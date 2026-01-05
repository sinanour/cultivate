import type { User, AuthTokens, LoginCredentials } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

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
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
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
}
