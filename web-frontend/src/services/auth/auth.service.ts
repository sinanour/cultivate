import { User, AuthTokens, LoginCredentials } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

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

        const data: LoginResponse = await response.json();

        // Store tokens and user
        this.storeTokens(data.accessToken, data.refreshToken);
        this.storeUser(data.user);

        return {
            user: data.user,
            tokens: {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
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

        const data = await response.json();

        this.storeTokens(data.accessToken, data.refreshToken);

        return {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        };
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
            const exp = payload.exp * 1000; // Convert to milliseconds
            return Date.now() >= exp;
        } catch (error) {
            return true;
        }
    }
}
