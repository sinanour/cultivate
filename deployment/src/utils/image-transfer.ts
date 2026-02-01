/**
 * Image transfer module
 * Transfers Docker images from local machine to remote hosts
 * 
 * Requirements:
 * - 9.3: Transfer Docker images to target host
 * - 9.5: Provide progress feedback during image transfer operations
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { SSHClient } from './ssh-client.js';
import { ImageBuilder } from './image-builder.js';
import type { ContainerRuntime } from '../types/deployment.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Options for transferring an image to a remote host
 */
export interface ImageTransferOptions {
  /** SSH client connected to remote host */
  sshClient: SSHClient;

  /** Image tag to transfer (e.g., "cultivate_frontend:1.0.0") */
  imageTag: string;

  /** Optional container runtime (auto-detected if not specified) */
  runtime?: ContainerRuntime;

  /** Remote directory for temporary files (default: /tmp/docker-images) */
  remoteTempDir?: string;

  /** Whether to clean up local tar file after transfer */
  cleanupLocal?: boolean;
}

/**
 * Progress callback for image transfer operations
 */
export type TransferProgressCallback = (message: string, bytesTransferred?: number, totalBytes?: number) => void;

/**
 * Result of an image transfer operation
 */
export interface ImageTransferResult {
  /** Whether transfer was successful */
  success: boolean;

  /** Image tag that was transferred */
  imageTag: string;

  /** Size of transferred image in bytes */
  size: number;

  /** Time taken for transfer in milliseconds */
  transferTime: number;

  /** Error message if transfer failed */
  error?: string;
}

/**
 * Image transfer class
 * Handles transferring Docker/Finch images to remote hosts
 */
export class ImageTransfer {
  private readonly DEFAULT_REMOTE_TEMP_DIR = '/tmp/docker-images';
  private imageBuilder: ImageBuilder;

  constructor() {
    this.imageBuilder = new ImageBuilder();
  }

  /**
   * Detect container runtime on remote host
   */
  private async detectRemoteRuntime(sshClient: SSHClient): Promise<string> {
    // Try finch first (for macOS) with multiple paths
    const finchPaths = [
      'finch',
      '/usr/local/bin/finch',
      '/opt/homebrew/bin/finch',
      '$HOME/.finch/bin/finch',
    ];

    for (const finchPath of finchPaths) {
      const result = await sshClient.executeCommand(`command -v ${finchPath} || ${finchPath} --version`);
      if (result.exitCode === 0) {
        logger.debug(`Detected Finch on remote host at: ${finchPath}`);
        return finchPath;
      }
    }

    // Fall back to docker
    logger.debug('Detected Docker on remote host');
    return 'docker';
  }

  /**
   * Ensure Finch VM is running on remote host
   * Checks VM status and starts it if stopped
   */
  private async ensureRemoteFinchVMRunning(
    sshClient: SSHClient,
    finchPath: string,
    onProgress?: TransferProgressCallback
  ): Promise<void> {
    logger.debug('Checking Finch VM status on remote host');

    // Check VM status
    const statusResult = await sshClient.executeCommand(`${finchPath} vm status 2>&1`);
    const statusOutput = statusResult.stdout.toLowerCase();

    // If VM is not initialized, initialize it
    if (statusOutput.includes('nonexistent') || statusOutput.includes('not found') || statusResult.exitCode !== 0) {
      logger.info('Finch VM not initialized on remote host, initializing (this may take up to 2 minutes)...');
      if (onProgress) {
        onProgress('Initializing Finch VM on remote host (this may take up to 2 minutes)...');
      }

      const initResult = await sshClient.executeCommand(`${finchPath} vm init 2>&1`);
      if (initResult.exitCode !== 0 && !initResult.stdout.includes('already exists')) {
        throw new Error(`Failed to initialize Finch VM: ${initResult.stderr || initResult.stdout}`);
      }

      logger.info('Finch VM initialized on remote host');

      // Wait for VM to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      return;
    }

    // If VM is stopped, start it
    if (statusOutput.includes('stopped')) {
      logger.info('Finch VM is stopped on remote host, starting (this may take up to 2 minutes)...');
      if (onProgress) {
        onProgress('Starting Finch VM on remote host (this may take up to 2 minutes)...');
      }

      const startResult = await sshClient.executeCommand(`${finchPath} vm start 2>&1`);
      if (startResult.exitCode !== 0) {
        throw new Error(`Failed to start Finch VM: ${startResult.stderr || startResult.stdout}`);
      }

      logger.info('Finch VM started on remote host');

      // Wait for VM to be fully ready
      if (onProgress) {
        onProgress('Waiting for Finch VM to be fully ready...');
      }
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second wait
    } else {
      logger.debug('Finch VM is already running on remote host');
    }
  }

  /**
   * Transfer a Docker image to a remote host
   * 
   * Process:
   * 1. Save image to tar file using docker save
   * 2. Transfer tar file via SSH/SCP
   * 3. Load image on remote host using docker load
   * 4. Verify image exists on remote host
   * 5. Clean up temporary files
   * 
   * @param options Transfer options
   * @param onProgress Optional progress callback
   * @returns Transfer result
   */
  async transferImage(
    options: ImageTransferOptions,
    onProgress?: TransferProgressCallback
  ): Promise<ImageTransferResult> {
    const { sshClient, imageTag } = options;
    const remoteTempDir = options.remoteTempDir || this.DEFAULT_REMOTE_TEMP_DIR;
    const cleanupLocal = options.cleanupLocal !== false; // Default to true

    const startTime = Date.now();

    logger.info('Transferring Docker image to remote host', {
      imageTag,
      remoteTempDir
    });

    if (!sshClient.isConnected()) {
      throw new Error('SSH client is not connected');
    }

    // Detect remote runtime
    const remoteRuntime = await this.detectRemoteRuntime(sshClient);
    logger.info(`Using remote runtime: ${remoteRuntime}`);

    let localTarPath: string | null = null;
    let remoteTarPath: string | null = null;

    try {
      // Step 1: Save image to tar file
      if (onProgress) {
        onProgress('Saving image to tar file...');
      }

      localTarPath = await this.saveImageToTar(
        imageTag,
        options.runtime,
        onProgress
      );

      const tarStats = await fs.stat(localTarPath);
      const imageSize = tarStats.size;

      logger.debug('Image saved to tar file', {
        imageTag,
        localTarPath,
        size: imageSize
      });

      // Step 2: Create remote temp directory
      if (onProgress) {
        onProgress('Creating remote directory...');
      }

      await this.createRemoteTempDir(sshClient, remoteTempDir);

      // Step 3: Transfer tar file via SSH
      if (onProgress) {
        onProgress('Transferring image to remote host...', 0, imageSize);
      }

      remoteTarPath = await this.transferTarFile(
        sshClient,
        localTarPath,
        remoteTempDir,
        imageSize,
        onProgress
      );

      // Step 4: Load image on remote host
      if (onProgress) {
        onProgress('Loading image on remote host...');
      }

      await this.loadImageOnRemote(
        sshClient,
        remoteTarPath,
        imageTag,
        remoteRuntime,
        onProgress
      );

      // Step 5: Verify image exists on remote host
      if (onProgress) {
        onProgress('Verifying image on remote host...');
      }

      const verified = await this.verifyRemoteImage(sshClient, imageTag, remoteRuntime);
      if (!verified) {
        throw new Error('Image verification failed on remote host');
      }

      // Step 6: Clean up temporary files
      if (onProgress) {
        onProgress('Cleaning up temporary files...');
      }

      await this.cleanupTempFiles(
        sshClient,
        localTarPath,
        remoteTarPath,
        cleanupLocal
      );

      const transferTime = Date.now() - startTime;

      if (onProgress) {
        onProgress(`Successfully transferred ${imageTag} (${this.formatBytes(imageSize)} in ${this.formatTime(transferTime)})`);
      }

      logger.info('Image transfer completed successfully', {
        imageTag,
        size: imageSize,
        transferTime
      });

      return {
        success: true,
        imageTag,
        size: imageSize,
        transferTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const transferTime = Date.now() - startTime;

      logger.error('Image transfer failed', {
        imageTag,
        error: errorMessage,
        transferTime
      });

      // Attempt cleanup even on failure
      if (localTarPath && remoteTarPath) {
        try {
          await this.cleanupTempFiles(
            sshClient,
            localTarPath,
            remoteTarPath,
            cleanupLocal
          );
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temporary files', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
        }
      }

      if (onProgress) {
        onProgress(`Transfer failed: ${errorMessage}`);
      }

      return {
        success: false,
        imageTag,
        size: 0,
        transferTime,
        error: errorMessage
      };
    }
  }

  /**
   * Save a Docker image to a tar file
   */
  private async saveImageToTar(
    imageTag: string,
    runtime?: ContainerRuntime,
    onProgress?: TransferProgressCallback
  ): Promise<string> {
    logger.debug('Saving image to tar file', { imageTag });

    // Create temporary directory for tar file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docker-image-'));
    const tarFileName = `${imageTag.replace(/[/:]/g, '_')}.tar`;
    const tarPath = path.join(tempDir, tarFileName);

    // Use ImageBuilder to save the image
    await this.imageBuilder.saveImage({
      imageTag,
      outputPath: tarPath,
      runtime
    }, (message) => {
      if (onProgress) {
        onProgress(message);
      }
    });

    logger.debug('Image saved to tar file', { imageTag, tarPath });

    return tarPath;
  }

  /**
   * Create remote temporary directory
   */
  private async createRemoteTempDir(
    sshClient: SSHClient,
    remoteTempDir: string
  ): Promise<void> {
    logger.debug('Creating remote temp directory', { remoteTempDir });

    const command = `mkdir -p ${remoteTempDir} && chmod 755 ${remoteTempDir}`;
    const result = await sshClient.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create remote temp directory: ${result.stderr}`);
    }

    logger.debug('Remote temp directory created', { remoteTempDir });
  }

  /**
   * Transfer tar file to remote host via SSH
   */
  private async transferTarFile(
    sshClient: SSHClient,
    localTarPath: string,
    remoteTempDir: string,
    fileSize: number,
    onProgress?: TransferProgressCallback
  ): Promise<string> {
    logger.debug('Transferring tar file to remote host', {
      localTarPath,
      remoteTempDir,
      fileSize
    });

    const tarFileName = path.basename(localTarPath);
    const remoteTarPath = path.join(remoteTempDir, tarFileName);

    // Upload file via SFTP
    // Note: The SSHClient.uploadFile method doesn't provide progress callbacks,
    // but we can report the start and completion
    if (onProgress) {
      onProgress(`Uploading ${this.formatBytes(fileSize)}...`, 0, fileSize);
    }

    await sshClient.uploadFile(localTarPath, remoteTarPath);

    if (onProgress) {
      onProgress(`Upload complete`, fileSize, fileSize);
    }

    logger.debug('Tar file transferred to remote host', { remoteTarPath });

    return remoteTarPath;
  }

  /**
   * Load Docker/Finch image on remote host from tar file
   */
  private async loadImageOnRemote(
    sshClient: SSHClient,
    remoteTarPath: string,
    imageTag: string,
    remoteRuntime: string,
    onProgress?: TransferProgressCallback
  ): Promise<void> {
    logger.debug('Loading image on remote host', {
      remoteTarPath,
      imageTag,
      runtime: remoteRuntime
    });

    // For Finch on macOS, we need to use stdin redirection because the VM may not have access to /tmp
    const isFinch = remoteRuntime.includes('finch');

    // If Finch, ensure VM is running before attempting to load
    if (isFinch) {
      await this.ensureRemoteFinchVMRunning(sshClient, remoteRuntime, onProgress);
    }

    let command: string;
    let result: any;

    if (isFinch) {
      // Use cat to pipe the tar file into finch load via stdin
      // This works because cat runs on the host and finch load reads from stdin
      logger.debug('Using stdin redirection for Finch load', { imageTag });
      command = `cat ${remoteTarPath} | ${remoteRuntime} load`;
      result = await sshClient.executeCommand(command);

      // If permission denied, try with sudo on the finch command
      if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
        logger.debug('Finch permission denied, retrying with sudo', { imageTag });
        command = `cat ${remoteTarPath} | sudo ${remoteRuntime} load`;
        result = await sshClient.executeCommand(command);
      }
    } else {
      // For Docker, use the -i flag directly
      command = `${remoteRuntime} load -i ${remoteTarPath}`;
      result = await sshClient.executeCommand(command);

      // If permission denied, try with sudo
      if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
        logger.debug('Docker permission denied, retrying with sudo', { imageTag });
        command = `sudo ${remoteRuntime} load -i ${remoteTarPath}`;
        result = await sshClient.executeCommand(command);
      }
    }

    if (result.exitCode !== 0) {
      throw new Error(`Failed to load image on remote host: ${result.stderr}`);
    }

    // Log load output
    if (result.stdout) {
      logger.debug('Container runtime load output', { stdout: result.stdout });
      if (onProgress) {
        onProgress(`  ${result.stdout.trim()}`);
      }
    }

    logger.debug('Image loaded on remote host', { imageTag });
  }

  /**
   * Verify that image exists on remote host
   */
  private async verifyRemoteImage(
    sshClient: SSHClient,
    imageTag: string,
    remoteRuntime: string
  ): Promise<boolean> {
    logger.debug('Verifying image on remote host', { imageTag, runtime: remoteRuntime });

    // Try images command without sudo first
    let command = `${remoteRuntime} images -q ${imageTag}`;
    let result = await sshClient.executeCommand(command);

    // If permission denied, try with sudo
    if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
      logger.debug('Container runtime permission denied, retrying with sudo', { imageTag });
      command = `sudo ${remoteRuntime} images -q ${imageTag}`;
      result = await sshClient.executeCommand(command);
    }

    if (result.exitCode !== 0) {
      logger.warn('Failed to verify remote image', {
        imageTag,
        error: result.stderr
      });
      return false;
    }

    const exists = result.stdout.trim().length > 0;

    logger.debug('Image verification result', { imageTag, exists });

    return exists;
  }

  /**
   * Clean up temporary files on local and remote hosts
   */
  private async cleanupTempFiles(
    sshClient: SSHClient,
    localTarPath: string,
    remoteTarPath: string,
    cleanupLocal: boolean
  ): Promise<void> {
    logger.debug('Cleaning up temporary files', {
      localTarPath,
      remoteTarPath,
      cleanupLocal
    });

    // Clean up local tar file
    if (cleanupLocal) {
      try {
        const tempDir = path.dirname(localTarPath);
        await fs.rm(tempDir, { recursive: true, force: true });
        logger.debug('Local tar file cleaned up', { localTarPath });
      } catch (error) {
        logger.warn('Failed to cleanup local tar file', {
          localTarPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Clean up remote tar file
    try {
      const command = `rm -f ${remoteTarPath}`;
      const result = await sshClient.executeCommand(command);

      if (result.exitCode !== 0) {
        logger.warn('Failed to cleanup remote tar file', {
          remoteTarPath,
          error: result.stderr
        });
      } else {
        logger.debug('Remote tar file cleaned up', { remoteTarPath });
      }
    } catch (error) {
      logger.warn('Failed to cleanup remote tar file', {
        remoteTarPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format milliseconds to human-readable time string
   */
  private formatTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}

/**
 * Transfer all three application images to a remote host
 * 
 * @param sshClient Connected SSH client
 * @param version Version tag of the images
 * @param onProgress Optional progress callback
 * @returns Array of transfer results
 */
export async function transferAllImages(
  sshClient: SSHClient,
  version: string,
  onProgress?: TransferProgressCallback
): Promise<ImageTransferResult[]> {
  const transfer = new ImageTransfer();

  logger.info('Transferring all application images to remote host', {
    version
  });

  const results: ImageTransferResult[] = [];

  // Define images to transfer
  const imagesToTransfer = [
    `cultivate_frontend:${version}`,
    `cultivate_backend:${version}`,
    `cultivate_database:${version}`
  ];

  // Transfer each image
  for (const imageTag of imagesToTransfer) {
    if (onProgress) {
      onProgress(`\nTransferring ${imageTag}...`);
    }

    const result = await transfer.transferImage({
      sshClient,
      imageTag
    }, onProgress);

    results.push(result);

    if (!result.success) {
      logger.error('Image transfer failed, stopping batch transfer', {
        imageTag,
        error: result.error
      });
      throw new Error(`Failed to transfer ${imageTag}: ${result.error}`);
    }
  }

  logger.info('All images transferred successfully', {
    version,
    count: results.length
  });

  if (onProgress) {
    onProgress(`\nAll images transferred successfully (version: ${version})`);
  }

  return results;
}

/**
 * Verify that all application images exist on remote host
 * 
 * @param sshClient Connected SSH client
 * @param version Version tag of the images
 * @returns True if all images exist
 */
export async function verifyAllImagesOnRemote(
  sshClient: SSHClient,
  version: string
): Promise<boolean> {
  logger.info('Verifying all images on remote host', { version });

  // Detect remote runtime
  const transfer = new ImageTransfer();
  const remoteRuntime = await (transfer as any).detectRemoteRuntime(sshClient);
  logger.debug(`Using remote runtime for verification: ${remoteRuntime}`);

  const imagesToVerify = [
    `cultivate_frontend:${version}`,
    `cultivate_backend:${version}`,
    `cultivate_database:${version}`
  ];

  for (const imageTag of imagesToVerify) {
    // Try images command without sudo first
    let command = `${remoteRuntime} images -q ${imageTag}`;
    let result = await sshClient.executeCommand(command);

    // If permission denied, try with sudo
    if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
      logger.debug('Container runtime permission denied, retrying with sudo', { imageTag });
      command = `sudo ${remoteRuntime} images -q ${imageTag}`;
      result = await sshClient.executeCommand(command);
    }

    if (result.exitCode !== 0 || result.stdout.trim().length === 0) {
      logger.warn('Image not found on remote host', { imageTag });
      return false;
    }

    logger.debug('Image verified on remote host', { imageTag });
  }

  logger.info('All images verified on remote host', { version });

  return true;
}
