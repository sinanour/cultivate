import type { ActivityCategory } from '../../types';
import { ApiClient } from './api.client';

export class ActivityCategoryService {
    private baseUrl = '/activity-categories';

    async getActivityCategories(): Promise<ActivityCategory[]> {
        return ApiClient.get<ActivityCategory[]>(this.baseUrl);
    }

    async getActivityCategory(id: string): Promise<ActivityCategory> {
        return ApiClient.get<ActivityCategory>(`${this.baseUrl}/${id}`);
    }

    async createActivityCategory(data: { name: string }): Promise<ActivityCategory> {
        return ApiClient.post<ActivityCategory>(this.baseUrl, data);
    }

    async updateActivityCategory(
        id: string,
        data: { name: string; version?: number }
    ): Promise<ActivityCategory> {
        return ApiClient.put<ActivityCategory>(`${this.baseUrl}/${id}`, data);
    }

    async deleteActivityCategory(id: string): Promise<void> {
        return ApiClient.delete<void>(`${this.baseUrl}/${id}`);
    }
}

export const activityCategoryService = new ActivityCategoryService();
