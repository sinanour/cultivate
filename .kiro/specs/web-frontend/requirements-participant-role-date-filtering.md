# Requirements Update: Participant List Role and Activity Date Filtering

## Overview

This document specifies new filtering capabilities for the Participant List page that enable filtering by participant roles and activity date ranges. These filters require backend queries to join with the Assignment table to access role and activity date information.

## Related Requirements

This requirement extends:
- **Requirement 5B**: Unified List Filtering with FilterGroupingPanel (web-frontend)
- **Requirement 28**: Unified Flexible Filtering and Attribute Selection Architecture (backend-api)

## Glossary

- **Assignment_Based_Filter**: A filter that requires joining the Assignment table to access participant-activity relationship data (roles, activity dates)
- **Role_Filter**: A filter that shows only participants who have performed specific roles in activities
- **Activity_Date_Range_Filter**: A filter that shows only participants who participated in activities within a specified date range
- **Absolute_Date_Range**: A date range specified with explicit start and end dates (e.g., 2025-01-01 to 2025-12-31)
- **Relative_Date_Range**: A date range specified relative to the current date (e.g., "Last 90 days", "Last 6 months", "Last 1 year")

## New Requirement: Participant List Role and Activity Date Filtering

### Requirement 4C: Filter Participants by Role and Activity Date Range

**User Story:** As a community organizer, I want to filter the participant list by the roles they've performed and by when they participated in activities, so that I can find participants who served in specific capacities or were active during specific time periods.

#### Acceptance Criteria

**Role Filtering:**

1. THE Web_App SHALL add "Role" as a filter property in the FilterGroupingPanel on the ParticipantList page
2. THE "Role" filter property SHALL implement lazy loading of role values when the user types in the filter input
3. WHEN a user types in the Role filter, THE Web_App SHALL asynchronously fetch matching roles from the RoleService
4. THE FilterGroupingPanel SHALL debounce role filter input to avoid excessive API requests (minimum 300ms delay)
5. THE FilterGroupingPanel SHALL display a loading indicator while fetching role values
6. WHEN one or more roles are selected in the filter, THE Web_App SHALL send the selected role IDs to the backend API using ?filter[roleIds]=uuid1,uuid2 parameter
7. WHEN multiple roles are selected, THE Web_App SHALL apply OR logic within the role filter dimension (participants who performed at least one of the specified roles)
8. WHEN role filter is combined with other filters, THE Web_App SHALL apply AND logic across filter dimensions
9. THE Web_App SHALL display role filter tokens in the PropertyFilter with human-readable role names (e.g., "Tutor", "Teacher") instead of UUIDs
10. WHEN a role filter token is displayed, THE Web_App SHALL show the role names as a comma-separated list (e.g., "Role = Tutor, Teacher")
11. THE Web_App SHALL persist role filter selections to URL query parameters
12. WHEN a user navigates to a ParticipantList URL with role filter parameters, THE Web_App SHALL restore and apply the role filter
13. WHEN a role filter is applied, THE Web_App SHALL include only participants who have at least one assignment with at least one of the specified roles

**Activity Date Range Filtering:**

14. THE Web_App SHALL add "Activity Date Range" as a filter property in the FilterGroupingPanel on the ParticipantList page
15. THE "Activity Date Range" filter property SHALL support both absolute and relative date range selection
16. THE Web_App SHALL use CloudScape DateRangePicker component for absolute date range selection
17. THE Web_App SHALL provide relative date range options: "Last 30 days", "Last 90 days", "Last 6 months", "Last 1 year"
18. WHEN an absolute date range is selected, THE Web_App SHALL send startDate and endDate as ISO-8601 date strings (YYYY-MM-DD) to the backend using ?filter[activityStartDate]=YYYY-MM-DD&filter[activityEndDate]=YYYY-MM-DD parameters
19. WHEN a relative date range is selected, THE Web_App SHALL calculate the absolute start and end dates based on the current date
20. WHEN "Last 30 days" is selected, THE Web_App SHALL calculate startDate as 30 days before today and endDate as today
21. WHEN "Last 90 days" is selected, THE Web_App SHALL calculate startDate as 90 days before today and endDate as today
22. WHEN "Last 6 months" is selected, THE Web_App SHALL calculate startDate as 6 months before today and endDate as today
23. WHEN "Last 1 year" is selected, THE Web_App SHALL calculate startDate as 1 year before today and endDate as today
24. THE Web_App SHALL display the activity date range filter token in the PropertyFilter with human-readable date formatting
25. WHEN an absolute date range is active, THE Web_App SHALL display a token like "Activity Date Range = 2025-01-01 to 2025-12-31"
26. WHEN a relative date range is active, THE Web_App SHALL display a token like "Activity Date Range = Last 90 days"
27. THE Web_App SHALL persist activity date range filter selections to URL query parameters
28. WHEN an absolute date range is selected, THE Web_App SHALL persist startDate and endDate as ISO-8601 strings to URL query parameters
29. WHEN a relative date range is selected, THE Web_App SHALL persist the relative period in compact format (e.g., "-30d", "-90d", "-6m", "-1y") to the relativePeriod URL query parameter
30. WHEN a user navigates to a ParticipantList URL with activity date range filter parameters, THE Web_App SHALL restore and apply the filter
31. WHEN an activity date range filter is applied, THE Web_App SHALL include only participants who have at least one assignment to an activity that overlaps with the specified date range
32. WHEN an activity date range filter is combined with other filters, THE Web_App SHALL apply AND logic across filter dimensions

**Combined Filtering Logic:**

33. WHEN both role filter and activity date range filter are applied, THE Web_App SHALL include only participants who have at least one assignment matching BOTH criteria (role AND date range)
34. WHEN role filter, activity date range filter, and other filters (population, age cohort, etc.) are all applied, THE Web_App SHALL apply AND logic across all filter dimensions
35. THE Web_App SHALL allow users to clear role and activity date range filters independently of other filters
36. THE Web_App SHALL allow users to clear all filters including role and activity date range using the "Clear All" button
37. WHEN role or activity date range filters are applied or changed, THE Web_App SHALL reset pagination to page 1

**Backend API Requirements:**

38. THE Backend API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/participants endpoint
39. WHEN roleIds filter is provided, THE Backend API SHALL join the Assignment table to filter participants
40. WHEN roleIds filter is provided, THE Backend API SHALL return only participants who have at least one assignment with a roleId matching at least one of the specified role IDs (OR logic within dimension)
41. THE Backend API SHALL accept ?filter[activityStartDate]=YYYY-MM-DD parameter on GET /api/v1/participants endpoint
42. THE Backend API SHALL accept ?filter[activityEndDate]=YYYY-MM-DD parameter on GET /api/v1/participants endpoint
43. WHEN activity date range filter is provided, THE Backend API SHALL join the Assignment and Activity tables to filter participants
44. WHEN activity date range filter is provided, THE Backend API SHALL return only participants who have at least one assignment to an activity that overlaps with the specified date range
45. THE Backend API SHALL use overlap logic for activity date range filtering: (activity.startDate <= filterEndDate) AND (activity.endDate >= filterStartDate OR activity.endDate IS NULL)
46. WHEN only activityStartDate is provided, THE Backend API SHALL return participants with activities starting on or after that date
47. WHEN only activityEndDate is provided, THE Backend API SHALL return participants with activities ending on or before that date (or ongoing activities)
48. WHEN both activityStartDate and activityEndDate are provided, THE Backend API SHALL return participants with activities overlapping the date range
49. WHEN both roleIds and activity date range filters are provided, THE Backend API SHALL apply both filters using AND logic (participants must have assignments matching BOTH criteria)
50. WHEN roleIds or activity date range filters are combined with other participant filters (name, email, population, age cohort), THE Backend API SHALL apply all filters using AND logic across dimensions
51. THE Backend API SHALL optimize queries with appropriate indexes on Assignment.roleId, Activity.startDate, and Activity.endDate
52. THE Backend API SHALL handle null activity endDate values correctly (treat as ongoing activities that match any date range extending to present)

**Performance Considerations:**

53. THE Backend API SHALL use efficient JOIN strategies to minimize query execution time when Assignment table is included
54. THE Backend API SHALL use EXISTS subqueries or INNER JOINs with DISTINCT to avoid duplicate participant results when multiple assignments match the filter criteria
55. THE Backend API SHALL maintain sub-100ms query latency for role and activity date range filtering on datasets with up to 10,000 participants and 100,000 assignments

**Error Handling:**

56. WHEN invalid role IDs are provided in the roleIds filter, THE Backend API SHALL return 400 Bad Request with a validation error
57. WHEN invalid date formats are provided in activity date range filters, THE Backend API SHALL return 400 Bad Request with a validation error
58. THE Web_App SHALL display validation errors to users when invalid filter values are entered
59. THE Web_App SHALL provide clear error messages explaining what went wrong and how to fix it

#### Implementation Notes

**Backend Query Pattern:**

When roleIds or activity date range filters are provided, the backend must join with the Assignment table:

```typescript
// Prisma query example
const where: any = {
  // ... other filters ...
};

// Add role filter
if (filter.roleIds && filter.roleIds.length > 0) {
  where.assignments = {
    some: {
      roleId: { in: filter.roleIds }
    }
  };
}

// Add activity date range filter
if (filter.activityStartDate || filter.activityEndDate) {
  const activityDateCondition: any = {};
  
  if (filter.activityStartDate && filter.activityEndDate) {
    // Overlap logic: activity overlaps with filter range
    activityDateCondition.AND = [
      { startDate: { lte: filter.activityEndDate } },
      {
        OR: [
          { endDate: { gte: filter.activityStartDate } },
          { endDate: null } // Ongoing activities
        ]
      }
    ];
  } else if (filter.activityStartDate) {
    // Activities starting on or after date
    activityDateCondition.startDate = { gte: filter.activityStartDate };
  } else if (filter.activityEndDate) {
    // Activities ending on or before date (or ongoing)
    activityDateCondition.OR = [
      { endDate: { lte: filter.activityEndDate } },
      { endDate: null }
    ];
  }
  
  where.assignments = {
    some: {
      ...(where.assignments?.some || {}),
      activity: activityDateCondition
    }
  };
}

const participants = await prisma.participant.findMany({
  where,
  // ... pagination, select, include ...
});
```

**Frontend Filter Token Display:**

```typescript
// Role filter token
{
  propertyKey: "role",
  operator: "=",
  value: ["uuid1", "uuid2"],
  displayValue: "Tutor, Teacher" // Human-readable names
}

// Activity date range filter token (absolute)
{
  propertyKey: "activityDateRange",
  operator: "=",
  value: { start: "2025-01-01", end: "2025-12-31" },
  displayValue: "2025-01-01 to 2025-12-31"
}

// Activity date range filter token (relative)
{
  propertyKey: "activityDateRange",
  operator: "=",
  value: { relative: "-90d" },
  displayValue: "Last 90 days"
}
```

**URL Parameter Format:**

```
# Role filter
?filter_roleIds=uuid1,uuid2

# Absolute activity date range
?filter_activityStartDate=2025-01-01&filter_activityEndDate=2025-12-31

# Relative activity date range
?filter_activityDateRange=-90d
```

#### Testing Considerations

Property-based tests should verify:
- Role filter correctly includes participants with matching role assignments
- Activity date range filter correctly includes participants with activities in range
- Overlap logic works correctly for ongoing activities (null endDate)
- Combined role and date range filters apply AND logic correctly
- Filter tokens display human-readable role names instead of UUIDs
- URL synchronization works for both absolute and relative date ranges
- Pagination resets to page 1 when filters are applied
- Backend query performance meets latency requirements
- Validation errors are displayed for invalid inputs
