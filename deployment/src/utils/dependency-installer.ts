import { SSHClient } from './ssh-client.js';
import { DependencyChecker, MIN_DOCKER_VERSION, MIN_DOCKER_COMPOSE_VERSION } from './dependency-checker.js';
import { OSDetector, type OSDetectionResult } from './os-detector.js';
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
 * DependencyInstaller class for installing Docker/Finch and Docker Compose/Finch Compose on remote hosts
 * 
 * Features:
 * - Automatic OS detection (Linux distributions and macOS)
 * - Multi-distribution support (Ubuntu, Debian, RHEL, CentOS, Fedora, Rocky, AlmaLinux, SLES, openSUSE, Alpine, macOS)
 * - Appropriate package manager selection (apt-get, yum, dnf, zypper, apk, brew)
 * - Docker Compose v2 (plugin) installation
 * - Finch support for macOS with installation guidance
 * - Installation verification using DependencyChecker
 * - Proper error handling and logging
 * 
 * Requirements: 8.3, 8.4, 8.6, 8.7, 8.8, 8.9, 8.10
 */
export class DependencyInstaller {
  private sshClient: SSHClient;
  private dependencyChecker: DependencyChecker;
  private osDetector: OSDetector;
  private osInfo?: OSDetectionResult;

  /**
   * Creates a new DependencyInstaller instance
   * @param sshClient Connected SSH client for remote command execution
   */
  constructor(sshClient: SSHClient) {
    this.sshClient = sshClient;
    this.dependencyChecker = new DependencyChecker(sshClient);
    this.osDetector = new OSDetector(sshClient);
  }

  /**
   * Detects the target OS if not already detected
   */
  private async ensureOSDetected(): Promise<OSDetectionResult> {
    if (!this.osInfo) {
      this.osInfo = await this.osDetector.detectOS();

      if (!this.osInfo.supported) {
        throw new Error(
          this.osInfo.error ||
          `Unsupported OS distribution: ${this.osInfo.distribution}. ` +
          `Supported distributions: Ubuntu, Debian, RHEL, CentOS, Fedora, Rocky, AlmaLinux, SLES, openSUSE, Alpine, macOS`
        );
      }
    }
    return this.osInfo;
  }

  /**
   * Installs Docker or Finch using the appropriate method for the detected OS
   * @returns Promise that resolves with installation result
   */
  async installDocker(): Promise<InstallationResult> {
    logger.info('Starting Docker/Finch installation...');

    try {
      // Detect OS first
      const osInfo = await this.ensureOSDetected();
      logger.info(`Installing Docker/Finch on ${osInfo.distribution} using ${osInfo.packageManager}`);

      // Check if Docker/Finch is already installed and meets requirements
      const checkResult = await this.dependencyChecker.checkDocker();
      
      if (checkResult.installed && checkResult.meetsMinimum) {
        logger.info(`Docker/Finch ${checkResult.version} is already installed and meets requirements`);
        return {
          success: true,
          installed: false,
          version: checkResult.version,
          message: `Docker/Finch ${checkResult.version} is already installed`,
        };
      }

      if (checkResult.installed && !checkResult.meetsMinimum) {
        logger.warn(`Docker/Finch ${checkResult.version} is installed but does not meet minimum requirement (${MIN_DOCKER_VERSION})`);
        logger.info('Proceeding with Docker/Finch upgrade...');
      }

      // Handle macOS separately
      if (osInfo.isMacOS) {
        return await this.handleMacOSFinch();
      }

      // Install Docker based on package manager for Linux
      switch (osInfo.packageManager) {
        case 'apt-get':
          return await this.installDockerApt(osInfo);
        case 'yum':
        case 'dnf':
          // Use Amazon Linux specific installation for amzn distribution
          if (osInfo.distribution === 'amzn') {
            return await this.installDockerAmazonLinux(osInfo);
          }
          return await this.installDockerYum(osInfo);
        case 'zypper':
          return await this.installDockerZypper(osInfo);
        case 'apk':
          return await this.installDockerApk(osInfo);
        default:
          throw new Error(`Unsupported package manager: ${osInfo.packageManager}`);
      }
    } catch (err) {
      const errorMsg = `Docker/Finch installation failed: ${err instanceof Error ? err.message : String(err)}`;
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
   * Handles Finch installation/verification on macOS
   */
  private async handleMacOSFinch(): Promise<InstallationResult> {
    logger.info('Handling Finch on macOS...');

    // Check if Finch is installed in common locations
    const finchPaths = [
      'finch',                           // In PATH
      '/usr/local/bin/finch',           // Homebrew default
      '/opt/homebrew/bin/finch',        // Homebrew on Apple Silicon
      '$HOME/.finch/bin/finch',         // User installation
    ];

    let finchFound = false;
    for (const finchPath of finchPaths) {
      const finchCheck = await this.sshClient.executeCommand(`command -v ${finchPath} || ${finchPath} --version`);
      if (finchCheck.exitCode === 0) {
        finchFound = true;
        logger.info(`Found Finch at: ${finchPath}`);
        break;
      }
    }

    if (finchFound) {
      // Finch is installed, verify it
      return await this.verifyDockerInstallation();
    }

    // Finch is not installed, provide installation instructions
    const installInstructions = `
Finch is not installed on the target macOS system.

To install Finch, run the following commands on the target host:

  # Using Homebrew:
  brew install --cask finch

  # Or download from GitHub:
  # https://github.com/runfinch/finch/releases

After installation, initialize Finch:
  finch vm init

Then re-run the deployment script.
`;

    logger.warn('Finch not found on macOS target');
    logger.info(installInstructions);

    return {
      success: false,
      installed: false,
      error: 'Finch not installed on macOS target',
      message: installInstructions.trim(),
    };
  }

  /**
   * Installs Docker on Debian/Ubuntu systems using apt-get
   */
  private async installDockerApt(osInfo: OSDetectionResult): Promise<InstallationResult> {
    logger.info('Installing Docker using apt-get...');

    try {
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

      const distro = osInfo.distribution === 'ubuntu' ? 'ubuntu' : 'debian';
      await this.sshClient.executeCommandSimple(
        `curl -fsSL https://download.docker.com/linux/${distro}/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg`
      );

      // Step 4: Set up Docker repository
      logger.info('Setting up Docker repository...');
      const repoSetupCommand = `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${distro} $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null`;
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

      return await this.verifyDockerInstallation();
    } catch (err) {
      throw new Error(`apt-get installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker on RHEL/CentOS/Fedora systems using yum/dnf
   */
  private async installDockerYum(osInfo: OSDetectionResult): Promise<InstallationResult> {
    logger.info(`Installing Docker using ${osInfo.packageManager}...`);
    const pm = osInfo.packageManager; // yum or dnf

    try {
      // Step 1: Remove old versions
      logger.info('Removing old Docker versions...');
      await this.sshClient.executeCommand(
        `sudo ${pm} remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine`
      );

      // Step 2: Install prerequisites
      logger.info('Installing prerequisites...');
      await this.sshClient.executeCommandSimple(`sudo ${pm} install -y yum-utils`);

      // Step 3: Add Docker repository
      logger.info('Adding Docker repository...');
      await this.sshClient.executeCommandSimple(
        'sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo'
      );

      // Step 4: Install Docker Engine
      logger.info('Installing Docker Engine...');
      await this.sshClient.executeCommandSimple(
        `sudo ${pm} install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`
      );

      // Step 5: Start and enable Docker service
      logger.info('Starting Docker service...');
      await this.sshClient.executeCommandSimple('sudo systemctl start docker');
      await this.sshClient.executeCommandSimple('sudo systemctl enable docker');

      return await this.verifyDockerInstallation();
    } catch (err) {
      throw new Error(`${pm} installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker on Amazon Linux systems
   * Amazon Linux has Docker available in the default repositories
   */
  private async installDockerAmazonLinux(osInfo: OSDetectionResult): Promise<InstallationResult> {
    logger.info(`Installing Docker on Amazon Linux using ${osInfo.packageManager}...`);
    const pm = osInfo.packageManager; // yum or dnf

    try {
      // Amazon Linux has Docker in the default repos, so installation is simpler
      logger.info('Updating package index...');
      await this.sshClient.executeCommandSimple(`sudo ${pm} update -y`);

      // Install Docker directly from Amazon Linux repos
      logger.info('Installing Docker from Amazon Linux repository...');
      await this.sshClient.executeCommandSimple(`sudo ${pm} install -y docker`);

      // Start and enable Docker service
      logger.info('Starting Docker service...');
      await this.sshClient.executeCommandSimple('sudo systemctl start docker');
      await this.sshClient.executeCommandSimple('sudo systemctl enable docker');

      return await this.verifyDockerInstallation();
    } catch (err) {
      throw new Error(`Amazon Linux installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker on SUSE systems using zypper
   */
  private async installDockerZypper(_osInfo: OSDetectionResult): Promise<InstallationResult> {
    logger.info('Installing Docker using zypper...');

    try {
      // Step 1: Remove old versions
      logger.info('Removing old Docker versions...');
      await this.sshClient.executeCommand(
        'sudo zypper remove -y docker docker-engine'
      );

      // Step 2: Add Docker repository
      logger.info('Adding Docker repository...');
      await this.sshClient.executeCommandSimple(
        'sudo zypper addrepo https://download.docker.com/linux/sles/docker-ce.repo'
      );

      // Step 3: Refresh repositories
      logger.info('Refreshing repositories...');
      await this.sshClient.executeCommandSimple('sudo zypper refresh');

      // Step 4: Install Docker Engine
      logger.info('Installing Docker Engine...');
      await this.sshClient.executeCommandSimple(
        'sudo zypper install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin'
      );

      // Step 5: Start and enable Docker service
      logger.info('Starting Docker service...');
      await this.sshClient.executeCommandSimple('sudo systemctl start docker');
      await this.sshClient.executeCommandSimple('sudo systemctl enable docker');

      return await this.verifyDockerInstallation();
    } catch (err) {
      throw new Error(`zypper installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker on Alpine systems using apk
   */
  private async installDockerApk(_osInfo: OSDetectionResult): Promise<InstallationResult> {
    logger.info('Installing Docker using apk...');

    try {
      // Step 1: Update package index
      logger.info('Updating package index...');
      await this.sshClient.executeCommandSimple('sudo apk update');

      // Step 2: Install Docker
      logger.info('Installing Docker...');
      await this.sshClient.executeCommandSimple('sudo apk add docker docker-compose');

      // Step 3: Start and enable Docker service
      logger.info('Starting Docker service...');
      await this.sshClient.executeCommandSimple('sudo rc-update add docker boot');
      await this.sshClient.executeCommandSimple('sudo service docker start');

      return await this.verifyDockerInstallation();
    } catch (err) {
      throw new Error(`apk installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Verifies Docker installation
   */
  private async verifyDockerInstallation(): Promise<InstallationResult> {
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
  }

  /**
   * Installs Docker Compose or Finch Compose using the appropriate method for the detected OS
   * @returns Promise that resolves with installation result
   */
  async installDockerCompose(): Promise<InstallationResult> {
    logger.info('Starting Docker Compose/Finch Compose installation...');

    try {
      // Detect OS first
      const osInfo = await this.ensureOSDetected();
      logger.info(`Installing Docker Compose/Finch Compose on ${osInfo.distribution} using ${osInfo.packageManager}`);

      // Check if Docker Compose/Finch Compose is already installed and meets requirements
      const checkResult = await this.dependencyChecker.checkDockerCompose();
      
      if (checkResult.installed && checkResult.meetsMinimum) {
        logger.info(`Docker Compose/Finch Compose ${checkResult.version} is already installed and meets requirements`);
        return {
          success: true,
          installed: false,
          version: checkResult.version,
          message: `Docker Compose/Finch Compose ${checkResult.version} is already installed`,
        };
      }

      if (checkResult.installed && !checkResult.meetsMinimum) {
        logger.warn(`Docker Compose/Finch Compose ${checkResult.version} is installed but does not meet minimum requirement (${MIN_DOCKER_COMPOSE_VERSION})`);
        logger.info('Proceeding with Docker Compose/Finch Compose upgrade...');
      }

      // Handle macOS separately - Finch includes compose built-in
      if (osInfo.isMacOS) {
        // Finch includes compose, so just verify it
        return await this.verifyDockerComposeInstallation();
      }

      // Install Docker Compose based on package manager for Linux
      switch (osInfo.packageManager) {
        case 'apt-get':
          return await this.installDockerComposeApt();
        case 'yum':
        case 'dnf':
          // Use Amazon Linux specific installation for amzn distribution
          if (osInfo.distribution === 'amzn') {
            return await this.installDockerComposeAmazonLinux(osInfo);
          }
          return await this.installDockerComposeYum(osInfo.packageManager);
        case 'zypper':
          return await this.installDockerComposeZypper();
        case 'apk':
          // Docker Compose is installed with Docker on Alpine
          return await this.verifyDockerComposeInstallation();
        default:
          throw new Error(`Unsupported package manager: ${osInfo.packageManager}`);
      }
    } catch (err) {
      const errorMsg = `Docker Compose/Finch Compose installation failed: ${err instanceof Error ? err.message : String(err)}`;
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
   * Installs Docker Compose on Debian/Ubuntu using apt-get
   */
  private async installDockerComposeApt(): Promise<InstallationResult> {
    logger.info('Installing Docker Compose plugin using apt-get...');

    try {
      // Update package index
      await this.sshClient.executeCommandSimple('sudo apt-get update');

      // Install docker-compose-plugin
      await this.sshClient.executeCommandSimple(
        'sudo apt-get install -y docker-compose-plugin'
      );

      return await this.verifyDockerComposeInstallation();
    } catch (err) {
      throw new Error(`apt-get installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker Compose on RHEL/CentOS/Fedora using yum/dnf
   */
  private async installDockerComposeYum(packageManager: 'yum' | 'dnf'): Promise<InstallationResult> {
    logger.info(`Installing Docker Compose plugin using ${packageManager}...`);

    try {
      // Docker Compose plugin should be installed with docker-ce
      // If not, install it explicitly
      await this.sshClient.executeCommandSimple(
        `sudo ${packageManager} install -y docker-compose-plugin`
      );

      return await this.verifyDockerComposeInstallation();
    } catch (err) {
      throw new Error(`${packageManager} installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker Compose on SUSE systems using zypper
   */
  private async installDockerComposeZypper(): Promise<InstallationResult> {
    logger.info('Installing Docker Compose plugin using zypper...');

    try {
      // Install docker-compose-plugin
      await this.sshClient.executeCommandSimple(
        'sudo zypper install -y docker-compose-plugin'
      );

      return await this.verifyDockerComposeInstallation();
    } catch (err) {
      throw new Error(`zypper installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Installs Docker Compose on Amazon Linux systems
   * For AL2023, docker-compose is available in the repos
   * For AL2, we may need to install it via pip or download binary
   */
  private async installDockerComposeAmazonLinux(osInfo: OSDetectionResult): Promise<InstallationResult> {
    logger.info(`Installing Docker Compose on Amazon Linux using ${osInfo.packageManager}...`);
    const pm = osInfo.packageManager;

    try {
      // Try installing from repos first (works on AL2023)
      logger.info('Attempting to install docker-compose from repository...');
      try {
        await this.sshClient.executeCommandSimple(`sudo ${pm} install -y docker-compose-plugin`);
        return await this.verifyDockerComposeInstallation();
      } catch (repoErr) {
        logger.warn('docker-compose-plugin not available in repos, trying alternative method...');
      }

      // Fallback: Install standalone docker-compose binary
      logger.info('Installing standalone docker-compose binary...');
      const composeVersion = '2.24.0'; // Latest stable version
      await this.sshClient.executeCommandSimple(
        `sudo curl -L "https://github.com/docker/compose/releases/download/v${composeVersion}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose`
      );
      await this.sshClient.executeCommandSimple('sudo chmod +x /usr/local/bin/docker-compose');

      // Create symlink for docker compose (v2 style)
      await this.sshClient.executeCommand(
        'sudo ln -sf /usr/local/bin/docker-compose /usr/local/bin/docker-compose'
      );

      return await this.verifyDockerComposeInstallation();
    } catch (err) {
      throw new Error(`Amazon Linux installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Verifies Docker Compose installation
   */
  private async verifyDockerComposeInstallation(): Promise<InstallationResult> {
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
