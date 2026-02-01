import { SSHClient } from './ssh-client.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Supported operating system distributions
 */
export type OSDistribution = 
  | 'ubuntu' 
  | 'debian' 
  | 'rhel' 
  | 'centos' 
  | 'fedora' 
  | 'rocky' 
  | 'alma'
  | 'amzn'
  | 'sles' 
  | 'opensuse' 
  | 'alpine'
  | 'macos'
  | 'unknown';

/**
 * Package manager types
 */
export type PackageManager = 'apt-get' | 'yum' | 'dnf' | 'zypper' | 'apk' | 'brew';

/**
 * OS detection result
 */
export interface OSDetectionResult {
  distribution: OSDistribution;
  version?: string;
  packageManager: PackageManager;
  supported: boolean;
  isMacOS?: boolean;
  error?: string;
}

/**
 * OSDetector class for detecting target host operating system
 * 
 * Features:
 * - Detects Linux distribution from /etc/os-release
 * - Detects macOS using uname command
 * - Falls back to legacy detection methods for Linux
 * - Determines appropriate package manager
 * - Validates OS is supported for Docker/Finch installation
 * 
 * Requirements: 8.6, 8.7, 8.8, 8.9
 */
export class OSDetector {
  private sshClient: SSHClient;

  constructor(sshClient: SSHClient) {
    this.sshClient = sshClient;
  }

  /**
   * Detects the operating system distribution on the target host
   * @returns Promise that resolves with OS detection result
   */
  async detectOS(): Promise<OSDetectionResult> {
    logger.info('Detecting target host operating system...');

    try {
      // Try macOS detection first
      const macOSResult = await this.detectMacOS();
      if (macOSResult.supported) {
        logger.info(`Detected OS: macOS ${macOSResult.version}`);
        return macOSResult;
      }

      // Try modern /etc/os-release for Linux distributions
      const osReleaseResult = await this.detectFromOSRelease();
      if (osReleaseResult.supported) {
        logger.info(`Detected OS: ${osReleaseResult.distribution} (${osReleaseResult.packageManager})`);
        return osReleaseResult;
      }

      // Fall back to legacy detection methods
      const legacyResult = await this.detectFromLegacyFiles();
      if (legacyResult.supported) {
        logger.info(`Detected OS: ${legacyResult.distribution} (${legacyResult.packageManager})`);
        return legacyResult;
      }

      // Unable to detect supported OS
      const error = 'Unable to detect supported operating system';
      logger.error(error);
      return {
        distribution: 'unknown',
        packageManager: 'apt-get', // Default fallback
        supported: false,
        error
      };
    } catch (err) {
      const error = `OS detection failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(error);
      return {
        distribution: 'unknown',
        packageManager: 'apt-get',
        supported: false,
        error
      };
    }
  }

  /**
   * Detects macOS using uname command
   */
  private async detectMacOS(): Promise<OSDetectionResult> {
    try {
      // Check if running on macOS using uname
      const unameResult = await this.sshClient.executeCommand('uname');

      if (unameResult.exitCode === 0 && unameResult.stdout.trim() === 'Darwin') {
        // Get macOS version
        const versionResult = await this.sshClient.executeCommand('sw_vers -productVersion');
        const version = versionResult.exitCode === 0 ? versionResult.stdout.trim() : undefined;

        logger.info(`Detected macOS ${version || 'unknown version'}`);

        return {
          distribution: 'macos',
          version,
          packageManager: 'brew',
          supported: true,
          isMacOS: true
        };
      }

      return {
        distribution: 'unknown',
        packageManager: 'apt-get',
        supported: false
      };
    } catch (err) {
      logger.debug(`Failed to detect macOS: ${err}`);
      return {
        distribution: 'unknown',
        packageManager: 'apt-get',
        supported: false
      };
    }
  }

  /**
   * Detects OS from /etc/os-release file (modern method)
   */
  private async detectFromOSRelease(): Promise<OSDetectionResult> {
    try {
      // Check if /etc/os-release exists
      const checkResult = await this.sshClient.executeCommand('test -f /etc/os-release && echo "exists"');
      
      if (!checkResult.stdout.includes('exists')) {
        return {
          distribution: 'unknown',
          packageManager: 'apt-get',
          supported: false
        };
      }

      // Read /etc/os-release
      const osReleaseResult = await this.sshClient.executeCommand('cat /etc/os-release');
      const osRelease = osReleaseResult.stdout;

      // Parse ID and VERSION_ID
      const idMatch = osRelease.match(/^ID=["']?([^"'\n]+)["']?/m);
      const versionMatch = osRelease.match(/^VERSION_ID=["']?([^"'\n]+)["']?/m);

      if (!idMatch) {
        return {
          distribution: 'unknown',
          packageManager: 'apt-get',
          supported: false
        };
      }

      const distribution = idMatch[1].toLowerCase() as OSDistribution;
      const version = versionMatch ? versionMatch[1] : undefined;

      // Determine package manager and support
      return this.mapDistributionToPackageManager(distribution, version);
    } catch (err) {
      logger.debug(`Failed to detect from /etc/os-release: ${err}`);
      return {
        distribution: 'unknown',
        packageManager: 'apt-get',
        supported: false
      };
    }
  }

  /**
   * Detects OS from legacy files (fallback method)
   */
  private async detectFromLegacyFiles(): Promise<OSDetectionResult> {
    try {
      // Check for Red Hat-based systems
      const rhelCheck = await this.sshClient.executeCommand('test -f /etc/redhat-release && echo "exists"');
      if (rhelCheck.stdout.includes('exists')) {
        // Determine if it's RHEL, CentOS, Fedora, etc.
        const releaseContent = await this.sshClient.executeCommand('cat /etc/redhat-release');
        const content = releaseContent.stdout.toLowerCase();

        if (content.includes('fedora')) {
          return this.mapDistributionToPackageManager('fedora');
        } else if (content.includes('centos')) {
          return this.mapDistributionToPackageManager('centos');
        } else {
          return this.mapDistributionToPackageManager('rhel');
        }
      }

      // Check for Debian-based systems
      const debianCheck = await this.sshClient.executeCommand('test -f /etc/debian_version && echo "exists"');
      if (debianCheck.stdout.includes('exists')) {
        return this.mapDistributionToPackageManager('debian');
      }

      // Unable to detect
      return {
        distribution: 'unknown',
        packageManager: 'apt-get',
        supported: false
      };
    } catch (err) {
      logger.debug(`Failed to detect from legacy files: ${err}`);
      return {
        distribution: 'unknown',
        packageManager: 'apt-get',
        supported: false
      };
    }
  }

  /**
   * Maps distribution to package manager and determines support
   */
  private mapDistributionToPackageManager(
    distribution: OSDistribution,
    version?: string
  ): OSDetectionResult {
    switch (distribution) {
      case 'macos':
        return {
          distribution,
          version,
          packageManager: 'brew',
          supported: true,
          isMacOS: true
        };

      case 'ubuntu':
      case 'debian':
        return {
          distribution,
          version,
          packageManager: 'apt-get',
          supported: true
        };

      case 'amzn':
        // Amazon Linux uses yum (AL1) or dnf (AL2023)
        // AL2023 uses dnf, AL2 uses yum
        const useYumForAL = version && (version.startsWith('2.') || version === '2');
        return {
          distribution,
          version,
          packageManager: useYumForAL ? 'yum' : 'dnf',
          supported: true
        };

      case 'rhel':
      case 'centos':
      case 'rocky':
      case 'alma':
        // Use dnf for version 8+, yum for older versions
        const useYum = version && parseInt(version) < 8;
        return {
          distribution,
          version,
          packageManager: useYum ? 'yum' : 'dnf',
          supported: true
        };

      case 'fedora':
        return {
          distribution,
          version,
          packageManager: 'dnf',
          supported: true
        };

      case 'sles':
      case 'opensuse':
        return {
          distribution,
          version,
          packageManager: 'zypper',
          supported: true
        };

      case 'alpine':
        return {
          distribution,
          version,
          packageManager: 'apk',
          supported: true
        };

      default:
        return {
          distribution,
          version,
          packageManager: 'apt-get', // Default fallback
          supported: false,
          error: `Unsupported distribution: ${distribution}. Supported: Ubuntu, Debian, RHEL, CentOS, Fedora, Rocky, AlmaLinux, Amazon Linux, SLES, openSUSE, Alpine, macOS`
        };
    }
  }

  /**
   * Checks if a specific package manager is available
   */
  async checkPackageManager(packageManager: PackageManager): Promise<boolean> {
    try {
      const result = await this.sshClient.executeCommand(`command -v ${packageManager}`);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}
