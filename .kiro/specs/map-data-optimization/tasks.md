# Implementation Plan: Map Data API Performance Optimization

## Overview

This implementation plan covers the optimization of the `getActivityMarkers` method in MapDataService using raw SQL queries with conditional joins, database-level pagination, and stable sorting. The goal is to achieve 50-80% performance improvement while maintaining backward compatibility.

## Tasks

- [x] 1. Create query builder infrastructure
  - [x] 1.1 Create ActivityMarkerQueryBuilder class
    - Create new file `backend-api/src/utils/activity-marker-query-builder.ts`
    - Define QueryVariant enum (BASE, GEOGRAPHIC, POPULATION, FULL)
    - Implement constructor that accepts filters, effectiveVenueIds, boundingBox, limit, offset
    - Implement selectVariant() method to choose optimal query variant based on filters
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.2 Implement base query builder
    - Implement buildBaseQuery() method for queries without optional filters
    - Build CTE for current venues using DISTINCT ON
    - Build SELECT clause with window function COUNT(*) OVER()
    - Build FROM and JOIN clauses for Activity, ActivityType, current_venues
    - Build WHERE clause with activity type, category, status, date, and bounding box filters
    - Add ORDER BY a.id for stable sorting
    - Add LIMIT and OFFSET for pagination
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.15, 1.16, 1.17, 1.20, 1.21, 3.1, 3.3, 3.4, 3.7, 3.8_

  - [x] 1.3 Implement geographic query variant
    - Implement buildGeographicQuery() method
    - Apply geographic filter in CTE WHERE clause (v."geographicAreaId" = ANY($areaIds))
    - Use same structure as base query but with early geographic filtering
    - Maintain ORDER BY a.id for stable sorting
    - _Requirements: 1.9, 1.10, 1.11, 1.20, 1.21_

  - [x] 1.4 Implement population query variant
    - Implement buildPopulationQuery() method
    - Add INNER JOIN for Assignment, Participant, ParticipantPopulation tables
    - Add population filter in WHERE clause (pp."populationId" = ANY($populationIds))
    - Add GROUP BY clause to deduplicate activities with multiple matching participants
    - Maintain ORDER BY a.id for stable sorting
    - _Requirements: 1.7, 1.8, 1.20, 1.21_

  - [x] 1.5 Implement full query variant
    - Implement buildFullQuery() method combining geographic and population filters
    - Apply geographic filter in CTE
    - Add population joins in main query
    - Add GROUP BY clause for deduplication
    - Maintain ORDER BY a.id for stable sorting
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 1.11, 1.20, 1.21_

  - [x] 1.6 Implement CTE builder for current venues
    - Implement buildCurrentVenuesCTE() method
    - Use DISTINCT ON (avh."activityId") to get one venue per activity
    - Join ActivityVenueHistory with Venue
    - Filter out venues without coordinates (latitude/longitude IS NOT NULL)
    - Apply optional geographic filter when effectiveVenueIds is provided
    - Order by activityId, effectiveFrom DESC NULLS LAST
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 1.7 Implement WHERE clause builder
    - Implement buildWhereClause() method
    - Add activity type filter (a."activityTypeId" = ANY($activityTypeIds))
    - Add activity category filter (at."activityCategoryId" = ANY($activityCategoryIds))
    - Add status filter (a.status = $status)
    - Add population filter when includePopulationFilter is true
    - Add date range filters with temporal overlap logic
    - Add bounding box filters with date line handling
    - Use conditional logic to include only active filters
    - _Requirements: 1.12, 1.13, 1.14, 1.15, 1.16, 1.17_

  - [x] 1.8 Implement bounding box filter builder
    - Implement buildBoundingBoxConditions() method
    - Add latitude range filters (cv.latitude >= $minLat AND cv.latitude <= $maxLat)
    - Add longitude range filters with date line crossing logic
    - When minLon > maxLon: use OR logic (longitude >= minLon OR longitude <= maxLon)
    - When minLon <= maxLon: use AND logic (longitude >= minLon AND longitude <= maxLon)
    - _Requirements: 1.12, 1.13, 1.14_

  - [x] 1.9 Add query builder utility methods
    - Implement getVariant() method to return selected query variant
    - Implement needsGroupBy() method to determine if GROUP BY is required
    - Add validation for filter parameters
    - Add helper methods for SQL fragment generation
    - _Requirements: 2.8, 2.9_

  - [ ]* 1.10 Write unit tests for query builder
    - Test variant selection logic (base, geographic, population, full)
    - Test SQL generation for each variant
    - Test WHERE clause construction with different filter combinations
    - Test bounding box filter with and without date line crossing
    - Test that all variants include ORDER BY a.id
    - Test that population variant includes GROUP BY
    - Verify generated SQL is valid PostgreSQL syntax
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_


- [x] 2. Implement optimized getActivityMarkers method
  - [x] 2.1 Add type definitions for query results
    - Create ActivityMarkerRow interface in map-data.service.ts
    - Define fields: id (string), latitude (any), longitude (any), activityTypeId (string), activityCategoryId (string), total_count (bigint)
    - Add type conversion utilities for Decimal and bigint types
    - _Requirements: 1.16, 4.1, 4.2_

  - [x] 2.2 Create getActivityMarkersOptimized method
    - Add new method to MapDataService class
    - Keep existing authorization logic (getEffectiveGeographicAreaIds)
    - Handle early returns for empty authorized areas
    - Instantiate ActivityMarkerQueryBuilder with filters and pagination params
    - Execute query using prisma.$queryRaw with Prisma.raw()
    - Extract total count from first row's total_count field (window function result)
    - Transform query results to ActivityMarker[] with type conversions
    - Return PaginatedResponse with data and pagination metadata
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.16, 1.17, 4.1, 4.2, 4.3_

  - [x] 2.3 Add performance monitoring
    - Add execution time measurement using performance.now()
    - Log query variant selected
    - Log execution time, rows returned, and total count
    - Log filter presence (population, geographic, bounding box, date range)
    - Make logging conditional on NODE_ENV === 'development'
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 2.4 Add feature flag support
    - Add USE_OPTIMIZED_MAP_QUERIES environment variable check
    - Rename existing getActivityMarkers to getActivityMarkersLegacy
    - Create new getActivityMarkers that switches between legacy and optimized
    - Default to legacy implementation (USE_OPTIMIZED_MAP_QUERIES=false)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 2.5 Handle edge cases
    - Handle empty result sets (return empty array with total=0)
    - Handle null filter parameters (use NULL in SQL)
    - Validate page and limit parameters (page >= 1, limit 1-100)
    - Handle Prisma query errors with try-catch
    - Convert Decimal types to numbers for latitude/longitude
    - Convert bigint to number for total_count
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 2.6 Write integration tests for optimized method
    - Test pagination consistency (no duplicates across pages)
    - Test with no filters (base query variant)
    - Test with population filter (population query variant)
    - Test with geographic filter (geographic query variant)
    - Test with both filters (full query variant)
    - Test with bounding box filter
    - Test with date range filters
    - Test with all filters combined
    - Verify total count accuracy
    - Verify stable ordering by activity ID
    - Compare results with legacy implementation for consistency
    - Measure and verify performance improvement (>50% faster)
    - _Requirements: 1.1-1.24, 3.1-3.8, 4.1-4.8, 5.7_


- [x] 3. Verify database indexes
  - [x] 3.1 Check existing indexes
    - Query PostgreSQL system tables to list existing indexes
    - Verify primary key indexes exist on all ID columns
    - Verify foreign key indexes exist on all foreign key columns
    - Verify composite index exists on ActivityVenueHistory (activityId, effectiveFrom DESC)
    - Verify coordinate indexes exist on Venue (latitude, longitude)
    - _Requirements: Database performance_

  - [x] 3.2 Create missing indexes if needed
    - Create Prisma migration for any missing indexes
    - Add composite index on ActivityVenueHistory if missing
    - Add coordinate indexes on Venue if missing
    - Run migration against development database
    - Verify indexes are created successfully
    - _Requirements: Database performance_

  - [ ]* 3.3 Analyze query execution plans
    - Use EXPLAIN ANALYZE to examine query plans for each variant
    - Verify indexes are being used (no sequential scans on large tables)
    - Verify join order is optimal
    - Verify DISTINCT ON is using index
    - Document any performance issues found
    - _Requirements: Database performance_

- [x] 4. Update documentation
  - [x] 4.1 Add inline code comments
    - Document query builder class and methods
    - Explain query variant selection logic
    - Document DISTINCT ON approach for current venue
    - Explain stable sorting with ORDER BY activity.id
    - Document parameter binding with Prisma.sql
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.2 Update OpenAPI specification
    - No changes needed (API contract unchanged)
    - Add performance notes to endpoint descriptions
    - Document that pagination is now stable and deterministic
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.3 Create optimization guide
    - Document when to use raw SQL vs ORM
    - Explain query variant strategy
    - Provide examples of conditional joins
    - Document stable sorting requirements for pagination
    - Add troubleshooting guide for common issues
    - _Requirements: 7.6_


- [x] 5. Performance validation
  - [x] 5.1 Create performance benchmark script
    - Create script to measure query execution time
    - Test with varying data volumes (1k, 10k, 100k activities)
    - Test with different filter combinations
    - Compare legacy vs optimized implementation
    - Generate performance report with metrics
    - _Requirements: 5.7_

  - [x] 5.2 Run load tests with fake data
    - Generate large dataset using existing fake data script
    - Run benchmark script against large dataset
    - Verify query time is under 200ms for 100k+ activities
    - Verify memory usage is reduced (no in-memory pagination)
    - Verify database load is reduced (single query vs multiple)
    - _Requirements: 1.22, Performance requirements_

  - [x] 5.3 Validate pagination consistency
    - Create test that fetches all pages sequentially
    - Verify no duplicates across pages
    - Verify no gaps (all activities returned exactly once)
    - Verify total count is consistent across all pages
    - Test with different page sizes (10, 50, 100)
    - _Requirements: 1.4, 1.5, 3.7, 3.8_

  - [x] 5.4 Compare results with legacy implementation
    - Run same queries through both implementations
    - Compare returned activity IDs (should be identical sets)
    - Compare total counts (should be identical)
    - Verify all filters produce same results
    - Document any discrepancies found
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 6. Checkpoint - Verify optimization is working correctly
  - Ensure all tests pass
  - Verify performance improvement meets target (>50% faster)
  - Verify pagination is stable and consistent
  - Verify results match legacy implementation
  - Ask user if questions arise


- [ ] 7. Optional: Optimize participant home markers (if time permits)
  - [ ] 7.1 Create ParticipantHomeQueryBuilder class
    - Apply same optimization approach as activity markers
    - Handle temporal filtering for address history
    - Group by venue and count participants
    - Use conditional joins for population filter
    - Maintain stable ordering for pagination
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 7.2 Implement optimized getParticipantHomeMarkers method
    - Replace current implementation with raw SQL query
    - Use query builder to construct optimal query
    - Apply same feature flag pattern
    - Add performance monitoring
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.3 Write integration tests for participant home optimization
    - Test pagination consistency
    - Test temporal filtering
    - Test population filtering
    - Compare with legacy implementation
    - Measure performance improvement
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Deployment and monitoring
  - [x] 8.1 Deploy to staging environment
    - Set USE_OPTIMIZED_MAP_QUERIES=false initially
    - Deploy code with both implementations
    - Run smoke tests to verify deployment
    - _Requirements: Deployment_

  - [x] 8.2 Enable optimization in staging
    - Set USE_OPTIMIZED_MAP_QUERIES=true
    - Monitor application logs for errors
    - Monitor database query performance
    - Run integration tests against staging
    - Verify no regressions
    - _Requirements: Deployment_

  - [x] 8.3 Production rollout
    - Deploy to production with USE_OPTIMIZED_MAP_QUERIES=false
    - Monitor for 24 hours with legacy implementation
    - Enable optimization (USE_OPTIMIZED_MAP_QUERIES=true)
    - Monitor query performance and error rates
    - Verify performance improvement in production
    - _Requirements: Deployment_

  - [x] 8.4 Cleanup legacy code
    - After 1 week of successful production operation
    - Remove getActivityMarkersLegacy method
    - Remove feature flag logic
    - Remove USE_OPTIMIZED_MAP_QUERIES environment variable
    - Update documentation to reflect final implementation
    - _Requirements: Maintainability_


## Implementation Notes

### Query Builder Pattern

The query builder uses a modular approach where SQL fragments are composed based on active filters:

```typescript
class ActivityMarkerQueryBuilder {
  private variant: QueryVariant;
  
  constructor(filters, effectiveVenueIds, boundingBox, limit, offset) {
    this.variant = this.selectVariant();
  }
  
  public build(): string {
    // Select appropriate query based on variant
    switch (this.variant) {
      case QueryVariant.BASE: return this.buildBaseQuery();
      case QueryVariant.GEOGRAPHIC: return this.buildGeographicQuery();
      case QueryVariant.POPULATION: return this.buildPopulationQuery();
      case QueryVariant.FULL: return this.buildFullQuery();
    }
  }
}
```

### Parameter Binding

Use Prisma's tagged template literals for safe parameter binding:

```typescript
const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
  ${Prisma.raw(queryBuilder.build())}
`;
```

Or inline parameters directly:

```typescript
const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
  SELECT a.id, cv.latitude, cv.longitude
  FROM "Activity" a
  WHERE a."activityTypeId" = ANY(${filters.activityTypeIds || null}::uuid[])
  ORDER BY a.id
  LIMIT ${limit} OFFSET ${offset}
`;
```

### Stable Sorting

Every query MUST include:
```sql
ORDER BY a.id
LIMIT $limit OFFSET $offset
```

This ensures:
- Deterministic ordering (same query = same order)
- Consistent pagination (page 2 follows page 1)
- No duplicates or gaps

### Testing Strategy

1. **Unit tests**: Test query builder in isolation
2. **Integration tests**: Test full method with real database
3. **Performance tests**: Measure execution time improvements
4. **Compatibility tests**: Compare results with legacy implementation


## Risk Mitigation

### Risk 1: SQL Injection
**Mitigation:** Use Prisma's parameter binding (tagged templates) for all user inputs. Never concatenate user input into SQL strings.

### Risk 2: Breaking Changes
**Mitigation:** Feature flag allows instant rollback. Keep legacy implementation until optimization is validated in production.

### Risk 3: Query Performance Regression
**Mitigation:** Benchmark before and after. Monitor query execution time in production. Rollback if performance degrades.

### Risk 4: Incorrect Results
**Mitigation:** Integration tests compare optimized vs legacy results. Validate with production-like data volumes.

### Risk 5: Database Compatibility
**Mitigation:** Use PostgreSQL-specific features (DISTINCT ON) that are well-supported. Document PostgreSQL version requirement (14+).

## Success Criteria

- [ ] Query execution time reduced by at least 50%
- [ ] All integration tests pass
- [ ] Results match legacy implementation exactly
- [ ] Pagination is stable (no duplicates or gaps)
- [ ] No increase in error rates
- [ ] Memory usage reduced (no in-memory pagination)
- [ ] Code is well-documented and maintainable

## Notes

- Tasks marked with `*` are optional and can be skipped for faster delivery
- Each task references specific requirements for traceability
- Checkpoint ensures validation before deployment
- Feature flag enables safe rollout and rollback
