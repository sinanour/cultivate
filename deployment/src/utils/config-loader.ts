import * as fs from 'fs/promises';
import { createLogger } from './logger.js';
import { DeploymentConfiguration } from '../types/deployment.js';

const logger = createLogger();

/**
 * Loads and parses .env file into DeploymentConfiguration
 * 
 * Requirements: 11.1, 11.2, 11.4
 */
export class ConfigLoader {
    /**
     * Loads configuration from .env file
     * @param envFilePath Path to .env file
     * @returns Parsed deployment configuration
     */
    static async loadFromEnvFile(envFilePath: string): Promise<DeploymentConfiguration> {
        logger.info(`Loading configuration from ${envFilePath}`);

        try {
            // Read .env file
            const content = await fs.readFile(envFilePath, 'utf-8');

            // Parse .env file
            const env = this.parseEnvFile(content);

            // Build configuration object
            const config: DeploymentConfiguration = {
                network: {
                    httpPort: parseInt(env.HTTP_PORT || '80', 10),
                    httpsPort: parseInt(env.HTTPS_PORT || '443', 10),
                    enableHttps: env.ENABLE_HTTPS === 'true',
                },
                volumes: {
                    dataPath: env.DATA_PATH || '/var/lib/postgresql/data',
                    socketPath: env.SOCKET_PATH || '/var/run/postgresql',
                    certPath: env.CERT_PATH,
                },
                environment: {
                    nodeEnv: (env.NODE_ENV as 'production' | 'staging') || 'production',
                    databaseUrl: env.DATABASE_URL || 'postgresql://apiuser@localhost/cultivate?host=/var/run/postgresql',
                    backendPort: parseInt(env.BACKEND_PORT || '3000', 10),
                },
                security: {
                    apiUserUid: parseInt(env.API_USER_UID || '1001', 10),
                    apiUserGid: parseInt(env.API_USER_GID || '1001', 10),
                    socketPermissions: env.SOCKET_PERMISSIONS || '0770',
                },
            };

            logger.info('Configuration loaded successfully');
            return config;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to load configuration: ${errorMessage}`);
            throw new Error(`Failed to load configuration from ${envFilePath}: ${errorMessage}`);
        }
    }

    /**
     * Parses .env file content into key-value pairs
     * @param content .env file content
     * @returns Parsed environment variables
     */
    private static parseEnvFile(content: string): Record<string, string> {
        const env: Record<string, string> = {};

        const lines = content.split('\n');
        for (const line of lines) {
            // Skip empty lines and comments
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Parse KEY=VALUE
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();

                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                env[key] = value;
            }
        }

        return env;
    }

    /**
     * Validates that required configuration values are present
     * @param config Configuration to validate
     * @returns Validation result
     */
    static validateRequired(config: DeploymentConfiguration): {
        valid: boolean;
        missing: string[];
    } {
        const missing: string[] = [];

        // Check required values
        if (!config.network.httpPort) missing.push('HTTP_PORT');
        if (!config.environment.nodeEnv) missing.push('NODE_ENV');
        if (!config.environment.databaseUrl) missing.push('DATABASE_URL');
        if (!config.security.apiUserUid) missing.push('API_USER_UID');
        if (!config.security.apiUserGid) missing.push('API_USER_GID');

        return {
            valid: missing.length === 0,
            missing,
        };
    }

    /**
     * Loads configuration with defaults applied
     * @param envFilePath Path to .env file
     * @returns Configuration with defaults
     */
    static async loadWithDefaults(envFilePath: string): Promise<DeploymentConfiguration> {
        const config = await this.loadFromEnvFile(envFilePath);

        // Apply defaults for optional values
        return {
            ...config,
            network: {
                httpPort: config.network.httpPort || 80,
                httpsPort: config.network.httpsPort || 443,
                enableHttps: config.network.enableHttps ?? false,
            },
            volumes: {
                dataPath: config.volumes.dataPath || '/var/lib/postgresql/data',
                socketPath: config.volumes.socketPath || '/var/run/postgresql',
                certPath: config.volumes.certPath,
            },
            environment: {
                nodeEnv: config.environment.nodeEnv || 'production',
                databaseUrl: config.environment.databaseUrl || 'postgresql://apiuser@localhost/cultivate?host=/var/run/postgresql',
                backendPort: config.environment.backendPort || 3000,
            },
            security: {
                apiUserUid: config.security.apiUserUid || 1001,
                apiUserGid: config.security.apiUserGid || 1001,
                socketPermissions: config.security.socketPermissions || '0770',
            },
        };
    }
}
