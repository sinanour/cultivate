/**
 * Tests for Finch Network Configuration Module
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FinchNetworkConfig, PortForwardConfig } from './finch-network-config';
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

describe('FinchNetworkConfig', () => {
    let mockSSHClient: jest.Mocked<SSHClient>;
    let finchNetworkConfig: FinchNetworkConfig;

    beforeEach(() => {
        mockSSHClient = {
            executeCommand: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            verifyConnection: jest.fn(),
            isConnected: jest.fn(),
            getConnectionInfo: jest.fn(),
            uploadFile: jest.fn(),
            downloadFile: jest.fn(),
            executeCommandSimple: jest.fn(),
        } as any;

        finchNetworkConfig = new FinchNetworkConfig(mockSSHClient);
    });

    describe('checkPortForwarding', () => {
        const testPorts: PortForwardConfig[] = [
            { guestPort: 80, hostIP: '0.0.0.0', hostPort: 8080 },
            { guestPort: 443, hostIP: '0.0.0.0', hostPort: 1443 },
        ];

        it('should detect when port forwarding is configured correctly', async () => {
            mockSSHClient.executeCommand
                // Get home directory
                .mockResolvedValueOnce({
                    stdout: '/Users/testuser',
                    stderr: '',
                    exitCode: 0,
                })
                // Check if config exists
                .mockResolvedValueOnce({
                    stdout: 'exists',
                    stderr: '',
                    exitCode: 0,
                })
                // Read config file
                .mockResolvedValueOnce({
                    stdout: `portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
  - guestPort: 443
    hostIP: "0.0.0.0"
    hostPort: 1443`,
                    stderr: '',
                    exitCode: 0,
                });

            const result = await finchNetworkConfig.checkPortForwarding(testPorts);

            expect(result.configured).toBe(true);
            expect(result.needsRestart).toBe(false);
            expect(result.error).toBeUndefined();
        });

        it('should detect when port forwarding is not configured', async () => {
            mockSSHClient.executeCommand
                // Get home directory
                .mockResolvedValueOnce({
                    stdout: '/Users/testuser',
                    stderr: '',
                    exitCode: 0,
                })
                // Check if config exists
                .mockResolvedValueOnce({
                    stdout: 'exists',
                    stderr: '',
                    exitCode: 0,
                })
                // Read config file (no port forwards)
                .mockResolvedValueOnce({
                    stdout: `cpus: 4
memory: 4GiB`,
                    stderr: '',
                    exitCode: 0,
                });

            const result = await finchNetworkConfig.checkPortForwarding(testPorts);

            expect(result.configured).toBe(false);
            expect(result.needsRestart).toBe(true);
            expect(result.error).toContain('Port forwarding not configured');
        });

        it('should handle missing config file', async () => {
            mockSSHClient.executeCommand
                // Get home directory
                .mockResolvedValueOnce({
                    stdout: '/Users/testuser',
                    stderr: '',
                    exitCode: 0,
                })
                // Check if config exists
                .mockResolvedValueOnce({
                    stdout: 'missing',
                    stderr: '',
                    exitCode: 0,
                });

            const result = await finchNetworkConfig.checkPortForwarding(testPorts);

            expect(result.configured).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('generateFinchConfig', () => {
        const testPorts: PortForwardConfig[] = [
            { guestPort: 80, hostIP: '0.0.0.0', hostPort: 8080 },
        ];

        it('should generate config with port forwarding', () => {
            const config = finchNetworkConfig.generateFinchConfig(testPorts);

            expect(config).toContain('portForwards:');
            expect(config).toContain('guestPort: 80');
            expect(config).toContain('hostIP: "0.0.0.0"');
            expect(config).toContain('hostPort: 8080');
        });

        it('should preserve existing config', () => {
            const existingConfig = `cpus: 8
memory: 8GiB
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
`;

            const config = finchNetworkConfig.generateFinchConfig(testPorts, existingConfig);

            expect(config).toContain('cpus: 8');
            expect(config).toContain('memory: 8GiB');
            expect(config).toContain('guestPort: 80');
        });

        it('should not duplicate existing port forwards', () => {
            const existingConfig = `portForwards:
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
`;

            const config = finchNetworkConfig.generateFinchConfig(testPorts, existingConfig);

            // Count occurrences of guestPort: 80
            const matches = config.match(/guestPort: 80/g);
            expect(matches).toHaveLength(1);
        });
    });

    describe('getConfigurationInstructions', () => {
        const testPorts: PortForwardConfig[] = [
            { guestPort: 80, hostIP: '0.0.0.0', hostPort: 8080 },
            { guestPort: 443, hostIP: '0.0.0.0', hostPort: 1443 },
        ];

        it('should generate helpful instructions', () => {
            const instructions = finchNetworkConfig.getConfigurationInstructions(testPorts);

            expect(instructions).toContain('Finch Port Forwarding Configuration Required');
            expect(instructions).toContain('~/.finch/finch.yaml');
            expect(instructions).toContain('guestPort: 80');
            expect(instructions).toContain('hostPort: 8080');
            expect(instructions).toContain('finch vm stop');
            expect(instructions).toContain('finch vm start');
        });

        it('should include all configured ports', () => {
            const instructions = finchNetworkConfig.getConfigurationInstructions(testPorts);

            expect(instructions).toContain('guestPort: 80');
            expect(instructions).toContain('hostPort: 8080');
            expect(instructions).toContain('guestPort: 443');
            expect(instructions).toContain('hostPort: 1443');
        });
    });
});
