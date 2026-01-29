/**
 * Failure Detection Module
 * 
 * Detects various types of deployment failures:
 * - Container startup failures
 * - Health check failures
 * - SSH connection failures
 * 
 * Requirements: 10.5, 13.5
 */

import { SSHClient } from './ssh-client.js';
import { ContainerDeployment, ContainerStatus } from './container-deployment.js';
import { HealthCheck, ContainerHealthStatus } from './health-check.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Types of failures that can be detected
 */
export enum FailureType {
  SSH_CONNECTION = 'ssh_connection',
  CONTAINER_STARTUP = 'container_startup',
  HEALTH_CHECK = 'health_check',
  CONTAINER_CRASH = 'container_crash',
  TIMEOUT = 'timeout',
}

/**
 * Failure detection result
 */
export interface FailureDetectionResult {
  /** Whether a failure was detected */
  hasFailure: boolean;

  /** Type of failure detected */
  failureType?: FailureType;

  /** Detailed failure message */
  message: string;

  /** Affected container names (if applicable) */
  affectedContainers?: string[];

  /** Additional diagnostic information */
  diagnostics?: Record<string, unknown>;

  /** Timestamp when failure was detected */
  timestamp: Date;
}

/**
 * Options for failure detection
 */
export interface FailureDetectionOptions {
  /** Working directory containing docker-compose.yml */
  workingDirectory: string;

  /** Timeout for operations in milliseconds */
  timeout?: number;

  /** Whether to check SSH connectivity */
  checkSSH?: boolean;

  /** Whether to check container status */
  checkContainers?: boolean;

  /** Whether to check health status */
  checkHealth?: boolean;
}

/**
 * Failure Detection
 * Detects various types of deployment failures
 */
export class FailureDetection {
  private sshClient: SSHClient;
  private containerDeployment: ContainerDeployment;
  private healthCheck: HealthCheck;

  constructor(
    sshClient: SSHClient,
    containerDeployment: ContainerDeployment,
    healthCheck: HealthCheck
  ) {
    this.sshClient = sshClient;
    this.containerDeployment = containerDeployment;
    this.healthCheck = healthCheck;
  }

  /**
   * Detect SSH connection failures
   * 
   * @returns Failure detection result
   */
  async detectSSHFailure(): Promise<FailureDetectionResult> {
    logger.info('Checking SSH connection...');

    try {
      // Check if SSH client is connected
      if (!this.sshClient.isConnected()) {
        return {
          hasFailure: true,
          failureType: FailureType.SSH_CONNECTION,
          message: 'SSH connection is not established',
          timestamp: new Date(),
        };
      }

      // Verify SSH connection is working
      const isConnected = await this.sshClient.verifyConnection();

      if (!isConnected) {
        return {
          hasFailure: true,
          failureType: FailureType.SSH_CONNECTION,
          message: 'SSH connection verification failed',
          timestamp: new Date(),
        };
      }

      logger.info('SSH connection is healthy');
      return {
        hasFailure: false,
        message: 'SSH connection is healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`SSH connection check failed: ${errorMessage}`);

      return {
        hasFailure: true,
        failureType: FailureType.SSH_CONNECTION,
        message: `SSH connection error: ${errorMessage}`,
        diagnostics: { error: errorMessage },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Detect container startup failures
   * 
   * @param workingDirectory - Working directory containing docker-compose.yml
   * @returns Failure detection result
   */
  async detectContainerStartupFailure(
    workingDirectory: string
  ): Promise<FailureDetectionResult> {
    logger.info('Checking container startup status...');

    try {
      // Get container status
      const containers = await this.containerDeployment.getContainerStatus(workingDirectory);

      if (containers.length === 0) {
        return {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'No containers found',
          timestamp: new Date(),
        };
      }

      // Check for containers that failed to start
      const failedContainers = this.findFailedContainers(containers);

      if (failedContainers.length > 0) {
        const containerNames = failedContainers.map(c => c.name);
        const states = failedContainers.map(c => `${c.name}: ${c.state}`).join(', ');

        logger.error(`Container startup failures detected: ${states}`);

        return {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: `Containers failed to start: ${states}`,
          affectedContainers: containerNames,
          diagnostics: {
            containers: failedContainers,
          },
          timestamp: new Date(),
        };
      }

      // Check for containers that are not running
      const notRunning = containers.filter(c => c.state !== 'running');

      if (notRunning.length > 0) {
        const containerNames = notRunning.map(c => c.name);
        const states = notRunning.map(c => `${c.name}: ${c.state}`).join(', ');

        logger.warn(`Some containers are not running: ${states}`);

        return {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: `Containers not running: ${states}`,
          affectedContainers: containerNames,
          diagnostics: {
            containers: notRunning,
          },
          timestamp: new Date(),
        };
      }

      logger.info('All containers started successfully');
      return {
        hasFailure: false,
        message: 'All containers are running',
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Container startup check failed: ${errorMessage}`);

      return {
        hasFailure: true,
        failureType: FailureType.CONTAINER_STARTUP,
        message: `Container startup check error: ${errorMessage}`,
        diagnostics: { error: errorMessage },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Detect health check failures
   * 
   * @param workingDirectory - Working directory containing docker-compose.yml
   * @param timeout - Timeout for health checks in milliseconds
   * @returns Failure detection result
   */
  async detectHealthCheckFailure(
    workingDirectory: string,
    timeout: number = 300000
  ): Promise<FailureDetectionResult> {
    logger.info('Checking container health status...');

    try {
      // Verify container health
      const healthResult = await this.healthCheck.verifyContainerHealth({
        workingDirectory,
        timeout,
        maxRetries: 60,
        useExponentialBackoff: true,
      });

      if (!healthResult.allHealthy) {
        const unhealthyContainers = this.findUnhealthyContainers(healthResult.containers);
        const containerNames = unhealthyContainers.map(c => c.containerName);
        const statuses = unhealthyContainers
          .map(c => `${c.containerName}: ${c.status} (${c.state})`)
          .join(', ');

        logger.error(`Health check failures detected: ${statuses}`);

        return {
          hasFailure: true,
          failureType: FailureType.HEALTH_CHECK,
          message: healthResult.error || `Health checks failed: ${statuses}`,
          affectedContainers: containerNames,
          diagnostics: {
            containers: unhealthyContainers,
            duration: healthResult.duration,
          },
          timestamp: new Date(),
        };
      }

      logger.info('All health checks passed');
      return {
        hasFailure: false,
        message: 'All containers are healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Health check failed: ${errorMessage}`);

      return {
        hasFailure: true,
        failureType: FailureType.HEALTH_CHECK,
        message: `Health check error: ${errorMessage}`,
        diagnostics: { error: errorMessage },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Detect all types of failures
   * 
   * @param options - Failure detection options
   * @returns Array of failure detection results
   */
  async detectAllFailures(
    options: FailureDetectionOptions
  ): Promise<FailureDetectionResult[]> {
    const results: FailureDetectionResult[] = [];

    // Check SSH connection if requested
    if (options.checkSSH !== false) {
      const sshResult = await this.detectSSHFailure();
      results.push(sshResult);

      // If SSH fails, no point checking containers
      if (sshResult.hasFailure) {
        return results;
      }
    }

    // Check container startup if requested
    if (options.checkContainers !== false) {
      const containerResult = await this.detectContainerStartupFailure(
        options.workingDirectory
      );
      results.push(containerResult);

      // If containers failed to start, no point checking health
      if (containerResult.hasFailure) {
        return results;
      }
    }

    // Check health status if requested
    if (options.checkHealth !== false) {
      const healthResult = await this.detectHealthCheckFailure(
        options.workingDirectory,
        options.timeout
      );
      results.push(healthResult);
    }

    return results;
  }

  /**
   * Check if any failures were detected
   * 
   * @param results - Array of failure detection results
   * @returns True if any failures were detected
   */
  hasAnyFailure(results: FailureDetectionResult[]): boolean {
    return results.some(r => r.hasFailure);
  }

  /**
   * Get summary of all failures
   * 
   * @param results - Array of failure detection results
   * @returns Summary message
   */
  getFailureSummary(results: FailureDetectionResult[]): string {
    const failures = results.filter(r => r.hasFailure);

    if (failures.length === 0) {
      return 'No failures detected';
    }

    const messages = failures.map(f => {
      const type = f.failureType || 'unknown';
      const containers = f.affectedContainers
        ? ` (${f.affectedContainers.join(', ')})`
        : '';
      return `${type}${containers}: ${f.message}`;
    });

    return `${failures.length} failure(s) detected:\n${messages.join('\n')}`;
  }

  /**
   * Find containers that failed to start
   * 
   * @param containers - Container statuses
   * @returns Array of failed containers
   */
  private findFailedContainers(containers: ContainerStatus[]): ContainerStatus[] {
    return containers.filter(
      c =>
        c.state === 'exited' ||
        c.state === 'dead' ||
        c.state === 'removing' ||
        c.state === 'paused'
    );
  }

  /**
   * Find containers with unhealthy health status
   * 
   * @param containers - Container health statuses
   * @returns Array of unhealthy containers
   */
  private findUnhealthyContainers(
    containers: ContainerHealthStatus[]
  ): ContainerHealthStatus[] {
    return containers.filter(c => {
      // Container is unhealthy if:
      // 1. Health status is 'unhealthy', OR
      // 2. Container is not running (exited, dead, etc.)
      const isUnhealthy = c.status === 'unhealthy';
      const isNotRunning = c.state !== 'running';

      return isUnhealthy || isNotRunning;
    });
  }
}

/**
 * Create a failure detection instance
 * 
 * @param sshClient - SSH client
 * @param containerDeployment - Container deployment instance
 * @param healthCheck - Health check instance
 * @returns Failure detection instance
 */
export function createFailureDetection(
  sshClient: SSHClient,
  containerDeployment: ContainerDeployment,
  healthCheck: HealthCheck
): FailureDetection {
  return new FailureDetection(sshClient, containerDeployment, healthCheck);
}
