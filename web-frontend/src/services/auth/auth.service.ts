import type { User, AuthTokens, LoginCredentials } from '../../types';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api/v1';

export class AuthService {
    private static readonly TOKEN_KEY = 'authTokens';
    private static readonly USER_KEY = 'authUser';

    static async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Login failed' }));
            throw new Error(error.message || 'Login failed');
        }

        const loginData = await response.json();

        // Extract tokens from the response wrapper { success: true, data: { accessToken, refreshToken } }
        const tokens = loginData.data;

        // Store tokens first
        this.storeTokens(tokens.accessToken, tokens.refreshToken);

        // Fetch complete user info from /auth/me endpoint to get displayName and other fields
        const user = await this.fetchCurrentUser();

        return {
            user,
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
        };
    }

    static logout(): void {
        // Call backend logout endpoint to invalidate refresh token
        // Don't await - we want to clear client state immediately
        fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        }).catch((error) => {
            console.error('Logout API call failed:', error);
        });

        // Clear tokens from localStorage
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);

        // Clear any other user-specific localStorage items
        // Check for and remove any keys that might contain user-specific data
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.includes('user') ||
                key.includes('auth') ||
                key.includes('profile') ||
                key === 'globalGeographicAreaFilter' // Clear user's filter preference
            )) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear all sessionStorage
        sessionStorage.clear();

        // React Query cache clearing is handled in AuthContext.logout()
        // Hard navigation is handled in AuthContext.logout()
    }

    static async refreshToken(): Promise<AuthTokens> {
        const tokens = this.getStoredTokens();

        if (!tokens?.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });

        if (!response.ok) {
            this.logout();
            throw new Error('Token refresh failed');
        }

        const refreshData = await response.json();
        // Extract tokens from response wrapper { success: true, data: { accessToken, refreshToken } }
        const newTokens = refreshData.data;

        this.storeTokens(newTokens.accessToken, newTokens.refreshToken);

        return {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
        };
    }

    static async fetchCurrentUser(): Promise<User> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch current user');
        }

        const userData = await response.json();
        // Extract user from response wrapper { success: true, data: { id, displayName, email, role, ... } }
        const user = userData.data;

        // Store the complete user object including displayName
        this.storeUser(user);

        return user;
    }

    static getCurrentUser(): User | null {
        const userStr = localStorage.getItem(this.USER_KEY);
        if (!userStr) return null;

        try {
            return JSON.parse(userStr);
        } catch (error) {
            console.error('Failed to parse stored user:', error);
            return null;
        }
    }

    static getStoredTokens(): AuthTokens | null {
        const tokensStr = localStorage.getItem(this.TOKEN_KEY);
        if (!tokensStr) return null;

        try {
            return JSON.parse(tokensStr);
        } catch (error) {
            console.error('Failed to parse stored tokens:', error);
            return null;
        }
    }

    private static storeTokens(accessToken: string, refreshToken: string): void {
        const tokens: AuthTokens = { accessToken, refreshToken };
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokens));
    }

    private static storeUser(user: User): void {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }

    static isTokenExpired(token: string): boolean {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (!payload.exp) {
                return true;
            }
            const exp = payload.exp * 1000;
            return Date.now() >= exp;
        } catch {
            return true;
        }
    }

    static decodeToken(token: string): { userId: string; email: string; role: string } | null {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return {
                userId: payload.userId,
                email: payload.email,
                role: payload.role,
            };
        } catch (error) {
            console.error('Failed to decode token:', error);
            return null;
        }
    }

    /**
     * Request a password reset email
     */
    static async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${API_BASE_URL}/auth/request-password-reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Password reset request failed' }));
            throw new Error(error.message || 'Password reset request failed');
        }

        return await response.json();
    }

    /**
     * Reset password using token
     */
    static async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, newPassword }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Password reset failed' }));
            throw new Error(error.message || 'Password reset failed');
        }

        return await response.json();
    }

    /**
     * Invalidate all tokens for the current user across all devices
     * Requires authentication
     */
    static async invalidateAllTokens(): Promise<void> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/invalidate-tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Token invalidation failed' }));
            throw new Error(error.message || 'Token invalidation failed');
        }
    }

    /**
     * Invalidate all tokens for a specific user (admin only)
     * Requires authentication with admin role
     */
    static async invalidateUserTokens(userId: string): Promise<void> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/invalidate-tokens/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Token invalidation failed' }));
            throw new Error(error.message || 'Token invalidation failed');
        }
    }
}
