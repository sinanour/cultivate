import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../auth.service';

describe('AuthService', () => {
    beforeEach(() => {
        localStorage.clear();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should successfully login and store tokens', async () => {
            // Create a valid JWT token with user info
            const payload = {
                userId: '1',
                email: 'test@example.com',
                role: 'EDITOR',
                exp: Math.floor(Date.now() / 1000) + 3600,
            };
            const mockAccessToken = `header.${btoa(JSON.stringify(payload))}.signature`;

            const mockLoginResponse = {
                success: true,
                data: {
                    accessToken: mockAccessToken,
                    refreshToken: 'refresh-token-456',
                },
            };

            const mockUserResponse = {
                success: true,
                data: {
                    id: '1',
                    displayName: 'Test User',
                    email: 'test@example.com',
                    role: 'EDITOR',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                },
            };

            // Mock both login and /auth/me endpoints
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockLoginResponse,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUserResponse,
                });

            const result = await AuthService.login({
                email: 'test@example.com',
                password: 'password123',
            });

            expect(result.user.id).toBe('1');
            expect(result.user.displayName).toBe('Test User');
            expect(result.user.email).toBe('test@example.com');
            expect(result.user.role).toBe('EDITOR');
            expect(result.tokens.accessToken).toBe(mockAccessToken);
            expect(result.tokens.refreshToken).toBe('refresh-token-456');

            // Check localStorage
            const storedTokens = localStorage.getItem('authTokens');
            expect(storedTokens).toBeTruthy();

            const storedUser = localStorage.getItem('authUser');
            expect(storedUser).toBeTruthy();

            const parsedUser = JSON.parse(storedUser!);
            expect(parsedUser.displayName).toBe('Test User');
        });

        it('should throw error on failed login', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'Invalid credentials' }),
            });

            await expect(
                AuthService.login({ email: 'test@example.com', password: 'wrong' })
            ).rejects.toThrow('Invalid credentials');
        });

        it('should handle network errors', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            await expect(
                AuthService.login({ email: 'test@example.com', password: 'password' })
            ).rejects.toThrow('Network error');
        });
    });

    describe('logout', () => {
        it('should clear tokens and user from localStorage', () => {
            localStorage.setItem('authTokens', JSON.stringify({ accessToken: 'token', refreshToken: 'refresh' }));
            localStorage.setItem('authUser', JSON.stringify({ id: '1', name: 'Test' }));

            // Mock fetch for logout API call
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
            });

            AuthService.logout();

            expect(localStorage.getItem('authTokens')).toBeNull();
            expect(localStorage.getItem('authUser')).toBeNull();
        });

        it('should clear all user-specific localStorage items', () => {
            // Set up various user-specific items
            localStorage.setItem('authTokens', JSON.stringify({ accessToken: 'token', refreshToken: 'refresh' }));
            localStorage.setItem('authUser', JSON.stringify({ id: '1', name: 'Test' }));
            localStorage.setItem('userPreferences', JSON.stringify({ theme: 'dark' }));
            localStorage.setItem('globalGeographicAreaFilter', 'area-123');
            localStorage.setItem('someOtherKey', 'should-remain');

            // Mock fetch for logout API call
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
            });

            AuthService.logout();

            // Auth-related items should be cleared
            expect(localStorage.getItem('authTokens')).toBeNull();
            expect(localStorage.getItem('authUser')).toBeNull();
            expect(localStorage.getItem('userPreferences')).toBeNull();
            expect(localStorage.getItem('globalGeographicAreaFilter')).toBeNull();

            // Non-auth items should remain
            expect(localStorage.getItem('someOtherKey')).toBe('should-remain');
        });

        it('should handle empty localStorage gracefully', () => {
            // Mock fetch for logout API call
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
            });

            expect(() => AuthService.logout()).not.toThrow();
        });

        it('should clear sessionStorage', () => {
            sessionStorage.setItem('tempData', 'should-be-cleared');

            // Mock fetch for logout API call
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
            });

            AuthService.logout();

            expect(sessionStorage.length).toBe(0);
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            localStorage.setItem('authTokens', JSON.stringify({
                accessToken: 'old-access',
                refreshToken: 'refresh-token',
            }));

            const mockResponse = {
                success: true,
                data: {
                    accessToken: 'new-access-token',
                    refreshToken: 'new-refresh-token',
                },
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await AuthService.refreshToken();

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBe('new-refresh-token');
        });

        it('should throw error when no refresh token available', async () => {
            await expect(AuthService.refreshToken()).rejects.toThrow('No refresh token available');
        });

        it('should logout on failed refresh', async () => {
            localStorage.setItem('authTokens', JSON.stringify({
                accessToken: 'old-access',
                refreshToken: 'refresh-token',
            }));

            // Mock failed refresh
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: false,
                    json: async () => ({ message: 'Invalid token' }),
                })
                // Mock logout API call
                .mockResolvedValueOnce({
                    ok: true,
                });

            await expect(AuthService.refreshToken()).rejects.toThrow('Token refresh failed');

            // Should have cleared localStorage
            expect(localStorage.getItem('authTokens')).toBeNull();
        });
    });

    describe('getCurrentUser', () => {
        it('should return stored user', () => {
            const user = {
                id: '1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'EDITOR' as const,
            };

            localStorage.setItem('authUser', JSON.stringify(user));

            const result = AuthService.getCurrentUser();
            expect(result).toEqual(user);
        });

        it('should return null when no user stored', () => {
            const result = AuthService.getCurrentUser();
            expect(result).toBeNull();
        });

        it('should return null for invalid JSON', () => {
            localStorage.setItem('authUser', 'invalid-json');

            const result = AuthService.getCurrentUser();
            expect(result).toBeNull();
        });
    });

    describe('getStoredTokens', () => {
        it('should return stored tokens', () => {
            const tokens = {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            };

            localStorage.setItem('authTokens', JSON.stringify(tokens));

            const result = AuthService.getStoredTokens();
            expect(result).toEqual(tokens);
        });

        it('should return null when no tokens stored', () => {
            const result = AuthService.getStoredTokens();
            expect(result).toBeNull();
        });

        it('should return null for invalid JSON', () => {
            localStorage.setItem('authTokens', 'invalid-json');

            const result = AuthService.getStoredTokens();
            expect(result).toBeNull();
        });
    });

    describe('isTokenExpired', () => {
        it('should return false for valid token', () => {
            // Create a token that expires in 1 hour
            const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
            const token = `header.${btoa(JSON.stringify(payload))}.signature`;

            const result = AuthService.isTokenExpired(token);
            expect(result).toBe(false);
        });

        it('should return true for expired token', () => {
            // Create a token that expired 1 hour ago
            const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
            const token = `header.${btoa(JSON.stringify(payload))}.signature`;

            const result = AuthService.isTokenExpired(token);
            expect(result).toBe(true);
        });

        it('should return true for invalid token format', () => {
            const result = AuthService.isTokenExpired('invalid-token');
            expect(result).toBe(true);
        });

        it('should return true for token without exp claim', () => {
            const payload = { sub: 'user123' };
            const token = `header.${btoa(JSON.stringify(payload))}.signature`;

            const result = AuthService.isTokenExpired(token);
            expect(result).toBe(true);
        });
    });

    describe('requestPasswordReset', () => {
        it('should call correct endpoint with email', async () => {
            const mockResponse = {
                success: true,
                message: 'If the email exists, a password reset link has been sent.',
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await AuthService.requestPasswordReset('user@example.com');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/request-password-reset'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: 'user@example.com' }),
                })
            );

            expect(result.success).toBe(true);
            expect(result.message).toBe('If the email exists, a password reset link has been sent.');
        });

        it('should handle error responses', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'Server error' }),
            });

            await expect(
                AuthService.requestPasswordReset('user@example.com')
            ).rejects.toThrow('Server error');
        });

        it('should handle network errors', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            await expect(
                AuthService.requestPasswordReset('user@example.com')
            ).rejects.toThrow('Network error');
        });
    });

    describe('resetPassword', () => {
        it('should call correct endpoint with token and password', async () => {
            const mockResponse = {
                success: true,
                message: 'Password has been reset successfully',
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await AuthService.resetPassword('test-token', 'newPassword123');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/reset-password'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: 'test-token', newPassword: 'newPassword123' }),
                })
            );

            expect(result.success).toBe(true);
            expect(result.message).toBe('Password has been reset successfully');
        });

        it('should handle invalid token error', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'Invalid or expired reset token' }),
            });

            await expect(
                AuthService.resetPassword('invalid-token', 'newPassword123')
            ).rejects.toThrow('Invalid or expired reset token');
        });

        it('should handle network errors', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            await expect(
                AuthService.resetPassword('test-token', 'newPassword123')
            ).rejects.toThrow('Network error');
        });

        it('should handle server errors', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'Internal server error' }),
            });

            await expect(
                AuthService.resetPassword('test-token', 'newPassword123')
            ).rejects.toThrow('Internal server error');
        });
    });
});
