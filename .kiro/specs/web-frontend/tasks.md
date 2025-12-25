# Implementation Plan: Web Frontend Package

## Overview

This implementation plan covers the React-based web application built with TypeScript, Vite, and CloudScape Design System. The application provides a responsive interface for managing activities, participants, venues, geographic areas, and viewing analytics with offline support.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Initialize Vite React TypeScript project
  - Install dependencies: react, react-router-dom, @cloudscape-design/components, react-query, dexie, leaflet
  - Configure TypeScript compiler options
  - Set up ESLint and Prettier
  - Create project directory structure (components, pages, hooks, services, types)
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Set up routing and layout
  - [ ] 2.1 Configure React Router
    - Set up route definitions for all pages
    - Implement protected routes for authenticated pages
    - Configure route-based code splitting
    - _Requirements: 13.1, 13.3, 9.1_

  - [ ] 2.2 Create AppLayout component
    - Use CloudScape AppLayout component
    - Implement navigation sidebar with links
    - Display user menu with name, role, and logout
    - Show connection status indicator
    - Highlight current active section
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 10.5_

  - [ ]* 2.3 Write property test for active navigation highlighting
    - **Property 33: Active Navigation Highlighting**
    - **Validates: Requirements 13.2**

  - [ ]* 2.4 Write property test for navigation state persistence
    - **Property 34: Navigation State Persistence**
    - **Validates: Requirements 13.3**

- [ ] 3. Implement authentication system
  - [ ] 3.1 Create authentication service
    - Implement login API call
    - Implement logout functionality
    - Implement token refresh
    - Store tokens securely in localStorage
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 3.2 Create LoginPage component
    - Render email and password fields using CloudScape
    - Validate inputs before submission
    - Display error messages using CloudScape Alert
    - Redirect to dashboard on success
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 3.3 Write property test for unauthenticated access protection
    - **Property 25: Unauthenticated Access Protection**
    - **Validates: Requirements 9.1, 9.2**

  - [ ] 3.3 Create ProtectedRoute component
    - Check authentication status
    - Redirect to login if not authenticated
    - Check user role for authorization
    - _Requirements: 9.1, 9.2_

  - [ ] 3.4 Implement role-based UI rendering
    - Show all features for ADMINISTRATOR
    - Show create/update/delete for EDITOR
    - Hide create/update/delete for READ_ONLY
    - _Requirements: 9.3, 9.4, 9.5_

  - [ ]* 3.5 Write property test for unauthorized action error messages
    - **Property 26: Unauthorized Action Error Messages**
    - **Validates: Requirements 9.6**

- [ ] 4. Checkpoint - Verify authentication and routing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement activity type management UI
  - [ ] 5.1 Create ActivityTypeList component
    - Display table using CloudScape Table
    - Distinguish predefined vs custom types with badges
    - Provide edit and delete actions
    - Handle delete validation
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Write property test for type/role distinction
    - **Property 1: Type/Role Distinction in Lists**
    - **Validates: Requirements 2.1, 3.1**

  - [ ]* 5.3 Write property test for referential integrity on deletion
    - **Property 2: Referential Integrity on Deletion**
    - **Validates: Requirements 2.5, 3.5**

  - [ ]* 5.4 Write property test for deletion error messages
    - **Property 3: Deletion Error Messages**
    - **Validates: Requirements 2.6, 3.6**

  - [ ] 5.2 Create ActivityTypeForm component
    - Modal form for create/edit
    - Validate name is not empty
    - Submit to API and update cache
    - _Requirements: 2.2, 2.3, 2.7_

  - [ ]* 5.5 Write property test for non-empty name validation
    - **Property 4: Non-Empty Name Validation**
    - **Validates: Requirements 2.7, 3.7**

- [ ] 6. Implement participant role management UI
  - [ ] 6.1 Create ParticipantRoleList and ParticipantRoleForm components
    - Similar structure to activity type management
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 7. Implement participant management UI
  - [ ] 7.1 Create ParticipantList component
    - Display table with search, sort, and filter
    - Use CloudScape Table with pagination
    - Implement client-side search
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property test for participant list display
    - **Property 5: Participant List Display**
    - **Validates: Requirements 4.1**

  - [ ]* 7.3 Write property test for participant search
    - **Property 6: Participant Search Functionality**
    - **Validates: Requirements 4.2**

  - [ ] 7.2 Create ParticipantForm component
    - Modal form for create/edit
    - Validate name, email format, and required fields
    - Support optional phone and notes
    - Support home venue selection
    - Display inline validation errors
    - _Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.11_

  - [ ]* 7.4 Write property tests for participant validation
    - **Property 7: Required Field Validation**
    - **Property 8: Email Format Validation**
    - **Property 9: Optional Field Acceptance**
    - **Validates: Requirements 4.7, 4.8, 4.9**

  - [ ] 7.3 Create ParticipantDetail component
    - Show participant information
    - List all activities with roles
    - Display address history
    - _Requirements: 4.10, 4.12_

  - [ ]* 7.5 Write property test for participant detail view
    - **Property 10: Participant Detail View Completeness**
    - **Validates: Requirements 4.10**

- [ ] 8. Implement venue management UI
  - [ ] 8.1 Create VenueList component
    - Display table with name, address, and geographic area
    - Implement search, sort, and filter
    - _Requirements: 6A.1, 6A.2, 6A.3_

  - [ ]* 8.2 Write property tests for venue list and search
    - **Property 44: Venue List Display**
    - **Property 45: Venue Search Functionality**
    - **Validates: Requirements 6A.1, 6A.2**

  - [ ] 8.2 Create VenueForm component
    - Validate required fields (name, address, geographic area)
    - Support optional latitude, longitude, venue type
    - Handle delete validation
    - _Requirements: 6A.4, 6A.5, 6A.6, 6A.7, 6A.8, 6A.10, 6A.11_

  - [ ]* 8.3 Write property tests for venue validation
    - **Property 46: Venue Required Field Validation**
    - **Property 47: Venue Optional Field Acceptance**
    - **Property 48: Venue Deletion Prevention**
    - **Validates: Requirements 6A.7, 6A.8, 6A.10, 6A.11**

  - [ ] 8.3 Create VenueDetail component
    - Show venue information
    - List associated activities
    - List participants with venue as home
    - Display geographic area hierarchy
    - _Requirements: 6A.9_

  - [ ]* 8.4 Write property test for venue detail view
    - **Property 49: Venue Detail View Completeness**
    - **Validates: Requirements 6A.9**

- [ ] 9. Implement geographic area management UI
  - [ ] 9.1 Create GeographicAreaList component
    - Display hierarchical tree view using CloudScape Tree
    - Show area type badges
    - Provide expand/collapse functionality
    - Handle delete validation
    - _Requirements: 6B.1, 6B.4, 6B.9, 6B.10_

  - [ ]* 9.2 Write property test for hierarchical display
    - **Property 50: Geographic Area Hierarchical Display**
    - **Validates: Requirements 6B.1**

  - [ ] 9.2 Create GeographicAreaForm component
    - Validate required fields (name, area type)
    - Support parent selection
    - Prevent circular relationships
    - _Requirements: 6B.2, 6B.3, 6B.5, 6B.6, 6B.7_

  - [ ]* 9.3 Write property tests for geographic area validation
    - **Property 51: Geographic Area Required Field Validation**
    - **Property 52: Circular Relationship Prevention**
    - **Property 53: Geographic Area Deletion Prevention**
    - **Validates: Requirements 6B.5, 6B.7, 6B.9, 6B.10**

  - [ ] 9.3 Create GeographicAreaDetail component
    - Display full hierarchy path
    - List child areas
    - List associated venues
    - Show statistics
    - _Requirements: 6B.8, 6B.11_

  - [ ]* 9.4 Write property test for hierarchy path display
    - **Property 54: Geographic Area Hierarchy Path Display**
    - **Validates: Requirements 6B.11**

- [ ] 10. Checkpoint - Verify core entity management UI
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement activity management UI
  - [ ] 11.1 Create ActivityList component
    - Display table with filtering by type and status
    - Visually distinguish finite vs ongoing
    - Provide sort capabilities
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 11.2 Write property tests for activity list
    - **Property 11: Activity List Display**
    - **Property 12: Activity Filtering**
    - **Property 13: Finite vs Ongoing Activity Distinction**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [ ] 11.2 Create ActivityForm component
    - Conditionally require end date for finite activities
    - Allow null end date for ongoing
    - Validate name, type, start date
    - Support venue selection
    - _Requirements: 5.5, 5.6, 5.8, 5.9, 5.10, 5.13_

  - [ ]* 11.3 Write property tests for activity validation
    - **Property 14: Finite Activity End Date Requirement**
    - **Property 15: Ongoing Activity Null End Date**
    - **Validates: Requirements 5.8, 5.9**

  - [ ] 11.3 Create ActivityDetail component
    - Show activity information
    - List assigned participants with roles
    - Display venue history
    - Provide "Mark Complete" button
    - _Requirements: 5.11, 5.12, 5.14_

  - [ ]* 11.4 Write property test for activity detail view
    - **Property 16: Activity Detail View Completeness**
    - **Validates: Requirements 5.12**

- [ ] 12. Implement assignment management UI
  - [ ] 12.1 Create AssignmentForm component
    - Require role selection
    - Validate role is selected
    - Prevent duplicate assignments
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

  - [ ]* 12.2 Write property tests for assignments
    - **Property 17: Assignment Role Requirement**
    - **Property 18: Assignment Display Completeness**
    - **Property 19: Duplicate Assignment Prevention**
    - **Validates: Requirements 6.2, 6.3, 6.5, 6.6**

  - [ ] 12.2 Create AssignmentList component
    - Display assigned participants on activity detail
    - Show participant name and role
    - Provide remove button
    - _Requirements: 6.3, 6.4_

- [ ] 13. Implement map view UI
  - [ ] 13.1 Create MapView component
    - Render interactive map using Leaflet or Mapbox
    - Display venue markers with coordinates
    - Use different colors for activity types/statuses
    - Implement marker clustering
    - Provide popup with activity information
    - _Requirements: 6C.1, 6C.2, 6C.3, 6C.4, 6C.7_

  - [ ]* 13.2 Write property tests for map display
    - **Property 55: Map Venue Marker Display**
    - **Property 56: Map Marker Activity Information**
    - **Validates: Requirements 6C.2, 6C.3**

  - [ ] 13.2 Create MapFilters component
    - Provide filter controls for type, status, date range
    - Update markers based on filters
    - Support geographic area boundary toggle
    - Provide center button
    - Display legend
    - _Requirements: 6C.5, 6C.6, 6C.8, 6C.9, 6C.10_

- [ ] 14. Implement analytics dashboards
  - [ ] 14.1 Create EngagementDashboard component
    - Display summary metrics using CloudScape Cards
    - Render charts for activities by type and role distribution
    - Provide date range filter
    - Provide geographic area filter
    - Display geographic breakdown chart
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.12, 7.13, 7.14_

  - [ ]* 14.2 Write property tests for engagement metrics
    - **Property 20: Engagement Metrics Accuracy**
    - **Property 21: Chart Data Aggregation**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**

  - [ ] 14.2 Create GrowthDashboard component
    - Display time-series charts
    - Provide time period selector
    - Show percentage changes
    - Display cumulative counts
    - Provide geographic area filter
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

  - [ ]* 14.3 Write property tests for growth metrics
    - **Property 22: Time-Series Data Calculation**
    - **Property 23: Percentage Change Calculation**
    - **Property 24: Cumulative Count Calculation**
    - **Validates: Requirements 7.8, 7.10, 7.11**

- [ ] 15. Implement offline support
  - [ ] 15.1 Create OfflineStorage service
    - Use Dexie.js for IndexedDB management
    - Store tables for all entities
    - Implement syncFromServer
    - Implement getLocalData
    - _Requirements: 10.1, 10.2_

  - [ ]* 15.2 Write property test for offline data caching
    - **Property 27: Offline Data Caching**
    - **Validates: Requirements 10.2**

  - [ ] 15.2 Create SyncQueue service
    - Store pending operations in IndexedDB
    - Implement enqueue, processQueue, clearQueue
    - Implement exponential backoff
    - _Requirements: 10.3, 11.2, 11.3, 11.4_

  - [ ]* 15.3 Write property tests for sync queue
    - **Property 28: Offline Operation Queueing**
    - **Property 30: Sync Queue Processing**
    - **Property 31: Sync Retry with Exponential Backoff**
    - **Property 32: Pending Operation Count Display**
    - **Validates: Requirements 10.3, 11.2, 11.3, 11.4, 11.6**

  - [ ] 15.3 Create ConnectionMonitor service
    - Listen to online/offline events
    - Update global connection state
    - Trigger sync when connectivity restored
    - _Requirements: 10.5, 11.1_

  - [ ]* 15.4 Write property test for offline feature indication
    - **Property 29: Offline Feature Indication**
    - **Validates: Requirements 10.6, 10.7**

- [ ] 16. Implement PWA capabilities
  - [ ] 16.1 Create service worker
    - Cache static assets
    - Implement offline detection
    - _Requirements: 12.3, 12.4_

  - [ ] 16.2 Create web app manifest
    - Configure icons and colors
    - Enable installability
    - Provide splash screen
    - _Requirements: 12.1, 12.2, 12.5_

- [ ] 17. Implement form validation and error handling
  - [ ] 17.1 Create validation utilities
    - Validate all form inputs before submission
    - Display inline error messages
    - Highlight invalid fields
    - Prevent submission when validation fails
    - Preserve valid field values
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 17.2 Write property tests for form validation
    - **Property 35: Form Validation Error Display**
    - **Property 36: Invalid Form Submission Prevention**
    - **Property 37: Valid Field Value Preservation**
    - **Validates: Requirements 14.2, 14.3, 14.4, 14.5**

  - [ ] 17.2 Create error handling utilities
    - Display user-friendly error messages
    - Use toast notifications for transient errors
    - Use modal dialogs for critical errors
    - Maintain application state during errors
    - Log errors to console
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ]* 17.3 Write property tests for error handling
    - **Property 38: Error Notification Type**
    - **Property 39: Error State Preservation**
    - **Property 40: Error Console Logging**
    - **Validates: Requirements 15.2, 15.3, 15.5, 15.6**

- [ ] 18. Implement loading states
  - [ ] 18.1 Create loading components
    - Display loading indicators during API requests
    - Disable buttons during submission
    - Display skeleton screens for lists
    - Provide progress indicators
    - Display success messages
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ]* 18.2 Write property tests for loading states
    - **Property 41: Loading State Indicators**
    - **Property 42: Form Button Disabling During Submission**
    - **Property 43: Success Message Display**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5**

- [ ] 19. Implement user management (admin only)
  - [ ] 19.1 Create UserList and UserForm components
    - Display table of all users (admin only)
    - Allow role assignment and modification
    - Hide from non-administrators
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
