export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface ParticipantHomeMarkerQueryParams {
    venueIds?: string[];
    populationIds?: string[];
    roleIds?: string[]; // NEW
    ageCohorts?: string[]; // NEW
    startDate?: Date;
    endDate?: Date;
    boundingBox?: BoundingBox;
    limit: number;
    skip: number;
    referenceDate: Date; // NEW: For age cohort calculations
}

/**
 * Raw SQL query result row for participant home markers
 */
export interface ParticipantHomeMarkerRow {
    venueId: string;
    latitude: any; // Prisma Decimal type
    longitude: any; // Prisma Decimal type
    participantCount: bigint; // PostgreSQL COUNT returns bigint
    total_count: bigint; // Window function COUNT returns bigint
}

/**
 * Query builder for participant home markers using CTEs with inline arrays
 * to avoid PostgreSQL's 32,767 bind variable limit.
 * 
 * Uses WITH clauses and inline UUID arrays to handle any number of venue/population IDs.
 * UUIDs are validated by the service layer before being passed to this builder.
 */
export class ParticipantHomeMarkerQueryBuilder {
    private params: any[] = [];
    private paramIndex = 1;

    constructor(private queryParams: ParticipantHomeMarkerQueryParams) { }

    /**
     * Build the complete SQL query with CTEs
     * Uses inline arrays for venue/population IDs to avoid bind variable limits
     */
    build(): string {
        const ctes: string[] = [];

        // CTE 1: Filtered venues (if geographic filter provided)
        if (this.queryParams.venueIds && this.queryParams.venueIds.length > 0) {
            ctes.push(this.buildFilteredVenuesCTE());
        }

        // CTE 2: Filtered populations (if population filter provided)
        if (this.queryParams.populationIds && this.queryParams.populationIds.length > 0) {
            ctes.push(this.buildFilteredPopulationsCTE());
        }

        // CTE 3: Current addresses
        ctes.push(this.buildCurrentAddressesCTE());

        // CTE 4: Active addresses (if temporal filter provided)
        if (this.queryParams.startDate || this.queryParams.endDate) {
            ctes.push(this.buildActiveAddressesCTE());
        }

        // Main query
        const mainQuery = this.buildMainQuery();

        // Assemble complete query
        const sql = `
WITH ${ctes.join(',\n')}
${mainQuery}
        `.trim();

        return sql;
    }

    /**
     * Get parameters array for query execution
     */
    getParams(): any[] {
        return this.params;
    }

    /**
     * CTE 1: Filtered venues from inline array
     * Uses inline UUID literals to avoid bind variable limits
     * Returns text type to match venues.id column type
     */
    private buildFilteredVenuesCTE(): string {
        const venueIdList = this.queryParams.venueIds!.map(id => `('${id}')`).join(', ');

        return `filtered_venues AS (
    SELECT id::text FROM (VALUES ${venueIdList}) AS t(id)
)`;
    }

    /**
     * CTE 2: Filtered populations from inline array
     * Returns text type to match participant_populations.populationId column type
     */
    private buildFilteredPopulationsCTE(): string {
        const populationIdList = this.queryParams.populationIds!.map(id => `('${id}')`).join(', ');

        return `filtered_populations AS (
    SELECT id::text FROM (VALUES ${populationIdList}) AS t(id)
)`;
    }

    /**
     * CTE 3: Current addresses with venue details
     * Uses DISTINCT ON to get most recent address per participant
     */
    private buildCurrentAddressesCTE(): string {
        let sql = `current_addresses AS (
    SELECT DISTINCT ON (pah."participantId")
        pah."participantId",
        pah."venueId",
        pah."effectiveFrom",
        v.latitude,
        v.longitude,
        p."dateOfBirth"
    FROM participant_address_history pah
    JOIN venues v ON pah."venueId" = v.id
    JOIN participants p ON pah."participantId" = p.id`;

        // Join filtered venues CTE if geographic filter provided
        if (this.queryParams.venueIds && this.queryParams.venueIds.length > 0) {
            sql += `\n    JOIN filtered_venues fv ON v.id = fv.id`;
        }

        // Join assignments if role filter provided
        if (this.queryParams.roleIds && this.queryParams.roleIds.length > 0) {
            sql += `\n    JOIN assignments asn ON asn."participantId" = p.id`;
        }

        // Start WHERE clause
        const whereConditions: string[] = [
            'v.latitude IS NOT NULL',
            'v.longitude IS NOT NULL'
        ];

        // Add coordinate filters
        if (this.queryParams.boundingBox) {
            const coordConditions = this.buildCoordinateFilter();
            whereConditions.push(...coordConditions);
        }

        // Add role filter
        if (this.queryParams.roleIds && this.queryParams.roleIds.length > 0) {
            const roleIdList = this.queryParams.roleIds.map(id => `'${id}'`).join(', ');
            whereConditions.push(`asn."roleId" IN (${roleIdList})`);
        }

        // Add age cohort filter
        if (this.queryParams.ageCohorts && this.queryParams.ageCohorts.length > 0) {
            whereConditions.push(this.buildAgeCohortFilter());
        }

        // Add population filter
        if (this.queryParams.populationIds && this.queryParams.populationIds.length > 0) {
            whereConditions.push(`EXISTS (
        SELECT 1 FROM participant_populations pp
        JOIN filtered_populations fp ON pp."populationId" = fp.id
        WHERE pp."participantId" = pah."participantId"
    )`);
        }

        sql += `\n    WHERE ${whereConditions.join('\n      AND ')}`;
        sql += `\n    ORDER BY pah."participantId", pah."effectiveFrom" DESC NULLS LAST`;
        sql += `\n)`;

        return sql;
    }

    /**
     * CTE 4: Active addresses (temporal filtering)
     * Filters addresses that were active during the query period
     */
    private buildActiveAddressesCTE(): string {
        const { startDate, endDate } = this.queryParams;

        let sql = `active_addresses AS (
    SELECT 
        ca."participantId",
        ca."venueId",
        ca.latitude,
        ca.longitude
    FROM current_addresses ca
    WHERE `;

        const conditions: string[] = [];

        if (startDate && endDate) {
            // Both dates: address must overlap with period
            this.params.push(endDate);
            const endDateParam = this.paramIndex++;
            this.params.push(startDate);
            const startDateParam = this.paramIndex++;

            conditions.push(`(ca."effectiveFrom" IS NULL OR ca."effectiveFrom" <= $${endDateParam})`);
            conditions.push(`(
        -- Address is still current OR ended after period start
        NOT EXISTS (
            SELECT 1 FROM participant_address_history pah2
            WHERE pah2."participantId" = ca."participantId"
              AND (
                  (ca."effectiveFrom" IS NULL AND pah2."effectiveFrom" IS NOT NULL)
                  OR (pah2."effectiveFrom" > ca."effectiveFrom")
              )
              AND pah2."effectiveFrom" <= $${startDateParam}
        )
    )`);
        } else if (startDate) {
            // Only startDate: address must end after start
            this.params.push(startDate);
            const startDateParam = this.paramIndex++;

            conditions.push(`(
        NOT EXISTS (
            SELECT 1 FROM participant_address_history pah2
            WHERE pah2."participantId" = ca."participantId"
              AND (
                  (ca."effectiveFrom" IS NULL AND pah2."effectiveFrom" IS NOT NULL)
                  OR (pah2."effectiveFrom" > ca."effectiveFrom")
              )
              AND pah2."effectiveFrom" <= $${startDateParam}
        )
    )`);
        } else if (endDate) {
            // Only endDate: address must start before/during end
            this.params.push(endDate);
            const endDateParam = this.paramIndex++;

            conditions.push(`(ca."effectiveFrom" IS NULL OR ca."effectiveFrom" <= $${endDateParam})`);
        }

        sql += conditions.join('\n      AND ');
        sql += `\n)`;

        return sql;
    }

    /**
     * Build coordinate filter conditions
     * Handles international date line crossing
     */
    private buildCoordinateFilter(): string[] {
        const { minLat, maxLat, minLon, maxLon } = this.queryParams.boundingBox!;
        const conditions: string[] = [];

        // Latitude filter (always simple range)
        this.params.push(minLat);
        const minLatParam = this.paramIndex++;
        this.params.push(maxLat);
        const maxLatParam = this.paramIndex++;

        conditions.push(`v.latitude >= $${minLatParam}`);
        conditions.push(`v.latitude <= $${maxLatParam}`);

        // Longitude filter (handle date line crossing)
        const crossesDateLine = minLon > maxLon;

        if (crossesDateLine) {
            // Crossing date line: longitude >= minLon OR longitude <= maxLon
            this.params.push(minLon);
            const minLonParam = this.paramIndex++;
            this.params.push(maxLon);
            const maxLonParam = this.paramIndex++;

            conditions.push(`(v.longitude >= $${minLonParam} OR v.longitude <= $${maxLonParam})`);
        } else {
            // Normal case: longitude between minLon and maxLon
            this.params.push(minLon);
            const minLonParam = this.paramIndex++;
            this.params.push(maxLon);
            const maxLonParam = this.paramIndex++;

            conditions.push(`v.longitude >= $${minLonParam}`);
            conditions.push(`v.longitude <= $${maxLonParam}`);
        }

        return conditions;
    }

    /**
     * Build main query that groups by venue and paginates
     */
    private buildMainQuery(): string {
        // Determine which CTE to select from
        const sourceCTE = (this.queryParams.startDate || this.queryParams.endDate)
            ? 'active_addresses'
            : 'current_addresses';

        this.params.push(this.queryParams.limit);
        const limitParam = this.paramIndex++;
        this.params.push(this.queryParams.skip);
        const skipParam = this.paramIndex++;

        return `
SELECT 
    ${sourceCTE}."venueId"::text as "venueId",
    ${sourceCTE}.latitude,
    ${sourceCTE}.longitude,
    COUNT(DISTINCT ${sourceCTE}."participantId") as "participantCount",
    COUNT(*) OVER() as total_count
FROM ${sourceCTE}
GROUP BY ${sourceCTE}."venueId", ${sourceCTE}.latitude, ${sourceCTE}.longitude
ORDER BY ${sourceCTE}."venueId"
LIMIT $${limitParam} OFFSET $${skipParam}`;
    }

    /**
     * Get query variant description for logging
     */
    getVariant(): string {
        const features: string[] = [];

        if (this.queryParams.venueIds) features.push('geographic');
        if (this.queryParams.populationIds) features.push('population');
        if (this.queryParams.roleIds) features.push('role');
        if (this.queryParams.ageCohorts) features.push('ageCohort');
        if (this.queryParams.startDate || this.queryParams.endDate) features.push('temporal');
        if (this.queryParams.boundingBox) features.push('coordinates');

        return features.length > 0 ? features.join('+') : 'base';
    }

    /**
     * Build age cohort filter SQL fragment
     * Converts age cohort names to date range conditions on dateOfBirth using reference date
     */
    private buildAgeCohortFilter(): string {
        if (!this.queryParams.ageCohorts || this.queryParams.ageCohorts.length === 0) {
            return '1=1';
        }

        // Import the conversion function
        const { convertCohortToDateRange } = require('./age-cohort.utils');

        const cohortConditions: string[] = [];

        for (const cohortName of this.queryParams.ageCohorts) {
            if (cohortName === 'Unknown') {
                cohortConditions.push(`p."dateOfBirth" IS NULL`);
                continue;
            }

            const range = convertCohortToDateRange(cohortName, this.queryParams.referenceDate);

            if (!range) {
                continue;
            }

            if (range.min && range.max) {
                // Range with both boundaries
                cohortConditions.push(
                    `(p."dateOfBirth" >= '${range.min.toISOString()}' AND p."dateOfBirth" < '${range.max.toISOString()}')`
                );
            } else if (range.min) {
                // Only minimum boundary (Child cohort)
                cohortConditions.push(`p."dateOfBirth" > '${range.min.toISOString()}'`);
            } else if (range.max) {
                // Only maximum boundary (Adult cohort)
                cohortConditions.push(`p."dateOfBirth" < '${range.max.toISOString()}'`);
            }
        }

        // Combine with OR logic
        return cohortConditions.length > 0 ? `(${cohortConditions.join(' OR ')})` : '1=1';
    }
}
