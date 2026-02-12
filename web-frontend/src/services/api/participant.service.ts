import type { Participant, Assignment } from '../../types';
import { ApiClient } from './api.client';

interface CreateParticipantData {
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
    dateOfBirth?: string;
    dateOfRegistration?: string;
    nickname?: string;
    homeVenueId?: string;
}

interface UpdateParticipantData {
    name?: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    dateOfBirth?: string | null;
    dateOfRegistration?: string | null;
    nickname?: string | null;
    homeVenueId?: string | null;
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

export class ParticipantService {
    /**
     * Get participants with flexible filtering and customizable attribute selection
     */
    static async getParticipantsFlexible(options: FlexibleQueryOptions): Promise<PaginatedResponse<Participant>> {
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
        return ApiClient.get<PaginatedResponse<Participant>>(`/participants${query ? `?${query}` : ''}`);
    }
    static async getParticipantById(id: string): Promise<Participant> {
        return ApiClient.get<Participant>(`/participants/${id}`);
    }


    static async getParticipants(page?: number, limit?: number, geographicAreaId?: string | null): Promise<PaginatedResponse<Participant>> {
        // Delegate to flexible method for backward compatibility
        return this.getParticipantsFlexible({ page, limit, geographicAreaId });
    }

    static async getParticipant(id: string): Promise<Participant> {
        return ApiClient.get<Participant>(`/participants/${id}`);
    }

    static async createParticipant(data: CreateParticipantData): Promise<Participant> {
        return ApiClient.post<Participant>('/participants', data);
    }

    static async updateParticipant(id: string, data: UpdateParticipantData): Promise<Participant> {
        return ApiClient.put<Participant>(`/participants/${id}`, data);
    }

    static async deleteParticipant(id: string): Promise<void> {
        return ApiClient.delete<void>(`/participants/${id}`);
    }

    static async getAddressHistory(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/participants/${id}/address-history`);
    }

    static async getParticipantActivities(id: string): Promise<Assignment[]> {
        return ApiClient.get<Assignment[]>(`/participants/${id}/activities`);
    }

    static async exportParticipants(geographicAreaId?: string | null): Promise<void> {
        const params = new URLSearchParams();
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        const query = params.toString();

        const response = await fetch(`${ApiClient.getBaseURL()}/participants/export${query ? `?${query}` : ''}`, {
            method: 'GET',
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to export participants');
        }

        const blob = await response.blob();
        const { downloadBlob } = await import('../../utils/csv.utils');
        const filename = `participants-${new Date().toISOString().split('T')[0]}.csv`;
        downloadBlob(blob, filename);
    }

    static async importParticipants(file: File): Promise<import('../../types/csv.types').ImportResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${ApiClient.getBaseURL()}/participants/import`, {
            method: 'POST',
            headers: {
                ...ApiClient.getAuthHeaders(),
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to import participants');
        }

        const result = await response.json();
        return result.data;
    }
}
