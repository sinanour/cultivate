import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { createLogger } from './logger.js';

// Create logger instance
const logger = createLogger();

/**
 * SSH connection configuration options
 */
export interface SSHConnectionConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: Buffer | string;
  privateKeyPath?: string;
  passphrase?: string;
  timeout?: number;
}

/**
 * Result of an SSH command execution
 */
export interface SSHCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * SSHClient class for managing SSH connections and executing remote commands
 * 
 * Features:
 * - Connection establishment with timeout
 * - SSH key-based authentication
 * - Password authentication support
 * - Connection verification
 * - Remote command execution
 * - Proper error handling and logging
 */
export class SSHClient {
  private client: Client;
  private config: SSHConnectionConfig;
  private connected: boolean = false;
  private readonly DEFAULT_PORT = 22;
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  /**
   * Creates a new SSHClient instance
   * @param config SSH connection configuration
   */
  constructor(config: SSHConnectionConfig) {
    this.client = new Client();
    this.config = {
      ...config,
      port: config.port || this.DEFAULT_PORT,
      timeout: config.timeout || this.DEFAULT_TIMEOUT,
    };
  }

  /**
   * Establishes SSH connection to the remote host
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails or times out
   */
  async connect(): Promise<void> {
    // Prepare connection configuration
    const connectConfig: ConnectConfig = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username || 'root',
      readyTimeout: this.config.timeout,
    };

    // Add authentication method
    if (this.config.privateKey) {
      connectConfig.privateKey = this.config.privateKey;
      if (this.config.passphrase) {
        connectConfig.passphrase = this.config.passphrase;
      }
      logger.info(`Connecting to ${this.config.host} using SSH key authentication`);
    } else if (this.config.privateKeyPath) {
      // Read private key from file
      try {
        const fs = await import('fs/promises');
        const keyContent = await fs.readFile(this.config.privateKeyPath, 'utf8');
        connectConfig.privateKey = keyContent;
        if (this.config.passphrase) {
          connectConfig.passphrase = this.config.passphrase;
        }
        logger.info(`Connecting to ${this.config.host} using SSH key from ${this.config.privateKeyPath}`);
      } catch (err) {
        throw new Error(`Failed to read private key from ${this.config.privateKeyPath}: ${err}`);
      }
    } else if (this.config.password) {
      connectConfig.password = this.config.password;
      logger.info(`Connecting to ${this.config.host} using password authentication`);
    } else {
      throw new Error('No authentication method provided (privateKey, privateKeyPath, or password required)');
    }

    // Now establish the connection
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.client.end();
        reject(new Error(`SSH connection timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      this.client.on('ready', () => {
        clearTimeout(timeoutId);
        this.connected = true;
        logger.info(`SSH connection established to ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.client.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        this.connected = false;
        logger.error(`SSH connection error: ${err.message}`);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      this.client.on('close', () => {
        this.connected = false;
        logger.info('SSH connection closed');
      });

      try {
        this.client.connect(connectConfig);
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  /**
   * Verifies that the SSH connection is active and working
   * @returns Promise that resolves to true if connection is verified, false otherwise
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.connected) {
      logger.warn('Cannot verify connection: not connected');
      return false;
    }

    try {
      // Execute a simple command to verify connection
      const result = await this.executeCommand('echo "connection_test"');
      const isValid = result.exitCode === 0 && result.stdout.trim() === 'connection_test';
      
      if (isValid) {
        logger.info('SSH connection verified successfully');
      } else {
        logger.warn('SSH connection verification failed');
      }
      
      return isValid;
    } catch (err) {
      logger.error(`SSH connection verification error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Executes a command on the remote host
   * @param command Command to execute
   * @returns Promise that resolves with command result (stdout, stderr, exitCode)
   * @throws Error if not connected or command execution fails
   */
  async executeCommand(command: string): Promise<SSHCommandResult> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }

    return new Promise((resolve, reject) => {
      this.client.exec(command, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          logger.error(`Failed to execute command: ${err.message}`);
          reject(new Error(`Command execution failed: ${err.message}`));
          return;
        }

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', (code: number) => {
          exitCode = code;
          logger.debug(`Command executed with exit code ${exitCode}`);
          resolve({ stdout, stderr, exitCode });
        });

        stream.on('error', (streamErr: Error) => {
          logger.error(`Stream error: ${streamErr.message}`);
          reject(new Error(`Stream error: ${streamErr.message}`));
        });
      });
    });
  }

  /**
   * Executes a command and returns only stdout
   * @param command Command to execute
   * @returns Promise that resolves with stdout string
   * @throws Error if command fails or returns non-zero exit code
   */
  async executeCommandSimple(command: string): Promise<string> {
    const result = await this.executeCommand(command);
    
    if (result.exitCode !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
    }
    
    return result.stdout;
  }

  /**
   * Checks if the client is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Gets the current connection configuration (without sensitive data)
   * @returns Connection configuration with password/privateKey redacted
   */
  getConnectionInfo(): Partial<SSHConnectionConfig> {
    return {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      timeout: this.config.timeout,
    };
  }

  /**
   * Closes the SSH connection
   * @returns Promise that resolves when connection is closed
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }

      // Set a timeout to ensure we don't hang forever
      const timeout = setTimeout(() => {
        this.connected = false;
        logger.warn('SSH disconnect timeout - forcing disconnection');
        resolve();
      }, 5000);

      this.client.once('close', () => {
        clearTimeout(timeout);
        this.connected = false;
        logger.info('SSH connection disconnected');
        resolve();
      });

      this.client.end();
    });
  }

  /**
   * Uploads a file to the remote host using SFTP
   * @param localPath Local file path
   * @param remotePath Remote file path
   * @returns Promise that resolves when upload is complete
   */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }

    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          logger.error(`SFTP session error: ${err.message}`);
          reject(new Error(`Failed to create SFTP session: ${err.message}`));
          return;
        }

        sftp.fastPut(localPath, remotePath, (uploadErr) => {
          if (uploadErr) {
            logger.error(`File upload error: ${uploadErr.message}`);
            reject(new Error(`Failed to upload file: ${uploadErr.message}`));
          } else {
            logger.info(`File uploaded: ${localPath} -> ${remotePath}`);
            resolve();
          }
          sftp.end();
        });
      });
    });
  }

  /**
   * Downloads a file from the remote host using SFTP
   * @param remotePath Remote file path
   * @param localPath Local file path
   * @returns Promise that resolves when download is complete
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }

    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          logger.error(`SFTP session error: ${err.message}`);
          reject(new Error(`Failed to create SFTP session: ${err.message}`));
          return;
        }

        sftp.fastGet(remotePath, localPath, (downloadErr) => {
          if (downloadErr) {
            logger.error(`File download error: ${downloadErr.message}`);
            reject(new Error(`Failed to download file: ${downloadErr.message}`));
          } else {
            logger.info(`File downloaded: ${remotePath} -> ${localPath}`);
            resolve();
          }
          sftp.end();
        });
      });
    });
  }
}
