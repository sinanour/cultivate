import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Health check configuration options
 */
export interface HealthCheckOptions {
  /** Working directory containing docker-compose.yml */
  workingDirectory: string;
  /** Timeout for health checks in milliseconds */
  timeout?: number;
  /** Interval between health check attempts in milliseconds */
  checkInterval?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Whether to use exponential backoff for retries */
  useExponentialBackoff?: boolean;
  /** Initial backoff delay in milliseconds (for exponential backoff) */
  initialBackoffDelay?: number;
  /** Maximum backoff delay in milliseconds (for exponential backoff) */
  maxBackoffDelay?: number;
}

/**
 * Health status for a single container
 */
export interface ContainerHealthStatus {
  /** Container name */
  containerName: string;
  /** Health status (healthy, unhealthy, starting, none) */
  status: 'healthy' | 'unhealthy' | 'starting' | 'none';
  /** Container state (running, exited, etc.) */
  state: string;
  /** Number of health check attempts */
  attempts: number;
  /** Last error message if health check failed */
  lastError?: string;
}

/**
 * Result of health check verification
 */
export interface HealthCheckResult {
  /** Whether all containers are healthy */
  allHealthy: boolean;
  /** Individual container health statuses */
  containers: ContainerHealthStatus[];
  /** Total time taken for health checks in milliseconds */
  duration: number;
  /** Error message if health checks failed */
  error?: string;
}

/**
 * HealthCheck class for verifying container health status
 * 
 * Features:
 * - Poll container health status until all are healthy
 * - Configurable timeout and retry logic
 * - Exponential backoff for retries
 * - Detailed health status reporting
 * - Support for containers without health checks
 */
export class HealthCheck {
  private sshClient: SSHClient;
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly DEFAULT_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_MAX_RETRIES = 60; // 60 retries = 5 minutes with 5s interval
  private readonly DEFAULT_INITIAL_BACKOFF = 1000; // 1 second
  private readonly DEFAULT_MAX_BACKOFF = 30000; // 30 seconds

  /**
   * Creates a new HealthCheck instance
   * @param sshClient SSH client for remote operations
   */
  constructor(sshClient: SSHClient) {
    this.sshClient = sshClient;
  }

  /**
   * Verifies that all containers reach a healthy state
   * @param options Health check options
   * @returns Promise that resolves with health check result
   */
  async verifyContainerHealth(options: HealthCheckOptions): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const checkInterval = options.checkInterval || this.DEFAULT_CHECK_INTERVAL;
    const maxRetries = options.maxRetries || this.DEFAULT_MAX_RETRIES;
    const useExponentialBackoff = options.useExponentialBackoff ?? true;
    const initialBackoffDelay = options.initialBackoffDelay || this.DEFAULT_INITIAL_BACKOFF;
    const maxBackoffDelay = options.maxBackoffDelay || this.DEFAULT_MAX_BACKOFF;

    logger.info('Starting health check verification...');

    try {
      // Get list of containers
      const containerNames = await this.getContainerNames(options.workingDirectory);
      
      if (containerNames.length === 0) {
        return {
          allHealthy: false,
          containers: [],
          duration: Date.now() - startTime,
          error: 'No containers found',
        };
      }

      logger.info(`Found ${containerNames.length} containers to check: ${containerNames.join(', ')}`);

      // Initialize health status tracking
      const healthStatuses: Map<string, ContainerHealthStatus> = new Map();
      for (const name of containerNames) {
        healthStatuses.set(name, {
          containerName: name,
          status: 'starting',
          state: 'unknown',
          attempts: 0,
        });
      }

      let retryCount = 0;
      let backoffDelay = initialBackoffDelay;

      // Poll health status until all healthy or timeout
      while (retryCount < maxRetries && Date.now() - startTime < timeout) {
        retryCount++;

        // Check health status of all containers
        const allHealthy = await this.checkAllContainers(
          containerNames,
          options.workingDirectory,
          healthStatuses
        );

        // Log progress
        const healthyCount = Array.from(healthStatuses.values()).filter(
          s => s.status === 'healthy' || (s.status === 'none' && s.state === 'running')
        ).length;
        logger.info(`Health check progress (attempt ${retryCount}/${maxRetries}): ${healthyCount}/${containerNames.length} healthy`);

        if (allHealthy) {
          logger.info('All containers are healthy');
          return {
            allHealthy: true,
            containers: Array.from(healthStatuses.values()),
            duration: Date.now() - startTime,
          };
        }

        // Check for any containers that have failed
        const failedContainers = Array.from(healthStatuses.values()).filter(
          s => s.status === 'unhealthy' || s.state === 'exited' || s.state === 'dead'
        );

        if (failedContainers.length > 0) {
          const failedNames = failedContainers.map(c => c.containerName).join(', ');
          logger.error(`Containers failed health checks: ${failedNames}`);
          return {
            allHealthy: false,
            containers: Array.from(healthStatuses.values()),
            duration: Date.now() - startTime,
            error: `Containers failed health checks: ${failedNames}`,
          };
        }

        // Calculate delay for next check
        let delay: number;
        if (useExponentialBackoff) {
          delay = Math.min(backoffDelay, maxBackoffDelay);
          backoffDelay *= 2; // Exponential backoff
        } else {
          delay = checkInterval;
        }

        // Wait before next check
        await this.sleep(delay);
      }

      // Timeout or max retries reached
      const healthyCount = Array.from(healthStatuses.values()).filter(
        s => s.status === 'healthy' || (s.status === 'none' && s.state === 'running')
      ).length;

      logger.error(`Health check timeout: ${healthyCount}/${containerNames.length} containers healthy after ${retryCount} attempts`);

      return {
        allHealthy: false,
        containers: Array.from(healthStatuses.values()),
        duration: Date.now() - startTime,
        error: `Health check timeout after ${retryCount} attempts (${Math.round((Date.now() - startTime) / 1000)}s)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Health check error: ${errorMessage}`);

      return {
        allHealthy: false,
        containers: [],
        duration: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Checks health status of all containers
   * @param containerNames Names of containers to check
   * @param workingDirectory Working directory containing docker-compose.yml
   * @param healthStatuses Map to update with health statuses
   * @returns Promise that resolves to true if all containers are healthy
   */
  private async checkAllContainers(
    containerNames: string[],
    workingDirectory: string,
    healthStatuses: Map<string, ContainerHealthStatus>
  ): Promise<boolean> {
    let allHealthy = true;

    for (const containerName of containerNames) {
      const status = healthStatuses.get(containerName)!;
      status.attempts++;

      try {
        const health = await this.checkContainerHealth(containerName, workingDirectory);
        
        status.status = health.status;
        status.state = health.state;
        status.lastError = health.lastError;

        // Container is considered healthy if:
        // 1. Health status is 'healthy', OR
        // 2. No health check defined (status 'none') AND container is running
        const isHealthy = health.status === 'healthy' || 
                         (health.status === 'none' && health.state === 'running');

        if (!isHealthy) {
          allHealthy = false;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        status.lastError = errorMessage;
        status.status = 'unhealthy';
        allHealthy = false;
        logger.warn(`Failed to check health for ${containerName}: ${errorMessage}`);
      }
    }

    return allHealthy;
  }

  /**
   * Checks the health status of a single container
   * @param containerName Name of the container
   * @param workingDirectory Working directory containing docker-compose.yml
   * @returns Promise that resolves with container health status
   */
  async checkContainerHealth(
    containerName: string,
    workingDirectory: string
  ): Promise<Pick<ContainerHealthStatus, 'status' | 'state' | 'lastError'>> {
    try {
      // Get container status using docker inspect
      const cmd = `cd ${workingDirectory} && docker inspect --format='{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' ${containerName}`;
      let result = await this.sshClient.executeCommand(cmd);

      // If permission denied, retry with sudo
      if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
        logger.debug('Docker permission denied, retrying with sudo');
        const sudoCmd = cmd.replace(/docker inspect/g, 'sudo docker inspect');
        result = await this.sshClient.executeCommand(sudoCmd);
      }

      if (result.exitCode !== 0) {
        return {
          status: 'unhealthy',
          state: 'unknown',
          lastError: result.stderr || 'Failed to inspect container',
        };
      }

      const [state, healthStatus] = result.stdout.trim().split('|');

      return {
        status: healthStatus as 'healthy' | 'unhealthy' | 'starting' | 'none',
        state: state || 'unknown',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: 'unhealthy',
        state: 'unknown',
        lastError: errorMessage,
      };
    }
  }

  /**
   * Gets the names of all containers in the docker-compose project
   * @param workingDirectory Working directory containing docker-compose.yml
   * @returns Promise that resolves with array of container names
   */
  private async getContainerNames(workingDirectory: string): Promise<string[]> {
    try {
      const cmd = `cd ${workingDirectory} && docker-compose ps --format json`;
      let result = await this.sshClient.executeCommand(cmd);

      // If permission denied, retry with sudo
      if (result.exitCode !== 0 && result.stderr.includes('permission denied')) {
        logger.debug('Docker permission denied, retrying with sudo');
        const sudoCmd = cmd.replace(/docker-compose/g, 'sudo docker-compose');
        result = await this.sshClient.executeCommand(sudoCmd);
      }

      if (result.exitCode !== 0) {
        logger.warn(`Failed to get container names: ${result.stderr}`);
        return [];
      }

      // Parse JSON output (one JSON object per line)
      const containerNames: string[] = [];
      const lines = result.stdout.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const name = data.Name || data.name;
          if (name) {
            containerNames.push(name);
          }
        } catch (parseError) {
          logger.warn(`Failed to parse container info: ${line}`);
        }
      }

      return containerNames;
    } catch (error) {
      logger.error(`Error getting container names: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Waits for a specific container to become healthy
   * @param containerName Name of the container
   * @param workingDirectory Working directory containing docker-compose.yml
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves to true if container becomes healthy
   */
  async waitForContainerHealthy(
    containerName: string,
    workingDirectory: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    logger.info(`Waiting for ${containerName} to become healthy...`);

    while (Date.now() - startTime < timeout) {
      const health = await this.checkContainerHealth(containerName, workingDirectory);

      if (health.status === 'healthy' || (health.status === 'none' && health.state === 'running')) {
        logger.info(`${containerName} is healthy`);
        return true;
      }

      if (health.state === 'exited' || health.state === 'dead') {
        logger.error(`${containerName} has exited or died`);
        return false;
      }

      await this.sleep(checkInterval);
    }

    logger.error(`Timeout waiting for ${containerName} to become healthy`);
    return false;
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
