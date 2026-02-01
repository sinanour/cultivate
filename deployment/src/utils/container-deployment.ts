import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Options for container deployment
 */
export interface ContainerDeploymentOptions {
  /** Path to docker-compose.yml on remote host */
  composePath: string;
  /** Working directory for docker-compose commands */
  workingDirectory: string;
  /** Timeout for container startup in milliseconds */
  startupTimeout?: number;
  /** Whether to pull images before starting */
  pullImages?: boolean;
  /** Whether to force recreate containers */
  forceRecreate?: boolean;
  /** Environment variables to pass to docker-compose */
  environment?: Record<string, string>;
}

/**
 * Container status information
 */
export interface ContainerStatus {
  /** Container name */
  name: string;
  /** Container state (running, exited, etc.) */
  state: string;
  /** Container health status (healthy, unhealthy, starting, none) */
  health: string;
  /** Container uptime */
  uptime: string;
}

/**
 * Container logs
 */
export interface ContainerLogs {
  /** Container name */
  containerName: string;
  /** Log output */
  logs: string;
  /** Timestamp when logs were captured */
  timestamp: Date;
}

/**
 * Result of container deployment
 */
export interface DeploymentResult {
  /** Whether deployment was successful */
  success: boolean;
  /** Container statuses after deployment */
  containers: ContainerStatus[];
  /** Container logs captured during startup */
  logs: ContainerLogs[];
  /** Error message if deployment failed */
  error?: string;
}

/**
 * ContainerDeployment class for deploying and managing Docker/Finch containers via compose
 * 
 * Features:
 * - Deploy containers using docker-compose or finch compose
 * - Monitor container startup progress
 * - Capture container logs during startup
 * - Check container status and health
 * - Stop and remove containers
 * - Support both Docker and Finch runtimes
 */
export class ContainerDeployment {
  private sshClient: SSHClient;
  private readonly DEFAULT_STARTUP_TIMEOUT = 300000; // 5 minutes
  private composeCommand: string;

  /**
   * Creates a new ContainerDeployment instance
   * @param sshClient SSH client for remote operations
   * @param composeCommand Optional compose command (default: 'docker-compose')
   */
  constructor(sshClient: SSHClient, composeCommand: string = 'docker-compose') {
    this.sshClient = sshClient;
    this.composeCommand = composeCommand;
    logger.info(`ContainerDeployment initialized with compose command: ${composeCommand}`);
  }

  /**
   * Sets the compose command to use (docker-compose or finch compose)
   * @param command The compose command to use
   */
  setComposeCommand(command: string): void {
    this.composeCommand = command;
    logger.info(`Container deployment will use: ${command}`);
  }

  /**
   * Executes a compose command, automatically adding sudo if needed
   * @param command The full compose command to execute
   * @returns Promise that resolves with command result
   */
  private async executeDockerComposeCommand(command: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    logger.info(`Executing compose command: ${command}`);

    // Try without sudo first
    let result = await this.sshClient.executeCommand(command);

    // If permission denied, retry with sudo
    if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
      logger.debug('Container runtime permission denied, retrying with sudo');
      // Add sudo to the compose command part
      const sudoCommand = command.replace(this.composeCommand, `sudo ${this.composeCommand}`);
      logger.info(`Retrying with sudo: ${sudoCommand}`);
      result = await this.sshClient.executeCommand(sudoCommand);
    }

    if (result.exitCode !== 0) {
      logger.error(`Compose command failed with exit code ${result.exitCode}`);
      logger.error(`stderr: ${result.stderr}`);
      logger.error(`stdout: ${result.stdout}`);
    }

    return result;
  }

  /**
   * Deploys containers using compose up
   * @param options Deployment options
   * @returns Promise that resolves with deployment result
   */
  async deployContainers(options: ContainerDeploymentOptions): Promise<DeploymentResult> {
    const startupTimeout = options.startupTimeout || this.DEFAULT_STARTUP_TIMEOUT;
    const logs: ContainerLogs[] = [];

    try {
      logger.info('Starting container deployment...');

      // Verify compose file exists
      await this.verifyComposeFile(options.composePath);

      // Build compose command
      const composeCmd = this.buildComposeCommand(options);
      logger.info(`Executing: ${composeCmd}`);

      // Execute compose up
      const startTime = Date.now();
      const result = await this.executeDockerComposeCommand(composeCmd);

      if (result.exitCode !== 0) {
        logger.error(`Compose up failed: ${result.stderr}`);
        return {
          success: false,
          containers: [],
          logs: [],
          error: `Compose up failed: ${result.stderr}`,
        };
      }

      logger.info('Compose up completed, monitoring container startup...');

      // Monitor container startup
      const monitorResult = await this.monitorContainerStartup(
        options.workingDirectory,
        startupTimeout - (Date.now() - startTime)
      );

      // Capture logs from all containers using service names
      const serviceNames = await this.getContainerNames(options.workingDirectory);
      for (const name of serviceNames) {
        const containerLogs = await this.captureContainerLogs(name, options.workingDirectory);
        logs.push(containerLogs);
      }

      logger.info(`Container deployment completed. Success: ${monitorResult.success}`);

      return {
        ...monitorResult,
        logs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Container deployment failed: ${errorMessage}`);

      // Try to capture logs even on failure
      try {
        const containerNames = await this.getContainerNames(options.workingDirectory);
        for (const name of containerNames) {
          const containerLogs = await this.captureContainerLogs(name, options.workingDirectory);
          logs.push(containerLogs);
        }
      } catch (logError) {
        logger.warn(`Failed to capture logs: ${logError instanceof Error ? logError.message : String(logError)}`);
      }

      return {
        success: false,
        containers: [],
        logs,
        error: errorMessage,
      };
    }
  }

  /**
   * Monitors container startup until all containers are running or timeout occurs
   * @param workingDirectory Working directory containing compose file
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with deployment result
   */
  private async monitorContainerStartup(
    workingDirectory: string,
    timeout: number
  ): Promise<Omit<DeploymentResult, 'logs'>> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < timeout) {
      const containers = await this.getContainerStatus(workingDirectory);

      if (containers.length === 0) {
        logger.warn('No containers found, waiting...');
        await this.sleep(checkInterval);
        continue;
      }

      // Log current container states for debugging
      logger.debug(`Container states: ${containers.map(c => `${c.name}=${c.state}`).join(', ')}`);

      // Check if all containers are running (handle both "running" and "up" states)
      const allRunning = containers.every(c =>
        c.state === 'running' || c.state.startsWith('up')
      );
      const anyExited = containers.some(c =>
        c.state === 'exited' || c.state === 'dead' || c.state.includes('exit')
      );

      if (anyExited) {
        logger.error('One or more containers exited during startup');
        return {
          success: false,
          containers,
          error: 'One or more containers exited during startup',
        };
      }

      if (allRunning) {
        logger.info('All containers are running');
        return {
          success: true,
          containers,
        };
      }

      // Log progress
      const runningCount = containers.filter(c =>
        c.state === 'running' || c.state.startsWith('up')
      ).length;
      logger.info(`Container startup progress: ${runningCount}/${containers.length} running`);

      // Wait before next check
      await this.sleep(checkInterval);
    }

    // Timeout reached
    const containers = await this.getContainerStatus(workingDirectory);
    logger.error('Container startup timeout reached');
    return {
      success: false,
      containers,
      error: `Container startup timeout after ${timeout}ms`,
    };
  }

  /**
   * Gets the status of all containers in the compose project
   * @param workingDirectory Working directory containing compose file
   * @returns Promise that resolves with array of container statuses
   */
  async getContainerStatus(workingDirectory: string): Promise<ContainerStatus[]> {
    try {
      const cmd = `cd ${workingDirectory} && ${this.composeCommand} -f docker-compose.yml ps --format json`;
      const result = await this.executeDockerComposeCommand(cmd);

      if (result.exitCode !== 0) {
        logger.warn(`Failed to get container status: ${result.stderr}`);
        return [];
      }

      const output = result.stdout.trim();
      if (!output) {
        logger.debug('No container status output received');
        return [];
      }

      logger.debug(`Container status output: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);

      // Parse JSON output - handle both array format and newline-delimited format
      const containers: ContainerStatus[] = [];

      // Try parsing as a JSON array first (Finch format)
      try {
        const parsed = JSON.parse(output);
        if (Array.isArray(parsed)) {
          for (const data of parsed) {
            containers.push(this.parseContainerData(data));
          }
          return containers;
        }
      } catch {
        // Not a JSON array, try line-by-line parsing
      }

      // Parse as newline-delimited JSON (Docker format)
      const lines = output.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          containers.push(this.parseContainerData(data));
        } catch (parseError) {
          logger.warn(`Failed to parse container status line: ${line}`);
        }
      }

      return containers;
    } catch (error) {
      logger.error(`Error getting container status: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Parses container data from JSON output, handling different field name formats
   * @param data Raw container data from compose ps
   * @returns Normalized container status
   */
  private parseContainerData(data: any): ContainerStatus {
    // Handle different field name formats (capitalized vs lowercase)
    const name = data.Name || data.name || data.Service || data.service || 'unknown';
    const state = data.State || data.state || data.Status || data.status || 'unknown';
    const health = data.Health || data.health || 'none';
    const uptime = data.Status || data.status || data.Uptime || data.uptime || 'unknown';

    // Normalize state to lowercase for consistent comparison
    const normalizedState = state.toLowerCase();

    return {
      name,
      state: normalizedState,
      health,
      uptime,
    };
  }

  /**
   * Captures logs from a specific container
   * @param containerName Name of the container
   * @param workingDirectory Working directory containing compose file
   * @param tailLines Number of lines to tail (default: 100)
   * @returns Promise that resolves with container logs
   */
  async captureContainerLogs(
    containerName: string,
    workingDirectory: string,
    tailLines: number = 100
  ): Promise<ContainerLogs> {
    try {
      const cmd = `cd ${workingDirectory} && ${this.composeCommand} -f docker-compose.yml logs --tail=${tailLines} ${containerName}`;
      const result = await this.executeDockerComposeCommand(cmd);

      return {
        containerName,
        logs: result.stdout || result.stderr || 'No logs available',
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to capture logs for ${containerName}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        containerName,
        logs: `Error capturing logs: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Gets the names of all containers in the compose project
   * @param workingDirectory Working directory containing compose file
   * @returns Promise that resolves with array of container names
   */
  private async getContainerNames(workingDirectory: string): Promise<string[]> {
    try {
      const cmd = `cd ${workingDirectory} && ${this.composeCommand} -f docker-compose.yml ps --services`;
      const result = await this.executeDockerComposeCommand(cmd);

      if (result.exitCode !== 0) {
        return [];
      }

      return result.stdout.trim().split('\n').filter(name => name.trim());
    } catch (error) {
      logger.warn(`Failed to get container names: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Stops all containers in the compose project
   * @param workingDirectory Working directory containing compose file
   * @returns Promise that resolves when containers are stopped
   */
  async stopContainers(workingDirectory: string): Promise<void> {
    try {
      logger.info('Stopping containers...');
      const cmd = `cd ${workingDirectory} && ${this.composeCommand} -f docker-compose.yml stop`;
      const result = await this.executeDockerComposeCommand(cmd);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to stop containers: ${result.stderr}`);
      }

      logger.info('Containers stopped successfully');
    } catch (error) {
      logger.error(`Error stopping containers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Stops and removes all containers in the compose project
   * @param workingDirectory Working directory containing compose file
   * @param removeVolumes Whether to remove volumes as well
   * @returns Promise that resolves when containers are removed
   */
  async removeContainers(workingDirectory: string, removeVolumes: boolean = false): Promise<void> {
    try {
      logger.info('Removing containers...');
      const volumeFlag = removeVolumes ? '-v' : '';
      const cmd = `cd ${workingDirectory} && ${this.composeCommand} -f docker-compose.yml down ${volumeFlag}`;
      const result = await this.executeDockerComposeCommand(cmd);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to remove containers: ${result.stderr}`);
      }

      logger.info('Containers removed successfully');
    } catch (error) {
      logger.error(`Error removing containers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Verifies that the compose file exists on the remote host
   * @param composePath Path to compose file
   * @returns Promise that resolves if file exists
   * @throws Error if file does not exist
   */
  private async verifyComposeFile(composePath: string): Promise<void> {
    const cmd = `test -f ${composePath} && echo "exists" || echo "not found"`;
    const result = await this.sshClient.executeCommand(cmd);

    if (!result.stdout.includes('exists')) {
      throw new Error(`Compose file not found: ${composePath}`);
    }
  }

  /**
   * Builds the compose up command with options
   * @param options Deployment options
   * @returns compose command string
   */
  private buildComposeCommand(options: ContainerDeploymentOptions): string {
    // Build the command directly without shell wrapper
    // The SSH client will execute it in the default shell
    // Always specify the compose file explicitly with -f for compatibility with both Docker and Finch
    let command = `cd ${options.workingDirectory} && ${this.composeCommand} -f ${options.composePath} up -d`;

    if (options.forceRecreate) {
      command += ' --force-recreate';
    }

    if (options.pullImages) {
      command += ' --pull always';
    }

    // Add environment variables at the beginning if provided
    if (options.environment) {
      const envVars = Object.entries(options.environment)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      command = `${envVars} ${command}`;
    }

    logger.debug(`Built compose command: ${command}`);
    return command;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
