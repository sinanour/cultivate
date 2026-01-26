# Implementation Tasks: Geographic Breakdown Query Optimization

## Overview

This implementation plan converts the geographic breakdown optimization design into discrete coding tasks. The approach builds incrementally, starting with query builder methods, then integrating with the service, and finally adding pagination support.

## Tasks

- [ ] 1. Create geographic breakdown query builder
  - [x] 1.1 Create GeographicBreakdownQueryBuilder class
    - Create `src/services/analytics/geographic-breakdown-query-builder.ts`
    - Define class with constructor accepting Prisma client
    - Define QueryResult interface
    - _Requirements: 1.1-1.4_
  
  - [x] 1.2 Implement buildAreaDescendantsCTE() method
    - Accept area IDs and area-to-descendants mapping
    - Generate SQL VALUES clause: `VALUES ('area-1', ARRAY['area-1', 'child-1'])`
    - Return CTE string with proper formatting
    - _Requirements: 3.1-3.4_
  
  - [x] 1.3 Implement buildFilteredActivitiesCTE() method
    - Build base SELECT from activities table
    - Add JOIN with activity_venue_history
    - Add JOIN with venues
    - Add conditional JOIN with activity_types (if category filter)
    - Add conditional EXISTS for population filter
    - Apply all filters as WHERE conditions with push-down predicates
    - Use parameterized queries (@activityTypeIds, @startDate, etc.)
    - _Requirements: 5.1-5.5, 6.1-6.7_
  
  - [x] 1.4 Implement buildAreaMetricsCTE() method
    - SELECT from area_descendants CTE
    - LEFT JOIN with filtered_activities on geographicAreaId = ANY(descendant_ids)
    - LEFT JOIN with assignments
    - GROUP BY area_id
    - Add HAVING clause to filter zero-metric areas
    - Preserve areas with children using EXISTS subquery
    - _Requirements: 2.1-2.4, 7.1-7.4_
  
  - [x] 1.5 Implement buildGeographicBreakdownQuery() method
    - Combine all CTEs into final query
    - Add ORDER BY geographicAreaId for stable ordering
    - Add LIMIT/OFFSET for pagination (if provided)
    - Return QueryResult with SQL and parameters
    - _Requirements: 1.1-1.4, 8.6-8.8_
  
  - [x] 1.6 Implement buildCountQuery() method
    - Build main query without LIMIT/OFFSET
    - Wrap in COUNT subquery: `SELECT COUNT(*) FROM (...) AS count_query`
    - Return QueryResult
    - _Requirements: 9.1-9.2_

- [ ] 2. Update AnalyticsService
  - [x] 2.1 Inject GeographicBreakdownQueryBuilder
    - Add query builder to service constructor
    - Initialize in constructor
    - _Requirements: 1.1_
  
  - [x] 2.2 Refactor getGeographicBreakdown() - Part 1: Setup
    - Keep existing authorization validation
    - Keep existing logic to determine areas to return
    - Batch fetch descendants for all areas (existing logic)
    - Build area-to-descendants mapping
    - _Requirements: 3.1-3.4, 4.1-4.5_
  
  - [x] 2.3 Refactor getGeographicBreakdown() - Part 2: Query Execution
    - Call query builder to generate main SQL query
    - Call query builder to generate COUNT query
    - Execute both queries in parallel using Promise.all()
    - Handle query errors with proper error codes
    - _Requirements: 1.1-1.4, 9.3_
  
  - [x] 2.4 Refactor getGeographicBreakdown() - Part 3: Metadata
    - Fetch area metadata (name, type) in single query
    - Query for hasChildren flag in single query using GROUP BY
    - Merge query results with area metadata
    - _Requirements: 1.4_
  
  - [x] 2.5 Add pagination support
    - Accept optional pagination parameters
    - Validate page and pageSize
    - Pass pagination to query builder
    - Calculate pagination metadata from COUNT result
    - Return response with pagination metadata
    - _Requirements: 8.1-8.8, 9.4, 10.1-10.4_
  
  - [x] 2.6 Ensure backward compatibility
    - When no pagination params, return all results
    - Include pagination metadata even when not paginated
    - Maintain existing response structure
    - _Requirements: 11.1-11.5_

- [ ] 3. Update API route
  - [x] 3.1 Add pagination parameter extraction
    - Extract page from query params
    - Extract pageSize from query params
    - Parse as integers with defaults
    - _Requirements: 8.1-8.2_
  
  - [x] 3.2 Add pagination parameter validation
    - Validate page is positive integer
    - Validate pageSize is between 1 and 1000
    - Return 400 error for invalid values
    - _Requirements: 8.3-8.5_
  
  - [x] 3.3 Update route handler
    - Pass pagination params to service
    - Return response with pagination metadata
    - _Requirements: 10.1-10.4_

- [ ] 4. Write tests
  - [x] 4.1 Unit tests for query builder
    - Test area descendants CTE generation
    - Test filtered activities CTE with various filters
    - Test area metrics CTE with HAVING clause
    - Test pagination clause generation
    - Test COUNT query generation
    - _Requirements: All_
  
  - [x] 4.2 Unit tests for service
    - Test with no parent (top-level areas)
    - Test with parent (child areas)
    - Test with various filters
    - Test with pagination
    - Test authorization filtering
    - Test zero-row filtering
    - _Requirements: All_
  
  - [x] 4.3 Integration tests
    - Test against real database with test data
    - Verify query results match expected aggregations
    - Test pagination returns correct pages
    - Test COUNT query accuracy
    - Test backward compatibility
    - _Requirements: All_
  
  - [ ] 4.4 Performance tests
    - Measure query execution time for 10K activities
    - Measure COUNT query execution time
    - Measure memory usage
    - Compare against current implementation
    - _Requirements: 12.1-12.5_

- [ ] 5. Documentation
  - [x] 5.1 Update API documentation
    - Document pagination parameters
    - Add example requests with pagination
    - Document response format with pagination metadata
    - _Requirements: Documentation_
  
  - [x] 5.2 Add inline code documentation
    - Add JSDoc comments for all new methods
    - Document query structure and CTEs
    - Document HAVING clause logic
    - _Requirements: Documentation_
  
  - [x] 5.3 Create migration guide
    - Document changes from old implementation
    - Provide migration examples
    - Document backward compatibility
    - _Requirements: Documentation_

## Notes

- This optimization follows the same patterns as the engagement metrics optimization
- The main difference is that we maintain the existing response structure (no wire format change)
- Pagination is added as an optional feature for backward compatibility
- The HAVING clause filters zero-metric areas but preserves areas with children
- All aggregation is performed in PostgreSQL, not Node.js
