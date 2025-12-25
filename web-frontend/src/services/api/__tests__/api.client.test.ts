import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from '../api.client';
import { AuthService } from '../../auth/auth.service';

vi.mock('../../auth/auth.service');

describe('ApiClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
        vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue({
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
        });
    });

    describe('get', () => {
        it('should make GET request with auth header', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: 'test' }),
            });

            const result = await ApiClient.get('/test');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test'),
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                    }),
                })
            );
            expect(result).toEqual({ data: 'test' });
        });

        it('should handle 401 and refresh token', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    json: async () => ({ message: 'Unauthorized' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: 'test' }),
                });

            vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
                accessToken: 'new-token',
                refreshToken: 'new-refresh',
            });

            const result = await ApiClient.get('/test');

            expect(AuthService.refreshToken).toHaveBeenCalled();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ data: 'test' });
        });

        it('should throw error on non-ok response', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ message: 'Bad request' }),
            });

            await expect(ApiClient.get('/test')).rejects.toThrow('Bad request');
        });
    });

    describe('post', () => {
        it('should make POST request with body', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: '1' }),
            });

            const data = { name: 'Test' };
            const result = await ApiClient.post('/test', data);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(data),
                })
            );
            expect(result).toEqual({ id: '1' });
        });
    });

    describe('put', () => {
        it('should make PUT request with body', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: '1', updated: true }),
            });

            const data = { name: 'Updated' };
            const result = await ApiClient.put('/test/1', data);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test/1'),
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(data),
                })
            );
            expect(result).toEqual({ id: '1', updated: true });
        });
    });

    describe('delete', () => {
        it('should make DELETE request', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 204,
            });

            const result = await ApiClient.delete('/test/1');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test/1'),
                expect.objectContaining({
                    method: 'DELETE',
                })
            );
            expect(result).toEqual({});
        });

        it('should handle DELETE with JSON response', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ deleted: true }),
            });

            const result = await ApiClient.delete('/test/1');

            expect(result).toEqual({ deleted: true });
        });
    });
});


describe('error handling', () => {
    it('should handle 401 with failed refresh', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Unauthorized' }),
        });

        vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'));

        // Mock window.location.href
        delete (window as any).location;
        (window as any).location = { href: '' };

        await expect(ApiClient.get('/test')).rejects.toThrow('Authentication failed');
        expect(window.location.href).toBe('/login');
    });

    it('should handle error response without JSON body', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error('Invalid JSON');
            },
        });

        await expect(ApiClient.get('/test')).rejects.toThrow('Request failed');
    });

    it('should handle POST 401 and retry', async () => {
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ message: 'Unauthorized' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: '1' }),
            });

        vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
            accessToken: 'new-token',
            refreshToken: 'new-refresh',
        });

        const result = await ApiClient.post('/test', { data: 'test' });

        expect(AuthService.refreshToken).toHaveBeenCalled();
        expect(result).toEqual({ id: '1' });
    });

    it('should handle PUT 401 and retry', async () => {
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ message: 'Unauthorized' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: '1', updated: true }),
            });

        vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
            accessToken: 'new-token',
            refreshToken: 'new-refresh',
        });

        const result = await ApiClient.put('/test/1', { data: 'test' });

        expect(result).toEqual({ id: '1', updated: true });
    });

    it('should handle DELETE 401 and retry', async () => {
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ message: 'Unauthorized' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
            });

        vi.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
            accessToken: 'new-token',
            refreshToken: 'new-refresh',
        });

        const result = await ApiClient.delete('/test/1');

        expect(result).toEqual({});
    });

    it('should redirect to login on POST 401 with failed refresh', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Unauthorized' }),
        });

        vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'));

        delete (window as any).location;
        (window as any).location = { href: '' };

        await expect(ApiClient.post('/test', {})).rejects.toThrow('Authentication failed');
        expect(window.location.href).toBe('/login');
    });

    it('should redirect to login on PUT 401 with failed refresh', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Unauthorized' }),
        });

        vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'));

        delete (window as any).location;
        (window as any).location = { href: '' };

        await expect(ApiClient.put('/test/1', {})).rejects.toThrow('Authentication failed');
        expect(window.location.href).toBe('/login');
    });

    it('should redirect to login on DELETE 401 with failed refresh', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Unauthorized' }),
        });

        vi.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'));

        delete (window as any).location;
        (window as any).location = { href: '' };

        await expect(ApiClient.delete('/test/1')).rejects.toThrow('Authentication failed');
        expect(window.location.href).toBe('/login');
    });
});
