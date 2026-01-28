# Implementation Plan: Remove Redundant Authorization Checks

## Overview

This implementation plan covers the refactoring of GlobalGeographicFilterContext to remove redundant frontend authorization checks. The backend already enforces geographic authorization on all endpoints, making frontend validation unnecessary.

## Tasks

- [x] 1. Update GlobalGeographicFilterContext to remove authorization checks
  - [x] 1.1 Remove authorization-related state variables
    - Remove `authorizedAreaIds` state variable
    - Remove `hasAuthorizationRules` state variable
    - Remove `setAuthorizedAreaIds` state setter
    - Remove `setHasAuthorizationRules` state setter
    - _Requirements: 1.2, 1.12_

  - [x] 1.2 Remove authorization fetching useEffect
    - Delete the entire useEffect that calls `geographicAuthorizationService.getAuthorizedAreas(user.id)`
    - Remove the logic that extracts directly authorized area IDs
    - Remove the logic that sets `hasAuthorizationRules` based on response
    - _Requirements: 1.1, 1.13_

  - [x] 1.3 Remove isAuthorizedArea method
    - Delete the `isAuthorizedArea` function implementation
    - This method is no longer needed since we trust backend authorization
    - _Requirements: 1.4_

  - [x] 1.4 Simplify setGeographicAreaFilter method
    - Remove authorization validation check before setting filter
    - Remove the call to `isAuthorizedArea(id)` at the start of the method
    - Remove the early return when area is unauthorized
    - Remove the console.warn for unauthorized areas
    - Keep the logic for updating state, localStorage, and URL
    - _Requirements: 1.3, 1.15_

  - [x] 1.5 Simplify URL sync useEffect
    - Remove `hasAuthorizationRules` from dependency array
    - Remove the check for `hasAuthorizationRules === null` (skip condition)
    - Remove authorization validation when applying URL parameter
    - Remove the call to `isAuthorizedArea(urlGeographicAreaId)`
    - Remove the conditional logic that clears filter for unauthorized URL areas
    - Remove the console.warn for unauthorized URL areas
    - Remove authorization validation when restoring from localStorage
    - Remove the call to `isAuthorizedArea(storedId)`
    - Remove the conditional logic that clears localStorage for unauthorized areas
    - Remove the console.warn for unauthorized localStorage areas
    - Keep the logic for syncing between URL, localStorage, and state
    - _Requirements: 1.14, 1.16_

  - [x] 1.6 Update context interface
    - Remove `authorizedAreaIds: Set<string>` from GlobalGeographicFilterContextType interface
    - Remove `isAuthorizedArea: (areaId: string) => boolean` from GlobalGeographicFilterContextType interface
    - _Requirements: 1.4, 1.5_

  - [x] 1.7 Update context provider value
    - Remove `authorizedAreaIds` from the provider value object
    - Remove `isAuthorizedArea` from the provider value object
    - _Requirements: 1.4, 1.5_

  - [x] 1.8 Preserve error handling for authorization failures
    - Keep the useEffect that subscribes to `geographicFilterEvents`
    - Keep the logic that clears filter when authorization error event is received
    - This handles cases where backend returns 403 for unauthorized access
    - _Requirements: 1.8, 1.9, 1.10_

  - [x] 1.9 Remove import of geographicAuthorizationService
    - Remove the import statement for `geographicAuthorizationService` from GlobalGeographicFilterContext
    - This service is no longer used in this context
    - _Requirements: 1.1_

- [x] 2. Search for and update dependent components
  - [x] 2.1 Search for usages of authorizedAreaIds from context
    - Use grep search to find any components accessing `authorizedAreaIds` from GlobalGeographicFilterContext
    - Document any found usages
    - Update or remove those usages
    - _Requirements: 3.5_

  - [x] 2.2 Search for usages of isAuthorizedArea from context
    - Use grep search to find any components calling `isAuthorizedArea()` from GlobalGeographicFilterContext
    - Document any found usages
    - Update or remove those usages
    - _Requirements: 3.6_

- [x] 3. Verify GeographicAuthorizationManager remains functional
  - [x] 3.1 Confirm GeographicAuthorizationManager still uses getAuthorizedAreas
    - Verify that GeographicAuthorizationManager component continues to call `geographicAuthorizationService.getAuthorizedAreas(userId)`
    - Verify that the effective access summary displays correctly
    - Ensure no changes are needed to this component
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify GeographicAuthorizationService retains method
    - Confirm that `getAuthorizedAreas()` method remains in GeographicAuthorizationService class
    - Confirm that the method signature and implementation are unchanged
    - _Requirements: 2.4, 2.5_

- [x] 4. Update tests
  - [x] 4.1 Update GlobalGeographicFilterContext tests
    - Remove tests for authorization validation logic
    - Remove tests for `isAuthorizedArea()` method
    - Remove tests for `authorizedAreaIds` state
    - Update tests to verify simplified filter setting behavior
    - Add tests to verify filter is set without authorization checks
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.2 Add tests for authorization error handling
    - Verify that 403 errors trigger filter clearing
    - Verify that geographicFilterEvents subscription works correctly
    - Verify that filter reverts to "Global" on authorization error
    - _Requirements: 1.8, 1.9, 1.10_

- [x] 5. Manual testing
  - [x] 5.1 Test global filter with authorized areas
    - Log in as a user with authorization rules
    - Verify that available areas dropdown shows only authorized areas (backend filtered)
    - Verify that selecting an area sets the filter correctly
    - Verify that filter persists across page navigation
    - _Requirements: 1.6, 1.11_

  - [x] 5.2 Test global filter with unauthorized areas
    - Manually construct a URL with an unauthorized geographic area ID
    - Navigate to that URL
    - Verify that backend returns 403 error
    - Verify that filter clears automatically
    - Verify that user sees error message
    - _Requirements: 1.7, 1.8, 1.9, 1.10_

  - [x] 5.3 Test GeographicAuthorizationManager (admin)
    - Log in as an administrator
    - Navigate to user management
    - Open authorization manager for a user
    - Verify that effective access summary displays correctly
    - Verify that full access, read-only, and denied areas are shown
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 6. Documentation updates
  - [x] 6.1 Update inline code comments
    - Remove comments about frontend authorization validation
    - Add comments explaining that backend handles authorization
    - Update comments in error handling to clarify 403 handling
    - _Requirements: 1.11_

  - [x] 6.2 Update component documentation
    - Update GlobalGeographicFilterContext documentation to reflect simplified behavior
    - Document that authorization is enforced by backend
    - Document error handling for unauthorized access attempts
    - _Requirements: 1.11, 4.5, 4.6_
