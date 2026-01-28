export interface RoleDistributionFilters {
    startDate?: Date;
    endDate?: Date;
    activityTypeIds?: string[];
    activityCategoryIds?: string[];
    geographicAreaIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
}

export interface QueryResult {
    sql: string;
    parameters: any[];  // Positional parameters array
}

export interface RawRoleDistributionResult {
    roleId: string;
    assignmentCount: bigint;
}

/**
 * Builds optimized SQL queries for role distribution analytics using CTEs
 */
export class RoleDistributionQueryBuilder {
    constructor() { }

    /**
     * Builds the main role distribution query with CTEs
     */
    buildRoleDistributionQuery(filters: RoleDistributionFilters): QueryResult {
        const parameters: any[] = [];
        let paramIndex = 1;

        // Build filtered_activities CTE
        const filteredActivitiesCTE = this.buildFilteredActivitiesCTE(filters, parameters, paramIndex);
        paramIndex = parameters.length + 1;

        // Build role_counts CTE
        const roleCountsCTE = this.buildRoleCountsCTE(filters, parameters, paramIndex);

        // Build final SELECT
        const sql = `
WITH
  ${filteredActivitiesCTE},
  ${roleCountsCTE}

SELECT 
  rc."roleId",
  rc.assignment_count as "assignmentCount"
FROM role_counts rc
ORDER BY rc.assignment_count DESC`;

        return { sql, parameters };
    }

    /**
     * Builds the filtered_activities CTE with all filter conditions
     */
    private buildFilteredActivitiesCTE(
        filters: RoleDistributionFilters,
        parameters: any[],
        startIndex: number
    ): string {
        const { startDate, endDate, activityTypeIds, activityCategoryIds, geographicAreaIds, venueIds } = filters;

        // Determine which joins are needed
        const needsVenueJoin = (geographicAreaIds && geographicAreaIds.length > 0) || (venueIds && venueIds.length > 0);
        const needsCategoryJoin = activityCategoryIds && activityCategoryIds.length > 0;

        let cte = `filtered_activities AS (
    SELECT DISTINCT a.id, a."startDate", a."endDate", a."additionalParticipantCount"
    FROM activities a`;

        // Add category join if needed
        if (needsCategoryJoin) {
            cte += `
    JOIN activity_types at ON a."activityTypeId" = at.id`;
        }

        // Add venue-related joins if needed
        if (needsVenueJoin) {
            cte += `
    LEFT JOIN activity_venue_history avh ON a.id = avh."activityId"
    LEFT JOIN venues v ON avh."venueId" = v.id`;
        }

        // Build WHERE conditions
        const conditions: string[] = [];
        let currentIndex = startIndex;

        // Activity type filter
        if (activityTypeIds && activityTypeIds.length > 0) {
            parameters.push(activityTypeIds);
            conditions.push(`a."activityTypeId" = ANY($${currentIndex})`);
            currentIndex++;
        }

        // Activity category filter
        if (activityCategoryIds && activityCategoryIds.length > 0) {
            parameters.push(activityCategoryIds);
            conditions.push(`at."activityCategoryId" = ANY($${currentIndex})`);
            currentIndex++;
        }

        // Venue filter
        if (venueIds && venueIds.length > 0) {
            parameters.push(venueIds);
            conditions.push(`avh."venueId" = ANY($${currentIndex})`);
            currentIndex++;
        }

        // Geographic area filter
        if (geographicAreaIds && geographicAreaIds.length > 0) {
            parameters.push(geographicAreaIds);
            conditions.push(`v."geographicAreaId" = ANY($${currentIndex})`);
            currentIndex++;
        }

        // Date filtering
        if (startDate && endDate) {
            parameters.push(startDate);
            const startDateIndex = currentIndex++;
            parameters.push(endDate);
            const endDateIndex = currentIndex++;
            conditions.push(`(
      DATE(a."startDate") <= DATE($${endDateIndex})
      AND (a."endDate" IS NULL OR DATE(a."endDate") >= DATE($${startDateIndex}))
    )`);
        } else {
            conditions.push(`(
      DATE(a."startDate") <= CURRENT_DATE
      AND (a."endDate" IS NULL OR DATE(a."endDate") >= CURRENT_DATE)
    )`);
        }

        if (conditions.length > 0) {
            cte += `
    WHERE ${conditions.join('\n      AND ')}`;
        }

        cte += `
  )`;

        return cte;
    }

    /**
     * Builds the role_counts CTE with population filtering and additional participant count
     */
    private buildRoleCountsCTE(
        filters: RoleDistributionFilters,
        parameters: any[],
        startIndex: number
    ): string {
        const { populationIds } = filters;

        let cte = `role_counts_individual AS (
    SELECT 
      asn."roleId",
      COUNT(asn.id) as assignment_count
    FROM filtered_activities fa
    JOIN assignments asn ON fa.id = asn."activityId"`;

        if (populationIds && populationIds.length > 0) {
            parameters.push(populationIds);
            cte += `
    JOIN participant_populations pp ON asn."participantId" = pp."participantId"
    WHERE pp."populationId" = ANY($${startIndex})`;
        }

        cte += `
    GROUP BY asn."roleId"
  ),
  role_counts_additional AS (
    SELECT
      r.id as "roleId",
      COALESCE(SUM(fa."additionalParticipantCount"), 0)::bigint as assignment_count
    FROM filtered_activities fa
    CROSS JOIN roles r
    WHERE r.name = 'Participant'
      AND fa."additionalParticipantCount" IS NOT NULL
      AND fa."additionalParticipantCount" > 0
    GROUP BY r.id
  ),
  role_counts AS (
    SELECT
      "roleId",
      SUM(assignment_count) as assignment_count
    FROM (
      SELECT "roleId", assignment_count FROM role_counts_individual
      UNION ALL
      SELECT "roleId", assignment_count FROM role_counts_additional
    ) combined
    GROUP BY "roleId"
  )`;

        return cte;
    }
}
