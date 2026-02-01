import { createLogger } from './logger.js';
import { OSDetectionResult } from './os-detector.js';

const logger = createLogger();

/**
 * Deployment path strategy for different operating systems
 * 
 * On Linux: Uses standard FHS paths (/opt, /var/log)
 * On macOS: Uses home directory paths to ensure Finch VM accessibility
 * 
 * Requirements: 8.9, 8.10, 10.6
 */
export interface DeploymentPathStrategy {
  /** Target operating system */
  targetOS: 'linux' | 'macos';

  /** Base deployment directory */
  deploymentBasePath: string;

  /** Configuration files directory */
  configPath: string;

  /** Log files directory */
  logPath: string;

  /** Docker volumes directory */
  volumePath: string;

  /** Whether paths are VM-accessible (for macOS/Finch) */
  vmAccessible: boolean;
}

/**
 * Gets deployment paths appropriate for the target operating system
 * 
 * @param osResult OS detection result
 * @param username Optional username for home directory path (macOS)
 * @returns Deployment path strategy
 */
export function getDeploymentPaths(
  osResult: OSDetectionResult,
  username?: string
): DeploymentPathStrategy {
  if (osResult.isMacOS) {
    return getMacOSPaths(username);
  } else {
    return getLinuxPaths();
  }
}

/**
 * Gets Linux deployment paths using standard FHS locations
 */
function getLinuxPaths(): DeploymentPathStrategy {
  logger.info('Using Linux deployment paths (FHS standard)');

  return {
    targetOS: 'linux',
    deploymentBasePath: '/opt/cultivate',
    configPath: '/opt/cultivate/config',
    logPath: '/var/log/cultivate',
    volumePath: '/opt/cultivate/volumes',
    vmAccessible: true, // Docker on Linux doesn't use a VM
  };
}

/**
 * Gets macOS deployment paths using home directory
 * 
 * On macOS, Finch runs containers in a Lima VM that only mounts certain
 * host directories by default (typically /Users, sometimes /Volumes).
 * Paths like /opt are NOT mounted, so we use the home directory instead.
 */
function getMacOSPaths(username?: string): DeploymentPathStrategy {
  const homeDir = username ? `/Users/${username}` : '~';
  
  logger.info(`Using macOS deployment paths (home directory: ${homeDir})`);
  logger.info('Note: Finch VM only mounts /Users by default, avoiding /opt paths');

  return {
    targetOS: 'macos',
    deploymentBasePath: `${homeDir}/cultivate`,
    configPath: `${homeDir}/cultivate/config`,
    logPath: `${homeDir}/cultivate/logs`,
    volumePath: `${homeDir}/cultivate/volumes`,
    vmAccessible: true, // Paths under /Users are mounted in Finch VM
  };
}

/**
 * Validates that paths are accessible in the Finch VM (macOS only)
 * 
 * @param paths Deployment path strategy
 * @returns Validation result with error message if invalid
 */
export function validateMacOSPaths(paths: DeploymentPathStrategy): {
  valid: boolean;
  error?: string;
} {
  if (paths.targetOS !== 'macos') {
    return { valid: true };
  }

  // Check if any paths use /opt or other non-mounted directories
  const allPaths = [
    paths.deploymentBasePath,
    paths.configPath,
    paths.logPath,
    paths.volumePath,
  ];

  const invalidPaths = allPaths.filter(p => {
    // Paths starting with /opt, /var, /etc are not mounted in Finch VM
    return p.startsWith('/opt') || 
           p.startsWith('/var') || 
           p.startsWith('/etc') ||
           (p.startsWith('/') && !p.startsWith('/Users') && !p.startsWith('/Volumes'));
  });

  if (invalidPaths.length > 0) {
    const error = `
Error: Cannot access paths on macOS target

Finch runs containers in a Linux VM that only mounts certain host directories.
The following paths are not accessible inside the VM:
${invalidPaths.map(p => `  - ${p}`).join('\n')}

Solutions:
1. Use a path under /Users (recommended):
   DEPLOYMENT_PATH=/Users/username/cultivate

2. Create a symlink in your home directory:
   ln -s /opt/cultivate ~/cultivate
   DEPLOYMENT_PATH=~/cultivate

3. Configure Lima to mount additional directories (advanced):
   Edit ~/.finch/finch.yaml to add paths to mounts

For more information, see: docs/MACOS_DEPLOYMENT.md
    `.trim();

    return { valid: false, error };
  }

  return { valid: true };
}

/**
 * Expands tilde (~) in paths to the actual home directory
 * 
 * @param path Path that may contain ~
 * @param username Username for home directory expansion
 * @returns Expanded path
 */
export function expandHomePath(path: string, username?: string): string {
  if (!path.startsWith('~')) {
    return path;
  }

  const homeDir = username ? `/Users/${username}` : process.env.HOME || '~';
  return path.replace(/^~/, homeDir);
}

/**
 * Generates docker-compose.yml volume paths appropriate for the OS
 * 
 * @param paths Deployment path strategy
 * @returns Volume path configuration for docker-compose.yml
 */
export function getComposeVolumePaths(paths: DeploymentPathStrategy): {
  dbData: string;
  dbSocket: string;
} {
  return {
    dbData: `${paths.volumePath}/db_data`,
    dbSocket: `${paths.volumePath}/db_socket`,
  };
}

/**
 * Gets the username from SSH connection or environment
 * 
 * @param sshUsername SSH username if available
 * @returns Username for path expansion
 */
export function getUsername(sshUsername?: string): string | undefined {
  return sshUsername || process.env.USER || process.env.USERNAME;
}

/**
 * Logs deployment path information for debugging
 * 
 * @param paths Deployment path strategy
 */
export function logDeploymentPaths(paths: DeploymentPathStrategy): void {
  logger.info('Deployment paths configuration:');
  logger.info(`  Target OS: ${paths.targetOS}`);
  logger.info(`  Base path: ${paths.deploymentBasePath}`);
  logger.info(`  Config path: ${paths.configPath}`);
  logger.info(`  Log path: ${paths.logPath}`);
  logger.info(`  Volume path: ${paths.volumePath}`);
  logger.info(`  VM accessible: ${paths.vmAccessible}`);

  if (paths.targetOS === 'macos') {
    logger.info('');
    logger.info('Note: macOS deployment uses home directory paths');
    logger.info('      Finch VM only mounts /Users by default');
  }
}
