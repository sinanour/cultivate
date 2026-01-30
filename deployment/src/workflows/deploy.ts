/**
 * Main deployment workflow
 * Orchestrates the complete deployment process
 * 
 * Workflow steps:
 * 1. Validate prerequisites
 * 2. Establish SSH connection
 * 3. Check target dependencies
 * 4. Build or transfer images
 * 5. Deploy configuration
 * 6. Start containers
 * 7. Verify deployment
 * 
 * Requirements:
 * - 7.1: Accept target SSH host as required parameter
 * - 10.3: Start containers using Docker Compose
 * - 10.4: Verify all containers start successfully
 */

import type { DeploymentOptions, DeploymentResult, DeploymentState } from '../types/deployment.js';
import { createLogger } from '../utils/logger.js';
import { SSHClient } from '../utils/ssh-client.js';
import { DependencyChecker } from '../utils/dependency-checker.js';
import { DependencyInstaller } from '../utils/dependency-installer.js';
import { buildAllImages } from '../utils/image-builder.js';
import { ImageTransfer, transferAllImages } from '../utils/image-transfer.js';
import { ConfigValidator } from '../utils/config-validator.js';
import { ConfigTransfer } from '../utils/config-transfer.js';
import { ContainerDeployment } from '../utils/container-deployment.js';
import { HealthCheck } from '../utils/health-check.js';
import { DeploymentStateManager } from '../utils/deployment-state.js';
import { FailureDetection } from '../utils/failure-detection.js';
import { DiagnosticCapture } from '../utils/diagnostic-capture.js';
import { RollbackExecutor } from '../utils/rollback-executor.js';
import { FailureHandler } from '../utils/failure-handler.js';
import * as path from 'path';
import * as os from 'os';

const logger = createLogger();

/**
 * Execute the deployment workflow
 */
export async function deployWorkflow(
    options: DeploymentOptions
): Promise<DeploymentResult> {
    logger.info('Executing deployment workflow', {
        targetHost: options.targetHost,
        buildMode: options.buildOptions.buildMode
    });

    const logs: string[] = [];
    const log = (message: string) => {
        logs.push(message);
        logger.info(message);
    };

    let sshClient: SSHClient | null = null;
    const stateManager = new DeploymentStateManager(options.stateFilePath);

    try {
        // Step 1: Validate prerequisites
        log('Step 1: Validating prerequisites...');
        await validatePrerequisites(options);
        log('Prerequisites validated successfully');

        // Step 2: Establish SSH connection
        log('Step 2: Establishing SSH connection...');
        sshClient = await establishSSHConnection(options);
        log(`SSH connection established to ${options.targetHost}`);

        // Step 3: Check and install target dependencies
        log('Step 3: Checking target dependencies...');
        await checkAndInstallDependencies(sshClient);
        log('Target dependencies verified');

        // Step 4: Build or transfer images
        log('Step 4: Building and transferring images...');
        const version = generateVersion();
        const imageVersions = await buildAndTransferImages(
            options,
            sshClient,
            version,
            (message) => log(`  ${message}`)
        );
        log(`Images built and transferred: version ${version}`);

        // Step 5: Deploy configuration
        log('Step 5: Deploying configuration...');
        const config = await deployConfiguration(options, sshClient, version);
        log('Configuration deployed successfully');

        // Step 6: Create deployment state
        const state: DeploymentState = stateManager.createDeploymentState(
            version,
            options.targetHost,
            imageVersions,
            config
        );
        await stateManager.saveCurrentState(state);
        log('Deployment state saved');

        // Step 7: Start containers
        log('Step 7: Starting containers...');
        const containerDeployment = new ContainerDeployment(sshClient);
        const deployResult = await containerDeployment.deployContainers({
            composePath: '/opt/community-tracker/docker-compose.yml',
            workingDirectory: '/opt/community-tracker',
            pullImages: false,
            forceRecreate: true
        });

        if (!deployResult.success) {
            throw new Error(`Container deployment failed: ${deployResult.error}`);
        }
        log('Containers started successfully');

        // Step 8: Verify deployment with health checks
        log('Step 8: Verifying deployment...');
        const healthCheck = new HealthCheck(sshClient);
        const healthResult = await healthCheck.verifyContainerHealth({
            workingDirectory: '/opt/community-tracker',
            timeout: 300000, // 5 minutes
            maxRetries: 60,
            useExponentialBackoff: true
        });

        if (!healthResult.allHealthy) {
            throw new Error(`Health check failed: ${healthResult.error}`);
        }

        // Add health check results to state
        for (const container of healthResult.containers) {
            await stateManager.addHealthCheck({
                service: container.containerName as 'frontend' | 'backend' | 'database',
                status: container.status === 'healthy' ? 'healthy' : 'unhealthy',
                timestamp: new Date(),
                message: container.lastError
            });
        }

        log('All health checks passed');

        // Update deployment state to active
        await stateManager.updateStatus('active');
        log('Deployment completed successfully');

        const finalState = await stateManager.loadCurrentState();

        return {
            success: true,
            state: finalState!,
            logs
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Deployment workflow failed', { error: errorMessage });
        log(`ERROR: ${errorMessage}`);

        // Handle failure with automatic rollback
        if (sshClient && sshClient.isConnected()) {
            try {
                log('Initiating failure handling and rollback...');
                await handleDeploymentFailure(sshClient, options, stateManager);
                log('Rollback completed');
            } catch (rollbackError) {
                const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
                logger.error('Rollback failed', { error: rollbackMessage });
                log(`Rollback failed: ${rollbackMessage}`);
            }
        }

        // Update deployment state to failed
        try {
            await stateManager.updateStatus('failed');
        } catch (stateError) {
            logger.warn('Failed to update deployment state', { error: stateError });
        }

        const currentState = await stateManager.loadCurrentState();

        return {
            success: false,
            state: currentState || {
                version: 'unknown',
                timestamp: new Date(),
                targetHost: options.targetHost,
                imageVersions: { frontend: 'unknown', backend: 'unknown', database: 'unknown' },
                configurationHash: 'unknown',
                status: 'failed',
                healthChecks: []
            },
            error: errorMessage,
            logs
        };
    } finally {
        // Cleanup: disconnect SSH
        if (sshClient && sshClient.isConnected()) {
            await sshClient.disconnect();
            logger.info('SSH connection closed');
        }
    }
}

/**
 * Validate prerequisites before deployment
 */
async function validatePrerequisites(options: DeploymentOptions): Promise<void> {
    logger.info('Validating prerequisites...');

    // Validate target host is provided
    if (!options.targetHost) {
        throw new Error('Target host is required');
    }

    // Validate build options
    if (!options.buildOptions) {
        throw new Error('Build options are required');
    }

    // Validate context path exists if building locally
    if (options.buildOptions.buildMode === 'local') {
        const contextPath = options.buildOptions.contextPath;
        if (!contextPath) {
            throw new Error('Context path is required for local builds');
        }
    }

    logger.info('Prerequisites validated');
}

/**
 * Establish SSH connection to target host
 */
async function establishSSHConnection(options: DeploymentOptions): Promise<SSHClient> {
    logger.info(`Establishing SSH connection to ${options.targetHost}...`);

    const sshClient = new SSHClient({
        host: options.targetHost,
        port: options.sshConfig?.port || 22,
        username: options.sshConfig?.username || 'root',
        privateKeyPath: options.sshConfig?.privateKeyPath,
        timeout: options.sshConfig?.timeout || 30000
    });

    await sshClient.connect();

    // Verify connection
    const verified = await sshClient.verifyConnection();
    if (!verified) {
        throw new Error('SSH connection verification failed');
    }

    logger.info('SSH connection established and verified');
    return sshClient;
}

/**
 * Check and install dependencies on target host
 */
async function checkAndInstallDependencies(sshClient: SSHClient): Promise<void> {
    logger.info('Checking target dependencies...');

    const dependencyChecker = new DependencyChecker(sshClient);
    const summary = await dependencyChecker.checkAllDependencies();

    if (summary.allDependenciesMet) {
        logger.info('All dependencies are installed and meet minimum requirements');
        return;
    }

    // Install missing dependencies
    logger.info('Installing missing dependencies...');
    const installer = new DependencyInstaller(sshClient);

    if (!summary.docker.installed || !summary.docker.meetsMinimum) {
        logger.info('Installing Docker...');
        await installer.installDocker();
    }

    if (!summary.dockerCompose.installed || !summary.dockerCompose.meetsMinimum) {
        logger.info('Installing Docker Compose...');
        await installer.installDockerCompose();
    }

    // Verify installation
    const verifyResult = await dependencyChecker.checkAllDependencies();
    if (!verifyResult.allDependenciesMet) {
        throw new Error('Failed to install required dependencies');
    }

    logger.info('All dependencies installed successfully');
}

/**
 * Build and transfer Docker images
 */
async function buildAndTransferImages(
    options: DeploymentOptions,
    sshClient: SSHClient,
    version: string,
    onProgress?: (message: string) => void
): Promise<{ frontend: string; backend: string; database: string }> {
    const buildMode = options.buildOptions.buildMode;

    if (buildMode === 'local') {
        logger.info('Building images locally...');

        // Build images locally
        const contextPath = options.buildOptions.contextPath;
        // Dockerfiles are in deployment/dockerfiles/, not at workspace root
        const dockerfilesPath = path.join(contextPath, 'deployment', 'dockerfiles');

        await buildAllImages(version, contextPath, dockerfilesPath, onProgress);

        // Transfer images to remote host
        logger.info('Transferring images to remote host...');
        await transferAllImages(sshClient, version, onProgress);
    } else {
        // Build images on remote host
        logger.info('Building images on remote host...');
        // TODO: Implement remote build in future enhancement
        throw new Error('Remote build mode not yet implemented');
    }

    return {
        frontend: `cat_frontend:${version}`,
        backend: `cat_backend:${version}`,
        database: `cat_database:${version}`
    };
}

/**
 * Deploy configuration files to target host
 */
async function deployConfiguration(
    _options: DeploymentOptions,
    sshClient: SSHClient,
    version: string
): Promise<any> {
    logger.info('Deploying configuration...');

    // Create default configuration
    const config = ConfigValidator.applyDefaults({
        network: {
            httpPort: 80,
            httpsPort: 443,
            enableHttps: false
        },
        volumes: {
            dataPath: '/var/lib/postgresql/data',
            socketPath: '/var/run/postgresql'
        },
        environment: {
            nodeEnv: 'production',
            databaseUrl: 'postgresql://apiuser@localhost/community_tracker?host=/var/run/postgresql',
            backendPort: 3000
        },
        security: {
            apiUserUid: 1001,
            apiUserGid: 1001,
            socketPermissions: '0770'
        }
    });

    // Validate configuration
    const validation = ConfigValidator.validateConfiguration(config);
    if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate .env file
    const tempDir = await os.tmpdir();
    const envPath = path.join(tempDir, '.env');
    await ConfigTransfer.writeEnvFile(config, envPath);

    // Generate docker-compose.yml
    const composePath = path.join(tempDir, 'docker-compose.yml');
    const composeContent = generateDockerComposeFile(version);
    const fs = await import('fs/promises');
    await fs.writeFile(composePath, composeContent);

    // Transfer configuration files
    const configTransfer = new ConfigTransfer(sshClient);
    const transferResult = await configTransfer.transferConfiguration({
        composeFilePath: composePath,
        envFilePath: envPath,
        targetDir: '/opt/community-tracker',
        setPermissions: true
    });

    if (!transferResult.success) {
        throw new Error(`Configuration transfer failed: ${transferResult.errors.join(', ')}`);
    }

    logger.info('Configuration deployed successfully');
    return config;
}

/**
 * Generate docker-compose.yml content
 */
function generateDockerComposeFile(version: string): string {
    return `version: '3.8'

services:
  database:
    image: cat_database:${version}
    container_name: cat_database
    volumes:
      - db_data:/var/lib/postgresql/data
      - db_socket:/var/run/postgresql
    environment:
      - POSTGRES_USER=apiuser
      - POSTGRES_DB=community_tracker
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U apiuser -d community_tracker"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: cat_backend:${version}
    container_name: cat_backend
    depends_on:
      database:
        condition: service_healthy
    volumes:
      - db_socket:/var/run/postgresql:rw
    environment:
      - DATABASE_URL=postgresql://apiuser@localhost/community_tracker?host=/var/run/postgresql
      - NODE_ENV=production
      - PORT=3000
      - CORS_ORIGIN=\${CORS_ORIGIN:-*}
      - SRP_ROOT_ADMIN_EMAIL=\${SRP_ROOT_ADMIN_EMAIL:-admin@example.com}
      - SRP_ROOT_ADMIN_PASSWORD=\${SRP_ROOT_ADMIN_PASSWORD:-changeme}
      - JWT_SECRET=\${JWT_SECRET:-change-this-in-production}
      - JWT_ACCESS_TOKEN_EXPIRY=\${JWT_ACCESS_TOKEN_EXPIRY:-15m}
      - JWT_REFRESH_TOKEN_EXPIRY=\${JWT_REFRESH_TOKEN_EXPIRY:-7d}
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    image: cat_frontend:${version}
    container_name: cat_frontend
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_BACKEND_URL=/api/v1
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  backend:
    driver: bridge

volumes:
  db_data:
    driver: local
  db_socket:
    driver: local
`;
}

/**
 * Handle deployment failure with automatic rollback
 */
async function handleDeploymentFailure(
    sshClient: SSHClient,
    _options: DeploymentOptions,
    stateManager: DeploymentStateManager
): Promise<void> {
    logger.info('Handling deployment failure...');

    const containerDeployment = new ContainerDeployment(sshClient);
    const healthCheck = new HealthCheck(sshClient);
    const failureDetection = new FailureDetection(sshClient, containerDeployment, healthCheck);
    const diagnosticCapture = new DiagnosticCapture(sshClient, containerDeployment);
    const imageTransfer = new ImageTransfer();
    const configTransfer = new ConfigTransfer(sshClient);

    const rollbackExecutor = new RollbackExecutor(
        stateManager,
        sshClient,
        imageTransfer,
        configTransfer,
        containerDeployment,
        healthCheck
    );

    const failureHandler = new FailureHandler(
        failureDetection,
        diagnosticCapture,
        rollbackExecutor
    );

    const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/community-tracker',
        rollbackOptions: {
            targetHost: _options.targetHost,
            sshConfig: {
                username: _options.sshConfig?.username || 'root',
                port: _options.sshConfig?.port || 22,
                privateKeyPath: _options.sshConfig?.privateKeyPath,
                timeout: _options.sshConfig?.timeout || 30000
            },
            composePath: '/opt/community-tracker/docker-compose.yml',
            verifyHealth: true
        },
        autoRollback: true,
        captureDiagnostics: true,
        verifyRollback: true
    });

    if (!result.success) {
        throw new Error(`Failure handling failed: ${result.error}`);
    }

    logger.info('Deployment failure handled successfully');
}

/**
 * Generate version string for deployment
 */
function generateVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${year}.${month}.${day}-${hour}${minute}${second}`;
}
