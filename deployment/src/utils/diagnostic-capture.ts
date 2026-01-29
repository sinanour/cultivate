/**
 * Diagnostic Capture Module
 * 
 * Captures diagnostic information on deployment failures:
 * - Container logs
 * - Docker-compose logs
 * - System logs from target host
 * 
 * Requirements: 15.2, 15.3
 */

import { SSHClient } from './ssh-client.js';
import { ContainerDeployment } from './container-deployment.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Diagnostic information captured from a container
 */
export interface ContainerDiagnostics {
    /** Container name */
    containerName: string;

    /** Container logs */
    logs: string;

    /** Container state */
    state: string;

    /** Container health status */
    health: string;

    /** Timestamp when diagnostics were captured */
    timestamp: Date;
}

/**
 * Docker Compose diagnostics
 */
export interface ComposeDiagnostics {
    /** Docker Compose logs */
    logs: string;

    /** Docker Compose configuration */
    config?: string;

    /** Timestamp when diagnostics were captured */
    timestamp: Date;
}

/**
 * System diagnostics from target host
 */
export interface SystemDiagnostics {
    /** Docker daemon status */
    dockerStatus: string;

    /** Docker version */
    dockerVersion: string;

    /** System disk usage */
    diskUsage: string;

    /** System memory usage */
    memoryUsage: string;

    /** Recent system logs */
    systemLogs: string;

    /** Timestamp when diagnostics were captured */
    timestamp: Date;
}

/**
 * Complete diagnostic information
 */
export interface DiagnosticReport {
    /** Container diagnostics */
    containers: ContainerDiagnostics[];

    /** Docker Compose diagnostics */
    compose: ComposeDiagnostics;

    /** System diagnostics */
    system: SystemDiagnostics;

    /** Timestamp when report was generated */
    timestamp: Date;
}

/**
 * Options for diagnostic capture
 */
export interface DiagnosticCaptureOptions {
    /** Working directory containing docker-compose.yml */
    workingDirectory: string;

    /** Number of log lines to capture per container */
    logLines?: number;

    /** Whether to capture system logs */
    captureSystemLogs?: boolean;

    /** Whether to capture docker-compose config */
    captureComposeConfig?: boolean;
}

/**
 * Diagnostic Capture
 * Captures diagnostic information for troubleshooting deployment failures
 */
export class DiagnosticCapture {
    private sshClient: SSHClient;
    private containerDeployment: ContainerDeployment;
    private readonly DEFAULT_LOG_LINES = 100;

    constructor(sshClient: SSHClient, containerDeployment: ContainerDeployment) {
        this.sshClient = sshClient;
        this.containerDeployment = containerDeployment;
    }

    /**
     * Capture complete diagnostic report
     * 
     * @param options - Diagnostic capture options
     * @returns Complete diagnostic report
     */
    async captureDiagnostics(
        options: DiagnosticCaptureOptions
    ): Promise<DiagnosticReport> {
        logger.info('Capturing diagnostic information...');

        const timestamp = new Date();

        try {
            // Capture container diagnostics
            const containers = await this.captureContainerDiagnostics(
                options.workingDirectory,
                options.logLines || this.DEFAULT_LOG_LINES
            );

            // Capture docker-compose diagnostics
            const compose = await this.captureComposeDiagnostics(
                options.workingDirectory,
                options.captureComposeConfig !== false
            );

            // Capture system diagnostics
            const system = await this.captureSystemDiagnostics(
                options.captureSystemLogs !== false
            );

            logger.info('Diagnostic capture completed');

            return {
                containers,
                compose,
                system,
                timestamp,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to capture diagnostics: ${errorMessage}`);

            // Return partial diagnostics
            return {
                containers: [],
                compose: {
                    logs: `Error capturing compose logs: ${errorMessage}`,
                    timestamp: new Date(),
                },
                system: {
                    dockerStatus: 'unknown',
                    dockerVersion: 'unknown',
                    diskUsage: 'unknown',
                    memoryUsage: 'unknown',
                    systemLogs: `Error capturing system logs: ${errorMessage}`,
                    timestamp: new Date(),
                },
                timestamp,
            };
        }
    }

    /**
     * Capture diagnostics for all containers
     * 
     * @param workingDirectory - Working directory containing docker-compose.yml
     * @param logLines - Number of log lines to capture
     * @returns Array of container diagnostics
     */
    async captureContainerDiagnostics(
        workingDirectory: string,
        logLines: number = this.DEFAULT_LOG_LINES
    ): Promise<ContainerDiagnostics[]> {
        logger.info('Capturing container diagnostics...');

        try {
            // Get container status
            const containers = await this.containerDeployment.getContainerStatus(
                workingDirectory
            );

            if (containers.length === 0) {
                logger.warn('No containers found for diagnostics');
                return [];
            }

            // Capture logs for each container
            const diagnostics: ContainerDiagnostics[] = [];

            for (const container of containers) {
                try {
                    const containerLogs = await this.containerDeployment.captureContainerLogs(
                        container.name,
                        workingDirectory,
                        logLines
                    );

                    diagnostics.push({
                        containerName: container.name,
                        logs: containerLogs.logs,
                        state: container.state,
                        health: container.health,
                        timestamp: containerLogs.timestamp,
                    });

                    logger.info(`Captured diagnostics for ${container.name}`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed to capture logs for ${container.name}: ${errorMessage}`);

                    diagnostics.push({
                        containerName: container.name,
                        logs: `Error capturing logs: ${errorMessage}`,
                        state: container.state,
                        health: container.health,
                        timestamp: new Date(),
                    });
                }
            }

            return diagnostics;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to capture container diagnostics: ${errorMessage}`);
            return [];
        }
    }

    /**
     * Capture docker-compose diagnostics
     * 
     * @param workingDirectory - Working directory containing docker-compose.yml
     * @param captureConfig - Whether to capture docker-compose config
     * @returns Docker Compose diagnostics
     */
    async captureComposeDiagnostics(
        workingDirectory: string,
        captureConfig: boolean = true
    ): Promise<ComposeDiagnostics> {
        logger.info('Capturing docker-compose diagnostics...');

        try {
            // Capture docker-compose logs
            const logsCmd = `cd ${workingDirectory} && docker-compose logs --tail=100`;
            const logsResult = await this.sshClient.executeCommand(logsCmd);

            let config: string | undefined;

            // Capture docker-compose config if requested
            if (captureConfig) {
                try {
                    const configCmd = `cd ${workingDirectory} && docker-compose config`;
                    const configResult = await this.sshClient.executeCommand(configCmd);
                    config = configResult.stdout;
                } catch (error) {
                    logger.warn(`Failed to capture docker-compose config: ${error}`);
                }
            }

            return {
                logs: logsResult.stdout || logsResult.stderr || 'No logs available',
                config,
                timestamp: new Date(),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to capture docker-compose diagnostics: ${errorMessage}`);

            return {
                logs: `Error capturing docker-compose logs: ${errorMessage}`,
                timestamp: new Date(),
            };
        }
    }

    /**
     * Capture system diagnostics from target host
     * 
     * @param captureSystemLogs - Whether to capture system logs
     * @returns System diagnostics
     */
    async captureSystemDiagnostics(
        captureSystemLogs: boolean = true
    ): Promise<SystemDiagnostics> {
        logger.info('Capturing system diagnostics...');

        try {
            // Capture Docker daemon status
            const dockerStatus = await this.captureDockerStatus();

            // Capture Docker version
            const dockerVersion = await this.captureDockerVersion();

            // Capture disk usage
            const diskUsage = await this.captureDiskUsage();

            // Capture memory usage
            const memoryUsage = await this.captureMemoryUsage();

            // Capture system logs if requested
            let systemLogs = 'System logs not captured';
            if (captureSystemLogs) {
                systemLogs = await this.captureSystemLogs();
            }

            return {
                dockerStatus,
                dockerVersion,
                diskUsage,
                memoryUsage,
                systemLogs,
                timestamp: new Date(),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to capture system diagnostics: ${errorMessage}`);

            return {
                dockerStatus: 'unknown',
                dockerVersion: 'unknown',
                diskUsage: 'unknown',
                memoryUsage: 'unknown',
                systemLogs: `Error capturing system logs: ${errorMessage}`,
                timestamp: new Date(),
            };
        }
    }

    /**
     * Capture Docker daemon status
     * 
     * @returns Docker daemon status
     */
    private async captureDockerStatus(): Promise<string> {
        try {
            const result = await this.sshClient.executeCommand('systemctl status docker');
            return result.stdout || result.stderr || 'Docker status unavailable';
        } catch (error) {
            logger.warn(`Failed to capture Docker status: ${error}`);
            return 'Docker status unavailable';
        }
    }

    /**
     * Capture Docker version
     * 
     * @returns Docker version
     */
    private async captureDockerVersion(): Promise<string> {
        try {
            const result = await this.sshClient.executeCommand('docker --version');
            return result.stdout.trim() || 'Docker version unavailable';
        } catch (error) {
            logger.warn(`Failed to capture Docker version: ${error}`);
            return 'Docker version unavailable';
        }
    }

    /**
     * Capture disk usage
     * 
     * @returns Disk usage information
     */
    private async captureDiskUsage(): Promise<string> {
        try {
            const result = await this.sshClient.executeCommand('df -h /');
            return result.stdout || 'Disk usage unavailable';
        } catch (error) {
            logger.warn(`Failed to capture disk usage: ${error}`);
            return 'Disk usage unavailable';
        }
    }

    /**
     * Capture memory usage
     * 
     * @returns Memory usage information
     */
    private async captureMemoryUsage(): Promise<string> {
        try {
            const result = await this.sshClient.executeCommand('free -h');
            return result.stdout || 'Memory usage unavailable';
        } catch (error) {
            logger.warn(`Failed to capture memory usage: ${error}`);
            return 'Memory usage unavailable';
        }
    }

    /**
     * Capture system logs
     * 
     * @returns Recent system logs
     */
    private async captureSystemLogs(): Promise<string> {
        try {
            // Try to get recent system logs using journalctl
            const result = await this.sshClient.executeCommand(
                'journalctl -n 100 --no-pager'
            );
            return result.stdout || 'System logs unavailable';
        } catch (error) {
            logger.warn(`Failed to capture system logs: ${error}`);

            // Fallback to /var/log/syslog if journalctl is not available
            try {
                const fallbackResult = await this.sshClient.executeCommand(
                    'tail -n 100 /var/log/syslog'
                );
                return fallbackResult.stdout || 'System logs unavailable';
            } catch (fallbackError) {
                return 'System logs unavailable';
            }
        }
    }

    /**
     * Format diagnostic report as human-readable text
     * 
     * @param report - Diagnostic report
     * @returns Formatted diagnostic report
     */
    formatDiagnosticReport(report: DiagnosticReport): string {
        const lines: string[] = [];

        lines.push('='.repeat(80));
        lines.push('DIAGNOSTIC REPORT');
        lines.push(`Generated: ${report.timestamp.toISOString()}`);
        lines.push('='.repeat(80));
        lines.push('');

        // Container diagnostics
        lines.push('CONTAINER DIAGNOSTICS');
        lines.push('-'.repeat(80));
        if (report.containers.length === 0) {
            lines.push('No containers found');
        } else {
            for (const container of report.containers) {
                lines.push(`\nContainer: ${container.containerName}`);
                lines.push(`State: ${container.state}`);
                lines.push(`Health: ${container.health}`);
                lines.push(`Logs (last ${this.DEFAULT_LOG_LINES} lines):`);
                lines.push(container.logs);
                lines.push('-'.repeat(40));
            }
        }
        lines.push('');

        // Docker Compose diagnostics
        lines.push('DOCKER COMPOSE DIAGNOSTICS');
        lines.push('-'.repeat(80));
        lines.push('Logs:');
        lines.push(report.compose.logs);
        if (report.compose.config) {
            lines.push('\nConfiguration:');
            lines.push(report.compose.config);
        }
        lines.push('');

        // System diagnostics
        lines.push('SYSTEM DIAGNOSTICS');
        lines.push('-'.repeat(80));
        lines.push(`Docker Status:\n${report.system.dockerStatus}`);
        lines.push(`\nDocker Version: ${report.system.dockerVersion}`);
        lines.push(`\nDisk Usage:\n${report.system.diskUsage}`);
        lines.push(`\nMemory Usage:\n${report.system.memoryUsage}`);
        lines.push(`\nSystem Logs:\n${report.system.systemLogs}`);
        lines.push('');

        lines.push('='.repeat(80));
        lines.push('END OF DIAGNOSTIC REPORT');
        lines.push('='.repeat(80));

        return lines.join('\n');
    }

    /**
     * Save diagnostic report to file on target host
     * 
     * @param report - Diagnostic report
     * @param filePath - Path to save report
     * @returns Promise that resolves when report is saved
     */
    async saveDiagnosticReport(
        report: DiagnosticReport,
        filePath: string
    ): Promise<void> {
        logger.info(`Saving diagnostic report to ${filePath}...`);

        try {
            const formattedReport = this.formatDiagnosticReport(report);

            // Create a temporary local file
            const tempFile = `/tmp/diagnostic-report-${Date.now()}.txt`;
            const fs = await import('fs/promises');
            await fs.writeFile(tempFile, formattedReport);

            // Upload to target host
            await this.sshClient.uploadFile(tempFile, filePath);

            // Clean up temporary file
            await fs.unlink(tempFile);

            logger.info(`Diagnostic report saved to ${filePath}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to save diagnostic report: ${errorMessage}`);
            throw error;
        }
    }
}

/**
 * Create a diagnostic capture instance
 * 
 * @param sshClient - SSH client
 * @param containerDeployment - Container deployment instance
 * @returns Diagnostic capture instance
 */
export function createDiagnosticCapture(
    sshClient: SSHClient,
    containerDeployment: ContainerDeployment
): DiagnosticCapture {
    return new DiagnosticCapture(sshClient, containerDeployment);
}
