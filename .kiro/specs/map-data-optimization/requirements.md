# Requirements Document: Map Data API Performance Optimization

## Introduction

The Map Data API provides specialized endpoints for rendering map markers with lightweight data and lazy-loaded popup content. The current implementation uses Prisma ORM abstractions which result in inefficient multi-query patterns and in-memory pagination. This spec defines requirements for optimizing these endpoints using raw SQL queries that push filtering, joins, and pagination to the database engine.

## Glossary

- **Raw_SQL_Query**: A SQL query executed directly against the database using Prisma's `$queryRaw` or `$queryRawUnsafe` methods, bypassing ORM abstractions
- **Query_Variant**: A specific version of a SQL query optimized for a particular combination of filters (e.g., with/without population filtering)
- **Conditional_Join**: A table join that is only included in the query when specific filters are present
- **Single_Round_Trip**: A database query pattern where all necessary data is fetched in one database call instead of multiple sequential queries
- **Database_Level_Pagination**: Applying LIMIT and OFFSET clauses in SQL rather than fetching all results and paginating in application code
- **Query_Plan**: The execution strategy chosen by the database engine to execute a query, which can be optimized by minimizing unnecessary joins

## Requirements

### Requirement 1: Optimize Activity Markers Query with Raw SQL

**User Story:** As a backend developer, I want the `getActivityMarkers` method to use optimized raw SQL queries, so that map marker data loads faster with minimal database overhead.

#### Acceptance Criteria

1. THE API SHALL replace the current Prisma ORM query in `getActivityMarkers` with a raw SQL query using `prisma.$queryRaw`
2. THE raw SQL query SHALL fetch activity markers in a single database round trip
3. THE raw SQL query SHALL apply pagination at the database level using LIMIT and OFFSET clauses
4. THE raw SQL query SHALL use a stable sort order based on the activity ID to ensure consistent pagination results
5. THE raw SQL query SHALL include ORDER BY activity.id in all queries to guarantee deterministic result ordering
6. THE raw SQL query SHALL calculate the total count in the same query using window functions (COUNT(*) OVER())
7. THE raw SQL query SHALL join only the tables necessary based on active filters
8. WHEN no population filter is provided, THE query SHALL NOT join Assignment, Participant, or ParticipantPopulation tables
9. WHEN population filter is provided, THE query SHALL join Assignment, Participant, and ParticipantPopulation tables
10. WHEN no geographic filter is provided, THE query SHALL NOT join GeographicArea table
11. WHEN geographic filter is provided, THE query SHALL join Venue and use IN clause for geographicAreaId
12. THE query SHALL use a subquery or CTE to identify the current venue for each activity (most recent ActivityVenueHistory record)
13. THE query SHALL filter out activities without coordinates (venue latitude/longitude IS NOT NULL)
14. THE query SHALL apply bounding box filters directly in the WHERE clause
15. THE query SHALL handle international date line crossing in coordinate filters
16. THE query SHALL apply temporal overlap logic for date range filters
17. THE query SHALL apply activity type, category, status, and venue filters in the WHERE clause
18. THE query SHALL return only the fields needed for markers: id, latitude, longitude, activityTypeId, activityCategoryId
19. THE query SHALL maintain the same authorization filtering behavior as the current implementation
20. THE query SHALL use ORDER BY activity.id consistently across all query variants to ensure stable pagination
21. THE query SHALL apply ORDER BY before LIMIT and OFFSET to ensure deterministic result sets
22. THE optimized query SHALL reduce database query time by at least 50% compared to the current implementation
23. THE API SHALL create separate query builder methods for different filter combinations to avoid unnecessary joins
24. THE API SHALL select the appropriate query variant based on which filters are present in the request

### Requirement 2: Implement Query Variant Selection Logic

**User Story:** As a backend developer, I want the system to automatically select the most efficient SQL query variant based on active filters, so that queries run as fast as possible without unnecessary table joins.

#### Acceptance Criteria

1. THE API SHALL implement a `buildActivityMarkersQuery` method that analyzes active filters
2. THE method SHALL determine which tables need to be joined based on filter presence
3. THE method SHALL construct the appropriate SQL query string with conditional JOIN clauses
4. THE method SHALL use a query builder pattern to compose SQL fragments
5. THE method SHALL support the following query variants:
   - Base query: Activity + ActivityType + ActivityVenueHistory + Venue (no optional joins)
   - With population filter: Base + Assignment + Participant + ParticipantPopulation
   - With geographic filter: Base + explicit venue filtering via IN clause
   - With both filters: All tables joined
6. THE method SHALL parameterize all filter values to prevent SQL injection
7. THE method SHALL use Prisma's `Prisma.sql` template tag for safe parameter binding
8. THE method SHALL handle null/undefined filter values gracefully
9. THE method SHALL apply filters in the optimal order for query performance (most selective first)
10. THE method SHALL use appropriate indexes (assume they exist on foreign keys and filter columns)

### Requirement 3: Optimize Current Venue Identification

**User Story:** As a backend developer, I want the SQL query to efficiently identify the current venue for each activity, so that we avoid N+1 query patterns.

#### Acceptance Criteria

1. THE query SHALL use a LATERAL join or window function to identify the most recent ActivityVenueHistory record per activity
2. THE query SHALL handle null effectiveFrom dates correctly (treat as activity startDate)
3. THE query SHALL order venue history by effectiveFrom DESC NULLS LAST within each activity
4. THE query SHALL use ROW_NUMBER() or DISTINCT ON to select only the first (most recent) venue per activity
5. THE query SHALL filter out activities where the current venue has null coordinates
6. THE current venue identification SHALL be performed in a single query without subqueries per row
7. THE query SHALL maintain stable ordering by including activity.id in the final ORDER BY clause
8. THE stable ordering SHALL ensure that LIMIT and OFFSET produce consistent, non-overlapping result pages

### Requirement 4: Maintain Backward Compatibility

**User Story:** As a frontend developer, I want the optimized API to return the same response format, so that no client code changes are required.

#### Acceptance Criteria

1. THE optimized `getActivityMarkers` method SHALL return the same TypeScript interface: `PaginatedResponse<ActivityMarker>`
2. THE response data structure SHALL remain unchanged
3. THE pagination metadata SHALL remain unchanged (page, limit, total, totalPages)
4. THE method signature SHALL remain unchanged (same parameters and types)
5. THE authorization filtering behavior SHALL remain unchanged
6. THE bounding box filtering behavior SHALL remain unchanged
7. THE temporal filtering behavior SHALL remain unchanged
8. THE method SHALL handle all edge cases the same way as the current implementation

### Requirement 5: Add Performance Monitoring

**User Story:** As a backend developer, I want to measure query performance improvements, so that I can validate the optimization was successful.

#### Acceptance Criteria

1. THE API SHALL log query execution time for activity marker queries
2. THE API SHALL include query execution time in development/debug logs
3. THE API SHALL log which query variant was selected
4. THE API SHALL log the number of rows returned and total count
5. THE logs SHALL include enough information to diagnose performance issues
6. THE logging SHALL be conditional (only in development mode or when debug flag is set)
7. THE API SHALL provide a way to compare performance before and after optimization

### Requirement 6: Optimize Participant Home Markers Query (Optional)

**User Story:** As a backend developer, I want to apply the same optimization approach to participant home markers, so that all map endpoints benefit from improved performance.

#### Acceptance Criteria

1. THE API SHALL apply the same raw SQL optimization approach to `getParticipantHomeMarkers`
2. THE query SHALL use conditional joins based on population and geographic filters
3. THE query SHALL handle temporal filtering for address history efficiently
4. THE query SHALL group by venue and count participants in a single query
5. THE query SHALL apply pagination at the database level
6. THE optimization SHALL follow the same patterns as activity markers for consistency

### Requirement 7: Document Query Optimization Patterns

**User Story:** As a backend developer, I want clear documentation of the query optimization patterns, so that I can apply them to other endpoints if needed.

#### Acceptance Criteria

1. THE code SHALL include inline comments explaining the SQL query structure
2. THE code SHALL document which filters trigger which table joins
3. THE code SHALL include examples of the generated SQL for different filter combinations
4. THE code SHALL document any PostgreSQL-specific features used (window functions, LATERAL joins, etc.)
5. THE code SHALL explain the performance characteristics of each query variant
6. THE documentation SHALL include guidance on when to use raw SQL vs ORM abstractions

## Non-Functional Requirements

### Performance

- Activity marker queries SHALL complete in under 200ms for datasets with 100,000+ activities
- The optimization SHALL reduce database query time by at least 50%
- The optimization SHALL reduce memory usage by avoiding in-memory pagination
- The optimization SHALL scale linearly with the number of results (O(n) not O(n²))

### Maintainability

- The raw SQL queries SHALL be readable and well-formatted
- The query builder logic SHALL be modular and testable
- The code SHALL follow existing project conventions
- The optimization SHALL not introduce technical debt

### Reliability

- The optimized queries SHALL handle all edge cases correctly
- The optimization SHALL not introduce new bugs
- The optimization SHALL maintain the same error handling behavior
- The optimization SHALL be covered by integration tests

## Out of Scope

- Optimizing venue marker queries (already efficient with direct venue filtering)
- Adding database indexes (assume they already exist)
- Caching query results (can be added later)
- Optimizing popup content queries (already efficient single-record lookups)
- Changing the API contract or response format
