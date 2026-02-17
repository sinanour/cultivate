import type { ParticipantRole } from '../../types';
import { ApiClient } from './api.client';

export class ParticipantRoleService {
    static async getRoles(): Promise<ParticipantRole[]> {
        return ApiClient.get<ParticipantRole[]>('/roles');
    }

    static async searchRoles(searchText: string): Promise<ParticipantRole[]> {
        const params = new URLSearchParams();
        if (searchText) {
            params.append('filter[name]', searchText);
        }
        params.append('limit', '20'); // Limit results for dropdown

        const response = await ApiClient.get<{ data: ParticipantRole[] }>(`/roles?${params.toString()}`);
        return response.data || response as any; // Handle both paginated and non-paginated responses
    }

    static async getRolesByIds(roleIds: string[]): Promise<ParticipantRole[]> {
        // Fetch all roles and filter to requested IDs
        const allRoles = await this.getRoles();
        return allRoles.filter(r => roleIds.includes(r.id));
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
