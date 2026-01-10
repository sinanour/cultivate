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

export class VenueService {
    static async getVenues(page?: number, limit?: number, geographicAreaId?: string | null, search?: string): Promise<Venue[]> {
        const params = new URLSearchParams();
        if (page) params.append('page', page.toString());
        if (limit) params.append('limit', limit.toString());
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        if (search) params.append('search', search);
        const query = params.toString();
        return ApiClient.get<Venue[]>(`/venues${query ? `?${query}` : ''}`);
  }

    static async getVenuesPaginated(page: number = 1, limit: number = 100, geographicAreaId?: string | null, search?: string): Promise<PaginatedResponse<Venue>> {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        if (search) params.append('search', search);
        const query = params.toString();
        return ApiClient.get<PaginatedResponse<Venue>>(`/venues${query ? `?${query}` : ''}`);
    }

  static async getVenue(id: string): Promise<Venue> {
    return ApiClient.get<Venue>(`/venues/${id}`);
  }

    static async searchVenues(query: string): Promise<Venue[]> {
        return ApiClient.get<Venue[]>(`/venues/search?q=${encodeURIComponent(query)}`);
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
