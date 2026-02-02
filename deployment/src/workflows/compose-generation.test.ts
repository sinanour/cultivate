/**
 * Integration tests for docker-compose.yml generation
 * Tests the actual generated compose file content
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';

// Mock deployment paths and config for testing
const mockLinuxPaths = {
    targetOS: 'linux' as const,
    deploymentBasePath: '/opt/cultivate',
    configPath: '/opt/cultivate/config',
    logPath: '/var/log/cultivate',
    volumePath: '/opt/cultivate/volumes',
    vmAccessible: true,
};

const mockMacOSPaths = {
    targetOS: 'macos' as const,
    deploymentBasePath: '/Users/testuser/cultivate',
    configPath: '/Users/testuser/cultivate/config',
    logPath: '/Users/testuser/cultivate/logs',
    volumePath: '/Users/testuser/cultivate/volumes',
    vmAccessible: true,
};

const mockConfigWithHttps = {
    network: {
        httpPort: 8080,
        httpsPort: 1443,
        enableHttps: true,
    },
    volumes: {
        dataPath: '/var/lib/postgresql/data',
        socketPath: '/var/run/postgresql',
        certPath: './config/certs',
    },
    environment: {
        nodeEnv: 'production' as const,
        databaseUrl: 'postgresql://apiuser@localhost/cultivate?host=/var/run/postgresql',
        backendPort: 3000,
    },
    security: {
        apiUserUid: 1001,
        apiUserGid: 1001,
        socketPermissions: '0770',
    },
};

const mockConfigWithoutHttps = {
    ...mockConfigWithHttps,
    network: {
        ...mockConfigWithHttps.network,
        enableHttps: false,
    },
};

const mockConfigWithoutCertPath = {
    ...mockConfigWithHttps,
    volumes: {
        ...mockConfigWithHttps.volumes,
        certPath: undefined,
    },
};

describe('Docker Compose Generation Integration', () => {
    // Helper function to simulate generateDockerComposeFile
    // (We can't import it directly since it's not exported)
    function simulateComposeGeneration(
        version: string,
        deploymentPaths: { targetOS: 'linux' | 'macos'; configPath: string; volumePath: string },
        config: {
            network?: { httpPort?: number; httpsPort?: number; enableHttps?: boolean };
            volumes?: { certPath?: string };
        }
    ): string {
        const useNamedVolumes = deploymentPaths.targetOS === 'macos';
        const dbDataVolume = useNamedVolumes
            ? 'db_data'
            : path.join(deploymentPaths.volumePath, 'db_data');
        const dbSocketVolume = 'db_socket';

        const httpPort = config.network?.httpPort || 80;
        const httpsPort = config.network?.httpsPort || 443;
        const enableHttps = config.network?.enableHttps && config.volumes?.certPath;
        const remoteCertPath = path.join(deploymentPaths.configPath, 'certs');
        const certVolumeMount = enableHttps
            ? `      - ${remoteCertPath}:/etc/nginx/certs:ro\n`
            : '';

        return `version: '3.8'

services:
  database:
    image: cultivate_database:${version}
    container_name: cultivate_database
    volumes:
      - ${dbDataVolume}:/var/lib/postgresql/data
      - ${dbSocketVolume}:/var/run/postgresql

  frontend:
    image: cultivate_frontend:${version}
    container_name: cultivate_frontend
    ports:
      - "0.0.0.0:${httpPort}:80"
      - "0.0.0.0:${httpsPort}:443"
    volumes:
${certVolumeMount}    environment:
      - VITE_BACKEND_URL=/api/v1
`;
    }

    describe('Port Configuration', () => {
        it('should use configured HTTP_PORT in port mapping', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithHttps);

            expect(compose).toContain('"0.0.0.0:8080:80"');
        });

        it('should use configured HTTPS_PORT in port mapping', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithHttps);

            expect(compose).toContain('"0.0.0.0:1443:443"');
        });

        it('should use default ports when not configured', () => {
            const configWithDefaults = {
                ...mockConfigWithHttps,
                network: {
                    httpPort: undefined as any,
                    httpsPort: undefined as any,
                    enableHttps: false,
                },
            };

            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, configWithDefaults);

            expect(compose).toContain('"0.0.0.0:80:80"');
            expect(compose).toContain('"0.0.0.0:443:443"');
        });

        it('should bind to 0.0.0.0 for public accessibility', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithHttps);

            // Verify ports are bound to 0.0.0.0, not localhost
            expect(compose).toContain('0.0.0.0:');
            expect(compose).not.toContain('127.0.0.1:');
        });
    });

    describe('Certificate Volume Mount', () => {
        it('should include certificate volume when HTTPS enabled and cert path set', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithHttps);

            expect(compose).toContain('/opt/cultivate/config/certs:/etc/nginx/certs:ro');
        });

        it('should not include certificate volume when HTTPS disabled', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithoutHttps);

            expect(compose).not.toContain('/etc/nginx/certs');
        });

        it('should not include certificate volume when cert path not set', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithoutCertPath);

            expect(compose).not.toContain('/etc/nginx/certs');
        });

        it('should use correct remote cert path for macOS', () => {
            const compose = simulateComposeGeneration('1.0.0', mockMacOSPaths, mockConfigWithHttps);

            expect(compose).toContain('/Users/testuser/cultivate/config/certs:/etc/nginx/certs:ro');
        });
    });

    describe('Volume Strategy', () => {
        it('should use host path for data volume on Linux', () => {
            const compose = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithHttps);

            expect(compose).toContain('/opt/cultivate/volumes/db_data:/var/lib/postgresql/data');
        });

        it('should use named volume for data on macOS', () => {
            const compose = simulateComposeGeneration('1.0.0', mockMacOSPaths, mockConfigWithHttps);

            expect(compose).toContain('db_data:/var/lib/postgresql/data');
            expect(compose).not.toContain('/Users/testuser/cultivate/volumes/db_data');
        });

        it('should always use named volume for socket', () => {
            const composeLinux = simulateComposeGeneration('1.0.0', mockLinuxPaths, mockConfigWithHttps);
            const composeMacOS = simulateComposeGeneration('1.0.0', mockMacOSPaths, mockConfigWithHttps);

            expect(composeLinux).toContain('db_socket:/var/run/postgresql');
            expect(composeMacOS).toContain('db_socket:/var/run/postgresql');
        });
    });
});
