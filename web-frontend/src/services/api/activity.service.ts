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
    filter?: Record<string, any>;
    fields?: string[];
}

export class ActivityService {
    /**
     * Get activities with flexible filtering and customizable attribute selection
     */
    static async getActivitiesFlexible(options: ActivityFilterParams): Promise<PaginatedResponse<Activity>> {
        const params = new URLSearchParams();

        // Add pagination params
        if (options.page) params.append('page', options.page.toString());
        if (options.limit) params.append('limit', options.limit.toString());

        // Add geographicAreaId as first-class parameter (not in filter[])
        if (options.geographicAreaId) params.append('geographicAreaId', options.geographicAreaId);

        // Convert legacy parameters to filter[] syntax
        if (!options.filter) options.filter = {};

        // Convert activityCategoryIds to filter[activityCategoryIds]
        if (options.activityCategoryIds && options.activityCategoryIds.length > 0) {
            options.filter.activityCategoryIds = options.activityCategoryIds.join(',');
        }

        // Convert activityTypeIds to filter[activityTypeIds]
        if (options.activityTypeIds && options.activityTypeIds.length > 0) {
            options.filter.activityTypeIds = options.activityTypeIds.join(',');
        }

        // Convert status to filter[status]
        if (options.status && options.status.length > 0) {
            options.filter.status = options.status.join(',');
        }

        // Convert populationIds to filter[populationIds]
        if (options.populationIds && options.populationIds.length > 0) {
            options.filter.populationIds = options.populationIds.join(',');
        }

        // Convert startDate to filter[startDate]
        if (options.startDate) {
            options.filter.startDate = options.startDate;
        }

        // Convert endDate to filter[endDate]
        if (options.endDate) {
            options.filter.endDate = options.endDate;
        }

        // Add flexible filter params using filter[fieldName]=value syntax
        if (options.filter) {
            for (const [key, value] of Object.entries(options.filter)) {
                if (value !== undefined && value !== null) {
                    // Handle nested objects (like updatedAt with operators)
                    if (typeof value === 'object' && !Array.isArray(value)) {
                        // For nested objects like updatedAt: { gte: '...', lte: '...' }
                        for (const [nestedKey, nestedValue] of Object.entries(value)) {
                            if (nestedValue !== undefined && nestedValue !== null) {
                                params.append(`filter[${key}][${nestedKey}]`, String(nestedValue));
                            }
                        }
                    } else if (Array.isArray(value)) {
                        params.append(`filter[${key}]`, value.join(','));
                    } else {
                        params.append(`filter[${key}]`, value.toString());
                    }
                }
            }
        }

        // Add fields param
        if (options.fields && options.fields.length > 0) {
            params.append('fields', options.fields.join(','));
        }

        const query = params.toString();
        return ApiClient.get<PaginatedResponse<Activity>>(`/activities${query ? `?${query}` : ''}`);
    }

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
    static async getActivityById(id: string): Promise<Activity> {
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
