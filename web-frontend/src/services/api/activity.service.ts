import { Activity } from '../../types';
import { ApiClient } from './api.client';

interface CreateActivityData {
    name: string;
    activityTypeId: string;
    startDate: string;
    endDate?: string;
    isOngoing: boolean;
    venueIds?: string[];
}

interface UpdateActivityData extends CreateActivityData { }

export class ActivityService {
    static async getActivities(): Promise<Activity[]> {
        return ApiClient.get<Activity[]>('/activities');
    }

    static async getActivity(id: string): Promise<Activity> {
        return ApiClient.get<Activity>(`/activities/${id}`);
    }

    static async createActivity(data: CreateActivityData): Promise<Activity> {
        return ApiClient.post<Activity>('/activities', data);
    }

    static async updateActivity(id: string, data: UpdateActivityData): Promise<Activity> {
        return ApiClient.put<Activity>(`/activities/${id}`, data);
    }

    static async deleteActivity(id: string): Promise<void> {
        return ApiClient.delete<void>(`/activities/${id}`);
    }

    static async markComplete(id: string): Promise<Activity> {
        return ApiClient.post<Activity>(`/activities/${id}/complete`, {});
    }
}
