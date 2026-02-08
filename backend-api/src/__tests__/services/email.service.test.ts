import { EmailService } from '../../services/email.service';
import nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
    let emailService: EmailService;
    let mockTransporter: any;

    beforeEach(() => {
        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
        };

        (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

        // Set up environment variables
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_SECURE = 'false';
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASSWORD = 'test-password';
        process.env.SMTP_FROM_ADDRESS = 'noreply@example.com';
        process.env.FRONTEND_URL = 'http://localhost:5173';

        emailService = new EmailService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should read SMTP configuration from environment variables', () => {
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                host: 'smtp.test.com',
                port: 587,
                secure: false,
                auth: {
                    user: 'test@example.com',
                    pass: 'test-password',
                },
            });
        });

        it('should default to port 587 if SMTP_PORT is not set', () => {
            delete process.env.SMTP_PORT;
            new EmailService();

            expect(nodemailer.createTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    port: 587,
                })
            );
        });

        it('should set secure to true when SMTP_SECURE is "true"', () => {
            process.env.SMTP_SECURE = 'true';
            new EmailService();

            expect(nodemailer.createTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    secure: true,
                })
            );
        });
    });

    describe('sendPasswordResetEmail', () => {
        it('should call transporter.sendMail with correct parameters', async () => {
            const email = 'user@example.com';
            const token = 'test-token-123';

            await emailService.sendPasswordResetEmail(email, token);

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'noreply@example.com',
                    to: email,
                    subject: 'Password Reset Request for Cultivate',
                })
            );
        });

        it('should include reset URL with token in email templates', async () => {
            const email = 'user@example.com';
            const token = 'test-token-123';
            const expectedUrl = 'http://localhost:5173/login?password_reset=test-token-123';

            await emailService.sendPasswordResetEmail(email, token);

            const callArgs = mockTransporter.sendMail.mock.calls[0][0];
            expect(callArgs.html).toContain(expectedUrl);
            expect(callArgs.text).toContain(expectedUrl);
        });

        it('should include expiration notice in email templates', async () => {
            const email = 'user@example.com';
            const token = 'test-token-123';

            await emailService.sendPasswordResetEmail(email, token);

            const callArgs = mockTransporter.sendMail.mock.calls[0][0];
            expect(callArgs.html).toContain('15 minutes');
            expect(callArgs.text).toContain('15 minutes');
        });

        it('should include instructions in email templates', async () => {
            const email = 'user@example.com';
            const token = 'test-token-123';

            await emailService.sendPasswordResetEmail(email, token);

            const callArgs = mockTransporter.sendMail.mock.calls[0][0];
            expect(callArgs.html).toContain('reset your password');
            expect(callArgs.text).toContain('reset your password');
        });

        it('should include both HTML and plain text versions', async () => {
            const email = 'user@example.com';
            const token = 'test-token-123';

            await emailService.sendPasswordResetEmail(email, token);

            const callArgs = mockTransporter.sendMail.mock.calls[0][0];
            expect(callArgs.html).toBeDefined();
            expect(callArgs.text).toBeDefined();
            expect(typeof callArgs.html).toBe('string');
            expect(typeof callArgs.text).toBe('string');
        });
    });
});
