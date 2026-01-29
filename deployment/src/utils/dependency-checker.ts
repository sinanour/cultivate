import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

// Create logger instance
const logger = createLogger();

/**
 * Minimum required versions for dependencies
 */
export const MIN_DOCKER_VERSION = '20.10.0';
export const MIN_DOCKER_COMPOSE_VERSION = '2.0.0';

/**
 * Result of a dependency check
 */
export interface DependencyCheckResult {
  installed: boolean;
  version?: string;
  meetsMinimum: boolean;
  error?: string;
}

/**
 * Result of checking all dependencies
 */
export interface DependencyCheckSummary {
  docker: DependencyCheckResult;
  dockerCompose: DependencyCheckResult;
  allDependenciesMet: boolean;
}

/**
 * DependencyChecker class for verifying Docker and Docker Compose on remote hosts
 * 
 * Features:
 * - Docker version detection via SSH
 * - Docker Compose version detection via SSH
 * - Version comparison against minimum requirements
 * - Proper error handling and logging
 * 
 * Requirements: 8.1, 8.2, 8.5
 */
export class DependencyChecker {
  private sshClient: SSHClient;

  /**
   * Creates a new DependencyChecker instance
   * @param sshClient Connected SSH client for remote command execution
   */
  constructor(sshClient: SSHClient) {
    this.sshClient = sshClient;
  }

  /**
   * Checks if Docker is installed and meets minimum version requirements
   * @returns Promise that resolves with Docker check result
   */
  async checkDocker(): Promise<DependencyCheckResult> {
    logger.info('Checking Docker installation...');

    try {
      // Try to get Docker version
      const result = await this.sshClient.executeCommand('docker --version');

      if (result.exitCode !== 0) {
        logger.warn('Docker command failed');
        return {
          installed: false,
          meetsMinimum: false,
          error: result.stderr || 'Docker command returned non-zero exit code',
        };
      }

      // Parse version from output
      // Expected format: "Docker version 20.10.17, build 100c701"
      const version = this.parseDockerVersion(result.stdout);

      if (!version) {
        logger.warn('Could not parse Docker version from output');
        return {
          installed: true,
          meetsMinimum: false,
          error: 'Could not parse Docker version',
        };
      }

      const meetsMinimum = this.compareVersions(version, MIN_DOCKER_VERSION) >= 0;

      if (meetsMinimum) {
        logger.info(`Docker ${version} is installed and meets minimum requirement (${MIN_DOCKER_VERSION})`);
      } else {
        logger.warn(`Docker ${version} is installed but does not meet minimum requirement (${MIN_DOCKER_VERSION})`);
      }

      return {
        installed: true,
        version,
        meetsMinimum,
      };
    } catch (err) {
      logger.error(`Error checking Docker: ${err instanceof Error ? err.message : String(err)}`);
      return {
        installed: false,
        meetsMinimum: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Checks if Docker Compose is installed and meets minimum version requirements
   * @returns Promise that resolves with Docker Compose check result
   */
  async checkDockerCompose(): Promise<DependencyCheckResult> {
    logger.info('Checking Docker Compose installation...');

    try {
      // Try docker compose (v2 - plugin) first
      let result = await this.sshClient.executeCommand('docker compose version');

      // If that fails, try docker-compose (v1 - standalone) as fallback
      if (result.exitCode !== 0) {
        logger.debug('docker compose command failed, trying docker-compose...');
        result = await this.sshClient.executeCommand('docker-compose --version');
      }

      if (result.exitCode !== 0) {
        logger.warn('Docker Compose command failed');
        return {
          installed: false,
          meetsMinimum: false,
          error: result.stderr || 'Docker Compose command returned non-zero exit code',
        };
      }

      // Parse version from output
      // Expected formats:
      // v2: "Docker Compose version v2.17.2"
      // v1: "docker-compose version 1.29.2, build 5becea4c"
      const version = this.parseDockerComposeVersion(result.stdout);

      if (!version) {
        logger.warn('Could not parse Docker Compose version from output');
        return {
          installed: true,
          meetsMinimum: false,
          error: 'Could not parse Docker Compose version',
        };
      }

      const meetsMinimum = this.compareVersions(version, MIN_DOCKER_COMPOSE_VERSION) >= 0;

      if (meetsMinimum) {
        logger.info(`Docker Compose ${version} is installed and meets minimum requirement (${MIN_DOCKER_COMPOSE_VERSION})`);
      } else {
        logger.warn(`Docker Compose ${version} is installed but does not meet minimum requirement (${MIN_DOCKER_COMPOSE_VERSION})`);
      }

      return {
        installed: true,
        version,
        meetsMinimum,
      };
    } catch (err) {
      logger.error(`Error checking Docker Compose: ${err instanceof Error ? err.message : String(err)}`);
      return {
        installed: false,
        meetsMinimum: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Checks all dependencies (Docker and Docker Compose)
   * @returns Promise that resolves with summary of all dependency checks
   */
  async checkAllDependencies(): Promise<DependencyCheckSummary> {
    logger.info('Checking all dependencies...');

    const docker = await this.checkDocker();
    const dockerCompose = await this.checkDockerCompose();

    const allDependenciesMet = docker.installed && 
                                docker.meetsMinimum && 
                                dockerCompose.installed && 
                                dockerCompose.meetsMinimum;

    if (allDependenciesMet) {
      logger.info('All dependencies are installed and meet minimum requirements');
    } else {
      logger.warn('Some dependencies are missing or do not meet minimum requirements');
    }

    return {
      docker,
      dockerCompose,
      allDependenciesMet,
    };
  }

  /**
   * Parses Docker version from command output
   * @param output Output from 'docker --version' command
   * @returns Parsed version string or null if parsing fails
   * @private
   */
  private parseDockerVersion(output: string): string | null {
    // Expected format: "Docker version 20.10.17, build 100c701"
    const match = output.match(/Docker version (\d+\.\d+\.\d+)/i);
    return match ? match[1] : null;
  }

  /**
   * Parses Docker Compose version from command output
   * @param output Output from 'docker compose version' or 'docker-compose --version' command
   * @returns Parsed version string or null if parsing fails
   * @private
   */
  private parseDockerComposeVersion(output: string): string | null {
    // Expected formats:
    // v2: "Docker Compose version v2.17.2"
    // v1: "docker-compose version 1.29.2, build 5becea4c"
    
    // Try v2 format first (with optional 'v' prefix)
    let match = output.match(/Docker Compose version v?(\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }

    // Try v1 format
    match = output.match(/docker-compose version (\d+\.\d+\.\d+)/i);
    return match ? match[1] : null;
  }

  /**
   * Compares two semantic version strings
   * @param version1 First version string (e.g., "20.10.17")
   * @param version2 Second version string (e.g., "20.10.0")
   * @returns Negative if version1 < version2, 0 if equal, positive if version1 > version2
   * @private
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    // Compare major, minor, patch in order
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part !== v2Part) {
        return v1Part - v2Part;
      }
    }

    return 0; // Versions are equal
  }
}
