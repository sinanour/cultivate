# Requirements Update: Map View Role and Age Cohort Filtering

## Overview

This document specifies new filtering capabilities for the Map View that enable filtering by participant roles and age cohorts. These filters extend the existing FilterGroupingPanel configuration on the Map View and require backend queries to conditionally join with the Assignment and Participant tables based on the active map mode and filters.

## Related Requirements

This requirement extends:
- **Requirement 6C**: Map View UI with Optimized Loading (web-frontend)
- **Requirement 3B**: Filter Participants by Role and Activity Date Range (backend-api)
- **Requirement 3A**: Calculate and Filter by Age Cohort (backend-api)

## Glossary

- **Assignment_Based_Filter**: A filter that requires joining the Assignment table to access participant-activity relationship data (roles)
- **Participant_Based_Filter**: A filter that requires joining the Participant table to access participant demographic data (age cohort)
- **Role_Filter**: A filter that shows only activities or participant homes where participants have performed specific roles
- **Age_Cohort_Filter**: A filter that shows only activities or participant homes where participants belong to specific age cohorts
- **Conditional_Join**: A database table join that is only included in the query when specific filters are present, optimizing query performance
- **Mode_Specific_Filter**: A filter that only applies to certain map modes and is silently ignored in other modes while remaining visible in the UI

## New Requirement: Map View Role and Age Cohort Filtering

### Requirement 6E: Filter Map Markers by Participant Role and Age Cohort

**User Story:** As a community organizer viewing the map, I want to filter activities and participant homes by the roles participants have performed and by their age cohorts, so that I can visualize engagement patterns for specific participant demographics and roles.

#### Acceptance Criteria

**Filter Property Configuration:**

1. THE Web_App SHALL add "Role" as a filter property in the FilterGroupingPanel on the Map View
2. THE Web_App SHALL add "Age Cohort" as a filter property in the FilterGroupingPanel on the Map View
3. THE "Role" filter property SHALL implement lazy loading of role values when the user types in the filter input
4. WHEN a user types in the Role filter, THE Web_App SHALL asynchronously fetch matching roles from the RoleService
5. THE FilterGroupingPanel SHALL debounce role filter input to avoid excessive API requests (minimum 300ms delay)
6. THE "Age Cohort" filter property SHALL provide predefined options without async loading: "Child", "Junior Youth", "Youth", "Young Adult", "Adult", "Unknown"
7. THE Web_App SHALL keep Role and Age Cohort filter properties available and enabled regardless of the selected map mode
8. THE Web_App SHALL NOT disable or hide Role and Age Cohort filter properties based on map mode selection

**Filter Application Logic by Map Mode:**

9. WHEN the map mode is "Activities by Type" or "Activities by Category", THE Web_App SHALL apply role filter to show only activities where at least one participant has at least one of the specified roles
10. WHEN the map mode is "Activities by Type" or "Activities by Category", THE Web_App SHALL apply age cohort filter to show only activities where at least one participant belongs to at least one of the specified age cohorts
11. WHEN the map mode is "Activities by Type" or "Activities by Category" with age cohort filter active, THE Backend API SHALL calculate participant age cohorts using a reference date determined as the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)
12. WHEN the map mode is "Participant Homes", THE Web_App SHALL apply role filter to show only participant home addresses for participants who have performed at least one of the specified roles in any activity
13. WHEN the map mode is "Participant Homes", THE Web_App SHALL apply age cohort filter to show only participant home addresses for participants who belong to at least one of the specified age cohorts
14. WHEN the map mode is "Participant Homes" with age cohort filter active, THE Backend API SHALL calculate participant age cohorts using a reference date determined as the minimum of: current date and date range filter endDate (if provided)
15. WHEN the map mode is "Venues", THE Web_App SHALL silently ignore role and age cohort filters for marker fetching
16. WHEN the map mode is "Venues" with role or age cohort filters active, THE Web_App SHALL keep the filters visible and selected in the FilterGroupingPanel
17. WHEN switching from "Venues" mode to an activity or participant homes mode, THE Web_App SHALL automatically apply any active role or age cohort filters to the new mode

**Frontend Filter Token Display:**

16. THE Web_App SHALL display role filter tokens in the PropertyFilter with human-readable role names (e.g., "Tutor", "Teacher") instead of UUIDs
17. WHEN a role filter token is displayed, THE Web_App SHALL show the role names as a comma-separated list (e.g., "Role = Tutor, Teacher")
18. THE Web_App SHALL display age cohort filter tokens in the PropertyFilter with human-readable cohort names
19. WHEN an age cohort filter token is displayed, THE Web_App SHALL show the cohort names as a comma-separated list (e.g., "Age Cohort = Youth, Young Adult")
20. THE Web_App SHALL persist role and age cohort filter selections to URL query parameters
21. WHEN a user navigates to a Map View URL with role or age cohort filter parameters, THE Web_App SHALL restore and apply those filters

**Frontend API Request Generation:**

22. WHEN role filter is active and map mode is "Activities by Type" or "Activities by Category", THE Web_App SHALL send ?filter[roleIds]=uuid1,uuid2 parameter to GET /api/v1/map/activities endpoint
23. WHEN age cohort filter is active and map mode is "Activities by Type" or "Activities by Category", THE Web_App SHALL send ?filter[ageCohorts]=cohort1,cohort2 parameter to GET /api/v1/map/activities endpoint
24. WHEN role filter is active and map mode is "Participant Homes", THE Web_App SHALL send ?filter[roleIds]=uuid1,uuid2 parameter to GET /api/v1/map/participant-homes endpoint
25. WHEN age cohort filter is active and map mode is "Participant Homes", THE Web_App SHALL send ?filter[ageCohorts]=cohort1,cohort2 parameter to GET /api/v1/map/participant-homes endpoint
26. WHEN role or age cohort filters are active and map mode is "Venues", THE Web_App SHALL NOT send role or age cohort parameters to GET /api/v1/map/venues endpoint
27. WHEN multiple roles are selected, THE Web_App SHALL join role IDs with commas in the query parameter
28. WHEN multiple age cohorts are selected, THE Web_App SHALL join cohort names with commas in the query parameter

**Backend API Requirements for Activity Markers:**

29. THE Backend API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/map/activities endpoint
30. THE Backend API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/map/activities endpoint
31. WHEN roleIds filter is provided to /api/v1/map/activities, THE Backend API SHALL conditionally join the Assignment table to access role information
32. WHEN ageCohorts filter is provided to /api/v1/map/activities, THE Backend API SHALL conditionally join the Assignment and Participant tables to access participant demographic information
33. WHEN both roleIds and ageCohorts filters are provided to /api/v1/map/activities, THE Backend API SHALL join Assignment and Participant tables once and apply both filters using AND logic
34. WHEN roleIds filter is provided, THE Backend API SHALL return only activities where at least one participant has at least one assignment with a roleId matching at least one of the specified role IDs
35. WHEN ageCohorts filter is provided, THE Backend API SHALL return only activities where at least one participant's calculated age cohort matches at least one of the specified cohorts
36. WHEN calculating age cohort for activity marker filtering, THE Backend API SHALL use the current date as the reference point (not the activity's endDate)
37. WHEN multiple role IDs are provided, THE Backend API SHALL apply OR logic within the role filter dimension
38. WHEN multiple age cohorts are provided, THE Backend API SHALL apply OR logic within the age cohort filter dimension
39. WHEN roleIds and ageCohorts filters are combined, THE Backend API SHALL apply AND logic across filter dimensions
40. WHEN roleIds or ageCohorts filters are combined with other activity filters (activityTypeIds, activityCategoryIds, status, date range, geographic area, population), THE Backend API SHALL apply all filters using AND logic across dimensions
41. THE Backend API SHALL use GROUP BY or DISTINCT to avoid returning duplicate activity records when multiple participants match the filter criteria
42. THE Backend API SHALL optimize queries by only joining Assignment table when roleIds filter is present
43. THE Backend API SHALL optimize queries by only joining Participant table when ageCohorts filter is present
44. WHEN neither roleIds nor ageCohorts filters are present, THE Backend API SHALL NOT join Assignment or Participant tables

**Backend API Requirements for Participant Home Markers:**

45. THE Backend API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/map/participant-homes endpoint
46. THE Backend API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/map/participant-homes endpoint
47. WHEN roleIds filter is provided to /api/v1/map/participant-homes, THE Backend API SHALL conditionally join the Assignment table to filter participants by roles they've performed
48. WHEN ageCohorts filter is provided to /api/v1/map/participant-homes, THE Backend API SHALL filter participants by their calculated age cohort using date range conditions on dateOfBirth
49. WHEN roleIds filter is provided, THE Backend API SHALL return only participant home addresses for participants who have at least one assignment with a roleId matching at least one of the specified role IDs
50. WHEN ageCohorts filter is provided, THE Backend API SHALL return only participant home addresses for participants whose calculated age cohort matches at least one of the specified cohorts
51. WHEN calculating age cohort for participant home marker filtering, THE Backend API SHALL use the current date as the reference point
52. WHEN multiple role IDs are provided, THE Backend API SHALL apply OR logic within the role filter dimension
53. WHEN multiple age cohorts are provided, THE Backend API SHALL apply OR logic within the age cohort filter dimension
54. WHEN roleIds and ageCohorts filters are combined, THE Backend API SHALL apply AND logic across filter dimensions
55. WHEN roleIds or ageCohorts filters are combined with other participant home filters (geographic area, population, date range), THE Backend API SHALL apply all filters using AND logic across dimensions
56. THE Backend API SHALL optimize queries by only joining Assignment table when roleIds filter is present
57. WHEN ageCohorts filter is present, THE Backend API SHALL convert cohort names to date range conditions before querying (same logic as participant list filtering)

**Backend API Requirements for Venue Markers:**

58. THE Backend API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/map/venues endpoint
59. THE Backend API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/map/venues endpoint
60. WHEN roleIds or ageCohorts filters are provided to /api/v1/map/venues, THE Backend API SHALL silently ignore these filters
61. THE Backend API SHALL return all venues matching other active filters (geographic area, bounding box) regardless of role or age cohort filter values
62. THE Backend API SHALL NOT join Assignment or Participant tables when processing /api/v1/map/venues requests, even if roleIds or ageCohorts parameters are present

**Query Optimization and Performance:**

63. THE Backend API SHALL create database indexes on Assignment.roleId if not already present
64. THE Backend API SHALL use existing indexes on Participant.dateOfBirth for age cohort filtering
65. THE Backend API SHALL use efficient JOIN strategies (EXISTS subqueries or INNER JOIN with GROUP BY/DISTINCT) to minimize query execution time
66. THE Backend API SHALL maintain sub-200ms query latency for role and age cohort filtering on map marker queries with datasets of 100,000+ activities
67. THE Backend API SHALL avoid N+1 query problems by using appropriate conditional join strategies
68. THE Backend API SHALL use the same query variant selection logic as the optimized activity markers implementation (from map-data-optimization spec)

**Pagination and Total Count:**

69. WHEN role or age cohort filters are applied, THE Backend API SHALL include the filters in the total count calculation for pagination metadata
70. THE Backend API SHALL return accurate total counts reflecting the filtered result set
71. THE Backend API SHALL support pagination with role and age cohort filters (page and limit parameters work correctly)
72. THE Backend API SHALL maintain stable ordering (ORDER BY activity.id or participant.id) to ensure consistent pagination

**Integration with Existing Filters:**

73. THE role and age cohort filters SHALL integrate seamlessly with existing map filters (activity category, activity type, status, population, date range, geographic area, bounding box)
74. THE Backend API SHALL apply all filters using AND logic across dimensions
75. THE Backend API SHALL apply OR logic within each filter dimension (e.g., multiple roles, multiple age cohorts)
76. WHEN role or age cohort filters are combined with population filters, THE Backend API SHALL apply both filters (participants must match role/cohort AND belong to specified populations)

**Error Handling:**

77. WHEN invalid role IDs are provided in the roleIds filter, THE Backend API SHALL return 400 Bad Request with a validation error
78. WHEN invalid age cohort names are provided in the ageCohorts filter, THE Backend API SHALL return 400 Bad Request with a validation error
79. WHEN roleIds filter contains non-existent role IDs, THE Backend API SHALL return an empty result set (not an error)
80. WHEN query execution fails due to database errors, THE Backend API SHALL return 500 Internal Server Error with appropriate error message
81. THE Backend API SHALL log all query errors for debugging purposes
82. THE Web_App SHALL display validation errors to users when invalid filter values are entered
83. THE Web_App SHALL provide clear error messages explaining what went wrong and how to fix it

**Response Format:**

84. THE Backend API SHALL return activity markers in the standard paginated response format with data and pagination metadata
85. THE Backend API SHALL return participant home markers in the standard paginated response format with data and pagination metadata
86. THE Backend API SHALL maintain consistent response format regardless of which filters are applied
87. THE Backend API SHALL NOT include assignment or participant details in the marker response (only filter by them)

#### Implementation Notes

**Backend Query Pattern for Activity Markers:**

The backend should extend the existing query variant selection logic to handle role and age cohort filters:

```typescript
// Determine which tables to join based on active filters
const hasPopulationFilter = filters.populationIds && filters.populationIds.length > 0;
const hasRoleFilter = filters.roleIds && filters.roleIds.length > 0;
const hasAgeCohortFilter = filters.ageCohorts && filters.ageCohorts.length > 0;

// Select query variant
if (hasPopulationFilter || hasRoleFilter || hasAgeCohortFilter) {
  // Need to join Assignment and Participant tables
  query = buildActivityMarkersWithParticipantJoins();
} else {
  // Base query without participant-related joins
  query = buildActivityMarkersBaseQuery();
}
```

**SQL Query Structure with Role and Age Cohort Filters:**

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
-- Conditional joins for role and age cohort filtering
INNER JOIN "Assignment" asn ON asn."activityId" = a.id
INNER JOIN "Participant" p ON p.id = asn."participantId"
-- Conditional join for population filter (if present)
LEFT JOIN "ParticipantPopulation" pp ON pp."participantId" = p.id
WHERE 1=1
  -- Role filter (if present)
  AND ($roleIds IS NULL OR asn."roleId" = ANY($roleIds::uuid[]))
  -- Age cohort filter (if present, converted to date range conditions)
  AND ($ageCohortDateRanges IS NULL OR p."dateOfBirth" BETWEEN ... OR p."dateOfBirth" IS NULL)
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

**Backend Query Pattern for Participant Home Markers:**

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
  const cohortConditions = filter.ageCohorts.map(cohort => 
    convertCohortToDateRange(cohort)
  );
  where.OR = cohortConditions.map(range => ({
    dateOfBirth: {
      ...(range.min && { gte: range.min }),
      ...(range.max && { lt: range.max })
    }
  }));
  
  // Handle "Unknown" cohort
  if (filter.ageCohorts.includes('Unknown')) {
    where.OR.push({ dateOfBirth: null });
  }
}

// Execute query with appropriate joins
const participants = await prisma.participant.findMany({
  where,
  // ... pagination, select, include ...
});
```

**Frontend Filter Conversion:**

```typescript
// In MapView component
function convertFiltersToAPIParams(filterTokens: FilterToken[], mapMode: string): URLSearchParams {
  const params = new URLSearchParams();
  
  for (const token of filterTokens) {
    switch (token.propertyKey) {
      case 'role':
        // Only apply to activity and participant home modes
        if (mapMode !== 'Venues') {
          const roleIds = token.value as string[];
          params.append('filter[roleIds]', roleIds.join(','));
        }
        break;
        
      case 'ageCohort':
        // Only apply to activity and participant home modes
        if (mapMode !== 'Venues') {
          const cohorts = token.value as string[];
          params.append('filter[ageCohorts]', cohorts.join(','));
        }
        break;
        
      // ... handle other filter properties ...
    }
  }
  
  return params;
}
```

**URL Parameter Format:**

```
# Role filter
?filter_roleIds=uuid1,uuid2

# Age cohort filter
?filter_ageCohorts=Youth,Young+Adult

# Combined with other filters
?filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_populationIds=uuid3&mapMode=Activities+by+Type
```

#### Testing Considerations

Property-based tests should verify:
- Role filter correctly includes activities/homes with matching role assignments
- Age cohort filter correctly includes activities/homes with matching age cohorts
- Filters are silently ignored in "Venues" mode
- Filters remain visible and selected when switching between modes
- Combined role and age cohort filters apply AND logic correctly
- Filters integrate correctly with existing map filters
- Backend conditionally joins tables based on filter presence
- Query performance meets latency requirements (<200ms)
- Pagination remains stable with new filters
- Validation errors are returned for invalid inputs
- URL synchronization works correctly

#### Performance Considerations

**Backend Optimization:**
- Only join Assignment table when roleIds filter is present
- Only join Participant table when ageCohorts filter is present
- Use GROUP BY or DISTINCT to deduplicate activities with multiple matching participants
- Leverage existing indexes on Assignment.roleId and Participant.dateOfBirth
- Maintain query variant selection logic to minimize unnecessary joins

**Expected Query Variants:**

| Filters Active | Tables Joined |
|----------------|---------------|
| None | Activity, ActivityType, ActivityVenueHistory, Venue |
| Population only | + Assignment, Participant, ParticipantPopulation |
| Role only | + Assignment |
| Age Cohort only | + Assignment, Participant |
| Role + Age Cohort | + Assignment, Participant |
| Population + Role | + Assignment, Participant, ParticipantPopulation |
| Population + Age Cohort | + Assignment, Participant, ParticipantPopulation |
| All three | + Assignment, Participant, ParticipantPopulation |

**Performance Targets:**
- Activity marker queries with role/age cohort filters: < 200ms for 100,000+ activities
- Participant home marker queries with role/age cohort filters: < 200ms for 10,000,000+ participants
- Query time should scale linearly with result set size, not total data size
- Conditional joins should reduce query time by 20-40% when filters are not present


#### Age Cohort Reference Date Calculation

**Frontend Awareness:**

The frontend does not need to calculate or pass reference dates to the backend. The backend automatically determines the appropriate reference date based on:
- Current date (always available)
- Activity endDate (from activity data)
- Date range filter endDate (from filter parameters)

**User Experience:**

When users apply an age cohort filter on the map:
- **Without date range filter**: Shows activities/homes where participants are currently in the specified age cohorts
- **With date range filter**: Shows activities/homes where participants were in the specified age cohorts at the end of the date range
- **For completed activities**: Shows activities where participants were in the specified age cohorts when the activity ended (or at filter endDate, whichever is earlier)

**Example Scenarios:**

1. **Current Youth filter, no date range**: Shows activities with participants who are currently 15-20 years old
2. **Youth filter + date range ending 2025-06-30**: Shows activities with participants who were 15-20 years old on 2025-06-30
3. **Youth filter + activity ended 2024-12-31, no date range**: Shows activities with participants who were 15-20 years old on 2024-12-31
4. **Youth filter + activity ended 2025-12-31 + date range ending 2025-06-30**: Shows activities with participants who were 15-20 years old on 2025-06-30 (the earlier date)

This ensures that age cohort filtering is temporally accurate and aligns with the user's intent when viewing historical data or specific time periods.
