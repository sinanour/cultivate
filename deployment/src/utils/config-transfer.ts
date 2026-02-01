import * as fs from 'fs';
import * as path from 'path';
import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';
import { DeploymentConfiguration } from '../types/deployment.js';

const logger = createLogger();

/**
 * Configuration transfer options
 */
export interface ConfigTransferOptions {
  /** Path to docker-compose.yml file */
  composeFilePath: string;
  /** Path to .env file */
  envFilePath: string;
  /** Optional path to certificates directory */
  certPath?: string;
  /** Target directory on remote host */
  targetDir: string;
  /** Whether to set file permissions after transfer */
  setPermissions?: boolean;
}

/**
 * File permission configuration
 */
export interface FilePermissions {
  /** File path on remote host */
  path: string;
  /** Permissions in octal format (e.g., '0644') */
  mode: string;
  /** Optional owner (user:group format) */
  owner?: string;
}

/**
 * Transfer result for a single file
 */
export interface FileTransferResult {
  /** Local file path */
  localPath: string;
  /** Remote file path */
  remotePath: string;
  /** Whether transfer succeeded */
  success: boolean;
  /** Error message if transfer failed */
  error?: string;
}

/**
 * Complete configuration transfer result
 */
export interface ConfigTransferResult {
  /** Whether all transfers succeeded */
  success: boolean;
  /** Individual file transfer results */
  files: FileTransferResult[];
  /** List of errors encountered */
  errors: string[];
}

/**
 * ConfigTransfer class for transferring configuration files to remote hosts
 * 
 * Features:
 * - Transfer docker-compose.yml to target host
 * - Transfer .env file with environment variables
 * - Transfer certificates if HTTPS is enabled
 * - Set appropriate file permissions on remote files
 * - Verify file transfers
 */
export class ConfigTransfer {
  private sshClient: SSHClient;

  /**
   * Creates a new ConfigTransfer instance
   * @param sshClient SSH client for remote operations
   */
  constructor(sshClient: SSHClient) {
    this.sshClient = sshClient;
  }

  /**
   * Transfers all configuration files to the remote host
   * @param options Configuration transfer options
   * @returns Promise that resolves with transfer result
   */
  async transferConfiguration(options: ConfigTransferOptions): Promise<ConfigTransferResult> {
    logger.info(`Starting configuration transfer to ${options.targetDir}`);

    const results: FileTransferResult[] = [];
    const errors: string[] = [];

    try {
      // Ensure target directory exists
      await this.ensureRemoteDirectory(options.targetDir);

      // Transfer docker-compose.yml
      const composeResult = await this.transferFile(
        options.composeFilePath,
        path.join(options.targetDir, 'docker-compose.yml')
      );
      results.push(composeResult);
      if (!composeResult.success) {
        errors.push(composeResult.error || 'Failed to transfer docker-compose.yml');
      }

      // Transfer .env file
      const envResult = await this.transferFile(
        options.envFilePath,
        path.join(options.targetDir, '.env')
      );
      results.push(envResult);
      if (!envResult.success) {
        errors.push(envResult.error || 'Failed to transfer .env file');
      }

      // Transfer certificates if provided
      if (options.certPath) {
        const certResults = await this.transferCertificates(
          options.certPath,
          path.join(options.targetDir, 'certs')
        );
        results.push(...certResults);
        
        const certErrors = certResults.filter(r => !r.success);
        if (certErrors.length > 0) {
          errors.push(...certErrors.map(r => r.error || 'Certificate transfer failed'));
        }
      }

      // Set file permissions if requested
      if (options.setPermissions) {
        await this.setFilePermissions(options.targetDir, results);
      }

      const success = errors.length === 0;
      logger.info(`Configuration transfer ${success ? 'completed successfully' : 'failed'}: ${results.length} files, ${errors.length} errors`);

      return {
        success,
        files: results,
        errors,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Configuration transfer failed: ${errorMessage}`);
      errors.push(errorMessage);

      return {
        success: false,
        files: results,
        errors,
      };
    }
  }

  /**
   * Transfers a single file to the remote host
   * @param localPath Local file path
   * @param remotePath Remote file path
   * @returns Promise that resolves with transfer result
   */
  async transferFile(localPath: string, remotePath: string): Promise<FileTransferResult> {
    logger.info(`Transferring file: ${localPath} -> ${remotePath}`);

    try {
      // Verify local file exists
      if (!fs.existsSync(localPath)) {
        const error = `Local file not found: ${localPath}`;
        logger.error(error);
        return {
          localPath,
          remotePath,
          success: false,
          error,
        };
      }

      // Transfer file via SSH
      await this.sshClient.uploadFile(localPath, remotePath);

      // Verify transfer
      const verified = await this.verifyFileTransfer(localPath, remotePath);
      if (!verified) {
        const error = 'File transfer verification failed';
        logger.error(error);
        return {
          localPath,
          remotePath,
          success: false,
          error,
        };
      }

      logger.info(`File transferred successfully: ${remotePath}`);
      return {
        localPath,
        remotePath,
        success: true,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`File transfer failed: ${error}`);
      return {
        localPath,
        remotePath,
        success: false,
        error,
      };
    }
  }

  /**
   * Transfers certificate files to the remote host
   * @param certPath Local certificates directory
   * @param remoteCertDir Remote certificates directory
   * @returns Promise that resolves with array of transfer results
   */
  async transferCertificates(certPath: string, remoteCertDir: string): Promise<FileTransferResult[]> {
    logger.info(`Transferring certificates from ${certPath} to ${remoteCertDir}`);

    const results: FileTransferResult[] = [];

    try {
      // Ensure remote certificate directory exists
      await this.ensureRemoteDirectory(remoteCertDir);

      // Check if certPath is a directory or file
      const stats = fs.statSync(certPath);

      if (stats.isDirectory()) {
        // Transfer all certificate files in directory
        const files = fs.readdirSync(certPath);
        const certFiles = files.filter(f => 
          f.endsWith('.pem') || 
          f.endsWith('.crt') || 
          f.endsWith('.key') ||
          f.endsWith('.cert')
        );

        for (const file of certFiles) {
          const localFilePath = path.join(certPath, file);
          const remoteFilePath = path.join(remoteCertDir, file);
          const result = await this.transferFile(localFilePath, remoteFilePath);
          results.push(result);
        }
      } else {
        // Transfer single certificate file
        const fileName = path.basename(certPath);
        const remoteFilePath = path.join(remoteCertDir, fileName);
        const result = await this.transferFile(certPath, remoteFilePath);
        results.push(result);
      }

      logger.info(`Certificate transfer completed: ${results.length} files`);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Certificate transfer failed: ${errorMessage}`);
      
      return [{
        localPath: certPath,
        remotePath: remoteCertDir,
        success: false,
        error: errorMessage,
      }];
    }
  }

  /**
   * Sets file permissions on transferred files
   * @param targetDir Target directory on remote host
   * @param transferResults Transfer results containing file paths
   * @returns Promise that resolves when permissions are set
   */
  async setFilePermissions(targetDir: string, transferResults: FileTransferResult[]): Promise<void> {
    logger.info('Setting file permissions on remote host');

    const permissions: FilePermissions[] = [
      // docker-compose.yml should be readable by all
      {
        path: path.join(targetDir, 'docker-compose.yml'),
        mode: '0644',
      },
      // .env file should be readable only by owner (contains sensitive data)
      {
        path: path.join(targetDir, '.env'),
        mode: '0600',
      },
    ];

    // Add certificate permissions (readable only by owner)
    const certResults = transferResults.filter(r => 
      r.remotePath.includes('/certs/') && r.success
    );
    for (const certResult of certResults) {
      permissions.push({
        path: certResult.remotePath,
        mode: certResult.remotePath.endsWith('.key') ? '0600' : '0644',
      });
    }

    // Apply permissions
    for (const perm of permissions) {
      try {
        await this.sshClient.executeCommand(`chmod ${perm.mode} ${perm.path}`);
        logger.debug(`Set permissions ${perm.mode} on ${perm.path}`);

        if (perm.owner) {
          await this.sshClient.executeCommand(`chown ${perm.owner} ${perm.path}`);
          logger.debug(`Set owner ${perm.owner} on ${perm.path}`);
        }
      } catch (err) {
        logger.warn(`Failed to set permissions on ${perm.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info('File permissions set successfully');
  }

  /**
   * Ensures a directory exists on the remote host
   * @param remotePath Remote directory path
   * @returns Promise that resolves when directory exists
   */
  async ensureRemoteDirectory(remotePath: string): Promise<void> {
    logger.debug(`Ensuring remote directory exists: ${remotePath}`);

    try {
      // Try creating directory without sudo first
      let result = await this.sshClient.executeCommand(`mkdir -p ${remotePath}`);

      // If permission denied and path starts with /opt or other system directories
      if (result.exitCode !== 0 && result.stderr.includes('Permission denied')) {
        // Check if we're on macOS
        const unameResult = await this.sshClient.executeCommand('uname');
        const isMacOS = unameResult.stdout.trim() === 'Darwin';

        if (isMacOS && remotePath.startsWith('/opt')) {
          // On macOS, /opt requires sudo but we can't use it over SSH without password
          // Suggest using a user-accessible directory instead
          throw new Error(
            `Cannot create directory ${remotePath} on macOS without sudo password. ` +
            `Please use a user-accessible directory like ~/cultivate instead, ` +
            `or manually create ${remotePath} with appropriate permissions before deployment.`
          );
        }

        logger.debug('Permission denied, retrying with sudo');
        result = await this.sshClient.executeCommand(`sudo mkdir -p ${remotePath}`);

        // Also ensure the current user can write to it
        if (result.exitCode === 0) {
          const whoamiResult = await this.sshClient.executeCommand('whoami');
          const currentUser = whoamiResult.stdout.trim();
          await this.sshClient.executeCommand(`sudo chown -R ${currentUser}:${currentUser} ${remotePath}`);
        }
      }

      if (result.exitCode !== 0) {
        throw new Error(result.stderr || 'Failed to create directory');
      }

      logger.debug(`Remote directory ensured: ${remotePath}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to create remote directory: ${errorMessage}`);
      throw new Error(`Failed to create remote directory ${remotePath}: ${errorMessage}`);
    }
  }

  /**
   * Verifies that a file was transferred correctly
   * @param localPath Local file path
   * @param remotePath Remote file path
   * @returns Promise that resolves to true if verification succeeds
   */
  async verifyFileTransfer(localPath: string, remotePath: string): Promise<boolean> {
    try {
      // Get local file size
      const localStats = fs.statSync(localPath);
      const localSize = localStats.size;

      // Get remote file size
      const result = await this.sshClient.executeCommand(`stat -f%z ${remotePath} 2>/dev/null || stat -c%s ${remotePath} 2>/dev/null`);
      const remoteSize = parseInt(result.stdout.trim(), 10);

      if (isNaN(remoteSize)) {
        logger.warn(`Could not verify remote file size for ${remotePath}`);
        return false;
      }

      const match = localSize === remoteSize;
      if (match) {
        logger.debug(`File transfer verified: ${remotePath} (${localSize} bytes)`);
      } else {
        logger.warn(`File size mismatch: local=${localSize}, remote=${remoteSize}`);
      }

      return match;
    } catch (err) {
      logger.warn(`File transfer verification failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Generates .env file content from deployment configuration
   * @param config Deployment configuration
   * @returns .env file content as string
   */
  static generateEnvFile(config: DeploymentConfiguration): string {
    logger.info('Generating .env file content');

    const lines: string[] = [
      '# Deployment Configuration',
      '# Generated automatically - do not edit manually',
      '',
      '# Network Configuration',
      `HTTP_PORT=${config.network.httpPort}`,
      `HTTPS_PORT=${config.network.httpsPort}`,
      `ENABLE_HTTPS=${config.network.enableHttps}`,
      '',
      '# Volume Configuration',
      `DATA_PATH=${config.volumes.dataPath}`,
      `SOCKET_PATH=${config.volumes.socketPath}`,
    ];

    if (config.volumes.certPath) {
      lines.push(`CERT_PATH=${config.volumes.certPath}`);
    }

    lines.push(
      '',
      '# Environment Configuration',
      `NODE_ENV=${config.environment.nodeEnv}`,
      `DATABASE_URL=${config.environment.databaseUrl}`,
      `BACKEND_PORT=${config.environment.backendPort}`,
      '',
      '# Security Configuration',
      `API_USER_UID=${config.security.apiUserUid}`,
      `API_USER_GID=${config.security.apiUserGid}`,
      `SOCKET_PERMISSIONS=${config.security.socketPermissions}`,
      ''
    );

    return lines.join('\n');
  }

  /**
   * Writes .env file to local filesystem
   * @param config Deployment configuration
   * @param outputPath Output file path
   * @returns Promise that resolves when file is written
   */
  static async writeEnvFile(config: DeploymentConfiguration, outputPath: string): Promise<void> {
    logger.info(`Writing .env file to ${outputPath}`);

    const content = this.generateEnvFile(config);
    
    try {
      fs.writeFileSync(outputPath, content, 'utf8');
      logger.info('.env file written successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to write .env file: ${errorMessage}`);
      throw new Error(`Failed to write .env file: ${errorMessage}`);
    }
  }
}
