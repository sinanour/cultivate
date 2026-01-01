import type { Activity } from '../../types';
import { ApiClient } from './api.client';

interface CreateActivityData {
    name: string;
    activityTypeId: string;
    status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startDate: string;
    endDate?: string | null;
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

    static async addActivityVenue(activityId: string, venueId: string, effectiveFrom: string | null): Promise<any> {
        return ApiClient.post<any>(`/activities/${activityId}/venues`, { venueId, effectiveFrom });
    }

    static async deleteActivityVenue(activityId: string, venueId: string): Promise<void> {
        return ApiClient.delete<void>(`/activities/${activityId}/venues/${venueId}`);
    }

    static async exportActivities(geographicAreaId?: string | null): Promise<void> {
        const params = new URLSearchParams();
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
        const query = params.toString();

        const response = await fetch(`${ApiClient.getBaseURL()}/activities/export${query ? `?${query}` : ''}`, {
            method: 'GET',
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to export activities');
        }

        const blob = await response.blob();
        const { downloadBlob } = await import('../../utils/csv.utils');
        const filename = `activities-${new Date().toISOString().split('T')[0]}.csv`;
        downloadBlob(blob, filename);
    }

    static async importActivities(file: File): Promise<import('../../types/csv.types').ImportResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${ApiClient.getBaseURL()}/activities/import`, {
            method: 'POST',
            headers: {
                ...ApiClient.getAuthHeaders(),
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to import activities');
        }

        const result = await response.json();
        return result.data;
    }
}
