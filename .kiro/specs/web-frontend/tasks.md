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

- [x] 2. Set up routing and layout
  - [x] 2.1 Configure React Router
    - Set up route definitions for all pages
    - Implement protected routes for authenticated pages
    - Configure route-based code splitting
    - _Requirements: 13.1, 13.3, 9.1_

  - [x] 2.2 Create AppLayout component
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

- [x] 3. Implement authentication system
  - [x] 3.1 Create authentication service
    - Implement login API call (returns access token with 15 min expiry, refresh token with 7 day expiry)
    - Implement logout functionality
    - Implement token refresh using refresh token
    - Implement JWT token decoding to extract user info (userId, email, role)
    - Implement getCurrentUser() to fetch from /auth/me endpoint
    - Store tokens securely in localStorage
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 3.2 Create LoginPage component
    - Render email and password fields using CloudScape
    - Validate inputs before submission
    - Display error messages using CloudScape Alert
    - Redirect to dashboard on success
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 3.3 Write property test for unauthenticated access protection
    - **Property 25: Unauthenticated Access Protection**
    - **Validates: Requirements 9.1, 9.2**

  - [x] 3.3 Create ProtectedRoute component
    - Check authentication status
    - Redirect to login if not authenticated
    - Check user role for authorization
    - _Requirements: 9.1, 9.2_

  - [x] 3.4 Implement role-based UI rendering
    - Show all features for ADMINISTRATOR
    - Show create/update/delete for EDITOR
    - Hide create/update/delete for READ_ONLY
    - _Requirements: 9.3, 9.4, 9.5_

  - [ ]* 3.5 Write property test for unauthorized action error messages
    - **Property 26: Unauthorized Action Error Messages**
    - **Validates: Requirements 9.6**

- [x] 4. Checkpoint - Verify authentication and routing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement activity type management UI
  - [x] 5.1 Create ActivityTypeList component
    - Display table using CloudScape Table
    - Distinguish predefined vs custom types with badges
    - Provide edit and delete actions
    - Handle delete validation (REFERENCED_ENTITY error)
    - Display version number for debugging
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

  - [x] 5.2 Create ActivityTypeForm component
    - Modal form for create/edit
    - Validate name is not empty
    - Include version field in update requests for optimistic locking
    - Submit to API and update cache
    - _Requirements: 2.2, 2.3, 2.7_

  - [ ]* 5.5 Write property test for non-empty name validation
    - **Property 4: Non-Empty Name Validation**
    - **Validates: Requirements 2.7, 3.7**

- [x] 6. Implement participant role management UI
  - [x] 6.1 Create ParticipantRoleList and ParticipantRoleForm components
    - Similar structure to activity type management
    - Include version field in update requests for optimistic locking
    - Handle REFERENCED_ENTITY errors on deletion
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 7. Implement participant management UI
  - [x] 7.1 Create ParticipantList component
    - Display table with search, sort, and filter
    - Use CloudScape Table with optional pagination support
    - Implement client-side search
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property test for participant list display
    - **Property 5: Participant List Display**
    - **Validates: Requirements 4.1**

  - [ ]* 7.3 Write property test for participant search
    - **Property 6: Participant Search Functionality**
    - **Validates: Requirements 4.2**

  - [x] 7.2 Create ParticipantForm component
    - Modal form for create/edit
    - Validate name, email format, and required fields
    - Support optional phone and notes
    - Support home venue selection (homeVenueId)
    - Include version field in update requests for optimistic locking
    - Display inline validation errors
    - Embed address history management section within the form
    - Allow adding new address history records with venue and effective start date
    - Allow editing existing address history records (edit mode only)
    - Allow deleting existing address history records (edit mode only)
    - Display address history table in reverse chronological order within the form
    - Validate address history for required fields and duplicate prevention
    - _Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18_

  - [ ]* 7.4 Write property tests for participant validation
    - **Property 7: Required Field Validation**
    - **Property 8: Email Format Validation**
    - **Property 9: Optional Field Acceptance**
    - **Validates: Requirements 4.7, 4.8, 4.9**

  - [x] 7.3 Create ParticipantDetail component
    - Show participant information
    - List all activities with roles
    - Display address history table in reverse chronological order
    - _Requirements: 4.10, 4.11_

  - [ ]* 7.5 Write property test for participant detail view
    - **Property 10: Participant Detail View Completeness**
    - **Validates: Requirements 4.10**

  - [x] 7.4 Create AddressHistoryTable component
    - Display address history in reverse chronological order by effective start date
    - Show venue name and effective start date
    - Highlight most recent address (first record)
    - Provide edit and delete buttons for each record
    - _Requirements: 4.11_

  - [ ]* 7.6 Write property test for address history display order
    - **Property 11: Address History Display Order**
    - **Validates: Requirements 4.11**

  - [x] 7.5 Create AddressHistoryForm component
    - Modal form for add/edit address history
    - Require venue selection from dropdown
    - Require effective start date using CloudScape DatePicker
    - Validate effective start date is provided
    - Prevent duplicate records with same effective start date
    - _Requirements: 4.12, 4.13, 4.14, 4.15, 4.16_

  - [ ]* 7.7 Write property tests for address history validation
    - **Property 12: Address History Required Fields**
    - **Property 13: Address History Duplicate Prevention**
    - **Validates: Requirements 4.15, 4.16**

  - [x] 7.6 Implement ParticipantAddressHistoryService
    - Implement getAddressHistory(participantId)
    - Implement createAddressHistory(participantId, data)
    - Implement updateAddressHistory(participantId, historyId, data)
    - Implement deleteAddressHistory(participantId, historyId)
    - Use /participants/:id/address-history endpoints
    - _Requirements: 4.12, 4.13, 4.14_

  - [ ] 7.7 Implement participant activities display
    - Add getParticipantActivities(id) method to ParticipantService
    - Update ParticipantDetail to fetch participant activities using /participants/:id/activities endpoint
    - Display activities table with columns: activity name (linked), type, role, status, dates, notes
    - Show loading state while fetching activities
    - Show empty state when participant has no activities
    - Format dates using formatDate() utility
    - Handle ongoing activities (display "Ongoing" instead of end date)
    - _Requirements: 4.10_

- [x] 8. Implement venue management UI
  - [x] 8.1 Create VenueList component
    - Display table with name, address, and geographic area
    - Implement search via /venues/search?q= endpoint, sort, and filter
    - Support optional pagination
    - _Requirements: 6A.1, 6A.2, 6A.3_

  - [ ]* 8.2 Write property tests for venue list and search
    - **Property 44: Venue List Display**
    - **Property 45: Venue Search Functionality**
    - **Validates: Requirements 6A.1, 6A.2**

  - [x] 8.2 Create VenueForm component
    - Validate required fields (name, address, geographic area)
    - Support optional latitude, longitude, venue type
    - Include version field in update requests for optimistic locking
    - Handle delete validation (REFERENCED_ENTITY error)
    - _Requirements: 6A.4, 6A.5, 6A.6, 6A.7, 6A.8, 6A.10, 6A.11_

  - [ ]* 8.3 Write property tests for venue validation
    - **Property 46: Venue Required Field Validation**
    - **Property 47: Venue Optional Field Acceptance**
    - **Property 48: Venue Deletion Prevention**
    - **Validates: Requirements 6A.7, 6A.8, 6A.10, 6A.11**

  - [x] 8.3 Create VenueDetail component
    - Show venue information
    - List associated activities from /venues/:id/activities endpoint
    - List participants with venue as home from /venues/:id/participants endpoint
    - Display geographic area hierarchy using /geographic-areas/:id/ancestors endpoint
    - _Requirements: 6A.9_

  - [ ]* 8.4 Write property test for venue detail view
    - **Property 49: Venue Detail View Completeness**
    - **Validates: Requirements 6A.9**

  - [x] 8.5 Implement Nominatim geocoding integration
    - [x] 8.5.1 Create GeocodingService
      - Implement geocodeAddress(address) method to query Nominatim API
      - Use Nominatim search endpoint: https://nominatim.openstreetmap.org/search
      - Include User-Agent header as required by Nominatim usage policy
      - Implement rate limiting (max 1 request per second)
      - Parse Nominatim response to extract coordinates and display names
      - Cache recent geocoding results to reduce API calls
      - Handle API errors and network failures gracefully
      - _Requirements: 21.1, 21.3, 21.9_

    - [x] 8.5.2 Create VenueFormMapView component
      - Create reusable map component for venue form using Leaflet
      - Display map positioned to the right of form fields
      - Render draggable marker when coordinates are provided
      - Set map zoom to level 15 when coordinates are first populated
      - Track whether user has manually adjusted zoom level
      - Handle marker drag events to extract new coordinates
      - Provide callback to update parent form state with new coordinates
      - Center map on marker when coordinates change (without resetting zoom if user-adjusted)
      - Preserve user-adjusted zoom level during coordinate updates
      - Handle empty coordinate state (no marker displayed)
      - _Requirements: 21.11, 21.12, 21.13, 21.14, 21.18_

    - [x] 8.5.3 Update VenueForm component with geocoding and map
      - Add "Geocode Address" button next to latitude/longitude fields
      - Disable geocode button when address field is empty
      - Disable geocode button when offline
      - Display loading indicator during geocoding request
      - On single result: automatically populate latitude and longitude fields
      - On multiple results: display selection dialog with result list
      - On no results: display error message
      - Allow manual editing of geocoded coordinates
      - Integrate VenueFormMapView component in form layout
      - Position map view to the right of form fields using grid or flex layout
      - Pass latitude/longitude state to map component
      - Update latitude/longitude state when map pin is dragged
      - Update map pin when latitude/longitude inputs are manually edited
      - Maintain two-way synchronization between inputs and map
      - Preserve user-adjusted zoom level during coordinate updates
      - _Requirements: 21.2, 21.4, 21.5, 21.6, 21.7, 21.8, 21.10, 21.11, 21.12, 21.13, 21.14, 21.15, 21.16, 21.17, 21.18_

    - [ ]* 8.5.4 Write property tests for geocoding and map interaction
      - **Property 69: Geocoding Request Success**
      - **Property 70: Geocoding Coordinate Population**
      - **Property 71: Geocoding Multiple Results Handling**
      - **Property 72: Geocoding Error Handling**
      - **Property 73: Geocoding Loading State**
      - **Property 74: Geocoding Manual Override**
      - **Property 75: Geocoding Offline Behavior**
      - **Property 87: Map View Display in Venue Form**
      - **Property 88: Map Pin Rendering**
      - **Property 89: Map Zoom Level**
      - **Property 90: Pin Drag Updates Coordinates**
      - **Property 91: Coordinate Input Updates Pin**
      - **Property 92: Two-Way Coordinate Synchronization**
      - **Property 93: Zoom Level Preservation**
      - **Validates: Requirements 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.10, 21.11, 21.12, 21.13, 21.14, 21.15, 21.16, 21.17, 21.18**

- [x] 9. Implement geographic area management UI
  - [x] 9.1 Create GeographicAreaList component
    - Display hierarchical tree view using CloudScape TreeView component
    - Use TreeView with items prop containing hierarchical data structure
    - Manage expanded state with expandedItems and onExpandedItemsChange props
    - Enable vertical connector lines with connectorLines="vertical" prop
    - Show area type badges for each node with increased vertical spacing
    - Auto-expand all nodes on page load using useEffect to collect all node IDs
    - Implement click-to-toggle expansion on row click for nodes with children
    - Add hover highlighting with smooth background color transitions
    - Show pointer cursor for expandable rows, default cursor for leaf nodes
    - Prevent action button clicks from triggering row toggle with stopPropagation
    - Provide View, Edit, and Delete actions per node based on permissions
    - Support optional pagination
    - Handle delete validation (REFERENCED_ENTITY error)
    - _Requirements: 6B.1, 6B.4, 6B.9, 6B.10_

  - [ ]* 9.2 Write property test for hierarchical display
    - **Property 50: Geographic Area Hierarchical Display**
    - **Validates: Requirements 6B.1**

  - [x] 9.2 Create GeographicAreaForm component
    - Validate required fields (name, area type)
    - Support parent selection
    - Prevent circular relationships (CIRCULAR_REFERENCE error)
    - Include version field in update requests for optimistic locking
    - _Requirements: 6B.2, 6B.3, 6B.5, 6B.6, 6B.7_

  - [ ]* 9.3 Write property tests for geographic area validation
    - **Property 51: Geographic Area Required Field Validation**
    - **Property 52: Circular Relationship Prevention**
    - **Property 53: Geographic Area Deletion Prevention**
    - **Validates: Requirements 6B.5, 6B.7, 6B.9, 6B.10**

  - [x] 9.3 Create GeographicAreaDetail component
    - Display full hierarchy path using /geographic-areas/:id/ancestors endpoint
    - List child areas from /geographic-areas/:id/children endpoint
    - List associated venues from /geographic-areas/:id/venues endpoint
    - Show statistics from /geographic-areas/:id/statistics endpoint
    - _Requirements: 6B.8, 6B.11_

  - [ ]* 9.4 Write property test for hierarchy path display
    - **Property 54: Geographic Area Hierarchy Path Display**
    - **Validates: Requirements 6B.11**

- [x] 10. Checkpoint - Verify core entity management UI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement activity management UI
  - [x] 11.1 Create ActivityList component
    - Display table with filtering by type and status (PLANNED, ACTIVE, COMPLETED, CANCELLED)
    - Visually distinguish finite vs ongoing
    - Provide sort capabilities
    - Support optional pagination
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.11_

  - [ ]* 11.2 Write property tests for activity list
    - **Property 11: Activity List Display**
    - **Property 12: Activity Filtering**
    - **Property 13: Finite vs Ongoing Activity Distinction**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x] 11.2 Create ActivityForm component
    - Conditionally require end date for finite activities
    - Allow null end date for ongoing
    - Validate name, type, start date
    - Support all four status values (PLANNED, ACTIVE, COMPLETED, CANCELLED)
    - Support venue selection and management
    - Include version field in update requests for optimistic locking
    - Embed venue history management section within the form
    - Allow adding new venue associations with effective start dates
    - Allow editing existing venue associations (edit mode only)
    - Allow deleting existing venue associations (edit mode only)
    - Display venue history table in reverse chronological order within the form
    - Validate venue associations for required fields and duplicate prevention
    - _Requirements: 5.5, 5.6, 5.8, 5.9, 5.10, 5.11, 5.12, 5.14, 5.15, 5.16, 5.17_

  - [ ]* 11.3 Write property tests for activity validation
    - **Property 14: Finite Activity End Date Requirement**
    - **Property 15: Ongoing Activity Null End Date**
    - **Validates: Requirements 5.8, 5.9**

  - [x] 11.3 Create ActivityDetail component
    - Show activity information with all status values
    - List assigned participants with roles from /activities/:id/participants endpoint
    - Display venue history table in reverse chronological order
    - Provide status update button (not just "Mark Complete")
    - Support adding/removing venues via /activities/:id/venues endpoints
    - _Requirements: 5.11, 5.12, 5.13, 5.14_

  - [ ]* 11.4 Write property test for activity detail view
    - **Property 16: Activity Detail View Completeness**
    - **Validates: Requirements 5.12**

  - [x] 11.4 Create ActivityVenueHistoryTable component
    - Display venue history in reverse chronological order by effective start date
    - Show venue name and effective start date
    - Highlight most recent venue (first record)
    - Provide delete button for each record
    - _Requirements: 5.14_

  - [x] 11.5 Create ActivityVenueHistoryForm component
    - Modal form for adding venue associations
    - Require venue selection from dropdown
    - Require effective start date using CloudScape DatePicker
    - Validate effective start date is provided
    - Prevent duplicate records with same effective start date
    - _Requirements: 5.13, 5.14_

  - [x] 11.6 Implement ActivityVenueHistoryService
    - Implement getActivityVenues(activityId)
    - Implement addActivityVenue(activityId, venueId, effectiveFrom)
    - Implement deleteActivityVenue(activityId, venueId)
    - Use /activities/:id/venues endpoints
    - _Requirements: 5.13, 5.14_

- [x] 12. Implement assignment management UI
  - [x] 12.1 Create AssignmentForm component
    - Require role selection
    - Validate role is selected
    - Prevent duplicate assignments (DUPLICATE_ASSIGNMENT error)
    - Support optional notes field
    - Use /activities/:activityId/participants endpoint
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

  - [ ]* 12.2 Write property tests for assignments
    - **Property 17: Assignment Role Requirement**
    - **Property 18: Assignment Display Completeness**
    - **Property 19: Duplicate Assignment Prevention**
    - **Validates: Requirements 6.2, 6.3, 6.5, 6.6**

  - [x] 12.2 Create AssignmentList component
    - Display assigned participants on activity detail
    - Show participant name, role, and notes
    - Provide remove button using DELETE /activities/:activityId/participants/:participantId
    - Support updating assignments via PUT /activities/:activityId/participants/:participantId
    - _Requirements: 6.3, 6.4_

- [x] 13. Implement map view UI
  - [x] 13.1 Create MapView component
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

  - [x] 13.2 Create MapFilters component
    - Provide filter controls for type, status, date range
    - Update markers based on filters
    - Support geographic area boundary toggle
    - Provide center button
    - Display legend
    - _Requirements: 6C.5, 6C.6, 6C.8, 6C.9, 6C.10_

- [x] 14. Implement analytics dashboards
  - [x] 14.1 Create EngagementDashboard component
    - Display comprehensive temporal metrics using CloudScape Cards:
      - Activities at start/end of date range
      - Activities started, completed, cancelled within range
      - Participants at start/end of date range
      - New participants and disengaged participants
    - Display aggregate counts and breakdowns by activity type
    - Render charts for activities by type and role distribution
    - Provide multi-dimensional grouping controls:
      - Activity type grouping
      - Venue grouping
      - Geographic area grouping
      - Date grouping (weekly, monthly, quarterly, yearly)
    - Provide flexible filter controls:
      - Activity type filter (dropdown)
      - Venue filter (dropdown)
      - Geographic area filter (dropdown, includes descendants)
      - Date range filter using CloudScape DateRangePicker
    - Render grouped results in CloudScape Table when multiple grouping dimensions selected:
      - Display breakdown dimension columns first (activity type, venue, geographic area, date period)
      - Display metric aggregation columns after dimensions (activities at start, at end, started, completed, cancelled, participants at start, at end, new, disengaged)
      - Render activity type names as hyperlinks to edit forms or detail views
      - Render venue names as hyperlinks to /venues/:id using CloudScape Link component
      - Render geographic area names as hyperlinks to /geographic-areas/:id using CloudScape Link component
      - Display each metric in its own column for easy comparison
    - Show role distribution within filtered and grouped results
    - Display geographic breakdown chart showing engagement by geographic area
    - Allow drilling down into child geographic areas
    - Display all-time metrics when no date range specified
    - Synchronize all filter and grouping parameters with URL query parameters:
      - Read URL parameters on component mount to initialize dashboard state
      - Update URL when user changes filters or grouping (using React Router's useSearchParams or similar)
      - Support parameters: activityType, venue, geographicArea, startDate, endDate, groupBy (array), dateGranularity
      - Enable browser back/forward navigation between different configurations
      - Ensure URL updates don't cause page reloads (use history.pushState or React Router navigation)
    - Use /analytics/engagement endpoint with enhanced parameters
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27, 7.28, 7.29, 7.30, 7.31, 7.32, 7.33, 7.34, 7.35, 7.36, 7.37, 7.38, 7.39, 7.40, 7.41_

  - [ ]* 14.2 Write property tests for engagement metrics
    - **Property 23: Temporal Activity Metrics Display**
    - **Property 24: Temporal Participant Metrics Display**
    - **Property 25: Aggregate and Breakdown Display**
    - **Property 26: Multi-Dimensional Grouping Controls**
    - **Property 27: Filter Control Availability**
    - **Property 28: Grouped Results Table Display**
    - **Property 28a: Dimension Hyperlinks in Grouped Results**
    - **Property 28b: Metric Columns in Grouped Results**
    - **Property 29: Multiple Filter Application**
    - **Property 30: All-Time Metrics Display**
    - **Property 31: Role Distribution Display**
    - **Property 31a: Analytics URL Parameter Synchronization**
    - **Property 31b: Analytics URL Parameter Application**
    - **Property 31c: Analytics URL Update on State Change**
    - **Property 31d: Analytics Browser Navigation Support**
    - **Property 31e: Analytics URL Shareability**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27, 7.28, 7.29, 7.30, 7.31, 7.32, 7.33**

  - [x] 14.2 Create GrowthDashboard component
    - Display time-series charts for new participants and activities
    - Provide time period selector (DAY, WEEK, MONTH, YEAR) using period parameter
    - Show percentage changes between periods
    - Display cumulative counts over time
    - Provide geographic area filter (optional geographicAreaId)
    - Use /analytics/growth endpoint with optional startDate, endDate, period, geographicAreaId
    - _Requirements: 7.34, 7.35, 7.36, 7.37, 7.38, 7.39_

  - [ ]* 14.3 Write property tests for growth metrics
    - **Property 32: Time-Series Data Calculation**
    - **Property 33: Percentage Change Calculation**
    - **Property 34: Cumulative Count Calculation**
    - **Validates: Requirements 7.35, 7.36, 7.37, 7.38**

  - [x] 14.3 Create GeographicAnalyticsDashboard component
    - Display geographic breakdown using /analytics/geographic endpoint
    - Show metrics by geographic area (geographicAreaId, geographicAreaName, areaType, totalActivities, activeActivities, totalParticipants, activeParticipants)
    - Provide optional date range filter (startDate, endDate)
    - _Requirements: 7.40, 7.41_

- [x] 15. Implement offline support
  - [x] 15.1 Create OfflineStorage service
    - Use Dexie.js for IndexedDB management
    - Store tables for all entities (participants, activities, activityTypes, roles, assignments, venues, geographicAreas)
    - Implement syncFromServer to fetch and cache all data
    - Implement getLocalData
    - _Requirements: 10.1, 10.2_

  - [ ]* 15.2 Write property test for offline data caching
    - **Property 27: Offline Data Caching**
    - **Validates: Requirements 10.2**

  - [x] 15.2 Create SyncQueue service
    - Store pending operations in IndexedDB with proper format (entityType, entityId, operation, data, timestamp, version)
    - Implement enqueue, processQueue, clearQueue
    - Use /sync/batch endpoint for synchronization
    - Implement exponential backoff for retries
    - Handle sync results including conflicts and errors
    - _Requirements: 10.3, 11.2, 11.3, 11.4_

  - [ ]* 15.3 Write property tests for sync queue
    - **Property 28: Offline Operation Queueing**
    - **Property 30: Sync Queue Processing**
    - **Property 31: Sync Retry with Exponential Backoff**
    - **Property 32: Pending Operation Count Display**
    - **Validates: Requirements 10.3, 11.2, 11.3, 11.4, 11.6**

  - [x] 15.3 Create ConnectionMonitor service
    - Listen to online/offline events
    - Update global connection state
    - Trigger sync when connectivity restored
    - _Requirements: 10.5, 11.1_

  - [ ]* 15.4 Write property test for offline feature indication
    - **Property 29: Offline Feature Indication**
    - **Validates: Requirements 10.6, 10.7**

- [x] 16. Implement PWA capabilities
  - [x] 16.1 Create service worker
    - Cache static assets
    - Implement offline detection
    - _Requirements: 12.3, 12.4_

  - [x] 16.2 Create web app manifest
    - Configure icons and colors
    - Enable installability
    - Provide splash screen
    - _Requirements: 12.1, 12.2, 12.5_

- [x] 17. Implement form validation and error handling
  - [x] 17.1 Create validation utilities
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

  - [x] 17.2 Create error handling utilities
    - Display user-friendly error messages
    - Use toast notifications for transient errors
    - Use modal dialogs for critical errors
    - Handle VERSION_CONFLICT errors (409) with conflict resolution UI
    - Handle RATE_LIMIT_EXCEEDED errors (429) with retry logic
    - Parse and display specific error codes (VALIDATION_ERROR, REFERENCED_ENTITY, CIRCULAR_REFERENCE, etc.)
    - Maintain application state during errors
    - Log errors to console
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 18.2, 18.3, 19.1, 19.2_

  - [ ]* 17.3 Write property tests for error handling
    - **Property 38: Error Notification Type**
    - **Property 39: Error State Preservation**
    - **Property 40: Error Console Logging**
    - **Validates: Requirements 15.2, 15.3, 15.5, 15.6**

  - [x] 17.3 Create date formatting utility
    - Implement formatDate() function to convert ISO-8601 strings to YYYY-MM-DD format
    - Handle both full datetime strings and date-only strings
    - Apply to all date displays in tables, detail views, forms, and charts
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [ ]* 17.4 Write property test for date formatting
    - **Property 68: Date Formatting Consistency**
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7**

- [x] 17A. Implement optimistic locking and conflict resolution
  - [x] 17A.1 Create version conflict detection utility
    - Detect 409 errors with VERSION_CONFLICT code
    - Extract version information from error response
    - _Requirements: 18.2_

  - [x] 17A.2 Create conflict resolution UI component
    - Display conflict notification modal
    - Show current vs server version differences
    - Provide options: retry with latest, discard changes, view details
    - Refetch latest entity data on conflict
    - _Requirements: 18.2, 18.3, 18.4_

  - [x] 17A.3 Update all entity forms to include version
    - Pass version field in all update requests
    - Handle version conflicts gracefully
    - _Requirements: 18.1_

  - [ ]* 17A.4 Write property tests for optimistic locking
    - Test version conflict detection
    - Test conflict resolution flow
    - Test version field inclusion in updates
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4**

- [x] 17B. Implement rate limiting handling
  - [x] 17B.1 Create rate limit detection utility
    - Detect 429 errors with RATE_LIMIT_EXCEEDED code
    - Parse X-RateLimit-* headers from responses
    - Calculate retry-after time from X-RateLimit-Reset header
    - _Requirements: 19.1, 19.2_

  - [x] 17B.2 Create rate limit notification component
    - Display rate limit exceeded message
    - Show countdown timer for retry-after period
    - Display remaining request counts when available
    - _Requirements: 19.1, 19.2, 19.5_

  - [x] 17B.3 Implement automatic retry logic
    - Queue requests when rate limited
    - Automatically retry after cooldown period
    - Log rate limit events for debugging
    - _Requirements: 19.3, 19.4_

  - [ ]* 17B.4 Write property tests for rate limiting
    - Test rate limit detection
    - Test retry logic
    - Test cooldown period calculation
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4**

- [x] 18. Implement loading states
  - [x] 18.1 Create loading components
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

- [x] 19. Implement user management (admin only)
  - [x] 19.1 Create UserList and UserForm components
    - Display table of all users (admin only)
    - Allow role assignment and modification
    - Hide from non-administrators
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 20. Checkpoint - Verify error handling and conflict resolution
  - Ensure all tests pass, ask the user if questions arise.
  - Verify optimistic locking works correctly
  - Verify rate limiting is handled gracefully

- [x] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Implement hyperlinked primary columns in tables
  - [x] 22.1 Update primary entity list components
    - Update ActivityList: Make activity name column hyperlinked to /activities/:id
    - Update ParticipantList: Make participant name column hyperlinked to /participants/:id
    - Update VenueList: Make venue name column hyperlinked to /venues/:id
    - Update ActivityTypeList: Make activity type name column hyperlinked (to edit form or detail)
    - Update ParticipantRoleList: Make role name column hyperlinked (to edit form or detail)
    - Update UserList: Make user email column hyperlinked (to edit form, admin only)
    - Remove "View" action buttons from Actions column in all list components
    - Use CloudScape Link component for all hyperlinks
    - Preserve Edit and Delete action buttons where appropriate
    - _Requirements: 22.1, 22.2, 22.3, 22.5, 22.6, 22.7_

  - [x] 22.2 Update detail page associated record tables
    - Update AddressHistoryTable: Make venue name column hyperlinked to /venues/:id
    - Update ActivityVenueHistoryTable: Make venue name column hyperlinked to /venues/:id
    - Update AssignmentList (on ActivityDetail): Make participant name column hyperlinked to /participants/:id
    - Update VenueDetail activity table: Make activity name column hyperlinked to /activities/:id
    - Update VenueDetail participant table: Make participant name column hyperlinked to /participants/:id
    - Update ParticipantDetail activity table: Already implemented with hyperlinked activity names
    - Remove "View" action buttons from these tables where present
    - Use CloudScape Link component for all hyperlinks
    - _Requirements: 22.4, 22.5, 22.6_

  - [ ]* 22.3 Write property test for hyperlinked primary columns
    - **Property 76: Hyperlinked Primary Column Navigation**
    - Test that clicking hyperlinked primary column navigates to correct detail view
    - Test that View buttons are not present when primary column is hyperlinked
    - Test that Edit and Delete buttons are preserved
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.7**

- [x] 23. Implement edit action buttons on detail pages
  - [x] 23.1 Update ParticipantDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Open ParticipantForm when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [x] 23.2 Update ActivityDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Open ActivityForm when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [x] 23.3 Update VenueDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Open VenueForm when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [x] 23.4 Update GeographicAreaDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Open GeographicAreaForm when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [ ]* 23.5 Write property tests for edit buttons on detail pages
    - **Property 79: Edit Button on Detail Pages**
    - **Property 80: Edit Button Opens Edit Form**
    - Test that edit button is displayed in header for EDITOR and ADMINISTRATOR roles
    - Test that edit button is hidden for READ_ONLY role
    - Test that edit button is positioned as right-most action
    - Test that clicking edit button opens the edit form
    - **Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.6**

- [ ] 24. Implement global persistent geographic area filter
  - [ ] 24.1 Create GlobalGeographicFilterContext
    - Create React context for global geographic area filter state
    - Provide selectedGeographicAreaId (string | null)
    - Provide selectedGeographicArea (GeographicArea | null)
    - Provide setGeographicAreaFilter(id: string | null) method
    - Provide clearFilter() method
    - Provide isLoading boolean
    - Implement URL query parameter synchronization (?geographicArea=<id>)
    - Implement localStorage persistence (key: 'globalGeographicAreaFilter')
    - Restore filter from localStorage on app initialization
    - URL parameter takes precedence over localStorage
    - Fetch full geographic area details when filter is set
    - _Requirements: 24.1, 24.2, 24.3, 24.6, 24.7, 24.8, 24.9_

  - [ ] 24.2 Create useGlobalGeographicFilter hook
    - Export custom hook to access GlobalGeographicFilterContext
    - Provide convenient access to filter state and methods
    - _Requirements: 24.1, 24.2, 24.3_

  - [ ] 24.3 Update AppLayout component with filter selector
    - Add geographic area filter selector in header utilities section
    - Use CloudScape Select component with hierarchical options
    - Display "Global (All Areas)" as default option
    - Show current filter selection or "Global" when no filter active
    - Provide clear button (X icon) to remove filter
    - Display visual indicator (badge or highlighted text) of active filter
    - Position prominently in header for accessibility from all views
    - _Requirements: 24.1, 24.2, 24.3, 24.10, 24.11_

  - [ ] 24.4 Update ActivityList to apply global filter
    - Read selectedGeographicAreaId from GlobalGeographicFilterContext
    - Pass geographicAreaId to ActivityService.getActivities()
    - Update React Query key to include filter
    - Display filtered results only
    - _Requirements: 24.4, 24.5_

  - [ ] 24.5 Update ParticipantList to apply global filter
    - Read selectedGeographicAreaId from GlobalGeographicFilterContext
    - Pass geographicAreaId to ParticipantService.getParticipants()
    - Update React Query key to include filter
    - Display filtered results only
    - _Requirements: 24.4, 24.5_

  - [ ] 24.6 Update VenueList to apply global filter
    - Read selectedGeographicAreaId from GlobalGeographicFilterContext
    - Pass geographicAreaId to VenueService.getVenues()
    - Update React Query key to include filter
    - Display filtered results only
    - _Requirements: 24.4, 24.5_

  - [ ] 24.7 Update GeographicAreaList to apply global filter
    - Read selectedGeographicAreaId from GlobalGeographicFilterContext
    - Pass geographicAreaId to GeographicAreaService.getGeographicAreas()
    - Update React Query key to include filter
    - Display filtered hierarchy (selected area, descendants, and ancestors)
    - _Requirements: 24.4, 24.5_

  - [ ] 24.8 Update API service methods to accept geographic area filter
    - Update ActivityService.getActivities(page?, limit?, geographicAreaId?)
    - Update ParticipantService.getParticipants(page?, limit?, geographicAreaId?)
    - Update VenueService.getVenues(page?, limit?, geographicAreaId?)
    - Update GeographicAreaService.getGeographicAreas(page?, limit?, geographicAreaId?)
    - Add geographicAreaId as query parameter in API requests
    - _Requirements: 24.4, 24.5_

  - [ ]* 24.9 Write property tests for global filter
    - **Property 81: Global Filter URL Synchronization**
    - **Property 82: Global Filter Persistence**
    - **Property 83: Global Filter Restoration**
    - **Property 84: Recursive Geographic Filtering**
    - **Property 85: Global Filter Application to All Lists**
    - **Property 86: Global Filter Clear Functionality**
    - **Validates: Requirements 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.11**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases

## Implementation Notes for Embedded History Management

**ParticipantForm with Address History:**
- The ParticipantForm component should include an embedded section for managing address history
- In create mode: Allow adding address history records that will be created after the participant is created
- In edit mode: Display existing address history records with add/edit/delete capabilities
- Use a mini-table or expandable section within the form to display address history
- Validate address history records before form submission
- Submit participant data and address history changes in appropriate sequence

**ActivityForm with Venue History:**
- The ActivityForm component should include an embedded section for managing venue associations
- In create mode: Allow adding venue associations that will be created after the activity is created
- In edit mode: Display existing venue associations with add/edit/delete capabilities
- Use a mini-table or expandable section within the form to display venue history
- Validate venue associations before form submission
- Submit activity data and venue association changes in appropriate sequence

## API Alignment Notes

This implementation plan has been updated to align with the Backend API contract defined in `/docs/API_CONTRACT.md`:

**Key API Contract Features:**
- All responses wrapped in `{ success: true, data: {...} }` format
- Optimistic locking via `version` field on all entities
- Optional pagination on list endpoints (page, limit query params)
- Rate limiting with X-RateLimit-* headers
- Comprehensive error codes (VERSION_CONFLICT, RATE_LIMIT_EXCEEDED, REFERENCED_ENTITY, etc.)
- Activity status: PLANNED, ACTIVE, COMPLETED, CANCELLED
- Token expiration: 15 min (access), 7 days (refresh)
- Assignment notes field support

**Implementation Priorities:**
1. High: Activity status values, optimistic locking, response format handling
2. Medium: Rate limiting, version conflict UI, error code mapping
3. Low: Rate limit display, advanced conflict resolution

See `API_ALIGNMENT_SUMMARY.md` for detailed alignment documentation.
