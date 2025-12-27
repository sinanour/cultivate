/**
 * Geocoding Service
 * 
 * Integrates with Nominatim API (OpenStreetMap) to convert addresses to coordinates.
 * Respects Nominatim usage policy with rate limiting and User-Agent header.
 * 
 * API Documentation: https://nominatim.org/release-docs/latest/api/Overview/
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 */

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
    private static readonly USER_AGENT = 'CommunityActivityTracker/1.0';
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
    static async geocodeAddress(address: string): Promise<GeocodingResult[]> {
        if (!address || address.trim().length === 0) {
            throw new Error('Address is required for geocoding');
        }

        // Normalize address for cache key
        const normalizedAddress = address.trim().toLowerCase();

        // Check cache first
        if (this.cache.has(normalizedAddress)) {
            return this.cache.get(normalizedAddress)!;
        }

        // Enforce rate limiting (1 request per second)
        await this.enforceRateLimit();

        // Build query parameters
        const params = new URLSearchParams({
            q: address,
            format: 'json',
            limit: '5',
            addressdetails: '1'
        });

        // Make API request
        const response = await fetch(`${this.BASE_URL}/search?${params}`, {
            headers: {
                'User-Agent': this.USER_AGENT
            }
        });

        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }

        const data: NominatimResponse[] = await response.json();
        this.lastRequestTime = Date.now();

        // Transform to our format
        const results: GeocodingResult[] = data.map((item) => ({
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
        this.cache.set(normalizedAddress, results);

        return results;
    }

    /**
     * Enforce rate limiting to respect Nominatim usage policy
     * Waits if necessary to maintain max 1 request per second
     */
    private static async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
            const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    /**
     * Clear the geocoding cache
     * Useful for testing or when memory needs to be freed
     */
    static clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache size (for debugging/monitoring)
     */
    static getCacheSize(): number {
        return this.cache.size;
    }
}
