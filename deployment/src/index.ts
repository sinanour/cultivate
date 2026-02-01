/**
 * Main entry point for the deployment system
 * Implements CLI interface with Commander.js and logging with Winston
 * 
 * Requirements:
 * - 7.1: Accept target SSH host as required parameter
 * - 15.1: Log all deployment steps with timestamps
 * - 15.5: Provide verbose mode for detailed diagnostic output
 */

import { Command } from 'commander';
import * as path from 'path';
import { createLogger } from './utils/logger.js';
import { deployWorkflow } from './workflows/deploy.js';
import { rollbackWorkflow } from './workflows/rollback.js';
import type { DeploymentOptions, BuildOptions } from './types/deployment.js';

export * from './types/deployment.js';

// Initialize logger
const logger = createLogger();

/**
 * Main function - entry point for the deployment system
 */
async function main(): Promise<void> {
    const program = new Command();

    program
        .name('deploy')
        .description('Cultivate Production Deployment System')
        .version('1.0.0');

    // Deploy command
    program
        .command('deploy')
        .description('Deploy the application to a target host')
        .requiredOption('-t, --target <host>', 'Target SSH host (hostname or IP)')
        .option('-u, --user <username>', 'SSH username', 'root')
        .option('-k, --key <path>', 'Path to SSH private key')
        .option('-p, --port <number>', 'SSH port', '22')
        .option('-b, --build-mode <mode>', 'Build mode: local or remote', 'local')
        .option('-v, --verbose', 'Enable verbose output', false)
        .option('-c, --config <path>', 'Path to configuration file', './config/.env')
        .option('--state-file <path>', 'Path to deployment state file', './deployment-state.json')
        .action(async (options) => {
            try {
                logger.info('Starting deployment workflow', {
                    target: options.target,
                    buildMode: options.buildMode,
                    verbose: options.verbose
                });

                // Set verbose mode for logger
                if (options.verbose) {
                    logger.level = 'debug';
                    logger.debug('Verbose mode enabled');
                }

                // Build deployment options
                const buildOptions: BuildOptions = {
                    buildMode: options.buildMode as 'local' | 'remote',
                    verbose: options.verbose,
                    contextPath: path.resolve(process.cwd(), '..'), // Workspace root (parent of deployment)
                    buildArgs: {}
                };

                const deploymentOptions: Partial<DeploymentOptions> = {
                    targetHost: options.target,
                    sshConfig: {
                        username: options.user,
                        port: parseInt(options.port, 10),
                        privateKeyPath: options.key,
                        timeout: 30000
                    },
                    buildOptions,
                    rollback: false,
                    stateFilePath: options.stateFile
                };

                // Execute deployment workflow
                const result = await deployWorkflow(deploymentOptions as DeploymentOptions);

                if (result.success) {
                    logger.info('Deployment completed successfully', {
                        version: result.state.version,
                        targetHost: result.state.targetHost
                    });
                    process.exit(0);
                } else {
                    logger.error('Deployment failed', {
                        error: result.error,
                        targetHost: deploymentOptions.targetHost
                    });
                    process.exit(1);
                }
            } catch (error) {
                handleError(error);
            }
        });

    // Rollback command
    program
        .command('rollback')
        .description('Rollback to the previous deployment')
        .requiredOption('-t, --target <host>', 'Target SSH host (hostname or IP)')
        .option('-u, --user <username>', 'SSH username', 'root')
        .option('-k, --key <path>', 'Path to SSH private key')
        .option('-p, --port <number>', 'SSH port', '22')
        .option('-v, --verbose', 'Enable verbose output', false)
        .option('--state-file <path>', 'Path to deployment state file', './deployment-state.json')
        .action(async (options) => {
            try {
                logger.info('Starting rollback workflow', {
                    target: options.target,
                    verbose: options.verbose
                });

                // Set verbose mode for logger
                if (options.verbose) {
                    logger.level = 'debug';
                    logger.debug('Verbose mode enabled');
                }

                // Build deployment options for rollback
                const buildOptions: BuildOptions = {
                    buildMode: 'remote', // Rollback always uses existing images
                    verbose: options.verbose,
                    contextPath: process.cwd(),
                    buildArgs: {}
                };

                const deploymentOptions: Partial<DeploymentOptions> = {
                    targetHost: options.target,
                    sshConfig: {
                        username: options.user,
                        port: parseInt(options.port, 10),
                        privateKeyPath: options.key,
                        timeout: 30000
                    },
                    buildOptions,
                    rollback: true,
                    stateFilePath: options.stateFile
                };

                // Execute rollback workflow
                const result = await rollbackWorkflow(deploymentOptions as DeploymentOptions);

                if (result.success) {
                    logger.info('Rollback completed successfully', {
                        version: result.state.version,
                        targetHost: result.state.targetHost
                    });
                    process.exit(0);
                } else {
                    logger.error('Rollback failed', {
                        error: result.error,
                        targetHost: deploymentOptions.targetHost
                    });
                    process.exit(1);
                }
            } catch (error) {
                handleError(error);
            }
        });

    // Parse command line arguments
    await program.parseAsync(process.argv);
}

/**
 * Global error handler
 * Catches and logs all unhandled errors gracefully
 * 
 * Requirements:
 * - 15.1: Log all errors with timestamps
 * - 15.5: Provide detailed error information in verbose mode
 */
function handleError(error: unknown): void {
    if (error instanceof Error) {
        logger.error('Unhandled error occurred', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
    } else {
        logger.error('Unknown error occurred', {
            error: String(error)
        });
    }

    process.exit(1);
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', {
        message: error.message,
        stack: error.stack
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', {
        reason: String(reason)
    });
    process.exit(1);
});

// Run main function
main().catch(handleError);
