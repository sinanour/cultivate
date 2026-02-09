# Implementation Plan: Technical Debt Refactoring

## Overview

This implementation plan breaks down the technical debt refactoring into incremental, testable steps. The approach follows a phased migration strategy: create new utilities and services first, then gradually migrate existing code to use them. Each phase includes testing tasks to ensure no regressions are introduced.

The refactoring is organized into three main tracks:
1. Backend constants and utilities (query parameters, pagination, authorization)
2. Shared geographic filtering service (consolidate duplicated logic)
3. Frontend UI components (confirmation dialogs and modals)

## Tasks

- [x] 1. Create backend query parameter constants
  - Add QUERY_PARAMS constant object to backend-api/src/utils/constants.ts
  - Include pagination parameters (PAGE, LIMIT)
  - Include filtering parameters (GEOGRAPHIC_AREA_ID, DEPTH, GROUP_BY, START_DATE, END_DATE, TIME_PERIOD, GRANULARITY)
  - Include sorting parameters (SORT_BY, SORT_ORDER)
  - Export QueryParamKey type alias
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 1.1 Write unit tests for query parameter constants
  - Test constants are defined and accessible
  - Test type safety of QueryParamKey
  - _Requirements: 1.1_

- [x] 2. Create pagination parsing utilities
  - [x] 2.1 Implement parseIntegerParam utility function
    - Add to backend-api/src/utils/query-params.utils.ts
    - Parse query parameter as integer with validation
    - Return { value, error } structure
    - Handle undefined, null, non-numeric values
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Implement parsePaginationParams utility function
    - Add to backend-api/src/utils/query-params.utils.ts
    - Use QUERY_PARAMS constants for parameter names
    - Parse page and limit parameters using parseIntegerParam
    - Validate page >= 1
    - Validate limit between 1 and PAGINATION.MAX_LIMIT
    - Return { pagination, errors } structure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 2.3 Write unit tests for pagination parsing
    - Test valid inputs (positive integers)
    - Test invalid inputs (negative, non-numeric, out of range)
    - Test missing inputs (undefined)
    - Test edge cases (0, MAX_LIMIT + 1)
    - _Requirements: 2.2, 2.3, 2.5_
  
  - [ ]* 2.4 Write property test for valid pagination parsing
    - **Property 1: Valid Pagination Parameters Parse Correctly**
    - **Validates: Requirements 2.2**
    - Generate random valid page and limit values
    - Verify parsing returns correct values with no errors
    - Run 100 iterations
  
  - [ ]* 2.5 Write property test for invalid pagination parsing
    - **Property 2: Invalid Pagination Parameters Return Errors**
    - **Validates: Requirements 2.3**
    - Generate random invalid values (non-numeric, negative, out of range)
    - Verify parsing returns errors
    - Run 100 iterations

- [x] 3. Create authorization context extraction utility
  - [x] 3.1 Implement extractAuthorizationContext function
    - Create backend-api/src/utils/auth.utils.ts
    - Define AuthorizationContext interface
    - Extract authorizedAreaIds, hasGeographicRestrictions, userId, userRole
    - Provide safe defaults for missing fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 3.2 Write unit tests for authorization context extraction
    - Test with full user object
    - Test with missing authorizedAreaIds
    - Test with missing hasGeographicRestrictions
    - Test with missing user object (defaults)
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [ ]* 3.3 Write property test for authorization context extraction
    - **Property 3: Authorization Context Extraction Includes All Fields**
    - **Validates: Requirements 3.2, 3.3**
    - Generate random user objects
    - Verify all required fields are present in result
    - Run 100 iterations

- [x] 4. Checkpoint - Ensure utility tests pass
  - Run all new utility tests
  - Verify no regressions in existing tests
  - Ask the user if questions arise

- [x] 5. Create shared geographic filtering service
  - [x] 5.1 Implement GeographicFilteringService class
    - Create backend-api/src/services/geographic-filtering.service.ts
    - Add constructor with GeographicAreaRepository dependency
    - Implement getEffectiveGeographicAreaIds method (single area variant)
    - Handle explicit filter validation against authorized areas
    - Handle implicit filtering with restrictions
    - Handle no filtering without restrictions
    - Expand geographic area hierarchies to include descendants
    - Throw authorization errors for denied access
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 5.2 Implement analytics variant method
    - Add getEffectiveGeographicAreaIdsForAnalytics method
    - Accept string or string[] for explicit filters
    - Normalize to array
    - Validate all areas against authorized areas
    - Expand all areas to include descendants
    - _Requirements: 4.3, 4.6_
  
  - [x] 5.3 Write unit tests for geographic filtering service
    - Test explicit filter with authorization
    - Test explicit filter without authorization
    - Test implicit filtering with restrictions
    - Test no filtering without restrictions
    - Test descendant expansion
    - Test authorization denial (throws error)
    - Test analytics variant with array input
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 5.4 Write property test for geographic filter validation
    - **Property 4: Geographic Filter Validation Enforces Authorization**
    - **Validates: Requirements 4.3**
    - Generate random filters and authorized area sets
    - Verify authorization errors when filter not in authorized set
    - Run 100 iterations
  
  - [ ]* 5.5 Write property test for hierarchy expansion
    - **Property 5: Geographic Hierarchy Expansion Includes Descendants**
    - **Validates: Requirements 4.6**
    - Generate random geographic area hierarchies
    - Verify expansion includes original area and all descendants
    - Run 100 iterations

- [x] 6. Migrate backend route handlers to use new utilities (Phase 1)
  - [x] 6.1 Update population.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [x] 6.2 Update role.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [x] 6.3 Update activity-category.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [x] 6.4 Update activity-type.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [ ]* 6.5 Run integration tests for Phase 1 routes
    - Verify all route tests pass
    - Verify API behavior unchanged
    - _Requirements: 12.4, 12.5_

- [x] 7. Migrate backend route handlers to use new utilities (Phase 2)
  - [x] 7.1 Update venue.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [x] 7.2 Update participant.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [x] 7.3 Update activity.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [x] 7.4 Update geographic-area.routes.ts
    - Replace inline pagination parsing with parsePaginationParams
    - Replace inline authorization extraction with extractAuthorizationContext
    - Use QUERY_PARAMS constants
    - _Requirements: 1.2, 2.6, 3.5_
  
  - [ ]* 7.5 Run integration tests for Phase 2 routes
    - Verify all route tests pass
    - Verify API behavior unchanged
    - _Requirements: 12.4, 12.5_

- [x] 8. Update analytics routes with new utilities and standardized parameters
  - [x] 8.1 Update analytics.routes.ts to use parsePaginationParams
    - Replace inline pagination parsing
    - Change "pageSize" parameter to "limit"
    - Use QUERY_PARAMS constants
    - Replace inline authorization extraction with extractAuthorizationContext
    - _Requirements: 1.2, 2.6, 3.5, 6.1, 6.2, 6.3_
  
  - [ ]* 8.2 Run integration tests for analytics routes
    - Verify analytics endpoints work with "limit" parameter
    - Verify backward compatibility if needed
    - _Requirements: 12.4, 12.5_

- [x] 9. Checkpoint - Ensure all route migrations pass tests
  - Run all backend tests
  - Verify no regressions
  - Ask the user if questions arise

- [x] 10. Migrate service layer to use geographic filtering service
  - [x] 10.1 Update venue.service.ts
    - Inject GeographicFilteringService
    - Replace getEffectiveGeographicAreaIds with service call
    - Remove duplicated method
    - _Requirements: 4.7, 4.8_
  
  - [x] 10.2 Update participant.service.ts
    - Inject GeographicFilteringService
    - Replace getEffectiveGeographicAreaIds with service call
    - Remove duplicated method
    - _Requirements: 4.7, 4.8_
  
  - [x] 10.3 Update activity.service.ts
    - Inject GeographicFilteringService
    - Replace getEffectiveGeographicAreaIds with service call
    - Remove duplicated method
    - _Requirements: 4.7, 4.8_
  
  - [x] 10.4 Update geographic-area.service.ts
    - Inject GeographicFilteringService
    - Replace getEffectiveGeographicAreaIds with service call
    - Remove duplicated method
    - _Requirements: 4.7, 4.8_
  
  - [x] 10.5 Update analytics.service.ts
    - Inject GeographicFilteringService
    - Replace getEffectiveGeographicAreaIds with service call (use analytics variant)
    - Remove duplicated method
    - _Requirements: 4.7, 4.8_
  
  - [x] 10.6 Update map-data.service.ts
    - Inject GeographicFilteringService
    - Replace getEffectiveGeographicAreaIds with service call
    - Remove duplicated method
    - _Requirements: 4.7, 4.8_
  
  - [ ]* 10.7 Run service layer tests
    - Verify all service tests pass
    - Verify behavior unchanged
    - _Requirements: 12.3, 12.5_

- [x] 11. Create frontend confirmation dialog component
  - [x] 11.1 Implement BaseModal component
    - Create web-frontend/src/components/common/BaseModal.tsx
    - Define BaseModalProps interface
    - Wrap CloudScape Modal with standard props
    - Provide default footer with Close button
    - Support custom footer and sizes
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 11.2 Implement ConfirmationDialog component
    - Create web-frontend/src/components/common/ConfirmationDialog.tsx
    - Define ConfirmationDialogProps interface
    - Use CloudScape Modal
    - Accept title, message, button labels as props
    - Support destructive and normal variants
    - Provide confirm and cancel callbacks
    - Provide sensible defaults for optional props
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 11.3 Write unit tests for BaseModal
    - Test renders with custom header and content
    - Test custom footer is used when provided
    - Test default footer is used when not provided
    - Test size prop is passed through
    - Test onDismiss callback is invoked
    - _Requirements: 9.2, 9.3, 9.4_
  
  - [x] 11.4 Write unit tests for ConfirmationDialog
    - Test renders with custom title and message
    - Test confirm callback is invoked
    - Test cancel callback is invoked
    - Test destructive variant
    - Test normal variant
    - Test default props are applied
    - _Requirements: 5.2, 5.3, 5.5_
  
  - [ ]* 11.5 Write property test for ConfirmationDialog rendering
    - **Property 8: ConfirmationDialog Renders Custom Props**
    - **Validates: Requirements 5.2**
    - Generate random title, message, and button labels
    - Verify all props are rendered in output
    - Run 100 iterations

- [x] 12. Migrate frontend components to use ConfirmationDialog (Phase 1 - Simple)
  - [x] 12.1 Update PopulationList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 12.2 Update ActivityCategoryList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 12.3 Update ActivityTypeList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 12.4 Update ParticipantRoleList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [ ]* 12.5 Test Phase 1 component migrations
    - Verify component tests pass
    - Verify user interactions work correctly
    - _Requirements: 12.4_

- [x] 13. Migrate frontend components to use ConfirmationDialog (Phase 2 - Medium)
  - [x] 13.1 Update GeographicAuthorizationManager.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 13.2 Update UserFormWithAuthorization.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [ ]* 13.3 Test Phase 2 component migrations
    - Verify component tests pass
    - Verify user interactions work correctly
    - _Requirements: 12.4_

- [x] 14. Migrate frontend components to use ConfirmationDialog (Phase 3 - Complex Lists)
  - [x] 14.1 Update VenueList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 14.2 Update ParticipantList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 14.3 Update ActivityList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 14.4 Update GeographicAreaList.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [ ]* 14.5 Test Phase 3 component migrations
    - Verify component tests pass
    - Verify user interactions work correctly
    - _Requirements: 12.4_

- [x] 15. Migrate frontend components to use ConfirmationDialog (Phase 4 - Complex Details)
  - [x] 15.1 Update VenueDetail.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 15.2 Update ParticipantDetail.tsx
    - Replace window.confirm() calls with ConfirmationDialog
    - Add state for confirmation modals (delete participant, delete address)
    - Update delete handlers
    - _Requirements: 5.6, 5.7_
  
  - [x] 15.3 Update GeographicAreaDetail.tsx
    - Replace window.confirm() with ConfirmationDialog
    - Add state for confirmation modal
    - Update delete handler
    - _Requirements: 5.6, 5.7_
  
  - [x] 15.4 Update ActivityDetail.tsx
    - Replace window.confirm() calls with ConfirmationDialog
    - Add state for confirmation modals (update status, remove assignment, delete venue, delete activity)
    - Update all handlers
    - _Requirements: 5.6, 5.7_
  
  - [ ]* 15.5 Test Phase 4 component migrations
    - Verify component tests pass
    - Verify user interactions work correctly
    - _Requirements: 12.4_

- [x] 16. Checkpoint - Ensure all component migrations pass tests
  - Run all frontend tests
  - Verify no window.confirm() calls remain
  - Verify user interactions work correctly
  - Ask the user if questions arise

- [x] 17. Write unit tests for array normalization utility
  - [x] 17.1 Write unit tests for normalizeArrayParam
    - Test single string wrapping
    - Test array passthrough
    - Test undefined handling
    - Test comma-separated values
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 17.2 Write property test for single value wrapping
    - **Property 6: Array Normalization Wraps Single Values**
    - **Validates: Requirements 8.2**
    - Generate random single strings
    - Verify result is array with one element
    - Run 100 iterations
  
  - [ ]* 17.3 Write property test for idempotence
    - **Property 7: Array Normalization Is Idempotent**
    - **Validates: Requirements 8.3**
    - Generate random arrays
    - Verify normalizing twice equals normalizing once
    - Run 100 iterations

- [x] 18. Final validation and documentation
  - [x] 18.1 Run full test suite
    - Run all backend unit tests
    - Run all backend integration tests
    - Run all frontend component tests
    - Run all property-based tests
    - Verify no regressions
    - _Requirements: 12.1, 12.5_
  
  - [x] 18.2 Update API documentation
    - Document standardized query parameter names
    - Document "limit" parameter (not "pageSize")
    - Document new utility functions
    - Document GeographicFilteringService
    - _Requirements: 6.4_
  
  - [x] 18.3 Update developer documentation
    - Document refactoring patterns
    - Document usage of new utilities
    - Document ConfirmationDialog usage pattern
    - Add code examples
    - _Requirements: 7.4_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Verify all tests pass
  - Verify no window.confirm() calls remain
  - Verify no inline query parameter strings remain
  - Verify no duplicated getEffectiveGeographicAreaIds methods remain
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the refactoring
- Migration is phased to minimize risk (simple components first, complex last)
- Property tests validate universal correctness properties with 100 iterations each
- Unit tests validate specific examples and edge cases
- All refactoring maintains backward compatibility and existing behavior
