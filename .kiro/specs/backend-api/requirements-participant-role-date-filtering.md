# Requirements Update: Participant Filtering by Role and Activity Date Range

## Overview

This document specifies new filtering capabilities for the GET /api/v1/participants endpoint that enable filtering by participant roles and activity date ranges. These filters require joining with the Assignment and Activity tables to access role and temporal participation data.

## Related Requirements

This requirement extends:
- **Requirement 28**: Unified Flexible Filtering and Attribute Selection Architecture
- **Requirement 3**: Track Participants

## Glossary

- **Assignment_Based_Filter**: A filter that requires joining the Assignment table to access participant-activity relationship data (roles, activity dates)
- **Role_Filter**: A filter that returns only participants who have performed specific roles in activities
- **Activity_Date_Range_Filter**: A filter that returns only participants who participated in activities within a specified date range
- **Overlap_Logic**: A temporal filtering technique that includes activities whose date range overlaps with the query date range, handling both finite activities (with endDate) and ongoing activities (null endDate)

## New Requirement: Participant Role and Activity Date Filtering

### Requirement 3B: Filter Participants by Role and Activity Date Range

**User Story:** As a community organizer using the API, I want to filter participants by the roles they've performed and by when they participated in activities, so that I can retrieve specific subsets of participants based on their involvement patterns.

#### Acceptance Criteria

**Role Filtering:**

1. THE API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/participants endpoint
2. WHEN roleIds filter is provided, THE API SHALL validate that all provided values are valid UUIDs
3. WHEN invalid UUIDs are provided in roleIds filter, THE API SHALL return 400 Bad Request with a validation error
4. WHEN roleIds filter is provided, THE API SHALL join the Assignment table to access role information
5. WHEN roleIds filter is provided, THE API SHALL return only participants who have at least one assignment with a roleId matching at least one of the specified role IDs
6. WHEN multiple role IDs are provided, THE API SHALL apply OR logic within the role filter dimension (participants matching at least one role)
7. WHEN a participant has multiple assignments with different roles and at least one matches the filter, THE API SHALL include that participant in the results
8. WHEN a participant has no assignments matching any of the specified roles, THE API SHALL exclude that participant from the results
9. THE API SHALL use DISTINCT or EXISTS subquery to avoid returning duplicate participant records when a participant has multiple matching assignments
10. WHEN roleIds filter is combined with other participant filters (name, email, population, age cohort), THE API SHALL apply all filters using AND logic across dimensions

**Activity Date Range Filtering:**

11. THE API SHALL accept ?filter[activityStartDate]=YYYY-MM-DD parameter on GET /api/v1/participants endpoint
12. THE API SHALL accept ?filter[activityEndDate]=YYYY-MM-DD parameter on GET /api/v1/participants endpoint
13. WHEN activity date range filter parameters are provided, THE API SHALL validate that dates are in valid ISO-8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
14. WHEN invalid date formats are provided, THE API SHALL return 400 Bad Request with a validation error
15. WHEN activity date range filter is provided, THE API SHALL join the Assignment and Activity tables to access activity date information
16. WHEN both activityStartDate and activityEndDate are provided, THE API SHALL return only participants who have at least one assignment to an activity that overlaps with the specified date range
17. THE API SHALL use overlap logic for date range filtering: (activity.startDate <= filterEndDate) AND (activity.endDate >= filterStartDate OR activity.endDate IS NULL)
18. WHEN an activity has null endDate (ongoing activity), THE API SHALL treat it as overlapping with any date range that extends to the present or future
19. WHEN only activityStartDate is provided (no activityEndDate), THE API SHALL return participants with activities starting on or after that date
20. WHEN only activityEndDate is provided (no activityStartDate), THE API SHALL return participants with activities ending on or before that date, including ongoing activities (null endDate)
21. WHEN a participant has multiple assignments and at least one is to an activity within the date range, THE API SHALL include that participant in the results
22. WHEN a participant has no assignments to activities within the date range, THE API SHALL exclude that participant from the results
23. THE API SHALL use DISTINCT or EXISTS subquery to avoid returning duplicate participant records when a participant has multiple assignments within the date range
24. WHEN activity date range filter is combined with other participant filters, THE API SHALL apply all filters using AND logic across dimensions

**Combined Role and Date Range Filtering:**

25. WHEN both roleIds and activity date range filters are provided, THE API SHALL apply both filters using AND logic
26. WHEN both filters are provided, THE API SHALL return only participants who have at least one assignment that matches BOTH the role criteria AND the activity date range criteria
27. THE API SHALL optimize the query to use a single JOIN with the Assignment table when both filters are active
28. WHEN both filters are provided, THE API SHALL use a combined WHERE clause: assignments.some({ roleId: { in: roleIds }, activity: { date overlap logic } })

**Query Optimization:**

29. THE API SHALL create a database index on Assignment.roleId for efficient role-based filtering
30. THE API SHALL create a database index on Activity.startDate for efficient date range filtering
31. THE API SHALL create a database index on Activity.endDate for efficient date range filtering
32. THE API SHALL use efficient JOIN strategies (EXISTS subqueries or INNER JOIN with DISTINCT) to minimize query execution time
33. THE API SHALL maintain sub-100ms query latency for role and activity date range filtering on datasets with up to 10,000 participants and 100,000 assignments
34. THE API SHALL avoid N+1 query problems by using appropriate Prisma include/select strategies

**Pagination and Total Count:**

35. WHEN role or activity date range filters are applied, THE API SHALL include the filters in the total count calculation for pagination metadata
36. THE API SHALL return accurate total counts reflecting the filtered result set
37. THE API SHALL support pagination with role and activity date range filters (page and limit parameters work correctly)

**Integration with Existing Filters:**

38. THE roleIds and activity date range filters SHALL integrate seamlessly with existing participant filters (name, email, dateOfBirth, dateOfRegistration, populationIds, ageCohorts)
39. THE API SHALL apply all filters using AND logic across dimensions
40. THE API SHALL apply OR logic within each filter dimension (e.g., multiple roles, multiple populations)
41. THE API SHALL support combining role filter with geographic area filter (geographicAreaId parameter)
42. WHEN geographic area filter is active with role or activity date range filters, THE API SHALL apply all filters using AND logic

**Response Format:**

43. THE API SHALL return participants in the standard paginated response format with data and pagination metadata
44. THE API SHALL include all standard participant fields in the response (id, name, email, phone, ageCohort, populations, etc.)
45. THE API SHALL NOT include assignment or activity details in the participant list response (only filter by them)
46. THE API SHALL maintain consistent response format regardless of which filters are applied

**Error Handling:**

47. WHEN roleIds filter contains non-existent role IDs, THE API SHALL return an empty result set (not an error)
48. WHEN activity date range filter specifies a range with no matching activities, THE API SHALL return an empty result set (not an error)
49. WHEN query execution fails due to database errors, THE API SHALL return 500 Internal Server Error with appropriate error message
50. THE API SHALL log all query errors for debugging purposes

#### Implementation Notes

**Prisma Query Pattern:**

```typescript
// Build WHERE clause with assignment-based filters
const where: any = {
  // ... existing filters (name, email, etc.) ...
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
      { startDate: { lte: new Date(filter.activityEndDate) } },
      {
        OR: [
          { endDate: { gte: new Date(filter.activityStartDate) } },
          { endDate: null } // Ongoing activities
        ]
      }
    ];
  } else if (filter.activityStartDate) {
    // Activities starting on or after date
    activityDateCondition.startDate = { gte: new Date(filter.activityStartDate) };
  } else if (filter.activityEndDate) {
    // Activities ending on or before date (or ongoing)
    activityDateCondition.OR = [
      { endDate: { lte: new Date(filter.activityEndDate) } },
      { endDate: null }
    ];
  }
  
  // Merge with existing assignments filter if present
  if (where.assignments?.some) {
    where.assignments.some.activity = activityDateCondition;
  } else {
    where.assignments = {
      some: {
        activity: activityDateCondition
      }
    };
  }
}

// Execute query with DISTINCT to avoid duplicates
const participants = await prisma.participant.findMany({
  where,
  distinct: ['id'], // Prevent duplicates from multiple matching assignments
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

**Database Indexes:**

```sql
-- Index for role-based filtering
CREATE INDEX idx_assignment_role_id ON "Assignment"("roleId");

-- Indexes for activity date range filtering
CREATE INDEX idx_activity_start_date ON "Activity"("startDate");
CREATE INDEX idx_activity_end_date ON "Activity"("endDate");

-- Composite index for combined filtering (optional, if query planner doesn't use separate indexes efficiently)
CREATE INDEX idx_assignment_role_activity ON "Assignment"("roleId", "activityId");
```

**Frontend Service Method:**

```typescript
// In ParticipantService
async getParticipants(filters: ParticipantFilters, page: number, limit: number) {
  const params = new URLSearchParams();
  
  // ... existing filter parameters ...
  
  // Add role filter
  if (filters.roleIds && filters.roleIds.length > 0) {
    params.append('filter[roleIds]', filters.roleIds.join(','));
  }
  
  // Add activity date range filter
  if (filters.activityDateRange) {
    if (filters.activityDateRange.type === 'absolute') {
      params.append('filter[activityStartDate]', filters.activityDateRange.startDate);
      params.append('filter[activityEndDate]', filters.activityDateRange.endDate);
    } else if (filters.activityDateRange.type === 'relative') {
      // Calculate absolute dates from relative period
      const { startDate, endDate } = calculateAbsoluteDates(filters.activityDateRange.relativePeriod);
      params.append('filter[activityStartDate]', startDate);
      params.append('filter[activityEndDate]', endDate);
    }
  }
  
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get(`/api/v1/participants?${params.toString()}`);
  return response.data;
}
```

#### Testing Considerations

Property-based tests should verify:
- Role filter correctly includes participants with matching role assignments
- Role filter correctly excludes participants without matching role assignments
- Activity date range filter correctly includes participants with activities in range
- Activity date range filter correctly handles ongoing activities (null endDate)
- Overlap logic works correctly for various date range scenarios
- Combined role and date range filters apply AND logic correctly
- Filters integrate correctly with existing participant filters
- Query performance meets latency requirements
- Duplicate participants are not returned when multiple assignments match
- URL synchronization works for both absolute and relative date ranges
- Validation errors are returned for invalid inputs
