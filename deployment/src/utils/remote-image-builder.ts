/**
 * Remote image builder module
 * Builds Docker images on remote hosts via SSH
 * 
 * Requirements:
 * - 9.2: Support building Docker images directly on the target host
 * - 9.5: Provide progress feedback during image build operations
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { SSHClient } from './ssh-client.js';
import type { DockerImage } from '../types/deployment.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Options for building an image on a remote host
 */
export interface RemoteImageBuildOptions {
  /** SSH client connected to remote host */
  sshClient: SSHClient;

  /** Path to Dockerfile on local machine */
  dockerfile: string;

  /** Build context directory on local machine */
  context: string;

  /** Image name (without tag) */
  imageName: string;

  /** Image tag/version */
  tag: string;

  /** Optional build arguments */
  buildArgs?: Record<string, string>;

  /** Whether to show detailed build output */
  verbose?: boolean;

  /** Remote working directory (default: /tmp/docker-build) */
  remoteWorkDir?: string;
}

/**
 * Progress callback for remote build operations
 */
export type RemoteProgressCallback = (message: string) => void;

/**
 * Remote image builder class
 * Handles building Docker images on remote hosts
 */
export class RemoteImageBuilder {
  private readonly DEFAULT_REMOTE_WORK_DIR = '/tmp/docker-build';

  /**
   * Build a Docker image on a remote host
   * 
   * Process:
   * 1. Create remote working directory
   * 2. Transfer Dockerfile and build context via SSH
   * 3. Execute docker build command on remote host
   * 4. Capture and stream build output
   * 5. Clean up temporary files
   * 
   * @param options Build options
   * @param onProgress Optional progress callback
   * @returns DockerImage metadata
   */
  async buildImage(
    options: RemoteImageBuildOptions,
    onProgress?: RemoteProgressCallback
  ): Promise<DockerImage> {
    const { sshClient, dockerfile, context, imageName, tag } = options;
    const fullImageTag = `${imageName}:${tag}`;
    const remoteWorkDir = options.remoteWorkDir || this.DEFAULT_REMOTE_WORK_DIR;

    logger.info('Building Docker image on remote host', {
      image: fullImageTag,
      dockerfile,
      context,
      remoteWorkDir
    });

    if (!sshClient.isConnected()) {
      throw new Error('SSH client is not connected');
    }

    // Verify local files exist
    await this.verifyLocalFiles(dockerfile, context);

    try {
      // Step 1: Create remote working directory
      if (onProgress) {
        onProgress('Creating remote working directory...');
      }
      await this.createRemoteWorkDir(sshClient, remoteWorkDir);

      // Step 2: Transfer Dockerfile and build context
      if (onProgress) {
        onProgress('Transferring build context to remote host...');
      }
      const remoteBuildContext = await this.transferBuildContext(
        sshClient,
        dockerfile,
        context,
        remoteWorkDir,
        onProgress
      );

      // Step 3: Execute docker build on remote host
      if (onProgress) {
        onProgress(`Building image ${fullImageTag} on remote host...`);
      }
      await this.executeBuildCommand(
        sshClient,
        remoteBuildContext,
        fullImageTag,
        options.buildArgs,
        options.verbose,
        onProgress
      );

      // Step 4: Get image metadata
      if (onProgress) {
        onProgress('Retrieving image metadata...');
      }
      const imageMetadata = await this.getRemoteImageMetadata(
        sshClient,
        fullImageTag
      );

      // Step 5: Clean up remote working directory
      if (onProgress) {
        onProgress('Cleaning up temporary files...');
      }
      await this.cleanupRemoteWorkDir(sshClient, remoteWorkDir);

      if (onProgress) {
        onProgress(`Successfully built ${fullImageTag} on remote host`);
      }

      logger.info('Remote image build completed successfully', {
        image: fullImageTag
      });

      return imageMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Remote image build failed', {
        image: fullImageTag,
        error: errorMessage
      });

      // Attempt cleanup even on failure
      try {
        await this.cleanupRemoteWorkDir(sshClient, remoteWorkDir);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup remote work directory', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        });
      }

      if (onProgress) {
        onProgress(`Build failed: ${errorMessage}`);
      }

      throw new Error(`Failed to build image ${fullImageTag} on remote host: ${errorMessage}`);
    }
  }

  /**
   * Verify that local Dockerfile and context exist
   */
  private async verifyLocalFiles(dockerfile: string, context: string): Promise<void> {
    try {
      await fs.access(dockerfile);
    } catch (error) {
      throw new Error(`Dockerfile not found: ${dockerfile}`);
    }

    try {
      const stats = await fs.stat(context);
      if (!stats.isDirectory()) {
        throw new Error(`Build context is not a directory: ${context}`);
      }
    } catch (error) {
      throw new Error(`Build context directory not found: ${context}`);
    }
  }

  /**
   * Create remote working directory
   */
  private async createRemoteWorkDir(
    sshClient: SSHClient,
    remoteWorkDir: string
  ): Promise<void> {
    logger.debug('Creating remote working directory', { remoteWorkDir });

    const command = `mkdir -p ${remoteWorkDir} && chmod 755 ${remoteWorkDir}`;
    const result = await sshClient.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create remote working directory: ${result.stderr}`);
    }

    logger.debug('Remote working directory created', { remoteWorkDir });
  }

  /**
   * Transfer Dockerfile and build context to remote host
   * 
   * Creates a tarball of the build context locally, transfers it via SSH,
   * and extracts it on the remote host.
   */
  private async transferBuildContext(
    sshClient: SSHClient,
    dockerfile: string,
    context: string,
    remoteWorkDir: string,
    onProgress?: RemoteProgressCallback
  ): Promise<{ dockerfile: string; context: string }> {
    logger.debug('Transferring build context', {
      dockerfile,
      context,
      remoteWorkDir
    });

    // Create a temporary tarball of the build context
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docker-build-'));
    const tarballPath = path.join(tempDir, 'build-context.tar.gz');

    try {
      // Create tarball of build context
      if (onProgress) {
        onProgress('Creating tarball of build context...');
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Get relative path of Dockerfile from context
      const dockerfileRelative = path.relative(context, dockerfile);

      // Create tarball including Dockerfile
      const tarCommand = `tar -czf ${tarballPath} -C ${context} .`;
      await execAsync(tarCommand);

      logger.debug('Build context tarball created', { tarballPath });

      // Transfer tarball to remote host
      if (onProgress) {
        onProgress('Uploading build context to remote host...');
      }

      const remoteTarball = path.join(remoteWorkDir, 'build-context.tar.gz');
      await sshClient.uploadFile(tarballPath, remoteTarball);

      logger.debug('Build context tarball uploaded', { remoteTarball });

      // Extract tarball on remote host
      if (onProgress) {
        onProgress('Extracting build context on remote host...');
      }

      const extractCommand = `cd ${remoteWorkDir} && tar -xzf build-context.tar.gz && rm build-context.tar.gz`;
      const extractResult = await sshClient.executeCommand(extractCommand);

      if (extractResult.exitCode !== 0) {
        throw new Error(`Failed to extract build context: ${extractResult.stderr}`);
      }

      logger.debug('Build context extracted on remote host');

      // Clean up local tarball
      await fs.rm(tempDir, { recursive: true, force: true });

      // Return remote paths
      return {
        dockerfile: path.join(remoteWorkDir, dockerfileRelative),
        context: remoteWorkDir
      };
    } catch (error) {
      // Clean up local tarball on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn('Failed to cleanup local tarball', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        });
      }

      throw error;
    }
  }

  /**
   * Execute docker build command on remote host
   * Captures and streams build output
   */
  private async executeBuildCommand(
    sshClient: SSHClient,
    remoteBuildContext: { dockerfile: string; context: string },
    imageTag: string,
    buildArgs?: Record<string, string>,
    verbose?: boolean,
    onProgress?: RemoteProgressCallback
  ): Promise<void> {
    logger.debug('Executing docker build on remote host', {
      dockerfile: remoteBuildContext.dockerfile,
      context: remoteBuildContext.context,
      imageTag
    });

    // Build the docker build command
    const buildArgsStr = this.formatBuildArgs(buildArgs);
    const command = [
      'docker',
      'build',
      '-f', remoteBuildContext.dockerfile,
      '-t', imageTag,
      buildArgsStr,
      remoteBuildContext.context
    ].filter(Boolean).join(' ');

    logger.debug('Docker build command', { command });

    // Execute build command
    const result = await sshClient.executeCommand(command);

    // Log build output
    if (verbose && result.stdout) {
      logger.debug('Build output', { stdout: result.stdout });
      if (onProgress) {
        // Stream build output line by line
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            onProgress(`  ${line}`);
          }
        }
      }
    }

    if (result.stderr && !result.stderr.includes('WARNING')) {
      logger.warn('Build stderr', { stderr: result.stderr });
    }

    if (result.exitCode !== 0) {
      const errorOutput = result.stderr || result.stdout;
      throw new Error(`Docker build failed with exit code ${result.exitCode}: ${errorOutput}`);
    }

    logger.debug('Docker build completed successfully');
  }

  /**
   * Get metadata for a Docker image on remote host
   */
  private async getRemoteImageMetadata(
    sshClient: SSHClient,
    imageTag: string
  ): Promise<DockerImage> {
    logger.debug('Getting remote image metadata', { imageTag });

    const command = `docker inspect ${imageTag} --format "{{json .}}"`;
    const result = await sshClient.executeCommand(command);

    if (result.exitCode !== 0) {
      logger.warn('Failed to get image metadata, using defaults', {
        error: result.stderr
      });

      // Return minimal metadata if inspect fails
      const [name, tag] = imageTag.split(':');
      return {
        name,
        tag: tag || 'latest',
        digest: '',
        size: 0,
        buildTimestamp: new Date(),
        buildHost: 'remote'
      };
    }

    try {
      const inspectData = JSON.parse(result.stdout);

      // Extract relevant metadata
      const [name, tag] = imageTag.split(':');

      const metadata: DockerImage = {
        name,
        tag: tag || 'latest',
        digest: inspectData.Id || '',
        size: inspectData.Size || 0,
        buildTimestamp: new Date(inspectData.Created || Date.now()),
        buildHost: 'remote'
      };

      logger.debug('Remote image metadata retrieved', { metadata });

      return metadata;
    } catch (error) {
      logger.warn('Failed to parse image metadata, using defaults', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Return minimal metadata if parsing fails
      const [name, tag] = imageTag.split(':');
      return {
        name,
        tag: tag || 'latest',
        digest: '',
        size: 0,
        buildTimestamp: new Date(),
        buildHost: 'remote'
      };
    }
  }

  /**
   * Clean up remote working directory
   */
  private async cleanupRemoteWorkDir(
    sshClient: SSHClient,
    remoteWorkDir: string
  ): Promise<void> {
    logger.debug('Cleaning up remote working directory', { remoteWorkDir });

    const command = `rm -rf ${remoteWorkDir}`;
    const result = await sshClient.executeCommand(command);

    if (result.exitCode !== 0) {
      logger.warn('Failed to cleanup remote working directory', {
        error: result.stderr
      });
    } else {
      logger.debug('Remote working directory cleaned up');
    }
  }

  /**
   * Format build arguments for docker build command
   */
  private formatBuildArgs(buildArgs?: Record<string, string>): string {
    if (!buildArgs || Object.keys(buildArgs).length === 0) {
      return '';
    }

    return Object.entries(buildArgs)
      .map(([key, value]) => `--build-arg ${key}=${value}`)
      .join(' ');
  }
}

/**
 * Build all three application images on a remote host
 * 
 * @param sshClient Connected SSH client
 * @param version Version tag for the images
 * @param contextPath Local path to build context containing Dockerfiles
 * @param onProgress Optional progress callback
 * @returns Array of built image metadata
 */
export async function buildAllImagesRemote(
  sshClient: SSHClient,
  version: string,
  contextPath: string,
  onProgress?: RemoteProgressCallback
): Promise<DockerImage[]> {
  const builder = new RemoteImageBuilder();

  logger.info('Building all application images on remote host', {
    version,
    contextPath
  });

  const images: DockerImage[] = [];

  // Build frontend image
  if (onProgress) {
    onProgress('Building frontend image on remote host...');
  }

  const frontendImage = await builder.buildImage({
    sshClient,
    dockerfile: path.join(contextPath, 'Dockerfile.frontend'),
    context: contextPath,
    imageName: 'cultivate_frontend',
    tag: version,
    verbose: true
  }, onProgress);

  images.push(frontendImage);

  // Build backend image
  if (onProgress) {
    onProgress('Building backend image on remote host...');
  }

  const backendImage = await builder.buildImage({
    sshClient,
    dockerfile: path.join(contextPath, 'Dockerfile.backend'),
    context: contextPath,
    imageName: 'cultivate_backend',
    tag: version,
    verbose: true
  }, onProgress);

  images.push(backendImage);

  // Build database image
  if (onProgress) {
    onProgress('Building database image on remote host...');
  }

  const databaseImage = await builder.buildImage({
    sshClient,
    dockerfile: path.join(contextPath, 'Dockerfile.database'),
    context: contextPath,
    imageName: 'cultivate_database',
    tag: version,
    verbose: true
  }, onProgress);

  images.push(databaseImage);

  logger.info('All images built successfully on remote host', {
    version,
    count: images.length
  });

  if (onProgress) {
    onProgress(`All images built successfully on remote host (version: ${version})`);
  }

  return images;
}
