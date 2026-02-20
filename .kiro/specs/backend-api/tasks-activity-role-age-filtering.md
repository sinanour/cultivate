# Implementation Plan: Activity List Role and Age Cohort Filtering

## Overview

This implementation plan covers the backend API changes needed to support filtering activities by participant role and age cohort. The implementation extends the existing unified flexible filtering system in the ActivityRepository and ActivityService.

## Tasks

- [x] 1. Update validation schemas for new filter parameters
  - [x] 1.1 Update ActivityQuerySchema in validation.schemas.ts
    - Add roleIds field to filter object: `z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional())`
    - Add ageCohorts field to filter object: `z.preprocess(normalizeToArray, z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional())`
    - Use z.preprocess with normalizeToArray to handle single values, multiple parameters, and comma-separated values
    - Validate that roleIds are valid UUIDs
    - Validate that ageCohorts are valid cohort names
    - _Requirements: 4D.1, 4D.2, 4D.3, 4D.4, 4D.5, 4D.6_

  - [ ]* 1.2 Write unit tests for validation schema
    - Test valid roleIds array is accepted
    - Test invalid UUIDs in roleIds are rejected
    - Test valid ageCohorts array is accepted
    - Test invalid cohort names are rejected
    - Test single value, multiple parameters, and comma-separated values are normalized correctly
    - **Validates: Requirements 4D.1, 4D.2, 4D.3, 4D.4, 4D.5, 4D.6**

- [x] 2. Implement assignment-based filtering in ActivityRepository
  - [x] 2.1 Create buildAssignmentFilter helper method
    - Accept filter object as parameter
    - Check if roleIds or ageCohorts filters are present
    - Return null if no assignment-based filters
    - Build Prisma where clause for assignments.some with role and/or age cohort conditions
    - Combine role filter and age cohort filter using AND logic when both present
    - _Requirements: 4D.7, 4D.8, 4D.9, 4D.10, 4D.11, 4D.12, 4D.23_

  - [x] 2.2 Create buildAgeCohortFilter helper method
    - Accept ageCohorts array and filter endDate parameters
    - Calculate reference date using calculateReferenceDate() utility
    - Use minimum of (current date, filter endDate) as reference
    - Convert each cohort to date range using convertCohortToDateRange(cohort, referenceDate)
    - Build Prisma where clause for participant.dateOfBirth
    - Handle "Unknown" cohort as dateOfBirth IS NULL
    - Return Prisma where clause for age cohort filtering
    - _Requirements: 4D.16, 4D.17, 4D.18, 4D.19, 4D.20, 4D.28, 4D.29, 4D.30, 4D.31, 4D.32, 4D.33, 4D.34, 4D.35, 4D.36, 4D.37, 4D.38, 4D.39, 4D.40, 4D.41, 4D.42, 4D.43, 4D.44, 4D.45_

  - [x] 2.3 Update buildWhereClause method
    - Skip roleIds and ageCohorts in main filter loop
    - Call buildAssignmentFilter() to get assignment-based where clause
    - Merge assignment filter into main where clause
    - Ensure existing filters (name, activityTypeIds, status, etc.) continue to work
    - _Requirements: 4D.55, 4D.56, 4D.57, 4D.58_

  - [x] 2.4 Update findAllPaginated method to use DISTINCT
    - Add `distinct: ['id']` to Prisma query when assignment-based filters are present
    - Ensure DISTINCT works correctly with include statements for activityType and activityCategory
    - If DISTINCT causes issues with includes, implement alternative deduplication strategy
    - _Requirements: 4D.25, 4D.26, 4D.27, 4D.49_

  - [ ]* 2.5 Write unit tests for repository methods
    - Test buildAssignmentFilter with roleIds only
    - Test buildAssignmentFilter with ageCohorts only
    - Test buildAssignmentFilter with both roleIds and ageCohorts
    - Test buildAgeCohortFilter with various reference dates
    - Test buildAgeCohortFilter handles all cohort types
    - Test buildWhereClause integrates assignment filters correctly
    - **Validates: Requirements 4D.7, 4D.8, 4D.9, 4D.13, 4D.14, 4D.15, 4D.16, 4D.21, 4D.22, 4D.23, 4D.37, 4D.38_

- [x] 3. Update ActivityService for new filters
  - [x] 3.1 Add optional role ID validation
    - Create validateRoleIds(roleIds) method
    - Query RoleRepository to check if role IDs exist
    - Log warning for non-existent role IDs but don't throw error (return empty results instead)
    - _Requirements: 4D.63_

  - [x] 3.2 Update getActivities method
    - Pass roleIds filter to repository
    - Pass ageCohorts filter to repository
    - Ensure existing activity fields are still included in response
    - _Requirements: 4D.13, 4D.14, 4D.15, 4D.23, 4D.24, 4D.59, 4D.60, 4D.61, 4D.62_

  - [ ]* 3.3 Write unit tests for service methods
    - Test getActivities with roleIds filter
    - Test getActivities with ageCohorts filter
    - Test getActivities with both filters combined
    - Test getActivities with role filter + existing filters (population, activity type)
    - Test validateRoleIds with valid and invalid role IDs
    - **Validates: Requirements 4D.13, 4D.14, 4D.15, 4D.23, 4D.24, 4D.63**

- [x] 4. Verify database indexes exist
  - [x] 4.1 Check for required indexes
    - Verify index exists on Assignment.roleId
    - Verify index exists on Participant.dateOfBirth
    - Verify index exists on Assignment(activityId, participantId)
    - If missing, create migration to add indexes
    - _Requirements: 4D.46, 4D.47, 4D.49_

  - [x] 4.2 Verify index usage with EXPLAIN ANALYZE
    - Run EXPLAIN ANALYZE on queries with roleIds filter
    - Run EXPLAIN ANALYZE on queries with ageCohorts filter
    - Run EXPLAIN ANALYZE on queries with both filters
    - Verify indexes are being used by query planner
    - Measure query execution time and ensure < 200ms
    - _Requirements: 4D.48, 4D.49, 4D.50_

- [x] 5. Update route handler for new filters
  - [x] 5.1 Update GET /api/v1/activities route
    - Ensure validation middleware uses updated ActivityQuerySchema
    - Extract roleIds and ageCohorts from query parameters
    - Pass new filters to ActivityService.getActivities()
    - Return standard paginated response format
    - _Requirements: 4D.59, 4D.60, 4D.61, 4D.62_

  - [x] 5.2 Add error handling for new filters
    - Catch validation errors and return 400 Bad Request
    - Catch database errors and return 500 Internal Server Error
    - Log all errors for debugging
    - Return descriptive error messages
    - _Requirements: 4D.63, 4D.64, 4D.65, 4D.66_

- [x] 6. Write integration tests
  - [x] 6.1 Test role filtering
    - Create test activities with participants having various roles
    - Test filtering by single role returns correct activities
    - Test filtering by multiple roles applies OR logic correctly
    - Test activities without matching roles are excluded
    - Test role filter combined with activity type filter applies AND logic
    - _Requirements: 4D.13, 4D.14, 4D.23, 4D.24, 4D.56, 4D.57_

  - [x] 6.2 Test age cohort filtering
    - Create test activities with participants of various ages
    - Test filtering by single age cohort returns correct activities
    - Test filtering by multiple age cohorts applies OR logic correctly
    - Test activities without matching age cohorts are excluded
    - Test age cohort filter with date range (reference date calculation)
    - Test age cohort filter with completed activities (reference date includes activity endDate)
    - _Requirements: 4D.15, 4D.16, 4D.17, 4D.18, 4D.19, 4D.20, 4D.21, 4D.22, 4D.24, 4D.56, 4D.57_

  - [x] 6.3 Test combined role and age cohort filtering
    - Create test data with participants having various roles and ages
    - Test filtering by role AND age cohort applies AND logic correctly
    - Test activities must have participants matching BOTH criteria
    - Test combined filters with other activity filters (population, activity type, date range)
    - _Requirements: 4D.23, 4D.24, 4D.58_

  - [x] 6.4 Test pagination with new filters
    - Test pagination works correctly with role filter
    - Test pagination works correctly with age cohort filter
    - Test total count is accurate with new filters
    - Test page navigation maintains filter state
    - Test stable ordering (ORDER BY activity.id)
    - _Requirements: 4D.51, 4D.52, 4D.53, 4D.54_

  - [x] 6.5 Test error handling
    - Test invalid UUID in roleIds returns 400 Bad Request
    - Test invalid cohort name returns 400 Bad Request
    - Test non-existent role IDs return empty results (not error)
    - Test cohorts with no matching participants return empty results
    - _Requirements: 4D.4, 4D.6, 4D.63, 4D.64, 4D.65, 4D.66_

  - [x] 6.6 Test query performance
    - Create dataset with 100,000 activities and 500,000 assignments
    - Measure query latency with roleIds filter
    - Measure query latency with ageCohorts filter
    - Measure query latency with both filters combined
    - Verify all queries complete in < 200ms
    - Verify indexes are being used (check EXPLAIN ANALYZE output)
    - _Requirements: 4D.48, 4D.49, 4D.50_

- [ ]* 7. Write property tests for filtering logic
  - **Property 405: Role Filter Inclusion for Activities**
  - **Property 406: Role Filter Exclusion for Activities**
  - **Property 407: Role Filter OR Logic Within Dimension**
  - **Property 408: Age Cohort Filter with Reference Date Calculation**
  - **Property 409: Age Cohort Filter with Date Range (Reference Date)**
  - **Property 410: Age Cohort Filter with Activity EndDate (Reference Date)**
  - **Property 411: Age Cohort Filter with Both Dates (Minimum Reference Date)**
  - **Property 412: Combined Role and Age Cohort AND Logic**
  - **Property 413: Participant Filters with Existing Activity Filters**
  - **Property 414: No Duplicate Activities in Results**
  - **Property 415: Pagination with Participant Filters**
  - **Property 416: Total Count Accuracy with Participant Filters**
  - **Validates: Requirements 4D.13, 4D.14, 4D.15, 4D.16, 4D.17, 4D.18, 4D.19, 4D.20, 4D.21, 4D.22, 4D.23, 4D.24, 4D.25, 4D.51, 4D.52, 4D.53, 4D.54, 4D.55, 4D.56, 4D.57, 4D.58**

- [x] 8. Checkpoint - Verify backend implementation
  - Ensure all tests pass
  - Verify query performance meets targets (<200ms)
  - Test with realistic data volumes
  - Verify reference date calculation works correctly
  - Verify conditional joins are added only when needed
  - Ask the user if questions arise

## Implementation Notes

### Reference Date Calculation Examples

```typescript
// Example 1: No temporal constraints
const ref1 = calculateReferenceDate(
  new Date('2026-02-20'),
  null, // ongoing activity
  null  // no date filter
);
// Result: 2026-02-20

// Example 2: Activity has finite endDate
const ref2 = calculateReferenceDate(
  new Date('2026-02-20'),
  new Date('2025-12-31'), // activity ended
  null  // no date filter
);
// Result: 2025-12-31 (earlier than current)

// Example 3: Date range filter active
const ref3 = calculateReferenceDate(
  new Date('2026-02-20'),
  null, // ongoing activity
  new Date('2025-06-30')  // filter endDate
);
// Result: 2025-06-30 (earlier than current)

// Example 4: Both activity endDate and filter endDate
const ref4 = calculateReferenceDate(
  new Date('2026-02-20'),
  new Date('2025-12-31'), // activity ended
  new Date('2025-06-30')  // filter endDate
);
// Result: 2025-06-30 (earliest of all three)
```

### Testing Data Setup

Create test fixtures with:
- 10 activities with various statuses and date ranges
- 5 roles (Tutor, Teacher, Animator, Host, Participant)
- 20 participants with various ages
- 50 assignments connecting participants to activities with various roles

Test scenarios:
1. Activity A (ended 2025-12-31): Participant 1 (born 2010-01-01, Tutor)
2. Activity B (ongoing): Participant 2 (born 2005-06-15, Teacher)
3. Activity C (ended 2024-06-30): Participant 3 (born 2008-03-20, Tutor)
4. Activity D (ongoing): Participant 4 (born 2000-11-10, Animator)

Filter tests with date range 2025-01-01 to 2025-06-30:
- `roleIds=[Tutor]` → Returns A, C (both have Tutors)
- `ageCohorts=[Youth]` → Returns A, B, C (participants were Youth at reference date 2025-06-30)
- `roleIds=[Tutor] + ageCohorts=[Youth]` → Returns A, C (Tutors who were Youth at reference date)
- Reference date for cohort calculation: 2025-06-30 (minimum of current and filter endDate)

### Performance Benchmarking

Measure query performance with:
```sql
-- Enable query timing
\timing on

-- Test role filter
EXPLAIN ANALYZE
SELECT DISTINCT a.*
FROM "Activity" a
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
WHERE asn."roleId" = ANY(ARRAY['uuid1', 'uuid2']::uuid[]);

-- Test age cohort filter with reference date
EXPLAIN ANALYZE
SELECT DISTINCT a.*
FROM "Activity" a
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
WHERE p."dateOfBirth" >= '2004-06-30' AND p."dateOfBirth" < '2010-06-30';

-- Test combined filters
EXPLAIN ANALYZE
SELECT DISTINCT a.*
FROM "Activity" a
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
WHERE asn."roleId" = ANY(ARRAY['uuid1']::uuid[])
  AND p."dateOfBirth" >= '2004-06-30' 
  AND p."dateOfBirth" < '2010-06-30';
```

Target: All queries should use indexes and complete in < 200ms.
