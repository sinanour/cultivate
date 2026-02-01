/**
 * Rollback Verification Module
 * 
 * Verifies that containers start successfully after rollback and runs health checks.
 * 
 * Requirements: 14.5
 */

import { SSHClient } from './ssh-client';
import { HealthCheck, HealthCheckResult } from './health-check';
import { createLogger } from './logger';

const logger = createLogger();

/**
 * Rollback verification options
 */
export interface RollbackVerificationOptions {
  /** Working directory containing docker-compose.yml */
  workingDirectory: string;

  /** Timeout for verification in milliseconds */
  timeout?: number;

  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Whether to check container logs on failure */
  captureLogs?: boolean;
}

/**
 * Container verification status
 */
export interface ContainerVerificationStatus {
  /** Container name */
  containerName: string;

  /** Whether container is running */
  isRunning: boolean;

  /** Health status */
  healthStatus: 'healthy' | 'unhealthy' | 'starting' | 'none';

  /** Container uptime */
  uptime?: string;

  /** Container logs (if captured) */
  logs?: string;

  /** Error message if verification failed */
  error?: string;
}

/**
 * Rollback verification result
 */
export interface RollbackVerificationResult {
  /** Whether all containers are verified */
  success: boolean;

  /** Individual container statuses */
  containers: ContainerVerificationStatus[];

  /** Overall health check result */
  healthCheckResult?: HealthCheckResult;

  /** Total verification time in milliseconds */
  duration: number;

  /** Error message if verification failed */
  error?: string;
}

/**
 * Rollback Verification
 * Verifies that rolled-back deployment is healthy and operational
 */
export class RollbackVerification {
  private sshClient: SSHClient;
  private healthCheck: HealthCheck;
  private composeCommand: string;

  constructor(sshClient: SSHClient, composeCommand: string = 'docker-compose') {
    this.sshClient = sshClient;
    this.composeCommand = composeCommand;
    this.healthCheck = new HealthCheck(sshClient, composeCommand);
  }

  /**
   * Verify rollback success
   * Checks that all containers are running and healthy
   * 
   * @param options - Verification options
   * @returns Verification result
   */
  async verifyRollback(
    options: RollbackVerificationOptions
  ): Promise<RollbackVerificationResult> {
    const startTime = Date.now();
    logger.info('Starting rollback verification');

    try {
      // Step 1: Verify containers are running
      const containerStatuses = await this.verifyContainersRunning(options);

      const allRunning = containerStatuses.every(status => status.isRunning);
      if (!allRunning) {
        const notRunning = containerStatuses
          .filter(status => !status.isRunning)
          .map(status => status.containerName);

        return {
          success: false,
          containers: containerStatuses,
          duration: Date.now() - startTime,
          error: `Containers not running after rollback: ${notRunning.join(', ')}`
        };
      }

      logger.info('All containers are running');

      // Step 2: Run health checks
      const healthCheckResult = await this.healthCheck.verifyContainerHealth({
        workingDirectory: options.workingDirectory,
        timeout: options.timeout || 300000,
        maxRetries: options.maxRetries || 60
      });

      // Update container statuses with health check results
      containerStatuses.forEach(status => {
        const healthStatus = healthCheckResult.containers.find(
          c => c.containerName === status.containerName
        );
        if (healthStatus) {
          status.healthStatus = healthStatus.status;
        }
      });

      if (!healthCheckResult.allHealthy) {
        const unhealthy = healthCheckResult.containers
          .filter(c => c.status !== 'healthy')
          .map(c => c.containerName);

        // Capture logs if requested
        if (options.captureLogs) {
          await this.captureContainerLogs(containerStatuses, options.workingDirectory);
        }

        return {
          success: false,
          containers: containerStatuses,
          healthCheckResult,
          duration: Date.now() - startTime,
          error: `Health checks failed for containers: ${unhealthy.join(', ')}`
        };
      }

      logger.info('All health checks passed');

      return {
        success: true,
        containers: containerStatuses,
        healthCheckResult,
        duration: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = `Rollback verification failed: ${error}`;
      logger.error(errorMessage);

      return {
        success: false,
        containers: [],
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Verify that all containers are running
   * 
   * @param options - Verification options
   * @returns Container statuses
   */
  private async verifyContainersRunning(
    options: RollbackVerificationOptions
  ): Promise<ContainerVerificationStatus[]> {
    logger.info('Verifying containers are running');

    const command = `cd ${options.workingDirectory} && ${this.composeCommand} -f docker-compose.yml ps --format json`;
    const result = await this.sshClient.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get container status: ${result.stderr}`);
    }

    // Parse docker-compose ps output (JSON format)
    const lines = result.stdout.trim().split('\n').filter(line => line.trim());
    const containers: ContainerVerificationStatus[] = [];

    for (const line of lines) {
      try {
        const containerInfo = JSON.parse(line);
        containers.push({
          containerName: containerInfo.Name || containerInfo.name,
          isRunning: containerInfo.State === 'running' || containerInfo.state === 'running',
          healthStatus: this.parseHealthStatus(containerInfo.Health || containerInfo.health),
          uptime: containerInfo.Status || containerInfo.status
        });
      } catch (error) {
        logger.warn(`Failed to parse container info: ${line}`);
      }
    }

    return containers;
  }

  /**
   * Parse health status from docker-compose output
   * 
   * @param health - Health string from docker-compose
   * @returns Normalized health status
   */
  private parseHealthStatus(health: string | undefined): 'healthy' | 'unhealthy' | 'starting' | 'none' {
    if (!health) {
      return 'none';
    }

    const healthLower = health.toLowerCase();
    if (healthLower.includes('healthy') && !healthLower.includes('unhealthy')) {
      return 'healthy';
    } else if (healthLower.includes('unhealthy')) {
      return 'unhealthy';
    } else if (healthLower.includes('starting')) {
      return 'starting';
    }

    return 'none';
  }

  /**
   * Capture container logs for diagnostics
   * 
   * @param containers - Container statuses to capture logs for
   * @param workingDirectory - Working directory
   */
  private async captureContainerLogs(
    containers: ContainerVerificationStatus[],
    workingDirectory: string
  ): Promise<void> {
    logger.info('Capturing container logs for diagnostics');

    for (const container of containers) {
      try {
        const command = `cd ${workingDirectory} && docker-compose logs --tail=100 ${container.containerName}`;
        const result = await this.sshClient.executeCommand(command);

        if (result.exitCode === 0) {
          container.logs = result.stdout;
        } else {
          container.error = `Failed to capture logs: ${result.stderr}`;
        }
      } catch (error) {
        container.error = `Failed to capture logs: ${error}`;
      }
    }
  }

  /**
   * Quick verification that containers are running
   * Lighter weight check without full health verification
   * 
   * @param workingDirectory - Working directory
   * @returns True if all containers are running
   */
  async quickVerify(workingDirectory: string): Promise<boolean> {
    try {
      const containerStatuses = await this.verifyContainersRunning({
        workingDirectory
      });

      return containerStatuses.every(status => status.isRunning);
    } catch (error) {
      logger.error(`Quick verification failed: ${error}`);
      return false;
    }
  }
}
