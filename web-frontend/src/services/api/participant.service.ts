import type { Participant, Assignment } from '../../types';
import { ApiClient } from './api.client';

interface CreateParticipantData {
    name: string;
    email: string;
    phone?: string;
    notes?: string;
    homeVenueId?: string;
}

interface UpdateParticipantData extends CreateParticipantData {
    version?: number;
}

export class ParticipantService {
    static async getParticipants(page?: number, limit?: number, geographicAreaId?: string | null, search?: string): Promise<Participant[]> {
        const params = new URLSearchParams();
        if (page) params.append('page', page.toString());
        if (limit) params.append('limit', limit.toString());
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        if (search) params.append('search', search);
        const query = params.toString();
        return ApiClient.get<Participant[]>(`/participants${query ? `?${query}` : ''}`);
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
}
