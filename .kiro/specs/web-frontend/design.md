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
- Redirects to dashboard on successful authentication

**ProtectedRoute**
- Wrapper component that checks authentication status
- Redirects to login if user is not authenticated
- Checks user role for authorization
- Conditionally renders children based on permissions

#### 2. Layout Components

**AppLayout**
- Uses CloudScape AppLayout component for consistent structure
- Renders navigation sidebar with links to all sections
- Displays user menu with name, role, and logout option
- Shows connection status indicator (online/offline)
- Highlights current active section
- Displays global geographic area filter selector in header utilities section
- Shows current filter selection or "Global" when no filter is active
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
- Unified page/view for managing both activity categories and types
- Displays categories and types in a cohesive interface
- Shows hierarchical relationship between categories and types
- Provides easy navigation between category and type management

#### 4. Participant Role Management

**ParticipantRoleList**
- Displays table of roles using CloudScape Table
- Distinguishes predefined vs custom roles with badges
- Renders role name as hyperlink in primary column (links to edit form or detail view)
- Provides edit and delete actions per row (no separate View button)
- Handles delete validation (prevents deletion if referenced)

**ParticipantRoleForm**
- Modal form for creating/editing roles
- Validates name is not empty
- Submits to API and updates cache

#### 5. Participant Management

**ParticipantList**
- Displays table with search, sort, and filter capabilities
- Uses CloudScape Table with pagination
- Renders participant name as hyperlink in primary column (links to /participants/:id)
- Provides actions for edit and delete (no separate View button)
- Implements client-side search across name and email
- Applies global geographic area filter from context when active
- Filters to show only participants whose current home venue is in the filtered geographic area or its descendants

**ParticipantForm**
- Modal form for creating/editing participants
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

**ParticipantDetail**
- Shows participant information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Opens ParticipantForm when edit button is clicked
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

**AddressHistoryTable**
- Displays participant's home address history in reverse chronological order
- Renders venue name as hyperlink in primary column (links to /venues/:id)
- Shows effective start date for each record
- Provides edit and delete buttons for each record (no separate View button)
- Highlights the most recent address (first record in the list)

**AddressHistoryForm**
- Modal form for adding/editing address history records
- Requires venue selection from dropdown
- Requires effective start date using CloudScape DatePicker
- Validates that effective start date is provided
- Prevents duplicate records with the same effective start date for the same participant

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

**ActivityForm**
- Modal form for creating/editing activities
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

**ActivityDetail**
- Shows activity information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Opens ActivityForm when edit button is clicked
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
- Shows "Mark Complete" button for finite activities

**ActivityVenueHistoryTable**
- Displays activity's venue history in reverse chronological order
- Renders venue name as hyperlink in primary column (links to /venues/:id)
- Shows effective start date for each record
- Provides delete button for each record (no separate View button)
- Highlights the most recent venue (first record in the list)

**ActivityVenueHistoryForm**
- Modal form for adding venue associations
- Requires venue selection from dropdown
- Requires effective start date using CloudScape DatePicker
- Validates that effective start date is provided
- Prevents duplicate records with the same effective start date for the same activity

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
- Provides actions for edit and delete (no separate View button)
- Implements client-side search across name and address
- Applies global geographic area filter from context when active
- Filters to show only venues in the filtered geographic area or its descendants

**VenueForm**
- Modal form for creating/editing venues
- Validates name, address, and geographic area are required
- Provides dropdown for geographic area selection
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
- Renders draggable pin on map when coordinates are populated
- Sets map zoom to reasonable level (e.g., zoom level 15) when coordinates are first populated
- Updates latitude/longitude input fields when pin is dragged to new position
- Updates map pin position when latitude/longitude fields are manually edited
- Maintains two-way synchronization between coordinate inputs and map pin at all times
- Preserves user-adjusted zoom level during coordinate updates (only adjusts center point, not zoom)

**VenueDetail**
- Shows venue information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Opens VenueForm when edit button is clicked
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

**GeographicAreaForm**
- Modal form for creating/editing geographic areas
- Validates name and area type are required
- Provides dropdown for area type selection (NEIGHBOURHOOD, COMMUNITY, CITY, etc.)
- Provides dropdown for parent geographic area selection
- Prevents circular parent-child relationships
- Displays inline validation errors

**GeographicAreaDetail**
- Shows geographic area information in detail view
- Displays primary edit button in header section using CloudScape Button with variant="primary"
- Displays delete button in header section next to edit button
- Positions edit button as right-most action in header (before Back button)
- Opens GeographicAreaForm when edit button is clicked
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

#### 10. Map View

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
- Provides filter controls for activity category, activity type, status, and date range
- Updates map markers based on selected filters
- Provides geographic area boundary toggle
- Includes button to center map on specific venue or geographic area

**MapPopup**
- In Activities mode: displays activity name (hyperlinked to /activities/:id), category, type, start date, and participant count
- In Participant Homes mode: displays venue name (hyperlinked to /venues/:id) and count of participants living at that address
- In Venues mode: displays venue name (hyperlinked to /venues/:id), address, and geographic area
- Provides navigation to detail pages via hyperlinked names

#### 11. Analytics Dashboards

**EngagementDashboard**
- Displays comprehensive temporal metrics using CloudScape Cards:
  - Activities at start/end of date range
  - Activities started, completed, cancelled within range
  - Participants at start/end of date range
- Displays aggregate counts and breakdowns by activity category and activity type
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
- Provides multi-dimensional grouping controls:
  - Activity category grouping
  - Activity type grouping
  - Venue grouping
  - Geographic area grouping
- **PropertyFilter Component** for unified filtering:
  - Replaces separate activity type and venue filter dropdowns
  - Uses CloudScape PropertyFilter component
  - Supports filtering by Activity Category, Activity Type, and Venue properties
  - Implements lazy loading of property values when user types in filter input
  - Asynchronously fetches matching values from backend APIs:
    - Activity Categories: from ActivityCategoryService.getActivityCategories()
    - Activity Types: from ActivityTypeService.getActivityTypes()
    - Venues: from VenueService.getVenues() with geographic area filtering
  - Debounces user input internally (CloudScape handles debouncing)
  - Displays loading indicator while fetching property values
  - Supports multiple filter tokens with AND logic
  - Provides clear labels for each property (Activity Category, Activity Type, Venue)
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
  - First row displays aggregate metrics with "Total" label in first column
  - When multiple grouping dimensions selected, subsequent dimension cells in Total row are left blank
  - Metric columns: activities at start, at end, started, completed, cancelled, participants at start, at end
  - When grouping dimensions selected, additional rows show dimensional breakdowns:
    - Breakdown dimension columns appear first (activity category, activity type, venue, geographic area)
    - Activity category names rendered as hyperlinks to /configuration (Activity Configuration page)
    - Activity type names rendered as hyperlinks to /configuration (Activity Configuration page)
    - Venue names rendered as hyperlinks to /venues/:id
    - Geographic area names rendered as hyperlinks to /geographic-areas/:id
  - Each metric displayed in its own column for easy comparison
- Shows role distribution within filtered and grouped results
- Displays geographic breakdown chart showing engagement by geographic area
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
- Displays two separate time-series charts: one for unique participant counts and one for unique activity counts
- Provides time period selector (day, week, month, year)
- Each time period represents a snapshot of unique participants and activities engaged at that point in time (not cumulative counts)
- Provides optional grouping control to view growth by activity type or activity category
- When grouped by type: displays separate time-series for each activity type in both charts
- When grouped by category: displays separate time-series for each activity category in both charts
- When not grouped: displays aggregate time-series across all types and categories in both charts
- Uses separate line charts for each metric:
  - Participant Growth Chart: displays unique participant counts over time
  - Activity Growth Chart: displays unique activity counts over time
  - Each chart has its own Y-axis scale optimized for its data range
- Provides geographic area filter dropdown
- Uses recharts for line charts
- Synchronizes filter parameters with URL query parameters:
  - Period parameter: `?period=MONTH`
  - Absolute date range: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - Relative date range: `?relativePeriod=-90d` (compact format: -[amount][unit])
    - Units: d (day), w (week), m (month), y (year)
    - Examples: `-30d`, `-6m`, `-1y`
  - Grouping parameter: `?groupBy=type` or `?groupBy=category`
  - Reads URL parameters on component mount to initialize dashboard state
  - Updates URL when user changes filters (using React Router's useSearchParams)
  - Enables browser back/forward navigation between different configurations
  - Allows URL sharing for collaborative analysis

#### 9. User Management (Admin Only)

**UserList**
- Displays table of all users (admin only)
- Renders user email as hyperlink in primary column (links to edit form)
- Shows email and role
- Provides edit action per row (no separate View button)

**UserForm**
- Modal form for creating/editing users
- Allows role assignment and modification
- Only accessible to administrators

#### 12. Common Components

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

### Service Layer

#### React Contexts

**GlobalGeographicFilterContext**
- Manages global geographic area filter state shared across all views
- Provides `selectedGeographicAreaId: string | null` - Currently selected geographic area ID or null for "Global" view
- Provides `selectedGeographicArea: GeographicArea | null` - Full geographic area object for display
- Provides `setGeographicAreaFilter(id: string | null)` - Updates filter selection
- Provides `clearFilter()` - Resets filter to "Global" (null)
- Provides `isLoading: boolean` - Indicates if geographic area details are being fetched
- Provides `availableAreas: GeographicAreaWithHierarchy[]` - List of geographic areas available in the filter dropdown
- Provides `formatAreaOption(area: GeographicAreaWithHierarchy): string` - Formats area with type and hierarchy path for display
- Synchronizes filter with URL query parameter (`?geographicArea=<id>`)
- Persists filter to localStorage (key: `globalGeographicAreaFilter`)
- Restores filter from localStorage on application initialization
- URL parameter takes precedence over localStorage on initial load
- Fetches full geographic area details when filter is set for display in header
- Fetches available areas based on current filter scope:
  - When filter is "Global": fetches all geographic areas
  - When filter is active: fetches only descendants of the filtered area
- Fetches ancestor hierarchy for each area to build hierarchy path display
- Formats dropdown options with area type and ancestor path (e.g., "NEIGHBOURHOOD\nCommunity A > City B > Province C")

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
- `addActivityVenue(activityId, venueId, effectiveFrom)`: Associates venue with activity with effective start date
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
- `getEngagementMetrics(params)`: Fetches comprehensive engagement data from `/analytics/engagement` with flexible parameters
  - Parameters: `startDate?`, `endDate?`, `geographicAreaId?`, `activityCategoryId?`, `activityTypeId?`, `venueId?`, `groupBy?` (array of dimensions)
  - Returns temporal analysis: activities/participants at start/end, activities started/completed/cancelled
  - Returns aggregate counts and breakdowns by activity category and activity type
  - Returns hierarchically grouped results when multiple dimensions specified
  - Returns role distribution within filtered results
- `getGrowthMetrics(startDate?, endDate?, period?, geographicAreaId?, groupBy?)`: Fetches growth data from `/analytics/growth` with optional filters (period: DAY, WEEK, MONTH, YEAR; groupBy: 'type' | 'category' for optional grouping)
- `getGeographicAnalytics(startDate?, endDate?)`: Fetches geographic breakdown from `/analytics/geographic`
- `getActivityLifecycleEvents(params)`: Fetches activity lifecycle event data from `/analytics/activity-lifecycle`
  - Parameters: `startDate` (required), `endDate` (required), `groupBy` ('category' | 'type'), `geographicAreaIds?`, `activityTypeIds?`, `venueIds?`
  - Returns array of objects with `groupName`, `started` count, and `completed` count
  - Applies all provided filters using AND logic

**UserService** (Admin only)
- `getUsers()`: Fetches all users (admin only)
- `createUser(data)`: Creates new user (admin only)
- `updateUser(id, data)`: Updates user including role (admin only)

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
  email: string;
  role: 'ADMINISTRATOR' | 'EDITOR' | 'READ_ONLY';
  createdAt: string;
  updatedAt: string;
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
  effectiveFrom: string;
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
  effectiveFrom: string;
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
  
  // Aggregate counts
  totalActivities: number;
  totalParticipants: number;
  
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
    startDate?: string;
    endDate?: string;
  };
  groupingDimensions?: string[];
}

interface GrowthMetrics {
  period: string;
  uniqueParticipants: number;
  uniqueActivities: number;
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
  entityType: 'Activity' | 'Participant' | 'ActivityParticipant' | 'Venue' | 'GeographicArea' | 'ActivityType' | 'Role';
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

### Property 11: Address History Display Order

*For any* participant with address history, the address history table should display records in reverse chronological order by effective start date (most recent first).

**Validates: Requirements 4.11**

### Property 12: Address History Required Fields

*For any* address history record submission without venue or effective start date, the validation should fail and prevent creation.

**Validates: Requirements 4.15**

### Property 13: Address History Duplicate Prevention

*For any* participant, attempting to create an address history record with the same effective start date as an existing record should be prevented.

**Validates: Requirements 4.16**

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

### Property 20: Assignment Role Requirement

*For any* participant assignment attempt without a role selected, the validation should fail and prevent assignment.

**Validates: Requirements 6.2, 6.5**

### Property 21: Assignment Display Completeness

*For any* activity with assignments, the detail view should display all assigned participants along with their roles.

**Validates: Requirements 6.3**

### Property 22: Duplicate Assignment Prevention

*For any* attempt to create an assignment with the same participant and role combination that already exists for an activity, the operation should be prevented.

**Validates: Requirements 6.6**

### Property 23: Temporal activity metrics display

*For any* engagement dashboard with a date range, the displayed metrics should include activities at start, activities at end, activities started, activities completed, and activities cancelled.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

### Property 24: Temporal participant metrics display

*For any* engagement dashboard with a date range, the displayed metrics should include participants at start and participants at end.

**Validates: Requirements 7.7, 7.8**

### Property 25: Aggregate and breakdown display

*For any* engagement dashboard, all activity and participant counts should be displayed in both aggregate form and broken down by activity category and activity type.

**Validates: Requirements 7.9, 7.10, 7.11, 7.12, 7.13, 7.14**

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

*For any* engagement dashboard, the first row of the Engagement Summary table should display "Total" in the first column and aggregate metrics (activities at start, at end, started, completed, cancelled, participants at start, at end) in subsequent columns.

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

*For any* row in the Engagement Summary table, each metric aggregation (activities at start, at end, started, completed, cancelled, participants at start, at end) should be displayed in its own separate column.

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

*For any* time period and dataset, the separate time-series charts should correctly calculate unique participants and unique activities engaged during each time period as snapshots (not cumulative).

**Validates: Requirements 7.40, 7.41, 7.43**

### Property 33: Optional grouping display

*For any* growth dashboard with grouping selected (by type or category), separate time-series data should be displayed for each group showing unique participants and activities per period in both charts.

**Validates: Requirements 7.45, 7.46, 7.47**

### Property 33a: Growth Dashboard URL Parameter Synchronization

*For any* growth dashboard state (period and date range filters), the browser URL query parameters should accurately reflect all current filter values (period, startDate, endDate, relativeAmount, relativeUnit).

**Validates: Requirements 46a**

### Property 33b: Growth Dashboard URL Parameter Application

*For any* URL with growth dashboard query parameters, when a user navigates to that URL, the growth dashboard should automatically apply all filter parameters from the URL to initialize the dashboard state.

**Validates: Requirements 46b**

### Property 33c: Growth Dashboard URL Update on State Change

*For any* change to filter parameters in the growth dashboard, the browser URL should be updated to reflect the new state without causing a page reload.

**Validates: Requirements 46c**

### Property 33d: Growth Dashboard Browser Navigation Support

*For any* sequence of filter changes in the growth dashboard, using browser back/forward buttons should navigate through the history of configurations and restore the corresponding dashboard state.

**Validates: Requirements 46d**

### Property 33e: Growth Dashboard URL Shareability

*For any* growth dashboard URL copied and shared with another user, when that user navigates to the URL, they should see the same filtered results as the original user.

**Validates: Requirements 46e**

### Property 34: Unauthenticated access protection

*For any* protected route, attempting to access it without authentication should redirect to the login page.

**Validates: Requirements 9.1, 9.2**

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

### Property 44: Form validation error display

*For any* invalid form field, the field should be visually highlighted and display an inline error message.

**Validates: Requirements 14.2, 14.3**

### Property 45: Invalid form submission prevention

*For any* form with validation errors, the submit button should be disabled or submission should be prevented.

**Validates: Requirements 14.4**

### Property 46: Valid field value preservation

*For any* form with validation errors, all valid field values should remain unchanged after validation fails.

**Validates: Requirements 14.5**

### Property 47: Error Notification Type

*For any* error, transient errors should display toast notifications while critical errors should display modal dialogs.

**Validates: Requirements 15.2, 15.3**

### Property 48: Error State Preservation

*For any* error occurrence, the application state should remain unchanged (no data loss or corruption).

**Validates: Requirements 15.5**

### Property 49: Error Console Logging

*For any* error, detailed error information should be logged to the browser console.

**Validates: Requirements 15.6**

### Property 50: Loading State Indicators

*For any* asynchronous operation (API request, data loading, long operation), appropriate loading indicators should be displayed (spinners, skeleton screens, or progress bars).

**Validates: Requirements 16.1, 16.3, 16.4**

### Property 51: Form Button Disabling During Submission

*For any* form submission in progress, the submit button should be disabled to prevent duplicate submissions.

**Validates: Requirements 16.2**

### Property 52: Success Message Display

*For any* successful operation (create, update, delete), a success message should be displayed to the user.

**Validates: Requirements 16.5**

### Property 53: Venue List Display

*For any* venue, the list view should include the venue's name, address, and geographic area in the rendered output.

**Validates: Requirements 6A.1**

### Property 54: Venue Search Functionality

*For any* search query and venue list, the search results should only include venues whose name or address contains the search term (case-insensitive).

**Validates: Requirements 6A.2**

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

### Property 71: Geographic Area Filter Application

*For any* analytics dashboard with a geographic area filter applied, only activities and participants associated with venues in that geographic area or its descendants should be included in the metrics.

**Validates: Requirements 7.16**

### Property 72: Geographic Breakdown Chart Display

*For any* engagement metrics, the geographic breakdown chart should correctly display engagement data grouped by geographic area.

**Validates: Requirements 7.38**

### Property 73: Geographic Area Drill-Down

*For any* geographic area in the breakdown chart, clicking it should allow drilling down into child geographic areas to view more detailed statistics.

**Validates: Requirements 7.39**

### Property 74: Date Formatting Consistency

*For any* date value displayed in the UI (activity dates, address history dates, venue history dates, analytics date ranges, table columns, detail views, forms), the rendered output should use ISO-8601 format (YYYY-MM-DD).

**Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7**

### Property 75: Geocoding Request Success

*For any* valid address string, when the geocode button is clicked, the Nominatim API should be called with the address and return at least one result or an error.

**Validates: Requirements 21.2, 21.3**

### Property 76: Geocoding Coordinate Population

*For any* successful geocoding response with a single result, the latitude and longitude fields should be automatically populated with the returned coordinates.

**Validates: Requirements 21.4**

### Property 77: Geocoding Multiple Results Handling

*For any* geocoding response with multiple results, a selection dialog should be displayed allowing the user to choose the correct location.

**Validates: Requirements 21.5**

### Property 78: Geocoding Error Handling

*For any* geocoding request that returns no results or fails, an appropriate error message should be displayed to the user.

**Validates: Requirements 21.6**

### Property 79: Geocoding Loading State

*For any* geocoding request in progress, a loading indicator should be displayed and the geocode button should be disabled.

**Validates: Requirements 21.7**

### Property 80: Geocoding Manual Override

*For any* geocoded coordinates, users should be able to manually edit the latitude and longitude fields to override the geocoded values.

**Validates: Requirements 21.8**

### Property 81: Geocoding Offline Behavior

*For any* offline state, the geocode button should be disabled and display a message that geocoding requires connectivity.

**Validates: Requirements 21.10**

### Property 82: Map View Display in Venue Form

*For any* venue form (create or edit mode), an interactive map view component should be displayed positioned to the right of the form fields.

**Validates: Requirements 21.11**

### Property 83: Map Pin Rendering

*For any* venue form with populated latitude and longitude coordinates, a pin should be rendered on the map at those exact coordinates.

**Validates: Requirements 21.12**

### Property 84: Map Zoom Level

*For any* venue form with populated coordinates, the map should be set to a reasonable zoom level for viewing the venue location.

**Validates: Requirements 21.13**

### Property 85: Pin Drag Updates Coordinates

*For any* venue form with a map pin, when the pin is dragged to a new position on the map, the latitude and longitude input fields should be updated with the new coordinates.

**Validates: Requirements 21.14, 21.15**

### Property 86: Coordinate Input Updates Pin

*For any* venue form with a map pin, when the latitude or longitude input fields are manually edited with valid coordinates, the pin position on the map should be updated to reflect the new coordinates.

**Validates: Requirements 21.16**

### Property 87: Two-Way Coordinate Synchronization

*For any* venue form, changes to either the coordinate input fields or the map pin position should immediately synchronize with the other, maintaining consistency at all times.

**Validates: Requirements 21.17**

### Property 88: Zoom Level Preservation

*For any* venue form where the user has manually adjusted the map zoom level, subsequent coordinate updates (via input fields or pin drag) should preserve the user's zoom level and only adjust the map center point.

**Validates: Requirements 21.18**

### Property 89: Hyperlinked Primary Column Navigation

*For any* entity list table, clicking the hyperlinked primary column value should navigate to the detail view for that entity.

**Validates: Requirements 22.1, 22.2**

### Property 90: View Button Exclusion with Hyperlinked Primary Column

*For any* table with a hyperlinked primary column, the Actions column should NOT include a separate "View" action button.

**Validates: Requirements 22.3**

### Property 91: Hyperlinked Primary Column Consistency

*For any* table in the application (list views or detail page tables), the primary column should use the CloudScape Link component with consistent styling.

**Validates: Requirements 22.5, 22.6**

### Property 92: Edit Button on Detail Pages

*For any* entity detail page (participants, activities, venues, geographic areas), when the user has EDITOR or ADMINISTRATOR role, an edit button should be displayed in the header section as the right-most action using CloudScape Button with variant="primary".

**Validates: Requirements 23.1, 23.2, 23.3, 23.5, 23.6**

### Property 93: Edit Button Opens Edit Form

*For any* entity detail page with an edit button, clicking the edit button should open the edit form for the current entity.

**Validates: Requirements 23.4**

### Property 93a: Delete Button on Detail Pages

*For any* entity detail page (participants, activities, venues, geographic areas), when the user has EDITOR or ADMINISTRATOR role, a delete button should be displayed in the header section next to the edit button.

**Validates: Requirements 23A.1, 23A.2, 23A.3, 23A.8, 23A.9**

### Property 93b: Delete Confirmation Dialog

*For any* delete button click on an entity detail page, a confirmation dialog should be displayed before proceeding with the deletion.

**Validates: Requirements 23A.4**

### Property 93c: Delete Success Navigation

*For any* successful entity deletion from a detail page, the application should navigate back to the corresponding entity list page.

**Validates: Requirements 23A.5, 23A.6**

### Property 93d: Delete Error Handling

*For any* failed entity deletion from a detail page, an error message should be displayed explaining why the deletion failed.

**Validates: Requirements 23A.7, 23A.10**

### Property 94: Global Filter URL Synchronization

*For any* geographic area selected in the global filter, the URL query parameter should be updated to reflect the selected area ID, and navigating to a URL with a geographic area query parameter should apply that filter automatically.

**Validates: Requirements 24.6, 24.7**

### Property 95: Global Filter Persistence

*For any* geographic area selected in the global filter, the selection should be persisted to localStorage so it can be restored in future sessions.

**Validates: Requirements 24.8**

### Property 96: Global Filter Restoration

*For any* user returning to the application, the last-selected geographic area filter should be restored from localStorage and applied automatically.

**Validates: Requirements 24.9**

### Property 97: Recursive Geographic Filtering

*For any* geographic area selected in the global filter, all filtered results should include records associated with the selected area and all its descendant areas (recursive aggregation).

**Validates: Requirements 24.4, 24.5**

### Property 98: Global Filter Application to All Lists

*For any* list view (activities, participants, venues, geographic areas), when the global geographic area filter is active, only records associated with venues in the filtered geographic area or its descendants should be displayed.

**Validates: Requirements 24.5**

### Property 99: Global Filter Clear Functionality

*For any* active global geographic area filter, the user should be able to clear the filter and return to the "Global" (all areas) view with a single action.

**Validates: Requirements 24.11**

### Property 100: Async Dropdown Initial Load

*For any* high-cardinality entity dropdown (venue, participant, geographic area), when the dropdown is opened, the first page of results should be automatically loaded from the backend.

**Validates: Requirements 25.4**

### Property 101: Async Dropdown Text Filtering

*For any* high-cardinality entity dropdown with user text input, the dropdown should asynchronously fetch and display filtered results from the backend based on the input text.

**Validates: Requirements 25.5**

### Property 102: Dropdown Input Debouncing

*For any* text input in a high-cardinality dropdown, API requests should be debounced with a minimum 300ms delay to prevent excessive requests.

**Validates: Requirements 25.6**

### Property 103: Dropdown Loading Indicator

*For any* high-cardinality dropdown while fetching results, a loading indicator should be displayed to provide visual feedback.

**Validates: Requirements 25.7**

### Property 104: Dropdown Combined Filtering

*For any* high-cardinality dropdown with both text search and geographic area filter active, both filters should be applied using AND logic.

**Validates: Requirements 25.7 (implied from backend requirement 21.7)**

### Property 105: Global Filter Dropdown Hierarchical Display

*For any* geographic area displayed in the global filter dropdown, the option should show the area type and the full ancestor hierarchy path formatted with closest ancestor on the left and most distant ancestor on the right, separated by " > ".

**Validates: Requirements 24.12, 24.13, 24.14, 24.15**

### Property 106: Global Filter Dropdown Scoped Options

*For any* active global geographic area filter, the filter selector dropdown should display only the descendants (recursively) of the currently filtered area, and when the filter is "Global", all geographic areas should be displayed.

**Validates: Requirements 24.16, 24.17**

### Optional Field Clearing Properties

**Property 107: Optional field clearing in participant form**
*For any* participant form with populated optional fields (email, phone, notes, dateOfBirth, dateOfRegistration, nickname), clicking the clear button should set the field to null and send null to the API on save, resulting in the field being empty in subsequent views.
**Validates: Requirements 26.1, 26.5, 26.6, 26.7, 26.8**

**Property 108: Optional field clearing in venue form**
*For any* venue form with populated optional fields (latitude, longitude, venueType), clicking the clear button should set the field to null and send null to the API on save, resulting in the field being empty in subsequent views.
**Validates: Requirements 26.2, 26.5, 26.6, 26.7, 26.8**

**Property 109: End date clearing in activity form**
*For any* activity form with a populated endDate, clicking the clear button should set endDate to null and send null to the API on save, converting the activity to ongoing.
**Validates: Requirements 26.3, 26.5, 26.6, 26.7, 26.8**

**Property 110: Notes clearing in assignment form**
*For any* assignment form with populated notes, clicking the clear button should set notes to null and send null to the API on save, resulting in the notes being empty in subsequent views.
**Validates: Requirements 26.4, 26.5, 26.6, 26.7, 26.8**

**Property 111: Clear button visibility**
*For any* optional field with a value, a clear button (X icon) should be visible next to the field, and when the field is empty, the clear button should be hidden.
**Validates: Requirements 26.7, 26.8**

**Property 112: Field clearing vs omission distinction**
*For any* form update, fields that are not modified should be omitted from the API request (preserving existing values), while fields that are explicitly cleared should send null to the API (clearing the values).
**Validates: Requirements 26.9**

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
**Validates: Requirements 26.22, 26.23**

**Property 143: CSV import button visibility**
*For any* user with READ_ONLY role, the Import CSV button should be hidden; for users with EDITOR or ADMINISTRATOR role, it should be visible.
**Validates: Requirements 26.22, 26.23**

**Property 144: CSV export trigger**
*For any* Export CSV button click, the application should call the appropriate backend export endpoint and trigger a browser download.
**Validates: Requirements 26.1, 26.2, 26.3, 26.4, 26.5, 26.6**

**Property 145: Empty CSV download**
*For any* export operation with no records, the application should download a CSV file with only the header row.
**Validates: Requirements 26.7**

**Property 146: CSV import file selection**
*For any* Import CSV button click, the application should open a file selection dialog.
**Validates: Requirements 26.8, 26.9, 26.10, 26.11, 26.12**

**Property 147: CSV import success handling**
*For any* successful CSV import, the application should display a success message with counts and refresh the entity list.
**Validates: Requirements 26.14, 26.18**

**Property 148: CSV import error handling**
*For any* failed CSV import, the application should display detailed error messages for failed rows.
**Validates: Requirements 26.15**

**Property 149: CSV file validation**
*For any* non-CSV file selected for import, the application should display an error message and prevent upload.
**Validates: Requirements 26.19, 26.20**

**Property 150: CSV operation loading states**
*For any* import or export operation in progress, the application should display a loading indicator and disable the corresponding button.
**Validates: Requirements 26.16, 26.17**

**Property 151: CSV export geographic filtering**
*For any* export operation with the global geographic area filter active, the application should include the filter in the export request and indicate in the success message that only filtered records were exported.
**Validates: Requirements 26.24, 26.25**

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
