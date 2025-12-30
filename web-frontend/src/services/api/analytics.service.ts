import type { EngagementMetrics, GrowthMetrics, GeographicAnalytics } from '../../types';
import { ApiClient } from './api.client';
import type { TimePeriod, DateGranularity, GroupingDimension } from '../../utils/constants';

export interface EngagementMetricsParams {
    startDate?: string;
    endDate?: string;
    geographicAreaId?: string;
    activityCategoryId?: string;
    activityTypeId?: string;
    venueId?: string;
    groupBy?: GroupingDimension[];
    dateGranularity?: DateGranularity;
}

export interface GrowthMetricsParams {
    startDate?: string;
    endDate?: string;
    period?: TimePeriod;
    geographicAreaId?: string;
}

export class AnalyticsService {
    static async getEngagementMetrics(params: EngagementMetricsParams = {}): Promise<EngagementMetrics> {
        const queryParams = new URLSearchParams();

        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.geographicAreaId) queryParams.append('geographicAreaId', params.geographicAreaId);
        if (params.activityCategoryId) queryParams.append('activityCategoryId', params.activityCategoryId);
        if (params.activityTypeId) queryParams.append('activityTypeId', params.activityTypeId);
        if (params.venueId) queryParams.append('venueId', params.venueId);
        if (params.dateGranularity) queryParams.append('dateGranularity', params.dateGranularity);

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
        if (params.geographicAreaId) queryParams.append('geographicAreaId', params.geographicAreaId);

        const query = queryParams.toString();
        return ApiClient.get<GrowthMetrics>(`/analytics/growth${query ? `?${query}` : ''}`);
    }

    static async getGeographicAnalytics(
        startDate?: string,
        endDate?: string
    ): Promise<GeographicAnalytics[]> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const query = params.toString();
        return ApiClient.get<GeographicAnalytics[]>(`/analytics/geographic${query ? `?${query}` : ''}`);
    }
}
