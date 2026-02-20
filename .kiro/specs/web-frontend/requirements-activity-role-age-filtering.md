# Requirements Update: Activity List Role and Age Cohort Filtering

## Overview

This document specifies new filtering capabilities for the Activity List page that enable filtering by participant roles and age cohorts. These filters extend the existing FilterGroupingPanel configuration and require backend queries to join with the Assignment and Participant tables.

## Related Requirements

This requirement extends:
- **Requirement 5B**: Unified List Filtering with FilterGroupingPanel (web-frontend)
- **Requirement 5A**: Activity List Filtering UX with PropertyFilter (web-frontend)
- **Requirement 4D**: Filter Activities by Participant Role and Age Cohort (backend-api)

## Glossary

- **Assignment_Based_Filter**: A filter that requires joining the Assignment table to access participant-activity relationship data (roles)
- **Participant_Based_Filter**: A filter that requires joining the Participant table to access participant demographic data (age cohort)
- **Role_Filter**: A filter that shows only activities where participants have performed specific roles
- **Age_Cohort_Filter**: A filter that shows only activities where participants belong to specific age cohorts
- **Reference_Date**: The date used as the reference point for calculating participant age cohorts, automatically calculated by the backend as the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)

## New Requirement: Activity List Role and Age Cohort Filtering

### Requirement 5E: Filter Activities by Participant Role and Age Cohort

**User Story:** As a community organizer viewing the activity list, I want to filter activities by the roles participants have performed and by their age cohorts, so that I can find activities involving specific participant demographics and roles.

#### Acceptance Criteria

**Filter Property Configuration:**

1. THE Web_App SHALL add "Role" as a filter property in the FilterGroupingPanel on the ActivityList page
2. THE Web_App SHALL add "Age Cohort" as a filter property in the FilterGroupingPanel on the ActivityList page
3. THE "Role" filter property SHALL implement lazy loading of role values when the user types in the filter input
4. WHEN a user types in the Role filter, THE Web_App SHALL asynchronously fetch matching roles from the RoleService
5. THE FilterGroupingPanel SHALL debounce role filter input to avoid excessive API requests (minimum 300ms delay)
6. THE "Age Cohort" filter property SHALL provide predefined options without async loading: "Child", "Junior Youth", "Youth", "Young Adult", "Adult", "Unknown"
7. THE Web_App SHALL keep Role and Age Cohort filter properties available and enabled at all times
8. THE Web_App SHALL NOT disable or hide Role and Age Cohort filter properties based on any condition

**Filter Application Logic:**

9. WHEN one or more roles are selected in the filter, THE Web_App SHALL send the selected role IDs to the backend API using ?filter[roleIds]=uuid1,uuid2 parameter
10. WHEN multiple roles are selected, THE Web_App SHALL apply OR logic within the role filter dimension (activities with participants who performed at least one of the specified roles)
11. WHEN one or more age cohorts are selected in the filter, THE Web_App SHALL send the selected cohorts to the backend API using ?filter[ageCohorts]=cohort1,cohort2 parameter
12. WHEN multiple age cohorts are selected, THE Web_App SHALL apply OR logic within the age cohort filter dimension (activities with participants in at least one of the specified cohorts)
13. WHEN both role and age cohort filters are applied, THE Web_App SHALL send both parameters to the backend
14. WHEN role or age cohort filters are combined with other filters (activity category, activity type, status, population, date range), THE Web_App SHALL apply all filters using AND logic across dimensions
15. THE Web_App SHALL include only activities where at least one participant matches the role and/or age cohort criteria

**Frontend Filter Token Display:**

16. THE Web_App SHALL display role filter tokens in the PropertyFilter with human-readable role names (e.g., "Tutor", "Teacher") instead of UUIDs
17. WHEN a role filter token is displayed, THE Web_App SHALL show the role names as a comma-separated list (e.g., "Role = Tutor, Teacher")
18. THE Web_App SHALL display age cohort filter tokens in the PropertyFilter with human-readable cohort names
19. WHEN an age cohort filter token is displayed, THE Web_App SHALL show the cohort names as a comma-separated list (e.g., "Age Cohort = Youth, Young Adult")
20. THE Web_App SHALL persist role and age cohort filter selections to URL query parameters
21. WHEN a user navigates to an ActivityList URL with role or age cohort filter parameters, THE Web_App SHALL restore and apply those filters

**Frontend API Request Generation:**

22. WHEN role filter is active, THE Web_App SHALL send ?filter[roleIds]=uuid1,uuid2 parameter to GET /api/v1/activities endpoint
23. WHEN age cohort filter is active, THE Web_App SHALL send ?filter[ageCohorts]=cohort1,cohort2 parameter to GET /api/v1/activities endpoint
24. WHEN multiple roles are selected, THE Web_App SHALL join role IDs with commas in the query parameter
25. WHEN multiple age cohorts are selected, THE Web_App SHALL join cohort names with commas in the query parameter
26. THE Web_App SHALL combine role and age cohort filters with other activity filters in the same API request

**Backend API Requirements:**

27. THE Backend API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/activities endpoint
28. THE Backend API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/activities endpoint
29. WHEN roleIds filter is provided to /api/v1/activities, THE Backend API SHALL conditionally join the Assignment table to access role information
30. WHEN ageCohorts filter is provided to /api/v1/activities, THE Backend API SHALL conditionally join the Assignment and Participant tables to access participant demographic information
31. WHEN both roleIds and ageCohorts filters are provided to /api/v1/activities, THE Backend API SHALL join Assignment and Participant tables once and apply both filters using AND logic
32. WHEN roleIds filter is provided, THE Backend API SHALL return only activities where at least one participant has at least one assignment with a roleId matching at least one of the specified role IDs
33. WHEN ageCohorts filter is provided, THE Backend API SHALL return only activities where at least one participant's calculated age cohort matches at least one of the specified cohorts
34. WHEN calculating age cohort for activity list filtering, THE Backend API SHALL determine the reference date as the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)
35. WHEN multiple role IDs are provided, THE Backend API SHALL apply OR logic within the role filter dimension
36. WHEN multiple age cohorts are provided, THE Backend API SHALL apply OR logic within the age cohort filter dimension
37. WHEN roleIds and ageCohorts filters are combined, THE Backend API SHALL apply AND logic across filter dimensions
38. WHEN roleIds or ageCohorts filters are combined with other activity filters, THE Backend API SHALL apply all filters using AND logic across dimensions
39. THE Backend API SHALL use GROUP BY or DISTINCT to avoid returning duplicate activity records when multiple participants match the filter criteria
40. THE Backend API SHALL optimize queries by only joining Assignment table when roleIds filter is present
41. THE Backend API SHALL optimize queries by only joining Participant table when ageCohorts filter is present

**Performance Considerations:**

42. THE Backend API SHALL use efficient JOIN strategies to minimize query execution time when Assignment and Participant tables are included
43. THE Backend API SHALL use EXISTS subqueries or INNER JOINs with DISTINCT to avoid duplicate activity results when multiple participants match the filter criteria
44. THE Backend API SHALL maintain sub-200ms query latency for role and age cohort filtering on datasets with up to 100,000 activities and 500,000 assignments

**Error Handling:**

45. WHEN invalid role IDs are provided in the roleIds filter, THE Backend API SHALL return 400 Bad Request with a validation error
46. WHEN invalid age cohort names are provided in the ageCohorts filter, THE Backend API SHALL return 400 Bad Request with a validation error
47. THE Web_App SHALL display validation errors to users when invalid filter values are entered
48. THE Web_App SHALL provide clear error messages explaining what went wrong and how to fix it

**Combined Filtering Logic:**

49. WHEN role filter, age cohort filter, and other filters (population, activity type, date range) are all applied, THE Web_App SHALL apply AND logic across all filter dimensions
50. THE Web_App SHALL allow users to clear role and age cohort filters independently of other filters
51. THE Web_App SHALL allow users to clear all filters including role and age cohort using the "Clear All" button
52. WHEN role or age cohort filters are applied or changed, THE Web_App SHALL reset pagination to page 1

#### Implementation Notes

**Frontend Filter Token Display:**

```typescript
// Role filter token
{
  propertyKey: "role",
  operator: "=",
  value: ["uuid1", "uuid2"],
  displayValue: "Tutor, Teacher" // Human-readable names
}

// Age cohort filter token
{
  propertyKey: "ageCohort",
  operator: "=",
  value: ["Youth", "Young Adult"],
  displayValue: "Youth, Young Adult"
}
```

**URL Parameter Format:**

```
# Role filter
?filter_roleIds=uuid1,uuid2

# Age cohort filter
?filter_ageCohorts=Youth,Young+Adult

# Combined with other filters
?filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_activityTypeIds=uuid3&filter_populationIds=uuid4
```

**Reference Date Calculation (Backend Handles This):**

The frontend does not need to calculate or pass reference dates to the backend. The backend automatically determines the appropriate reference date based on:
- Current date (always available)
- Activity endDate (from activity data)
- Date range filter endDate (from filter parameters)

**User Experience:**

When users apply an age cohort filter on the activity list:
- **Without date range filter**: Shows activities where participants are currently in the specified age cohorts
- **With date range filter**: Shows activities where participants were in the specified age cohorts at the end of the date range (or activity endDate, whichever is earlier)
- **For completed activities**: Shows activities where participants were in the specified age cohorts when the activity ended (or at filter endDate, whichever is earlier)

#### Testing Considerations

Property-based tests should verify:
- Role filter correctly includes activities with participants having matching roles
- Age cohort filter correctly includes activities with participants in matching cohorts
- Reference date calculation produces temporally accurate results
- Combined role and age cohort filters apply AND logic correctly
- Filter tokens display human-readable names instead of UUIDs
- URL synchronization works correctly
- Pagination resets to page 1 when filters are applied
- Backend query performance meets latency requirements
- Validation errors are displayed for invalid inputs
