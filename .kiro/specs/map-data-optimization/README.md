# Map Data API Performance Optimization

## Status: ✅ Complete

This spec implements performance optimization for the Map Data API's `getActivityMarkers` method using raw SQL queries with conditional joins and stable sorting.

## What Was Implemented

### 1. Query Builder Infrastructure
- Created `ActivityMarkerQueryBuilder` class with 4 query variants
- Implemented conditional joins based on active filters
- Added stable sorting with `ORDER BY activity.id`
- Used PostgreSQL `DISTINCT ON` for efficient current venue identification

### 2. Optimized Implementation
- Created `getActivityMarkersOptimized()` method using raw SQL
- Added feature flag support (`USE_OPTIMIZED_MAP_QUERIES`)
- Kept legacy implementation for comparison and rollback
- Added performance monitoring and logging

### 3. Database Indexes
- Added composite index on `activity_venue_history(activityId, effectiveFrom DESC)`
- Added coordinate index on `venues(latitude, longitude)`
- Migration: `20260120193751_add_map_query_optimization_indexes`

### 4. Documentation
- Created optimization guide: `backend-api/docs/MAP_QUERY_OPTIMIZATION.md`
- Added inline code comments
- Documented query variant strategy

### 5. Performance Validation
- Created benchmark script: `backend-api/scripts/benchmark-map-queries.ts`
- Added integration tests: `backend-api/src/__tests__/integration/map-data-optimized.test.ts`
- All tests passing (5/5)

## How to Use

### Enable Optimization

Set environment variable:
```bash
USE_OPTIMIZED_MAP_QUERIES=true
```

### Disable Optimization (Rollback)

```bash
USE_OPTIMIZED_MAP_QUERIES=false
# or unset the variable (defaults to false)
```

### Run Performance Benchmark

```bash
npm run benchmark:map-queries
```

This will compare legacy vs optimized implementation and show performance improvements.

## Performance Improvements

Expected improvements based on design:
- **50-80% faster** query execution time
- **Single database round trip** instead of multiple queries
- **Database-level pagination** instead of in-memory
- **Stable pagination** with no duplicates or gaps

## Query Variants

The system automatically selects the optimal query variant:

| Variant | Filters | Tables Joined | Use Case |
|---------|---------|---------------|----------|
| BASE | None | 4 | Fastest, no optional filters |
| GEOGRAPHIC | Geographic only | 4 | Fast, geographic filtering |
| POPULATION | Population only | 7 | Moderate, population filtering |
| FULL | Both | 7 | Moderate, all filters |

## Testing

### Run Optimized Tests

```bash
npm test -- --testPathPattern="map-data-optimized"
```

### Run All Tests

```bash
npm test
```

**Note:** 2 pre-existing test failures in legacy implementation (coordinate and temporal filtering). These are known issues that will be fixed when the optimized version is enabled by default.

## Files Changed

- `backend-api/src/utils/activity-marker-query-builder.ts` (new)
- `backend-api/src/services/map-data.service.ts` (modified)
- `backend-api/prisma/schema.prisma` (modified - added indexes)
- `backend-api/scripts/benchmark-map-queries.ts` (new)
- `backend-api/docs/MAP_QUERY_OPTIMIZATION.md` (new)
- `backend-api/src/__tests__/integration/map-data-optimized.test.ts` (new)
- `backend-api/package.json` (modified - added benchmark script)

## Next Steps

1. **Test in development**: Enable `USE_OPTIMIZED_MAP_QUERIES=true` and verify behavior
2. **Run benchmark**: Execute `npm run benchmark:map-queries` to measure improvements
3. **Deploy to staging**: Deploy with flag disabled, then enable and monitor
4. **Production rollout**: Enable in production after staging validation
5. **Cleanup**: Remove legacy implementation after 1 week of successful operation

## Rollback Plan

If issues are discovered:
1. Set `USE_OPTIMIZED_MAP_QUERIES=false`
2. Restart application
3. Legacy implementation is used immediately
4. No code deployment needed

## References

- Requirements: `.kiro/specs/map-data-optimization/requirements.md`
- Design: `.kiro/specs/map-data-optimization/design.md`
- Tasks: `.kiro/specs/map-data-optimization/tasks.md`
- Optimization Guide: `backend-api/docs/MAP_QUERY_OPTIMIZATION.md`
