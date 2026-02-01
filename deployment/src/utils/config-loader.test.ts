import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigLoader } from './config-loader.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ConfigLoader', () => {
    let tempDir: string;
    let testEnvPath: string;

    beforeEach(async () => {
        // Create temporary directory for test files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-loader-test-'));
        testEnvPath = path.join(tempDir, '.env');
    });

    afterEach(async () => {
        // Clean up temporary directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    describe('loadFromEnvFile', () => {
        it('should load configuration from valid .env file', async () => {
            const envContent = `
HTTP_PORT=8080
HTTPS_PORT=1443
ENABLE_HTTPS=true
NODE_ENV=production
BACKEND_PORT=3000
API_USER_UID=1001
API_USER_GID=1001
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);

            expect(config.network.httpPort).toBe(8080);
            expect(config.network.httpsPort).toBe(1443);
            expect(config.network.enableHttps).toBe(true);
            expect(config.environment.nodeEnv).toBe('production');
            expect(config.environment.backendPort).toBe(3000);
            expect(config.security.apiUserUid).toBe(1001);
            expect(config.security.apiUserGid).toBe(1001);
        });

        it('should handle quoted values', async () => {
            const envContent = `
HTTP_PORT="8080"
NODE_ENV='production'
CERT_PATH="/path/to/certs"
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);

            expect(config.network.httpPort).toBe(8080);
            expect(config.environment.nodeEnv).toBe('production');
            expect(config.volumes.certPath).toBe('/path/to/certs');
        });

        it('should skip comments and empty lines', async () => {
            const envContent = `
# This is a comment
HTTP_PORT=8080

# Another comment
HTTPS_PORT=1443

`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);

            expect(config.network.httpPort).toBe(8080);
            expect(config.network.httpsPort).toBe(1443);
        });

        it('should apply defaults for missing optional values', async () => {
            const envContent = `
# Minimal configuration
NODE_ENV=production
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);

            expect(config.network.httpPort).toBe(80); // Default
            expect(config.network.httpsPort).toBe(443); // Default
            expect(config.network.enableHttps).toBe(false); // Default
            expect(config.environment.backendPort).toBe(3000); // Default
            expect(config.security.apiUserUid).toBe(1001); // Default
        });

        it('should handle boolean values correctly', async () => {
            const envContent = `
ENABLE_HTTPS=true
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);
            expect(config.network.enableHttps).toBe(true);

            const envContent2 = `
ENABLE_HTTPS=false
`;
            await fs.writeFile(testEnvPath, envContent2);

            const config2 = await ConfigLoader.loadFromEnvFile(testEnvPath);
            expect(config2.network.enableHttps).toBe(false);
        });

        it('should throw error if file does not exist', async () => {
            const nonExistentPath = path.join(tempDir, 'nonexistent.env');

            await expect(ConfigLoader.loadFromEnvFile(nonExistentPath))
                .rejects
                .toThrow(/Failed to load configuration/);
        });

        it('should handle certificate path', async () => {
            const envContent = `
CERT_PATH=/etc/letsencrypt/live/example.com/
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);

            expect(config.volumes.certPath).toBe('/etc/letsencrypt/live/example.com/');
        });

        it('should handle missing certificate path', async () => {
            const envContent = `
HTTP_PORT=80
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadFromEnvFile(testEnvPath);

            expect(config.volumes.certPath).toBeUndefined();
        });
    });

    describe('loadWithDefaults', () => {
        it('should load configuration with all defaults applied', async () => {
            const envContent = `
# Empty configuration
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadWithDefaults(testEnvPath);

            expect(config.network.httpPort).toBe(80);
            expect(config.network.httpsPort).toBe(443);
            expect(config.network.enableHttps).toBe(false);
            expect(config.environment.nodeEnv).toBe('production');
            expect(config.environment.backendPort).toBe(3000);
            expect(config.security.apiUserUid).toBe(1001);
            expect(config.security.apiUserGid).toBe(1001);
            expect(config.security.socketPermissions).toBe('0770');
        });

        it('should override defaults with provided values', async () => {
            const envContent = `
HTTP_PORT=8080
HTTPS_PORT=1443
ENABLE_HTTPS=true
NODE_ENV=staging
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadWithDefaults(testEnvPath);

            expect(config.network.httpPort).toBe(8080);
            expect(config.network.httpsPort).toBe(1443);
            expect(config.network.enableHttps).toBe(true);
            expect(config.environment.nodeEnv).toBe('staging');
            // Defaults still applied for unspecified values
            expect(config.environment.backendPort).toBe(3000);
        });
    });

    describe('validateRequired', () => {
        it('should validate complete configuration', () => {
            const config = {
                network: {
                    httpPort: 80,
                    httpsPort: 443,
                    enableHttps: false,
                },
                volumes: {
                    dataPath: '/data',
                    socketPath: '/socket',
                },
                environment: {
                    nodeEnv: 'production' as const,
                    databaseUrl: 'postgresql://user@localhost/db',
                    backendPort: 3000,
                },
                security: {
                    apiUserUid: 1001,
                    apiUserGid: 1001,
                    socketPermissions: '0770',
                },
            };

            const result = ConfigLoader.validateRequired(config);

            expect(result.valid).toBe(true);
            expect(result.missing).toHaveLength(0);
        });

        it('should detect missing required values', () => {
            const config = {
                network: {
                    httpPort: 0, // Invalid
                    httpsPort: 443,
                    enableHttps: false,
                },
                volumes: {
                    dataPath: '/data',
                    socketPath: '/socket',
                },
                environment: {
                    nodeEnv: '' as any, // Invalid
                    databaseUrl: 'postgresql://user@localhost/db',
                    backendPort: 3000,
                },
                security: {
                    apiUserUid: 0, // Invalid
                    apiUserGid: 1001,
                    socketPermissions: '0770',
                },
            };

            const result = ConfigLoader.validateRequired(config);

            expect(result.valid).toBe(false);
            expect(result.missing).toContain('HTTP_PORT');
            expect(result.missing).toContain('NODE_ENV');
            expect(result.missing).toContain('API_USER_UID');
        });
    });

    describe('Integration', () => {
        it('should handle complete production configuration', async () => {
            const envContent = `
# Production Configuration
HTTP_PORT=80
HTTPS_PORT=443
ENABLE_HTTPS=true
CERT_PATH=/etc/letsencrypt/live/example.com/

# Database
POSTGRES_USER=apiuser
POSTGRES_DB=cultivate

# Backend
NODE_ENV=production
BACKEND_PORT=3000

# Security
API_USER_UID=1001
API_USER_GID=1001
SOCKET_PERMISSIONS=0770
`;
            await fs.writeFile(testEnvPath, envContent);

            const config = await ConfigLoader.loadWithDefaults(testEnvPath);
            const validation = ConfigLoader.validateRequired(config);

            expect(validation.valid).toBe(true);
            expect(config.network.httpPort).toBe(80);
            expect(config.network.httpsPort).toBe(443);
            expect(config.network.enableHttps).toBe(true);
            expect(config.volumes.certPath).toBe('/etc/letsencrypt/live/example.com/');
            expect(config.environment.nodeEnv).toBe('production');
        });
    });
});
