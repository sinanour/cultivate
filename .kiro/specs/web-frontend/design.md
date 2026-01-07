# Design Document: Web Frontend Package

## Overview

The Web Frontend package is a Progressive Web Application (PWA) built with React 18+, TypeScript, and Vite that provides community organizers with a responsive interface for managing activities, participants, and viewing analytics. The application uses AWS CloudScape Design System for all UI components and supports offline operation through IndexedDB and Service Workers.

The frontend communicates with the Backend API package for data persistence and authentication, while maintaining local caches for offline functionality. The design prioritizes user experience through clear navigation, comprehensive form validation, and real-time feedback during operations.

## Architecture

### Technology Stack

**Core Framework:**
- React 18+ with TypeScript for type safety and modern React features (concurrent rendering, automatic batching)
- Vite for fast development server and optimized production builds
- React Router v6 for client-side routing and navigation

**UI Components:**
- AWS CloudScape Design System exclusively for all UI elements
- Ensures consistency with AWS design patterns and accessibility standards

**State Management:**
- React Query (TanStack Query) for server state management, caching, and synchronization
- React Context API for global UI state (theme, user session, offline status)
- Local component state for form inputs and UI interactions

**Offline Support:**
- IndexedDB via Dexie.js for structured local data storage
- Service Worker for asset caching and offline detection
- Custom sync queue for pending operations during offline periods

**Build and Development:**
- Vite for module bundling and hot module replacement
- TypeScript for compile-time type checking
- ESLint and Prettier for code quality

### Application Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components (forms, tables, etc.)
│   ├── layout/         # Layout components (navigation, header, etc.)
│   └── features/       # Feature-specific components
├── pages/              # Route-level page components
├── hooks/              # Custom React hooks
├── services/           # API client and business logic
│   ├── api/           # Backend API integration
│   ├── offline/       # Offline storage and sync
│   └── auth/          # Authentication service
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── contexts/           # React contexts
└── App.tsx            # Root application component
```

### Design Rationale

**CloudScape Design System:** Chosen for its comprehensive component library, built-in accessibility, and consistency with AWS ecosystem. Reduces custom CSS and ensures professional appearance.

**React Query:** Selected for its powerful caching, automatic background refetching, and optimistic updates. Simplifies server state management and reduces boilerplate compared to Redux.

**Dexie.js:** Provides a clean, promise-based API over IndexedDB with better TypeScript support than raw IndexedDB API. Handles schema versioning and migrations.

**Vite:** Offers significantly faster development experience than webpack-based tools through native ES modules and optimized production builds.

## Components and Interfaces

### Core Components

#### 1. Authentication Components

**LoginPage**
- Renders email and password input fields using CloudScape FormField and Input
- Validates inputs before submission
- Displays error messages using CloudScape Alert component
- Checks for redirect URL parameter in query string (e.g., ?redirect=/activities/123)
- On successful authentication, executes animated transition sequence before navigation
- **Animation Sequence:**
  1. **Form Fade Out (1000ms)**: Fades out the login form container div until it disappears
  2. **Icon Display**: Renders icon-no-bg.svg image centered on screen at 256x256 pixels
  3. **Stroke Animation (2000ms)**: Animates the SVG stroke from 0% to 100% drawn using CSS stroke-dasharray and stroke-dashoffset
  4. **Navigation**: Redirects to the URL specified in redirect parameter if present, otherwise redirects to dashboard
- Stores redirect URL in component state during login process
- Uses CSS transitions and keyframe animations for smooth visual effects
- Ensures animation completes before navigation occurs
- **Technical Implementation Notes:**
  - SVG stroke animation uses `stroke-dasharray` set to total path length and `stroke-dashoffset` animated from total length to 0
  - Path length calculated using `getTotalLength()` method on SVG path elements
  - Animation phases orchestrated using React state and `setTimeout` or CSS `animationend` events
  - Icon asset located at `/public/icon-no-bg.svg`

**ProtectedRoute**
- Wrapper component that checks authentication status
- Redirects to login if user is not authenticated
- When redirecting to login, captures the current URL path and query parameters
- Appends the original URL as a query parameter to the login route (e.g., /login?redirect=/activities/123)
- Checks user role for authorization
- Conditionally renders children based on permissions

#### 2. Layout Components

**AppLayout**
- Uses CloudScape AppLayout component for consistent structure
- Implements sticky header positioning using CSS (position: sticky or fixed)
- Ensures header remains visible at the top of the viewport during vertical scrolling
- Adjusts content area padding/margin to prevent header from obscuring content
- Renders navigation sidebar with links to all sections
- Displays user menu with name, role, and logout option
- Shows connection status indicator (online/offline)
- Highlights current active section
- Displays global geographic area filter selector in header utilities section
- Shows current filter selection or "Global" when no filter is active
- When displaying active filter, includes the full ancestor hierarchy path to provide geographic context
- Renders all ancestor areas in breadcrumb as clickable links
- When user clicks unauthorized ancestor, clears filter (reverts to "Global")
- Provides dropdown with geographic areas formatted with hierarchical context:
  - Each option displays the geographic area name and type
  - Below the type, displays the full ancestor hierarchy path
  - Hierarchy path ordered from closest ancestor (left) to most distant ancestor (right)
  - Ancestor names separated by " > " symbol
  - Example format: "NEIGHBOURHOOD\nCommunity A > City B > Province C"
- When global filter is active, dropdown shows only descendants of the filtered area
- When global filter is "Global", dropdown shows all geographic areas
- Shows visual indicator (badge or highlighted text) of active filter in header
- Provides clear button (X icon) to remove filter and return to "Global" view
- Positions filter selector prominently in header for accessibility from all views
- Never suppresses ancestor areas from any display, as they provide essential navigational context
- Validates filter selections against user's authorized areas, clearing filter for unauthorized areas

**Navigation**
- Renders navigation items based on user role
- Hides admin-only sections from non-administrators
- Maintains navigation state across route changes

#### 3. Activity Configuration Management

**ActivityCategoryList**
- Displays table of activity categories using CloudScape Table
- Distinguishes predefined vs custom categories with badges
- Renders activity category name as clickable CloudScape Link component in the name column
- When category name link is clicked, opens the edit form for that category
- Provides edit and delete actions per row (no separate View button)
- Handles delete validation (prevents deletion if activity types reference it)

**ActivityCategoryForm**
- Modal form for creating/editing activity categories
- Validates name is not empty
- Submits to API and updates cache

**ActivityTypeList**
- Displays table of activity types using CloudScape Table
- Groups activity types by their category
- Distinguishes predefined vs custom types with badges
- Renders activity type name as hyperlink in primary column (links to edit form or detail view)
- Shows associated activity category for each type
- Provides edit and delete actions per row (no separate View button)
- Handles delete validation (prevents deletion if activities reference it)

**ActivityTypeForm**
- Modal form for creating/editing activity types
- Requires activity category selection from dropdown
- Validates name is not empty
- Validates activity category is selected
- Submits to API and updates cache

**ConfigurationView**
- Unified page/view for managing activity categories, activity types, participant roles, and populations
- Displays all four tables in a cohesive interface on a single page
- Shows hierarchical relationship between categories and types
- Provides easy navigation between category, type, role, and population management
- Uses CloudScape SpaceBetween component to stack the four tables vertically with appropriate spacing
- Displays tables in order: Activity Categories, Activity Types, Participant Roles, Populations

#### 4. Participant Role Management

**ParticipantRoleList**
- Displays table of roles using CloudScape Table
- Distinguishes predefined vs custom roles with badges
- Renders role name as hyperlink in primary column (links to edit form or detail view)
- Provides edit and delete actions per row (no separate View button)
- Handles delete validation (prevents deletion if referenced)
- Integrated within the ConfigurationView page alongside activity categories and types

**ParticipantRoleForm**
- Modal form for creating/editing roles
- Validates name is not empty
- Submits to API and updates cache

#### 4A. Population Management

**PopulationList**
- Displays table of populations using CloudScape Table
- Renders population name as hyperlink in primary column (links to edit form or detail view)
- Provides edit and delete actions per row (no separate View button)
- Handles delete validation (prevents deletion if referenced by participants)
- Integrated within the ConfigurationView page alongside activity categories, types, and roles
- Edit and delete actions restricted to ADMINISTRATOR role only
- All roles can view populations

**PopulationForm**
- Modal form for creating/editing populations
- Validates name is not empty
- Submits to API and updates cache
- Only accessible to ADMINISTRATOR role

#### 5. Participant Management

**ParticipantList**
- Displays table with search, sort, and filter capabilities
- Uses CloudScape Table with pagination
- Renders participant name as hyperlink in primary column (links to /participants/:id)
- Provides actions for edit and delete (no separate View button)
- Implements client-side search across name and email
- Applies global geographic area filter from context when active
- Filters to show only participants whose current home venue is in the filtered geographic area or its descendants

**ParticipantFormPage**
- Dedicated full-page form for creating/editing participants (not a modal)
- Accessible via routes: /participants/new (create) and /participants/:id/edit (edit)
- Validates name as required field
- Validates email format when email is provided (email is optional)
- Validates dateOfBirth is in the past when provided (optional)
- Validates dateOfRegistration is a valid date when provided (optional)
- Supports optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields
- Provides clear buttons (X icons) next to optional fields to remove previously entered values
- When clear button is clicked, sets field value to null/empty and sends null to API on save
- Visually indicates when optional fields are empty vs populated
- Displays inline validation errors
- Includes embedded address history management section within the form
- Allows adding new address history records with venue and effective start date
- Allows editing existing address history records (edit mode only)
- Allows deleting existing address history records (edit mode only)
- Displays address history table in reverse chronological order within the form
- Validates address history records for required fields and duplicate prevention
- When adding address history to a new participant (before participant is created), fetches venue details from backend and stores in temporary record for display
- Displays venue name in address history table by accessing venue object from temporary records
- Implements navigation guard using React Router's useBlocker to detect dirty form state
- When user attempts to navigate away with unsaved changes, displays confirmation dialog
- Allows vertical scrolling to accommodate large forms with embedded sections
- Includes embedded population membership management section within the form
- Allows adding participant to populations
- Allows removing participant from populations
- Displays populations the participant belongs to in a list or table
- Supports zero, one, or multiple population memberships per participant

**ParticipantDetail**
- Shows participant information in detail view
- Renders participant email address as a clickable mailto link using CloudScape Link component
- Renders participant phone number as a clickable tel link using CloudScape Link component
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Navigates to /participants/:id/edit when edit button is clicked
- Shows confirmation dialog when delete button is clicked
- Navigates to participant list page after successful deletion
- Displays error message when deletion fails
- Hides edit and delete buttons when user has READ_ONLY role
- Shows edit and delete buttons when user has EDITOR or ADMINISTRATOR role
- Lists all activities the participant is assigned to in a table
- Displays activity name (with link to detail), type, role, status, dates, and notes for each assignment
- Shows loading state while fetching activities
- Shows empty state when participant has no activity assignments
- Shows address history table in reverse chronological order
- Provides interface to add new address history records
- Provides interface to edit existing address history records
- Provides interface to delete address history records
- Displays population memberships in a list or table
- Shows which populations the participant belongs to

**AddressHistoryTable**
- Displays participant's home address history in reverse chronological order
- Renders venue name as hyperlink in primary column (links to /venues/:id)
- Shows effective start date for each record (displays "Initial Address" for null dates)
- Provides edit and delete buttons for each record (no separate View button)
- Highlights the most recent address (first record in the list, or null record if no non-null dates exist)

**AddressHistoryForm**
- Modal form for adding/editing address history records
- Requires venue selection from dropdown
- Allows optional effective start date using CloudScape DatePicker
- When effective start date is null, treats it as the oldest home address for the participant
- Validates at most one null effective start date per participant
- Prevents duplicate records with the same effective start date (including null) for the same participant

#### 6. Activity Management

**ActivityList**
- Displays table with filtering by category, type, and status
- Renders activity name as hyperlink in primary column (links to /activities/:id)
- Shows activity category and type
- Visually distinguishes finite vs ongoing activities
- Provides sort capabilities
- Provides edit and delete actions per row (no separate View button)
- Shows activity dates and status badges
- Applies global geographic area filter from context when active
- Filters to show only activities whose current venue is in the filtered geographic area or its descendants

**ActivityFormPage**
- Dedicated full-page form for creating/editing activities (not a modal)
- Accessible via routes: /activities/new (create) and /activities/:id/edit (edit)
- Conditionally requires end date for finite activities
- Allows null end date for ongoing activities
- Provides clear button (X icon) next to end date field to convert finite activity to ongoing
- When end date clear button is clicked, sets endDate to null and sends null to API on save
- Validates name, type, and start date
- Provides date pickers using CloudScape DatePicker
- Includes embedded venue history management section within the form
- Allows adding new venue associations with effective start dates
- Allows editing existing venue associations (edit mode only)
- Allows deleting existing venue associations (edit mode only)
- Displays venue history table in reverse chronological order within the form
- Validates venue associations for required fields and duplicate prevention
- When adding venue associations to a new activity (before activity is created), fetches venue details from backend and stores in temporary record for display
- Displays venue name in venue history table by accessing venue object from temporary records
- Includes embedded participant assignment management section within the form
- Allows adding new participant assignments with participant, role, and optional notes
- Allows editing existing participant assignments (edit mode only)
- Allows removing existing participant assignments (edit mode only)
- Displays participant assignments table in reverse chronological order or by participant name within the form
- Validates participant assignments for required fields (participant, role) and duplicate prevention (same participant + role)
- When adding participant assignments to a new activity (before activity is created), fetches participant details from backend and finds role from already-loaded roles list (no additional API call)
- Displays participant name and role name in assignments table by accessing participant and role objects from temporary records
- Displays venue associations table and participant assignments table stacked vertically, with venue associations appearing above participant assignments
- Provides atomic user experience where all activity details, venue associations, and participant assignments can be configured before the activity is persisted to the backend
- Implements navigation guard using React Router's useBlocker to detect dirty form state
- When user attempts to navigate away with unsaved changes, displays confirmation dialog
- Allows vertical scrolling to accommodate large forms with embedded sections

**ActivityDetail**
- Shows activity information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Navigates to /activities/:id/edit when edit button is clicked
- Shows confirmation dialog when delete button is clicked
- Navigates to activity list page after successful deletion
- Displays error message when deletion fails
- Hides edit and delete buttons when user has READ_ONLY role
- Shows edit and delete buttons when user has EDITOR or ADMINISTRATOR role
- Lists all assigned participants with their roles
- Provides interface to add/remove participant assignments
- Shows venue history table in reverse chronological order
- Provides interface to add venue associations
- Provides interface to remove venue associations
- Shows "Mark Complete" button that updates status to COMPLETED
- Shows "Cancel Activity" button that updates status to CANCELLED
- When "Mark Complete" is clicked, implicitly sets endDate to today if null (converting ongoing to finite)
- When "Cancel Activity" is clicked, implicitly sets endDate to today if null and sets startDate to today if startDate is in the future

**ActivityVenueHistoryTable**
- Displays activity's venue history in reverse chronological order
- Renders venue name as hyperlink in primary column (links to /venues/:id)
- Shows effective start date for each record (displays "Since Activity Start" or activity startDate for null dates)
- Provides delete button for each record (no separate View button)
- Highlights the most recent venue (first record in the list, or null record if no non-null dates exist)

**ActivityVenueHistoryForm**
- Modal form for adding venue associations
- Requires venue selection from dropdown
- Allows optional effective start date using CloudScape DatePicker
- When effective start date is null, treats the venue association start date as the same as the activity start date
- Validates at most one null effective start date per activity
- Prevents duplicate records with the same effective start date (including null) for the same activity

#### 7. Assignment Management

**AssignmentForm**
- Interface to assign participants to activities
- Requires role selection from dropdown
- Validates role is selected
- Prevents duplicate assignments (same participant + role)
- Supports optional notes field with clear button (X icon) to remove previously entered notes
- When notes clear button is clicked, sets notes to null and sends null to API on save

**AssignmentList**
- Displays assigned participants on activity detail
- Renders participant name as hyperlink in primary column (links to /participants/:id)
- Shows role and notes for each assignment
- Provides remove button for each assignment (no separate View button)

#### 8. Venue Management

**VenueList**
- Displays table of venues with name, address, and geographic area
- Uses CloudScape Table with search, sort, and filter capabilities
- Renders venue name as hyperlink in primary column (links to /venues/:id)
- Renders geographic area name as hyperlink in geographic area column (links to /geographic-areas/:id)
- Provides actions for edit and delete (no separate View button)
- Implements client-side search across name and address
- Applies global geographic area filter from context when active
- Filters to show only venues in the filtered geographic area or its descendants

**VenueFormPage**
- Dedicated full-page form for creating/editing venues (not a modal)
- Accessible via routes: /venues/new (create) and /venues/:id/edit (edit)
- Validates name, address, and geographic area are required
- Uses Geographic_Area_Selector component for geographic area selection
- Supports optional latitude, longitude, and venue type fields
- Provides clear buttons (X icons) next to optional coordinate and venue type fields to remove previously entered values
- When clear button is clicked for coordinates, sets both latitude and longitude to null and removes map pin
- When clear button is clicked for venue type, sets field to null
- Sends null values to API on save to clear optional fields
- Provides "Geocode Address" button to automatically populate coordinates
- Displays loading indicator during geocoding request
- Shows selection dialog when multiple geocoding results are returned
- Displays error message when address cannot be geocoded
- Disables geocode button when offline
- Allows manual override of geocoded coordinates
- Displays inline validation errors
- Handles delete validation (prevents deletion if referenced)
- Displays interactive map view component positioned to the right of the form
- Displays "Drop Pin" button in map view header (right-justified)
- When "Drop Pin" button is clicked, places pin at current center point of map viewport
- When pin is placed via "Drop Pin" button, updates latitude/longitude fields with center point coordinates
- When pin is placed via "Drop Pin" button, zooms map to street-level (zoom 15-17)
- Renders draggable pin on map when coordinates are populated
- Sets map zoom to reasonable level (e.g., zoom level 15) when coordinates are first populated
- Updates latitude/longitude input fields when pin is dragged to new position
- When user right-clicks on map, moves pin to clicked location
- When pin is repositioned via right-click, updates latitude/longitude input fields
- Updates map pin position when latitude/longitude fields are manually edited
- Maintains two-way synchronization between coordinate inputs and map pin at all times
- Preserves user-adjusted zoom level during coordinate updates (only adjusts center point, not zoom)
- Implements navigation guard using React Router's useBlocker to detect dirty form state
- When user attempts to navigate away with unsaved changes, displays confirmation dialog
- Allows vertical scrolling to accommodate form fields and embedded map view

**VenueDetail**
- Shows venue information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Navigates to /venues/:id/edit when edit button is clicked
- Shows confirmation dialog when delete button is clicked
- Navigates to venue list page after successful deletion
- Displays error message when deletion fails
- Hides edit and delete buttons when user has READ_ONLY role
- Shows edit and delete buttons when user has EDITOR or ADMINISTRATOR role
- Lists all activities associated with the venue (current and historical) with activity names hyperlinked to /activities/:id
- Lists all participants with this venue as their current home address (most recent address history) with participant names hyperlinked to /participants/:id
- Displays geographic area hierarchy path

#### 9. Geographic Area Management

**GeographicAreaList**
- Displays hierarchical tree view of geographic areas using CloudScape TreeView component
- Uses TreeView with items prop containing hierarchical data structure
- Manages expanded state with expandedItems and onExpandedItemsChange
- Shows vertical connector lines to visualize hierarchy relationships
- Renders area type badges for each node with increased vertical spacing
- Renders geographic area name as hyperlink in tree nodes (links to /geographic-areas/:id)
- Applies padding directly to interactive elements for full-height clickability and hover treatment
- Automatically expands all nodes when page loads for immediate visibility
- Supports click-to-toggle expansion on any row with children
- Provides hover highlighting with smooth transitions for interactive feedback
- Shows pointer cursor for expandable rows, default cursor for leaf nodes
- Provides Edit and Delete actions per node based on user permissions (no separate View button)
- Prevents action button clicks from triggering row toggle using event propagation control
- Handles delete validation (prevents deletion if referenced by venues or child areas)
- Shows area type badges for each geographic area
- Provides expand/collapse functionality for hierarchy navigation
- Provides actions for edit and delete (no separate View button)
- Handles delete validation (prevents deletion if referenced)
- Applies global geographic area filter from context when active
- When filtered, displays the selected area, all its descendants, and all its ancestors (to maintain hierarchy context)
- Visually indicates ancestor areas as read-only when displayed due to filtering (e.g., with a badge, icon, or muted styling)
- Never suppresses or hides ancestor areas from the tree view, as they provide essential navigational context

**GeographicAreaFormPage**
- Dedicated full-page form for creating/editing geographic areas (not a modal)
- Accessible via routes: /geographic-areas/new (create) and /geographic-areas/:id/edit (edit)
- Validates name and area type are required
- Provides dropdown for area type selection (NEIGHBOURHOOD, COMMUNITY, CITY, etc.)
- Uses Geographic_Area_Selector component for parent geographic area selection
- Prevents circular parent-child relationships
- Displays inline validation errors
- Implements navigation guard using React Router's useBlocker to detect dirty form state
- When user attempts to navigate away with unsaved changes, displays confirmation dialog
- Allows vertical scrolling to accommodate form fields

**GeographicAreaDetail**
- Shows geographic area information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Navigates to /geographic-areas/:id/edit when edit button is clicked
- Shows confirmation dialog when delete button is clicked
- Navigates to geographic area list page after successful deletion
- Displays error message when deletion fails
- Hides edit and delete buttons when user has READ_ONLY role
- Shows edit and delete buttons when user has EDITOR or ADMINISTRATOR role
- Displays full hierarchy path from root to current area
- Lists all child geographic areas
- Lists all venues in the geographic area and all descendant areas (recursive aggregation)
- Shows statistics (activity and participant counts) for the area and descendants (recursive aggregation)
- **Note:** Venue list should recursively include venues from all child and descendant geographic areas, matching the recursive behavior of statistics

#### 11. Map View

**MapView**
- Renders interactive map using Leaflet or Mapbox GL JS
- Provides mode selector control to switch between "Activities", "Participant Homes", and "Venues" modes
- In Activities mode: displays activity markers at current venue locations, color-coded by activity type
- In Activity Categories mode: displays activity markers at current venue locations, color-coded by activity category
- In Participant Homes mode: displays markers for participant home addresses (current venue from address history)
- In Venues mode: displays markers for all venues with coordinates, regardless of activities or participants
- Implements marker clustering for dense areas
- Provides popup with mode-specific information on marker click
- Includes map controls for zoom, pan, and center
- Displays right-aligned legend in Activities mode showing only activity types that are visible on the map
- Displays right-aligned legend in Activity Categories mode showing only activity categories that are visible on the map
- Filters legend items dynamically based on current markers after applying all filters
- Hides legend when no markers are visible
- Respects global geographic area filter across all modes

**MapFilters**
- Provides filter controls for activity category, activity type, status, date range, and population
- Updates map markers based on selected filters
- When population filter is applied: shows only activities with participants in specified populations
- When population filter is applied in Participant Homes mode: shows only participants in specified populations
- Disables population filter control when map mode is "Venues" (population filtering has no effect on venues)
- Enables population filter control when map mode is "Activities", "Activity Categories", or "Participant Homes"
- Provides geographic area boundary toggle
- Includes button to center map on specific venue or geographic area

**MapPopup**
- In Activities mode: displays activity name (hyperlinked to /activities/:id), category, type, start date, and participant count
- In Participant Homes mode: displays venue name (hyperlinked to /venues/:id) and count of participants living at that address
- In Venues mode: displays venue name (hyperlinked to /venues/:id), address, and geographic area
- Provides navigation to detail pages via hyperlinked names

#### 13. Analytics Dashboards

**EngagementDashboard**
- Displays comprehensive temporal metrics using CloudScape Cards:
  - Activities at start/end of date range
  - Activities started, completed, cancelled within range
  - Participants at start/end of date range
  - Participation (non-unique) at start/end of date range
  - Info icons next to participant and participation metrics with popover explanations
- Displays aggregate counts and breakdowns by activity category and activity type for activities, participants, and participation
- Renders charts for activities distribution, role distribution, and geographic breakdown
- **Activities Chart** (renamed from "Activities by Type"):
  - Displays chart titled "Activities" (generic name to reflect multiple view modes)
  - Provides CloudScape SegmentedControl above or within chart area with two options:
    - "Activity Type" (default selection)
    - "Activity Category"
  - Follows same UX pattern as map view toggle functionality
  - When "Activity Type" selected: displays activities grouped by activity type
  - When "Activity Category" selected: displays activities grouped by activity category
  - Updates data display without page refresh when view mode changes
  - Preserves current date range and filter selections when switching views
  - Displays activity counts in descending order by count value
  - Shows appropriate empty state message when no activities exist for grouping dimension
  - Handles API errors gracefully with user-friendly error messages
  - Stores selected view mode in browser localStorage (key: "activitiesChartViewMode")
  - Restores previously selected view mode from localStorage on dashboard load
  - Defaults to "Activity Type" view if no localStorage value exists or localStorage unavailable
  - Segmented control is keyboard navigable (Tab and Arrow keys)
  - Provides visual focus indicators when segmented control options receive focus
  - Includes appropriate ARIA labels for screen readers (aria-label="Activities chart view mode")
  - Announces view mode changes to screen readers using aria-live region
  - Displays interactive legend when multiple activity types or categories are shown
  - Allows users to click legend items to toggle individual series visibility
  - Visually indicates hidden series with dimmed text or reduced opacity in legend
  - Adjusts chart axis scales dynamically when series are toggled
  - Provides hover states on legend items to indicate clickability
  - Ensures legend items are keyboard navigable (Tab key) and screen reader accessible
- Provides multi-dimensional grouping controls:
  - Activity category grouping
  - Activity type grouping
  - Venue grouping
  - Geographic area grouping
- **PropertyFilter Component** for unified filtering:
  - Replaces separate activity type and venue filter dropdowns
  - Uses CloudScape PropertyFilter component
  - Supports filtering by Activity Category, Activity Type, Venue, and Population properties
  - Supports multi-select for each property (OR logic within dimension)
  - Applies AND logic across different properties (e.g., categories AND venues AND populations)
  - Implements lazy loading of property values when user types in filter input
  - Asynchronously fetches matching values from backend APIs:
    - Activity Categories: from ActivityCategoryService.getActivityCategories()
    - Activity Types: from ActivityTypeService.getActivityTypes()
    - Venues: from VenueService.getVenues() with geographic area filtering
    - Populations: from PopulationService.getPopulations()
  - Debounces user input internally (CloudScape handles debouncing)
  - Displays loading indicator while fetching property values
  - Supports multiple filter tokens with AND logic across dimensions
  - Provides clear labels for each property (Activity Category, Activity Type, Venue, Population)
  - Displays selected property values in filter tokens
  - Allows clearing all filters at once
  - Integrates with existing date range and geographic area filters
  - Persists filter tokens to URL query parameters
  - Restores filter tokens from URL on page load
  - Extracts filter values from tokens (propertyKey and value) and applies to analytics queries
  - Supports operators: = (equals) and != (not equals)
- Provides date range filter using CloudScape DateRangePicker
- Renders "Engagement Summary" table using CloudScape Table:
  - Always visible regardless of whether grouping dimensions are selected
  - Provides info icon next to "Engagement Summary" table header
  - When info icon clicked, displays popover explaining: "Participant Count: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once. Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."
  - First row displays aggregate metrics with "Total" label in first column
  - When multiple grouping dimensions selected, subsequent dimension cells in Total row are left blank
  - When date range is specified: displays metric columns with temporal labels (activities at start, at end, started, completed, cancelled, participants at start, at end, participation at start, participation at end)
  - When no date range is specified: hides "at start" columns (always 0 for all-time metrics) and simplifies "at end" columns to current state labels (Participants, Participation, Activities, Activities Started, Activities Completed, Activities Cancelled)
  - When grouping dimensions selected, additional rows show dimensional breakdowns:
    - Breakdown dimension columns appear first (activity category, activity type, venue, geographic area)
    - Activity category names rendered as hyperlinks to /configuration (Activity Configuration page)
    - Activity type names rendered as hyperlinks to /configuration (Activity Configuration page)
    - Venue names rendered as hyperlinks to /venues/:id
    - Geographic area names rendered as hyperlinks to /geographic-areas/:id
  - Each metric displayed in its own column for easy comparison
- Displays pie chart showing breakdown of unique activities by activity category:
  - Positioned in line width (full width of its container) to the left of the role distribution chart
  - Uses same filtered data as other dashboard components
  - Displays activity category names in the legend
  - Uses consistent color scheme with other dashboard charts
  - Shows activity category name and count on hover over pie segments
  - Includes interactive legend allowing users to toggle individual category segments on/off
  - Displays appropriate message or keeps at least one segment visible when all are hidden
  - Integrates with InteractiveLegend component for consistent behavior
- Shows role distribution chart within filtered and grouped results with interactive legend:
  - Allows users to click legend items to toggle individual role series on/off
  - Visually indicates hidden series with dimmed text or reduced opacity
  - Adjusts chart scales dynamically when series are toggled
  - Provides hover states and keyboard navigation for legend items
- Displays geographic breakdown chart showing engagement by geographic area with interactive legend:
  - Displays both unique participant counts and total participation counts
  - Uses separate data series for "Participants" (unique count) and "Participation" (non-unique count)
  - Renders geographic area names with customized labels that include area type badges
  - Displays area type badge underneath the geographic area name in chart labels
  - Uses getAreaTypeBadgeColor() utility function to determine badge color for each area type
  - Formats chart labels with area name on first line and area type badge on second line
  - Implements custom tick component or label formatter for recharts to render multi-line labels with badges
  - Allows users to click legend items to toggle individual data series on/off
  - Visually indicates hidden series with dimmed text or reduced opacity
  - Adjusts chart scales dynamically when series are toggled
  - Provides hover states and keyboard navigation for legend items
- Allows drilling down into child geographic areas
- Uses recharts library for data visualization
- Displays all-time metrics when no date range specified
- Synchronizes all filter and grouping parameters with URL query parameters:
  - Filter parameters: activityCategory, activityType, venue, geographicArea, startDate, endDate
  - Grouping parameters: groupBy (array)
  - Reads URL parameters on component mount to initialize dashboard state
  - Updates URL when user changes filters or grouping
  - Enables browser back/forward navigation between different configurations
  - Allows URL sharing for collaborative analysis
- **CSV Export for Engagement Summary Table:**
  - Provides "Export CSV" button positioned near the Engagement Summary table header
  - Button uses CloudScape Button component with iconName="download"
  - Generates CSV file containing all rows from the Engagement Summary table
  - Exports human-friendly labels (activity category names, activity type names, venue names, geographic area names) instead of UUIDs
  - Includes Total row as first data row in CSV
  - Includes all dimensional breakdown rows when grouping dimensions are selected
  - When date range is specified: includes all temporal metric columns (activities at start, at end, started, completed, cancelled, participants at start, at end, participation at start, participation at end)
  - When no date range is specified: includes only current state and temporal event columns (Participants, Participation, Activities, Activities Started, Activities Completed, Activities Cancelled)
  - Uses descriptive column headers matching table headers
  - Generates filename that reflects active filters with format: "engagement-summary" + filter segments + current date
  - When global geographic area filter is active: includes area name and type in format "{name}-{type}" (e.g., "Vancouver-City", "Downtown-Neighbourhood")
  - Formats geographic area type in title case with hyphens for multi-word types
  - When date range filter is active: includes start and end dates in ISO-8601 format (YYYY-MM-DD)
  - When activity category, type, venue, or population filters are active: includes their sanitized names
  - Sanitizes filter values by replacing spaces with hyphens and removing invalid filename characters (colons, slashes, backslashes, asterisks, question marks, quotes, angle brackets, pipes)
  - Omits inactive filters from filename to keep it concise
  - Separates filename components with underscores
  - Example filenames:
    - No filters: "engagement-summary_2026-01-06.csv"
    - With geographic area: "engagement-summary_Vancouver-City_2026-01-06.csv"
    - With date range: "engagement-summary_2025-01-01_2025-12-31_2026-01-06.csv"
    - Multiple filters: "engagement-summary_Vancouver-City_Study-Circles_2025-01-01_2025-12-31_2026-01-06.csv"
  - Displays loading indicator during export operation
  - Disables button during export to prevent duplicate requests
  - Shows success notification after download completes
  - Displays error message if export fails
  - Respects role-based access control (hidden from READ_ONLY users)
  - Exports only filtered and grouped data matching current dashboard state
  - Handles empty tables by exporting CSV with only header row

**ActivityLifecycleChart**
- Displays activity lifecycle events (started and completed activities) within a selected time period or all time
- Positioned after the Activities chart on the Engagement Dashboard
- Uses CloudScape Container with Header component
- Provides CloudScape SegmentedControl in header actions with two options:
  - "By Type" (default selection)
  - "By Category"
- When "By Type" selected: groups and displays data by activity type
- When "By Category" selected: groups and displays data by activity category
- Displays two data series using recharts BarChart:
  - "Started" series (activities with startDate within time period or all time) - blue color (#0088FE)
  - "Completed" series (activities with endDate within time period and status COMPLETED, or all completed) - green color (#00C49F)
- Displays interactive legend allowing users to toggle individual data series (Started/Completed) on/off
- Visually indicates hidden series in legend with dimmed text or reduced opacity
- Adjusts chart axis scales dynamically when series are toggled
- Provides hover states on legend items to indicate clickability
- Ensures legend is keyboard navigable and screen reader accessible
- Excludes cancelled activities from both series
- Updates chart data when view mode toggle changes
- Animates transitions smoothly when switching between views
- Fetches data from `/api/analytics/activity-lifecycle` endpoint
- Accepts props:
  - `startDate?: Date` (optional - omit for all history)
  - `endDate?: Date` (optional - omit for all history)
  - `geographicAreaIds?: string[]` (optional filter)
  - `activityTypeIds?: string[]` (optional filter)
  - `venueIds?: string[]` (optional filter)
- Handles all date range scenarios:
  - Absolute date range: Uses provided startDate and endDate
  - Relative date range: Calculates absolute dates from relative amount/unit
  - No date range: Omits dates to show all-time lifecycle events
- Applies all provided filters to API request
- Displays loading state with CloudScape LoadingSpinner while fetching data
- Displays error state with error message if API request fails
- Displays empty state message when no lifecycle events exist for selected grouping
- Stores selected view mode in browser localStorage (key: "lifecycleChartViewMode")
- Restores previously selected view mode from localStorage on component mount
- Defaults to "By Type" view if no localStorage value exists or localStorage unavailable
- Always renders regardless of date range selection (shows all-time data when no range selected)
- Includes screen reader announcement for view mode changes using aria-live region
- Responsive design adapts to different screen sizes
- Chart height: 400px
- Uses same color scheme as other dashboard charts for consistency

**GrowthDashboard**
- Displays three separate time-series charts: one for unique participant counts, one for unique activity counts, and one for total participation (non-unique participant-activity associations)
- Provides time period selector (day, week, month, year)
- Each time period represents a snapshot of unique participants, unique activities, and total participation engaged at that point in time (not cumulative counts)
- Provides CloudScape SegmentedControl to view growth metrics with three options:
  - "All" (default selection)
  - "Activity Type"
  - "Activity Category"
- When "All" selected: 
  - Displays single aggregate time-series line for total unique participants, single aggregate time-series line for total unique activities, and single aggregate time-series line for total participation across all activity types and categories in all three charts
  - Displays overall participant growth numbers, activity growth numbers, and participation growth numbers representing totals across all activity types and categories
- When "Activity Type" selected: 
  - Displays multiple time-series lines in all three charts, one line for each activity type showing unique participants, unique activities, and total participation for that type
  - Does NOT display overall growth numbers, showing only the grouped breakdown data
- When "Activity Category" selected: 
  - Displays multiple time-series lines in all three charts, one line for each activity category showing unique participants, unique activities, and total participation for that category
  - Does NOT display overall growth numbers, showing only the grouped breakdown data
- Uses consistent color scheme across all three charts (Unique Participants, Unique Activities, and Total Participation), so the same activity type or category has the same color on all charts
- Displays interactive legend on all three charts showing color mapping for each activity type or category when multiple lines are displayed
- Allows users to click legend items to toggle individual data series on/off
- Visually indicates hidden series in legend (dimmed text or reduced opacity)
- Maintains at least one visible series or displays appropriate message when all are hidden
- Adjusts chart axis scales dynamically when series are toggled
- Provides hover states on legend items to indicate clickability
- Ensures legend items are keyboard navigable and screen reader accessible
- Updates all three charts without page refresh when view mode changes between "All", "Activity Type", and "Activity Category"
- Preserves current time period, date range, and geographic area filter selections when switching between view modes
- Stores selected view mode in browser localStorage (key: "growthChartViewMode")
- Restores previously selected view mode from localStorage when user returns to Growth Dashboard
- Defaults to "All" view if no previous selection exists in localStorage
- Functions normally with "All" as default when localStorage is unavailable
- Uses separate line charts for each metric:
  - Unique Participants Chart: displays unique participant counts over time
  - Unique Activities Chart: displays unique activity counts over time
  - Total Participation Chart: displays total participation (non-unique) counts over time
  - Each chart has its own Y-axis scale optimized for its data range
- Provides info icons next to "Participant Growth" and "Participation Growth" boxes (displayed in "All" view mode)
- When info icon next to Participant Growth is clicked, displays popover explaining "Unique Participants: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once."
- When info icon next to Participation Growth is clicked, displays popover explaining "Total Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."
- Provides geographic area filter dropdown
- Provides multi-dimensional filter controls:
  - Activity category filter (multi-select, OR logic within dimension)
  - Activity type filter (multi-select, OR logic within dimension)
  - Geographic area filter (multi-select, OR logic within dimension, includes descendants)
  - Venue filter (multi-select, OR logic within dimension)
  - Population filter (multi-select, OR logic within dimension)
  - Applies AND logic across filter dimensions
- Uses recharts for line charts
- Synchronizes filter parameters with URL query parameters:
  - Period parameter: `?period=MONTH`
  - Absolute date range: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - Relative date range: `?relativePeriod=-90d` (compact format: -[amount][unit])
    - Units: d (day), w (week), m (month), y (year)
    - Examples: `-30d`, `-6m`, `-1y`
  - Filter parameters: activityCategoryIds, activityTypeIds, geographicAreaIds, venueIds, populationIds (arrays)
  - Grouping parameter: `?groupBy=all` or `?groupBy=type` or `?groupBy=category`
  - Reads URL parameters on component mount to initialize dashboard state
  - Updates URL when user changes filters (using React Router's useSearchParams)
  - Enables browser back/forward navigation between different configurations
  - Allows URL sharing for collaborative analysis

#### 9. User Management (Admin Only)

**UserList**
- Displays table of all users (admin only)
- Renders user display name (or email if displayName is null) as hyperlink in primary column (links to /users/:id/edit)
- Shows display name (or email), email, and role
- Provides edit action per row (no separate View button)
- Does NOT provide a separate "Manage Authorizations" action

**UserFormPage**
- Dedicated full-page form for creating/editing users (not a modal)
- Accessible via routes: /users/new (create) and /users/:id/edit (edit)
- Validates email and password (create only) are required
- Allows optional display name field
- Validates email format and uniqueness
- Validates password is at least 8 characters (create only)
- Allows role assignment and modification using CloudScape Select
- Displays inline validation errors
- Includes embedded geographic authorization management section within the form
- Displays all geographic authorization rules for the user in a table within the form
- Provides "Add Rule" button within the form to create new authorization rules
- Provides delete button for each authorization rule within the form
- Displays effective access summary section showing:
  - Allowed areas (full access) with list of descendants
  - Ancestor areas (read-only access) marked with read-only badge
  - Denied areas marked with denied badge
- Provides explanatory Alert describing authorization rules:
  - "ALLOW rules grant access to the selected area and all its descendants"
  - "ALLOW rules grant read-only access to ancestor areas for navigation context"
  - "DENY rules take precedence over ALLOW rules"
  - "Users with no rules have unrestricted access to all areas"
- Displays warning Alert when creating DENY rules that override existing ALLOW rules
- When creating a new user, allows adding geographic authorization rules before the user is persisted to the backend
- When creating a new user with authorization rules, persists the user and all authorization rules in a single atomic operation
- Implements navigation guard using React Router's useBlocker to detect dirty form state
- When user attempts to navigate away with unsaved changes, displays confirmation dialog
- Allows vertical scrolling to accommodate user fields and embedded authorization management
- Only accessible to administrators

**GeographicAuthorizationForm**
- Modal form for creating authorization rules (opened from UserFormPage)
- Uses Geographic_Area_Selector component for geographic area selection
- Requires rule type selection (ALLOW or DENY) using CloudScape RadioGroup
- Validates geographic area is selected
- Validates rule type is selected
- Prevents duplicate rules for same user and geographic area
- Displays preview of effective access changes before saving
- Displays warning when creating DENY rules
- Only accessible to ADMINISTRATOR role

#### 10. About Page

**AboutPage**
- Displays information about the Cultivate application
- Accessible via route: /about
- Renders the Cultivate app icon (icon-no-bg.svg) at appropriate size (e.g., 200x200 pixels)
- Displays the Universal House of Justice excerpt in a prominent text block:
  - "The Formative Age is that critical period in the Faith's development in which the friends increasingly come to appreciate the mission with which Bahá'u'lláh has entrusted them, deepen their understanding of the meaning and implications of His revealed Word, and systematically cultivate capacity—their own and that of others—in order to put into practice His teachings for the betterment of the world."
  - Includes attribution: "— The Universal House of Justice"
- Displays disclaimer text explaining this is an individual initiative:
  - "This software is an individual initiative to help communities more systematically track their growth, and has not been officially sponsored by any Bahá'í Institution."
- Provides hyperlink to official Bahá'í website (https://www.bahai.org) using CloudScape Link component
- Uses CloudScape Container, Header, and SpaceBetween components for consistent layout
- Accessible to all authenticated users (no role restrictions)
- Includes navigation link in the application menu

#### 14. Common Components

**Geographic_Area_Selector**
- Reusable dropdown component for selecting geographic areas with hierarchical context display
- Uses CloudScape Select component as foundation
- Displays custom option labels with area name and area type badge
- Renders option label using Box component with display="block" variant="div"
- First Box displays area name
- Second Box displays area type Badge with color from getAreaTypeBadgeColor() utility
- Uses Select's description property to display full ancestor hierarchy path
- Formats hierarchy path as "Ancestor1 > Ancestor2 > Ancestor3" (closest to most distant)
- Displays "No parent areas" when area has no ancestors
- Implements async lazy-loading of geographic areas from backend
- Loads first page of results (50 items) when dropdown opens
- Supports text-based filtering using CloudScape's filteringType="auto" (client-side filtering)
- Displays loading indicator using statusType="loading" while fetching
- Supports pagination for large result sets
- Accepts optional props to filter results by parent area or other criteria
- Handles empty states when no results match search
- Handles error states gracefully
- Provides accessible keyboard navigation
- Decoupled from any parent component (not tied to BreadcrumbGroup or global filter)
- Accepts standard form control props: value, onChange, disabled, error, placeholder, inlineLabelText
- Supports empty/unselected state with configurable placeholder text
- Does NOT artificially insert "Global" or "All Areas" option
- Uses expandToViewport property for dropdown expansion beyond container
- Provides renderHighlightedAriaLive callback for screen reader support
- Uses selectedAriaLabel property for accessibility
- Usable in both modal forms and full-page forms

**Implementation Details:**
- Accepts props: value (selected area ID), onChange (callback), options (GeographicAreaWithHierarchy[]), loading, disabled, error, placeholder, inlineLabelText
- Transforms GeographicAreaWithHierarchy objects into Select options with custom labelContent
- Uses React useMemo to optimize option rendering
- Integrates with existing geographic area utilities (getAreaTypeBadgeColor)
- Can be wrapped with additional UI elements (e.g., BreadcrumbGroup for global filter)

**Usage Examples:**
- Global geographic area filter in AppLayout header
- Venue form geographic area selection
- Geographic area form parent selection
- Geographic authorization form area selection
- Any other form requiring geographic area selection

**AsyncEntitySelect**
- Reusable dropdown component for high-cardinality entity selection (venues, participants, geographic areas)
- Uses CloudScape Autosuggest or Select component with async loading capabilities
- Loads first page of results from backend on component mount (default 50 items)
- Supports text-based filtering with debounced input (300ms delay)
- Sends search query to backend via `?search=text` parameter
- Displays loading indicator while fetching filtered results
- Supports pagination for large result sets (loads more on scroll or explicit action)
- Respects global geographic area filter when applicable (combines `?search=text&geographicAreaId=id`)
- Handles empty states and error states gracefully
- Provides clear visual feedback during async operations
- Optimizes for both small scoped datasets (shows all immediately) and large global datasets (requires filtering)

**Implementation Details:**
- Generic component accepting entity type, fetch function, and display formatter
- Maintains local state for search text, loading status, and current results
- Uses React Query for caching and request deduplication
- Implements virtual scrolling for large result sets
- Provides accessible keyboard navigation and screen reader support

**InteractiveLegend**
- Reusable component for making chart legends interactive across all multi-series charts
- Wraps recharts Legend component with click handlers and state management
- Maintains visibility state for each data series (visible/hidden)
- Provides onClick handler for legend items to toggle series visibility
- Applies visual styling to indicate hidden series (opacity: 0.5, text-decoration: line-through, or dimmed color)
- Provides hover states (cursor: pointer, slight highlight) to indicate legend items are clickable
- Integrates with recharts charts by controlling which series are rendered
- Ensures at least one series remains visible (prevents hiding all series)
- Provides keyboard navigation support (Tab to focus, Enter/Space to toggle)
- Includes ARIA attributes for accessibility (role="button", aria-pressed, aria-label)
- Announces series visibility changes to screen readers using aria-live region

**Implementation Details:**
- Accepts props: chartId (unique identifier), series (array of series names), onVisibilityChange callback
- Returns visibility state object mapping series names to boolean values
- Can be used with recharts LineChart, BarChart, AreaChart, PieChart, and other chart types
- Integrates seamlessly with existing chart configurations

**NavigationGuard (useFormNavigationGuard hook)**
- Custom React hook for implementing navigation guards on form pages
- Uses React Router's useBlocker to intercept navigation attempts
- Tracks dirty form state by comparing current form values to initial values
- Provides `isDirty` boolean indicating if form has unsaved changes
- Provides `setInitialValues(values)` method to set baseline for comparison
- Provides `clearDirtyState()` method to reset after successful submission
- When navigation is attempted with dirty form:
  - Blocks navigation automatically
  - Triggers confirmation dialog via callback
  - Allows navigation to proceed if user confirms discard
  - Cancels navigation if user chooses to stay
- Handles browser back/forward button navigation
- Handles programmatic navigation (Link clicks, navigate() calls)
- Cleans up blocker when component unmounts

**Implementation Details:**
- Accepts props: formValues (current form state), initialValues (baseline), onNavigationBlocked (callback for confirmation dialog)
- Returns: { isDirty, setInitialValues, clearDirtyState, confirmNavigation, cancelNavigation }
- Uses deep equality comparison for form value changes
- Ignores changes to non-user-editable fields (timestamps, IDs)
- Integrates with CloudScape Modal for confirmation dialog

**EntitySelectorWithActions**
- Reusable wrapper component that adds refresh and add action buttons to entity reference selectors
- Wraps any entity selector component (Geographic_Area_Selector, AsyncEntitySelect, or standard Select)
- Displays refresh button (CloudScape refresh icon) and add button (CloudScape add-plus icon) adjacent to the selector
- Uses CloudScape ButtonGroup or SpaceBetween to position buttons to the right of the selector
- When refresh button is clicked:
  - Triggers callback to reload entity options from backend
  - Displays loading indicator on button during reload operation
  - Restores button to normal state after reload completes
  - Maintains currently selected value if it still exists in refreshed list
- When add button is clicked:
  - Opens entity creation page in new browser tab using target="_blank"
  - Preserves current form context in original tab
  - Allows user to return to original tab and click refresh to see newly-added entity
- Disables add button when user lacks permission to create the referenced entity type
- Always enables refresh button regardless of user permissions
- Provides accessible keyboard navigation for action buttons
- Includes appropriate ARIA labels for screen readers

**Implementation Details:**
- Accepts props: 
  - children (entity selector component to wrap)
  - onRefresh (callback to reload options)
  - addEntityUrl (URL for entity creation page)
  - canAdd (boolean indicating if user has create permission)
  - isRefreshing (boolean indicating refresh in progress)
  - entityTypeName (string for accessibility labels, e.g., "geographic area", "venue")
- Renders selector component as child with action buttons positioned adjacent
- Uses CloudScape Button components with iconName="refresh" and iconName="add-plus"
- Implements loading state management for refresh operation
- Opens add URL in new tab using window.open() or Link with target="_blank"

**Usage Examples:**
- Wraps Geographic_Area_Selector in VenueForm
- Wraps AsyncEntitySelect for venues in ParticipantForm address history
- Wraps AsyncEntitySelect for venues in ActivityForm venue history
- Wraps Select for activity categories in ActivityTypeForm
- Wraps AsyncEntitySelect for participants in ActivityForm assignments
- Wraps Select for roles in ActivityForm assignments
- Wraps Select for populations in ParticipantForm
- Wraps Geographic_Area_Selector in GeographicAreaForm parent selection
- Wraps Geographic_Area_Selector in GeographicAuthorizationForm

### Service Layer

#### React Contexts

**GlobalGeographicFilterContext**
- Manages global geographic area filter state shared across all views
- Provides `selectedGeographicAreaId: string | null` - Currently selected geographic area ID or null for "Global" view
- Provides `selectedGeographicArea: GeographicArea | null` - Full geographic area object for display
- Provides `setGeographicAreaFilter(id: string | null)` - Updates filter selection
- Provides `clearFilter()` - Resets filter to "Global" (null)
- Provides `isLoading: boolean` - Indicates if geographic area details are being fetched
- Provides `availableAreas: GeographicAreaWithHierarchy[]` - List of geographic areas for the Geographic_Area_Selector component
- Provides `authorizedAreaIds: Set<string>` - Set of geographic area IDs the user is directly authorized to access (FULL access, not descendants, not read-only ancestors)
- Provides `isAuthorizedArea(areaId: string): boolean` - Checks if user has direct authorization for filtering
- Provides `formatAreaOption(area: GeographicAreaWithHierarchy): { label: string; description: string }` - Formats area for Geographic_Area_Selector display
- Synchronizes filter with URL query parameter (`?geographicArea=<id>`)
- Persists filter to localStorage (key: `globalGeographicAreaFilter`)
- Restores filter from localStorage on application initialization
- URL parameter takes precedence over localStorage on initial load
- Validates filter selections against user's authorized areas (excludes read-only ancestors)
- Automatically clears filter and removes URL parameter when unauthorized area is selected
- Prevents filtering by read-only ancestor areas to avoid incomplete analytics data
- Fetches full geographic area details when filter is set for display in header
- Fetches available areas based on current filter scope:
  - When filter is "Global": fetches all geographic areas
  - When filter is active: fetches only descendants of the filtered area
- Fetches ancestor hierarchy for each area to build hierarchy path display
- Formats options for Geographic_Area_Selector with label (area name) and description (hierarchy path)

#### API Service

**AuthService**
- `login(email, password)`: Authenticates user and returns JWT tokens (access token expires in 15 minutes, refresh token in 7 days)
- `logout()`: Clears tokens and redirects to login
- `refreshToken(refreshToken)`: Refreshes expired access token using refresh token
- `getCurrentUser()`: Fetches current user info from `/auth/me` endpoint
- `decodeToken(token)`: Decodes JWT to extract user information (userId, email, role)

**ActivityCategoryService**
- `getActivityCategories()`: Fetches all activity categories from `/activity-categories`
- `createActivityCategory(data)`: Creates new activity category
- `updateActivityCategory(id, data, version?)`: Updates existing activity category with optional version for optimistic locking
- `deleteActivityCategory(id)`: Deletes activity category (validates references, returns REFERENCED_ENTITY error if activity types reference it)

**ActivityTypeService**
- `getActivityTypes()`: Fetches all activity types from `/activity-types` with category information populated
- `createActivityType(data)`: Creates new activity type (requires activityCategoryId)
- `updateActivityType(id, data, version?)`: Updates existing activity type with optional version for optimistic locking
- `deleteActivityType(id)`: Deletes activity type (validates references, returns REFERENCED_ENTITY error if referenced)

**ParticipantRoleService**
- `getRoles()`: Fetches all roles from `/roles` endpoint
- `createRole(data)`: Creates new role
- `updateRole(id, data, version?)`: Updates existing role with optional version for optimistic locking
- `deleteRole(id)`: Deletes role (validates references, returns REFERENCED_ENTITY error if referenced)

**PopulationService**
- `getPopulations()`: Fetches all populations from `/populations` endpoint
- `createPopulation(data)`: Creates new population (admin only)
- `updatePopulation(id, data, version?)`: Updates existing population with optional version for optimistic locking (admin only)
- `deletePopulation(id)`: Deletes population (validates references, returns REFERENCED_ENTITY error if referenced, admin only)

**ParticipantPopulationService**
- `getParticipantPopulations(participantId)`: Fetches populations for a participant from `/participants/:id/populations`
- `addParticipantToPopulation(participantId, populationId)`: Adds participant to population via POST `/participants/:id/populations`
- `removeParticipantFromPopulation(participantId, populationId)`: Removes participant from population via DELETE `/participants/:id/populations/:populationId`

**ParticipantService**
- `getParticipants(page?, limit?, geographicAreaId?, search?)`: Fetches all participants with optional pagination, optional geographic area filter, and optional text search filter
- `getParticipant(id)`: Fetches single participant
- `getParticipantActivities(id)`: Fetches participant's activity assignments from `/participants/:id/activities`
- `createParticipant(data)`: Creates new participant
- `updateParticipant(id, data, version?)`: Updates existing participant with optional version for optimistic locking
- `deleteParticipant(id)`: Deletes participant

**ParticipantAddressHistoryService**
- `getAddressHistory(participantId)`: Fetches participant's home address history from `/participants/:id/address-history`
- `createAddressHistory(participantId, data)`: Creates new address history record via `/participants/:id/address-history`
- `updateAddressHistory(participantId, historyId, data)`: Updates existing address history record via `/participants/:id/address-history/:historyId`
- `deleteAddressHistory(participantId, historyId)`: Deletes address history record via `/participants/:id/address-history/:historyId`

**ActivityService**
- `getActivities(page?, limit?, geographicAreaId?)`: Fetches all activities with optional pagination and optional geographic area filter
- `getActivity(id)`: Fetches single activity with activityType populated
- `createActivity(data)`: Creates new activity (status defaults to PLANNED if not provided)
- `updateActivity(id, data, version?)`: Updates existing activity with optional version for optimistic locking
- `deleteActivity(id)`: Deletes activity
- `getActivityParticipants(id)`: Fetches participants assigned to activity from `/activities/:id/participants`
- `getActivityVenues(id)`: Fetches venue history for activity from `/activities/:id/venues` ordered by effectiveFrom descending
- `addActivityVenue(activityId, venueId, effectiveFrom?)`: Associates venue with activity with optional effective start date (null means uses activity startDate)
- `removeActivityVenue(activityId, venueId)`: Removes venue association (true deletion)

**AssignmentService**
- `addParticipant(activityId, participantId, roleId, notes?)`: Creates assignment via `/activities/:activityId/participants`
- `updateParticipant(activityId, participantId, roleId?, notes?)`: Updates assignment
- `removeParticipant(activityId, participantId)`: Removes assignment via `/activities/:activityId/participants/:participantId`
- `getActivityParticipants(activityId)`: Fetches assignments for activity

**VenueService**
- `getVenues(page?, limit?, geographicAreaId?, search?)`: Fetches all venues with optional pagination, optional geographic area filter, and optional text search filter
- `getVenue(id)`: Fetches single venue with geographicArea populated
- `searchVenues(query)`: Searches venues by name or address via `/venues/search?q=`
- `createVenue(data)`: Creates new venue
- `updateVenue(id, data, version?)`: Updates existing venue with optional version for optimistic locking
- `deleteVenue(id)`: Deletes venue (validates references, returns REFERENCED_ENTITY error if referenced)
- `getVenueActivities(id)`: Fetches activities associated with venue from `/venues/:id/activities`
- `getVenueParticipants(id)`: Fetches participants with venue as home from `/venues/:id/participants`

**GeocodingService**
- `geocodeAddress(address)`: Queries Nominatim API to convert address to coordinates
- `searchAddress(query)`: Searches for addresses using Nominatim search endpoint
- Returns array of geocoding results with latitude, longitude, and display name
- Implements rate limiting to respect Nominatim usage policy (max 1 request per second)
- Includes User-Agent header as required by Nominatim terms of service
- Handles API errors and network failures gracefully
- Caches recent geocoding results to reduce API calls
- `getVenueActivities(id)`: Fetches activities associated with venue from `/venues/:id/activities`
- `getVenueParticipants(id)`: Fetches participants with venue as home from `/venues/:id/participants`

**GeographicAreaService**
- `getGeographicAreas(page?, limit?, geographicAreaId?, search?)`: Fetches all geographic areas with optional pagination, optional geographic area filter (returns selected area, descendants, and ancestors for hierarchy context), and optional text search filter
- `getGeographicArea(id)`: Fetches single geographic area with parent populated
- `createGeographicArea(data)`: Creates new geographic area (validates circular relationships)
- `updateGeographicArea(id, data, version?)`: Updates existing geographic area with optional version for optimistic locking
- `deleteGeographicArea(id)`: Deletes geographic area (validates references, returns REFERENCED_ENTITY error if referenced)
- `getChildren(id)`: Fetches child geographic areas from `/geographic-areas/:id/children`
- `getAncestors(id)`: Fetches hierarchy path to root from `/geographic-areas/:id/ancestors`
- `getVenues(id)`: Fetches venues in geographic area from `/geographic-areas/:id/venues`
- `getStatistics(id)`: Fetches statistics for geographic area and descendants from `/geographic-areas/:id/statistics`
- `getDescendantIds(id)`: Fetches all descendant area IDs for recursive filtering (used by global filter)

**ParticipantAddressHistoryService**
- `getAddressHistory(participantId)`: Fetches participant's home address history from `/participants/:id/address-history`

**AnalyticsService**
- `getEngagementMetrics(params)`: Fetches comprehensive engagement data from `/analytics/engagement` with flexible multi-dimensional filtering
  - Parameters: `startDate?`, `endDate?`, `activityCategoryIds?` (array), `activityTypeIds?` (array), `geographicAreaIds?` (array), `venueIds?` (array), `populationIds?` (array), `groupBy?` (array of dimensions)
  - Supports OR logic within each filter dimension (e.g., `activityCategoryIds=[A, B]` means category IN (A, B))
  - Applies AND logic across filter dimensions (e.g., categories AND venues AND populations)
  - Returns temporal analysis: activities/participants/participation at start/end, activities started/completed/cancelled
  - Returns aggregate counts and breakdowns by activity category and activity type for activities, participants, and participation
  - Returns hierarchically grouped results when multiple dimensions specified
  - Returns role distribution within filtered results
  - When populationIds provided: includes only participants in specified populations and activities with at least one participant in specified populations
- `getGrowthMetrics(params)`: Fetches growth data from `/analytics/growth` with flexible multi-dimensional filtering
  - Parameters: `startDate?`, `endDate?`, `period` (DAY, WEEK, MONTH, YEAR), `activityCategoryIds?` (array), `activityTypeIds?` (array), `geographicAreaIds?` (array), `venueIds?` (array), `populationIds?` (array), `groupBy?` ('type' | 'category')
  - Supports OR logic within each filter dimension (e.g., `venueIds=[A, B]` means venue IN (A, B))
  - Applies AND logic across filter dimensions (e.g., categories AND venues AND populations)
  - Returns time-series data with unique participant counts, unique activity counts, and total participation counts per period
- `getGeographicAnalytics(parentGeographicAreaId?, startDate?, endDate?, activityCategoryIds?, activityTypeIds?, venueIds?, populationIds?)`: Fetches geographic breakdown from `/analytics/geographic`
  - When parentGeographicAreaId provided: returns metrics for immediate children of that area
  - When parentGeographicAreaId not provided: returns metrics for all top-level areas (null parent)
  - Each area's metrics aggregate data from the area and all its descendants (recursive)
  - Supports optional date range and filter parameters
  - Returns array of objects with geographicAreaId, geographicAreaName, areaType, activityCount, participantCount, participationCount
- `getActivityLifecycleEvents(params)`: Fetches activity lifecycle event data from `/analytics/activity-lifecycle`
  - Parameters: `startDate` (required), `endDate` (required), `groupBy` ('category' | 'type'), `geographicAreaIds?`, `activityTypeIds?`, `venueIds?`, `populationIds?`
  - Returns array of objects with `groupName`, `started` count, and `completed` count
  - Applies all provided filters using AND logic
  - When populationIds provided: includes only activities with at least one participant in specified populations

**UserService** (Admin only)
- `getUsers()`: Fetches all users from `/users` (admin only)
- `getUser(id)`: Fetches single user from `/users/:id` (admin only)
- `createUser(data)`: Creates new user with optional authorization rules via POST `/users` (admin only)
  - Accepts: displayName, email, password, role, authorizationRules (optional array)
  - When authorizationRules provided, creates user and rules in single atomic operation
- `updateUser(id, data)`: Updates user including displayName, email, password, and role via PUT `/users/:id` (admin only)

**GeographicAuthorizationService** (Admin only)
- `getAuthorizationRules(userId)`: Fetches all authorization rules for a user from `/users/:id/geographic-authorizations`
- `createAuthorizationRule(userId, geographicAreaId, ruleType)`: Creates new authorization rule via POST `/users/:id/geographic-authorizations`
- `deleteAuthorizationRule(userId, authId)`: Deletes authorization rule via DELETE `/users/:id/geographic-authorizations/:authId`
- `getAuthorizedAreas(userId)`: Fetches effective authorized areas from `/users/:id/authorized-areas` (includes allowed areas, descendants, and ancestors with access level flags)

#### Sync Service

**SyncService**
- `batchSync(clientId, operations)`: Sends batch of operations to `/sync/batch` endpoint
- `processSyncResults(results)`: Handles sync results including conflicts and errors

#### Offline Service

**OfflineStorage**
- Uses Dexie.js to manage IndexedDB database
- Stores tables for: participants, activities, activityTypes, roles, assignments
- `syncFromServer()`: Fetches all data and stores locally
- `getLocalData(table)`: Retrieves data from IndexedDB
- `clearCache()`: Clears all local data

**SyncQueue**
- Stores pending operations in IndexedDB queue table
- `enqueue(operation)`: Adds operation to queue
- `processQueue()`: Sends all queued operations to server
- `clearQueue()`: Removes processed operations
- Implements exponential backoff for retries

**ConnectionMonitor**
- Listens to online/offline events
- Updates global connection state
- Triggers sync when connectivity restored
- Provides `isOnline()` status check

## Data Models

### Frontend Data Types

```typescript
interface User {
  id: string;
  displayName?: string;  // Optional - falls back to email if not provided
  email: string;
  role: 'ADMINISTRATOR' | 'EDITOR' | 'READ_ONLY';
  createdAt: string;
  updatedAt: string;
}

interface UserGeographicAuthorization {
  id: string;
  userId: string;
  geographicAreaId: string;
  geographicArea?: GeographicArea;
  ruleType: 'ALLOW' | 'DENY';
  createdAt: string;
  createdBy: string;
}

interface AuthorizedArea {
  geographicAreaId: string;
  geographicArea: GeographicArea;
  accessLevel: 'FULL' | 'READ_ONLY' | 'DENIED';
  isDescendant?: boolean;  // True if access granted via ancestor ALLOW rule
  isAncestor?: boolean;    // True if read-only access via descendant ALLOW rule
}

interface ActivityCategory {
  id: string;
  name: string;
  isPredefined: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ActivityType {
  id: string;
  name: string;
  activityCategoryId: string;
  activityCategory?: ActivityCategory;
  isPredefined: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantRole {
  id: string;
  name: string;
  isPredefined: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Population {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantPopulation {
  id: string;
  participantId: string;
  populationId: string;
  population?: Population;
  createdAt: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string | null;  // Nullable: null means oldest home address
}

interface Venue {
  id: string;
  name: string;
  address: string;
  geographicAreaId: string;
  geographicArea?: GeographicArea;
  latitude?: number;
  longitude?: number;
  venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface GeographicArea {
  id: string;
  name: string;
  areaType: 'NEIGHBOURHOOD' | 'COMMUNITY' | 'CITY' | 'CLUSTER' | 'COUNTY' | 'PROVINCE' | 'STATE' | 'COUNTRY' | 'CONTINENT' | 'HEMISPHERE' | 'WORLD';
  parentGeographicAreaId?: string;
  parent?: GeographicArea;
  children?: GeographicArea[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface GeographicAreaWithHierarchy extends GeographicArea {
  ancestors: GeographicArea[];  // Ordered from closest to most distant
  hierarchyPath: string;         // Formatted path: "Community A > City B > Province C"
}

interface GeographicAreaStatistics {
  totalActivities: number;
  totalParticipants: number;
  totalVenues: number;
  activeActivities: number;
}

interface Activity {
  id: string;
  name: string;
  activityTypeId: string;
  activityType?: ActivityType;
  startDate: string;
  endDate?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  isOngoing: boolean;
  createdBy?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ActivityVenueHistory {
  id: string;
  activityId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string | null;  // Nullable: null means uses activity startDate
}

interface Assignment {
  id: string;
  activityId: string;
  participantId: string;
  roleId: string;
  notes?: string;
  participant?: Participant;
  role?: ParticipantRole;
  activity?: Activity;
  createdAt: string;
}

interface EngagementMetrics {
  // Temporal activity counts
  activitiesAtStart: number;
  activitiesAtEnd: number;
  activitiesStarted: number;
  activitiesCompleted: number;
  activitiesCancelled: number;
  
  // Temporal participant counts
  participantsAtStart: number;
  participantsAtEnd: number;
  
  // Temporal participation counts (non-unique)
  participationAtStart: number;
  participationAtEnd: number;
  
  // Aggregate counts
  totalActivities: number;
  totalParticipants: number;
  totalParticipation: number;
  
  // Breakdown by activity category
  activitiesByCategory: {
    activityCategoryId: string;
    activityCategoryName: string;
    activitiesAtStart: number;
    activitiesAtEnd: number;
    activitiesStarted: number;
    activitiesCompleted: number;
    activitiesCancelled: number;
    participantsAtStart: number;
    participantsAtEnd: number;
    participationAtStart: number;
    participationAtEnd: number;
  }[];
  
  // Breakdown by activity type
  activitiesByType: {
    activityTypeId: string;
    activityTypeName: string;
    activityCategoryId: string;
    activityCategoryName: string;
    activitiesAtStart: number;
    activitiesAtEnd: number;
    activitiesStarted: number;
    activitiesCompleted: number;
    activitiesCancelled: number;
    participantsAtStart: number;
    participantsAtEnd: number;
    participationAtStart: number;
    participationAtEnd: number;
  }[];
  
  // Role distribution
  roleDistribution: {
    roleId: string;
    roleName: string;
    count: number;
  }[];
  
  // Geographic breakdown
  geographicBreakdown: {
    geographicAreaId: string;
    geographicAreaName: string;
    activityCount: number;
    participantCount: number;
    participationCount: number;
  }[];
  
  // Grouped results (when groupBy dimensions specified)
  groupedResults?: {
    dimensions: { [key: string]: string };
    metrics: EngagementMetrics;
  }[];
  
  // Metadata
  periodStart: string;
  periodEnd: string;
  appliedFilters: {
    activityCategoryId?: string;
    activityTypeId?: string;
    venueId?: string;
    geographicAreaId?: string;
    populationIds?: string[];
    startDate?: string;
    endDate?: string;
  };
  groupingDimensions?: string[];
}

interface GrowthMetrics {
  period: string;
  uniqueParticipants: number;
  uniqueActivities: number;
  totalParticipation: number;
}

interface GeographicAnalytics {
  geographicAreaId: string;
  geographicAreaName: string;
  areaType: string;
  totalActivities: number;
  activeActivities: number;
  totalParticipants: number;
  activeParticipants: number;
}

interface ActivityLifecycleData {
  groupName: string;
  started: number;
  completed: number;
}

interface QueuedOperation {
  id: string;
  entityType: 'Activity' | 'Participant' | 'ActivityParticipant' | 'Venue' | 'GeographicArea' | 'ActivityType' | 'Role' | 'Population';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: string;
  version?: number;
  retries: number;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface APIError {
  code: string;
  message: string;
  details?: any;
}

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  boundingBox?: [number, number, number, number];
}
```

### Temporal Data and Null EffectiveFrom Handling

**ParticipantAddressHistory and ActivityVenueHistory** use nullable `effectiveFrom` dates with special semantics:

**Null EffectiveFrom for Participant Address History:**
- A null `effectiveFrom` represents the **oldest/initial home address** for a participant
- UI should display null dates as "Initial Address" or similar indicator
- When sorting by date (descending), null values appear last (oldest)
- Only one address history record per participant can have null `effectiveFrom`

**Null EffectiveFrom for Activity Venue History:**
- A null `effectiveFrom` means the venue association **started with the activity** (uses activity's `startDate`)
- UI should display null dates as "Since Activity Start" or show the activity's `startDate`
- When sorting by date (descending), null values are compared using the activity's `startDate`
- Only one venue history record per activity can have null `effectiveFrom`

**UI Considerations:**

1. **Date Display:**
   - Address history with null date: Display "Initial Address" or leave date field empty with explanatory text
   - Venue history with null date: Display "Since Activity Start" or show the activity's `startDate` in parentheses

2. **Form Validation:**
   - AddressHistoryForm: Allow clearing the date field; validate only one null per participant
   - ActivityVenueHistoryForm: Allow clearing the date field; validate only one null per activity
   - Show validation error if attempting to create a second null `effectiveFrom` record

3. **Current Record Identification:**
   - For participants: Current address is the record with the most recent non-null date, or the null record if only null exists
   - For activities: Current venue is the record with the most recent non-null date, or the null record if only null exists

4. **Map and Analytics:**
   - When determining current venue for map markers or analytics, handle null `effectiveFrom` appropriately
   - Null dates for activities should be treated as the activity's `startDate` for temporal filtering
   - Null dates for participants should be treated as the earliest possible date

### API Request/Response Types

All API requests and responses follow the Backend API package specifications. The frontend transforms these into the above data models for internal use.

**Response Format:**
All successful API responses are wrapped in a standard format:
```typescript
{
  success: true,
  data: T,
  pagination?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

**Error Response Format:**
```typescript
{
  code: string,
  message: string,
  details?: any
}
```

**Error Codes:**
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_REQUIRED`: Missing or invalid token
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `NOT_FOUND`: Resource not found
- `VERSION_CONFLICT`: Optimistic locking conflict (version mismatch)
- `CIRCULAR_REFERENCE`: Circular relationship detected
- `REFERENCED_ENTITY`: Entity is referenced and cannot be deleted
- `DUPLICATE_EMAIL`: Email already exists
- `DUPLICATE_NAME`: Name already exists
- `DUPLICATE_ASSIGNMENT`: Assignment already exists
- `INVALID_REFERENCE`: Referenced entity does not exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

**Rate Limiting:**
- Authentication endpoints: 5 requests/minute per IP
- Mutation endpoints (POST, PUT, DELETE): 100 requests/minute per user
- Query endpoints (GET): 1000 requests/minute per user

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp (Unix)

**Pagination:**
Pagination is optional on list endpoints. When `page` or `limit` query parameters are provided, the response includes pagination metadata. Without these parameters, all results are returned.

**Optimistic Locking:**
All entities support optimistic locking via the `version` field. When updating an entity, include the current version number in the request. If the version doesn't match, a `VERSION_CONFLICT` error (409) is returned.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Category/Type/Role Distinction in Lists

*For any* list of activity categories, activity types, or participant roles, the rendered output should visually distinguish predefined items from custom items.

**Validates: Requirements 2.2, 2.3, 3.1**

### Property 2: Referential Integrity on Deletion

*For any* entity (activity category, activity type, or participant role) that has references from other entities, attempting to delete it should be prevented and return an error.

**Validates: Requirements 2.7, 2.14, 3.5**

### Property 3: Deletion Error Messages

*For any* failed deletion operation, the application should display an error message explaining why the deletion failed.

**Validates: Requirements 2.8, 2.15, 3.6**

### Property 4: Non-Empty Name Validation

*For any* string composed entirely of whitespace or empty string, attempting to use it as a name for activity categories, activity types, or participant roles should be rejected.

**Validates: Requirements 2.9, 2.16, 3.7**

### Property 4A: Activity Category Link in Category List

*For any* activity category displayed in the activity category list, clicking the category name should open the edit form for that category.

**Validates: Requirements 2.17, 2.18**

### Property 5: Participant List Display

*For any* participant, the list view should include the participant's name and email (if provided) in the rendered output.

**Validates: Requirements 4.1**

### Property 6: Participant Search Functionality

*For any* search query and participant list, the search results should only include participants whose name or email contains the search term (case-insensitive).

**Validates: Requirements 4.2**

### Property 7: Required Field Validation

*For any* form submission with missing required fields (participant name, activity name/type/start date, login email/password), the validation should fail and prevent submission.

**Validates: Requirements 4.7, 5.10, 8.2**

### Property 7A: Optional Email Validation

*For any* participant form submission with an email provided, the email format should be validated, and invalid formats should prevent submission.

**Validates: Requirements 4.8**

### Property 7B: Date of Birth Validation

*For any* participant form submission with a dateOfBirth provided that is not in the past, the validation should fail and prevent submission.

**Validates: Requirements 4.10**

### Property 7C: Date of Registration Validation

*For any* participant form submission with a dateOfRegistration provided that is not a valid date, the validation should fail and prevent submission.

**Validates: Requirements 4.11**

### Property 8: Email Format Validation

*For any* string that doesn't match valid email format (missing @, invalid domain, etc.), attempting to use it as an email should be rejected.

**Validates: Requirements 4.8**

### Property 9: Optional Field Acceptance

*For any* participant form submission with or without phone and notes fields, the submission should succeed if all required fields are valid.

**Validates: Requirements 4.9**

### Property 10: Participant Detail View Completeness

*For any* participant, the detail view should display the participant's information and all activities they are assigned to.

**Validates: Requirements 4.10**

### Property 10a: Participant Email Mailto Link

*For any* participant with an email address, the detail view should render the email as a clickable mailto link.

**Validates: Requirements 4.12a**

### Property 10b: Participant Phone Tel Link

*For any* participant with a phone number, the detail view should render the phone number as a clickable tel link.

**Validates: Requirements 4.12b**

### Property 11: Address History Display Order

*For any* participant with address history, the address history table should display records in reverse chronological order by effective start date (most recent first).

**Validates: Requirements 4.11**

### Property 12: Address History Required Fields

*For any* address history record submission without venue, the validation should fail and prevent creation.

**Validates: Requirements 4.15**

### Property 13: Address History Duplicate Prevention

*For any* participant, attempting to create an address history record with the same effective start date (including null) as an existing record should be prevented.

**Validates: Requirements 4.19**

### Property 13A: Address History Null EffectiveFrom Uniqueness

*For any* participant, attempting to create a second address history record with a null effective start date when one already exists should be prevented.

**Validates: Requirements 4.17, 4.18**

### Property 13B: Address History Null EffectiveFrom Display

*For any* participant address history record with a null effective start date, the UI should indicate it represents the oldest/initial home address.

**Validates: Requirements 4.17**

### Property 13a: Address History Venue Name Display

*For any* address history record added to a new participant before the participant is created, the venue name should be fetched from the backend and displayed in the address history table.

**Validates: Requirements 4.19, 4.20**

### Property 14: Activity List Display

*For any* activity, the list view should include the activity category, activity type, dates, and status in the rendered output.

**Validates: Requirements 5.1**

### Property 15: Activity Filtering

*For any* filter criteria (activity category, activity type, or status) and activity list, the filtered results should only include activities matching the criteria.

**Validates: Requirements 5.2**

### Property 16: Finite vs Ongoing Activity Distinction

*For any* activity list containing both finite and ongoing activities, the rendered output should visually distinguish between the two types.

**Validates: Requirements 5.4**

### Property 17: Finite Activity End Date Requirement

*For any* finite activity submission without an end date, the validation should fail and prevent creation.

**Validates: Requirements 5.8**

### Property 18: Ongoing Activity Null End Date

*For any* ongoing activity submission with null end date, the validation should succeed if all other required fields are valid.

**Validates: Requirements 5.9**

### Property 19: Activity Detail View Completeness

*For any* activity, the detail view should display the activity information and all assigned participants with their roles.

**Validates: Requirements 5.12**

### Property 19a: Activity Venue Association Name Display

*For any* venue association added to a new activity before the activity is created, the venue name should be fetched from the backend and displayed in the venue history table.

**Validates: Requirements 5.18, 5.19**

### Property 19b: Activity Participant Assignment Name Display

*For any* participant assignment added to a new activity before the activity is created, the participant name and role name should be fetched from the backend and displayed in the participant assignments table.

**Validates: Requirements 5.25, 5.26**

### Property 19c: Activity Form Vertical Table Stacking

*For any* activity form rendering (create or edit mode), the venue associations table should appear above the participant assignments table in a vertical stack layout.

**Validates: Requirements 5.27**

### Property 19d: Activity Form Atomic Experience

*For any* activity creation workflow, all activity details, venue associations, and participant assignments should be configurable within the form before any data is persisted to the backend.

**Validates: Requirements 5.28**

### Property 20: Assignment Role Requirement

*For any* participant assignment attempt without a role selected, the validation should fail and prevent assignment.

**Validates: Requirements 6.2, 6.5**

### Property 21: Assignment Display Completeness

*For any* activity with assignments, the detail view should display all assigned participants along with their roles.

**Validates: Requirements 6.3**

### Property 22: Duplicate Assignment Prevention

*For any* attempt to create an assignment with the same participant and role combination that already exists for an activity, the operation should be prevented.

**Validates: Requirements 6.6**

### Property 22a: Assignment Notes Support

*For any* participant assignment, optional notes should be accepted and stored with the assignment.

**Validates: Requirements 6.7**

### Property 22b: Assignment Interface in Activity Form

*For any* activity form (create or edit mode), an interface for managing participant assignments should be displayed within the form, positioned below the venue associations interface.

**Validates: Requirements 6.1, 6.8, 6.9, 6.10**

### Property 23: Temporal activity metrics display

*For any* engagement dashboard with a date range, the displayed metrics should include activities at start, activities at end, activities started, activities completed, and activities cancelled.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

### Property 24: Temporal participant metrics display

*For any* engagement dashboard with a date range, the displayed metrics should include participants at start, participants at end, participation at start, and participation at end.

**Validates: Requirements 7.7, 7.8, 7.8a, 7.8b**

### Property 24a: Participation metric info icons

*For any* Growth Dashboard in "All" view mode, info icons should be displayed next to the "Participant Growth" and "Participation Growth" boxes.

**Validates: Requirements 7.8c, 7.8e**

### Property 24b: Participation metric popover explanations

*For any* info icon click next to the Participant Growth box, a popover should display explaining "Unique Participants: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once." For the Participation Growth box, the popover should explain "Total Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."

**Validates: Requirements 7.8d, 7.8f**

### Property 24c: Engagement Summary info icon

*For any* Engagement Dashboard, an info icon should be displayed next to the "Engagement Summary" table header.

**Validates: Requirements 7.21a**

### Property 24d: Engagement Summary info popover

*For any* info icon click next to the Engagement Summary header, a popover should display explaining both metrics: "Participant Count: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once. Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."

**Validates: Requirements 7.21b**

### Property 25: Aggregate and breakdown display

*For any* engagement dashboard, all activity, participant, and participation counts should be displayed in both aggregate form and broken down by activity category and activity type.

**Validates: Requirements 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.14a, 7.14b, 7.14c**

### Property 26: Multi-dimensional grouping controls

*For any* engagement dashboard, the UI should provide controls to select one or more grouping dimensions (activity category, activity type, venue, geographic area).

**Validates: Requirements 7.15**

### Property 27: Filter control availability

*For any* engagement dashboard, the UI should provide filter controls for activity category, activity type, venue, geographic area, and date range.

**Validates: Requirements 7.16, 7.17, 7.18, 7.19, 7.20**

### Property 28: Engagement Summary Table Display

*For any* engagement dashboard state (with or without grouping dimensions), an "Engagement Summary" table should always be displayed with the first row labeled "Total" containing aggregate metrics.

**Validates: Requirements 7.21, 7.22**

### Property 28a: Total Row Aggregate Metrics

*For any* engagement dashboard, the first row of the Engagement Summary table should display "Total" in the first column and aggregate metrics (activities at start, at end, started, completed, cancelled, participants at start, at end, participation at start, participation at end) in subsequent columns.

**Validates: Requirements 7.22**

### Property 28b: Total Row Blank Dimension Cells

*For any* engagement dashboard with multiple grouping dimensions selected, the dimension cells in the Total row (after the first column) should be left blank.

**Validates: Requirements 7.23**

### Property 28c: Dimensional Breakdown Rows

*For any* engagement dashboard with grouping dimensions selected, rows below the Total row should display dimensional breakdowns where breakdown dimension columns appear first, followed by metric aggregation columns.

**Validates: Requirements 7.24**

### Property 28d: Dimension Hyperlinks in Breakdown Rows

*For any* dimensional breakdown row in the Engagement Summary table, dimension values should be rendered as hyperlinks: activity category names and activity type names link to /configuration (Activity Configuration page), venue names link to /venues/:id, and geographic area names link to /geographic-areas/:id.

**Validates: Requirements 7.25, 7.26, 7.27, 7.28**

### Property 28e: Metric Columns in Engagement Summary

*For any* row in the Engagement Summary table, each metric aggregation (activities at start, at end, started, completed, cancelled, participants at start, at end, participation at start, participation at end) should be displayed in its own separate column.

**Validates: Requirements 7.29**

### Property 29: Multiple filter application

*For any* engagement dashboard with multiple filters applied, all filters should be applied using AND logic and the UI should clearly indicate which filters are active.

**Validates: Requirements 7.30**

### Property 30: All-time metrics display

*For any* engagement dashboard without a date range specified, the UI should display all-time metrics and clearly indicate that no date filter is active.

**Validates: Requirements 7.31**

### Property 31: Role distribution display

*For any* engagement dashboard, the role distribution chart should display counts for all roles within the filtered and grouped results.

**Validates: Requirements 7.32**

### Property 31_pie: Activity Category Pie Chart Display

*For any* engagement dashboard, a pie chart showing the breakdown of unique activities by activity category should be displayed.

**Validates: Requirements 7.32a**

### Property 31_pie_a: Pie Chart Positioning

*For any* engagement dashboard rendering, the activity category pie chart should appear in line width (full container width) and be positioned to the left of the role distribution chart.

**Validates: Requirements 7.32b**

### Property 31_pie_b: Pie Chart Data Consistency

*For any* engagement dashboard with filters applied, the pie chart should use the same filtered data as other dashboard components.

**Validates: Requirements 7.32c**

### Property 31_pie_c: Pie Chart Legend Display

*For any* activity category pie chart, the legend should display activity category names.

**Validates: Requirements 7.32d**

### Property 31_pie_d: Pie Chart Color Consistency

*For any* activity category pie chart, the color scheme should be consistent with other dashboard charts.

**Validates: Requirements 7.32e**

### Property 31_pie_e: Pie Chart Hover Information

*For any* pie chart segment hover event, the activity category name and count should be displayed.

**Validates: Requirements 7.32f**

### Property 31_pie_f: Pie Chart Interactive Legend

*For any* activity category pie chart, the legend should allow users to toggle individual category segments on and off.

**Validates: Requirements 7.32g**

### Property 31_pie_g: Pie Chart Minimum Visibility

*For any* activity category pie chart with all segments hidden, an appropriate message should be displayed or at least one segment should remain visible.

**Validates: Requirements 7.32h**

### Property 31a: Analytics URL Parameter Synchronization

*For any* engagement dashboard state (filters and grouping), the browser URL query parameters should accurately reflect all current filter values (activityCategory, activityType, venue, geographicArea, startDate, endDate) and grouping configuration (groupBy dimensions).

**Validates: Requirements 7.33, 7.34**

### Property 31b: Analytics URL Parameter Application

*For any* URL with analytics query parameters, when a user navigates to that URL, the engagement dashboard should automatically apply all filter and grouping parameters from the URL to initialize the dashboard state.

**Validates: Requirements 7.35**

### Property 31c: Analytics URL Update on State Change

*For any* change to filters or grouping parameters in the engagement dashboard, the browser URL should be updated to reflect the new state without causing a page reload.

**Validates: Requirements 7.36**

### Property 31d: Analytics Browser Navigation Support

*For any* sequence of filter or grouping changes in the engagement dashboard, using browser back/forward buttons should navigate through the history of configurations and restore the corresponding dashboard state.

**Validates: Requirements 7.37**

### Property 31e: Analytics URL Shareability

*For any* engagement dashboard URL copied and shared with another user, when that user navigates to the URL, they should see the same filtered and grouped results as the original user.

**Validates: Requirements 7.38**

### Property 31f: Activities Chart Title Display

*For any* engagement dashboard rendering, the activities distribution chart should display the title "Activities" (not "Activities by Type").

**Validates: Requirements 7.47**

### Property 31g: Activities Chart Segmented Control Presence

*For any* engagement dashboard rendering, the Activities chart should display a segmented control with two options: "Activity Type" and "Activity Category".

**Validates: Requirements 7.48**

### Property 31h: Activities Chart Default View Mode

*For any* engagement dashboard initial rendering without a stored preference, the Activities chart segmented control should default to "Activity Type" as the selected option.

**Validates: Requirements 7.49**

### Property 31i: Activities Chart View Mode Switching

*For any* Activities chart view mode selection (Activity Type or Activity Category), the chart should display activities grouped by the selected dimension without requiring a page refresh.

**Validates: Requirements 7.51, 7.52, 7.53**

### Property 31j: Activity Lifecycle Chart Data Completeness

*For any* time period and grouping mode (category or type), the Activity Lifecycle Chart should display all activity categories or types that have at least one started or completed activity, with no groups omitted.

**Validates: Requirements 7A.1, 7A.7, 7A.8**

### Property 31k: Activity Lifecycle Started Count Accuracy

*For any* activity, if it started within the time period, it should be counted exactly once in the "started" series for its corresponding group.

**Validates: Requirements 7A.11, 7A.13**

### Property 31l: Activity Lifecycle Completed Count Accuracy

*For any* activity, if it completed within the time period, it should be counted exactly once in the "completed" series for its corresponding group.

**Validates: Requirements 7A.12, 7A.13**

### Property 31m: Activity Lifecycle Cancelled Exclusion

*For any* cancelled activity, it should not be counted in either the "started" or "completed" series, regardless of its dates.

**Validates: Requirements 7A.14**

### Property 31n: Activity Lifecycle Filter Application

*For any* combination of filters (geographic area, activity type, venue), only activities matching all applied filters should be included in the lifecycle event counts.

**Validates: Requirements 7A.21, 7A.22, 7A.23, 7A.24, 7A.25**

### Property 31o: Activity Lifecycle Toggle State Consistency

*For any* toggle state change between category and type views, the chart data should update to reflect the new grouping mode without losing filter context.

**Validates: Requirements 7A.7, 7A.8, 7A.10**

### Property 31p: Activity Lifecycle View Mode Persistence

*For any* view mode selection in the Activity Lifecycle Chart, the selection should be stored in localStorage and restored when the user returns to the dashboard.

**Validates: Requirements 7A.26, 7A.27, 7A.28, 7A.29**

### Property 31j: Activities Chart Filter Preservation

*For any* Activities chart view mode change, the current date range and filter selections should be preserved and applied to the new view.

**Validates: Requirements 7.54**

### Property 31k: Activities Chart Data Ordering

*For any* Activities chart rendering with data, activity counts should be displayed in descending order by count value.

**Validates: Requirements 7.56**

### Property 31l: Activities Chart State Persistence

*For any* Activities chart view mode selection, the selection should be stored in browser localStorage and restored when the user returns to the Engagement Dashboard.

**Validates: Requirements 7.58, 7.59, 7.60, 7.61**

### Property 31m: Activities Chart Keyboard Navigation

*For any* Activities chart segmented control, users should be able to navigate between options using Tab and Arrow keys, with visual focus indicators displayed.

**Validates: Requirements 7.62, 7.63**

### Property 31n: Activities Chart Screen Reader Support

*For any* Activities chart segmented control, appropriate ARIA labels should be present and view mode changes should be announced to screen readers.

**Validates: Requirements 7.64, 7.65**

### Property 31o: PropertyFilter Lazy Loading

*For any* PropertyFilter property (Activity Category, Activity Type, Venue), when a user types in the filter input, matching values should be asynchronously fetched from the backend and displayed.

**Validates: Requirements 7B.5, 7B.6**

### Property 31p: PropertyFilter Multiple Token Application

*For any* PropertyFilter with multiple filter tokens, all filters should be applied using AND logic to the analytics queries.

**Validates: Requirements 7B.9**

### Property 31q: PropertyFilter URL Persistence

*For any* PropertyFilter state with active filter tokens, the tokens should be persisted to URL query parameters and restored when navigating to a URL with those parameters.

**Validates: Requirements 7B.11, 7B.12**

### Property 31r: PropertyFilter Integration

*For any* PropertyFilter state change (adding or removing tokens), the dashboard should update to reflect the new filters while preserving date range and geographic area filters.

**Validates: Requirements 7B.10, 7B.16, 7B.17**

### Property 32: Time-series unique count calculation

*For any* time period and dataset, the separate time-series charts should correctly calculate unique participants, unique activities, and total participation engaged during each time period as snapshots (not cumulative).

**Validates: Requirements 7.40, 7.41, 7.41a, 7.43**

### Property 33: Growth Dashboard Segmented Control Display

*For any* growth dashboard rendering, a segmented control with three options ("All", "Activity Type", "Activity Category") should be displayed, defaulting to "All".

**Validates: Requirements 7.44, 7.45**

### Property 33a: Growth Dashboard All View Mode

*For any* growth dashboard with "All" view mode selected, all three charts should display a single aggregate time-series line for total unique participants, total unique activities, and total participation across all activity types and categories, and overall growth numbers should be displayed.

**Validates: Requirements 7.46, 7.46a, 7.46b, 7.46c**

### Property 33b: Growth Dashboard Activity Type View Mode

*For any* growth dashboard with "Activity Type" view mode selected, all three charts should display multiple time-series lines, one for each activity type, showing unique participants, unique activities, and total participation for that type, and overall growth numbers should NOT be displayed.

**Validates: Requirements 7.46d, 7.47**

### Property 33c: Growth Dashboard Activity Category View Mode

*For any* growth dashboard with "Activity Category" view mode selected, all three charts should display multiple time-series lines, one for each activity category, showing unique participants, unique activities, and total participation for that category, and overall growth numbers should NOT be displayed.

**Validates: Requirements 7.46d, 7.48**

### Property 33d: Growth Dashboard Consistent Color Scheme

*For any* growth dashboard displaying multiple lines for activity types or categories, the same activity type or category should have the same color on all three charts (Unique Participants, Unique Activities, and Total Participation).

**Validates: Requirements 7.49**

### Property 33e: Growth Dashboard Legend Display

*For any* growth dashboard displaying multiple lines, all three charts should display a legend showing the color mapping for each activity type or category.

**Validates: Requirements 7.50**

### Property 33f: Growth Dashboard View Mode Switching

*For any* growth dashboard view mode change between "All", "Activity Type", and "Activity Category", all three charts should update without requiring a page refresh.

**Validates: Requirements 7.51**

### Property 33g: Growth Dashboard Filter Preservation

*For any* growth dashboard view mode change, the current time period, date range, and geographic area filter selections should be preserved.

**Validates: Requirements 7.52**

### Property 33h: Growth Dashboard View Mode Persistence

*For any* growth dashboard view mode selection, the selection should be stored in browser localStorage with key "growthChartViewMode" and restored when the user returns to the dashboard.

**Validates: Requirements 7.53, 7.54, 7.55, 7.56**

### Property 33i: Growth Dashboard URL Parameter Synchronization

*For any* growth dashboard state (period, date range filters, and grouping mode), the browser URL query parameters should accurately reflect all current filter values (period, startDate, endDate, relativeAmount, relativeUnit, groupBy).

**Validates: Requirements 57a**

### Property 33j: Growth Dashboard URL Parameter Application

*For any* URL with growth dashboard query parameters, when a user navigates to that URL, the growth dashboard should automatically apply all filter parameters from the URL to initialize the dashboard state.

**Validates: Requirements 57b**

### Property 33k: Growth Dashboard URL Update on State Change

*For any* change to filter or grouping parameters in the growth dashboard, the browser URL should be updated to reflect the new state without causing a page reload.

**Validates: Requirements 57c**

### Property 33l: Growth Dashboard Browser Navigation Support

*For any* sequence of filter or grouping changes in the growth dashboard, using browser back/forward buttons should navigate through the history of configurations and restore the corresponding dashboard state.

**Validates: Requirements 57d**

### Property 33m: Growth Dashboard URL Shareability

*For any* growth dashboard URL copied and shared with another user, when that user navigates to the URL, they should see the same filtered and grouped results as the original user.

**Validates: Requirements 57e**

### Property 34: Unauthenticated access protection

*For any* protected route, attempting to access it without authentication should redirect to the login page.

**Validates: Requirements 9.1, 9.2**

### Property 34a: Post-authentication redirect to original URL

*For any* protected route that redirects an unauthenticated user to login, after successful authentication, the user should be redirected back to the original URL they were attempting to access.

**Validates: Requirements 8.8, 8.9**

### Property 34b: Login animation sequence execution

*For any* successful authentication, the login page should execute the complete animation sequence (form fade out, icon display, stroke animation) before navigation occurs.

**Validates: Requirements 8.10, 8.11, 8.12, 8.13, 8.14**

### Property 34c: Login form fade out timing

*For any* successful authentication, the login form container should fade out completely over exactly 1000 milliseconds.

**Validates: Requirements 8.11**

### Property 34d: Icon stroke animation timing

*For any* successful authentication, the icon-no-bg.svg stroke should animate from 0% to 100% drawn over exactly 2000 milliseconds.

**Validates: Requirements 8.13**

### Property 34e: Animation sequence ordering

*For any* successful authentication, the animation phases should execute in the correct order: form fade out, then icon display and stroke animation, then navigation.

**Validates: Requirements 8.10, 8.11, 8.12, 8.13, 8.14**

### Property 35: Unauthorized action error messages

*For any* unauthorized action attempt, the application should display an appropriate error message.

**Validates: Requirements 9.6**

### Property 36: Offline data caching

*For any* user data loaded from the API, the data should be stored in IndexedDB for offline access.

**Validates: Requirements 10.2**

### Property 37: Offline operation queueing

*For any* create, update, or delete operation performed while offline, the operation should be added to the local sync queue.

**Validates: Requirements 10.3**

### Property 38: Offline feature indication

*For any* feature that requires connectivity, when offline, the feature should be visually indicated as unavailable and disabled.

**Validates: Requirements 10.6, 10.7**

### Property 39: Sync queue processing

*For any* queued operations when connectivity is restored, all operations should be sent to the backend and the queue should be cleared upon success.

**Validates: Requirements 11.2, 11.3**

### Property 40: Sync retry with exponential backoff

*For any* failed synchronization attempt, the retry delay should increase exponentially with each subsequent failure.

**Validates: Requirements 11.4**

### Property 41: Pending operation count display

*For any* number of pending operations in the sync queue, the displayed count should match the actual queue length.

**Validates: Requirements 11.6**

### Property 42: Active navigation highlighting

*For any* current route, the corresponding navigation item should be visually highlighted.

**Validates: Requirements 13.2**

### Property 43: Navigation state persistence

*For any* navigation between sections, the navigation state (expanded/collapsed items, scroll position) should be preserved.

**Validates: Requirements 13.3**

### Property 43a: Dashboard quick link visibility

*For any* user viewing the main dashboard page, the User Administration quick link should only be visible if the user has ADMINISTRATOR role.

**Validates: Requirements 13.7, 13.8**

### Property 43b: Sticky header visibility

*For any* vertical scroll position on any page, the application header (including navigation header and geographic area filter header) should remain visible at the top of the viewport.

**Validates: Requirements 13.9, 13.10**

### Property 43c: Sticky header content clearance

*For any* page with a sticky header, the page content should not be obscured by the header and should have appropriate spacing to account for the header height.

**Validates: Requirements 13.11**

### Property 43d: About Page Content Display

*For any* About page rendering, the page should display the Cultivate app icon, the Universal House of Justice excerpt with attribution, the disclaimer about individual initiative, and a hyperlink to the official Bahá'í website.

**Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.6**

### Property 43e: About Page Accessibility

*For any* authenticated user regardless of role, the About page should be accessible from the navigation menu.

**Validates: Requirements 14.1, 14.8**

### Property 44: Form validation error display

*For any* invalid form field, the field should be visually highlighted and display an inline error message.

**Validates: Requirements 15.2, 15.3**

### Property 45: Invalid form submission prevention

*For any* form with validation errors, the submit button should be disabled or submission should be prevented.

**Validates: Requirements 15.4**

### Property 46: Valid field value preservation

*For any* form with validation errors, all valid field values should remain unchanged after validation fails.

**Validates: Requirements 15.5**

### Property 47: Error Notification Type

*For any* error, transient errors should display toast notifications while critical errors should display modal dialogs.

**Validates: Requirements 16.2, 16.3**

### Property 48: Error State Preservation

*For any* error occurrence, the application state should remain unchanged (no data loss or corruption).

**Validates: Requirements 16.5**

### Property 49: Error Console Logging

*For any* error, detailed error information should be logged to the browser console.

**Validates: Requirements 16.6**

### Property 50: Loading State Indicators

*For any* asynchronous operation (API request, data loading, long operation), appropriate loading indicators should be displayed (spinners, skeleton screens, or progress bars).

**Validates: Requirements 17.1, 17.3, 17.4**

### Property 51: Form Button Disabling During Submission

*For any* form submission in progress, the submit button should be disabled to prevent duplicate submissions.

**Validates: Requirements 17.2**

### Property 52: Success Message Display

*For any* successful operation (create, update, delete), a success message should be displayed to the user.

**Validates: Requirements 17.5**

### Property 53: Venue List Display

*For any* venue, the list view should include the venue's name, address, and geographic area in the rendered output.

**Validates: Requirements 6A.1**

### Property 54: Venue Search Functionality

*For any* search query and venue list, the search results should only include venues whose name or address contains the search term (case-insensitive).

**Validates: Requirements 6A.2**

### Property 54a: Venue List Geographic Area Hyperlink

*For any* venue displayed in the venue list, the geographic area name should be rendered as a hyperlink that navigates to the geographic area detail page.

**Validates: Requirements 6A.1a**

### Property 55: Venue Required Field Validation

*For any* venue form submission with missing required fields (name, address, or geographic area), the validation should fail and prevent submission.

**Validates: Requirements 6A.7**

### Property 52: Venue Optional Field Acceptance

*For any* venue form submission with or without optional latitude, longitude, and venue type fields, the submission should succeed if all required fields are valid.

**Validates: Requirements 6A.8**

### Property 53: Venue Deletion Prevention

*For any* venue referenced by activities or participants, attempting to delete it should be prevented and display an error message explaining which entities reference it.

**Validates: Requirements 6A.10, 6A.11**

### Property 54: Venue Detail View Completeness

*For any* venue, the detail view should display the venue information, associated activities, and participants using it as their current home address (most recent address history only).

**Validates: Requirements 6A.9, 6A.9a**

### Property 55: Geographic Area Hierarchical Display

*For any* set of geographic areas, the list view should display them in a hierarchical tree structure showing parent-child relationships.

**Validates: Requirements 6B.1**

### Property 56: Geographic Area Required Field Validation

*For any* geographic area form submission with missing required fields (name or area type), the validation should fail and prevent submission.

**Validates: Requirements 6B.5**

### Property 57: Circular Relationship Prevention

*For any* geographic area, attempting to set its parent to itself or to one of its descendants should be prevented with a validation error.

**Validates: Requirements 6B.7**

### Property 58: Geographic Area Deletion Prevention

*For any* geographic area referenced by venues or child geographic areas, attempting to delete it should be prevented and display an error message explaining which entities reference it.

**Validates: Requirements 6B.9, 6B.10**

### Property 59: Geographic Area Hierarchy Path Display

*For any* geographic area, the detail view should display the full hierarchy path from root to the current area.

**Validates: Requirements 6B.11**

### Property 59a: Geographic Area Ancestor Display in Tree View

*For any* geographic area tree view with an active filter, the displayed areas should include the filtered area, all its descendants, and all its ancestors to maintain hierarchy context.

**Validates: Requirements 6B.12**

### Property 59b: Geographic Area Ancestor Read-Only Indication

*For any* ancestor geographic area displayed in the tree view due to filtering, the UI should visually indicate that the ancestor area is read-only (e.g., with a badge, icon, or muted styling).

**Validates: Requirements 6B.13**

### Property 59c: Geographic Area Ancestor Non-Suppression

*For any* geographic area tree view rendering with an active filter, ancestor areas should never be suppressed or hidden from the display.

**Validates: Requirements 6B.14**

### Property 60: Map Mode Selector

*For any* map view, a mode selector control should be available to switch between "Activities", "Participant Homes", and "Venues" modes.

**Validates: Requirements 6C.2**

### Property 61: Activity Marker Display

*For any* activity with a current venue that has latitude and longitude coordinates, when in "Activities" mode, a marker should be displayed on the map at the venue's location.

**Validates: Requirements 6C.3**

### Property 62: Activity Marker Color Coding

*For any* set of activities displayed on the map in "Activities" mode, markers should be color-coded based on activity category to visually distinguish them.

**Validates: Requirements 6C.4**

### Property 63: Activity Legend Display

*For any* map view in "Activities" or "Activity Categories" mode, a right-aligned legend should be displayed showing the mapping between marker colors and activity types or categories.

**Validates: Requirements 6C.5**

### Property 63a: Legend Filtering Based on Visible Markers

*For any* map view with filters applied, the legend should only display activity types or categories that are actually visible on the map, excluding those filtered out.

**Validates: Requirements 6C.5a, 6C.5b**

### Property 63b: Legend Visibility with No Markers

*For any* map view where filters result in no visible markers, the legend should be hidden.

**Validates: Requirements 6C.5c**

### Property 64: Activity Popup Information

*For any* activity marker clicked in "Activities" mode, a popup should display showing the activity name (as a hyperlink to /activities/:id), category, type, start date, and participant count.

**Validates: Requirements 6C.6, 6C.7**

### Property 65: Participant Home Marker Display

*For any* participant with a current home venue (from address history) that has latitude and longitude coordinates, when in "Participant Homes" mode, a marker should be displayed on the map at the venue's location.

**Validates: Requirements 6C.8**

### Property 66: Participant Home Popup Information

*For any* participant home marker clicked in "Participant Homes" mode, a popup should display showing the venue name (as a hyperlink to /venues/:id) and the count of participants living at that address.

**Validates: Requirements 6C.9, 6C.10**

### Property 67: Venue Marker Display

*For any* venue with latitude and longitude coordinates, when in "Venues" mode, a marker should be displayed on the map at the venue's location.

**Validates: Requirements 6C.11**

### Property 68: Venue Popup Information

*For any* venue marker clicked in "Venues" mode, a popup should display showing the venue name (as a hyperlink to /venues/:id), address, and geographic area.

**Validates: Requirements 6C.12, 6C.13**

### Property 69: Map Filter Application

*For any* filter criteria (activity category, activity type, status, or date range) applied to the map, only activities matching the criteria should display markers.

**Validates: Requirements 6C.14**

### Property 70: Map Global Filter Application

*For any* map mode with the global geographic area filter active, only markers for entities associated with venues in the filtered geographic area or its descendants should be displayed.

**Validates: Requirements 6C.19, 6C.20, 6C.21, 6C.22**

### Property 70A: Map null effectiveFrom handling for activities

*For any* activity marker on the map with a null effectiveFrom date in its venue history, the map should treat the venue association start date as the activity's startDate when determining the current venue.

**Validates: Requirements 6C.23, 6C.25**

### Property 70B: Map null effectiveFrom handling for participants

*For any* participant home marker on the map with a null effectiveFrom date in their address history, the map should treat it as the oldest home address when determining the current home venue.

**Validates: Requirements 6C.24, 6C.26**

### Property 70C: Map current venue determination with null dates

*For any* activity or participant displayed on the map with venue/address history containing null effectiveFrom dates, the map should correctly identify and display the current venue/address location.

**Validates: Requirements 6C.23, 6C.24, 6C.25, 6C.26**

### Property 71: Geographic Area Filter Application

*For any* analytics dashboard with a geographic area filter applied, only activities and participants associated with venues in that geographic area or its descendants should be included in the metrics.

**Validates: Requirements 7.16**

### Property 71A: Analytics null effectiveFrom handling for activities

*For any* activity in analytics calculations with a null effectiveFrom date in its venue history, the dashboard should treat the venue association start date as the activity's startDate when determining the current venue.

**Validates: Requirements 7.38a, 7.38c**

### Property 71B: Analytics null effectiveFrom handling for participants

*For any* participant in analytics calculations with a null effectiveFrom date in their address history, the dashboard should treat it as the oldest home address when determining the current home venue.

**Validates: Requirements 7.38b, 7.38c**

### Property 71C: Analytics current venue determination with null dates

*For any* activity or participant included in analytics with venue/address history containing null effectiveFrom dates, the dashboard should correctly identify the current venue/address for filtering and aggregation purposes.

**Validates: Requirements 7.38a, 7.38b, 7.38c**

### Property 72: Geographic Breakdown Chart Display

*For any* engagement metrics, the geographic breakdown chart should display engagement data for the immediate children of the current global geographic area filter (or all top-level areas when no filter is active), with each area's metrics aggregating data from that area and all its descendants. The chart should include both unique participant counts and total participation counts as separate data series, with geographic area names rendered with customized labels showing area type badges underneath the area name. Clicking on an area in the chart should set it as the new global filter, enabling progressive drill-down through the geographic hierarchy.

**Validates: Requirements 7.49, 7.49a, 7.49b, 7.49c, 7.49d, 7.49e, 7.49f, 7.49g, 7.49h, 7.49i, 7.49j, 7.49k, 7.50, 7.51**

### Property 73: Geographic Area Drill-Down

*For any* geographic area in the breakdown chart, clicking it should allow drilling down into child geographic areas to view more detailed statistics.

**Validates: Requirements 7.39**

### Property 74: Date Formatting Consistency

*For any* date value displayed in the UI (activity dates, address history dates, venue history dates, analytics date ranges, table columns, detail views, forms), the rendered output should use ISO-8601 format (YYYY-MM-DD).

**Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7**

### Property 75: Geocoding Request Success

*For any* valid address string, when the geocode button is clicked, the Nominatim API should be called with the address and return at least one result or an error.

**Validates: Requirements 22.2, 22.3**

### Property 76: Geocoding Coordinate Population

*For any* successful geocoding response with a single result, the latitude and longitude fields should be automatically populated with the returned coordinates.

**Validates: Requirements 22.4**

### Property 77: Geocoding Multiple Results Handling

*For any* geocoding response with multiple results, a selection dialog should be displayed allowing the user to choose the correct location.

**Validates: Requirements 22.5**

### Property 78: Geocoding Error Handling

*For any* geocoding request that returns no results or fails, an appropriate error message should be displayed to the user.

**Validates: Requirements 22.6**

### Property 79: Geocoding Loading State

*For any* geocoding request in progress, a loading indicator should be displayed and the geocode button should be disabled.

**Validates: Requirements 22.7**

### Property 80: Geocoding Manual Override

*For any* geocoded coordinates, users should be able to manually edit the latitude and longitude fields to override the geocoded values.

**Validates: Requirements 22.8**

### Property 81: Geocoding Offline Behavior

*For any* offline state, the geocode button should be disabled and display a message that geocoding requires connectivity.

**Validates: Requirements 22.10**

### Property 82: Map View Display in Venue Form

*For any* venue form (create or edit mode), an interactive map view component should be displayed positioned to the right of the form fields.

**Validates: Requirements 22.11**

### Property 83: Map Pin Rendering

*For any* venue form with populated latitude and longitude coordinates, a pin should be rendered on the map at those exact coordinates.

**Validates: Requirements 22.12**

### Property 84: Map Zoom Level

*For any* venue form with populated coordinates, the map should be set to a reasonable zoom level for viewing the venue location.

**Validates: Requirements 22.13**

### Property 85: Pin Drag Updates Coordinates

*For any* venue form with a map pin, when the pin is dragged to a new position on the map, the latitude and longitude input fields should be updated with the new coordinates.

**Validates: Requirements 22.14, 22.15**

### Property 86: Coordinate Input Updates Pin

*For any* venue form with a map pin, when the latitude or longitude input fields are manually edited with valid coordinates, the pin position on the map should be updated to reflect the new coordinates.

**Validates: Requirements 22.16**

### Property 87: Two-Way Coordinate Synchronization

*For any* venue form, changes to either the coordinate input fields or the map pin position should immediately synchronize with the other, maintaining consistency at all times.

**Validates: Requirements 22.17**

### Property 88: Zoom Level Preservation

*For any* venue form where the user has manually adjusted the map zoom level, subsequent coordinate updates (via input fields or pin drag) should preserve the user's zoom level and only adjust the map center point.

**Validates: Requirements 22.18**

### Property 89: Hyperlinked Primary Column Navigation

*For any* entity list table, clicking the hyperlinked primary column value should navigate to the detail view for that entity.

**Validates: Requirements 23.1, 23.2**

### Property 90: View Button Exclusion with Hyperlinked Primary Column

*For any* table with a hyperlinked primary column, the Actions column should NOT include a separate "View" action button.

**Validates: Requirements 23.3**

### Property 91: Hyperlinked Primary Column Consistency

*For any* table in the application (list views or detail page tables), the primary column should use the CloudScape Link component with consistent styling.

**Validates: Requirements 23.5, 23.6**

### Property 92: Edit Button on Detail Pages

*For any* entity detail page (participants, activities, venues, geographic areas), when the user has EDITOR or ADMINISTRATOR role, an edit button should be displayed in the header section as the right-most action using CloudScape Button with variant="primary".

**Validates: Requirements 24.1, 24.2, 24.3, 24.5, 24.6**

### Property 93: Edit Button Opens Edit Form

*For any* entity detail page with an edit button, clicking the edit button should open the edit form for the current entity.

**Validates: Requirements 24.4**

### Property 93a: Delete Button on Detail Pages

*For any* entity detail page (participants, activities, venues, geographic areas), when the user has EDITOR or ADMINISTRATOR role, a delete button should be displayed in the header section next to the edit button.

**Validates: Requirements 24A.1, 24A.2, 24A.3, 24A.8, 24A.9**

### Property 93b: Delete Confirmation Dialog

*For any* delete button click on an entity detail page, a confirmation dialog should be displayed before proceeding with the deletion.

**Validates: Requirements 24A.4**

### Property 93c: Delete Success Navigation

*For any* successful entity deletion from a detail page, the application should navigate back to the corresponding entity list page.

**Validates: Requirements 24A.5, 24A.6**

### Property 93d: Delete Error Handling

*For any* failed entity deletion from a detail page, an error message should be displayed explaining why the deletion failed.

**Validates: Requirements 24A.7, 24A.10**

### Property 94: Global Filter URL Synchronization

*For any* geographic area selected in the global filter, the URL query parameter should be updated to reflect the selected area ID, and navigating to a URL with a geographic area query parameter should apply that filter automatically.

**Validates: Requirements 25.6, 25.7**

### Property 95: Global Filter Persistence

*For any* geographic area selected in the global filter, the selection should be persisted to localStorage so it can be restored in future sessions.

**Validates: Requirements 25.8**

### Property 96: Global Filter Restoration

*For any* user returning to the application, the last-selected geographic area filter should be restored from localStorage and applied automatically.

**Validates: Requirements 25.9**

### Property 97: Recursive Geographic Filtering

*For any* geographic area selected in the global filter, all filtered results should include records associated with the selected area and all its descendant areas (recursive aggregation).

**Validates: Requirements 25.4, 25.5**

### Property 98: Global Filter Application to All Lists

*For any* list view (activities, participants, venues, geographic areas), when the global geographic area filter is active, only records associated with venues in the filtered geographic area or its descendants should be displayed.

**Validates: Requirements 25.5**

### Property 99: Global Filter Clear Functionality

*For any* active global geographic area filter, the user should be able to clear the filter and return to the "Global" (all areas) view with a single action.

**Validates: Requirements 25.11**

### Property 100: Async Dropdown Initial Load

*For any* high-cardinality entity dropdown (venue, participant, geographic area), when the dropdown is opened, the first page of results should be automatically loaded from the backend.

**Validates: Requirements 26.4**

### Property 101: Async Dropdown Text Filtering

*For any* high-cardinality entity dropdown with user text input, the dropdown should asynchronously fetch and display filtered results from the backend based on the input text.

**Validates: Requirements 26.5**

### Property 102: Dropdown Input Debouncing

*For any* text input in a high-cardinality dropdown, API requests should be debounced with a minimum 300ms delay to prevent excessive requests.

**Validates: Requirements 26.6**

### Property 103: Dropdown Loading Indicator

*For any* high-cardinality dropdown while fetching results, a loading indicator should be displayed to provide visual feedback.

**Validates: Requirements 26.7**

### Property 104: Dropdown Combined Filtering

*For any* high-cardinality dropdown with both text search and geographic area filter active, both filters should be applied using AND logic.

**Validates: Requirements 26.7 (implied from backend requirement 22.7)**

### Property 105: Global Filter Dropdown Hierarchical Display

*For any* geographic area displayed in the global filter dropdown, the option should show the area type and the full ancestor hierarchy path formatted with closest ancestor on the left and most distant ancestor on the right, separated by " > ".

**Validates: Requirements 25.12, 25.13, 25.14, 25.15**

### Property 106: Global Filter Dropdown Scoped Options

*For any* active global geographic area filter, the filter selector dropdown should display only the descendants (recursively) of the currently filtered area, and when the filter is "Global", all geographic areas should be displayed.

**Validates: Requirements 25.16, 25.17**

### Property 106a: Global Filter Breadcrumb Ancestor Display

*For any* active global geographic area filter displayed in the header breadcrumb or filter indicator, the display should include the full ancestor hierarchy path to provide geographic context.

**Validates: Requirements 25.18**

### Property 106b: Global Filter Ancestor Non-Suppression

*For any* global geographic area filter display (breadcrumb, filter indicator, or tree view), ancestor geographic areas should never be suppressed or hidden from the display.

**Validates: Requirements 25.19**

### Property 106c: Breadcrumb Ancestor Click Behavior

*For any* ancestor area displayed in the breadcrumb that the user does not have direct authorization to access, clicking on that ancestor should clear the global geographic area filter (revert to "Global").

**Validates: Requirements 25.20**

### Property 106d: Unauthorized Filter URL Clearing

*For any* URL navigation with a geographic area filter parameter that refers to an area the user is not directly authorized to access, the filter parameter should be cleared from the URL and the filter should revert to "Global".

**Validates: Requirements 25.21**

### Property 106e: Filter Authorization Validation

*For any* geographic area filter selection, the system should validate that the selected area is within the user's directly authorized areas, and clear the filter if validation fails.

**Validates: Requirements 25.22**

### Property 106f: Filter Clearing on 403 Authorization Error

*For any* API request that returns a 403 Forbidden error with code GEOGRAPHIC_AUTHORIZATION_DENIED while a global geographic area filter is active, the system should automatically clear the global filter, revert to "Global", and display a notification explaining the filter was cleared due to authorization restrictions.

**Validates: Requirements 25.24, 25.25**

### Optional Field Clearing Properties

**Property 107: Optional field clearing in participant form**
*For any* participant form with populated optional fields (email, phone, notes, dateOfBirth, dateOfRegistration, nickname), clicking the clear button should set the field to null and send null to the API on save, resulting in the field being empty in subsequent views.
**Validates: Requirements 27.1, 27.5, 27.6, 27.7, 27.8**

**Property 108: Optional field clearing in venue form**
*For any* venue form with populated optional fields (latitude, longitude, venueType), clicking the clear button should set the field to null and send null to the API on save, resulting in the field being empty in subsequent views.
**Validates: Requirements 27.2, 27.5, 27.6, 27.7, 27.8**

**Property 109: End date clearing in activity form**
*For any* activity form with a populated endDate, clicking the clear button should set endDate to null and send null to the API on save, converting the activity to ongoing.
**Validates: Requirements 27.3, 27.5, 27.6, 27.7, 27.8**

**Property 110: Notes clearing in assignment form**
*For any* assignment form with populated notes, clicking the clear button should set notes to null and send null to the API on save, resulting in the notes being empty in subsequent views.
**Validates: Requirements 27.4, 27.5, 27.6, 27.7, 27.8**

**Property 111: Clear button visibility**
*For any* optional field with a value, a clear button (X icon) should be visible next to the field, and when the field is empty, the clear button should be hidden.
**Validates: Requirements 27.7, 27.8**

**Property 112: Field clearing vs omission distinction**
*For any* form update, fields that are not modified should be omitted from the API request (preserving existing values), while fields that are explicitly cleared should send null to the API (clearing the values).
**Validates: Requirements 27.9**

### Interactive Chart Legend Properties

**Property 113: Legend Item Click Toggles Series Visibility**
*For any* chart with multiple data series and an interactive legend, clicking a legend item should toggle the visibility of the corresponding data series in the chart.
**Validates: Requirements 28.2**

**Property 114: Hidden Series Visual Indication**
*For any* chart legend with hidden data series, the legend should visually indicate which series are hidden through dimmed text, reduced opacity, or other clear visual treatment.
**Validates: Requirements 28.3, 28.4**

**Property 115: Independent Series Toggling**
*For any* chart with multiple data series, each series should be independently toggleable without affecting the visibility state of other series.
**Validates: Requirements 28.5**

**Property 116: Minimum Visible Series**
*For any* chart with interactive legend, at least one data series should remain visible at all times, or an appropriate message should be displayed when attempting to hide all series.
**Validates: Requirements 28.6**

**Property 117: Interactive Legend Application to All Multi-Series Charts**
*For any* chart that displays multiple data series (Activities chart, Activity Lifecycle chart, Growth Dashboard charts, Geographic breakdown chart, Role distribution chart), an interactive legend should be provided.
**Validates: Requirements 28.1, 28.7**

**Property 118: Chart Responsiveness with Series Toggling**
*For any* chart with series toggled on or off, the chart should remain interactive and responsive, with axis scales and ranges updating appropriately to reflect the visible data.
**Validates: Requirements 28.8, 28.9**

**Property 119: Legend Item Hover Feedback**
*For any* interactive legend item, hovering over it should provide visual feedback (e.g., cursor change, highlight) to indicate it is clickable.
**Validates: Requirements 28.10**

**Property 120: Legend Accessibility**
*For any* interactive legend, legend items should be keyboard navigable (Tab key) and screen reader compatible with appropriate ARIA attributes.
**Validates: Requirements 28.11**

**Property 121: Series Visibility Persistence**
*For any* chart with toggled series visibility, the visibility state should be persisted in browser session storage and restored when the user returns to the chart.
**Validates: Requirements 28.12**

### Property 56A: Dirty Form Detection

*For any* form page with unsaved changes, the navigation guard should detect the dirty state by comparing current form values to initial values.

**Validates: Requirements 2A.9, 2A.13**

### Property 56B: Navigation Blocking with Dirty Form

*For any* navigation attempt from a form page with unsaved changes, the navigation guard should intercept the attempt and display a confirmation dialog.

**Validates: Requirements 2A.10**

### Property 56C: Discard Changes Confirmation

*For any* dirty form where the user confirms they want to discard changes, the navigation should proceed to the intended destination.

**Validates: Requirements 2A.11**

### Property 56D: Cancel Discard Confirmation

*For any* dirty form where the user cancels the discard confirmation, the navigation should be cancelled and all form data should be preserved.

**Validates: Requirements 2A.12**

### Property 56E: Dirty State Clearing After Submission

*For any* form page with unsaved changes, after successful form submission, the dirty state should be cleared and subsequent navigation should not trigger confirmation dialogs.

**Validates: Requirements 2A.14**

### Property 56F: Form Page Vertical Scrolling

*For any* form page for major entities (participants, activities, venues, geographic areas), the page should allow vertical scrolling to accommodate large forms with many fields and embedded sections.

**Validates: Requirements 2A.6**

### Property 56G: Modal Dialog Restriction for Major Entities

*For any* create or edit operation on major entities (participants, activities, venues, geographic areas), the UI should use dedicated pages rather than modal dialogs.

**Validates: Requirements 2A.1, 2A.2, 2A.3, 2A.4, 2A.5**

### Property 56H: Modal Dialog Permission for Simple Entities

*For any* create or edit operation on simple configuration entities (activity categories, activity types, participant roles) or child records (address history, venue history, assignments), the UI may use modal dialogs.

**Validates: Requirements 2A.7, 2A.8**

## Error Handling

### Client-Side Errors

**Validation Errors:**
- Display inline error messages using CloudScape FormField error prop
- Highlight invalid fields with red border
- Prevent form submission until all errors resolved
- Preserve valid field values during validation

**Network Errors:**
- Detect offline status and queue operations
- Display toast notification for transient network failures
- Provide retry mechanism for failed requests
- Show connection status indicator in header

**Authentication Errors:**
- Redirect to login on 401 Unauthorized
- Clear tokens and session data
- Display error message explaining authentication failure
- Preserve intended destination for post-login redirect

**Authorization Errors:**
- Display modal dialog for 403 Forbidden
- Explain which permission is required
- Provide link to contact administrator
- Maintain current page state

### Server-Side Errors

**400 Bad Request:**
- Parse validation errors from response
- Display field-specific errors in form
- Highlight problematic fields

**404 Not Found:**
- Display user-friendly "resource not found" message
- Provide navigation back to list view
- Log error details to console

**409 Conflict (Version Mismatch):**
- Detect VERSION_CONFLICT error code
- Display conflict notification to user
- Provide options: retry with latest version, discard changes, or view differences
- Refetch latest entity data

**500 Internal Server Error:**
- Display generic error message to user
- Log full error details to console
- Provide retry option
- Maintain application state

**429 Too Many Requests:**
- Display rate limit exceeded message
- Show retry-after time from X-RateLimit-Reset header
- Automatically retry after cooldown period
- Log rate limit details

### Offline Handling

**Offline Detection:**
- Listen to `online` and `offline` events
- Update global connection state
- Display offline indicator in header
- Disable features requiring connectivity

**Queue Management:**
- Store failed operations in IndexedDB queue
- Retry automatically when online
- Display pending operation count
- Provide manual sync button

**Conflict Resolution:**
- Detect conflicts during sync (version mismatch)
- Display conflict notification to user
- Provide options: keep local, keep server, or merge
- Log conflict details for debugging

### Error Logging

**Console Logging:**
- Log all errors with full stack traces
- Include request/response details for API errors
- Log user actions leading to error
- Include timestamp and user context

**Error Boundaries:**
- Implement React Error Boundaries for component crashes
- Display fallback UI with error message
- Provide "Report Error" button
- Log component stack to console

### Utility Functions

**Date Formatting:**
- `formatDate(dateString: string): string` - Converts ISO-8601 datetime strings to YYYY-MM-DD format
- Handles both full ISO-8601 datetime strings (2024-03-15T10:30:00Z) and date-only strings (2024-03-15)
- Returns consistently formatted date string for display throughout the UI
- Used in all components that display dates (tables, detail views, forms, charts)

**Implementation:**
```typescript
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  // Extract date portion from ISO-8601 string (YYYY-MM-DD)
  return dateString.split('T')[0];
}
```

## CSV Import and Export

### Overview

The web frontend provides CSV import and export functionality for bulk data operations on Participants, Venues, Activities, and Geographic Areas. This enables community organizers to:
- Bulk load data from external sources (spreadsheets, other systems)
- Share data with stakeholders who prefer spreadsheet formats
- Backup and restore data in a human-readable format
- Understand the required data structure through empty CSV templates

### UI Components

#### Export Button

**Location:** Table header actions area on list pages (Participants, Venues, Activities, Geographic Areas)

**Component:** CloudScape Button with icon

**Behavior:**
- Positioned in table header alongside other action buttons
- Hidden from READ_ONLY users
- Visible to EDITOR and ADMINISTRATOR users
- Disabled during export operation
- Shows loading indicator during export

**Implementation:**
```typescript
<Button
  iconName="download"
  onClick={handleExport}
  loading={isExporting}
  disabled={isExporting}
>
  Export CSV
</Button>
```

#### Import Button

**Location:** Table header actions area on list pages (Participants, Venues, Activities, Geographic Areas)

**Component:** CloudScape Button with icon and hidden file input

**Behavior:**
- Positioned in table header alongside Export button
- Hidden from READ_ONLY users
- Visible to EDITOR and ADMINISTRATOR users
- Opens file selection dialog on click
- Validates file extension (.csv) before upload
- Shows loading indicator during import
- Displays import results in modal dialog

**Implementation:**
```typescript
<>
  <input
    ref={fileInputRef}
    type="file"
    accept=".csv"
    style={{ display: 'none' }}
    onChange={handleFileSelect}
  />
  <Button
    iconName="upload"
    onClick={() => fileInputRef.current?.click()}
    loading={isImporting}
    disabled={isImporting}
  >
    Import CSV
  </Button>
</>
```

#### Import Results Modal

**Component:** CloudScape Modal with results summary

**Content:**
- Success/failure counts
- List of errors with row numbers and error messages
- Option to download error report
- Close button

**Implementation:**
```typescript
<Modal
  visible={showResults}
  onDismiss={() => setShowResults(false)}
  header="Import Results"
>
  <SpaceBetween size="m">
    <Alert type={result.failureCount > 0 ? 'warning' : 'success'}>
      {result.successCount} records imported successfully
      {result.failureCount > 0 && `, ${result.failureCount} failed`}
    </Alert>
    
    {result.errors.length > 0 && (
      <Table
        columnDefinitions={[
          { header: 'Row', cell: e => e.row },
          { header: 'Errors', cell: e => e.errors.join(', ') }
        ]}
        items={result.errors}
      />
    )}
  </SpaceBetween>
</Modal>
```

### Service Layer

#### Export Service Methods

**ParticipantService:**
```typescript
async exportParticipants(geographicAreaId?: string): Promise<void> {
  const response = await apiClient.get('/participants/export', {
    params: { geographicAreaId },
    responseType: 'blob'
  });
  
  const filename = `participants-${formatDate(new Date())}.csv`;
  downloadBlob(response.data, filename);
}
```

**VenueService:**
```typescript
async exportVenues(geographicAreaId?: string): Promise<void> {
  const response = await apiClient.get('/venues/export', {
    params: { geographicAreaId },
    responseType: 'blob'
  });
  
  const filename = `venues-${formatDate(new Date())}.csv`;
  downloadBlob(response.data, filename);
}
```

**ActivityService:**
```typescript
async exportActivities(geographicAreaId?: string): Promise<void> {
  const response = await apiClient.get('/activities/export', {
    params: { geographicAreaId },
    responseType: 'blob'
  });
  
  const filename = `activities-${formatDate(new Date())}.csv`;
  downloadBlob(response.data, filename);
}
```

**GeographicAreaService:**
```typescript
async exportGeographicAreas(): Promise<void> {
  const response = await apiClient.get('/geographic-areas/export', {
    responseType: 'blob'
  });
  
  const filename = `geographic-areas-${formatDate(new Date())}.csv`;
  downloadBlob(response.data, filename);
}
```

#### Import Service Methods

**ParticipantService:**
```typescript
async importParticipants(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/participants/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data.data;
}
```

**VenueService:**
```typescript
async importVenues(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/venues/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data.data;
}
```

**ActivityService:**
```typescript
async importActivities(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/activities/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data.data;
}
```

**GeographicAreaService:**
```typescript
async importGeographicAreas(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/geographic-areas/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data.data;
}
```

### Utility Functions

**Download Blob:**
```typescript
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

**File Validation:**
```typescript
function validateCSVFile(file: File): { valid: boolean; error?: string } {
  if (!file.name.endsWith('.csv')) {
    return { valid: false, error: 'File must be a CSV (.csv extension)' };
  }
  
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }
  
  return { valid: true };
}
```

**Generate Engagement Summary CSV:**
```typescript
function generateEngagementSummaryCSV(
  metrics: EngagementMetrics,
  groupingDimensions: string[]
): Blob {
  const rows: string[][] = [];
  
  // Build header row
  const headers = [...groupingDimensions];
  headers.push(
    'Activities at Start',
    'Activities at End',
    'Activities Started',
    'Activities Completed',
    'Activities Cancelled',
    'Participants at Start',
    'Participants at End',
    'Participation at Start',
    'Participation at End'
  );
  rows.push(headers);
  
  // Add Total row
  const totalRow = groupingDimensions.map(() => '');
  totalRow[0] = 'Total';
  totalRow.push(
    metrics.activitiesAtStart.toString(),
    metrics.activitiesAtEnd.toString(),
    metrics.activitiesStarted.toString(),
    metrics.activitiesCompleted.toString(),
    metrics.activitiesCancelled.toString(),
    metrics.participantsAtStart.toString(),
    metrics.participantsAtEnd.toString(),
    metrics.participationAtStart.toString(),
    metrics.participationAtEnd.toString()
  );
  rows.push(totalRow);
  
  // Add dimensional breakdown rows if grouping is active
  if (metrics.groupedResults && metrics.groupedResults.length > 0) {
    for (const group of metrics.groupedResults) {
      const row: string[] = [];
      
      // Add dimension values (human-friendly labels, not UUIDs)
      for (const dimension of groupingDimensions) {
        row.push(group.dimensions[dimension] || '');
      }
      
      // Add metric values
      row.push(
        group.metrics.activitiesAtStart.toString(),
        group.metrics.activitiesAtEnd.toString(),
        group.metrics.activitiesStarted.toString(),
        group.metrics.activitiesCompleted.toString(),
        group.metrics.activitiesCancelled.toString(),
        group.metrics.participantsAtStart.toString(),
        group.metrics.participantsAtEnd.toString(),
        group.metrics.participationAtStart.toString(),
        group.metrics.participationAtEnd.toString()
      );
      
      rows.push(row);
    }
  }
  
  // Convert to CSV string
  const csvContent = rows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  // Create blob
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}
```

### Component Implementation

#### Export Handler

```typescript
const handleExport = async () => {
  setIsExporting(true);
  
  try {
    // Get global geographic area filter from context
    const { selectedGeographicAreaId } = useGlobalGeographicFilter();
    
    // Call export service with filter
    await participantService.exportParticipants(selectedGeographicAreaId);
    
    // Show success notification
    addNotification({
      type: 'success',
      content: selectedGeographicAreaId 
        ? 'Filtered participants exported successfully'
        : 'All participants exported successfully'
    });
  } catch (error) {
    // Show error notification
    addNotification({
      type: 'error',
      content: 'Failed to export participants: ' + error.message
    });
  } finally {
    setIsExporting(false);
  }
};
```

#### Import Handler

```typescript
const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // Validate file
  const validation = validateCSVFile(file);
  if (!validation.valid) {
    addNotification({
      type: 'error',
      content: validation.error
    });
    return;
  }
  
  setIsImporting(true);
  
  try {
    // Upload and import
    const result = await participantService.importParticipants(file);
    
    // Show results modal
    setImportResult(result);
    setShowResults(true);
    
    // Refresh list if any records were imported
    if (result.successCount > 0) {
      queryClient.invalidateQueries(['participants']);
    }
  } catch (error) {
    addNotification({
      type: 'error',
      content: 'Failed to import participants: ' + error.message
    });
  } finally {
    setIsImporting(false);
    // Reset file input
    event.target.value = '';
  }
};
```

### Data Types

```typescript
interface ImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: ImportError[];
}

interface ImportError {
  row: number;
  data: Record<string, any>;
  errors: string[];
}
```

### Error Handling

**File Validation Errors:**
- Non-CSV file: Display error notification "File must be a CSV (.csv extension)"
- File too large: Display error notification "File size must be less than 10MB"

**Import Errors:**
- Network errors: Display error notification with retry option
- Validation errors: Display in results modal with row numbers and error messages
- Partial success: Display warning notification with success/failure counts

**Export Errors:**
- Network errors: Display error notification with retry option
- Empty result: Download CSV with header row only (not an error)

### User Experience

**Export Flow:**
1. User clicks "Export CSV" button
2. Button shows loading state
3. Browser downloads CSV file
4. Success notification appears
5. Button returns to normal state

**Import Flow:**
1. User clicks "Import CSV" button
2. File selection dialog opens
3. User selects CSV file
4. File is validated
5. If valid, upload begins with loading indicator
6. Import results modal appears
7. User reviews results
8. If successful, list refreshes automatically
9. User closes modal

**Geographic Filter Integration:**
- When global geographic area filter is active, export includes only filtered records
- Success notification indicates whether export was filtered or global
- Import is not affected by geographic filter (imports all records in file)

### Performance Considerations

**Large File Handling:**
- Show progress indicator during upload
- Use streaming for large file uploads
- Implement chunking for very large files (>5MB)
- Provide cancel option for long-running imports

**Export Optimization:**
- Use blob response type for efficient binary handling
- Stream download directly to browser
- Don't load entire CSV into memory
- Use browser's native download mechanism

**UI Responsiveness:**
- Disable buttons during operations to prevent duplicate requests
- Show loading indicators for user feedback
- Use optimistic updates where appropriate
- Refresh list data after successful import

### Security Considerations

**Authorization:**
- Export: Available to all authenticated users (respects geographic filter)
- Import: Restricted to EDITOR and ADMINISTRATOR roles only
- Buttons hidden based on user role

**Input Validation:**
- Validate file type before upload
- Validate file size before upload
- Backend validates all CSV data
- Sanitize error messages to prevent XSS

**Data Privacy:**
- Respect geographic area filters on exports
- Audit log all import/export operations
- Include user ID in audit logs

### Correctness Properties

**Property 142: CSV export button visibility**
*For any* user with READ_ONLY role, the Export CSV button should be hidden; for users with EDITOR or ADMINISTRATOR role, it should be visible.
**Validates: Requirements 29.22, 29.23**

**Property 143: CSV import button visibility**
*For any* user with READ_ONLY role, the Import CSV button should be hidden; for users with EDITOR or ADMINISTRATOR role, it should be visible.
**Validates: Requirements 29.22, 29.23**

**Property 144: CSV export trigger**
*For any* Export CSV button click, the application should call the appropriate backend export endpoint and trigger a browser download.
**Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6**

**Property 145: Empty CSV download**
*For any* export operation with no records, the application should download a CSV file with only the header row.
**Validates: Requirements 29.7**

**Property 146: CSV import file selection**
*For any* Import CSV button click, the application should open a file selection dialog.
**Validates: Requirements 29.8, 29.9, 29.10, 29.11, 29.12**

**Property 147: CSV import success handling**
*For any* successful CSV import, the application should display a success message with counts and refresh the entity list.
**Validates: Requirements 29.14, 29.18**

**Property 148: CSV import error handling**
*For any* failed CSV import, the application should display detailed error messages for failed rows.
**Validates: Requirements 29.15**

**Property 149: CSV file validation**
*For any* non-CSV file selected for import, the application should display an error message and prevent upload.
**Validates: Requirements 29.19, 29.20**

**Property 150: CSV operation loading states**
*For any* import or export operation in progress, the application should display a loading indicator and disable the corresponding button.
**Validates: Requirements 29.16, 29.17**

**Property 151: CSV export geographic filtering**
*For any* export operation with the global geographic area filter active, the application should include the filter in the export request and indicate in the success message that only filtered records were exported.
**Validates: Requirements 29.24, 29.25**

**Property 152: Engagement Summary CSV export button presence**
*For any* Engagement Dashboard rendering, an "Export CSV" button should be displayed near the Engagement Summary table for users with EDITOR or ADMINISTRATOR roles.
**Validates: Requirements 30.1, 30.13, 30.14**

**Property 153: Engagement Summary CSV content completeness**
*For any* Engagement Summary table with data, the exported CSV should include the Total row, all dimensional breakdown rows (when grouping is active), and all metric columns.
**Validates: Requirements 30.2, 30.3, 30.4, 30.6**

**Property 154: Engagement Summary CSV human-friendly labels**
*For any* Engagement Summary CSV export with dimensional breakdowns, all dimension columns should contain human-friendly labels (activity category names, activity type names, venue names, geographic area names) instead of UUIDs.
**Validates: Requirements 30.5**

**Property 155: Engagement Summary CSV filename format**
*For any* Engagement Summary CSV export, the downloaded filename should include "engagement-summary" and the current date in ISO-8601 format (YYYY-MM-DD).
**Validates: Requirements 30.8, 30.17**

**Property 156: Engagement Summary CSV export loading state**
*For any* Engagement Summary CSV export operation in progress, a loading indicator should be displayed and the Export CSV button should be disabled.
**Validates: Requirements 30.9, 30.10**

**Property 157: Engagement Summary CSV export filtered data**
*For any* Engagement Summary CSV export with filters or grouping dimensions applied, the exported CSV should contain only the filtered and grouped data matching the current dashboard state.
**Validates: Requirements 30.15, 30.16**

**Property 158: Engagement Summary CSV empty table handling**
*For any* Engagement Summary table with no data rows, the exported CSV should contain only the header row.
**Validates: Requirements 30.18**

### Geographic Authorization Properties

**Property 159: Authorization rules display**
*For any* user with geographic authorization rules, the User Administration page should display all rules with geographic area name, rule type, and creation date.
**Validates: Requirements 31.2, 31.5**

**Property 160: Authorization rule visual distinction**
*For any* authorization rule displayed, ALLOW rules should be visually distinguished from DENY rules using color coding or icons (green checkmark for ALLOW, red X for DENY).
**Validates: Requirements 31.11**

**Property 161: Authorization rule creation**
*For any* valid geographic area and rule type selection, creating an authorization rule should result in the rule being added to the user's authorization list.
**Validates: Requirements 31.6, 31.8**

**Property 162: Duplicate authorization rule prevention**
*For any* user and geographic area combination with an existing rule, attempting to create a second rule should be prevented with an error message.
**Validates: Requirements 31.10**

**Property 163: Effective access summary display**
*For any* user with authorization rules, the effective access summary should display allowed areas with descendants, ancestor areas marked as read-only, and denied areas.
**Validates: Requirements 31.12, 31.13, 31.14**

**Property 164: Authorization management admin restriction**
*For any* non-administrator user viewing the User Administration page, geographic authorization management features should be hidden.
**Validates: Requirements 31.15, 31.16**

**Property 165: DENY rule override warning**
*For any* DENY rule creation that overrides existing ALLOW rules, a warning should be displayed to the administrator.
**Validates: Requirements 31.17**

**Property 166: Authorization explanatory text**
*For any* geographic authorization interface, explanatory text should be displayed describing how allow-listing and deny-listing rules work, including descendant and ancestor access behavior.
**Validates: Requirements 31.18, 31.19**

**Property 167: Authorization refresh after modification**
*For any* authorization rule creation or deletion, the user list or detail view should refresh to reflect the changes.
**Validates: Requirements 31.20**

### Property 182: Entity Selector Refresh Button Presence

*For any* entity reference selector in a form (geographic area, venue, activity category, participant, role, population), a refresh button with the refresh icon should be displayed adjacent to the selector.

**Validates: Requirements 17A.1, 17A.2, 17A.17**

### Property 183: Entity Selector Add Button Presence

*For any* entity reference selector in a form (geographic area, venue, activity category, participant, role, population), an add button with the add-plus icon should be displayed adjacent to the selector.

**Validates: Requirements 17A.1, 17A.3, 17A.17**

### Property 184: Refresh Button Reloads Options

*For any* entity reference selector, when the refresh button is clicked, the selector options should be reloaded from the backend and the currently selected value should be preserved if it still exists.

**Validates: Requirements 17A.4, 17A.23**

### Property 185: Add Button Opens New Tab

*For any* entity reference selector, when the add button is clicked, the entity creation page should open in a new browser tab without affecting the current form context.

**Validates: Requirements 17A.5, 17A.6, 17A.7**

### Property 186: Add Button Permission-Based Disabling

*For any* entity reference selector, the add button should be disabled when the user does not have permission to create the referenced entity type, while the refresh button should always be enabled.

**Validates: Requirements 17A.19, 17A.20**

### Property 187: Refresh Button Loading Indicator

*For any* entity reference selector, when the refresh button is clicked, a loading indicator should be displayed on the button during the reload operation and restored to normal state after completion.

**Validates: Requirements 17A.21, 17A.22**

## Testing Strategy

### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions using Jest and React Testing Library.

**Component Testing:**
- Test component rendering with various props
- Test user interactions (clicks, form inputs)
- Test conditional rendering based on state
- Test error states and edge cases
- Mock API calls and external dependencies

**Service Testing:**
- Test API client methods with mocked responses
- Test error handling for network failures
- Test data transformation logic
- Test authentication token management

**Utility Testing:**
- Test validation functions with valid and invalid inputs
- Test date formatting and parsing
- Test data aggregation and calculation functions

**Example Unit Tests:**
- Login form displays error for invalid credentials
- Activity form requires end date for finite activities
- Delete button is disabled when entity has references
- Offline indicator appears when connection lost
- Admin-only features hidden from non-admin users

### Property-Based Testing

Property-based tests verify universal properties across all inputs using fast-check library. Each test runs a minimum of 100 iterations with randomly generated inputs.

**Test Configuration:**
- Use fast-check for property-based testing
- Configure 100+ iterations per test
- Tag each test with feature name and property number
- Reference design document property in test comments

**Generator Strategy:**
- Create smart generators that constrain to valid input space
- Generate realistic test data (valid emails, dates, etc.)
- Include edge cases in generators (empty strings, boundary values)
- Compose generators for complex data structures

**Property Test Examples:**
- For any activity type with references, deletion should be prevented (Property 2)
- For any whitespace-only string, name validation should fail (Property 4)
- For any search term, results should only include matching participants (Property 6)
- For any dataset, metric calculations should be accurate (Property 20)
- For any offline operation, it should be queued for sync (Property 28)

**Test Tagging Format:**
```typescript
// Feature: web-frontend, Property 6: Participant Search Functionality
test('search results only include matching participants', () => {
  fc.assert(
    fc.property(
      fc.array(participantGenerator()),
      fc.string(),
      (participants, searchTerm) => {
        const results = searchParticipants(participants, searchTerm);
        return results.every(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests verify end-to-end flows and component interactions using Playwright or Cypress.

**Test Scenarios:**
- Complete user workflows (login → create activity → assign participant)
- Offline operation and synchronization
- Authentication and authorization flows
- Form submission and validation
- Navigation and routing

### Visual Regression Testing

Visual tests ensure UI consistency across changes using Percy or Chromatic.

**Test Coverage:**
- All major pages and components
- Different screen sizes (768px, 1024px, 1920px)
- Different user roles (admin, editor, read-only)
- Error states and loading states

### Accessibility Testing

Accessibility tests ensure WCAG 2.1 AA compliance using axe-core.

**Test Coverage:**
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus management
- ARIA labels and roles

## Implementation Notes

### State Management Strategy

**Server State (React Query):**
- Cache API responses with automatic invalidation
- Optimistic updates for better UX
- Background refetching for data freshness
- Automatic retry on failure

**Global UI State (Context):**
- User session and authentication
- Theme preferences
- Connection status
- Notification queue

**Local Component State:**
- Form inputs and validation
- UI interactions (modals, dropdowns)
- Temporary UI state

### Offline-First Architecture

**Data Flow:**
1. User performs action
2. Check connection status
3. If online: Send to API, update cache
4. If offline: Store in queue, update local cache
5. When online: Process queue, sync with server

**Conflict Resolution:**
- Use optimistic locking with version numbers
- Detect conflicts during sync
- Prompt user to resolve conflicts
- Provide clear options (local, server, merge)

### Performance Optimization

**Code Splitting:**
- Lazy load routes with React.lazy()
- Split vendor bundles
- Preload critical routes

**Memoization:**
- Use React.memo for expensive components
- Use useMemo for expensive calculations
- Use useCallback for stable function references

**Virtual Scrolling:**
- Implement virtual scrolling for large lists
- Use react-window or react-virtual

**Image Optimization:**
- Lazy load images
- Use appropriate image formats (WebP)
- Provide responsive images

### Security Considerations

**Token Storage:**
- Store access tokens in memory only (expires in 15 minutes)
- Store refresh tokens in localStorage or httpOnly cookies (expires in 7 days)
- Clear tokens on logout
- Decode JWT access token to extract user information (userId, email, role)

**XSS Prevention:**
- Sanitize user inputs
- Use React's built-in XSS protection
- Avoid dangerouslySetInnerHTML

**CSRF Protection:**
- Include CSRF tokens in state-changing requests
- Validate tokens on backend

**Content Security Policy:**
- Implement strict CSP headers
- Whitelist trusted sources
- Report violations

### Accessibility Requirements

**Keyboard Navigation:**
- All interactive elements accessible via keyboard
- Logical tab order
- Visible focus indicators
- Keyboard shortcuts for common actions

**Screen Reader Support:**
- Semantic HTML elements
- ARIA labels and roles
- Live regions for dynamic content
- Descriptive link text

**Visual Accessibility:**
- Minimum 4.5:1 contrast ratio for text
- Minimum 3:1 contrast ratio for UI components
- No information conveyed by color alone
- Resizable text up to 200%

### Browser Support

**Target Browsers:**
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

**Progressive Enhancement:**
- Core functionality works without JavaScript
- Enhanced features for modern browsers
- Graceful degradation for older browsers

### Deployment Considerations

**Build Optimization:**
- Minification and compression
- Tree shaking for unused code
- Asset optimization (images, fonts)
- Source maps for debugging

**CDN Strategy:**
- Serve static assets from CDN
- Cache-busting with content hashes
- Preload critical resources

**Monitoring:**
- Error tracking with Sentry or similar
- Performance monitoring with Web Vitals
- User analytics for feature usage
- A/B testing infrastructure
