import { AuthService } from '../auth/auth.service';
import type { APIError } from '../../types';
import { geographicFilterEvents } from '../../utils/geographic-filter-events';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api/v1';

export class ApiClient {
    static getBaseURL(): string {
        return API_BASE_URL;
    }

    static getAuthHeaders(): HeadersInit {
        const tokens = AuthService.getStoredTokens();
        const headers: HeadersInit = {};

        if (tokens?.accessToken) {
            headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        }

        return headers;
    }

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

            // Check for geographic authorization denial
            if (response.status === 403 && error.code === 'GEOGRAPHIC_AUTHORIZATION_DENIED') {
                // Emit event to clear global geographic filter
                geographicFilterEvents.emit();
            }

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
        if (body && typeof body === 'object' && 'success' in body) {
            // Check if this is a paginated response (has both data and pagination)
            if ('data' in body && 'pagination' in body) {
                // Return the full paginated response (data + pagination)
                return { data: body.data, pagination: body.pagination } as T;
            }
            // Regular response - return just the data
            if ('data' in body) {
                return body.data as T;
            }
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
            } catch {
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
            } catch {
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
            } catch {
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
            } catch {
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
        }

        return this.handleResponse<T>(response);
    }
}
