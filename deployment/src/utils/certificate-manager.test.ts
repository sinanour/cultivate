/**
 * Tests for Certificate Manager Module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock dependencies before importing
jest.mock('./logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('./ssh-client');
jest.mock('./certificate-validator');

import {
  prepareCertificates,
  transferCertificates,
  generateNginxSslConfig,
  updateNginxConfig,
  generateDockerComposeVolumeConfig,
  getCertificateConfigFromEnv,
  CertificateConfig
} from './certificate-manager';
import { SSHClient } from './ssh-client';

describe('Certificate Manager', () => {
  const testCertsDir = path.join(__dirname, '../../test-certs');
  let validCertPath: string;
  let validKeyPath: string;
  let validChainPath: string;

  beforeAll(() => {
    // Create test certificates directory
    if (!fs.existsSync(testCertsDir)) {
      fs.mkdirSync(testCertsDir, { recursive: true });
    }

    // Generate test certificates
    const { certificate, privateKey } = generateTestCertificate();
    validCertPath = path.join(testCertsDir, 'test-cert.pem');
    validKeyPath = path.join(testCertsDir, 'test-key.pem');
    validChainPath = path.join(testCertsDir, 'test-chain.pem');
    
    fs.writeFileSync(validCertPath, certificate);
    fs.writeFileSync(validKeyPath, privateKey);
    fs.writeFileSync(validChainPath, certificate); // Use same cert for chain in tests
  });

  afterAll(() => {
    // Clean up test certificates
    if (fs.existsSync(testCertsDir)) {
      fs.rmSync(testCertsDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('prepareCertificates', () => {
    it('should skip preparation when HTTPS is disabled', async () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: false
      };

      const result = await prepareCertificates(config);
      expect(result).toBe(true);
    });

    it('should validate certificates when HTTPS is enabled', async () => {
      const { validateCertificateFile, validateCertificateKeyPair } = require('./certificate-validator');
      
      validateCertificateFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      validateCertificateKeyPair.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = await prepareCertificates(config);
      expect(result).toBe(true);
      expect(validateCertificateFile).toHaveBeenCalledWith(validCertPath);
      expect(validateCertificateKeyPair).toHaveBeenCalledWith(validCertPath, validKeyPath);
    });

    it('should validate chain certificate if provided', async () => {
      const { validateCertificateFile, validateCertificateKeyPair } = require('./certificate-validator');
      
      validateCertificateFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      validateCertificateKeyPair.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        chainPath: validChainPath,
        enableHttps: true
      };

      const result = await prepareCertificates(config);
      expect(result).toBe(true);
      expect(validateCertificateFile).toHaveBeenCalledTimes(2); // cert and chain
    });
  });

  describe('transferCertificates', () => {
    let mockSshClient: jest.Mocked<SSHClient>;

    beforeEach(() => {
      mockSshClient = {
        executeCommand: jest.fn().mockResolvedValue(''),
        uploadFile: jest.fn().mockResolvedValue(undefined),
        connect: jest.fn(),
        disconnect: jest.fn()
      } as any;
    });

    it('should skip transfer when HTTPS is disabled', async () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: false
      };

      const result = await transferCertificates(mockSshClient, config);
      expect(result).toBe(true);
      expect(mockSshClient.executeCommand).not.toHaveBeenCalled();
    });

    it('should transfer certificates when HTTPS is enabled', async () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = await transferCertificates(mockSshClient, config);
      
      expect(result).toBe(true);
      expect(mockSshClient.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('mkdir -p')
      );
      expect(mockSshClient.uploadFile).toHaveBeenCalledTimes(2); // cert and key
    });

    it('should transfer chain certificate if provided', async () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        chainPath: validChainPath,
        enableHttps: true
      };

      const result = await transferCertificates(mockSshClient, config);
      
      expect(result).toBe(true);
      expect(mockSshClient.uploadFile).toHaveBeenCalledTimes(3); // cert, key, and chain
    });
  });

  describe('generateNginxSslConfig', () => {
    it('should return empty string when HTTPS is disabled', () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: false
      };

      const result = generateNginxSslConfig(config);
      expect(result).toBe('');
    });

    it('should generate SSL configuration when HTTPS is enabled', () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = generateNginxSslConfig(config);
      
      expect(result).toContain('ssl_certificate');
      expect(result).toContain('ssl_certificate_key');
      expect(result).toContain('ssl_protocols');
      expect(result).toContain('TLSv1.2');
      expect(result).toContain('TLSv1.3');
    });
  });

  describe('generateDockerComposeVolumeConfig', () => {
    it('should return empty string when HTTPS is disabled', () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: false
      };

      const result = generateDockerComposeVolumeConfig(config);
      expect(result).toBe('');
    });

    it('should generate volume configuration when HTTPS is enabled', () => {
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = generateDockerComposeVolumeConfig(config);
      
      expect(result).toContain('/etc/nginx/certs:ro');
      expect(result).toContain('/opt/community-tracker/certs');
    });
  });

  describe('getCertificateConfigFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should read configuration from environment variables', () => {
      process.env.ENABLE_HTTPS = 'true';
      process.env.CERT_PATH = '/path/to/cert.pem';
      process.env.KEY_PATH = '/path/to/key.pem';
      process.env.CHAIN_PATH = '/path/to/chain.pem';

      const config = getCertificateConfigFromEnv();
      
      expect(config.enableHttps).toBe(true);
      expect(config.certPath).toBe('/path/to/cert.pem');
      expect(config.keyPath).toBe('/path/to/key.pem');
      expect(config.chainPath).toBe('/path/to/chain.pem');
    });

    it('should default to HTTPS disabled', () => {
      delete process.env.ENABLE_HTTPS;

      const config = getCertificateConfigFromEnv();
      
      expect(config.enableHttps).toBe(false);
    });
  });
});

// Helper function to generate test certificates
function generateTestCertificate(): { certificate: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const certificate = `-----BEGIN CERTIFICATE-----
MIICertificateDataHere==
-----END CERTIFICATE-----`;

  return { certificate, privateKey };
}

  describe('reloadNginxConfig', () => {
    let mockSshClient: jest.Mocked<SSHClient>;

    beforeEach(() => {
      mockSshClient = {
        executeCommand: jest.fn().mockResolvedValue(''),
        uploadFile: jest.fn().mockResolvedValue(undefined),
        connect: jest.fn(),
        disconnect: jest.fn()
      } as any;
    });

    it('should reload Nginx configuration successfully', async () => {
      const { reloadNginxConfig } = require('./certificate-manager');
      
      mockSshClient.executeCommand.mockResolvedValue('signal process started');

      const result = await reloadNginxConfig(mockSshClient, 'cat_frontend');
      
      expect(result).toBe(true);
      expect(mockSshClient.executeCommand).toHaveBeenCalledWith(
        'docker exec cat_frontend nginx -s reload'
      );
    });

    it('should handle reload failure', async () => {
      const { reloadNginxConfig } = require('./certificate-manager');
      
      mockSshClient.executeCommand.mockResolvedValue('error: failed to reload');

      const result = await reloadNginxConfig(mockSshClient, 'cat_frontend');
      
      expect(result).toBe(false);
    });
  });

  describe('renewCertificates', () => {
    let mockSshClient: jest.Mocked<SSHClient>;

    beforeEach(() => {
      mockSshClient = {
        executeCommand: jest.fn().mockResolvedValue(''),
        uploadFile: jest.fn().mockResolvedValue(undefined),
        connect: jest.fn(),
        disconnect: jest.fn()
      } as any;

      const { validateCertificateFile, validateCertificateKeyPair } = require('./certificate-validator');
      
      validateCertificateFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      validateCertificateKeyPair.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
    });

    it('should renew certificates without container rebuild', async () => {
      const { renewCertificates } = require('./certificate-manager');
      
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = await renewCertificates(mockSshClient, config);
      
      expect(result).toBe(true);
      expect(mockSshClient.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('cp -r')
      );
      expect(mockSshClient.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('nginx -s reload')
      );
    });
  });

  describe('checkCertificateRenewalNeeded', () => {
    it('should return false when HTTPS is disabled', async () => {
      const { checkCertificateRenewalNeeded } = require('./certificate-manager');
      
      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: false
      };

      const result = await checkCertificateRenewalNeeded(config);
      expect(result).toBe(false);
    });

    it('should return true when certificate is expiring soon', async () => {
      const { checkCertificateRenewalNeeded } = require('./certificate-manager');
      const { validateCertificateFile } = require('./certificate-validator');
      
      validateCertificateFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        certificate: {
          subject: 'CN=test.example.com',
          issuer: 'CN=test.example.com',
          validFrom: new Date(),
          validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days
          daysUntilExpiry: 20
        }
      });

      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = await checkCertificateRenewalNeeded(config, 30);
      expect(result).toBe(true);
    });

    it('should return false when certificate is not expiring soon', async () => {
      const { checkCertificateRenewalNeeded } = require('./certificate-manager');
      const { validateCertificateFile } = require('./certificate-validator');
      
      validateCertificateFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        certificate: {
          subject: 'CN=test.example.com',
          issuer: 'CN=test.example.com',
          validFrom: new Date(),
          validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          daysUntilExpiry: 90
        }
      });

      const config: CertificateConfig = {
        certPath: validCertPath,
        keyPath: validKeyPath,
        enableHttps: true
      };

      const result = await checkCertificateRenewalNeeded(config, 30);
      expect(result).toBe(false);
    });
  });
