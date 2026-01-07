import type { EngagementMetrics, GrowthMetrics, GeographicAnalytics } from '../../types';
import { ApiClient } from './api.client';
import type { TimePeriod, DateGranularity, GroupingDimension } from '../../utils/constants';

export interface EngagementMetricsParams {
    startDate?: string;
    endDate?: string;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    geographicAreaIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
    groupBy?: GroupingDimension[];
    dateGranularity?: DateGranularity;
}

export interface GrowthMetricsParams {
    startDate?: string;
    endDate?: string;
    period?: TimePeriod;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    geographicAreaIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
    groupBy?: 'type' | 'category';
}

export interface ActivityLifecycleData {
    groupName: string;
    started: number;
    completed: number;
}

export interface ActivityLifecycleParams {
    startDate?: string;
    endDate?: string;
    groupBy: 'category' | 'type';
    geographicAreaIds?: string[];
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
}

export class AnalyticsService {
    static async getEngagementMetrics(params: EngagementMetricsParams = {}): Promise<EngagementMetrics> {
        const queryParams = new URLSearchParams();

        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.dateGranularity) queryParams.append('dateGranularity', params.dateGranularity);

        // Handle array parameters - append each value separately
        if (params.activityCategoryIds && params.activityCategoryIds.length > 0) {
            params.activityCategoryIds.forEach(id => {
                queryParams.append('activityCategoryIds', id);
            });
        }

        if (params.activityTypeIds && params.activityTypeIds.length > 0) {
            params.activityTypeIds.forEach(id => {
                queryParams.append('activityTypeIds', id);
            });
        }

        if (params.geographicAreaIds && params.geographicAreaIds.length > 0) {
            params.geographicAreaIds.forEach(id => {
                queryParams.append('geographicAreaIds', id);
            });
        }

        if (params.venueIds && params.venueIds.length > 0) {
            params.venueIds.forEach(id => {
                queryParams.append('venueIds', id);
            });
        }

        if (params.populationIds && params.populationIds.length > 0) {
            params.populationIds.forEach(id => {
                queryParams.append('populationIds', id);
            });
        }

        // Handle groupBy array parameter
        if (params.groupBy && params.groupBy.length > 0) {
            params.groupBy.forEach(dimension => {
                queryParams.append('groupBy', dimension);
            });
        }

        const query = queryParams.toString();
        return ApiClient.get<EngagementMetrics>(`/analytics/engagement${query ? `?${query}` : ''}`);
    }

    static async getGrowthMetrics(params: GrowthMetricsParams = {}): Promise<GrowthMetrics> {
        const queryParams = new URLSearchParams();

        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.period) queryParams.append('period', params.period);
        if (params.groupBy) queryParams.append('groupBy', params.groupBy);

        // Handle array parameters - append each value separately
        if (params.activityCategoryIds && params.activityCategoryIds.length > 0) {
            params.activityCategoryIds.forEach(id => {
                queryParams.append('activityCategoryIds', id);
            });
        }

        if (params.activityTypeIds && params.activityTypeIds.length > 0) {
            params.activityTypeIds.forEach(id => {
                queryParams.append('activityTypeIds', id);
            });
        }

        if (params.geographicAreaIds && params.geographicAreaIds.length > 0) {
            params.geographicAreaIds.forEach(id => {
                queryParams.append('geographicAreaIds', id);
            });
        }

        if (params.venueIds && params.venueIds.length > 0) {
            params.venueIds.forEach(id => {
                queryParams.append('venueIds', id);
            });
        }

        if (params.populationIds && params.populationIds.length > 0) {
            params.populationIds.forEach(id => {
                queryParams.append('populationIds', id);
            });
        }

        const query = queryParams.toString();
        return ApiClient.get<GrowthMetrics>(`/analytics/growth${query ? `?${query}` : ''}`);
    }

    static async getGeographicAnalytics(
        parentGeographicAreaId?: string,
        startDate?: string,
        endDate?: string,
        activityCategoryIds?: string[],
        activityTypeIds?: string[],
        venueIds?: string[],
        populationIds?: string[]
    ): Promise<GeographicAnalytics[]> {
        const params = new URLSearchParams();
        if (parentGeographicAreaId) params.append('parentGeographicAreaId', parentGeographicAreaId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        // Handle array parameters
        if (activityCategoryIds && activityCategoryIds.length > 0) {
            activityCategoryIds.forEach(id => {
                params.append('activityCategoryIds', id);
            });
        }

        if (activityTypeIds && activityTypeIds.length > 0) {
            activityTypeIds.forEach(id => {
                params.append('activityTypeIds', id);
            });
        }

        if (venueIds && venueIds.length > 0) {
            venueIds.forEach(id => {
                params.append('venueIds', id);
            });
        }

        if (populationIds && populationIds.length > 0) {
            populationIds.forEach(id => {
                params.append('populationIds', id);
            });
        }

        const query = params.toString();
        return ApiClient.get<GeographicAnalytics[]>(`/analytics/geographic${query ? `?${query}` : ''}`);
    }

    static async getActivityLifecycleEvents(params: ActivityLifecycleParams): Promise<ActivityLifecycleData[]> {
        const queryParams = new URLSearchParams();

        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        queryParams.append('groupBy', params.groupBy);

        // Handle array parameters
        if (params.geographicAreaIds && params.geographicAreaIds.length > 0) {
            params.geographicAreaIds.forEach(id => {
                queryParams.append('geographicAreaIds', id);
            });
        }

        if (params.activityCategoryIds && params.activityCategoryIds.length > 0) {
            params.activityCategoryIds.forEach(id => {
                queryParams.append('activityCategoryIds', id);
            });
        }

        if (params.activityTypeIds && params.activityTypeIds.length > 0) {
            params.activityTypeIds.forEach(id => {
                queryParams.append('activityTypeIds', id);
            });
        }

        if (params.venueIds && params.venueIds.length > 0) {
            params.venueIds.forEach(id => {
                queryParams.append('venueIds', id);
            });
        }

        if (params.populationIds && params.populationIds.length > 0) {
            params.populationIds.forEach(id => {
                queryParams.append('populationIds', id);
            });
        }

        const query = queryParams.toString();
        return ApiClient.get<ActivityLifecycleData[]>(`/analytics/activity-lifecycle?${query}`);
    }
}
