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

export class ParticipantService {
    static async getParticipants(page?: number, limit?: number, geographicAreaId?: string | null, search?: string): Promise<PaginatedResponse<Participant>> {
        const params = new URLSearchParams();
        if (page) params.append('page', page.toString());
        if (limit) params.append('limit', limit.toString());
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        if (search) params.append('search', search);
        const query = params.toString();

        // If pagination params provided, return paginated response
        if (page !== undefined || limit !== undefined) {
            return ApiClient.get<PaginatedResponse<Participant>>(`/participants${query ? `?${query}` : ''}`);
        }

        // Otherwise, ApiClient returns the array directly (unwrapped), so wrap it
        const participants = await ApiClient.get<Participant[]>(`/participants${query ? `?${query}` : ''}`);
        return {
            data: participants,
            pagination: {
                page: 1,
                limit: participants.length,
                total: participants.length,
                totalPages: 1
            }
        };
    }

    static async getParticipantsPaginated(page: number = 1, limit: number = 100, geographicAreaId?: string | null, search?: string): Promise<PaginatedResponse<Participant>> {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        if (search) params.append('search', search);
        const query = params.toString();
        return ApiClient.get<PaginatedResponse<Participant>>(`/participants${query ? `?${query}` : ''}`);
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
