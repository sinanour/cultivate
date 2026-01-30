/**
 * Geocoding Service
 * 
 * Integrates with backend geocoding proxy to convert addresses to coordinates.
 * The backend proxies requests to Nominatim API with proper User-Agent header.
 * 
 * Note: Direct browser requests to Nominatim cannot set custom User-Agent headers
 * due to browser security restrictions. The backend proxy solves this limitation.
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

export class GeocodingService {
    private static readonly API_BASE_URL = import.meta.env.BACKEND_URL || '/api/v1';
    private static cache = new Map<string, GeocodingResult[]>();

    /**
     * Geocode an address to coordinates using backend proxy
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

        // Build query parameters
        const params = new URLSearchParams({
            q: address
        });

        // Get auth token from localStorage
        const tokensStr = localStorage.getItem('authTokens');
        if (!tokensStr) {
            throw new Error('Authentication required for geocoding');
        }

        let accessToken: string;
        try {
            const tokens = JSON.parse(tokensStr);
            accessToken = tokens.accessToken;
            if (!accessToken) {
                throw new Error('Authentication required for geocoding');
            }
        } catch (error) {
            throw new Error('Authentication required for geocoding');
        }

        // Make API request to backend proxy
        const response = await fetch(`${this.API_BASE_URL}/geocoding/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required for geocoding');
            }
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }

        const result = await response.json();
        const data: GeocodingResult[] = result.data.map((item: any) => ({
            ...item,
            address: item.address || {},
            boundingBox: item.boundingBox || undefined
        }));

        // Cache results
        this.cache.set(normalizedAddress, data);

        return data;
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
