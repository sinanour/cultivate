import { Participant } from '../../types';
import { ApiClient } from './api.client';

interface CreateParticipantData {
    name: string;
    email: string;
    phone?: string;
    notes?: string;
    homeVenueId?: string;
}

interface UpdateParticipantData extends CreateParticipantData { }

export class ParticipantService {
    static async getParticipants(): Promise<Participant[]> {
        return ApiClient.get<Participant[]>('/participants');
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
}
