import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeocodingService } from '../geocoding.service';

describe('GeocodingService', () => {
    beforeEach(() => {
        // Clear cache before each test
        GeocodingService.clearCache();

        // Reset fetch mock
        global.fetch = vi.fn();

        // Mock localStorage with valid auth tokens
        const localStorageMock = {
            getItem: vi.fn((key: string) => {
                if (key === 'authTokens') {
                    return JSON.stringify({
                        accessToken: 'mock-token-123',
                        refreshToken: 'mock-refresh-token'
                    });
                }
                return null;
            }),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn()
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true
        });
    });

    describe('geocodeAddress', () => {
        it('should throw error for empty address', async () => {
            await expect(GeocodingService.geocodeAddress('')).rejects.toThrow('Address is required');
        });

        it('should throw error for whitespace-only address', async () => {
            await expect(GeocodingService.geocodeAddress('   ')).rejects.toThrow('Address is required');
        });

        it('should return geocoding results for valid address', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: '123 Main Street, Seattle, WA, USA',
                        address: {
                            road: 'Main Street',
                            city: 'Seattle',
                            state: 'Washington',
                            country: 'United States',
                            postcode: '98101'
                        },
                        boundingBox: [47.6061, 47.6063, -122.3322, -122.3320]
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const results = await GeocodingService.geocodeAddress('123 Main Street, Seattle, WA');

            expect(results).toHaveLength(1);
            expect(results[0].latitude).toBe(47.6062);
            expect(results[0].longitude).toBe(-122.3321);
            expect(results[0].displayName).toBe('123 Main Street, Seattle, WA, USA');
            expect(results[0].address.city).toBe('Seattle');

            // Verify it called the backend proxy endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/geocoding/search'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-token-123'
                    })
                })
            );
        });

        it('should return empty array when no results found', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: [] })
            });

            const results = await GeocodingService.geocodeAddress('Invalid Address XYZ123');

            expect(results).toHaveLength(0);
        });

        it('should return multiple results when available', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Main Street, Seattle, WA',
                        address: { city: 'Seattle' }
                    },
                    {
                        latitude: 45.5152,
                        longitude: -122.6784,
                        displayName: 'Main Street, Portland, OR',
                        address: { city: 'Portland' }
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const results = await GeocodingService.geocodeAddress('Main Street');

            expect(results).toHaveLength(2);
            expect(results[0].address.city).toBe('Seattle');
            expect(results[1].address.city).toBe('Portland');
        });

        it('should throw error when API request fails', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                statusText: 'Internal Server Error'
            });

            await expect(GeocodingService.geocodeAddress('123 Main St')).rejects.toThrow('Geocoding failed');
        });

        it('should include User-Agent header in request', async () => {
            // This test is no longer relevant since User-Agent is set by backend
            // Instead, verify that Authorization header is included
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: [] })
            });

            await GeocodingService.geocodeAddress('123 Main St');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/geocoding/search'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-token-123'
                    })
                })
            );
        });

        it('should cache results for same address', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Seattle, WA',
                        address: {}
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // First call
            const results1 = await GeocodingService.geocodeAddress('Seattle, WA');

            // Second call (should use cache)
            const results2 = await GeocodingService.geocodeAddress('Seattle, WA');

            expect(results1).toEqual(results2);
            expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should normalize address for cache key', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Seattle, WA',
                        address: {}
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // First call with different casing and whitespace
            await GeocodingService.geocodeAddress('  Seattle, WA  ');

            // Second call (should use cache despite different formatting)
            await GeocodingService.geocodeAddress('seattle, wa');

            expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should handle missing address details gracefully', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Unknown Location'
                        // No address field
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const results = await GeocodingService.geocodeAddress('Unknown');

            expect(results).toHaveLength(1);
            expect(results[0].address).toEqual({});
        });

        it('should handle missing bounding box gracefully', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Location'
                        // No boundingBox field
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            const results = await GeocodingService.geocodeAddress('Location');

            expect(results).toHaveLength(1);
            expect(results[0].boundingBox).toBeUndefined();
        });

        it('should throw error when authentication token is missing', async () => {
            // Mock localStorage without token
            const localStorageMock = {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
                length: 0,
                key: vi.fn()
            };
            Object.defineProperty(window, 'localStorage', {
                value: localStorageMock,
                writable: true
            });

            await expect(GeocodingService.geocodeAddress('Seattle, WA')).rejects.toThrow('Authentication required');
        });
    });

    describe('clearCache', () => {
        it('should clear the cache', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Seattle, WA',
                        address: {}
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse
            });

            // Add to cache
            await GeocodingService.geocodeAddress('Seattle, WA');
            expect(GeocodingService.getCacheSize()).toBe(1);

            // Clear cache
            GeocodingService.clearCache();
            expect(GeocodingService.getCacheSize()).toBe(0);
        });
    });

    describe('getCacheSize', () => {
        it('should return 0 for empty cache', () => {
            expect(GeocodingService.getCacheSize()).toBe(0);
        });

        it('should return correct cache size', async () => {
            const mockApiResponse = {
                success: true,
                data: [
                    {
                        latitude: 47.6062,
                        longitude: -122.3321,
                        displayName: 'Location',
                        address: {}
                    }
                ]
            };

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockApiResponse
            });

            await GeocodingService.geocodeAddress('Address 1');
            expect(GeocodingService.getCacheSize()).toBe(1);

            await GeocodingService.geocodeAddress('Address 2');
            expect(GeocodingService.getCacheSize()).toBe(2);
        });
    });
});

