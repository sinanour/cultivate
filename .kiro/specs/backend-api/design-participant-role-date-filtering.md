# Design Document: Participant Filtering by Role and Activity Date Range

## Overview

This design document describes the implementation of role-based and activity date range filtering for the GET /api/v1/participants endpoint. These filters enable clients to retrieve participants based on the roles they've performed in activities and the time periods when they were active. The implementation extends the existing unified flexible filtering system by adding support for filters that require joining with the Assignment and Activity tables.

## Design Rationale

**Why Assignment Table Joins:**
- Role information is stored in the Assignment table (participant-activity-role relationship)
- Activity date information is stored in the Activity table
- Filtering by role or activity dates requires traversing these relationships
- Using Prisma's nested where clauses with `assignments.some` provides efficient filtering

**Why Overlap Logic for Date Ranges:**
- Activities can span multiple days, weeks, or months
- Participants should be included if they were active at ANY point during the filter range
- Ongoing activities (null endDate) should match any date range extending to present
- Standard overlap logic: `(start1 <= end2) AND (end1 >= start2 OR end1 IS NULL)`

**Why DISTINCT or EXISTS:**
- A participant may have multiple assignments matching the filter criteria
- Without deduplication, the same participant could appear multiple times in results
- Prisma's `distinct: ['id']` or EXISTS subqueries prevent duplicates
- Maintains correct pagination counts

## Architecture

### Query Building Strategy

The implementation extends the existing `buildWhereClause()` method in ParticipantRepository to handle assignment-based filters:

```typescript
private buildWhereClause(filter?: Record<string, any>): any {
  if (!filter) return {};
  
  const where: any = {};
  
  // Handle existing filters (name, email, dateOfBirth, etc.)
  for (const [field, value] of Object.entries(filter)) {
    if (field === 'roleIds' || field === 'activityStartDate' || field === 'activityEndDate') {
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
  const hasDateFilter = filter.activityStartDate || filter.activityEndDate;
  
  if (!hasRoleFilter && !hasDateFilter) {
    return null;
  }
  
  const assignmentCondition: any = {};
  
  // Add role filter
  if (hasRoleFilter) {
    assignmentCondition.roleId = { in: filter.roleIds };
  }
  
  // Add activity date range filter
  if (hasDateFilter) {
    assignmentCondition.activity = this.buildActivityDateFilter(
      filter.activityStartDate,
      filter.activityEndDate
    );
  }
  
  return { some: assignmentCondition };
}

private buildActivityDateFilter(startDate?: string, endDate?: string): any {
  if (!startDate && !endDate) return {};
  
  if (startDate && endDate) {
    // Overlap logic: activity overlaps with filter range
    return {
      AND: [
        { startDate: { lte: new Date(endDate) } },
        {
          OR: [
            { endDate: { gte: new Date(startDate) } },
            { endDate: null } // Ongoing activities
          ]
        }
      ]
    };
  } else if (startDate) {
    // Activities starting on or after date
    return {
      startDate: { gte: new Date(startDate) }
    };
  } else if (endDate) {
    // Activities ending on or before date (or ongoing)
    return {
      OR: [
        { endDate: { lte: new Date(endDate) } },
        { endDate: null }
      ]
    };
  }
  
  return {};
}
```

### Deduplication Strategy

When a participant has multiple assignments matching the filter criteria, we must prevent duplicate results:

**Option 1: Prisma distinct (Preferred)**
```typescript
const participants = await prisma.participant.findMany({
  where,
  distinct: ['id'],
  include: {
    participantPopulations: {
      include: {
        population: {
          select: { id: true, name: true }
        }
      }
    }
  },
  skip: (page - 1) * limit,
  take: limit
});
```

**Option 2: EXISTS Subquery (Alternative)**
```typescript
// If distinct doesn't work well with includes, use raw SQL with EXISTS
const participants = await prisma.$queryRaw`
  SELECT DISTINCT p.*
  FROM "Participant" p
  WHERE EXISTS (
    SELECT 1
    FROM "Assignment" a
    INNER JOIN "Activity" act ON a."activityId" = act.id
    WHERE a."participantId" = p.id
      AND a."roleId" = ANY(${roleIds}::uuid[])
      AND act."startDate" <= ${endDate}
      AND (act."endDate" >= ${startDate} OR act."endDate" IS NULL)
  )
  LIMIT ${limit} OFFSET ${(page - 1) * limit}
`;
```

### Validation Schema Updates

Update the ParticipantQuerySchema in validation.schemas.ts:

```typescript
export const ParticipantQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(100),
  geographicAreaId: z.string().uuid().optional(),
  filter: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    nickname: z.string().optional(),
    dateOfBirth: z.coerce.date().optional(),
    dateOfRegistration: z.coerce.date().optional(),
    populationIds: z.preprocess(
      normalizeToArray,
      z.array(z.string().uuid()).optional()
    ),
    ageCohorts: z.preprocess(
      normalizeToArray,
      z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
    ),
    // NEW: Role filter
    roleIds: z.preprocess(
      normalizeToArray,
      z.array(z.string().uuid()).optional()
    ),
    // NEW: Activity date range filter
    activityStartDate: z.coerce.date().optional(),
    activityEndDate: z.coerce.date().optional()
  }).optional(),
  fields: z.string().optional()
});
```

### Service Layer Updates

Update ParticipantService.getParticipants() to pass new filters to repository:

```typescript
async getParticipants(options: ParticipantQueryOptions): Promise<PaginatedResponse<Participant>> {
  // Validate role IDs exist (optional validation)
  if (options.filter?.roleIds) {
    await this.validateRoleIds(options.filter.roleIds);
  }
  
  // Validate date range (optional validation)
  if (options.filter?.activityStartDate && options.filter?.activityEndDate) {
    if (new Date(options.filter.activityStartDate) > new Date(options.filter.activityEndDate)) {
      throw new ValidationError('activityStartDate must be before or equal to activityEndDate');
    }
  }
  
  // Fetch participants from repository with all filters
  const participants = await this.participantRepository.findAllPaginated(options);
  
  // Calculate ageCohort for each participant
  const participantsWithCohort = participants.data.map(participant => ({
    ...participant,
    ageCohort: this.calculateAgeCohort(participant.dateOfBirth),
    populations: participant.participantPopulations?.map(pp => pp.population) || []
  }));
  
  return {
    ...participants,
    data: participantsWithCohort
  };
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

Create a new Prisma migration to add indexes for efficient filtering:

```prisma
// In a new migration file
-- Index for role-based filtering
CREATE INDEX "idx_assignment_role_id" ON "Assignment"("roleId");

-- Indexes for activity date range filtering (may already exist)
CREATE INDEX "idx_activity_start_date" ON "Activity"("startDate");
CREATE INDEX "idx_activity_end_date" ON "Activity"("endDate");

-- Composite index for participant-role lookups
CREATE INDEX "idx_assignment_participant_role" ON "Assignment"("participantId", "roleId");
```

### Query Performance Optimization

**Expected Query Plan:**
1. Filter participants by direct attributes (name, email, etc.) using existing indexes
2. Use EXISTS subquery or INNER JOIN to filter by assignment-based criteria
3. PostgreSQL query planner should use indexes on Assignment.roleId and Activity dates
4. DISTINCT ensures no duplicate participants in results

**Performance Targets:**
- Query latency: < 100ms for datasets with 10,000 participants and 100,000 assignments
- Index usage: All filters should use indexes (verify with EXPLAIN ANALYZE)
- Memory usage: Minimal - no in-memory filtering, all done at database level

### Error Handling

**Validation Errors (400 Bad Request):**
- Invalid UUID format in roleIds
- Invalid date format in activityStartDate or activityEndDate
- activityStartDate after activityEndDate (optional validation)

**Empty Results (200 OK with empty array):**
- No participants match the filter criteria
- Role IDs don't exist in database
- Date range has no matching activities

**Server Errors (500 Internal Server Error):**
- Database connection failures
- Query execution errors
- Unexpected Prisma errors

### Integration with Existing Filters

The new filters integrate seamlessly with existing participant filters:

```typescript
// Example: Combine role, date range, population, and age cohort filters
GET /api/v1/participants?filter[roleIds]=tutor-uuid,teacher-uuid&filter[activityStartDate]=2025-01-01&filter[activityEndDate]=2025-12-31&filter[populationIds]=youth-uuid&filter[ageCohorts]=Youth,Young Adult

// Result: Participants who:
// - Performed Tutor OR Teacher role (OR within dimension)
// - In activities between 2025-01-01 and 2025-12-31 (overlap logic)
// - Belong to Youth population (OR within dimension)
// - Are in Youth OR Young Adult age cohort (OR within dimension)
// All combined with AND logic across dimensions
```

### Response Format

The response format remains unchanged - standard paginated participant list:

```typescript
{
  success: true,
  data: [
    {
      id: "uuid",
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      ageCohort: "Youth",
      populations: [
        { id: "pop-uuid", name: "Youth" }
      ],
      // ... other participant fields
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

Note: The response does NOT include assignment or activity details - those are only used for filtering.

## Implementation Approach

### Phase 1: Backend Implementation
1. Update ParticipantQuerySchema validation to accept roleIds, activityStartDate, activityEndDate
2. Update ParticipantRepository.buildWhereClause() to handle assignment-based filters
3. Add buildAssignmentFilter() and buildActivityDateFilter() helper methods
4. Create database migration for new indexes
5. Update ParticipantService to validate new filter parameters
6. Test with various filter combinations

### Phase 2: Frontend Implementation
1. Update FilterGroupingPanel configuration on ParticipantList to include Role and Activity Date Range properties
2. Implement lazy loading callback for Role filter (fetch from RoleService)
3. Implement date range selection UI for Activity Date Range filter
4. Add support for relative date ranges (Last 30 days, Last 90 days, etc.)
5. Update filter token display to show human-readable role names
6. Update URL synchronization to handle new filter parameters
7. Test filter combinations and URL sharing

### Phase 3: Testing
1. Write integration tests for backend filtering logic
2. Write property tests for overlap logic with ongoing activities
3. Write frontend tests for filter UI and URL synchronization
4. Performance test with large datasets (10,000 participants, 100,000 assignments)
5. Verify query latency meets < 100ms target

## Technical Considerations

### Prisma Limitations

Prisma's `distinct` may not work well with complex `include` statements. If issues arise:
- Use raw SQL with EXISTS subquery for filtering
- Fetch participant IDs first, then fetch full participant objects
- Or use GROUP BY in raw SQL

### Date Handling

- Frontend sends dates as ISO-8601 strings (YYYY-MM-DD)
- Backend converts to Date objects for Prisma queries
- Timezone considerations: Use UTC for consistency
- Ongoing activities (null endDate) require special handling in overlap logic

### Performance Monitoring

Monitor query performance with:
- PostgreSQL EXPLAIN ANALYZE for query plans
- Application-level query timing logs
- Database slow query logs
- Index usage statistics

If performance degrades:
- Add composite indexes on (participantId, roleId, activityId)
- Consider materialized views for frequently used filter combinations
- Optimize Prisma query generation
- Use database-level query optimization hints

## Future Enhancements

Potential future improvements:
- Filter by specific activity types or categories (already supported via activity filters)
- Filter by assignment notes (requires text search on Assignment.notes)
- Filter by assignment date ranges (if joinedAt timestamp is added)
- Aggregate statistics (e.g., "participants who performed Tutor role more than 5 times")
- Temporal analytics (e.g., "participants active in Q1 but not Q2")
