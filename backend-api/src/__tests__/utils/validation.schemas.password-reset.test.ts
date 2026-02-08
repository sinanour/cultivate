import { RequestPasswordResetSchema, ResetPasswordSchema } from '../../utils/validation.schemas';

describe('Password Reset Validation Schemas', () => {
    describe('RequestPasswordResetSchema', () => {
        it('should accept valid email addresses', () => {
            const validEmails = [
                'user@example.com',
                'test.user@example.co.uk',
                'user+tag@example.com',
                'user123@test-domain.com',
            ];

            validEmails.forEach((email) => {
                const result = RequestPasswordResetSchema.safeParse({ email });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.email).toBe(email);
                }
            });
        });

        it('should reject invalid email addresses', () => {
            const invalidEmails = [
                'not-an-email',
                '@example.com',
                'user@',
                'user @example.com',
                'user@example',
                '',
            ];

            invalidEmails.forEach((email) => {
                const result = RequestPasswordResetSchema.safeParse({ email });
                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toContain('Invalid email format');
                }
            });
        });

        it('should reject missing email field', () => {
            const result = RequestPasswordResetSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    describe('ResetPasswordSchema', () => {
        it('should accept valid token and password', () => {
            const validData = {
                token: 'valid-jwt-token-string',
                newPassword: 'securePassword123',
            };

            const result = ResetPasswordSchema.safeParse(validData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.token).toBe(validData.token);
                expect(result.data.newPassword).toBe(validData.newPassword);
            }
        });

        it('should require token field', () => {
            const result = ResetPasswordSchema.safeParse({
                newPassword: 'securePassword123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(issue => issue.path.includes('token'))).toBe(true);
            }
        });

        it('should reject empty token', () => {
            const result = ResetPasswordSchema.safeParse({
                token: '',
                newPassword: 'securePassword123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Token is required');
            }
        });

        it('should enforce minimum password length of 8 characters', () => {
            const result = ResetPasswordSchema.safeParse({
                token: 'valid-token',
                newPassword: 'short',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at least 8 characters');
            }
        });

        it('should accept password with exactly 8 characters', () => {
            const result = ResetPasswordSchema.safeParse({
                token: 'valid-token',
                newPassword: '12345678',
            });

            expect(result.success).toBe(true);
        });

        it('should accept password with special characters', () => {
            const result = ResetPasswordSchema.safeParse({
                token: 'valid-token',
                newPassword: 'P@ssw0rd!#$%',
            });

            expect(result.success).toBe(true);
        });

        it('should require newPassword field', () => {
            const result = ResetPasswordSchema.safeParse({
                token: 'valid-token',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(issue => issue.path.includes('newPassword'))).toBe(true);
            }
        });
    });
});
