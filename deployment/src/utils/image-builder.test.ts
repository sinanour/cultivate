/**
 * Unit tests for image-builder module
 * Tests Docker image building, tagging, and saving functionality
 */

import { ImageBuilder, buildAllImages, saveAllImages } from './image-builder.js';
import type { ContainerRuntime } from '../types/deployment.js';
import * as containerRuntime from './container-runtime.js';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('child_process');
jest.mock('util', () => {
  const mockExec = jest.fn();
  return {
    promisify: jest.fn(() => mockExec)
  };
});
jest.mock('fs/promises');
jest.mock('./container-runtime.js');
jest.mock('./logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Get the mocked exec async function
import { promisify } from 'util';
const mockExecAsync = promisify(jest.fn() as any) as jest.Mock;

describe('ImageBuilder', () => {
  let builder: ImageBuilder;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock runtime
    mockRuntime = {
      name: 'docker',
      buildCommand: 'docker',
      composeCommand: 'docker-compose',
      available: true,
      version: '24.0.0'
    };

    // Mock container runtime detection
    (containerRuntime.detectContainerRuntime as jest.Mock).mockResolvedValue(mockRuntime);
    (containerRuntime.verifyContainerRuntime as jest.Mock).mockResolvedValue(true);

    // Mock fs.access to simulate file existence
    (fs.access as jest.Mock).mockResolvedValue(undefined);

    // Mock fs.mkdir
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    builder = new ImageBuilder();
  });

  describe('initialize', () => {
    it('should detect and verify container runtime', async () => {
      await builder.initialize();

      expect(containerRuntime.detectContainerRuntime).toHaveBeenCalled();
      expect(containerRuntime.verifyContainerRuntime).toHaveBeenCalledWith(mockRuntime);
    });

    it('should throw error if runtime verification fails', async () => {
      (containerRuntime.verifyContainerRuntime as jest.Mock).mockResolvedValue(false);

      await expect(builder.initialize()).rejects.toThrow(
        'Container runtime docker is not functional'
      );
    });

    it('should support Finch runtime on macOS', async () => {
      const finchRuntime: ContainerRuntime = {
        name: 'finch',
        buildCommand: 'finch',
        composeCommand: 'finch compose',
        available: true,
        version: '1.0.0'
      };

      (containerRuntime.detectContainerRuntime as jest.Mock).mockResolvedValue(finchRuntime);

      await builder.initialize();

      expect(containerRuntime.detectContainerRuntime).toHaveBeenCalled();
      expect(containerRuntime.verifyContainerRuntime).toHaveBeenCalledWith(finchRuntime);
    });
  });

  describe('buildImage', () => {
    beforeEach(async () => {
      await builder.initialize();
    });

    it('should build Docker image successfully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'Successfully built abc123',
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            Id: 'sha256:abc123',
            Size: 1024000,
            Created: '2024-01-01T00:00:00Z'
          }),
          stderr: ''
        });

      const result = await builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0'
      });

      expect(result).toMatchObject({
        name: 'test_image',
        tag: '1.0.0',
        buildHost: 'local'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('docker build'),
        expect.any(Object)
      );
    });

    it('should use Finch when specified', async () => {
      const finchRuntime: ContainerRuntime = {
        name: 'finch',
        buildCommand: 'finch',
        composeCommand: 'finch compose',
        available: true,
        version: '1.0.0'
      };

      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'Successfully built abc123',
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            Id: 'sha256:abc123',
            Size: 1024000,
            Created: '2024-01-01T00:00:00Z'
          }),
          stderr: ''
        });

      await builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0',
        runtime: finchRuntime
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('finch build'),
        expect.any(Object)
      );
    });

    it('should include build arguments when provided', async () => {
      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'Successfully built abc123',
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            Id: 'sha256:abc123',
            Size: 1024000,
            Created: '2024-01-01T00:00:00Z'
          }),
          stderr: ''
        });

      await builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0',
        buildArgs: {
          NODE_ENV: 'production',
          VERSION: '1.0.0'
        }
      });

      const buildCommand = mockExecAsync.mock.calls[0][0];
      expect(buildCommand).toContain('--build-arg NODE_ENV=production');
      expect(buildCommand).toContain('--build-arg VERSION=1.0.0');
    });

    it('should call progress callback during build', async () => {
      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'Successfully built abc123',
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            Id: 'sha256:abc123',
            Size: 1024000,
            Created: '2024-01-01T00:00:00Z'
          }),
          stderr: ''
        });

      const progressCallback = jest.fn();

      await builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0'
      }, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith('Building image test_image:1.0.0...');
      expect(progressCallback).toHaveBeenCalledWith('Successfully built test_image:1.0.0');
    });

    it('should throw error if Dockerfile does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('File not found'));

      await expect(builder.buildImage({
        dockerfile: '/path/to/nonexistent/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0'
      })).rejects.toThrow('Dockerfile not found');
    });

    it('should throw error if context directory does not exist', async () => {
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // Dockerfile exists
        .mockRejectedValueOnce(new Error('Directory not found')); // Context doesn't exist

      await expect(builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/nonexistent/context',
        imageName: 'test_image',
        tag: '1.0.0'
      })).rejects.toThrow('Build context directory not found');
    });

    it('should throw error if build fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Build failed: syntax error'));

      await expect(builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0'
      })).rejects.toThrow('Failed to build image test_image:1.0.0');
    });

    it('should handle build warnings in stderr', async () => {
      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'Successfully built abc123',
          stderr: 'WARNING: deprecated feature used'
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            Id: 'sha256:abc123',
            Size: 1024000,
            Created: '2024-01-01T00:00:00Z'
          }),
          stderr: ''
        });

      // Should not throw error for warnings
      const result = await builder.buildImage({
        dockerfile: '/path/to/Dockerfile',
        context: '/path/to/context',
        imageName: 'test_image',
        tag: '1.0.0'
      });

      expect(result).toBeDefined();
    });
  });

  describe('tagImage', () => {
    beforeEach(async () => {
      await builder.initialize();
    });

    it('should tag image successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await builder.tagImage('test_image:1.0.0', 'test_image:latest');

      expect(mockExecAsync).toHaveBeenCalledWith('docker tag test_image:1.0.0 test_image:latest');
    });

    it('should throw error if tagging fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Image not found'));

      await expect(
        builder.tagImage('nonexistent:1.0.0', 'nonexistent:latest')
      ).rejects.toThrow('Failed to tag image');
    });

    it('should support version tagging for rollback', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      // Tag with version for rollback capability
      await builder.tagImage('test_image:latest', 'test_image:1.0.0');

      expect(mockExecAsync).toHaveBeenCalledWith('docker tag test_image:latest test_image:1.0.0');
    });
  });

  describe('saveImage', () => {
    beforeEach(async () => {
      await builder.initialize();
    });

    it('should save image to tar file', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await builder.saveImage({
        imageTag: 'test_image:1.0.0',
        outputPath: '/tmp/test_image.tar'
      });

      expect(fs.mkdir).toHaveBeenCalledWith('/tmp', { recursive: true });
      expect(mockExecAsync).toHaveBeenCalledWith('docker save test_image:1.0.0 -o /tmp/test_image.tar');
    });

    it('should call progress callback during save', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const progressCallback = jest.fn();

      await builder.saveImage({
        imageTag: 'test_image:1.0.0',
        outputPath: '/tmp/test_image.tar'
      }, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith('Saving image test_image:1.0.0 to /tmp/test_image.tar...');
      expect(progressCallback).toHaveBeenCalledWith('Image saved to /tmp/test_image.tar');
    });

    it('should throw error if save fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Disk full'));

      await expect(builder.saveImage({
        imageTag: 'test_image:1.0.0',
        outputPath: '/tmp/test_image.tar'
      })).rejects.toThrow('Failed to save image test_image:1.0.0');
    });

    it('should create output directory if it does not exist', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await builder.saveImage({
        imageTag: 'test_image:1.0.0',
        outputPath: '/tmp/nested/dir/test_image.tar'
      });

      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/nested/dir', { recursive: true });
    });
  });

  describe('listImages', () => {
    beforeEach(async () => {
      await builder.initialize();
    });

    it('should list all images', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'test_image:1.0.0\ntest_image:latest\nanother_image:2.0.0\n',
        stderr: ''
      });

      const images = await builder.listImages();

      expect(images).toEqual([
        'test_image:1.0.0',
        'test_image:latest',
        'another_image:2.0.0'
      ]);
    });

    it('should return empty array if no images exist', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const images = await builder.listImages();

      expect(images).toEqual([]);
    });

    it('should throw error if listing fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Docker daemon not running'));

      await expect(builder.listImages()).rejects.toThrow('Failed to list images');
    });
  });

  describe('imageExists', () => {
    beforeEach(async () => {
      await builder.initialize();
    });

    it('should return true if image exists', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'abc123\n', stderr: '' });

      const exists = await builder.imageExists('test_image:1.0.0');

      expect(exists).toBe(true);
    });

    it('should return false if image does not exist', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const exists = await builder.imageExists('nonexistent:1.0.0');

      expect(exists).toBe(false);
    });

    it('should return false if command fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const exists = await builder.imageExists('test_image:1.0.0');

      expect(exists).toBe(false);
    });
  });

  describe('removeImage', () => {
    beforeEach(async () => {
      await builder.initialize();
    });

    it('should remove image successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await builder.removeImage('test_image:1.0.0');

      expect(mockExecAsync).toHaveBeenCalledWith('docker rmi test_image:1.0.0');
    });

    it('should throw error if removal fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Image in use'));

      await expect(
        builder.removeImage('test_image:1.0.0')
      ).rejects.toThrow('Failed to remove image test_image:1.0.0');
    });
  });
});

describe('buildAllImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockRuntime: ContainerRuntime = {
      name: 'docker',
      buildCommand: 'docker',
      composeCommand: 'docker-compose',
      available: true,
      version: '24.0.0'
    };

    (containerRuntime.detectContainerRuntime as jest.Mock).mockResolvedValue(mockRuntime);
    (containerRuntime.verifyContainerRuntime as jest.Mock).mockResolvedValue(true);
    (fs.access as jest.Mock).mockResolvedValue(undefined);

    mockExecAsync.mockImplementation((cmd: string) => {
      if (cmd.includes('inspect')) {
        return Promise.resolve({
          stdout: JSON.stringify({
            Id: 'sha256:abc123',
            Size: 1024000,
            Created: '2024-01-01T00:00:00Z'
          }),
          stderr: ''
        });
      }
      return Promise.resolve({
        stdout: 'Successfully built abc123',
        stderr: ''
      });
    });
  });

  it('should build all three application images', async () => {
    const images = await buildAllImages('1.0.0', '/path/to/context');

    expect(images).toHaveLength(3);
    expect(images[0].name).toBe('cat_frontend');
    expect(images[1].name).toBe('cat_backend');
    expect(images[2].name).toBe('cat_database');
    expect(images.every(img => img.tag === '1.0.0')).toBe(true);
  });

  it('should call progress callback for each image', async () => {
    const progressCallback = jest.fn();

    await buildAllImages('1.0.0', '/path/to/context', progressCallback);

    expect(progressCallback).toHaveBeenCalledWith('Building frontend image...');
    expect(progressCallback).toHaveBeenCalledWith('Building backend image...');
    expect(progressCallback).toHaveBeenCalledWith('Building database image...');
    expect(progressCallback).toHaveBeenCalledWith(expect.stringContaining('All images built successfully'));
  });

  it('should throw error if any image build fails', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: 'Success', stderr: '' }) // frontend build
      .mockResolvedValueOnce({ stdout: JSON.stringify({ Id: 'abc', Size: 1024, Created: '2024-01-01' }), stderr: '' }) // frontend inspect
      .mockRejectedValueOnce(new Error('Backend build failed')); // backend build fails

    await expect(
      buildAllImages('1.0.0', '/path/to/context')
    ).rejects.toThrow();
  });
});

describe('saveAllImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockRuntime: ContainerRuntime = {
      name: 'docker',
      buildCommand: 'docker',
      composeCommand: 'docker-compose',
      available: true,
      version: '24.0.0'
    };

    (containerRuntime.detectContainerRuntime as jest.Mock).mockResolvedValue(mockRuntime);
    (containerRuntime.verifyContainerRuntime as jest.Mock).mockResolvedValue(true);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('should save all three application images', async () => {
    const outputPaths = await saveAllImages('1.0.0', '/tmp/images');

    expect(outputPaths).toHaveLength(3);
    expect(outputPaths[0]).toContain('cat_frontend-1.0.0.tar');
    expect(outputPaths[1]).toContain('cat_backend-1.0.0.tar');
    expect(outputPaths[2]).toContain('cat_database-1.0.0.tar');
  });

  it('should call progress callback for each image', async () => {
    const progressCallback = jest.fn();

    await saveAllImages('1.0.0', '/tmp/images', progressCallback);

    expect(progressCallback).toHaveBeenCalledWith(expect.stringContaining('Saving image cat_frontend:1.0.0'));
    expect(progressCallback).toHaveBeenCalledWith(expect.stringContaining('Saving image cat_backend:1.0.0'));
    expect(progressCallback).toHaveBeenCalledWith(expect.stringContaining('Saving image cat_database:1.0.0'));
    expect(progressCallback).toHaveBeenCalledWith(expect.stringContaining('All images saved'));
  });

  it('should throw error if any image save fails', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // frontend save
      .mockRejectedValueOnce(new Error('Disk full')); // backend save fails

    await expect(
      saveAllImages('1.0.0', '/tmp/images')
    ).rejects.toThrow();
  });
});
