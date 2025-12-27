import type { Activity } from '../../types';
import { ApiClient } from './api.client';

interface CreateActivityData {
    name: string;
    activityTypeId: string;
    status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startDate: string;
    endDate?: string;
}

interface UpdateActivityData extends Partial<CreateActivityData> {
    version?: number;
}

export class ActivityService {
    static async getActivities(page?: number, limit?: number, geographicAreaId?: string | null): Promise<Activity[]> {
        const params = new URLSearchParams();
        if (page) params.append('page', page.toString());
        if (limit) params.append('limit', limit.toString());
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        const query = params.toString();
        return ApiClient.get<Activity[]>(`/activities${query ? `?${query}` : ''}`);
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

    static async getActivityParticipants(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/activities/${id}/participants`);
    }

    static async getActivityVenues(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/activities/${id}/venues`);
    }

    static async addActivityVenue(activityId: string, venueId: string, effectiveFrom: string): Promise<any> {
        return ApiClient.post<any>(`/activities/${activityId}/venues`, { venueId, effectiveFrom });
    }

    static async deleteActivityVenue(activityId: string, venueId: string): Promise<void> {
        return ApiClient.delete<void>(`/activities/${activityId}/venues/${venueId}`);
    }
}
