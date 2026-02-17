# Design Document: Participant List Role and Activity Date Filtering

## Overview

This design document describes the implementation of role-based and activity date range filtering for the ParticipantList page. These filters extend the existing FilterGroupingPanel component with two new filter properties that enable users to find participants based on the roles they've performed and when they were active in activities.

## Design Rationale

**Why Add These Filters:**
- Users need to find participants who served in specific capacities (e.g., all Tutors)
- Users need to find participants who were active during specific time periods
- Complements existing filters (population, age cohort) for comprehensive participant segmentation
- Enables use cases like "Find all Tutors who were active in the last 6 months"

**Why Use FilterGroupingPanel:**
- Consistent with existing list page filtering (ActivityList, VenueList)
- Provides unified UI for all filter dimensions
- Handles lazy loading, URL synchronization, and token display automatically
- Reduces code duplication and maintenance burden

**Why Support Relative Date Ranges:**
- Users often think in relative terms ("last 90 days") rather than absolute dates
- Relative ranges are more intuitive for recurring queries
- Automatically adjusts to current date without manual calculation
- Matches pattern used in analytics dashboards

## Architecture

### FilterGroupingPanel Configuration

Update the ParticipantList component to add two new filter properties:

```typescript
const filterProperties: FilterProperty[] = [
  // Existing properties
  {
    key: 'name',
    label: 'Name',
    groupValuesLabel: 'Name values',
    operators: ['='],
    loadItems: async (filterText) => {
      const participants = await ParticipantService.searchParticipants(filterText);
      return participants.map(p => ({ value: p.id, label: p.name }));
    }
  },
  {
    key: 'email',
    label: 'Email',
    groupValuesLabel: 'Email values',
    operators: ['='],
    loadItems: async (filterText) => {
      const participants = await ParticipantService.searchParticipants(filterText);
      return participants.map(p => ({ value: p.id, label: p.email }));
    }
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    groupValuesLabel: 'Date of Birth',
    operators: ['='],
    propertyType: 'date-range'
  },
  {
    key: 'dateOfRegistration',
    label: 'Date of Registration',
    groupValuesLabel: 'Date of Registration',
    operators: ['='],
    propertyType: 'date-range'
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
  },
  
  // NEW: Role filter property
  {
    key: 'role',
    label: 'Role',
    groupValuesLabel: 'Role values',
    operators: ['='],
    loadItems: async (filterText) => {
      const roles = await RoleService.searchRoles(filterText);
      return roles.map(r => ({ value: r.id, label: r.name }));
    }
  },
  
  // NEW: Activity date range filter property
  {
    key: 'activityDateRange',
    label: 'Activity Date Range',
    groupValuesLabel: 'Activity Date Range',
    operators: ['='],
    propertyType: 'date-range',
    supportsRelative: true,
    relativeOptions: [
      { value: '-30d', label: 'Last 30 days' },
      { value: '-90d', label: 'Last 90 days' },
      { value: '-6m', label: 'Last 6 months' },
      { value: '-1y', label: 'Last 1 year' }
    ]
  }
];
```

### Filter Token Display

**Role Filter Token:**
```typescript
// Internal representation
{
  propertyKey: 'role',
  operator: '=',
  value: ['uuid1', 'uuid2'], // Role IDs
  displayValue: 'Tutor, Teacher' // Human-readable names
}

// Displayed in UI
"Role = Tutor, Teacher"
```

**Activity Date Range Filter Token (Absolute):**
```typescript
// Internal representation
{
  propertyKey: 'activityDateRange',
  operator: '=',
  value: { start: '2025-01-01', end: '2025-12-31' },
  displayValue: '2025-01-01 to 2025-12-31'
}

// Displayed in UI
"Activity Date Range = 2025-01-01 to 2025-12-31"
```

**Activity Date Range Filter Token (Relative):**
```typescript
// Internal representation
{
  propertyKey: 'activityDateRange',
  operator: '=',
  value: { relative: '-90d' },
  displayValue: 'Last 90 days'
}

// Displayed in UI
"Activity Date Range = Last 90 days"
```

### API Request Generation

Convert filter tokens to API query parameters:

```typescript
function buildParticipantQueryParams(filterTokens: FilterToken[]): URLSearchParams {
  const params = new URLSearchParams();
  
  for (const token of filterTokens) {
    switch (token.propertyKey) {
      case 'role':
        // Convert role names back to IDs
        const roleIds = token.value as string[];
        params.append('filter[roleIds]', roleIds.join(','));
        break;
        
      case 'activityDateRange':
        const dateRange = token.value as DateRangeValue;
        if (dateRange.relative) {
          // Calculate absolute dates from relative period
          const { startDate, endDate } = calculateAbsoluteDates(dateRange.relative);
          params.append('filter[activityStartDate]', startDate);
          params.append('filter[activityEndDate]', endDate);
        } else {
          // Use absolute dates
          params.append('filter[activityStartDate]', dateRange.start);
          params.append('filter[activityEndDate]', dateRange.end);
        }
        break;
        
      // ... handle other filter properties ...
    }
  }
  
  return params;
}

function calculateAbsoluteDates(relativePeriod: string): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  let startDate: Date;
  
  if (relativePeriod === '-30d') {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
  } else if (relativePeriod === '-90d') {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 90);
  } else if (relativePeriod === '-6m') {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 6);
  } else if (relativePeriod === '-1y') {
    startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 1);
  } else {
    throw new Error(`Invalid relative period: ${relativePeriod}`);
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate
  };
}
```

### URL Synchronization

**URL Parameter Format:**

```
# Role filter
?filter_roleIds=uuid1,uuid2

# Absolute activity date range
?filter_activityStartDate=2025-01-01&filter_activityEndDate=2025-12-31

# Relative activity date range
?filter_activityDateRange=-90d

# Combined filters
?filter_roleIds=uuid1&filter_activityDateRange=-90d&filter_populationIds=uuid3&filter_ageCohorts=Youth
```

**URL Restoration Logic:**

```typescript
function restoreFiltersFromURL(searchParams: URLSearchParams): FilterToken[] {
  const tokens: FilterToken[] = [];
  
  // Restore role filter
  const roleIds = searchParams.get('filter_roleIds');
  if (roleIds) {
    const roleIdArray = roleIds.split(',');
    // Fetch role names for display
    const roles = await RoleService.getRolesByIds(roleIdArray);
    tokens.push({
      propertyKey: 'role',
      operator: '=',
      value: roleIdArray,
      displayValue: roles.map(r => r.name).join(', ')
    });
  }
  
  // Restore activity date range filter
  const relativePeriod = searchParams.get('filter_activityDateRange');
  if (relativePeriod) {
    // Relative date range
    const label = getRelativeDateLabel(relativePeriod); // "Last 90 days"
    tokens.push({
      propertyKey: 'activityDateRange',
      operator: '=',
      value: { relative: relativePeriod },
      displayValue: label
    });
  } else {
    const startDate = searchParams.get('filter_activityStartDate');
    const endDate = searchParams.get('filter_activityEndDate');
    if (startDate || endDate) {
      // Absolute date range
      tokens.push({
        propertyKey: 'activityDateRange',
        operator: '=',
        value: { start: startDate, end: endDate },
        displayValue: `${startDate || '...'} to ${endDate || '...'}`
      });
    }
  }
  
  // ... restore other filters ...
  
  return tokens;
}
```

### RoleService Integration

Add a search method to RoleService for lazy loading:

```typescript
// In RoleService
async searchRoles(searchText: string): Promise<Role[]> {
  const params = new URLSearchParams();
  params.append('filter[name]', searchText);
  params.append('limit', '20'); // Limit results for dropdown
  
  const response = await apiClient.get(`/api/v1/roles?${params.toString()}`);
  return response.data.data;
}

async getRolesByIds(roleIds: string[]): Promise<Role[]> {
  // Fetch multiple roles by ID for URL restoration
  const response = await apiClient.get(`/api/v1/roles`);
  const allRoles = response.data.data;
  return allRoles.filter(r => roleIds.includes(r.id));
}
```

### Date Range Picker Component

For the Activity Date Range filter, use CloudScape DateRangePicker with custom relative options:

```typescript
<DateRangePicker
  value={dateRangeValue}
  onChange={({ detail }) => handleDateRangeChange(detail.value)}
  relativeOptions={[
    { key: '-30d', amount: 30, unit: 'day', type: 'relative' },
    { key: '-90d', amount: 90, unit: 'day', type: 'relative' },
    { key: '-6m', amount: 6, unit: 'month', type: 'relative' },
    { key: '-1y', amount: 1, unit: 'year', type: 'relative' }
  ]}
  isValidRange={(range) => {
    // Validate that start date is before end date
    if (range?.type === 'absolute') {
      return new Date(range.startDate) <= new Date(range.endDate);
    }
    return true;
  }}
  placeholder="Select activity date range"
  i18nStrings={{
    todayAriaLabel: 'Today',
    nextMonthAriaLabel: 'Next month',
    previousMonthAriaLabel: 'Previous month',
    customRelativeRangeDurationLabel: 'Duration',
    customRelativeRangeDurationPlaceholder: 'Enter duration',
    customRelativeRangeOptionLabel: 'Custom range',
    customRelativeRangeOptionDescription: 'Set a custom range in the past',
    customRelativeRangeUnitLabel: 'Unit of time',
    formatRelativeRange: (range) => {
      const labels = {
        '-30d': 'Last 30 days',
        '-90d': 'Last 90 days',
        '-6m': 'Last 6 months',
        '-1y': 'Last 1 year'
      };
      return labels[range.key] || range.key;
    },
    formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
    dateTimeConstraintText: 'Range must be between 1 day and 1 year',
    relativeModeTitle: 'Relative range',
    absoluteModeTitle: 'Absolute range',
    relativeRangeSelectionHeading: 'Choose a range',
    startDateLabel: 'Start date',
    endDateLabel: 'End date',
    clearButtonLabel: 'Clear',
    cancelButtonLabel: 'Cancel',
    applyButtonLabel: 'Apply'
  }}
/>
```

### Filter Logic Flow

**User Interaction Flow:**

1. User opens ParticipantList page
2. User clicks on FilterGroupingPanel to add filters
3. User selects "Role" property and types "Tutor"
4. FilterGroupingPanel calls loadItems callback with "Tutor"
5. RoleService.searchRoles("Tutor") fetches matching roles from backend
6. Dropdown displays "Tutor" option with role UUID as value
7. User selects "Tutor" - token added with UUID value and "Tutor" display name
8. User selects "Activity Date Range" property
9. DateRangePicker opens with absolute and relative options
10. User selects "Last 90 days" relative option
11. Token added with relative period value and "Last 90 days" display name
12. User clicks "Update" button
13. FilterGroupingPanel invokes onUpdate callback with filter state
14. ParticipantList converts tokens to API parameters:
    - Role token → `?filter[roleIds]=tutor-uuid`
    - Date range token → `?filter[activityStartDate]=2024-11-18&filter[activityEndDate]=2026-02-16` (calculated from relative)
15. ParticipantList calls ParticipantService.getParticipants() with parameters
16. Backend returns filtered participants
17. Table displays results with pagination metadata

### State Management

**Component State:**
```typescript
interface ParticipantListState {
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
  value: any; // UUID array for roles, date range object for dates
  displayValue: string; // Human-readable display
}

interface DateRangeValue {
  type: 'absolute' | 'relative';
  startDate?: string; // ISO-8601 date string
  endDate?: string;   // ISO-8601 date string
  relative?: string;  // e.g., "-90d", "-6m"
}
```

**React Query Cache Keys:**
```typescript
// Cache key includes all filter parameters for proper invalidation
const queryKey = [
  'participants',
  page,
  limit,
  globalGeographicAreaId,
  filterTokens, // Includes role and date range filters
];

const { data, isLoading, error } = useQuery({
  queryKey,
  queryFn: () => ParticipantService.getParticipants({
    page,
    limit,
    geographicAreaId: globalGeographicAreaId,
    filters: convertTokensToFilters(filterTokens)
  }),
  placeholderData: keepPreviousData, // Prevent flicker during filter changes
});
```

### Filter Token Conversion

Convert FilterGroupingPanel tokens to API request parameters:

```typescript
function convertTokensToFilters(tokens: FilterToken[]): ParticipantFilters {
  const filters: ParticipantFilters = {};
  
  for (const token of tokens) {
    switch (token.propertyKey) {
      case 'name':
        filters.name = token.value;
        break;
        
      case 'email':
        filters.email = token.value;
        break;
        
      case 'population':
        filters.populationIds = token.value as string[];
        break;
        
      case 'ageCohort':
        filters.ageCohorts = token.value as string[];
        break;
        
      case 'role':
        filters.roleIds = token.value as string[];
        break;
        
      case 'activityDateRange':
        const dateRange = token.value as DateRangeValue;
        if (dateRange.type === 'relative') {
          // Calculate absolute dates
          const { startDate, endDate } = calculateAbsoluteDates(dateRange.relative!);
          filters.activityStartDate = startDate;
          filters.activityEndDate = endDate;
        } else {
          // Use absolute dates
          filters.activityStartDate = dateRange.startDate;
          filters.activityEndDate = dateRange.endDate;
        }
        break;
        
      case 'dateOfBirth':
        // Handle date of birth range
        filters.dobStart = token.value.start;
        filters.dobEnd = token.value.end;
        break;
        
      case 'dateOfRegistration':
        // Handle date of registration range
        filters.dorStart = token.value.start;
        filters.dorEnd = token.value.end;
        break;
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
  loadItems: async (filterText: string, filteringProperty: any, filteringOperator: string) => {
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

**Debouncing:**
- FilterGroupingPanel already implements 300ms debouncing for loadItems callbacks
- No additional debouncing needed in RoleService.searchRoles()

### URL Synchronization

**Persisting to URL:**

```typescript
function syncFiltersToURL(filterTokens: FilterToken[]) {
  const params = new URLSearchParams(window.location.search);
  
  // Clear existing filter parameters
  Array.from(params.keys())
    .filter(key => key.startsWith('filter_'))
    .forEach(key => params.delete(key));
  
  // Add current filter parameters
  for (const token of filterTokens) {
    if (token.propertyKey === 'role') {
      params.set('filter_roleIds', (token.value as string[]).join(','));
    } else if (token.propertyKey === 'activityDateRange') {
      const dateRange = token.value as DateRangeValue;
      if (dateRange.type === 'relative') {
        params.set('filter_activityDateRange', dateRange.relative!);
      } else {
        if (dateRange.startDate) {
          params.set('filter_activityStartDate', dateRange.startDate);
        }
        if (dateRange.endDate) {
          params.set('filter_activityEndDate', dateRange.endDate);
        }
      }
    }
    // ... handle other properties ...
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
    
    // Fetch role names for display (required for token display)
    const roles = await RoleService.getRolesByIds(roleIdArray);
    const roleNames = roles.map(r => r.name).join(', ');
    
    tokens.push({
      propertyKey: 'role',
      operator: '=',
      value: roleIdArray,
      displayValue: roleNames
    });
  }
  
  // Restore activity date range filter
  const relativePeriod = searchParams.get('filter_activityDateRange');
  if (relativePeriod) {
    // Relative date range
    const label = getRelativeDateLabel(relativePeriod);
    tokens.push({
      propertyKey: 'activityDateRange',
      operator: '=',
      value: { type: 'relative', relative: relativePeriod },
      displayValue: label
    });
  } else {
    const startDate = searchParams.get('filter_activityStartDate');
    const endDate = searchParams.get('filter_activityEndDate');
    if (startDate || endDate) {
      // Absolute date range
      tokens.push({
        propertyKey: 'activityDateRange',
        operator: '=',
        value: { type: 'absolute', startDate, endDate },
        displayValue: `${startDate || '...'} to ${endDate || '...'}`
      });
    }
  }
  
  // ... restore other filters ...
  
  return tokens;
}

function getRelativeDateLabel(relativePeriod: string): string {
  const labels: Record<string, string> = {
    '-30d': 'Last 30 days',
    '-90d': 'Last 90 days',
    '-6m': 'Last 6 months',
    '-1y': 'Last 1 year'
  };
  return labels[relativePeriod] || relativePeriod;
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

**Adding Activity Date Range Filter:**
1. User clicks "Add filter" in PropertyFilter
2. Selects "Activity Date Range" from property dropdown
3. DateRangePicker opens with two tabs: "Absolute range" and "Relative range"
4. User switches to "Relative range" tab
5. Selects "Last 90 days" from dropdown
6. Token appears: "Activity Date Range = Last 90 days"
7. Clicking "Update" applies filter

**Clearing Filters:**
- Click X on individual token to remove that filter
- Click "Clear All" button to remove all filters
- Pagination resets to page 1 when filters change

### Visual Feedback

**Loading States:**
- FilterGroupingPanel shows loading indicator while resolving URL filters
- Table shows loading indicator while fetching filtered results
- Role dropdown shows loading indicator while fetching role options

**Error States:**
- Validation errors displayed inline in FilterGroupingPanel
- API errors displayed as CloudScape Alert above table
- Retry button provided for failed requests

**Empty States:**
- "No participants match the current filters" message when results are empty
- Suggestion to adjust or clear filters

## Performance Considerations

### Frontend Optimizations

- Debounce role search input (300ms) to reduce API calls
- Cache role search results using React Query
- Use keepPreviousData to prevent flicker during filter changes
- Lazy load role options only when user types in filter

### Backend Optimizations

- Database indexes on Assignment.roleId, Activity.startDate, Activity.endDate
- Use DISTINCT or EXISTS to avoid duplicate results
- Push all filtering to database level (no Node.js filtering)
- Optimize JOIN strategy based on query planner analysis

### Expected Performance

- Role filter lazy loading: < 200ms
- Filtered participant list fetch: < 100ms (backend target)
- Total user-perceived latency: < 500ms from filter selection to results display
- URL restoration: < 1s (includes fetching role names for display)

## Error Handling

### Validation Errors

**Frontend:**
- Display validation errors inline in FilterGroupingPanel
- Prevent "Update" button click when validation fails
- Show clear error messages (e.g., "Invalid date format")

**Backend:**
- Return 400 Bad Request for invalid UUIDs or date formats
- Include detailed error messages in response
- Log validation errors for debugging

### Empty Results

**Not an Error:**
- When no participants match filters, return 200 OK with empty array
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
- Test relative date calculation logic
- Test URL synchronization (persist and restore)
- Test role name resolution for display

### Integration Tests

- Test role filter returns correct participants
- Test activity date range filter with various scenarios
- Test combined role and date range filters
- Test integration with existing filters (population, age cohort)
- Test pagination with new filters
- Test URL sharing and restoration

### Property Tests

- Role filter correctly includes/excludes participants
- Date range overlap logic works for all scenarios
- Ongoing activities (null endDate) handled correctly
- Combined filters apply AND logic correctly
- No duplicate participants in results

## Future Enhancements

Potential improvements:
- Filter by multiple date ranges (e.g., "Q1 OR Q3")
- Filter by assignment notes (text search)
- Filter by number of activities (e.g., "more than 5 activities")
- Filter by specific activity types or categories
- Export filtered results to CSV
- Save filter presets for quick access
