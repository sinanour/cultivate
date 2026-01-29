import { DependencyChecker, MIN_DOCKER_VERSION, MIN_DOCKER_COMPOSE_VERSION } from './dependency-checker';
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

describe('DependencyChecker', () => {
  let mockSSHClient: jest.Mocked<SSHClient>;
  let dependencyChecker: DependencyChecker;

  beforeEach(() => {
    // Create a mock SSH client
    mockSSHClient = {
      executeCommand: jest.fn(),
    } as any;

    dependencyChecker = new DependencyChecker(mockSSHClient);
  });

  describe('checkDocker', () => {
    it('should detect Docker when installed with valid version', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker version 20.10.17, build 100c701',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('20.10.17');
      expect(result.meetsMinimum).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('docker --version');
    });

    it('should detect Docker when version exactly meets minimum', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: `Docker version ${MIN_DOCKER_VERSION}, build abc123`,
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(true);
      expect(result.version).toBe(MIN_DOCKER_VERSION);
      expect(result.meetsMinimum).toBe(true);
    });

    it('should detect Docker when version exceeds minimum', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker version 24.0.5, build ced0996',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('24.0.5');
      expect(result.meetsMinimum).toBe(true);
    });

    it('should detect Docker but report version below minimum', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker version 19.03.12, build 48a66213fe',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('19.03.12');
      expect(result.meetsMinimum).toBe(false);
    });

    it('should handle Docker not installed (command not found)', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'bash: docker: command not found',
        exitCode: 127,
      });

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(false);
      expect(result.meetsMinimum).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle unparseable Docker version output', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker version unknown',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(true);
      expect(result.meetsMinimum).toBe(false);
      expect(result.error).toBe('Could not parse Docker version');
    });

    it('should handle SSH command execution errors', async () => {
      mockSSHClient.executeCommand.mockRejectedValue(new Error('SSH connection lost'));

      const result = await dependencyChecker.checkDocker();

      expect(result.installed).toBe(false);
      expect(result.meetsMinimum).toBe(false);
      expect(result.error).toBe('SSH connection lost');
    });

    it('should parse Docker version with different formats', async () => {
      // Test various real-world Docker version output formats
      const testCases = [
        { output: 'Docker version 20.10.17, build 100c701', expected: '20.10.17' },
        { output: 'Docker version 24.0.5, build ced0996', expected: '24.0.5' },
        { output: 'Docker version 23.0.1, build a5ee5b1', expected: '23.0.1' },
      ];

      for (const testCase of testCases) {
        mockSSHClient.executeCommand.mockResolvedValue({
          stdout: testCase.output,
          stderr: '',
          exitCode: 0,
        });

        const result = await dependencyChecker.checkDocker();
        expect(result.version).toBe(testCase.expected);
      }
    });
  });

  describe('checkDockerCompose', () => {
    it('should detect Docker Compose v2 (plugin) when installed', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker Compose version v2.17.2',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.17.2');
      expect(result.meetsMinimum).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('docker compose version');
    });

    it('should detect Docker Compose v2 without "v" prefix', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker Compose version 2.20.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.20.0');
      expect(result.meetsMinimum).toBe(true);
    });

    it('should fallback to docker-compose v1 (standalone) when v2 not available', async () => {
      // First call (docker compose) fails
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: 'docker: \'compose\' is not a docker command.',
        exitCode: 1,
      });

      // Second call (docker-compose) succeeds
      mockSSHClient.executeCommand.mockResolvedValueOnce({
        stdout: 'docker-compose version 1.29.2, build 5becea4c',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('1.29.2');
      expect(result.meetsMinimum).toBe(false); // v1.x is below minimum v2.0.0
      expect(mockSSHClient.executeCommand).toHaveBeenCalledTimes(2);
      expect(mockSSHClient.executeCommand).toHaveBeenNthCalledWith(1, 'docker compose version');
      expect(mockSSHClient.executeCommand).toHaveBeenNthCalledWith(2, 'docker-compose --version');
    });

    it('should detect Docker Compose when version exactly meets minimum', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: `Docker Compose version v${MIN_DOCKER_COMPOSE_VERSION}`,
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.version).toBe(MIN_DOCKER_COMPOSE_VERSION);
      expect(result.meetsMinimum).toBe(true);
    });

    it('should detect Docker Compose when version exceeds minimum', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker Compose version v2.23.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.23.0');
      expect(result.meetsMinimum).toBe(true);
    });

    it('should detect Docker Compose but report version below minimum', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'docker-compose version 1.29.2, build 5becea4c',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.version).toBe('1.29.2');
      expect(result.meetsMinimum).toBe(false);
    });

    it('should handle Docker Compose not installed (both commands fail)', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(false);
      expect(result.meetsMinimum).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle unparseable Docker Compose version output', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'Docker Compose version unknown',
        stderr: '',
        exitCode: 0,
      });

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(true);
      expect(result.meetsMinimum).toBe(false);
      expect(result.error).toBe('Could not parse Docker Compose version');
    });

    it('should handle SSH command execution errors', async () => {
      mockSSHClient.executeCommand.mockRejectedValue(new Error('Network timeout'));

      const result = await dependencyChecker.checkDockerCompose();

      expect(result.installed).toBe(false);
      expect(result.meetsMinimum).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('checkAllDependencies', () => {
    it('should report all dependencies met when both are installed and valid', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'Docker version 20.10.17, build 100c701',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'Docker Compose version v2.17.2',
          stderr: '',
          exitCode: 0,
        });

      const result = await dependencyChecker.checkAllDependencies();

      expect(result.docker.installed).toBe(true);
      expect(result.docker.meetsMinimum).toBe(true);
      expect(result.dockerCompose.installed).toBe(true);
      expect(result.dockerCompose.meetsMinimum).toBe(true);
      expect(result.allDependenciesMet).toBe(true);
    });

    it('should report dependencies not met when Docker is missing', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'command not found',
          exitCode: 127,
        })
        .mockResolvedValueOnce({
          stdout: 'Docker Compose version v2.17.2',
          stderr: '',
          exitCode: 0,
        });

      const result = await dependencyChecker.checkAllDependencies();

      expect(result.docker.installed).toBe(false);
      expect(result.dockerCompose.installed).toBe(true);
      expect(result.allDependenciesMet).toBe(false);
    });

    it('should report dependencies not met when Docker Compose is missing', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'Docker version 20.10.17, build 100c701',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'command not found',
          exitCode: 127,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'command not found',
          exitCode: 127,
        });

      const result = await dependencyChecker.checkAllDependencies();

      expect(result.docker.installed).toBe(true);
      expect(result.dockerCompose.installed).toBe(false);
      expect(result.allDependenciesMet).toBe(false);
    });

    it('should report dependencies not met when Docker version is too old', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'Docker version 19.03.12, build 48a66213fe',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'Docker Compose version v2.17.2',
          stderr: '',
          exitCode: 0,
        });

      const result = await dependencyChecker.checkAllDependencies();

      expect(result.docker.installed).toBe(true);
      expect(result.docker.meetsMinimum).toBe(false);
      expect(result.dockerCompose.meetsMinimum).toBe(true);
      expect(result.allDependenciesMet).toBe(false);
    });

    it('should report dependencies not met when Docker Compose version is too old', async () => {
      mockSSHClient.executeCommand
        .mockResolvedValueOnce({
          stdout: 'Docker version 20.10.17, build 100c701',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'docker-compose version 1.29.2, build 5becea4c',
          stderr: '',
          exitCode: 0,
        });

      const result = await dependencyChecker.checkAllDependencies();

      expect(result.docker.meetsMinimum).toBe(true);
      expect(result.dockerCompose.installed).toBe(true);
      expect(result.dockerCompose.meetsMinimum).toBe(false);
      expect(result.allDependenciesMet).toBe(false);
    });

    it('should report dependencies not met when both are missing', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
      });

      const result = await dependencyChecker.checkAllDependencies();

      expect(result.docker.installed).toBe(false);
      expect(result.dockerCompose.installed).toBe(false);
      expect(result.allDependenciesMet).toBe(false);
    });
  });

  describe('version comparison edge cases', () => {
    it('should correctly compare versions with different patch numbers', async () => {
      const testCases = [
        { version: '20.10.0', meetsMin: true },
        { version: '20.10.1', meetsMin: true },
        { version: '20.10.99', meetsMin: true },
        { version: '20.9.99', meetsMin: false },
      ];

      for (const testCase of testCases) {
        mockSSHClient.executeCommand.mockResolvedValue({
          stdout: `Docker version ${testCase.version}, build abc`,
          stderr: '',
          exitCode: 0,
        });

        const result = await dependencyChecker.checkDocker();
        expect(result.meetsMinimum).toBe(testCase.meetsMin);
      }
    });

    it('should correctly compare versions with different minor numbers', async () => {
      const testCases = [
        { version: '20.10.0', meetsMin: true },
        { version: '20.11.0', meetsMin: true },
        { version: '20.9.0', meetsMin: false },
        { version: '21.0.0', meetsMin: true },
      ];

      for (const testCase of testCases) {
        mockSSHClient.executeCommand.mockResolvedValue({
          stdout: `Docker version ${testCase.version}, build abc`,
          stderr: '',
          exitCode: 0,
        });

        const result = await dependencyChecker.checkDocker();
        expect(result.meetsMinimum).toBe(testCase.meetsMin);
      }
    });

    it('should correctly compare versions with different major numbers', async () => {
      const testCases = [
        { version: '20.10.0', meetsMin: true },
        { version: '21.0.0', meetsMin: true },
        { version: '25.0.0', meetsMin: true },
        { version: '19.99.99', meetsMin: false },
      ];

      for (const testCase of testCases) {
        mockSSHClient.executeCommand.mockResolvedValue({
          stdout: `Docker version ${testCase.version}, build abc`,
          stderr: '',
          exitCode: 0,
        });

        const result = await dependencyChecker.checkDocker();
        expect(result.meetsMinimum).toBe(testCase.meetsMin);
      }
    });
  });

  describe('constants', () => {
    it('should export minimum version constants', () => {
      expect(MIN_DOCKER_VERSION).toBe('20.10.0');
      expect(MIN_DOCKER_COMPOSE_VERSION).toBe('2.0.0');
    });
  });
});
