import { OSDetector } from './os-detector';
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

describe('OSDetector', () => {
  let mockSSHClient: jest.Mocked<SSHClient>;
  let osDetector: OSDetector;

  beforeEach(() => {
    mockSSHClient = {
      executeCommand: jest.fn(),
    } as any;

    osDetector = new OSDetector(mockSSHClient);
  });

  describe('detectOS', () => {
    describe('macOS detection', () => {
      it('should detect macOS with version', async () => {
        // First call: uname returns Darwin
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'Darwin\n',
          stderr: '',
          exitCode: 0,
        });

        // Second call: sw_vers returns version
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: '14.2.1\n',
          stderr: '',
          exitCode: 0,
        });

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('macos');
        expect(result.version).toBe('14.2.1');
        expect(result.packageManager).toBe('brew');
        expect(result.supported).toBe(true);
        expect(result.isMacOS).toBe(true);
        expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('uname');
        expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('sw_vers -productVersion');
      });

      it('should detect macOS even if version command fails', async () => {
        // First call: uname returns Darwin
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'Darwin\n',
          stderr: '',
          exitCode: 0,
        });

        // Second call: sw_vers fails
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: '',
          stderr: 'command not found',
          exitCode: 1,
        });

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('macos');
        expect(result.version).toBeUndefined();
        expect(result.packageManager).toBe('brew');
        expect(result.supported).toBe(true);
        expect(result.isMacOS).toBe(true);
      });
    });

    describe('Linux detection', () => {
      it('should detect Ubuntu from /etc/os-release', async () => {
        // First call: uname returns Linux
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'Linux\n',
          stderr: '',
          exitCode: 0,
        });

        // Second call: check /etc/os-release exists
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'exists\n',
          stderr: '',
          exitCode: 0,
        });

        // Third call: read /etc/os-release
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'ID=ubuntu\nVERSION_ID="22.04"\n',
          stderr: '',
          exitCode: 0,
        });

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('ubuntu');
        expect(result.version).toBe('22.04');
        expect(result.packageManager).toBe('apt-get');
        expect(result.supported).toBe(true);
        expect(result.isMacOS).toBeUndefined();
      });

      it('should detect Amazon Linux 2023', async () => {
        // First call: uname returns Linux
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'Linux\n',
          stderr: '',
          exitCode: 0,
        });

        // Second call: check /etc/os-release exists
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'exists\n',
          stderr: '',
          exitCode: 0,
        });

        // Third call: read /etc/os-release
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'ID="amzn"\nVERSION_ID="2023"\n',
          stderr: '',
          exitCode: 0,
        });

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('amzn');
        expect(result.version).toBe('2023');
        expect(result.packageManager).toBe('dnf'); // AL2023 uses dnf
        expect(result.supported).toBe(true);
      });

      it('should detect Amazon Linux 2', async () => {
        // First call: uname returns Linux
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'Linux\n',
          stderr: '',
          exitCode: 0,
        });

        // Second call: check /etc/os-release exists
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'exists\n',
          stderr: '',
          exitCode: 0,
        });

        // Third call: read /etc/os-release
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'ID="amzn"\nVERSION_ID="2"\n',
          stderr: '',
          exitCode: 0,
        });

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('amzn');
        expect(result.version).toBe('2');
        expect(result.packageManager).toBe('yum'); // AL2 uses yum
        expect(result.supported).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle unsupported OS', async () => {
        // First call: uname returns something unexpected
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: 'FreeBSD\n',
          stderr: '',
          exitCode: 0,
        });

        // Second call: check /etc/os-release exists
        mockSSHClient.executeCommand.mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 1,
        });

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('unknown');
        expect(result.supported).toBe(false);
        expect(result.error).toBeTruthy();
      });

      it('should handle SSH command errors', async () => {
        mockSSHClient.executeCommand.mockRejectedValue(new Error('SSH connection lost'));

        const result = await osDetector.detectOS();

        expect(result.distribution).toBe('unknown');
        expect(result.supported).toBe(false);
        expect(result.error).toBeTruthy();
        // The error is caught and a generic message is returned
        expect(result.error).toContain('Unable to detect');
      });
    });
  });

  describe('checkPackageManager', () => {
    it('should return true when package manager is available', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '/usr/bin/apt-get\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await osDetector.checkPackageManager('apt-get');

      expect(result).toBe(true);
      expect(mockSSHClient.executeCommand).toHaveBeenCalledWith('command -v apt-get');
    });

    it('should return false when package manager is not available', async () => {
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 1,
      });

      const result = await osDetector.checkPackageManager('brew');

      expect(result).toBe(false);
    });

    it('should return false when SSH command throws error', async () => {
      mockSSHClient.executeCommand.mockRejectedValue(new Error('Connection error'));

      const result = await osDetector.checkPackageManager('dnf');

      expect(result).toBe(false);
    });
  });
});
