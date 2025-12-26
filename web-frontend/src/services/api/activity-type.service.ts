import type { ActivityType } from '../../types';
import { ApiClient } from './api.client';

export class ActivityTypeService {
    static async getActivityTypes(): Promise<ActivityType[]> {
        return ApiClient.get<ActivityType[]>('/activity-types');
    }

    static async createActivityType(data: { name: string }): Promise<ActivityType> {
        return ApiClient.post<ActivityType>('/activity-types', data);
    }

    static async updateActivityType(
        id: string,
        data: { name: string; version?: number }
    ): Promise<ActivityType> {
        return ApiClient.put<ActivityType>(`/activity-types/${id}`, data);
    }

    static async deleteActivityType(id: string): Promise<void> {
        return ApiClient.delete<void>(`/activity-types/${id}`);
    }
}
