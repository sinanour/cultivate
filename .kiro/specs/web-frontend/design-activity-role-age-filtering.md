# Design Document: Activity List Role and Age Cohort Filtering

## Overview

This design document describes the implementation of role-based and age cohort filtering for the ActivityList page. These filters extend the existing FilterGroupingPanel component with two new filter properties that enable users to find activities based on participant demographics and roles.

## Design Rationale

**Why Add These Filters:**
- Users need to find activities where specific roles are active (e.g., all activities with Tutors)
- Users need to find activities involving specific age groups
- Complements existing filters (activity type, status, population) for comprehensive activity segmentation
- Enables use cases like "Find all Study Circles with Youth participants in the last 6 months"

**Why Use FilterGroupingPanel:**
- Consistent with existing list page filtering (ParticipantList, VenueList)
- Provides unified UI for all filter dimensions
- Handles lazy loading, URL synchronization, and token display automatically
- Reduces code duplication and maintenance burden

**Why Reference Date Matters:**
- Age cohorts should reflect participant ages at the relevant time period
- When viewing historical data, cohorts should show ages at that time
- Backend automatically calculates reference date as minimum of (current date, activity endDate, filter endDate)
- Frontend doesn't need to handle this complexity - backend does it automatically

## Architecture

### FilterGroupingPanel Configuration

Update the ActivityList FilterGroupingPanel to add two new filter properties:

```typescript
const filterProperties: FilterProperty[] = [
  // Existing properties
  {
    key: 'activityCategory',
    label: 'Activity Category',
    groupValuesLabel: 'Activity Category values',
    operators: ['='],
    loadItems: async (filterText) => {
      const categories = await ActivityCategoryService.searchCategories(filterText);
      return categories.map(c => ({ value: c.id, label: c.name }));
    }
  },
  {
    key: 'activityType',
    label: 'Activity Type',
    groupValuesLabel: 'Activity Type values',
    operators: ['='],
    loadItems: async (filterText) => {
      const types = await ActivityTypeService.searchTypes(filterText);
      return types.map(t => ({ value: t.id, label: t.name }));
    }
  },
  {
    key: 'status',
    label: 'Status',
    groupValuesLabel: 'Status values',
    operators: ['='],
    propertyType: 'enum',
    options: [
      { value: 'PLANNED', label: 'Planned' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'CANCELLED', label: 'Cancelled' }
    ]
  },
  {
    key: 'population',
    label: 'Population',
    groupValuesLabel: 'Population values',
    operators: ['='],
    loadItems: async (filterText) => {
      const populations = await PopulationService.searchPopulations(filterText);
      return populations.map(p => ({ value: p.id, label: p.name }));
    }
  },
  
  // NEW: Role filter property
  {
    key: 'role',
    label: 'Role',
    groupValuesLabel: 'Role values',
    operators: ['='],
    loadItems: async (filterText) => {
      const roles = await RoleService.searchRoles(filterText);
      return roles.map(r => ({ 
        value: r.id, 
        label: r.name,
        description: r.isPredefined ? 'Predefined role' : 'Custom role'
      }));
    }
  },
  
  // NEW: Age Cohort filter property
  {
    key: 'ageCohort',
    label: 'Age Cohort',
    groupValuesLabel: 'Age Cohort values',
    operators: ['='],
    propertyType: 'enum',
    options: [
      { value: 'Child', label: 'Child' },
      { value: 'Junior Youth', label: 'Junior Youth' },
      { value: 'Youth', label: 'Youth' },
      { value: 'Young Adult', label: 'Young Adult' },
      { value: 'Adult', label: 'Adult' },
      { value: 'Unknown', label: 'Unknown' }
    ]
  }
];
```

### Filter Token Display

**Role Filter Token:**
```typescript
{
  propertyKey: 'role',
  operator: '=',
  value: ['uuid1', 'uuid2'], // Role IDs
  displayValue: 'Tutor, Teacher' // Human-readable names
}

// Displayed in UI: "Role = Tutor, Teacher"
```

**Age Cohort Filter Token:**
```typescript
{
  propertyKey: 'ageCohort',
  operator: '=',
  value: ['Youth', 'Young Adult'], // Cohort names
  displayValue: 'Youth, Young Adult'
}

// Displayed in UI: "Age Cohort = Youth, Young Adult"
```

### API Request Generation

Convert filter tokens to API query parameters:

```typescript
function buildActivityQueryParams(
  filterTokens: FilterToken[],
  dateRange: DateRangeValue | null
): URLSearchParams {
  const params = new URLSearchParams();
  
  for (const token of filterTokens) {
    switch (token.propertyKey) {
      case 'activityCategory':
        const categoryIds = token.value as string[];
        params.append('filter[activityCategoryIds]', categoryIds.join(','));
        break;
        
      case 'activityType':
        const typeIds = token.value as string[];
        params.append('filter[activityTypeIds]', typeIds.join(','));
        break;
        
      case 'status':
        const statuses = token.value as string[];
        params.append('filter[status]', statuses.join(','));
        break;
        
      case 'population':
        const populationIds = token.value as string[];
        params.append('filter[populationIds]', populationIds.join(','));
        break;
        
      case 'role':
        // NEW: Add role filter
        const roleIds = token.value as string[];
        params.append('filter[roleIds]', roleIds.join(','));
        break;
        
      case 'ageCohort':
        // NEW: Add age cohort filter
        const cohorts = token.value as string[];
        params.append('filter[ageCohorts]', cohorts.join(','));
        break;
    }
  }
  
  // Add date range parameters
  if (dateRange) {
    if (dateRange.type === 'absolute') {
      if (dateRange.startDate) {
        params.append('filter[startDate]', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('filter[endDate]', dateRange.endDate);
      }
    } else if (dateRange.type === 'relative') {
      // Calculate absolute dates from relative period
      const { startDate, endDate } = calculateAbsoluteDates(dateRange.relative!);
      params.append('filter[startDate]', startDate);
      params.append('filter[endDate]', endDate);
    }
  }
  
  return params;
}
```

### URL Synchronization

**URL Parameter Format:**

```
# Role filter
?filter_roleIds=uuid1,uuid2

# Age cohort filter
?filter_ageCohorts=Youth,Young+Adult

# Combined with other filters and date range
?filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_activityTypeIds=uuid3&filter_populationIds=uuid4&filter_startDate=2025-01-01&filter_endDate=2025-12-31
```

**Persisting to URL:**

```typescript
function syncFiltersToURL(filterTokens: FilterToken[], dateRange: DateRangeValue | null) {
  const params = new URLSearchParams(window.location.search);
  
  // Clear existing filter parameters
  Array.from(params.keys())
    .filter(key => key.startsWith('filter_'))
    .forEach(key => params.delete(key));
  
  // Add current filter parameters
  for (const token of filterTokens) {
    if (token.propertyKey === 'role') {
      params.set('filter_roleIds', (token.value as string[]).join(','));
    } else if (token.propertyKey === 'ageCohort') {
      params.set('filter_ageCohorts', (token.value as string[]).join(','));
    }
    // ... handle other properties ...
  }
  
  // Add date range
  if (dateRange) {
    if (dateRange.type === 'relative') {
      params.set('relativePeriod', dateRange.relative!);
    } else {
      if (dateRange.startDate) params.set('filter_startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('filter_endDate', dateRange.endDate);
    }
  }
  
  // Update URL without navigation
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}
```

**Restoring from URL:**

```typescript
async function restoreFiltersFromURL(searchParams: URLSearchParams): Promise<FilterToken[]> {
  const tokens: FilterToken[] = [];
  
  // Restore role filter
  const roleIds = searchParams.get('filter_roleIds');
  if (roleIds) {
    const roleIdArray = roleIds.split(',');
    
    // Fetch role names for display
    const roles = await RoleService.getRolesByIds(roleIdArray);
    const roleNames = roles.map(r => r.name).join(', ');
    
    tokens.push({
      propertyKey: 'role',
      operator: '=',
      value: roleIdArray,
      displayValue: roleNames
    });
  }
  
  // Restore age cohort filter
  const ageCohorts = searchParams.get('filter_ageCohorts');
  if (ageCohorts) {
    const cohortArray = ageCohorts.split(',').map(c => decodeURIComponent(c));
    
    tokens.push({
      propertyKey: 'ageCohort',
      operator: '=',
      value: cohortArray,
      displayValue: cohortArray.join(', ')
    });
  }
  
  // ... restore other filters ...
  
  return tokens;
}
```

## User Experience

### Filter Selection Flow

**Adding Role Filter:**
1. User clicks "Add filter" in PropertyFilter
2. Selects "Role" from property dropdown
3. Types "Tut" in value field
4. Sees "Tutor" option appear after 300ms debounce
5. Selects "Tutor"
6. Token appears: "Role = Tutor"
7. Can add more roles to same token by repeating steps

**Adding Age Cohort Filter:**
1. User clicks "Add filter" in PropertyFilter
2. Selects "Age Cohort" from property dropdown
3. Sees predefined options: Child, Junior Youth, Youth, Young Adult, Adult, Unknown
4. Selects "Youth"
5. Token appears: "Age Cohort = Youth"
6. Can add more cohorts to same token by selecting additional options

**Applying Filters:**
1. User clicks "Update" button on FilterGroupingPanel
2. Activity list refetches with new filters
3. Table updates to show only matching activities
4. URL updates to reflect current filter state
5. Pagination resets to page 1

### Visual Feedback

**Loading States:**
- FilterGroupingPanel shows loading indicator while resolving URL filters
- Table shows loading indicator while fetching filtered results
- Role dropdown shows loading indicator while fetching role options

**Error States:**
- Validation errors displayed inline in FilterGroupingPanel
- API errors displayed as CloudScape Alert
- Retry button provided for failed requests

**Empty States:**
- "No activities found matching current filters" message when results are empty
- Suggestion to adjust or clear filters
- Table remains visible

## State Management

**Component State:**
```typescript
interface ActivityListState {
  filterTokens: FilterToken[];
  dateRange: DateRangeValue | null;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
}

interface FilterToken {
  propertyKey: string;
  operator: string;
  value: any; // UUID array for roles, string array for cohorts
  displayValue: string; // Human-readable display
}
```

**React Query Cache Keys:**
```typescript
// Cache key includes all filter parameters
const queryKey = [
  'activities',
  page,
  limit,
  globalGeographicAreaId,
  filterTokens, // Includes role and age cohort filters
  dateRange
];

const { data, isLoading, error } = useQuery({
  queryKey,
  queryFn: () => ActivityService.getActivities({
    page,
    limit,
    geographicAreaId: globalGeographicAreaId,
    filters: convertTokensToFilters(filterTokens, dateRange)
  }),
  placeholderData: keepPreviousData,
});
```

### Filter Token Conversion

Convert FilterGroupingPanel tokens to API request parameters:

```typescript
function convertTokensToFilters(tokens: FilterToken[], dateRange: DateRangeValue | null): ActivityFilters {
  const filters: ActivityFilters = {};
  
  for (const token of tokens) {
    switch (token.propertyKey) {
      case 'activityCategory':
        filters.activityCategoryIds = token.value as string[];
        break;
        
      case 'activityType':
        filters.activityTypeIds = token.value as string[];
        break;
        
      case 'status':
        filters.status = token.value as string[];
        break;
        
      case 'population':
        filters.populationIds = token.value as string[];
        break;
        
      case 'role':
        filters.roleIds = token.value as string[];
        break;
        
      case 'ageCohort':
        filters.ageCohorts = token.value as string[];
        break;
    }
  }
  
  // Add date range
  if (dateRange) {
    if (dateRange.type === 'relative') {
      const { startDate, endDate } = calculateAbsoluteDates(dateRange.relative!);
      filters.startDate = startDate;
      filters.endDate = endDate;
    } else {
      filters.startDate = dateRange.startDate;
      filters.endDate = dateRange.endDate;
    }
  }
  
  return filters;
}
```

### Lazy Loading Implementation

**Role Filter Lazy Loading:**

```typescript
const roleFilterProperty: FilterProperty = {
  key: 'role',
  label: 'Role',
  groupValuesLabel: 'Role values',
  operators: ['='],
  loadItems: async (filterText: string) => {
    try {
      // Fetch roles matching the search text
      const roles = await RoleService.searchRoles(filterText);
      
      // Transform to PropertyFilter option format
      return roles.map(role => ({
        value: role.id,
        label: role.name,
        description: role.isPredefined ? 'Predefined role' : 'Custom role'
      }));
    } catch (error) {
      console.error('Error loading roles:', error);
      return [];
    }
  }
};
```

**Age Cohort Filter (No Lazy Loading):**

```typescript
const ageCohortFilterProperty: FilterProperty = {
  key: 'ageCohort',
  label: 'Age Cohort',
  groupValuesLabel: 'Age Cohort values',
  operators: ['='],
  propertyType: 'enum',
  options: [
    { value: 'Child', label: 'Child' },
    { value: 'Junior Youth', label: 'Junior Youth' },
    { value: 'Youth', label: 'Youth' },
    { value: 'Young Adult', label: 'Young Adult' },
    { value: 'Adult', label: 'Adult' },
    { value: 'Unknown', label: 'Unknown' }
  ]
};
```

## User Experience Flow

### Scenario 1: Filter Activities by Youth Tutors

1. User opens ActivityList page
2. User adds "Role = Tutor" filter
3. User adds "Age Cohort = Youth" filter
4. User clicks "Update"
5. Backend fetches activities where at least one participant is:
   - A Tutor (role filter)
   - AND currently 15-20 years old (age cohort filter)
6. Table updates to show only matching activities
7. User can click activity names to see details

### Scenario 2: Historical View with Date Range

1. User opens ActivityList page
2. User selects date range: 2025-01-01 to 2025-06-30
3. User adds "Age Cohort = Junior Youth" filter
4. User clicks "Update"
5. Backend calculates reference date as 2025-06-30 (minimum of current date and filter endDate)
6. Table shows activities where at least one participant was 11-14 years old on 2025-06-30
7. Provides historically accurate view of Junior Youth engagement in first half of 2025

### Scenario 3: Combined with Existing Filters

1. User has "Activity Type = Study Circle" filter active
2. User adds "Role = Tutor" filter
3. User adds "Population = Youth" filter
4. User clicks "Update"
5. Table shows Study Circles with Youth population members who served as Tutors
6. All filters apply with AND logic across dimensions

## Performance Considerations

### Frontend Optimizations

- Debounce role search input (300ms) to reduce API calls
- Cache role search results using React Query
- Use keepPreviousData to prevent flicker during filter changes
- Lazy load role options only when user types in filter
- Age cohort options are static (no API calls needed)

### Backend Optimizations

- Conditional joins only when filters are present
- Use existing indexes on Assignment.roleId and Participant.dateOfBirth
- DISTINCT deduplicates activities with multiple matching participants
- Reference date calculated once per query, not per activity
- Query optimization through Prisma or raw SQL as needed

### Expected Performance

- Role filter lazy loading: < 200ms
- Filtered activity list fetch: < 200ms (backend target)
- Total user-perceived latency: < 500ms from filter selection to results displayed
- URL restoration: < 1s (includes fetching role names for display)

## Error Handling

### Validation Errors

**Frontend:**
- Display validation errors inline in FilterGroupingPanel
- Prevent "Update" button click when validation fails
- Show clear error messages

**Backend:**
- Return 400 Bad Request for invalid UUIDs or cohort names
- Include detailed error messages in response
- Log validation errors for debugging

### Empty Results

**Not an Error:**
- When no activities match filters, return 200 OK with empty array
- Frontend displays empty state message
- User can adjust or clear filters

### API Errors

**Frontend Handling:**
- Display CloudScape Alert with error message
- Provide retry button
- Log errors to console
- Maintain previous results if available (graceful degradation)

## Testing Strategy

### Unit Tests

- Test filter token conversion to API parameters
- Test URL synchronization (persist and restore)
- Test role name resolution for display

### Integration Tests

- Test role filter returns correct activities
- Test age cohort filter with various date range scenarios
- Test combined role and age cohort filters
- Test integration with existing filters (population, activity type, date range)
- Test pagination with new filters
- Test URL sharing and restoration

### Property Tests

- Role filter correctly includes/excludes activities
- Age cohort filter correctly includes/excludes activities based on reference date
- Combined filters apply AND logic correctly
- Filters integrate with existing activity filters
- No duplicate activities in results
- Pagination remains stable

## Future Enhancements

Potential improvements:
- Visual indicator showing reference date used for age cohort calculation
- Filter presets for common combinations (e.g., "Youth Study Circles")
- Export filtered activities to CSV
- Save filter configurations for quick access
