# Implementation Plan: Participant Filtering by Role and Activity Date Range

## Overview

This implementation plan covers the backend API changes needed to support filtering participants by role and activity date ranges. The implementation extends the existing unified flexible filtering system in the ParticipantRepository and ParticipantService.

## Tasks

- [x] 1. Update validation schemas for new filter parameters
  - [x] 1.1 Update ParticipantQuerySchema in validation.schemas.ts
    - Add roleIds field to filter object: `z.array(z.string().uuid()).optional()`
    - Add activityStartDate field to filter object: `z.coerce.date().optional()`
    - Add activityEndDate field to filter object: `z.coerce.date().optional()`
    - Use z.preprocess with normalizeToArray for roleIds to handle single values, multiple parameters, and comma-separated values
    - Validate that roleIds are valid UUIDs
    - Validate that dates are valid ISO-8601 format
    - _Requirements: 3B.1, 3B.2, 3B.11, 3B.12, 3B.13_

  - [x] 1.2 Add validation for date range logic
    - Add optional Zod refinement to validate activityStartDate <= activityEndDate when both provided
    - Return descriptive error message when start date is after end date
    - _Requirements: 3B.14_

  - [ ]* 1.3 Write unit tests for validation schema
    - Test valid roleIds array is accepted
    - Test invalid UUIDs in roleIds are rejected
    - Test valid date formats are accepted
    - Test invalid date formats are rejected
    - Test single value, multiple parameters, and comma-separated roleIds are normalized correctly
    - **Validates: Requirements 3B.1, 3B.2, 3B.3, 3B.11, 3B.12, 3B.13, 3B.14**

- [x] 2. Implement assignment-based filtering in ParticipantRepository
  - [x] 2.1 Create buildAssignmentFilter helper method
    - Accept filter object as parameter
    - Check if roleIds or activity date range filters are present
    - Return null if no assignment-based filters
    - Build Prisma where clause for assignments.some with role and/or activity conditions
    - Combine role filter and activity date filter using AND logic when both present
    - _Requirements: 3B.4, 3B.5, 3B.15, 3B.25, 3B.27, 3B.28_

  - [x] 2.2 Create buildActivityDateFilter helper method
    - Accept activityStartDate and activityEndDate parameters
    - When both dates provided: build overlap logic with AND/OR conditions
    - Overlap condition: (startDate <= filterEndDate) AND (endDate >= filterStartDate OR endDate IS NULL)
    - When only startDate provided: build startDate >= filter condition
    - When only endDate provided: build (endDate <= filter OR endDate IS NULL) condition
    - Return Prisma where clause for activity date filtering
    - _Requirements: 3B.16, 3B.17, 3B.18, 3B.19, 3B.20, 3B.45_

  - [x] 2.3 Update buildWhereClause method
    - Skip roleIds, activityStartDate, and activityEndDate in main filter loop
    - Call buildAssignmentFilter() to get assignment-based where clause
    - Merge assignment filter into main where clause
    - Ensure existing filters (name, email, etc.) continue to work
    - _Requirements: 3B.38, 3B.39, 3B.40_

  - [x] 2.4 Update findAllPaginated method to use DISTINCT
    - Add `distinct: ['id']` to Prisma query when assignment-based filters are present
    - Ensure DISTINCT works correctly with include statements for populations
    - If DISTINCT causes issues with includes, implement alternative deduplication strategy
    - _Requirements: 3B.9, 3B.23, 3B.54_

  - [ ]* 2.5 Write unit tests for repository methods
    - Test buildAssignmentFilter with roleIds only
    - Test buildAssignmentFilter with activity date range only
    - Test buildAssignmentFilter with both roleIds and date range
    - Test buildActivityDateFilter with both dates (overlap logic)
    - Test buildActivityDateFilter with only startDate
    - Test buildActivityDateFilter with only endDate
    - Test buildActivityDateFilter handles null endDate correctly
    - Test buildWhereClause integrates assignment filters correctly
    - **Validates: Requirements 3B.4, 3B.5, 3B.15, 3B.16, 3B.17, 3B.18, 3B.19, 3B.20, 3B.25, 3B.27, 3B.28**

- [x] 3. Update ParticipantService for new filters
  - [x] 3.1 Add optional role ID validation
    - Create validateRoleIds(roleIds) method
    - Query RoleRepository to check if role IDs exist
    - Log warning for non-existent role IDs but don't throw error (return empty results instead)
    - _Requirements: 3B.47_

  - [x] 3.2 Update getParticipants method
    - Pass roleIds filter to repository
    - Pass activityStartDate and activityEndDate filters to repository
    - Ensure ageCohort calculation still works with new filters
    - Ensure population associations are still included in response
    - _Requirements: 3B.6, 3B.7, 3B.8, 3B.10, 3B.21, 3B.22, 3B.24, 3B.26, 3B.44, 3B.45_

  - [ ]* 3.3 Write unit tests for service methods
    - Test getParticipants with roleIds filter
    - Test getParticipants with activity date range filter
    - Test getParticipants with both filters combined
    - Test getParticipants with role filter + existing filters (population, age cohort)
    - Test validateRoleIds with valid and invalid role IDs
    - **Validates: Requirements 3B.6, 3B.7, 3B.8, 3B.10, 3B.25, 3B.26, 3B.47**

- [x] 4. Create database indexes for performance
  - [x] 4.1 Create Prisma migration for new indexes
    - Add index on Assignment.roleId: `@@index([roleId])`
    - Add index on Activity.startDate: `@@index([startDate])` (may already exist)
    - Add index on Activity.endDate: `@@index([endDate])` (may already exist)
    - Add composite index on Assignment(participantId, roleId): `@@index([participantId, roleId])`
    - _Requirements: 3B.29, 3B.30, 3B.31, 3B.51_

  - [x] 4.2 Verify index usage with EXPLAIN ANALYZE
    - Run EXPLAIN ANALYZE on queries with roleIds filter
    - Run EXPLAIN ANALYZE on queries with activity date range filter
    - Run EXPLAIN ANALYZE on queries with both filters
    - Verify indexes are being used by query planner
    - Measure query execution time and ensure < 100ms
    - _Requirements: 3B.32, 3B.33, 3B.55_

- [ ] 5. Update route handler for new filters
  - [x] 5.1 Update GET /api/v1/participants route
    - Ensure validation middleware uses updated ParticipantQuerySchema
    - Extract roleIds, activityStartDate, activityEndDate from query parameters
    - Pass new filters to ParticipantService.getParticipants()
    - Return standard paginated response format
    - _Requirements: 3B.38, 3B.43, 3B.44_

  - [x] 5.2 Add error handling for new filters
    - Catch validation errors and return 400 Bad Request
    - Catch database errors and return 500 Internal Server Error
    - Log all errors for debugging
    - Return descriptive error messages
    - _Requirements: 3B.49, 3B.50, 3B.56, 3B.57_

- [ ] 6. Update OpenAPI documentation
  - [ ] 6.1 Document new filter parameters
    - Add roleIds parameter to GET /api/v1/participants documentation
    - Add activityStartDate parameter documentation
    - Add activityEndDate parameter documentation
    - Document parameter types, formats, and validation rules
    - _Requirements: 3B.1, 3B.11, 3B.12_

  - [ ] 6.2 Add examples for new filters
    - Example: Filter by single role
    - Example: Filter by multiple roles
    - Example: Filter by activity date range (both dates)
    - Example: Filter by activity start date only
    - Example: Filter by activity end date only
    - Example: Combine role and date range filters
    - Example: Combine new filters with existing filters (population, age cohort)
    - _Requirements: 3B.6, 3B.16, 3B.19, 3B.20, 3B.25, 3B.50_

  - [ ] 6.3 Document overlap logic for date ranges
    - Explain how overlap logic works for activity date ranges
    - Document handling of ongoing activities (null endDate)
    - Provide examples of edge cases
    - _Requirements: 3B.17, 3B.18, 3B.45, 3B.52_

- [ ] 7. Write integration tests
  - [x] 7.1 Test role filtering
    - Create test participants with various role assignments
    - Test filtering by single role returns correct participants
    - Test filtering by multiple roles applies OR logic correctly
    - Test participants without matching roles are excluded
    - Test role filter combined with name filter applies AND logic
    - _Requirements: 3B.5, 3B.6, 3B.7, 3B.8, 3B.10, 3B.13_

  - [x] 7.2 Test activity date range filtering
    - Create test participants with assignments to activities in various date ranges
    - Test filtering with both start and end dates uses overlap logic
    - Test filtering with only start date includes activities starting on or after
    - Test filtering with only end date includes activities ending on or before
    - Test ongoing activities (null endDate) are included correctly
    - Test participants without activities in range are excluded
    - Test activity date filter combined with population filter applies AND logic
    - _Requirements: 3B.16, 3B.17, 3B.18, 3B.19, 3B.20, 3B.21, 3B.22, 3B.24_

  - [x] 7.3 Test combined role and date range filtering
    - Create test data with participants having various roles and activity dates
    - Test filtering by role AND date range applies AND logic correctly
    - Test participants must have assignments matching BOTH criteria
    - Test combined filters with other participant filters (population, age cohort)
    - _Requirements: 3B.25, 3B.26, 3B.28, 3B.34, 3B.50_

  - [x] 7.4 Test pagination with new filters
    - Test pagination works correctly with role filter
    - Test pagination works correctly with activity date range filter
    - Test total count is accurate with new filters
    - Test page navigation maintains filter state
    - _Requirements: 3B.35, 3B.36, 3B.37_

  - [x] 7.5 Test error handling
    - Test invalid UUID in roleIds returns 400 Bad Request
    - Test invalid date format returns 400 Bad Request
    - Test non-existent role IDs return empty results (not error)
    - Test date range with no matching activities returns empty results
    - _Requirements: 3B.3, 3B.14, 3B.47, 3B.48, 3B.56, 3B.57_

  - [ ] 7.6 Test query performance
    - Create dataset with 10,000 participants and 100,000 assignments
    - Measure query latency with roleIds filter
    - Measure query latency with activity date range filter
    - Measure query latency with both filters combined
    - Verify all queries complete in < 100ms
    - Verify indexes are being used (check EXPLAIN ANALYZE output)
    - _Requirements: 3B.33, 3B.51, 3B.53, 3B.55_

- [ ]* 8. Write property tests for filtering logic
  - **Property 346: Role Filter Inclusion**
  - **Property 347: Role Filter Exclusion**
  - **Property 348: Role Filter OR Logic Within Dimension**
  - **Property 349: Activity Date Range Overlap Logic**
  - **Property 350: Ongoing Activity Date Range Handling**
  - **Property 351: Activity Start Date Only Filter**
  - **Property 352: Activity End Date Only Filter**
  - **Property 353: Combined Role and Date Range AND Logic**
  - **Property 354: Assignment-Based Filters with Existing Filters**
  - **Property 355: No Duplicate Participants in Results**
  - **Property 356: Pagination with Assignment-Based Filters**
  - **Property 357: Total Count Accuracy with Assignment-Based Filters**
  - **Validates: Requirements 3B.5, 3B.6, 3B.7, 3B.8, 3B.9, 3B.10, 3B.16, 3B.17, 3B.18, 3B.19, 3B.20, 3B.21, 3B.22, 3B.23, 3B.24, 3B.25, 3B.26, 3B.28, 3B.34, 3B.35, 3B.36, 3B.37, 3B.38, 3B.39, 3B.40, 3B.50**

- [ ] 9. Checkpoint - Verify backend implementation
  - Ensure all tests pass
  - Verify query performance meets targets
  - Test with realistic data volumes
  - Ask the user if questions arise

## Implementation Notes

### Query Optimization Tips

**Use DISTINCT Carefully:**
```typescript
// Preferred approach
const participants = await prisma.participant.findMany({
  where,
  distinct: ['id'],
  include: { participantPopulations: { include: { population: true } } }
});
```

**Alternative: Two-Step Query:**
```typescript
// If DISTINCT doesn't work with includes
// Step 1: Get participant IDs
const participantIds = await prisma.participant.findMany({
  where,
  select: { id: true },
  distinct: ['id']
});

// Step 2: Fetch full participant objects
const participants = await prisma.participant.findMany({
  where: { id: { in: participantIds.map(p => p.id) } },
  include: { participantPopulations: { include: { population: true } } }
});
```

**Alternative: EXISTS Subquery:**
```typescript
// Use raw SQL if Prisma doesn't generate efficient queries
const participants = await prisma.$queryRaw`
  SELECT DISTINCT p.*
  FROM "Participant" p
  WHERE EXISTS (
    SELECT 1
    FROM "Assignment" a
    INNER JOIN "Activity" act ON a."activityId" = act.id
    WHERE a."participantId" = p.id
      AND (${roleIds.length} = 0 OR a."roleId" = ANY(${roleIds}::uuid[]))
      AND (${!startDate} OR act."startDate" >= ${startDate}::date)
      AND (${!endDate} OR act."endDate" <= ${endDate}::date OR act."endDate" IS NULL)
  )
  ORDER BY p.name
  LIMIT ${limit} OFFSET ${(page - 1) * limit}
`;
```

### Testing Data Setup

Create test fixtures with:
- 5 participants
- 3 roles (Tutor, Teacher, Participant)
- 10 activities spanning different date ranges (some ongoing with null endDate)
- 20 assignments connecting participants to activities with various roles

Test scenarios:
1. Participant A: Tutor in Activity 1 (2025-01-01 to 2025-03-31)
2. Participant B: Teacher in Activity 2 (2025-02-01 to 2025-04-30)
3. Participant C: Tutor in Activity 3 (2025-03-01 to null - ongoing)
4. Participant D: Participant in Activity 4 (2024-12-01 to 2024-12-31)
5. Participant E: No assignments

Filter tests:
- `roleIds=[Tutor]` → Returns A, C
- `roleIds=[Teacher]` → Returns B
- `roleIds=[Tutor,Teacher]` → Returns A, B, C
- `activityStartDate=2025-02-01&activityEndDate=2025-03-31` → Returns A, B, C (overlap)
- `activityStartDate=2025-04-01` → Returns B, C (C is ongoing)
- `activityEndDate=2025-01-31` → Returns A, D
- `roleIds=[Tutor]&activityStartDate=2025-02-01` → Returns A, C (both Tutor AND active after Feb 1)

### Performance Benchmarking

Measure query performance with:
```sql
-- Enable query timing
\timing on

-- Test role filter
EXPLAIN ANALYZE
SELECT DISTINCT p.*
FROM "Participant" p
INNER JOIN "Assignment" a ON a."participantId" = p.id
WHERE a."roleId" = ANY(ARRAY['uuid1', 'uuid2']::uuid[]);

-- Test activity date range filter
EXPLAIN ANALYZE
SELECT DISTINCT p.*
FROM "Participant" p
INNER JOIN "Assignment" a ON a."participantId" = p.id
INNER JOIN "Activity" act ON a."activityId" = act.id
WHERE act."startDate" <= '2025-12-31'
  AND (act."endDate" >= '2025-01-01' OR act."endDate" IS NULL);

-- Test combined filters
EXPLAIN ANALYZE
SELECT DISTINCT p.*
FROM "Participant" p
INNER JOIN "Assignment" a ON a."participantId" = p.id
INNER JOIN "Activity" act ON a."activityId" = act.id
WHERE a."roleId" = ANY(ARRAY['uuid1']::uuid[])
  AND act."startDate" <= '2025-12-31'
  AND (act."endDate" >= '2025-01-01' OR act."endDate" IS NULL);
```

Target: All queries should use indexes and complete in < 100ms.

### Migration Script

```prisma
-- CreateIndexesForAssignmentFiltering
-- Add indexes to support efficient role and activity date range filtering

-- Index for role-based filtering
CREATE INDEX IF NOT EXISTS "idx_assignment_role_id" ON "Assignment"("roleId");

-- Indexes for activity date range filtering
CREATE INDEX IF NOT EXISTS "idx_activity_start_date" ON "Activity"("startDate");
CREATE INDEX IF NOT EXISTS "idx_activity_end_date" ON "Activity"("endDate");

-- Composite index for participant-role lookups
CREATE INDEX IF NOT EXISTS "idx_assignment_participant_role" ON "Assignment"("participantId", "roleId");
```
