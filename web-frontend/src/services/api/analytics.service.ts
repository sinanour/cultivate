import type { EngagementMetrics, GrowthMetrics, GeographicAnalytics, PaginationMetadata } from '../../types';
import { ApiClient } from './api.client';
import type { TimePeriod, DateGranularity, GroupingDimension } from '../../utils/constants';
import type { EngagementWireFormat } from '../../utils/wireFormatParser';

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
    page?: number;
    pageSize?: number;
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

export interface RoleDistributionWireFormat {
    data: Array<[number, number]>;  // [roleIndex, count]
    lookups: {
        roles: Array<{ id: string; name: string }>;
    };
    metadata: {
        columns: string[];
    };
}

export interface RoleDistributionParams {
    startDate?: string;
    endDate?: string;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    geographicAreaIds?: string[];
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

    static async getEngagementMetricsOptimized(params: EngagementMetricsParams = {}): Promise<EngagementWireFormat> {
        const queryParams = new URLSearchParams();

        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.page) queryParams.append('page', String(params.page));
        if (params.pageSize) queryParams.append('limit', String(params.pageSize));

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

        // Handle groupBy array parameter - convert to string values
        if (params.groupBy && params.groupBy.length > 0) {
            params.groupBy.forEach(dimension => {
                // Convert GroupingDimension enum to string values expected by backend
                let dimValue: string = dimension;
                if (dimension === 'activityType') dimValue = 'type';
                else if (dimension === 'activityCategory') dimValue = 'category';
                else if (dimension === 'geographicArea') dimValue = 'geographicArea';
                queryParams.append('groupBy', dimValue);
            });
        }

        const query = queryParams.toString();
        return ApiClient.post<EngagementWireFormat>(`/analytics/engagement-optimized${query ? `?${query}` : ''}`, {});
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
        populationIds?: string[],
        page?: number,
        pageSize?: number
    ): Promise<{ data: GeographicAnalytics[]; pagination: PaginationMetadata }> {
        const params = new URLSearchParams();
        if (parentGeographicAreaId) params.append('parentGeographicAreaId', parentGeographicAreaId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (page !== undefined) params.append('page', page.toString());
        if (pageSize !== undefined) params.append('limit', pageSize.toString());

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
        return ApiClient.get<{ data: GeographicAnalytics[]; pagination: PaginationMetadata }>(`/analytics/geographic${query ? `?${query}` : ''}`);
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

    static async getRoleDistribution(params: RoleDistributionParams = {}): Promise<RoleDistributionWireFormat> {
        const queryParams = new URLSearchParams();

        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);

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
        return ApiClient.post<RoleDistributionWireFormat>(`/analytics/role-distribution${query ? `?${query}` : ''}`, {});
    }
}
