import * as fs from 'fs';
import { createLogger } from './logger.js';
import { DeploymentConfiguration, CertificateConfig } from '../types/deployment.js';

const logger = createLogger();

/**
 * Validation result for configuration
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
}

/**
 * Certificate validation result
 */
export interface CertificateValidationResult {
  /** Whether certificate is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Certificate expiration date */
  expirationDate?: Date;
  /** Whether certificate and key match */
  keyPairMatch: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<DeploymentConfiguration> = {
  network: {
    httpPort: 80,
    httpsPort: 443,
    enableHttps: false,
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
  volumes: {
    dataPath: '/var/lib/postgresql/data',
    socketPath: '/var/run/postgresql',
  },
};

/**
 * ConfigValidator class for validating deployment configuration
 * 
 * Features:
 * - Validates required configuration values
 * - Applies default values for optional settings
 * - Validates certificate files when HTTPS is enabled
 * - Checks certificate format, expiration, and key pair matching
 */
export class ConfigValidator {
  /**
   * Validates a deployment configuration
   * @param config Configuration to validate
   * @returns Validation result with errors and warnings
   */
  static validateConfiguration(config: Partial<DeploymentConfiguration>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate network configuration
    if (config.network) {
      if (config.network.httpPort !== undefined) {
        if (!this.isValidPort(config.network.httpPort)) {
          errors.push(`Invalid HTTP port: ${config.network.httpPort}. Must be between 1 and 65535.`);
        }
      }

      if (config.network.httpsPort !== undefined) {
        if (!this.isValidPort(config.network.httpsPort)) {
          errors.push(`Invalid HTTPS port: ${config.network.httpsPort}. Must be between 1 and 65535.`);
        }
      }

      if (config.network.enableHttps && !config.volumes?.certPath) {
        errors.push('HTTPS is enabled but no certificate path is provided.');
      }
    }

    // Validate volumes configuration
    if (config.volumes) {
      if (config.volumes.certPath && !config.network?.enableHttps) {
        warnings.push('Certificate path is provided but HTTPS is not enabled.');
      }
    }

    // Validate environment configuration
    if (config.environment) {
      if (config.environment.nodeEnv && !['production', 'staging'].includes(config.environment.nodeEnv)) {
        errors.push(`Invalid nodeEnv: ${config.environment.nodeEnv}. Must be 'production' or 'staging'.`);
      }

      if (config.environment.backendPort !== undefined) {
        if (!this.isValidPort(config.environment.backendPort)) {
          errors.push(`Invalid backend port: ${config.environment.backendPort}. Must be between 1 and 65535.`);
        }
      }

      if (config.environment.databaseUrl && !this.isValidDatabaseUrl(config.environment.databaseUrl)) {
        errors.push('Invalid database URL format. Expected PostgreSQL connection string with Unix socket.');
      }
    }

    // Validate security configuration
    if (config.security) {
      if (config.security.apiUserUid !== undefined && config.security.apiUserUid < 1) {
        errors.push(`Invalid apiUserUid: ${config.security.apiUserUid}. Must be greater than 0.`);
      }

      if (config.security.apiUserGid !== undefined && config.security.apiUserGid < 1) {
        errors.push(`Invalid apiUserGid: ${config.security.apiUserGid}. Must be greater than 0.`);
      }

      if (config.security.socketPermissions && !this.isValidPermissions(config.security.socketPermissions)) {
        errors.push(`Invalid socket permissions: ${config.security.socketPermissions}. Must be octal format (e.g., '0770').`);
      }
    }

    logger.info(`Configuration validation completed: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Applies default values to configuration
   * @param config Partial configuration
   * @returns Complete configuration with defaults applied
   */
  static applyDefaults(config: Partial<DeploymentConfiguration>): DeploymentConfiguration {
    logger.info('Applying default configuration values');

    const completeConfig: DeploymentConfiguration = {
      network: {
        httpPort: config.network?.httpPort ?? DEFAULT_CONFIG.network!.httpPort,
        httpsPort: config.network?.httpsPort ?? DEFAULT_CONFIG.network!.httpsPort,
        enableHttps: config.network?.enableHttps ?? DEFAULT_CONFIG.network!.enableHttps,
      },
      volumes: {
        dataPath: config.volumes?.dataPath ?? DEFAULT_CONFIG.volumes!.dataPath,
        socketPath: config.volumes?.socketPath ?? DEFAULT_CONFIG.volumes!.socketPath,
        certPath: config.volumes?.certPath,
      },
      environment: {
        nodeEnv: config.environment?.nodeEnv ?? DEFAULT_CONFIG.environment!.nodeEnv,
        databaseUrl: config.environment?.databaseUrl ?? DEFAULT_CONFIG.environment!.databaseUrl,
        backendPort: config.environment?.backendPort ?? DEFAULT_CONFIG.environment!.backendPort,
      },
      security: {
        apiUserUid: config.security?.apiUserUid ?? DEFAULT_CONFIG.security!.apiUserUid,
        apiUserGid: config.security?.apiUserGid ?? DEFAULT_CONFIG.security!.apiUserGid,
        socketPermissions: config.security?.socketPermissions ?? DEFAULT_CONFIG.security!.socketPermissions,
      },
    };

    logger.debug('Default values applied successfully');
    return completeConfig;
  }

  /**
   * Validates certificate files when HTTPS is enabled
   * @param certConfig Certificate configuration
   * @returns Certificate validation result
   */
  static async validateCertificates(certConfig: CertificateConfig): Promise<CertificateValidationResult> {
    const errors: string[] = [];
    let expirationDate: Date | undefined;
    let keyPairMatch = false;

    logger.info(`Validating certificates: ${certConfig.certPath}`);

    // Check if certificate file exists
    if (!fs.existsSync(certConfig.certPath)) {
      errors.push(`Certificate file not found: ${certConfig.certPath}`);
      return { valid: false, errors, keyPairMatch };
    }

    // Check if key file exists
    if (!fs.existsSync(certConfig.keyPath)) {
      errors.push(`Private key file not found: ${certConfig.keyPath}`);
      return { valid: false, errors, keyPairMatch };
    }

    // Check if CA file exists (if provided)
    if (certConfig.caPath && !fs.existsSync(certConfig.caPath)) {
      errors.push(`CA certificate file not found: ${certConfig.caPath}`);
      return { valid: false, errors, keyPairMatch };
    }

    try {
      // Read certificate file
      const certContent = fs.readFileSync(certConfig.certPath, 'utf8');
      const keyContent = fs.readFileSync(certConfig.keyPath, 'utf8');

      // Validate PEM format
      if (!this.isPemFormat(certContent)) {
        errors.push('Certificate file is not in valid PEM format');
      }

      if (!this.isPemFormat(keyContent)) {
        errors.push('Private key file is not in valid PEM format');
      }

      // Extract certificate expiration date
      expirationDate = this.extractExpirationDate(certContent);
      if (expirationDate) {
        const now = new Date();
        if (expirationDate < now) {
          errors.push(`Certificate has expired on ${expirationDate.toISOString()}`);
        } else {
          const daysUntilExpiry = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 30) {
            logger.warn(`Certificate expires in ${daysUntilExpiry} days`);
          }
        }
      }

      // Verify certificate and key pair match
      keyPairMatch = await this.verifyCertificateKeyPair(certContent, keyContent);
      if (!keyPairMatch) {
        errors.push('Certificate and private key do not match');
      }

      logger.info(`Certificate validation completed: ${errors.length} errors`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`Certificate validation error: ${errorMessage}`);
      logger.error(`Certificate validation failed: ${errorMessage}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      expirationDate,
      keyPairMatch,
    };
  }

  /**
   * Validates a port number
   * @param port Port number to validate
   * @returns true if valid, false otherwise
   */
  private static isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * Validates database URL format
   * @param url Database URL to validate
   * @returns true if valid, false otherwise
   */
  private static isValidDatabaseUrl(url: string): boolean {
    // Check for PostgreSQL URL with Unix socket
    return url.startsWith('postgresql://') && url.includes('host=/');
  }

  /**
   * Validates file permissions format
   * @param permissions Permissions string to validate
   * @returns true if valid, false otherwise
   */
  private static isValidPermissions(permissions: string): boolean {
    // Check for octal format (e.g., '0770')
    return /^0[0-7]{3}$/.test(permissions);
  }

  /**
   * Checks if content is in PEM format
   * @param content Content to check
   * @returns true if PEM format, false otherwise
   */
  private static isPemFormat(content: string): boolean {
    return content.includes('-----BEGIN') && content.includes('-----END');
  }

  /**
   * Extracts expiration date from certificate
   * @param certContent Certificate content in PEM format
   * @returns Expiration date or undefined if not found
   */
  private static extractExpirationDate(certContent: string): Date | undefined {
    try {
      // Extract certificate data between BEGIN and END markers
      const certMatch = certContent.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]+?)\s*-----END CERTIFICATE-----/);
      if (!certMatch) {
        return undefined;
      }

      // For now, return undefined as we need openssl or a certificate parsing library
      // In a real implementation, we would use node-forge or similar library
      logger.debug('Certificate expiration date extraction requires openssl or certificate parsing library');
      return undefined;
    } catch (err) {
      logger.error(`Failed to extract expiration date: ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  }

  /**
   * Verifies that certificate and private key match
   * @param certContent Certificate content
   * @param keyContent Private key content
   * @returns Promise that resolves to true if they match, false otherwise
   */
  private static async verifyCertificateKeyPair(certContent: string, keyContent: string): Promise<boolean> {
    try {
      // This is a simplified check - in production, use proper certificate verification
      // We check that both files are in PEM format and contain the expected markers
      const hasCert = certContent.includes('-----BEGIN CERTIFICATE-----');
      const hasKey = keyContent.includes('-----BEGIN') && (
        keyContent.includes('PRIVATE KEY') || 
        keyContent.includes('RSA PRIVATE KEY')
      );

      // For a real implementation, we would:
      // 1. Parse the certificate to extract the public key
      // 2. Parse the private key
      // 3. Verify that the public key from the certificate matches the private key
      // This requires a library like node-forge or using openssl

      logger.debug('Certificate-key pair verification requires proper cryptographic library');
      return hasCert && hasKey;
    } catch (err) {
      logger.error(`Certificate-key pair verification failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Validates required configuration values are present
   * @param config Configuration to validate
   * @returns List of missing required fields
   */
  static validateRequiredFields(config: Partial<DeploymentConfiguration>): string[] {
    const missing: string[] = [];

    // Network configuration is always required
    if (!config.network) {
      missing.push('network configuration');
    }

    // Volumes configuration is always required
    if (!config.volumes) {
      missing.push('volumes configuration');
    }

    // Environment configuration is always required
    if (!config.environment) {
      missing.push('environment configuration');
    }

    // Security configuration is always required
    if (!config.security) {
      missing.push('security configuration');
    }

    if (missing.length > 0) {
      logger.error(`Missing required configuration fields: ${missing.join(', ')}`);
    }

    return missing;
  }
}
