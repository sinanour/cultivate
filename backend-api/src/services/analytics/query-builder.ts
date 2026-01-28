import { PrismaClient } from '@prisma/client';

export enum GroupingDimension {
    ACTIVITY_TYPE = 'activityType',
    ACTIVITY_CATEGORY = 'activityCategory',
    GEOGRAPHIC_AREA = 'geographicArea',
    VENUE = 'venue',
}

export interface AnalyticsFilters {
    startDate?: Date;
    endDate?: Date;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    geographicAreaIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
    groupBy?: GroupingDimension[];
}

export interface QueryResult {
    sql: string;
    parameters: Record<string, any>;
}

export interface PaginationParams {
    page?: number;
    pageSize?: number;
}

interface MetricDefinition {
    name: string;
    expression: string;
}

export class QueryBuilder {
    constructor(_prisma: PrismaClient) { }

    /**
     * Get centralized metric definitions for both SELECT and HAVING clauses
     * This ensures consistency and eliminates code duplication
     */
    private getMetricDefinitions(hasDateRange: boolean): MetricDefinition[] {
        if (hasDateRange) {
            // Date range: 8 metrics (start snapshot, end snapshot, lifecycle events)
            return [
                {
                    name: 'activitiesAtStart',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE DATE(fa."startDate") <= DATE(@startDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@startDate)))'
                },
                {
                    name: 'participantsAtStart',
                    expression: 'COUNT(DISTINCT asn."participantId") FILTER (WHERE DATE(fa."startDate") <= DATE(@startDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@startDate)))'
                },
                {
                    name: 'participationAtStart',
                    expression: '(COUNT(asn.id) FILTER (WHERE DATE(fa."startDate") <= DATE(@startDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@startDate))) + COALESCE(SUM(fa."additionalParticipantCount") FILTER (WHERE DATE(fa."startDate") <= DATE(@startDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@startDate))), 0))'
                },
                {
                    name: 'activitiesAtEnd',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE DATE(fa."startDate") <= DATE(@endDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@endDate)))'
                },
                {
                    name: 'participantsAtEnd',
                    expression: 'COUNT(DISTINCT asn."participantId") FILTER (WHERE DATE(fa."startDate") <= DATE(@endDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@endDate)))'
                },
                {
                    name: 'participationAtEnd',
                    expression: '(COUNT(asn.id) FILTER (WHERE DATE(fa."startDate") <= DATE(@endDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@endDate))) + COALESCE(SUM(fa."additionalParticipantCount") FILTER (WHERE DATE(fa."startDate") <= DATE(@endDate) AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= DATE(@endDate))), 0))'
                },
                {
                    name: 'activitiesStarted',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE DATE(fa."startDate") BETWEEN DATE(@startDate) AND DATE(@endDate))'
                },
                {
                    name: 'activitiesCompleted',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE fa."endDate" IS NOT NULL AND DATE(fa."endDate") BETWEEN DATE(@startDate) AND DATE(@endDate))'
                }
            ];
        } else {
            // Current date: 5 metrics (active snapshot + lifecycle events)
            return [
                {
                    name: 'activeActivities',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE DATE(fa."startDate") <= CURRENT_DATE AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= CURRENT_DATE))'
                },
                {
                    name: 'uniqueParticipants',
                    expression: 'COUNT(DISTINCT asn."participantId") FILTER (WHERE DATE(fa."startDate") <= CURRENT_DATE AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= CURRENT_DATE))'
                },
                {
                    name: 'totalParticipation',
                    expression: '(COUNT(asn.id) FILTER (WHERE DATE(fa."startDate") <= CURRENT_DATE AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= CURRENT_DATE)) + COALESCE(SUM(fa."additionalParticipantCount") FILTER (WHERE DATE(fa."startDate") <= CURRENT_DATE AND (fa."endDate" IS NULL OR DATE(fa."endDate") >= CURRENT_DATE)), 0))'
                },
                {
                    name: 'activitiesStarted',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE DATE(fa."startDate") <= CURRENT_DATE)'
                },
                {
                    name: 'activitiesCompleted',
                    expression: 'COUNT(DISTINCT fa.id) FILTER (WHERE fa."endDate" IS NOT NULL AND DATE(fa."endDate") <= CURRENT_DATE)'
                }
            ];
        }
    }

    buildEngagementQuery(
        filters: AnalyticsFilters,
        groupBy: GroupingDimension[],
        pagination?: PaginationParams
    ): QueryResult {
        const parameters: Record<string, any> = {};

        // Add date parameters if provided
        if (filters.startDate) {
            parameters.startDate = filters.startDate.toISOString();
        }
        if (filters.endDate) {
            parameters.endDate = filters.endDate.toISOString();
        }

        // Build CTEs
        const baseActivityCTE = this.buildBaseActivityCTE(filters, groupBy);
        const snapshotMetricsCTE = this.buildSnapshotMetricsCTE(filters, groupBy);
        const paginationClause = this.buildPaginationClause(pagination?.page, pagination?.pageSize);

        // Combine into final query
        let sql = `
WITH
  ${baseActivityCTE},
  ${snapshotMetricsCTE}

SELECT * FROM snapshot_metrics
ORDER BY `;

        // Build ORDER BY clause based on grouping dimensions
        // Use NULLS FIRST to ensure total aggregation row appears first
        const orderClauses: string[] = [];
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            orderClauses.push('"activityTypeId" NULLS FIRST');
        }
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            orderClauses.push('"activityCategoryId" NULLS FIRST');
        }
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            orderClauses.push('"geographicAreaId" NULLS FIRST');
        }
        if (groupBy.includes(GroupingDimension.VENUE)) {
            orderClauses.push('"venueId" NULLS FIRST');
        }

        sql += orderClauses.length > 0 ? orderClauses.join(', ') : '1';
        sql += paginationClause;

        return {
            sql,
            parameters,
        };
    }

    /**
     * Build COUNT query to get total number of records (before pagination)
     */
    buildCountQuery(
        filters: AnalyticsFilters,
        groupBy: GroupingDimension[]
    ): QueryResult {
        // Build main query without pagination
        const { sql: mainSql, parameters } = this.buildEngagementQuery(
            filters,
            groupBy,
            undefined // no pagination
        );

        // Wrap in COUNT query
        const countSql = `
SELECT COUNT(*) as total FROM (
  ${mainSql}
) AS count_query`;

        return {
            sql: countSql,
            parameters,
        };
    }

    /**
     * Build HAVING clause to filter out rows with all-zero metrics
     * Preserves the total aggregation row even if it has zero metrics
     * Returns empty string if no grouping (no GROUP BY, so no HAVING needed)
     * 
     * Note: PostgreSQL doesn't allow column aliases in HAVING clause,
     * so we must repeat the aggregate expressions
     */
    private buildHavingClause(hasDateRange: boolean, groupBy: GroupingDimension[]): string {
        // If no grouping, there's no GROUP BY, so no HAVING clause needed
        if (groupBy.length === 0) {
            return '';
        }

        // Get metric definitions (centralized)
        const metrics = this.getMetricDefinitions(hasDateRange);

        // Build conditions: metric1 > 0 OR metric2 > 0 OR ...
        const metricConditions = metrics.map(metric => `${metric.expression} > 0`);

        // Build condition to preserve total aggregation row
        const dimensionNullChecks: string[] = [];
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            dimensionNullChecks.push('fa."activityTypeId" IS NULL');
        }
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            dimensionNullChecks.push('fa."activityCategoryId" IS NULL');
        }
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            dimensionNullChecks.push('fa."geographicAreaId" IS NULL');
        }
        if (groupBy.includes(GroupingDimension.VENUE)) {
            dimensionNullChecks.push('fa."venueId" IS NULL');
        }

        // If no grouping, no need to preserve total row (it's the only row)
        const preserveTotalRow = dimensionNullChecks.length > 0
            ? `(${dimensionNullChecks.join(' AND ')})`
            : null;

        // Combine: (metric1 > 0 OR metric2 > 0 OR ... OR isTotalRow)
        const allConditions = preserveTotalRow
            ? [...metricConditions, preserveTotalRow]
            : metricConditions;

        return `
        HAVING ${allConditions.join('\n          OR ')}`;
    }

    /**
     * Build pagination clause with LIMIT and OFFSET
     */
    private buildPaginationClause(page?: number, pageSize?: number): string {
        // If no pagination params, return empty string (no pagination)
        if (!page && !pageSize) {
            return '';
        }

        // Default values
        const effectivePage = page || 1;
        const effectivePageSize = pageSize || 100;

        // Calculate offset (1-based page number)
        const offset = (effectivePage - 1) * effectivePageSize;

        return `
LIMIT ${effectivePageSize} OFFSET ${offset}`;
    }

    private buildSnapshotMetricsCTE(filters: AnalyticsFilters, groupBy: GroupingDimension[]): string {
        const hasDateRange = !!(filters.startDate && filters.endDate);

        let cte = `
      snapshot_metrics AS (
        SELECT `;

        // Add grouping dimension columns
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            cte += `
          fa."activityTypeId",`;
        }
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            cte += `
          fa."activityCategoryId",`;
        }
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            cte += `
          fa."geographicAreaId",`;
        }
        if (groupBy.includes(GroupingDimension.VENUE)) {
            cte += `
          fa."venueId",`;
        }

        // Get metric definitions (centralized)
        const metrics = this.getMetricDefinitions(hasDateRange);

        // Add metric columns
        cte += metrics.map(metric => `
          ${metric.expression} as "${metric.name}"`).join(',');

        cte += `
        FROM filtered_activities fa
        LEFT JOIN assignments asn ON fa.id = asn."activityId"`;

        // Add population filter join if needed
        if (filters.populationIds && filters.populationIds.length > 0) {
            const populationIds = filters.populationIds.map((id) => `'${id}'`).join(', ');
            cte += `
        LEFT JOIN participant_populations pp ON asn."participantId" = pp."participantId"
        WHERE pp."populationId" IN (${populationIds})`;
        }

        // Add GROUP BY clause
        cte += this.buildGroupingSets(groupBy);

        // Add HAVING clause inside the CTE (after GROUP BY)
        cte += this.buildHavingClause(hasDateRange, groupBy);

        cte += `
      )`;

        return cte;
    }

    private buildBaseActivityCTE(filters: AnalyticsFilters, groupBy: GroupingDimension[]): string {
        const requiredJoins = this.determineRequiredJoins(filters, groupBy);
        const filterConditions = this.buildFilterConditions(filters);

        let cte = `
      filtered_activities AS (
        SELECT 
          a.id,
          a."startDate",
          a."endDate",
          a."activityTypeId",
          at."activityCategoryId",
          a."additionalParticipantCount"`;

        // Add venue ID if needed
        if (requiredJoins.includes('venue') || requiredJoins.includes('geographicArea') || groupBy.includes(GroupingDimension.VENUE)) {
            cte += `,
          v.id as "venueId"`;
        }

        // Add geographic area if needed
        if (requiredJoins.includes('geographicArea') || groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            cte += `,
          v."geographicAreaId"`;
        }

        cte += `
        FROM activities a
        INNER JOIN activity_types at ON a."activityTypeId" = at.id`;

        // Add venue joins if needed
        if (requiredJoins.includes('venue') || requiredJoins.includes('geographicArea') || groupBy.includes(GroupingDimension.VENUE)) {
            cte += `
        LEFT JOIN activity_venue_history avh ON a.id = avh."activityId"
          AND NOT EXISTS (
            SELECT 1 FROM activity_venue_history avh2
            WHERE avh2."activityId" = a.id
            AND (
              (avh2."effectiveFrom" IS NOT NULL AND avh."effectiveFrom" IS NOT NULL AND avh2."effectiveFrom" > avh."effectiveFrom")
              OR (avh2."effectiveFrom" IS NOT NULL AND avh."effectiveFrom" IS NULL)
            )
          )
        LEFT JOIN venues v ON avh."venueId" = v.id`;
        }

        // Add filter conditions
        if (filterConditions) {
            cte += `
        WHERE ${filterConditions}`;
        }

        cte += `
      )`;

        return cte;
    }

    private buildGroupingSets(groupBy: GroupingDimension[]): string {
        if (groupBy.length === 0) {
            // No grouping - return total aggregation only
            return '';
        }

        // Build dimension list for GROUPING SETS
        const dimensions: string[] = [];
        if (groupBy.includes(GroupingDimension.ACTIVITY_TYPE)) {
            dimensions.push('"activityTypeId"');
        }
        if (groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY)) {
            dimensions.push('"activityCategoryId"');
        }
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            dimensions.push('"geographicAreaId"');
        }
        if (groupBy.includes(GroupingDimension.VENUE)) {
            dimensions.push('"venueId"');
        }

        // Generate GROUPING SETS with only full-grain grouping and total aggregation
        // No intermediate subset groupings
        const groupingSets: string[] = [];

        // Full detail (all requested dimensions)
        if (dimensions.length > 0) {
            groupingSets.push(`(${dimensions.join(', ')})`);
        }

        // Total aggregation (empty grouping - all dimensions NULL)
        groupingSets.push(`()`);

        return `
        GROUP BY GROUPING SETS (
          ${groupingSets.join(',\n          ')}
        )`;
    }

    private buildFilterConditions(filters: AnalyticsFilters): string {
        const conditions: string[] = [];

        // Activity type filter
        if (filters.activityTypeIds && filters.activityTypeIds.length > 0) {
            const typeIds = filters.activityTypeIds.map((id) => `'${id}'`).join(', ');
            conditions.push(`a."activityTypeId" IN (${typeIds})`);
        }

        // Activity category filter
        if (filters.activityCategoryIds && filters.activityCategoryIds.length > 0) {
            const categoryIds = filters.activityCategoryIds.map((id) => `'${id}'`).join(', ');
            conditions.push(`at."activityCategoryId" IN (${categoryIds})`);
        }

        // Venue filter
        if (filters.venueIds && filters.venueIds.length > 0) {
            const venueIds = filters.venueIds.map((id) => `'${id}'`).join(', ');
            conditions.push(`v.id IN (${venueIds})`);
        }

        // Geographic area filter
        if (filters.geographicAreaIds && filters.geographicAreaIds.length > 0) {
            const areaIds = filters.geographicAreaIds.map((id) => `'${id}'`).join(', ');
            conditions.push(`v."geographicAreaId" IN (${areaIds})`);
        }

        return conditions.length > 0 ? conditions.join(' AND ') : '';
    }

    private determineRequiredJoins(
        filters: AnalyticsFilters,
        groupBy: GroupingDimension[]
    ): string[] {
        const joins: Set<string> = new Set();

        // Check if venue join is needed
        if (filters.venueIds && filters.venueIds.length > 0) {
            joins.add('venue');
        }

        // Check if geographic area join is needed
        if (filters.geographicAreaIds && filters.geographicAreaIds.length > 0) {
            joins.add('geographicArea');
            joins.add('venue'); // Need venue to get to geographic area
        }

        // Check if grouping requires joins
        if (groupBy.includes(GroupingDimension.GEOGRAPHIC_AREA)) {
            joins.add('geographicArea');
            joins.add('venue');
        }

        if (groupBy.includes(GroupingDimension.VENUE)) {
            joins.add('venue');
        }

        // Population filter requires assignment join (handled separately)
        if (filters.populationIds && filters.populationIds.length > 0) {
            joins.add('population');
        }

        return Array.from(joins);
    }
}
