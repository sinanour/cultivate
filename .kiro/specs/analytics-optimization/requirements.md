# Requirements Document

## Introduction

This specification defines the optimization of the AnalyticsService to improve performance through database-level aggregation using Common Table Expressions (CTEs), SQL window functions, and Prisma's raw query interface. The optimization aims to reduce database round-trips, minimize data transfer, and leverage PostgreSQL's query engine for efficient multi-dimensional analytics.

## Glossary

- **AnalyticsService**: Backend service responsible for computing engagement metrics and analytics data
- **CTE (Common Table Expression)**: SQL WITH clause that defines temporary result sets for complex queries
- **Window Function**: SQL function that performs calculations across rows related to the current row
- **Engagement Metrics**: Quantitative measures of activity participation including counts of activities, participants, and participation instances
- **Date Snapshot**: Point-in-time view of engagement metrics for a specific date
- **Activity Lifecycle Event**: Transition point in an activity's timeline (started or completed)
- **Grouping Dimension**: Categorical attribute used to segment engagement metrics (type, category, geographic area)
- **Total Aggregation**: Overall metrics across all dimension values, represented by NULL values for all grouping dimensions
- **Wire Format**: Data structure used for API response transmission
- **Daily Granularity**: Time precision limited to calendar dates, ignoring hours/minutes/seconds
- **Date Overlap Logic**: Algorithm to determine if an activity's date range intersects with a query date
- **Prisma Raw Query Interface**: Prisma ORM method for executing raw SQL queries with type safety

## Requirements

### Requirement 1: Single Query Optimization

**User Story:** As a backend developer, I want to fetch all engagement data in one or two database queries, so that I can minimize database round-trips and improve response times.

#### Acceptance Criteria

1. WHEN the AnalyticsService computes engagement metrics, THE System SHALL execute at most two database queries regardless of filter complexity
2. WHEN multiple grouping dimensions are requested, THE System SHALL compute all groupings in a single query using window functions
3. WHEN date range snapshots are requested, THE System SHALL fetch both start and end date metrics in a single query

### Requirement 2: Database-Level Aggregation

**User Story:** As a backend developer, I want all counts calculated in the database engine, so that I can avoid memory-intensive operations in Node.js and leverage PostgreSQL's optimized aggregation.

#### Acceptance Criteria

1. THE System SHALL compute all engagement counts using SQL aggregate functions (COUNT, COUNT DISTINCT)
2. THE System SHALL NOT transfer individual activity or participation records to Node.js for counting
3. THE System SHALL perform all aggregation calculations in a single database query

### Requirement 3: Minimal Data Transfer

**User Story:** As a backend developer, I want to return only aggregated counts without unnecessary details, so that I can minimize network payload and improve API response times.

#### Acceptance Criteria

1. THE System SHALL return only numeric counts and grouping dimension identifiers in the query result
2. THE System SHALL NOT include activity names, statuses, descriptions, or other non-aggregated fields in the main query result
3. WHEN dimension lookups are needed, THE System SHALL fetch them in a separate lightweight query

### Requirement 4: Date Range Snapshots

**User Story:** As a frontend developer, I want counts at both start and end dates when a date range is specified, so that I can show engagement trends over time.

#### Acceptance Criteria

1. WHEN a date range is specified with startDate and endDate, THE System SHALL return metrics for both dates
2. FOR EACH snapshot date, THE System SHALL include counts of active activities, unique participants, and total participation instances
3. WHEN no date range is specified, THE System SHALL return metrics for the current date only

### Requirement 5: Current Date Default

**User Story:** As a frontend developer, I want the system to default to current date when no date range is specified, so that I can see current engagement without explicit date parameters.

#### Acceptance Criteria

1. WHEN no date range is specified, THE System SHALL use the current date as the query date
2. FOR the current date, THE System SHALL include ongoing activities where endDate is null
3. FOR the current date, THE System SHALL include finite activities where startDate is less than or equal to today AND endDate is null or in the future

### Requirement 6: Activity Lifecycle Events

**User Story:** As a frontend developer, I want counts of activities started and completed during a period, so that I can track activity lifecycle transitions.

#### Acceptance Criteria

1. WHEN a date range is specified, THE System SHALL return the count of activities where startDate falls within the range
2. WHEN a date range is specified, THE System SHALL return the count of activities where endDate falls within the range
3. WHEN no date range is specified, THE System SHALL NOT include lifecycle event counts

### Requirement 7: Date Overlap Logic

**User Story:** As a backend developer, I want correct date overlapping logic to determine activity status, so that I can accurately identify which activities are active on a given date.

#### Acceptance Criteria

1. FOR ANY activity and query date, THE System SHALL consider the activity active IF startDate is less than or equal to the query date AND (endDate is null OR endDate is greater than or equal to the query date)
2. WHEN determining date overlap, THE System SHALL use SQL date comparison operators
3. THE System SHALL handle null endDate values as representing ongoing activities

### Requirement 8: Daily Granularity

**User Story:** As a backend developer, I want all dates clamped to daily granularity, so that I can ensure consistent date comparisons regardless of timestamp precision.

#### Acceptance Criteria

1. THE System SHALL truncate all date values to remove time components before comparison
2. WHEN comparing dates, THE System SHALL use DATE type or equivalent daily precision
3. THE System SHALL apply daily granularity to both query parameters and database date fields

### Requirement 9: Multi-Dimensional Filtering

**User Story:** As a frontend developer, I want to filter engagement metrics by multiple dimensions, so that I can analyze specific subsets of activities.

#### Acceptance Criteria

1. THE System SHALL support optional filtering by activity type identifiers
2. THE System SHALL support optional filtering by activity category identifiers
3. THE System SHALL support optional filtering by venue identifiers
4. THE System SHALL support optional filtering by geographic area identifiers
5. THE System SHALL support optional filtering by population identifiers
6. WHEN multiple filters are specified, THE System SHALL apply them with AND logic

### Requirement 10: Smart Join Optimization

**User Story:** As a backend developer, I want to exclude unnecessary table joins based on active filters, so that I can minimize query complexity and improve performance.

#### Acceptance Criteria

1. WHEN no venue filter is specified AND venue is not a grouping dimension, THE System SHALL NOT join the venue table
2. WHEN no geographic area filter is specified AND geographic area is not a grouping dimension, THE System SHALL NOT join the geographic area table
3. WHEN no population filter is specified, THE System SHALL NOT join the population table
4. THE System SHALL dynamically construct the SQL query to include only necessary joins

### Requirement 11: Multi-Dimensional Grouping

**User Story:** As a frontend developer, I want to group engagement metrics by any combination of dimensions with total aggregates, so that I can analyze data at the requested granularity level.

#### Acceptance Criteria

1. THE System SHALL support grouping by activity type only
2. THE System SHALL support grouping by activity category only
3. THE System SHALL support grouping by geographic area only
4. THE System SHALL support grouping by venue only
5. THE System SHALL support grouping by any combination of two dimensions (type+category, type+area, type+venue, category+area, category+venue, area+venue)
6. THE System SHALL support grouping by any combination of three dimensions (type+category+area, type+category+venue, type+area+venue, category+area+venue)
7. THE System SHALL support grouping by all four dimensions (type+category+area+venue)
8. THE System SHALL support no grouping (total aggregation only)
9. WHEN grouping dimensions are specified, THE System SHALL return separate rows for each unique combination of dimension values
10. WHEN grouping dimensions are specified, THE System SHALL also return one total aggregation row where all dimension values are NULL
11. THE System SHALL NOT return partial subset groupings (e.g., if grouping by type+area, do NOT return type-only or area-only aggregations)

### Requirement 12: Total Aggregation Row

**User Story:** As a frontend developer, I want a total aggregation row included with grouped results, so that I can display overall metrics alongside detailed breakdowns.

#### Acceptance Criteria

1. WHEN grouping dimensions are specified, THE System SHALL include one additional row representing total aggregation across all dimension values
2. FOR the total aggregation row, THE System SHALL set all dimension identifier columns to NULL
3. THE total aggregation row SHALL contain the same metric columns as detail rows, with values representing totals across all dimension combinations
4. THE System SHALL compute the total aggregation row in the same query as the detail rows using GROUPING SETS or UNION ALL

### Requirement 13: Optimized Wire Format

**User Story:** As a frontend developer, I want a consolidated table format with indexed lookups, so that I can minimize API response payload size and efficiently parse multi-dimensional engagement data.

#### Acceptance Criteria

1. THE System SHALL return engagement data as a list of lists where each inner list represents one row
2. FOR EACH grouping dimension, THE System SHALL include an ordered lookup array containing entity objects with id and name properties
3. FOR EACH row in the data table, THE System SHALL use integer indexes (0-based) into the lookup arrays for dimension values
4. WHEN a dimension value represents an aggregated row, THE System SHALL use -1 instead of null
5. FOR EACH row, THE System SHALL place dimension indexes in the first columns followed by engagement metric values
6. THE System SHALL include a metadata object containing column header names in order
7. THE System SHALL include entity identifiers only once in the lookup arrays, not repeated in every data row
8. WHEN no date range is specified, THE System SHALL return 3 metric columns (activeActivities, uniqueParticipants, totalParticipation) plus dimension index columns
9. WHEN a date range is specified, THE System SHALL return 8 metric columns (start snapshot: 3 metrics, end snapshot: 3 metrics, lifecycle events: 2 metrics) plus dimension index columns
10. WHEN venue is included in the groupBy parameter, THE System SHALL include a venues lookup array with venue id and name properties
11. THE venues lookup array SHALL contain all unique venues that appear in the query results
12. WHEN no venues match the filters or venue is not in groupBy, THE System SHALL omit the venues array from the lookups object

### Requirement 14: Frontend Integration

**User Story:** As a frontend developer, I want the EngagementDashboard to use the optimized API, so that I can display engagement metrics with improved performance.

#### Acceptance Criteria

1. THE EngagementDashboard SHALL call the optimized analytics API endpoint
2. THE EngagementDashboard SHALL parse the wire format response to extract engagement metrics
3. THE EngagementDashboard SHALL use the lookup table to display human-readable dimension names
4. THE EngagementDashboard SHALL render the engagement summary table using the consolidated data structure
5. THE EngagementDashboard SHALL render activity breakdown charts using the grouped metrics
6. WHEN the API response format changes, THE EngagementDashboard SHALL handle the new structure without errors


## Enhancement Requirements: Pagination and Zero-Row Filtering

### Requirement 15: Database-Level Zero-Row Filtering

**User Story:** As a backend developer, I want to filter out aggregation rows with all-zero metrics at the database level, so that I can reduce payload size and avoid transferring meaningless data to the frontend.

#### Acceptance Criteria

1. THE System SHALL add a HAVING clause to the SQL query that filters out rows where all metric columns equal zero
2. WHEN no date range is specified, THE System SHALL filter rows where `activeActivities = 0 AND uniqueParticipants = 0 AND totalParticipation = 0`
3. WHEN a date range is specified, THE System SHALL filter rows where all 8 metrics equal zero (activitiesAtStart, activitiesAtEnd, activitiesStarted, activitiesCompleted, participantsAtStart, participantsAtEnd, participationAtStart, participationAtEnd)
4. THE System SHALL apply the HAVING clause AFTER the GROUP BY clause and BEFORE the ORDER BY clause
5. THE System SHALL preserve the total aggregation row (where all dimension IDs are NULL) even if it has zero metrics

### Requirement 16: Stable Ordering for Pagination

**User Story:** As a backend developer, I want results ordered consistently with total aggregates first, so that pagination works correctly and users see overall metrics before details.

#### Acceptance Criteria

1. THE System SHALL order results by the grouping dimension columns in the same order they appear in the GROUP BY clause
2. FOR EACH grouping dimension column, THE System SHALL use `NULLS FIRST` to ensure the total aggregation row appears at the beginning
3. THE System SHALL maintain consistent ordering across pagination requests to prevent duplicate or missing rows
4. WHEN no grouping dimensions are specified, THE System SHALL order by a constant value (e.g., `ORDER BY 1`)

### Requirement 17: Pagination Parameters

**User Story:** As a frontend developer, I want to specify page number and page size, so that I can control how much data is loaded at once.

#### Acceptance Criteria

1. THE System SHALL accept an optional `page` query parameter (1-based, default: 1)
2. THE System SHALL accept an optional `pageSize` query parameter (default: 100, max: 1000)
3. THE System SHALL validate that `page` is a positive integer
4. THE System SHALL validate that `pageSize` is between 1 and 1000
5. THE System SHALL return a validation error (400) if pagination parameters are invalid

### Requirement 18: SQL Pagination Implementation

**User Story:** As a backend developer, I want to use SQL LIMIT and OFFSET for pagination, so that I can efficiently retrieve only the requested page of data.

#### Acceptance Criteria

1. THE System SHALL use SQL `LIMIT` clause to restrict the number of rows returned
2. THE System SHALL use SQL `OFFSET` clause to skip rows for pagination (calculated as `(page - 1) * pageSize`)
3. THE System SHALL apply LIMIT and OFFSET AFTER the ORDER BY clause
4. THE System SHALL execute a separate COUNT query to determine the total number of records (before pagination)

### Requirement 19: Total Count Query

**User Story:** As a backend developer, I want to know the total count of available records, so that I can provide pagination metadata to the frontend.

#### Acceptance Criteria

1. THE System SHALL execute a COUNT query that applies the same filters and HAVING clause as the main query
2. THE COUNT query SHALL use `COUNT(*)` on the grouped results to count the number of aggregation rows
3. THE COUNT query SHALL wrap the main query (without LIMIT/OFFSET) in a subquery: `SELECT COUNT(*) FROM (main_query) AS count_query`
4. THE System SHALL execute the COUNT query in parallel with the main query to minimize latency
5. THE System SHALL return the total count in the wire format metadata

### Requirement 20: Wire Format Pagination Metadata

**User Story:** As a frontend developer, I want pagination metadata in the API response, so that I can display pagination controls and inform users about the dataset size.

#### Acceptance Criteria

1. THE System SHALL add a `pagination` object to the wire format metadata
2. THE `pagination` object SHALL include:
   - `page`: Current page number (1-based)
   - `pageSize`: Number of records per page
   - `totalRecords`: Total number of records available (from COUNT query)
   - `totalPages`: Calculated as `Math.ceil(totalRecords / pageSize)`
   - `hasNextPage`: Boolean indicating if more pages exist
   - `hasPreviousPage`: Boolean indicating if previous pages exist
3. WHEN no pagination parameters are provided, THE System SHALL return all results and set `page = 1`, `pageSize = totalRecords`, `totalPages = 1`

### Requirement 21: Frontend Pagination Controls

**User Story:** As a frontend user, I want pagination controls in the Engagement Dashboard, so that I can navigate through large result sets efficiently.

#### Acceptance Criteria

1. THE EngagementDashboard SHALL display pagination controls below the Engagement Summary table
2. THE pagination controls SHALL use CloudScape Pagination component
3. THE pagination controls SHALL display:
   - Current page number
   - Total number of pages
   - Total number of records
   - Previous/Next page buttons
   - Page size selector (options: 25, 50, 100, 200)
4. THE System SHALL default to page size of 100 records
5. WHEN the user changes page or page size, THE System SHALL fetch new data from the API

### Requirement 22: Frontend Lazy Loading

**User Story:** As a frontend user, I want the dashboard to load only the data I need, so that initial page load is fast and responsive.

#### Acceptance Criteria

1. THE EngagementDashboard SHALL NOT fetch all records at once
2. THE EngagementDashboard SHALL fetch only the current page of records
3. WHEN the user navigates to a different page, THE System SHALL fetch that page's data
4. THE System SHALL display a loading indicator while fetching paginated data
5. THE System SHALL preserve the current page when filters or grouping dimensions change (reset to page 1)

### Requirement 23: URL State Management for Pagination

**User Story:** As a frontend user, I want pagination state preserved in the URL, so that I can bookmark or share specific pages of results.

#### Acceptance Criteria

1. THE System SHALL include `page` and `pageSize` parameters in the URL query string
2. WHEN the user changes page or page size, THE System SHALL update the URL
3. WHEN the user navigates back/forward, THE System SHALL restore the correct page and page size
4. WHEN filters or grouping change, THE System SHALL reset to page 1

### Requirement 24: Backward Compatibility

**User Story:** As a backend developer, I want pagination to be optional, so that existing API consumers continue to work without changes.

#### Acceptance Criteria

1. THE System SHALL maintain backward compatibility with existing API consumers
2. WHEN no pagination parameters are provided, THE System SHALL return all results (no pagination)
3. THE System SHALL include pagination metadata even when pagination is not used (with appropriate values)
4. THE System SHALL not break existing frontend components that don't use pagination


## Role Distribution Requirements

### Requirement 25: Role Distribution Query Optimization

**User Story:** As a backend developer, I want to fetch role distribution data using database-level aggregation, so that I can minimize data transfer and improve query performance.

#### Acceptance Criteria

25.1. THE System SHALL compute role distribution counts using SQL aggregate functions (COUNT)

25.2. THE System SHALL NOT transfer individual assignment records to Node.js for counting

25.3. THE System SHALL perform all aggregation in a single database query using CTEs

25.4. THE System SHALL group assignments by roleId and count the number of assignments per role

25.5. THE System SHALL support optional filtering by activity type identifiers

25.6. THE System SHALL support optional filtering by activity category identifiers

25.7. THE System SHALL support optional filtering by venue identifiers

25.8. THE System SHALL support optional filtering by geographic area identifiers (with descendant expansion)

25.9. THE System SHALL support optional filtering by population identifiers

25.10. THE System SHALL support optional date range filtering (startDate and endDate)

25.11. WHEN multiple filters are specified, THE System SHALL apply them with AND logic

25.12. WHEN a date range is specified, THE System SHALL only count assignments for activities that were active during the date range

25.13. AN activity is considered active during a date range IF its startDate is on or before the range end AND (its endDate is null OR its endDate is on or after the range start)

25.14. WHEN no date range is specified, THE System SHALL count assignments for activities that are active on the current date (using CURRENT_DATE)

25.15. THE System SHALL apply daily granularity to all date comparisons (ignore time components)

25.16. WHEN population filter is specified, THE System SHALL only count assignments where the participant belongs to at least one of the specified populations

25.17. THE System SHALL use a JOIN with participant_populations table to filter assignments

25.18. THE System SHALL use DISTINCT to avoid counting the same assignment multiple times when a participant belongs to multiple specified populations

25.19. THE System SHALL return role distribution data in an optimized wire format with indexed lookups

25.20. THE data field SHALL be a list of lists where each inner list contains [roleIndex, count]

25.21. THE lookups field SHALL contain a roles array with objects containing id and name properties

25.22. THE metadata field SHALL contain a columns array with column names in order

25.23. Role indexes SHALL be 0-based integers referencing the roles lookup array

25.24. THE System SHALL provide a POST endpoint at `/api/v1/analytics/role-distribution`

25.25. THE endpoint SHALL accept the same filter parameters as the engagement metrics endpoint

25.26. THE endpoint SHALL require authentication

25.27. THE endpoint SHALL apply geographic authorization filtering

25.28. THE endpoint SHALL return a wire format response with role distribution data
