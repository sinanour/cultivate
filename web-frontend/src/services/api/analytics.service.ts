import type { EngagementMetrics, GrowthMetrics } from '../../types';
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
        period: 'day' | 'week' | 'month' | 'year',
        geographicAreaId?: string
    ): Promise<GrowthMetrics> {
        const params = new URLSearchParams();
        params.append('period', period);
        if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);

        return ApiClient.get<GrowthMetrics>(`/analytics/growth?${params.toString()}`);
    }

    static async getGeographicBreakdown(): Promise<{ area: string; count: number }[]> {
        return ApiClient.get<{ area: string; count: number }[]>('/analytics/geographic-breakdown');
    }
}
