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
    - Add routes for major entity form pages:
      - /participants/new (create participant)
      - /participants/:id/edit (edit participant)
      - /activities/new (create activity)
      - /activities/:id/edit (edit activity)
      - /venues/new (create venue)
      - /venues/:id/edit (edit venue)
      - /geographic-areas/new (create geographic area)
      - /geographic-areas/:id/edit (edit geographic area)
    - Implement protected routes for authenticated pages
    - Configure route-based code splitting
    - _Requirements: 13.1, 13.3, 9.1, 2A.5_

  - [x] 2.2 Create AppLayout component
    - Use CloudScape AppLayout component
    - Implement sticky header positioning using CSS (position: sticky with top: 0, or position: fixed)
    - Apply z-index to ensure header stays above page content
    - Adjust content area padding-top to account for sticky header height
    - Ensure header remains visible during vertical scrolling
    - Implement navigation sidebar with links
    - Display user menu with name, role, and logout
    - Show connection status indicator
    - Highlight current active section
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.9, 13.10, 13.11, 10.5_

  - [x] 2.2a Create DashboardPage with role-based quick links
    - Display quick links for key sections (Geographic Areas, Venues, Activities, Participants, Map, Analytics, About)
    - Filter quick links based on user role
    - Hide User Administration quick link from non-administrators
    - Show User Administration quick link only for ADMINISTRATOR role
    - _Requirements: 13.6, 13.7, 13.8_

  - [ ]* 2.3 Write property test for active navigation highlighting
    - **Property 33: Active Navigation Highlighting**
    - **Validates: Requirements 13.2**

  - [ ]* 2.4 Write property test for navigation state persistence
    - **Property 34: Navigation State Persistence**
    - **Validates: Requirements 13.3**

  - [ ]* 2.5 Write property test for dashboard quick link visibility
    - **Property 44a: Dashboard Quick Link Visibility**
    - **Validates: Requirements 13.7, 13.8**

  - [ ]* 2.6 Write property tests for sticky header
    - **Property 43b: Sticky Header Visibility**
    - **Property 43c: Sticky Header Content Clearance**
    - **Validates: Requirements 13.9, 13.10, 13.11**

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
    - Read redirect URL from query parameter (?redirect=/original/path)
    - Store redirect URL in component state
    - On successful authentication, redirect to stored URL if present, otherwise redirect to dashboard
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.8, 8.9_

  - [x] 3.2a Implement animated login transition
    - [x] 3.2a.1 Create animation state management in LoginPage
      - Add state to track animation phase (idle, formFadeOut, iconAnimation, complete)
      - Trigger animation sequence on successful authentication
      - Delay navigation until animation completes
      - _Requirements: 8.10, 8.14_

    - [x] 3.2a.2 Implement form fade out animation
      - Wrap login form in container div with fade-out CSS transition
      - Set opacity to 0 over 1000ms when authentication succeeds
      - Use CSS transition or React state + inline styles
      - _Requirements: 8.11_

    - [x] 3.2a.3 Create IconAnimation component
      - Load and display icon-no-bg.svg centered on screen at 256x256 pixels
      - Implement SVG stroke animation using CSS stroke-dasharray and stroke-dashoffset
      - Calculate total path length using getTotalLength() for accurate animation
      - Animate stroke from 0% to 100% over 2000ms
      - Use CSS keyframe animation or React animation library
      - _Requirements: 8.12, 8.13_

    - [x] 3.2a.4 Orchestrate animation sequence timing
      - Chain animations using setTimeout or Promise-based delays
      - Ensure proper timing: 1000ms (form) → 2000ms (icon) → navigate
      - Handle cleanup if component unmounts during animation
      - Navigate to destination page after complete sequence
      - _Requirements: 8.10, 8.14_

    - [ ]* 3.2a.5 Write property tests for login animation
      - **Property 34b: Login Animation Sequence Execution**
      - **Property 34c: Login Form Fade Out Timing**
      - **Property 34d: Icon Stroke Animation Timing**
      - **Property 34e: Animation Sequence Ordering**
      - **Validates: Requirements 8.10, 8.11, 8.12, 8.13, 8.14**

  - [ ]* 3.3 Write property test for unauthenticated access protection
    - **Property 25: Unauthenticated Access Protection**
    - **Validates: Requirements 9.1, 9.2**

  - [ ]* 3.3a Write property test for post-authentication redirect
    - **Property 34a: Post-Authentication Redirect to Original URL**
    - **Validates: Requirements 8.8, 8.9**

  - [x] 3.3 Create ProtectedRoute component
    - Check authentication status
    - When user is not authenticated, capture current URL path and query parameters
    - Redirect to login with original URL as query parameter (/login?redirect=/original/path)
    - Check user role for authorization
    - _Requirements: 9.1, 9.2, 8.8_

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

- [x] 5. Implement activity configuration UI
  - [x] 5.1 Create ActivityCategoryList component
    - Display table using CloudScape Table
    - Distinguish predefined vs custom categories with badges
    - Provide edit and delete actions
    - Handle delete validation (REFERENCED_ENTITY error when activity types reference it)
    - Display version number for debugging
    - _Requirements: 2.2, 2.6, 2.7, 2.8_

  - [x] 5.2 Create ActivityCategoryForm component
    - Modal form for create/edit
    - Validate name is not empty
    - Include version field in update requests for optimistic locking
    - Submit to API and update cache
    - _Requirements: 2.4, 2.5, 2.9_

  - [x] 5.3 Create ActivityTypeList component
    - Display table using CloudScape Table
    - Group activity types by their category
    - Distinguish predefined vs custom types with badges
    - Show associated activity category for each type
    - Provide edit and delete actions
    - Handle delete validation (REFERENCED_ENTITY error when activities reference it)
    - Display version number for debugging
    - _Requirements: 2.3, 2.12, 2.14, 2.15_

  - [ ]* 5.4 Write property test for type/role distinction
    - **Property 1: Type/Role Distinction in Lists**
    - **Validates: Requirements 2.1, 3.1**

  - [ ]* 5.5 Write property test for referential integrity on deletion
    - **Property 2: Referential Integrity on Deletion**
    - **Validates: Requirements 2.5, 3.5**

  - [ ]* 5.6 Write property test for deletion error messages
    - **Property 3: Deletion Error Messages**
    - **Validates: Requirements 2.6, 3.6**

  - [x] 5.4 Create ActivityTypeForm component
    - Modal form for create/edit
    - Require activity category selection from dropdown
    - Validate name is not empty
    - Validate activity category is selected
    - Include version field in update requests for optimistic locking
    - Submit to API and update cache
    - _Requirements: 2.10, 2.11, 2.13, 2.16_

  - [ ]* 5.7 Write property test for non-empty name validation
    - **Property 4: Non-Empty Name Validation**
    - **Validates: Requirements 2.9, 2.16, 3.7**

  - [x] 5.5 Create ConfigurationPage
    - Unified interface for managing activity categories, activity types, and participant roles
    - Display all three tables in cohesive layout on single page
    - Stack tables vertically using CloudScape SpaceBetween component
    - Display in order: Activity Categories, Activity Types, Participant Roles
    - Shows hierarchical relationship between categories and types
    - Provides easy navigation between category, type, and role management
    - _Requirements: 2.1, 2.19, 2.20_

- [x] 6. Implement participant role management UI
  - [x] 6.1 Create ParticipantRoleList and ParticipantRoleForm components
    - Similar structure to activity type management
    - Include version field in update requests for optimistic locking
    - Handle REFERENCED_ENTITY errors on deletion
    - Integrate ParticipantRoleList into ConfigurationPage
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6A. Implement population management UI (admin only)
  - [x] 6A.1 Create PopulationList component
    - Display table using CloudScape Table
    - Render population name as hyperlink in primary column
    - Provide edit and delete actions per row (no separate View button)
    - Handle delete validation (REFERENCED_ENTITY error when participants reference it)
    - Restrict edit and delete actions to ADMINISTRATOR role only
    - Allow all roles to view populations
    - Display version number for debugging
    - _Requirements: 3A.1, 3A.4, 3A.5, 3A.6, 3A.8, 3A.9, 3A.10_

  - [x] 6A.2 Create PopulationForm component
    - Modal form for create/edit
    - Validate name is not empty
    - Include version field in update requests for optimistic locking
    - Submit to API and update cache
    - Only accessible to ADMINISTRATOR role
    - _Requirements: 3A.2, 3A.3, 3A.7, 3A.8_

  - [x] 6A.3 Integrate PopulationList into ConfigurationPage
    - Add PopulationList to ConfigurationPage after ParticipantRoleList
    - Update page header to reflect four configuration entities
    - Stack all four tables vertically with consistent spacing
    - Display in order: Activity Categories, Activity Types, Participant Roles, Populations
    - _Requirements: 2.1, 2.20, 2.21, 3A.10_

  - [ ]* 6A.4 Write property tests for population management
    - **Property 1: Type/Role/Population Distinction in Lists**
    - **Property 2: Referential Integrity on Deletion**
    - **Property 3: Deletion Error Messages**
    - **Property 4: Non-Empty Name Validation**
    - **Property 168: Population Administrator Restriction**
    - **Validates: Requirements 3A.1, 3A.2, 3A.3, 3A.4, 3A.5, 3A.6, 3A.7, 3A.8, 3A.9**

- [x] 7. Implement participant management UI
  - [x] 7.0 Create useFormNavigationGuard hook
    - Create custom React hook for navigation guard functionality
    - Use React Router's useBlocker to intercept navigation attempts
    - Track dirty form state by comparing current form values to initial values
    - Provide isDirty boolean
    - Provide setInitialValues(values) method
    - Provide clearDirtyState() method
    - Implement deep equality comparison for form values
    - Ignore non-user-editable fields (timestamps, IDs) in comparison
    - Return confirmNavigation and cancelNavigation methods for dialog integration
    - Handle browser back/forward navigation
    - Handle programmatic navigation
    - Clean up blocker on component unmount
    - _Requirements: 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14, 2A.15_

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

  - [x] 7.2 Create ParticipantFormPage component
    - Dedicated full-page form for create/edit (not a modal)
    - Accessible via routes: /participants/new and /participants/:id/edit
    - Validate name, email format, and required fields
    - Support optional phone and notes
    - Support home venue selection (homeVenueId)
    - Include version field in update requests for optimistic locking
    - Display inline validation errors
    - Embed address history management section within the form
    - Allow adding new address history records with venue and optional effective start date
    - Allow editing existing address history records (edit mode only)
    - Allow deleting existing address history records (edit mode only)
    - Display address history table in reverse chronological order within the form
    - Validate address history for required fields and duplicate prevention (including null dates)
    - Enforce at most one null effective start date per participant
    - Display null effective start dates as "Initial Address" or similar indicator
    - Fetch venue details when venue is selected for new address history records
    - Store venue object in temporary records for display before participant is created
    - Implement navigation guard using useFormNavigationGuard hook
    - Display confirmation dialog when user attempts to navigate away with unsaved changes
    - Allow vertical scrolling for large forms
    - _Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18, 4.19, 4.20, 2A.1, 2A.5, 2A.6, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14, 2A.15_

  - [ ]* 7.4 Write property tests for participant validation
    - **Property 7: Required Field Validation**
    - **Property 8: Email Format Validation**
    - **Property 9: Optional Field Acceptance**
    - **Validates: Requirements 4.7, 4.8, 4.9**

  - [ ]* 7.4a Write property tests for navigation guards
    - **Property 56A: Dirty Form Detection**
    - **Property 56B: Navigation Blocking with Dirty Form**
    - **Property 56C: Discard Changes Confirmation**
    - **Property 56D: Cancel Discard Confirmation**
    - **Property 56E: Dirty State Clearing After Submission**
    - **Property 56F: Form Page Vertical Scrolling**
    - **Property 56G: Modal Dialog Restriction for Major Entities**
    - **Property 56H: Modal Dialog Permission for Simple Entities**
    - **Validates: Requirements 2A.1, 2A.2, 2A.3, 2A.4, 2A.5, 2A.6, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14, 2A.15**

  - [x] 7.3 Create ParticipantDetail component
    - Show participant information
    - List all activities with roles
    - Display address history table in reverse chronological order
    - Add primary edit button that navigates to /participants/:id/edit
    - Add delete button with confirmation dialog
    - _Requirements: 4.10, 4.11, 23.1, 23.2, 23.3, 23.4, 23A.1, 23A.2_

  - [ ]* 7.5 Write property test for participant detail view
    - **Property 10: Participant Detail View Completeness**
    - **Validates: Requirements 4.10**

  - [x] 7.4 Create AddressHistoryTable component
    - Display address history in reverse chronological order by effective start date
    - Show venue name and effective start date (display "Initial Address" for null dates)
    - Highlight most recent address (first record, or null record if no non-null dates exist)
    - Provide edit and delete buttons for each record
    - _Requirements: 4.11, 4.17_

  - [ ]* 7.6 Write property test for address history display order
    - **Property 11: Address History Display Order**
    - **Validates: Requirements 4.11**

  - [x] 7.5 Create AddressHistoryForm component
    - Modal form for add/edit address history
    - Require venue selection from dropdown
    - Allow optional effective start date using CloudScape DatePicker
    - Validate effective start date is optional (can be null for oldest address)
    - Prevent duplicate records with same effective start date (including null)
    - Enforce at most one null effective start date per participant
    - _Requirements: 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18, 4.19_

  - [ ]* 7.7 Write property tests for address history validation
    - **Property 12: Address History Required Fields**
    - **Property 13: Address History Duplicate Prevention**
    - **Property 13A: Address History Null EffectiveFrom Uniqueness**
    - **Property 13B: Address History Null EffectiveFrom Display**
    - **Validates: Requirements 4.15, 4.17, 4.18, 4.19**

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

  - [x] 7.8 Implement participant population membership management
    - [x] 7.8.1 Create ParticipantPopulationService
      - Implement getParticipantPopulations(participantId) to fetch from /participants/:id/populations
      - Implement addParticipantToPopulation(participantId, populationId) via POST /participants/:id/populations
      - Implement removeParticipantFromPopulation(participantId, populationId) via DELETE /participants/:id/populations/:populationId
      - _Requirements: 4.21, 4.23, 4.24_

    - [x] 7.8.2 Create PopulationMembershipManager component
      - Display list or table of populations the participant belongs to
      - Provide interface to add participant to populations (multi-select or dropdown)
      - Provide interface to remove participant from populations (remove button per population)
      - Support zero, one, or multiple population memberships
      - Embed within ParticipantFormPage (both create and edit modes)
      - _Requirements: 4.21, 4.22, 4.23, 4.24, 4.25_

    - [x] 7.8.3 Update ParticipantDetail to display populations
      - Fetch and display populations the participant belongs to
      - Show population names in a list or table
      - _Requirements: 4.26_

    - [ ]* 7.8.4 Write property tests for population membership
      - **Property 169: Participant Population Membership Display**
      - **Property 170: Multiple Population Membership Support**
      - **Property 171: Population Membership Management in Form**
      - **Validates: Requirements 4.21, 4.22, 4.23, 4.24, 4.25, 4.26**

- [x] 8. Implement venue management UI
  - [x] 8.1 Create VenueList component
    - Display table with name, address, and geographic area
    - Render venue name as hyperlink to /venues/:id
    - Render geographic area name as hyperlink to /geographic-areas/:id
    - Implement search via /venues/search?q= endpoint, sort, and filter
    - Support optional pagination
    - _Requirements: 6A.1, 6A.1a, 6A.2, 6A.3_

  - [ ]* 8.2 Write property tests for venue list and search
    - **Property 44: Venue List Display**
    - **Property 45: Venue Search Functionality**
    - **Property 54a: Venue List Geographic Area Hyperlink**
    - **Validates: Requirements 6A.1, 6A.1a, 6A.2**

  - [x] 8.2 Create VenueFormPage component
    - Dedicated full-page form for create/edit (not a modal)
    - Accessible via routes: /venues/new and /venues/:id/edit
    - Validate required fields (name, address, geographic area)
    - Support optional latitude, longitude, venue type
    - Include version field in update requests for optimistic locking
    - Handle delete validation (REFERENCED_ENTITY error)
    - Implement navigation guard using useFormNavigationGuard hook
    - Display confirmation dialog when user attempts to navigate away with unsaved changes
    - Allow vertical scrolling for large forms with embedded map
    - _Requirements: 6A.4, 6A.5, 6A.6, 6A.7, 6A.8, 6A.10, 6A.11, 2A.3, 2A.5, 2A.6, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14, 2A.15_

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
    - Add primary edit button that navigates to /venues/:id/edit
    - Add delete button with confirmation dialog
    - _Requirements: 6A.9, 23.1, 23.2, 23.3, 23.4, 23A.1, 23A.2_

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
      - _Requirements: 22.1, 22.3, 22.9_

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
      - _Requirements: 22.11, 22.12, 22.13, 22.14, 22.18_

    - [x] 8.5.3 Update VenueFormPage component with geocoding and map
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
      - _Requirements: 22.2, 22.4, 22.5, 22.6, 22.7, 22.8, 22.10, 22.11, 22.12, 22.13, 22.14, 22.15, 22.16, 22.17, 22.18_

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
      - **Validates: Requirements 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.10, 22.11, 22.12, 22.13, 22.14, 22.15, 22.16, 22.17, 22.18**

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
    - When global filter is active, display filtered area, all descendants, AND all ancestors (never suppress ancestors)
    - Visually indicate ancestor areas as read-only (e.g., with badge, icon, or muted styling)
    - Ensure ancestors are always rendered to provide hierarchy context
    - _Requirements: 6B.1, 6B.4, 6B.9, 6B.10, 6B.12, 6B.13, 6B.14_

  - [ ]* 9.2 Write property test for hierarchical display
    - **Property 50: Geographic Area Hierarchical Display**
    - **Property 59a: Geographic Area Ancestor Display in Tree View**
    - **Property 59b: Geographic Area Ancestor Read-Only Indication**
    - **Property 59c: Geographic Area Ancestor Non-Suppression**
    - **Validates: Requirements 6B.1, 6B.12, 6B.13, 6B.14**

  - [x] 9.2 Create GeographicAreaFormPage component
    - Dedicated full-page form for create/edit (not a modal)
    - Accessible via routes: /geographic-areas/new and /geographic-areas/:id/edit
    - Validate required fields (name, area type)
    - Provide dropdown for area type selection (NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD)
    - Support parent selection
    - Prevent circular relationships (CIRCULAR_REFERENCE error)
    - Include version field in update requests for optimistic locking
    - Implement navigation guard using useFormNavigationGuard hook
    - Display confirmation dialog when user attempts to navigate away with unsaved changes
    - Allow vertical scrolling for form fields
    - _Requirements: 6B.2, 6B.3, 6B.5, 6B.6, 6B.7, 2A.4, 2A.5, 2A.6, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14, 2A.15_

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
    - Add primary edit button that navigates to /geographic-areas/:id/edit
    - Add delete button with confirmation dialog
    - _Requirements: 6B.8, 6B.11, 23.1, 23.2, 23.3, 23.4, 23A.1, 23A.2_

  - [ ]* 9.4 Write property test for hierarchy path display
    - **Property 54: Geographic Area Hierarchy Path Display**
    - **Validates: Requirements 6B.11**

- [x] 10. Checkpoint - Verify core entity management UI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement activity management UI
  - [x] 11.1 Create ActivityList component
    - Display table with filtering by category, type, and status (PLANNED, ACTIVE, COMPLETED, CANCELLED)
    - Show activity category and type
    - Visually distinguish finite vs ongoing
    - Provide sort capabilities
    - Support optional pagination
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.11_

  - [ ]* 11.2 Write property tests for activity list
    - **Property 11: Activity List Display**
    - **Property 12: Activity Filtering**
    - **Property 13: Finite vs Ongoing Activity Distinction**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x] 11.2 Create ActivityFormPage component
    - Dedicated full-page form for create/edit (not a modal)
    - Accessible via routes: /activities/new and /activities/:id/edit
    - Conditionally require end date for finite activities
    - Allow null end date for ongoing
    - Validate name, type, start date
    - Support all four status values (PLANNED, ACTIVE, COMPLETED, CANCELLED)
    - Support venue selection and management
    - Include version field in update requests for optimistic locking
    - Embed venue history management section within the form
    - Allow adding new venue associations with optional effective start dates
    - Allow editing existing venue associations (edit mode only)
    - Allow deleting existing venue associations (edit mode only)
    - Display venue history table in reverse chronological order within the form
    - Validate venue associations for required fields and duplicate prevention (including null dates)
    - Enforce at most one null effective start date per activity
    - Display null effective start dates as "Since Activity Start" or show activity startDate
    - Fetch venue details when venue is selected for new venue associations
    - Store venue object in temporary records for display before activity is created
    - Embed participant assignment management section within the form
    - Allow adding new participant assignments with participant, role, and optional notes
    - Allow editing existing participant assignments (edit mode only)
    - Allow removing existing participant assignments (edit mode only)
    - Display participant assignments table within the form
    - Validate participant assignments for required fields (participant, role) and duplicate prevention (same participant + role)
    - Fetch participant and role details when assignment is added to new activity (before activity is created)
    - Store participant and role objects in temporary records for display before activity is created
    - Display participant name and role name in assignments table by accessing objects from temporary records
    - Display venue associations table above participant assignments table (stacked vertically)
    - Provide atomic user experience where all activity details, venue associations, and participant assignments can be configured before backend persistence
    - Implement navigation guard using useFormNavigationGuard hook
    - Display confirmation dialog when user attempts to navigate away with unsaved changes
    - Allow vertical scrolling for large forms with embedded sections
    - _Requirements: 5.5, 5.6, 5.8, 5.9, 5.10, 5.11, 5.12, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 5.20, 5.21, 5.22, 5.23, 5.24, 5.25, 5.26, 5.27, 5.28, 6.1, 6.2, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 2A.2, 2A.5, 2A.6, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14, 2A.15_

  - [ ]* 11.3 Write property tests for activity validation
    - **Property 14: Finite Activity End Date Requirement**
    - **Property 15: Ongoing Activity Null End Date**
    - **Validates: Requirements 5.8, 5.9**

  - [x] 11.3 Create ActivityDetail component
    - Show activity information with all status values
    - List assigned participants with roles from /activities/:id/participants endpoint
    - Display venue history table in reverse chronological order
    - Provide status update buttons: "Mark Complete", "Cancel Activity", "Set Active"
    - When "Mark Complete" is clicked, update status to COMPLETED and implicitly set endDate to today if null
    - When "Cancel Activity" is clicked, update status to CANCELLED, implicitly set endDate to today if null, and set startDate to today if startDate is in the future
    - Support adding/removing venues via /activities/:id/venues endpoints
    - Add primary edit button that navigates to /activities/:id/edit
    - Add delete button with confirmation dialog
    - _Requirements: 5.11, 5.12, 5.12a, 5.12b, 5.12c, 5.13, 5.14, 23.1, 23.2, 23.3, 23.4, 23A.1, 23A.2_

  - [ ]* 11.4 Write property test for activity detail view
    - **Property 16: Activity Detail View Completeness**
    - **Validates: Requirements 5.12**

  - [x] 11.4 Create ActivityVenueHistoryTable component
    - Display venue history in reverse chronological order by effective start date
    - Show venue name and effective start date (display "Since Activity Start" or activity startDate for null dates)
    - Highlight most recent venue (first record, or null record if no non-null dates exist)
    - Provide delete button for each record
    - _Requirements: 5.14, 5.20_

  - [x] 11.5 Create ActivityVenueHistoryForm component
    - Modal form for adding venue associations
    - Require venue selection from dropdown
    - Allow optional effective start date using CloudScape DatePicker
    - Validate effective start date is optional (can be null to use activity startDate)
    - Prevent duplicate records with same effective start date (including null)
    - Enforce at most one null effective start date per activity
    - _Requirements: 5.16, 5.17, 5.18, 5.19, 5.20, 5.21, 5.22_

  - [x] 11.6 Implement ActivityVenueHistoryService
    - Implement getActivityVenues(activityId)
    - Implement addActivityVenue(activityId, venueId, effectiveFrom)
    - Implement deleteActivityVenue(activityId, venueId)
    - Use /activities/:id/venues endpoints
    - _Requirements: 5.13, 5.14_

- [x] 12. Implement assignment management UI
  - [x] 12.1 Create AssignmentForm component (embedded in ActivityForm)
    - Note: This component is now embedded within ActivityForm for both create and edit modes
    - Require role selection
    - Validate role is selected
    - Prevent duplicate assignments (DUPLICATE_ASSIGNMENT error)
    - Support optional notes field
    - Use /activities/:activityId/participants endpoint (only in edit mode when activity exists)
    - In create mode: Store assignments in temporary state until activity is created
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

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
    - Also used within ActivityForm to display temporary assignments during creation
    - _Requirements: 6.3, 6.4_

- [x] 13. Implement map view UI
  - [x] 13.1 Create MapView component
    - Render interactive map using Leaflet or Mapbox
    - Provide mode selector control to switch between "Activities", "Participant Homes", and "Venues" modes
    - In Activities mode: display activity markers at current venue locations, color-coded by activity type
    - In Activity Categories mode: display activity markers at current venue locations, color-coded by activity category
    - In Participant Homes mode: display markers for participant home addresses (current venue from address history)
    - In Venues mode: display markers for all venues with coordinates, regardless of activities or participants
    - Implement marker clustering for dense areas
    - Provide mode-specific popup with information on marker click
    - Include map controls for zoom, pan, and center
    - Display right-aligned legend in Activities mode showing only visible activity types
    - Display right-aligned legend in Activity Categories mode showing only visible activity categories
    - Filter legend items dynamically based on markers actually rendered on the map
    - Hide legend when no markers are visible
    - Respect global geographic area filter across all modes
    - Handle null effectiveFrom dates: treat as activity startDate for activities, as oldest address for participants
    - Correctly identify current venue for activity markers considering null effectiveFrom dates
    - Correctly identify current home venue for participant markers considering null effectiveFrom dates
    - _Requirements: 6C.1, 6C.2, 6C.3, 6C.4, 6C.5, 6C.5a, 6C.5b, 6C.5c, 6C.6, 6C.7, 6C.8, 6C.9, 6C.10, 6C.11, 6C.12, 6C.13, 6C.18, 6C.19, 6C.20, 6C.21, 6C.22, 6C.23, 6C.24, 6C.25, 6C.26_

  - [ ]* 13.2 Write property tests for map display
    - **Property 60: Map Mode Selector**
    - **Property 61: Activity Marker Display**
    - **Property 62: Activity Marker Color Coding**
    - **Property 63: Activity Legend Display**
    - **Property 63a: Legend Filtering Based on Visible Markers**
    - **Property 63b: Legend Visibility with No Markers**
    - **Property 64: Activity Popup Information**
    - **Property 65: Participant Home Marker Display**
    - **Property 66: Participant Home Popup Information**
    - **Property 67: Venue Marker Display**
    - **Property 68: Venue Popup Information**
    - **Property 70: Map Global Filter Application**
    - **Validates: Requirements 6C.2, 6C.3, 6C.4, 6C.5, 6C.6, 6C.7, 6C.8, 6C.9, 6C.10, 6C.11, 6C.12, 6C.13, 6C.19, 6C.20, 6C.21, 6C.22**

  - [x] 13.3 Create MapFilters component
    - Provide filter controls for category, type, status, date range, and population
    - Add population filter control to map view
    - When population filter applied: show only activities with participants in specified populations
    - When population filter applied in Participant Homes mode: show only participants in specified populations
    - Update markers based on filters
    - Support geographic area boundary toggle
    - Provide center button
    - _Requirements: 6C.14, 6C.14a, 6C.14b, 6C.14c, 6C.15, 6C.17_

  - [x] 13.3a Implement conditional population filter enabling based on map mode
    - Disable population filter control when map mode is "Venues"
    - Enable population filter control when map mode is "Activities", "Activity Categories", or "Participant Homes"
    - Update MapViewPage component to pass disabled state to Multiselect component
    - _Requirements: 6C.14d, 6C.14e_

  - [x] 13.4 Create MapPopup component
    - In Activities mode: display activity name (hyperlinked to /activities/:id), category, type, start date, and participant count
    - In Participant Homes mode: display venue name (hyperlinked to /venues/:id) and count of participants at that address
    - In Venues mode: display venue name (hyperlinked to /venues/:id), address, and geographic area
    - Provide navigation to detail pages via hyperlinked names
    - _Requirements: 6C.6, 6C.7, 6C.9, 6C.10, 6C.12, 6C.13_

  - [ ]* 13.5 Write property test for map filter application
    - **Property 69: Map Filter Application**
    - **Validates: Requirements 6C.14**

- [x] 14. Implement analytics dashboards
  - [x] 14.1 Create EngagementDashboard component
    - Display comprehensive temporal metrics using CloudScape Cards:
      - Activities at start/end of date range
      - Activities started, completed, cancelled within range
      - Participants at start/end of date range
    - Display aggregate counts and breakdowns by activity category and activity type
    - Render charts for activities distribution, activity category pie chart, role distribution, and geographic breakdown
    - Display pie chart showing breakdown of unique activities by activity category:
      - Position in line width (full container width) to the left of role distribution chart
      - Use recharts PieChart component
      - Calculate unique activity counts per category from filtered data
      - Display activity category names in legend
      - Use consistent color scheme with other dashboard charts
      - Show activity category name and count on hover
      - Integrate with InteractiveLegend component for toggling segments
      - Handle empty state when no activities exist
      - Ensure at least one segment remains visible or display appropriate message
    - Render charts for activities distribution, role distribution, and geographic breakdown
    - Provide multi-dimensional grouping controls:
      - Activity category grouping
      - Activity type grouping
      - Venue grouping
      - Geographic area grouping
    - Provide flexible filter controls:
      - Activity category filter (dropdown)
      - Activity type filter (dropdown)
      - Venue filter (dropdown)
      - Geographic area filter (dropdown, includes descendants)
      - Date range filter using CloudScape DateRangePicker
    - Render "Engagement Summary" table using CloudScape Table:
      - Always display table regardless of whether grouping dimensions are selected
      - First row displays aggregate metrics with "Total" label in first column
      - When multiple grouping dimensions selected, leave subsequent dimension cells blank in Total row
      - Display metric columns: activities at start, at end, started, completed, cancelled, participants at start, at end
      - When grouping dimensions selected, render additional rows below Total row showing dimensional breakdowns:
        - Display breakdown dimension columns first (activity category, activity type, venue, geographic area)
        - Display metric aggregation columns after dimensions
        - Render activity category names as hyperlinks to /configuration (Activity Configuration page)
        - Render activity type names as hyperlinks to /configuration (Activity Configuration page)
        - Render venue names as hyperlinks to /venues/:id using CloudScape Link component
        - Render geographic area names as hyperlinks to /geographic-areas/:id using CloudScape Link component
        - Display each metric in its own column for easy comparison
    - Show role distribution within filtered and grouped results
    - Display geographic breakdown chart showing engagement by geographic area
    - Allow drilling down into child geographic areas
    - Display all-time metrics when no date range specified
    - Handle null effectiveFrom dates: treat as activity startDate for activities, as oldest address for participants
    - Correctly identify current venue/address when effectiveFrom is null for filtering and grouping
    - Synchronize all filter and grouping parameters with URL query parameters:
      - Read URL parameters on component mount to initialize dashboard state
      - Update URL when user changes filters or grouping (using React Router's useSearchParams or similar)
      - Support parameters: activityCategory, activityType, venue, geographicArea, startDate, endDate, groupBy (array)
      - Enable browser back/forward navigation between different configurations
      - Ensure URL updates don't cause page reloads (use history.pushState or React Router navigation)
    - Use /analytics/engagement endpoint with enhanced parameters
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27, 7.28, 7.29, 7.30, 7.31, 7.32, 7.32a, 7.32b, 7.32c, 7.32d, 7.32e, 7.32f, 7.32g, 7.32h, 7.33, 7.34, 7.35, 7.36, 7.37, 7.38, 7.38a, 7.38b, 7.38c, 7.39, 7.40, 7.41, 7.42, 7.43, 7.44, 7.45, 7.46_

  - [x] 14.1a Enhance Activities chart with segmented control toggle
    - Rename chart title from "Activities by Type" to "Activities"
    - Add CloudScape SegmentedControl component above or within chart area
    - Configure segmented control with two options:
      - "Activity Type" (default)
      - "Activity Category"
    - Follow same UX pattern as map view toggle functionality
    - Implement view mode state management using React useState hook
    - When "Activity Type" selected:
      - Fetch activities grouped by activity type from API
      - Display chart with activity type labels on x-axis
    - When "Activity Category" selected:
      - Fetch activities grouped by activity category from API
      - Display chart with activity category labels on x-axis
    - Update chart data without page refresh when view mode changes
    - Preserve current date range and filter selections when switching views
    - Display activity counts in descending order by count value
    - Show empty state message when no activities exist for grouping dimension
    - Handle API errors gracefully with CloudScape Alert component
    - Implement localStorage persistence:
      - Store selected view mode in localStorage with key "activitiesChartViewMode"
      - Read from localStorage on component mount to restore previous selection
      - Default to "Activity Type" if no localStorage value exists
      - Handle localStorage unavailability gracefully
    - Implement keyboard navigation:
      - Make segmented control keyboard navigable using Tab and Arrow keys
      - Provide visual focus indicators using CloudScape focus styles
    - Implement accessibility features:
      - Add aria-label="Activities chart view mode" to segmented control
      - Add aria-live="polite" region to announce view mode changes
      - Ensure screen readers announce "Activity Type view selected" or "Activity Category view selected"
    - _Requirements: 7.47, 7.48, 7.49, 7.50, 7.51, 7.52, 7.53, 7.54, 7.55, 7.56, 7.57, 7.58, 7.59, 7.60, 7.61, 7.62, 7.63, 7.64, 7.65_

  - [ ]* 14.1b Write property tests for Activities chart enhancement
    - **Property 31f: Activities Chart Title Display**
    - **Property 31g: Activities Chart Segmented Control Presence**
    - **Property 31h: Activities Chart Default View Mode**
    - **Property 31i: Activities Chart View Mode Switching**
    - **Property 31j: Activities Chart Filter Preservation**
    - **Property 31k: Activities Chart Data Ordering**
    - **Property 31l: Activities Chart State Persistence**
    - **Property 31m: Activities Chart Keyboard Navigation**
    - **Property 31n: Activities Chart Screen Reader Support**
    - **Validates: Requirements 7.47, 7.48, 7.49, 7.51, 7.52, 7.53, 7.54, 7.56, 7.58, 7.59, 7.60, 7.61, 7.62, 7.63, 7.64, 7.65**

  - [x] 14.1c Add Activity Category Pie Chart to EngagementDashboard
    - Create ActivityCategoryPieChart component or add pie chart directly to EngagementDashboard
    - Use recharts PieChart component for visualization
    - Calculate unique activity counts per category from engagement metrics data
    - Position chart in line width (full container width) to the left of role distribution chart
    - Use CSS Grid or Flexbox layout to arrange pie chart and role distribution chart side by side
    - Display activity category names in legend
    - Use consistent color palette with other dashboard charts (define color mapping for categories)
    - Implement hover tooltip showing activity category name and count
    - Integrate with InteractiveLegend component for toggling category segments
    - Handle empty state when no activities exist (display message)
    - Ensure at least one segment remains visible when toggling
    - Apply all current filters (PropertyFilter tokens, date range, geographic area) to pie chart data
    - Update pie chart when filters change
    - _Requirements: 7.32a, 7.32b, 7.32c, 7.32d, 7.32e, 7.32f, 7.32g, 7.32h_

  - [ ]* 14.1d Write property tests for Activity Category Pie Chart
    - **Property 31_pie: Activity Category Pie Chart Display**
    - **Property 31_pie_a: Pie Chart Positioning**
    - **Property 31_pie_b: Pie Chart Data Consistency**
    - **Property 31_pie_c: Pie Chart Legend Display**
    - **Property 31_pie_d: Pie Chart Color Consistency**
    - **Property 31_pie_e: Pie Chart Hover Information**
    - **Property 31_pie_f: Pie Chart Interactive Legend**
    - **Property 31_pie_g: Pie Chart Minimum Visibility**
    - **Validates: Requirements 7.32a, 7.32b, 7.32c, 7.32d, 7.32e, 7.32f, 7.32g, 7.32h**

  - [ ]* 14.2 Write property tests for engagement metrics
    - **Property 23: Temporal Activity Metrics Display**
    - **Property 24: Temporal Participant Metrics Display**
    - **Property 25: Aggregate and Breakdown Display**
    - **Property 26: Multi-Dimensional Grouping Controls**
    - **Property 27: Filter Control Availability**
    - **Property 28: Engagement Summary Table Display**
    - **Property 28a: Total Row Aggregate Metrics**
    - **Property 28b: Total Row Blank Dimension Cells**
    - **Property 28c: Dimensional Breakdown Rows**
    - **Property 28d: Dimension Hyperlinks in Breakdown Rows**
    - **Property 28e: Metric Columns in Engagement Summary**
    - **Property 29: Multiple Filter Application**
    - **Property 30: All-Time Metrics Display**
    - **Property 31: Role Distribution Display**
    - **Property 31_pie: Activity Category Pie Chart Display**
    - **Property 31_pie_a: Pie Chart Positioning**
    - **Property 31_pie_b: Pie Chart Data Consistency**
    - **Property 31_pie_c: Pie Chart Legend Display**
    - **Property 31_pie_d: Pie Chart Color Consistency**
    - **Property 31_pie_e: Pie Chart Hover Information**
    - **Property 31_pie_f: Pie Chart Interactive Legend**
    - **Property 31_pie_g: Pie Chart Minimum Visibility**
    - **Property 31a: Analytics URL Parameter Synchronization**
    - **Property 31b: Analytics URL Parameter Application**
    - **Property 31c: Analytics URL Update on State Change**
    - **Property 31d: Analytics Browser Navigation Support**
    - **Property 31e: Analytics URL Shareability**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27, 7.28, 7.29, 7.30, 7.31, 7.32, 7.32a, 7.32b, 7.32c, 7.32d, 7.32e, 7.32f, 7.32g, 7.32h, 7.33, 7.34, 7.35, 7.36, 7.37, 7.38**

  - [x] 14.2 Create GrowthDashboard component
    - Display two separate time-series charts: one for unique participant counts and one for unique activity counts
    - Provide time period selector (DAY, WEEK, MONTH, YEAR) using period parameter
    - Display each time period as a snapshot of unique participants and activities (not cumulative)
    - Add CloudScape SegmentedControl component with three options:
      - "All" (default selection)
      - "Activity Type"
      - "Activity Category"
    - Implement view mode state management using React useState hook
    - When "All" selected:
      - Fetch aggregate growth data from API (no groupBy parameter)
      - Display single time-series line for total unique participants in Participant Growth Chart
      - Display single time-series line for total unique activities in Activity Growth Chart
      - Display overall participation and activity growth numbers representing totals across all activity types and categories
    - When "Activity Type" selected:
      - Fetch growth data grouped by activity type from API (groupBy='type')
      - Display multiple time-series lines in both charts, one for each activity type
      - Show unique participants per type in Participant Growth Chart
      - Show unique activities per type in Activity Growth Chart
      - Do NOT display overall participation and activity growth numbers, showing only the grouped breakdown data
    - When "Activity Category" selected:
      - Fetch growth data grouped by activity category from API (groupBy='category')
      - Display multiple time-series lines in both charts, one for each activity category
      - Show unique participants per category in Participant Growth Chart
      - Show unique activities per category in Activity Growth Chart
      - Do NOT display overall participation and activity growth numbers, showing only the grouped breakdown data
    - Implement consistent color scheme across both charts:
      - Define color palette for activity types/categories
      - Apply same color to same type/category on both Participant and Activity charts
      - Use recharts color prop or custom color mapping function
    - Display legend on both charts showing color mapping when multiple lines are displayed
    - Update both charts without page refresh when view mode changes
    - Preserve current time period, date range, and geographic area filter selections when switching views
    - Implement localStorage persistence:
      - Store selected view mode in localStorage with key "growthChartViewMode"
      - Read from localStorage on component mount to restore previous selection
      - Default to "All" if no localStorage value exists
      - Handle localStorage unavailability gracefully
    - Provide geographic area filter (optional geographicAreaId)
    - Use /analytics/growth endpoint with optional startDate, endDate, period, geographicAreaId, groupBy parameters
    - Combine date range and period controls into single unified container with side-by-side layout
    - Use separate LineChart components for each metric:
      - Participant Growth Chart: displays unique participant counts over time
      - Activity Growth Chart: displays unique activity counts over time
      - Each chart has its own Y-axis scale optimized for its data range
    - Synchronize filter and grouping parameters with URL query parameters:
      - Read URL parameters on component mount to initialize dashboard state
      - Update URL when user changes filters or grouping (using React Router's useSearchParams)
      - Support parameters: period, startDate, endDate, relativePeriod (compact format: -90d, -6m, -1y), groupBy (all|type|category)
      - Use same compact relative date format as Engagement dashboard for consistency
      - Enable browser back/forward navigation between different configurations
      - Ensure URL updates don't cause page reloads (use replace: true)
    - _Requirements: 7.39, 7.40, 7.41, 7.42, 7.43, 7.44, 7.45, 7.46, 7.46a, 7.46b, 7.47, 7.48, 7.49, 7.50, 7.51, 7.52, 7.53, 7.54, 7.55, 7.56, 57a, 57b, 57c, 57d, 57e_

  - [ ]* 14.3 Write property tests for growth metrics
    - **Property 32: Time-Series Unique Count Calculation**
    - **Property 33: Growth Dashboard Segmented Control Display**
    - **Property 33a: Growth Dashboard All View Mode**
    - **Property 33b: Growth Dashboard Activity Type View Mode**
    - **Property 33c: Growth Dashboard Activity Category View Mode**
    - **Property 33d: Growth Dashboard Consistent Color Scheme**
    - **Property 33e: Growth Dashboard Legend Display**
    - **Property 33f: Growth Dashboard View Mode Switching**
    - **Property 33g: Growth Dashboard Filter Preservation**
    - **Property 33h: Growth Dashboard View Mode Persistence**
    - **Property 33i: Growth Dashboard URL Parameter Synchronization**
    - **Property 33j: Growth Dashboard URL Parameter Application**
    - **Property 33k: Growth Dashboard URL Update on State Change**
    - **Property 33l: Growth Dashboard Browser Navigation Support**
    - **Property 33m: Growth Dashboard URL Shareability**
    - **Validates: Requirements 7.40, 7.41, 7.43, 7.44, 7.45, 7.46, 7.46a, 7.46b, 7.47, 7.48, 7.49, 7.50, 7.51, 7.52, 7.53, 7.54, 7.55, 7.56, 57a, 57b, 57c, 57d, 57e**

  - [x] 14.3 Create GeographicAnalyticsDashboard component
    - Display geographic breakdown using /analytics/geographic endpoint
    - Show metrics by geographic area (geographicAreaId, geographicAreaName, areaType, totalActivities, activeActivities, totalParticipants, activeParticipants)
    - Provide optional date range filter (startDate, endDate)
    - _Requirements: 7.38, 7.39_

  - [x] 14.4 Create ActivityLifecycleChart component
    - Create new component file with props interface (startDate?, endDate?, geographicAreaIds, activityTypeIds, venueIds)
    - Add segmented control toggle for "By Type" and "By Category" views
    - Implement data fetching from /analytics/activity-lifecycle endpoint
    - Handle all date range scenarios: absolute, relative, and no date range (all history)
    - Calculate absolute dates from relative date ranges
    - Transform data for recharts BarChart format
    - Display two data series: "Started" (blue) and "Completed" (green)
    - Handle loading, error, and empty states
    - Store view mode in localStorage (key: "lifecycleChartViewMode")
    - Restore view mode from localStorage on mount
    - Default to "By Type" view
    - Include screen reader announcements for view mode changes
    - Position after Activities chart on Engagement Dashboard
    - Always render regardless of date range selection
    - Apply all provided filters to API request
    - _Requirements: 7A.1, 7A.2, 7A.3, 7A.4, 7A.5, 7A.6, 7A.7, 7A.8, 7A.9, 7A.10, 7A.11, 7A.12, 7A.13, 7A.14, 7A.15, 7A.16, 7A.17, 7A.18, 7A.19, 7A.20, 7A.21, 7A.22, 7A.23, 7A.24, 7A.25, 7A.26, 7A.27, 7A.28, 7A.29, 7A.30, 7A.31, 7A.32_

  - [x] 14.5 Integrate ActivityLifecycleChart into EngagementDashboard
    - Import and render ActivityLifecycleChart component
    - Calculate date range for all scenarios (absolute, relative, no range)
    - Pass calculated startDate and endDate (or undefined for all history)
    - Pass filter props (geographicAreaIds, activityTypeIds, venueIds)
    - Position after Activities chart
    - Always render (not conditional on date range type)
    - _Requirements: 7A.1, 7A.5, 7A.21, 7A.22, 7A.23, 7A.24, 7A.25, 7A.30, 7A.31, 7A.32_

  - [x] 14.6 Replace filter dropdowns with PropertyFilter component
    - Remove separate Select components for activity type and venue filters
    - Add CloudScape PropertyFilter component to EngagementDashboard
    - Configure filtering properties: Activity Category, Activity Type, Venue, Population
    - Implement handleLoadItems function for async property value loading:
      - Fetch activity categories from ActivityCategoryService
      - Fetch activity types from ActivityTypeService
      - Fetch venues from VenueService with geographic area filtering
      - Fetch populations from PopulationService
      - Filter results based on user input text (case-insensitive)
    - Configure PropertyFilter with operators: = (equals) and != (not equals)
    - Manage PropertyFilter query state with tokens and operation
    - Extract filter values from PropertyFilter tokens (propertyKey and value)
    - Apply extracted filters to analytics API queries (activityCategoryId, activityTypeId, venueId, populationIds)
    - When population filter applied: include only participants in specified populations
    - When population filter applied: include only activities with at least one participant in specified populations
    - Update URL synchronization to persist PropertyFilter tokens including population
    - Update ActivityLifecycleChart to use PropertyFilter tokens for filtering including population
    - Display loading indicator while fetching property values
    - Provide comprehensive i18nStrings for PropertyFilter accessibility
    - _Requirements: 7B.1, 7B.2, 7B.3, 7B.4, 7B.5, 7B.6, 7B.7, 7B.8, 7B.9, 7B.10, 7B.11, 7B.12, 7B.13, 7B.14, 7B.15, 7B.16, 7B.17, 7.19a, 7.19b, 7.19c_

  - [ ]* 14.7 Write property tests for PropertyFilter
    - **Property 31o: PropertyFilter Lazy Loading**
    - **Property 31p: PropertyFilter Multiple Token Application**
    - **Property 31q: PropertyFilter URL Persistence**
    - **Property 31r: PropertyFilter Integration**
    - **Validates: Requirements 7B.5, 7B.6, 7B.9, 7B.10, 7B.11, 7B.12, 7B.16, 7B.17**

- [x] 15. Implement offline support
  - [x] 15.1 Create OfflineStorage service
    - Use Dexie.js for IndexedDB management
    - Store tables for all entities (participants, activities, activityTypes, roles, populations, assignments, venues, geographicAreas)
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
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 17.2 Write property tests for form validation
    - **Property 35: Form Validation Error Display**
    - **Property 36: Invalid Form Submission Prevention**
    - **Property 37: Valid Field Value Preservation**
    - **Validates: Requirements 15.2, 15.3, 15.4, 15.5**

  - [x] 17.2 Create error handling utilities
    - Display user-friendly error messages
    - Use toast notifications for transient errors
    - Use modal dialogs for critical errors
    - Handle VERSION_CONFLICT errors (409) with conflict resolution UI
    - Handle RATE_LIMIT_EXCEEDED errors (429) with retry logic
    - Parse and display specific error codes (VALIDATION_ERROR, REFERENCED_ENTITY, CIRCULAR_REFERENCE, etc.)
    - Maintain application state during errors
    - Log errors to console
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 19.2, 19.3, 20.1, 20.2_

  - [ ]* 17.3 Write property tests for error handling
    - **Property 38: Error Notification Type**
    - **Property 39: Error State Preservation**
    - **Property 40: Error Console Logging**
    - **Validates: Requirements 16.2, 16.3, 16.5, 16.6**

  - [x] 17.3 Create date formatting utility
    - Implement formatDate() function to convert ISO-8601 strings to YYYY-MM-DD format
    - Handle both full datetime strings and date-only strings
    - Apply to all date displays in tables, detail views, forms, and charts
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

  - [ ]* 17.4 Write property test for date formatting
    - **Property 68: Date Formatting Consistency**
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7**

- [x] 17A. Implement optimistic locking and conflict resolution
  - [x] 17A.1 Create version conflict detection utility
    - Detect 409 errors with VERSION_CONFLICT code
    - Extract version information from error response
    - _Requirements: 19.2_

  - [x] 17A.2 Create conflict resolution UI component
    - Display conflict notification modal
    - Show current vs server version differences
    - Provide options: retry with latest, discard changes, view details
    - Refetch latest entity data on conflict
    - _Requirements: 19.2, 19.3, 19.4_

  - [x] 17A.3 Update all entity forms to include version
    - Pass version field in all update requests
    - Handle version conflicts gracefully
    - _Requirements: 19.1_

  - [ ]* 17A.4 Write property tests for optimistic locking
    - Test version conflict detection
    - Test conflict resolution flow
    - Test version field inclusion in updates
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4**

- [x] 17B. Implement rate limiting handling
  - [x] 17B.1 Create rate limit detection utility
    - Detect 429 errors with RATE_LIMIT_EXCEEDED code
    - Parse X-RateLimit-* headers from responses
    - Calculate retry-after time from X-RateLimit-Reset header
    - _Requirements: 20.1, 20.2_

  - [x] 17B.2 Create rate limit notification component
    - Display rate limit exceeded message
    - Show countdown timer for retry-after period
    - Display remaining request counts when available
    - _Requirements: 20.1, 20.2, 20.5_

  - [x] 17B.3 Implement automatic retry logic
    - Queue requests when rate limited
    - Automatically retry after cooldown period
    - Log rate limit events for debugging
    - _Requirements: 20.3, 20.4_

  - [ ]* 17B.4 Write property tests for rate limiting
    - Test rate limit detection
    - Test retry logic
    - Test cooldown period calculation
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4**

- [x] 18. Implement loading states
  - [x] 18.1 Create loading components
    - Display loading indicators during API requests
    - Disable buttons during submission
    - Display skeleton screens for lists
    - Provide progress indicators
    - Display success messages
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 18.2 Write property tests for loading states
    - **Property 41: Loading State Indicators**
    - **Property 42: Form Button Disabling During Submission**
    - **Property 43: Success Message Display**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

- [x] 19. Implement user management (admin only)
  - [x] 19.1 Create UserList and UserForm components
    - Display table of all users (admin only)
    - Allow role assignment and modification
    - Hide from non-administrators
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 19A. Implement About page
  - [x] 19A.1 Create AboutPage component
    - Create new page component accessible via route /about
    - Use CloudScape Container and SpaceBetween components for layout
    - Display Cultivate app icon (icon-no-bg.svg) at 200x200 pixels
    - Display Universal House of Justice excerpt in a prominent text block using CloudScape Box or TextContent
    - Include attribution text: "— The Universal House of Justice"
    - Display disclaimer text about individual initiative using CloudScape Alert or Box component
    - Add hyperlink to https://www.bahai.org using CloudScape Link component with external icon
    - Ensure responsive layout for tablet and desktop screens
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 19A.2 Add About page route to router configuration
    - Add /about route to React Router configuration
    - Make route accessible to all authenticated users (no role restrictions)
    - _Requirements: 14.1, 14.8_

  - [x] 19A.3 Add About link to navigation menu
    - Add "About" link to navigation sidebar
    - Position in appropriate location (e.g., at bottom of navigation or in user menu)
    - Ensure link is visible to all authenticated users
    - _Requirements: 14.1, 14.8_

  - [ ]* 19A.4 Write property tests for About page
    - **Property 43d: About Page Content Display**
    - **Property 43e: About Page Accessibility**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.8**

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
    - _Requirements: 23.1, 23.2, 23.3, 23.5, 23.6, 23.7_

  - [x] 22.2 Update detail page associated record tables
    - Update AddressHistoryTable: Make venue name column hyperlinked to /venues/:id
    - Update ActivityVenueHistoryTable: Make venue name column hyperlinked to /venues/:id
    - Update AssignmentList (on ActivityDetail): Make participant name column hyperlinked to /participants/:id
    - Update VenueDetail activity table: Make activity name column hyperlinked to /activities/:id
    - Update VenueDetail participant table: Make participant name column hyperlinked to /participants/:id
    - Update ParticipantDetail activity table: Already implemented with hyperlinked activity names
    - Remove "View" action buttons from these tables where present
    - Use CloudScape Link component for all hyperlinks
    - _Requirements: 23.4, 23.5, 23.6_

  - [ ]* 22.3 Write property test for hyperlinked primary columns
    - **Property 76: Hyperlinked Primary Column Navigation**
    - Test that clicking hyperlinked primary column navigates to correct detail view
    - Test that View buttons are not present when primary column is hyperlinked
    - Test that Edit and Delete buttons are preserved
    - **Validates: Requirements 23.1, 23.2, 23.3, 23.7**

- [x] 23. Implement edit action buttons on detail pages
  - [x] 23.1 Update ParticipantDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Navigate to /participants/:id/edit when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 2A.1, 2A.5_

  - [x] 23.2 Update ActivityDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Navigate to /activities/:id/edit when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 2A.2, 2A.5_

  - [x] 23.3 Update VenueDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Navigate to /venues/:id/edit when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 2A.3, 2A.5_

  - [x] 23.4 Update GeographicAreaDetail component
    - Add primary edit button to header section using CloudScape Button with variant="primary"
    - Position edit button as right-most action in header
    - Navigate to /geographic-areas/:id/edit when edit button is clicked
    - Hide edit button when user has READ_ONLY role
    - Show edit button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 2A.4, 2A.5_

  - [ ]* 23.5 Write property tests for edit buttons on detail pages
    - **Property 79: Edit Button on Detail Pages**
    - **Property 80: Edit Button Navigates to Edit Page**
    - Test that edit button is displayed in header for EDITOR and ADMINISTRATOR roles
    - Test that edit button is hidden for READ_ONLY role
    - Test that edit button is positioned as right-most action
    - Test that clicking edit button navigates to the dedicated edit page
    - **Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 2A.5**

- [x] 23A. Implement delete action buttons on detail pages
  - [x] 23A.1 Update ParticipantDetail component
    - Add delete button to header section next to edit button
    - Display confirmation dialog on delete button click
    - Call ParticipantService.deleteParticipant() on confirmation
    - Navigate to /participants on successful deletion
    - Display error message on deletion failure
    - Hide delete button when user has READ_ONLY role
    - Show delete button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24A.1, 24A.2, 24A.3, 24A.4, 24A.5, 24A.6, 24A.7, 24A.8, 24A.9, 24A.10_

  - [x] 23A.2 Update ActivityDetail component
    - Add delete button to header section next to edit button
    - Display confirmation dialog on delete button click
    - Call ActivityService.deleteActivity() on confirmation
    - Navigate to /activities on successful deletion
    - Display error message on deletion failure
    - Hide delete button when user has READ_ONLY role
    - Show delete button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24A.1, 24A.2, 24A.3, 24A.4, 24A.5, 24A.6, 24A.7, 24A.8, 24A.9, 24A.10_

  - [x] 23A.3 Update VenueDetail component
    - Add delete button to header section next to edit button
    - Display confirmation dialog on delete button click
    - Call VenueService.deleteVenue() on confirmation
    - Navigate to /venues on successful deletion
    - Display error message on deletion failure
    - Hide delete button when user has READ_ONLY role
    - Show delete button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24A.1, 24A.2, 24A.3, 24A.4, 24A.5, 24A.6, 24A.7, 24A.8, 24A.9, 24A.10_

  - [x] 23A.4 Update GeographicAreaDetail component
    - Add delete button to header section next to edit button
    - Display confirmation dialog on delete button click
    - Call GeographicAreaService.deleteGeographicArea() on confirmation
    - Navigate to /geographic-areas on successful deletion
    - Display error message on deletion failure
    - Hide delete button when user has READ_ONLY role
    - Show delete button when user has EDITOR or ADMINISTRATOR role
    - _Requirements: 24A.1, 24A.2, 24A.3, 24A.4, 24A.5, 24A.6, 24A.7, 24A.8, 24A.9, 24A.10_

  - [ ]* 23A.5 Write property tests for delete buttons on detail pages
    - **Property 93a: Delete Button on Detail Pages**
    - **Property 93b: Delete Confirmation Dialog**
    - **Property 93c: Delete Success Navigation**
    - **Property 93d: Delete Error Handling**
    - Test that delete button is displayed for EDITOR and ADMINISTRATOR roles
    - Test that delete button is hidden for READ_ONLY role
    - Test that confirmation dialog appears on delete click
    - Test that successful deletion navigates to list page
    - Test that failed deletion displays error message
    - **Validates: Requirements 24A.1, 24A.2, 24A.3, 24A.4, 24A.5, 24A.6, 24A.7, 24A.8, 24A.9, 24A.10**

- [x] 24. Implement global persistent geographic area filter
  - [x] 24.1 Create GlobalGeographicFilterContext
    - Create React context for global geographic area filter state
    - Provide selectedGeographicAreaId (string | null)
    - Provide selectedGeographicArea (GeographicArea | null)
    - Provide availableAreas (GeographicAreaWithHierarchy[]) - list of areas for dropdown
    - Provide authorizedAreaIds (Set<string>) - set of directly authorized area IDs
    - Provide isAuthorizedArea(areaId: string) method to check direct authorization
    - Provide formatAreaOption(area) method to format display with type and hierarchy
    - Provide setGeographicAreaFilter(id: string | null) method
    - Provide clearFilter() method
    - Provide isLoading boolean
    - Implement URL query parameter synchronization (?geographicArea=<id>)
    - Implement localStorage persistence (key: 'globalGeographicAreaFilter')
    - Restore filter from localStorage on app initialization
    - URL parameter takes precedence over localStorage
    - Validate filter selections against authorizedAreaIds
    - Automatically revert to "Global" when unauthorized area is selected (via URL or localStorage)
    - Fetch user's authorized areas from /users/:id/authorized-areas endpoint
    - Extract directly authorized area IDs (accessLevel === 'FULL' and !isDescendant)
    - Fetch full geographic area details when filter is set
    - Fetch available areas based on current filter scope:
      - When filter is "Global": fetch all geographic areas
      - When filter is active: fetch only descendants of filtered area
    - For each area, fetch ancestor hierarchy using /geographic-areas/:id/ancestors endpoint
    - Build hierarchyPath string with format "Ancestor1 > Ancestor2 > Ancestor3" (closest to most distant)
    - Store areas with hierarchy information in availableAreas state
    - _Requirements: 25.1, 25.2, 25.3, 25.6, 25.7, 25.8, 25.9, 25.12, 25.13, 25.14, 25.15, 25.16, 25.17, 25.20, 25.21, 25.22_

  - [ ] 24.2 Create useGlobalGeographicFilter hook
    - Export custom hook to access GlobalGeographicFilterContext
    - Provide convenient access to filter state and methods
    - _Requirements: 24.1, 24.2, 24.3_

  - [ ] 24.3 Update AppLayout component with filter selector
    - Add geographic area filter selector in header utilities section
    - Use CloudScape Select component with custom option rendering
    - Display "Global (All Areas)" as default option
    - For each geographic area option:
      - Display area name and type on first line
      - Display hierarchy path on second line below type (smaller, muted text)
      - Format: "NEIGHBOURHOOD\nCommunity A > City B > Province C"
    - Show current filter selection or "Global" when no filter active
    - When displaying active filter, include the full ancestor hierarchy path in the filter indicator/breadcrumb
    - Render all ancestor areas in breadcrumb as clickable links
    - When user clicks unauthorized ancestor, clear filter (revert to "Global")
    - Use isAuthorizedArea() from context to determine click behavior
    - Provide clear button (X icon) to remove filter
    - Display visual indicator (badge or highlighted text) of active filter
    - Position prominently in header for accessibility from all views
    - Use availableAreas from context (respects current filter scope)
    - Never suppress ancestor areas from any display - they provide essential navigational context
    - _Requirements: 25.1, 25.2, 25.3, 25.10, 25.11, 25.12, 25.13, 25.14, 25.15, 25.16, 25.17, 25.18, 25.19, 25.20_

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
    - **Property 105: Global Filter Dropdown Hierarchical Display**
    - **Property 106: Global Filter Dropdown Scoped Options**
    - **Property 106a: Global Filter Breadcrumb Ancestor Display**
    - **Property 106b: Global Filter Ancestor Non-Suppression**
    - **Property 106c: Breadcrumb Ancestor Non-Clickability**
    - **Property 106d: Unauthorized Filter Reversion**
    - **Property 106e: Filter Authorization Validation**
    - **Property 106f: Filter Clearing on 403 Authorization Error**
    - **Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10, 25.11, 25.12, 25.13, 25.14, 25.15, 25.16, 25.17, 25.18, 25.19, 25.20, 25.21, 25.22, 25.24, 25.25**

  - [x] 24.10 Implement 403 authorization error handling for global filter
    - Create geographic-filter-events.ts event emitter utility
    - Update API client error interceptor to detect GEOGRAPHIC_AUTHORIZATION_DENIED errors
    - When 403 with GEOGRAPHIC_AUTHORIZATION_DENIED is received and global filter is active, emit event via geographicFilterEvents
    - Update GlobalGeographicFilterContext to subscribe to authorization error events
    - When event received, call clearFilterState() to revert to "Global"
    - Log warning message explaining filter was cleared due to authorization restrictions
    - _Requirements: 25.24, 25.25_

- [x] 25. Implement high-cardinality dropdown filtering
  - [x] 25.1 Create AsyncEntitySelect component
    - Create reusable dropdown component for venues, participants, and geographic areas
    - Use CloudScape Autosuggest component with async loading capabilities
    - Load first page of results (50 items) from backend on component mount
    - Implement text input with debounced search (300ms delay)
    - Send search query to backend via ?search=text parameter
    - Combine with geographic area filter when applicable (?search=text&geographicAreaId=id)
    - Display loading indicator during async fetch operations
    - Support pagination for large result sets
    - Handle empty states when no results match
    - Handle error states gracefully
    - Provide accessible keyboard navigation
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.9_

  - [x] 25.2 Update ParticipantForm to use AsyncEntitySelect
    - Replace venue dropdown with AsyncEntitySelect for venue selection
    - Configure for participant entity type
    - Pass appropriate fetch function and display formatter
    - _Requirements: 26.2_

  - [x] 25.3 Update ActivityForm to use AsyncEntitySelect
    - Replace venue dropdown with AsyncEntitySelect for venue selection
    - Configure for venue entity type
    - _Requirements: 26.1_

  - [x] 25.4 Update AssignmentForm to use AsyncEntitySelect
    - Replace participant dropdown with AsyncEntitySelect
    - Configure for participant entity type
    - _Requirements: 26.2_

  - [x] 25.5 Update VenueForm to use AsyncEntitySelect
    - Replace geographic area dropdown with AsyncEntitySelect
    - Configure for geographic area entity type
    - _Requirements: 26.3_

  - [x] 25.6 Update GeographicAreaForm to use AsyncEntitySelect
    - Replace parent geographic area dropdown with AsyncEntitySelect
    - Configure for geographic area entity type
    - _Requirements: 26.3_

  - [x] 25.7 Update AddressHistoryForm to use AsyncEntitySelect
    - Replace venue dropdown with AsyncEntitySelect
    - Configure for venue entity type
    - _Requirements: 26.1_

  - [x] 25.8 Update ActivityVenueHistoryForm to use AsyncEntitySelect
    - Replace venue dropdown with AsyncEntitySelect
    - Configure for venue entity type
    - _Requirements: 26.1_

  - [x] 25.9 Update API service methods to support search parameter
    - Update ParticipantService.getParticipants to accept search parameter
    - Update VenueService.getVenues to accept search parameter
    - Update GeographicAreaService.getGeographicAreas to accept search parameter
    - Add search as query parameter in API requests
    - _Requirements: 26.5_

  - [ ]* 25.10 Write property tests for async dropdown filtering
    - **Property 94: Async Dropdown Initial Load**
    - **Property 95: Async Dropdown Text Filtering**
    - **Property 96: Dropdown Input Debouncing**
    - **Property 97: Dropdown Loading Indicator**
    - **Property 98: Dropdown Combined Filtering**
    - **Validates: Requirements 26.4, 26.5, 26.6, 26.7**

- [ ] 26. Enhance Participant entity with additional optional fields
  - [ ] 26.1 Update ParticipantForm component
    - Make email field optional (remove required validation)
    - Add dateOfBirth field (DatePicker, optional)
    - Add dateOfRegistration field (DatePicker, optional)
    - Add nickname field (Input, optional, max 100 chars)
    - Validate email format only when email is provided
    - Validate dateOfBirth is in the past when provided
    - Validate dateOfRegistration is a valid date when provided
    - Update form state to include new fields
    - _Requirements: 4.7, 4.8, 4.9, 4.10, 4.11_

  - [ ] 26.2 Update ParticipantList component
    - Update table columns to handle optional email (display empty cell or placeholder)
    - Consider adding nickname column if space permits
    - Ensure search still works with optional email
    - _Requirements: 4.1, 4.2_

  - [ ] 26.3 Update ParticipantDetail component
    - Display new fields (dateOfBirth, dateOfRegistration, nickname) in detail view
    - Format dates appropriately for display
    - Handle null/undefined values gracefully
    - Display email as optional field
    - _Requirements: 4.12_

  - [ ] 26.4 Update TypeScript types
    - Update Participant interface to include new optional fields
    - Update ParticipantFormData interface
    - Ensure type safety across all components
    - _Requirements: 4.9, 4.10, 4.11_

  - [ ] 26.5 Update validation utilities
    - Update participant validation to make email optional
    - Add dateOfBirth validation (must be in past)
    - Add dateOfRegistration validation (valid date)
    - Add nickname validation (max 100 chars)
    - _Requirements: 4.8, 4.10, 4.11_

  - [ ]* 26.6 Write property tests for new participant fields
    - **Property 7A: Optional Email Validation**
    - **Property 7B: Date of Birth Validation**
    - **Property 7C: Date of Registration Validation**
    - **Property 99: Nickname Length Validation**
    - **Validates: Requirements 4.8, 4.9, 4.10, 4.11**

  - [ ] 26.7 Update API service
    - Ensure ParticipantService handles new fields in requests/responses
    - Update createParticipant and updateParticipant methods
    - _Requirements: 4.9, 4.10, 4.11_

- [ ] 27. Checkpoint - Verify participant enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 28. Make Activity Categories clickable in Activity Category list
  - [ ] 28.1 Update ActivityCategoryList component
    - Render activity category name as CloudScape Link component in the name column
    - Add onClick handler to category link that opens the edit form for that category
    - Use Link's onFollow event to trigger the edit action
    - Prevent default link navigation behavior
    - Use consistent styling with other hyperlinked columns in the application
    - _Requirements: 2.17, 2.18_

  - [ ]* 28.2 Write property test for category link functionality
    - **Property 4A: Activity Category Link in Category List**
    - **Validates: Requirements 2.17, 2.18**

- [x] 29. Merge Participant Roles into Configuration Page
  - [x] 29.1 Update ConfigurationPage component
    - Import ParticipantRoleList component
    - Add ParticipantRoleList to the page layout after ActivityTypeList
    - Update page header description to reflect all three configuration entities
    - Use SpaceBetween component to stack all three tables with consistent spacing
    - Ensure proper visual hierarchy and separation between sections
    - _Requirements: 2.1, 2.19, 2.20, 3.1_

  - [x] 29.2 Update navigation and routing
    - Update navigation menu to point to /configuration for all three entity types
    - Remove separate /participant-roles route if it exists
    - Update any links that point to separate participant roles page
    - Ensure breadcrumbs and navigation reflect unified configuration page
    - _Requirements: 2.1, 2.19, 2.20_

  - [x] 29.3 Remove ParticipantRolesPage component
    - Delete ParticipantRolesPage.tsx file
    - Remove route definition for participant roles page
    - Update any imports or references to the old page
    - _Requirements: 2.1, 2.19, 2.20_

  - [x] 29.4 Remove ActivityTypesPage component if unused
    - Check if ActivityTypesPage.tsx is still referenced
    - If not used, delete the file
    - Remove route definition if it exists
    - _Requirements: 2.1_

  - [ ]* 29.5 Write property test for unified configuration page
    - **Property 121: Configuration Page Displays All Three Tables**
    - Test that configuration page renders activity categories, activity types, and participant roles
    - Test that tables are displayed in correct order
    - Test that all CRUD operations work for each entity type
    - **Validates: Requirements 2.1, 2.19, 2.20, 3.1**

- [ ] 30. Checkpoint - Verify configuration page consolidation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify navigation works correctly
  - Verify all three entity types can be managed from single page

- [ ] 31. Checkpoint - Verify configuration page enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [x] 30. Implement CSV Import and Export
  - [x] 30.1 Create CSV utility functions
    - Create downloadBlob(blob, filename) utility function for triggering browser downloads
    - Create validateCSVFile(file) utility function for file validation (.csv extension, max 10MB)
    - Add to utils directory
    - _Requirements: 29.19, 29.20_

  - [x] 30.2 Add CSV export methods to API services
    - Add exportParticipants(geographicAreaId?) to ParticipantService
    - Add exportVenues(geographicAreaId?) to VenueService
    - Add exportActivities(geographicAreaId?) to ActivityService
    - Add exportGeographicAreas() to GeographicAreaService
    - Use axios with responseType: 'blob' for binary response
    - Call downloadBlob() to trigger browser download
    - Generate filename with current date
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.24_

  - [x] 30.3 Add CSV import methods to API services
    - Add importParticipants(file) to ParticipantService
    - Add importVenues(file) to VenueService
    - Add importActivities(file) to ActivityService
    - Add importGeographicAreas(file) to GeographicAreaService
    - Create FormData and append file
    - Set Content-Type header to multipart/form-data
    - Return ImportResult from response
    - _Requirements: 29.8, 29.9, 29.10, 29.11, 29.12, 29.13_

  - [x] 30.4 Add Export CSV button to ParticipantList
    - Add CloudScape Button with iconName="download" to table header actions
    - Implement handleExport handler that calls exportParticipants with global geographic filter
    - Show loading indicator during export
    - Disable button during export
    - Display success notification after export
    - Display error notification on failure
    - Hide button from READ_ONLY users
    - Show button to EDITOR and ADMINISTRATOR users
    - _Requirements: 29.1, 29.5, 29.16, 29.17, 29.22, 29.23, 29.24, 29.25_

  - [x] 30.5 Add Import CSV button to ParticipantList
    - Add hidden file input with accept=".csv"
    - Add CloudScape Button with iconName="upload" to table header actions
    - Implement handleFileSelect handler that validates file and calls importParticipants
    - Show loading indicator during import
    - Disable button during import
    - Display import results modal with success/failure counts and error details
    - Refresh participant list after successful import
    - Display error notification on failure
    - Hide button from READ_ONLY users
    - Show button to EDITOR and ADMINISTRATOR users
    - _Requirements: 29.8, 29.12, 29.13, 29.14, 29.15, 29.16, 29.17, 29.18, 29.19, 29.20, 29.22, 29.23_

  - [x] 30.6 Add Export and Import CSV buttons to VenueList
    - Implement same pattern as ParticipantList
    - Use VenueService export/import methods
    - Apply global geographic filter to exports
    - _Requirements: 29.2, 29.9, 29.22, 29.23, 29.24_

  - [x] 30.7 Add Export and Import CSV buttons to ActivityList
    - Implement same pattern as ParticipantList
    - Use ActivityService export/import methods
    - Apply global geographic filter to exports
    - _Requirements: 29.3, 29.10, 29.22, 29.23, 29.24_

  - [x] 30.8 Add Export and Import CSV buttons to GeographicAreaList
    - Implement same pattern as ParticipantList
    - Use GeographicAreaService export/import methods
    - No geographic filter for geographic areas export
    - _Requirements: 29.4, 29.11, 29.22, 29.23_

  - [x] 30.9 Create ImportResultsModal component
    - Create reusable CloudScape Modal component for displaying import results
    - Show success/failure counts with CloudScape Alert
    - Display error table with row numbers and error messages using CloudScape Table
    - Provide close button
    - Accept ImportResult as prop
    - _Requirements: 29.14, 29.15_

  - [x] 30.10 Create TypeScript types for CSV operations
    - Create ImportResult interface with totalRows, successCount, failureCount, errors
    - Create ImportError interface with row, data, errors
    - Add to types directory
    - _Requirements: 29.14, 29.15_

  - [ ]* 30.11 Write property tests for CSV operations
    - **Property 142: CSV Export Button Visibility**
    - **Property 143: CSV Import Button Visibility**
    - **Property 144: CSV Export Trigger**
    - **Property 145: Empty CSV Download**
    - **Property 146: CSV Import File Selection**
    - **Property 147: CSV Import Success Handling**
    - **Property 148: CSV Import Error Handling**
    - **Property 149: CSV File Validation**
    - **Property 150: CSV Operation Loading States**
    - **Property 151: CSV Export Geographic Filtering**
    - **Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8, 29.9, 29.10, 29.11, 29.12, 29.14, 29.15, 29.16, 29.17, 29.18, 29.19, 29.20, 29.22, 29.23, 29.24, 29.25**

- [x] 30A. Implement Engagement Summary Table CSV Export
  - [x] 30A.1 Create generateEngagementSummaryCSV utility function
    - Create utility function that accepts EngagementMetrics and groupingDimensions
    - Build header row with grouping dimension names and metric column names
    - Add Total row with aggregate metrics (blank cells for dimension columns except first)
    - Add dimensional breakdown rows when grouping is active
    - Use human-friendly labels from dimensions object (not UUIDs)
    - Escape CSV special characters (quotes, commas, newlines)
    - Return Blob with CSV content
    - Add to utils directory
    - _Requirements: 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_

  - [x] 30A.2 Add Export CSV button to EngagementDashboard
    - Add CloudScape Button with iconName="download" near Engagement Summary table header
    - Implement handleExportEngagementSummary handler
    - Call generateEngagementSummaryCSV with current metrics and grouping dimensions
    - Generate filename: "engagement-summary-YYYY-MM-DD.csv" using formatDate utility
    - Call downloadBlob to trigger browser download
    - Show loading indicator during export
    - Disable button during export
    - Display success notification after export
    - Display error notification on failure
    - Hide button from READ_ONLY users
    - Show button to EDITOR and ADMINISTRATOR users
    - _Requirements: 30.1, 30.8, 30.9, 30.10, 30.11, 30.12, 30.13, 30.14, 30.17_

  - [x] 30A.3 Handle filtered and grouped data in CSV export
    - Ensure CSV export uses the same filtered metrics displayed in the table
    - Preserve grouping structure in CSV output
    - Export only data matching current filter state (PropertyFilter tokens, date range, geographic area)
    - Handle empty table case (export header row only)
    - _Requirements: 30.15, 30.16, 30.18_

  - [ ]* 30A.4 Write property tests for Engagement Summary CSV export
    - **Property 152: Engagement Summary CSV Export Button Presence**
    - **Property 153: Engagement Summary CSV Content Completeness**
    - **Property 154: Engagement Summary CSV Human-Friendly Labels**
    - **Property 155: Engagement Summary CSV Filename Format**
    - **Property 156: Engagement Summary CSV Export Loading State**
    - **Property 157: Engagement Summary CSV Export Filtered Data**
    - **Property 158: Engagement Summary CSV Empty Table Handling**
    - **Validates: Requirements 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.8, 30.9, 30.10, 30.11, 30.13, 30.14, 30.15, 30.16, 30.17, 30.18**

- [ ] 31. Checkpoint - Verify CSV import/export functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 32. Implement optional field clearing UI
  - [ ] 32.1 Create ClearableInput component
    - Create reusable component that wraps CloudScape Input with clear button
    - Display X icon button when field has a value
    - Hide clear button when field is empty
    - Call onClear callback when X button is clicked
    - Support for text inputs (email, phone, notes, nickname)
    - _Requirements: 27.1, 27.2, 27.4, 27.7, 27.8_

  - [ ] 32.2 Create ClearableDatePicker component
    - Create reusable component that wraps CloudScape DatePicker with clear button
    - Display X icon button when date is selected
    - Hide clear button when date is empty
    - Call onClear callback when X button is clicked
    - Support for date inputs (dateOfBirth, dateOfRegistration, endDate)
    - _Requirements: 27.1, 27.3, 27.7, 27.8_

  - [ ] 32.3 Create ClearableSelect component
    - Create reusable component that wraps CloudScape Select with clear button
    - Display X icon button when option is selected
    - Hide clear button when no option selected
    - Call onClear callback when X button is clicked
    - Support for select inputs (venueType)
    - _Requirements: 27.2, 27.7, 27.8_

  - [ ] 32.4 Update ParticipantForm to use clearable components
    - Replace Input with ClearableInput for email, phone, notes, nickname fields
    - Replace DatePicker with ClearableDatePicker for dateOfBirth, dateOfRegistration fields
    - Handle onClear callbacks to set field values to null
    - Track which fields have been explicitly cleared vs unchanged
    - Send null for cleared fields in API request
    - Omit unchanged fields from API request
    - _Requirements: 27.1, 27.5, 27.6, 27.7, 27.8, 27.9_

  - [ ] 32.5 Update VenueForm to use clearable components
    - Replace Input with ClearableInput for latitude, longitude fields
    - Replace Select with ClearableSelect for venueType field
    - Handle onClear callbacks to set field values to null
    - When coordinates are cleared, remove map pin and reset map view
    - Track which fields have been explicitly cleared vs unchanged
    - Send null for cleared fields in API request
    - Omit unchanged fields from API request
    - _Requirements: 27.2, 27.5, 27.6, 27.7, 27.8, 27.9_

  - [ ] 32.6 Update ActivityForm to use clearable components
    - Replace DatePicker with ClearableDatePicker for endDate field
    - Handle onClear callback to set endDate to null (converts to ongoing)
    - Track which fields have been explicitly cleared vs unchanged
    - Send null for cleared endDate in API request
    - Omit unchanged fields from API request
    - _Requirements: 27.3, 27.5, 27.6, 27.7, 27.8, 27.9_

  - [ ] 32.7 Update AssignmentForm to use clearable components
    - Replace Input with ClearableInput for notes field
    - Handle onClear callback to set notes to null
    - Track which fields have been explicitly cleared vs unchanged
    - Send null for cleared notes in API request
    - Omit unchanged fields from API request
    - _Requirements: 27.4, 27.5, 27.6, 27.7, 27.8, 27.9_

  - [ ]* 32.8 Write property tests for optional field clearing
    - **Property 107: Optional Field Clearing in Participant Form**
    - **Property 108: Optional Field Clearing in Venue Form**
    - **Property 109: End Date Clearing in Activity Form**
    - **Property 110: Notes Clearing in Assignment Form**
    - **Property 111: Clear Button Visibility**
    - **Property 112: Field Clearing vs Omission Distinction**
    - **Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9**

- [ ] 33. Checkpoint - Verify optional field clearing functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 35. Fix Growth Dashboard chart data field mismatch
  - [x] 35.1 Identify the correct field name for time series data
    - Backend returns `period` field in GrowthPeriodData
    - Frontend charts expect `date` field
    - Design document specifies `date` field in GrowthPeriodData interface
    - Backend implementation uses `period` instead of `date`
    - _Requirements: 7.40, 7.41, 7.42_

  - [x] 35.2 Update backend analytics service to use `date` field
    - Change `period: period.label` to `date: period.label` in getGrowthMetrics method
    - Update GrowthPeriodData interface in analytics.service.ts to use `date` instead of `period`
    - Ensure consistency with design document specification
    - _Requirements: 7.40, 7.41, 7.42_

  - [x] 35.3 Verify charts render correctly after fix
    - Test New Activities line chart displays data
    - Test Cumulative Growth area chart displays data
    - Test with different time periods (DAY, WEEK, MONTH, YEAR)
    - Test with and without date range filters
    - Test with geographic area filters
    - _Requirements: 7.40, 7.41, 7.42_

- [x] 36. Implement interactive chart legends
  - [x] 36.1 Create InteractiveLegend component
    - Create reusable component for making chart legends interactive
    - Accept props: chartId (unique identifier), series (array of series names/keys), onVisibilityChange callback
    - Maintain visibility state for each data series using React useState
    - Provide onClick handler for legend items to toggle series visibility
    - Apply visual styling to hidden series (opacity: 0.5, text-decoration: line-through, or dimmed color)
    - Provide hover states (cursor: pointer, slight highlight) on legend items
    - Implement keyboard navigation (Tab to focus, Enter/Space to toggle)
    - Include ARIA attributes (role="button", aria-pressed, aria-label) for accessibility
    - Announce visibility changes to screen readers using aria-live region
    - Ensure at least one series remains visible (prevent hiding all series)
    - Return visibility state object for parent component to use
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.10, 27.11, 27.12_

  - [ ]* 35.2 Write property tests for InteractiveLegend component
    - **Property 113: Legend Item Click Toggles Series Visibility**
    - **Property 114: Hidden Series Visual Indication**
    - **Property 115: Independent Series Toggling**
    - **Property 116: Minimum Visible Series**
    - **Property 119: Legend Item Hover Feedback**
    - **Property 120: Legend Accessibility**
    - **Validates: Requirements 27.2, 27.3, 27.4, 27.5, 27.6, 27.10, 27.11**

  - [x] 35.3 Update GrowthDashboard to use interactive legends
    - Import InteractiveLegend component
    - Add InteractiveLegend to both Unique Participants and Unique Activities charts
    - Pass unique chartId for each chart ("growth-participants", "growth-activities")
    - Extract series names from chart data based on view mode (All/Type/Category)
    - Use visibility state from InteractiveLegend to filter data passed to recharts LineChart
    - Only render Line components for visible series
    - Update chart axis scales to reflect visible data range
    - Ensure consistent color scheme is maintained when series are toggled
    - _Requirements: 27.1, 27.7, 27.8, 27.9_

  - [x] 35.4 Update ActivityLifecycleChart to use interactive legend
    - Import InteractiveLegend component
    - Add InteractiveLegend to the bar chart
    - Pass chartId "activity-lifecycle"
    - Extract series names from chart data based on view mode (Type/Category)
    - Use visibility state to filter data passed to recharts BarChart
    - Only render Bar components for visible series
    - Update chart axis scales to reflect visible data range
    - _Requirements: 27.1, 27.7, 27.8, 27.9_

  - [x] 35.5 Update EngagementDashboard Activities chart to use interactive legend
    - Import InteractiveLegend component
    - Add InteractiveLegend to the Activities chart
    - Pass chartId "engagement-activities"
    - Extract series names from chart data based on view mode (Type/Category)
    - Use visibility state to filter displayed data
    - Update chart rendering to reflect visible series only
    - _Requirements: 27.1, 27.7, 27.8, 27.9_

  - [x] 35.6 Update Role Distribution chart to use interactive legend
    - Import InteractiveLegend component
    - Add InteractiveLegend to the role distribution chart
    - Pass chartId "role-distribution"
    - Extract role names as series from chart data
    - Use visibility state to filter displayed roles
    - Update chart rendering to reflect visible series only
    - _Requirements: 27.1, 27.7, 27.8, 27.9_

  - [x] 35.7 Update Geographic Breakdown chart to use interactive legend
    - Import InteractiveLegend component
    - Add InteractiveLegend to the geographic breakdown chart
    - Pass chartId "geographic-breakdown"
    - Extract geographic area names as series from chart data
    - Use visibility state to filter displayed areas
    - Update chart rendering to reflect visible series only
    - _Requirements: 27.1, 27.7, 27.8, 27.9_

  - [ ]* 35.8 Write integration tests for interactive legends across all charts
    - **Property 117: Interactive Legend Application to All Multi-Series Charts**
    - **Property 118: Chart Responsiveness with Series Toggling**
    - Test that all multi-series charts have interactive legends
    - Test that toggling series updates chart display correctly
    - Test that axis scales adjust appropriately
    - Test that chart remains responsive after toggling
    - **Validates: Requirements 27.1, 27.7, 27.8, 27.9**

- [x] 36. Checkpoint - Verify interactive chart legends functionality
  - Ensure all tests pass, ask the user if questions arise.
  - Test legend interactivity on all charts
  - Verify accessibility with keyboard navigation and screen readers
  - Verify series visibility persistence across page reloads

- [x] 37. Enhance activity status update to set end date when completing or cancelling
  - [x] 37.1 Update ActivityDetail component status update logic
    - Modify handleUpdateStatus function to include startDate and endDate in update payload
    - When status is COMPLETED or CANCELLED, check if endDate is null
    - If endDate is null, set endDate to today's date (ISO 8601 datetime format) - this converts ongoing activities to finite
    - When status is CANCELLED, check if startDate is in the future
    - If startDate is in the future, set startDate to today's date (ISO 8601 datetime format)
    - Pass updated fields (status, startDate, endDate, version) to ActivityService.updateActivity
    - _Requirements: 5.12a, 5.12b, 5.12c_

  - [ ]* 37.2 Write property tests for status update with implicit date setting
    - **Property 159: Mark Complete Sets End Date When Null**
    - **Property 160: Cancel Activity Sets End Date When Null**
    - **Property 161: Cancel Activity Sets Start Date When Future**
    - Test that marking activity as COMPLETED sets endDate to today when null
    - Test that marking activity as CANCELLED sets endDate to today when null
    - Test that marking activity as CANCELLED sets startDate to today when startDate is in the future
    - Test that marking activity as CANCELLED preserves startDate when startDate is in the past
    - Test that existing endDate is preserved when not null
    - **Validates: Requirements 5.12a, 5.12b, 5.12c**

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

**ActivityForm with Venue History and Participant Assignments:**
- The ActivityForm component should include embedded sections for managing both venue associations and participant assignments
- Display venue associations table and participant assignments table stacked vertically, with venue associations appearing above participant assignments
- In create mode: Allow adding venue associations and participant assignments that will be created after the activity is created
- In edit mode: Display existing venue associations and participant assignments with add/edit/delete capabilities
- Use mini-tables or expandable sections within the form to display venue history and participant assignments
- Validate venue associations and participant assignments before form submission
- Submit activity data, venue association changes, and participant assignment changes in appropriate sequence
- Provide atomic user experience where all activity configuration can be completed before backend persistence

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


- [x] 38. Fix navigation guard and detail page refresh issues on entity edit pages
  - [x] 38.1 Fix navigation guard not clearing after successful update
    - Update ParticipantForm to call clearDirtyState or setInitialValues after successful update
    - In updateMutation.onSuccess callback, update initialFormState to match current form values
    - This prevents navigation guard from triggering after successful save
    - Apply same fix to ActivityForm, VenueForm, and GeographicAreaForm components
    - _Requirements: 2A.9, 2A.10, 2A.11, 2A.12, 2A.13, 2A.14_

  - [x] 38.2 Fix detail page not refreshing after edit
    - Update ParticipantFormPage to invalidate participant detail query after successful update
    - In handleSuccess callback, call queryClient.invalidateQueries for both list and detail queries
    - Invalidate queries: ['participants'], ['participant', id], ['participantAddressHistory', id]
    - Apply same fix to ActivityFormPage, VenueFormPage, and GeographicAreaFormPage
    - Ensure detail pages show updated data immediately after navigation from edit page
    - _Requirements: 4.5, 5.6, 6A.5, 6B.3_

  - [ ]* 38.3 Write property tests for navigation guard and refresh behavior
    - **Property 162: Navigation Guard Clears After Successful Update**
    - **Property 163: Detail Page Shows Updated Data After Edit**
    - Test that navigation guard does not trigger after successful form submission
    - Test that detail page displays updated data without manual refresh
    - Test that form dirty state is cleared after successful save
    - **Validates: Requirements 2A.9, 2A.10, 2A.14, 4.5, 5.6, 6A.5, 6B.3**

- [ ] 39. Implement geographic authorization management UI
  - [ ] 39.1 Create GeographicAuthorizationService
    - Implement getAuthorizationRules(userId) to fetch from /users/:id/geographic-authorizations
    - Implement createAuthorizationRule(userId, geographicAreaId, ruleType) via POST
    - Implement deleteAuthorizationRule(userId, authId) via DELETE
    - Implement getAuthorizedAreas(userId) to fetch from /users/:id/authorized-areas
    - _Requirements: 31.2, 31.6, 31.7, 31.12_

  - [ ] 39.2 Create TypeScript types for geographic authorization
    - Create UserGeographicAuthorization interface (id, userId, geographicAreaId, geographicArea, ruleType, createdAt, createdBy)
    - Create AuthorizedArea interface (geographicAreaId, geographicArea, accessLevel, isDescendant, isAncestor)
    - Create RuleType enum ('ALLOW' | 'DENY')
    - Create AccessLevel enum ('FULL' | 'READ_ONLY' | 'DENIED')
    - Add to types directory
    - _Requirements: 31.5, 31.11, 31.13_

  - [ ] 39.3 Create UserAuthorizationsPage component
    - Create dedicated full page for managing authorization rules
    - Accessible via route: /users/:userId/authorizations
    - Display user email and role in page header using ContentLayout
    - Display table of authorization rules using CloudScape Table
    - Show geographic area name, rule type, and creation date columns
    - Visually distinguish ALLOW rules (green checkmark icon) from DENY rules (red X icon)
    - Provide "Add Rule" button in header actions
    - Provide delete button for each rule
    - Display effective access summary section with three subsections:
      - Allowed Areas (full access) - list with descendant count
      - Ancestor Areas (read-only) - list with read-only badge
      - Denied Areas - list with denied badge
    - Display explanatory Alert about authorization rules
    - Display warning Alert when DENY rules override ALLOW rules
    - Provide back button or breadcrumb navigation to /users
    - Only render for ADMINISTRATOR role (redirect non-admins)
    - _Requirements: 31.1, 31.2, 31.4, 31.5, 31.6, 31.7, 31.11, 31.12, 31.13, 31.14, 31.15, 31.16, 31.17, 31.18, 31.19, 31.20_

  - [ ] 39.4 Create GeographicAuthorizationForm component
    - Create modal form for adding authorization rules
    - Use AsyncEntitySelect for geographic area selection
    - Use CloudScape RadioGroup for rule type selection (ALLOW or DENY)
    - Validate geographic area is selected
    - Validate rule type is selected
    - Display warning when creating DENY rules
    - Handle duplicate rule errors gracefully
    - Only accessible to ADMINISTRATOR role
    - _Requirements: 31.6, 31.8, 31.9, 31.10, 31.15, 31.17_

  - [ ] 39.5 Add route for UserAuthorizationsPage
    - Add /users/:userId/authorizations route to React Router configuration
    - Make route protected (require authentication)
    - Add authorization check (require ADMINISTRATOR role)
    - Redirect non-administrators to dashboard
    - _Requirements: 31.1, 31.15, 31.16_

  - [ ] 39.6 Update UserList component
    - Change "Manage Authorizations" button to a link
    - Use React Router Link or navigate to /users/:userId/authorizations
    - Only show authorization link to ADMINISTRATOR role
    - _Requirements: 31.3, 31.16_

  - [ ]* 39.7 Write property tests for geographic authorization UI
    - **Property 159: Authorization Rules Display**
    - **Property 160: Authorization Rule Visual Distinction**
    - **Property 161: Authorization Rule Creation**
    - **Property 162: Duplicate Authorization Rule Prevention**
    - **Property 163: Effective Access Summary Display**
    - **Property 164: Authorization Management Admin Restriction**
    - **Property 165: DENY Rule Override Warning**
    - **Property 166: Authorization Explanatory Text**
    - **Property 167: Back Navigation from Authorization Page**
    - **Validates: Requirements 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.8, 31.10, 31.11, 31.12, 31.13, 31.14, 31.15, 31.16, 31.17, 31.18, 31.19, 31.20**

- [ ] 40. Checkpoint - Verify geographic authorization UI
  - Ensure all tests pass, ask the user if questions arise.
  - Test authorization rule creation and deletion
  - Test effective access summary calculation
  - Verify admin-only access restrictions
  - Test visual distinction between ALLOW and DENY rules
