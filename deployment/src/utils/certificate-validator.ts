/**
 * Certificate Validator Module
 * 
 * Validates SSL/TLS certificates for HTTPS deployment.
 * Validates PEM format, expiration dates, and certificate-key pair matching.
 * 
 * Requirements: 6.4
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger();

export interface CertificateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  certificate?: {
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
    daysUntilExpiry: number;
  };
}

/**
 * Validates a certificate file in PEM format
 * @param certPath Path to the certificate file
 * @returns Validation result with certificate details
 */
export async function validateCertificateFile(certPath: string): Promise<CertificateValidationResult> {
  const result: CertificateValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    // Check if file exists
    if (!fs.existsSync(certPath)) {
      result.valid = false;
      result.errors.push(`Certificate file not found: ${certPath}`);
      return result;
    }

    // Read certificate file
    const certContent = fs.readFileSync(certPath, 'utf8');

    // Validate PEM format
    if (!isPemFormat(certContent)) {
      result.valid = false;
      result.errors.push('Certificate is not in valid PEM format');
      return result;
    }

    // Parse certificate
    try {
      const cert = parseCertificate(certContent);
      result.certificate = cert;

      // Check expiration
      const now = new Date();
      if (cert.validTo < now) {
        result.valid = false;
        result.errors.push(`Certificate expired on ${cert.validTo.toISOString()}`);
      } else if (cert.daysUntilExpiry <= 30) {
        result.warnings.push(`Certificate expires in ${cert.daysUntilExpiry} days`);
      }

      if (cert.validFrom > now) {
        result.valid = false;
        result.errors.push(`Certificate not yet valid (valid from ${cert.validFrom.toISOString()})`);
      }

      logger.info('Certificate validation completed', {
        path: certPath,
        subject: cert.subject,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        daysUntilExpiry: cert.daysUntilExpiry
      });

    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to parse certificate: ${error instanceof Error ? error.message : String(error)}`);
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Certificate validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Validates that a certificate and private key match
 * @param certPath Path to the certificate file
 * @param keyPath Path to the private key file
 * @returns Validation result
 */
export async function validateCertificateKeyPair(
  certPath: string,
  keyPath: string
): Promise<CertificateValidationResult> {
  const result: CertificateValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    // Check if files exist
    if (!fs.existsSync(certPath)) {
      result.valid = false;
      result.errors.push(`Certificate file not found: ${certPath}`);
    }

    if (!fs.existsSync(keyPath)) {
      result.valid = false;
      result.errors.push(`Private key file not found: ${keyPath}`);
    }

    if (!result.valid) {
      return result;
    }

    // Read files
    const certContent = fs.readFileSync(certPath, 'utf8');
    const keyContent = fs.readFileSync(keyPath, 'utf8');

    // Validate PEM formats
    if (!isPemFormat(certContent)) {
      result.valid = false;
      result.errors.push('Certificate is not in valid PEM format');
    }

    if (!isPemFormat(keyContent, 'PRIVATE KEY')) {
      result.valid = false;
      result.errors.push('Private key is not in valid PEM format');
    }

    if (!result.valid) {
      return result;
    }

    // Verify certificate and key match
    try {
      const certModulus = getCertificateModulus(certContent);
      const keyModulus = getPrivateKeyModulus(keyContent);

      if (certModulus !== keyModulus) {
        result.valid = false;
        result.errors.push('Certificate and private key do not match');
      } else {
        logger.info('Certificate and private key pair validated successfully', {
          certPath,
          keyPath
        });
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to verify certificate-key pair: ${error instanceof Error ? error.message : String(error)}`);
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Certificate-key pair validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Checks if content is in PEM format
 * @param content File content to check
 * @param type Expected PEM type (e.g., 'CERTIFICATE', 'PRIVATE KEY')
 * @returns True if content is in PEM format
 */
function isPemFormat(content: string, type: string = 'CERTIFICATE'): boolean {
  const beginMarker = `-----BEGIN ${type}-----`;
  const endMarker = `-----END ${type}-----`;

  // Check for standard PEM markers
  if (content.includes(beginMarker) && content.includes(endMarker)) {
    return true;
  }

  // Check for RSA PRIVATE KEY format
  if (type === 'PRIVATE KEY') {
    const rsaBegin = '-----BEGIN RSA PRIVATE KEY-----';
    const rsaEnd = '-----END RSA PRIVATE KEY-----';
    if (content.includes(rsaBegin) && content.includes(rsaEnd)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses a PEM certificate and extracts details
 * @param certContent Certificate content in PEM format
 * @returns Certificate details
 */
function parseCertificate(certContent: string): {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  daysUntilExpiry: number;
} {
  // Create X509 certificate object
  const cert = new crypto.X509Certificate(certContent);

  const validFrom = new Date(cert.validFrom);
  const validTo = new Date(cert.validTo);
  const now = new Date();
  const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    subject: cert.subject,
    issuer: cert.issuer,
    validFrom,
    validTo,
    daysUntilExpiry
  };
}

/**
 * Extracts the modulus from a certificate for comparison
 * @param certContent Certificate content in PEM format
 * @returns Certificate modulus as hex string
 */
function getCertificateModulus(certContent: string): string {
  const cert = new crypto.X509Certificate(certContent);
  const publicKey = cert.publicKey;

  // Export public key and extract modulus
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(publicKeyDer).digest('hex');
}

/**
 * Extracts the modulus from a private key for comparison
 * @param keyContent Private key content in PEM format
 * @returns Private key modulus as hex string
 */
function getPrivateKeyModulus(keyContent: string): string {
  // Create private key object
  const privateKey = crypto.createPrivateKey(keyContent);

  // Export public key from private key and extract modulus
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(publicKeyDer).digest('hex');
}

/**
 * Validates certificate expiration date
 * @param certPath Path to the certificate file
 * @param warningDays Number of days before expiration to issue warning (default: 30)
 * @returns Validation result
 */
export async function checkCertificateExpiration(
  certPath: string,
  warningDays: number = 30
): Promise<CertificateValidationResult> {
  const result: CertificateValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    if (!fs.existsSync(certPath)) {
      result.valid = false;
      result.errors.push(`Certificate file not found: ${certPath}`);
      return result;
    }

    const certContent = fs.readFileSync(certPath, 'utf8');
    const cert = parseCertificate(certContent);
    result.certificate = cert;

    const now = new Date();

    if (cert.validTo < now) {
      result.valid = false;
      result.errors.push(`Certificate expired on ${cert.validTo.toISOString()}`);
    } else if (cert.daysUntilExpiry <= warningDays) {
      result.warnings.push(`Certificate expires in ${cert.daysUntilExpiry} days (${cert.validTo.toISOString()})`);
    }

    if (cert.validFrom > now) {
      result.valid = false;
      result.errors.push(`Certificate not yet valid (valid from ${cert.validFrom.toISOString()})`);
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Failed to check certificate expiration: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
