# Requirements Document: Geographic Breakdown Query Optimization

## Introduction

This specification defines the optimization of the `getGeographicBreakdown()` method in the AnalyticsService to improve performance through database-level aggregation using Common Table Expressions (CTEs), GROUP BY clauses, and Prisma's raw query interface. The current implementation fetches all activities with full relations and performs aggregation in Node.js memory, resulting in:

- Multiple database queries (one per geographic area to check for children)
- Large data transfer (full activity objects with nested relations)
- Memory-intensive operations in Node.js
- Slow response times for large datasets
- N+1 query pattern when checking for child areas

The optimized design will:

- Execute 1-2 database queries maximum (one for metrics, one optional for area metadata)
- Perform all aggregation in PostgreSQL using CTEs and GROUP BY
- Return only aggregated counts and geographic area identifiers
- Support pagination with stable ordering
- Minimize memory usage and improve response times
- Maintain API compatibility (except for optional pagination parameters)

## Glossary

- **Geographic Breakdown**: Aggregated metrics grouped by geographic area, showing activity counts, participant counts, and participation counts for each area
- **Parent Geographic Area**: The geographic area whose immediate children are being analyzed
- **Descendant Areas**: All child, grandchild, and deeper nested areas within a geographic area hierarchy
- **Area Metrics Aggregation**: Combining metrics from an area and all its descendants into a single set of counts
- **CTE (Common Table Expression)**: SQL WITH clause that defines temporary result sets for complex queries
- **Push-Down Predicate**: SQL optimization technique where filters are applied as early as possible in the query
- **HAVING Clause**: SQL clause that filters grouped results based on aggregate conditions
- **Pagination**: Dividing large result sets into smaller pages for efficient data transfer and rendering

## Requirements

### Requirement 1: Single Query for All Areas

**User Story:** As a backend developer, I want to fetch metrics for all geographic areas in one database query, so that I can eliminate the N+1 query pattern and improve response times.

#### Acceptance Criteria

1.1. WHEN computing geographic breakdown for multiple areas, THE System SHALL execute at most two database queries regardless of the number of areas

1.2. THE System SHALL compute metrics for all areas in a single aggregation query using GROUP BY

1.3. THE System SHALL NOT execute separate queries for each geographic area

1.4. THE System SHALL fetch area metadata (name, type, hasChildren) in a separate lightweight query if needed

### Requirement 2: Database-Level Aggregation

**User Story:** As a backend developer, I want all counts calculated in the database engine, so that I can avoid memory-intensive operations in Node.js and leverage PostgreSQL's optimized aggregation.

#### Acceptance Criteria

2.1. THE System SHALL compute all activity, participant, and participation counts using SQL aggregate functions (COUNT, COUNT DISTINCT)

2.2. THE System SHALL NOT transfer individual activity or assignment records to Node.js for counting

2.3. THE System SHALL perform all aggregation calculations in a single database query using GROUP BY geographicAreaId

2.4. THE System SHALL use LEFT JOIN with assignments table to include activities with zero participants

### Requirement 3: Descendant Area Expansion

**User Story:** As a backend developer, I want each area's metrics to include its descendants, so that geographic breakdown shows comprehensive metrics for hierarchical areas.

#### Acceptance Criteria

3.1. FOR EACH geographic area in the result set, THE System SHALL include activities from the area itself AND all its descendant areas

3.2. THE System SHALL use the GeographicAreaRepository.findBatchDescendants() method to expand area IDs before querying activities

3.3. THE System SHALL build a mapping of parent area ID to all descendant IDs (including the parent itself)

3.4. THE System SHALL filter activities by venue.geographicAreaId IN (area + all descendants)

### Requirement 4: Authorization Filtering

**User Story:** As a backend developer, I want to respect geographic authorization rules, so that users only see metrics for areas they have access to.

#### Acceptance Criteria

4.1. WHEN a user has geographic restrictions, THE System SHALL validate access to the parent area (if specified)

4.2. WHEN returning top-level areas, THE System SHALL filter to only areas the user is authorized to access

4.3. WHEN returning child areas, THE System SHALL filter to only areas the user is authorized to access

4.4. FOR EACH area's metrics, THE System SHALL only include activities from authorized descendant areas

4.5. THE System SHALL throw a 403 error if the user attempts to access an unauthorized parent area

### Requirement 5: Smart Join Optimization

**User Story:** As a backend developer, I want to include only necessary table joins, so that I can minimize query complexity and improve performance.

#### Acceptance Criteria

5.1. THE System SHALL always join the venue table (required for geographic area filtering)

5.2. THE System SHALL always join the activity_venue_history table (required for venue-activity relationship)

5.3. THE System SHALL join the activity_types table only if activity type filter is specified

5.4. THE System SHALL join the participant_populations table only if population filter is specified

5.5. THE System SHALL use LEFT JOIN for assignments table to include activities with zero participants

### Requirement 6: Filter Application

**User Story:** As a backend developer, I want to apply all filters at the database level, so that I can reduce the amount of data transferred and processed.

#### Acceptance Criteria

6.1. THE System SHALL support filtering by activity type identifiers

6.2. THE System SHALL support filtering by activity category identifiers

6.3. THE System SHALL support filtering by venue identifiers

6.4. THE System SHALL support filtering by population identifiers

6.5. THE System SHALL support filtering by date range (startDate and endDate)

6.6. WHEN multiple filters are specified, THE System SHALL apply them with AND logic

6.7. THE System SHALL apply filters in the base activity CTE before aggregation

### Requirement 7: Zero-Row Filtering

**User Story:** As a backend developer, I want to filter out geographic areas with zero metrics, so that I can reduce payload size and avoid transferring meaningless data.

#### Acceptance Criteria

7.1. THE System SHALL add a HAVING clause to filter out rows where activityCount = 0 AND participantCount = 0 AND participationCount = 0

7.2. THE System SHALL apply the HAVING clause after the GROUP BY clause

7.3. THE System SHALL filter out ALL areas with zero metrics, regardless of whether they have children

7.4. THE System SHALL NOT use an EXISTS subquery to preserve areas with children in the HAVING clause

### Requirement 8: Pagination Support

**User Story:** As a frontend developer, I want paginated results with stable ordering, so that I can efficiently display large result sets with lazy loading.

#### Acceptance Criteria

8.1. THE System SHALL accept an optional `page` query parameter (1-based, default: 1)

8.2. THE System SHALL accept an optional `pageSize` query parameter (default: 100, max: 1000)

8.3. THE System SHALL validate that `page` is a positive integer

8.4. THE System SHALL validate that `pageSize` is between 1 and 1000

8.5. THE System SHALL return a validation error (400) if pagination parameters are invalid

8.6. THE System SHALL use SQL LIMIT and OFFSET clauses for pagination

8.7. THE System SHALL calculate offset as `(page - 1) * pageSize`

8.8. THE System SHALL order results by geographic area name for stable pagination

8.9. WHEN pagination parameters are provided, THE System SHALL check if the pagination object exists (not check individual properties with AND logic)

8.10. WHEN the requested page number exceeds the total number of pages, THE System SHALL clamp the page number to the last valid page (totalPages)

8.11. WHEN the requested page number is less than 1, THE System SHALL clamp the page number to 1

8.12. THE System SHALL execute the COUNT query before the main query to determine the valid page range for clamping

8.13. THE System SHALL return the clamped page number in the pagination metadata (not the originally requested page)

### Requirement 9: Total Count Query

**User Story:** As a frontend developer, I want to know the total count of available areas, so that I can display pagination controls and inform users about the dataset size.

#### Acceptance Criteria

9.1. THE System SHALL execute a COUNT query that applies the same filters and HAVING clause as the main query

9.2. THE COUNT query SHALL count the number of geographic areas (after filtering and HAVING)

9.3. THE System SHALL execute the COUNT query in parallel with the main query to minimize latency

9.4. THE System SHALL return the total count in the response metadata

### Requirement 10: Response Format with Pagination Metadata

**User Story:** As a frontend developer, I want pagination metadata in the API response, so that I can display pagination controls.

#### Acceptance Criteria

10.1. THE System SHALL maintain the existing GeographicBreakdown response structure

10.2. THE System SHALL add a pagination metadata object to the response

10.3. THE pagination metadata SHALL include:
   - `page`: Current page number (1-based)
   - `pageSize`: Number of records per page
   - `totalRecords`: Total number of areas available (from COUNT query)
   - `totalPages`: Calculated as `Math.ceil(totalRecords / pageSize)`
   - `hasNextPage`: Boolean indicating if more pages exist
   - `hasPreviousPage`: Boolean indicating if previous pages exist

10.4. WHEN no pagination parameters are provided, THE System SHALL return all results and set `page = 1`, `pageSize = totalRecords`, `totalPages = 1`

### Requirement 11: Backward Compatibility

**User Story:** As a backend developer, I want pagination to be optional, so that existing API consumers continue to work without changes.

#### Acceptance Criteria

11.1. THE System SHALL maintain the existing GeographicBreakdown[] response structure

11.2. WHEN no pagination parameters are provided, THE System SHALL return all results (no pagination)

11.3. THE System SHALL include pagination metadata in the response (even when pagination is not used)

11.4. THE System SHALL not break existing API consumers that don't use pagination

11.5. THE System SHALL maintain the same response field names and types

### Requirement 12: Performance Targets

**User Story:** As a backend developer, I want the optimized query to be significantly faster, so that users experience improved dashboard load times.

#### Acceptance Criteria

12.1. THE System SHALL execute the main query in less than 500ms for datasets with 10,000 activities

12.2. THE System SHALL execute the COUNT query in less than 100ms

12.3. THE System SHALL reduce memory usage by at least 80% compared to the current implementation

12.4. THE System SHALL reduce payload size by at least 50% when pagination is used

12.5. THE HAVING clause overhead SHALL be less than 5ms

## Non-Functional Requirements

### Performance

- Query execution time: < 500ms for 10,000 activities
- COUNT query time: < 100ms
- Memory usage: < 100MB for 10,000 activities
- Payload size: < 50% of current implementation when paginated

### Scalability

- Support up to 100,000 activities without performance degradation
- Support up to 1,000 geographic areas in a single query
- Support pagination with page sizes up to 1,000 records

### Reliability

- Retry transient database connection failures (max 3 attempts)
- Set query timeout to 30 seconds
- Log all query errors with context
- Return clear error messages for validation failures

### Security

- Validate all user inputs before query construction
- Prevent SQL injection through parameterized queries
- Enforce geographic authorization rules
- Validate user access to parent areas before querying children

## Success Criteria

1. ✅ All existing tests pass without modification
2. ✅ Query execution time reduced by 60%+ for large datasets
3. ✅ Memory usage reduced by 80%+
4. ✅ Payload size reduced by 50%+ when pagination is used
5. ✅ No breaking changes to API response structure
6. ✅ Pagination is optional and backward compatible
7. ✅ All authorization rules continue to work correctly
