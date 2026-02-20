# Design Document: Map View Role and Age Cohort Filtering

## Overview

This design document describes the implementation of role and age cohort filtering for the Map View. These filters extend the existing FilterGroupingPanel component with two new filter properties that enable users to visualize activities and participant homes based on participant demographics and roles.

## Design Rationale

**Why Add These Filters:**
- Users need to visualize where specific roles are active (e.g., all Tutors)
- Users need to visualize engagement patterns by age group
- Complements existing map filters (population, activity type, date range)
- Enables use cases like "Show all activities with Youth participants in the last 6 months"

**Why Use FilterGroupingPanel:**
- Consistent with existing map filtering UI
- Provides unified interface for all filter dimensions
- Handles lazy loading, URL synchronization, and token display automatically
- Reduces code duplication and maintenance burden

**Why Keep Filters Active Across Modes:**
- Smooth UX when switching between map modes
- Users don't lose filter selections when exploring different visualizations
- Backend silently ignores inapplicable filters (e.g., role filter in Venues mode)
- Matches pattern used for other filters (activity category, activity type, status)

**Why Reference Date Matters:**
- Age cohorts should reflect participant ages at the relevant time period
- When viewing historical data, cohorts should show ages at that time
- Backend automatically calculates reference date as minimum of (current date, activity endDate, filter endDate)
- Frontend doesn't need to handle this complexity - backend does it automatically

## Architecture

### FilterGroupingPanel Configuration

Update the Map View FilterGroupingPanel to add two new filter properties:

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

Convert filter tokens to API query parameters based on map mode:

```typescript
function buildMapMarkerQueryParams(
  filterTokens: FilterToken[],
  mapMode: string,
  dateRange: DateRangeValue | null,
  boundingBox: BoundingBox | null
): URLSearchParams {
  const params = new URLSearchParams();
  
  // Determine if role and age cohort filters apply to current mode
  const applyParticipantFilters = mapMode !== 'Venues';
  
  for (const token of filterTokens) {
    switch (token.propertyKey) {
      case 'activityCategory':
        // Only apply to activity modes
        if (mapMode === 'Activities by Type' || mapMode === 'Activities by Category') {
          const categoryIds = token.value as string[];
          params.append('filter[activityCategoryIds]', categoryIds.join(','));
        }
        break;
        
      case 'activityType':
        // Only apply to activity modes
        if (mapMode === 'Activities by Type' || mapMode === 'Activities by Category') {
          const typeIds = token.value as string[];
          params.append('filter[activityTypeIds]', typeIds.join(','));
        }
        break;
        
      case 'status':
        // Only apply to activity modes
        if (mapMode === 'Activities by Type' || mapMode === 'Activities by Category') {
          params.append('filter[status]', token.value as string);
        }
        break;
        
      case 'population':
        // Apply to activity and participant home modes
        if (applyParticipantFilters) {
          const populationIds = token.value as string[];
          params.append('filter[populationIds]', populationIds.join(','));
        }
        break;
        
      case 'role':
        // NEW: Apply to activity and participant home modes
        if (applyParticipantFilters) {
          const roleIds = token.value as string[];
          params.append('filter[roleIds]', roleIds.join(','));
        }
        break;
        
      case 'ageCohort':
        // NEW: Apply to activity and participant home modes
        if (applyParticipantFilters) {
          const cohorts = token.value as string[];
          params.append('filter[ageCohorts]', cohorts.join(','));
        }
        break;
    }
  }
  
  // Add date range parameters
  if (dateRange) {
    if (dateRange.type === 'absolute') {
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }
    } else if (dateRange.type === 'relative') {
      // Calculate absolute dates from relative period
      const { startDate, endDate } = calculateAbsoluteDates(dateRange.relative!);
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
  }
  
  // Add bounding box parameters
  if (boundingBox) {
    params.append('minLat', boundingBox.minLat.toString());
    params.append('maxLat', boundingBox.maxLat.toString());
    params.append('minLon', boundingBox.minLon.toString());
    params.append('maxLon', boundingBox.maxLon.toString());
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

# Combined with other filters and map mode
?mapMode=Activities+by+Type&filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_populationIds=uuid3&startDate=2025-01-01&endDate=2025-12-31
```

**Persisting to URL:**

```typescript
function syncFiltersToURL(filterTokens: FilterToken[], mapMode: string, dateRange: DateRangeValue | null) {
  const params = new URLSearchParams(window.location.search);
  
  // Clear existing filter parameters
  Array.from(params.keys())
    .filter(key => key.startsWith('filter_'))
    .forEach(key => params.delete(key));
  
  // Add map mode
  params.set('mapMode', mapMode);
  
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
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);
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
2. Map refetches markers with new filters
3. Markers update to show only matching activities/homes
4. Legend updates to show only visible types/categories
5. URL updates to reflect current filter state

**Mode Switching with Active Filters:**
1. User has "Role = Tutor" and "Age Cohort = Youth" filters active
2. User switches from "Activities by Type" to "Venues" mode
3. Filters remain visible and selected in FilterGroupingPanel
4. Backend silently ignores role and age cohort filters for venue markers
5. User switches back to "Activities by Type"
6. Filters automatically reapply to show filtered activities

### Visual Feedback

**Loading States:**
- FilterGroupingPanel shows loading indicator while resolving URL filters
- Map shows progress indicator while fetching marker batches
- Role dropdown shows loading indicator while fetching role options

**Error States:**
- Validation errors displayed inline in FilterGroupingPanel
- API errors displayed as CloudScape Alert
- Retry button provided for failed requests

**Empty States:**
- "No markers found matching current filters" message when results are empty
- Suggestion to adjust or clear filters
- Map remains interactive

## State Management

**Component State:**
```typescript
interface MapViewState {
  mapMode: string; // "Activities by Type", "Activities by Category", "Participant Homes", "Venues"
  filterTokens: FilterToken[];
  dateRange: DateRangeValue | null;
  currentPage: number;
  loadedMarkers: Marker[];
  totalMarkers: number;
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
// Cache key includes all filter parameters and map mode
const queryKey = [
  'mapMarkers',
  mapMode,
  page,
  limit,
  globalGeographicAreaId,
  filterTokens, // Includes role and age cohort filters
  dateRange,
  boundingBox
];

const { data, isLoading, error } = useQuery({
  queryKey,
  queryFn: () => {
    const endpoint = getEndpointForMode(mapMode);
    return MapDataService[endpoint]({
      filters: convertTokensToFilters(filterTokens, mapMode),
      boundingBox,
      page,
      limit
    });
  },
  placeholderData: keepPreviousData,
});
```

### Filter Token Conversion

Convert FilterGroupingPanel tokens to API request parameters:

```typescript
function convertTokensToFilters(tokens: FilterToken[], mapMode: string): MapFilters {
  const filters: MapFilters = {};
  const applyParticipantFilters = mapMode !== 'Venues';
  
  for (const token of tokens) {
    switch (token.propertyKey) {
      case 'activityCategory':
        if (mapMode === 'Activities by Type' || mapMode === 'Activities by Category') {
          filters.activityCategoryIds = token.value as string[];
        }
        break;
        
      case 'activityType':
        if (mapMode === 'Activities by Type' || mapMode === 'Activities by Category') {
          filters.activityTypeIds = token.value as string[];
        }
        break;
        
      case 'status':
        if (mapMode === 'Activities by Type' || mapMode === 'Activities by Category') {
          filters.status = token.value as string;
        }
        break;
        
      case 'population':
        if (applyParticipantFilters) {
          filters.populationIds = token.value as string[];
        }
        break;
        
      case 'role':
        // NEW: Apply to activity and participant home modes
        if (applyParticipantFilters) {
          filters.roleIds = token.value as string[];
        }
        break;
        
      case 'ageCohort':
        // NEW: Apply to activity and participant home modes
        if (applyParticipantFilters) {
          filters.ageCohorts = token.value as string[];
        }
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

## MapDataService Updates

### Method Signatures

```typescript
interface MapFilters {
  activityCategoryIds?: string[];
  activityTypeIds?: string[];
  status?: string;
  populationIds?: string[];
  roleIds?: string[]; // NEW
  ageCohorts?: string[]; // NEW
  startDate?: string;
  endDate?: string;
}

// Activity markers
async getActivityMarkers(
  filters: MapFilters,
  boundingBox?: BoundingBox,
  page?: number,
  limit?: number
): Promise<PaginatedResponse<ActivityMarker>>;

// Participant home markers
async getParticipantHomeMarkers(
  filters: MapFilters,
  boundingBox?: BoundingBox,
  page?: number,
  limit?: number
): Promise<PaginatedResponse<ParticipantHomeMarker>>;

// Venue markers (accepts but ignores role and age cohort filters)
async getVenueMarkers(
  filters: MapFilters,
  boundingBox?: BoundingBox,
  page?: number,
  limit?: number
): Promise<PaginatedResponse<VenueMarker>>;
```

### Implementation

```typescript
// In MapDataService

async getActivityMarkers(
  filters: MapFilters,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<ActivityMarker>> {
  const params = new URLSearchParams();
  
  // Add all filter parameters
  if (filters.activityCategoryIds) {
    params.append('filter[activityCategoryIds]', filters.activityCategoryIds.join(','));
  }
  if (filters.activityTypeIds) {
    params.append('filter[activityTypeIds]', filters.activityTypeIds.join(','));
  }
  if (filters.status) {
    params.append('filter[status]', filters.status);
  }
  if (filters.populationIds) {
    params.append('filter[populationIds]', filters.populationIds.join(','));
  }
  
  // NEW: Add role filter
  if (filters.roleIds) {
    params.append('filter[roleIds]', filters.roleIds.join(','));
  }
  
  // NEW: Add age cohort filter
  if (filters.ageCohorts) {
    params.append('filter[ageCohorts]', filters.ageCohorts.join(','));
  }
  
  // Add date range
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  
  // Add bounding box
  if (boundingBox) {
    params.append('minLat', boundingBox.minLat.toString());
    params.append('maxLat', boundingBox.maxLat.toString());
    params.append('minLon', boundingBox.minLon.toString());
    params.append('maxLon', boundingBox.maxLon.toString());
  }
  
  // Add pagination
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get(`/api/v1/map/activities?${params.toString()}`);
  return response.data;
}

async getVenueMarkers(
  filters: MapFilters,
  boundingBox?: BoundingBox,
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<VenueMarker>> {
  // Silently ignore role and age cohort filters
  const { roleIds, ageCohorts, ...relevantFilters } = filters;
  
  const params = new URLSearchParams();
  
  // Add only relevant filters for venues
  if (relevantFilters.geographicAreaIds) {
    params.append('filter[geographicAreaIds]', relevantFilters.geographicAreaIds.join(','));
  }
  
  // Add bounding box
  if (boundingBox) {
    params.append('minLat', boundingBox.minLat.toString());
    params.append('maxLat', boundingBox.maxLat.toString());
    params.append('minLon', boundingBox.minLon.toString());
    params.append('maxLon', boundingBox.maxLon.toString());
  }
  
  // Add pagination
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get(`/api/v1/map/venues?${params.toString()}`);
  return response.data;
}
```

## User Experience Flow

### Scenario 1: Filter Activities by Youth Tutors

1. User opens Map View in "Activities by Type" mode
2. User adds "Role = Tutor" filter
3. User adds "Age Cohort = Youth" filter
4. User clicks "Update"
5. Map fetches activities where at least one participant is:
   - A Tutor (role filter)
   - AND currently 15-20 years old (age cohort filter)
6. Markers update to show only matching activities
7. User can click markers to see activity details

### Scenario 2: Historical View with Date Range

1. User opens Map View in "Activities by Type" mode
2. User selects date range: 2025-01-01 to 2025-06-30
3. User adds "Age Cohort = Junior Youth" filter
4. User clicks "Update"
5. Backend calculates reference date as 2025-06-30 (minimum of current date and filter endDate)
6. Map shows activities where at least one participant was 11-14 years old on 2025-06-30
7. Provides historically accurate view of Junior Youth engagement in first half of 2025

### Scenario 3: Mode Switching

1. User has "Role = Teacher" and "Age Cohort = Adult" filters active
2. User is viewing "Activities by Category" mode
3. User switches to "Venues" mode
4. Filters remain visible in FilterGroupingPanel
5. Backend ignores role and age cohort filters
6. Map shows all venues (filtered only by geographic area if active)
7. User switches back to "Participant Homes" mode
8. Filters automatically reapply
9. Map shows homes of Adult Teachers

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
- GROUP BY deduplicates activities with multiple matching participants
- Reference date calculated once per query, not per activity
- Query variant selection minimizes unnecessary joins

### Expected Performance

- Role filter lazy loading: < 200ms
- Filtered activity markers fetch: < 200ms (backend target)
- Filtered participant home markers fetch: < 200ms (backend target)
- Total user-perceived latency: < 500ms from filter selection to markers displayed
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
- When no markers match filters, return 200 OK with empty array
- Frontend displays empty state message
- User can adjust or clear filters

### API Errors

**Frontend Handling:**
- Display CloudScape Alert with error message
- Provide retry button
- Log errors to console
- Maintain previous markers if available (graceful degradation)

## Testing Strategy

### Unit Tests

- Test filter token conversion to API parameters
- Test mode-specific filter application logic
- Test URL synchronization (persist and restore)
- Test role name resolution for display

### Integration Tests

- Test role filter returns correct activities
- Test age cohort filter with various date range scenarios
- Test combined role and age cohort filters
- Test integration with existing filters (population, activity type, date range)
- Test mode switching preserves filters
- Test venue mode ignores participant filters
- Test pagination with new filters
- Test URL sharing and restoration

### Property Tests

- Role filter correctly includes/excludes activities
- Age cohort filter correctly includes/excludes activities based on reference date
- Combined filters apply AND logic correctly
- Filters integrate with existing map filters
- No duplicate markers in results
- Pagination remains stable

## Future Enhancements

Potential improvements:
- Visual indicator showing which filters apply to current mode
- Tooltip explaining reference date calculation
- Filter presets for common combinations (e.g., "Youth Tutors")
- Export filtered markers to CSV
- Save filter configurations for quick access
