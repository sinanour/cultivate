/**
 * Unit tests for Deployment State Tracking Module
 */

import * as fs from 'fs';
import * as path from 'path';
import { DeploymentStateManager } from './deployment-state';
import { DeploymentState, DeploymentConfiguration } from '../types/deployment';

describe('DeploymentStateManager', () => {
  let stateManager: DeploymentStateManager;
  let testStateDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    testStateDir = path.join(__dirname, '../../test-state-' + Date.now());
    stateManager = new DeploymentStateManager(testStateDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testStateDir)) {
      const files = fs.readdirSync(testStateDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testStateDir, file));
      });
      fs.rmdirSync(testStateDir);
    }
  });

  describe('initialize', () => {
    it('should create state directory if it does not exist', async () => {
      await stateManager.initialize();
      expect(fs.existsSync(testStateDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await stateManager.initialize();
      await expect(stateManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('saveCurrentState and loadCurrentState', () => {
    it('should save and load deployment state correctly', async () => {
      const state: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: [
          {
            service: 'frontend',
            status: 'healthy',
            timestamp: new Date('2024-01-01T00:01:00Z'),
            message: 'OK'
          }
        ]
      };

      await stateManager.saveCurrentState(state);
      const loaded = await stateManager.loadCurrentState();

      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(state.version);
      expect(loaded?.targetHost).toBe(state.targetHost);
      expect(loaded?.imageVersions).toEqual(state.imageVersions);
      expect(loaded?.configurationHash).toBe(state.configurationHash);
      expect(loaded?.status).toBe(state.status);
      expect(loaded?.healthChecks).toHaveLength(1);
      expect(loaded?.healthChecks[0].service).toBe('frontend');
    });

    it('should return null when no current state exists', async () => {
      const loaded = await stateManager.loadCurrentState();
      expect(loaded).toBeNull();
    });

    it('should preserve timestamps as Date objects', async () => {
      const state: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: []
      };

      await stateManager.saveCurrentState(state);
      const loaded = await stateManager.loadCurrentState();

      expect(loaded?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('savePreviousState and loadPreviousState', () => {
    it('should move current state to previous when saving new state', async () => {
      const firstState: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: []
      };

      const secondState: DeploymentState = {
        ...firstState,
        version: '2.0.0',
        timestamp: new Date('2024-01-02T00:00:00Z'),
        imageVersions: {
          frontend: 'frontend:2.0.0',
          backend: 'backend:2.0.0',
          database: 'database:2.0.0'
        }
      };

      // Save first state
      await stateManager.saveCurrentState(firstState);

      // Save second state (should move first to previous)
      await stateManager.saveCurrentState(secondState);

      // Load both states
      const current = await stateManager.loadCurrentState();
      const previous = await stateManager.loadPreviousState();

      expect(current?.version).toBe('2.0.0');
      expect(previous?.version).toBe('1.0.0');
    });

    it('should return null when no previous state exists', async () => {
      const loaded = await stateManager.loadPreviousState();
      expect(loaded).toBeNull();
    });
  });

  describe('hasPreviousState', () => {
    it('should return false when no previous state exists', async () => {
      const hasPrevious = await stateManager.hasPreviousState();
      expect(hasPrevious).toBe(false);
    });

    it('should return true when previous state exists', async () => {
      const firstState: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: []
      };

      const secondState: DeploymentState = {
        ...firstState,
        version: '2.0.0'
      };

      await stateManager.saveCurrentState(firstState);
      await stateManager.saveCurrentState(secondState);

      const hasPrevious = await stateManager.hasPreviousState();
      expect(hasPrevious).toBe(true);
    });
  });

  describe('calculateConfigurationHash', () => {
    it('should generate consistent hash for same configuration', () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false
        },
        volumes: {
          dataPath: '/data',
          socketPath: '/socket'
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://localhost',
          backendPort: 3000
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770'
        }
      };

      const hash1 = stateManager.calculateConfigurationHash(config);
      const hash2 = stateManager.calculateConfigurationHash(config);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 hex characters
    });

    it('should generate different hash for different configuration', () => {
      const config1: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false
        },
        volumes: {
          dataPath: '/data',
          socketPath: '/socket'
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://localhost',
          backendPort: 3000
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770'
        }
      };

      const config2: DeploymentConfiguration = {
        network: {
          httpPort: 8080, // Changed port
          httpsPort: 443,
          enableHttps: false
        },
        volumes: {
          dataPath: '/data',
          socketPath: '/socket'
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://localhost',
          backendPort: 3000
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770'
        }
      };

      const hash1 = stateManager.calculateConfigurationHash(config1);
      const hash2 = stateManager.calculateConfigurationHash(config2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createDeploymentState', () => {
    it('should create a properly structured deployment state', () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false
        },
        volumes: {
          dataPath: '/data',
          socketPath: '/socket'
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://localhost',
          backendPort: 3000
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770'
        }
      };

      const state = stateManager.createDeploymentState(
        '1.0.0',
        'test-host',
        {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        config
      );

      expect(state.version).toBe('1.0.0');
      expect(state.targetHost).toBe('test-host');
      expect(state.imageVersions.frontend).toBe('frontend:1.0.0');
      expect(state.status).toBe('pending');
      expect(state.healthChecks).toEqual([]);
      expect(state.configurationHash).toBeTruthy();
      expect(state.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('updateStatus', () => {
    it('should update the status of current deployment', async () => {
      const state: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'pending',
        healthChecks: []
      };

      await stateManager.saveCurrentState(state);
      await stateManager.updateStatus('active');

      const loaded = await stateManager.loadCurrentState();
      expect(loaded?.status).toBe('active');
    });

    it('should throw error when no current state exists', async () => {
      await expect(stateManager.updateStatus('active')).rejects.toThrow(
        'No current deployment state to update'
      );
    });
  });

  describe('addHealthCheck', () => {
    it('should add health check to current deployment', async () => {
      const state: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'pending',
        healthChecks: []
      };

      await stateManager.saveCurrentState(state);

      const healthCheck = {
        service: 'frontend' as const,
        status: 'healthy' as const,
        timestamp: new Date(),
        message: 'OK'
      };

      await stateManager.addHealthCheck(healthCheck);

      const loaded = await stateManager.loadCurrentState();
      expect(loaded?.healthChecks).toHaveLength(1);
      expect(loaded?.healthChecks[0].service).toBe('frontend');
      expect(loaded?.healthChecks[0].status).toBe('healthy');
    });

    it('should throw error when no current state exists', async () => {
      const healthCheck = {
        service: 'frontend' as const,
        status: 'healthy' as const,
        timestamp: new Date()
      };

      await expect(stateManager.addHealthCheck(healthCheck)).rejects.toThrow(
        'No current deployment state to update'
      );
    });
  });

  describe('getDeploymentHistory', () => {
    it('should return both current and previous states', async () => {
      const firstState: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: []
      };

      const secondState: DeploymentState = {
        ...firstState,
        version: '2.0.0'
      };

      await stateManager.saveCurrentState(firstState);
      await stateManager.saveCurrentState(secondState);

      const history = await stateManager.getDeploymentHistory();

      expect(history.current?.version).toBe('2.0.0');
      expect(history.previous?.version).toBe('1.0.0');
    });

    it('should return null for missing states', async () => {
      const history = await stateManager.getDeploymentHistory();

      expect(history.current).toBeNull();
      expect(history.previous).toBeNull();
    });
  });

  describe('clearAllState', () => {
    it('should remove all state files', async () => {
      const state: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'test-host',
        imageVersions: {
          frontend: 'frontend:1.0.0',
          backend: 'backend:1.0.0',
          database: 'database:1.0.0'
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: []
      };

      await stateManager.saveCurrentState(state);
      await stateManager.saveCurrentState({ ...state, version: '2.0.0' });

      await stateManager.clearAllState();

      const current = await stateManager.loadCurrentState();
      const previous = await stateManager.loadPreviousState();

      expect(current).toBeNull();
      expect(previous).toBeNull();
    });
  });
});
