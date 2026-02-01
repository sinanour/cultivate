import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

// Create logger instance
const logger = createLogger();

/**
 * Minimum required versions for dependencies
 */
export const MIN_DOCKER_VERSION = '20.10.0';
export const MIN_FINCH_VERSION = '1.0.0'; // Finch uses different versioning
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
 * DependencyChecker class for verifying Docker/Finch and Docker Compose/Finch Compose on remote hosts
 * 
 * Features:
 * - Docker/Finch version detection via SSH
 * - Docker Compose/Finch Compose version detection via SSH
 * - Version comparison against minimum requirements
 * - macOS/Finch support
 * - Proper error handling and logging
 * 
 * Requirements: 8.1, 8.2, 8.5, 8.9, 8.10
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
   * Checks if Docker or Finch is installed and meets minimum version requirements
   * @returns Promise that resolves with Docker/Finch check result
   */
  async checkDocker(): Promise<DependencyCheckResult> {
    logger.info('Checking Docker/Finch installation...');

    try {
      // Try Docker first
      let result = await this.sshClient.executeCommand('docker --version');
      let isFinch = false;

      // If Docker fails, try Finch (for macOS)
      if (result.exitCode !== 0) {
        logger.debug('Docker command failed, trying Finch...');
        // Try multiple possible Finch locations for macOS
        const finchPaths = [
          'finch',                           // In PATH
          '/usr/local/bin/finch',           // Homebrew default
          '/opt/homebrew/bin/finch',        // Homebrew on Apple Silicon
          '$HOME/.finch/bin/finch',         // User installation
        ];

        for (const finchPath of finchPaths) {
          result = await this.sshClient.executeCommand(`${finchPath} --version`);
          if (result.exitCode === 0) {
            isFinch = true;
            logger.debug(`Found Finch at: ${finchPath}`);
            break;
          }
        }
      }

      if (result.exitCode !== 0) {
        logger.warn('Neither Docker nor Finch command succeeded');
        return {
          installed: false,
          meetsMinimum: false,
          error: result.stderr || 'Docker/Finch command returned non-zero exit code',
        };
      }

      // Parse version from output
      // Docker format: "Docker version 20.10.17, build 100c701"
      // Finch format: "finch version v1.0.0"
      const version = this.parseDockerOrFinchVersion(result.stdout);

      if (!version) {
        logger.warn('Could not parse Docker/Finch version from output');
        return {
          installed: true,
          meetsMinimum: false,
          error: 'Could not parse Docker/Finch version',
        };
      }

      // Use appropriate minimum version based on runtime
      const minVersion = isFinch ? MIN_FINCH_VERSION : MIN_DOCKER_VERSION;
      const meetsMinimum = this.compareVersions(version, minVersion) >= 0;

      if (meetsMinimum) {
        const runtime = isFinch ? 'Finch' : 'Docker';
        logger.info(`${runtime} ${version} is installed and meets minimum requirement (${minVersion})`);
      } else {
        const runtime = isFinch ? 'Finch' : 'Docker';
        logger.warn(`${runtime} ${version} is installed but does not meet minimum requirement (${minVersion})`);
      }

      return {
        installed: true,
        version,
        meetsMinimum,
      };
    } catch (err) {
      logger.error(`Error checking Docker/Finch: ${err instanceof Error ? err.message : String(err)}`);
      return {
        installed: false,
        meetsMinimum: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Checks if Docker Compose or Finch Compose is installed and meets minimum version requirements
   * @returns Promise that resolves with Docker Compose/Finch Compose check result
   */
  async checkDockerCompose(): Promise<DependencyCheckResult> {
    logger.info('Checking Docker Compose/Finch Compose installation...');

    try {
      // Try docker compose (v2 - plugin) first
      let result = await this.sshClient.executeCommand('docker compose version');
      let isFinch = false;

      // If that fails, try finch compose (for macOS) with multiple paths
      if (result.exitCode !== 0) {
        logger.debug('docker compose command failed, trying finch compose...');

        const finchPaths = [
          'finch',                           // In PATH
          '/usr/local/bin/finch',           // Homebrew default
          '/opt/homebrew/bin/finch',        // Homebrew on Apple Silicon
          '$HOME/.finch/bin/finch',         // User installation
        ];

        for (const finchPath of finchPaths) {
          // Try 'finch compose version' first
          result = await this.sshClient.executeCommand(`${finchPath} compose version`);
          if (result.exitCode === 0) {
            logger.debug(`Found Finch compose at: ${finchPath}`);
            isFinch = true;
            break;
          }

          // If 'compose version' doesn't work, try just 'finch --version'
          // (Finch includes compose built-in, so finch version = compose version)
          result = await this.sshClient.executeCommand(`${finchPath} --version`);
          if (result.exitCode === 0) {
            logger.debug(`Found Finch at: ${finchPath} (compose is built-in)`);
            isFinch = true;
            break;
          }
        }
      }

      // If that fails, try docker-compose (v1 - standalone) as fallback
      if (result.exitCode !== 0) {
        logger.debug('finch compose command failed, trying docker-compose...');
        result = await this.sshClient.executeCommand('docker-compose --version');
      }

      if (result.exitCode !== 0) {
        logger.warn('Docker Compose/Finch Compose command failed');
        return {
          installed: false,
          meetsMinimum: false,
          error: result.stderr || 'Docker Compose/Finch Compose command returned non-zero exit code',
        };
      }

      // Parse version from output
      // Expected formats:
      // v2: "Docker Compose version v2.17.2"
      // finch: "finch compose version v1.0.0"
      // v1: "docker-compose version 1.29.2, build 5becea4c"
      const version = this.parseDockerComposeVersion(result.stdout);

      if (!version) {
        logger.warn('Could not parse Docker Compose/Finch Compose version from output');
        logger.debug(`Raw output was: ${result.stdout}`);
        return {
          installed: true,
          meetsMinimum: false,
          error: `Could not parse Docker Compose/Finch Compose version. Output: ${result.stdout.substring(0, 100)}`,
        };
      }

      // For Finch, use MIN_FINCH_VERSION since compose is built-in
      // For Docker Compose, use MIN_DOCKER_COMPOSE_VERSION
      const minVersion = isFinch ? MIN_FINCH_VERSION : MIN_DOCKER_COMPOSE_VERSION;
      const meetsMinimum = this.compareVersions(version, minVersion) >= 0;

      if (meetsMinimum) {
        const runtime = isFinch ? 'Finch' : 'Docker Compose';
        logger.info(`${runtime} ${version} is installed and meets minimum requirement (${minVersion})`);
      } else {
        const runtime = isFinch ? 'Finch' : 'Docker Compose';
        logger.warn(`${runtime} ${version} is installed but does not meet minimum requirement (${minVersion})`);
      }

      return {
        installed: true,
        version,
        meetsMinimum,
      };
    } catch (err) {
      logger.error(`Error checking Docker Compose/Finch Compose: ${err instanceof Error ? err.message : String(err)}`);
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
   * Parses Docker or Finch version from command output
   * @param output Output from 'docker --version' or 'finch --version' command
   * @returns Parsed version string or null if parsing fails
   * @private
   */
  private parseDockerOrFinchVersion(output: string): string | null {
    // Docker format: "Docker version 20.10.17, build 100c701"
    let match = output.match(/Docker version (\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }

    // Finch format: "finch version v1.0.0" or "finch version 1.0.0"
    match = output.match(/finch version v?(\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }

    return null;
  }

  /**
   * Parses Docker Compose or Finch Compose version from command output
   * @param output Output from 'docker compose version', 'finch compose version', or 'docker-compose --version' command
   * @returns Parsed version string or null if parsing fails
   * @private
   */
  private parseDockerComposeVersion(output: string): string | null {
    // Expected formats:
    // v2: "Docker Compose version v2.17.2"
    // finch compose: "finch compose version v1.0.0" or just "v1.0.0"
    // finch: "finch version v1.14.1" (when compose is built-in)
    // v1: "docker-compose version 1.29.2, build 5becea4c"

    // Try v2/finch compose format first (with optional 'v' prefix)
    let match = output.match(/(?:Docker Compose|finch compose) version v?(\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }

    // Try standalone finch version (compose is built-in to finch)
    match = output.match(/finch version v?(\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }

    // Try v1 format
    match = output.match(/docker-compose version (\d+\.\d+\.\d+)/i);
    if (match) {
      return match[1];
    }

    // Try generic version pattern as last resort
    match = output.match(/version v?(\d+\.\d+\.\d+)/i);
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
