/**
 * Geocoding Service
 * 
 * Proxies geocoding requests to Nominatim API with proper User-Agent header.
 * This service runs on the backend to bypass browser restrictions on User-Agent headers.
 * 
 * API Documentation: https://nominatim.org/release-docs/latest/api/Overview/
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 */

import axios from 'axios';

export interface GeocodingResult {
    latitude: number;
    longitude: number;
    displayName: string;
    address: {
        road?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
    };
    boundingBox?: [number, number, number, number];
}

interface NominatimResponse {
    lat: string;
    lon: string;
    display_name: string;
    address?: {
        road?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
    };
    boundingbox?: string[];
}

export class GeocodingService {
    private static readonly BASE_URL = 'https://nominatim.openstreetmap.org';
    private static readonly USER_AGENT = 'Cultivate/1.0';
    private static readonly RATE_LIMIT_MS = 1000; // 1 request per second
    private static lastRequestTime = 0;
    private static cache = new Map<string, GeocodingResult[]>();

    /**
     * Geocode an address to coordinates using Nominatim API
     * 
     * @param address - Full address string to geocode
     * @returns Array of geocoding results (may be empty if no results found)
     * @throws Error if API request fails
     */
    async geocodeAddress(address: string): Promise<GeocodingResult[]> {
        if (!address || address.trim().length === 0) {
            throw new Error('Address is required for geocoding');
        }

        // Normalize address for cache key
        const normalizedAddress = address.trim().toLowerCase();

        // Check cache first
        if (GeocodingService.cache.has(normalizedAddress)) {
            return GeocodingService.cache.get(normalizedAddress)!;
        }

        // Enforce rate limiting (1 request per second)
        await this.enforceRateLimit();

        try {
            // Make API request with proper User-Agent header
            const response = await axios.get<NominatimResponse[]>(
                `${GeocodingService.BASE_URL}/search`,
                {
                    params: {
                        q: address,
                        format: 'json',
                        limit: 5,
                        addressdetails: 1
                    },
                    headers: {
                        'User-Agent': GeocodingService.USER_AGENT
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            GeocodingService.lastRequestTime = Date.now();

            // Transform to our format
            const results: GeocodingResult[] = response.data.map((item) => ({
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                displayName: item.display_name,
                address: item.address || {},
                boundingBox: item.boundingbox
                    ? [
                        parseFloat(item.boundingbox[0]),
                        parseFloat(item.boundingbox[1]),
                        parseFloat(item.boundingbox[2]),
                        parseFloat(item.boundingbox[3])
                    ]
                    : undefined
            }));

            // Cache results
            GeocodingService.cache.set(normalizedAddress, results);

            return results;
        } catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { status: number; statusText: string }; request?: unknown };
                if (axiosError.response) {
                    throw new Error(`Geocoding failed: ${axiosError.response.status} ${axiosError.response.statusText}`);
                } else if (axiosError.request) {
                    throw new Error('Geocoding failed: No response from Nominatim API');
                }
            }
            throw new Error('Geocoding failed: Network error');
        }
    }

    /**
     * Enforce rate limiting to respect Nominatim usage policy
     * Waits if necessary to maintain max 1 request per second
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - GeocodingService.lastRequestTime;

        if (timeSinceLastRequest < GeocodingService.RATE_LIMIT_MS) {
            const waitTime = GeocodingService.RATE_LIMIT_MS - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    /**
     * Clear the geocoding cache
     * Useful for testing or when memory needs to be freed
     */
    clearCache(): void {
        GeocodingService.cache.clear();
    }

    /**
     * Get cache size (for debugging/monitoring)
     */
    getCacheSize(): number {
        return GeocodingService.cache.size;
    }
}
