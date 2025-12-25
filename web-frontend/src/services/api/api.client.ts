import { AuthService } from '../auth/auth.service';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export class ApiClient {
    private static async getHeaders(): Promise<HeadersInit> {
        const tokens = AuthService.getStoredTokens();
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (tokens?.accessToken) {
            headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        }

        return headers;
    }

    static async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: await this.getHeaders(),
        });

        if (response.status === 401) {
            // Token expired, try to refresh
            try {
                await AuthService.refreshToken();
                // Retry the request
                return this.get<T>(endpoint);
            } catch (error) {
                // Refresh failed, redirect to login
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || 'Request failed');
        }

        return response.json();
    }

    static async post<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: await this.getHeaders(),
            body: JSON.stringify(data),
        });

        if (response.status === 401) {
            try {
                await AuthService.refreshToken();
                return this.post<T>(endpoint, data);
            } catch (error) {
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || 'Request failed');
        }

        return response.json();
    }

    static async put<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: await this.getHeaders(),
            body: JSON.stringify(data),
        });

        if (response.status === 401) {
            try {
                await AuthService.refreshToken();
                return this.put<T>(endpoint, data);
            } catch (error) {
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || 'Request failed');
        }

        return response.json();
    }

    static async delete<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: await this.getHeaders(),
        });

        if (response.status === 401) {
            try {
                await AuthService.refreshToken();
                return this.delete<T>(endpoint);
            } catch (error) {
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || 'Request failed');
        }

        // DELETE might return 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }
}
