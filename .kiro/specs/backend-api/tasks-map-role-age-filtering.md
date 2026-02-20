# Implementation Plan: Map Data API Role and Age Cohort Filtering

## Overview

This implementation plan covers the backend API changes needed to support role and age cohort filtering for map marker endpoints. The implementation extends the existing optimized raw SQL query system with conditional joins for the Assignment and Participant tables.

## Tasks

- [x] 1. Update validation schemas for new filter parameters
  - [x] 1.1 Update ActivityMarkersQuerySchema in validation.schemas.ts
    - Add roleIds field: `z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional())`
    - Add ageCohorts field: `z.preprocess(normalizeToArray, z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional())`
    - Use z.preprocess with normalizeToArray to handle single values, multiple parameters, and comma-separated values
    - Validate that roleIds are valid UUIDs
    - Validate that ageCohorts are valid cohort names
    - _Requirements: 1A.1, 1A.2, 1A.3, 1A.4, 1A.5, 1A.6_

  - [x] 1.2 Update ParticipantHomeMarkersQuerySchema in validation.schemas.ts
    - Add roleIds field: `z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional())`
    - Add ageCohorts field: `z.preprocess(normalizeToArray, z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional())`
    - Use same validation pattern as ActivityMarkersQuerySchema
    - _Requirements: 1B.1, 1B.2, 1B.3, 1B.4, 1B.5, 1B.6_

  - [x] 1.3 Update VenueMarkersQuerySchema in validation.schemas.ts
    - Add roleIds field: `z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional())`
    - Add ageCohorts field: `z.preprocess(normalizeToArray, z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional())`
    - Note: These parameters are accepted but will be silently ignored
    - _Requirements: 1C.1, 1C.2, 1C.6_

  - [ ]* 1.4 Write unit tests for validation schemas
    - Test valid roleIds array is accepted
    - Test invalid UUIDs in roleIds are rejected
    - Test valid ageCohorts array is accepted
    - Test invalid cohort names are rejected
    - Test single value, multiple parameters, and comma-separated values are normalized correctly
    - **Validates: Requirements 1A.1, 1A.2, 1A.3, 1A.4, 1A.5, 1A.6, 1B.1, 1B.2, 1B.3, 1B.4, 1B.5, 1B.6**

- [x] 2. Implement reference date calculation utility
  - [x] 2.1 Create calculateReferenceDate utility function
    - Create function in backend-api/src/utils/age-cohort.utils.ts
    - Accept parameters: currentDate (Date), activityEndDate (Date | null), filterEndDate (Date | null)
    - Return the minimum (earliest) of all non-null dates
    - When all three dates provided, return the earliest
    - When only currentDate and one other date provided, return the earlier
    - When only currentDate provided, return currentDate
    - _Requirements: 1A.24, 1A.25, 1A.26, 1A.27, 1A.28, 1A.29, 1A.30_

  - [x] 2.2 Update convertCohortToDateRange to accept reference date
    - Modify existing convertCohortToDateRange() function signature
    - Add referenceDate parameter (Date)
    - Use referenceDate instead of current date for all calculations
    - Calculate cohort boundaries relative to referenceDate
    - Maintain same cohort definitions (Child < 11, Junior Youth 11-14, etc.)
    - _Requirements: 1A.26, 1A.28, 1A.29, 1A.30, 1A.31, 1A.32, 1A.33, 1A.34, 1A.35, 1A.36_

  - [ ]* 2.3 Write unit tests for reference date calculation
    - Test with all three dates provided (returns minimum)
    - Test with currentDate and activityEndDate only
    - Test with currentDate and filterEndDate only
    - Test with only currentDate (returns currentDate)
    - Test with future activityEndDate (returns currentDate)
    - Test with past filterEndDate (returns filterEndDate)
    - **Validates: Requirements 1A.24, 1A.25, 1A.26, 1A.27, 1A.28, 1A.29, 1A.30**

  - [ ]* 2.4 Write unit tests for enhanced convertCohortToDateRange
    - Test each cohort with various reference dates
    - Test "Child" cohort boundaries with reference date
    - Test "Junior Youth" cohort boundaries with reference date
    - Test "Youth" cohort boundaries with reference date
    - Test "Young Adult" cohort boundaries with reference date
    - Test "Adult" cohort boundaries with reference date
    - Test "Unknown" cohort returns null
    - **Validates: Requirements 1A.28, 1A.29, 1A.30, 1A.31, 1A.32, 1A.33**

- [x] 3. Extend ActivityMarkerQueryBuilder for role and age cohort filters
  - [x] 3.1 Update selectQueryVariant method
    - Check for roleIds filter presence
    - Check for ageCohorts filter presence
    - Determine needsParticipantJoins flag (population OR role OR ageCohort)
    - Return appropriate query variant based on filter combination
    - _Requirements: 1A.7, 1A.8, 1A.9, 1A.10, 1A.11, 1A.12, 1A.36_

  - [x] 3.2 Create buildRoleFilter method
    - Accept filters object as parameter
    - Return SQL fragment for role filtering
    - When roleIds present: return 'asn."roleId" = ANY($roleIds::uuid[])'
    - When roleIds not present: return '$roleIds IS NULL'
    - _Requirements: 1A.13, 1A.14, 1A.34_

  - [x] 3.3 Create buildAgeCohortFilter method
    - Accept filters object and reference date as parameters
    - Calculate reference date using calculateReferenceDate()
    - Convert each cohort to date range using convertCohortToDateRange(cohort, referenceDate)
    - Build SQL conditions for each cohort
    - Combine conditions with OR logic
    - Handle "Unknown" cohort as p."dateOfBirth" IS NULL
    - Return SQL fragment for age cohort filtering
    - _Requirements: 1A.15, 1A.16, 1A.17, 1A.18, 1A.19, 1A.20, 1A.21, 1A.22, 1A.35_

  - [x] 3.4 Update addConditionalJoins method
    - Check if roleIds, ageCohorts, or populationIds filters are present
    - When any participant-related filter present, add Assignment join
    - When ageCohorts or populationIds present, add Participant join
    - When populationIds present, add ParticipantPopulation join
    - Ensure joins are added in correct order
    - _Requirements: 1A.7, 1A.8, 1A.9, 1A.10, 1A.11, 1A.12, 1A.42, 1A.43, 1A.44_

  - [x] 3.5 Update buildWhereClause method
    - Call buildRoleFilter() and add to WHERE conditions
    - Call buildAgeCohortFilter() and add to WHERE conditions
    - Ensure role and age cohort filters combine with AND logic
    - Ensure all filters combine with AND logic across dimensions
    - _Requirements: 1A.23, 1A.24, 1A.40_

  - [x] 3.6 Update needsGroupBy method
    - Return true when roleIds filter is present
    - Return true when ageCohorts filter is present
    - Return true when populationIds filter is present
    - GROUP BY required to deduplicate activities with multiple matching participants
    - _Requirements: 1A.21, 1A.22, 1A.23_

  - [ ]* 3.7 Write unit tests for ActivityMarkerQueryBuilder extensions
    - Test selectQueryVariant with role filter
    - Test selectQueryVariant with age cohort filter
    - Test selectQueryVariant with both filters
    - Test buildRoleFilter generates correct SQL
    - Test buildAgeCohortFilter generates correct SQL with reference date
    - Test addConditionalJoins adds correct tables
    - Test needsGroupBy returns true when participant filters present
    - **Validates: Requirements 1A.7, 1A.8, 1A.9, 1A.10, 1A.11, 1A.12, 1A.13, 1A.14, 1A.15, 1A.21, 1A.22, 1A.34, 1A.35, 1A.36, 1A.42, 1A.43, 1A.44**

- [x] 4. Update MapDataService for activity markers
  - [x] 4.1 Update getActivityMarkers method
    - Extract roleIds and ageCohorts from filters parameter
    - Calculate reference date using calculateReferenceDate()
    - Pass reference date to ActivityMarkerQueryBuilder constructor
    - Ensure new filters are passed to query builder
    - Maintain existing authorization and geographic filtering logic
    - _Requirements: 1A.13, 1A.14, 1A.15, 1A.16, 1A.17, 1A.18, 1A.19, 1A.20, 1A.23, 1A.24_

  - [ ]* 4.2 Write unit tests for getActivityMarkers with new filters
    - Test method accepts roleIds filter
    - Test method accepts ageCohorts filter
    - Test method passes filters to query builder
    - Test reference date calculation is invoked
    - **Validates: Requirements 1A.13, 1A.14, 1A.15**

- [x] 5. Update MapDataService for participant home markers
  - [x] 5.1 Update getParticipantHomeMarkers method
    - Add role filter using Prisma's assignments.some() pattern
    - Calculate reference date for age cohort filtering
    - Convert ageCohorts to date range conditions using enhanced convertCohortToDateRange()
    - Apply date range conditions to WHERE clause
    - Combine role and age cohort filters with AND logic
    - Maintain existing grouping by venue logic
    - _Requirements: 1B.7, 1B.8, 1B.9, 1B.10, 1B.11, 1B.12, 1B.13, 1B.14, 1B.15, 1B.16, 1B.17, 1B.18, 1B.19, 1B.20, 1B.21, 1B.22_

  - [ ]* 5.2 Write unit tests for getParticipantHomeMarkers with new filters
    - Test method accepts roleIds filter
    - Test method accepts ageCohorts filter
    - Test role filter applies assignments.some() pattern
    - Test age cohort filter converts to date range conditions
    - Test reference date calculation with filter endDate
    - **Validates: Requirements 1B.7, 1B.11, 1B.12, 1B.13, 1B.14, 1B.15, 1B.18, 1B.19, 1B.20, 1B.21**

- [x] 6. Update MapDataService for venue markers
  - [x] 6.1 Update getVenueMarkers method
    - Accept roleIds and ageCohorts parameters in filters
    - Silently ignore these parameters (don't use in query)
    - Maintain existing venue filtering logic
    - Ensure no performance impact from unused parameters
    - _Requirements: 1C.1, 1C.2, 1C.3, 1C.4, 1C.5, 1C.7_

  - [ ]* 6.2 Write unit tests for getVenueMarkers with ignored filters
    - Test method accepts roleIds parameter
    - Test method accepts ageCohorts parameter
    - Test parameters are silently ignored
    - Test query results unchanged by these parameters
    - **Validates: Requirements 1C.1, 1C.2, 1C.3, 1C.4, 1C.5, 1C.6, 1C.7**

- [x] 7. Update route handlers for new filters
  - [x] 7.1 Update GET /api/v1/map/activities route
    - Ensure validation middleware uses updated ActivityMarkersQuerySchema
    - Extract roleIds and ageCohorts from query parameters
    - Pass new filters to MapDataService.getActivityMarkers()
    - Return standard paginated response format
    - _Requirements: 1A.1, 1A.2, 1A.44, 1A.45, 1A.46, 1A.47_

  - [x] 7.2 Update GET /api/v1/map/participant-homes route
    - Ensure validation middleware uses updated ParticipantHomeMarkersQuerySchema
    - Extract roleIds and ageCohorts from query parameters
    - Pass new filters to MapDataService.getParticipantHomeMarkers()
    - Return standard paginated response format
    - _Requirements: 1B.1, 1B.2, 1B.27, 1B.28, 1B.29, 1B.30_

  - [x] 7.3 Update GET /api/v1/map/venues route
    - Ensure validation middleware uses updated VenueMarkersQuerySchema
    - Accept roleIds and ageCohorts parameters (validation passes)
    - Pass to MapDataService.getVenueMarkers() which ignores them
    - Return standard paginated response format
    - _Requirements: 1C.1, 1C.2, 1C.3, 1C.4, 1C.6_

  - [x] 7.4 Add error handling for new filters
    - Catch validation errors and return 400 Bad Request
    - Catch database errors and return 500 Internal Server Error
    - Log all errors for debugging
    - Return descriptive error messages
    - _Requirements: 1A.48, 1A.49, 1A.50, 1A.51, 1B.31, 1B.32, 1B.33, 1B.34_

- [x] 8. Write integration tests
  - [x] 8.1 Test activity markers with role filter
    - Create test activities with participants having various roles
    - Test filtering by single role returns correct activities
    - Test filtering by multiple roles applies OR logic correctly
    - Test activities without matching roles are excluded
    - Test role filter combined with activity type filter applies AND logic
    - _Requirements: 1A.13, 1A.14, 1A.23, 1A.24, 1A.40_

  - [x] 8.2 Test activity markers with age cohort filter
    - Create test activities with participants of various ages
    - Test filtering by single age cohort returns correct activities
    - Test filtering by multiple age cohorts applies OR logic correctly
    - Test activities without matching age cohorts are excluded
    - Test age cohort filter with date range (reference date calculation)
    - Test age cohort filter with completed activities (reference date includes activity endDate)
    - _Requirements: 1A.15, 1A.16, 1A.17, 1A.18, 1A.19, 1A.20, 1A.21, 1A.22, 1A.24, 1A.40_

  - [x] 8.3 Test activity markers with combined role and age cohort filters
    - Create test data with participants having various roles and ages
    - Test filtering by role AND age cohort applies AND logic correctly
    - Test activities must have participants matching BOTH criteria
    - Test combined filters with other activity filters (population, activity type, date range)
    - _Requirements: 1A.23, 1A.24, 1A.40_

  - [x] 8.4 Test participant home markers with role filter
    - Create test participants with various role assignments
    - Test filtering by role returns correct participant homes
    - Test role filter combined with population filter applies AND logic
    - _Requirements: 1B.11, 1B.12, 1B.17, 1B.18_

  - [x] 8.5 Test participant home markers with age cohort filter
    - Create test participants of various ages
    - Test filtering by age cohort returns correct participant homes
    - Test age cohort filter with date range (reference date calculation)
    - Test age cohort filter combined with population filter applies AND logic
    - _Requirements: 1B.13, 1B.14, 1B.15, 1B.16, 1B.17, 1B.18, 1B.19, 1B.20, 1B.21, 1B.22_

  - [x] 8.6 Test venue markers ignore role and age cohort filters
    - Test venue markers endpoint accepts roleIds parameter
    - Test venue markers endpoint accepts ageCohorts parameter
    - Test venue markers results unchanged by these parameters
    - Test no validation errors when parameters provided
    - _Requirements: 1C.1, 1C.2, 1C.3, 1C.4, 1C.5, 1C.6, 1C.7_

  - [x] 8.7 Test pagination with new filters
    - Test pagination works correctly with role filter
    - Test pagination works correctly with age cohort filter
    - Test total count is accurate with new filters
    - Test page navigation maintains filter state
    - Test stable ordering (ORDER BY activity.id)
    - _Requirements: 1A.40, 1A.41, 1A.42, 1A.43_

  - [x] 8.8 Test error handling
    - Test invalid UUID in roleIds returns 400 Bad Request
    - Test invalid cohort name returns 400 Bad Request
    - Test non-existent role IDs return empty results (not error)
    - Test cohorts with no matching participants return empty results
    - _Requirements: 1A.4, 1A.6, 1A.48, 1A.49, 1A.50, 1A.51_

  - [x] 8.9 Test query performance
    - Create dataset with 100,000 activities and 500,000 assignments
    - Measure query latency with roleIds filter
    - Measure query latency with ageCohorts filter
    - Measure query latency with both filters combined
    - Verify all queries complete in < 200ms
    - Verify indexes are being used (check EXPLAIN ANALYZE output)
    - _Requirements: 1A.39, 1A.65, 1A.66, 1A.67, 1B.23, 1B.24_

- [ ]* 9. Write property tests for filtering logic
  - **Property 375: Role Filter Inclusion for Activity Markers**
  - **Property 376: Role Filter Exclusion for Activity Markers**
  - **Property 377: Role Filter OR Logic Within Dimension**
  - **Property 378: Age Cohort Filter with Reference Date Calculation**
  - **Property 379: Age Cohort Filter with Date Range (Reference Date)**
  - **Property 380: Age Cohort Filter with Activity EndDate (Reference Date)**
  - **Property 381: Age Cohort Filter with Both Dates (Minimum Reference Date)**
  - **Property 382: Combined Role and Age Cohort AND Logic**
  - **Property 383: Participant Filters with Existing Map Filters**
  - **Property 384: No Duplicate Activities in Results**
  - **Property 385: Pagination with Participant Filters**
  - **Property 386: Total Count Accuracy with Participant Filters**
  - **Property 387: Venue Markers Ignore Participant Filters**
  - **Validates: Requirements 1A.13, 1A.14, 1A.15, 1A.16, 1A.17, 1A.18, 1A.19, 1A.20, 1A.21, 1A.22, 1A.23, 1A.24, 1A.40, 1A.41, 1A.42, 1A.43, 1B.11, 1B.12, 1B.13, 1B.14, 1B.15, 1B.16, 1B.17, 1B.18, 1C.3, 1C.4, 1C.5**

- [x] 10. Update OpenAPI documentation
  - [x] 10.1 Document new filter parameters for activity markers
    - Add roleIds parameter to GET /api/v1/map/activities documentation
    - Add ageCohorts parameter documentation
    - Document parameter types, formats, and validation rules
    - Explain reference date calculation logic
    - _Requirements: 1A.1, 1A.2_

  - [x] 10.2 Document new filter parameters for participant home markers
    - Add roleIds parameter to GET /api/v1/map/participant-homes documentation
    - Add ageCohorts parameter documentation
    - Document parameter types, formats, and validation rules
    - Explain reference date calculation logic
    - _Requirements: 1B.1, 1B.2_

  - [x] 10.3 Document ignored parameters for venue markers
    - Add note that roleIds and ageCohorts parameters are accepted but ignored
    - Explain why these parameters don't apply to venue markers
    - _Requirements: 1C.1, 1C.2, 1C.3_

  - [x] 10.4 Add examples for new filters
    - Example: Filter by single role
    - Example: Filter by multiple roles
    - Example: Filter by single age cohort
    - Example: Filter by multiple age cohorts
    - Example: Combine role and age cohort filters
    - Example: Combine with date range (reference date calculation)
    - Example: Combine with other map filters
    - _Requirements: 1A.13, 1A.14, 1A.15, 1A.16, 1A.17, 1A.18, 1A.19, 1A.20, 1A.23, 1A.24_

- [x] 11. Checkpoint - Verify backend implementation
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
  new Date('2026-02-19'),
  null, // ongoing activity
  null  // no date filter
);
// Result: 2026-02-19

// Example 2: Activity has finite endDate
const ref2 = calculateReferenceDate(
  new Date('2026-02-19'),
  new Date('2025-12-31'), // activity ended
  null  // no date filter
);
// Result: 2025-12-31 (earlier than current)

// Example 3: Date range filter active
const ref3 = calculateReferenceDate(
  new Date('2026-02-19'),
  null, // ongoing activity
  new Date('2025-06-30')  // filter endDate
);
// Result: 2025-06-30 (earlier than current)

// Example 4: Both activity endDate and filter endDate
const ref4 = calculateReferenceDate(
  new Date('2026-02-19'),
  new Date('2025-12-31'), // activity ended
  new Date('2025-06-30')  // filter endDate
);
// Result: 2025-06-30 (earliest of all three)
```

### SQL Query Example with Reference Date

```sql
-- Age cohort boundaries calculated using reference date
-- Reference date = MIN(current_date, filter_endDate)
-- Example: filter_endDate = 2025-06-30, so reference = 2025-06-30

-- Child: dateOfBirth > 2014-06-30 (reference - 11 years)
-- Junior Youth: dateOfBirth >= 2010-06-30 AND < 2014-06-30
-- Youth: dateOfBirth >= 2004-06-30 AND < 2010-06-30
-- Young Adult: dateOfBirth >= 1995-06-30 AND < 2004-06-30
-- Adult: dateOfBirth < 1995-06-30

WHERE (
  'Youth' = ANY($ageCohorts) AND 
  p."dateOfBirth" >= '2004-06-30' AND 
  p."dateOfBirth" < '2010-06-30'
)
```

### Performance Benchmarking

Measure query performance with:
```sql
-- Enable query timing
\timing on

-- Test role filter
EXPLAIN ANALYZE
SELECT DISTINCT a.id, cv.latitude, cv.longitude
FROM "Activity" a
INNER JOIN current_venues cv ON cv."activityId" = a.id
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
WHERE asn."roleId" = ANY(ARRAY['uuid1', 'uuid2']::uuid[])
ORDER BY a.id
LIMIT 100;

-- Test age cohort filter with reference date
EXPLAIN ANALYZE
SELECT DISTINCT a.id, cv.latitude, cv.longitude
FROM "Activity" a
INNER JOIN current_venues cv ON cv."activityId" = a.id
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
WHERE p."dateOfBirth" >= '2004-06-30' AND p."dateOfBirth" < '2010-06-30'
ORDER BY a.id
LIMIT 100;

-- Test combined filters
EXPLAIN ANALYZE
SELECT DISTINCT a.id, cv.latitude, cv.longitude
FROM "Activity" a
INNER JOIN current_venues cv ON cv."activityId" = a.id
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
WHERE asn."roleId" = ANY(ARRAY['uuid1']::uuid[])
  AND p."dateOfBirth" >= '2004-06-30' 
  AND p."dateOfBirth" < '2010-06-30'
ORDER BY a.id
LIMIT 100;
```

Target: All queries should use indexes and complete in < 200ms.

### Testing Data Setup

Create test fixtures with:
- 10 participants with various ages and roles
- 5 roles (Tutor, Teacher, Animator, Host, Participant)
- 20 activities spanning different date ranges
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
