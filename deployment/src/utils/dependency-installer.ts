import { SSHClient } from './ssh-client.js';
import { DependencyChecker, MIN_DOCKER_VERSION, MIN_DOCKER_COMPOSE_VERSION } from './dependency-checker.js';
import { createLogger } from './logger.js';

// Create logger instance
const logger = createLogger();

/**
 * Result of a dependency installation
 */
export interface InstallationResult {
  success: boolean;
  installed: boolean;
  version?: string;
  error?: string;
  message: string;
}

/**
 * Result of installing all dependencies
 */
export interface InstallationSummary {
  docker: InstallationResult;
  dockerCompose: InstallationResult;
  allSuccessful: boolean;
}

/**
 * DependencyInstaller class for installing Docker and Docker Compose on remote hosts
 * 
 * Features:
 * - Docker installation for Ubuntu/Debian systems
 * - Docker Compose v2 (plugin) installation
 * - Installation verification using DependencyChecker
 * - Proper error handling and logging
 * 
 * Requirements: 8.3, 8.4
 */
export class DependencyInstaller {
  private sshClient: SSHClient;
  private dependencyChecker: DependencyChecker;

  /**
   * Creates a new DependencyInstaller instance
   * @param sshClient Connected SSH client for remote command execution
   */
  constructor(sshClient: SSHClient) {
    this.sshClient = sshClient;
    this.dependencyChecker = new DependencyChecker(sshClient);
  }

  /**
   * Installs Docker on Ubuntu/Debian systems using the official Docker repository
   * @returns Promise that resolves with installation result
   */
  async installDocker(): Promise<InstallationResult> {
    logger.info('Starting Docker installation...');

    try {
      // Check if Docker is already installed and meets requirements
      const checkResult = await this.dependencyChecker.checkDocker();
      
      if (checkResult.installed && checkResult.meetsMinimum) {
        logger.info(`Docker ${checkResult.version} is already installed and meets requirements`);
        return {
          success: true,
          installed: false,
          version: checkResult.version,
          message: `Docker ${checkResult.version} is already installed`,
        };
      }

      if (checkResult.installed && !checkResult.meetsMinimum) {
        logger.warn(`Docker ${checkResult.version} is installed but does not meet minimum requirement (${MIN_DOCKER_VERSION})`);
        logger.info('Proceeding with Docker upgrade...');
      }

      // Step 1: Update package index
      logger.info('Updating package index...');
      await this.sshClient.executeCommandSimple('sudo apt-get update');

      // Step 2: Install prerequisites
      logger.info('Installing prerequisites...');
      const prerequisites = [
        'ca-certificates',
        'curl',
        'gnupg',
        'lsb-release',
      ];
      await this.sshClient.executeCommandSimple(
        `sudo apt-get install -y ${prerequisites.join(' ')}`
      );

      // Step 3: Add Docker's official GPG key
      logger.info('Adding Docker GPG key...');
      await this.sshClient.executeCommandSimple(
        'sudo mkdir -p /etc/apt/keyrings'
      );
      await this.sshClient.executeCommandSimple(
        'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg'
      );

      // Step 4: Set up Docker repository
      logger.info('Setting up Docker repository...');
      const repoSetupCommand = `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null`;
      await this.sshClient.executeCommandSimple(repoSetupCommand);

      // Step 5: Update package index again
      logger.info('Updating package index with Docker repository...');
      await this.sshClient.executeCommandSimple('sudo apt-get update');

      // Step 6: Install Docker Engine
      logger.info('Installing Docker Engine...');
      const dockerPackages = [
        'docker-ce',
        'docker-ce-cli',
        'containerd.io',
        'docker-buildx-plugin',
      ];
      await this.sshClient.executeCommandSimple(
        `sudo apt-get install -y ${dockerPackages.join(' ')}`
      );

      // Step 7: Start and enable Docker service
      logger.info('Starting Docker service...');
      await this.sshClient.executeCommandSimple('sudo systemctl start docker');
      await this.sshClient.executeCommandSimple('sudo systemctl enable docker');

      // Step 8: Verify installation
      logger.info('Verifying Docker installation...');
      const verifyResult = await this.dependencyChecker.checkDocker();

      if (!verifyResult.installed || !verifyResult.meetsMinimum) {
        const errorMsg = 'Docker installation verification failed';
        logger.error(errorMsg);
        return {
          success: false,
          installed: true,
          version: verifyResult.version,
          error: verifyResult.error || errorMsg,
          message: errorMsg,
        };
      }

      logger.info(`Docker ${verifyResult.version} installed successfully`);
      return {
        success: true,
        installed: true,
        version: verifyResult.version,
        message: `Docker ${verifyResult.version} installed successfully`,
      };
    } catch (err) {
      const errorMsg = `Docker installation failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(errorMsg);
      return {
        success: false,
        installed: false,
        error: err instanceof Error ? err.message : String(err),
        message: errorMsg,
      };
    }
  }

  /**
   * Installs Docker Compose v2 (plugin) on Ubuntu/Debian systems
   * @returns Promise that resolves with installation result
   */
  async installDockerCompose(): Promise<InstallationResult> {
    logger.info('Starting Docker Compose installation...');

    try {
      // Check if Docker Compose is already installed and meets requirements
      const checkResult = await this.dependencyChecker.checkDockerCompose();
      
      if (checkResult.installed && checkResult.meetsMinimum) {
        logger.info(`Docker Compose ${checkResult.version} is already installed and meets requirements`);
        return {
          success: true,
          installed: false,
          version: checkResult.version,
          message: `Docker Compose ${checkResult.version} is already installed`,
        };
      }

      if (checkResult.installed && !checkResult.meetsMinimum) {
        logger.warn(`Docker Compose ${checkResult.version} is installed but does not meet minimum requirement (${MIN_DOCKER_COMPOSE_VERSION})`);
        logger.info('Proceeding with Docker Compose upgrade...');
      }

      // Docker Compose v2 is installed as a Docker plugin
      // It should be installed with docker-ce, but we'll ensure it's present
      logger.info('Installing Docker Compose plugin...');
      
      // Update package index
      await this.sshClient.executeCommandSimple('sudo apt-get update');

      // Install docker-compose-plugin
      await this.sshClient.executeCommandSimple(
        'sudo apt-get install -y docker-compose-plugin'
      );

      // Verify installation
      logger.info('Verifying Docker Compose installation...');
      const verifyResult = await this.dependencyChecker.checkDockerCompose();

      if (!verifyResult.installed || !verifyResult.meetsMinimum) {
        const errorMsg = 'Docker Compose installation verification failed';
        logger.error(errorMsg);
        return {
          success: false,
          installed: true,
          version: verifyResult.version,
          error: verifyResult.error || errorMsg,
          message: errorMsg,
        };
      }

      logger.info(`Docker Compose ${verifyResult.version} installed successfully`);
      return {
        success: true,
        installed: true,
        version: verifyResult.version,
        message: `Docker Compose ${verifyResult.version} installed successfully`,
      };
    } catch (err) {
      const errorMsg = `Docker Compose installation failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(errorMsg);
      return {
        success: false,
        installed: false,
        error: err instanceof Error ? err.message : String(err),
        message: errorMsg,
      };
    }
  }

  /**
   * Installs all dependencies (Docker and Docker Compose)
   * @returns Promise that resolves with summary of all installations
   */
  async installAllDependencies(): Promise<InstallationSummary> {
    logger.info('Starting installation of all dependencies...');

    // Install Docker first (Docker Compose depends on it)
    const docker = await this.installDocker();

    // Only install Docker Compose if Docker installation was successful
    let dockerCompose: InstallationResult;
    if (docker.success) {
      dockerCompose = await this.installDockerCompose();
    } else {
      logger.error('Skipping Docker Compose installation due to Docker installation failure');
      dockerCompose = {
        success: false,
        installed: false,
        error: 'Docker installation failed',
        message: 'Skipped due to Docker installation failure',
      };
    }

    const allSuccessful = docker.success && dockerCompose.success;

    if (allSuccessful) {
      logger.info('All dependencies installed successfully');
    } else {
      logger.warn('Some dependencies failed to install');
    }

    return {
      docker,
      dockerCompose,
      allSuccessful,
    };
  }

  /**
   * Checks and installs missing dependencies
   * This is a convenience method that checks first and only installs what's needed
   * @returns Promise that resolves with summary of installations
   */
  async ensureDependencies(): Promise<InstallationSummary> {
    logger.info('Ensuring all dependencies are installed...');

    // Check current state
    const checkSummary = await this.dependencyChecker.checkAllDependencies();

    // If all dependencies are met, no installation needed
    if (checkSummary.allDependenciesMet) {
      logger.info('All dependencies are already installed and meet requirements');
      return {
        docker: {
          success: true,
          installed: false,
          version: checkSummary.docker.version,
          message: `Docker ${checkSummary.docker.version} is already installed`,
        },
        dockerCompose: {
          success: true,
          installed: false,
          version: checkSummary.dockerCompose.version,
          message: `Docker Compose ${checkSummary.dockerCompose.version} is already installed`,
        },
        allSuccessful: true,
      };
    }

    // Install missing or outdated dependencies
    return await this.installAllDependencies();
  }
}
