/**
 * Basic tests to verify type definitions and project setup
 */

import {
  DeploymentState,
  DeploymentConfiguration,
  DockerImage,
  HealthCheckResult,
} from './deployment.js';

describe('Type Definitions', () => {
  describe('DeploymentState', () => {
    it('should create a valid deployment state object', () => {
      const state: DeploymentState = {
        version: '1.0.0',
        timestamp: new Date(),
        targetHost: 'example.com',
        imageVersions: {
          frontend: 'cat_frontend:1.0.0',
          backend: 'cat_backend:1.0.0',
          database: 'cat_database:1.0.0',
        },
        configurationHash: 'abc123',
        status: 'active',
        healthChecks: [],
      };

      expect(state.version).toBe('1.0.0');
      expect(state.status).toBe('active');
      expect(state.imageVersions.frontend).toBe('cat_frontend:1.0.0');
    });

    it('should support all status values', () => {
      const statuses: Array<DeploymentState['status']> = [
        'pending',
        'active',
        'failed',
        'rolled_back',
      ];

      statuses.forEach((status) => {
        const state: DeploymentState = {
          version: '1.0.0',
          timestamp: new Date(),
          targetHost: 'example.com',
          imageVersions: {
            frontend: 'cat_frontend:1.0.0',
            backend: 'cat_backend:1.0.0',
            database: 'cat_database:1.0.0',
          },
          configurationHash: 'abc123',
          status,
          healthChecks: [],
        };

        expect(state.status).toBe(status);
      });
    });
  });

  describe('HealthCheckResult', () => {
    it('should create a valid health check result', () => {
      const healthCheck: HealthCheckResult = {
        service: 'frontend',
        status: 'healthy',
        timestamp: new Date(),
        message: 'Service is running',
      };

      expect(healthCheck.service).toBe('frontend');
      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.message).toBe('Service is running');
    });

    it('should support all service types', () => {
      const services: Array<HealthCheckResult['service']> = [
        'frontend',
        'backend',
        'database',
      ];

      services.forEach((service) => {
        const healthCheck: HealthCheckResult = {
          service,
          status: 'healthy',
          timestamp: new Date(),
        };

        expect(healthCheck.service).toBe(service);
      });
    });
  });

  describe('DeploymentConfiguration', () => {
    it('should create a valid deployment configuration', () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/community_tracker?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      expect(config.network.httpPort).toBe(80);
      expect(config.environment.nodeEnv).toBe('production');
      expect(config.security.apiUserUid).toBe(1001);
    });

    it('should support optional certificate path', () => {
      const config: DeploymentConfiguration = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: true,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
          certPath: '/etc/ssl/certs',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/community_tracker?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      expect(config.volumes.certPath).toBe('/etc/ssl/certs');
      expect(config.network.enableHttps).toBe(true);
    });
  });

  describe('DockerImage', () => {
    it('should create a valid docker image object', () => {
      const image: DockerImage = {
        name: 'cat_frontend',
        tag: '1.0.0',
        digest: 'sha256:abc123',
        size: 1024000,
        buildTimestamp: new Date(),
        buildHost: 'local',
      };

      expect(image.name).toBe('cat_frontend');
      expect(image.tag).toBe('1.0.0');
      expect(image.buildHost).toBe('local');
    });

    it('should support both local and remote build hosts', () => {
      const buildHosts: Array<DockerImage['buildHost']> = ['local', 'remote'];

      buildHosts.forEach((buildHost) => {
        const image: DockerImage = {
          name: 'cat_frontend',
          tag: '1.0.0',
          digest: 'sha256:abc123',
          size: 1024000,
          buildTimestamp: new Date(),
          buildHost,
        };

        expect(image.buildHost).toBe(buildHost);
      });
    });
  });
});
