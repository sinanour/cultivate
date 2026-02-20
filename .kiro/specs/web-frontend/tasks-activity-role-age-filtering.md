# Implementation Plan: Activity List Role and Age Cohort Filtering

## Overview

This implementation plan covers the frontend changes needed to add role and age cohort filtering to the ActivityList page. The implementation extends the existing FilterGroupingPanel configuration with two new filter properties.

## Tasks

- [x] 1. Add Role filter property to ActivityList FilterGroupingPanel
  - [x] 1.1 Update ActivityList FilterGroupingPanel configuration
    - Add new filter property object for "Role"
    - Set key: 'role', label: 'Role', groupValuesLabel: 'Role values'
    - Set operators: ['='] (only equals operator)
    - Implement loadItems callback that calls RoleService.searchRoles()
    - Transform role objects to PropertyFilter option format: { value: role.id, label: role.name }
    - Add optional description for predefined vs custom roles
    - _Requirements: 5E.1, 5E.3, 5E.4, 5E.5, 5E.7, 5E.8_

  - [x] 1.2 Verify role filter remains enabled at all times
    - Ensure role filter property is not conditionally hidden
    - Verify filter remains visible regardless of other filter selections
    - Test that filter selection persists when other filters change
    - _Requirements: 5E.7, 5E.8_

  - [ ]* 1.3 Write unit tests for role filter property configuration
    - Test role filter property is correctly configured
    - Test loadItems callback fetches roles correctly
    - Test filter remains enabled at all times
    - **Validates: Requirements 5E.1, 5E.3, 5E.4, 5E.5, 5E.7, 5E.8**

- [x] 2. Add Age Cohort filter property to ActivityList FilterGroupingPanel
  - [x] 2.1 Update ActivityList FilterGroupingPanel configuration
    - Add new filter property object for "Age Cohort"
    - Set key: 'ageCohort', label: 'Age Cohort', groupValuesLabel: 'Age Cohort values'
    - Set operators: ['='] (only equals operator)
    - Set propertyType: 'enum'
    - Define options array with all six cohorts: Child, Junior Youth, Youth, Young Adult, Adult, Unknown
    - No loadItems callback needed (predefined options)
    - _Requirements: 5E.2, 5E.6, 5E.7, 5E.8_

  - [x] 2.2 Verify age cohort filter remains enabled at all times
    - Ensure age cohort filter property is not conditionally hidden
    - Verify filter remains visible regardless of other filter selections
    - Test that filter selection persists when other filters change
    - _Requirements: 5E.7, 5E.8_

  - [ ]* 2.3 Write unit tests for age cohort filter property configuration
    - Test age cohort filter property is correctly configured
    - Test all six cohort options are available
    - Test filter remains enabled at all times
    - **Validates: Requirements 5E.2, 5E.6, 5E.7, 5E.8**

- [x] 3. Implement filter token to API parameter conversion
  - [x] 3.1 Update convertTokensToFilters function
    - Add case for 'role' property key
    - Extract role IDs from token.value (array of UUIDs)
    - Add to filters object as roleIds: string[]
    - Add case for 'ageCohort' property key
    - Extract cohort names from token.value (array of strings)
    - Add to filters object as ageCohorts: string[]
    - _Requirements: 5E.9, 5E.11, 5E.13_

  - [x] 3.2 Update buildActivityQueryParams function
    - Handle roleIds filter parameter
    - When roleIds present, add ?filter[roleIds]=uuid1,uuid2
    - Handle ageCohorts filter parameter
    - When ageCohorts present, add ?filter[ageCohorts]=cohort1,cohort2
    - Join multiple role IDs with commas
    - Join multiple cohort names with commas
    - _Requirements: 5E.22, 5E.23, 5E.24, 5E.25, 5E.26_

  - [ ]* 3.3 Write unit tests for filter conversion
    - Test role filter converts to correct API parameters
    - Test age cohort filter converts to correct API parameters
    - Test multiple roles join with commas
    - Test multiple cohorts join with commas
    - Test combined filters generate correct query string
    - **Validates: Requirements 5E.9, 5E.11, 5E.13, 5E.22, 5E.23, 5E.24, 5E.25, 5E.26**

- [x] 4. Implement filter token display
  - [x] 4.1 Update filter token display for role filter
    - Ensure role filter tokens display human-readable role names
    - When multiple roles selected, display as comma-separated list: "Role = Tutor, Teacher"
    - Maintain one-to-one mapping between property and token
    - _Requirements: 5E.16, 5E.17_

  - [x] 4.2 Update filter token display for age cohort filter
    - Ensure age cohort filter tokens display human-readable cohort names
    - When multiple cohorts selected, display as comma-separated list: "Age Cohort = Youth, Young Adult"
    - Maintain one-to-one mapping between property and token
    - _Requirements: 5E.18, 5E.19_

  - [ ]* 4.3 Write unit tests for filter token display
    - Test role token displays role names not UUIDs
    - Test multiple roles in single token
    - Test age cohort token displays cohort names
    - Test multiple cohorts in single token
    - **Validates: Requirements 5E.16, 5E.17, 5E.18, 5E.19**

- [x] 5. Implement URL synchronization for new filters
  - [x] 5.1 Update URL persistence logic
    - In syncFiltersToURL() function, handle role filter
    - Persist roleIds as comma-separated UUIDs: ?filter_roleIds=uuid1,uuid2
    - In syncFiltersToURL() function, handle age cohort filter
    - Persist ageCohorts as comma-separated names: ?filter_ageCohorts=Youth,Young+Adult
    - URL-encode cohort names with spaces
    - _Requirements: 5E.20_

  - [x] 5.2 Update URL restoration logic
    - In restoreFiltersFromURL() function, handle role filter
    - Extract roleIds from URL parameter
    - Fetch role names using RoleService.getRolesByIds()
    - Create filter token with UUIDs as value and names as displayValue
    - In restoreFiltersFromURL() function, handle age cohort filter
    - Extract ageCohorts from URL parameter
    - Decode URL-encoded cohort names
    - Create filter token with cohort names as both value and displayValue
    - _Requirements: 5E.21_

  - [x] 5.3 Integrate with FilterGroupingPanel URL initialization
    - Ensure new filters participate in URL filter resolution flow
    - Wait for role names to be fetched before triggering initial activity fetch
    - Age cohort filter resolves immediately (no async loading)
    - Display loading indicator while resolving filters from URL
    - After resolution, automatically trigger activity fetch with resolved filters
    - _Requirements: 5E.21_

  - [ ]* 5.4 Write unit tests for URL synchronization
    - Test role filter persists to URL correctly
    - Test age cohort filter persists to URL correctly
    - Test role filter restores from URL correctly
    - Test age cohort filter restores from URL correctly
    - Test URL restoration fetches role names for display
    - Test URL-encoded cohort names are decoded correctly
    - **Validates: Requirements 5E.20, 5E.21**

- [x] 6. Update ActivityService to handle new filters
  - [x] 6.1 Update getActivities method signature
    - Add roleIds?: string[] to ActivityFilters interface
    - Add ageCohorts?: string[] to ActivityFilters interface
    - _Requirements: 5E.9, 5E.11_

  - [x] 6.2 Update API request building
    - When roleIds present, add to URLSearchParams as filter[roleIds]
    - When ageCohorts present, add to URLSearchParams as filter[ageCohorts]
    - Ensure parameters are formatted correctly
    - _Requirements: 5E.22, 5E.23_

  - [ ]* 6.3 Write unit tests for ActivityService
    - Test getActivities includes roleIds in API request
    - Test getActivities includes ageCohorts in API request
    - Test getActivities combines new filters with existing filters
    - Test API request URL is formatted correctly
    - **Validates: Requirements 5E.9, 5E.11, 5E.22, 5E.23**

- [x] 7. Update ActivityList component
  - [x] 7.1 Update filter state management
    - Ensure component state includes role and age cohort filters
    - Update handleFilterUpdate callback to process new filter types
    - Extract role IDs and age cohorts from FilterGroupingState
    - Pass to ActivityService.getActivities()
    - _Requirements: 5E.9, 5E.11, 5E.13, 5E.14, 5E.15_

  - [x] 7.2 Update pagination reset logic
    - When role filter changes, reset to page 1
    - When age cohort filter changes, reset to page 1
    - Maintain existing pagination reset behavior for other filters
    - _Requirements: 5E.52_

  - [x] 7.3 Update filter clearing logic
    - Ensure "Clear All" button clears role filter
    - Ensure "Clear All" button clears age cohort filter
    - Ensure individual filter tokens can be removed independently
    - _Requirements: 5E.50, 5E.51_

  - [ ]* 7.4 Write component tests for ActivityList
    - Test role filter integration with FilterGroupingPanel
    - Test age cohort filter integration
    - Test filter state updates correctly
    - Test pagination resets when filters change
    - Test filter clearing works correctly
    - **Validates: Requirements 5E.9, 5E.11, 5E.13, 5E.14, 5E.15, 5E.50, 5E.51, 5E.52**

- [x] 8. Implement combined filter logic
  - [x] 8.1 Test role + age cohort combination
    - Verify both filters can be applied simultaneously
    - Verify AND logic is applied across filter dimensions
    - Verify results include only activities matching BOTH criteria
    - _Requirements: 5E.13, 5E.14, 5E.49_

  - [x] 8.2 Test role + existing filters combination
    - Test role filter + population filter
    - Test role filter + activity type filter
    - Test role filter + date range filter
    - Verify AND logic across all dimensions
    - _Requirements: 5E.14, 5E.49_

  - [x] 8.3 Test age cohort + existing filters combination
    - Test age cohort filter + population filter
    - Test age cohort filter + activity type filter
    - Test age cohort filter + date range filter (reference date calculation)
    - Verify AND logic across all dimensions
    - _Requirements: 5E.14, 5E.49_

  - [ ]* 8.4 Write integration tests for combined filtering
    - Test role + age cohort + population filters together
    - Test all filter combinations apply correct logic
    - Test OR logic within dimensions (multiple roles, multiple cohorts)
    - Test AND logic across dimensions
    - **Validates: Requirements 5E.10, 5E.12, 5E.13, 5E.14, 5E.49**

- [x] 9. Add error handling and validation
  - [x] 9.1 Handle backend validation errors
    - Display validation errors from backend (400 responses)
    - Show user-friendly error messages in CloudScape Alert
    - Highlight problematic filter tokens
    - Provide guidance on how to fix errors
    - _Requirements: 5E.47, 5E.48_

  - [x] 9.2 Handle empty results
    - Display empty state message when no activities match filters
    - Suggest adjusting or clearing filters
    - Show current filter state for context
    - _Requirements: 5E.15_

  - [x] 9.3 Handle API errors
    - Display error alert when API request fails
    - Provide retry button
    - Log errors to console for debugging
    - Maintain previous results if available (graceful degradation)
    - _Requirements: 5E.47, 5E.48_

  - [ ]* 9.4 Write tests for error handling
    - Test validation error display
    - Test empty results display
    - Test API error handling and retry
    - **Validates: Requirements 5E.47, 5E.48**

- [x] 10. Update documentation and examples
  - [x] 10.1 Add inline help text
    - Add help text for Role filter explaining it filters by roles performed in activities
    - Add help text for Age Cohort filter explaining it filters by participant age groups
    - Add note about reference date calculation for age cohorts
    - Use CloudScape Popover or info icons for help text
    - _Requirements: 5E.1, 5E.2_

  - [x] 10.2 Update component documentation
    - Document new filter properties in ActivityList component
    - Document filter token format for role and age cohort
    - Document URL parameter format
    - Add usage examples
    - Explain reference date calculation and its impact
    - _Requirements: 5E.20, 5E.21_

- [ ] 11. Write property tests for filtering UI
  - [ ]* 11.1 Write property tests for role filtering
    - **Property 417: Role Filter Property Configuration on Activity List**
    - **Property 418: Role Filter Lazy Loading on Activity List**
    - **Property 419: Role Filter Token Display on Activity List**
    - **Property 420: Role Filter URL Synchronization on Activity List**
    - **Property 421: Role Filter OR Logic Within Dimension**
    - **Property 422: Role Filter AND Logic Across Dimensions**
    - **Validates: Requirements 5E.1, 5E.3, 5E.4, 5E.5, 5E.7, 5E.8, 5E.9, 5E.10, 5E.14, 5E.16, 5E.17, 5E.20, 5E.21, 5E.22**

  - [ ]* 11.2 Write property tests for age cohort filtering
    - **Property 423: Age Cohort Filter Property Configuration on Activity List**
    - **Property 424: Age Cohort Filter Predefined Options**
    - **Property 425: Age Cohort Filter Token Display on Activity List**
    - **Property 426: Age Cohort Filter URL Synchronization on Activity List**
    - **Property 427: Age Cohort Filter OR Logic Within Dimension**
    - **Property 428: Age Cohort Filter AND Logic Across Dimensions**
    - **Property 429: Age Cohort Filter with Date Range (Reference Date)**
    - **Validates: Requirements 5E.2, 5E.6, 5E.7, 5E.8, 5E.11, 5E.12, 5E.14, 5E.18, 5E.19, 5E.20, 5E.21, 5E.23**

  - [ ]* 11.3 Write property tests for combined filtering
    - **Property 430: Role and Age Cohort Combined Filtering on Activity List**
    - **Property 431: Participant Filters with Existing Activity Filters**
    - **Property 432: Filter Clearing Independence**
    - **Property 433: Pagination Reset on Filter Change**
    - **Validates: Requirements 5E.13, 5E.14, 5E.49, 5E.50, 5E.51, 5E.52**

- [x] 12. Checkpoint - Verify frontend implementation
  - Test role filter in browser on activity list
  - Test age cohort filter in browser on activity list
  - Test combined filters
  - Test URL sharing and restoration
  - Test pagination with filters
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

### URL Parameter Examples

```
# Role filter only
/activities?filter_roleIds=uuid1,uuid2

# Age cohort filter only
/activities?filter_ageCohorts=Youth,Young+Adult

# Combined filters
/activities?filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_activityTypeIds=uuid3&filter_populationIds=uuid4

# With date range (affects age cohort reference date)
/activities?filter_roleIds=uuid1&filter_ageCohorts=Youth&filter_startDate=2025-01-01&filter_endDate=2025-06-30

# With pagination
/activities?filter_roleIds=uuid1&filter_ageCohorts=Youth&page=2&limit=100
```

### Testing Scenarios

**Role Filter:**
- Select single role → verify correct activities returned
- Select multiple roles → verify OR logic applied
- Combine with population filter → verify AND logic applied
- Clear role filter → verify all activities returned

**Age Cohort Filter:**
- Select single cohort → verify correct activities returned
- Select multiple cohorts → verify OR logic applied
- Combine with date range → verify reference date affects results
- Combine with role filter → verify AND logic applied

**URL Sharing:**
- Apply filters → copy URL → open in new tab → verify filters restored
- Share URL with colleague → verify they see same filtered activities
- Use browser back button → verify previous filter state restored

### Performance Expectations

- Role filter lazy loading: < 200ms
- Age cohort filter selection: Instant (no API calls)
- Filtered activity list fetch: < 500ms (includes backend query and rendering)
- URL restoration: < 1s (includes fetching role names)
- Filter token display: Instant (no API calls)

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
