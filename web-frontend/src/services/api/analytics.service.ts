import type { EngagementMetrics, GrowthMetrics, GeographicAnalytics } from '../../types';
import { ApiClient } from './api.client';

export class AnalyticsService {
    static async getEngagementMetrics(
        startDate?: string,
        endDate?: string,
        geographicAreaId?: string
    ): Promise<EngagementMetrics> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);

        const query = params.toString();
        return ApiClient.get<EngagementMetrics>(`/analytics/engagement${query ? `?${query}` : ''}`);
    }

    static async getGrowthMetrics(
        startDate?: string,
        endDate?: string,
        period?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR',
        geographicAreaId?: string
    ): Promise<GrowthMetrics> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (period) params.append('period', period);
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);

        const query = params.toString();
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

