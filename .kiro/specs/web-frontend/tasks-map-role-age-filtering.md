# Implementation Plan: Map View Role and Age Cohort Filtering

## Overview

This implementation plan covers the frontend changes needed to add role and age cohort filtering to the Map View. The implementation extends the existing FilterGroupingPanel configuration with two new filter properties.

## Tasks

- [x] 1. Add Role filter property to Map View FilterGroupingPanel
  - [x] 1.1 Update MapView FilterGroupingPanel configuration
    - Add new filter property object for "Role"
    - Set key: 'role', label: 'Role', groupValuesLabel: 'Role values'
    - Set operators: ['='] (only equals operator)
    - Implement loadItems callback that calls RoleService.searchRoles()
    - Transform role objects to PropertyFilter option format: { value: role.id, label: role.name }
    - Add optional description for predefined vs custom roles
    - _Requirements: 6E.1, 6E.3, 6E.4, 6E.5, 6E.7, 6E.8_

  - [x] 1.2 Verify role filter remains enabled across all map modes
    - Ensure role filter property is not conditionally hidden based on map mode
    - Verify filter remains visible when switching between modes
    - Test that filter selection persists when changing modes
    - _Requirements: 6E.7, 6E.8, 6E.14, 6E.15_

  - [ ]* 1.3 Write unit tests for role filter property configuration
    - Test role filter property is correctly configured
    - Test loadItems callback fetches roles correctly
    - Test filter remains enabled in all map modes
    - **Validates: Requirements 6E.1, 6E.3, 6E.4, 6E.5, 6E.7, 6E.8**

- [x] 2. Add Age Cohort filter property to Map View FilterGroupingPanel
  - [x] 2.1 Update MapView FilterGroupingPanel configuration
    - Add new filter property object for "Age Cohort"
    - Set key: 'ageCohort', label: 'Age Cohort', groupValuesLabel: 'Age Cohort values'
    - Set operators: ['='] (only equals operator)
    - Set propertyType: 'enum'
    - Define options array with all six cohorts: Child, Junior Youth, Youth, Young Adult, Adult, Unknown
    - No loadItems callback needed (predefined options)
    - _Requirements: 6E.2, 6E.6, 6E.7, 6E.8_

  - [x] 2.2 Verify age cohort filter remains enabled across all map modes
    - Ensure age cohort filter property is not conditionally hidden based on map mode
    - Verify filter remains visible when switching between modes
    - Test that filter selection persists when changing modes
    - _Requirements: 6E.7, 6E.8, 6E.14, 6E.15_

  - [ ]* 2.3 Write unit tests for age cohort filter property configuration
    - Test age cohort filter property is correctly configured
    - Test all six cohort options are available
    - Test filter remains enabled in all map modes
    - **Validates: Requirements 6E.2, 6E.6, 6E.7, 6E.8**

- [x] 3. Implement mode-specific filter application logic
  - [x] 3.1 Update convertTokensToFilters function
    - Add case for 'role' property key
    - Extract role IDs from token.value (array of UUIDs)
    - Only add to filters object when mapMode !== 'Venues'
    - Add case for 'ageCohort' property key
    - Extract cohort names from token.value (array of strings)
    - Only add to filters object when mapMode !== 'Venues'
    - _Requirements: 6E.9, 6E.10, 6E.11, 6E.12, 6E.13, 6E.14, 6E.15_

  - [x] 3.2 Update buildMapMarkerQueryParams function
    - Handle roleIds filter parameter
    - When roleIds present and mode is not Venues, add ?filter[roleIds]=uuid1,uuid2
    - Handle ageCohorts filter parameter
    - When ageCohorts present and mode is not Venues, add ?filter[ageCohorts]=cohort1,cohort2
    - Join multiple role IDs with commas
    - Join multiple cohort names with commas
    - _Requirements: 6E.22, 6E.23, 6E.24, 6E.25, 6E.26, 6E.27, 6E.28_

  - [ ]* 3.3 Write unit tests for mode-specific filter application
    - Test role filter applied in "Activities by Type" mode
    - Test role filter applied in "Activities by Category" mode
    - Test role filter applied in "Participant Homes" mode
    - Test role filter NOT applied in "Venues" mode
    - Test age cohort filter applied in activity modes
    - Test age cohort filter applied in participant homes mode
    - Test age cohort filter NOT applied in venues mode
    - **Validates: Requirements 6E.9, 6E.10, 6E.11, 6E.12, 6E.13, 6E.14, 6E.26**

- [x] 4. Implement filter token display
  - [x] 4.1 Update filter token display for role filter
    - Ensure role filter tokens display human-readable role names
    - When multiple roles selected, display as comma-separated list: "Role = Tutor, Teacher"
    - Maintain one-to-one mapping between property and token
    - _Requirements: 6E.16, 6E.17_

  - [x] 4.2 Update filter token display for age cohort filter
    - Ensure age cohort filter tokens display human-readable cohort names
    - When multiple cohorts selected, display as comma-separated list: "Age Cohort = Youth, Young Adult"
    - Maintain one-to-one mapping between property and token
    - _Requirements: 6E.18, 6E.19_

  - [ ]* 4.3 Write unit tests for filter token display
    - Test role token displays role names not UUIDs
    - Test multiple roles in single token
    - Test age cohort token displays cohort names
    - Test multiple cohorts in single token
    - **Validates: Requirements 6E.16, 6E.17, 6E.18, 6E.19**

- [x] 5. Implement URL synchronization for new filters
  - [x] 5.1 Update URL persistence logic
    - In syncFiltersToURL() function, handle role filter
    - Persist roleIds as comma-separated UUIDs: ?filter_roleIds=uuid1,uuid2
    - In syncFiltersToURL() function, handle age cohort filter
    - Persist ageCohorts as comma-separated names: ?filter_ageCohorts=Youth,Young+Adult
    - URL-encode cohort names with spaces
    - _Requirements: 6E.20_

  - [x] 5.2 Update URL restoration logic
    - In restoreFiltersFromURL() function, handle role filter
    - Extract roleIds from URL parameter
    - Fetch role names using RoleService.getRolesByIds()
    - Create filter token with UUIDs as value and names as displayValue
    - In restoreFiltersFromURL() function, handle age cohort filter
    - Extract ageCohorts from URL parameter
    - Decode URL-encoded cohort names
    - Create filter token with cohort names as both value and displayValue
    - _Requirements: 6E.21_

  - [x] 5.3 Integrate with FilterGroupingPanel URL initialization
    - Ensure new filters participate in URL filter resolution flow
    - Wait for role names to be fetched before triggering initial marker fetch
    - Age cohort filter resolves immediately (no async loading)
    - Display loading indicator while resolving filters from URL
    - After resolution, automatically trigger marker fetch with resolved filters
    - _Requirements: 6E.21_

  - [ ]* 5.4 Write unit tests for URL synchronization
    - Test role filter persists to URL correctly
    - Test age cohort filter persists to URL correctly
    - Test role filter restores from URL correctly
    - Test age cohort filter restores from URL correctly
    - Test URL restoration fetches role names for display
    - Test URL-encoded cohort names are decoded correctly
    - **Validates: Requirements 6E.20, 6E.21**

- [x] 6. Update MapDataService to pass new filters
  - [x] 6.1 Update getActivityMarkers method signature
    - Add roleIds?: string[] to MapFilters interface
    - Add ageCohorts?: string[] to MapFilters interface
    - _Requirements: 6E.22, 6E.23_

  - [x] 6.2 Update getParticipantHomeMarkers method signature
    - Add roleIds?: string[] to MapFilters interface
    - Add ageCohorts?: string[] to MapFilters interface
    - _Requirements: 6E.24, 6E.25_

  - [x] 6.3 Update getVenueMarkers method signature
    - Add roleIds?: string[] to MapFilters interface
    - Add ageCohorts?: string[] to MapFilters interface
    - Note: These will be ignored by the method
    - _Requirements: 6E.26_

  - [x] 6.4 Update API request building in all methods
    - When roleIds present, add to URLSearchParams as filter[roleIds]
    - When ageCohorts present, add to URLSearchParams as filter[ageCohorts]
    - Ensure parameters are formatted correctly
    - _Requirements: 6E.22, 6E.23, 6E.24, 6E.25, 6E.27, 6E.28_

  - [ ]* 6.5 Write unit tests for MapDataService
    - Test getActivityMarkers includes roleIds in API request
    - Test getActivityMarkers includes ageCohorts in API request
    - Test getParticipantHomeMarkers includes roleIds in API request
    - Test getParticipantHomeMarkers includes ageCohorts in API request
    - Test getVenueMarkers accepts but doesn't use roleIds
    - Test getVenueMarkers accepts but doesn't use ageCohorts
    - **Validates: Requirements 6E.22, 6E.23, 6E.24, 6E.25, 6E.26**

- [x] 7. Update MapView component
  - [x] 7.1 Update filter state management
    - Ensure component state includes role and age cohort filters
    - Update handleFilterUpdate callback to process new filter types
    - Extract role IDs and age cohorts from FilterGroupingState
    - Pass to MapDataService methods
    - _Requirements: 6E.9, 6E.10, 6E.11, 6E.12, 6E.13_

  - [x] 7.2 Update marker refetch logic
    - When role filter changes, refetch markers for current mode
    - When age cohort filter changes, refetch markers for current mode
    - When mode changes, apply role and age cohort filters if mode supports them
    - Maintain existing refetch behavior for other filter changes
    - _Requirements: 6E.9, 6E.10, 6E.11, 6E.12, 6E.13, 6E.15_

  - [x] 7.3 Update filter clearing logic
    - Ensure "Clear All" button clears role filter
    - Ensure "Clear All" button clears age cohort filter
    - Ensure individual filter tokens can be removed independently
    - _Requirements: 6E.20, 6E.21_

  - [ ]* 7.4 Write component tests for MapView
    - Test role filter integration with FilterGroupingPanel
    - Test age cohort filter integration with FilterGroupingPanel
    - Test filter state updates correctly
    - Test marker refetch when filters change
    - Test filter clearing works correctly
    - Test mode switching preserves filters
    - **Validates: Requirements 6E.9, 6E.10, 6E.11, 6E.12, 6E.13, 6E.14, 6E.15**

- [x] 8. Implement combined filter logic
  - [x] 8.1 Test role + age cohort combination
    - Verify both filters can be applied simultaneously
    - Verify AND logic is applied across filter dimensions
    - Verify results include only markers matching BOTH criteria
    - _Requirements: 6E.9, 6E.10, 6E.11, 6E.12_

  - [x] 8.2 Test role + existing filters combination
    - Test role filter + population filter
    - Test role filter + activity type filter
    - Test role filter + date range filter
    - Verify AND logic across all dimensions
    - _Requirements: 6E.9, 6E.10_

  - [x] 8.3 Test age cohort + existing filters combination
    - Test age cohort filter + population filter
    - Test age cohort filter + activity type filter
    - Test age cohort filter + date range filter (reference date calculation)
    - Verify AND logic across all dimensions
    - _Requirements: 6E.10, 6E.11, 6E.12_

  - [ ]* 8.4 Write integration tests for combined filtering
    - Test role + age cohort + population filters together
    - Test all filter combinations apply correct logic
    - Test OR logic within dimensions (multiple roles, multiple cohorts)
    - Test AND logic across dimensions
    - Test mode-specific application (ignored in Venues mode)
    - **Validates: Requirements 6E.9, 6E.10, 6E.11, 6E.12, 6E.13, 6E.14, 6E.15**

- [x] 9. Add error handling and validation
  - [x] 9.1 Handle backend validation errors
    - Display validation errors from backend (400 responses)
    - Show user-friendly error messages in CloudScape Alert
    - Highlight problematic filter tokens
    - Provide guidance on how to fix errors
    - _Requirements: 6E.82, 6E.83_

  - [x] 9.2 Handle empty results
    - Display empty state message when no markers match filters
    - Suggest adjusting or clearing filters
    - Show current filter state for context
    - Keep map interactive
    - _Requirements: 6E.82, 6E.83_

  - [x] 9.3 Handle API errors
    - Display error alert when API request fails
    - Provide retry button
    - Log errors to console for debugging
    - Maintain previous markers if available (graceful degradation)
    - _Requirements: 6E.82, 6E.83_

  - [ ]* 9.4 Write tests for error handling
    - Test validation error display
    - Test empty results display
    - Test API error handling and retry
    - **Validates: Requirements 6E.82, 6E.83**

- [x] 10. Update documentation and examples
  - [x] 10.1 Add inline help text
    - Add help text for Role filter explaining it filters by roles performed in activities
    - Add help text for Age Cohort filter explaining it filters by participant age groups
    - Add note about reference date calculation for age cohorts
    - Use CloudScape Popover or info icons for help text
    - _Requirements: 6E.1, 6E.2_

  - [x] 10.2 Update component documentation
    - Document new filter properties in MapView component
    - Document filter token format for role and age cohort
    - Document URL parameter format
    - Document mode-specific filter application logic
    - Add usage examples
    - Explain reference date calculation and its impact
    - _Requirements: 6E.20, 6E.21_

- [ ] 11. Write property tests for filtering UI
  - [ ]* 11.1 Write property tests for role filtering
    - **Property 388: Role Filter Property Configuration on Map View**
    - **Property 389: Role Filter Lazy Loading on Map View**
    - **Property 390: Role Filter Token Display on Map View**
    - **Property 391: Role Filter URL Synchronization on Map View**
    - **Property 392: Role Filter Mode-Specific Application**
    - **Property 393: Role Filter Ignored in Venues Mode**
    - **Validates: Requirements 6E.1, 6E.3, 6E.4, 6E.5, 6E.7, 6E.8, 6E.9, 6E.13, 6E.14, 6E.16, 6E.17, 6E.20, 6E.21, 6E.22, 6E.26**

  - [ ]* 11.2 Write property tests for age cohort filtering
    - **Property 394: Age Cohort Filter Property Configuration on Map View**
    - **Property 395: Age Cohort Filter Predefined Options**
    - **Property 396: Age Cohort Filter Token Display on Map View**
    - **Property 397: Age Cohort Filter URL Synchronization on Map View**
    - **Property 398: Age Cohort Filter Mode-Specific Application**
    - **Property 399: Age Cohort Filter Ignored in Venues Mode**
    - **Property 400: Age Cohort Filter with Date Range (Reference Date)**
    - **Validates: Requirements 6E.2, 6E.6, 6E.7, 6E.8, 6E.10, 6E.11, 6E.12, 6E.13, 6E.14, 6E.18, 6E.19, 6E.20, 6E.21, 6E.23, 6E.25, 6E.26**

  - [ ]* 11.3 Write property tests for combined filtering
    - **Property 401: Role and Age Cohort Combined Filtering on Map**
    - **Property 402: Participant Filters with Existing Map Filters**
    - **Property 403: Filter Persistence Across Mode Changes**
    - **Property 404: Filters Reapply When Switching to Applicable Mode**
    - **Validates: Requirements 6E.9, 6E.10, 6E.11, 6E.12, 6E.13, 6E.14, 6E.15**

- [x] 12. Checkpoint - Verify frontend implementation
  - Test role filter in browser on map view
  - Test age cohort filter in browser on map view
  - Test combined filters
  - Test mode switching with active filters
  - Test URL sharing and restoration
  - Test that filters are ignored in Venues mode
  - Verify performance is acceptable
  - Ensure all tests pass
  - Ask the user if questions arise

## Implementation Notes

### Filter Property Configuration Pattern

Follow the same pattern as existing filter properties:

```typescript
// Role filter (with lazy loading)
{
  key: 'role',
  label: 'Role',
  groupValuesLabel: 'Role values',
  operators: ['='],
  loadItems: async (filterText: string) => {
    const roles = await RoleService.searchRoles(filterText);
    return roles.map(role => ({
      value: role.id,
      label: role.name,
      description: role.isPredefined ? 'Predefined' : 'Custom'
    }));
  }
}

// Age cohort filter (predefined options)
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
```

### Mode-Specific Filter Application

```typescript
// Determine which filters apply to current mode
const applyParticipantFilters = mapMode !== 'Venues';

// Apply filters conditionally
if (applyParticipantFilters) {
  if (filters.roleIds) {
    params.append('filter[roleIds]', filters.roleIds.join(','));
  }
  if (filters.ageCohorts) {
    params.append('filter[ageCohorts]', filters.ageCohorts.join(','));
  }
}
```

### URL Parameter Examples

```
# Role filter only
/map?mapMode=Activities+by+Type&filter_roleIds=uuid1,uuid2

# Age cohort filter only
/map?mapMode=Participant+Homes&filter_ageCohorts=Youth,Young+Adult

# Combined filters
/map?mapMode=Activities+by+Category&filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_populationIds=uuid3

# With date range (affects age cohort reference date)
/map?mapMode=Activities+by+Type&filter_ageCohorts=Youth&startDate=2025-01-01&endDate=2025-06-30

# In Venues mode (filters present but ignored)
/map?mapMode=Venues&filter_roleIds=uuid1&filter_ageCohorts=Youth
```

### Testing Scenarios

**Role Filter:**
- Select single role → verify correct activities/homes returned
- Select multiple roles → verify OR logic applied
- Combine with population filter → verify AND logic applied
- Switch to Venues mode → verify filter ignored
- Switch back to Activities mode → verify filter reapplies

**Age Cohort Filter:**
- Select single cohort → verify correct activities/homes returned
- Select multiple cohorts → verify OR logic applied
- Combine with date range → verify reference date affects results
- Combine with role filter → verify AND logic applied
- Switch to Venues mode → verify filter ignored

**URL Sharing:**
- Apply filters → copy URL → open in new tab → verify filters restored
- Share URL with colleague → verify they see same filtered markers
- Use browser back button → verify previous filter state restored

### Performance Expectations

- Role filter lazy loading: < 200ms
- Age cohort filter selection: Instant (no API calls)
- Filtered marker fetch: < 500ms (includes backend query and rendering)
- URL restoration: < 1s (includes fetching role names)
- Filter token display: Instant (no API calls)
- Mode switching: < 500ms (refetch markers with new mode)

### Accessibility Considerations

- Role filter dropdown is keyboard navigable
- Age cohort filter options are keyboard accessible
- Filter tokens are announced to screen readers
- Clear buttons have appropriate ARIA labels
- Loading states are announced to screen readers
- Error messages are associated with filter inputs
- Help text is accessible via keyboard and screen readers

### Reference Date Calculation (Backend Handles This)

The frontend does not need to implement reference date calculation. The backend automatically:
1. Receives the date range filter endDate (if provided)
2. Calculates reference date as minimum of (current date, activity endDate, filter endDate)
3. Converts age cohort names to date range conditions using the reference date
4. Applies the date range conditions to the query

The frontend simply passes the age cohort names and date range to the backend, and the backend handles the temporal accuracy automatically.
