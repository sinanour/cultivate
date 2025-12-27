import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeocodingService } from '../geocoding.service';

describe('GeocodingService', () => {
    beforeEach(() => {
        // Clear cache before each test
        GeocodingService.clearCache();

        // Reset fetch mock
        global.fetch = vi.fn();
    });

    describe('geocodeAddress', () => {
        it('should throw error for empty address', async () => {
            await expect(GeocodingService.geocodeAddress('')).rejects.toThrow('Address is required');
        });

        it('should throw error for whitespace-only address', async () => {
            await expect(GeocodingService.geocodeAddress('   ')).rejects.toThrow('Address is required');
        });

        it('should return geocoding results for valid address', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: '123 Main Street, Seattle, WA, USA',
                    address: {
                        road: 'Main Street',
                        city: 'Seattle',
                        state: 'Washington',
                        country: 'United States',
                        postcode: '98101'
                    },
                    boundingbox: ['47.6061', '47.6063', '-122.3322', '-122.3320']
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const results = await GeocodingService.geocodeAddress('123 Main Street, Seattle, WA');

            expect(results).toHaveLength(1);
            expect(results[0].latitude).toBe(47.6062);
            expect(results[0].longitude).toBe(-122.3321);
            expect(results[0].displayName).toBe('123 Main Street, Seattle, WA, USA');
            expect(results[0].address.city).toBe('Seattle');
        });

        it('should return empty array when no results found', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            const results = await GeocodingService.geocodeAddress('Invalid Address XYZ123');

            expect(results).toHaveLength(0);
        });

        it('should return multiple results when available', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Main Street, Seattle, WA',
                    address: { city: 'Seattle' }
                },
                {
                    lat: '45.5152',
                    lon: '-122.6784',
                    display_name: 'Main Street, Portland, OR',
                    address: { city: 'Portland' }
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
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
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            await GeocodingService.geocodeAddress('123 Main St');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('nominatim.openstreetmap.org'),
                expect.objectContaining({
                    headers: {
                        'User-Agent': 'CommunityActivityTracker/1.0'
                    }
                })
            );
        });

        it('should cache results for same address', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Seattle, WA',
                    address: {}
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            // First call
            const results1 = await GeocodingService.geocodeAddress('Seattle, WA');

            // Second call (should use cache)
            const results2 = await GeocodingService.geocodeAddress('Seattle, WA');

            expect(results1).toEqual(results2);
            expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should normalize address for cache key', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Seattle, WA',
                    address: {}
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            // First call with different casing and whitespace
            await GeocodingService.geocodeAddress('  Seattle, WA  ');

            // Second call (should use cache despite different formatting)
            await GeocodingService.geocodeAddress('seattle, wa');

            expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should handle missing address details gracefully', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Unknown Location'
                    // No address field
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const results = await GeocodingService.geocodeAddress('Unknown');

            expect(results).toHaveLength(1);
            expect(results[0].address).toEqual({});
        });

        it('should handle missing bounding box gracefully', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Location'
                    // No boundingbox field
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const results = await GeocodingService.geocodeAddress('Location');

            expect(results).toHaveLength(1);
            expect(results[0].boundingBox).toBeUndefined();
        });
    });

    describe('clearCache', () => {
        it('should clear the cache', async () => {
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Seattle, WA',
                    address: {}
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
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
            const mockResponse = [
                {
                    lat: '47.6062',
                    lon: '-122.3321',
                    display_name: 'Location',
                    address: {}
                }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            await GeocodingService.geocodeAddress('Address 1');
            expect(GeocodingService.getCacheSize()).toBe(1);

            await GeocodingService.geocodeAddress('Address 2');
            expect(GeocodingService.getCacheSize()).toBe(2);
        });
    });
});
