# Map Query Optimization Guide

## Overview

The Map Data API uses optimized raw SQL queries with conditional joins for significantly improved performance. This guide explains the query variant strategy, when to use raw SQL vs ORM abstractions, and troubleshooting tips.

## When to Use Raw SQL vs ORM

### Use Prisma ORM When:
- Simple CRUD operations (single table)
- Type safety is critical
- Query complexity is low
- Performance is acceptable
- Maintainability is priority

### Use Raw SQL When:
- Complex multi-table joins
- Conditional joins based on runtime filters
- Advanced PostgreSQL features (DISTINCT ON, window functions, CTEs)
- Performance is critical
- ORM generates suboptimal query plans

## Query Variant Strategy

The `getActivityMarkers` method uses 4 query variants to minimize unnecessary joins:

| Variant | When Used | Tables Joined | Performance |
|---------|-----------|---------------|-------------|
| BASE | No population or geographic filters | 4 tables | Fastest |
| GEOGRAPHIC | Geographic filter only | 4 tables | Fast |
| POPULATION | Population filter only | 7 tables | Moderate |
| FULL | Both filters | 7 tables | Moderate |

### Variant Selection Logic

```typescript
const hasPopulation = filters.populationIds && filters.populationIds.length > 0;
const hasGeographic = effectiveVenueIds !== undefined;

if (hasPopulation && hasGeographic) return QueryVariant.FULL;
if (hasPopulation) return QueryVariant.POPULATION;
if (hasGeographic) return QueryVariant.GEOGRAPHIC;
return QueryVariant.BASE;
```

## Stable Sorting for Pagination

### Why It Matters

Without stable sorting, pagination produces inconsistent results:
- Same activity appears on multiple pages (duplicates)
- Activities are skipped between pages (gaps)
- Total count doesn't match actual data

### Solution

Always include `ORDER BY` on a stable, unique column:

```sql
ORDER BY a.id  -- Primary key, unique, indexed
LIMIT 100 OFFSET 0
```

### What NOT to Do

```sql
-- ❌ No ORDER BY - arbitrary order
SELECT * FROM Activity LIMIT 100 OFFSET 0

-- ❌ ORDER BY non-unique column - unstable
ORDER BY a.createdAt LIMIT 100 OFFSET 0

-- ✅ ORDER BY unique column - stable
ORDER BY a.id LIMIT 100 OFFSET 0
```

## Conditional Joins

### The Problem

Always joining all tables is inefficient:

```sql
-- ❌ Always joins 7 tables even when population filter not present
SELECT ...
FROM Activity a
INNER JOIN Assignment asn ON ...
INNER JOIN Participant p ON ...
INNER JOIN ParticipantPopulation pp ON ...
WHERE 1=1  -- No population filter!
```

### The Solution

Only join tables when filters require them:

```typescript
if (hasPopulationFilter) {
  // Use query with population joins (7 tables)
  query = buildPopulationQuery();
} else {
  // Use query without population joins (4 tables)
  query = buildBaseQuery();
}
```

### Performance Impact

- Without population filter: 43% fewer joins
- Query execution time reduced by 30-40%
- Especially important for large datasets

## Current Venue Identification

### DISTINCT ON Approach

PostgreSQL's `DISTINCT ON` efficiently gets the most recent venue per activity:

```sql
SELECT DISTINCT ON (avh."activityId")
  avh."activityId",
  avh."venueId",
  v.latitude,
  v.longitude
FROM activity_venue_history avh
INNER JOIN venues v ON v.id = avh."venueId"
WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
```

**How it works:**
1. `DISTINCT ON (activityId)` keeps only first row per activity
2. `ORDER BY activityId, effectiveFrom DESC NULLS LAST` ensures first row is most recent
3. `NULLS LAST` handles null effectiveFrom (treats as oldest)
4. Result: One venue per activity, the most recent one

## Performance Monitoring

In development mode, the service logs performance metrics:

```
[MapData] Activity markers query completed: {
  variant: 'population',
  executionTime: '87ms',
  rowsReturned: 100,
  totalCount: 15234,
  filters: {
    hasPopulation: true,
    hasGeographic: false,
    hasBoundingBox: true,
    hasDateRange: false
  }
}
```

## Troubleshooting

### Issue: Slow Query Performance

**Check:**
1. Are indexes present? Run `\d+ activity_venue_history` in psql
2. Is the right variant selected? Check logs for variant name
3. Are filters too broad? Check totalCount in logs

**Solutions:**
- Add missing indexes via Prisma migration
- Adjust filters to be more selective
- Consider adding composite indexes

### Issue: Inconsistent Pagination

**Check:**
1. Is ORDER BY present in query? Should see `ORDER BY a.id`
2. Are results ordered by activity ID? Check returned IDs

**Solutions:**
- Verify query builder includes ORDER BY in all variants
- Check that LIMIT/OFFSET are applied after ORDER BY

### Issue: Wrong Results

**Check:**
1. Check filter logic in WHERE clause
2. Verify CTE is filtering correctly
3. Compare with expected test data

**Solutions:**
- Review query builder WHERE clause construction
- Check parameter binding (no SQL injection)
- Verify geographic filter is applied correctly

### Issue: SQL Syntax Errors

**Check:**
1. Are parameters properly escaped?
2. Are array parameters formatted correctly?
3. Are date values in ISO format?
4. Are UUID comparisons using text (not uuid type)?

**Solutions:**
- Validate filter values before building query
- Check PostgreSQL logs for actual SQL executed
- Remember: Prisma stores UUIDs as text, not native uuid type

## Best Practices

1. **Always use stable sorting** for paginated queries (ORDER BY unique column)
2. **Use conditional joins** to avoid unnecessary table joins
3. **Apply filters early** (in CTEs when possible)
4. **Use window functions** to calculate totals in same query
5. **Monitor performance** in development to catch regressions
6. **Test with realistic data** volumes before deploying
7. **Remember UUID type handling**: Prisma uses text columns for UUIDs

## References

- Design Document: `.kiro/specs/map-data-optimization/design.md`
- Requirements: `.kiro/specs/map-data-optimization/requirements.md`
- Query Builder: `backend-api/src/utils/activity-marker-query-builder.ts`
- Service: `backend-api/src/services/map-data.service.ts`
- Benchmark Script: `backend-api/scripts/benchmark-map-queries.ts`
