/**
 * Unit tests for Failure Detection Module
 */

import { FailureDetection, FailureType, createFailureDetection } from './failure-detection';
import { SSHClient } from './ssh-client';
import { ContainerDeployment, ContainerStatus } from './container-deployment';
import { HealthCheck } from './health-check';

// Mock dependencies
jest.mock('./logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('FailureDetection', () => {
  let sshClient: SSHClient;
  let containerDeployment: ContainerDeployment;
  let healthCheck: HealthCheck;
  let failureDetection: FailureDetection;

  beforeEach(() => {
    // Create mock instances
    sshClient = {
      isConnected: jest.fn(),
      verifyConnection: jest.fn(),
    } as unknown as SSHClient;

    containerDeployment = {
      getContainerStatus: jest.fn(),
    } as unknown as ContainerDeployment;

    healthCheck = {
      verifyContainerHealth: jest.fn(),
    } as unknown as HealthCheck;

    failureDetection = new FailureDetection(
      sshClient,
      containerDeployment,
      healthCheck
    );
  });

  describe('detectSSHFailure', () => {
    it('should detect when SSH is not connected', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(false);

      const result = await failureDetection.detectSSHFailure();

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.SSH_CONNECTION);
      expect(result.message).toContain('not established');
    });

    it('should detect when SSH connection verification fails', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(true);
      (sshClient.verifyConnection as jest.Mock).mockResolvedValue(false);

      const result = await failureDetection.detectSSHFailure();

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.SSH_CONNECTION);
      expect(result.message).toContain('verification failed');
    });

    it('should return no failure when SSH is healthy', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(true);
      (sshClient.verifyConnection as jest.Mock).mockResolvedValue(true);

      const result = await failureDetection.detectSSHFailure();

      expect(result.hasFailure).toBe(false);
      expect(result.message).toContain('healthy');
    });

    it('should handle SSH verification errors', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(true);
      (sshClient.verifyConnection as jest.Mock).mockRejectedValue(
        new Error('Connection timeout')
      );

      const result = await failureDetection.detectSSHFailure();

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.SSH_CONNECTION);
      expect(result.message).toContain('Connection timeout');
      expect(result.diagnostics).toBeDefined();
    });
  });

  describe('detectContainerStartupFailure', () => {
    it('should detect when no containers are found', async () => {
      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue([]);

      const result = await failureDetection.detectContainerStartupFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.CONTAINER_STARTUP);
      expect(result.message).toContain('No containers found');
    });

    it('should detect exited containers', async () => {
      const containers: ContainerStatus[] = [
        {
          name: 'test_container',
          state: 'exited',
          health: 'none',
          uptime: '0s',
        },
      ];

      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
        containers
      );

      const result = await failureDetection.detectContainerStartupFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.CONTAINER_STARTUP);
      expect(result.affectedContainers).toContain('test_container');
      expect(result.message).toContain('exited');
    });

    it('should detect dead containers', async () => {
      const containers: ContainerStatus[] = [
        {
          name: 'test_container',
          state: 'dead',
          health: 'none',
          uptime: '0s',
        },
      ];

      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
        containers
      );

      const result = await failureDetection.detectContainerStartupFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.CONTAINER_STARTUP);
      expect(result.affectedContainers).toContain('test_container');
    });

    it('should detect containers that are not running', async () => {
      const containers: ContainerStatus[] = [
        {
          name: 'test_container',
          state: 'created',
          health: 'none',
          uptime: '0s',
        },
      ];

      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
        containers
      );

      const result = await failureDetection.detectContainerStartupFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.CONTAINER_STARTUP);
      expect(result.affectedContainers).toContain('test_container');
      expect(result.message).toContain('not running');
    });

    it('should return no failure when all containers are running', async () => {
      const containers: ContainerStatus[] = [
        {
          name: 'container1',
          state: 'running',
          health: 'healthy',
          uptime: '5m',
        },
        {
          name: 'container2',
          state: 'running',
          health: 'healthy',
          uptime: '5m',
        },
      ];

      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
        containers
      );

      const result = await failureDetection.detectContainerStartupFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(false);
      expect(result.message).toContain('running');
    });

    it('should handle errors when checking container status', async () => {
      (containerDeployment.getContainerStatus as jest.Mock).mockRejectedValue(
        new Error('Docker daemon not running')
      );

      const result = await failureDetection.detectContainerStartupFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.CONTAINER_STARTUP);
      expect(result.message).toContain('Docker daemon not running');
    });
  });

  describe('detectHealthCheckFailure', () => {
    it('should detect unhealthy containers', async () => {
      const healthResult = {
        allHealthy: false,
        containers: [
          {
            containerName: 'test_container',
            status: 'unhealthy' as const,
            state: 'running',
            attempts: 5,
            lastError: 'Health check failed',
          },
        ],
        duration: 30000,
        error: 'Health checks failed',
      };

      (healthCheck.verifyContainerHealth as jest.Mock).mockResolvedValue(
        healthResult
      );

      const result = await failureDetection.detectHealthCheckFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.HEALTH_CHECK);
      expect(result.affectedContainers).toContain('test_container');
      expect(result.message).toContain('Health checks failed');
    });

    it('should detect containers that are not running', async () => {
      const healthResult = {
        allHealthy: false,
        containers: [
          {
            containerName: 'test_container',
            status: 'none' as const,
            state: 'exited',
            attempts: 3,
          },
        ],
        duration: 15000,
        error: 'Container exited',
      };

      (healthCheck.verifyContainerHealth as jest.Mock).mockResolvedValue(
        healthResult
      );

      const result = await failureDetection.detectHealthCheckFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.HEALTH_CHECK);
      expect(result.affectedContainers).toContain('test_container');
    });

    it('should return no failure when all containers are healthy', async () => {
      const healthResult = {
        allHealthy: true,
        containers: [
          {
            containerName: 'container1',
            status: 'healthy' as const,
            state: 'running',
            attempts: 2,
          },
          {
            containerName: 'container2',
            status: 'healthy' as const,
            state: 'running',
            attempts: 2,
          },
        ],
        duration: 10000,
      };

      (healthCheck.verifyContainerHealth as jest.Mock).mockResolvedValue(
        healthResult
      );

      const result = await failureDetection.detectHealthCheckFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(false);
      expect(result.message).toContain('healthy');
    });

    it('should handle health check errors', async () => {
      (healthCheck.verifyContainerHealth as jest.Mock).mockRejectedValue(
        new Error('Health check timeout')
      );

      const result = await failureDetection.detectHealthCheckFailure(
        '/opt/test'
      );

      expect(result.hasFailure).toBe(true);
      expect(result.failureType).toBe(FailureType.HEALTH_CHECK);
      expect(result.message).toContain('Health check timeout');
    });

    it('should pass timeout to health check', async () => {
      const healthResult = {
        allHealthy: true,
        containers: [],
        duration: 5000,
      };

      (healthCheck.verifyContainerHealth as jest.Mock).mockResolvedValue(
        healthResult
      );

      await failureDetection.detectHealthCheckFailure('/opt/test', 60000);

      expect(healthCheck.verifyContainerHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });
  });

  describe('detectAllFailures', () => {
    it('should check all failure types when requested', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(true);
      (sshClient.verifyConnection as jest.Mock).mockResolvedValue(true);
      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue([
        {
          name: 'test',
          state: 'running',
          health: 'healthy',
          uptime: '5m',
        },
      ]);
      (healthCheck.verifyContainerHealth as jest.Mock).mockResolvedValue({
        allHealthy: true,
        containers: [],
        duration: 5000,
      });

      const results = await failureDetection.detectAllFailures({
        workingDirectory: '/opt/test',
        checkSSH: true,
        checkContainers: true,
        checkHealth: true,
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => !r.hasFailure)).toBe(true);
    });

    it('should stop checking after SSH failure', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(false);

      const results = await failureDetection.detectAllFailures({
        workingDirectory: '/opt/test',
        checkSSH: true,
        checkContainers: true,
        checkHealth: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].failureType).toBe(FailureType.SSH_CONNECTION);
      expect(containerDeployment.getContainerStatus).not.toHaveBeenCalled();
    });

    it('should stop checking after container startup failure', async () => {
      (sshClient.isConnected as jest.Mock).mockReturnValue(true);
      (sshClient.verifyConnection as jest.Mock).mockResolvedValue(true);
      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue([
        {
          name: 'test',
          state: 'exited',
          health: 'none',
          uptime: '0s',
        },
      ]);

      const results = await failureDetection.detectAllFailures({
        workingDirectory: '/opt/test',
        checkSSH: true,
        checkContainers: true,
        checkHealth: true,
      });

      expect(results).toHaveLength(2);
      expect(results[1].failureType).toBe(FailureType.CONTAINER_STARTUP);
      expect(healthCheck.verifyContainerHealth).not.toHaveBeenCalled();
    });

    it('should skip SSH check when not requested', async () => {
      (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue([]);

      const results = await failureDetection.detectAllFailures({
        workingDirectory: '/opt/test',
        checkSSH: false,
        checkContainers: true,
        checkHealth: false,
      });

      expect(sshClient.isConnected).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });
  });

  describe('hasAnyFailure', () => {
    it('should return true when failures exist', () => {
      const results = [
        {
          hasFailure: false,
          message: 'OK',
          timestamp: new Date(),
        },
        {
          hasFailure: true,
          failureType: FailureType.SSH_CONNECTION,
          message: 'Failed',
          timestamp: new Date(),
        },
      ];

      expect(failureDetection.hasAnyFailure(results)).toBe(true);
    });

    it('should return false when no failures exist', () => {
      const results = [
        {
          hasFailure: false,
          message: 'OK',
          timestamp: new Date(),
        },
        {
          hasFailure: false,
          message: 'OK',
          timestamp: new Date(),
        },
      ];

      expect(failureDetection.hasAnyFailure(results)).toBe(false);
    });
  });

  describe('getFailureSummary', () => {
    it('should return summary of all failures', () => {
      const results = [
        {
          hasFailure: true,
          failureType: FailureType.SSH_CONNECTION,
          message: 'SSH failed',
          timestamp: new Date(),
        },
        {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'Container exited',
          affectedContainers: ['test_container'],
          timestamp: new Date(),
        },
      ];

      const summary = failureDetection.getFailureSummary(results);

      expect(summary).toContain('2 failure(s)');
      expect(summary).toContain('ssh_connection');
      expect(summary).toContain('container_startup');
      expect(summary).toContain('test_container');
    });

    it('should return no failures message when no failures', () => {
      const results = [
        {
          hasFailure: false,
          message: 'OK',
          timestamp: new Date(),
        },
      ];

      const summary = failureDetection.getFailureSummary(results);

      expect(summary).toBe('No failures detected');
    });
  });

  describe('createFailureDetection', () => {
    it('should create a failure detection instance', () => {
      const instance = createFailureDetection(
        sshClient,
        containerDeployment,
        healthCheck
      );

      expect(instance).toBeInstanceOf(FailureDetection);
    });
  });
});
