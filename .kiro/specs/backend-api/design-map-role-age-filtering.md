# Design Document: Map Data API Role and Age Cohort Filtering

## Overview

This design document describes the implementation of role and age cohort filtering for the Map Data API endpoints (GET /api/v1/map/activities and GET /api/v1/map/participant-homes). The implementation extends the existing optimized raw SQL query system with conditional joins for the Assignment and Participant tables, following the same query variant selection pattern established in the map-data-optimization spec.

## Design Rationale

**Why Conditional Joins:**
- Role filtering requires joining the Assignment table to access participant-activity-role relationships
- Age cohort filtering requires joining the Participant table to access dateOfBirth
- Only adding these joins when filters are present maintains optimal query performance
- Follows the established pattern from map-data-optimization spec

**Why Reference Date Calculation:**
- Age cohorts should reflect participant ages at the most relevant point in time
- When viewing historical data (past date range), cohorts should show ages at that time
- When viewing completed activities, cohorts should show ages when activity ended
- Using minimum of (current date, activity endDate, filter endDate) ensures temporal accuracy
- Conservative approach prevents showing participants who aged into a cohort after the relevant period

**Why Silent Ignore for Venue Markers:**
- Venue markers don't have associated participants, so role/age cohort filters don't apply
- Silently ignoring allows frontend to keep filters active when switching modes
- Provides smooth UX without requiring filter clearing when changing modes

## Architecture

### Query Variant Selection

Extend the existing query variant selection logic to consider role and age cohort filters:

```typescript
enum QueryVariant {
  BASE = 'base',
  GEOGRAPHIC = 'geographic',
  PARTICIPANTS_ONLY = 'participants_only',
  FULL_WITH_PARTICIPANTS = 'full_with_participants'
}

function selectQueryVariant(filters: MapFilters, effectiveVenueIds?: string[]): QueryVariant {
  const hasPopulationFilter = filters.populationIds && filters.populationIds.length > 0;
  const hasRoleFilter = filters.roleIds && filters.roleIds.length > 0;
  const hasAgeCohortFilter = filters.ageCohorts && filters.ageCohorts.length > 0;
  const hasGeographicFilter = effectiveVenueIds !== undefined;
  
  // Determine if we need participant-related joins
  const needsParticipantJoins = hasPopulationFilter || hasRoleFilter || hasAgeCohortFilter;
  
  if (needsParticipantJoins && hasGeographicFilter) {
    return QueryVariant.FULL_WITH_PARTICIPANTS;
  }
  if (needsParticipantJoins) {
    return QueryVariant.PARTICIPANTS_ONLY;
  }
  if (hasGeographicFilter) {
    return QueryVariant.GEOGRAPHIC;
  }
  return QueryVariant.BASE;
}
```

### Reference Date Calculation

Implement a utility function to determine the appropriate reference date for age cohort calculations:

```typescript
/**
 * Calculate the reference date for age cohort filtering.
 * Returns the minimum (earliest) of all provided non-null dates.
 * 
 * @param currentDate - The current date (always provided)
 * @param activityEndDate - The activity's end date (null for ongoing activities)
 * @param filterEndDate - The date range filter's end date (null if no date filter)
 * @returns The reference date to use for age cohort calculations
 */
function calculateReferenceDate(
  currentDate: Date,
  activityEndDate: Date | null,
  filterEndDate: Date | null
): Date {
  const dates: Date[] = [currentDate];
  
  if (activityEndDate) {
    dates.push(activityEndDate);
  }
  
  if (filterEndDate) {
    dates.push(filterEndDate);
  }
  
  // Return the minimum (earliest) date
  return new Date(Math.min(...dates.map(d => d.getTime())));
}
```

### Age Cohort Date Range Conversion

Enhance the existing `convertCohortToDateRange()` function to accept a reference date:

```typescript
/**
 * Convert age cohort name to date range conditions on dateOfBirth.
 * 
 * @param cohort - The age cohort name
 * @param referenceDate - The date to use as reference for age calculation
 * @returns Date range boundaries for the cohort, or null for "Unknown"
 */
function convertCohortToDateRange(
  cohort: AgeCohort,
  referenceDate: Date
): { min?: Date; max?: Date } | null {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  
  switch (cohort) {
    case AgeCohort.CHILD:
      // < 11 years old: dateOfBirth > (reference date - 11 years)
      return { min: new Date(refYear - 11, refMonth, refDay) };
    
    case AgeCohort.JUNIOR_YOUTH:
      // >= 11 and < 15 years old
      return {
        min: new Date(refYear - 15, refMonth, refDay),
        max: new Date(refYear - 11, refMonth, refDay)
      };
    
    case AgeCohort.YOUTH:
      // >= 15 and < 21 years old
      return {
        min: new Date(refYear - 21, refMonth, refDay),
        max: new Date(refYear - 15, refMonth, refDay)
      };
    
    case AgeCohort.YOUNG_ADULT:
      // >= 21 and < 30 years old
      return {
        min: new Date(refYear - 30, refMonth, refDay),
        max: new Date(refYear - 21, refMonth, refDay)
      };
    
    case AgeCohort.ADULT:
      // >= 30 years old: dateOfBirth < (reference date - 30 years)
      return { max: new Date(refYear - 30, refMonth, refDay) };
    
    case AgeCohort.UNKNOWN:
      // null dateOfBirth
      return null;
    
    default:
      throw new Error(`Invalid age cohort: ${cohort}`);
  }
}
```

## SQL Query Structure

### Activity Markers with Role and Age Cohort Filters

```sql
WITH current_venues AS (
  SELECT DISTINCT ON (avh."activityId")
    avh."activityId",
    avh."venueId",
    v.latitude,
    v.longitude
  FROM "ActivityVenueHistory" avh
  INNER JOIN "Venue" v ON v.id = avh."venueId"
  WHERE v.latitude IS NOT NULL 
    AND v.longitude IS NOT NULL
    -- Geographic filter if present
    AND ($effectiveVenueAreaIds IS NULL OR v."geographicAreaId" = ANY($effectiveVenueAreaIds::uuid[]))
  ORDER BY avh."activityId", avh."effectiveFrom" DESC NULLS LAST
)
SELECT 
  a.id,
  cv.latitude,
  cv.longitude,
  a."activityTypeId",
  at."activityCategoryId",
  COUNT(*) OVER() as total_count
FROM "Activity" a
INNER JOIN "ActivityType" at ON at.id = a."activityTypeId"
INNER JOIN current_venues cv ON cv."activityId" = a.id
-- Conditional joins (only when role, age cohort, or population filters present)
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
LEFT JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
WHERE 1=1
  -- Role filter (if present)
  AND ($roleIds IS NULL OR asn."roleId" = ANY($roleIds::uuid[]))
  -- Age cohort filter (if present, using reference date)
  AND (
    $ageCohorts IS NULL OR
    (
      ('Child' = ANY($ageCohorts) AND p."dateOfBirth" > $childMinDate) OR
      ('Junior Youth' = ANY($ageCohorts) AND p."dateOfBirth" >= $jyMinDate AND p."dateOfBirth" < $jyMaxDate) OR
      ('Youth' = ANY($ageCohorts) AND p."dateOfBirth" >= $youthMinDate AND p."dateOfBirth" < $youthMaxDate) OR
      ('Young Adult' = ANY($ageCohorts) AND p."dateOfBirth" >= $yaMinDate AND p."dateOfBirth" < $yaMaxDate) OR
      ('Adult' = ANY($ageCohorts) AND p."dateOfBirth" < $adultMaxDate) OR
      ('Unknown' = ANY($ageCohorts) AND p."dateOfBirth" IS NULL)
    )
  )
  -- Population filter (if present)
  AND ($populationIds IS NULL OR pp."populationId" = ANY($populationIds::uuid[]))
  -- Other activity filters
  AND ($activityTypeIds IS NULL OR a."activityTypeId" = ANY($activityTypeIds::uuid[]))
  AND ($activityCategoryIds IS NULL OR at."activityCategoryId" = ANY($activityCategoryIds::uuid[]))
  AND ($status IS NULL OR a.status = $status)
  -- Date range filters
  AND ($startDate IS NULL OR a."startDate" <= $endDate)
  AND ($endDate IS NULL OR a."endDate" >= $startDate OR a."endDate" IS NULL)
  -- Bounding box filters
  AND ($minLat IS NULL OR cv.latitude >= $minLat)
  AND ($maxLat IS NULL OR cv.latitude <= $maxLat)
  AND ($minLon IS NULL OR $maxLon IS NULL OR 
       CASE 
         WHEN $minLon > $maxLon THEN (cv.longitude >= $minLon OR cv.longitude <= $maxLon)
         ELSE (cv.longitude >= $minLon AND cv.longitude <= $maxLon)
       END)
GROUP BY a.id, cv.latitude, cv.longitude, a."activityTypeId", at."activityCategoryId"
ORDER BY a.id
LIMIT $limit OFFSET $offset;
```

**Key Points:**
- Conditional joins only added when role, age cohort, or population filters are present
- Age cohort date boundaries ($childMinDate, $jyMinDate, etc.) calculated using reference date
- GROUP BY deduplicates activities with multiple matching participants
- ORDER BY a.id maintains stable pagination

### Participant Home Markers with Role and Age Cohort Filters

For participant homes, the query is simpler since we're already working with participants:

```typescript
// Build WHERE clause with role and age cohort filters
const where: any = {
  // ... existing filters (geographic area, population, date range) ...
};

// Add role filter
if (filter.roleIds && filter.roleIds.length > 0) {
  where.assignments = {
    some: {
      roleId: { in: filter.roleIds }
    }
  };
}

// Add age cohort filter
if (filter.ageCohorts && filter.ageCohorts.length > 0) {
  // Calculate reference date (minimum of current date and filter endDate)
  const referenceDate = calculateReferenceDate(
    new Date(),
    null, // No activity endDate for participant homes
    filter.endDate ? new Date(filter.endDate) : null
  );
  
  // Convert cohorts to date range conditions
  const cohortConditions = filter.ageCohorts.map(cohort => {
    if (cohort === 'Unknown') {
      return { dateOfBirth: null };
    }
    
    const range = convertCohortToDateRange(cohort, referenceDate);
    const condition: any = {};
    
    if (range.min) {
      condition.gte = range.min;
    }
    if (range.max) {
      condition.lt = range.max;
    }
    
    return { dateOfBirth: condition };
  });
  
  // Apply OR logic for multiple cohorts
  if (cohortConditions.length === 1) {
    Object.assign(where, cohortConditions[0]);
  } else {
    where.OR = cohortConditions;
  }
}
```

## Implementation Approach

### Phase 1: Backend - Activity Markers

1. Update ActivityMarkersQuerySchema validation to accept roleIds and ageCohorts parameters
2. Implement calculateReferenceDate() utility function
3. Update convertCohortToDateRange() to accept reference date parameter
4. Extend ActivityMarkerQueryBuilder class:
   - Add buildRoleFilter() method
   - Add buildAgeCohortFilter() method
   - Update selectQueryVariant() to consider new filters
   - Update buildWhereClause() to include role and age cohort conditions
   - Update addConditionalJoins() to add Assignment and Participant joins when needed
5. Update MapDataService.getActivityMarkers() to pass new filters to query builder
6. Test with various filter combinations

### Phase 2: Backend - Participant Home Markers

1. Update ParticipantHomeMarkersQuerySchema validation to accept roleIds and ageCohorts parameters
2. Update MapDataService.getParticipantHomeMarkers() to handle new filters
3. Apply role filter using Prisma's assignments.some() pattern
4. Apply age cohort filter using enhanced convertCohortToDateRange() with reference date
5. Test with various filter combinations

### Phase 3: Backend - Venue Markers

1. Update VenueMarkersQuerySchema validation to accept (but ignore) roleIds and ageCohorts parameters
2. Ensure MapDataService.getVenueMarkers() silently ignores these parameters
3. Verify no performance impact from accepting unused parameters

### Phase 4: Frontend Integration

1. Add "Role" filter property to Map View FilterGroupingPanel
2. Add "Age Cohort" filter property to Map View FilterGroupingPanel
3. Implement filter token conversion to API parameters
4. Update MapDataService to pass roleIds and ageCohorts to backend
5. Implement mode-specific filter application logic
6. Update URL synchronization to handle new filters
7. Test filter combinations across all map modes

### Phase 5: Testing

1. Write integration tests for activity marker filtering with role and age cohort
2. Write integration tests for participant home marker filtering
3. Verify venue markers ignore the filters
4. Test reference date calculation with various scenarios
5. Verify query performance meets <200ms target
6. Test pagination stability with new filters

## Technical Considerations

### Reference Date Calculation Complexity

**Challenge**: Activities in a single query may have different endDates, making per-activity reference date calculation complex in SQL.

**Solution**: Use a conservative approach:
- Calculate reference date as minimum of (current date, filter endDate)
- This provides consistent cohort boundaries across all activities
- Activities with earlier endDates will naturally have participants who were younger
- Acceptable trade-off between accuracy and query complexity

**Alternative (More Accurate but Complex)**:
```sql
-- Per-activity reference date calculation in SQL
AND (
  $ageCohorts IS NULL OR
  p."dateOfBirth" > (
    LEAST(
      CURRENT_DATE,
      COALESCE(a."endDate", CURRENT_DATE),
      COALESCE($filterEndDate, CURRENT_DATE)
    ) - INTERVAL '11 years'
  )
)
```

This alternative is more accurate but adds complexity. The conservative approach is recommended for initial implementation.

### Query Performance

**Expected Performance Impact:**

| Filter Combination | Tables Joined | Expected Query Time |
|-------------------|---------------|---------------------|
| None | 4 (Activity, ActivityType, Venue, History) | 50-100ms |
| Role only | +1 (Assignment) | 80-120ms |
| Age Cohort only | +2 (Assignment, Participant) | 100-150ms |
| Role + Age Cohort | +2 (Assignment, Participant) | 100-150ms |
| Population + Role + Age Cohort | +3 (Assignment, Participant, Population) | 120-180ms |

All queries should remain under 200ms target.

### Database Indexes

Required indexes (should already exist):
- Assignment.roleId
- Assignment.activityId
- Assignment.participantId
- Participant.dateOfBirth
- ParticipantPopulation.participantId
- ParticipantPopulation.populationId

### Validation Schema Updates

```typescript
// In validation.schemas.ts

export const ActivityMarkersQuerySchema = z.object({
  // ... existing fields ...
  roleIds: z.preprocess(
    normalizeToArray,
    z.array(z.string().uuid()).optional()
  ),
  ageCohorts: z.preprocess(
    normalizeToArray,
    z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
  )
});

export const ParticipantHomeMarkersQuerySchema = z.object({
  // ... existing fields ...
  roleIds: z.preprocess(
    normalizeToArray,
    z.array(z.string().uuid()).optional()
  ),
  ageCohorts: z.preprocess(
    normalizeToArray,
    z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
  )
});

export const VenueMarkersQuerySchema = z.object({
  // ... existing fields ...
  // Accept but don't use these parameters
  roleIds: z.preprocess(
    normalizeToArray,
    z.array(z.string().uuid()).optional()
  ),
  ageCohorts: z.preprocess(
    normalizeToArray,
    z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
  )
});
```

## ActivityMarkerQueryBuilder Extensions

### New Methods

**buildRoleFilter():**
```typescript
private buildRoleFilter(): string {
  if (!this.filters.roleIds || this.filters.roleIds.length === 0) {
    return '$roleIds IS NULL';
  }
  
  return 'asn."roleId" = ANY($roleIds::uuid[])';
}
```

**buildAgeCohortFilter():**
```typescript
private buildAgeCohortFilter(): string {
  if (!this.filters.ageCohorts || this.filters.ageCohorts.length === 0) {
    return '$ageCohorts IS NULL';
  }
  
  // Calculate reference date
  const referenceDate = calculateReferenceDate(
    new Date(),
    null, // Activity endDate handled conservatively
    this.filters.endDate ? new Date(this.filters.endDate) : null
  );
  
  // Convert cohorts to date range conditions
  const conditions: string[] = [];
  
  for (const cohort of this.filters.ageCohorts) {
    if (cohort === 'Unknown') {
      conditions.push(`('Unknown' = ANY($ageCohorts) AND p."dateOfBirth" IS NULL)`);
      continue;
    }
    
    const range = convertCohortToDateRange(cohort, referenceDate);
    
    if (range.min && range.max) {
      conditions.push(
        `('${cohort}' = ANY($ageCohorts) AND p."dateOfBirth" >= $${cohort}_min AND p."dateOfBirth" < $${cohort}_max)`
      );
    } else if (range.min) {
      conditions.push(
        `('${cohort}' = ANY($ageCohorts) AND p."dateOfBirth" > $${cohort}_min)`
      );
    } else if (range.max) {
      conditions.push(
        `('${cohort}' = ANY($ageCohorts) AND p."dateOfBirth" < $${cohort}_max)`
      );
    }
  }
  
  return `(${conditions.join(' OR ')})`;
}
```

**addConditionalJoins():**
```typescript
private addConditionalJoins(): void {
  const needsAssignment = this.filters.roleIds || this.filters.ageCohorts || this.filters.populationIds;
  const needsParticipant = this.filters.ageCohorts || this.filters.populationIds;
  const needsPopulation = this.filters.populationIds;
  
  if (needsAssignment) {
    this.joinClauses.push('INNER JOIN "Assignment" asn ON asn."activityId" = a.id');
  }
  
  if (needsParticipant) {
    this.joinClauses.push('INNER JOIN "Participant" p ON p.id = asn."participantId"');
  }
  
  if (needsPopulation) {
    this.joinClauses.push('LEFT JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id');
  }
}
```

**needsGroupBy():**
```typescript
private needsGroupBy(): boolean {
  // GROUP BY needed when any participant-related filter is present
  return !!(
    this.filters.populationIds ||
    this.filters.roleIds ||
    this.filters.ageCohorts
  );
}
```

## MapDataService Updates

### getActivityMarkers()

```typescript
async getActivityMarkers(
  filters: MapFilters,
  userId: string,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<ActivityMarker>> {
  // ... existing authorization logic ...
  
  // Calculate reference date for age cohort filtering
  const referenceDate = calculateReferenceDate(
    new Date(),
    null, // Conservative: don't use activity endDate in query building
    filters.endDate ? new Date(filters.endDate) : null
  );
  
  // Build query with role and age cohort filters
  const queryBuilder = new ActivityMarkerQueryBuilder(
    filters,
    effectiveVenueIds,
    boundingBox,
    referenceDate,
    effectiveLimit,
    skip
  );
  
  // Execute query
  const results = await this.prisma.$queryRaw<ActivityMarkerRow[]>`
    ${Prisma.raw(queryBuilder.build())}
  `;
  
  // ... transform and return results ...
}
```

### getParticipantHomeMarkers()

```typescript
async getParticipantHomeMarkers(
  filters: MapFilters,
  userId: string,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<ParticipantHomeMarker>> {
  // ... existing authorization logic ...
  
  // Build WHERE clause with role and age cohort filters
  const where: any = {
    // ... existing filters ...
  };
  
  // Add role filter
  if (filters.roleIds && filters.roleIds.length > 0) {
    where.assignments = {
      some: {
        roleId: { in: filters.roleIds }
      }
    };
  }
  
  // Add age cohort filter
  if (filters.ageCohorts && filters.ageCohorts.length > 0) {
    // Calculate reference date
    const referenceDate = calculateReferenceDate(
      new Date(),
      null, // No activity endDate for participant homes
      filters.endDate ? new Date(filters.endDate) : null
    );
    
    // Convert cohorts to date range conditions
    const cohortConditions = filters.ageCohorts.map(cohort => {
      if (cohort === 'Unknown') {
        return { dateOfBirth: null };
      }
      
      const range = convertCohortToDateRange(cohort, referenceDate);
      const condition: any = {};
      
      if (range.min) {
        condition.gte = range.min;
      }
      if (range.max) {
        condition.lt = range.max;
      }
      
      return { dateOfBirth: condition };
    });
    
    // Apply OR logic for multiple cohorts
    if (cohortConditions.length === 1) {
      Object.assign(where, cohortConditions[0]);
    } else {
      where.OR = cohortConditions;
    }
  }
  
  // Execute query with grouping by venue
  // ... rest of implementation ...
}
```

### getVenueMarkers()

```typescript
async getVenueMarkers(
  filters: MapFilters,
  userId: string,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<VenueMarker>> {
  // Silently ignore roleIds and ageCohorts filters
  const { roleIds, ageCohorts, ...relevantFilters } = filters;
  
  // Use only relevant filters for venue query
  // ... existing implementation ...
}
```

## Error Handling

### Validation Errors

**Invalid UUIDs in roleIds:**
```typescript
// Zod validation will catch this
// Return 400 Bad Request with message: "Invalid UUID in roleIds parameter"
```

**Invalid age cohort names:**
```typescript
// Zod validation will catch this
// Return 400 Bad Request with message: "Invalid age cohort name. Must be one of: Child, Junior Youth, Youth, Young Adult, Adult, Unknown"
```

### Empty Results

**Non-existent role IDs:**
- Return empty result set (200 OK with data: [], total: 0)
- Log warning: "Role IDs not found: [uuid1, uuid2]"

**No matching participants:**
- Return empty result set (200 OK with data: [], total: 0)
- Normal behavior, not an error

### Database Errors

**Query execution failure:**
- Catch Prisma errors
- Log error with stack trace
- Return 500 Internal Server Error
- Message: "Failed to fetch map markers"

## Performance Optimization

### Query Variant Performance

| Variant | Joins | Estimated Time | Use Case |
|---------|-------|----------------|----------|
| BASE | 4 tables | 50-100ms | No participant filters |
| PARTICIPANTS_ONLY | 6-7 tables | 100-150ms | Role/age cohort/population, no geographic |
| GEOGRAPHIC | 4 tables | 60-110ms | Geographic only, no participant filters |
| FULL_WITH_PARTICIPANTS | 6-7 tables | 120-180ms | All filters combined |

### Index Usage

All queries should use indexes:
- Activity.id (primary key)
- ActivityType.id (primary key)
- Assignment.activityId (foreign key)
- Assignment.roleId (indexed)
- Assignment.participantId (foreign key)
- Participant.id (primary key)
- Participant.dateOfBirth (indexed)
- ParticipantPopulation.participantId (foreign key)
- ParticipantPopulation.populationId (foreign key)

Verify with EXPLAIN ANALYZE that all joins use index scans, not sequential scans.

## Testing Strategy

### Unit Tests

- Test calculateReferenceDate() with various date combinations
- Test convertCohortToDateRange() with reference date parameter
- Test query variant selection with role and age cohort filters
- Test buildRoleFilter() and buildAgeCohortFilter() methods

### Integration Tests

- Test activity markers with role filter only
- Test activity markers with age cohort filter only
- Test activity markers with both role and age cohort filters
- Test activity markers with role + age cohort + population filters
- Test activity markers with role + age cohort + date range filters
- Test participant home markers with role filter
- Test participant home markers with age cohort filter
- Test venue markers ignore role and age cohort filters
- Verify reference date calculation produces correct results
- Verify pagination consistency
- Verify query performance meets targets

### Property Tests

- Role filter correctly includes/excludes activities
- Age cohort filter correctly includes/excludes activities based on reference date
- Combined filters apply AND logic correctly
- Filters integrate with existing map filters
- No duplicate activities in results
- Pagination remains stable

## Future Enhancements

Potential improvements:
- Per-activity reference date calculation in SQL (more accurate but more complex)
- Caching of age cohort date range calculations
- Support for custom age cohort definitions
- Age cohort filtering on venue markers (show venues with activities/residents in cohorts)
