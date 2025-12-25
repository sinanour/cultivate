import type { ParticipantRole } from '../../types';
import { ApiClient } from './api.client';

export class ParticipantRoleService {
    static async getRoles(): Promise<ParticipantRole[]> {
        return ApiClient.get<ParticipantRole[]>('/participant-roles');
    }

    static async createRole(data: { name: string }): Promise<ParticipantRole> {
        return ApiClient.post<ParticipantRole>('/participant-roles', data);
    }

    static async updateRole(id: string, data: { name: string }): Promise<ParticipantRole> {
        return ApiClient.put<ParticipantRole>(`/participant-roles/${id}`, data);
    }

    static async deleteRole(id: string): Promise<void> {
        return ApiClient.delete<void>(`/participant-roles/${id}`);
    }
}
