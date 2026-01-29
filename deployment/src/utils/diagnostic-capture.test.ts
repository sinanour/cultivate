/**
 * Unit tests for Diagnostic Capture Module
 */

import { DiagnosticCapture, createDiagnosticCapture } from './diagnostic-capture';
import { SSHClient } from './ssh-client';
import { ContainerDeployment, ContainerStatus } from './container-deployment';

// Mock dependencies
jest.mock('./logger.js', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    })),
}));

describe('DiagnosticCapture', () => {
    let sshClient: SSHClient;
    let containerDeployment: ContainerDeployment;
    let diagnosticCapture: DiagnosticCapture;

    beforeEach(() => {
        // Create mock instances
        sshClient = {
            executeCommand: jest.fn(),
            uploadFile: jest.fn(),
        } as unknown as SSHClient;

        containerDeployment = {
            getContainerStatus: jest.fn(),
            captureContainerLogs: jest.fn(),
        } as unknown as ContainerDeployment;

        diagnosticCapture = new DiagnosticCapture(sshClient, containerDeployment);
    });

    describe('captureContainerDiagnostics', () => {
        it('should capture diagnostics for all containers', async () => {
            const containers: ContainerStatus[] = [
                {
                    name: 'container1',
                    state: 'running',
                    health: 'healthy',
                    uptime: '5m',
                },
                {
                    name: 'container2',
                    state: 'running',
                    health: 'healthy',
                    uptime: '5m',
                },
            ];

            (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
                containers
            );

            (containerDeployment.captureContainerLogs as jest.Mock).mockResolvedValue({
                containerName: 'test',
                logs: 'test logs',
                timestamp: new Date(),
            });

            const result = await diagnosticCapture.captureContainerDiagnostics(
                '/opt/test',
                100
            );

            expect(result).toHaveLength(2);
            expect(result[0].containerName).toBe('container1');
            expect(result[1].containerName).toBe('container2');
            expect(containerDeployment.captureContainerLogs).toHaveBeenCalledTimes(2);
        });

        it('should return empty array when no containers found', async () => {
            (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue([]);

            const result = await diagnosticCapture.captureContainerDiagnostics(
                '/opt/test'
            );

            expect(result).toHaveLength(0);
        });

        it('should handle errors when capturing container logs', async () => {
            const containers: ContainerStatus[] = [
                {
                    name: 'container1',
                    state: 'running',
                    health: 'healthy',
                    uptime: '5m',
                },
            ];

            (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
                containers
            );

            (containerDeployment.captureContainerLogs as jest.Mock).mockRejectedValue(
                new Error('Failed to capture logs')
            );

            const result = await diagnosticCapture.captureContainerDiagnostics(
                '/opt/test'
            );

            expect(result).toHaveLength(1);
            expect(result[0].logs).toContain('Error capturing logs');
        });

        it('should handle errors when getting container status', async () => {
            (containerDeployment.getContainerStatus as jest.Mock).mockRejectedValue(
                new Error('Docker daemon not running')
            );

            const result = await diagnosticCapture.captureContainerDiagnostics(
                '/opt/test'
            );

            expect(result).toHaveLength(0);
        });
    });

    describe('captureComposeDiagnostics', () => {
        it('should capture docker-compose logs', async () => {
            (sshClient.executeCommand as jest.Mock).mockResolvedValue({
                stdout: 'compose logs',
                stderr: '',
                exitCode: 0,
            });

            const result = await diagnosticCapture.captureComposeDiagnostics(
                '/opt/test',
                false
            );

            expect(result.logs).toBe('compose logs');
            expect(result.config).toBeUndefined();
        });

        it('should capture docker-compose config when requested', async () => {
            (sshClient.executeCommand as jest.Mock)
                .mockResolvedValueOnce({
                    stdout: 'compose logs',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'compose config',
                    stderr: '',
                    exitCode: 0,
                });

            const result = await diagnosticCapture.captureComposeDiagnostics(
                '/opt/test',
                true
            );

            expect(result.logs).toBe('compose logs');
            expect(result.config).toBe('compose config');
        });

        it('should handle errors when capturing compose logs', async () => {
            (sshClient.executeCommand as jest.Mock).mockRejectedValue(
                new Error('Command failed')
            );

            const result = await diagnosticCapture.captureComposeDiagnostics(
                '/opt/test'
            );

            expect(result.logs).toContain('Error capturing docker-compose logs');
        });

        it('should continue if config capture fails', async () => {
            (sshClient.executeCommand as jest.Mock)
                .mockResolvedValueOnce({
                    stdout: 'compose logs',
                    stderr: '',
                    exitCode: 0,
                })
                .mockRejectedValueOnce(new Error('Config failed'));

            const result = await diagnosticCapture.captureComposeDiagnostics(
                '/opt/test',
                true
            );

            expect(result.logs).toBe('compose logs');
            expect(result.config).toBeUndefined();
        });
    });

    describe('captureSystemDiagnostics', () => {
        it('should capture all system diagnostics', async () => {
            (sshClient.executeCommand as jest.Mock)
                .mockResolvedValueOnce({
                    stdout: 'docker status',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'Docker version 20.10.0',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'disk usage',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'memory usage',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'system logs',
                    stderr: '',
                    exitCode: 0,
                });

            const result = await diagnosticCapture.captureSystemDiagnostics(true);

            expect(result.dockerStatus).toBe('docker status');
            expect(result.dockerVersion).toBe('Docker version 20.10.0');
            expect(result.diskUsage).toBe('disk usage');
            expect(result.memoryUsage).toBe('memory usage');
            expect(result.systemLogs).toBe('system logs');
        });

        it('should skip system logs when not requested', async () => {
            (sshClient.executeCommand as jest.Mock)
                .mockResolvedValueOnce({
                    stdout: 'docker status',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'Docker version 20.10.0',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'disk usage',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'memory usage',
                    stderr: '',
                    exitCode: 0,
                });

            const result = await diagnosticCapture.captureSystemDiagnostics(false);

            expect(result.systemLogs).toBe('System logs not captured');
            expect(sshClient.executeCommand).toHaveBeenCalledTimes(4);
        });

        it('should handle errors gracefully', async () => {
            (sshClient.executeCommand as jest.Mock).mockRejectedValue(
                new Error('Command failed')
            );

            const result = await diagnosticCapture.captureSystemDiagnostics(true);

            expect(result.dockerStatus).toBe('Docker status unavailable');
            expect(result.dockerVersion).toBe('Docker version unavailable');
            expect(result.diskUsage).toBe('Disk usage unavailable');
            expect(result.memoryUsage).toBe('Memory usage unavailable');
            expect(result.systemLogs).toBe('System logs unavailable');
        });
    });

    describe('captureDiagnostics', () => {
        it('should capture complete diagnostic report', async () => {
            const containers: ContainerStatus[] = [
                {
                    name: 'container1',
                    state: 'running',
                    health: 'healthy',
                    uptime: '5m',
                },
            ];

            (containerDeployment.getContainerStatus as jest.Mock).mockResolvedValue(
                containers
            );

            (containerDeployment.captureContainerLogs as jest.Mock).mockResolvedValue({
                containerName: 'container1',
                logs: 'test logs',
                timestamp: new Date(),
            });

            (sshClient.executeCommand as jest.Mock)
                .mockResolvedValueOnce({
                    stdout: 'compose logs',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'compose config',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'docker status',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'Docker version 20.10.0',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'disk usage',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'memory usage',
                    stderr: '',
                    exitCode: 0,
                })
                .mockResolvedValueOnce({
                    stdout: 'system logs',
                    stderr: '',
                    exitCode: 0,
                });

            const result = await diagnosticCapture.captureDiagnostics({
                workingDirectory: '/opt/test',
                logLines: 100,
                captureSystemLogs: true,
                captureComposeConfig: true,
            });

            expect(result.containers).toHaveLength(1);
            expect(result.compose.logs).toBe('compose logs');
            expect(result.compose.config).toBe('compose config');
            expect(result.system.dockerVersion).toBe('Docker version 20.10.0');
        });

        it('should return partial diagnostics on error', async () => {
            (containerDeployment.getContainerStatus as jest.Mock).mockRejectedValue(
                new Error('Failed to get containers')
            );

            const result = await diagnosticCapture.captureDiagnostics({
                workingDirectory: '/opt/test',
            });

            expect(result.containers).toHaveLength(0);
            expect(result.compose.logs).toContain('Error capturing docker-compose logs');
            expect(result.system.dockerStatus).toBe('Docker status unavailable');
        });
    });

    describe('formatDiagnosticReport', () => {
        it('should format diagnostic report as text', () => {
            const report = {
                containers: [
                    {
                        containerName: 'container1',
                        logs: 'test logs',
                        state: 'running',
                        health: 'healthy',
                        timestamp: new Date(),
                    },
                ],
                compose: {
                    logs: 'compose logs',
                    config: 'compose config',
                    timestamp: new Date(),
                },
                system: {
                    dockerStatus: 'running',
                    dockerVersion: 'Docker version 20.10.0',
                    diskUsage: '50% used',
                    memoryUsage: '2GB used',
                    systemLogs: 'system logs',
                    timestamp: new Date(),
                },
                timestamp: new Date(),
            };

            const formatted = diagnosticCapture.formatDiagnosticReport(report);

            expect(formatted).toContain('DIAGNOSTIC REPORT');
            expect(formatted).toContain('CONTAINER DIAGNOSTICS');
            expect(formatted).toContain('container1');
            expect(formatted).toContain('DOCKER COMPOSE DIAGNOSTICS');
            expect(formatted).toContain('SYSTEM DIAGNOSTICS');
            expect(formatted).toContain('Docker version 20.10.0');
        });

        it('should handle empty containers', () => {
            const report = {
                containers: [],
                compose: {
                    logs: 'compose logs',
                    timestamp: new Date(),
                },
                system: {
                    dockerStatus: 'running',
                    dockerVersion: 'Docker version 20.10.0',
                    diskUsage: '50% used',
                    memoryUsage: '2GB used',
                    systemLogs: 'system logs',
                    timestamp: new Date(),
                },
                timestamp: new Date(),
            };

            const formatted = diagnosticCapture.formatDiagnosticReport(report);

            expect(formatted).toContain('No containers found');
        });
    });

    describe('createDiagnosticCapture', () => {
        it('should create a diagnostic capture instance', () => {
            const instance = createDiagnosticCapture(sshClient, containerDeployment);

            expect(instance).toBeInstanceOf(DiagnosticCapture);
        });
    });
});
