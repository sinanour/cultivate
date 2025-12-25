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
            const mockResponse = {
                accessToken: 'access-token-123',
                refreshToken: 'refresh-token-456',
                user: {
                    id: '1',
                    email: 'test@example.com',
                    name: 'Test User',
                    role: 'EDITOR',
                },
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await AuthService.login({
                email: 'test@example.com',
                password: 'password123',
            });

            expect(result.user).toEqual(mockResponse.user);
            expect(result.tokens.accessToken).toBe('access-token-123');
            expect(result.tokens.refreshToken).toBe('refresh-token-456');

            // Check localStorage
            const storedTokens = localStorage.getItem('authTokens');
            expect(storedTokens).toBeTruthy();

            const storedUser = localStorage.getItem('authUser');
            expect(storedUser).toBeTruthy();
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

            AuthService.logout();

            expect(localStorage.getItem('authTokens')).toBeNull();
            expect(localStorage.getItem('authUser')).toBeNull();
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            localStorage.setItem('authTokens', JSON.stringify({
                accessToken: 'old-access',
                refreshToken: 'refresh-token',
            }));

            const mockResponse = {
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
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

            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'Invalid token' }),
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
});
