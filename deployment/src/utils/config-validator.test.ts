import { ConfigValidator } from './config-validator';
import { DeploymentConfiguration, CertificateConfig } from '../types/deployment';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigValidator', () => {
  describe('validateConfiguration', () => {
    it('should validate a complete valid configuration', () => {
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
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid HTTP port', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 70000, // Invalid port
          httpsPort: 443,
          enableHttps: false,
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid HTTP port: 70000. Must be between 1 and 65535.');
    });

    it('should reject invalid HTTPS port', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 80,
          httpsPort: 0, // Invalid port
          enableHttps: false,
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid HTTPS port: 0. Must be between 1 and 65535.');
    });

    it('should require certificate path when HTTPS is enabled', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: true,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
          // certPath missing
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTTPS is enabled but no certificate path is provided.');
    });

    it('should warn when certificate path is provided but HTTPS is disabled', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false,
        },
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
          certPath: '/etc/certs',
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Certificate path is provided but HTTPS is not enabled.');
    });

    it('should reject invalid nodeEnv', () => {
      const config: Partial<DeploymentConfiguration> = {
        environment: {
          nodeEnv: 'development' as any, // Invalid value
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid nodeEnv: development. Must be 'production' or 'staging'.");
    });

    it('should reject invalid backend port', () => {
      const config: Partial<DeploymentConfiguration> = {
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: -1, // Invalid port
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid backend port: -1. Must be between 1 and 65535.');
    });

    it('should reject invalid database URL', () => {
      const config: Partial<DeploymentConfiguration> = {
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'mysql://user:pass@localhost/db', // Wrong format
          backendPort: 3000,
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid database URL format. Expected PostgreSQL connection string with Unix socket.');
    });

    it('should reject invalid apiUserUid', () => {
      const config: Partial<DeploymentConfiguration> = {
        security: {
          apiUserUid: 0, // Invalid UID
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid apiUserUid: 0. Must be greater than 0.');
    });

    it('should reject invalid socket permissions', () => {
      const config: Partial<DeploymentConfiguration> = {
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '770', // Missing leading 0
        },
      };

      const result = ConfigValidator.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid socket permissions: 770. Must be octal format (e.g., '0770').");
    });
  });

  describe('applyDefaults', () => {
    it('should apply default values for missing fields', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 8080,
          httpsPort: 443,
          enableHttps: false,
        },
      };

      const result = ConfigValidator.applyDefaults(config);

      expect(result.network.httpPort).toBe(8080); // User-provided value
      expect(result.network.httpsPort).toBe(443); // User-provided value
      expect(result.volumes.dataPath).toBe('/var/lib/postgresql/data'); // Default
      expect(result.volumes.socketPath).toBe('/var/run/postgresql'); // Default
      expect(result.environment.nodeEnv).toBe('production'); // Default
      expect(result.environment.backendPort).toBe(3000); // Default
      expect(result.security.apiUserUid).toBe(1001); // Default
      expect(result.security.apiUserGid).toBe(1001); // Default
      expect(result.security.socketPermissions).toBe('0770'); // Default
    });

    it('should not override user-provided values', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 8080,
          httpsPort: 8443,
          enableHttps: true,
        },
        environment: {
          nodeEnv: 'staging',
          databaseUrl: 'postgresql://custom@/db?host=/custom/socket',
          backendPort: 4000,
        },
        security: {
          apiUserUid: 2000,
          apiUserGid: 2000,
          socketPermissions: '0750',
        },
      };

      const result = ConfigValidator.applyDefaults(config);

      expect(result.network.httpPort).toBe(8080);
      expect(result.network.httpsPort).toBe(8443);
      expect(result.network.enableHttps).toBe(true);
      expect(result.environment.nodeEnv).toBe('staging');
      expect(result.environment.databaseUrl).toBe('postgresql://custom@/db?host=/custom/socket');
      expect(result.environment.backendPort).toBe(4000);
      expect(result.security.apiUserUid).toBe(2000);
      expect(result.security.apiUserGid).toBe(2000);
      expect(result.security.socketPermissions).toBe('0750');
    });

    it('should handle empty configuration', () => {
      const config: Partial<DeploymentConfiguration> = {};

      const result = ConfigValidator.applyDefaults(config);

      expect(result.network.httpPort).toBe(80);
      expect(result.network.httpsPort).toBe(443);
      expect(result.network.enableHttps).toBe(false);
      expect(result.volumes.dataPath).toBe('/var/lib/postgresql/data');
      expect(result.volumes.socketPath).toBe('/var/run/postgresql');
      expect(result.environment.nodeEnv).toBe('production');
      expect(result.environment.backendPort).toBe(3000);
      expect(result.security.apiUserUid).toBe(1001);
      expect(result.security.apiUserGid).toBe(1001);
      expect(result.security.socketPermissions).toBe('0770');
    });
  });

  describe('validateCertificates', () => {
    let tempDir: string;
    let certPath: string;
    let keyPath: string;

    beforeEach(() => {
      // Create temporary directory for test certificates
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cert-test-'));
      certPath = path.join(tempDir, 'cert.pem');
      keyPath = path.join(tempDir, 'key.pem');
    });

    afterEach(() => {
      // Clean up temporary files
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should reject missing certificate file', async () => {
      const certConfig: CertificateConfig = {
        certPath: '/nonexistent/cert.pem',
        keyPath: keyPath,
      };

      const result = await ConfigValidator.validateCertificates(certConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate file not found: /nonexistent/cert.pem');
    });

    it('should reject missing key file', async () => {
      // Create certificate file
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');

      const certConfig: CertificateConfig = {
        certPath: certPath,
        keyPath: '/nonexistent/key.pem',
      };

      const result = await ConfigValidator.validateCertificates(certConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Private key file not found: /nonexistent/key.pem');
    });

    it('should reject invalid PEM format for certificate', async () => {
      // Create invalid certificate file
      fs.writeFileSync(certPath, 'This is not a valid PEM file');
      fs.writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----');

      const certConfig: CertificateConfig = {
        certPath: certPath,
        keyPath: keyPath,
      };

      const result = await ConfigValidator.validateCertificates(certConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate file is not in valid PEM format');
    });

    it('should reject invalid PEM format for key', async () => {
      // Create valid certificate but invalid key
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
      fs.writeFileSync(keyPath, 'This is not a valid PEM file');

      const certConfig: CertificateConfig = {
        certPath: certPath,
        keyPath: keyPath,
      };

      const result = await ConfigValidator.validateCertificates(certConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Private key file is not in valid PEM format');
    });

    it('should accept valid PEM format files', async () => {
      // Create valid PEM files
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----');
      fs.writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----');

      const certConfig: CertificateConfig = {
        certPath: certPath,
        keyPath: keyPath,
      };

      const result = await ConfigValidator.validateCertificates(certConfig);

      // Should pass basic validation (PEM format check)
      // Note: Full validation would require proper certificate parsing
      expect(result.valid).toBe(true);
      expect(result.keyPairMatch).toBe(true); // Simplified check passes
    });

    it('should check for CA certificate if provided', async () => {
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
      fs.writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----');

      const certConfig: CertificateConfig = {
        certPath: certPath,
        keyPath: keyPath,
        caPath: '/nonexistent/ca.pem',
      };

      const result = await ConfigValidator.validateCertificates(certConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CA certificate file not found: /nonexistent/ca.pem');
    });
  });

  describe('validateRequiredFields', () => {
    it('should return empty array for complete configuration', () => {
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
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const missing = ConfigValidator.validateRequiredFields(config);

      expect(missing).toHaveLength(0);
    });

    it('should detect missing network configuration', () => {
      const config: Partial<DeploymentConfiguration> = {
        volumes: {
          dataPath: '/var/lib/postgresql/data',
          socketPath: '/var/run/postgresql',
        },
        environment: {
          nodeEnv: 'production',
          databaseUrl: 'postgresql://apiuser@/cultivate?host=/var/run/postgresql',
          backendPort: 3000,
        },
        security: {
          apiUserUid: 1001,
          apiUserGid: 1001,
          socketPermissions: '0770',
        },
      };

      const missing = ConfigValidator.validateRequiredFields(config);

      expect(missing).toContain('network configuration');
    });

    it('should detect multiple missing configurations', () => {
      const config: Partial<DeploymentConfiguration> = {
        network: {
          httpPort: 80,
          httpsPort: 443,
          enableHttps: false,
        },
      };

      const missing = ConfigValidator.validateRequiredFields(config);

      expect(missing).toContain('volumes configuration');
      expect(missing).toContain('environment configuration');
      expect(missing).toContain('security configuration');
      expect(missing.length).toBe(3);
    });

    it('should detect all missing configurations for empty config', () => {
      const config: Partial<DeploymentConfiguration> = {};

      const missing = ConfigValidator.validateRequiredFields(config);

      expect(missing).toContain('network configuration');
      expect(missing).toContain('volumes configuration');
      expect(missing).toContain('environment configuration');
      expect(missing).toContain('security configuration');
      expect(missing.length).toBe(4);
    });
  });
});
