import { ActivityStatus } from './constants';

export enum QueryVariant {
  BASE = 'base',
  GEOGRAPHIC = 'geographic',
  POPULATION = 'population',
  PARTICIPANTS_ONLY = 'participants_only',
  FULL = 'full',
  FULL_WITH_PARTICIPANTS = 'full_with_participants',
}

export interface MapFilters {
  geographicAreaIds?: string[];
  activityCategoryIds?: string[];
  activityTypeIds?: string[];
  venueIds?: string[];
  populationIds?: string[];
  roleIds?: string[]; // NEW
  ageCohorts?: string[]; // NEW
  startDate?: Date;
  endDate?: Date;
  status?: ActivityStatus;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Query builder for optimized activity marker queries using raw SQL.
 * Selects the optimal query variant based on active filters to minimize table joins.
 */
export class ActivityMarkerQueryBuilder {
  private variant: QueryVariant;
  private referenceDate: Date;

  constructor(
    private filters: MapFilters,
    private effectiveVenueIds: string[] | undefined,
    private boundingBox: BoundingBox | undefined,
    referenceDate: Date,
    private limit: number,
    private offset: number
  ) {
    this.referenceDate = referenceDate;
    this.variant = this.selectVariant();
  }

  /**
   * Select the optimal query variant based on active filters
   */
  private selectVariant(): QueryVariant {
    const hasPopulation = this.filters.populationIds && this.filters.populationIds.length > 0;
    const hasRole = this.filters.roleIds && this.filters.roleIds.length > 0;
    const hasAgeCohort = this.filters.ageCohorts && this.filters.ageCohorts.length > 0;
    const hasGeographic = this.effectiveVenueIds !== undefined;

    // Determine if we need participant-related joins
    const needsParticipantJoins = hasPopulation || hasRole || hasAgeCohort;

    if (needsParticipantJoins && hasGeographic) {
      return QueryVariant.FULL_WITH_PARTICIPANTS;
    }
    if (needsParticipantJoins) {
      return QueryVariant.PARTICIPANTS_ONLY;
    }
    if (hasGeographic) {
      return QueryVariant.GEOGRAPHIC;
    }
    return QueryVariant.BASE;
  }

  /**
   * Get the selected query variant
   */
  public getVariant(): QueryVariant {
    return this.variant;
  }

  /**
   * Build the complete SQL query based on the selected variant
   */
  public build(): string {
    switch (this.variant) {
      case QueryVariant.BASE:
        return this.buildBaseQuery();
      case QueryVariant.GEOGRAPHIC:
        return this.buildGeographicQuery();
      case QueryVariant.POPULATION:
        return this.buildPopulationQuery();
      case QueryVariant.PARTICIPANTS_ONLY:
        return this.buildParticipantsOnlyQuery();
      case QueryVariant.FULL:
        return this.buildFullQuery();
      case QueryVariant.FULL_WITH_PARTICIPANTS:
        return this.buildFullWithParticipantsQuery();
    }
  }

  /**
   * Build base query without optional filters (no population or geographic joins)
   */
  private buildBaseQuery(): string {
    const cte = this.buildCurrentVenuesCTE(false);
    const whereClause = this.buildWhereClause(false);

    return `
      WITH current_venues AS (
        ${cte}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM activities a
      INNER JOIN activity_types at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      WHERE ${whereClause}
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }

  /**
   * Build geographic query variant with geographic filter in CTE
   */
  private buildGeographicQuery(): string {
    const cte = this.buildCurrentVenuesCTE(true); // Include geographic filter in CTE
    const whereClause = this.buildWhereClause(false);

    return `
      WITH current_venues AS (
        ${cte}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM activities a
      INNER JOIN activity_types at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      WHERE ${whereClause}
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }

  /**
   * Build population query variant with population joins (legacy - for backward compatibility)
   */
  private buildPopulationQuery(): string {
    const cte = this.buildCurrentVenuesCTE(false);
    const whereClause = this.buildWhereClauseWithParticipants(); // Use new method

    return `
      WITH current_venues AS (
        ${cte}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM activities a
      INNER JOIN activity_types at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      INNER JOIN assignments asn ON asn."activityId" = a.id
      INNER JOIN participants p ON p.id = asn."participantId"
      INNER JOIN participant_populations pp ON pp."participantId" = p.id
      WHERE ${whereClause}
      GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }

  /**
   * Build participants-only query variant (role/age cohort without geographic filter)
   */
  private buildParticipantsOnlyQuery(): string {
    const cte = this.buildCurrentVenuesCTE(false);
    const whereClause = this.buildWhereClauseWithParticipants();

    const hasPopulation = this.filters.populationIds && this.filters.populationIds.length > 0;
    const populationJoin = hasPopulation ? 'LEFT JOIN participant_populations pp ON pp."participantId" = p.id' : '';

    return `
      WITH current_venues AS (
        ${cte}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM activities a
      INNER JOIN activity_types at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      INNER JOIN assignments asn ON asn."activityId" = a.id
      INNER JOIN participants p ON p.id = asn."participantId"
      ${populationJoin}
      WHERE ${whereClause}
      GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }

  /**
   * Build full query variant with both geographic and population filters (legacy)
   */
  private buildFullQuery(): string {
    const cte = this.buildCurrentVenuesCTE(true); // Include geographic filter in CTE
    const whereClause = this.buildWhereClauseWithParticipants(); // Use new method for all participant filters

    return `
      WITH current_venues AS (
        ${cte}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM activities a
      INNER JOIN activity_types at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      INNER JOIN assignments asn ON asn."activityId" = a.id
      INNER JOIN participants p ON p.id = asn."participantId"
      INNER JOIN participant_populations pp ON pp."participantId" = p.id
      WHERE ${whereClause}
      GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }

  /**
   * Build full query variant with geographic and participant filters
   */
  private buildFullWithParticipantsQuery(): string {
    const cte = this.buildCurrentVenuesCTE(true); // Include geographic filter in CTE
    const whereClause = this.buildWhereClauseWithParticipants();

    const hasPopulation = this.filters.populationIds && this.filters.populationIds.length > 0;
    const populationJoin = hasPopulation ? 'LEFT JOIN participant_populations pp ON pp."participantId" = p.id' : '';

    return `
      WITH current_venues AS (
        ${cte}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM activities a
      INNER JOIN activity_types at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      INNER JOIN assignments asn ON asn."activityId" = a.id
      INNER JOIN participants p ON p.id = asn."participantId"
      ${populationJoin}
      WHERE ${whereClause}
      GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }

  /**
   * Build CTE for identifying current venue for each activity
   * Uses DISTINCT ON to efficiently get the most recent venue per activity
   */
  private buildCurrentVenuesCTE(includeGeographicFilter: boolean): string {
    let geoFilter = '';
    if (includeGeographicFilter && this.effectiveVenueIds && this.effectiveVenueIds.length > 0) {
      // Build IN clause - v.id is text in Prisma, so compare with text literals
      const venueIdList = this.effectiveVenueIds.map((id: string) => `'${id}'`).join(', ');
      geoFilter = `AND v.id IN (${venueIdList})`;
    }

    return `
      SELECT DISTINCT ON (avh."activityId")
        avh."activityId",
        avh."venueId",
        v.latitude,
        v.longitude
      FROM activity_venue_history avh
      INNER JOIN venues v ON v.id = avh."venueId"
      WHERE v.latitude IS NOT NULL 
        AND v.longitude IS NOT NULL
        ${geoFilter}
      ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
    `;
  }

  /**
   * Build WHERE clause with all applicable filters
   */
  private buildWhereClause(includePopulationFilter: boolean): string {
    const conditions: string[] = ['1=1'];

    // Population filter
    if (includePopulationFilter && this.filters.populationIds && this.filters.populationIds.length > 0) {
      const popIds = this.filters.populationIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`pp."populationId" IN (${popIds})`);
    }

    // Activity type filter
    if (this.filters.activityTypeIds && this.filters.activityTypeIds.length > 0) {
      const typeIds = this.filters.activityTypeIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`a."activityTypeId" IN (${typeIds})`);
    }

    // Activity category filter
    if (this.filters.activityCategoryIds && this.filters.activityCategoryIds.length > 0) {
      const catIds = this.filters.activityCategoryIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`at."activityCategoryId" IN (${catIds})`);
    }

    // Status filter
    if (this.filters.status) {
      conditions.push(`a.status = '${this.filters.status}'`);
    }

    // Date range filters with temporal overlap logic
    if (this.filters.startDate && this.filters.endDate) {
      conditions.push(`a."startDate" <= '${this.filters.endDate.toISOString()}'`);
      conditions.push(`(a."endDate" >= '${this.filters.startDate.toISOString()}' OR a."endDate" IS NULL)`);
    } else if (this.filters.startDate) {
      conditions.push(`(a."endDate" >= '${this.filters.startDate.toISOString()}' OR a."endDate" IS NULL)`);
    } else if (this.filters.endDate) {
      conditions.push(`a."startDate" <= '${this.filters.endDate.toISOString()}'`);
    }

    // Bounding box filters
    if (this.boundingBox) {
      conditions.push(...this.buildBoundingBoxConditions());
    }

    return conditions.join(' AND ');
  }

  /**
   * Build bounding box filter conditions with date line handling
   */
  private buildBoundingBoxConditions(): string[] {
    if (!this.boundingBox) return [];

    const { minLat, maxLat, minLon, maxLon } = this.boundingBox;
    const conditions: string[] = [];

    conditions.push(`cv.latitude >= ${minLat}`);
    conditions.push(`cv.latitude <= ${maxLat}`);

    // Handle international date line crossing
    if (minLon > maxLon) {
      conditions.push(`(cv.longitude >= ${minLon} OR cv.longitude <= ${maxLon})`);
    } else {
      conditions.push(`cv.longitude >= ${minLon}`);
      conditions.push(`cv.longitude <= ${maxLon}`);
    }

    return conditions;
  }

  /**
   * Build WHERE clause with participant-related filters (role, age cohort, population)
   * Used for PARTICIPANTS_ONLY and FULL_WITH_PARTICIPANTS variants
   */
  private buildWhereClauseWithParticipants(): string {
    const conditions: string[] = ['1=1'];

    // Role filter
    if (this.filters.roleIds && this.filters.roleIds.length > 0) {
      const roleIds = this.filters.roleIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`asn."roleId" IN (${roleIds})`);
    }

    // Age cohort filter
    if (this.filters.ageCohorts && this.filters.ageCohorts.length > 0) {
      conditions.push(this.buildAgeCohortFilter());
    }

    // Population filter
    if (this.filters.populationIds && this.filters.populationIds.length > 0) {
      const popIds = this.filters.populationIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`pp."populationId" IN (${popIds})`);
    }

    // Activity type filter
    if (this.filters.activityTypeIds && this.filters.activityTypeIds.length > 0) {
      const typeIds = this.filters.activityTypeIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`a."activityTypeId" IN (${typeIds})`);
    }

    // Activity category filter
    if (this.filters.activityCategoryIds && this.filters.activityCategoryIds.length > 0) {
      const catIds = this.filters.activityCategoryIds.map((id: string) => `'${id}'`).join(', ');
      conditions.push(`at."activityCategoryId" IN (${catIds})`);
    }

    // Status filter
    if (this.filters.status) {
      conditions.push(`a.status = '${this.filters.status}'`);
    }

    // Date range filters with temporal overlap logic
    if (this.filters.startDate && this.filters.endDate) {
      conditions.push(`a."startDate" <= '${this.filters.endDate.toISOString()}'`);
      conditions.push(`(a."endDate" >= '${this.filters.startDate.toISOString()}' OR a."endDate" IS NULL)`);
    } else if (this.filters.startDate) {
      conditions.push(`(a."endDate" >= '${this.filters.startDate.toISOString()}' OR a."endDate" IS NULL)`);
    } else if (this.filters.endDate) {
      conditions.push(`a."startDate" <= '${this.filters.endDate.toISOString()}'`);
    }

    // Bounding box filters
    if (this.boundingBox) {
      conditions.push(...this.buildBoundingBoxConditions());
    }

    return conditions.join(' AND ');
  }

  /**
   * Build age cohort filter SQL fragment
   * Converts age cohort names to date range conditions on dateOfBirth using reference date
   */
  private buildAgeCohortFilter(): string {
    if (!this.filters.ageCohorts || this.filters.ageCohorts.length === 0) {
      return '1=1';
    }

    // Import the conversion function
    const { convertCohortToDateRange } = require('./age-cohort.utils');

    const cohortConditions: string[] = [];

    for (const cohortName of this.filters.ageCohorts) {
      if (cohortName === 'Unknown') {
        cohortConditions.push(`p."dateOfBirth" IS NULL`);
        continue;
      }

      const range = convertCohortToDateRange(cohortName, this.referenceDate);

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
