import type { ParticipantRole } from '../../types';
import { ApiClient } from './api.client';

export class ParticipantRoleService {
    static async getRoles(): Promise<ParticipantRole[]> {
        return ApiClient.get<ParticipantRole[]>('/roles');
    }

    static async createRole(data: { name: string }): Promise<ParticipantRole> {
        return ApiClient.post<ParticipantRole>('/roles', data);
    }

    static async updateRole(id: string, data: { name: string; version?: number }): Promise<ParticipantRole> {
        return ApiClient.put<ParticipantRole>(`/roles/${id}`, data);
    }

    static async deleteRole(id: string): Promise<void> {
        return ApiClient.delete<void>(`/roles/${id}`);
    }
}
