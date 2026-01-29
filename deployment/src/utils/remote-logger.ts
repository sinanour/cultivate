/**
 * Remote logger for persisting deployment logs on target host
 * 
 * Requirements:
 * - 15.3: Persist logs to the Target_Host for later analysis
 * 
 * Features:
 * - Create log directory on target host
 * - Write deployment logs to target host
 * - Configure log retention policy
 * - Rotate logs based on size and age
 */

import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';
import fs from 'fs';
import path from 'path';

const logger = createLogger();

/**
 * Configuration for remote logging
 */
export interface RemoteLoggerConfig {
  /** Path to log directory on target host */
  logDirectory: string;
  /** Maximum log file size in bytes (default: 10MB) */
  maxLogSize?: number;
  /** Maximum number of log files to keep (default: 10) */
  maxLogFiles?: number;
  /** Maximum age of log files in days (default: 30) */
  maxLogAge?: number;
  /** Whether to compress old log files (default: true) */
  compressOldLogs?: boolean;
}

/**
 * Log entry to be written to remote host
 */
export interface RemoteLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level (info, warn, error, debug) */
  level: string;
  /** Log message */
  message: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of log persistence operation
 */
export interface LogPersistenceResult {
  /** Whether operation was successful */
  success: boolean;
  /** Path to log file on remote host */
  logFilePath?: string;
  /** Number of bytes written */
  bytesWritten?: number;
  /** Error message if operation failed */
  error?: string;
}

/**
 * RemoteLogger class for persisting deployment logs on target host
 * 
 * Features:
 * - Create and manage log directory on target host
 * - Write structured log entries to remote log files
 * - Implement log rotation based on size and count
 * - Clean up old logs based on retention policy
 * - Support log compression for archival
 */
export class RemoteLogger {
  private sshClient: SSHClient;
  private config: Required<RemoteLoggerConfig>;
  private currentLogFile: string;
  private readonly DEFAULT_MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_MAX_LOG_FILES = 10;
  private readonly DEFAULT_MAX_LOG_AGE = 30; // days
  private readonly DEFAULT_COMPRESS_OLD_LOGS = true;

  /**
   * Creates a new RemoteLogger instance
   * @param sshClient SSH client for remote operations
   * @param config Remote logger configuration
   */
  constructor(sshClient: SSHClient, config: RemoteLoggerConfig) {
    this.sshClient = sshClient;
    this.config = {
      logDirectory: config.logDirectory,
      maxLogSize: config.maxLogSize || this.DEFAULT_MAX_LOG_SIZE,
      maxLogFiles: config.maxLogFiles || this.DEFAULT_MAX_LOG_FILES,
      maxLogAge: config.maxLogAge || this.DEFAULT_MAX_LOG_AGE,
      compressOldLogs: config.compressOldLogs ?? this.DEFAULT_COMPRESS_OLD_LOGS,
    };

    // Generate current log file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(
      this.config.logDirectory,
      `deployment-${timestamp}.log`
    );
  }

  /**
   * Initializes the remote logging system
   * Creates log directory and sets up retention policy
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing remote logging system...');

      // Create log directory if it doesn't exist
      await this.createLogDirectory();

      // Clean up old logs based on retention policy
      await this.cleanupOldLogs();

      logger.info(`Remote logging initialized. Log file: ${this.currentLogFile}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize remote logging: ${errorMessage}`);
      throw new Error(`Remote logging initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Writes a log entry to the remote host
   * @param entry Log entry to write
   * @returns Promise that resolves with persistence result
   */
  async writeLog(entry: RemoteLogEntry): Promise<LogPersistenceResult> {
    try {
      // Format log entry as JSON line
      const logLine = JSON.stringify(entry) + '\n';

      // Check if log rotation is needed
      await this.checkAndRotateLog();

      // Append log entry to current log file
      const cmd = `echo '${this.escapeForShell(logLine)}' >> ${this.currentLogFile}`;
      const result = await this.sshClient.executeCommand(cmd);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to write log: ${result.stderr}`,
        };
      }

      return {
        success: true,
        logFilePath: this.currentLogFile,
        bytesWritten: Buffer.byteLength(logLine, 'utf8'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to write remote log: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Writes multiple log entries in batch
   * More efficient than writing entries one by one
   * @param entries Array of log entries to write
   * @returns Promise that resolves with persistence result
   */
  async writeLogs(entries: RemoteLogEntry[]): Promise<LogPersistenceResult> {
    try {
      if (entries.length === 0) {
        return {
          success: true,
          logFilePath: this.currentLogFile,
          bytesWritten: 0,
        };
      }

      // Format all entries as JSON lines
      const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';

      // Check if log rotation is needed
      await this.checkAndRotateLog();

      // Write all entries at once
      const cmd = `cat >> ${this.currentLogFile} << 'EOF'\n${logLines}EOF`;
      const result = await this.sshClient.executeCommand(cmd);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to write logs: ${result.stderr}`,
        };
      }

      return {
        success: true,
        logFilePath: this.currentLogFile,
        bytesWritten: Buffer.byteLength(logLines, 'utf8'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to write remote logs: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Uploads a local log file to the remote host
   * Useful for transferring complete local logs after deployment
   * @param localLogPath Path to local log file
   * @returns Promise that resolves with persistence result
   */
  async uploadLogFile(localLogPath: string): Promise<LogPersistenceResult> {
    try {
      logger.info(`Uploading log file to remote host: ${localLogPath}`);

      // Verify local file exists
      if (!fs.existsSync(localLogPath)) {
        return {
          success: false,
          error: `Local log file not found: ${localLogPath}`,
        };
      }

      // Get file size
      const stats = fs.statSync(localLogPath);
      const fileSize = stats.size;

      // Generate remote file name
      const fileName = path.basename(localLogPath);
      const remoteLogPath = path.join(this.config.logDirectory, fileName);

      // Upload file via SFTP
      await this.sshClient.uploadFile(localLogPath, remoteLogPath);

      logger.info(`Log file uploaded successfully: ${remoteLogPath}`);

      return {
        success: true,
        logFilePath: remoteLogPath,
        bytesWritten: fileSize,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to upload log file: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Creates the log directory on the remote host
   * @returns Promise that resolves when directory is created
   */
  private async createLogDirectory(): Promise<void> {
    try {
      const cmd = `mkdir -p ${this.config.logDirectory} && chmod 755 ${this.config.logDirectory}`;
      const result = await this.sshClient.executeCommand(cmd);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to create log directory: ${result.stderr}`);
      }

      logger.debug(`Log directory created: ${this.config.logDirectory}`);
    } catch (error) {
      throw new Error(
        `Failed to create log directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Checks if log rotation is needed and rotates if necessary
   * @returns Promise that resolves when check is complete
   */
  private async checkAndRotateLog(): Promise<void> {
    try {
      // Check current log file size
      const sizeCmd = `test -f ${this.currentLogFile} && stat -f%z ${this.currentLogFile} 2>/dev/null || stat -c%s ${this.currentLogFile} 2>/dev/null || echo 0`;
      const sizeResult = await this.sshClient.executeCommand(sizeCmd);
      const currentSize = parseInt(sizeResult.stdout.trim(), 10) || 0;

      // Rotate if size exceeds limit
      if (currentSize >= this.config.maxLogSize) {
        logger.info(`Log file size (${currentSize} bytes) exceeds limit, rotating...`);
        await this.rotateLog();
      }
    } catch (error) {
      logger.warn(`Failed to check log size: ${error instanceof Error ? error.message : String(error)}`);
      // Continue without rotation on error
    }
  }

  /**
   * Rotates the current log file
   * Renames current log and creates new one
   * @returns Promise that resolves when rotation is complete
   */
  private async rotateLog(): Promise<void> {
    try {
      // Generate rotated file name with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = `${this.currentLogFile}.${timestamp}`;

      // Rename current log file
      const renameCmd = `test -f ${this.currentLogFile} && mv ${this.currentLogFile} ${rotatedFile} || true`;
      await this.sshClient.executeCommand(renameCmd);

      // Compress rotated file if configured
      if (this.config.compressOldLogs) {
        const compressCmd = `gzip ${rotatedFile}`;
        await this.sshClient.executeCommand(compressCmd);
        logger.debug(`Compressed rotated log: ${rotatedFile}.gz`);
      }

      // Generate new log file name
      const newTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(
        this.config.logDirectory,
        `deployment-${newTimestamp}.log`
      );

      logger.info(`Log rotated. New log file: ${this.currentLogFile}`);
    } catch (error) {
      logger.error(`Failed to rotate log: ${error instanceof Error ? error.message : String(error)}`);
      // Continue with current log file on error
    }
  }

  /**
   * Cleans up old log files based on retention policy
   * Removes logs older than maxLogAge and keeps only maxLogFiles
   * @returns Promise that resolves when cleanup is complete
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      logger.debug('Cleaning up old logs...');

      // Remove logs older than maxLogAge days
      const ageCmd = `find ${this.config.logDirectory} -name "deployment-*.log*" -type f -mtime +${this.config.maxLogAge} -delete`;
      await this.sshClient.executeCommand(ageCmd);

      // Keep only maxLogFiles most recent logs
      const countCmd = `cd ${this.config.logDirectory} && ls -t deployment-*.log* 2>/dev/null | tail -n +${this.config.maxLogFiles + 1} | xargs -r rm`;
      await this.sshClient.executeCommand(countCmd);

      logger.debug('Old logs cleaned up successfully');
    } catch (error) {
      logger.warn(`Failed to cleanup old logs: ${error instanceof Error ? error.message : String(error)}`);
      // Continue without cleanup on error
    }
  }

  /**
   * Gets the current log file path on remote host
   * @returns Current log file path
   */
  getCurrentLogFile(): string {
    return this.currentLogFile;
  }

  /**
   * Gets the log directory path on remote host
   * @returns Log directory path
   */
  getLogDirectory(): string {
    return this.config.logDirectory;
  }

  /**
   * Lists all log files on the remote host
   * @returns Promise that resolves with array of log file paths
   */
  async listLogFiles(): Promise<string[]> {
    try {
      const cmd = `find ${this.config.logDirectory} -name "deployment-*.log*" -type f | sort -r`;
      const result = await this.sshClient.executeCommand(cmd);

      if (result.exitCode !== 0) {
        logger.warn(`Failed to list log files: ${result.stderr}`);
        return [];
      }

      return result.stdout
        .trim()
        .split('\n')
        .filter(line => line.trim());
    } catch (error) {
      logger.error(`Failed to list log files: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Downloads a log file from the remote host
   * @param remoteLogPath Path to log file on remote host
   * @param localLogPath Path to save log file locally
   * @returns Promise that resolves when download is complete
   */
  async downloadLogFile(remoteLogPath: string, localLogPath: string): Promise<void> {
    try {
      logger.info(`Downloading log file from remote host: ${remoteLogPath}`);
      await this.sshClient.downloadFile(remoteLogPath, localLogPath);
      logger.info(`Log file downloaded successfully: ${localLogPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to download log file: ${errorMessage}`);
      throw new Error(`Failed to download log file: ${errorMessage}`);
    }
  }

  /**
   * Escapes a string for safe use in shell commands
   * @param str String to escape
   * @returns Escaped string
   */
  private escapeForShell(str: string): string {
    return str.replace(/'/g, "'\\''");
  }
}
