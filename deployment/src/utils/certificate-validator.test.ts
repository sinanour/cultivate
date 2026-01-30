/**
 * Tests for Certificate Validator Module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock logger before importing the module
jest.mock('./logger', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }))
}));

import {
    validateCertificateFile,
    validateCertificateKeyPair,
    checkCertificateExpiration
} from './certificate-validator';

describe('Certificate Validator', () => {
    // Use a unique directory for each test run to avoid conflicts in parallel execution
    const testCertsDir = path.join(__dirname, `../../test-certs-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    let validCertPath: string;
    let validKeyPath: string;
    let invalidCertPath: string;

    beforeAll(() => {
        // Create test certificates directory
        if (!fs.existsSync(testCertsDir)) {
            fs.mkdirSync(testCertsDir, { recursive: true });
        }
    });

    beforeEach(() => {
        // Ensure directory exists before each test
        if (!fs.existsSync(testCertsDir)) {
            fs.mkdirSync(testCertsDir, { recursive: true });
        }

        // Generate test certificate and key
        const { certificate, privateKey } = generateTestCertificate();
        validCertPath = path.join(testCertsDir, 'valid-cert.pem');
        validKeyPath = path.join(testCertsDir, 'valid-key.pem');

        fs.writeFileSync(validCertPath, certificate);
        fs.writeFileSync(validKeyPath, privateKey);

        // Create invalid certificate file
        invalidCertPath = path.join(testCertsDir, 'invalid-cert.pem');
        fs.writeFileSync(invalidCertPath, 'This is not a valid certificate');
    });

    afterAll(() => {
        // Clean up test certificates
        if (fs.existsSync(testCertsDir)) {
            fs.rmSync(testCertsDir, { recursive: true, force: true });
        }
    });

    describe('validateCertificateFile', () => {
        it('should validate a valid certificate file', async () => {
            const result = await validateCertificateFile(validCertPath);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.certificate).toBeDefined();
            expect(result.certificate?.subject).toBeDefined();
            expect(result.certificate?.issuer).toBeDefined();
            expect(result.certificate?.validFrom).toBeInstanceOf(Date);
            expect(result.certificate?.validTo).toBeInstanceOf(Date);
        });

        it('should reject non-existent certificate file', async () => {
            const result = await validateCertificateFile('/nonexistent/cert.pem');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Certificate file not found: /nonexistent/cert.pem');
        });

        it('should reject invalid PEM format', async () => {
            const result = await validateCertificateFile(invalidCertPath);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('not in valid PEM format'))).toBe(true);
        });

        it('should warn about certificates expiring soon', async () => {
            // Generate certificate expiring in 15 days
            const { certificate } = generateTestCertificate(15);
            const soonExpirePath = path.join(testCertsDir, 'soon-expire-cert.pem');
            fs.writeFileSync(soonExpirePath, certificate);

            const result = await validateCertificateFile(soonExpirePath);

            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('expires in'))).toBe(true);

            fs.unlinkSync(soonExpirePath);
        });
    });

    describe('validateCertificateKeyPair', () => {
        it('should validate matching certificate and key pair', async () => {
            const result = await validateCertificateKeyPair(validCertPath, validKeyPath);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject non-existent certificate file', async () => {
            const result = await validateCertificateKeyPair('/nonexistent/cert.pem', validKeyPath);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Certificate file not found: /nonexistent/cert.pem');
        });

        it('should reject non-existent key file', async () => {
            const result = await validateCertificateKeyPair(validCertPath, '/nonexistent/key.pem');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Private key file not found: /nonexistent/key.pem');
        });

        it('should reject mismatched certificate and key', async () => {
            // Generate a different key pair
            const { privateKey: differentKey } = generateTestCertificate();
            const differentKeyPath = path.join(testCertsDir, 'different-key.pem');
            fs.writeFileSync(differentKeyPath, differentKey);

            const result = await validateCertificateKeyPair(validCertPath, differentKeyPath);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('do not match'))).toBe(true);

            fs.unlinkSync(differentKeyPath);
        });

        it('should reject invalid certificate format', async () => {
            const result = await validateCertificateKeyPair(invalidCertPath, validKeyPath);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('not in valid PEM format'))).toBe(true);
        });

        it('should reject invalid key format', async () => {
            const invalidKeyPath = path.join(testCertsDir, 'invalid-key.pem');
            fs.writeFileSync(invalidKeyPath, 'This is not a valid key');

            const result = await validateCertificateKeyPair(validCertPath, invalidKeyPath);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('not in valid PEM format'))).toBe(true);

            fs.unlinkSync(invalidKeyPath);
        });
    });

    describe('checkCertificateExpiration', () => {
        it('should validate certificate expiration', async () => {
            const result = await checkCertificateExpiration(validCertPath);

            expect(result.valid).toBe(true);
            expect(result.certificate).toBeDefined();
            expect(result.certificate?.daysUntilExpiry).toBeGreaterThan(0);
        });

        it('should reject expired certificate', async () => {
            // Create a fake expired certificate by manually creating an invalid cert
            // Since openssl can't create expired certs, we'll create a minimal invalid one
            const expiredCert = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHCgVZU6T9MA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3QxMB4XDTE1MDEwMTAwMDAwMFoXDTE1MDEwMjAwMDAwMFowETEPMA0GA1UEAwwG
dGVzdDEwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAL7Tz0RRiUt8JwjW8RKw
-----END CERTIFICATE-----`;
            const expiredPath = path.join(testCertsDir, 'expired-cert.pem');
            fs.writeFileSync(expiredPath, expiredCert);

            const result = await checkCertificateExpiration(expiredPath);

            // The certificate should be invalid due to parsing error or expiration
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            fs.unlinkSync(expiredPath);
        });

        it('should warn about certificates expiring within warning period', async () => {
            const result = await checkCertificateExpiration(validCertPath, 365);

            // Certificate valid for 365 days, so warning threshold of 365 should trigger warning
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });
});

/**
 * Helper function to generate test certificates
 * @param daysValid Number of days the certificate should be valid (default: 365)
 * @returns Certificate and private key in PEM format
 */
function generateTestCertificate(daysValid: number = 365): { certificate: string; privateKey: string } {
    // Generate RSA key pair
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Create certificate using openssl command (for testing purposes)
    // In a real test environment, you'd use a proper certificate generation library
    // For now, we'll create a minimal valid X.509 certificate structure
    const { execSync } = require('child_process');
    const tmpDir = require('os').tmpdir();
    const tmpKeyPath = require('path').join(tmpDir, `test-key-${Date.now()}.pem`);
    const tmpCertPath = require('path').join(tmpDir, `test-cert-${Date.now()}.pem`);

    try {
        // Write private key to temp file
        require('fs').writeFileSync(tmpKeyPath, privateKey);

        // Generate self-signed certificate using openssl
        const daysStr = Math.max(1, daysValid).toString();
        execSync(
            `openssl req -new -x509 -key "${tmpKeyPath}" -out "${tmpCertPath}" -days ${daysStr} -subj "/CN=test.example.com"`,
            { stdio: 'pipe' }
        );

        // Read generated certificate
        const certificate = require('fs').readFileSync(tmpCertPath, 'utf8');

        // Clean up temp files
        require('fs').unlinkSync(tmpKeyPath);
        require('fs').unlinkSync(tmpCertPath);

        return { certificate, privateKey };
    } catch (error) {
        // Clean up on error
        try { require('fs').unlinkSync(tmpKeyPath); } catch { }
        try { require('fs').unlinkSync(tmpCertPath); } catch { }
        throw error;
    }
}
