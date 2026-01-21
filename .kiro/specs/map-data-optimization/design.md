# Design Document: Map Data API Performance Optimization

## Overview

This design document details the optimization of the `getActivityMarkers` method in the MapDataService class. The current implementation uses Prisma ORM abstractions that result in multiple database queries and in-memory pagination. The optimized implementation will use raw SQL queries with conditional joins, database-level pagination, and stable sorting to achieve significant performance improvements.

## Problem Analysis

### Current Implementation Issues

1. **Multiple Database Round Trips**
   - First query: `getVenueIdsForAreas()` fetches all venue IDs for geographic areas
   - Second query: `activity.findMany()` fetches activities with massive IN clause
   - Result: 2+ database queries per request

2. **In-Memory Pagination**
   - Fetches ALL matching activities from database
   - Filters by coordinates in application code
   - Applies pagination by slicing array in memory
   - Result: Fetches 10,000 activities to return 100

3. **Unnecessary Table Joins**
   - Always joins Assignment, Participant, ParticipantPopulation tables
   - Even when no population filter is present
   - Result: Slower queries due to unnecessary joins

4. **Unstable Sorting**
   - No explicit ORDER BY clause
   - Results returned in arbitrary order
   - Result: LIMIT/OFFSET produce inconsistent pagination

### Performance Impact

For a dataset with 100,000 activities:
- Current: ~500-1000ms query time, fetches all 100k rows
- Target: ~50-100ms query time, fetches only 100 rows per page

## Solution Architecture

### Core Design Principles

1. **Single Database Round Trip**: All filtering, joining, and pagination in one SQL query
2. **Conditional Joins**: Only join tables when filters require them
3. **Database-Level Pagination**: Use LIMIT/OFFSET in SQL, not in memory
4. **Stable Sorting**: Always ORDER BY activity.id for deterministic results
5. **Query Variants**: Different SQL queries for different filter combinations

### Query Variant Strategy

The system will select one of four query variants based on active filters:


| Variant | Population Filter | Geographic Filter | Tables Joined |
|---------|------------------|-------------------|---------------|
| Base | No | No | Activity, ActivityType, ActivityVenueHistory, Venue |
| Geographic | No | Yes | Activity, ActivityType, ActivityVenueHistory, Venue |
| Population | Yes | No | Activity, ActivityType, ActivityVenueHistory, Venue, Assignment, Participant, ParticipantPopulation |
| Full | Yes | Yes | Activity, ActivityType, ActivityVenueHistory, Venue, Assignment, Participant, ParticipantPopulation |

### Query Selection Logic

```typescript
function selectQueryVariant(filters: MapFilters): QueryVariant {
  const hasPopulationFilter = filters.populationIds && filters.populationIds.length > 0;
  const hasGeographicFilter = effectiveVenueIds !== undefined;
  
  if (hasPopulationFilter && hasGeographicFilter) return QueryVariant.FULL;
  if (hasPopulationFilter) return QueryVariant.POPULATION;
  if (hasGeographicFilter) return QueryVariant.GEOGRAPHIC;
  return QueryVariant.BASE;
}
```

## SQL Query Structure

### Base Query (No Optional Filters)

This is the simplest and fastest variant, used when no population or geographic filters are present.

```sql
WITH current_venues AS (
  -- Identify the current venue for each activity using window function
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL 
    AND v.longitude IS NOT NULL
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
WHERE 1=1
  -- Activity type filter (if present)
  AND ($activityTypeIds IS NULL OR a."activityTypeId" = ANY($activityTypeIds::uuid[]))
  -- Activity category filter (if present)
  AND ($activityCategoryIds IS NULL OR at."activityCategoryId" = ANY($activityCategoryIds::uuid[]))
  -- Status filter (if present)
  AND ($status IS NULL OR a.status = $status)
  -- Date range filters (if present)
  AND ($startDate IS NULL OR a."startDate" <= $endDate)
  AND ($endDate IS NULL OR a."endDate" >= $startDate OR a."endDate" IS NULL)
  -- Bounding box filters (if present)
  AND ($minLat IS NULL OR cv.latitude >= $minLat)
  AND ($maxLat IS NULL OR cv.latitude <= $maxLat)
  AND ($minLon IS NULL OR $maxLon IS NULL OR 
       CASE 
         WHEN $minLon > $maxLon THEN (cv.longitude >= $minLon OR cv.longitude <= $maxLon)
         ELSE (cv.longitude >= $minLon AND cv.longitude <= $maxLon)
       END)
ORDER BY a.id
LIMIT $limit OFFSET $offset;
```

**Key Features:**
- CTE identifies current venue once per activity
- DISTINCT ON ensures one venue per activity
- Window function COUNT(*) OVER() calculates total in same query
- All filters in WHERE clause (database-level filtering)
- ORDER BY a.id ensures stable pagination
- NULLS LAST handles null effectiveFrom dates


### Population Filter Query Variant

When population filtering is required, we add joins to Assignment, Participant, and ParticipantPopulation tables.

```sql
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL 
    AND v.longitude IS NOT NULL
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
-- Population filter joins (only when populationIds filter is present)
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
INNER JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
WHERE 1=1
  -- Population filter (required for this variant)
  AND pp."populationId" = ANY($populationIds::uuid[])
  -- Other filters same as base query
  AND ($activityTypeIds IS NULL OR a."activityTypeId" = ANY($activityTypeIds::uuid[]))
  AND ($activityCategoryIds IS NULL OR at."activityCategoryId" = ANY($activityCategoryIds::uuid[]))
  AND ($status IS NULL OR a.status = $status)
  AND ($startDate IS NULL OR a."startDate" <= $endDate)
  AND ($endDate IS NULL OR a."endDate" >= $startDate OR a."endDate" IS NULL)
  AND ($minLat IS NULL OR cv.latitude >= $minLat)
  AND ($maxLat IS NULL OR cv.latitude <= $maxLat)
  AND ($minLon IS NULL OR $maxLon IS NULL OR 
       CASE 
         WHEN $minLon > $maxLon THEN (cv.longitude >= $minLon OR cv.longitude <= $maxLon)
         ELSE (cv.longitude >= $minLon AND cv.longitude <= $maxLon)
       END)
GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
ORDER BY a.id
LIMIT $limit OFFSET $offset;
```

**Key Differences:**
- Adds INNER JOIN for Assignment, Participant, ParticipantPopulation
- Filters by populationId in WHERE clause
- Uses GROUP BY to deduplicate (activity may have multiple participants in population)
- Still maintains ORDER BY a.id for stable pagination


### Geographic Filter Query Variant

When geographic filtering is required but no population filter, we filter venues by geographic area.

```sql
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL 
    AND v.longitude IS NOT NULL
    -- Geographic filter applied in CTE for efficiency
    AND v."geographicAreaId" = ANY($effectiveVenueAreaIds::uuid[])
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
WHERE 1=1
  AND ($activityTypeIds IS NULL OR a."activityTypeId" = ANY($activityTypeIds::uuid[]))
  AND ($activityCategoryIds IS NULL OR at."activityCategoryId" = ANY($activityCategoryIds::uuid[]))
  AND ($status IS NULL OR a.status = $status)
  AND ($startDate IS NULL OR a."startDate" <= $endDate)
  AND ($endDate IS NULL OR a."endDate" >= $startDate OR a."endDate" IS NULL)
  AND ($minLat IS NULL OR cv.latitude >= $minLat)
  AND ($maxLat IS NULL OR cv.latitude <= $maxLat)
  AND ($minLon IS NULL OR $maxLon IS NULL OR 
       CASE 
         WHEN $minLon > $maxLon THEN (cv.longitude >= $minLon OR cv.longitude <= $maxLon)
         ELSE (cv.longitude >= $minLon AND cv.longitude <= $maxLon)
       END)
ORDER BY a.id
LIMIT $limit OFFSET $offset;
```

**Key Differences:**
- Geographic filter applied in CTE WHERE clause (filters venues early)
- No population-related joins
- More efficient than base query when geographic filter is selective

### Full Query Variant (Both Filters)

When both population and geographic filters are present:

```sql
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL 
    AND v.longitude IS NOT NULL
    AND v."geographicAreaId" = ANY($effectiveVenueAreaIds::uuid[])
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
INNER JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
WHERE 1=1
  AND pp."populationId" = ANY($populationIds::uuid[])
  AND ($activityTypeIds IS NULL OR a."activityTypeId" = ANY($activityTypeIds::uuid[]))
  AND ($activityCategoryIds IS NULL OR at."activityCategoryId" = ANY($activityCategoryIds::uuid[]))
  AND ($status IS NULL OR a.status = $status)
  AND ($startDate IS NULL OR a."startDate" <= $endDate)
  AND ($endDate IS NULL OR a."endDate" >= $startDate OR a."endDate" IS NULL)
  AND ($minLat IS NULL OR cv.latitude >= $minLat)
  AND ($maxLat IS NULL OR cv.latitude <= $maxLat)
  AND ($minLon IS NULL OR $maxLon IS NULL OR 
       CASE 
         WHEN $minLon > $maxLon THEN (cv.longitude >= $minLon OR cv.longitude <= $maxLon)
         ELSE (cv.longitude >= $minLon AND cv.longitude <= $maxLon)
       END)
GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
ORDER BY a.id
LIMIT $limit OFFSET $offset;
```


## Implementation Design

### Query Builder Pattern

The implementation uses a modular query builder that constructs SQL dynamically:

```typescript
class ActivityMarkerQueryBuilder {
  private baseCTE: string;
  private selectClause: string;
  private fromClause: string;
  private joinClauses: string[] = [];
  private whereConditions: string[] = ['1=1'];
  private groupByClause?: string;
  private orderByClause: string = 'ORDER BY a.id';
  private paginationClause: string;
  
  constructor(
    private filters: MapFilters,
    private effectiveVenueIds: string[] | undefined,
    private boundingBox: BoundingBox | undefined,
    private limit: number,
    private offset: number
  ) {
    this.buildQuery();
  }
  
  private buildQuery(): void {
    // Build CTE for current venues
    this.baseCTE = this.buildCurrentVenuesCTE();
    
    // Build SELECT clause
    this.selectClause = `
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
    `;
    
    // Build FROM clause
    this.fromClause = 'FROM "Activity" a';
    
    // Add required joins
    this.addRequiredJoins();
    
    // Add conditional joins based on filters
    this.addConditionalJoins();
    
    // Add WHERE conditions
    this.addWhereConditions();
    
    // Add GROUP BY if needed
    if (this.needsGroupBy()) {
      this.groupByClause = 'GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"';
    }
    
    // Pagination
    this.paginationClause = `LIMIT ${this.limit} OFFSET ${this.offset}`;
  }
  
  private buildCurrentVenuesCTE(): string {
    const geographicFilter = this.effectiveVenueIds
      ? `AND v."geographicAreaId" = ANY($effectiveVenueAreaIds::uuid[])`
      : '';
    
    return `
      WITH current_venues AS (
        SELECT DISTINCT ON (avh."activityId")
          avh."activityId",
          avh."venueId",
          v.latitude,
          v.longitude
        FROM "ActivityVenueHistory" avh
        INNER JOIN "Venue" v ON v.id = avh."venueId"
        WHERE v.latitude IS NOT NULL 
          AND v.longitude IS NOT NULL
          ${geographicFilter}
        ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
      )
    `;
  }
  
  private addRequiredJoins(): void {
    this.joinClauses.push('INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"');
    this.joinClauses.push('INNER JOIN current_venues cv ON cv."activityId" = a.id');
  }
  
  private addConditionalJoins(): void {
    // Add population filter joins if needed
    if (this.filters.populationIds && this.filters.populationIds.length > 0) {
      this.joinClauses.push('INNER JOIN "Assignment" asn ON asn."activityId" = a.id');
      this.joinClauses.push('INNER JOIN "Participant" p ON p.id = asn."participantId"');
      this.joinClauses.push('INNER JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id');
    }
  }
  
  private addWhereConditions(): void {
    // Activity type filter
    if (this.filters.activityTypeIds && this.filters.activityTypeIds.length > 0) {
      this.whereConditions.push('a."activityTypeId" = ANY($activityTypeIds::uuid[])');
    }
    
    // Activity category filter
    if (this.filters.activityCategoryIds && this.filters.activityCategoryIds.length > 0) {
      this.whereConditions.push('at."activityCategoryId" = ANY($activityCategoryIds::uuid[])');
    }
    
    // Status filter
    if (this.filters.status) {
      this.whereConditions.push('a.status = $status');
    }
    
    // Population filter
    if (this.filters.populationIds && this.filters.populationIds.length > 0) {
      this.whereConditions.push('pp."populationId" = ANY($populationIds::uuid[])');
    }
    
    // Date range filters
    this.addDateRangeConditions();
    
    // Bounding box filters
    this.addBoundingBoxConditions();
  }
  
  private addDateRangeConditions(): void {
    if (this.filters.startDate && this.filters.endDate) {
      this.whereConditions.push('a."startDate" <= $endDate');
      this.whereConditions.push('(a."endDate" >= $startDate OR a."endDate" IS NULL)');
    } else if (this.filters.startDate) {
      this.whereConditions.push('(a."endDate" >= $startDate OR a."endDate" IS NULL)');
    } else if (this.filters.endDate) {
      this.whereConditions.push('a."startDate" <= $endDate');
    }
  }
  
  private addBoundingBoxConditions(): void {
    if (!this.boundingBox) return;
    
    const { minLat, maxLat, minLon, maxLon } = this.boundingBox;
    
    this.whereConditions.push('cv.latitude >= $minLat');
    this.whereConditions.push('cv.latitude <= $maxLat');
    
    // Handle international date line crossing
    if (minLon > maxLon) {
      this.whereConditions.push('(cv.longitude >= $minLon OR cv.longitude <= $maxLon)');
    } else {
      this.whereConditions.push('cv.longitude >= $minLon');
      this.whereConditions.push('cv.longitude <= $maxLon');
    }
  }
  
  private needsGroupBy(): boolean {
    // GROUP BY needed when population filter is present (to deduplicate activities with multiple matching participants)
    return this.filters.populationIds !== undefined && this.filters.populationIds.length > 0;
  }
  
  public build(): string {
    const parts = [
      this.baseCTE,
      this.selectClause,
      this.fromClause,
      ...this.joinClauses,
      `WHERE ${this.whereConditions.join(' AND ')}`,
    ];
    
    if (this.groupByClause) {
      parts.push(this.groupByClause);
    }
    
    parts.push(this.orderByClause);
    parts.push(this.paginationClause);
    
    return parts.join('\n');
  }
}
```


## Parameter Binding with Prisma

Prisma's `$queryRaw` uses tagged template literals for safe parameter binding:

```typescript
async getActivityMarkers(
  filters: MapFilters,
  userId: string,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<ActivityMarker>> {
  // ... authorization and filter preparation ...
  
  // Build query
  const queryBuilder = new ActivityMarkerQueryBuilder(
    filters,
    effectiveVenueIds,
    boundingBox,
    effectiveLimit,
    skip
  );
  
  // Execute with safe parameter binding
  const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
    ${Prisma.raw(queryBuilder.build())}
  `;
  
  // Alternative: Use Prisma.sql for inline parameters
  const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
    WITH current_venues AS (...)
    SELECT ...
    WHERE a."activityTypeId" = ANY(${filters.activityTypeIds || null}::uuid[])
      AND a.status = ${filters.status || null}
      AND cv.latitude >= ${boundingBox?.minLat || null}
    ORDER BY a.id
    LIMIT ${effectiveLimit} OFFSET ${skip}
  `;
  
  // Extract total count from first row (window function)
  const total = results.length > 0 ? results[0].total_count : 0;
  
  // Transform to markers
  const markers: ActivityMarker[] = results.map(row => ({
    id: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    activityTypeId: row.activityTypeId,
    activityCategoryId: row.activityCategoryId,
  }));
  
  return {
    data: markers,
    pagination: {
      page,
      limit: effectiveLimit,
      total,
      totalPages: Math.ceil(total / effectiveLimit),
    },
  };
}
```

### Type Definitions

```typescript
interface ActivityMarkerRow {
  id: string;
  latitude: any; // Prisma Decimal type
  longitude: any; // Prisma Decimal type
  activityTypeId: string;
  activityCategoryId: string;
  total_count: bigint; // PostgreSQL COUNT returns bigint
}
```


## Stable Sorting and Pagination

### Why Stable Sorting Matters

Without stable sorting, pagination can produce inconsistent results:

**Problem Example (No ORDER BY):**
```
Request 1: GET /map/activities?page=1&limit=100
Database returns activities in arbitrary order: [A, B, C, D, E, ...]

Request 2: GET /map/activities?page=2&limit=100
Database returns different order: [C, F, G, A, H, ...]
Result: Activity A appears on both pages, Activity B is skipped
```

**Solution (ORDER BY activity.id):**
```
Request 1: GET /map/activities?page=1&limit=100
Database returns: [A, B, C, D, E, ...] (sorted by ID)

Request 2: GET /map/activities?page=2&limit=100
Database returns: [F, G, H, I, J, ...] (continues from page 1)
Result: No duplicates, no gaps, consistent pagination
```

### Implementation

Every query variant MUST include:

```sql
ORDER BY a.id
LIMIT $limit OFFSET $offset
```

This ensures:
1. **Deterministic ordering**: Same query always returns same order
2. **Consistent pagination**: Page 2 always follows page 1
3. **No duplicates**: Each activity appears exactly once across all pages
4. **No gaps**: No activities are skipped between pages

### Performance Considerations

- `activity.id` is the primary key (indexed by default)
- Sorting by primary key is very fast (O(log n) with B-tree index)
- No additional index needed
- Minimal performance overhead


## Current Venue Identification Strategy

### DISTINCT ON Approach

PostgreSQL's `DISTINCT ON` is the most efficient way to get the most recent venue per activity:

```sql
SELECT DISTINCT ON (avh."activityId")
  avh."activityId",
  avh."venueId",
  v.latitude,
  v.longitude
FROM "ActivityVenueHistory" avh
INNER JOIN "Venue" v ON v.id = avh."venueId"
WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
```

**How it works:**
1. `DISTINCT ON (activityId)` keeps only the first row for each activity
2. `ORDER BY activityId, effectiveFrom DESC NULLS LAST` ensures the first row is the most recent
3. `NULLS LAST` handles null effectiveFrom dates (treats them as oldest)
4. Result: One venue per activity, the most recent one

### Alternative: Window Function Approach

If DISTINCT ON is not preferred, use ROW_NUMBER():

```sql
WITH ranked_venues AS (
  SELECT 
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude,
    ROW_NUMBER() OVER (
      PARTITION BY avh."activityId" 
      ORDER BY avh."effectiveFrom" DESC NULLS LAST
    ) as rn
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
)
SELECT 
  "activityId",
  "venueId",
  latitude,
  longitude
FROM ranked_venues
WHERE rn = 1
```

**Recommendation:** Use DISTINCT ON for better performance (simpler execution plan).


## Filter Optimization Strategies

### Geographic Filter Optimization

**Current Approach (Inefficient):**
```typescript
// Query 1: Get venue IDs
const venueIds = await getVenueIdsForAreas(areaIds); // Returns 50,000 IDs

// Query 2: Filter activities with massive IN clause
WHERE venueId IN (id1, id2, ..., id50000)
```

**Optimized Approach:**
```sql
-- Single query with geographic filter in CTE
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId") ...
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v."geographicAreaId" = ANY($areaIds::uuid[])  -- Filter early
  ...
)
```

**Benefits:**
- Single database round trip
- Filter applied early (reduces rows processed)
- Database optimizer can use indexes efficiently

### Population Filter Optimization

**Key Insight:** Only join population tables when filter is present

```typescript
// Check if population filter is active
const hasPopulationFilter = filters.populationIds && filters.populationIds.length > 0;

if (hasPopulationFilter) {
  // Use query variant with population joins
  query = buildPopulationFilterQuery();
} else {
  // Use query variant without population joins (faster)
  query = buildBaseQuery();
}
```

**Performance Impact:**
- Without population filter: 3 fewer table joins
- Query execution time reduced by 30-40%
- Especially important when population tables are large

### Bounding Box Filter Optimization

Apply coordinate filters directly in WHERE clause:

```sql
WHERE cv.latitude >= $minLat
  AND cv.latitude <= $maxLat
  AND cv.longitude >= $minLon
  AND cv.longitude <= $maxLon
```

**International Date Line Handling:**
```sql
WHERE cv.latitude >= $minLat
  AND cv.latitude <= $maxLat
  AND CASE 
    WHEN $minLon > $maxLon THEN 
      (cv.longitude >= $minLon OR cv.longitude <= $maxLon)
    ELSE 
      (cv.longitude >= $minLon AND cv.longitude <= $maxLon)
  END
```


## Performance Monitoring

### Query Execution Logging

```typescript
async getActivityMarkers(...): Promise<PaginatedResponse<ActivityMarker>> {
  const startTime = Date.now();
  
  // Determine query variant
  const variant = this.selectQueryVariant(filters);
  
  // Execute query
  const results = await this.executeQuery(variant, ...);
  
  const executionTime = Date.now() - startTime;
  
  // Log in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MapData] Activity markers query completed:`, {
      variant,
      executionTime: `${executionTime}ms`,
      rowsReturned: results.length,
      totalCount: results[0]?.total_count || 0,
      filters: {
        hasPopulation: !!filters.populationIds,
        hasGeographic: !!effectiveVenueIds,
        hasBoundingBox: !!boundingBox,
        hasDateRange: !!(filters.startDate || filters.endDate),
      },
    });
  }
  
  return transformResults(results);
}
```

### Performance Metrics

Track these metrics for comparison:

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Query time | 500-1000ms | <200ms | Database execution time |
| Rows fetched | All (100k+) | Page size (100) | Database rows returned |
| Memory usage | High | Low | Application memory for result set |
| Database load | High | Low | Query complexity and row processing |


## Implementation Approach

### Step 1: Create Query Builder Class

Create a new file `backend-api/src/utils/activity-marker-query-builder.ts`:

```typescript
export enum QueryVariant {
  BASE = 'base',
  GEOGRAPHIC = 'geographic',
  POPULATION = 'population',
  FULL = 'full',
}

export class ActivityMarkerQueryBuilder {
  // Implementation as shown above
}
```

### Step 2: Update MapDataService

Replace the current `getActivityMarkers` implementation:

```typescript
async getActivityMarkers(...): Promise<PaginatedResponse<ActivityMarker>> {
  // Keep existing authorization logic
  const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(...);
  
  // NEW: Build and execute optimized query
  const queryBuilder = new ActivityMarkerQueryBuilder(
    filters,
    effectiveVenueIds,
    boundingBox,
    effectiveLimit,
    skip
  );
  
  const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
    ${Prisma.raw(queryBuilder.build())}
  `;
  
  // Extract total from window function
  const total = results.length > 0 ? Number(results[0].total_count) : 0;
  
  // Transform results
  const markers = results.map(row => ({
    id: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    activityTypeId: row.activityTypeId,
    activityCategoryId: row.activityCategoryId,
  }));
  
  return {
    data: markers,
    pagination: {
      page,
      limit: effectiveLimit,
      total,
      totalPages: Math.ceil(total / effectiveLimit),
    },
  };
}
```

### Step 3: Handle Edge Cases

**Empty Result Sets:**
```typescript
if (effectiveAreaIds !== undefined && effectiveAreaIds.length === 0) {
  return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
}
```

**Null Parameters:**
```typescript
// Use NULL for optional parameters
const activityTypeIds = filters.activityTypeIds || null;
const status = filters.status || null;
```

**Type Conversions:**
```typescript
// Convert Prisma Decimal to number
latitude: Number(row.latitude)

// Convert bigint to number
total: Number(results[0].total_count)
```


## Testing Strategy

### Unit Tests

Test the query builder in isolation:

```typescript
describe('ActivityMarkerQueryBuilder', () => {
  it('should build base query without optional filters', () => {
    const builder = new ActivityMarkerQueryBuilder(
      {}, // No filters
      undefined, // No venue IDs
      undefined, // No bounding box
      100,
      0
    );
    
    const sql = builder.build();
    
    expect(sql).toContain('ORDER BY a.id');
    expect(sql).toContain('LIMIT 100 OFFSET 0');
    expect(sql).not.toContain('Assignment');
    expect(sql).not.toContain('ParticipantPopulation');
  });
  
  it('should include population joins when population filter is present', () => {
    const builder = new ActivityMarkerQueryBuilder(
      { populationIds: ['uuid1', 'uuid2'] },
      undefined,
      undefined,
      100,
      0
    );
    
    const sql = builder.build();
    
    expect(sql).toContain('Assignment');
    expect(sql).toContain('Participant');
    expect(sql).toContain('ParticipantPopulation');
    expect(sql).toContain('GROUP BY');
    expect(sql).toContain('ORDER BY a.id');
  });
  
  it('should handle bounding box with date line crossing', () => {
    const builder = new ActivityMarkerQueryBuilder(
      {},
      undefined,
      { minLat: -10, maxLat: 10, minLon: 170, maxLon: -170 }, // Crosses date line
      100,
      0
    );
    
    const sql = builder.build();
    
    expect(sql).toContain('cv.longitude >= $minLon OR cv.longitude <= $maxLon');
  });
});
```

### Integration Tests

Test the full method with real database:

```typescript
describe('MapDataService.getActivityMarkers (optimized)', () => {
  it('should return consistent results across paginated requests', async () => {
    // Create 250 test activities
    await createTestActivities(250);
    
    // Fetch page 1
    const page1 = await service.getActivityMarkers({}, userId, undefined, 1, 100);
    
    // Fetch page 2
    const page2 = await service.getActivityMarkers({}, userId, undefined, 2, 100);
    
    // Fetch page 3
    const page3 = await service.getActivityMarkers({}, userId, undefined, 3, 100);
    
    // Verify no duplicates
    const allIds = [
      ...page1.data.map(m => m.id),
      ...page2.data.map(m => m.id),
      ...page3.data.map(m => m.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length); // No duplicates
    
    // Verify total count is consistent
    expect(page1.pagination.total).toBe(250);
    expect(page2.pagination.total).toBe(250);
    expect(page3.pagination.total).toBe(250);
  });
  
  it('should apply population filter correctly', async () => {
    // Create activities with specific population assignments
    const population = await createPopulation('Youth');
    const activity1 = await createActivityWithPopulation(population.id);
    const activity2 = await createActivityWithoutPopulation();
    
    const result = await service.getActivityMarkers(
      { populationIds: [population.id] },
      userId
    );
    
    expect(result.data.map(m => m.id)).toContain(activity1.id);
    expect(result.data.map(m => m.id)).not.toContain(activity2.id);
  });
  
  it('should be significantly faster than current implementation', async () => {
    await createTestActivities(10000);
    
    const start = Date.now();
    await service.getActivityMarkers({}, userId, undefined, 1, 100);
    const executionTime = Date.now() - start;
    
    expect(executionTime).toBeLessThan(200); // Target: <200ms
  });
});
```


## Migration Strategy

### Phase 1: Implement Optimized Version

1. Create `ActivityMarkerQueryBuilder` class
2. Add new method `getActivityMarkersOptimized()` to MapDataService
3. Keep existing `getActivityMarkers()` method unchanged
4. Add feature flag to switch between implementations

```typescript
async getActivityMarkers(...): Promise<PaginatedResponse<ActivityMarker>> {
  const useOptimized = process.env.USE_OPTIMIZED_MAP_QUERIES === 'true';
  
  if (useOptimized) {
    return this.getActivityMarkersOptimized(...);
  }
  
  return this.getActivityMarkersLegacy(...);
}
```

### Phase 2: Validate and Compare

1. Run integration tests against both implementations
2. Compare results for consistency
3. Measure performance improvements
4. Test with production-like data volumes

### Phase 3: Switch Over

1. Enable optimized version in staging environment
2. Monitor for issues
3. Enable in production
4. Remove legacy implementation after validation period

### Rollback Plan

If issues are discovered:
1. Set `USE_OPTIMIZED_MAP_QUERIES=false`
2. Revert to legacy implementation immediately
3. No code deployment needed (environment variable change)


## Example Query Outputs

### Example 1: Base Query (No Optional Filters)

**Request:**
```
GET /api/v1/map/activities?page=1&limit=100
```

**Generated SQL:**
```sql
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
ORDER BY a.id
LIMIT 100 OFFSET 0;
```

**Result:**
- 4 tables joined (Activity, ActivityType, ActivityVenueHistory, Venue)
- Returns 100 rows
- Includes total count via window function
- Stable ordering by activity.id

### Example 2: With Population Filter

**Request:**
```
GET /api/v1/map/activities?page=1&limit=100&populationIds=uuid1,uuid2
```

**Generated SQL:**
```sql
WITH current_venues AS (...)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
INNER JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
WHERE pp."populationId" = ANY(ARRAY['uuid1', 'uuid2']::uuid[])
GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
ORDER BY a.id
LIMIT 100 OFFSET 0;
```

**Result:**
- 7 tables joined (adds Assignment, Participant, ParticipantPopulation)
- GROUP BY deduplicates activities with multiple matching participants
- Still maintains stable ordering


### Example 3: With Geographic and Bounding Box Filters

**Request:**
```
GET /api/v1/map/activities?page=2&limit=100&geographicAreaIds=city-uuid&minLat=40&maxLat=50&minLon=-120&maxLon=-110
```

**Generated SQL:**
```sql
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL 
    AND v.longitude IS NOT NULL
    AND v."geographicAreaId" = ANY(ARRAY['city-uuid', 'neighborhood1-uuid', 'neighborhood2-uuid']::uuid[])
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
WHERE cv.latitude >= 40
  AND cv.latitude <= 50
  AND cv.longitude >= -120
  AND cv.longitude <= -110
ORDER BY a.id
LIMIT 100 OFFSET 100;
```

**Result:**
- Geographic filter applied in CTE (early filtering)
- Bounding box filter in main WHERE clause
- Page 2 (OFFSET 100) returns next 100 activities after page 1
- Stable ordering ensures no overlap with page 1


## Database Indexes

The optimization assumes these indexes exist (they should already be present):

```sql
-- Primary keys (automatic indexes)
CREATE INDEX ON "Activity" (id);
CREATE INDEX ON "ActivityType" (id);
CREATE INDEX ON "Venue" (id);

-- Foreign keys (should already exist)
CREATE INDEX ON "Activity" ("activityTypeId");
CREATE INDEX ON "ActivityType" ("activityCategoryId");
CREATE INDEX ON "ActivityVenueHistory" ("activityId");
CREATE INDEX ON "ActivityVenueHistory" ("venueId");
CREATE INDEX ON "Venue" ("geographicAreaId");
CREATE INDEX ON "Assignment" ("activityId");
CREATE INDEX ON "Assignment" ("participantId");
CREATE INDEX ON "ParticipantPopulation" ("participantId");
CREATE INDEX ON "ParticipantPopulation" ("populationId");

-- Coordinate indexes (for bounding box queries)
CREATE INDEX ON "Venue" (latitude, longitude);

-- Composite index for venue history ordering
CREATE INDEX ON "ActivityVenueHistory" ("activityId", "effectiveFrom" DESC NULLS LAST);
```

If any indexes are missing, they should be added via Prisma migration.


## Correctness Properties

### Property 1: Pagination Consistency
*For any* valid page number and limit, requesting consecutive pages should return non-overlapping, complete result sets with no duplicates or gaps.
**Validates: Requirements 1.4, 1.5, 3.7, 3.8**

### Property 2: Filter Correctness
*For any* combination of filters, the optimized query should return the same activities as the current implementation (same IDs, same order).
**Validates: Requirements 1.17, 4.1-4.8**

### Property 3: Query Variant Selection
*For any* filter combination, the system should select the query variant with the minimum number of table joins required.
**Validates: Requirements 1.6-1.11, 2.1-2.10**

### Property 4: Total Count Accuracy
*For any* query, the total count returned should match the actual number of activities that satisfy all filters.
**Validates: Requirements 1.6, 4.1**

### Property 5: Stable Ordering
*For any* two requests with the same filters but different page numbers, the results should be ordered consistently by activity ID.
**Validates: Requirements 1.4, 1.5, 3.7, 3.8**

### Property 6: Performance Improvement
*For any* dataset with 10,000+ activities, the optimized query should complete in less than 50% of the time taken by the current implementation.
**Validates: Requirements 1.22**


## Design Rationale

### Why Raw SQL Instead of Prisma ORM?

**Prisma Limitations:**
1. Cannot conditionally include joins based on runtime filters
2. Cannot apply pagination before transforming included relations
3. Cannot use DISTINCT ON or window functions efficiently
4. Generates suboptimal query plans for complex multi-table queries

**Raw SQL Benefits:**
1. Full control over query structure and join order
2. Conditional joins based on filter presence
3. Database-level pagination with LIMIT/OFFSET
4. Optimal use of PostgreSQL features (DISTINCT ON, window functions)
5. Single round trip to database

### Why Query Variants?

**Problem:** A single query that always joins all tables is inefficient when filters aren't present.

**Solution:** Multiple query variants, each optimized for specific filter combinations.

**Example:**
- Base query (no population filter): 4 table joins
- Population query: 7 table joins
- Savings: 43% fewer joins when population filter not needed

### Why DISTINCT ON for Current Venue?

**Alternatives Considered:**

1. **Subquery per activity** (N+1 pattern)
   ```sql
   SELECT (SELECT venueId FROM ActivityVenueHistory WHERE activityId = a.id ORDER BY effectiveFrom DESC LIMIT 1)
   ```
   - Problem: Executes subquery for each activity (slow)

2. **Window function with ROW_NUMBER()**
   ```sql
   ROW_NUMBER() OVER (PARTITION BY activityId ORDER BY effectiveFrom DESC)
   ```
   - Problem: More complex execution plan, slower than DISTINCT ON

3. **DISTINCT ON** (chosen approach)
   ```sql
   SELECT DISTINCT ON (activityId) ... ORDER BY activityId, effectiveFrom DESC
   ```
   - Benefit: Simplest execution plan, fastest performance
   - PostgreSQL-specific but we're already using PostgreSQL

### Why ORDER BY activity.id?

**Requirements:**
- LIMIT/OFFSET require stable, deterministic ordering
- Without ORDER BY, database returns rows in arbitrary order
- Arbitrary order causes pagination inconsistencies

**Why activity.id specifically:**
- Primary key (unique, indexed)
- Stable (never changes)
- Fast to sort (B-tree index)
- Deterministic (same query = same order)

**Alternative considered:** ORDER BY createdAt
- Problem: Multiple activities can have same createdAt
- Result: Unstable ordering within same timestamp
- Solution: Would need ORDER BY createdAt, id (less efficient)


## Implementation Details

### Query Builder Class Structure

```typescript
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
  
  private selectVariant(): QueryVariant {
    const hasPopulation = this.filters.populationIds && this.filters.populationIds.length > 0;
    const hasGeographic = this.effectiveVenueIds !== undefined;
    
    if (hasPopulation && hasGeographic) return QueryVariant.FULL;
    if (hasPopulation) return QueryVariant.POPULATION;
    if (hasGeographic) return QueryVariant.GEOGRAPHIC;
    return QueryVariant.BASE;
  }
  
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
  
  private buildBaseQuery(): string {
    return `
      WITH current_venues AS (
        ${this.buildCurrentVenuesCTE(false)}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM "Activity" a
      INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      WHERE ${this.buildWhereClause(false)}
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }
  
  private buildPopulationQuery(): string {
    return `
      WITH current_venues AS (
        ${this.buildCurrentVenuesCTE(false)}
      )
      SELECT 
        a.id,
        cv.latitude,
        cv.longitude,
        a."activityTypeId",
        at."activityCategoryId",
        COUNT(*) OVER() as total_count
      FROM "Activity" a
      INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
      INNER JOIN current_venues cv ON cv."activityId" = a.id
      INNER JOIN "Assignment" asn ON asn."activityId" = a.id
      INNER JOIN "Participant" p ON p.id = asn."participantId"
      INNER JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
      WHERE ${this.buildWhereClause(true)}
      GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
      ORDER BY a.id
      LIMIT ${this.limit} OFFSET ${this.offset}
    `;
  }
  
  private buildCurrentVenuesCTE(includeGeographicFilter: boolean): string {
    const geoFilter = includeGeographicFilter && this.effectiveVenueIds
      ? `AND v."geographicAreaId" = ANY($effectiveVenueAreaIds::uuid[])`
      : '';
    
    return `
      SELECT DISTINCT ON (avh."activityId")
        avh."activityId",
        avh."venueId",
        v.latitude,
        v.longitude
      FROM "ActivityVenueHistory" avh
      INNER JOIN "Venue" v ON v.id = avh."venueId"
      WHERE v.latitude IS NOT NULL 
        AND v.longitude IS NOT NULL
        ${geoFilter}
      ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
    `;
  }
  
  private buildWhereClause(includePopulationFilter: boolean): string {
    const conditions: string[] = ['1=1'];
    
    // Population filter
    if (includePopulationFilter && this.filters.populationIds) {
      conditions.push('pp."populationId" = ANY($populationIds::uuid[])');
    }
    
    // Activity type filter
    if (this.filters.activityTypeIds && this.filters.activityTypeIds.length > 0) {
      conditions.push('a."activityTypeId" = ANY($activityTypeIds::uuid[])');
    }
    
    // Activity category filter
    if (this.filters.activityCategoryIds && this.filters.activityCategoryIds.length > 0) {
      conditions.push('at."activityCategoryId" = ANY($activityCategoryIds::uuid[])');
    }
    
    // Status filter
    if (this.filters.status) {
      conditions.push('a.status = $status');
    }
    
    // Date range filters
    if (this.filters.startDate && this.filters.endDate) {
      conditions.push('a."startDate" <= $endDate');
      conditions.push('(a."endDate" >= $startDate OR a."endDate" IS NULL)');
    } else if (this.filters.startDate) {
      conditions.push('(a."endDate" >= $startDate OR a."endDate" IS NULL)');
    } else if (this.filters.endDate) {
      conditions.push('a."startDate" <= $endDate');
    }
    
    // Bounding box filters
    if (this.boundingBox) {
      conditions.push(...this.buildBoundingBoxConditions());
    }
    
    return conditions.join(' AND ');
  }
  
  private buildBoundingBoxConditions(): string[] {
    if (!this.boundingBox) return [];
    
    const { minLat, maxLat, minLon, maxLon } = this.boundingBox;
    const conditions: string[] = [];
    
    conditions.push('cv.latitude >= $minLat');
    conditions.push('cv.latitude <= $maxLat');
    
    // Handle international date line
    if (minLon > maxLon) {
      conditions.push('(cv.longitude >= $minLon OR cv.longitude <= $maxLon)');
    } else {
      conditions.push('cv.longitude >= $minLon');
      conditions.push('cv.longitude <= $maxLon');
    }
    
    return conditions;
  }
  
  public getVariant(): QueryVariant {
    return this.variant;
  }
}
```


## Parameter Binding Strategy

### Using Prisma.sql Template Tag

Prisma provides safe parameter binding through tagged template literals:

```typescript
import { Prisma } from '@prisma/client';

// Approach 1: Inline parameters (recommended for simple queries)
const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
  SELECT a.id, cv.latitude, cv.longitude
  FROM "Activity" a
  WHERE a."activityTypeId" = ANY(${filters.activityTypeIds || null}::uuid[])
    AND a.status = ${filters.status || null}
  ORDER BY a.id
  LIMIT ${limit} OFFSET ${offset}
`;

// Approach 2: Raw SQL with separate parameters (for complex queries)
const sql = queryBuilder.build();
const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`${Prisma.raw(sql)}`;
```

### Handling Array Parameters

PostgreSQL array syntax requires special handling:

```typescript
// Convert TypeScript array to PostgreSQL array
const activityTypeIds = filters.activityTypeIds || null;

// In SQL: Use ANY() with array cast
WHERE a."activityTypeId" = ANY(${activityTypeIds}::uuid[])

// Prisma will bind as: ANY(ARRAY['uuid1', 'uuid2']::uuid[])
```

### Handling Null Parameters

```typescript
// Use null for optional parameters
const status = filters.status || null;

// In SQL: Check for null
WHERE ($status IS NULL OR a.status = $status)

// When status is null: condition evaluates to TRUE (no filtering)
// When status is provided: condition filters by status
```

### Type Safety

```typescript
// Define result row type
interface ActivityMarkerRow {
  id: string;
  latitude: any; // Prisma returns Decimal as object
  longitude: any;
  activityTypeId: string;
  activityCategoryId: string;
  total_count: bigint; // PostgreSQL COUNT returns bigint
}

// Transform to application types
const markers: ActivityMarker[] = results.map(row => ({
  id: row.id,
  latitude: Number(row.latitude), // Convert Decimal to number
  longitude: Number(row.longitude),
  activityTypeId: row.activityTypeId,
  activityCategoryId: row.activityCategoryId,
}));

const total = results.length > 0 ? Number(results[0].total_count) : 0;
```


## Error Handling

### SQL Syntax Errors

```typescript
try {
  const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`...`;
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known Prisma errors
    console.error('Database query error:', error.message);
    throw new Error('Failed to fetch activity markers');
  }
  throw error;
}
```

### Empty Result Sets

```typescript
// Window function returns no rows when no results
const total = results.length > 0 ? Number(results[0].total_count) : 0;

// Return empty response
if (results.length === 0) {
  return {
    data: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };
}
```

### Invalid Parameters

```typescript
// Validate before building query
if (limit < 1 || limit > 100) {
  throw new Error('Limit must be between 1 and 100');
}

if (page < 1) {
  throw new Error('Page must be at least 1');
}

// Validate UUIDs
if (filters.activityTypeIds) {
  for (const id of filters.activityTypeIds) {
    if (!isValidUUID(id)) {
      throw new Error(`Invalid activity type ID: ${id}`);
    }
  }
}
```


## Performance Benchmarks

### Expected Performance Improvements

| Scenario | Current | Optimized | Improvement |
|----------|---------|-----------|-------------|
| 100k activities, no filters | 800ms | 150ms | 81% faster |
| 100k activities, population filter | 1200ms | 250ms | 79% faster |
| 100k activities, geographic filter | 600ms | 100ms | 83% faster |
| 100k activities, all filters | 1500ms | 300ms | 80% faster |

### Measurement Methodology

```typescript
// Add timing to service method
const startTime = performance.now();
const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`...`;
const queryTime = performance.now() - startTime;

console.log(`Query executed in ${queryTime.toFixed(2)}ms`);
```

### Load Testing

Test with realistic data volumes:
- 10,000 geographic areas
- 1,000,000 venues
- 10,000,000 participants
- 20,000,000 activities

Use the existing fake data generation script:
```bash
npm run generate-fake-data -- --areas=10000 --venues=1000000 --participants=10000000 --activities=20000000
```


## Backward Compatibility

### Interface Compatibility

The optimized implementation maintains the exact same TypeScript interface:

```typescript
// Method signature (unchanged)
async getActivityMarkers(
  filters: MapFilters,
  userId: string,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<ActivityMarker>>

// Response type (unchanged)
interface PaginatedResponse<ActivityMarker> {
  data: ActivityMarker[];
  pagination: PaginationMetadata;
}

// Marker type (unchanged)
interface ActivityMarker {
  id: string;
  latitude: number;
  longitude: number;
  activityTypeId: string;
  activityCategoryId: string;
}
```

### Behavioral Compatibility

The optimized implementation maintains the same behavior:

1. **Authorization filtering**: Same logic, same results
2. **Geographic filtering**: Same hierarchical filtering (area + descendants)
3. **Population filtering**: Same participant-activity association logic
4. **Temporal filtering**: Same date overlap logic
5. **Bounding box filtering**: Same coordinate filtering with date line handling
6. **Pagination**: Same page/limit behavior (but now stable)
7. **Error handling**: Same error types and messages

### Testing Compatibility

Run the same integration tests against both implementations:

```typescript
describe('MapDataService compatibility', () => {
  it('should return same results as legacy implementation', async () => {
    const legacyResults = await service.getActivityMarkersLegacy(...);
    const optimizedResults = await service.getActivityMarkersOptimized(...);
    
    // Compare IDs (order may differ without stable sort in legacy)
    const legacyIds = new Set(legacyResults.data.map(m => m.id));
    const optimizedIds = new Set(optimizedResults.data.map(m => m.id));
    
    expect(optimizedIds).toEqual(legacyIds);
    expect(optimizedResults.pagination.total).toBe(legacyResults.pagination.total);
  });
});
```


## Future Optimizations (Out of Scope)

These optimizations are not included in this spec but could be considered later:

### 1. Query Result Caching

Cache query results for common filter combinations:
```typescript
const cacheKey = `activity-markers:${JSON.stringify(filters)}:${page}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
```

### 2. Materialized Views

Create a materialized view for current venues:
```sql
CREATE MATERIALIZED VIEW current_activity_venues AS
SELECT DISTINCT ON (avh."activityId")
  avh."activityId",
  avh."venueId",
  v.latitude,
  v.longitude,
  v."geographicAreaId"
FROM "ActivityVenueHistory" avh
INNER JOIN "Venue" v ON v.id = avh."venueId"
ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST;

-- Refresh periodically
REFRESH MATERIALIZED VIEW current_activity_venues;
```

### 3. Spatial Indexes

Use PostGIS for advanced spatial queries:
```sql
CREATE EXTENSION postgis;
ALTER TABLE "Venue" ADD COLUMN location GEOGRAPHY(POINT, 4326);
UPDATE "Venue" SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);
CREATE INDEX ON "Venue" USING GIST (location);

-- Query with spatial index
WHERE ST_DWithin(location, ST_MakePoint($centerLon, $centerLat)::geography, $radiusMeters);
```

### 4. Read Replicas

Route read-only map queries to database replicas:
```typescript
const readReplica = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_REPLICA_URL } }
});
```

### 5. Connection Pooling

Optimize database connection management:
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
  },
});
```


## Summary

### Key Design Decisions

1. **Raw SQL over ORM**: Necessary for conditional joins and optimal query plans
2. **Query Variants**: Different queries for different filter combinations (avoid unnecessary joins)
3. **DISTINCT ON**: Most efficient way to get current venue per activity
4. **ORDER BY activity.id**: Ensures stable, deterministic pagination
5. **Window Functions**: Calculate total count in same query (no separate COUNT query)
6. **CTE for Current Venues**: Isolates venue identification logic, improves readability
7. **Early Filtering**: Apply geographic filter in CTE to reduce rows processed
8. **Conditional Joins**: Only join population tables when population filter is present

### Expected Outcomes

- **Performance**: 50-80% reduction in query execution time
- **Scalability**: Query time scales with result set size, not total data size
- **Reliability**: Stable pagination with no duplicates or gaps
- **Maintainability**: Modular query builder, easy to extend
- **Compatibility**: No changes to API contract or client code

### Implementation Complexity

- **Low Risk**: Optimization is isolated to one method
- **Testable**: Can compare results with legacy implementation
- **Reversible**: Feature flag allows instant rollback
- **Incremental**: Can be deployed and validated gradually

