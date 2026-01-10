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

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ActivityFilterParams {
    page?: number;
    limit?: number;
    geographicAreaId?: string | null;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    status?: string[];
    populationIds?: string[];
    startDate?: string;
    endDate?: string;
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

    static async getActivitiesPaginated(
        page: number = 1,
        limit: number = 100,
        filters?: ActivityFilterParams
    ): Promise<PaginatedResponse<Activity>> {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        if (filters?.geographicAreaId) {
            params.append('geographicAreaId', filters.geographicAreaId);
        }

        // Activity category filter (OR logic within dimension)
        if (filters?.activityCategoryIds && filters.activityCategoryIds.length > 0) {
            filters.activityCategoryIds.forEach(id => {
                params.append('activityCategoryId', id);
            });
        }

        // Activity type filter (OR logic within dimension)
        if (filters?.activityTypeIds && filters.activityTypeIds.length > 0) {
            filters.activityTypeIds.forEach(id => {
                params.append('activityTypeId', id);
            });
        }

        // Status filter (OR logic within dimension)
        if (filters?.status && filters.status.length > 0) {
            filters.status.forEach(s => {
                params.append('status', s);
            });
        }

        // Population filter (OR logic within dimension)
        if (filters?.populationIds && filters.populationIds.length > 0) {
            filters.populationIds.forEach(id => {
                params.append('populationId', id);
            });
        }

        // Date range filter
        if (filters?.startDate) {
            params.append('startDate', filters.startDate);
        }
        if (filters?.endDate) {
            params.append('endDate', filters.endDate);
        }

        const query = params.toString();
        return ApiClient.get<PaginatedResponse<Activity>>(`/activities${query ? `?${query}` : ''}`);
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

    static async deleteActivityVenue(activityId: string, venueHistoryId: string): Promise<void> {
        return ApiClient.delete<void>(`/activities/${activityId}/venue-history/${venueHistoryId}`);
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
