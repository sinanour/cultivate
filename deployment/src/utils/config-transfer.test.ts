import { ConfigTransfer, ConfigTransferOptions } from './config-transfer';
import { SSHClient } from './ssh-client';
import { DeploymentConfiguration } from '../types/deployment';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock SSHClient
jest.mock('./ssh-client');

describe('ConfigTransfer', () => {
  let mockSSHClient: jest.Mocked<SSHClient>;
  let configTransfer: ConfigTransfer;
  let tempDir: string;

  beforeEach(() => {
    // Create mock SSH client
    mockSSHClient = {
      uploadFile: jest.fn(),
      executeCommand: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    configTransfer = new ConfigTransfer(mockSSHClient);

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-transfer-test-'));
  });

  afterEach(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('transferFile', () => {
    it('should transfer a file successfully', async () => {
      const localPath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(localPath, 'test content');

      mockSSHClient.uploadFile.mockResolvedValue(undefined);
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '12',
        stderr: '',
        exitCode: 0,
      });

      const result = await configTransfer.transferFile(localPath, '/remote/test.txt');

      expect(result.success).toBe(true);
      expect(result.localPath).toBe(localPath);
      expect(result.remotePath).toBe('/remote/test.txt');
      expect(mockSSHClient.uploadFile).toHaveBeenCalledWith(localPath, '/remote/test.txt');
    });

    it('should fail if local file does not exist', async () => {
      const result = await configTransfer.transferFile('/nonexistent/file.txt', '/remote/file.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Local file not found');
      expect(mockSSHClient.uploadFile).not.toHaveBeenCalled();
    });

    it('should fail if upload fails', async () => {
      const localPath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(localPath, 'test content');

      mockSSHClient.uploadFile.mockRejectedValue(new Error('Upload failed'));

      const result = await configTransfer.transferFile(localPath, '/remote/test.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    it('should fail if verification fails', async () => {
      const localPath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(localPath, 'test content');

      mockSSHClient.uploadFile.mockResolvedValue(undefined);
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '999', // Wrong size
        stderr: '',
        exitCode: 0,
      });

      const result = await configTransfer.transferFile(localPath, '/remote/test.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('verification failed');
    });
  });

  describe('transferConfiguration', () => {
    it('should transfer all configuration files', async () => {
      const composePath = path.join(tempDir, 'docker-compose.yml');
      const envPath = path.join(tempDir, '.env');

      fs.writeFileSync(composePath, 'version: "3.8"');
      fs.writeFileSync(envPath, 'NODE_ENV=production');

      // Mock file size verification to return correct sizes
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker-compose.yml')) {
          return { stdout: '14', stderr: '', exitCode: 0 }; // Size of 'version: "3.8"'
        } else if (cmd.includes('.env')) {
          return { stdout: '19', stderr: '', exitCode: 0 }; // Size of 'NODE_ENV=production'
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      mockSSHClient.uploadFile.mockResolvedValue(undefined);

      const options: ConfigTransferOptions = {
        composeFilePath: composePath,
        envFilePath: envPath,
        targetDir: '/opt/deployment',
        setPermissions: false,
      };

      const result = await configTransfer.transferConfiguration(options);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('mkdir -p /opt/deployment');
    });

    it('should transfer certificates when provided', async () => {
      const composePath = path.join(tempDir, 'docker-compose.yml');
      const envPath = path.join(tempDir, '.env');
      const certDir = path.join(tempDir, 'certs');

      fs.writeFileSync(composePath, 'version: "3.8"');
      fs.writeFileSync(envPath, 'NODE_ENV=production');
      fs.mkdirSync(certDir);
      fs.writeFileSync(path.join(certDir, 'cert.pem'), 'cert content');
      fs.writeFileSync(path.join(certDir, 'key.pem'), 'key content');

      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.startsWith('stat')) {
          if (cmd.includes('docker-compose.yml')) {
            return { stdout: '14', stderr: '', exitCode: 0 };
          } else if (cmd.includes('.env')) {
            return { stdout: '19', stderr: '', exitCode: 0 };
          } else if (cmd.includes('cert.pem')) {
            return { stdout: '12', stderr: '', exitCode: 0 };
          } else if (cmd.includes('key.pem')) {
            return { stdout: '11', stderr: '', exitCode: 0 };
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      mockSSHClient.uploadFile.mockResolvedValue(undefined);

      const options: ConfigTransferOptions = {
        composeFilePath: composePath,
        envFilePath: envPath,
        certPath: certDir,
        targetDir: '/opt/deployment',
        setPermissions: false,
      };

      const result = await configTransfer.transferConfiguration(options);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThanOrEqual(4); // compose, env, cert, key
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('mkdir -p /opt/deployment/certs');
    });

    it('should set file permissions when requested', async () => {
      const composePath = path.join(tempDir, 'docker-compose.yml');
      const envPath = path.join(tempDir, '.env');

      fs.writeFileSync(composePath, 'version: "3.8"');
      fs.writeFileSync(envPath, 'NODE_ENV=production');

      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker-compose.yml') && cmd.startsWith('stat')) {
          return { stdout: '14', stderr: '', exitCode: 0 };
        } else if (cmd.includes('.env') && cmd.startsWith('stat')) {
          return { stdout: '19', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      mockSSHClient.uploadFile.mockResolvedValue(undefined);

      const options: ConfigTransferOptions = {
        composeFilePath: composePath,
        envFilePath: envPath,
        targetDir: '/opt/deployment',
        setPermissions: true,
      };

      const result = await configTransfer.transferConfiguration(options);

      expect(result.success).toBe(true);
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('chmod 0644 /opt/deployment/docker-compose.yml')
      );
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('chmod 0600 /opt/deployment/.env')
      );
    });

    it('should handle transfer failures gracefully', async () => {
      const composePath = path.join(tempDir, 'docker-compose.yml');
      const envPath = path.join(tempDir, '.env');

      fs.writeFileSync(composePath, 'version: "3.8"');
      fs.writeFileSync(envPath, 'NODE_ENV=production');

      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockSSHClient.uploadFile.mockRejectedValue(new Error('Network error'));

      const options: ConfigTransferOptions = {
        composeFilePath: composePath,
        envFilePath: envPath,
        targetDir: '/opt/deployment',
        setPermissions: false,
      };

      const result = await configTransfer.transferConfiguration(options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('transferCertificates', () => {
    it('should transfer all certificate files from directory', async () => {
      const certDir = path.join(tempDir, 'certs');
      fs.mkdirSync(certDir);
      fs.writeFileSync(path.join(certDir, 'cert.pem'), 'cert');
      fs.writeFileSync(path.join(certDir, 'key.pem'), 'key');
      fs.writeFileSync(path.join(certDir, 'ca.crt'), 'ca');
      fs.writeFileSync(path.join(certDir, 'readme.txt'), 'readme'); // Should be ignored

      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.startsWith('stat')) {
          if (cmd.includes('cert.pem')) {
            return { stdout: '4', stderr: '', exitCode: 0 };
          } else if (cmd.includes('key.pem')) {
            return { stdout: '3', stderr: '', exitCode: 0 };
          } else if (cmd.includes('ca.crt')) {
            return { stdout: '2', stderr: '', exitCode: 0 };
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      mockSSHClient.uploadFile.mockResolvedValue(undefined);

      const results = await configTransfer.transferCertificates(certDir, '/remote/certs');

      expect(results.length).toBe(3); // Only cert files, not readme.txt
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should transfer single certificate file', async () => {
      const certFile = path.join(tempDir, 'cert.pem');
      fs.writeFileSync(certFile, 'cert content');

      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '12',
        stderr: '',
        exitCode: 0,
      });
      mockSSHClient.uploadFile.mockResolvedValue(undefined);

      const results = await configTransfer.transferCertificates(certFile, '/remote/certs');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].remotePath).toBe('/remote/certs/cert.pem');
    });

    it('should handle certificate transfer errors', async () => {
      const certDir = path.join(tempDir, 'certs');
      fs.mkdirSync(certDir);
      fs.writeFileSync(path.join(certDir, 'cert.pem'), 'cert');

      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockSSHClient.uploadFile.mockRejectedValue(new Error('Upload failed'));

      const results = await configTransfer.transferCertificates(certDir, '/remote/certs');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].success).toBe(false);
    });
  });

  describe('ensureRemoteDirectory', () => {
    it('should create remote directory', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await configTransfer.ensureRemoteDirectory('/opt/deployment');

      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('mkdir -p /opt/deployment');
    });

    it('should throw error if directory creation fails', async () => {
      mockSSHClient.executeCommand.mockRejectedValue(new Error('Permission denied'));

      await expect(configTransfer.ensureRemoteDirectory('/opt/deployment')).rejects.toThrow(
        'Failed to create remote directory'
      );
    });
  });

  describe('generateEnvFile', () => {
    it('should generate .env file content', () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const content = ConfigTransfer.generateEnvFile(config);

      expect(content).toContain('HTTP_PORT=80');
      expect(content).toContain('HTTPS_PORT=443');
      expect(content).toContain('ENABLE_HTTPS=false');
      expect(content).toContain('NODE_ENV=production');
      expect(content).toContain('BACKEND_PORT=3000');
      expect(content).toContain('API_USER_UID=1001');
      expect(content).toContain('SOCKET_PERMISSIONS=0770');
    });

    it('should include certificate path when provided', () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: true,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
          certPath: '/etc/certs',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const content = ConfigTransfer.generateEnvFile(config);

      expect(content).toContain('CERT_PATH=/etc/certs');
      expect(content).toContain('ENABLE_HTTPS=true');
    });
  });

  describe('writeEnvFile', () => {
    it('should write .env file to filesystem', async () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const outputPath = path.join(tempDir, '.env');
      await ConfigTransfer.writeEnvFile(config, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toContain('HTTP_PORT=80');
      expect(content).toContain('NODE_ENV=production');
    });

    it('should throw error if write fails', async () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const invalidPath = '/nonexistent/directory/.env';
      await expect(ConfigTransfer.writeEnvFile(config, invalidPath)).rejects.toThrow(
        'Failed to write .env file'
      );
    });
  });
});
