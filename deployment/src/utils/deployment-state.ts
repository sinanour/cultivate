/**
 * Deployment State Tracking Module
 * 
 * Manages deployment state persistence to JSON files.
 * Tracks image versions, configuration hashes, timestamps, and previous deployment state for rollback.
 * 
 * Requirements: 14.1, 14.3
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DeploymentState, DeploymentConfiguration } from '../types/deployment.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Default path for deployment state files
 */
const DEFAULT_STATE_DIR = '/var/lib/deployment-system';
const CURRENT_STATE_FILE = 'current-deployment.json';
const PREVIOUS_STATE_FILE = 'previous-deployment.json';

/**
 * Deployment State Manager
 * Handles persistence and retrieval of deployment state
 */
export class DeploymentStateManager {
    private stateDir: string;

    constructor(stateDir: string = DEFAULT_STATE_DIR) {
        this.stateDir = stateDir;
    }

    /**
     * Initialize the state directory
     * Creates the directory if it doesn't exist
     */
    async initialize(): Promise<void> {
        try {
            if (!fs.existsSync(this.stateDir)) {
                fs.mkdirSync(this.stateDir, { recursive: true, mode: 0o755 });
                logger.info(`Created deployment state directory: ${this.stateDir}`);
            }
        } catch (error) {
            logger.error(`Failed to initialize state directory: ${error}`);
            throw new Error(`Failed to initialize state directory: ${error}`);
        }
    }

    /**
     * Save current deployment state
     * Moves current state to previous before saving new state
     * 
     * @param state - Deployment state to save
     */
    async saveCurrentState(state: DeploymentState): Promise<void> {
        try {
            await this.initialize();

            // Move current state to previous (if exists)
            const currentPath = path.join(this.stateDir, CURRENT_STATE_FILE);

            if (fs.existsSync(currentPath)) {
                const currentState = await this.loadCurrentState();
                if (currentState) {
                    await this.savePreviousState(currentState);
                    logger.info('Moved current deployment state to previous');
                }
            }

            // Save new current state
            const stateJson = JSON.stringify(state, null, 2);
            fs.writeFileSync(currentPath, stateJson, { mode: 0o644 });
            logger.info(`Saved current deployment state: version ${state.version}`);
        } catch (error) {
            logger.error(`Failed to save current state: ${error}`);
            throw new Error(`Failed to save current state: ${error}`);
        }
    }

    /**
     * Save previous deployment state
     * Used internally when moving current to previous
     * 
     * @param state - Deployment state to save as previous
     */
    private async savePreviousState(state: DeploymentState): Promise<void> {
        try {
            const previousPath = path.join(this.stateDir, PREVIOUS_STATE_FILE);
            const stateJson = JSON.stringify(state, null, 2);
            fs.writeFileSync(previousPath, stateJson, { mode: 0o644 });
            logger.debug('Saved previous deployment state');
        } catch (error) {
            logger.error(`Failed to save previous state: ${error}`);
            throw new Error(`Failed to save previous state: ${error}`);
        }
    }

    /**
     * Load current deployment state
     * 
     * @returns Current deployment state or null if not found
     */
    async loadCurrentState(): Promise<DeploymentState | null> {
        try {
            const currentPath = path.join(this.stateDir, CURRENT_STATE_FILE);

            if (!fs.existsSync(currentPath)) {
                logger.debug('No current deployment state found');
                return null;
            }

            const stateJson = fs.readFileSync(currentPath, 'utf-8');
            const state = JSON.parse(stateJson) as DeploymentState;

            // Convert timestamp strings back to Date objects
            state.timestamp = new Date(state.timestamp);
            state.healthChecks = state.healthChecks.map(hc => ({
                ...hc,
                timestamp: new Date(hc.timestamp)
            }));

            logger.debug(`Loaded current deployment state: version ${state.version}`);
            return state;
        } catch (error) {
            logger.error(`Failed to load current state: ${error}`);
            return null;
        }
    }

    /**
     * Load previous deployment state
     * Used for rollback operations
     * 
     * @returns Previous deployment state or null if not found
     */
    async loadPreviousState(): Promise<DeploymentState | null> {
        try {
            const previousPath = path.join(this.stateDir, PREVIOUS_STATE_FILE);

            if (!fs.existsSync(previousPath)) {
                logger.debug('No previous deployment state found');
                return null;
            }

            const stateJson = fs.readFileSync(previousPath, 'utf-8');
            const state = JSON.parse(stateJson) as DeploymentState;

            // Convert timestamp strings back to Date objects
            state.timestamp = new Date(state.timestamp);
            state.healthChecks = state.healthChecks.map(hc => ({
                ...hc,
                timestamp: new Date(hc.timestamp)
            }));

            logger.debug(`Loaded previous deployment state: version ${state.version}`);
            return state;
        } catch (error) {
            logger.error(`Failed to load previous state: ${error}`);
            return null;
        }
    }

    /**
     * Check if a previous deployment exists
     * 
     * @returns True if previous deployment state exists
     */
    async hasPreviousState(): Promise<boolean> {
        const previousPath = path.join(this.stateDir, PREVIOUS_STATE_FILE);
        return fs.existsSync(previousPath);
    }

    /**
     * Calculate configuration hash
     * Used to detect configuration changes between deployments
     * 
     * @param config - Deployment configuration
     * @returns SHA256 hash of configuration
     */
    calculateConfigurationHash(config: DeploymentConfiguration): string {
        // Recursively sort object keys for consistent hashing
        const sortedConfig = this.sortObjectKeys(config);
        const configString = JSON.stringify(sortedConfig);
        return crypto.createHash('sha256').update(configString).digest('hex');
    }

    /**
     * Recursively sort object keys for consistent serialization
     * 
     * @param obj - Object to sort
     * @returns Object with sorted keys
     */
    private sortObjectKeys(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObjectKeys(item));
        }

        const sorted: any = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = this.sortObjectKeys(obj[key]);
        });

        return sorted;
    }

    /**
     * Create a new deployment state
     * Helper method to create a properly structured deployment state
     * 
     * @param version - Deployment version
     * @param targetHost - Target host identifier
     * @param imageVersions - Docker image versions
     * @param config - Deployment configuration
     * @returns New deployment state
     */
    createDeploymentState(
        version: string,
        targetHost: string,
        imageVersions: { frontend: string; backend: string; database: string },
        config: DeploymentConfiguration
    ): DeploymentState {
        return {
            version,
            timestamp: new Date(),
            targetHost,
            imageVersions,
            configurationHash: this.calculateConfigurationHash(config),
            status: 'pending',
            healthChecks: []
        };
    }

    /**
     * Update deployment state status
     * 
     * @param status - New status
     */
    async updateStatus(status: DeploymentState['status']): Promise<void> {
        try {
            const currentState = await this.loadCurrentState();
            if (!currentState) {
                throw new Error('No current deployment state to update');
            }

            currentState.status = status;
            await this.saveCurrentState(currentState);
            logger.info(`Updated deployment status to: ${status}`);
        } catch (error) {
            logger.error(`Failed to update status: ${error}`);
            throw new Error(`Failed to update status: ${error}`);
        }
    }

    /**
     * Add health check result to current deployment state
     * 
     * @param healthCheck - Health check result to add
     */
    async addHealthCheck(healthCheck: DeploymentState['healthChecks'][0]): Promise<void> {
        try {
            const currentState = await this.loadCurrentState();
            if (!currentState) {
                throw new Error('No current deployment state to update');
            }

            currentState.healthChecks.push(healthCheck);
            await this.saveCurrentState(currentState);
            logger.debug(`Added health check for ${healthCheck.service}: ${healthCheck.status}`);
        } catch (error) {
            logger.error(`Failed to add health check: ${error}`);
            throw new Error(`Failed to add health check: ${error}`);
        }
    }

    /**
     * Get deployment history
     * Returns both current and previous states if available
     * 
     * @returns Object with current and previous states
     */
    async getDeploymentHistory(): Promise<{
        current: DeploymentState | null;
        previous: DeploymentState | null;
    }> {
        const current = await this.loadCurrentState();
        const previous = await this.loadPreviousState();

        return { current, previous };
    }

    /**
     * Clear all deployment state
     * WARNING: This removes both current and previous state files
     * Use with caution - typically only for testing or cleanup
     */
    async clearAllState(): Promise<void> {
        try {
            const currentPath = path.join(this.stateDir, CURRENT_STATE_FILE);
            const previousPath = path.join(this.stateDir, PREVIOUS_STATE_FILE);

            if (fs.existsSync(currentPath)) {
                fs.unlinkSync(currentPath);
                logger.info('Removed current deployment state');
            }

            if (fs.existsSync(previousPath)) {
                fs.unlinkSync(previousPath);
                logger.info('Removed previous deployment state');
            }
        } catch (error) {
            logger.error(`Failed to clear state: ${error}`);
            throw new Error(`Failed to clear state: ${error}`);
        }
    }
}

/**
 * Default instance for convenience
 */
export const deploymentStateManager = new DeploymentStateManager();
