/**
 * Unit tests for Rollback Verification Module
 */

import { RollbackVerification, RollbackVerificationOptions } from './rollback-verification';
import { SSHClient } from './ssh-client';
import { HealthCheck } from './health-check';

// Mock dependencies
jest.mock('./ssh-client');
jest.mock('./health-check');

describe('RollbackVerification', () => {
  let rollbackVerification: RollbackVerification;
  let mockSSHClient: jest.Mocked<SSHClient>;
  let mockHealthCheck: jest.Mocked<HealthCheck>;

  beforeEach(() => {
    mockSSHClient = new SSHClient({
      host: 'test-host',
      port: 22,
      username: 'test-user',
      timeout: 30000
    }) as jest.Mocked<SSHClient>;

    rollbackVerification = new RollbackVerification(mockSSHClient);

    // Access the private healthCheck instance for mocking
    mockHealthCheck = (rollbackVerification as any).healthCheck as jest.Mocked<HealthCheck>;

    // Setup default mock implementations
    mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
      stdout: JSON.stringify({
        Name: 'cat_frontend',
        State: 'running',
        Health: 'healthy',
        Status: 'Up 5 minutes'
      }) + '\n' + JSON.stringify({
        Name: 'cat_backend',
        State: 'running',
        Health: 'healthy',
        Status: 'Up 5 minutes'
      }) + '\n' + JSON.stringify({
        Name: 'cat_database',
        State: 'running',
        Health: 'healthy',
        Status: 'Up 5 minutes'
      }),
      stderr: '',
      exitCode: 0
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

  describe('verifyRollback', () => {
    const verificationOptions: RollbackVerificationOptions = {
      workingDirectory: '/opt/community-tracker'
    };

    it('should successfully verify rollback when all containers are healthy', async () => {
      const result = await rollbackVerification.verifyRollback(verificationOptions);

      expect(result.success).toBe(true);
      expect(result.containers).toHaveLength(3);
      expect(result.containers.every(c => c.isRunning)).toBe(true);
      expect(result.containers.every(c => c.healthStatus === 'healthy')).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.healthCheckResult?.allHealthy).toBe(true);
    });

    it('should fail when containers are not running', async () => {
      mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
        stdout: JSON.stringify({
          Name: 'cat_frontend',
          State: 'exited',
          Health: 'none',
          Status: 'Exited (1) 2 minutes ago'
        }),
        stderr: '',
        exitCode: 0
      });

      const result = await rollbackVerification.verifyRollback(verificationOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Containers not running after rollback');
      expect(result.error).toContain('cat_frontend');
    });

    it('should fail when health checks fail', async () => {
      mockHealthCheck.verifyContainerHealth = jest.fn().mockResolvedValue({
        allHealthy: false,
        containers: [
          { containerName: 'cat_frontend', status: 'unhealthy', state: 'running', attempts: 5, lastError: 'Connection refused' },
          { containerName: 'cat_backend', status: 'healthy', state: 'running', attempts: 1 },
          { containerName: 'cat_database', status: 'healthy', state: 'running', attempts: 1 }
        ],
        duration: 5000,
        error: 'Health check failed'
      });

      const result = await rollbackVerification.verifyRollback(verificationOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Health checks failed');
      expect(result.error).toContain('cat_frontend');
    });

    it('should capture logs when captureLogs is true and health checks fail', async () => {
      mockHealthCheck.verifyContainerHealth = jest.fn().mockResolvedValue({
        allHealthy: false,
        containers: [
          { containerName: 'cat_frontend', status: 'unhealthy', state: 'running', attempts: 5 }
        ],
        duration: 5000
      });

      // Mock log capture
      mockSSHClient.executeCommand = jest.fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            Name: 'cat_frontend',
            State: 'running',
            Health: 'unhealthy',
            Status: 'Up 5 minutes'
          }),
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({
          stdout: 'Error: Connection refused\nFailed to start service',
          stderr: '',
          exitCode: 0
        });

      const result = await rollbackVerification.verifyRollback({
        ...verificationOptions,
        captureLogs: true
      });

      expect(result.success).toBe(false);
      expect(result.containers[0].logs).toContain('Connection refused');
    });

    it('should handle docker-compose command failure', async () => {
      mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
        stdout: '',
        stderr: 'docker-compose: command not found',
        exitCode: 127
      });

      const result = await rollbackVerification.verifyRollback(verificationOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get container status');
    });

    it('should handle malformed JSON output gracefully', async () => {
      mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
        stdout: 'invalid json\n{valid: "json"}',
        stderr: '',
        exitCode: 0
      });

      const result = await rollbackVerification.verifyRollback(verificationOptions);

      // Should not crash, but may have empty containers array
      expect(result).toBeDefined();
    });

    it('should pass timeout and maxRetries to health check', async () => {
      await rollbackVerification.verifyRollback({
        workingDirectory: '/opt/community-tracker',
        timeout: 600000,
        maxRetries: 120
      });

      expect(mockHealthCheck.verifyContainerHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 600000,
          maxRetries: 120
        })
      );
    });

    it('should use default timeout and maxRetries when not specified', async () => {
      await rollbackVerification.verifyRollback(verificationOptions);

      expect(mockHealthCheck.verifyContainerHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 300000,
          maxRetries: 60
        })
      );
    });

    it('should include duration in result', async () => {
      const result = await rollbackVerification.verifyRollback(verificationOptions);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should parse health status correctly', async () => {
      mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
        stdout: JSON.stringify({
          Name: 'cat_frontend',
          State: 'running',
          Health: 'healthy',
          Status: 'Up 5 minutes'
        }) + '\n' + JSON.stringify({
          Name: 'cat_backend',
          State: 'running',
          Health: 'starting',
          Status: 'Up 1 minute'
        }) + '\n' + JSON.stringify({
          Name: 'cat_database',
          State: 'running',
          Health: 'unhealthy',
          Status: 'Up 5 minutes'
        }),
        stderr: '',
        exitCode: 0
      });

      mockHealthCheck.verifyContainerHealth = jest.fn().mockResolvedValue({
        allHealthy: false,
        containers: [
          { containerName: 'cat_frontend', status: 'healthy', state: 'running', attempts: 1 },
          { containerName: 'cat_backend', status: 'starting', state: 'running', attempts: 1 },
          { containerName: 'cat_database', status: 'unhealthy', state: 'running', attempts: 1 }
        ],
        duration: 1000
      });

      const result = await rollbackVerification.verifyRollback(verificationOptions);

      expect(result.containers[0].healthStatus).toBe('healthy');
      expect(result.containers[1].healthStatus).toBe('starting');
      expect(result.containers[2].healthStatus).toBe('unhealthy');
    });
  });

  describe('quickVerify', () => {
    it('should return true when all containers are running', async () => {
      const result = await rollbackVerification.quickVerify('/opt/community-tracker');

      expect(result).toBe(true);
    });

    it('should return false when any container is not running', async () => {
      mockSSHClient.executeCommand = jest.fn().mockResolvedValue({
        stdout: JSON.stringify({
          Name: 'cat_frontend',
          State: 'exited',
          Health: 'none',
          Status: 'Exited (1) 2 minutes ago'
        }),
        stderr: '',
        exitCode: 0
      });

      const result = await rollbackVerification.quickVerify('/opt/community-tracker');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSSHClient.executeCommand = jest.fn().mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await rollbackVerification.quickVerify('/opt/community-tracker');

      expect(result).toBe(false);
    });
  });
});
