/**
 * Local image builder module
 * Builds Docker images locally using either Docker or Finch
 * 
 * Requirements:
 * - 9.1: Support building Docker images locally before transfer
 * - 9.5: Provide progress feedback during image build operations
 * - 9.6: Support Finch on macOS as alternative to Docker
 * - 9.7: Automatically detect available container runtime
 * - 9.8: Use compatible commands for both Docker and Finch
 * - 14.3: Tag images with version information for rollback
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ContainerRuntime, DockerImage } from '../types/deployment.js';
import { detectContainerRuntime, verifyContainerRuntime } from './container-runtime.js';
import { createLogger } from './logger.js';

const execAsync = promisify(exec);
const logger = createLogger();

/**
 * Options for building a Docker image
 */
export interface ImageBuildOptions {
  /** Path to Dockerfile */
  dockerfile: string;

  /** Build context directory */
  context: string;

  /** Image name (without tag) */
  imageName: string;

  /** Image tag/version */
  tag: string;

  /** Optional build arguments */
  buildArgs?: Record<string, string>;

  /** Whether to show detailed build output */
  verbose?: boolean;

  /** Container runtime to use (auto-detected if not specified) */
  runtime?: ContainerRuntime;
}

/**
 * Options for saving a Docker image to a tar file
 */
export interface ImageSaveOptions {
  /** Image name with tag (e.g., "cat_frontend:1.0.0") */
  imageTag: string;

  /** Output file path for the tar file */
  outputPath: string;

  /** Container runtime to use */
  runtime?: ContainerRuntime;
}

/**
 * Progress callback for build operations
 */
export type ProgressCallback = (message: string) => void;

/**
 * Image builder class
 * Handles building, tagging, and saving Docker images
 */
export class ImageBuilder {
  private runtime: ContainerRuntime | null = null;

  /**
   * Initialize the image builder
   * Detects and verifies the container runtime
   */
  async initialize(): Promise<void> {
    logger.info('Initializing image builder...');

    // Detect available container runtime
    this.runtime = await detectContainerRuntime();

    // Verify runtime is functional
    const isVerified = await verifyContainerRuntime(this.runtime);
    if (!isVerified) {
      throw new Error(`Container runtime ${this.runtime.name} is not functional`);
    }

    logger.info(`Image builder initialized with ${this.runtime.name}`);
  }

  /**
   * Get the current container runtime
   * Initializes if not already done
   */
  async getRuntime(): Promise<ContainerRuntime> {
    if (!this.runtime) {
      await this.initialize();
    }
    return this.runtime!;
  }

  /**
   * Build a Docker image from a Dockerfile
   * 
   * @param options Build options
   * @param onProgress Optional progress callback
   * @returns DockerImage metadata
   */
  async buildImage(
    options: ImageBuildOptions,
    onProgress?: ProgressCallback
  ): Promise<DockerImage> {
    const runtime = options.runtime || await this.getRuntime();
    const fullImageTag = `${options.imageName}:${options.tag}`;

    logger.info('Building Docker image', {
      image: fullImageTag,
      dockerfile: options.dockerfile,
      context: options.context,
      runtime: runtime.name
    });

    // Verify Dockerfile exists
    try {
      await fs.access(options.dockerfile);
    } catch (error) {
      throw new Error(`Dockerfile not found: ${options.dockerfile}`);
    }

    // Verify context directory exists
    try {
      await fs.access(options.context);
    } catch (error) {
      throw new Error(`Build context directory not found: ${options.context}`);
    }

    // Build the docker build command
    const buildArgs = this.formatBuildArgs(options.buildArgs);
    const command = [
      runtime.buildCommand,
      'build',
      '-f', options.dockerfile,
      '-t', fullImageTag,
      ...buildArgs,
      options.context
    ].join(' ');

    logger.debug('Executing build command', { command });

    if (onProgress) {
      onProgress(`Building image ${fullImageTag}...`);
    }

    try {
      // Execute build command
      // Note: We use exec instead of dockerode because:
      // 1. Finch doesn't have a programmatic API like dockerode
      // 2. exec commands work with both Docker and Finch
      // 3. Easier to capture and stream build output
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for build output
        cwd: options.context
      });

      // Log build output
      if (options.verbose && stdout) {
        logger.debug('Build output', { stdout });
      }

      if (stderr && !stderr.includes('WARNING')) {
        logger.warn('Build stderr', { stderr });
      }

      if (onProgress) {
        onProgress(`Successfully built ${fullImageTag}`);
      }

      logger.info('Image built successfully', { image: fullImageTag });

      // Get image metadata
      const imageMetadata = await this.getImageMetadata(fullImageTag, runtime);

      return imageMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Image build failed', {
        image: fullImageTag,
        error: errorMessage
      });

      if (onProgress) {
        onProgress(`Build failed: ${errorMessage}`);
      }

      throw new Error(`Failed to build image ${fullImageTag}: ${errorMessage}`);
    }
  }

  /**
   * Tag an existing image with a new tag
   * 
   * @param sourceTag Source image tag
   * @param targetTag Target image tag
   * @param runtime Container runtime to use
   */
  async tagImage(
    sourceTag: string,
    targetTag: string,
    runtime?: ContainerRuntime
  ): Promise<void> {
    const rt = runtime || await this.getRuntime();

    logger.info('Tagging image', {
      source: sourceTag,
      target: targetTag,
      runtime: rt.name
    });

    const command = `${rt.buildCommand} tag ${sourceTag} ${targetTag}`;

    try {
      await execAsync(command);
      logger.info('Image tagged successfully', {
        source: sourceTag,
        target: targetTag
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Image tagging failed', {
        source: sourceTag,
        target: targetTag,
        error: errorMessage
      });
      throw new Error(`Failed to tag image: ${errorMessage}`);
    }
  }

  /**
   * Save a Docker image to a tar file
   * Used for transferring images to remote hosts
   * 
   * @param options Save options
   * @param onProgress Optional progress callback
   */
  async saveImage(
    options: ImageSaveOptions,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const runtime = options.runtime || await this.getRuntime();

    logger.info('Saving image to tar file', {
      image: options.imageTag,
      output: options.outputPath,
      runtime: runtime.name
    });

    if (onProgress) {
      onProgress(`Saving image ${options.imageTag} to ${options.outputPath}...`);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(options.outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    const command = `${runtime.buildCommand} save ${options.imageTag} -o ${options.outputPath}`;

    try {
      await execAsync(command);

      if (onProgress) {
        onProgress(`Image saved to ${options.outputPath}`);
      }

      logger.info('Image saved successfully', {
        image: options.imageTag,
        output: options.outputPath
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Image save failed', {
        image: options.imageTag,
        error: errorMessage
      });

      if (onProgress) {
        onProgress(`Save failed: ${errorMessage}`);
      }

      throw new Error(`Failed to save image ${options.imageTag}: ${errorMessage}`);
    }
  }

  /**
   * List all Docker images
   * 
   * @param runtime Container runtime to use
   * @returns Array of image tags
   */
  async listImages(runtime?: ContainerRuntime): Promise<string[]> {
    const rt = runtime || await this.getRuntime();

    logger.debug('Listing images', { runtime: rt.name });

    const command = `${rt.buildCommand} images --format "{{.Repository}}:{{.Tag}}"`;

    try {
      const { stdout } = await execAsync(command);
      const images = stdout
        .trim()
        .split('\n')
        .filter(line => line.length > 0);

      logger.debug('Images listed', { count: images.length });

      return images;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to list images', { error: errorMessage });
      throw new Error(`Failed to list images: ${errorMessage}`);
    }
  }

  /**
   * Check if an image exists locally
   * 
   * @param imageTag Image tag to check
   * @param runtime Container runtime to use
   * @returns True if image exists
   */
  async imageExists(imageTag: string, runtime?: ContainerRuntime): Promise<boolean> {
    const rt = runtime || await this.getRuntime();

    logger.debug('Checking if image exists', { image: imageTag });

    const command = `${rt.buildCommand} images -q ${imageTag}`;

    try {
      const { stdout } = await execAsync(command);
      const exists = stdout.trim().length > 0;

      logger.debug('Image existence check', { image: imageTag, exists });

      return exists;
    } catch (error) {
      logger.debug('Image does not exist', { image: imageTag });
      return false;
    }
  }

  /**
   * Remove a Docker image
   * 
   * @param imageTag Image tag to remove
   * @param runtime Container runtime to use
   */
  async removeImage(imageTag: string, runtime?: ContainerRuntime): Promise<void> {
    const rt = runtime || await this.getRuntime();

    logger.info('Removing image', { image: imageTag, runtime: rt.name });

    const command = `${rt.buildCommand} rmi ${imageTag}`;

    try {
      await execAsync(command);
      logger.info('Image removed successfully', { image: imageTag });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to remove image', {
        image: imageTag,
        error: errorMessage
      });
      throw new Error(`Failed to remove image ${imageTag}: ${errorMessage}`);
    }
  }

  /**
   * Get metadata for a Docker image
   * 
   * @param imageTag Image tag
   * @param runtime Container runtime to use
   * @returns DockerImage metadata
   */
  private async getImageMetadata(
    imageTag: string,
    runtime: ContainerRuntime
  ): Promise<DockerImage> {
    logger.debug('Getting image metadata', { image: imageTag });

    // Get image inspect output
    const command = `${runtime.buildCommand} inspect ${imageTag} --format "{{json .}}"`;

    try {
      const { stdout } = await execAsync(command);
      const inspectData = JSON.parse(stdout);

      // Extract relevant metadata
      const [name, tag] = imageTag.split(':');

      const metadata: DockerImage = {
        name,
        tag: tag || 'latest',
        digest: inspectData.Id || '',
        size: inspectData.Size || 0,
        buildTimestamp: new Date(inspectData.Created || Date.now()),
        buildHost: 'local'
      };

      logger.debug('Image metadata retrieved', { metadata });

      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get image metadata', {
        image: imageTag,
        error: errorMessage
      });

      // Return minimal metadata if inspect fails
      const [name, tag] = imageTag.split(':');
      return {
        name,
        tag: tag || 'latest',
        digest: '',
        size: 0,
        buildTimestamp: new Date(),
        buildHost: 'local'
      };
    }
  }

  /**
   * Format build arguments for docker build command
   * 
   * @param buildArgs Build arguments object
   * @returns Array of formatted build arg strings
   */
  private formatBuildArgs(buildArgs?: Record<string, string>): string[] {
    if (!buildArgs) {
      return [];
    }

    return Object.entries(buildArgs).flatMap(([key, value]) => [
      '--build-arg',
      `${key}=${value}`
    ]);
  }
}

/**
 * Build all three application images (frontend, backend, database)
 * 
 * @param version Version tag for the images
 * @param contextPath Base context path (project root)
 * @param dockerfilesPath Path to directory containing Dockerfiles
 * @param onProgress Optional progress callback
 * @returns Array of built image metadata
 */
export async function buildAllImages(
  version: string,
  contextPath: string,
  dockerfilesPath: string,
  onProgress?: ProgressCallback
): Promise<DockerImage[]> {
  const builder = new ImageBuilder();
  await builder.initialize();

  logger.info('Building all application images', { version, contextPath, dockerfilesPath });

  const images: DockerImage[] = [];

  // Build frontend image
  if (onProgress) {
    onProgress('Building frontend image...');
  }

  // For production, the API is accessed via the same host (reverse proxy or same domain)
  // Use relative path /api or the backend service URL
  const frontendImage = await builder.buildImage({
    dockerfile: path.join(dockerfilesPath, 'Dockerfile.frontend'),
    context: contextPath,
    imageName: 'cat_frontend',
    tag: version,
    buildArgs: {
      BACKEND_URL: process.env.BACKEND_URL || '/api/v1'
    },
    verbose: true
  }, onProgress);

  images.push(frontendImage);

  // Build backend image
  if (onProgress) {
    onProgress('Building backend image...');
  }

  const backendImage = await builder.buildImage({
    dockerfile: path.join(dockerfilesPath, 'Dockerfile.backend'),
    context: contextPath,
    imageName: 'cat_backend',
    tag: version,
    verbose: true
  }, onProgress);

  images.push(backendImage);

  // Build database image
  if (onProgress) {
    onProgress('Building database image...');
  }

  const databaseImage = await builder.buildImage({
    dockerfile: path.join(dockerfilesPath, 'Dockerfile.database'),
    context: contextPath,
    imageName: 'cat_database',
    tag: version,
    verbose: true
  }, onProgress);

  images.push(databaseImage);

  logger.info('All images built successfully', {
    version,
    count: images.length
  });

  if (onProgress) {
    onProgress(`All images built successfully (version: ${version})`);
  }

  return images;
}

/**
 * Save all application images to tar files
 * 
 * @param version Version tag of the images
 * @param outputDir Directory to save tar files
 * @param onProgress Optional progress callback
 * @returns Array of output file paths
 */
export async function saveAllImages(
  version: string,
  outputDir: string,
  onProgress?: ProgressCallback
): Promise<string[]> {
  const builder = new ImageBuilder();
  await builder.initialize();

  logger.info('Saving all application images', { version, outputDir });

  const outputPaths: string[] = [];

  // Define images to save
  const imagesToSave = [
    { name: 'cat_frontend', tag: version },
    { name: 'cat_backend', tag: version },
    { name: 'cat_database', tag: version }
  ];

  // Save each image
  for (const image of imagesToSave) {
    const imageTag = `${image.name}:${image.tag}`;
    const outputPath = path.join(outputDir, `${image.name}-${image.tag}.tar`);

    await builder.saveImage({
      imageTag,
      outputPath
    }, onProgress);

    outputPaths.push(outputPath);
  }

  logger.info('All images saved successfully', {
    version,
    count: outputPaths.length
  });

  if (onProgress) {
    onProgress(`All images saved to ${outputDir}`);
  }

  return outputPaths;
}
