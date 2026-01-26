# Design Document: Geographic Breakdown Query Optimization

## Overview

This design optimizes the `getGeographicBreakdown()` method in the AnalyticsService to use database-level aggregation through Common Table Expressions (CTEs), GROUP BY clauses, and push-down predicates. The current implementation:

- Executes N+1 queries (one per area to check for children)
- Fetches all activities with full relations
- Performs aggregation in Node.js memory
- Transfers large amounts of data from database to application

The optimized design will:

- Execute 1-2 database queries maximum (one for metrics, one for area metadata)
- Perform all aggregation in PostgreSQL using CTEs and GROUP BY
- Apply filters as push-down predicates in the base CTE
- Use HAVING clause to filter out zero-metric areas
- Support pagination with stable ordering
- Maintain API compatibility (except for optional pagination parameters)

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  API Request                                                 │
│  GET /api/v1/analytics/geographic-breakdown                 │
│  ?parentGeographicAreaId=<uuid>                             │
│  &page=1&pageSize=100                                       │
│  &activityTypeIds=<uuid1>,<uuid2>                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AnalyticsService.getGeographicBreakdown()                  │
│                                                              │
│  1. Validate parent area access (if specified)              │
│  2. Determine areas to return (children or top-level)       │
│  3. Batch fetch descendants for all areas                   │
│  4. Build area-to-descendants mapping                       │
│  5. Build and execute optimized SQL query                   │
│  6. Execute COUNT query in parallel                         │
│  7. Format response with pagination metadata                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Optimized SQL Query                                         │
│                                                              │
│  WITH                                                        │
│    area_descendants AS (                                    │
│      -- Map each area to its descendants                    │
│      VALUES                                                  │
│        ('area-1', ARRAY['area-1', 'child-1', 'child-2']),  │
│        ('area-2', ARRAY['area-2', 'child-3'])              │
│    ),                                                        │
│    filtered_activities AS (                                 │
│      -- Apply all filters as push-down predicates          │
│      SELECT a.id, avh."venueId", v."geographicAreaId"      │
│      FROM activities a                                      │
│      JOIN activity_venue_history avh ON a.id = avh."activityId" │
│      JOIN venues v ON avh."venueId" = v.id                 │
│      WHERE [filters]                                        │
│    ),                                                        │
│    area_metrics AS (                                        │
│      -- Aggregate metrics per area                         │
│      SELECT                                                 │
│        ad.area_id as "geographicAreaId",                   │
│        COUNT(DISTINCT fa.id) as "activityCount",           │
│        COUNT(DISTINCT asn."participantId") as "participantCount", │
│        COUNT(asn.id) as "participationCount"               │
│      FROM area_descendants ad                              │
│      LEFT JOIN filtered_activities fa                      │
│        ON fa."geographicAreaId" = ANY(ad.descendant_ids)  │
│      LEFT JOIN assignments asn ON fa.id = asn."activityId" │
│      GROUP BY ad.area_id                                   │
│      HAVING COUNT(DISTINCT fa.id) > 0                      │
│         OR COUNT(DISTINCT asn."participantId") > 0         │
│         OR COUNT(asn.id) > 0                               │
│         OR EXISTS (                                         │
│           SELECT 1 FROM geographic_areas ga                │
│           WHERE ga."parentGeographicAreaId" = ad.area_id   │
│         )                                                   │
│    )                                                        │
│  SELECT * FROM area_metrics                                │
│  ORDER BY "geographicAreaId"                               │
│  LIMIT 100 OFFSET 0                                        │
└─────────────────────────────────────────────────────────────┘
```

### Query Structure

The optimized query uses a multi-CTE structure:

```sql
WITH 
  -- CTE 1: Map each area to its descendants (including itself)
  area_descendants AS (
    VALUES
      ('area-uuid-1', ARRAY['area-uuid-1', 'child-uuid-1', 'child-uuid-2']),
      ('area-uuid-2', ARRAY['area-uuid-2', 'child-uuid-3', 'child-uuid-4']),
      ('area-uuid-3', ARRAY['area-uuid-3'])
  ),
  
  -- CTE 2: Base filtered activities with push-down predicates
  filtered_activities AS (
    SELECT 
      a.id,
      avh."venueId",
      v."geographicAreaId"
    FROM activities a
    JOIN activity_venue_history avh ON a.id = avh."activityId"
    JOIN venues v ON avh."venueId" = v.id
    WHERE
      -- Activity type filter (if specified)
      (@activityTypeIds IS NULL OR a."activityTypeId" = ANY(@activityTypeIds))
      -- Activity category filter (if specified)
      AND (@activityCategoryIds IS NULL OR a."activityTypeId" IN (
        SELECT id FROM activity_types WHERE "activityCategoryId" = ANY(@activityCategoryIds)
      ))
      -- Venue filter (if specified)
      AND (@venueIds IS NULL OR avh."venueId" = ANY(@venueIds))
      -- Date range filter (if specified)
      AND (@startDate IS NULL OR DATE(a."startDate") <= DATE(@endDate))
      AND (@endDate IS NULL OR a."endDate" IS NULL OR DATE(a."endDate") >= DATE(@startDate))
      -- Population filter (if specified)
      AND (@populationIds IS NULL OR EXISTS (
        SELECT 1 FROM assignments asn
        JOIN participant_populations pp ON asn."participantId" = pp."participantId"
        WHERE asn."activityId" = a.id
          AND pp."populationId" = ANY(@populationIds)
      ))
  ),
  
  -- CTE 3: Aggregate metrics per area
  area_metrics AS (
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
      OR EXISTS (
        SELECT 1 FROM geographic_areas ga 
        WHERE ga."parentGeographicAreaId" = ad.area_id
      )
  )

SELECT * FROM area_metrics
ORDER BY "geographicAreaId"
LIMIT @pageSize OFFSET @offset;
```

### COUNT Query Structure

```sql
SELECT COUNT(*) as total FROM (
  WITH 
    area_descendants AS (...),
    filtered_activities AS (...),
    area_metrics AS (...)
  SELECT * FROM area_metrics
) AS count_query;
```

## Components and Interfaces

### 1. Geographic Breakdown Query Builder

**Responsibility**: Construct optimized SQL query for geographic breakdown

**Interface**:
```typescript
interface GeographicBreakdownQueryBuilder {
  buildGeographicBreakdownQuery(
    areaIds: string[],
    areaToDescendantsMap: Map<string, string[]>,
    filters: AnalyticsFilters,
    pagination?: PaginationParams
  ): QueryResult;
  
  buildCountQuery(
    areaIds: string[],
    areaToDescendantsMap: Map<string, string[]>,
    filters: AnalyticsFilters
  ): QueryResult;
}
```

**Key Methods**:
- `buildAreaDescendantsCTE()`: Creates VALUES clause mapping areas to descendants
- `buildFilteredActivitiesCTE()`: Creates base activity filter with push-down predicates
- `buildAreaMetricsCTE()`: Aggregates metrics per area with HAVING clause
- `buildPaginationClause()`: Generates LIMIT/OFFSET clause
- `buildCountQuery()`: Wraps main query in COUNT subquery

### 2. Response Format

**Existing Format** (maintained for compatibility):
```typescript
interface GeographicBreakdown {
  geographicAreaId: string;
  geographicAreaName: string;
  areaType: string;
  activityCount: number;
  participantCount: number;
  participationCount: number;
  hasChildren: boolean;
}
```

**Response Wrapper** (new):
```typescript
interface GeographicBreakdownResponse {
  data: GeographicBreakdown[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

## Implementation Strategy

### Phase 1: Query Builder

1. Create `buildAreaDescendantsCTE()` method
   - Accept area IDs and area-to-descendants mapping
   - Generate SQL VALUES clause with area ID and descendant array
   - Return CTE string

2. Create `buildFilteredActivitiesCTE()` method
   - Apply all filters as WHERE conditions
   - Use parameterized queries for safety
   - Include only necessary joins
   - Return CTE string

3. Create `buildAreaMetricsCTE()` method
   - Join area_descendants with filtered_activities
   - Use LEFT JOIN to include areas with zero activities
   - Aggregate using COUNT and COUNT DISTINCT
   - Add HAVING clause to filter zero-metric areas (except those with children)
   - Return CTE string

4. Create `buildGeographicBreakdownQuery()` method
   - Combine all CTEs
   - Add ORDER BY for stable ordering
   - Add LIMIT/OFFSET for pagination
   - Return QueryResult with SQL and parameters

5. Create `buildCountQuery()` method
   - Build main query without LIMIT/OFFSET
   - Wrap in COUNT subquery
   - Return QueryResult

### Phase 2: Service Integration

1. Update `getGeographicBreakdown()` method
   - Determine areas to return (children or top-level)
   - Batch fetch descendants for all areas
   - Build area-to-descendants mapping
   - Call query builder to generate SQL
   - Execute main query and COUNT query in parallel
   - Fetch area metadata (name, type) in separate query
   - Merge query results with area metadata
   - Calculate pagination metadata
   - Return response with pagination

### Phase 3: API Route Updates

1. Update route handler
   - Add pagination parameter extraction
   - Add pagination parameter validation
   - Pass pagination params to service
   - Return response with pagination metadata

## Correctness Properties

### Property 1: Single Query for All Areas

*For any* set of geographic areas, the system should execute at most two database queries: one for aggregated metrics and one for area metadata.

**Validates: Requirements 1.1-1.4**

### Property 2: Database-Level Aggregation

*For any* query result, the number of rows returned should equal the number of geographic areas (after filtering), not proportional to the number of activities or participants.

**Validates: Requirements 2.1-2.4**

### Property 3: Descendant Inclusion

*For any* geographic area in the result set, the metrics should include activities from the area itself AND all its descendant areas.

**Validates: Requirements 3.1-3.4**

### Property 4: Authorization Enforcement

*For any* user with geographic restrictions, the system should only return metrics for areas the user is authorized to access, and metrics should only include activities from authorized descendant areas.

**Validates: Requirements 4.1-4.5**

### Property 5: Zero-Row Filtering with Children Preservation

*For any* geographic area with zero metrics, the area should be filtered out UNLESS it has child areas, in which case it should be included with zero metrics.

**Validates: Requirements 7.1-7.4**

### Property 6: Pagination Correctness

*For any* paginated query, the system should return exactly pageSize records (or fewer on the last page), with stable ordering ensuring no duplicate or missing records across pages.

**Validates: Requirements 8.1-8.8**

### Property 7: Count Query Accuracy

*For any* query with pagination, the COUNT query should return the exact number of areas that match the filters and HAVING clause, matching the total number of records across all pages.

**Validates: Requirements 9.1-9.4**

### Property 8: Backward Compatibility

*For any* existing API consumer that doesn't provide pagination parameters, the system should return all results in the same format as before, with pagination metadata indicating a single page.

**Validates: Requirements 11.1-11.5**

## Data Flow

### Current Implementation (Inefficient)

```
1. Query areas to return (children or top-level)
2. For each area:
   a. Query descendants
   b. Query venues in area + descendants
   c. Query activities in those venues
   d. Aggregate in Node.js memory
   e. Query to check if area has children
3. Return array of GeographicBreakdown objects
```

**Problems:**
- N+1 queries for checking children
- Multiple queries for descendants
- Full activity objects transferred
- Memory-intensive aggregation

### Optimized Implementation

```
1. Query areas to return (children or top-level)
2. Batch fetch descendants for ALL areas (single query)
3. Build area-to-descendants mapping in memory
4. Execute optimized SQL query:
   - CTE 1: Map areas to descendants
   - CTE 2: Filter activities with push-down predicates
   - CTE 3: Aggregate metrics per area with HAVING clause
   - Main query: Order and paginate
5. Execute COUNT query in parallel
6. Fetch area metadata (name, type, hasChildren) in single query
7. Merge results and return with pagination metadata
```

**Benefits:**
- Maximum 3 queries total (metrics + count + metadata)
- All aggregation in PostgreSQL
- Minimal data transfer
- Efficient memory usage

## SQL Query Examples

### Example 1: Top-Level Areas with Pagination

**Request:**
```
GET /api/v1/analytics/geographic-breakdown?page=1&pageSize=10
```

**Generated SQL:**
```sql
WITH 
  area_descendants(area_id, descendant_ids) AS (
    VALUES
      ('country-1', ARRAY['country-1', 'province-1', 'province-2', 'city-1', 'city-2']),
      ('country-2', ARRAY['country-2', 'province-3', 'city-3'])
  ),
  filtered_activities AS (
    SELECT 
      a.id,
      v."geographicAreaId"
    FROM activities a
    JOIN activity_venue_history avh ON a.id = avh."activityId"
    JOIN venues v ON avh."venueId" = v.id
  ),
  area_metrics AS (
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
      OR EXISTS (
        SELECT 1 FROM geographic_areas ga 
        WHERE ga."parentGeographicAreaId" = ad.area_id
      )
  )
SELECT * FROM area_metrics
ORDER BY "geographicAreaId"
LIMIT 10 OFFSET 0;
```

### Example 2: Child Areas with Filters

**Request:**
```
GET /api/v1/analytics/geographic-breakdown
  ?parentGeographicAreaId=country-1
  &activityTypeIds=type-1,type-2
  &startDate=2024-01-01T00:00:00Z
  &endDate=2024-12-31T23:59:59Z
  &page=1&pageSize=20
```

**Generated SQL:**
```sql
WITH 
  area_descendants(area_id, descendant_ids) AS (
    VALUES
      ('province-1', ARRAY['province-1', 'city-1', 'city-2']),
      ('province-2', ARRAY['province-2', 'city-3'])
  ),
  filtered_activities AS (
    SELECT 
      a.id,
      v."geographicAreaId"
    FROM activities a
    JOIN activity_venue_history avh ON a.id = avh."activityId"
    JOIN venues v ON avh."venueId" = v.id
    WHERE
      a."activityTypeId" = ANY(ARRAY['type-1', 'type-2'])
      AND DATE(a."startDate") <= DATE('2024-12-31')
      AND (a."endDate" IS NULL OR DATE(a."endDate") >= DATE('2024-01-01'))
  ),
  area_metrics AS (
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
      OR EXISTS (
        SELECT 1 FROM geographic_areas ga 
        WHERE ga."parentGeographicAreaId" = ad.area_id
      )
  )
SELECT * FROM area_metrics
ORDER BY "geographicAreaId"
LIMIT 20 OFFSET 0;
```

## Error Handling

### Query Construction Errors

**Invalid Parent Area**:
- Validate parent area exists before querying children
- Return 404 if parent area not found
- Return 403 if user doesn't have access to parent area

**Authorization Errors**:
- Validate user has access to parent area (if specified)
- Filter areas to only those user is authorized to access
- Return 403 for unauthorized access attempts

**SQL Syntax Errors**:
- Wrap Prisma.$queryRaw in try-catch
- Log full SQL query and parameters on error
- Return 500 Internal Server Error with sanitized message

### Query Execution Errors

**Database Connection Errors**:
- Retry transient connection failures (max 3 attempts)
- Return 503 Service Unavailable for persistent failures
- Log connection errors for monitoring

**Query Timeout Errors**:
- Set reasonable timeout (30 seconds)
- Return 504 Gateway Timeout if exceeded
- Log slow queries for optimization

## Testing Strategy

### Unit Tests

1. **Query Builder Tests**:
   - Test area descendants CTE generation
   - Test filtered activities CTE with various filters
   - Test area metrics CTE with HAVING clause
   - Test pagination clause generation
   - Test COUNT query generation

2. **Service Tests**:
   - Test with no parent (top-level areas)
   - Test with parent (child areas)
   - Test with various filters
   - Test with pagination
   - Test authorization filtering
   - Test zero-row filtering

### Integration Tests

1. **Database Integration**:
   - Test against real PostgreSQL with test data
   - Verify query results match expected aggregations
   - Test with various data volumes
   - Test HAVING clause filters correctly
   - Test pagination returns correct pages

2. **API Integration**:
   - Test full request/response cycle
   - Test with various filter combinations
   - Test pagination parameters
   - Test backward compatibility (no pagination)

### Performance Tests

1. **Query Performance**:
   - Measure execution time for 10K, 100K activities
   - Target: < 500ms for 10K activities
   - Compare against current implementation

2. **Memory Usage**:
   - Measure Node.js memory during query execution
   - Target: < 100MB for 10K activities
   - Verify no memory leaks

## Migration Path

### Phase 1: Implementation
1. Create query builder methods
2. Update getGeographicBreakdown() method
3. Add pagination support
4. Add tests

### Phase 2: Validation
1. Test with production data
2. Verify performance improvements
3. Verify backward compatibility

### Phase 3: Deployment
1. Deploy to staging
2. Monitor performance metrics
3. Deploy to production

## Backward Compatibility

**No Breaking Changes:**
- ✅ Response structure unchanged (GeographicBreakdown[])
- ✅ Pagination parameters are optional
- ✅ When no pagination provided, returns all results
- ✅ Pagination metadata added to response (new field)
- ✅ All existing API consumers work without changes

## Performance Expectations

### Query Execution
- Current: 500-2000ms for 50 areas with 10K activities
- Optimized: < 500ms for 50 areas with 10K activities
- Improvement: 60-75% faster

### Memory Usage
- Current: 200-500MB for 10K activities
- Optimized: < 50MB for 10K activities
- Improvement: 80-90% reduction

### Payload Size
- Current: 5-20KB (depends on number of areas)
- With pagination: 1-5KB per page
- Improvement: 50-75% reduction with pagination
