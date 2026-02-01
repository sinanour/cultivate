/**
 * Container runtime detection and management
 * Supports both Docker and Finch for local image building
 * 
 * Requirements:
 * - 9.6: Support Finch on macOS as alternative to Docker
 * - 9.7: Automatically detect available container runtime
 * - 9.8: Use compatible commands for both Docker and Finch
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { ContainerRuntime } from '../types/deployment.js';
import { createLogger } from './logger.js';

const execAsync = promisify(exec);
const logger = createLogger();

/**
 * Check if a command is available on the system
 */
async function checkCommand(command: string): Promise<boolean> {
    try {
        await execAsync(command);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get version string for a container runtime
 */
async function getVersion(command: string): Promise<string | undefined> {
    try {
        const { stdout } = await execAsync(`${command} --version`);
        return stdout.trim();
    } catch {
        return undefined;
    }
}

/**
 * Detect available container runtime on the local machine
 * Checks for Docker first, then Finch as fallback
 * 
 * @returns ContainerRuntime configuration
 * @throws Error if neither Docker nor Finch is available
 */
export async function detectContainerRuntime(): Promise<ContainerRuntime> {
    logger.debug('Detecting available container runtime...');

    // Check for Docker first (most common)
    const dockerAvailable = await checkCommand('docker --version');
    if (dockerAvailable) {
        const version = await getVersion('docker');
        logger.info('Docker detected', { version });
        
        return {
            name: 'docker',
            buildCommand: 'docker',
            composeCommand: 'docker-compose',
            available: true,
            version
        };
    }

    // Check for Finch (macOS alternative)
    const finchAvailable = await checkCommand('finch --version');
    if (finchAvailable) {
        const version = await getVersion('finch');
        logger.info('Finch detected', { version });
        
        return {
            name: 'finch',
            buildCommand: 'finch',
            composeCommand: 'finch compose',
            available: true,
            version
        };
    }

    // Neither runtime found
    const error = 'No container runtime found. Please install Docker or Finch.';
    logger.error(error);
    throw new Error(error);
}

/**
 * Check if Finch VM is initialized on local machine
 */
async function isLocalFinchVMInitialized(): Promise<boolean> {
    try {
        const { stdout } = await execAsync('finch vm status 2>/dev/null');
        const output = stdout.toLowerCase();
        return output.includes('running') || output.includes('stopped');
    } catch {
        return false;
    }
}

/**
 * Initialize Finch VM on local machine
 */
async function initializeLocalFinchVM(): Promise<void> {
    logger.info('Initializing Finch VM on local machine...');
    try {
        await execAsync('finch vm init', { timeout: 120000 }); // 120 second timeout
        logger.info('Finch VM initialized successfully');
    } catch (error) {
        throw new Error(`Failed to initialize Finch VM: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Start Finch VM on local machine
 */
async function startLocalFinchVM(): Promise<void> {
    logger.info('Starting Finch VM on local machine...');
    try {
        await execAsync('finch vm start', { timeout: 120000 }); // 120 second timeout
        logger.info('Finch VM started successfully');

        // Wait a bit for VM to be fully ready
        await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
        throw new Error(`Failed to start Finch VM: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Ensure Finch VM is ready on local machine
 */
async function ensureLocalFinchVMReady(): Promise<void> {
    logger.info('Ensuring Finch VM is ready on local machine...');

    // Check if VM is initialized
    const isInitialized = await isLocalFinchVMInitialized();

    if (!isInitialized) {
        logger.info('Finch VM not initialized, initializing now (this may take a few minutes)...');
        await initializeLocalFinchVM();
        return;
    }

    // Check if VM is running
    try {
        const { stdout } = await execAsync('finch vm status 2>/dev/null');
        if (stdout.toLowerCase().includes('stopped')) {
            logger.info('Finch VM is stopped, starting it...');
            await startLocalFinchVM();
        } else {
            logger.info('Finch VM is already running');
        }
    } catch (error) {
        logger.warn('Could not check Finch VM status, attempting to start anyway');
        await startLocalFinchVM();
    }

    logger.info('Finch VM is ready');
}

/**
 * Verify that the detected runtime is functional
 * Tests basic operations like listing images
 * For Finch, ensures VM is initialized and running first
 */
export async function verifyContainerRuntime(runtime: ContainerRuntime): Promise<boolean> {
    try {
        logger.debug(`Verifying ${runtime.name} functionality...`);
        
        // If Finch, ensure VM is ready first
        if (runtime.name === 'finch') {
            try {
                await ensureLocalFinchVMReady();
            } catch (vmError) {
                logger.error('Failed to ensure Finch VM is ready', {
                    error: vmError instanceof Error ? vmError.message : String(vmError)
                });
                return false;
            }
        }

        // Try to list images as a basic functionality test
        await execAsync(`${runtime.buildCommand} images`);
        
        logger.info(`${runtime.name} is functional`);
        return true;
    } catch (error) {
        logger.error(`${runtime.name} verification failed`, {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Get the appropriate compose command for the runtime
 * Docker uses 'docker-compose' while Finch uses 'finch compose'
 */
export function getComposeCommand(runtime: ContainerRuntime): string {
    return runtime.composeCommand;
}

/**
 * Get the appropriate build command for the runtime
 * Both Docker and Finch use the same subcommand structure
 */
export function getBuildCommand(runtime: ContainerRuntime): string {
    return runtime.buildCommand;
}

/**
 * Check if the current platform is macOS
 * Useful for providing platform-specific guidance
 */
export function isMacOS(): boolean {
    return process.platform === 'darwin';
}

/**
 * Get recommended runtime for the current platform
 */
export function getRecommendedRuntime(): 'docker' | 'finch' {
    // Recommend Finch for macOS (better performance on Apple Silicon)
    // Recommend Docker for other platforms
    return isMacOS() ? 'finch' : 'docker';
}

/**
 * Provide installation guidance based on platform and missing runtime
 */
export function getInstallationGuidance(platform: NodeJS.Platform): string {
    if (platform === 'darwin') {
        return `
No container runtime found. Please install Docker or Finch:

Docker:
  - Download from: https://www.docker.com/products/docker-desktop
  - Or install via Homebrew: brew install --cask docker

Finch (Recommended for macOS):
  - Install via Homebrew: brew install finch
  - Initialize VM: finch vm init
  - More info: https://github.com/runfinch/finch

Finch is recommended for macOS, especially on Apple Silicon (M1/M2/M3),
as it provides better performance and resource efficiency.
        `.trim();
    } else if (platform === 'linux') {
        return `
No container runtime found. Please install Docker:

Docker:
  - Follow instructions at: https://docs.docker.com/engine/install/
  - Or use your package manager (apt, yum, etc.)

Note: Finch has limited support on Linux. Docker is recommended.
        `.trim();
    } else if (platform === 'win32') {
        return `
No container runtime found. Please install Docker:

Docker Desktop:
  - Download from: https://www.docker.com/products/docker-desktop

Note: Finch is not available for Windows. Docker is required.
        `.trim();
    }

    return 'No container runtime found. Please install Docker.';
}

