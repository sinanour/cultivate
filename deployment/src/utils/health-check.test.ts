import { HealthCheck, HealthCheckOptions } from './health-check';
import { SSHClient } from './ssh-client';

// Mock the logger
jest.mock('./logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('HealthCheck', () => {
  let mockSSHClient: jest.Mocked<SSHClient>;
  let healthCheck: HealthCheck;

  beforeEach(() => {
    // Create mock SSH client
    mockSSHClient = {
      executeCommand: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      verifyConnection: jest.fn(),
      isConnected: jest.fn(),
      getConnectionInfo: jest.fn(),
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
      executeCommandSimple: jest.fn(),
    } as any;

    healthCheck = new HealthCheck(mockSSHClient);
  });

  describe('verifyContainerHealth', () => {
    const defaultOptions: HealthCheckOptions = {
      workingDirectory: '/opt/app',
      timeout: 10000,
      checkInterval: 1000,
      maxRetries: 5,
      useExponentialBackoff: false,
    };

    it('should verify all containers are healthy', async () => {
      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }) + '\n' + JSON.stringify({ Name: 'app_api' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock health checks for both containers (healthy)
        .mockResolvedValueOnce({
          stdout: 'running|healthy',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'running|healthy',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(true);
      expect(result.containers).toHaveLength(2);
      expect(result.containers[0].status).toBe('healthy');
      expect(result.containers[1].status).toBe('healthy');
      expect(result.error).toBeUndefined();
    });

    it('should handle containers without health checks', async () => {
      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock health check (no health check defined, but running)
        .mockResolvedValueOnce({
          stdout: 'running|none',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(true);
      expect(result.containers[0].status).toBe('none');
      expect(result.containers[0].state).toBe('running');
    });

    it('should wait for containers to become healthy', async () => {
      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // First check - starting
        .mockResolvedValueOnce({
          stdout: 'running|starting',
          stderr: '',
          exitCode: 0,
        })
        // Second check - still starting
        .mockResolvedValueOnce({
          stdout: 'running|starting',
          stderr: '',
          exitCode: 0,
        })
        // Third check - healthy
        .mockResolvedValueOnce({
          stdout: 'running|healthy',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(true);
      expect(result.containers[0].attempts).toBe(3);
    });

    it('should fail when container becomes unhealthy', async () => {
      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock health check (unhealthy)
        .mockResolvedValueOnce({
          stdout: 'running|unhealthy',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(false);
      expect(result.containers[0].status).toBe('unhealthy');
      expect(result.error).toContain('failed health checks');
    });

    it('should fail when container exits', async () => {
      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock health check (exited)
        .mockResolvedValueOnce({
          stdout: 'exited|none',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(false);
      expect(result.containers[0].state).toBe('exited');
      expect(result.error).toContain('failed health checks');
    });

    it('should timeout when containers do not become healthy', async () => {
      const shortTimeoutOptions: HealthCheckOptions = {
        ...defaultOptions,
        timeout: 3000,
        checkInterval: 1000,
        maxRetries: 2,
      };

      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock health checks (always starting)
        .mockResolvedValue({
          stdout: 'running|starting',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(shortTimeoutOptions);

      expect(result.allHealthy).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should use exponential backoff when enabled', async () => {
      const backoffOptions: HealthCheckOptions = {
        ...defaultOptions,
        useExponentialBackoff: true,
        initialBackoffDelay: 100,
        maxBackoffDelay: 1000,
        maxRetries: 3,
      };

      const startTime = Date.now();

      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // First check - starting
        .mockResolvedValueOnce({
          stdout: 'running|starting',
          stderr: '',
          exitCode: 0,
        })
        // Second check - starting
        .mockResolvedValueOnce({
          stdout: 'running|starting',
          stderr: '',
          exitCode: 0,
        })
        // Third check - healthy
        .mockResolvedValueOnce({
          stdout: 'running|healthy',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.verifyContainerHealth(backoffOptions);
      const duration = Date.now() - startTime;

      expect(result.allHealthy).toBe(true);
      // With exponential backoff: 100ms + 200ms = 300ms minimum
      expect(duration).toBeGreaterThanOrEqual(300);
    });

    it('should handle no containers found', async () => {
      // Mock getting container names (empty)
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain('No containers found');
    });

    it('should handle SSH command errors gracefully', async () => {
      // Mock getting container names
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock health check error
        .mockRejectedValueOnce(new Error('SSH connection lost'));

      const result = await healthCheck.verifyContainerHealth(defaultOptions);

      expect(result.allHealthy).toBe(false);
      expect(result.containers[0].lastError).toContain('SSH connection lost');
    });
  });

  describe('checkContainerHealth', () => {
    it('should check container health status', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'running|healthy',
        stderr: '',
        exitCode: 0,
      });

      const health = await healthCheck.checkContainerHealth('app_web', '/opt/app');

      expect(health.status).toBe('healthy');
      expect(health.state).toBe('running');
      expect(health.lastError).toBeUndefined();
    });

    it('should handle containers without health checks', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'running|none',
        stderr: '',
        exitCode: 0,
      });

      const health = await healthCheck.checkContainerHealth('app_web', '/opt/app');

      expect(health.status).toBe('none');
      expect(health.state).toBe('running');
    });

    it('should handle unhealthy containers', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'running|unhealthy',
        stderr: '',
        exitCode: 0,
      });

      const health = await healthCheck.checkContainerHealth('app_web', '/opt/app');

      expect(health.status).toBe('unhealthy');
      expect(health.state).toBe('running');
    });

    it('should handle starting containers', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'running|starting',
        stderr: '',
        exitCode: 0,
      });

      const health = await healthCheck.checkContainerHealth('app_web', '/opt/app');

      expect(health.status).toBe('starting');
      expect(health.state).toBe('running');
    });

    it('should handle command failures', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Container not found',
        exitCode: 1,
      });

      const health = await healthCheck.checkContainerHealth('app_web', '/opt/app');

      expect(health.status).toBe('unhealthy');
      expect(health.state).toBe('unknown');
      expect(health.lastError).toContain('Container not found');
    });

    it('should handle exceptions', async () => {
      mockSSHClient.executeCommand.mockRejectedValueOnce(new Error('Network error'));

      const health = await healthCheck.checkContainerHealth('app_web', '/opt/app');

      expect(health.status).toBe('unhealthy');
      expect(health.state).toBe('unknown');
      expect(health.lastError).toContain('Network error');
    });
  });

  describe('waitForContainerHealthy', () => {
    it('should wait for container to become healthy', async () => {
      mockSSHClient.executeCommand
        // First check - starting
        .mockResolvedValueOnce({
          stdout: 'running|starting',
          stderr: '',
          exitCode: 0,
        })
        // Second check - healthy
        .mockResolvedValueOnce({
          stdout: 'running|healthy',
          stderr: '',
          exitCode: 0,
        });

      const result = await healthCheck.waitForContainerHealthy('app_web', '/opt/app', 10000);

      expect(result).toBe(true);
    });

    it('should return true for containers without health checks that are running', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'running|none',
        stderr: '',
        exitCode: 0,
      });

      const result = await healthCheck.waitForContainerHealthy('app_web', '/opt/app', 10000);

      expect(result).toBe(true);
    });

    it('should return false when container exits', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'exited|none',
        stderr: '',
        exitCode: 0,
      });

      const result = await healthCheck.waitForContainerHealthy('app_web', '/opt/app', 10000);

      expect(result).toBe(false);
    });

    it('should timeout when container does not become healthy', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'running|starting',
        stderr: '',
        exitCode: 0,
      });

      const result = await healthCheck.waitForContainerHealthy('app_web', '/opt/app', 3000);

      expect(result).toBe(false);
    });
  });
});
