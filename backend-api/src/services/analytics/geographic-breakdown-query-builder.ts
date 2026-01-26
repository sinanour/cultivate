import { PrismaClient } from '@prisma/client';

export interface GeographicBreakdownFilters {
    startDate?: Date;
    endDate?: Date;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
}

export interface PaginationParams {
    page?: number;
    pageSize?: number;
}

export interface QueryResult {
    sql: string;
    parameters: any[];
}

/**
 * Query builder for optimized geographic breakdown queries.
 * Uses CTEs, GROUP BY, and HAVING clauses to perform aggregation at the database level.
 */
export class GeographicBreakdownQueryBuilder {
    constructor(_prisma: PrismaClient) { }

    /**
     * Builds the main geographic breakdown query with optional pagination.
     * 
     * @param areaIds - Array of geographic area IDs to compute metrics for
     * @param areaToDescendantsMap - Map of area ID to array of descendant IDs (including the area itself)
     * @param filters - Optional filters to apply
     * @param pagination - Optional pagination parameters
     * @returns QueryResult with SQL and parameters
     */
    buildGeographicBreakdownQuery(
        areaIds: string[],
        areaToDescendantsMap: Map<string, string[]>,
        filters: GeographicBreakdownFilters = {},
        pagination?: PaginationParams
    ): QueryResult {
        const parameters: any[] = [];
        let paramIndex = 1;

        // Build CTEs
        const areaDescendantsCTE = this.buildAreaDescendantsCTE(areaIds, areaToDescendantsMap);
        const { cte: filteredActivitiesCTE, params: filterParams, nextIndex } = this.buildFilteredActivitiesCTE(
            filters,
            paramIndex
        );
        parameters.push(...filterParams);
        paramIndex = nextIndex;

        const areaMetricsCTE = this.buildAreaMetricsCTE();
        const paginationClause = this.buildPaginationClause(pagination);

        // Combine into final query
        const sql = `
WITH
  ${areaDescendantsCTE},
  ${filteredActivitiesCTE},
  ${areaMetricsCTE}

SELECT * FROM area_metrics
ORDER BY "geographicAreaId"${paginationClause}`;

        return { sql, parameters };
    }

    /**
     * Builds a COUNT query to get the total number of areas (before pagination).
     * 
     * @param areaIds - Array of geographic area IDs
     * @param areaToDescendantsMap - Map of area ID to descendant IDs
     * @param filters - Optional filters to apply
     * @returns QueryResult with SQL and parameters
     */
    buildCountQuery(
        areaIds: string[],
        areaToDescendantsMap: Map<string, string[]>,
        filters: GeographicBreakdownFilters = {}
    ): QueryResult {
        // Build main query without pagination
        const { sql: mainSql, parameters } = this.buildGeographicBreakdownQuery(
            areaIds,
            areaToDescendantsMap,
            filters,
            undefined // no pagination
        );

        // Wrap in COUNT query
        const countSql = `
SELECT COUNT(*) as total FROM (
  ${mainSql}
) AS count_query`;

        return { sql: countSql, parameters };
    }

    /**
     * Builds the area_descendants CTE using VALUES clause.
     * Maps each area ID to an array of descendant IDs (including the area itself).
     */
    private buildAreaDescendantsCTE(
        areaIds: string[],
        areaToDescendantsMap: Map<string, string[]>
    ): string {
        if (areaIds.length === 0) {
            return `area_descendants(area_id, descendant_ids) AS (
    SELECT NULL::text, ARRAY[]::text[] WHERE false
  )`;
        }

        const values = areaIds.map(areaId => {
            const descendants = areaToDescendantsMap.get(areaId) || [areaId];
            const descendantArray = descendants.map(id => `'${id}'`).join(', ');
            return `    ('${areaId}', ARRAY[${descendantArray}]::text[])`;
        });

        return `area_descendants(area_id, descendant_ids) AS (
    VALUES
${values.join(',\n')}
  )`;
    }

    /**
     * Builds the filtered_activities CTE with push-down predicates.
     * Applies all filters at the database level before aggregation.
     */
    private buildFilteredActivitiesCTE(
        filters: GeographicBreakdownFilters,
        startParamIndex: number
    ): { cte: string; params: any[]; nextIndex: number } {
        const params: any[] = [];
        const conditions: string[] = [];
        let paramIndex = startParamIndex;

        let cte = `filtered_activities AS (
    SELECT 
      a.id,
      v."geographicAreaId"
    FROM activities a
    JOIN activity_venue_history avh ON a.id = avh."activityId"
      AND NOT EXISTS (
        SELECT 1 FROM activity_venue_history avh2
        WHERE avh2."activityId" = a.id
        AND (
          (avh2."effectiveFrom" IS NOT NULL AND avh."effectiveFrom" IS NOT NULL AND avh2."effectiveFrom" > avh."effectiveFrom")
          OR (avh2."effectiveFrom" IS NOT NULL AND avh."effectiveFrom" IS NULL)
        )
      )
    JOIN venues v ON avh."venueId" = v.id`;

        // Add activity type filter
        if (filters.activityTypeIds && filters.activityTypeIds.length > 0) {
            conditions.push(`a."activityTypeId" = ANY($${paramIndex})`);
            params.push(filters.activityTypeIds);
            paramIndex++;
        }

        // Add activity category filter
        if (filters.activityCategoryIds && filters.activityCategoryIds.length > 0) {
            cte += `
    JOIN activity_types at ON a."activityTypeId" = at.id`;
            conditions.push(`at."activityCategoryId" = ANY($${paramIndex})`);
            params.push(filters.activityCategoryIds);
            paramIndex++;
        }

        // Add venue filter
        if (filters.venueIds && filters.venueIds.length > 0) {
            conditions.push(`avh."venueId" = ANY($${paramIndex})`);
            params.push(filters.venueIds);
            paramIndex++;
        }

        // Add date range filter
        if (filters.startDate && filters.endDate) {
            conditions.push(`DATE(a."startDate") <= DATE($${paramIndex})`);
            params.push(filters.endDate);
            paramIndex++;

            conditions.push(`(a."endDate" IS NULL OR DATE(a."endDate") >= DATE($${paramIndex}))`);
            params.push(filters.startDate);
            paramIndex++;
        } else if (filters.startDate) {
            conditions.push(`DATE(a."startDate") >= DATE($${paramIndex})`);
            params.push(filters.startDate);
            paramIndex++;
        } else if (filters.endDate) {
            conditions.push(`DATE(a."startDate") <= DATE($${paramIndex})`);
            params.push(filters.endDate);
            paramIndex++;
        }

        // Add population filter
        if (filters.populationIds && filters.populationIds.length > 0) {
            conditions.push(`EXISTS (
        SELECT 1 FROM assignments asn
        JOIN participant_populations pp ON asn."participantId" = pp."participantId"
        WHERE asn."activityId" = a.id
          AND pp."populationId" = ANY($${paramIndex})
      )`);
            params.push(filters.populationIds);
            paramIndex++;
        }

        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            cte += `
    WHERE ${conditions.join('\n      AND ')}`;
        }

        cte += `
  )`;

        return { cte, params, nextIndex: paramIndex };
    }

    /**
     * Builds the area_metrics CTE with GROUP BY and HAVING clause.
     * Aggregates metrics per area and filters out zero-metric areas.
     */
    private buildAreaMetricsCTE(): string {
        return `area_metrics AS (
    SELECT 
      ad.area_id as "geographicAreaId",
      COUNT(DISTINCT fa.id) as "activityCount",
      COUNT(DISTINCT asn."participantId") as "participantCount",
      COUNT(asn.id) as "participationCount"
    FROM area_descendants ad
    LEFT JOIN filtered_activities fa 
      ON fa."geographicAreaId" = ANY(ad.descendant_ids)
    LEFT JOIN assignments asn ON fa.id = asn."activityId"
    GROUP BY ad.area_id
    HAVING 
      COUNT(DISTINCT fa.id) > 0 
      OR COUNT(DISTINCT asn."participantId") > 0 
      OR COUNT(asn.id) > 0
  )`;
    }

    /**
     * Builds the pagination clause (LIMIT/OFFSET).
     * Returns empty string if no pagination parameters provided.
     */
    private buildPaginationClause(pagination?: PaginationParams): string {
        if (!pagination) {
            return '';
        }

        const page = pagination.page || 1;
        const pageSize = pagination.pageSize || 100;
        const offset = (page - 1) * pageSize;

        return `
LIMIT ${pageSize} OFFSET ${offset}`;
    }
}
