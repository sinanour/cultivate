/**
 * Rollback Executor Module
 * 
 * Implements rollback functionality to restore previous deployment.
 * Restores previous Docker images, configuration files, and restarts containers.
 * 
 * Requirements: 14.2, 14.4
 */

import { DeploymentStateManager } from './deployment-state.js';
import { SSHClient } from './ssh-client.js';
import { ImageTransfer } from './image-transfer.js';
import { ConfigTransfer } from './config-transfer.js';
import { ContainerDeployment } from './container-deployment.js';
import { HealthCheck } from './health-check.js';
import { createLogger } from './logger.js';
import { DeploymentState } from '../types/deployment.js';

const logger = createLogger();

/**
 * Rollback options
 */
export interface RollbackOptions {
  /** Target host for rollback */
  targetHost: string;

  /** SSH configuration */
  sshConfig: {
    username: string;
    privateKeyPath?: string;
    port?: number;
    timeout?: number;
  };

  /** Path to deployment state directory */
  stateDir?: string;

  /** Path to configuration files */
  configPath?: string;

  /** Path to docker-compose file */
  composePath?: string;

  /** Whether to verify rollback with health checks */
  verifyHealth?: boolean;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  /** Whether rollback succeeded */
  success: boolean;

  /** Previous deployment state that was restored */
  restoredState?: DeploymentState;

  /** Error message if rollback failed */
  error?: string;

  /** Diagnostic logs */
  logs: string[];
}

/**
 * Rollback Executor
 * Handles rollback operations to restore previous deployment
 */
export class RollbackExecutor {
  private stateManager: DeploymentStateManager;
  private sshClient: SSHClient;
  private containerDeployment: ContainerDeployment;
  private healthCheck: HealthCheck;
  private logs: string[] = [];

  constructor(
    stateManager: DeploymentStateManager,
    sshClient: SSHClient,
    _imageTransfer: ImageTransfer,
    _configTransfer: ConfigTransfer,
    containerDeployment: ContainerDeployment,
    healthCheck: HealthCheck
  ) {
    this.stateManager = stateManager;
    this.sshClient = sshClient;
    // imageTransfer and configTransfer are passed for dependency injection but not used directly
    // They may be used in future enhancements
    this.containerDeployment = containerDeployment;
    this.healthCheck = healthCheck;
  }

  /**
   * Execute rollback to previous deployment
   * 
   * @param options - Rollback options
   * @returns Rollback result
   */
  async executeRollback(options: RollbackOptions): Promise<RollbackResult> {
    this.logs = [];
    this.log('Starting rollback operation');

    try {
      // Check if previous deployment exists
      const hasPrevious = await this.stateManager.hasPreviousState();
      if (!hasPrevious) {
        const error = 'No previous deployment state found for rollback';
        this.log(error, 'error');
        return {
          success: false,
          error,
          logs: this.logs
        };
      }

      // Load previous deployment state
      const previousState = await this.stateManager.loadPreviousState();
      if (!previousState) {
        const error = 'Failed to load previous deployment state';
        this.log(error, 'error');
        return {
          success: false,
          error,
          logs: this.logs
        };
      }

      this.log(`Rolling back to version: ${previousState.version}`);

      // Connect to target host
      await this.sshClient.connect();
      this.log('Connected to target host');

      // Stop current containers
      await this.stopContainers();

      // Restore previous Docker images
      await this.restoreImages(previousState);

      // Restore previous configuration
      await this.restoreConfiguration(previousState, options);

      // Start containers with previous versions
      await this.startContainers();

      // Verify rollback if requested
      if (options.verifyHealth !== false) {
        await this.verifyRollback();
      }

      // Update deployment state
      previousState.status = 'active';
      previousState.timestamp = new Date();
      await this.stateManager.saveCurrentState(previousState);

      this.log('Rollback completed successfully');

      return {
        success: true,
        restoredState: previousState,
        logs: this.logs
      };
    } catch (error) {
      const errorMessage = `Rollback failed: ${error}`;
      this.log(errorMessage, 'error');
      logger.error(errorMessage);

      return {
        success: false,
        error: errorMessage,
        logs: this.logs
      };
    } finally {
      await this.sshClient.disconnect();
    }
  }

  /**
   * Stop current containers
   */
  private async stopContainers(): Promise<void> {
    try {
      this.log('Stopping current containers');
      await this.containerDeployment.stopContainers('/opt/cultivate');
      this.log('Containers stopped successfully');
    } catch (error) {
      this.log(`Warning: Failed to stop containers: ${error}`, 'warn');
      // Continue with rollback even if stop fails
    }
  }

  /**
   * Restore previous Docker images
   * 
   * @param previousState - Previous deployment state
   */
  private async restoreImages(previousState: DeploymentState): Promise<void> {
    this.log('Restoring previous Docker images');

    const { imageVersions } = previousState;

    // Check if images exist on target host
    const imagesExist = await this.checkImagesExist(imageVersions);

    if (!imagesExist) {
      this.log('Previous images not found on target host, attempting to restore from backup');
      // In a production system, you might restore from a registry or backup
      // For now, we'll assume images are tagged and available
      throw new Error('Previous Docker images not available for rollback');
    }

    this.log(`Restored images: frontend=${imageVersions.frontend}, backend=${imageVersions.backend}, database=${imageVersions.database}`);
  }

  /**
   * Detect container runtime on remote host
   */
  private async detectRemoteRuntime(): Promise<string> {
    // Try finch first (for macOS) with multiple paths
    const finchPaths = [
      'finch',
      '/usr/local/bin/finch',
      '/opt/homebrew/bin/finch',
      '$HOME/.finch/bin/finch',
    ];

    for (const finchPath of finchPaths) {
      const result = await this.sshClient.executeCommand(`command -v ${finchPath} || ${finchPath} --version`);
      if (result.exitCode === 0) {
        this.log(`Detected Finch on remote host at: ${finchPath}`, 'info');
        return finchPath;
      }
    }

    // Fall back to docker
    this.log('Detected Docker on remote host', 'info');
    return 'docker';
  }

  /**
   * Check if Docker images exist on target host
   * 
   * @param imageVersions - Image versions to check
   * @returns True if all images exist
   */
  private async checkImagesExist(imageVersions: {
    frontend: string;
    backend: string;
    database: string;
  }): Promise<boolean> {
    try {
      // Detect remote runtime
      const remoteRuntime = await this.detectRemoteRuntime();
      this.log(`Using remote runtime for image check: ${remoteRuntime}`, 'info');

      const images = [
        imageVersions.frontend,
        imageVersions.backend,
        imageVersions.database
      ];

      for (const image of images) {
        // Try without sudo first
        let command = `${remoteRuntime} images -q ${image}`;
        let result = await this.sshClient.executeCommand(command);

        // If permission denied, try with sudo
        if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
          this.log(`Container runtime permission denied, retrying with sudo for ${image}`, 'info');
          command = `sudo ${remoteRuntime} images -q ${image}`;
          result = await this.sshClient.executeCommand(command);
        }

        if (!result.stdout.trim()) {
          this.log(`Image not found: ${image}`, 'warn');
          return false;
        }
      }

      return true;
    } catch (error) {
      this.log(`Error checking images: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Restore previous configuration files
   * 
   * @param previousState - Previous deployment state
   * @param options - Rollback options
   */
  private async restoreConfiguration(
    previousState: DeploymentState,
    options: RollbackOptions
  ): Promise<void> {
    this.log('Restoring previous configuration');

    // Generate docker-compose.yml content for previous deployment
    const composeContent = this.generateComposeFile(previousState);

    // Write content to a temporary file
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rollback-config-'));
    const tempComposePath = path.join(tempDir, 'docker-compose.yml');

    try {
      await fs.writeFile(tempComposePath, composeContent, 'utf-8');

      const remotePath = options.composePath || '/opt/cultivate/docker-compose.yml';
      await this.sshClient.uploadFile(tempComposePath, remotePath);

      this.log('Configuration restored successfully');
    } finally {
      // Clean up temp file
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn(`Failed to clean up temp directory: ${cleanupError}`);
      }
    }
  }

  /**
   * Generate docker-compose.yml content for previous deployment
   * 
   * @param previousState - Previous deployment state
   * @returns Docker compose file content
   */
  private generateComposeFile(previousState: DeploymentState): string {
    const { imageVersions } = previousState;

    return `version: '3.8'

services:
  database:
    image: ${imageVersions.database}
    container_name: cultivate_database
    volumes:
      - db_data:/var/lib/postgresql/data
      - db_socket:/var/run/postgresql
    environment:
      - POSTGRES_USER=apiuser
      - POSTGRES_DB=cultivate
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U apiuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ${imageVersions.backend}
    container_name: cultivate_backend
    depends_on:
      database:
        condition: service_healthy
    volumes:
      - db_socket:/var/run/postgresql:rw
    environment:
      - DATABASE_URL=postgresql://apiuser@/cultivate?host=/var/run/postgresql
      - NODE_ENV=production
      - PORT=3000
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    image: ${imageVersions.frontend}
    container_name: cultivate_frontend
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_BACKEND_URL=/api/v1
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  backend:
    driver: bridge

volumes:
  db_data:
    driver: local
  db_socket:
    driver: local
`;
  }

  /**
   * Start containers with previous versions
   */
  private async startContainers(): Promise<void> {
    this.log('Starting containers with previous versions');
    await this.containerDeployment.deployContainers({
      composePath: '/opt/cultivate/docker-compose.yml',
      workingDirectory: '/opt/cultivate',
      pullImages: false,
      forceRecreate: true
    });
    this.log('Containers started successfully');
  }

  /**
   * Verify rollback success with health checks
   */
  private async verifyRollback(): Promise<void> {
    this.log('Verifying rollback with health checks');

    const healthResult = await this.healthCheck.verifyContainerHealth({
      workingDirectory: '/opt/cultivate',
      timeout: 300000, // 5 minutes
      maxRetries: 60
    });

    if (!healthResult.allHealthy) {
      const unhealthyContainers = healthResult.containers
        .filter(c => c.status !== 'healthy')
        .map(c => c.containerName);

      throw new Error(`Health check failed for containers: ${unhealthyContainers.join(', ')}`);
    }

    this.log('All health checks passed');
  }

  /**
   * Log message to internal log array and logger
   * 
   * @param message - Log message
   * @param level - Log level
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.logs.push(`[${level.toUpperCase()}] ${message}`);
    logger[level](message);
  }
}

/**
 * Create a rollback executor with default dependencies
 * 
 * @param options - Rollback options
 * @returns Configured rollback executor
 */
export async function createRollbackExecutor(
  options: RollbackOptions
): Promise<RollbackExecutor> {
  const stateManager = new DeploymentStateManager(options.stateDir);

  const sshClient = new SSHClient({
    host: options.targetHost,
    port: options.sshConfig.port || 22,
    username: options.sshConfig.username,
    privateKey: options.sshConfig.privateKeyPath,
    timeout: 30000
  });

  const imageTransfer = new ImageTransfer();
  const configTransfer = new ConfigTransfer(sshClient);
  const containerDeployment = new ContainerDeployment(sshClient);
  const healthCheck = new HealthCheck(sshClient);

  return new RollbackExecutor(
    stateManager,
    sshClient,
    imageTransfer,
    configTransfer,
    containerDeployment,
    healthCheck
  );
}
