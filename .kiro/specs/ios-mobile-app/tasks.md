# Implementation Plan: iOS Mobile App Package

## Overview

This implementation plan covers the native iOS application built with Swift, SwiftUI, and Core Data. The application provides an offline-first interface for managing activities, participants, venues, geographic areas, and viewing analytics on iPhone and iPad devices.

## Tasks

- [ ] 1. Set up Xcode project and dependencies
  - Create new iOS app project with SwiftUI
  - Configure minimum deployment target (iOS 16.0+)
  - Add Swift Package Manager dependencies (if needed)
  - Set up project structure (Views, ViewModels, Services, Models)
  - Configure Info.plist for required permissions
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Set up Core Data stack
  - [ ] 2.1 Create Core Data model
    - Define all entity models (ActivityType, ParticipantRole, Participant, Activity, Venue, GeographicArea, etc.)
    - Define relationships and foreign keys
    - Configure cascade rules
    - Add PendingOperation entity for sync queue
    - _Requirements: 10.1_

  - [ ] 2.2 Create Core Data stack manager
    - Initialize persistent container
    - Configure background context for sync
    - Implement save operations
    - _Requirements: 10.1_

- [ ] 3. Implement authentication system
  - [ ] 3.1 Create AuthService
    - Implement login API call
    - Implement logout functionality
    - Implement token refresh
    - Store credentials in Keychain
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 3.2 Write property test for Keychain round-trip
    - **Property 10: Keychain Storage Round-Trip**
    - **Validates: Requirements 8.5**

  - [ ] 3.2 Create LoginView
    - Render email and password fields
    - Validate inputs before submission
    - Display error alerts
    - Navigate to main app on success
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 3.3 Implement role-based UI rendering
    - Show all features for ADMINISTRATOR
    - Show create/update/delete for EDITOR
    - Hide create/update/delete for READ_ONLY
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 3.4 Write property test for role-based authorization
    - **Property 11: Role-Based Feature Authorization**
    - **Validates: Requirements 9.3, 9.4, 9.5**

- [ ] 4. Checkpoint - Verify authentication and Core Data
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement API service layer
  - [ ] 5.1 Create APIService
    - Implement URLSession-based HTTP client
    - Configure automatic auth token injection
    - Implement error handling
    - Define all API endpoints (activity types, roles, participants, activities, venues, geographic areas, analytics)
    - _Requirements: Overview_

  - [ ] 5.2 Create DTO models
    - Define Codable structs for all API request/response types
    - Implement mapping between DTOs and Core Data entities
    - _Requirements: Overview_

- [ ] 6. Implement activity type management
  - [ ] 6.1 Create ActivityTypeListView
    - Display list using SwiftUI List
    - Distinguish predefined vs custom types
    - Provide swipe-to-delete
    - Handle delete validation
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7_

  - [ ]* 6.2 Write property tests for activity type operations
    - **Property 1: Complete Data Retrieval**
    - **Property 2: Reference Constraint Enforcement**
    - **Validates: Requirements 2.1, 2.6**

  - [ ] 6.2 Create ActivityTypeFormView
    - Sheet for create/edit
    - Validate name is not empty
    - Submit to API and update Core Data
    - _Requirements: 2.3, 2.4_

- [ ] 7. Implement participant role management
  - [ ] 7.1 Create ParticipantRoleListView and ParticipantRoleFormView
    - Similar structure to activity type management
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 8. Implement participant management
  - [ ] 8.1 Create ParticipantListView
    - Display list with search functionality
    - Implement filtering and sorting
    - Provide swipe-to-delete
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [ ]* 8.2 Write property tests for participant operations
    - **Property 3: Search Result Accuracy**
    - **Property 4: Filter Correctness**
    - **Property 5: Sort Order Preservation**
    - **Validates: Requirements 4.2, 4.3**

  - [ ] 8.2 Create ParticipantFormView
    - Sheet for create/edit
    - Validate name, email format, and required fields
    - Support optional phone and notes
    - Support home venue selection
    - _Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.11_

  - [ ]* 8.3 Write property test for input validation
    - **Property 6: Input Validation Rejection**
    - **Validates: Requirements 4.7, 4.8, 5.8, 6.2, 8.2, 14.1**

  - [ ] 8.3 Create ParticipantDetailView
    - Show participant information
    - List all activities with roles
    - Display address history
    - _Requirements: 4.10, 4.12_

- [ ] 9. Implement venue management
  - [ ] 9.1 Create VenueListView
    - Display list with search functionality
    - Implement filtering and sorting
    - _Requirements: 6A.1, 6A.2, 6A.3, 6A.6_

  - [ ]* 9.2 Write property tests for venue operations
    - **Property 23: Venue List Display**
    - **Property 24: Venue Search Accuracy**
    - **Property 25: Venue Required Field Validation**
    - **Property 26: Venue Optional Field Acceptance**
    - **Property 27: Venue Deletion Prevention**
    - **Validates: Requirements 6A.1, 6A.2, 6A.7, 6A.8, 6A.10, 6A.11**

  - [ ] 9.2 Create VenueFormView
    - Validate required fields (name, address, geographic area)
    - Support optional latitude, longitude, venue type
    - Handle delete validation
    - _Requirements: 6A.4, 6A.5, 6A.7, 6A.8, 6A.10, 6A.11_

  - [ ] 9.3 Create VenueDetailView
    - Show venue information
    - List associated activities
    - List participants with venue as home
    - _Requirements: 6A.9_

  - [ ]* 9.4 Write property test for venue detail view
    - **Property 28: Venue Detail View Completeness**
    - **Validates: Requirements 6A.9**

- [ ] 10. Implement geographic area management
  - [ ] 10.1 Create GeographicAreaListView
    - Display hierarchical list
    - Show area type badges
    - Handle delete validation
    - _Requirements: 6B.1, 6B.4, 6B.9, 6B.10_

  - [ ]* 10.2 Write property tests for geographic area operations
    - **Property 29: Geographic Area Hierarchical Display**
    - **Property 30: Geographic Area Required Field Validation**
    - **Property 31: Circular Relationship Prevention**
    - **Property 32: Geographic Area Deletion Prevention**
    - **Validates: Requirements 6B.1, 6B.5, 6B.7, 6B.9, 6B.10**

  - [ ] 10.2 Create GeographicAreaFormView
    - Validate required fields (name, area type)
    - Provide picker for area type selection (NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD)
    - Support parent selection
    - Prevent circular relationships
    - _Requirements: 6B.2, 6B.3, 6B.5, 6B.6, 6B.7_

  - [ ] 10.3 Create GeographicAreaDetailView
    - Display full hierarchy path
    - List child areas
    - List associated venues
    - Show statistics
    - _Requirements: 6B.8_

- [ ] 11. Checkpoint - Verify core entity management
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement activity management
  - [ ] 12.1 Create ActivityListView
    - Display list with filtering by type and status
    - Visually distinguish finite vs ongoing
    - Provide sorting
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_

  - [ ]* 12.2 Write property test for activity classification
    - **Property 7: Activity Classification**
    - **Validates: Requirements 5.4**

  - [ ] 12.2 Create ActivityFormView
    - Conditionally require end date for finite activities
    - Allow null end date for ongoing
    - Validate name, type, start date
    - Support venue selection
    - _Requirements: 5.5, 5.6, 5.8, 5.9, 5.10, 5.12, 5.13_

  - [ ] 12.3 Create ActivityDetailView
    - Show activity information
    - List assigned participants with roles
    - Display venue history
    - Provide "Mark Complete" button
    - _Requirements: 5.11, 5.14_

- [ ] 13. Implement assignment management
  - [ ] 13.1 Create assignment interface
    - Require role selection
    - Validate role is selected
    - Prevent duplicate assignments
    - Display assigned participants
    - Provide swipe-to-delete
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 13.2 Write property test for duplicate prevention
    - **Property 8: Duplicate Assignment Prevention**
    - **Validates: Requirements 6.6**

- [ ] 14. Implement map view
  - [ ] 14.1 Create MapView using MapKit
    - Display venue annotations with coordinates
    - Use different colors for activity types/statuses
    - Provide annotation callouts with activity information
    - Support zooming and panning
    - Provide center button
    - Display user location when permitted
    - _Requirements: 6C.1, 6C.2, 6C.3, 6C.4, 6C.6, 6C.7, 6C.9_

  - [ ]* 14.2 Write property tests for map display
    - **Property 33: Map Annotation Display**
    - **Property 34: Map Annotation Activity Information**
    - **Property 35: Map Annotation Visual Distinction**
    - **Validates: Requirements 6C.2, 6C.3, 6C.4**

  - [ ] 14.2 Create map filter controls
    - Filter by type, status, date range
    - Update annotations based on filters
    - _Requirements: 6C.5, 6C.8_

  - [ ]* 14.3 Write property test for map filter application
    - **Property 36: Map Filter Application**
    - **Validates: Requirements 6C.5**

- [ ] 15. Implement analytics views
  - [ ] 15.1 Create EngagementMetricsView
    - Display summary metrics
    - Render charts using Swift Charts
    - Provide date range filter
    - Provide geographic area filter
    - Display geographic breakdown
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.11, 7.12_

  - [ ]* 15.2 Write property test for metric calculation
    - **Property 9: Metric Calculation Accuracy**
    - **Validates: Requirements 7.2, 7.3, 7.9, 7.10**

  - [ ] 15.2 Create GrowthAnalyticsView
    - Display time-series charts
    - Provide time period selector
    - Show percentage changes
    - Display cumulative counts
    - Provide geographic area filter
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11_

- [ ] 16. Implement offline support
  - [ ] 16.1 Create SyncService
    - Detect connectivity changes
    - Queue operations when offline
    - Process queue when online
    - Implement exponential backoff
    - _Requirements: 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 16.2 Write property tests for offline operations
    - **Property 12: Offline Data Availability**
    - **Property 13: Offline Operation Queuing**
    - **Property 14: Connectivity-Based Feature Availability**
    - **Property 15: Connectivity State Detection**
    - **Property 16: Sync Queue Processing**
    - **Property 17: Exponential Backoff Retry**
    - **Property 18: Queue Count Accuracy**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.7, 11.1, 11.2, 11.4, 11.5, 11.7**

  - [ ] 16.2 Display connection status
    - Show online/offline indicator
    - Indicate features requiring connectivity
    - Disable features when offline
    - Display pending operation count
    - _Requirements: 10.5, 10.6, 10.7, 11.7_

- [ ] 17. Implement push notifications
  - [ ] 17.1 Create NotificationService
    - Request notification permissions
    - Register for remote notifications with APNs
    - Handle incoming notifications
    - Navigate to relevant content on tap
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 17.2 Write property test for notification processing
    - **Property 19: Notification Processing**
    - **Validates: Requirements 12.3**

- [ ] 18. Implement navigation
  - [ ] 18.1 Create tab bar navigation
    - Configure tabs for main sections
    - Highlight current tab
    - Preserve navigation state within tabs
    - Use navigation stacks for hierarchical navigation
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 18.2 Write property test for navigation state preservation
    - **Property 20: Navigation State Preservation**
    - **Validates: Requirements 13.3**

- [ ] 19. Implement form validation and error handling
  - [ ] 19.1 Create validation utilities
    - Validate all form inputs before submission
    - Display inline error messages
    - Highlight invalid fields
    - Disable submit buttons when validation fails
    - Preserve valid field values
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 19.2 Create error handling utilities
    - Display user-friendly error messages
    - Use alerts for errors requiring attention
    - Use banners for transient errors
    - Maintain application state during errors
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 19.3 Write property test for error state preservation
    - **Property 21: Error State Preservation**
    - **Validates: Requirements 14.5, 15.5**

- [ ] 20. Implement loading states
  - [ ] 20.1 Create loading components
    - Display progress indicators during API requests
    - Disable buttons during submission
    - Display skeleton views for lists
    - Provide progress indicators
    - Display success messages
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 21. Implement accessibility
  - [ ] 21.1 Add accessibility support
    - Support VoiceOver
    - Support Dynamic Type
    - Provide accessibility labels for all interactive elements
    - Support high contrast mode
    - Support reduced motion preferences
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 21.2 Write property test for accessibility labels
    - **Property 22: Accessibility Label Completeness**
    - **Validates: Requirements 17.3**

- [ ] 22. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
