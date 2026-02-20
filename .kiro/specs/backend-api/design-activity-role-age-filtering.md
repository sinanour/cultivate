# Design Document: Activity List Role and Age Cohort Filtering

## Overview

This design document describes the implementation of role-based and age cohort filtering for the GET /api/v1/activities endpoint. The implementation extends the existing unified flexible filtering system in the ActivityRepository and ActivityService by adding support for filters that require joining with the Assignment and Participant tables.

## Design Rationale

**Why Assignment Table Joins:**
- Role information is stored in the Assignment table (participant-activity-role relationship)
- Filtering by role requires traversing this relationship
- Using Prisma's nested where clauses with `assignments.some` provides efficient filtering

**Why Participant Table Joins:**
- Age cohort is derived from Participant.dateOfBirth
- Filtering by age cohort requires accessing participant demographic data
- Conditional joins minimize query overhead when filters are not present

**Why Reference Date Calculation:**
- Age cohorts should reflect participant ages at the most relevant point in time
- When viewing historical data (past date range), cohorts should show ages at that time
- When viewing completed activities, cohorts should show ages when activity ended
- Using minimum of (current date, activity endDate, filter endDate) ensures temporal accuracy
- Conservative approach prevents showing activities with participants who aged into a cohort after the relevant period

**Why DISTINCT or GROUP BY:**
- An activity may have multiple participants matching the filter criteria
- Without deduplication, the same activity could appear multiple times in results
- Prisma's `distinct: ['id']` or GROUP BY prevents duplicates
- Maintains correct pagination counts

## Architecture

### Query Building Strategy

The implementation extends the existing `buildWhereClause()` method in ActivityRepository to handle assignment-based filters:

```typescript
private buildWhereClause(filter?: Record<string, any>): any {
  if (!filter) return {};
  
  const where: any = {};
  
  // Handle existing filters (name, activityTypeIds, status, etc.)
  for (const [field, value] of Object.entries(filter)) {
    if (field === 'roleIds' || field === 'ageCohorts') {
      // Skip assignment-based filters, handle separately
      continue;
    }
    
    if (this.isHighCardinalityField(field)) {
      where[field] = { contains: value, mode: 'insensitive' };
    } else if (Array.isArray(value)) {
      where[field] = { in: value };
    } else {
      where[field] = value;
    }
  }
  
  // Handle assignment-based filters
  const assignmentFilter = this.buildAssignmentFilter(filter);
  if (assignmentFilter) {
    where.assignments = assignmentFilter;
  }
  
  return where;
}

private buildAssignmentFilter(filter?: Record<string, any>): any {
  if (!filter) return null;
  
  const hasRoleFilter = filter.roleIds && filter.roleIds.length > 0;
  const hasAgeCohortFilter = filter.ageCohorts && filter.ageCohorts.length > 0;
  
  if (!hasRoleFilter && !hasAgeCohortFilter) {
    return null;
  }
  
  const assignmentCondition: any = {};
  
  // Add role filter
  if (hasRoleFilter) {
    assignmentCondition.roleId = { in: filter.roleIds };
  }
  
  // Add age cohort filter
  if (hasAgeCohortFilter) {
    assignmentCondition.participant = this.buildAgeCohortFilter(
      filter.ageCohorts,
      filter.endDate
    );
  }
  
  return { some: assignmentCondition };
}

private buildAgeCohortFilter(cohorts: string[], filterEndDate?: string): any {
  // Calculate reference date
  const referenceDate = calculateReferenceDate(
    new Date(),
    null, // Conservative: use single reference date for all activities
    filterEndDate ? new Date(filterEndDate) : null
  );
  
  // Convert cohorts to date range conditions
  const cohortConditions = cohorts.map(cohort => {
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
  return cohortConditions.length === 1 ? cohortConditions[0] : { OR: cohortConditions };
}
```

### Deduplication Strategy

When an activity has multiple participants matching the filter criteria, we must prevent duplicate results:

**Option 1: Prisma distinct (Preferred)**
```typescript
const activities = await prisma.activity.findMany({
  where,
  distinct: ['id'],
  include: {
    activityType: {
      include: {
        activityCategory: true
      }
    }
  },
  skip: (page - 1) * limit,
  take: limit
});
```

**Option 2: Raw SQL with GROUP BY (Alternative)**
```typescript
// If distinct doesn't work well with includes, use raw SQL
const activities = await prisma.$queryRaw`
  SELECT DISTINCT a.*
  FROM "Activity" a
  WHERE EXISTS (
    SELECT 1
    FROM "Assignment" asn
    INNER JOIN "Participant" p ON asn."participantId" = p.id
    WHERE asn."activityId" = a.id
      AND (${roleIds.length} = 0 OR asn."roleId" = ANY(${roleIds}::uuid[]))
      AND (
        ${ageCohorts.length} = 0 OR
        (
          ('Child' = ANY(${ageCohorts}) AND p."dateOfBirth" > ${childMinDate}) OR
          ('Junior Youth' = ANY(${ageCohorts}) AND p."dateOfBirth" >= ${jyMinDate} AND p."dateOfBirth" < ${jyMaxDate}) OR
          -- ... other cohorts
        )
      )
  )
  ORDER BY a.id
  LIMIT ${limit} OFFSET ${(page - 1) * limit}
`;
```

### Validation Schema Updates

Update the ActivityQuerySchema in validation.schemas.ts:

```typescript
export const ActivityQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(100),
  geographicAreaId: z.string().uuid().optional(),
  filter: z.object({
    name: z.string().optional(),
    activityTypeIds: z.preprocess(
      normalizeToArray,
      z.array(z.string().uuid()).optional()
    ),
    activityCategoryIds: z.preprocess(
      normalizeToArray,
      z.array(z.string().uuid()).optional()
    ),
    status: z.preprocess(
      normalizeToArray,
      z.array(z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])).optional()
    ),
    populationIds: z.preprocess(
      normalizeToArray,
      z.array(z.string().uuid()).optional()
    ),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    updatedAt: z.object({
      lte: z.coerce.date().optional(),
      lt: z.coerce.date().optional(),
      gte: z.coerce.date().optional(),
      gt: z.coerce.date().optional()
    }).optional(),
    // NEW: Role and age cohort filters
    roleIds: z.preprocess(
      normalizeToArray,
      z.array(z.string().uuid()).optional()
    ),
    ageCohorts: z.preprocess(
      normalizeToArray,
      z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
    )
  }).optional(),
  fields: z.string().optional()
});
```

### Service Layer Updates

Update ActivityService.getActivities() to pass new filters to repository:

```typescript
async getActivities(options: ActivityQueryOptions): Promise<PaginatedResponse<Activity>> {
  // Validate role IDs exist (optional validation)
  if (options.filter?.roleIds) {
    await this.validateRoleIds(options.filter.roleIds);
  }
  
  // Fetch activities from repository with all filters
  const activities = await this.activityRepository.findAllPaginated(options);
  
  return activities;
}

private async validateRoleIds(roleIds: string[]): Promise<void> {
  const roles = await this.roleRepository.findByIds(roleIds);
  const foundIds = roles.map(r => r.id);
  const missingIds = roleIds.filter(id => !foundIds.includes(id));
  
  if (missingIds.length > 0) {
    // Log warning but don't throw error - return empty results instead
    console.warn(`Role IDs not found: ${missingIds.join(', ')}`);
  }
}
```

### Database Indexes

The required indexes should already exist from previous implementations:

```sql
-- Index for role-based filtering (should already exist)
CREATE INDEX IF NOT EXISTS "idx_assignment_role_id" ON "Assignment"("roleId");

-- Index for age cohort filtering (should already exist)
CREATE INDEX IF NOT EXISTS "idx_participant_date_of_birth" ON "Participant"("dateOfBirth");

-- Composite index for activity-participant lookups (should already exist)
CREATE INDEX IF NOT EXISTS "idx_assignment_activity_participant" ON "Assignment"("activityId", "participantId");
```

### Query Performance Optimization

**Expected Query Plan:**
1. Filter activities by direct attributes (name, activityTypeIds, status, etc.) using existing indexes
2. Use EXISTS subquery or INNER JOIN to filter by assignment-based criteria
3. PostgreSQL query planner should use indexes on Assignment.roleId and Participant.dateOfBirth
4. DISTINCT ensures no duplicate activities in results

**Performance Targets:**
- Query latency: < 200ms for datasets with 100,000 activities and 500,000 assignments
- Index usage: All filters should use indexes (verify with EXPLAIN ANALYZE)
- Memory usage: Minimal - no in-memory filtering, all done at database level

### Error Handling

**Validation Errors (400 Bad Request):**
- Invalid UUID format in roleIds
- Invalid age cohort name in ageCohorts
- Invalid date format in date range filters

**Empty Results (200 OK with empty array):**
- No activities match the filter criteria
- Role IDs don't exist in database
- Age cohorts have no matching participants

**Server Errors (500 Internal Server Error):**
- Database connection failures
- Query execution errors
- Unexpected Prisma errors

### Integration with Existing Filters

The new filters integrate seamlessly with existing activity filters:

```typescript
// Example: Combine role, age cohort, population, activity type, and date range filters
GET /api/v1/activities?filter[roleIds]=tutor-uuid,teacher-uuid&filter[ageCohorts]=Youth,Young Adult&filter[populationIds]=youth-uuid&filter[activityTypeIds]=type-uuid&filter[startDate]=2025-01-01&filter[endDate]=2025-12-31

// Result: Activities where:
// - At least one participant performed Tutor OR Teacher role (OR within dimension)
// - At least one participant is in Youth OR Young Adult age cohort (OR within dimension)
// - At least one participant belongs to Youth population (OR within dimension)
// - Activity type matches specified type (OR within dimension)
// - Activity overlaps with date range 2025-01-01 to 2025-12-31
// All combined with AND logic across dimensions
```

### Response Format

The response format remains unchanged - standard paginated activity list:

```typescript
{
  success: true,
  data: [
    {
      id: "uuid",
      name: "Study Circle",
      activityTypeId: "type-uuid",
      status: "ACTIVE",
      startDate: "2025-01-15",
      endDate: null,
      // ... other activity fields
    }
  ],
  pagination: {
    page: 1,
    limit: 100,
    total: 42,
    totalPages: 1
  }
}
```

Note: The response does NOT include assignment or participant details - those are only used for filtering.

## Implementation Approach

### Phase 1: Backend Implementation
1. Update ActivityQuerySchema validation to accept roleIds and ageCohorts parameters
2. Update ActivityRepository.buildWhereClause() to handle assignment-based filters
3. Add buildAssignmentFilter() and buildAgeCohortFilter() helper methods
4. Update ActivityService to validate new filter parameters
5. Test with various filter combinations

### Phase 2: Frontend Implementation
1. Update FilterGroupingPanel configuration on ActivityList to include Role and Age Cohort properties
2. Implement lazy loading callback for Role filter (fetch from RoleService)
3. Provide predefined options for Age Cohort filter
4. Update filter token display to show human-readable names
5. Update URL synchronization to handle new filter parameters
6. Test filter combinations and URL sharing

### Phase 3: Testing
1. Write integration tests for backend filtering logic
2. Write property tests for reference date calculation and temporal accuracy
3. Write frontend tests for filter UI and URL synchronization
4. Performance test with large datasets (100,000 activities, 500,000 assignments)
5. Verify query latency meets < 200ms target

## Technical Considerations

### Prisma Limitations

Prisma's `distinct` may not work well with complex `include` statements. If issues arise:
- Use raw SQL with EXISTS subquery for filtering
- Fetch activity IDs first, then fetch full activity objects
- Or use GROUP BY in raw SQL

### Reference Date Handling

- Frontend sends dates as ISO-8601 strings (YYYY-MM-DD)
- Backend converts to Date objects for Prisma queries
- Timezone considerations: Use UTC for consistency
- Reference date calculated once per query for all activities (conservative approach)
- Per-activity reference date calculation would be more accurate but significantly more complex

### Performance Monitoring

Monitor query performance with:
- PostgreSQL EXPLAIN ANALYZE for query plans
- Application-level query timing logs
- Database slow query logs
- Index usage statistics

If performance degrades:
- Add composite indexes on (activityId, participantId, roleId)
- Consider materialized views for frequently used filter combinations
- Optimize Prisma query generation
- Use database-level query optimization hints

## Future Enhancements

Potential future improvements:
- Per-activity reference date calculation for maximum temporal accuracy
- Filter by specific participant names (already supported via participant filters)
- Filter by assignment notes (requires text search on Assignment.notes)
- Aggregate statistics (e.g., "activities with more than 10 Youth participants")
- Temporal analytics (e.g., "activities active in Q1 but not Q2")
