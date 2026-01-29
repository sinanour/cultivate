/**
 * Unit tests for image transfer module
 */

import { ImageTransfer, transferAllImages, verifyAllImagesOnRemote } from './image-transfer';
import { SSHClient } from './ssh-client';
import { ImageBuilder } from './image-builder';

// Mock dependencies
jest.mock('./ssh-client');
jest.mock('./image-builder');
jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/docker-image-test'),
  mkdir: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024000 }),
  rm: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('./logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ImageTransfer', () => {
  let transfer: ImageTransfer;
  let mockSSHClient: jest.Mocked<SSHClient>;

  beforeEach(() => {
    transfer = new ImageTransfer();

    // Create mock SSH client
    mockSSHClient = {
      isConnected: jest.fn().mockReturnValue(true),
      executeCommand: jest.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      }),
      uploadFile: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock ImageBuilder.prototype.saveImage
    const mockSaveImage = jest.fn().mockResolvedValue(undefined);
    (ImageBuilder.prototype.saveImage as jest.Mock) = mockSaveImage;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('transferImage', () => {
    it('should transfer an image successfully', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123def456',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image: test-image:1.0.0',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const result = await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      });

      expect(result.success).toBe(true);
      expect(result.imageTag).toBe('test-image:1.0.0');
      expect(result.size).toBeGreaterThan(0);
      expect(result.transferTime).toBeGreaterThanOrEqual(0);
      expect(mockSSHClient.uploadFile).toHaveBeenCalled();
    });

    it('should throw error if SSH client is not connected', async () => {
      mockSSHClient.isConnected.mockReturnValue(false);

      await expect(
        transfer.transferImage({
          sshClient: mockSSHClient,
          imageTag: 'test-image:1.0.0'
        })
      ).rejects.toThrow('SSH client is not connected');
    });

    it('should call progress callback during transfer', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image: test-image:1.0.0',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      }, onProgress);

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some(msg => msg.includes('Saving image'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('Transferring image'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('Loading image'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('Successfully transferred'))).toBe(true);
    });

    it('should handle transfer failure and return error result', async () => {
      // Mock upload failure
      mockSSHClient.uploadFile.mockRejectedValue(
        new Error('Network error')
      );

      const result = await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle docker load failure', async () => {
      // Mock docker load failure
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker load')) {
          return {
            stdout: '',
            stderr: 'Error loading image',
            exitCode: 1
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const result = await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load image');
    });

    it('should handle image verification failure', async () => {
      // Mock verification failure
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: '', // Empty output means image not found
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const result = await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('verification failed');
    });

    it('should support custom remote temp directory', async () => {
      const customTempDir = '/custom/temp/dir';

      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0',
        remoteTempDir: customTempDir
      });

      // Verify custom temp directory was used
      const mkdirCalls = mockSSHClient.executeCommand.mock.calls.filter(
        (call: any[]) => call[0].includes('mkdir') && call[0].includes(customTempDir)
      );
      expect(mkdirCalls.length).toBeGreaterThan(0);
    });

    it('should cleanup local tar file by default', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const result = await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      });

      expect(result.success).toBe(true);
      // Verify cleanup was attempted (rm -f command)
      const cleanupCalls = mockSSHClient.executeCommand.mock.calls.filter(
        (call: any[]) => call[0].includes('rm -f')
      );
      expect(cleanupCalls.length).toBeGreaterThan(0);
    });

    it('should not cleanup local tar file if cleanupLocal is false', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const result = await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0',
        cleanupLocal: false
      });

      expect(result.success).toBe(true);
    });

    it('should report progress with bytes transferred', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const progressCalls: Array<{ message: string; bytes?: number; total?: number }> = [];
      const onProgress = (message: string, bytes?: number, total?: number) => {
        progressCalls.push({ message, bytes, total });
      };

      await transfer.transferImage({
        sshClient: mockSSHClient,
        imageTag: 'test-image:1.0.0'
      }, onProgress);

      // Verify progress was reported with byte information
      const uploadProgress = progressCalls.filter(p => p.message.includes('Uploading'));
      expect(uploadProgress.length).toBeGreaterThan(0);
    });
  });

  describe('transferAllImages', () => {
    it('should transfer all three application images', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const results = await transferAllImages(
        mockSSHClient,
        '1.0.0'
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].imageTag).toBe('cat_frontend:1.0.0');
      expect(results[1].imageTag).toBe('cat_backend:1.0.0');
      expect(results[2].imageTag).toBe('cat_database:1.0.0');
    });

    it('should stop on first transfer failure', async () => {
      let transferCount = 0;

      // Mock first transfer success, second transfer failure
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker load')) {
          transferCount++;
          if (transferCount === 2) {
            return {
              stdout: '',
              stderr: 'Load failed',
              exitCode: 1
            };
          }
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker images -q')) {
          return {
            stdout: transferCount === 2 ? '' : 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      await expect(
        transferAllImages(mockSSHClient, '1.0.0')
      ).rejects.toThrow('Failed to transfer');
    });

    it('should call progress callback for each image', async () => {
      // Mock docker images verification
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker images -q')) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        if (cmd.includes('docker load')) {
          return {
            stdout: 'Loaded image',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await transferAllImages(
        mockSSHClient,
        '1.0.0',
        onProgress
      );

      expect(progressMessages.some(msg => msg.includes('cat_frontend'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('cat_backend'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('cat_database'))).toBe(true);
    });
  });

  describe('verifyAllImagesOnRemote', () => {
    it('should return true if all images exist', async () => {
      // Mock all images exist
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: 'abc123def456',
        stderr: '',
        exitCode: 0
      });

      const result = await verifyAllImagesOnRemote(mockSSHClient, '1.0.0');

      expect(result).toBe(true);
    });

    it('should return false if any image is missing', async () => {
      let callCount = 0;

      // Mock first two images exist, third is missing
      mockSSHClient.executeCommand.mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          };
        }
        return {
          stdout: '', // Empty output means image not found
          stderr: '',
          exitCode: 0
        };
      });

      const result = await verifyAllImagesOnRemote(mockSSHClient, '1.0.0');

      expect(result).toBe(false);
    });

    it('should return false if docker images command fails', async () => {
      // Mock command failure
      mockSSHClient.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'Docker not found',
        exitCode: 1
      });

      const result = await verifyAllImagesOnRemote(mockSSHClient, '1.0.0');

      expect(result).toBe(false);
    });
  });
});
