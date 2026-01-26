# Design Document: Analytics Service Optimization

## Overview

This design optimizes the AnalyticsService to use database-level aggregation through Common Table Expressions (CTEs) and SQL window functions via Prisma's raw query interface. The current implementation fetches all activities with full relations and performs aggregation in Node.js memory, resulting in:

- Multiple database round-trips for different breakdowns
- Large data transfer (full activity objects with nested relations)
- Memory-intensive operations in Node.js
- Slow response times for large datasets

The optimized design will:

- Execute 1-2 database queries maximum (one for metrics, one optional for dimension lookups)
- Perform all aggregation in PostgreSQL using CTEs and GROUPING SETS
- Return only aggregated counts and dimension indexes
- Support multi-dimensional grouping with total aggregation row
- Minimize wire format payload through indexed lookups

## Architecture

### High-Level Flow

```
┌─────────────────┐
│  API Request    │
│  with filters   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  AnalyticsService                   │
│  ┌───────────────────────────────┐  │
│  │ 1. Build CTE Query            │  │
│  │    - Base activity filter     │  │
│  │    - Date overlap logic       │  │
│  │    - Smart join optimization  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ 2. Execute via Prisma.$raw    │  │
│  │    - Single query with CTEs   │  │
│  │    - Window functions         │  │
│  │    - GROUP BY GROUPING SETS   │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ 3. Fetch Dimension Lookups    │  │
│  │    - Lightweight query        │  │
│  │    - Only IDs and names       │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ 4. Format Wire Response       │  │
│  │    - Convert IDs to indexes   │  │
│  │    - Build lookup arrays      │  │
│  │    - Construct metadata       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  JSON Response  │
│  - data: [][]   │
│  - lookups: {}  │
│  - metadata: {} │
└─────────────────┘
```

### Query Structure

The optimized query uses a multi-CTE structure:

```sql
WITH 
  -- CTE 1: Base filtered activities
  filtered_activities AS (
    SELECT a.id, a.startDate, a.endDate, a.activityTypeId, 
           at.activityCategoryId, v.geographicAreaId
    FROM Activity a
    JOIN ActivityType at ON a.activityTypeId = at.id
    LEFT JOIN ActivityVenueHistory avh ON a.id = avh.activityId
    LEFT JOIN Venue v ON avh.venueId = v.id
    WHERE [filters]
  ),
  
  -- CTE 2: Date snapshot calculations
  snapshot_metrics AS (
    SELECT 
      activityTypeId,
      activityCategoryId,
      geographicAreaId,
      -- Start date metrics
      COUNT(*) FILTER (WHERE startDate <= @startDate AND (endDate IS NULL OR endDate >= @startDate)) as activitiesAtStart,
      COUNT(DISTINCT participantId) FILTER (WHERE ...) as participantsAtStart,
      COUNT(assignmentId) FILTER (WHERE ...) as participationAtStart,
      -- End date metrics
      COUNT(*) FILTER (WHERE startDate <= @endDate AND (endDate IS NULL OR endDate >= @endDate)) as activitiesAtEnd,
      COUNT(DISTINCT participantId) FILTER (WHERE ...) as participantsAtEnd,
      COUNT(assignmentId) FILTER (WHERE ...) as participationAtEnd,
      -- Lifecycle events
      COUNT(*) FILTER (WHERE startDate BETWEEN @startDate AND @endDate) as activitiesStarted,
      COUNT(*) FILTER (WHERE endDate BETWEEN @startDate AND @endDate) as activitiesCompleted
    FROM filtered_activities fa
    LEFT JOIN Assignment asn ON fa.id = asn.activityId
    GROUP BY GROUPING SETS (
      (activityTypeId, activityCategoryId, geographicAreaId),  -- Full detail
      ()                                                        -- Total only
    )
  )
  
SELECT * FROM snapshot_metrics
ORDER BY activityTypeId NULLS FIRST, activityCategoryId NULLS FIRST, geographicAreaId NULLS FIRST;
```

## Components and Interfaces

### 1. Query Builder Component

**Responsibility**: Construct dynamic SQL queries based on filters and grouping dimensions

**Interface**:
```typescript
interface QueryBuilder {
  buildEngagementQuery(
    filters: AnalyticsFilters,
    groupBy: GroupingDimension[]
  ): {
    sql: string;
    parameters: Record<string, any>;
  };
}
```

**Key Methods**:
- `buildBaseActivityCTE()`: Creates filtered_activities CTE with smart joins
- `buildDateOverlapConditions()`: Generates date overlap SQL for snapshots
- `buildGroupingSets()`: Generates GROUPING SETS clause with full-grain grouping and total aggregation only
- `buildFilterConditions()`: Converts filters to WHERE clauses
- `determineRequiredJoins()`: Analyzes filters/grouping to minimize joins

### 2. Query Executor Component

**Responsibility**: Execute raw SQL queries via Prisma and handle result mapping

**Interface**:
```typescript
interface QueryExecutor {
  executeEngagementQuery(
    sql: string,
    parameters: Record<string, any>
  ): Promise<RawQueryResult[]>;
  
  fetchDimensionLookups(
    dimensionIds: {
      activityTypeIds?: string[];
      activityCategoryIds?: string[];
      geographicAreaIds?: string[];
    }
  ): Promise<DimensionLookups>;
}
```

**Key Methods**:
- `executeRawQuery()`: Wraps Prisma.$queryRaw with error handling
- `fetchActivityTypes()`: Lightweight query for type ID/name pairs
- `fetchActivityCategories()`: Lightweight query for category ID/name pairs
- `fetchGeographicAreas()`: Lightweight query for area ID/name pairs

### 3. Wire Format Transformer Component

**Responsibility**: Convert database results to optimized wire format with indexed lookups

**Interface**:
```typescript
interface WireFormatTransformer {
  transformToWireFormat(
    queryResults: RawQueryResult[],
    lookups: DimensionLookups,
    groupBy: GroupingDimension[]
  ): EngagementWireFormat;
}
```

**Key Methods**:
- `buildLookupArrays()`: Creates ordered arrays of dimension entities
- `convertIdsToIndexes()`: Maps dimension IDs to array indexes
- `buildMetadata()`: Constructs column header metadata
- `formatDataRows()`: Converts query results to list-of-lists format

### 4. Optimized Analytics Service

**Responsibility**: Orchestrate query building, execution, and response formatting

**Interface**:
```typescript
class OptimizedAnalyticsService {
  async getEngagementMetrics(
    filters: AnalyticsFilters,
    authorizedAreaIds: string[],
    hasGeographicRestrictions: boolean
  ): Promise<EngagementWireFormat>;
}
```

## Data Models

### Input Models

```typescript
interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  activityCategoryIds?: string[];
  activityTypeIds?: string[];
  geographicAreaIds?: string[];
  venueIds?: string[];
  populationIds?: string[];
  groupBy?: GroupingDimension[];
}

enum GroupingDimension {
  ACTIVITY_TYPE = 'activityType',
  ACTIVITY_CATEGORY = 'activityCategory',
  GEOGRAPHIC_AREA = 'geographicArea'
}
```

### Output Models

```typescript
interface EngagementWireFormat {
  // Main data table as list of lists
  data: Array<Array<number>>;
  
  // Lookup arrays for dimensions
  lookups: {
    activityTypes?: Array<{ id: string; name: string }>;
    activityCategories?: Array<{ id: string; name: string }>;
    geographicAreas?: Array<{ id: string; name: string }>;
  };
  
  // Column metadata
  metadata: {
    columns: string[];  // Ordered column names
    groupingDimensions: string[];  // Which dimensions are grouped
    hasDateRange: boolean;  // Whether date range metrics are included
  };
}

// Example response structure (no date range):
{
  data: [
    [-1, -1, 15, 35, 120],  // Total aggregation (FIRST due to NULLS FIRST)
    [0, 1, 5, 12, 45],      // Type index 0, Category index 1, 5 activities, 12 participants, 45 participation
    [0, 2, 3, 8, 23],       // Type index 0, Category index 2, 3 activities, 8 participants, 23 participation
    [1, 1, 7, 15, 52]       // Type index 1, Category index 1, 7 activities, 15 participants, 52 participation
  ],
  lookups: {
    activityTypes: [
      { id: "type-uuid-1", name: "Workshop" },
      { id: "type-uuid-2", name: "Training" }
    ],
    activityCategories: [
      { id: "cat-uuid-1", name: "Education" },
      { id: "cat-uuid-2", name: "Recreation" }
    ]
  },
  metadata: {
    columns: ["activityTypeIndex", "activityCategoryIndex", "activeActivities", "uniqueParticipants", "totalParticipation"],
    groupingDimensions: ["activityType", "activityCategory"],
    hasDateRange: false
  }
}

// Example response structure (with date range):
{
  data: [
    [0, 1, 5, 12, 45, 8, 18, 67, 3, 2],  // Full metrics with lifecycle events
    // Columns: typeIdx, catIdx, activitiesAtStart, participantsAtStart, participationAtStart,
    //          activitiesAtEnd, participantsAtEnd, participationAtEnd, started, completed
  ],
  lookups: { /* same as above */ },
  metadata: {
    columns: [
      "activityTypeIndex", "activityCategoryIndex",
      "activitiesAtStart", "participantsAtStart", "participationAtStart",
      "activitiesAtEnd", "participantsAtEnd", "participationAtEnd",
      "activitiesStarted", "activitiesCompleted"
    ],
    groupingDimensions: ["activityType", "activityCategory"],
    hasDateRange: true
  }
}
```

### Internal Models

```typescript
interface RawQueryResult {
  activityTypeId: string | null;
  activityCategoryId: string | null;
  geographicAreaId: string | null;
  activitiesAtStart?: number;
  participantsAtStart?: number;
  participationAtStart?: number;
  activitiesAtEnd?: number;
  participantsAtEnd?: number;
  participationAtEnd?: number;
  activitiesStarted?: number;
  activitiesCompleted?: number;
  activeActivities?: number;  // When no date range
  uniqueParticipants?: number;  // When no date range
  totalParticipation?: number;  // When no date range
}

interface DimensionLookups {
  activityTypes: Map<string, string>;  // id -> name
  activityCategories: Map<string, string>;
  geographicAreas: Map<string, string>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Maximum Two Database Queries

*For any* combination of filters, grouping dimensions, and date ranges, the system should execute at most two database queries: one for aggregated metrics and one optional query for dimension lookups.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Database-Level Aggregation

*For any* query result, the number of rows returned should be proportional to the number of unique dimension combinations (bounded by grouping dimensions), not proportional to the number of activities or participants in the database.

**Validates: Requirements 2.2**

### Property 3: SQL Aggregation Functions

*For any* generated SQL query, the query should contain COUNT and COUNT DISTINCT aggregate functions and should not SELECT individual activity or participant records.

**Validates: Requirements 2.1**

### Property 4: GROUPING SETS for Total Aggregation

*For any* query with grouping dimensions, the generated SQL should use GROUPING SETS to calculate both the full-grain grouping and the total aggregation (with all dimensions NULL) in a single query execution, without intermediate subset groupings.

**Validates: Requirements 2.3, 11.10, 12.1, 12.4**

### Property 5: Query Result Contains Only Aggregates

*For any* query result row, the row should contain only numeric counts and dimension identifiers (or nulls for aggregated dimensions), with no activity names, statuses, descriptions, or other non-aggregated fields.

**Validates: Requirements 3.1, 3.2**

### Property 6: Separate Lightweight Lookup Query

*For any* query with grouping dimensions, if dimension lookups are needed, a second query should fetch only id and name pairs for the relevant dimensions, with result size proportional to the number of unique dimension values, not the number of activities.

**Validates: Requirements 3.3**

### Property 7: Date Range Snapshot Completeness

*For any* query with a date range specified, the response should contain metrics for both the start date and end date, with each snapshot including counts of active activities, unique participants, and total participation.

**Validates: Requirements 4.1, 4.2**

### Property 8: Current Date Default Behavior

*For any* query without a date range specified, the response should contain metrics for the current date only, including ongoing activities (null endDate) and finite activities where startDate ≤ today and (endDate is null or endDate ≥ today).

**Validates: Requirements 4.3, 5.1, 5.2, 5.3**

### Property 9: Lifecycle Event Counting

*For any* query with a date range, the response should include counts of activities where startDate falls within the range (started) and activities where endDate falls within the range (completed), and for queries without a date range, lifecycle event counts should be absent.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 10: Date Overlap Logic Correctness

*For any* activity and query date, the activity should be considered active if and only if: startDate ≤ queryDate AND (endDate is null OR endDate ≥ queryDate), with null endDate values treated as ongoing activities.

**Validates: Requirements 7.1, 7.3**

### Property 11: Daily Granularity Enforcement

*For any* query with date parameters, all date values (both input parameters and database date fields) should be truncated to daily precision (removing time components) before comparison, using SQL DATE type or equivalent.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 12: Multi-Dimensional Filter Support

*For any* combination of filters (activity types, categories, venues, geographic areas, populations), the system should support all filter types and apply them with AND logic, returning only results that match all specified filters.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

### Property 13: Smart Join Optimization

*For any* query, the generated SQL should include joins only for tables that are required by active filters or grouping dimensions: venue table only if venue filter or grouping is present, geographic area table only if area filter or grouping is present, population table only if population filter is present.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 14: Multi-Dimensional Grouping Support

*For any* combination of grouping dimensions (including no grouping, single dimension, two dimensions, three dimensions, or four dimensions), the system should return separate rows for each unique combination of dimension values present in the data, plus one total aggregation row with all dimensions NULL.

**Validates: Requirements 11.9, 11.10**

### Property 15: No Partial Subset Groupings

*For any* query with multiple grouping dimensions, the response should include ONLY the full-grain grouping rows (all dimensions specified) and the total aggregation row (all dimensions NULL), with NO intermediate subset groupings (e.g., if grouping by type+area, do NOT include type-only or area-only rows).

**Validates: Requirements 11.11, 12.1, 12.2, 12.3**

### Property 16: Wire Format Structure

*For any* response, the data field should be a list of lists where each inner list represents one row, with dimension indexes in the first columns followed by metric values, and all dimension indexes should be 0-based integers referencing the lookup arrays (or -1 for aggregated dimensions).

**Validates: Requirements 13.1, 13.3, 13.4, 13.5**

### Property 17: Lookup Array Structure

*For any* response with grouping dimensions, each dimension should have an ordered lookup array containing objects with id and name properties, with entity identifiers appearing only once in the lookup arrays and not repeated in data rows.

**Validates: Requirements 13.2, 13.7**

### Property 18: Metadata Completeness

*For any* response, the metadata object should contain a columns array with column header names in the same order as the data columns, a groupingDimensions array listing the grouped dimensions, and a hasDateRange boolean indicating whether date range metrics are included.

**Validates: Requirements 13.6**

### Property 19: Column Count Correctness

*For any* response, when no date range is specified, the data should have N + 3 columns (N dimension indexes + 3 metrics: activeActivities, uniqueParticipants, totalParticipation), and when a date range is specified, the data should have N + 8 columns (N dimension indexes + 8 metrics: 3 start snapshot + 3 end snapshot + 2 lifecycle events).

**Validates: Requirements 13.8, 13.9**

### Property 20: Frontend Wire Format Parsing

*For any* valid wire format response, the EngagementDashboard should successfully parse the response to extract engagement metrics, resolve dimension indexes to human-readable names using the lookup tables, and display the data without errors.

**Validates: Requirements 14.2, 14.3**

### Property 21: Venue Lookup Inclusion

*For any* query with venue included in the groupBy parameter, the response lookups object should contain a venues array with objects containing id and name properties for all unique venues in the query results, and when venue is not in groupBy, the venues array should be omitted from the lookups object.

**Validates: Requirements 13.10, 13.11, 13.12**

### Property 22: Zero-Row Filtering

*For any* query result, rows where all metric columns equal zero should be filtered out at the database level using a HAVING clause, except for the total aggregation row (where all dimension IDs are NULL) which should always be preserved regardless of metric values.

**Validates: Enhancement Requirements 15.1, 15.2, 15.3, 15.5**

### Property 23: HAVING Clause Placement

*For any* generated SQL query with grouping dimensions, the HAVING clause should appear after the GROUP BY clause and before the ORDER BY clause, ensuring proper SQL syntax and execution order.

**Validates: Enhancement Requirements 15.4**

### Property 24: Stable Ordering for Pagination

*For any* query with pagination parameters, the results should be ordered by the grouping dimension columns in the same order they appear in the GROUP BY clause, with NULLS FIRST for each dimension to ensure the total aggregation row appears at the beginning, ensuring consistent ordering across pagination requests.

**Validates: Enhancement Requirements 16.1, 16.2, 16.3**

### Property 25: Pagination Parameter Validation

*For any* API request with pagination parameters, the system should validate that page is a positive integer and pageSize is between 1 and 1000, returning a 400 validation error for invalid values.

**Validates: Enhancement Requirements 17.3, 17.4, 17.5**

### Property 26: SQL Pagination Implementation

*For any* query with pagination parameters, the generated SQL should include LIMIT clause set to pageSize and OFFSET clause calculated as (page - 1) * pageSize, applied after the ORDER BY clause.

**Validates: Enhancement Requirements 18.1, 18.2, 18.3**

### Property 27: Parallel COUNT Query Execution

*For any* paginated query, the system should execute both the main query (with LIMIT/OFFSET) and a COUNT query (without LIMIT/OFFSET) in parallel, with the COUNT query applying the same filters and HAVING clause as the main query.

**Validates: Enhancement Requirements 19.1, 19.2, 19.3, 19.4**

### Property 28: Pagination Metadata Completeness

*For any* response with pagination, the metadata should include a pagination object containing page, pageSize, totalRecords, totalPages, hasNextPage, and hasPreviousPage, with totalPages calculated as Math.ceil(totalRecords / pageSize).

**Validates: Enhancement Requirements 20.1, 20.2**

### Property 29: Pagination Backward Compatibility

*For any* query without pagination parameters, the system should return all results with pagination metadata indicating page=1, pageSize=totalRecords, totalPages=1, maintaining backward compatibility with existing API consumers.

**Validates: Enhancement Requirements 20.3, 24.1, 24.2, 24.3, 24.4**

### Property 30: Frontend Pagination State Management

*For any* user interaction with pagination controls (page change, page size change), the EngagementDashboard should update the URL query parameters, trigger a new API request with the updated pagination parameters, and display a loading indicator during the fetch.

**Validates: Enhancement Requirements 21.5, 22.3, 22.4, 23.1, 23.2**

### Property 31: Pagination Reset on Filter Change

*For any* change to filters or grouping dimensions, the EngagementDashboard should reset the current page to 1 and update the URL accordingly, ensuring users see the first page of the new result set.

**Validates: Enhancement Requirements 22.5, 23.4**

## Error Handling

### Query Construction Errors

**Invalid Filter Combinations**:
- Validate filter arrays are not empty when provided
- Validate date ranges (startDate ≤ endDate)
- Validate dimension IDs exist before building query
- Return clear error messages for invalid inputs

**Authorization Errors**:
- Validate user has access to requested geographic areas
- Apply geographic restrictions to filter effective area IDs
- Return 403 Forbidden for unauthorized area access

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
- Set reasonable timeout (e.g., 30 seconds)
- Return 504 Gateway Timeout if exceeded
- Log slow queries for optimization

**Data Type Errors**:
- Validate query result types match expected schema
- Handle null values gracefully
- Return 500 Internal Server Error for unexpected types

### Wire Format Transformation Errors

**Missing Dimension Data**:
- Handle cases where dimension IDs in results don't have lookup entries
- Use placeholder names (e.g., "Unknown Type") for missing lookups
- Log warnings for missing dimension data

**Index Conversion Errors**:
- Validate all dimension IDs can be mapped to indexes
- Handle -1 for aggregated dimensions correctly
- Return 500 Internal Server Error if mapping fails

**Metadata Construction Errors**:
- Validate column count matches data row length
- Ensure grouping dimensions match actual grouped columns
- Return 500 Internal Server Error for mismatches

## Enhancement: Pagination and Zero-Row Filtering

### Overview

This enhancement adds two key optimizations to improve API performance and reduce payload size:

1. **Database-level zero-row filtering**: Filter out aggregation rows with all-zero metrics using SQL HAVING clause
2. **Pagination support**: Add pagination with stable ordering, lazy loading, and total count tracking

### Zero-Row Filtering Design

**HAVING Clause Implementation**:

The HAVING clause filters out rows where all metric columns equal zero, while preserving the total aggregation row.

**For queries without date range**:
```sql
HAVING 
  "activeActivities" > 0 
  OR "uniqueParticipants" > 0 
  OR "totalParticipation" > 0
  OR (
    "activityTypeId" IS NULL 
    AND "activityCategoryId" IS NULL 
    AND "geographicAreaId" IS NULL 
    AND "venueId" IS NULL
  )
```

**For queries with date range**:
```sql
HAVING 
  "activitiesAtStart" > 0 
  OR "activitiesAtEnd" > 0 
  OR "activitiesStarted" > 0 
  OR "activitiesCompleted" > 0
  OR "participantsAtStart" > 0 
  OR "participantsAtEnd" > 0 
  OR "participationAtStart" > 0 
  OR "participationAtEnd" > 0
  OR (
    "activityTypeId" IS NULL 
    AND "activityCategoryId" IS NULL 
    AND "geographicAreaId" IS NULL 
    AND "venueId" IS NULL
  )
```

**Query Structure with HAVING**:
```sql
WITH filtered_activities AS (...),
     snapshot_metrics AS (...)
SELECT * FROM snapshot_metrics
HAVING [zero-row filter conditions]
ORDER BY [grouping dimensions]
LIMIT [pageSize] OFFSET [offset]
```

### Pagination Design

**Pagination Parameters**:
- `page`: 1-based page number (default: 1)
- `pageSize`: Records per page (default: 100, max: 1000)

**SQL Implementation**:
```sql
-- Main query with pagination
SELECT * FROM snapshot_metrics
HAVING [conditions]
ORDER BY [dimensions]
LIMIT @pageSize OFFSET @offset

-- Count query (executed in parallel)
SELECT COUNT(*) as total FROM (
  SELECT * FROM snapshot_metrics
  HAVING [conditions]
) AS count_query
```

**Offset Calculation**:
```typescript
const offset = (page - 1) * pageSize;
```

**Stable Ordering**:
- Order by grouping dimension columns in the same order as GROUP BY
- Use `NULLS FIRST` to ensure total aggregation row appears at the beginning (first page)
- Consistent ordering prevents duplicate/missing rows across pages

### Pagination Metadata

**Wire Format Extension**:
```typescript
interface EngagementWireFormat {
  data: Array<Array<number>>;
  lookups: { /* ... */ };
  metadata: {
    columns: string[];
    groupingDimensions: string[];
    hasDateRange: boolean;
    pagination: {
      page: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
```

**Metadata Calculation**:
```typescript
const totalPages = Math.ceil(totalRecords / pageSize);
const hasNextPage = page < totalPages;
const hasPreviousPage = page > 1;
```

### Frontend Pagination Integration

**Component Structure**:
```typescript
// State management
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(100);

// Query with pagination
const { data: wireFormat } = useQuery({
  queryKey: ['engagement', filters, currentPage, pageSize],
  queryFn: () => AnalyticsService.getEngagementMetricsOptimized({
    ...filters,
    page: currentPage,
    pageSize: pageSize
  })
});

// Pagination controls
<Pagination
  currentPageIndex={currentPage}
  pagesCount={wireFormat?.metadata.pagination.totalPages || 1}
  onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
/>
```

**URL State Management**:
- Include `page` and `pageSize` in URL query parameters
- Update URL when pagination changes
- Restore pagination state from URL on mount
- Reset to page 1 when filters or grouping change

**Lazy Loading**:
- Fetch only the current page of data
- Display loading indicator during page transitions
- Preserve scroll position when navigating between pages

### Performance Impact

**Expected Improvements**:

1. **Zero-Row Filtering**:
   - Reduces payload size by 20-50% depending on data sparsity
   - Minimal query overhead (< 5ms for HAVING clause)
   - Reduces frontend rendering time

2. **Pagination**:
   - Reduces payload size by 90%+ for large result sets
   - COUNT query adds ~50-100ms overhead
   - Parallel execution minimizes latency impact
   - Improves initial page load time by 70%+

3. **Combined Effect**:
   - Total payload reduction: 85-95% for large datasets
   - Faster API response times
   - Improved frontend table rendering performance
   - Better user experience with large result sets

### Backward Compatibility

**No Breaking Changes**:
- Pagination parameters are optional
- When not provided, returns all results (existing behavior)
- Pagination metadata always included (with appropriate values)
- Zero-row filtering is transparent to API consumers
- Total aggregation row always preserved

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Test specific filter combinations (e.g., single type filter, multiple category filters)
- Test specific grouping scenarios (e.g., type-only, type+category)
- Test edge cases (empty results, null dates, single activity)
- Test error conditions (invalid filters, authorization failures)
- Test wire format transformation with known inputs
- Test frontend parsing with sample wire format responses
- **NEW**: Test HAVING clause filters zero rows correctly
- **NEW**: Test HAVING clause preserves total aggregation row
- **NEW**: Test pagination returns correct page of results
- **NEW**: Test COUNT query matches actual result count
- **NEW**: Test pagination metadata calculation

**Property-Based Tests**: Verify universal properties across all inputs
- Generate random filter combinations and verify query count ≤ 2
- Generate random activities and verify date overlap logic
- Generate random grouping dimensions and verify subset completeness
- Generate random dimension data and verify wire format structure
- Each property test should run minimum 100 iterations
- **NEW**: Verify stable ordering across pagination requests
- **NEW**: Verify no duplicate rows across pages
- **NEW**: Verify total count matches sum of all pages

### Property-Based Testing Configuration

**Testing Library**: Use `fast-check` for TypeScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: analytics-optimization, Property {number}: {property_text}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Feature: analytics-optimization, Property 1: Maximum Two Database Queries', () => {
  it('should execute at most 2 queries for any filter combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          activityTypeIds: fc.array(fc.uuid(), { maxLength: 5 }),
          activityCategoryIds: fc.array(fc.uuid(), { maxLength: 5 }),
          geographicAreaIds: fc.array(fc.uuid(), { maxLength: 5 }),
          groupBy: fc.array(fc.constantFrom('activityType', 'activityCategory', 'geographicArea'), { maxLength: 3 })
        }),
        async (filters) => {
          const queryCount = await countQueriesExecuted(() => 
            analyticsService.getEngagementMetrics(filters, [], false)
          );
          expect(queryCount).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Database Integration Tests**:
- Test against real PostgreSQL database with test data
- Verify SQL queries execute successfully
- Verify query results match expected aggregations
- Test with various data volumes (10, 100, 1000, 10000 activities)
- **NEW**: Test HAVING clause with sparse data
- **NEW**: Test pagination with various page sizes
- **NEW**: Test COUNT query performance

**API Integration Tests**:
- Test full request/response cycle through API endpoint
- Verify wire format structure matches specification
- Test with various filter and grouping combinations
- Verify response times meet performance targets
- **NEW**: Test pagination parameters validation
- **NEW**: Test pagination metadata in response
- **NEW**: Test backward compatibility (no pagination params)

**Frontend Integration Tests**:
- Test EngagementDashboard with mock API responses
- Verify table and chart rendering with wire format data
- Test error handling for malformed responses
- Verify lookup resolution displays correct names
- **NEW**: Test pagination controls functionality
- **NEW**: Test page navigation
- **NEW**: Test page size selector
- **NEW**: Test URL state management

### Performance Testing

**Query Performance Benchmarks**:
- Measure query execution time for various data volumes
- Target: < 500ms for 10,000 activities
- Target: < 2s for 100,000 activities
- Compare against current implementation baseline
- **NEW**: Measure HAVING clause overhead (target: < 5ms)
- **NEW**: Measure COUNT query execution time (target: < 100ms)
- **NEW**: Measure parallel query execution efficiency

**Payload Size Benchmarks**:
- Measure wire format response size
- Target: < 50% of current implementation size
- Verify indexed lookups reduce payload significantly
- **NEW**: Measure zero-row filtering impact (target: 20-50% reduction)
- **NEW**: Measure pagination impact (target: 90%+ reduction for large datasets)

**Memory Usage Benchmarks**:
- Measure Node.js memory usage during query execution
- Target: < 100MB for 10,000 activities
- Verify no memory leaks during repeated queries
- **NEW**: Verify pagination reduces memory usage proportionally


## Role Distribution Query Optimization

### Overview

The role distribution query provides a breakdown of participant assignments by role, showing how many assignments exist for each role (e.g., Tutor, Teacher, Animator, Host, Participant). This feature uses the same CTE-based optimization approach as the engagement metrics.

### SQL Query Structure

```sql
WITH 
  -- CTE 1: Filtered activities
  filtered_activities AS (
    SELECT DISTINCT a.id, a."startDate", a."endDate", a."activityTypeId"
    FROM activities a
    JOIN activity_types at ON a."activityTypeId" = at.id
    LEFT JOIN activity_venue_history avh ON a.id = avh."activityId"
    LEFT JOIN venues v ON avh."venueId" = v.id
    WHERE 
      -- Activity type filter
      (@activityTypeIds IS NULL OR a."activityTypeId" = ANY(@activityTypeIds))
      -- Activity category filter
      AND (@activityCategoryIds IS NULL OR at."activityCategoryId" = ANY(@activityCategoryIds))
      -- Venue filter
      AND (@venueIds IS NULL OR avh."venueId" = ANY(@venueIds))
      -- Geographic area filter
      AND (@geographicAreaIds IS NULL OR v."geographicAreaId" = ANY(@geographicAreaIds))
      -- Date range filter (activity was active during the range)
      AND (
        @startDate IS NULL 
        OR (
          DATE(a."startDate") <= DATE(@endDate)
          AND (a."endDate" IS NULL OR DATE(a."endDate") >= DATE(@startDate))
        )
      )
      -- Current date filter (when no date range specified)
      OR (
        @startDate IS NULL AND @endDate IS NULL
        AND DATE(a."startDate") <= CURRENT_DATE
        AND (a."endDate" IS NULL OR DATE(a."endDate") >= CURRENT_DATE)
      )
  ),
  
  -- CTE 2: Role counts
  role_counts AS (
    SELECT 
      asn."roleId",
      COUNT(asn.id) as assignment_count
    FROM filtered_activities fa
    JOIN assignments asn ON fa.id = asn."activityId"
    -- Population filter (if specified)
    LEFT JOIN participant_populations pp ON asn."participantId" = pp."participantId"
    WHERE 
      @populationIds IS NULL 
      OR pp."populationId" = ANY(@populationIds)
    GROUP BY asn."roleId"
  )

SELECT 
  rc."roleId",
  rc.assignment_count
FROM role_counts rc
ORDER BY rc.assignment_count DESC;
```

### Wire Format Structure

```typescript
interface RoleDistributionWireFormat {
  data: Array<[number, number]>;  // [roleIndex, count]
  lookups: {
    roles: Array<{ id: string; name: string }>;
  };
  metadata: {
    columns: ['roleIndex', 'count'];
  };
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      [0, 45],  // Role index 0 (Participant), 45 assignments
      [1, 12],  // Role index 1 (Tutor), 12 assignments
      [2, 8]    // Role index 2 (Teacher), 8 assignments
    ],
    "lookups": {
      "roles": [
        { "id": "role-uuid-1", "name": "Participant" },
        { "id": "role-uuid-2", "name": "Tutor" },
        { "id": "role-uuid-3", "name": "Teacher" }
      ]
    },
    "metadata": {
      "columns": ["roleIndex", "count"]
    }
  }
}
```

### Components

**RoleDistributionQueryBuilder**
- Builds filtered_activities CTE with all filter support
- Builds role_counts CTE with GROUP BY roleId
- Applies population filtering if specified
- Returns SQL and parameters

**RoleDistributionService**
- Orchestrates query building and execution
- Applies geographic authorization filtering
- Fetches role lookups
- Transforms to wire format
- Handles errors

### API Endpoint

```
POST /api/v1/analytics/role-distribution

Request Body:
{
  "startDate": "2024-01-01T00:00:00Z",  // optional
  "endDate": "2024-12-31T23:59:59Z",    // optional
  "activityTypeIds": ["uuid1", "uuid2"], // optional
  "activityCategoryIds": ["uuid3"],      // optional
  "geographicAreaIds": ["uuid4"],        // optional
  "venueIds": ["uuid5"],                 // optional
  "populationIds": ["uuid6"]             // optional
}

Response:
{
  "success": true,
  "data": {
    "data": [[0, 45], [1, 12], [2, 8]],
    "lookups": {
      "roles": [
        { "id": "role-uuid-1", "name": "Participant" },
        { "id": "role-uuid-2", "name": "Tutor" },
        { "id": "role-uuid-3", "name": "Teacher" }
      ]
    },
    "metadata": {
      "columns": ["roleIndex", "count"]
    }
  }
}
```

### Frontend Integration

The EngagementDashboard calls the role distribution endpoint separately from the main engagement metrics query:

```typescript
// Separate query for role distribution
const { data: roleDistributionWireFormat } = useQuery({
  queryKey: ['roleDistribution', filters],
  queryFn: () => AnalyticsService.getRoleDistribution(filters),
  enabled: hasRunReport,
});

// Parse wire format
const roleDistribution = useMemo(() => {
  if (!roleDistributionWireFormat) return [];
  const parsed = parseRoleDistributionWireFormat(roleDistributionWireFormat);
  return parsed.rows.map(row => ({
    roleName: row.role?.name || 'Unknown',
    count: row.count || 0,
  }));
}, [roleDistributionWireFormat]);

// Render pie chart
<PieChart
  data={roleDistribution}
  detailPopoverContent={(datum) => [
    { key: 'Role', value: datum.roleName },
    { key: 'Assignments', value: datum.count },
  ]}
/>
```

### Performance Targets

- Query execution time: < 200ms for 10,000 activities
- Payload size: < 5KB for typical role distribution (5-10 roles)
- Memory usage: < 10MB during query execution
