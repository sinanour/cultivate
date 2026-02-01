/**
 * Tests for compose command detection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SSHClient } from './ssh-client.js';
import {
    detectComposeCommand,
    isFinchVMInitialized,
    initializeFinchVM,
    ensureFinchVMReady
} from './compose-command-detector.js';

// Mock SSHClient
jest.mock('./ssh-client.js');

describe('ComposeCommandDetector', () => {
    let mockSSHClient: jest.Mocked<SSHClient>;

    beforeEach(() => {
        mockSSHClient = {
            executeCommand: jest.fn()
        } as unknown as jest.Mocked<SSHClient>;
    });

    describe('detectComposeCommand', () => {
        it('should detect docker-compose on Linux', async () => {
            // Mock uname to return Linux
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Linux\n',
                stderr: ''
            });

            const result = await detectComposeCommand(mockSSHClient);

            expect(result.command).toBe('docker-compose');
            expect(result.isMacOS).toBe(false);
            expect(result.isFinch).toBe(false);
        });

        it('should detect finch compose on macOS with Finch in PATH', async () => {
            // Mock uname to return Darwin
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Darwin\n',
                stderr: ''
            });

            // Mock which finch to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'found\n',
                stderr: ''
            });

            // Mock finch compose version to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'finch compose version v1.0.0\n',
                stderr: ''
            });

            const result = await detectComposeCommand(mockSSHClient);

            expect(result.command).toBe('finch compose');
            expect(result.isMacOS).toBe(true);
            expect(result.isFinch).toBe(true);
            expect(result.runtimePath).toBe('finch');
        });

        it('should detect finch compose on macOS with Finch at /opt/homebrew/bin/finch', async () => {
            // Mock uname to return Darwin
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Darwin\n',
                stderr: ''
            });

            // Mock which finch to fail (not in PATH) - should not contain "found"
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 1,
                stdout: '',
                stderr: ''
            });

            // Mock test -x /opt/homebrew/bin/finch to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'found\n',
                stderr: ''
            });

            // Mock finch compose version to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'finch compose version v1.0.0\n',
                stderr: ''
            });

            const result = await detectComposeCommand(mockSSHClient);

            expect(result.command).toBe('/opt/homebrew/bin/finch compose');
            expect(result.isMacOS).toBe(true);
            expect(result.isFinch).toBe(true);
            expect(result.runtimePath).toBe('/opt/homebrew/bin/finch');
        });

        it('should fall back to docker-compose on macOS without Finch', async () => {
            // Mock uname to return Darwin
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Darwin\n',
                stderr: ''
            });

            // Mock all finch checks to fail - should not contain "found"
            mockSSHClient.executeCommand.mockResolvedValue({
                exitCode: 1,
                stdout: '',
                stderr: ''
            });

            const result = await detectComposeCommand(mockSSHClient);

            expect(result.command).toBe('docker-compose');
            expect(result.isMacOS).toBe(true);
            expect(result.isFinch).toBe(false);
        });

        it('should handle finch found but compose not working', async () => {
            // Mock uname to return Darwin
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Darwin\n',
                stderr: ''
            });

            // Mock which finch to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'found\n',
                stderr: ''
            });

            // Mock finch compose version to fail
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 1,
                stdout: '',
                stderr: 'compose command not found'
            });

            // Mock remaining finch checks to fail - should not contain "found"
            mockSSHClient.executeCommand.mockResolvedValue({
                exitCode: 1,
                stdout: '',
                stderr: ''
            });

            const result = await detectComposeCommand(mockSSHClient);

            expect(result.command).toBe('docker-compose');
            expect(result.isMacOS).toBe(true);
            expect(result.isFinch).toBe(false);
        });
    });

    describe('isFinchVMInitialized', () => {
        it('should return true when VM is running', async () => {
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Running\n',
                stderr: ''
            });

            const result = await isFinchVMInitialized(mockSSHClient, 'finch');

            expect(result).toBe(true);
        });

        it('should return true when VM is stopped', async () => {
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Stopped\n',
                stderr: ''
            });

            const result = await isFinchVMInitialized(mockSSHClient, 'finch');

            expect(result).toBe(true);
        });

        it('should return false when VM is not initialized', async () => {
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 1,
                stdout: '',
                stderr: 'VM not found'
            });

            const result = await isFinchVMInitialized(mockSSHClient, 'finch');

            expect(result).toBe(false);
        });

        it('should return false when command throws error', async () => {
            mockSSHClient.executeCommand.mockRejectedValueOnce(new Error('Connection failed'));

            const result = await isFinchVMInitialized(mockSSHClient, 'finch');

            expect(result).toBe(false);
        });
    });

    describe('initializeFinchVM', () => {
        it('should initialize VM successfully', async () => {
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'VM initialized\n',
                stderr: ''
            });

            await expect(initializeFinchVM(mockSSHClient, 'finch')).resolves.toBeUndefined();
        }, 15000); // 15 second timeout for VM initialization

        it('should handle VM already exists', async () => {
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'VM already exists\n',
                stderr: ''
            });

            await expect(initializeFinchVM(mockSSHClient, 'finch')).resolves.toBeUndefined();
        }, 15000);

        it('should throw error when initialization fails', async () => {
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 1,
                stdout: '',
                stderr: 'Initialization failed'
            });

            await expect(initializeFinchVM(mockSSHClient, 'finch'))
                .rejects.toThrow('Failed to initialize Finch VM');
        });

        it('should throw error when command throws', async () => {
            mockSSHClient.executeCommand.mockRejectedValueOnce(new Error('Connection failed'));

            await expect(initializeFinchVM(mockSSHClient, 'finch'))
                .rejects.toThrow('Failed to initialize Finch VM');
        });
    });

    describe('ensureFinchVMReady', () => {
        it('should initialize VM when not initialized', async () => {
            // Mock VM status check to return not initialized
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 1,
                stdout: '',
                stderr: 'VM not found'
            });

            // Mock VM init to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'VM initialized\n',
                stderr: ''
            });

            await expect(ensureFinchVMReady(mockSSHClient, 'finch')).resolves.toBeUndefined();
        }, 20000); // 20 second timeout

        it('should start VM when stopped', async () => {
            // Mock VM status check to return stopped
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Stopped\n',
                stderr: ''
            });

            // Mock VM status check again
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Stopped\n',
                stderr: ''
            });

            // Mock VM start to succeed
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'VM started\n',
                stderr: ''
            });

            await expect(ensureFinchVMReady(mockSSHClient, 'finch')).resolves.toBeUndefined();
        }, 20000); // 20 second timeout

        it('should do nothing when VM is running', async () => {
            // Mock VM status check to return running
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Running\n',
                stderr: ''
            });

            // Mock VM status check again
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Running\n',
                stderr: ''
            });

            await expect(ensureFinchVMReady(mockSSHClient, 'finch')).resolves.toBeUndefined();
        });

        it('should throw error when VM start fails', async () => {
            // Mock VM status check to return stopped
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Stopped\n',
                stderr: ''
            });

            // Mock VM status check again
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 0,
                stdout: 'Stopped\n',
                stderr: ''
            });

            // Mock VM start to fail
            mockSSHClient.executeCommand.mockResolvedValueOnce({
                exitCode: 1,
                stdout: '',
                stderr: 'Failed to start VM'
            });

            await expect(ensureFinchVMReady(mockSSHClient, 'finch'))
                .rejects.toThrow('Failed to start Finch VM');
        });
    });
});
