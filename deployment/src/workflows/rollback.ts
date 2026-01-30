/**
 * Rollback workflow
 * Restores the previous deployment state
 * 
 * Workflow steps:
 * 1. Load previous deployment state
 * 2. Establish SSH connection
 * 3. Stop current containers
 * 4. Restore previous images
 * 5. Restore previous configuration
 * 6. Start containers with previous versions
 * 7. Verify rollback success
 * 
 * Requirements:
 * - 14.2: Provide rollback command to restore previous deployment
 * - 14.4: Restore previous configuration files
 * - 14.5: Verify successful rollback
 */

import type { DeploymentOptions, DeploymentResult } from '../types/deployment.js';
import { createLogger } from '../utils/logger.js';
import { SSHClient } from '../utils/ssh-client.js';
import { DeploymentStateManager } from '../utils/deployment-state.js';
import { ImageTransfer } from '../utils/image-transfer.js';
import { ConfigTransfer } from '../utils/config-transfer.js';
import { ContainerDeployment } from '../utils/container-deployment.js';
import { HealthCheck } from '../utils/health-check.js';
import { RollbackExecutor } from '../utils/rollback-executor.js';

const logger = createLogger();

/**
 * Execute the rollback workflow
 */
export async function rollbackWorkflow(
  options: DeploymentOptions
): Promise<DeploymentResult> {
  logger.info('Executing rollback workflow', {
    targetHost: options.targetHost
  });

  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(message);
    logger.info(message);
  };

  let sshClient: SSHClient | null = null;
  const stateManager = new DeploymentStateManager(options.stateFilePath);

  try {
    // Step 1: Check if previous deployment exists
    log('Step 1: Checking for previous deployment...');
    const hasPrevious = await stateManager.hasPreviousState();

    if (!hasPrevious) {
      const error = 'No previous deployment state found for rollback';
      log(`ERROR: ${error}`);
      throw new Error(error);
    }

    const previousState = await stateManager.loadPreviousState();
    if (!previousState) {
      const error = 'Failed to load previous deployment state';
      log(`ERROR: ${error}`);
      throw new Error(error);
    }

    log(`Found previous deployment: version ${previousState.version}`);

    // Step 2: Establish SSH connection
    log('Step 2: Establishing SSH connection...');
    sshClient = new SSHClient({
      host: options.targetHost,
      port: options.sshConfig?.port || 22,
      username: options.sshConfig?.username || 'root',
      privateKeyPath: options.sshConfig?.privateKeyPath,
      timeout: options.sshConfig?.timeout || 30000
    });

    await sshClient.connect();
    const verified = await sshClient.verifyConnection();
    if (!verified) {
      throw new Error('SSH connection verification failed');
    }
    log(`SSH connection established to ${options.targetHost}`);

    // Step 3-7: Execute rollback using RollbackExecutor
    log('Step 3: Executing rollback...');

    const imageTransfer = new ImageTransfer();
    const configTransfer = new ConfigTransfer(sshClient);
    const containerDeployment = new ContainerDeployment(sshClient);
    const healthCheck = new HealthCheck(sshClient);

    const rollbackExecutor = new RollbackExecutor(
      stateManager,
      sshClient,
      imageTransfer,
      configTransfer,
      containerDeployment,
      healthCheck
    );

    const rollbackResult = await rollbackExecutor.executeRollback({
      targetHost: options.targetHost,
      sshConfig: {
        username: options.sshConfig?.username || 'root',
        port: options.sshConfig?.port || 22,
        privateKeyPath: options.sshConfig?.privateKeyPath,
        timeout: options.sshConfig?.timeout || 30000
      },
      stateDir: options.stateFilePath,
      composePath: '/opt/community-tracker/docker-compose.yml',
      verifyHealth: true
    });

    // Add rollback logs to our logs
    logs.push(...rollbackResult.logs);

    if (!rollbackResult.success) {
      throw new Error(`Rollback failed: ${rollbackResult.error}`);
    }

    log('Rollback completed successfully');

    // Load the restored state
    const restoredState = await stateManager.loadCurrentState();

    return {
      success: true,
      state: restoredState || previousState,
      logs
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Rollback workflow failed', { error: errorMessage });
    log(`ERROR: ${errorMessage}`);

    // Try to update state to rolled_back status even on failure
    try {
      await stateManager.updateStatus('rolled_back');
    } catch (stateError) {
      logger.warn('Failed to update deployment state', { error: stateError });
    }

    const currentState = await stateManager.loadCurrentState();

    return {
      success: false,
      state: currentState || {
        version: 'unknown',
        timestamp: new Date(),
        targetHost: options.targetHost,
        imageVersions: { frontend: 'unknown', backend: 'unknown', database: 'unknown' },
        configurationHash: 'unknown',
        status: 'rolled_back',
        healthChecks: []
      },
      error: errorMessage,
      logs
    };
  } finally {
    // Cleanup: disconnect SSH
    if (sshClient && sshClient.isConnected()) {
      await sshClient.disconnect();
      logger.info('SSH connection closed');
    }
  }
}
