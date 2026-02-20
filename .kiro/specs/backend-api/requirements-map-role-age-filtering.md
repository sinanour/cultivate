# Requirements Update: Map Data API Role and Age Cohort Filtering

## Overview

This document specifies new filtering capabilities for the Map Data API endpoints that enable filtering by participant roles and age cohorts. These filters require conditional joins with the Assignment and Participant tables, extending the existing query variant selection logic from the map-data-optimization spec.

## Related Requirements

This requirement extends:
- **Map Data Optimization Spec**: Optimized raw SQL queries with conditional joins
- **Requirement 3B**: Filter Participants by Role and Activity Date Range
- **Requirement 3A**: Calculate and Filter by Age Cohort

## Glossary

- **Assignment_Based_Filter**: A filter that requires joining the Assignment table to access participant-activity relationship data (roles)
- **Participant_Based_Filter**: A filter that requires joining the Participant table to access participant demographic data (age cohort)
- **Conditional_Join**: A database table join that is only included in the query when specific filters are present
- **Query_Variant**: A specific version of a SQL query optimized for a particular combination of filters
- **Reference_Date**: The date used as the reference point for calculating participant age cohorts, determined as the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)
- **Temporal_Boundary**: A date that constrains the temporal scope of a query (activity endDate or filter endDate), used to ensure age cohort calculations reflect participant ages at the most restrictive point in time
- **Age_Cohort_Date_Range_Conversion**: The process of converting age cohort names to date range conditions on dateOfBirth for database filtering, using a calculated reference date

## New Requirement: Map Data API Role and Age Cohort Filtering

### Requirement 1A: Filter Activity Markers by Role and Age Cohort

**User Story:** As a backend developer, I want the GET /api/v1/map/activities endpoint to support role and age cohort filtering with conditional joins, so that map markers can be filtered by participant demographics efficiently.

#### Acceptance Criteria

**API Parameter Acceptance:**

1. THE API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/map/activities endpoint
2. THE API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/map/activities endpoint
3. WHEN roleIds filter is provided, THE API SHALL validate that all provided values are valid UUIDs
4. WHEN invalid UUIDs are provided in roleIds filter, THE API SHALL return 400 Bad Request with a validation error
5. WHEN ageCohorts filter is provided, THE API SHALL validate that all provided values are valid age cohort names (Child, Junior Youth, Youth, Young Adult, Adult, Unknown)
6. WHEN invalid age cohort names are provided, THE API SHALL return 400 Bad Request with a validation error

**Conditional Join Logic:**

7. WHEN roleIds filter is provided, THE API SHALL conditionally join the Assignment table in the raw SQL query
8. WHEN ageCohorts filter is provided, THE API SHALL conditionally join both the Assignment and Participant tables in the raw SQL query
9. WHEN both roleIds and ageCohorts filters are provided, THE API SHALL join Assignment and Participant tables once and apply both filters
10. WHEN neither roleIds nor ageCohorts filters are provided, THE API SHALL NOT join Assignment or Participant tables
11. WHEN only population filter is provided (no role or age cohort), THE API SHALL join Assignment, Participant, and ParticipantPopulation tables as per existing implementation
12. WHEN population, role, and age cohort filters are all provided, THE API SHALL join Assignment, Participant, and ParticipantPopulation tables once and apply all filters

**Filter Application Logic:**

13. WHEN roleIds filter is provided, THE API SHALL return only activities where at least one participant has at least one assignment with a roleId matching at least one of the specified role IDs
14. WHEN multiple role IDs are provided, THE API SHALL apply OR logic within the role filter dimension (activity has participant with role A OR role B)
15. WHEN ageCohorts filter is provided, THE API SHALL return only activities where at least one participant's calculated age cohort matches at least one of the specified cohorts
16. WHEN calculating age cohort for activity marker filtering, THE API SHALL determine the reference date using the following logic:
    - Calculate the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)
    - Use this minimum date as the reference point for age cohort calculation
    - This ensures age cohorts reflect participant ages at the most restrictive temporal boundary
17. WHEN an activity has a finite endDate and no date range filter is active, THE API SHALL use the minimum of current date and activity endDate as the reference point
18. WHEN a date range filter is active with endDate and the activity has null endDate (ongoing), THE API SHALL use the minimum of current date and filter endDate as the reference point
19. WHEN a date range filter is active with endDate and the activity has a finite endDate, THE API SHALL use the minimum of current date, activity endDate, and filter endDate as the reference point
20. WHEN no date range filter is active and the activity has null endDate (ongoing), THE API SHALL use the current date as the reference point
21. WHEN multiple age cohorts are provided, THE API SHALL apply OR logic within the age cohort filter dimension (activity has participant in cohort A OR cohort B)
22. WHEN ageCohorts filter includes "Unknown", THE API SHALL include activities where at least one participant has null dateOfBirth
23. WHEN both roleIds and ageCohorts filters are provided, THE API SHALL apply AND logic across filter dimensions (activity must have participants matching BOTH role AND age cohort criteria)
24. WHEN roleIds or ageCohorts filters are combined with other activity filters (activityTypeIds, activityCategoryIds, status, date range, geographic area, population, bounding box), THE API SHALL apply all filters using AND logic across dimensions

**Deduplication:**

21. THE API SHALL use GROUP BY or DISTINCT to avoid returning duplicate activity records when multiple participants match the filter criteria
22. THE GROUP BY clause SHALL include: activity.id, latitude, longitude, activityTypeId, activityCategoryId
23. THE API SHALL maintain stable ordering (ORDER BY activity.id) after GROUP BY to ensure consistent pagination

**Reference Date Calculation for Age Cohort:**

24. THE API SHALL implement a calculateReferenceDate() utility function that determines the appropriate reference date for age cohort calculations
25. THE calculateReferenceDate() function SHALL accept: current date, activity endDate (nullable), and filter endDate (nullable)
26. THE calculateReferenceDate() function SHALL return the minimum of all non-null dates provided
27. WHEN all three dates are provided (current, activity endDate, filter endDate), THE function SHALL return the earliest date
28. WHEN only current date and activity endDate are provided, THE function SHALL return the earlier of the two
29. WHEN only current date and filter endDate are provided, THE function SHALL return the earlier of the two
30. WHEN only current date is provided (activity endDate is null and no filter endDate), THE function SHALL return the current date
31. THE API SHALL use the calculated reference date when converting age cohort names to date range conditions
32. THE API SHALL apply the reference date consistently across all activities in a single query
33. WHEN activities in the result set have different endDates, THE API SHALL use a conservative approach by calculating cohort boundaries based on the minimum reference date across all applicable temporal boundaries

**Age Cohort Date Range Conversion:**

25. WHEN ageCohorts filter is provided, THE API SHALL convert cohort names to date range conditions on Participant.dateOfBirth before executing the query
26. THE API SHALL use an enhanced convertCohortToDateRange() function that accepts a reference date parameter
27. THE API SHALL calculate the reference date for age cohort conversion as the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)
28. WHEN filtering for "Child" cohort, THE API SHALL query for participants with dateOfBirth > (reference date - 11 years)
29. WHEN filtering for "Junior Youth" cohort, THE API SHALL query for participants with dateOfBirth >= (reference date - 15 years) AND dateOfBirth < (reference date - 11 years)
30. WHEN filtering for "Youth" cohort, THE API SHALL query for participants with dateOfBirth >= (reference date - 21 years) AND dateOfBirth < (reference date - 15 years)
31. WHEN filtering for "Young Adult" cohort, THE API SHALL query for participants with dateOfBirth >= (reference date - 30 years) AND dateOfBirth < (reference date - 21 years)
32. WHEN filtering for "Adult" cohort, THE API SHALL query for participants with dateOfBirth < (reference date - 30 years)
33. WHEN filtering for "Unknown" cohort, THE API SHALL query for participants with dateOfBirth IS NULL
34. WHEN multiple age cohorts are specified, THE API SHALL combine the date range conditions using OR logic
35. THE API SHALL calculate age cohort date ranges once per query using the determined reference date, not per activity
36. WHEN the reference date varies across activities in the result set (due to different activity endDates), THE API SHALL use a conservative approach by calculating cohort boundaries based on the most restrictive reference date (minimum of all applicable dates)

**Query Optimization:**

33. THE API SHALL extend the existing ActivityMarkerQueryBuilder class to support role and age cohort filters
34. THE API SHALL add buildRoleFilter() method to construct role filter SQL fragment
35. THE API SHALL add buildAgeCohortFilter() method to construct age cohort filter SQL fragment
36. THE API SHALL update selectQueryVariant() method to consider role and age cohort filters when determining which tables to join
37. THE API SHALL use existing database indexes on Assignment.roleId for role filtering
38. THE API SHALL use existing database indexes on Participant.dateOfBirth for age cohort filtering
39. THE API SHALL maintain sub-200ms query latency for role and age cohort filtering on datasets with 100,000+ activities

**Pagination and Total Count:**

40. WHEN role or age cohort filters are applied, THE API SHALL include the filters in the total count calculation (COUNT(*) OVER() window function)
41. THE API SHALL return accurate total counts reflecting the filtered result set
42. THE API SHALL support pagination with role and age cohort filters (page and limit parameters work correctly)
43. THE API SHALL maintain stable ordering (ORDER BY activity.id) to ensure consistent pagination across pages

**Response Format:**

44. THE API SHALL return activity markers in the standard paginated response format with data and pagination metadata
45. THE API SHALL return only the fields needed for markers: id, latitude, longitude, activityTypeId, activityCategoryId
46. THE API SHALL NOT include assignment or participant details in the marker response (only filter by them)
47. THE API SHALL maintain consistent response format regardless of which filters are applied

**Error Handling:**

48. WHEN roleIds filter contains non-existent role IDs, THE API SHALL return an empty result set (not an error)
49. WHEN ageCohorts filter specifies cohorts with no matching participants, THE API SHALL return an empty result set (not an error)
50. WHEN query execution fails due to database errors, THE API SHALL return 500 Internal Server Error with appropriate error message
51. THE API SHALL log all query errors for debugging purposes

### Requirement 1B: Filter Participant Home Markers by Role and Age Cohort

**User Story:** As a backend developer, I want the GET /api/v1/map/participant-homes endpoint to support role and age cohort filtering with conditional joins, so that participant home markers can be filtered by demographics efficiently.

#### Acceptance Criteria

**API Parameter Acceptance:**

1. THE API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/map/participant-homes endpoint
2. THE API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/map/participant-homes endpoint
3. WHEN roleIds filter is provided, THE API SHALL validate that all provided values are valid UUIDs
4. WHEN invalid UUIDs are provided in roleIds filter, THE API SHALL return 400 Bad Request with a validation error
5. WHEN ageCohorts filter is provided, THE API SHALL validate that all provided values are valid age cohort names
6. WHEN invalid age cohort names are provided, THE API SHALL return 400 Bad Request with a validation error

**Conditional Join Logic:**

7. WHEN roleIds filter is provided, THE API SHALL conditionally join the Assignment table to filter participants by roles they've performed
8. WHEN ageCohorts filter is provided, THE API SHALL apply date range conditions on Participant.dateOfBirth without additional joins (Participant table is already in the query)
9. WHEN both roleIds and ageCohorts filters are provided, THE API SHALL join Assignment table and apply both filters using AND logic
10. WHEN neither roleIds nor ageCohorts filters are provided, THE API SHALL NOT join Assignment table (unless population filter requires it)

**Filter Application Logic:**

11. WHEN roleIds filter is provided, THE API SHALL return only participant home addresses for participants who have at least one assignment with a roleId matching at least one of the specified role IDs
12. WHEN multiple role IDs are provided, THE API SHALL apply OR logic within the role filter dimension
13. WHEN ageCohorts filter is provided, THE API SHALL return only participant home addresses for participants whose calculated age cohort matches at least one of the specified cohorts
14. WHEN calculating age cohort for participant home marker filtering, THE API SHALL use the current date as the reference point
15. WHEN multiple age cohorts are provided, THE API SHALL apply OR logic within the age cohort filter dimension
16. WHEN both roleIds and ageCohorts filters are provided, THE API SHALL apply AND logic across filter dimensions
17. WHEN roleIds or ageCohorts filters are combined with other participant home filters (geographic area, population, date range), THE API SHALL apply all filters using AND logic across dimensions

**Age Cohort Date Range Conversion:**

18. WHEN ageCohorts filter is provided, THE API SHALL convert cohort names to date range conditions on Participant.dateOfBirth
19. THE API SHALL use the same convertCohortToDateRange() logic as the participant list filtering implementation
20. THE API SHALL apply the same date range conditions as specified in Requirement 3A (Child, Junior Youth, Youth, Young Adult, Adult, Unknown)

**Query Optimization:**

21. THE API SHALL optimize queries by only joining Assignment table when roleIds filter is present
22. THE API SHALL use existing database indexes on Assignment.roleId for role filtering
23. THE API SHALL use existing database indexes on Participant.dateOfBirth for age cohort filtering
24. THE API SHALL maintain sub-200ms query latency for role and age cohort filtering on datasets with 10,000,000+ participants

**Deduplication:**

25. THE API SHALL group participant home markers by venue to avoid duplicate markers for the same venue
26. THE API SHALL count the number of participants at each venue matching the filter criteria
27. THE API SHALL maintain the existing grouping logic while adding role and age cohort filters

**Response Format:**

28. THE API SHALL return participant home markers in the standard paginated response format with data and pagination metadata
29. THE API SHALL return only the fields needed for markers: venueId, latitude, longitude, participantCount
30. THE API SHALL NOT include assignment or participant details in the marker response (only filter by them)
31. THE API SHALL maintain consistent response format regardless of which filters are applied

**Error Handling:**

32. WHEN roleIds filter contains non-existent role IDs, THE API SHALL return an empty result set (not an error)
33. WHEN ageCohorts filter specifies cohorts with no matching participants, THE API SHALL return an empty result set (not an error)
34. WHEN query execution fails due to database errors, THE API SHALL return 500 Internal Server Error with appropriate error message
35. THE API SHALL log all query errors for debugging purposes

### Requirement 1C: Ignore Role and Age Cohort Filters for Venue Markers

**User Story:** As a backend developer, I want the GET /api/v1/map/venues endpoint to silently ignore role and age cohort filters, so that the frontend can keep filters active when switching between map modes without causing errors.

#### Acceptance Criteria

1. THE API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/map/venues endpoint
2. THE API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/map/venues endpoint
3. WHEN roleIds or ageCohorts filters are provided to /api/v1/map/venues, THE API SHALL silently ignore these filters
4. THE API SHALL return all venues matching other active filters (geographic area, bounding box) regardless of role or age cohort filter values
5. THE API SHALL NOT join Assignment or Participant tables when processing /api/v1/map/venues requests, even if roleIds or ageCohorts parameters are present
6. THE API SHALL NOT return validation errors when roleIds or ageCohorts parameters are provided to /api/v1/map/venues
7. THE API SHALL maintain the same query structure and performance characteristics for /api/v1/map/venues regardless of role or age cohort filter presence

#### Implementation Notes

**Validation Schema Update:**

The validation schemas for map marker endpoints should be updated to accept the new filter parameters:

```typescript
// Activity Markers Query Schema
const ActivityMarkersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(100),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLon: z.coerce.number().min(-180).max(180).optional(),
  maxLon: z.coerce.number().min(-180).max(180).optional(),
  geographicAreaIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  activityCategoryIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  activityTypeIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  populationIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  // NEW: Role and age cohort filters
  roleIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  ageCohorts: z.preprocess(
    normalizeToArray,
    z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
  )
});

// Participant Home Markers Query Schema
const ParticipantHomeMarkersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(100),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLon: z.coerce.number().min(-180).max(180).optional(),
  maxLon: z.coerce.number().min(-180).max(180).optional(),
  geographicAreaIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  populationIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  // NEW: Role and age cohort filters
  roleIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  ageCohorts: z.preprocess(
    normalizeToArray,
    z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
  )
});

// Venue Markers Query Schema
const VenueMarkersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(100),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLon: z.coerce.number().min(-180).max(180).optional(),
  maxLon: z.coerce.number().min(-180).max(180).optional(),
  geographicAreaIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  // NEW: Accept but ignore role and age cohort filters
  roleIds: z.preprocess(normalizeToArray, z.array(z.string().uuid()).optional()),
  ageCohorts: z.preprocess(
    normalizeToArray,
    z.array(z.enum(['Child', 'Junior Youth', 'Youth', 'Young Adult', 'Adult', 'Unknown'])).optional()
  )
});
```

**Query Variant Selection Logic:**

```typescript
function selectQueryVariant(filters: MapFilters): QueryVariant {
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

**SQL Query Example with Role and Age Cohort Filters:**

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
-- Conditional joins for role and age cohort filtering
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
-- Conditional join for population filter (if present)
LEFT JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
WHERE 1=1
  -- Role filter (if present)
  AND ($roleIds IS NULL OR asn."roleId" = ANY($roleIds::uuid[]))
  -- Age cohort filter (if present)
  AND (
    $ageCohorts IS NULL OR
    (
      -- Child: dateOfBirth > (current date - 11 years)
      ('Child' = ANY($ageCohorts) AND p."dateOfBirth" > $childMinDate) OR
      -- Junior Youth: dateOfBirth >= (current date - 15 years) AND < (current date - 11 years)
      ('Junior Youth' = ANY($ageCohorts) AND p."dateOfBirth" >= $jyMinDate AND p."dateOfBirth" < $jyMaxDate) OR
      -- Youth: dateOfBirth >= (current date - 21 years) AND < (current date - 15 years)
      ('Youth' = ANY($ageCohorts) AND p."dateOfBirth" >= $youthMinDate AND p."dateOfBirth" < $youthMaxDate) OR
      -- Young Adult: dateOfBirth >= (current date - 30 years) AND < (current date - 21 years)
      ('Young Adult' = ANY($ageCohorts) AND p."dateOfBirth" >= $yaMinDate AND p."dateOfBirth" < $yaMaxDate) OR
      -- Adult: dateOfBirth < (current date - 30 years)
      ('Adult' = ANY($ageCohorts) AND p."dateOfBirth" < $adultMaxDate) OR
      -- Unknown: dateOfBirth IS NULL
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

**Filter Application Logic:**

10. WHEN roleIds filter is provided, THE API SHALL return only participant home addresses for participants who have at least one assignment with a roleId matching at least one of the specified role IDs
11. WHEN multiple role IDs are provided, THE API SHALL apply OR logic within the role filter dimension
12. WHEN ageCohorts filter is provided, THE API SHALL return only participant home addresses for participants whose calculated age cohort matches at least one of the specified cohorts
13. WHEN calculating age cohort for participant home marker filtering, THE API SHALL determine the reference date using the following logic:
    - Calculate the minimum of: current date and date range filter endDate (if provided)
    - Use this minimum date as the reference point for age cohort calculation
    - This ensures age cohorts reflect participant ages at the most restrictive temporal boundary
14. WHEN a date range filter with endDate is active, THE API SHALL use the minimum of current date and filter endDate as the reference point
15. WHEN no date range filter is active, THE API SHALL use the current date as the reference point
16. WHEN multiple age cohorts are provided, THE API SHALL apply OR logic within the age cohort filter dimension
17. WHEN both roleIds and ageCohorts filters are provided, THE API SHALL apply AND logic across filter dimensions
18. WHEN roleIds or ageCohorts filters are combined with other participant home filters (geographic area, population, date range), THE API SHALL apply all filters using AND logic across dimensions

**Age Cohort Date Range Conversion:**

17. WHEN ageCohorts filter is provided, THE API SHALL convert cohort names to date range conditions on Participant.dateOfBirth
18. THE API SHALL use an enhanced convertCohortToDateRange() function that accepts a reference date parameter
19. THE API SHALL calculate the reference date for age cohort conversion as the minimum of: current date and date range filter endDate (if provided)
20. WHEN a date range filter with endDate is active, THE API SHALL use the minimum of current date and filter endDate as the reference point for age cohort calculations
21. WHEN no date range filter is active, THE API SHALL use the current date as the reference point for age cohort calculations
22. THE API SHALL apply the same age cohort date range conditions as specified in Requirement 3A, but using the calculated reference date instead of always using current date

**Query Optimization:**

20. THE API SHALL optimize queries by only joining Assignment table when roleIds filter is present
21. THE API SHALL use existing database indexes on Assignment.roleId for role filtering
22. THE API SHALL use existing database indexes on Participant.dateOfBirth for age cohort filtering
23. THE API SHALL maintain sub-200ms query latency for role and age cohort filtering on datasets with 10,000,000+ participants

**Grouping and Deduplication:**

24. THE API SHALL maintain the existing grouping by venue logic for participant home markers
25. THE API SHALL count only participants matching all active filters (role, age cohort, population, etc.) when calculating participantCount per venue
26. THE API SHALL use GROUP BY venueId to aggregate participants at each venue

**Response Format:**

27. THE API SHALL return participant home markers in the standard paginated response format with data and pagination metadata
28. THE API SHALL return only the fields needed for markers: venueId, latitude, longitude, participantCount
29. THE API SHALL NOT include assignment or participant details in the marker response (only filter by them)
30. THE API SHALL maintain consistent response format regardless of which filters are applied

**Error Handling:**

31. WHEN roleIds filter contains non-existent role IDs, THE API SHALL return an empty result set (not an error)
32. WHEN ageCohorts filter specifies cohorts with no matching participants, THE API SHALL return an empty result set (not an error)
33. WHEN query execution fails due to database errors, THE API SHALL return 500 Internal Server Error with appropriate error message
34. THE API SHALL log all query errors for debugging purposes

#### Testing Considerations

Property-based tests should verify:
- Role filter correctly includes activities with participants having matching roles
- Age cohort filter correctly includes activities with participants in matching cohorts
- Combined role and age cohort filters apply AND logic correctly
- Filters integrate correctly with existing map filters (population, activity type, date range)
- Conditional joins are only added when filters are present
- Query performance meets latency requirements (<200ms)
- Pagination remains stable with new filters
- Deduplication works correctly (no duplicate activities or venues)
- Validation errors are returned for invalid inputs
- Empty result sets are returned gracefully for non-matching filters


#### Reference Date Calculation Examples

**Example 1: No temporal constraints**
- Current date: 2026-02-19
- Activity endDate: null (ongoing)
- Filter endDate: null (no date range filter)
- **Reference date: 2026-02-19** (current date)
- Age cohort boundaries calculated from 2026-02-19

**Example 2: Activity has finite endDate**
- Current date: 2026-02-19
- Activity endDate: 2025-12-31
- Filter endDate: null (no date range filter)
- **Reference date: 2025-12-31** (minimum of current and activity endDate)
- Age cohort boundaries calculated from 2025-12-31

**Example 3: Date range filter active**
- Current date: 2026-02-19
- Activity endDate: null (ongoing)
- Filter endDate: 2025-06-30
- **Reference date: 2025-06-30** (minimum of current and filter endDate)
- Age cohort boundaries calculated from 2025-06-30

**Example 4: Both activity endDate and filter endDate present**
- Current date: 2026-02-19
- Activity endDate: 2025-12-31
- Filter endDate: 2025-06-30
- **Reference date: 2025-06-30** (minimum of all three dates)
- Age cohort boundaries calculated from 2025-06-30

**Example 5: Activity endDate in future**
- Current date: 2026-02-19
- Activity endDate: 2027-03-15
- Filter endDate: null
- **Reference date: 2026-02-19** (minimum of current and activity endDate)
- Age cohort boundaries calculated from 2026-02-19

**Rationale:**

Using the minimum date ensures that:
1. Age cohorts reflect participant ages at the most restrictive temporal boundary
2. When viewing historical data (past date range), cohorts show ages at that time
3. When viewing activities that ended in the past, cohorts show ages when activity ended
4. Conservative approach prevents showing participants who aged into a cohort after the relevant time period
5. Consistent with the principle of historical accuracy in temporal analytics
