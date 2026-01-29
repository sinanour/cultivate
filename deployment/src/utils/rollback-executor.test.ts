/**
 * Unit tests for Rollback Executor Module
 */

import { RollbackExecutor, RollbackOptions } from './rollback-executor';
import { DeploymentStateManager } from './deployment-state';
import { SSHClient } from './ssh-client';
import { ImageTransfer } from './image-transfer';
import { ConfigTransfer } from './config-transfer';
import { ContainerDeployment } from './container-deployment';
import { HealthCheck } from './health-check';
import { DeploymentState } from '../types/deployment';

// Mock all dependencies
jest.mock('./deployment-state');
jest.mock('./ssh-client');
jest.mock('./image-transfer');
jest.mock('./config-transfer');
jest.mock('./container-deployment');
jest.mock('./health-check');

describe('RollbackExecutor', () => {
  let rollbackExecutor: RollbackExecutor;
  let mockStateManager: jest.Mocked<DeploymentStateManager>;
  let mockSSHClient: jest.Mocked<SSHClient>;
  let mockImageTransfer: jest.Mocked<ImageTransfer>;
  let mockConfigTransfer: jest.Mocked<ConfigTransfer>;
  let mockContainerDeployment: jest.Mocked<ContainerDeployment>;
  let mockHealthCheck: jest.Mocked<HealthCheck>;

  const mockPreviousState: DeploymentState = {
    version: '1.0.0',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    targetHost: 'test-host',
    imageVersions: {
      frontend: 'frontend:1.0.0',
      backend: 'backend:1.0.0',
      database: 'database:1.0.0'
    },
    configurationHash: 'abc123',
    status: 'active',
    healthChecks: []
  };

  beforeEach(() => {
    // Create mock instances
    mockStateManager = new DeploymentStateManager() as jest.Mocked<DeploymentStateManager>;
    mockSSHClient = new SSHClient({
      host: 'test-host',
      port: 22,
      username: 'test-user',
      timeout: 30000
    }) as jest.Mocked<SSHClient>;
    mockImageTransfer = new ImageTransfer() as jest.Mocked<ImageTransfer>;
    mockConfigTransfer = new ConfigTransfer(mockSSHClient) as jest.Mocked<ConfigTransfer>;
    mockContainerDeployment = new ContainerDeployment(mockSSHClient) as jest.Mocked<ContainerDeployment>;
    mockHealthCheck = new HealthCheck(mockSSHClient) as jest.Mocked<HealthCheck>;

    // Create rollback executor with mocks
    rollbackExecutor = new RollbackExecutor(
      mockStateManager,
      mockSSHClient,
      mockImageTransfer,
      mockConfigTransfer,
      mockContainerDeployment,
      mockHealthCheck
    );

    // Setup default mock implementations
    mockSSHClient.connect = jest.fn().mockResolvedValue(undefined);
    mockSSHClient.disconnect = jest.fn().mockResolvedValue(undefined);
    mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
      stdout: 'image-id-123',
      stderr: '',
      exitCode: 0
    });
    mockSSHClient.uploadFile = jest.fn().mockResolvedValue(undefined);

    mockContainerDeployment.stopContainers = jest.fn().mockResolvedValue(undefined);
    mockContainerDeployment.deployContainers = jest.fn().mockResolvedValue({
      success: true,
      containers: [],
      logs: []
    });

    mockHealthCheck.verifyContainerHealth = jest.fn().mockResolvedValue({
      allHealthy: true,
      containers: [
        { containerName: 'cat_frontend', status: 'healthy', state: 'running', attempts: 1 },
        { containerName: 'cat_backend', status: 'healthy', state: 'running', attempts: 1 },
        { containerName: 'cat_database', status: 'healthy', state: 'running', attempts: 1 }
      ],
      duration: 1000
    });
  });

  describe('executeRollback', () => {
    const rollbackOptions: RollbackOptions = {
      targetHost: 'test-host',
      sshConfig: {
        username: 'test-user',
        privateKeyPath: '/path/to/key'
      }
    };

    it('should successfully rollback to previous deployment', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.success).toBe(true);
      expect(result.restoredState?.version).toBe('1.0.0');
      expect(result.error).toBeUndefined();
      expect(mockSSHClient.connect).toHaveBeenCalled();
      expect(mockContainerDeployment.stopContainers).toHaveBeenCalled();
      expect(mockContainerDeployment.deployContainers).toHaveBeenCalled();
      expect(mockSSHClient.disconnect).toHaveBeenCalled();
    });

    it('should fail when no previous deployment exists', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(false);

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No previous deployment state found');
      expect(mockSSHClient.connect).not.toHaveBeenCalled();
    });

    it('should fail when previous state cannot be loaded', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(null);

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load previous deployment state');
    });

    it('should verify health checks when verifyHealth is true', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      const result = await rollbackExecutor.executeRollback({
        ...rollbackOptions,
        verifyHealth: true
      });

      expect(result.success).toBe(true);
      expect(mockHealthCheck.verifyContainerHealth).toHaveBeenCalledTimes(1);
    });

    it('should skip health checks when verifyHealth is false', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      const result = await rollbackExecutor.executeRollback({
        ...rollbackOptions,
        verifyHealth: false
      });

      expect(result.success).toBe(true);
      expect(mockHealthCheck.verifyContainerHealth).not.toHaveBeenCalled();
    });

    it('should fail when health checks fail', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      mockHealthCheck.verifyContainerHealth = jest.fn().mockResolvedValue({
        allHealthy: false,
        containers: [
          { containerName: 'cat_frontend', status: 'unhealthy', state: 'running', attempts: 5, lastError: 'Service not responding' }
        ],
        duration: 5000,
        error: 'Health check failed'
      });

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Health check failed');
    });

    it('should continue rollback even if stopping containers fails', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      mockContainerDeployment.stopContainers = jest.fn().mockRejectedValue(
        new Error('Failed to stop containers')
      );

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.success).toBe(true);
      expect(mockContainerDeployment.deployContainers).toHaveBeenCalled();
    });

    it('should fail when images do not exist on target host', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);

      mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
        stdout: '', // Empty output means image not found
        stderr: '',
        exitCode: 0
      });

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Previous Docker images not available');
    });

    it('should disconnect SSH client even if rollback fails', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);

      mockContainerDeployment.deployContainers = jest.fn().mockRejectedValue(
        new Error('Failed to start containers')
      );

      await rollbackExecutor.executeRollback(rollbackOptions);

      expect(mockSSHClient.disconnect).toHaveBeenCalled();
    });

    it('should update deployment state after successful rollback', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      await rollbackExecutor.executeRollback(rollbackOptions);

      expect(mockStateManager.saveCurrentState).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.0.0',
          status: 'active'
        })
      );
    });

    it('should include logs in the result', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      const result = await rollbackExecutor.executeRollback(rollbackOptions);

      expect(result.logs).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0]).toContain('Starting rollback operation');
    });

    it('should upload docker-compose file with previous image versions', async () => {
      mockStateManager.hasPreviousState = jest.fn().mockResolvedValue(true);
      mockStateManager.loadPreviousState = jest.fn().mockResolvedValue(mockPreviousState);
      mockStateManager.saveCurrentState = jest.fn().mockResolvedValue(undefined);

      await rollbackExecutor.executeRollback(rollbackOptions);

      expect(mockSSHClient.uploadFile).toHaveBeenCalled();
      const uploadCall = mockSSHClient.uploadFile.mock.calls[0];
      const composeContent = uploadCall[0].toString();

      expect(composeContent).toContain('frontend:1.0.0');
      expect(composeContent).toContain('backend:1.0.0');
      expect(composeContent).toContain('database:1.0.0');
    });
  });
});
