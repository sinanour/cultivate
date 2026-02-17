# Implementation Plan: Participant List Role and Activity Date Filtering

## Overview

This implementation plan covers the frontend changes needed to add role and activity date range filtering to the ParticipantList page. The implementation extends the existing FilterGroupingPanel configuration with two new filter properties.

## Tasks

- [x] 1. Add RoleService search methods
  - [x] 1.1 Create searchRoles method in RoleService
    - Accept searchText parameter
    - Build query parameters with filter[name]=searchText
    - Limit results to 20 items for dropdown performance
    - Call GET /api/v1/roles endpoint
    - Return array of Role objects with id and name
    - Handle API errors gracefully
    - _Requirements: 4C.2, 4C.3, 4C.4_

  - [x] 1.2 Create getRolesByIds method in RoleService
    - Accept array of role IDs
    - Fetch all roles from GET /api/v1/roles endpoint
    - Filter to only roles matching provided IDs
    - Return array of Role objects
    - Used for URL restoration to get role names for display
    - Handle API errors gracefully
    - _Requirements: 4C.9, 4C.12_

  - [ ]* 1.3 Write unit tests for RoleService methods
    - Test searchRoles with various search texts
    - Test searchRoles handles empty results
    - Test searchRoles handles API errors
    - Test getRolesByIds returns correct roles
    - Test getRolesByIds handles non-existent IDs
    - **Validates: Requirements 4C.2, 4C.3, 4C.4, 4C.9, 4C.12**

- [x] 2. Add Role filter property to FilterGroupingPanel
  - [x] 2.1 Update ParticipantList FilterGroupingPanel configuration
    - Add new filter property object for "Role"
    - Set key: 'role', label: 'Role', groupValuesLabel: 'Role values'
    - Set operators: ['='] (only equals operator)
    - Implement loadItems callback that calls RoleService.searchRoles()
    - Transform role objects to PropertyFilter option format: { value: role.id, label: role.name }
    - Add optional description for predefined vs custom roles
    - _Requirements: 4C.1, 4C.2, 4C.3, 4C.4, 4C.5_

  - [x] 2.2 Update filter token to API parameter conversion
    - In convertTokensToFilters() function, add case for 'role' property
    - Extract role IDs from token.value (array of UUIDs)
    - Add to filters object as roleIds: string[]
    - _Requirements: 4C.6_

  - [x] 2.3 Update API request parameter building
    - In buildParticipantQueryParams() function, handle roleIds filter
    - When roleIds present, add ?filter[roleIds]=uuid1,uuid2 to query string
    - Join multiple role IDs with commas
    - _Requirements: 4C.6_

  - [x] 2.4 Update filter token display
    - Ensure role filter tokens display human-readable role names
    - When multiple roles selected, display as comma-separated list: "Role = Tutor, Teacher"
    - Maintain one-to-one mapping between property and token
    - _Requirements: 4C.9, 4C.10_

  - [ ]* 2.5 Write unit tests for role filter integration
    - Test role filter property configuration is correct
    - Test loadItems callback fetches roles correctly
    - Test filter token conversion to API parameters
    - Test token display shows role names not UUIDs
    - Test multiple roles in single token
    - **Validates: Requirements 4C.1, 4C.2, 4C.3, 4C.4, 4C.5, 4C.6, 4C.9, 4C.10**

- [x] 3. Add Activity Date Range filter property to FilterGroupingPanel
  - [x] 3.1 Create date range calculation utility
    - Create calculateAbsoluteDates(relativePeriod) function in utils
    - Accept relative period string (e.g., "-30d", "-90d", "-6m", "-1y")
    - Calculate startDate by subtracting period from current date
    - Set endDate to current date
    - Return { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
    - Handle all supported relative periods
    - _Requirements: 4C.19, 4C.20, 4C.21, 4C.22, 4C.23_

  - [x] 3.2 Update ParticipantList FilterGroupingPanel configuration
    - Add new filter property object for "Activity Date Range"
    - Set key: 'activityDateRange', label: 'Activity Date Range'
    - Set propertyType: 'date-range'
    - Set supportsRelative: true
    - Define relativeOptions array with Last 30 days, Last 90 days, Last 6 months, Last 1 year
    - Map relative options to compact format: { value: '-30d', label: 'Last 30 days' }
    - _Requirements: 4C.14, 4C.15, 4C.16, 4C.17_

  - [x] 3.3 Update filter token to API parameter conversion
    - In convertTokensToFilters() function, add case for 'activityDateRange' property
    - Check if date range is relative or absolute
    - If relative: call calculateAbsoluteDates() to get absolute dates
    - If absolute: use dates directly from token.value
    - Add activityStartDate and activityEndDate to filters object
    - _Requirements: 4C.18, 4C.19_

  - [x] 3.4 Update API request parameter building
    - In buildParticipantQueryParams() function, handle activity date range filter
    - When activityStartDate present, add ?filter[activityStartDate]=YYYY-MM-DD
    - When activityEndDate present, add ?filter[activityEndDate]=YYYY-MM-DD
    - Format dates as ISO-8601 strings (YYYY-MM-DD)
    - _Requirements: 4C.18_

  - [x] 3.5 Update filter token display
    - For absolute date ranges, display as "2025-01-01 to 2025-12-31"
    - For relative date ranges, display as "Last 90 days"
    - Format dates in user-friendly format
    - _Requirements: 4C.24, 4C.25, 4C.26_

  - [ ]* 3.6 Write unit tests for activity date range filter
    - Test calculateAbsoluteDates for all relative periods
    - Test date range filter property configuration
    - Test filter token conversion for absolute dates
    - Test filter token conversion for relative dates
    - Test API parameter building for date ranges
    - Test token display for absolute and relative ranges
    - **Validates: Requirements 4C.14, 4C.15, 4C.16, 4C.17, 4C.18, 4C.19, 4C.20, 4C.21, 4C.22, 4C.23, 4C.24, 4C.25, 4C.26**

- [x] 4. Implement URL synchronization for new filters
  - [x] 4.1 Update URL persistence logic
    - In syncFiltersToURL() function, handle role filter
    - Persist roleIds as comma-separated UUIDs: ?filter_roleIds=uuid1,uuid2
    - In syncFiltersToURL() function, handle activity date range filter
    - For relative ranges: persist as ?filter_activityDateRange=-90d
    - For absolute ranges: persist as ?filter_activityStartDate=YYYY-MM-DD&filter_activityEndDate=YYYY-MM-DD
    - _Requirements: 4C.11, 4C.27, 4C.28, 4C.29_

  - [x] 4.2 Update URL restoration logic
    - In restoreFiltersFromURL() function, handle role filter
    - Extract roleIds from URL parameter
    - Fetch role names using RoleService.getRolesByIds()
    - Create filter token with UUIDs as value and names as displayValue
    - In restoreFiltersFromURL() function, handle activity date range filter
    - Check for relative period parameter first
    - If not found, check for absolute date parameters
    - Create appropriate filter token with correct type and display value
    - _Requirements: 4C.12, 4C.30_

  - [x] 4.3 Integrate with FilterGroupingPanel URL initialization
    - Ensure new filters participate in URL filter resolution flow
    - Wait for role names to be fetched before triggering initial data fetch
    - Display loading indicator while resolving filters from URL
    - After resolution, automatically trigger data fetch with resolved filters
    - _Requirements: 4C.12, 4C.30_

  - [ ]* 4.4 Write unit tests for URL synchronization
    - Test role filter persists to URL correctly
    - Test absolute date range persists to URL correctly
    - Test relative date range persists to URL correctly
    - Test role filter restores from URL correctly
    - Test absolute date range restores from URL correctly
    - Test relative date range restores from URL correctly
    - Test URL restoration fetches role names for display
    - **Validates: Requirements 4C.11, 4C.12, 4C.27, 4C.28, 4C.29, 4C.30**

- [x] 5. Update ParticipantService to handle new filters
  - [x] 5.1 Update getParticipants method signature
    - Add roleIds?: string[] to ParticipantFilters interface
    - Add activityStartDate?: string to ParticipantFilters interface
    - Add activityEndDate?: string to ParticipantFilters interface
    - _Requirements: 4C.6, 4C.18_

  - [x] 5.2 Update API request building
    - When roleIds present, add to URLSearchParams as filter[roleIds]
    - When activityStartDate present, add to URLSearchParams as filter[activityStartDate]
    - When activityEndDate present, add to URLSearchParams as filter[activityEndDate]
    - Ensure dates are formatted as ISO-8601 strings (YYYY-MM-DD)
    - _Requirements: 4C.6, 4C.18_

  - [ ]* 5.3 Write unit tests for ParticipantService
    - Test getParticipants includes roleIds in API request
    - Test getParticipants includes activity date range in API request
    - Test getParticipants combines new filters with existing filters
    - Test API request URL is formatted correctly
    - **Validates: Requirements 4C.6, 4C.18**

- [x] 6. Update ParticipantList component
  - [x] 6.1 Update filter state management
    - Ensure component state includes role and activity date range filters
    - Update handleFilterUpdate callback to process new filter types
    - Extract role IDs and activity dates from FilterGroupingState
    - Pass to ParticipantService.getParticipants()
    - _Requirements: 4C.6, 4C.13, 4C.31_

  - [x] 6.2 Update pagination reset logic
    - When role filter changes, reset to page 1
    - When activity date range filter changes, reset to page 1
    - Maintain existing pagination reset behavior for other filters
    - _Requirements: 4C.37_

  - [x] 6.3 Update filter clearing logic
    - Ensure "Clear All" button clears role filter
    - Ensure "Clear All" button clears activity date range filter
    - Ensure individual filter tokens can be removed independently
    - _Requirements: 4C.35, 4C.36_

  - [ ]* 6.4 Write component tests for ParticipantList
    - Test role filter integration with FilterGroupingPanel
    - Test activity date range filter integration
    - Test filter state updates correctly
    - Test pagination resets when filters change
    - Test filter clearing works correctly
    - **Validates: Requirements 4C.6, 4C.13, 4C.31, 4C.35, 4C.36, 4C.37**

- [x] 7. Implement combined filter logic
  - [x] 7.1 Test role + date range combination
    - Verify both filters can be applied simultaneously
    - Verify AND logic is applied across filter dimensions
    - Verify results include only participants matching BOTH criteria
    - _Requirements: 4C.33, 4C.34_

  - [x] 7.2 Test role + existing filters combination
    - Test role filter + population filter
    - Test role filter + age cohort filter
    - Test role filter + name search
    - Verify AND logic across all dimensions
    - _Requirements: 4C.8, 4C.34_

  - [x] 7.3 Test date range + existing filters combination
    - Test activity date range + population filter
    - Test activity date range + age cohort filter
    - Test activity date range + name search
    - Verify AND logic across all dimensions
    - _Requirements: 4C.32, 4C.34_

  - [ ]* 7.4 Write integration tests for combined filtering
    - Test role + date range + population filters together
    - Test all filter combinations apply correct logic
    - Test OR logic within dimensions (multiple roles, multiple populations)
    - Test AND logic across dimensions
    - **Validates: Requirements 4C.7, 4C.8, 4C.32, 4C.33, 4C.34**

- [x] 8. Add error handling and validation
  - [x] 8.1 Handle backend validation errors
    - Display validation errors from backend (400 responses)
    - Show user-friendly error messages in CloudScape Alert
    - Highlight problematic filter tokens
    - Provide guidance on how to fix errors
    - _Requirements: 4C.58, 4C.59_

  - [x] 8.2 Handle empty results
    - Display empty state message when no participants match filters
    - Suggest adjusting or clearing filters
    - Show current filter state for context
    - _Requirements: 4C.13, 4C.31_

  - [x] 8.3 Handle API errors
    - Display error alert when API request fails
    - Provide retry button
    - Log errors to console for debugging
    - Maintain previous results if available (graceful degradation)
    - _Requirements: 4C.58, 4C.59_

  - [ ]* 8.4 Write tests for error handling
    - Test validation error display
    - Test empty results display
    - Test API error handling and retry
    - **Validates: Requirements 4C.58, 4C.59**

- [x] 9. Update documentation and examples
  - [x] 9.1 Add inline help text
    - Add help text for Role filter explaining it filters by roles performed in activities
    - Add help text for Activity Date Range filter explaining it filters by participation dates
    - Use CloudScape Popover or info icons for help text
    - _Requirements: 4C.1, 4C.14_

  - [x] 9.2 Update component documentation
    - Document new filter properties in ParticipantList component
    - Document filter token format for role and date range
    - Document URL parameter format
    - Add usage examples
    - _Requirements: 4C.11, 4C.12, 4C.27, 4C.28, 4C.29, 4C.30_

- [ ] 10. Write property tests for filtering UI
  - [ ]* 10.1 Write property tests for role filtering
    - **Property 358: Role Filter Property Configuration**
    - **Property 359: Role Filter Lazy Loading**
    - **Property 360: Role Filter Token Display**
    - **Property 361: Role Filter URL Synchronization**
    - **Property 362: Role Filter OR Logic Within Dimension**
    - **Property 363: Role Filter AND Logic Across Dimensions**
    - **Validates: Requirements 4C.1, 4C.2, 4C.3, 4C.4, 4C.5, 4C.6, 4C.7, 4C.8, 4C.9, 4C.10, 4C.11, 4C.12**

  - [ ]* 10.2 Write property tests for activity date range filtering
    - **Property 364: Activity Date Range Property Configuration**
    - **Property 365: Activity Date Range Absolute Selection**
    - **Property 366: Activity Date Range Relative Selection**
    - **Property 367: Activity Date Range Calculation**
    - **Property 368: Activity Date Range Token Display**
    - **Property 369: Activity Date Range URL Synchronization**
    - **Property 370: Activity Date Range AND Logic Across Dimensions**
    - **Validates: Requirements 4C.14, 4C.15, 4C.16, 4C.17, 4C.18, 4C.19, 4C.20, 4C.21, 4C.22, 4C.23, 4C.24, 4C.25, 4C.26, 4C.27, 4C.28, 4C.29, 4C.30, 4C.31, 4C.32**

  - [ ]* 10.3 Write property tests for combined filtering
    - **Property 371: Role and Date Range Combined Filtering**
    - **Property 372: Assignment-Based Filters with Existing Filters**
    - **Property 373: Filter Clearing Independence**
    - **Property 374: Pagination Reset on Filter Change**
    - **Validates: Requirements 4C.33, 4C.34, 4C.35, 4C.36, 4C.37**

- [x] 11. Checkpoint - Verify frontend implementation
  - Test role filter in browser
  - Test activity date range filter with absolute dates
  - Test activity date range filter with relative dates
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
// Example: Role filter property
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
```

### Date Range Calculation Examples

```typescript
// Last 30 days
const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() - 30);
// startDate: 2026-01-17, endDate: 2026-02-16

// Last 6 months
const today = new Date();
const startDate = new Date(today);
startDate.setMonth(today.getMonth() - 6);
// startDate: 2025-08-16, endDate: 2026-02-16

// Last 1 year
const today = new Date();
const startDate = new Date(today);
startDate.setFullYear(today.getFullYear() - 1);
// startDate: 2025-02-16, endDate: 2026-02-16
```

### URL Parameter Examples

```
# Role filter only
/participants?filter_roleIds=uuid1,uuid2

# Absolute activity date range only
/participants?filter_activityStartDate=2025-01-01&filter_activityEndDate=2025-12-31

# Relative activity date range only
/participants?filter_activityDateRange=-90d

# Combined filters
/participants?filter_roleIds=uuid1&filter_activityDateRange=-90d&filter_populationIds=uuid3

# With pagination
/participants?filter_roleIds=uuid1&filter_activityDateRange=-90d&page=2&limit=100
```

### Testing Scenarios

**Role Filter:**
- Select single role → verify correct participants returned
- Select multiple roles → verify OR logic applied
- Combine with population filter → verify AND logic applied
- Clear role filter → verify all participants returned

**Activity Date Range Filter:**
- Select "Last 30 days" → verify only recent participants returned
- Select "Last 1 year" → verify broader set returned
- Select absolute range → verify exact date range applied
- Combine with role filter → verify AND logic applied

**URL Sharing:**
- Apply filters → copy URL → open in new tab → verify filters restored
- Share URL with colleague → verify they see same filtered results
- Use browser back button → verify previous filter state restored

### Performance Expectations

- Role filter lazy loading: < 200ms
- Activity date range calculation: < 10ms (client-side)
- Filtered participant list fetch: < 500ms (includes backend query)
- URL restoration: < 1s (includes fetching role names)
- Filter token display: Instant (no API calls)

### Accessibility Considerations

- Role filter dropdown is keyboard navigable
- Activity date range picker is keyboard accessible
- Filter tokens are announced to screen readers
- Clear buttons have appropriate ARIA labels
- Loading states are announced to screen readers
- Error messages are associated with filter inputs
