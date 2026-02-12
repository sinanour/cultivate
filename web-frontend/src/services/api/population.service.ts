import type { Population, ParticipantPopulation } from '../../types';
import { ApiClient } from './api.client';

export class PopulationService {
    static async getPopulations(): Promise<Population[]> {
        return ApiClient.get<Population[]>('/populations');
    }

    static async getPopulationById(id: string): Promise<Population> {
        return ApiClient.get<Population>(`/populations/${id}`);
    }

    static async createPopulation(data: { name: string }): Promise<Population> {
        return ApiClient.post<Population>('/populations', data);
    }

    static async updatePopulation(id: string, data: { name: string }, version?: number): Promise<Population> {
        return ApiClient.put<Population>(`/populations/${id}`, { ...data, version });
    }

    static async deletePopulation(id: string): Promise<void> {
        await ApiClient.delete(`/populations/${id}`);
    }
}

export class ParticipantPopulationService {
    static async getParticipantPopulations(participantId: string): Promise<ParticipantPopulation[]> {
        return ApiClient.get<ParticipantPopulation[]>(`/participants/${participantId}/populations`);
    }

    static async addParticipantToPopulation(participantId: string, populationId: string): Promise<ParticipantPopulation> {
        return ApiClient.post<ParticipantPopulation>(
            `/participants/${participantId}/populations`,
            { populationId }
        );
    }

    static async removeParticipantFromPopulation(participantId: string, populationId: string): Promise<void> {
        await ApiClient.delete(`/participants/${participantId}/populations/${populationId}`);
    }
}
