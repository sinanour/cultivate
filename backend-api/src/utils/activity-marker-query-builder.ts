import { ActivityStatus } from './constants';

export enum QueryVariant {
  BASE = 'base',
  GEOGRAPHIC = 'geographic',
  POPULATION = 'population',
  FULL = 'full',
}

export interface MapFilters {
  geographicAreaIds?: string[];
  activityCategoryIds?: string[];
  activityTypeIds?: string[];
  venueIds?: string[];
  populationIds?: string[];
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

  constructor(
    private filters: MapFilters,
    private effectiveVenueIds: string[] | undefined,
    private boundingBox: BoundingBox | undefined,
    private limit: number,
    private offset: number
  ) {
    this.variant = this.selectVariant();
  }

  /**
   * Select the optimal query variant based on active filters
   */
  private selectVariant(): QueryVariant {
    const hasPopulation = this.filters.populationIds && this.filters.populationIds.length > 0;
    const hasGeographic = this.effectiveVenueIds !== undefined;

    if (hasPopulation && hasGeographic) return QueryVariant.FULL;
    if (hasPopulation) return QueryVariant.POPULATION;
    if (hasGeographic) return QueryVariant.GEOGRAPHIC;
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
      case QueryVariant.FULL:
        return this.buildFullQuery();
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
   * Build population query variant with population joins
   */
  private buildPopulationQuery(): string {
    const cte = this.buildCurrentVenuesCTE(false);
    const whereClause = this.buildWhereClause(true); // Include population filter

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
   * Build full query variant with both geographic and population filters
   */
  private buildFullQuery(): string {
    const cte = this.buildCurrentVenuesCTE(true); // Include geographic filter in CTE
    const whereClause = this.buildWhereClause(true); // Include population filter

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
}
