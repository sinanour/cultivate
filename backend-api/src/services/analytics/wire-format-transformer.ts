import { RawQueryResult, DimensionLookups } from './query-executor';
import { GroupingDimension } from './query-builder';

export interface PaginationMetadata {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface EngagementWireFormat {
    data: Array<Array<number>>;
    lookups: {
        activityTypes?: Array<{ id: string; name: string }>;
        activityCategories?: Array<{ id: string; name: string }>;
        geographicAreas?: Array<{ id: string; name: string }>;
        venues?: Array<{ id: string; name: string }>;
    };
    metadata: {
        columns: string[];
        groupingDimensions: string[];
        hasDateRange: boolean;
        pagination: PaginationMetadata;
    };
}

export class WireFormatTransformer {
    constructor() { }

    transformToWireFormat(
        queryResults: RawQueryResult[],
        lookups: DimensionLookups,
        groupBy: GroupingDimension[],
        hasDateRange: boolean,
        totalCount: number,
        page?: number,
        pageSize?: number
    ): EngagementWireFormat {
        // Build lookup arrays
        const lookupArrays = this.buildLookupArrays(queryResults, lookups, groupBy);

        // Convert IDs to indexes and format data rows
        const dataRows = this.formatDataRows(queryResults, lookupArrays, groupBy, hasDateRange);

        // Build metadata
        const metadata = this.buildMetadata(groupBy, hasDateRange, totalCount, page, pageSize);

        return {
            data: dataRows,
            lookups: {
                activityTypes: lookupArrays.activityTypes,
                activityCategories: lookupArrays.activityCategories,
                geographicAreas: lookupArrays.geographicAreas,
                venues: lookupArrays.venues,
            },
            metadata,
        };
    }

    private buildLookupArrays(
        queryResults: RawQueryResult[],
        lookups: DimensionLookups,
        groupBy: GroupingDimension[]
    ): {
        activityTypes?: Array<{ id: string; name: string }>;
        activityCategories?: Array<{ id: string; name: string }>;
        geographicAreas?: Array<{ id: string; name: string }>;
            venues?: Array<{ id: string; name: string }>;
    } {
        const result: any = {};

        // Build activity type lookup array
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            const typeIds = new Set<string>();
            for (const row of queryResults) {
                if (row.activityTypeId) {
                    typeIds.add(row.activityTypeId);
                }
            }

            result.activityTypes = Array.from(typeIds).map((id) => ({
                id,
                name: lookups.activityTypes.get(id) || 'Unknown Type',
            }));
        }

        // Build activity category lookup array
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            const categoryIds = new Set<string>();
            for (const row of queryResults) {
                if (row.activityCategoryId) {
                    categoryIds.add(row.activityCategoryId);
                }
            }

            result.activityCategories = Array.from(categoryIds).map((id) => ({
                id,
                name: lookups.activityCategories.get(id) || 'Unknown Category',
            }));
        }

        // Build geographic area lookup array
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            const areaIds = new Set<string>();
            for (const row of queryResults) {
                if (row.geographicAreaId) {
                    areaIds.add(row.geographicAreaId);
                }
            }

            result.geographicAreas = Array.from(areaIds).map((id) => ({
                id,
                name: lookups.geographicAreas.get(id) || 'Unknown Area',
            }));
        }

        // Build venue lookup array
        if (groupBy.includes(GroupingDimension.VENUE)) {
            const venueIds = new Set<string>();
            for (const row of queryResults) {
                if (row.venueId) {
                    venueIds.add(row.venueId);
                }
            }

            result.venues = Array.from(venueIds).map((id) => ({
                id,
                name: lookups.venues.get(id) || 'Unknown Venue',
            }));
        }

        return result;
    }

    private convertIdsToIndexes(
        row: RawQueryResult,
        lookupArrays: {
            activityTypes?: Array<{ id: string; name: string }>;
            activityCategories?: Array<{ id: string; name: string }>;
            geographicAreas?: Array<{ id: string; name: string }>;
            venues?: Array<{ id: string; name: string }>;
        },
        groupBy: GroupingDimension[]
    ): number[] {
        const indexes: number[] = [];

        // Convert activity type ID to index
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            if (row.activityTypeId) {
                const index = lookupArrays.activityTypes?.findIndex((t) => t.id === row.activityTypeId);
                indexes.push(index !== undefined && index >= 0 ? index : -1);
            } else {
                indexes.push(-1); // Aggregated row
            }
        }

        // Convert activity category ID to index
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            if (row.activityCategoryId) {
                const index = lookupArrays.activityCategories?.findIndex((c) => c.id === row.activityCategoryId);
                indexes.push(index !== undefined && index >= 0 ? index : -1);
            } else {
                indexes.push(-1); // Aggregated row
            }
        }

        // Convert geographic area ID to index
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            if (row.geographicAreaId) {
                const index = lookupArrays.geographicAreas?.findIndex((a) => a.id === row.geographicAreaId);
                indexes.push(index !== undefined && index >= 0 ? index : -1);
            } else {
                indexes.push(-1); // Aggregated row
            }
        }

        // Convert venue ID to index
        if (groupBy.includes(GroupingDimension.VENUE)) {
            if (row.venueId) {
                const index = lookupArrays.venues?.findIndex((v) => v.id === row.venueId);
                indexes.push(index !== undefined && index >= 0 ? index : -1);
            } else {
                indexes.push(-1); // Aggregated row
            }
        }

        return indexes;
    }

    private buildMetadata(
        groupBy: GroupingDimension[],
        hasDateRange: boolean,
        totalCount: number,
        page?: number,
        pageSize?: number
    ): {
        columns: string[];
        groupingDimensions: string[];
        hasDateRange: boolean;
            pagination: PaginationMetadata;
    } {
        const columns: string[] = [];

        // Add dimension index columns
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            columns.push('activityTypeIndex');
        }
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            columns.push('activityCategoryIndex');
        }
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            columns.push('geographicAreaIndex');
        }
        if (groupBy.includes(GroupingDimension.VENUE)) {
            columns.push('venueIndex');
        }

        // Add metric columns
        if (hasDateRange) {
            columns.push(
                'activitiesAtStart',
                'participantsAtStart',
                'participationAtStart',
                'activitiesAtEnd',
                'participantsAtEnd',
                'participationAtEnd',
                'activitiesStarted',
                'activitiesCompleted'
            );
        } else {
            // Current date: 5 metrics (active snapshot + lifecycle events)
            columns.push(
                'activeActivities',
                'uniqueParticipants',
                'totalParticipation',
                'activitiesStarted',
                'activitiesCompleted'
            );
        }

        // Build pagination metadata
        const paginationMetadata = this.buildPaginationMetadata(page, pageSize, totalCount);

        return {
            columns,
            groupingDimensions: groupBy,
            hasDateRange,
            pagination: paginationMetadata,
        };
    }

    /**
     * Build pagination metadata from pagination parameters and total count
     */
    private buildPaginationMetadata(
        page: number | undefined,
        pageSize: number | undefined,
        totalCount: number
    ): PaginationMetadata {
        // If no pagination params, return metadata indicating all results
        if (!page && !pageSize) {
            return {
                page: 1,
                pageSize: totalCount,
                totalRecords: totalCount,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            };
        }

        const effectivePage = page || 1;
        const effectivePageSize = pageSize || 100;
        const totalPages = Math.ceil(totalCount / effectivePageSize);

        return {
            page: effectivePage,
            pageSize: effectivePageSize,
            totalRecords: totalCount,
            totalPages,
            hasNextPage: effectivePage < totalPages,
            hasPreviousPage: effectivePage > 1,
        };
    }

    private formatDataRows(
        queryResults: RawQueryResult[],
        lookupArrays: {
            activityTypes?: Array<{ id: string; name: string }>;
            activityCategories?: Array<{ id: string; name: string }>;
            geographicAreas?: Array<{ id: string; name: string }>;
            venues?: Array<{ id: string; name: string }>;
        },
        groupBy: GroupingDimension[],
        hasDateRange: boolean
    ): Array<Array<number>> {
        const dataRows: Array<Array<number>> = [];

        for (const row of queryResults) {
            const dataRow: number[] = [];

            // Add dimension indexes
            const indexes = this.convertIdsToIndexes(row, lookupArrays, groupBy);
            dataRow.push(...indexes);

            // Add metric values
            if (hasDateRange) {
                dataRow.push(
                    row.activitiesAtStart || 0,
                    row.participantsAtStart || 0,
                    row.participationAtStart || 0,
                    row.activitiesAtEnd || 0,
                    row.participantsAtEnd || 0,
                    row.participationAtEnd || 0,
                    row.activitiesStarted || 0,
                    row.activitiesCompleted || 0
                );
            } else {
                // Current date: 5 metrics (active snapshot + lifecycle events)
                dataRow.push(
                    row.activeActivities || 0,
                    row.uniqueParticipants || 0,
                    row.totalParticipation || 0,
                    row.activitiesStarted || 0,
                    row.activitiesCompleted || 0
                );
            }

            dataRows.push(dataRow);
        }

        return dataRows;
    }
}
