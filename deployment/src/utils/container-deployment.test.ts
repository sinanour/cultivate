import { ContainerDeployment, ContainerDeploymentOptions } from './container-deployment';
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

describe('ContainerDeployment', () => {
  let mockSSHClient: jest.Mocked<SSHClient>;
  let containerDeployment: ContainerDeployment;

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

    containerDeployment = new ContainerDeployment(mockSSHClient);
  });

  describe('deployContainers', () => {
    const defaultOptions: ContainerDeploymentOptions = {
      composePath: '/opt/app/docker-compose.yml',
      workingDirectory: '/opt/app',
      startupTimeout: 10000,
    };

    it('should successfully deploy containers', async () => {
      // Mock compose file verification
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'exists',
          stderr: '',
          exitCode: 0,
        })
        // Mock docker-compose up
        .mockResolvedValueOnce({
          stdout: 'Creating network...\nCreating containers...',
          stderr: '',
          exitCode: 0,
        })
        // Mock container status checks (first check - starting, second check - running)
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web', State: 'starting', Health: 'starting', Status: 'Up 1 second' }) + '\n' +
                  JSON.stringify({ Name: 'app_api', State: 'starting', Health: 'starting', Status: 'Up 1 second' }),
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web', State: 'running', Health: 'healthy', Status: 'Up 5 seconds' }) + '\n' +
                  JSON.stringify({ Name: 'app_api', State: 'running', Health: 'healthy', Status: 'Up 5 seconds' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock getting container names
        .mockResolvedValueOnce({
          stdout: 'web\napi',
          stderr: '',
          exitCode: 0,
        })
        // Mock capturing logs for web
        .mockResolvedValueOnce({
          stdout: 'web container logs',
          stderr: '',
          exitCode: 0,
        })
        // Mock capturing logs for api
        .mockResolvedValueOnce({
          stdout: 'api container logs',
          stderr: '',
          exitCode: 0,
        });

      const result = await containerDeployment.deployContainers(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.containers).toHaveLength(2);
      expect(result.containers[0].state).toBe('running');
      expect(result.containers[1].state).toBe('running');
      expect(result.logs).toHaveLength(2);
      expect(result.error).toBeUndefined();
    });

    it('should fail when docker-compose file does not exist', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'not found',
        stderr: '',
        exitCode: 0,
      });

      const result = await containerDeployment.deployContainers(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Compose file not found');
    });

    it('should fail when docker-compose up fails', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'exists',
          stderr: '',
          exitCode: 0,
        })
        // Mock first attempt (without sudo) - permission denied
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'permission denied while trying to connect to the Docker daemon socket',
          exitCode: 1,
        })
        // Mock second attempt (with sudo) - still fails
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Error: network creation failed',
          exitCode: 1,
        });

      const result = await containerDeployment.deployContainers(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Compose up failed');
    });

    it('should fail when a container exits during startup', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'exists',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'Creating containers...',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web', State: 'running', Health: 'healthy', Status: 'Up 2 seconds' }) + '\n' +
                  JSON.stringify({ Name: 'app_api', State: 'exited', Health: 'none', Status: 'Exited (1)' }),
          stderr: '',
          exitCode: 0,
        })
        // Mock getting container names for log capture
        .mockResolvedValueOnce({
          stdout: 'web\napi',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'web logs',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'api logs with error',
          stderr: '',
          exitCode: 0,
        });

      const result = await containerDeployment.deployContainers(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exited during startup');
      expect(result.logs).toHaveLength(2);
    });

    it('should include environment variables in docker-compose command', async () => {
      const optionsWithEnv: ContainerDeploymentOptions = {
        ...defaultOptions,
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
      };

      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'exists',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'Creating containers...',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web', State: 'running', Health: 'healthy', Status: 'Up 1 second' }),
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'web',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'web logs',
          stderr: '',
          exitCode: 0,
        });

      await containerDeployment.deployContainers(optionsWithEnv);

      const composeCall = mockSSHClient.executeCommand.mock.calls[1][0];
      expect(composeCall).toContain('NODE_ENV="production"');
      expect(composeCall).toContain('PORT="3000"');
    });

    it('should use force-recreate flag when specified', async () => {
      const optionsWithForce: ContainerDeploymentOptions = {
        ...defaultOptions,
        forceRecreate: true,
      };

      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'exists',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'Recreating containers...',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ Name: 'app_web', State: 'running', Health: 'healthy', Status: 'Up 1 second' }),
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'web',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'web logs',
          stderr: '',
          exitCode: 0,
        });

      await containerDeployment.deployContainers(optionsWithForce);

      const composeCall = mockSSHClient.executeCommand.mock.calls[1][0];
      expect(composeCall).toContain('--force-recreate');
    });
  });

  describe('getContainerStatus', () => {
    it('should return container statuses', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: JSON.stringify({ Name: 'app_web', State: 'running', Health: 'healthy', Status: 'Up 10 minutes' }) + '\n' +
                JSON.stringify({ Name: 'app_api', State: 'running', Health: 'healthy', Status: 'Up 10 minutes' }),
        stderr: '',
        exitCode: 0,
      });

      const statuses = await containerDeployment.getContainerStatus('/opt/app');

      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('app_web');
      expect(statuses[0].state).toBe('running');
      expect(statuses[0].health).toBe('healthy');
      expect(statuses[1].name).toBe('app_api');
    });

    it('should return empty array when command fails', async () => {
      // Mock first attempt (without sudo) - permission denied
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'permission denied while trying to connect to the Docker daemon socket',
          exitCode: 1,
        })
        // Mock second attempt (with sudo) - still fails
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Error: no containers found',
          exitCode: 1,
        });

      const statuses = await containerDeployment.getContainerStatus('/opt/app');

      expect(statuses).toEqual([]);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: '{"Name": "app_web", "State": "running"}\n{invalid json}\n{"Name": "app_api", "State": "running"}',
        stderr: '',
        exitCode: 0,
      });

      const statuses = await containerDeployment.getContainerStatus('/opt/app');

      // Should parse valid lines and skip invalid ones
      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('app_web');
      expect(statuses[1].name).toBe('app_api');
    });
  });

  describe('captureContainerLogs', () => {
    it('should capture container logs', async () => {
      const expectedLogs = 'Container startup logs\nApplication running\n';
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: expectedLogs,
        stderr: '',
        exitCode: 0,
      });

      const logs = await containerDeployment.captureContainerLogs('app_web', '/opt/app');

      expect(logs.containerName).toBe('app_web');
      expect(logs.logs).toBe(expectedLogs);
      expect(logs.timestamp).toBeInstanceOf(Date);
    });

    it('should capture stderr if stdout is empty', async () => {
      const expectedLogs = 'Error logs from stderr';
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: expectedLogs,
        exitCode: 0,
      });

      const logs = await containerDeployment.captureContainerLogs('app_web', '/opt/app');

      expect(logs.logs).toBe(expectedLogs);
    });

    it('should handle log capture errors gracefully', async () => {
      mockSSHClient.executeCommand.mockRejectedValueOnce(new Error('Connection lost'));

      const logs = await containerDeployment.captureContainerLogs('app_web', '/opt/app');

      expect(logs.containerName).toBe('app_web');
      expect(logs.logs).toContain('Error capturing logs');
      expect(logs.logs).toContain('Connection lost');
    });

    it('should respect tail lines parameter', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'logs',
        stderr: '',
        exitCode: 0,
      });

      await containerDeployment.captureContainerLogs('app_web', '/opt/app', 50);

      const command = mockSSHClient.executeCommand.mock.calls[0][0];
      expect(command).toContain('--tail=50');
    });
  });

  describe('stopContainers', () => {
    it('should stop containers successfully', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'Stopping containers...\nStopped',
        stderr: '',
        exitCode: 0,
      });

      await expect(containerDeployment.stopContainers('/opt/app')).resolves.not.toThrow();

      const command = mockSSHClient.executeCommand.mock.calls[0][0];
      expect(command).toContain('docker-compose -f docker-compose.yml stop');
    });

    it('should throw error when stop fails', async () => {
      // Mock first attempt (without sudo) - permission denied
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'permission denied while trying to connect to the Docker daemon socket',
          exitCode: 1,
        })
        // Mock second attempt (with sudo) - still fails
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Error: containers not found',
          exitCode: 1,
        });

      await expect(containerDeployment.stopContainers('/opt/app')).rejects.toThrow('Failed to stop containers');
    });
  });

  describe('removeContainers', () => {
    it('should remove containers without volumes', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'Removing containers...\nRemoved',
        stderr: '',
        exitCode: 0,
      });

      await expect(containerDeployment.removeContainers('/opt/app', false)).resolves.not.toThrow();

      const command = mockSSHClient.executeCommand.mock.calls[0][0];
      expect(command).toContain('docker-compose -f docker-compose.yml down');
      expect(command).not.toContain('-v');
    });

    it('should remove containers with volumes when specified', async () => {
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'Removing containers and volumes...\nRemoved',
        stderr: '',
        exitCode: 0,
      });

      await expect(containerDeployment.removeContainers('/opt/app', true)).resolves.not.toThrow();

      const command = mockSSHClient.executeCommand.mock.calls[0][0];
      expect(command).toContain('docker-compose -f docker-compose.yml down -v');
    });

    it('should throw error when removal fails', async () => {
      // Mock first attempt (without sudo) - permission denied
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'permission denied while trying to connect to the Docker daemon socket',
          exitCode: 1,
        })
        // Mock second attempt (with sudo) - still fails
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Error: containers not found',
          exitCode: 1,
        });

      await expect(containerDeployment.removeContainers('/opt/app')).rejects.toThrow('Failed to remove containers');
    });
  });
});
