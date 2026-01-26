# Implementation Plan: Analytics Service Optimization

## Overview

This implementation plan converts the analytics service optimization design into discrete coding tasks. The approach is to build incrementally, starting with the query builder, then the executor, then the wire format transformer, and finally integrating with the frontend. Each step validates functionality through code before proceeding.

## Tasks

- [x] 1. Create query builder foundation
  - [x] 1.1 Create QueryBuilder class with interface
    - Create `src/services/analytics/query-builder.ts`
    - Define `QueryBuilder` interface with `buildEngagementQuery()` method
    - Implement constructor accepting Prisma client
    - _Requirements: 1.1, 2.1_
  
  - [x] 1.2 Implement base activity CTE builder
    - Implement `buildBaseActivityCTE()` method
    - Generate filtered_activities CTE with activity, type, category joins
    - Apply filter conditions (type, category, venue, population)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ]* 1.3 Write property test for filter combination
    - **Property 12: Multi-Dimensional Filter Support**
    - **Validates: Requirements 9.1-9.6**
  
  - [x] 1.4 Implement smart join optimization
    - Implement `determineRequiredJoins()` method
    - Analyze filters and grouping dimensions
    - Return list of required table joins
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 1.5 Write property test for smart join optimization
    - **Property 13: Smart Join Optimization**
    - **Validates: Requirements 10.1-10.4**

- [x] 2. Implement date overlap and snapshot logic
  - [x] 2.1 Implement date overlap condition builder
    - Implement `buildDateOverlapConditions()` method
    - Generate SQL for: startDate <= queryDate AND (endDate IS NULL OR endDate >= queryDate)
    - Apply daily granularity truncation (DATE() function)
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_
  
  - [ ]* 2.2 Write property test for date overlap logic
    - **Property 10: Date Overlap Logic Correctness**
    - **Validates: Requirements 7.1, 7.3**
  
  - [ ]* 2.3 Write property test for daily granularity
    - **Property 11: Daily Granularity Enforcement**
    - **Validates: Requirements 8.1-8.3**
  
  - [x] 2.4 Implement snapshot metrics CTE builder
    - Generate CTE with COUNT FILTER clauses for start/end snapshots
    - Include active activities, unique participants, total participation
    - Handle current date default (no date range specified)
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_
  
  - [ ]* 2.5 Write property test for snapshot completeness
    - **Property 7: Date Range Snapshot Completeness**
    - **Validates: Requirements 4.1, 4.2**
  
  - [ ]* 2.6 Write property test for current date default
    - **Property 8: Current Date Default Behavior**
    - **Validates: Requirements 4.3, 5.1-5.3**
  
  - [x] 2.7 Implement lifecycle event counting
    - Add COUNT FILTER for activities started (startDate in range)
    - Add COUNT FILTER for activities completed (endDate in range)
    - Conditionally include only when date range specified
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 2.8 Write property test for lifecycle events
    - **Property 9: Lifecycle Event Counting**
    - **Validates: Requirements 6.1-6.3**

- [ ] 3. Checkpoint - Ensure query builder tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement grouping and aggregation
  - [x] 4.1 Implement GROUPING SETS builder
    - Implement `buildGroupingSets()` method
    - Generate GROUPING SETS with full-grain grouping and total aggregation only
    - Use PostgreSQL GROUPING SETS syntax: (all dimensions), ()
    - Do NOT generate intermediate subset groupings
    - _Requirements: 11.1-11.11, 12.1-12.4_
  
  - [ ]* 4.2 Write property test for multi-dimensional grouping
    - **Property 14: Multi-Dimensional Grouping Support**
    - **Validates: Requirements 11.9, 11.10**
  
  - [ ]* 4.3 Write property test for no partial subsets
    - **Property 15: No Partial Subset Groupings**
    - **Validates: Requirements 11.11, 12.1-12.3**
  
  - [x] 4.4 Complete buildEngagementQuery() method
    - Combine all CTEs into final query
    - Add ORDER BY clause with NULLS FIRST for total row to appear first
    - Return SQL string and parameter object
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 4.5 Write property test for SQL aggregation functions
    - **Property 3: SQL Aggregation Functions**
    - **Validates: Requirements 2.1**
  
  - [ ]* 4.6 Write property test for GROUPING SETS
    - **Property 4: GROUPING SETS for Total Aggregation**
    - **Validates: Requirements 2.3, 11.10, 12.1, 12.4**

- [x] 5. Create query executor component
  - [x] 5.1 Create QueryExecutor class
    - Create `src/services/analytics/query-executor.ts`
    - Define `QueryExecutor` interface
    - Implement constructor accepting Prisma client
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 5.2 Implement executeEngagementQuery() method
    - Wrap Prisma.$queryRaw with error handling
    - Add retry logic for transient failures (max 3 attempts)
    - Set query timeout (30 seconds)
    - Log queries and errors
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 5.3 Write property test for maximum two queries
    - **Property 1: Maximum Two Database Queries**
    - **Validates: Requirements 1.1-1.3**
  
  - [x] 5.4 Implement fetchDimensionLookups() method
    - Query activity types (id, name) for type IDs in results
    - Query activity categories (id, name) for category IDs in results
    - Query geographic areas (id, name) for area IDs in results
    - Return as DimensionLookups object
    - _Requirements: 3.3_
  
  - [ ]* 5.5 Write property test for separate lookup query
    - **Property 6: Separate Lightweight Lookup Query**
    - **Validates: Requirements 3.3**
  
  - [ ]* 5.6 Write property test for database-level aggregation
    - **Property 2: Database-Level Aggregation**
    - **Validates: Requirements 2.2**
  
  - [ ]* 5.7 Write property test for query result structure
    - **Property 5: Query Result Contains Only Aggregates**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 6. Checkpoint - Ensure query executor tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create wire format transformer
  - [x] 7.1 Create WireFormatTransformer class
    - Create `src/services/analytics/wire-format-transformer.ts`
    - Define `WireFormatTransformer` interface
    - Implement constructor
    - _Requirements: 13.1-13.9_
  
  - [x] 7.2 Implement buildLookupArrays() method
    - Extract unique dimension IDs from query results
    - Fetch dimension names from lookups
    - Build ordered arrays of {id, name} objects
    - _Requirements: 13.2, 13.7_
  
  - [ ]* 7.3 Write property test for lookup array structure
    - **Property 17: Lookup Array Structure**
    - **Validates: Requirements 13.2, 13.7**
  
  - [x] 7.4 Implement convertIdsToIndexes() method
    - Create ID-to-index mapping for each dimension
    - Convert dimension IDs in query results to array indexes
    - Use -1 for null dimension values (aggregated rows)
    - _Requirements: 13.3, 13.4_
  
  - [x] 7.5 Implement buildMetadata() method
    - Generate column header names based on grouping dimensions
    - Include dimension index columns first, then metric columns
    - Add groupingDimensions and hasDateRange flags
    - _Requirements: 13.6_
  
  - [ ]* 7.6 Write property test for metadata completeness
    - **Property 18: Metadata Completeness**
    - **Validates: Requirements 13.6**
  
  - [x] 7.7 Implement formatDataRows() method
    - Convert query results to list-of-lists format
    - Place dimension indexes first, then metric values
    - Ensure column order matches metadata
    - _Requirements: 13.1, 13.5_
  
  - [ ]* 7.8 Write property test for wire format structure
    - **Property 16: Wire Format Structure**
    - **Validates: Requirements 13.1, 13.3-13.5**
  
  - [x] 7.9 Implement transformToWireFormat() method
    - Orchestrate all transformation steps
    - Return EngagementWireFormat object
    - _Requirements: 13.1-13.9_
  
  - [ ]* 7.10 Write property test for column count
    - **Property 19: Column Count Correctness**
    - **Validates: Requirements 13.8, 13.9**

- [x] 8. Create optimized analytics service
  - [x] 8.1 Create OptimizedAnalyticsService class
    - Create `src/services/analytics/optimized-analytics.service.ts`
    - Inject QueryBuilder, QueryExecutor, WireFormatTransformer
    - Implement constructor
    - _Requirements: 1.1-14.6_
  
  - [x] 8.2 Implement getEngagementMetrics() method
    - Handle geographic authorization (reuse existing logic)
    - Call QueryBuilder.buildEngagementQuery()
    - Call QueryExecutor.executeEngagementQuery()
    - Call QueryExecutor.fetchDimensionLookups()
    - Call WireFormatTransformer.transformToWireFormat()
    - Return EngagementWireFormat
    - _Requirements: 1.1-13.9_
  
  - [ ]* 8.3 Write integration test for full flow
    - Test complete request/response cycle
    - Verify wire format structure
    - Test with various filter/grouping combinations
    - _Requirements: 1.1-13.9_
  
  - [x] 8.4 Add error handling
    - Wrap query execution in try-catch
    - Handle authorization errors (403)
    - Handle query errors (500)
    - Handle timeout errors (504)
    - Log errors with context
    - _Requirements: Error Handling section_
  
  - [ ]* 8.5 Write unit tests for error handling
    - Test invalid filter combinations
    - Test authorization failures
    - Test database connection errors
    - Test query timeout errors
    - _Requirements: Error Handling section_

- [ ] 9. Checkpoint - Ensure optimized service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Update API endpoint
  - [x] 10.1 Create new API endpoint route
    - Add POST /api/analytics/engagement-optimized endpoint
    - Wire up OptimizedAnalyticsService
    - Add request validation middleware
    - _Requirements: 14.1_
  
  - [x] 10.2 Add request/response types
    - Define EngagementRequest DTO
    - Define EngagementWireFormat response type
    - Add OpenAPI/Swagger documentation
    - _Requirements: 13.1-13.9_
  
  - [ ]* 10.3 Write API integration tests
    - Test endpoint with various request payloads
    - Verify response format matches specification
    - Test error responses (400, 403, 500)
    - _Requirements: 14.1_

- [x] 11. Update frontend EngagementDashboard
  - [x] 11.1 Create wire format parser utility
    - Create `web-frontend/src/utils/wireFormatParser.ts`
    - Implement parseEngagementWireFormat() function
    - Convert indexed data to human-readable objects
    - Resolve dimension indexes using lookup arrays
    - _Requirements: 14.2, 14.3_
  
  - [ ]* 11.2 Write property test for wire format parsing
    - **Property 20: Frontend Wire Format Parsing**
    - **Validates: Requirements 14.2, 14.3**
  
  - [x] 11.3 Update EngagementDashboard API call
    - Replace old API call with new optimized endpoint
    - Update request payload format
    - Handle new response structure
    - _Requirements: 14.1_
  
  - [x] 11.4 Update engagement summary table rendering
    - Parse wire format data
    - Display dimension names from lookups
    - Render metric columns
    - Handle total aggregation row (appears first with NULLS FIRST ordering)
    - _Requirements: 14.4_
  
  - [x] 11.5 Update activity breakdown charts
    - Extract grouped metrics from wire format
    - Map dimension indexes to names
    - Render charts with parsed data
    - _Requirements: 14.5_
  
  - [x]* 11.6 Write unit tests for dashboard components
    - Test table rendering with wire format data
    - Test chart rendering with grouped metrics
    - Test error handling for malformed responses
    - _Requirements: 14.4, 14.5_

- [x] 12. Performance testing and optimization
  - [ ]* 12.1 Write performance benchmark tests
    - Measure query execution time for 10K, 100K activities
    - Measure wire format payload size
    - Measure memory usage during query execution
    - Compare against current implementation baseline
    - _Requirements: Testing Strategy - Performance Testing_
  
  - [x] 12.2 Add database indexes if needed
    - Analyze query execution plans
    - Add indexes for frequently filtered columns
    - Add indexes for join columns
    - _Requirements: Performance optimization_
  
  - [x] 12.3 Optimize query if performance targets not met
    - Review CTE structure
    - Consider materialized CTEs if beneficial
    - Optimize GROUPING SETS if needed
    - _Requirements: Performance optimization_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Documentation and migration
  - [x] 14.1 Update API documentation
    - Document new endpoint in API_CONTRACT.md
    - Add wire format specification
    - Add example requests/responses
    - _Requirements: Documentation_
  
  - [x] 14.2 Create migration guide
    - Document differences from old API
    - Provide migration examples
    - Document breaking changes
    - _Requirements: Documentation_
  
  - [x] 14.3 Add inline code documentation
    - Add JSDoc comments to all public methods
    - Document wire format structure
    - Document query builder logic
    - _Requirements: Documentation_

- [x] 15. Enhancement: Zero-Row Filtering
  - [x] 15.1 Implement HAVING clause builder
    - Create `buildHavingClause()` method in QueryBuilder
    - Generate HAVING conditions for no date range (3 metrics)
    - Generate HAVING conditions for date range (8 metrics)
    - Preserve total aggregation row (all dimension IDs NULL)
    - _Requirements: Enhancement Req 1.1-1.5_
  
  - [x] 15.2 Integrate HAVING clause into query
    - Add HAVING clause after GROUP BY
    - Add HAVING clause before ORDER BY
    - Test with sparse data (many zero rows)
    - Verify total row is preserved
    - _Requirements: Enhancement Req 1.4-1.5_
  
  - [ ]* 15.3 Write unit tests for HAVING clause
    - Test HAVING clause generation without date range
    - Test HAVING clause generation with date range
    - Test total row preservation
    - Test zero-row filtering effectiveness
    - _Requirements: Enhancement Req 1.1-1.5_
  
  - [ ]* 15.4 Write integration tests for zero-row filtering
    - Test with real database and sparse data
    - Verify payload size reduction
    - Verify query performance impact
    - _Requirements: Enhancement Req 1.1-1.5_

- [x] 16. Enhancement: Pagination Support
  - [x] 16.1 Add pagination parameters to interfaces
    - Add `PaginationParams` interface (page, pageSize)
    - Add `PaginationMetadata` interface (page, pageSize, totalRecords, totalPages, hasNextPage, hasPreviousPage)
    - Update `AnalyticsFilters` to include pagination params
    - Update `EngagementWireFormat` metadata to include pagination
    - _Requirements: Enhancement Req 3.1-3.4, 6.1-6.3_
  
  - [x] 16.2 Implement pagination clause builder
    - Create `buildPaginationClause()` method in QueryBuilder
    - Calculate offset: `(page - 1) * pageSize`
    - Generate LIMIT and OFFSET SQL
    - Validate page and pageSize parameters
    - _Requirements: Enhancement Req 3.1-3.5, 4.1-4.3_
  
  - [x] 16.3 Implement COUNT query builder
    - Create `buildCountQuery()` method in QueryBuilder
    - Wrap main query (without LIMIT/OFFSET) in subquery
    - Use `SELECT COUNT(*) FROM (main_query) AS count_query`
    - Apply same filters and HAVING clause as main query
    - _Requirements: Enhancement Req 5.1-5.3_
  
  - [x] 16.4 Update QueryExecutor for parallel queries
    - Create `executeCountQuery()` method
    - Execute main query and COUNT query in parallel using Promise.all()
    - Return both results and total count
    - Handle errors for both queries
    - _Requirements: Enhancement Req 5.4_
  
  - [x] 16.5 Update WireFormatTransformer for pagination metadata
    - Calculate totalPages: `Math.ceil(totalRecords / pageSize)`
    - Calculate hasNextPage: `page < totalPages`
    - Calculate hasPreviousPage: `page > 1`
    - Add pagination object to metadata
    - Handle case when no pagination params provided
    - _Requirements: Enhancement Req 6.1-6.3_
  
  - [x] 16.6 Update OptimizedAnalyticsService
    - Accept pagination parameters in method signature
    - Pass pagination params to QueryBuilder
    - Extract total count from QueryExecutor results
    - Pass total count to WireFormatTransformer
    - _Requirements: Enhancement Req 3.1-3.5_
  
  - [x] 16.7 Update API route validation
    - Add `page` query parameter to validation schema (optional, positive integer, default: 1)
    - Add `pageSize` query parameter to validation schema (optional, 1-1000, default: 100)
    - Return 400 error for invalid pagination params
    - Pass pagination params to service
    - _Requirements: Enhancement Req 3.1-3.5_
  
  - [ ]* 16.8 Write unit tests for pagination
    - Test pagination clause generation
    - Test COUNT query generation
    - Test offset calculation
    - Test pagination metadata calculation
    - Test validation of pagination parameters
    - _Requirements: Enhancement Req 3.1-6.3_
  
  - [ ]* 16.9 Write integration tests for pagination
    - Test pagination returns correct page of results
    - Test pagination with different page sizes
    - Test COUNT query matches actual result count
    - Test stable ordering across pages
    - Test no duplicate rows across pages
    - Test backward compatibility (no pagination params)
    - _Requirements: Enhancement Req 2.1-2.4, 4.1-4.4, 10.1-10.4_

- [x] 17. Frontend: Pagination Integration
  - [x] 17.1 Update AnalyticsService API method
    - Add `page` and `pageSize` parameters to `getEngagementMetricsOptimized()`
    - Include pagination params in API request query string
    - _Requirements: Enhancement Req 7.1-7.5_
  
  - [x] 17.2 Update wire format parser
    - Extract pagination metadata from wire format
    - Return pagination metadata along with parsed data
    - Handle missing pagination metadata (backward compatibility)
    - _Requirements: Enhancement Req 6.1-6.3_
  
  - [x] 17.3 Add pagination state to EngagementDashboard
    - Add state for currentPage (default: 1)
    - Add state for pageSize (default: 100)
    - Include page and pageSize in query key
    - Reset to page 1 when filters or grouping change
    - _Requirements: Enhancement Req 7.1-7.5, 8.1-8.5_
  
  - [x] 17.4 Add CloudScape Pagination component
    - Import Pagination component from CloudScape
    - Place below Engagement Summary table
    - Wire up currentPageIndex to state
    - Wire up pagesCount from pagination metadata
    - Handle onChange event to update currentPage
    - _Requirements: Enhancement Req 7.1-7.3_
  
  - [x] 17.5 Add page size selector
    - Add Select component for page size
    - Options: 25, 50, 100, 200
    - Default: 100
    - Handle onChange event to update pageSize
    - Reset to page 1 when page size changes
    - _Requirements: Enhancement Req 7.4-7.5_
  
  - [x] 17.6 Implement URL state management
    - Add `page` and `pageSize` to URL query parameters
    - Update URL when pagination changes (using useSearchParams)
    - Initialize pagination state from URL on mount
    - Handle browser back/forward navigation
    - _Requirements: Enhancement Req 9.1-9.4_
  
  - [x] 17.7 Add loading indicators for pagination
    - Show loading spinner during page transitions
    - Disable pagination controls while loading
    - Use placeholderData to prevent flicker
    - _Requirements: Enhancement Req 8.4_
  
  - [ ]* 17.8 Write unit tests for frontend pagination
    - Test pagination controls render correctly
    - Test page change triggers new API request
    - Test page size change triggers new API request
    - Test pagination resets to page 1 when filters change
    - Test URL updates with page and page size
    - Test URL state restoration
    - _Requirements: Enhancement Req 7.1-9.4_
  
  - [ ]* 17.9 Write integration tests for lazy loading
    - Test lazy loading fetches only current page
    - Test navigation between pages
    - Test page size selector
    - Test backward compatibility with non-paginated data
    - _Requirements: Enhancement Req 8.1-8.5, 10.1-10.4_

- [ ] 18. Enhancement: Testing and Validation
  - [ ]* 18.1 Performance benchmarks for zero-row filtering
    - Measure payload size reduction with sparse data
    - Measure HAVING clause overhead (target: < 5ms)
    - Compare against baseline without filtering
    - _Requirements: Enhancement performance targets_
  
  - [ ]* 18.2 Performance benchmarks for pagination
    - Measure payload size reduction with pagination
    - Measure COUNT query execution time (target: < 100ms)
    - Measure parallel query execution efficiency
    - Test with various page sizes (25, 50, 100, 200)
    - _Requirements: Enhancement performance targets_
  
  - [ ]* 18.3 End-to-end testing
    - Test complete flow from frontend to database
    - Test with large datasets (10K+ activities)
    - Verify pagination works correctly across all pages
    - Verify zero-row filtering reduces payload
    - Test backward compatibility
    - _Requirements: Enhancement Req 10.1-10.4_

- [ ] 19. Enhancement: Documentation
  - [ ] 19.1 Update API documentation
    - Document pagination parameters in API_CONTRACT.md
    - Add pagination metadata specification
    - Add example requests with pagination
    - Document zero-row filtering behavior
    - _Requirements: Enhancement documentation_
  
  - [ ] 19.2 Update migration guide
    - Document pagination feature
    - Provide pagination examples
    - Document backward compatibility
    - Add performance improvement metrics
    - _Requirements: Enhancement documentation_
  
  - [ ] 19.3 Add inline code documentation
    - Add JSDoc comments for pagination methods
    - Document HAVING clause logic
    - Document COUNT query logic
    - Document pagination metadata calculation
    - _Requirements: Enhancement documentation_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with Prisma ORM and PostgreSQL
- The wire format uses indexed lookups to minimize payload size
- All database aggregation is performed in PostgreSQL, not Node.js
