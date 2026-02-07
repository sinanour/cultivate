# Implementation Plan: PII-Restricted Role

## Overview

This implementation plan breaks down the PII-restricted role feature into discrete coding tasks. The approach follows a layered implementation strategy: first establishing the role infrastructure (enum, JWT, database), then implementing backend endpoint access control and analytics parameter validation, and finally updating frontend route protection and navigation filtering.

## Tasks

- [x] 1. Add PII_RESTRICTED role to system infrastructure
  - [x] 1.1 Add PII_RESTRICTED to UserRole enum in backend-api
    - Update the UserRole enum definition to include PII_RESTRICTED
    - Update any role validation logic to accept the new role
    - _Requirements: 1.1_
  
  - [x] 1.2 Add PII_RESTRICTED to UserRole enum in web-frontend
    - Update the frontend UserRole enum to match backend
    - Ensure type consistency across frontend codebase
    - _Requirements: 1.1_
  
  - [x] 1.3 Update JWT token generation to include PII_RESTRICTED role
    - Modify JWT payload generation to include role field
    - Ensure PII_RESTRICTED role is properly encoded in tokens
    - _Requirements: 1.4, 9.1_
  
  - [ ]*  1.4 Write property test for JWT role inclusion
    - **Property 1: JWT Token Role Inclusion**
    - **Validates: Requirements 1.4**
  
  - [x] 1.5 Update database schema to support PII_RESTRICTED role
    - Add migration to allow PII_RESTRICTED as a valid role value
    - Update any role constraints or indexes
    - _Requirements: 1.3_
  
  - [ ]*  1.6 Write property test for user role persistence
    - **Property 2: User Role Persistence**
    - **Validates: Requirements 1.3**

- [x] 2. Implement backend endpoint access control
  - [x] 2.1 Create endpoint blocking middleware
    - Define BLOCKED_ENDPOINTS array with regex patterns for /participants, /venues, /activities, /map
    - Implement isEndpointBlocked(path, role) function
    - Create checkPIIRestrictedAccess middleware function
    - Apply middleware to all API routes before other authorization checks
    - Return 403 Forbidden with ENDPOINT_ACCESS_DENIED error code for blocked endpoints
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3A.1, 3A.2, 3A.3, 3A.4, 3A.5, 3A.6, 3A.7, 3A.8, 3A.9, 3A.10, 3A.11, 3A.12, 3A.13, 3A.14, 3B.1, 3B.2, 3B.3, 3B.4, 3B.5, 3B.6_
  
  - [ ]* 2.2 Write property test for participant API blocking
    - **Property 3: Participant API Complete Blocking**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12**
  
  - [ ]* 2.3 Write property test for venue API blocking
    - **Property 4: Venue API Complete Blocking**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
  
  - [ ]* 2.4 Write property test for activity API blocking
    - **Property 5: Activity API Complete Blocking**
    - **Validates: Requirements 3A.1, 3A.2, 3A.3, 3A.4, 3A.5, 3A.6, 3A.7, 3A.8, 3A.9, 3A.10, 3A.11, 3A.12, 3A.13, 3A.14**
  
  - [ ]* 2.5 Write property test for map API blocking
    - **Property 6: Map API Complete Blocking**
    - **Validates: Requirements 3B.1, 3B.2, 3B.3, 3B.4, 3B.5, 3B.6**

- [x] 3. Implement analytics parameter validation
  - [x] 3.1 Create analytics parameter validation function
    - Implement validateAnalyticsParams(params, role) function
    - Check for venue in groupBy parameter
    - Check for venueIds in filter parameters
    - Return 400 Bad Request with descriptive error message when venue parameters detected
    - Apply validation to all analytics endpoints: /engagement, /growth, /activity-lifecycle, /geographic
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.9_
  
  - [ ]* 3.2 Write property test for venue grouping rejection
    - **Property 11: Analytics Venue Grouping Rejection**
    - **Validates: Requirements 6.5**
  
  - [ ]* 3.3 Write property test for venue filtering rejection
    - **Property 12: Analytics Venue Filtering Rejection**
    - **Validates: Requirements 6.6, 6.7, 6.8, 6.9**

- [x] 4. Checkpoint - Ensure backend access control tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update authorization middleware for read-only enforcement
  - [x] 5.1 Update authorization middleware to extract PII_RESTRICTED role from JWT
    - Modify extractAuthContext to handle PII_RESTRICTED role
    - Ensure role is available in request context
    - _Requirements: 9.2_
  
  - [x] 5.2 Implement write operation blocking for PII_RESTRICTED role
    - Update enforceReadOnlyForPIIRestricted function to block all write operations
    - Reject POST, PUT, DELETE operations for PII_RESTRICTED users on all resources
    - Return 403 Forbidden with READ_ONLY_ACCESS error code
    - _Requirements: 5.6, 5.7, 5.8, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16_
  
  - [ ]* 5.3 Write property test for write operation rejection
    - **Property 10: Geographic Area Write Blocking**
    - **Property 15: Configuration Write Blocking**
    - **Validates: Requirements 5.6, 5.7, 5.8, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16**
  
  - [ ]* 5.4 Write property test for JWT role extraction
    - **Property 17: JWT Role Extraction**
    - **Validates: Requirements 9.2**

- [x] 6. Implement geographic authorization for PII_RESTRICTED role
  - [x] 6.1 Update geographic authorization logic to apply to PII_RESTRICTED users
    - Ensure geographic area checks apply to PII_RESTRICTED role
    - Reject requests outside authorized areas
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 6.2 Write property test for geographic authorization enforcement
    - **Property 16: Geographic Authorization Enforcement**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 7. Verify configuration and geographic area read-only access
  - [x] 7.1 Ensure configuration resources are accessible to PII_RESTRICTED role
    - Verify GET /api/v1/activity-categories returns data
    - Verify GET /api/v1/activity-types returns data
    - Verify GET /api/v1/roles returns data
    - Verify GET /api/v1/populations returns data
    - Verify write operations are blocked (POST, PUT, DELETE)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16_
  
  - [x] 7.2 Ensure geographic area read-only access works correctly
    - Verify GET /api/v1/geographic-areas returns data
    - Verify GET /api/v1/geographic-areas/:id returns data
    - Verify GET /api/v1/geographic-areas/:id/children returns data
    - Verify POST /api/v1/geographic-areas/batch-ancestors returns data
    - Verify POST /api/v1/geographic-areas/batch-details returns data
    - Verify write operations are blocked (POST, PUT, DELETE)
    - Verify venue-related endpoints are blocked (/venues, /statistics)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_
  
  - [ ]* 7.3 Write property test for geographic area read-only access
    - **Property 9: Geographic Area Read-Only Access**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
  
  - [ ]* 7.4 Write property test for configuration read-only access
    - **Property 14: Configuration Read-Only Access**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 8. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement frontend route protection
  - [x] 9.1 Create ProtectedRoute component with role-based access control
    - Accept allowedRoles prop as array of UserRole values
    - Check current user's role against allowedRoles
    - Redirect to dashboard if role not allowed
    - Display unauthorized message when appropriate
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_
  
  - [x] 9.2 Apply ProtectedRoute to all participant, venue, activity, and map routes
    - Wrap /participants routes with allowedRoles=[ADMINISTRATOR, EDITOR, READ_ONLY]
    - Wrap /venues routes with allowedRoles=[ADMINISTRATOR, EDITOR, READ_ONLY]
    - Wrap /activities routes with allowedRoles=[ADMINISTRATOR, EDITOR, READ_ONLY]
    - Wrap /map route with allowedRoles=[ADMINISTRATOR, EDITOR, READ_ONLY]
    - Ensure PII_RESTRICTED users are redirected when attempting direct navigation
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_
  
  - [x] 9.3 Apply ProtectedRoute to analytics and geographic area routes
    - Wrap /analytics routes with allowedRoles=[ALL_ROLES] (including PII_RESTRICTED)
    - Wrap /geographic-areas routes with allowedRoles=[ALL_ROLES] (including PII_RESTRICTED)
    - Wrap /configuration route with allowedRoles=[ALL_ROLES] (including PII_RESTRICTED)
    - _Requirements: 5.12, 6.10, 6.11, 7.17_
  
  - [ ]* 9.4 Write property test for frontend route protection
    - **Property 8: Frontend Route Protection**
    - **Validates: Requirements 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11**

- [x] 10. Implement frontend navigation filtering
  - [x] 10.1 Update navigation component to filter menu items by role
    - Define navigationItems array with allowedRoles for each item
    - Filter navigation items based on current user's role
    - Hide Participants, Venues, Activities, and Map links for PII_RESTRICTED users
    - Show Geographic Areas, Analytics, and Configuration links for PII_RESTRICTED users
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.12, 6.10, 6.11, 7.17_
  
  - [x] 10.2 Update dashboard quick links to filter by role
    - Hide Participants, Venues, Activities, and Map quick links for PII_RESTRICTED users
    - Show only Geographic Areas and Analytics quick links for PII_RESTRICTED users
    - _Requirements: 4.12, 4.13_
  
  - [ ]* 10.3 Write property test for navigation filtering
    - **Property 7: Frontend Navigation Filtering**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 11. Implement analytics UI restrictions
  - [x] 11.1 Update FilterGroupingPanel to accept suppressVenueOptions prop
    - Add suppressVenueOptions boolean prop to FilterGroupingPanel component
    - When suppressVenueOptions is true, exclude 'venue' from groupingDimensions
    - When suppressVenueOptions is true, exclude 'venue' from filterProperties
    - Ensure other grouping and filtering options remain available
    - _Requirements: 6.12, 6.13, 6.14, 6.15, 6.16_
  
  - [x] 11.2 Update EngagementDashboard to suppress venue options for PII_RESTRICTED
    - Check if current user has PII_RESTRICTED role
    - Pass suppressVenueOptions={true} to FilterGroupingPanel when role is PII_RESTRICTED
    - Ensure venue grouping and filtering are hidden from UI
    - _Requirements: 6.12, 6.13, 6.15, 6.16_
  
  - [x] 11.3 Update GrowthDashboard to suppress venue filtering for PII_RESTRICTED
    - Check if current user has PII_RESTRICTED role
    - Pass suppressVenueOptions={true} to FilterGroupingPanel when role is PII_RESTRICTED
    - Ensure venue filtering is hidden from UI
    - _Requirements: 6.14, 6.15, 6.16_
  
  - [ ]* 11.4 Write property test for venue option suppression
    - **Property 13: Frontend Venue Option Suppression**
    - **Validates: Requirements 6.12, 6.13, 6.14**

- [x] 12. Update configuration page UI for PII_RESTRICTED role
  - [x] 12.1 Hide edit and delete buttons on configuration page for PII_RESTRICTED users
    - Check current user's role in ConfigurationPage component
    - Conditionally render edit and delete buttons based on role
    - Hide all create buttons for PII_RESTRICTED users
    - _Requirements: 7.18, 7.19_
  
  - [x] 12.2 Hide edit and delete buttons on geographic area pages for PII_RESTRICTED users
    - Check current user's role in GeographicAreaList and GeographicAreaDetail components
    - Conditionally render edit and delete buttons based on role
    - Hide create button for PII_RESTRICTED users
    - _Requirements: 5.15_

- [x] 13. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 14. Write integration tests for end-to-end flows
  - [ ]* 14.1 Write integration test for PII_RESTRICTED user accessing analytics
    - Test login → request engagement metrics → verify success
    - Test login → request growth metrics → verify success
    - Test login → attempt venue grouping → verify rejection
    - Test login → attempt venue filtering → verify rejection
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  
  - [ ]* 14.2 Write integration test for PII_RESTRICTED user accessing geographic areas
    - Test login → request geographic areas → verify success
    - Test login → attempt to create geographic area → verify rejection
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [ ]* 14.3 Write integration test for PII_RESTRICTED user attempting blocked endpoint access
    - Test login → request participants → verify 403 Forbidden
    - Test login → request venues → verify 403 Forbidden
    - Test login → request activities → verify 403 Forbidden
    - Test login → request map data → verify 403 Forbidden
    - _Requirements: 2.1, 3.1, 3A.1, 3B.1_
  
  - [ ]* 14.4 Write integration test for PII_RESTRICTED user navigation
    - Test login → verify navigation menu hides blocked pages
    - Test login → attempt direct navigation to blocked page → verify redirect
    - Test login → verify dashboard quick links hide blocked pages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end user flows
- The implementation follows a backend-first approach to ensure access control is enforced before UI updates
- PII redaction logic from previous implementation is no longer needed - complete endpoint blocking is simpler and more secure
