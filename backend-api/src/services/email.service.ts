import nodemailer from 'nodemailer';

/**
 * EmailService handles all email sending operations
 * Uses Nodemailer with SMTP configuration from environment variables
 */
export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }

    /**
     * Send password reset email with token link
     */
    async sendPasswordResetEmail(email: string, token: string): Promise<void> {
        const resetUrl = `${process.env.FRONTEND_URL}/login?password_reset=${token}`;

        const mailOptions = {
            from: process.env.SMTP_FROM_ADDRESS,
            to: email,
          subject: 'Password Reset Request for Cultivate',
            html: this.getPasswordResetEmailTemplate(resetUrl),
            text: this.getPasswordResetEmailTextTemplate(resetUrl),
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * HTML email template for password reset
     */
    private getPasswordResetEmailTemplate(resetUrl: string): string {
        return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request for Cultivate</h2>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0972D3; color: white; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>If the link above isn't clickable, try pasting this URL into your browser: ${resetUrl}</p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
      </div>
    `;
    }

    /**
     * Plain text email template for password reset
     */
    private getPasswordResetEmailTextTemplate(resetUrl: string): string {
        return `
Password Reset Request

You requested to reset your password. Click the link below to proceed:

${resetUrl}

This link will expire in 15 minutes.

If you didn't request this password reset, you can safely ignore this email.
    `;
    }
}
