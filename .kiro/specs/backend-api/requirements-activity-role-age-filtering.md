# Requirements Update: Activity Filtering by Role and Age Cohort

## Overview

This document specifies new filtering capabilities for the GET /api/v1/activities endpoint that enable filtering by participant roles and age cohorts. These filters require joining with the Assignment and Participant tables to access role and demographic data, following the same patterns established for participant list filtering and map marker filtering.

## Related Requirements

This requirement extends:
- **Requirement 28**: Unified Flexible Filtering and Attribute Selection Architecture (backend-api)
- **Requirement 4**: Create and Manage Activities (backend-api)
- **Requirement 3B**: Filter Participants by Role and Activity Date Range (backend-api)
- **Requirement 1A**: Filter Activity Markers by Role and Age Cohort (backend-api, map-role-age-filtering)

## Glossary

- **Assignment_Based_Filter**: A filter that requires joining the Assignment table to access participant-activity relationship data (roles)
- **Participant_Based_Filter**: A filter that requires joining the Participant table to access participant demographic data (age cohort)
- **Role_Filter**: A filter that returns only activities where participants have performed specific roles
- **Age_Cohort_Filter**: A filter that returns only activities where participants belong to specific age cohorts
- **Reference_Date**: The date used as the reference point for calculating participant age cohorts, determined as the minimum of: current date, activity endDate (if non-null), and date range filter endDate (if provided)
- **Conditional_Join**: A database table join that is only included in the query when specific filters are present

## New Requirement: Activity List Role and Age Cohort Filtering

### Requirement 4D: Filter Activities by Participant Role and Age Cohort

**User Story:** As a community organizer, I want to filter the activity list by the roles participants have performed and by their age cohorts, so that I can find activities involving specific participant demographics and roles.

#### Acceptance Criteria

**API Parameter Acceptance:**

1. THE API SHALL accept ?filter[roleIds]=uuid1,uuid2 parameter on GET /api/v1/activities endpoint
2. THE API SHALL accept ?filter[ageCohorts]=cohort1,cohort2 parameter on GET /api/v1/activities endpoint
3. WHEN roleIds filter is provided, THE API SHALL validate that all provided values are valid UUIDs
4. WHEN invalid UUIDs are provided in roleIds filter, THE API SHALL return 400 Bad Request with a validation error
5. WHEN ageCohorts filter is provided, THE API SHALL validate that all provided values are valid age cohort names (Child, Junior Youth, Youth, Young Adult, Adult, Unknown)
6. WHEN invalid age cohort names are provided, THE API SHALL return 400 Bad Request with a validation error

**Conditional Join Logic:**

7. WHEN roleIds filter is provided, THE API SHALL conditionally join the Assignment table in the query
8. WHEN ageCohorts filter is provided, THE API SHALL conditionally join both the Assignment and Participant tables in the query
9. WHEN both roleIds and ageCohorts filters are provided, THE API SHALL join Assignment and Participant tables once and apply both filters
10. WHEN neither roleIds nor ageCohorts filters are provided, THE API SHALL NOT join Assignment or Participant tables
11. WHEN only population filter is provided (no role or age cohort), THE API SHALL join Assignment, Participant, and ParticipantPopulation tables as per existing implementation
12. WHEN population, role, and age cohort filters are all provided, THE API SHALL join Assignment, Participant, and ParticipantPopulation tables once and apply all filters

**Filter Application Logic:**

13. WHEN roleIds filter is provided, THE API SHALL return only activities where at least one participant has at least one assignment with a roleId matching at least one of the specified role IDs
14. WHEN multiple role IDs are provided, THE API SHALL apply OR logic within the role filter dimension (activity has participant with role A OR role B)
15. WHEN ageCohorts filter is provided, THE API SHALL return only activities where at least one participant's calculated age cohort matches at least one of the specified cohorts
16. WHEN calculating age cohort for activity list filtering, THE API SHALL determine the reference date using the following logic:
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
24. WHEN roleIds or ageCohorts filters are combined with other activity filters (activityTypeIds, activityCategoryIds, status, date range, geographic area, population), THE API SHALL apply all filters using AND logic across dimensions

**Deduplication:**

25. THE API SHALL use GROUP BY or DISTINCT to avoid returning duplicate activity records when multiple participants match the filter criteria
26. THE GROUP BY clause SHALL include all selected activity fields
27. THE API SHALL maintain stable ordering (ORDER BY activity.id or activity.name) after GROUP BY to ensure consistent pagination

**Reference Date Calculation for Age Cohort:**

28. THE API SHALL implement a calculateReferenceDate() utility function that determines the appropriate reference date for age cohort calculations
29. THE calculateReferenceDate() function SHALL accept: current date, activity endDate (nullable), and filter endDate (nullable)
30. THE calculateReferenceDate() function SHALL return the minimum of all non-null dates provided
31. WHEN all three dates are provided (current, activity endDate, filter endDate), THE function SHALL return the earliest date
32. WHEN only current date and activity endDate are provided, THE function SHALL return the earlier of the two
33. WHEN only current date and filter endDate are provided, THE function SHALL return the earlier of the two
34. WHEN only current date is provided (activity endDate is null and no filter endDate), THE function SHALL return the current date
35. THE API SHALL use the calculated reference date when converting age cohort names to date range conditions
36. THE API SHALL apply the reference date on a per-activity basis when possible, or use a conservative approach with a single reference date for all activities in the query

**Age Cohort Date Range Conversion:**

37. WHEN ageCohorts filter is provided, THE API SHALL convert cohort names to date range conditions on Participant.dateOfBirth before executing the query
38. THE API SHALL use the convertCohortToDateRange() function that accepts a reference date parameter
39. WHEN filtering for "Child" cohort, THE API SHALL query for participants with dateOfBirth > (reference date - 11 years)
40. WHEN filtering for "Junior Youth" cohort, THE API SHALL query for participants with dateOfBirth >= (reference date - 15 years) AND dateOfBirth < (reference date - 11 years)
41. WHEN filtering for "Youth" cohort, THE API SHALL query for participants with dateOfBirth >= (reference date - 21 years) AND dateOfBirth < (reference date - 15 years)
42. WHEN filtering for "Young Adult" cohort, THE API SHALL query for participants with dateOfBirth >= (reference date - 30 years) AND dateOfBirth < (reference date - 21 years)
43. WHEN filtering for "Adult" cohort, THE API SHALL query for participants with dateOfBirth < (reference date - 30 years)
44. WHEN filtering for "Unknown" cohort, THE API SHALL query for participants with dateOfBirth IS NULL
45. WHEN multiple age cohorts are specified, THE API SHALL combine the date range conditions using OR logic

**Query Optimization:**

46. THE API SHALL use existing database indexes on Assignment.roleId for role filtering
47. THE API SHALL use existing database indexes on Participant.dateOfBirth for age cohort filtering
48. THE API SHALL maintain sub-200ms query latency for role and age cohort filtering on datasets with 100,000+ activities
49. THE API SHALL avoid N+1 query problems by using appropriate Prisma include/select strategies
50. THE API SHALL only add conditional joins when the corresponding filters are present

**Pagination and Total Count:**

51. WHEN role or age cohort filters are applied, THE API SHALL include the filters in the total count calculation for pagination metadata
52. THE API SHALL return accurate total counts reflecting the filtered result set
53. THE API SHALL support pagination with role and age cohort filters (page and limit parameters work correctly)
54. THE API SHALL maintain stable ordering to ensure consistent pagination across pages

**Integration with Existing Filters:**

55. THE roleIds and ageCohorts filters SHALL integrate seamlessly with existing activity filters (name, activityTypeIds, activityCategoryIds, status, populationIds, startDate, endDate, updatedAt, geographicAreaId)
56. THE API SHALL apply all filters using AND logic across dimensions
57. THE API SHALL apply OR logic within each filter dimension (e.g., multiple roles, multiple age cohorts)
58. WHEN role or age cohort filters are combined with population filters, THE API SHALL apply both filters (activities must have participants matching role/cohort AND belonging to specified populations)

**Response Format:**

59. THE API SHALL return activities in the standard paginated response format with data and pagination metadata
60. THE API SHALL include all standard activity fields in the response (id, name, activityTypeId, status, dates, etc.)
61. THE API SHALL NOT include assignment or participant details in the activity list response (only filter by them)
62. THE API SHALL maintain consistent response format regardless of which filters are applied

**Error Handling:**

63. WHEN roleIds filter contains non-existent role IDs, THE API SHALL return an empty result set (not an error)
64. WHEN ageCohorts filter specifies cohorts with no matching participants, THE API SHALL return an empty result set (not an error)
65. WHEN query execution fails due to database errors, THE API SHALL return 500 Internal Server Error with appropriate error message
66. THE API SHALL log all query errors for debugging purposes

#### Implementation Notes

**Prisma Query Pattern:**

```typescript
// Build WHERE clause with assignment-based filters
const where: any = {
  // ... existing filters (name, activityTypeIds, status, etc.) ...
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
  // Calculate reference date
  const referenceDate = calculateReferenceDate(
    new Date(),
    null, // Conservative: use single reference date for all activities
    filter.endDate ? new Date(filter.endDate) : null
  );
  
  // Convert cohorts to date range conditions
  const cohortConditions = filter.ageCohorts.map(cohort => {
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
  
  // Merge with existing assignments filter if present
  if (where.assignments?.some) {
    where.assignments.some.participant = {
      OR: cohortConditions
    };
  } else {
    where.assignments = {
      some: {
        participant: {
          OR: cohortConditions
        }
      }
    };
  }
}

// Execute query with DISTINCT to avoid duplicates
const activities = await prisma.activity.findMany({
  where,
  distinct: ['id'], // Prevent duplicates from multiple matching participants
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

**Validation Schema Update:**

```typescript
// In validation.schemas.ts

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

**Reference Date Calculation Examples:**

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

#### Testing Considerations

Property-based tests should verify:
- Role filter correctly includes activities with participants having matching roles
- Role filter correctly excludes activities without participants having matching roles
- Age cohort filter correctly includes activities with participants in matching cohorts
- Age cohort filter uses correct reference date for temporal accuracy
- Combined role and age cohort filters apply AND logic correctly
- Filters integrate correctly with existing activity filters
- Query performance meets latency requirements (<200ms)
- Duplicate activities are not returned when multiple participants match
- Pagination remains stable with new filters
- Validation errors are returned for invalid inputs
