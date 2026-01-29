import { SSHClient, SSHConnectionConfig } from './ssh-client';
import { Client } from 'ssh2';

// Mock the ssh2 Client
jest.mock('ssh2');

// Mock the logger
jest.mock('./logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('SSHClient', () => {
  let mockClient: any;
  let sshClient: SSHClient;
  let config: SSHConnectionConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock client instance
    mockClient = {
      on: jest.fn().mockReturnThis(),
      connect: jest.fn(),
      end: jest.fn(),
      exec: jest.fn().mockReturnThis(),
      sftp: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
    };

    // Mock the Client constructor to return our mock
    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);

    // Default config
    config = {
      host: 'test.example.com',
      username: 'testuser',
      privateKey: Buffer.from('fake-private-key'),
      timeout: 5000,
    };
  });

  describe('constructor', () => {
    it('should create SSHClient with provided config', () => {
      sshClient = new SSHClient(config);
      expect(sshClient).toBeInstanceOf(SSHClient);
      expect(sshClient.isConnected()).toBe(false);
    });

    it('should use default port if not provided', () => {
      const configWithoutPort = { ...config };
      delete configWithoutPort.port;
      sshClient = new SSHClient(configWithoutPort);
      
      const info = sshClient.getConnectionInfo();
      expect(info.port).toBe(22);
    });

    it('should use default timeout if not provided', () => {
      const configWithoutTimeout = { ...config };
      delete configWithoutTimeout.timeout;
      sshClient = new SSHClient(configWithoutTimeout);
      
      const info = sshClient.getConnectionInfo();
      expect(info.timeout).toBe(10000);
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      sshClient = new SSHClient(config);
    });

    it('should successfully connect with SSH key authentication', async () => {
      // Setup mock to simulate successful connection
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });

      await expect(sshClient.connect()).resolves.toBeUndefined();
      expect(sshClient.isConnected()).toBe(true);
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'test.example.com',
          port: 22,
          username: 'testuser',
          privateKey: expect.any(Buffer),
        })
      );
    });

    it('should successfully connect with password authentication', async () => {
      const passwordConfig: SSHConnectionConfig = {
        host: 'test.example.com',
        username: 'testuser',
        password: 'testpassword',
      };
      sshClient = new SSHClient(passwordConfig);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });

      await expect(sshClient.connect()).resolves.toBeUndefined();
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'testpassword',
        })
      );
    });

    it('should include passphrase when provided with private key', async () => {
      const configWithPassphrase: SSHConnectionConfig = {
        ...config,
        passphrase: 'my-passphrase',
      };
      sshClient = new SSHClient(configWithPassphrase);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });

      await sshClient.connect();
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          passphrase: 'my-passphrase',
        })
      );
    });

    it('should reject if no authentication method provided', async () => {
      const noAuthConfig: SSHConnectionConfig = {
        host: 'test.example.com',
        username: 'testuser',
      };
      sshClient = new SSHClient(noAuthConfig);

      await expect(sshClient.connect()).rejects.toThrow(
        'No authentication method provided'
      );
    });

    it('should reject on connection error', async () => {
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 10);
        }
        return mockClient;
      });

      await expect(sshClient.connect()).rejects.toThrow(
        'SSH connection failed: Connection refused'
      );
      expect(sshClient.isConnected()).toBe(false);
    });

    it('should reject on connection timeout', async () => {
      const shortTimeoutConfig = { ...config, timeout: 100 };
      sshClient = new SSHClient(shortTimeoutConfig);

      // Don't trigger any events to simulate timeout
      mockClient.on.mockReturnValue(mockClient);

      await expect(sshClient.connect()).rejects.toThrow(
        'SSH connection timeout after 100ms'
      );
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle close event', async () => {
      let closeCallback: any;
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        } else if (event === 'close') {
          closeCallback = callback;
        }
        return mockClient;
      });

      await sshClient.connect();
      expect(sshClient.isConnected()).toBe(true);

      // Simulate connection close
      closeCallback();
      expect(sshClient.isConnected()).toBe(false);
    });
  });

  describe('verifyConnection', () => {
    beforeEach(async () => {
      sshClient = new SSHClient(config);
      
      // Setup successful connection
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });
      
      await sshClient.connect();
    });

    it('should return true for valid connection', async () => {
      // Mock successful command execution
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('connection_test\n')), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      const result = await sshClient.verifyConnection();
      expect(result).toBe(true);
    });

    it('should return false if not connected', async () => {
      await sshClient.disconnect();
      const result = await sshClient.verifyConnection();
      expect(result).toBe(false);
    });

    it('should return false if verification command fails', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('wrong_output')), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      const result = await sshClient.verifyConnection();
      expect(result).toBe(false);
    });

    it('should return false on command execution error', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        callback(new Error('Execution failed'));
        return mockClient;
      });

      const result = await sshClient.verifyConnection();
      expect(result).toBe(false);
    });
  });

  describe('executeCommand', () => {
    beforeEach(async () => {
      sshClient = new SSHClient(config);
      
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });
      
      await sshClient.connect();
    });

    it('should execute command and return result', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('command output')), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      const result = await sshClient.executeCommand('ls -la');
      expect(result.stdout).toBe('command output');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should capture stderr output', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'close') {
              setTimeout(() => handler(1), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn((event: string, handler: any): any => {
              if (event === 'data') {
                setTimeout(() => handler(Buffer.from('error message')), 10);
              }
              return mockStream.stderr;
            }),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      const result = await sshClient.executeCommand('invalid-command');
      expect(result.stderr).toBe('error message');
      expect(result.exitCode).toBe(1);
    });

    it('should throw error if not connected', async () => {
      await sshClient.disconnect();
      
      await expect(sshClient.executeCommand('ls')).rejects.toThrow(
        'Not connected to SSH server'
      );
    });

    it('should throw error on exec failure', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        callback(new Error('Exec failed'));
        return mockClient;
      });

      await expect(sshClient.executeCommand('ls')).rejects.toThrow(
        'Command execution failed: Exec failed'
      );
    });

    it('should handle stream errors', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Stream error')), 10);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      await expect(sshClient.executeCommand('ls')).rejects.toThrow(
        'Stream error: Stream error'
      );
    });
  });

  describe('executeCommandSimple', () => {
    beforeEach(async () => {
      sshClient = new SSHClient(config);
      
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });
      
      await sshClient.connect();
    });

    it('should return stdout for successful command', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('success output')), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      const output = await sshClient.executeCommandSimple('echo test');
      expect(output).toBe('success output');
    });

    it('should throw error for non-zero exit code', async () => {
      mockClient.exec.mockImplementation((_cmd: string, callback: any) => {
        const mockStream: any = {
          on: jest.fn((event: string, handler: any): any => {
            if (event === 'close') {
              setTimeout(() => handler(1), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn((event: string, handler: any): any => {
              if (event === 'data') {
                setTimeout(() => handler(Buffer.from('command failed')), 10);
              }
              return mockStream.stderr;
            }),
          },
        };
        callback(undefined, mockStream);
        return mockClient;
      });

      await expect(sshClient.executeCommandSimple('false')).rejects.toThrow(
        'Command failed with exit code 1: command failed'
      );
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      sshClient = new SSHClient(config);
      
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });
      
      await sshClient.connect();
    });

    it('should disconnect successfully', async () => {
      mockClient.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });

      await sshClient.disconnect();
      expect(sshClient.isConnected()).toBe(false);
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should resolve immediately if not connected', async () => {
      await sshClient.disconnect();
      await expect(sshClient.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection info without sensitive data', () => {
      sshClient = new SSHClient(config);
      const info = sshClient.getConnectionInfo();
      
      expect(info.host).toBe('test.example.com');
      expect(info.username).toBe('testuser');
      expect(info.port).toBe(22);
      expect(info.timeout).toBe(5000);
      expect(info).not.toHaveProperty('privateKey');
      expect(info).not.toHaveProperty('password');
      expect(info).not.toHaveProperty('passphrase');
    });
  });

  describe('uploadFile', () => {
    beforeEach(async () => {
      sshClient = new SSHClient(config);
      
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });
      
      await sshClient.connect();
    });

    it('should upload file successfully', async () => {
      const mockSftp = {
        fastPut: jest.fn((_local: any, _remote: any, callback: any) => {
          setTimeout(() => callback(null), 10);
        }),
        end: jest.fn(),
      };

      mockClient.sftp.mockImplementation((callback: any) => {
        callback(null, mockSftp);
        return mockClient;
      });

      await expect(
        sshClient.uploadFile('/local/file.txt', '/remote/file.txt')
      ).resolves.toBeUndefined();
      
      expect(mockSftp.fastPut).toHaveBeenCalledWith(
        '/local/file.txt',
        '/remote/file.txt',
        expect.any(Function)
      );
    });

    it('should throw error if not connected', async () => {
      await sshClient.disconnect();
      
      await expect(
        sshClient.uploadFile('/local/file.txt', '/remote/file.txt')
      ).rejects.toThrow('Not connected to SSH server');
    });

    it('should throw error on SFTP session failure', async () => {
      mockClient.sftp.mockImplementation((callback: any) => {
        callback(new Error('SFTP failed'));
        return mockClient;
      });

      await expect(
        sshClient.uploadFile('/local/file.txt', '/remote/file.txt')
      ).rejects.toThrow('Failed to create SFTP session: SFTP failed');
    });

    it('should throw error on upload failure', async () => {
      const mockSftp = {
        fastPut: jest.fn((_local: any, _remote: any, callback: any) => {
          setTimeout(() => callback(new Error('Upload failed')), 10);
        }),
        end: jest.fn(),
      };

      mockClient.sftp.mockImplementation((callback: any) => {
        callback(null, mockSftp);
        return mockClient;
      });

      await expect(
        sshClient.uploadFile('/local/file.txt', '/remote/file.txt')
      ).rejects.toThrow('Failed to upload file: Upload failed');
    });
  });

  describe('downloadFile', () => {
    beforeEach(async () => {
      sshClient = new SSHClient(config);
      
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      });
      
      await sshClient.connect();
    });

    it('should download file successfully', async () => {
      const mockSftp = {
        fastGet: jest.fn((_remote: any, _local: any, callback: any) => {
          setTimeout(() => callback(null), 10);
        }),
        end: jest.fn(),
      };

      mockClient.sftp.mockImplementation((callback: any) => {
        callback(null, mockSftp);
        return mockClient;
      });

      await expect(
        sshClient.downloadFile('/remote/file.txt', '/local/file.txt')
      ).resolves.toBeUndefined();
      
      expect(mockSftp.fastGet).toHaveBeenCalledWith(
        '/remote/file.txt',
        '/local/file.txt',
        expect.any(Function)
      );
    });

    it('should throw error if not connected', async () => {
      await sshClient.disconnect();
      
      await expect(
        sshClient.downloadFile('/remote/file.txt', '/local/file.txt')
      ).rejects.toThrow('Not connected to SSH server');
    });

    it('should throw error on download failure', async () => {
      const mockSftp = {
        fastGet: jest.fn((_remote: any, _local: any, callback: any) => {
          setTimeout(() => callback(new Error('Download failed')), 10);
        }),
        end: jest.fn(),
      };

      mockClient.sftp.mockImplementation((callback: any) => {
        callback(null, mockSftp);
        return mockClient;
      });

      await expect(
        sshClient.downloadFile('/remote/file.txt', '/local/file.txt')
      ).rejects.toThrow('Failed to download file: Download failed');
    });
  });
});
