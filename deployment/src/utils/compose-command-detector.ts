/**
 * Compose command detection for target hosts
 * Detects whether to use docker-compose or finch compose based on target OS and available runtime
 * 
 * Requirements:
 * - 8.9: Check for Finch installation on macOS targets
 * - 8.10: Use Finch commands on macOS targets with Finch installed
 * - 10.6: Use finch compose commands for all compose operations on macOS
 */

import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Result of compose command detection
 */
export interface ComposeCommandResult {
    /** The compose command to use (e.g., 'docker-compose' or 'finch compose') */
    command: string;
    /** Whether the target is macOS */
    isMacOS: boolean;
    /** Whether Finch was detected */
    isFinch: boolean;
    /** Path to the runtime binary if found */
    runtimePath?: string;
}

/**
 * Detects the appropriate compose command to use on the target host
 * Checks for macOS and Finch, falls back to docker-compose
 * 
 * @param sshClient Connected SSH client for remote command execution
 * @returns Promise that resolves with compose command detection result
 */
export async function detectComposeCommand(sshClient: SSHClient): Promise<ComposeCommandResult> {
    logger.info('Detecting container runtime on target host...');

    // First, check if we're on macOS
    const unameResult = await sshClient.executeCommand('uname');
    const isMacOS = unameResult.stdout.trim() === 'Darwin';
    logger.info(`Target OS: ${isMacOS ? 'macOS' : 'Linux'}`);

    if (isMacOS) {
        // Try finch compose first (for macOS) with multiple paths
        const finchPaths = [
            'finch',                           // In PATH
            '/opt/homebrew/bin/finch',        // Homebrew on Apple Silicon (most common)
            '/usr/local/bin/finch',           // Homebrew on Intel
            '~/.finch/bin/finch',             // User installation (shell will expand ~)
        ];

        for (const finchPath of finchPaths) {
            logger.debug(`Checking for Finch at: ${finchPath}`);

            // Use 'which' for paths in PATH, direct check for absolute paths
            const checkCmd = finchPath.startsWith('/') || finchPath.startsWith('~')
                ? `test -x ${finchPath} && echo "found" || echo "not found"`
                : `which ${finchPath} 2>/dev/null && echo "found" || echo "not found"`;

            const checkResult = await sshClient.executeCommand(checkCmd);
            logger.debug(`Check result for ${finchPath}: ${checkResult.stdout.trim()}`);

            if (checkResult.stdout.includes('found')) {
                const composeCmd = `${finchPath} compose`;
                logger.info(`Found Finch at: ${finchPath}`);

                // Verify compose works
                const composeTest = await sshClient.executeCommand(`${composeCmd} version 2>/dev/null`);
                if (composeTest.exitCode === 0) {
                    logger.info(`✓ Verified ${composeCmd} is working`);
                    logger.info(`Will use compose command: ${composeCmd}`);
                    return {
                        command: composeCmd,
                        isMacOS: true,
                        isFinch: true,
                        runtimePath: finchPath
                    };
                } else {
                    logger.warn(`${composeCmd} found but not working (exit code: ${composeTest.exitCode})`);
                    logger.debug(`stderr: ${composeTest.stderr}`);
                }
            }
        }

        logger.warn('Finch not found on macOS target, falling back to docker-compose');
    }

    // Fall back to docker-compose
    logger.info('Will use compose command: docker-compose');
    return {
        command: 'docker-compose',
        isMacOS,
        isFinch: false
    };
}

/**
 * Checks if Finch VM is initialized on macOS
 * 
 * @param sshClient Connected SSH client for remote command execution
 * @param finchPath Path to finch binary
 * @returns Promise that resolves with true if VM is initialized
 */
export async function isFinchVMInitialized(sshClient: SSHClient, finchPath: string): Promise<boolean> {
    try {
        logger.debug('Checking if Finch VM is initialized...');

        // Check VM status
        const result = await sshClient.executeCommand(`${finchPath} vm status 2>/dev/null`);

        // If the command succeeds and output contains "Running" or "Stopped", VM is initialized
        // If VM is not initialized, the command typically fails or returns "nonexistent"
        if (result.exitCode === 0) {
            const output = result.stdout.toLowerCase();
            const isInitialized = output.includes('running') || output.includes('stopped');
            logger.debug(`Finch VM initialized: ${isInitialized}`);
            return isInitialized;
        }

        logger.debug('Finch VM not initialized (command failed)');
        return false;
    } catch (error) {
        logger.debug(`Error checking Finch VM status: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * Initializes Finch VM on macOS
 * 
 * @param sshClient Connected SSH client for remote command execution
 * @param finchPath Path to finch binary
 * @returns Promise that resolves when VM is initialized
 * @throws Error if initialization fails
 */
export async function initializeFinchVM(sshClient: SSHClient, finchPath: string): Promise<void> {
    logger.info('Initializing Finch VM (this may take up to 2 minutes)...');

    try {
        // Initialize VM with a generous timeout (120 seconds)
        // Note: SSH command execution timeout is handled by SSHClient
        const result = await sshClient.executeCommand(`${finchPath} vm init 2>&1`);

        // Check if VM already exists (not an error)
        if (result.stdout.includes('already exists') || result.stdout.includes('already initialized')) {
            logger.info('Finch VM already exists');
            return;
        }

        if (result.exitCode !== 0) {
            throw new Error(`Finch VM initialization failed: ${result.stderr || result.stdout}`);
        }

        logger.info('Finch VM initialized successfully');

        // Wait a bit for VM to be fully ready
        logger.debug('Waiting for VM to be fully ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to initialize Finch VM: ${errorMessage}`);
        throw new Error(`Failed to initialize Finch VM: ${errorMessage}`);
    }
}

/**
 * Ensures Finch VM is initialized and running on macOS
 * Checks if VM is initialized, and initializes it if necessary
 * 
 * @param sshClient Connected SSH client for remote command execution
 * @param finchPath Path to finch binary
 * @returns Promise that resolves when VM is ready
 */
export async function ensureFinchVMReady(sshClient: SSHClient, finchPath: string): Promise<void> {
    logger.info('Ensuring Finch VM is ready...');

    // Check if VM is initialized
    const isInitialized = await isFinchVMInitialized(sshClient, finchPath);

    if (!isInitialized) {
        logger.info('Finch VM not initialized, initializing now (this may take up to 2 minutes)...');
        await initializeFinchVM(sshClient, finchPath);
    } else {
        logger.info('Finch VM is already initialized');

        // Check if VM is running
        const statusResult = await sshClient.executeCommand(`${finchPath} vm status 2>/dev/null`);
        if (statusResult.exitCode === 0 && statusResult.stdout.toLowerCase().includes('stopped')) {
            logger.info('Finch VM is stopped, starting it (this may take up to 2 minutes)...');
            const startResult = await sshClient.executeCommand(`${finchPath} vm start 2>&1`);
            if (startResult.exitCode !== 0) {
                throw new Error(`Failed to start Finch VM: ${startResult.stderr || startResult.stdout}`);
            }
            logger.info('Finch VM started successfully');

            // Wait for VM to be fully ready
            logger.debug('Waiting for VM to be fully ready...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second wait
        }
    }

    logger.info('Finch VM is ready');
}

