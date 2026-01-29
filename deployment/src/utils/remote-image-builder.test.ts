/**
 * Unit tests for remote image builder module
 */

import { RemoteImageBuilder, buildAllImagesRemote } from './remote-image-builder';
import { SSHClient } from './ssh-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock dependencies
jest.mock('./ssh-client');
jest.mock('./logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('RemoteImageBuilder', () => {
  let builder: RemoteImageBuilder;
  let mockSSHClient: jest.Mocked<SSHClient>;
  let tempDir: string;

  beforeEach(async () => {
    builder = new RemoteImageBuilder();

    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remote-builder-test-'));

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
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    jest.restoreAllMocks();
  });

  describe('buildImage', () => {
    it('should build an image on remote host successfully', async () => {
      // Create test Dockerfile and context
      const dockerfile = path.join(tempDir, 'Dockerfile');
      const context = tempDir;

      await fs.writeFile(dockerfile, 'FROM alpine:latest\nRUN echo "test"');

      // Mock docker inspect response
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker inspect')) {
          return {
            stdout: JSON.stringify({
              Id: 'sha256:abc123',
              Size: 1024000,
              Created: new Date().toISOString()
            }),
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

      const result = await builder.buildImage({
        sshClient: mockSSHClient,
        dockerfile,
        context,
        imageName: 'test-image',
        tag: '1.0.0'
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('test-image');
      expect(result.tag).toBe('1.0.0');
      expect(result.buildHost).toBe('remote');
      expect(mockSSHClient.executeCommand).toHaveBeenCalled();
      expect(mockSSHClient.uploadFile).toHaveBeenCalled();
    });

    it('should throw error if SSH client is not connected', async () => {
      mockSSHClient.isConnected.mockReturnValue(false);

      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest');

      await expect(
        builder.buildImage({
          sshClient: mockSSHClient,
          dockerfile,
          context: tempDir,
          imageName: 'test-image',
          tag: '1.0.0'
        })
      ).rejects.toThrow('SSH client is not connected');
    });

    it('should throw error if Dockerfile does not exist', async () => {
      const nonExistentDockerfile = path.join(tempDir, 'NonExistent.Dockerfile');

      await expect(
        builder.buildImage({
          sshClient: mockSSHClient,
          dockerfile: nonExistentDockerfile,
          context: tempDir,
          imageName: 'test-image',
          tag: '1.0.0'
        })
      ).rejects.toThrow('Dockerfile not found');
    });

    it('should throw error if context directory does not exist', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest');

      const nonExistentContext = path.join(tempDir, 'nonexistent');

      await expect(
        builder.buildImage({
          sshClient: mockSSHClient,
          dockerfile,
          context: nonExistentContext,
          imageName: 'test-image',
          tag: '1.0.0'
        })
      ).rejects.toThrow('Build context directory not found');
    });

    it('should call progress callback during build', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest');

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await builder.buildImage({
        sshClient: mockSSHClient,
        dockerfile,
        context: tempDir,
        imageName: 'test-image',
        tag: '1.0.0'
      }, onProgress);

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages).toContain('Creating remote working directory...');
      expect(progressMessages.some(msg => msg.includes('Successfully built'))).toBe(true);
    });

    it('should handle build failure and cleanup', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest');

      // Mock docker build failure
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker build')) {
          return {
            stdout: '',
            stderr: 'Build failed: invalid syntax',
            exitCode: 1
          };
        }
        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      });

      await expect(
        builder.buildImage({
          sshClient: mockSSHClient,
          dockerfile,
          context: tempDir,
          imageName: 'test-image',
          tag: '1.0.0'
        })
      ).rejects.toThrow('Failed to build image');

      // Verify cleanup was attempted
      const cleanupCalls = mockSSHClient.executeCommand.mock.calls.filter(
        (call: any[]) => call[0].includes('rm -rf')
      );
      expect(cleanupCalls.length).toBeGreaterThan(0);
    });

    it('should support custom remote work directory', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest');

      const customWorkDir = '/custom/work/dir';

      await builder.buildImage({
        sshClient: mockSSHClient,
        dockerfile,
        context: tempDir,
        imageName: 'test-image',
        tag: '1.0.0',
        remoteWorkDir: customWorkDir
      });

      // Verify custom work directory was used
      const mkdirCalls = mockSSHClient.executeCommand.mock.calls.filter(
        (call: any[]) => call[0].includes('mkdir') && call[0].includes(customWorkDir)
      );
      expect(mkdirCalls.length).toBeGreaterThan(0);
    });

    it('should pass build arguments to docker build command', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest\nARG VERSION');

      const buildArgs = {
        VERSION: '1.0.0',
        BUILD_DATE: '2024-01-01'
      };

      await builder.buildImage({
        sshClient: mockSSHClient,
        dockerfile,
        context: tempDir,
        imageName: 'test-image',
        tag: '1.0.0',
        buildArgs
      });

      // Verify build args were passed
      const buildCalls = mockSSHClient.executeCommand.mock.calls.filter(
        (call: any[]) => call[0].includes('docker build')
      );
      expect(buildCalls.length).toBeGreaterThan(0);
      expect(buildCalls[0][0]).toContain('--build-arg VERSION=1.0.0');
      expect(buildCalls[0][0]).toContain('--build-arg BUILD_DATE=2024-01-01');
    });

    it('should handle verbose mode and stream build output', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      await fs.writeFile(dockerfile, 'FROM alpine:latest');

      // Mock docker build with output
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker build')) {
          return {
            stdout: 'Step 1/2 : FROM alpine:latest\nStep 2/2 : RUN echo test\nSuccessfully built abc123',
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

      await builder.buildImage({
        sshClient: mockSSHClient,
        dockerfile,
        context: tempDir,
        imageName: 'test-image',
        tag: '1.0.0',
        verbose: true
      }, onProgress);

      // Verify build output was streamed
      const buildOutputMessages = progressMessages.filter(msg => msg.includes('Step'));
      expect(buildOutputMessages.length).toBeGreaterThan(0);
    });
  });

  describe('buildAllImagesRemote', () => {
    it('should build all three application images', async () => {
      // Create test Dockerfiles
      const dockerfiles = ['Dockerfile.frontend', 'Dockerfile.backend', 'Dockerfile.database'];
      for (const dockerfile of dockerfiles) {
        await fs.writeFile(
          path.join(tempDir, dockerfile),
          'FROM alpine:latest\nRUN echo "test"'
        );
      }

      // Mock docker inspect response
      mockSSHClient.executeCommand.mockImplementation(async (cmd: string) => {
        if (cmd.includes('docker inspect')) {
          return {
            stdout: JSON.stringify({
              Id: 'sha256:abc123',
              Size: 1024000,
              Created: new Date().toISOString()
            }),
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

      const results = await buildAllImagesRemote(
        mockSSHClient,
        '1.0.0',
        tempDir
      );

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('cat_frontend');
      expect(results[1].name).toBe('cat_backend');
      expect(results[2].name).toBe('cat_database');
      expect(results.every(img => img.tag === '1.0.0')).toBe(true);
      expect(results.every(img => img.buildHost === 'remote')).toBe(true);
    });

    it('should call progress callback for each image', async () => {
      // Create test Dockerfiles
      const dockerfiles = ['Dockerfile.frontend', 'Dockerfile.backend', 'Dockerfile.database'];
      for (const dockerfile of dockerfiles) {
        await fs.writeFile(
          path.join(tempDir, dockerfile),
          'FROM alpine:latest'
        );
      }

      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };

      await buildAllImagesRemote(
        mockSSHClient,
        '1.0.0',
        tempDir,
        onProgress
      );

      expect(progressMessages.some(msg => msg.includes('frontend'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('backend'))).toBe(true);
      expect(progressMessages.some(msg => msg.includes('database'))).toBe(true);
    });
  });
});
