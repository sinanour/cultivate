import { describe, it, expect } from '@jest/globals';
import {
  getDeploymentPaths,
  validateMacOSPaths,
  expandHomePath,
  getComposeVolumePaths,
  getUsername,
  DeploymentPathStrategy,
} from './deployment-paths.js';
import { OSDetectionResult } from './os-detector.js';

describe('DeploymentPaths', () => {
  describe('getDeploymentPaths', () => {
    it('should return Linux paths for Linux OS', () => {
      const osResult: OSDetectionResult = {
        distribution: 'ubuntu',
        version: '22.04',
        packageManager: 'apt-get',
        supported: true,
        isMacOS: false,
      };

      const paths = getDeploymentPaths(osResult);

      expect(paths.targetOS).toBe('linux');
      expect(paths.deploymentBasePath).toBe('/opt/cultivate');
      expect(paths.configPath).toBe('/opt/cultivate/config');
      expect(paths.logPath).toBe('/var/log/cultivate');
      expect(paths.volumePath).toBe('/opt/cultivate/volumes');
      expect(paths.vmAccessible).toBe(true);
    });

    it('should return macOS paths for macOS without username', () => {
      const osResult: OSDetectionResult = {
        distribution: 'macos',
        version: '14.0',
        packageManager: 'brew',
        supported: true,
        isMacOS: true,
      };

      const paths = getDeploymentPaths(osResult);

      expect(paths.targetOS).toBe('macos');
      expect(paths.deploymentBasePath).toBe('~/cultivate');
      expect(paths.configPath).toBe('~/cultivate/config');
      expect(paths.logPath).toBe('~/cultivate/logs');
      expect(paths.volumePath).toBe('~/cultivate/volumes');
      expect(paths.vmAccessible).toBe(true);
    });

    it('should return macOS paths with username', () => {
      const osResult: OSDetectionResult = {
        distribution: 'macos',
        version: '14.0',
        packageManager: 'brew',
        supported: true,
        isMacOS: true,
      };

      const paths = getDeploymentPaths(osResult, 'testuser');

      expect(paths.targetOS).toBe('macos');
      expect(paths.deploymentBasePath).toBe('/Users/testuser/cultivate');
      expect(paths.configPath).toBe('/Users/testuser/cultivate/config');
      expect(paths.logPath).toBe('/Users/testuser/cultivate/logs');
      expect(paths.volumePath).toBe('/Users/testuser/cultivate/volumes');
      expect(paths.vmAccessible).toBe(true);
    });

    it('should handle different Linux distributions', () => {
      const distributions: Array<OSDetectionResult['distribution']> = [
        'ubuntu',
        'debian',
        'rhel',
        'centos',
        'fedora',
        'amzn',
      ];

      distributions.forEach(dist => {
        const osResult: OSDetectionResult = {
          distribution: dist,
          packageManager: 'apt-get',
          supported: true,
          isMacOS: false,
        };

        const paths = getDeploymentPaths(osResult);
        expect(paths.targetOS).toBe('linux');
        expect(paths.deploymentBasePath).toBe('/opt/cultivate');
      });
    });
  });

  describe('validateMacOSPaths', () => {
    it('should validate Linux paths without error', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'linux',
        deploymentBasePath: '/opt/cultivate',
        configPath: '/opt/cultivate/config',
        logPath: '/var/log/cultivate',
        volumePath: '/opt/cultivate/volumes',
        vmAccessible: true,
      };

      const result = validateMacOSPaths(paths);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate macOS paths under /Users', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/Users/testuser/cultivate',
        configPath: '/Users/testuser/cultivate/config',
        logPath: '/Users/testuser/cultivate/logs',
        volumePath: '/Users/testuser/cultivate/volumes',
        vmAccessible: true,
      };

      const result = validateMacOSPaths(paths);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject macOS paths under /opt', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/opt/cultivate',
        configPath: '/opt/cultivate/config',
        logPath: '/opt/cultivate/logs',
        volumePath: '/opt/cultivate/volumes',
        vmAccessible: false,
      };

      const result = validateMacOSPaths(paths);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not accessible inside the VM');
      expect(result.error).toContain('/opt/cultivate');
    });

    it('should reject macOS paths under /var', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/Users/testuser/cultivate',
        configPath: '/Users/testuser/cultivate/config',
        logPath: '/var/log/cultivate', // Invalid on macOS
        volumePath: '/Users/testuser/cultivate/volumes',
        vmAccessible: false,
      };

      const result = validateMacOSPaths(paths);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('/var/log/cultivate');
    });

    it('should accept macOS paths under /Volumes', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/Volumes/External/cultivate',
        configPath: '/Volumes/External/cultivate/config',
        logPath: '/Volumes/External/cultivate/logs',
        volumePath: '/Volumes/External/cultivate/volumes',
        vmAccessible: true,
      };

      const result = validateMacOSPaths(paths);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should provide helpful error message with solutions', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/opt/cultivate',
        configPath: '/opt/cultivate/config',
        logPath: '/var/log/cultivate',
        volumePath: '/opt/cultivate/volumes',
        vmAccessible: false,
      };

      const result = validateMacOSPaths(paths);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Solutions:');
      expect(result.error).toContain('/Users/username/cultivate');
      expect(result.error).toContain('symlink');
      expect(result.error).toContain('finch.yaml');
    });
  });

  describe('expandHomePath', () => {
    it('should expand ~ to home directory with username', () => {
      const expanded = expandHomePath('~/cultivate', 'testuser');
      expect(expanded).toBe('/Users/testuser/cultivate');
    });

    it('should expand ~ to home directory without username', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/Users/currentuser';

      const expanded = expandHomePath('~/cultivate');
      expect(expanded).toBe('/Users/currentuser/cultivate');

      process.env.HOME = originalHome;
    });

    it('should not modify paths without ~', () => {
      const path = '/opt/cultivate';
      const expanded = expandHomePath(path, 'testuser');
      expect(expanded).toBe(path);
    });

    it('should handle ~ in middle of path', () => {
      const path = '/opt/~/cultivate';
      const expanded = expandHomePath(path, 'testuser');
      expect(expanded).toBe(path); // Only expands leading ~
    });
  });

  describe('getComposeVolumePaths', () => {
    it('should generate volume paths for Linux', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'linux',
        deploymentBasePath: '/opt/cultivate',
        configPath: '/opt/cultivate/config',
        logPath: '/var/log/cultivate',
        volumePath: '/opt/cultivate/volumes',
        vmAccessible: true,
      };

      const volumePaths = getComposeVolumePaths(paths);

      expect(volumePaths.dbData).toBe('/opt/cultivate/volumes/db_data');
      expect(volumePaths.dbSocket).toBe('/opt/cultivate/volumes/db_socket');
    });

    it('should generate volume paths for macOS', () => {
      const paths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/Users/testuser/cultivate',
        configPath: '/Users/testuser/cultivate/config',
        logPath: '/Users/testuser/cultivate/logs',
        volumePath: '/Users/testuser/cultivate/volumes',
        vmAccessible: true,
      };

      const volumePaths = getComposeVolumePaths(paths);

      expect(volumePaths.dbData).toBe('/Users/testuser/cultivate/volumes/db_data');
      expect(volumePaths.dbSocket).toBe('/Users/testuser/cultivate/volumes/db_socket');
    });
  });

  describe('getUsername', () => {
    it('should return SSH username if provided', () => {
      const username = getUsername('sshuser');
      expect(username).toBe('sshuser');
    });

    it('should return USER environment variable if no SSH username', () => {
      const originalUser = process.env.USER;
      process.env.USER = 'envuser';

      const username = getUsername();
      expect(username).toBe('envuser');

      process.env.USER = originalUser;
    });

    it('should return USERNAME environment variable as fallback', () => {
      const originalUser = process.env.USER;
      const originalUsername = process.env.USERNAME;

      delete process.env.USER;
      process.env.USERNAME = 'winuser';

      const username = getUsername();
      expect(username).toBe('winuser');

      process.env.USER = originalUser;
      process.env.USERNAME = originalUsername;
    });

    it('should return undefined if no username available', () => {
      const originalUser = process.env.USER;
      const originalUsername = process.env.USERNAME;

      delete process.env.USER;
      delete process.env.USERNAME;

      const username = getUsername();
      expect(username).toBeUndefined();

      process.env.USER = originalUser;
      process.env.USERNAME = originalUsername;
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete Linux deployment path workflow', () => {
      const osResult: OSDetectionResult = {
        distribution: 'ubuntu',
        version: '22.04',
        packageManager: 'apt-get',
        supported: true,
        isMacOS: false,
      };

      const paths = getDeploymentPaths(osResult);
      const validation = validateMacOSPaths(paths);
      const volumePaths = getComposeVolumePaths(paths);

      expect(validation.valid).toBe(true);
      expect(paths.deploymentBasePath).toBe('/opt/cultivate');
      expect(volumePaths.dbData).toBe('/opt/cultivate/volumes/db_data');
    });

    it('should handle complete macOS deployment path workflow', () => {
      const osResult: OSDetectionResult = {
        distribution: 'macos',
        version: '14.0',
        packageManager: 'brew',
        supported: true,
        isMacOS: true,
      };

      const username = 'deployuser';
      const paths = getDeploymentPaths(osResult, username);
      const validation = validateMacOSPaths(paths);
      const volumePaths = getComposeVolumePaths(paths);

      expect(validation.valid).toBe(true);
      expect(paths.deploymentBasePath).toBe('/Users/deployuser/cultivate');
      expect(volumePaths.dbData).toBe('/Users/deployuser/cultivate/volumes/db_data');
    });

    it('should detect and reject invalid macOS paths', () => {
      // Manually create invalid paths (simulating misconfiguration)
      const invalidPaths: DeploymentPathStrategy = {
        targetOS: 'macos',
        deploymentBasePath: '/opt/cultivate',
        configPath: '/opt/cultivate/config',
        logPath: '/var/log/cultivate',
        volumePath: '/opt/cultivate/volumes',
        vmAccessible: false,
      };

      const validation = validateMacOSPaths(invalidPaths);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('not accessible inside the VM');
      expect(validation.error).toContain('Solutions:');
    });
  });
});
