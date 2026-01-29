import { DependencyInstaller } from './dependency-installer';
import { SSHClient } from './ssh-client';
import { DependencyChecker } from './dependency-checker';

// Mock the logger
jest.mock('./logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock the DependencyChecker
jest.mock('./dependency-checker');

describe('DependencyInstaller', () => {
  let mockSSHClient: jest.Mocked<SSHClient>;
  let mockDependencyChecker: jest.Mocked<DependencyChecker>;
  let installer: DependencyInstaller;

  beforeEach(() => {
    // Create mock SSH client
    mockSSHClient = {
      executeCommand: jest.fn(),
      executeCommandSimple: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      verifyConnection: jest.fn(),
      isConnected: jest.fn(),
      getConnectionInfo: jest.fn(),
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
    } as any;

    // Create installer instance
    installer = new DependencyInstaller(mockSSHClient);

    // Get the mocked dependency checker instance
    mockDependencyChecker = (installer as any).dependencyChecker as jest.Mocked<DependencyChecker>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('installDocker', () => {
    it('should skip installation if Docker is already installed and meets requirements', async () => {
      // Mock Docker already installed with sufficient version
      mockDependencyChecker.checkDocker.mockResolvedValue({
        installed: true,
        version: '24.0.0',
        meetsMinimum: true,
      });

      const result = await installer.installDocker();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(false);
      expect(result.version).toBe('24.0.0');
      expect(result.message).toContain('already installed');
      expect(mockSSHClient.executeCommandSimple).not.toHaveBeenCalled();
    });

    it('should install Docker when not present', async () => {
      // Mock Docker not installed initially
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDocker();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('24.0.0');
      expect(result.message).toContain('installed successfully');

      // Verify installation steps were executed
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith('sudo apt-get update');
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith(
        expect.stringContaining('sudo apt-get install -y ca-certificates')
      );
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith(
        expect.stringContaining('docker-ce')
      );
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith('sudo systemctl start docker');
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith('sudo systemctl enable docker');
    });

    it('should upgrade Docker when installed version is below minimum', async () => {
      // Mock Docker installed but below minimum version
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: true,
          version: '19.03.0',
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDocker();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('24.0.0');
      
      // Verify upgrade steps were executed
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith('sudo apt-get update');
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith(
        expect.stringContaining('docker-ce')
      );
    });

    it('should return error when installation fails', async () => {
      mockDependencyChecker.checkDocker.mockResolvedValue({
        installed: false,
        meetsMinimum: false,
      });

      const error = new Error('Network error');
      mockSSHClient.executeCommandSimple.mockRejectedValue(error);

      const result = await installer.installDocker();

      expect(result.success).toBe(false);
      expect(result.installed).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.message).toContain('installation failed');
    });

    it('should return error when verification fails after installation', async () => {
      // Mock installation succeeds but verification fails
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '19.03.0',
          meetsMinimum: false,
          error: 'Version too old',
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDocker();

      expect(result.success).toBe(false);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('19.03.0');
      expect(result.message).toContain('verification failed');
    });

    it('should execute all installation steps in correct order', async () => {
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      const executionOrder: string[] = [];
      mockSSHClient.executeCommandSimple.mockImplementation(async (cmd: string) => {
        if (cmd.includes('apt-get update')) {
          executionOrder.push('update');
        } else if (cmd.includes('ca-certificates')) {
          executionOrder.push('prerequisites');
        } else if (cmd.includes('mkdir') && cmd.includes('keyrings')) {
          executionOrder.push('mkdir-keyrings');
        } else if (cmd.includes('curl') && cmd.includes('gpg')) {
          executionOrder.push('gpg-key');
        } else if (cmd.includes('echo') && cmd.includes('deb')) {
          executionOrder.push('repository');
        } else if (cmd.includes('docker-ce')) {
          executionOrder.push('install');
        } else if (cmd.includes('systemctl start')) {
          executionOrder.push('start');
        } else if (cmd.includes('systemctl enable')) {
          executionOrder.push('enable');
        }
        return '';
      });

      await installer.installDocker();

      // Verify key steps were executed
      expect(executionOrder).toContain('update');
      expect(executionOrder).toContain('prerequisites');
      expect(executionOrder).toContain('mkdir-keyrings');
      expect(executionOrder).toContain('gpg-key');
      expect(executionOrder).toContain('repository');
      expect(executionOrder).toContain('install');
      expect(executionOrder).toContain('start');
      expect(executionOrder).toContain('enable');
      
      // Verify update happens before install
      const firstUpdate = executionOrder.indexOf('update');
      const install = executionOrder.indexOf('install');
      expect(firstUpdate).toBeLessThan(install);
      
      // Verify install happens before start
      const start = executionOrder.indexOf('start');
      expect(install).toBeLessThan(start);
      
      // Verify start happens before enable
      const enable = executionOrder.indexOf('enable');
      expect(start).toBeLessThan(enable);
    });
  });

  describe('installDockerCompose', () => {
    it('should skip installation if Docker Compose is already installed and meets requirements', async () => {
      mockDependencyChecker.checkDockerCompose.mockResolvedValue({
        installed: true,
        version: '2.17.0',
        meetsMinimum: true,
      });

      const result = await installer.installDockerCompose();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(false);
      expect(result.version).toBe('2.17.0');
      expect(result.message).toContain('already installed');
      expect(mockSSHClient.executeCommandSimple).not.toHaveBeenCalled();
    });

    it('should install Docker Compose when not present', async () => {
      mockDependencyChecker.checkDockerCompose
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '2.17.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDockerCompose();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.17.0');
      expect(result.message).toContain('installed successfully');

      // Verify installation steps
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith('sudo apt-get update');
      expect(mockSSHClient.executeCommandSimple).toHaveBeenCalledWith(
        'sudo apt-get install -y docker-compose-plugin'
      );
    });

    it('should upgrade Docker Compose when installed version is below minimum', async () => {
      mockDependencyChecker.checkDockerCompose
        .mockResolvedValueOnce({
          installed: true,
          version: '1.29.0',
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '2.17.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDockerCompose();

      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('2.17.0');
    });

    it('should return error when installation fails', async () => {
      mockDependencyChecker.checkDockerCompose.mockResolvedValue({
        installed: false,
        meetsMinimum: false,
      });

      const error = new Error('Package not found');
      mockSSHClient.executeCommandSimple.mockRejectedValue(error);

      const result = await installer.installDockerCompose();

      expect(result.success).toBe(false);
      expect(result.installed).toBe(false);
      expect(result.error).toBe('Package not found');
      expect(result.message).toContain('installation failed');
    });

    it('should return error when verification fails after installation', async () => {
      mockDependencyChecker.checkDockerCompose
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '1.29.0',
          meetsMinimum: false,
          error: 'Version too old',
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDockerCompose();

      expect(result.success).toBe(false);
      expect(result.installed).toBe(true);
      expect(result.message).toContain('verification failed');
    });
  });

  describe('installAllDependencies', () => {
    it('should install both Docker and Docker Compose successfully', async () => {
      // Mock both not installed
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      mockDependencyChecker.checkDockerCompose
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '2.17.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installAllDependencies();

      expect(result.allSuccessful).toBe(true);
      expect(result.docker.success).toBe(true);
      expect(result.docker.installed).toBe(true);
      expect(result.dockerCompose.success).toBe(true);
      expect(result.dockerCompose.installed).toBe(true);
    });

    it('should skip Docker Compose installation if Docker installation fails', async () => {
      // Mock Docker installation failure
      mockDependencyChecker.checkDocker.mockResolvedValue({
        installed: false,
        meetsMinimum: false,
      });

      mockSSHClient.executeCommandSimple.mockRejectedValue(new Error('Docker install failed'));

      const result = await installer.installAllDependencies();

      expect(result.allSuccessful).toBe(false);
      expect(result.docker.success).toBe(false);
      expect(result.dockerCompose.success).toBe(false);
      expect(result.dockerCompose.message).toContain('Skipped');
    });

    it('should report partial success when Docker succeeds but Docker Compose fails', async () => {
      // Mock Docker installation success
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      // Mock Docker Compose installation failure
      mockDependencyChecker.checkDockerCompose.mockResolvedValue({
        installed: false,
        meetsMinimum: false,
      });

      let callCount = 0;
      mockSSHClient.executeCommandSimple.mockImplementation(async (cmd: string) => {
        callCount++;
        // Fail on Docker Compose installation
        if (cmd.includes('docker-compose-plugin')) {
          throw new Error('Compose install failed');
        }
        return '';
      });

      const result = await installer.installAllDependencies();

      expect(result.allSuccessful).toBe(false);
      expect(result.docker.success).toBe(true);
      expect(result.dockerCompose.success).toBe(false);
    });
  });

  describe('ensureDependencies', () => {
    it('should skip installation when all dependencies are already met', async () => {
      mockDependencyChecker.checkAllDependencies.mockResolvedValue({
        docker: {
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        },
        dockerCompose: {
          installed: true,
          version: '2.17.0',
          meetsMinimum: true,
        },
        allDependenciesMet: true,
      });

      const result = await installer.ensureDependencies();

      expect(result.allSuccessful).toBe(true);
      expect(result.docker.installed).toBe(false);
      expect(result.dockerCompose.installed).toBe(false);
      expect(mockSSHClient.executeCommandSimple).not.toHaveBeenCalled();
    });

    it('should install missing dependencies', async () => {
      // Mock initial check showing missing dependencies
      mockDependencyChecker.checkAllDependencies.mockResolvedValue({
        docker: {
          installed: false,
          meetsMinimum: false,
        },
        dockerCompose: {
          installed: false,
          meetsMinimum: false,
        },
        allDependenciesMet: false,
      });

      // Mock successful installations
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      mockDependencyChecker.checkDockerCompose
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '2.17.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.ensureDependencies();

      expect(result.allSuccessful).toBe(true);
      expect(result.docker.installed).toBe(true);
      expect(result.dockerCompose.installed).toBe(true);
    });

    it('should upgrade outdated dependencies', async () => {
      // Mock initial check showing outdated dependencies
      mockDependencyChecker.checkAllDependencies.mockResolvedValue({
        docker: {
          installed: true,
          version: '19.03.0',
          meetsMinimum: false,
        },
        dockerCompose: {
          installed: true,
          version: '1.29.0',
          meetsMinimum: false,
        },
        allDependenciesMet: false,
      });

      // Mock successful upgrades
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: true,
          version: '19.03.0',
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      mockDependencyChecker.checkDockerCompose
        .mockResolvedValueOnce({
          installed: true,
          version: '1.29.0',
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '2.17.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.ensureDependencies();

      expect(result.allSuccessful).toBe(true);
      expect(result.docker.installed).toBe(true);
      expect(result.dockerCompose.installed).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty command output gracefully', async () => {
      mockDependencyChecker.checkDocker
        .mockResolvedValueOnce({
          installed: false,
          meetsMinimum: false,
        })
        .mockResolvedValueOnce({
          installed: true,
          version: '24.0.0',
          meetsMinimum: true,
        });

      mockSSHClient.executeCommandSimple.mockResolvedValue('');

      const result = await installer.installDocker();

      expect(result.success).toBe(true);
    });

    it('should handle network timeouts during installation', async () => {
      mockDependencyChecker.checkDocker.mockResolvedValue({
        installed: false,
        meetsMinimum: false,
      });

      mockSSHClient.executeCommandSimple.mockRejectedValue(new Error('Connection timeout'));

      const result = await installer.installDocker();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle permission errors during installation', async () => {
      mockDependencyChecker.checkDocker.mockResolvedValue({
        installed: false,
        meetsMinimum: false,
      });

      mockSSHClient.executeCommandSimple.mockRejectedValue(
        new Error('Permission denied: sudo required')
      );

      const result = await installer.installDocker();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });
});
