import { PrismaClient } from '@prisma/client';
import { QueryBuilder, AnalyticsFilters, GroupingDimension } from './query-builder';
import { QueryExecutor } from './query-executor';
import { WireFormatTransformer, EngagementWireFormat } from './wire-format-transformer';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';

export class OptimizedAnalyticsService {
    private queryBuilder: QueryBuilder;
    private queryExecutor: QueryExecutor;
    private wireFormatTransformer: WireFormatTransformer;
    private geographicAreaRepository: GeographicAreaRepository;

    constructor(prisma: PrismaClient) {
        this.queryBuilder = new QueryBuilder(prisma);
        this.queryExecutor = new QueryExecutor(prisma);
        this.wireFormatTransformer = new WireFormatTransformer();
        this.geographicAreaRepository = new GeographicAreaRepository(prisma);
    }

    async getEngagementMetrics(
        filters: AnalyticsFilters,
        authorizedAreaIds: string[],
        hasGeographicRestrictions: boolean,
        pagination?: { page?: number; pageSize?: number }
    ): Promise<EngagementWireFormat> {
        try {
            // Validate pagination parameters
            if (pagination?.page !== undefined && pagination.page < 1) {
                const error: any = new Error('Invalid pagination: page must be a positive integer');
                error.code = 'VALIDATION_ERROR';
                error.statusCode = 400;
                throw error;
            }
            if (pagination?.pageSize !== undefined && (pagination.pageSize < 1 || pagination.pageSize > 1000)) {
                const error: any = new Error('Invalid pagination: pageSize must be between 1 and 1000');
                error.code = 'VALIDATION_ERROR';
                error.statusCode = 400;
                throw error;
            }

            // Validate filters
            if (filters.startDate && filters.endDate) {
                if (filters.startDate > filters.endDate) {
                    const error: any = new Error('Invalid date range: startDate must be before endDate');
                    error.code = 'VALIDATION_ERROR';
                    error.statusCode = 400;
                    throw error;
                }
            }

            // Validate filter arrays are not empty
            if (filters.activityTypeIds && filters.activityTypeIds.length === 0) {
                const error: any = new Error('activityTypeIds filter cannot be empty array');
                error.code = 'VALIDATION_ERROR';
                error.statusCode = 400;
                throw error;
            }
            if (filters.activityCategoryIds && filters.activityCategoryIds.length === 0) {
                const error: any = new Error('activityCategoryIds filter cannot be empty array');
                error.code = 'VALIDATION_ERROR';
                error.statusCode = 400;
                throw error;
            }

            // Apply geographic authorization filtering
            const effectiveFilters = { ...filters };
            if (hasGeographicRestrictions) {
                if (effectiveFilters.geographicAreaIds && effectiveFilters.geographicAreaIds.length > 0) {
                    // Filter to only authorized areas
                    effectiveFilters.geographicAreaIds = effectiveFilters.geographicAreaIds.filter((id) =>
                        authorizedAreaIds.includes(id)
                    );

                    // If no authorized areas remain, throw authorization error
                    if (effectiveFilters.geographicAreaIds.length === 0) {
                        const error: any = new Error('Access denied to requested geographic areas');
                        error.code = 'GEOGRAPHIC_AUTHORIZATION_DENIED';
                        error.statusCode = 403;
                        throw error;
                    }

                    // Expand to include descendants (same logic as original analytics service)
                    const descendantIds = await this.geographicAreaRepository.findBatchDescendants(
                        effectiveFilters.geographicAreaIds
                    );
                    const allExpandedIds = new Set<string>([
                        ...effectiveFilters.geographicAreaIds,
                        ...descendantIds,
                    ]);

                    // Filter descendants to only authorized areas
                    effectiveFilters.geographicAreaIds = Array.from(allExpandedIds).filter((id) =>
                        authorizedAreaIds.includes(id)
                    );
                } else {
                    // No explicit filter - apply implicit filtering
                    effectiveFilters.geographicAreaIds = authorizedAreaIds;
                }
            } else {
                // No geographic restrictions
                if (effectiveFilters.geographicAreaIds && effectiveFilters.geographicAreaIds.length > 0) {
                    // Expand to include descendants
                    const descendantIds = await this.geographicAreaRepository.findBatchDescendants(
                        effectiveFilters.geographicAreaIds
                    );
                    effectiveFilters.geographicAreaIds = [
                        ...effectiveFilters.geographicAreaIds,
                        ...descendantIds,
                    ];
                }
            }

            // Build query
            const groupBy = filters.groupBy || [];
            const { sql, parameters } = this.queryBuilder.buildEngagementQuery(
                effectiveFilters,
                groupBy,
                pagination
            );

            // Build COUNT query
            const { sql: countSql } = this.queryBuilder.buildCountQuery(
                effectiveFilters,
                groupBy
            );

            // Execute both queries in parallel (use same parameters for both)
            const { results: queryResults, totalCount } = await this.queryExecutor.executeEngagementQueryWithCount(
                sql,
                countSql,
                parameters
            );

            // Extract dimension IDs from results
            const dimensionIds = this.extractDimensionIds(queryResults, groupBy);

            // Fetch dimension lookups
            const lookups = await this.queryExecutor.fetchDimensionLookups(dimensionIds);

            // Transform to wire format
            const hasDateRange = !!filters.startDate && !!filters.endDate;
            const wireFormat = this.wireFormatTransformer.transformToWireFormat(
                queryResults,
                lookups,
                groupBy,
                hasDateRange,
                totalCount,
                pagination?.page,
                pagination?.pageSize
            );

            return wireFormat;
        } catch (error) {
            console.error('Error in getEngagementMetrics:', error);

            // Re-throw with appropriate error type if not already formatted
            if (error instanceof Error && !(error as any).statusCode) {
                if (error.message.includes('Query timeout')) {
                    const timeoutError: any = new Error('Query execution timeout');
                    timeoutError.code = 'QUERY_TIMEOUT';
                    timeoutError.statusCode = 504;
                    throw timeoutError;
                }

                if (error.message.includes('Database query failed')) {
                    const dbError: any = new Error('Database error occurred');
                    dbError.code = 'DATABASE_ERROR';
                    dbError.statusCode = 500;
                    throw dbError;
                }

                // Unknown error
                const unknownError: any = new Error('Internal server error');
                unknownError.code = 'INTERNAL_ERROR';
                unknownError.statusCode = 500;
                throw unknownError;
            }

            // Re-throw if already formatted
            throw error;
        }
    }

    private extractDimensionIds(
        queryResults: any[],
        groupBy: GroupingDimension[]
    ): {
        activityTypeIds?: string[];
        activityCategoryIds?: string[];
        geographicAreaIds?: string[];
            venueIds?: string[];
    } {
        const dimensionIds: any = {};

        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            const typeIds = new Set<string>();
            for (const row of queryResults) {
                if (row.activityTypeId) {
                    typeIds.add(row.activityTypeId);
                }
            }
            dimensionIds.activityTypeIds = Array.from(typeIds);
        }

        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            const categoryIds = new Set<string>();
            for (const row of queryResults) {
                if (row.activityCategoryId) {
                    categoryIds.add(row.activityCategoryId);
                }
            }
            dimensionIds.activityCategoryIds = Array.from(categoryIds);
        }

        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            const areaIds = new Set<string>();
            for (const row of queryResults) {
                if (row.geographicAreaId) {
                    areaIds.add(row.geographicAreaId);
                }
            }
            dimensionIds.geographicAreaIds = Array.from(areaIds);
        }

        if (groupBy.includes(GroupingDimension.VENUE)) {
            const venueIds = new Set<string>();
            for (const row of queryResults) {
                if (row.venueId) {
                    venueIds.add(row.venueId);
                }
            }
            dimensionIds.venueIds = Array.from(venueIds);
        }

        return dimensionIds;
    }
}
