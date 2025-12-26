import { AuthService } from '../auth/auth.service';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

interface APIResponse<T> {
    success: boolean;
    data: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface APIError {
    code: string;
    message: string;
    details?: any;
}

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

    private static async handleResponse<T>(response: Response): Promise<T> {
        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        // Parse response body
        const body = await response.json().catch(() => null);

        // Handle errors
        if (!response.ok) {
            const error: APIError = body || { code: 'UNKNOWN_ERROR', message: 'Request failed' };
            const errorObj: any = new Error(error.message);
            errorObj.response = {
                status: response.status,
                data: error,
                headers: response.headers ? Object.fromEntries(response.headers.entries()) : {},
            };
            errorObj.code = error.code;
            throw errorObj;
        }

        // Handle success response with wrapper
        if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
            return body.data as T;
        }

        // Fallback for responses without wrapper
        return body as T;
    }

    static async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: await this.getHeaders(),
        });

        if (response.status === 401) {
            try {
                await AuthService.refreshToken();
                return this.get<T>(endpoint);
            } catch (error) {
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }

        return this.handleResponse<T>(response);
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

        return this.handleResponse<T>(response);
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

        return this.handleResponse<T>(response);
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

        return this.handleResponse<T>(response);
    }
}
