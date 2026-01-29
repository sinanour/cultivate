/**
 * Certificate Manager Module
 * 
 * Manages certificate mounting and Nginx configuration for HTTPS support.
 * Supports certificate paths via environment variables and read-only volume mounting.
 * 
 * Requirements: 6.1, 6.2
 */

import * as path from 'path';
import { createLogger } from './logger';
import { SSHClient } from './ssh-client';
import { validateCertificateFile, validateCertificateKeyPair } from './certificate-validator';

const logger = createLogger();

export interface CertificateConfig {
  certPath: string;
  keyPath: string;
  chainPath?: string;
  enableHttps: boolean;
}

export interface NginxCertificateConfig {
  sslCertificate: string;
  sslCertificateKey: string;
  sslTrustedCertificate?: string;
}

/**
 * Validates and prepares certificates for deployment
 * @param config Certificate configuration
 * @returns True if certificates are valid and ready
 */
export async function prepareCertificates(config: CertificateConfig): Promise<boolean> {
  if (!config.enableHttps) {
    logger.info('HTTPS not enabled, skipping certificate preparation');
    return true;
  }

  logger.info('Preparing certificates for HTTPS deployment', {
    certPath: config.certPath,
    keyPath: config.keyPath,
    chainPath: config.chainPath
  });

  // Validate certificate file
  const certValidation = await validateCertificateFile(config.certPath);
  if (!certValidation.valid) {
    logger.error('Certificate validation failed', { errors: certValidation.errors });
    return false;
  }

  // Log warnings if any
  if (certValidation.warnings.length > 0) {
    certValidation.warnings.forEach(warning => {
      logger.warn('Certificate warning', { warning });
    });
  }

  // Validate certificate and key pair
  const pairValidation = await validateCertificateKeyPair(config.certPath, config.keyPath);
  if (!pairValidation.valid) {
    logger.error('Certificate-key pair validation failed', { errors: pairValidation.errors });
    return false;
  }

  // Validate chain certificate if provided
  if (config.chainPath) {
    const chainValidation = await validateCertificateFile(config.chainPath);
    if (!chainValidation.valid) {
      logger.error('Certificate chain validation failed', { errors: chainValidation.errors });
      return false;
    }
  }

  logger.info('Certificates validated successfully');
  return true;
}

/**
 * Transfers certificates to target host
 * @param sshClient SSH client connected to target host
 * @param config Certificate configuration
 * @param remoteCertDir Remote directory for certificates
 * @returns True if transfer successful
 */
export async function transferCertificates(
  sshClient: SSHClient,
  config: CertificateConfig,
  remoteCertDir: string = '/opt/community-tracker/certs'
): Promise<boolean> {
  if (!config.enableHttps) {
    logger.info('HTTPS not enabled, skipping certificate transfer');
    return true;
  }

  try {
    logger.info('Transferring certificates to target host', { remoteCertDir });

    // Create remote certificate directory
    await sshClient.executeCommand(`mkdir -p ${remoteCertDir}`);
    await sshClient.executeCommand(`chmod 700 ${remoteCertDir}`);

    // Transfer certificate file
    const remoteCertPath = path.join(remoteCertDir, 'server.crt');
    await sshClient.uploadFile(config.certPath, remoteCertPath);
    await sshClient.executeCommand(`chmod 644 ${remoteCertPath}`);
    logger.info('Certificate file transferred', { remotePath: remoteCertPath });

    // Transfer private key file
    const remoteKeyPath = path.join(remoteCertDir, 'server.key');
    await sshClient.uploadFile(config.keyPath, remoteKeyPath);
    await sshClient.executeCommand(`chmod 600 ${remoteKeyPath}`);
    logger.info('Private key file transferred', { remotePath: remoteKeyPath });

    // Transfer chain certificate if provided
    if (config.chainPath) {
      const remoteChainPath = path.join(remoteCertDir, 'chain.crt');
      await sshClient.uploadFile(config.chainPath, remoteChainPath);
      await sshClient.executeCommand(`chmod 644 ${remoteChainPath}`);
      logger.info('Certificate chain transferred', { remotePath: remoteChainPath });
    }

    logger.info('All certificates transferred successfully');
    return true;

  } catch (error) {
    logger.error('Failed to transfer certificates', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Generates Nginx configuration for HTTPS
 * @param config Certificate configuration
 * @param remoteCertDir Remote directory containing certificates
 * @returns Nginx SSL configuration snippet
 */
export function generateNginxSslConfig(
  config: CertificateConfig,
  remoteCertDir: string = '/opt/community-tracker/certs'
): string {
  if (!config.enableHttps) {
    return '';
  }

  const certPath = path.join(remoteCertDir, 'server.crt');
  const keyPath = path.join(remoteCertDir, 'server.key');
  const chainPath = config.chainPath ? path.join(remoteCertDir, 'chain.crt') : undefined;

  const sslConfig = `
    # SSL Configuration
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ${chainPath ? `ssl_trusted_certificate ${chainPath};` : ''}
    
    # SSL Protocol and Cipher Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    
    # SSL Session Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
  `;

  return sslConfig.trim();
}

/**
 * Updates Nginx configuration to use certificates
 * @param sshClient SSH client connected to target host
 * @param config Certificate configuration
 * @param nginxConfigPath Path to Nginx configuration file on target host
 * @returns True if configuration updated successfully
 */
export async function updateNginxConfig(
  sshClient: SSHClient,
  config: CertificateConfig,
  nginxConfigPath: string = '/opt/community-tracker/nginx.conf'
): Promise<boolean> {
  try {
    logger.info('Updating Nginx configuration for HTTPS', { nginxConfigPath });

    // Generate SSL configuration
    const sslConfig = generateNginxSslConfig(config);

    if (!config.enableHttps) {
      logger.info('HTTPS not enabled, using HTTP-only configuration');
      return true;
    }

    // Read current Nginx configuration
    const currentConfigResult = await sshClient.executeCommand(`cat ${nginxConfigPath}`);
    const currentConfig = currentConfigResult.stdout;

    // Check if SSL configuration already exists
    if (currentConfig.includes('ssl_certificate')) {
      logger.info('SSL configuration already present in Nginx config');
      return true;
    }

    // Create backup of current configuration
    const backupPath = `${nginxConfigPath}.backup`;
    await sshClient.executeCommand(`cp ${nginxConfigPath} ${backupPath}`);
    logger.info('Created backup of Nginx configuration', { backupPath });

    // Update configuration with SSL settings
    // This is a simplified approach - in production, you'd use a proper config parser
    const updatedConfig = currentConfig.replace(
      /listen\s+443\s+ssl;/g,
      `listen 443 ssl;\n${sslConfig}`
    );

    // Write updated configuration
    await sshClient.executeCommand(`echo '${updatedConfig}' > ${nginxConfigPath}`);
    logger.info('Nginx configuration updated with SSL settings');

    // Test Nginx configuration
    const testResultCmd = await sshClient.executeCommand('nginx -t');
    const testResult = testResultCmd.stdout + testResultCmd.stderr;
    if (testResult.includes('syntax is ok') && testResult.includes('test is successful')) {
      logger.info('Nginx configuration test passed');
      return true;
    } else {
      logger.error('Nginx configuration test failed', { testResult });
      // Restore backup
      await sshClient.executeCommand(`mv ${backupPath} ${nginxConfigPath}`);
      return false;
    }

  } catch (error) {
    logger.error('Failed to update Nginx configuration', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Configures Docker Compose to mount certificates
 * @param config Certificate configuration
 * @param remoteCertDir Remote directory containing certificates
 * @returns Docker Compose volume configuration
 */
export function generateDockerComposeVolumeConfig(
  config: CertificateConfig,
  remoteCertDir: string = '/opt/community-tracker/certs'
): string {
  if (!config.enableHttps) {
    return '';
  }

  return `
      - ${remoteCertDir}:/etc/nginx/certs:ro
  `.trim();
}

/**
 * Gets certificate configuration from environment variables
 * @returns Certificate configuration
 */
export function getCertificateConfigFromEnv(): CertificateConfig {
  const enableHttps = process.env.ENABLE_HTTPS === 'true';
  const certPath = process.env.CERT_PATH || '';
  const keyPath = process.env.KEY_PATH || '';
  const chainPath = process.env.CHAIN_PATH;

  return {
    certPath,
    keyPath,
    chainPath,
    enableHttps
  };
}

/**
 * Reloads Nginx configuration without restarting the container
 * @param sshClient SSH client connected to target host
 * @param containerName Name of the Nginx container
 * @returns True if reload successful
 */
export async function reloadNginxConfig(
  sshClient: SSHClient,
  containerName: string = 'cat_frontend'
): Promise<boolean> {
  try {
    logger.info('Reloading Nginx configuration', { containerName });

    // Send reload signal to Nginx inside the container
    const reloadCommand = `docker exec ${containerName} nginx -s reload`;
    const resultCmd = await sshClient.executeCommand(reloadCommand);
    const result = resultCmd.stdout + resultCmd.stderr;

    if (result.includes('error') || result.includes('failed')) {
      logger.error('Failed to reload Nginx configuration', { result });
      return false;
    }

    logger.info('Nginx configuration reloaded successfully');
    return true;

  } catch (error) {
    logger.error('Failed to reload Nginx configuration', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Updates certificates without rebuilding the container
 * @param sshClient SSH client connected to target host
 * @param config Certificate configuration
 * @param remoteCertDir Remote directory for certificates
 * @param containerName Name of the Nginx container
 * @returns True if update successful
 */
export async function renewCertificates(
  sshClient: SSHClient,
  config: CertificateConfig,
  remoteCertDir: string = '/opt/community-tracker/certs',
  containerName: string = 'cat_frontend'
): Promise<boolean> {
  try {
    logger.info('Renewing certificates without container rebuild', {
      remoteCertDir,
      containerName
    });

    // Validate new certificates before updating
    const valid = await prepareCertificates(config);
    if (!valid) {
      logger.error('Certificate validation failed, aborting renewal');
      return false;
    }

    // Create backup of existing certificates
    const backupDir = `${remoteCertDir}.backup.${Date.now()}`;
    await sshClient.executeCommand(`cp -r ${remoteCertDir} ${backupDir}`);
    logger.info('Created backup of existing certificates', { backupDir });

    // Transfer new certificates
    const transferred = await transferCertificates(sshClient, config, remoteCertDir);
    if (!transferred) {
      logger.error('Failed to transfer new certificates, restoring backup');
      await sshClient.executeCommand(`rm -rf ${remoteCertDir}`);
      await sshClient.executeCommand(`mv ${backupDir} ${remoteCertDir}`);
      return false;
    }

    // Reload Nginx configuration
    const reloaded = await reloadNginxConfig(sshClient, containerName);
    if (!reloaded) {
      logger.error('Failed to reload Nginx, restoring backup');
      await sshClient.executeCommand(`rm -rf ${remoteCertDir}`);
      await sshClient.executeCommand(`mv ${backupDir} ${remoteCertDir}`);
      await reloadNginxConfig(sshClient, containerName); // Try to reload with old certs
      return false;
    }

    // Clean up backup after successful renewal
    await sshClient.executeCommand(`rm -rf ${backupDir}`);
    logger.info('Certificate renewal completed successfully');
    return true;

  } catch (error) {
    logger.error('Certificate renewal failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Checks if certificates need renewal based on expiration date
 * @param config Certificate configuration
 * @param renewalThresholdDays Number of days before expiration to trigger renewal (default: 30)
 * @returns True if certificates need renewal
 */
export async function checkCertificateRenewalNeeded(
  config: CertificateConfig,
  renewalThresholdDays: number = 30
): Promise<boolean> {
  if (!config.enableHttps) {
    return false;
  }

  try {
    const validation = await validateCertificateFile(config.certPath);
    
    if (!validation.valid) {
      logger.warn('Certificate is invalid, renewal needed');
      return true;
    }

    if (validation.certificate && validation.certificate.daysUntilExpiry <= renewalThresholdDays) {
      logger.info('Certificate expiring soon, renewal needed', {
        daysUntilExpiry: validation.certificate.daysUntilExpiry,
        threshold: renewalThresholdDays
      });
      return true;
    }

    return false;

  } catch (error) {
    logger.error('Failed to check certificate renewal status', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
