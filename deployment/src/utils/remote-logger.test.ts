/**
 * Tests for RemoteLogger
 * 
 * Tests cover:
 * - Log directory creation
 * - Writing single and multiple log entries
 * - Log file upload
 * - Log rotation based on size
 * - Log cleanup based on retention policy
 * - Error handling
 */

import { RemoteLogger, RemoteLogEntry, RemoteLoggerConfig } from './remote-logger';
import { SSHClient } from './ssh-client';

// Mock SSHClient
jest.mock('./ssh-client');

// Mock logger
jest.mock('./logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));

// Mock fs
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    statSync: jest.fn(),
}));

describe('RemoteLogger', () => {
    let mockSSHClient: jest.Mocked<SSHClient>;
    let remoteLogger: RemoteLogger;
    let config: RemoteLoggerConfig;

    beforeEach(() => {
        // Create mock SSH client
        mockSSHClient = {
            executeCommand: jest.fn(),
            uploadFile: jest.fn(),
            downloadFile: jest.fn(),
            isConnected: jest.fn().mockReturnValue(true),
        } as any;

        // Default config
        config = {
            logDirectory: '/var/log/deployment',
            maxLogSize: 1024 * 1024, // 1MB for testing
            maxLogFiles: 5,
            maxLogAge: 7,
            compressOldLogs: true,
        };

        remoteLogger = new RemoteLogger(mockSSHClient, config);
    });

    describe('initialize', () => {
        it('should create log directory on remote host', async () => {
            // Mock successful directory creation
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });

            await remoteLogger.initialize();

            // Verify directory creation command was called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('mkdir -p /var/log/deployment')
            );
        });

        it('should set correct permissions on log directory', async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });

            await remoteLogger.initialize();

            // Verify chmod command was called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('chmod 755 /var/log/deployment')
            );
        });

        it('should clean up old logs during initialization', async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });

            await remoteLogger.initialize();

            // Verify cleanup commands were called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('find')
            );
        });

        it('should throw error if directory creation fails', async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: 'Permission denied',
                exitCode: 1,
            });

            await expect(remoteLogger.initialize()).rejects.toThrow(
                'Remote logging initialization failed'
            );
        });
    });

    describe('writeLog', () => {
        beforeEach(async () => {
            // Initialize remote logger
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await remoteLogger.initialize();
        });

        it('should write log entry to remote host', async () => {
            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'info',
                message: 'Test log message',
                metadata: { key: 'value' },
            };

            // Mock successful write
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });

            const result = await remoteLogger.writeLog(entry);

            expect(result.success).toBe(true);
            expect(result.logFilePath).toBeDefined();
            expect(result.bytesWritten).toBeGreaterThan(0);
        });

        it('should format log entry as JSON', async () => {
            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'info',
                message: 'Test message',
            };

            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });

            await remoteLogger.writeLog(entry);

            // Verify JSON format in command
            const calls = jest.mocked(mockSSHClient.executeCommand).mock.calls;
            const writeCall = calls.find((call: any) => call[0].includes('echo') && call[0].includes('>>'));
            expect(writeCall).toBeDefined();
            expect(writeCall![0]).toContain('timestamp');
            expect(writeCall![0]).toContain('level');
            expect(writeCall![0]).toContain('message');
        });

        it('should handle write errors gracefully', async () => {
            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'error',
                message: 'Error message',
            };

            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: 'Write failed',
                exitCode: 1,
            });

            const result = await remoteLogger.writeLog(entry);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to write log');
        });

        it('should check for log rotation before writing', async () => {
            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'info',
                message: 'Test message',
            };

            // Mock large file size to trigger rotation
            let callCount = 0;
            jest.mocked(mockSSHClient.executeCommand).mockImplementation(async (cmd: string) => {
                callCount++;
                if (cmd.includes('stat')) {
                    // Return size larger than maxLogSize
                    return { stdout: '2000000', stderr: '', exitCode: 0 };
                }
                return { stdout: '', stderr: '', exitCode: 0 };
            });

            await remoteLogger.writeLog(entry);

            // Verify stat command was called to check size
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('stat')
            );
        });
    });

    describe('writeLogs', () => {
        beforeEach(async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await remoteLogger.initialize();
        });

        it('should write multiple log entries in batch', async () => {
            const entries: RemoteLogEntry[] = [
                {
                    timestamp: '2024-01-01T12:00:00.000Z',
                    level: 'info',
                    message: 'Message 1',
                },
                {
                    timestamp: '2024-01-01T12:00:01.000Z',
                    level: 'warn',
                    message: 'Message 2',
                },
                {
                    timestamp: '2024-01-01T12:00:02.000Z',
                    level: 'error',
                    message: 'Message 3',
                },
            ];

            const result = await remoteLogger.writeLogs(entries);

            expect(result.success).toBe(true);
            expect(result.bytesWritten).toBeGreaterThan(0);
        });

        it('should handle empty array gracefully', async () => {
            const result = await remoteLogger.writeLogs([]);

            expect(result.success).toBe(true);
            expect(result.bytesWritten).toBe(0);
        });

        it('should use heredoc for batch writes', async () => {
            const entries: RemoteLogEntry[] = [
                { timestamp: '2024-01-01T12:00:00.000Z', level: 'info', message: 'Test 1' },
                { timestamp: '2024-01-01T12:00:01.000Z', level: 'info', message: 'Test 2' },
            ];

            await remoteLogger.writeLogs(entries);

            // Verify heredoc syntax was used
            const calls = jest.mocked(mockSSHClient.executeCommand).mock.calls;
            const writeCall = calls.find((call: any) => call[0].includes('cat >>'));
            expect(writeCall).toBeDefined();
            expect(writeCall![0]).toContain('EOF');
        });
    });

    describe('uploadLogFile', () => {
        beforeEach(async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await remoteLogger.initialize();
        });

        it('should upload local log file to remote host', async () => {
            const localPath = '/local/logs/deployment.log';
            const fs = await import('fs');

            // Mock file exists and get size
            jest.mocked(fs.default.existsSync).mockReturnValue(true);
            jest.mocked(fs.default.statSync).mockReturnValue({
                size: 1024,
            } as any);

            jest.mocked(mockSSHClient.uploadFile).mockResolvedValue();

            const result = await remoteLogger.uploadLogFile(localPath);

            expect(result.success).toBe(true);
            expect(result.bytesWritten).toBe(1024);
            expect(mockSSHClient.uploadFile).toHaveBeenCalledWith(
                localPath,
                expect.stringContaining('deployment.log')
            );
        });

        it('should handle missing local file', async () => {
            const localPath = '/local/logs/missing.log';
            const fs = await import('fs');

            jest.mocked(fs.default.existsSync).mockReturnValue(false);

            const result = await remoteLogger.uploadLogFile(localPath);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should handle upload errors', async () => {
            const localPath = '/local/logs/deployment.log';
            const fs = await import('fs');

            jest.mocked(fs.default.existsSync).mockReturnValue(true);
            jest.mocked(fs.default.statSync).mockReturnValue({ size: 1024 } as any);
            jest.mocked(mockSSHClient.uploadFile).mockRejectedValue(
                new Error('Upload failed')
            );

            const result = await remoteLogger.uploadLogFile(localPath);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Upload failed');
        });
    });

    describe('log rotation', () => {
        beforeEach(async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await remoteLogger.initialize();
        });

        it('should rotate log when size exceeds limit', async () => {
            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'info',
                message: 'Test message',
            };

            // Mock file size check to return size over limit
            let callCount = 0;
            jest.mocked(mockSSHClient.executeCommand).mockImplementation(async (cmd: string) => {
                callCount++;
                if (cmd.includes('stat')) {
                    // Return size larger than maxLogSize (1MB)
                    return { stdout: '2000000', stderr: '', exitCode: 0 };
                }
                if (cmd.includes('mv')) {
                    // Log rotation command
                    return { stdout: '', stderr: '', exitCode: 0 };
                }
                return { stdout: '', stderr: '', exitCode: 0 };
            });

            await remoteLogger.writeLog(entry);

            // Verify rotation command was called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('mv')
            );
        });

        it('should compress rotated logs when configured', async () => {
            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'info',
                message: 'Test message',
            };

            // Mock file size check to trigger rotation
            jest.mocked(mockSSHClient.executeCommand).mockImplementation(async (cmd: string) => {
                if (cmd.includes('stat')) {
                    return { stdout: '2000000', stderr: '', exitCode: 0 };
                }
                return { stdout: '', stderr: '', exitCode: 0 };
            });

            await remoteLogger.writeLog(entry);

            // Verify gzip command was called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('gzip')
            );
        });

        it('should not compress rotated logs when disabled', async () => {
            // Create logger with compression disabled
            const noCompressConfig = { ...config, compressOldLogs: false };
            const noCompressLogger = new RemoteLogger(mockSSHClient, noCompressConfig);

            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await noCompressLogger.initialize();

            const entry: RemoteLogEntry = {
                timestamp: '2024-01-01T12:00:00.000Z',
                level: 'info',
                message: 'Test message',
            };

            // Mock file size check to trigger rotation
            jest.mocked(mockSSHClient.executeCommand).mockImplementation(async (cmd: string) => {
                if (cmd.includes('stat')) {
                    return { stdout: '2000000', stderr: '', exitCode: 0 };
                }
                return { stdout: '', stderr: '', exitCode: 0 };
            });

            await noCompressLogger.writeLog(entry);

            // Verify gzip command was NOT called
            const calls = jest.mocked(mockSSHClient.executeCommand).mock.calls;
            const gzipCall = calls.find((call: any) => call[0].includes('gzip'));
            expect(gzipCall).toBeUndefined();
        });
    });

    describe('log cleanup', () => {
        beforeEach(async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
        });

        it('should remove logs older than maxLogAge', async () => {
            await remoteLogger.initialize();

            // Verify find command with mtime was called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringMatching(/find.*-mtime \+7.*-delete/)
            );
        });

        it('should keep only maxLogFiles most recent logs', async () => {
            await remoteLogger.initialize();

            // Verify tail command with maxLogFiles was called
            expect(mockSSHClient.executeCommand).toHaveBeenCalledWith(
                expect.stringMatching(/tail -n \+6/)
            );
        });

        it('should handle cleanup errors gracefully', async () => {
            // Mock cleanup failure
            jest.mocked(mockSSHClient.executeCommand).mockImplementation(async (cmd: string) => {
                if (cmd.includes('find') || cmd.includes('tail')) {
                    return { stdout: '', stderr: 'Cleanup failed', exitCode: 1 };
                }
                return { stdout: '', stderr: '', exitCode: 0 };
            });

            // Should not throw error
            await expect(remoteLogger.initialize()).resolves.not.toThrow();
        });
    });

    describe('listLogFiles', () => {
        beforeEach(async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await remoteLogger.initialize();
        });

        it('should list all log files on remote host', async () => {
            const logFiles = [
                '/var/log/deployment/deployment-2024-01-01.log',
                '/var/log/deployment/deployment-2024-01-02.log',
                '/var/log/deployment/deployment-2024-01-03.log.gz',
            ];

            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: logFiles.join('\n'),
                stderr: '',
                exitCode: 0,
            });

            const result = await remoteLogger.listLogFiles();

            expect(result).toEqual(logFiles);
        });

        it('should return empty array on error', async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: 'Error',
                exitCode: 1,
            });

            const result = await remoteLogger.listLogFiles();

            expect(result).toEqual([]);
        });
    });

    describe('downloadLogFile', () => {
        beforeEach(async () => {
            jest.mocked(mockSSHClient.executeCommand).mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 0,
            });
            await remoteLogger.initialize();
        });

        it('should download log file from remote host', async () => {
            const remotePath = '/var/log/deployment/deployment.log';
            const localPath = '/local/logs/deployment.log';

            jest.mocked(mockSSHClient.downloadFile).mockResolvedValue();

            await remoteLogger.downloadLogFile(remotePath, localPath);

            expect(mockSSHClient.downloadFile).toHaveBeenCalledWith(remotePath, localPath);
        });

        it('should throw error on download failure', async () => {
            const remotePath = '/var/log/deployment/deployment.log';
            const localPath = '/local/logs/deployment.log';

            jest.mocked(mockSSHClient.downloadFile).mockRejectedValue(
                new Error('Download failed')
            );

            await expect(
                remoteLogger.downloadLogFile(remotePath, localPath)
            ).rejects.toThrow('Failed to download log file');
        });
    });

    describe('getters', () => {
        it('should return current log file path', () => {
            const logFile = remoteLogger.getCurrentLogFile();
            expect(logFile).toContain('/var/log/deployment/deployment-');
            expect(logFile).toContain('.log');
        });

        it('should return log directory path', () => {
            const logDir = remoteLogger.getLogDirectory();
            expect(logDir).toBe('/var/log/deployment');
        });
    });
});
