import type { Venue } from '../../types';
import { ApiClient } from './api.client';

interface CreateVenueData {
    name: string;
    address: string;
    geographicAreaId: string;
    latitude?: number | null;
    longitude?: number | null;
    venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE' | null;
}

interface UpdateVenueData extends Partial<CreateVenueData> {
    version?: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface FlexibleQueryOptions {
    page?: number;
    limit?: number;
    geographicAreaId?: string | null;
    filter?: Record<string, any>;
    fields?: string[];
}

export class VenueService {
    /**
     * Get venues with flexible filtering and customizable attribute selection
     */
    static async getVenuesFlexible(options: FlexibleQueryOptions): Promise<PaginatedResponse<Venue>> {
        const params = new URLSearchParams();

        // Add pagination params
        if (options.page) params.append('page', options.page.toString());
        if (options.limit) params.append('limit', options.limit.toString());

        // Add geographicAreaId as first-class parameter (not in filter[])
        if (options.geographicAreaId) params.append('geographicAreaId', options.geographicAreaId);

        // Add flexible filter params using filter[fieldName]=value syntax
        if (options.filter) {
            for (const [key, value] of Object.entries(options.filter)) {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        params.append(`filter[${key}]`, value.join(','));
                    } else {
                        params.append(`filter[${key}]`, value.toString());
                    }
                }
            }
        }

        // Add fields param
        if (options.fields && options.fields.length > 0) {
            params.append('fields', options.fields.join(','));
        }

        const query = params.toString();
        return ApiClient.get<PaginatedResponse<Venue>>(`/venues${query ? `?${query}` : ''}`);
    }

    static async getVenues(page?: number, limit?: number, geographicAreaId?: string | null): Promise<PaginatedResponse<Venue>> {
        // Delegate to flexible method for backward compatibility
        return this.getVenuesFlexible({ page, limit, geographicAreaId });
    }

  static async getVenue(id: string): Promise<Venue> {
    return ApiClient.get<Venue>(`/venues/${id}`);
  }

    static async createVenue(data: CreateVenueData): Promise<Venue> {
        return ApiClient.post<Venue>('/venues', data);
    }

    static async updateVenue(id: string, data: UpdateVenueData): Promise<Venue> {
        return ApiClient.put<Venue>(`/venues/${id}`, data);
    }

    static async deleteVenue(id: string): Promise<void> {
        return ApiClient.delete<void>(`/venues/${id}`);
    }

    static async getVenueActivities(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/venues/${id}/activities`);
    }

    static async getVenueParticipants(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/venues/${id}/participants`);
    }

    static async exportVenues(geographicAreaId?: string | null): Promise<void> {
        const params = new URLSearchParams();
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        const query = params.toString();

        const response = await fetch(`${ApiClient.getBaseURL()}/venues/export${query ? `?${query}` : ''}`, {
            method: 'GET',
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to export venues');
        }

        const blob = await response.blob();
        const { downloadBlob } = await import('../../utils/csv.utils');
        const filename = `venues-${new Date().toISOString().split('T')[0]}.csv`;
        downloadBlob(blob, filename);
    }

    static async importVenues(file: File): Promise<import('../../types/csv.types').ImportResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${ApiClient.getBaseURL()}/venues/import`, {
            method: 'POST',
            headers: {
                ...ApiClient.getAuthHeaders(),
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to import venues');
        }

        const result = await response.json();
        return result.data;
    }
}
