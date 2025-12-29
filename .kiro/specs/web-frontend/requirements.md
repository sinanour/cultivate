# Requirements Document: Web Frontend Package

## Introduction

The Web Frontend package provides a responsive React-based web application that enables community organizers to manage activities, participants, and view analytics from desktop and tablet browsers. The application supports offline operation and uses the CloudScape Design System for all UI components.

## Glossary

- **Web_App**: The React-based web application
- **CloudScape**: AWS CloudScape Design System - UI component library
- **PWA**: Progressive Web App - web app with native-like capabilities
- **IndexedDB**: Browser database for offline storage
- **Service_Worker**: Background script for offline support
- **Sync_Queue**: Local queue of pending offline operations
- **Venue**: A physical location where activities occur
- **Geographic_Area**: A hierarchical geographic region
- **Map_View**: An interactive map visualization showing venues and activities by geography
- **Nominatim**: OpenStreetMap's geocoding API service for converting addresses to geographic coordinates
- **Geocoding**: The process of converting a physical address into latitude and longitude coordinates
- **Global_Filter**: A persistent filter applied across all views in the application
- **Recursive_Filter**: A filter that includes the selected entity and all its descendants in a hierarchy

## Requirements

### Requirement 1: Responsive Web Interface

**User Story:** As a community organizer, I want a responsive web interface, so that I can use the application on desktop and tablet devices.

#### Acceptance Criteria

1. THE Web_App SHALL be built with React 18+ and TypeScript
2. THE Web_App SHALL use Vite for build tooling and development server
3. THE Web_App SHALL use CloudScape Design System components exclusively for all UI elements
4. THE Web_App SHALL be responsive and work on screen sizes from 768px to 1920px width
5. THE Web_App SHALL follow CloudScape design patterns and guidelines
6. THE Web_App SHALL provide a consistent look and feel across all pages

### Requirement 2: Activity Type Management UI

**User Story:** As a community organizer, I want to manage activity types in the web interface, so that I can categorize activities.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all activity types with predefined and custom types distinguished
2. THE Web_App SHALL provide a form to create new activity types
3. THE Web_App SHALL provide a form to edit existing activity types
4. THE Web_App SHALL provide a delete button for activity types
5. WHEN deleting an activity type, THE Web_App SHALL prevent deletion if activities reference it
6. WHEN deleting an activity type, THE Web_App SHALL display an error message explaining why deletion failed
7. THE Web_App SHALL validate that activity type names are not empty

### Requirement 3: Participant Role Management UI

**User Story:** As a community organizer, I want to manage participant roles in the web interface, so that I can define functions people perform.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all participant roles with predefined and custom roles distinguished
2. THE Web_App SHALL provide a form to create new roles
3. THE Web_App SHALL provide a form to edit existing roles
4. THE Web_App SHALL provide a delete button for roles
5. WHEN deleting a role, THE Web_App SHALL prevent deletion if assignments reference it
6. WHEN deleting a role, THE Web_App SHALL display an error message explaining why deletion failed
7. THE Web_App SHALL validate that role names are not empty

### Requirement 4: Participant Management UI

**User Story:** As a community organizer, I want to manage participants in the web interface, so that I can track individuals in my community.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all participants with name and email
2. THE Web_App SHALL provide search functionality to find participants by name or email
3. THE Web_App SHALL provide sorting and filtering for the participant list
4. THE Web_App SHALL provide a form to create new participants
5. THE Web_App SHALL provide a form to edit existing participants
6. THE Web_App SHALL provide a delete button for participants
7. THE Web_App SHALL validate that participant name and email are provided
8. THE Web_App SHALL validate email format
9. THE Web_App SHALL allow optional phone and notes fields
10. THE Web_App SHALL display a detail view showing participant information and their activities
11. THE Web_App SHALL display a table of the participant's home address history in reverse chronological order
12. THE Web_App SHALL provide an interface to add new address history records with venue and effective start date
13. THE Web_App SHALL provide an interface to edit existing address history records
14. THE Web_App SHALL provide an interface to delete address history records
15. THE Web_App SHALL validate that address history records have a venue and effective start date
16. THE Web_App SHALL prevent duplicate address history records with the same effective start date for the same participant
17. WHEN creating a new participant, THE Web_App SHALL allow adding home address history records within the participant creation modal form
18. WHEN editing an existing participant, THE Web_App SHALL allow adding, editing, and deleting home address history records within the participant edit modal form

### Requirement 5: Activity Management UI

**User Story:** As a community organizer, I want to manage activities in the web interface, so that I can track community events.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all activities with type, dates, and status
2. THE Web_App SHALL provide filtering by activity type and status
3. THE Web_App SHALL provide sorting for the activity list
4. THE Web_App SHALL distinguish finite and ongoing activities visually
5. THE Web_App SHALL provide a form to create new activities
6. THE Web_App SHALL provide a form to edit existing activities
7. THE Web_App SHALL provide a delete button for activities
8. WHEN creating a finite activity, THE Web_App SHALL require an end date
9. WHEN creating an ongoing activity, THE Web_App SHALL allow null end date
10. THE Web_App SHALL validate that activity name, type, and start date are provided
11. THE Web_App SHALL support activity statuses: PLANNED, ACTIVE, COMPLETED, CANCELLED
12. THE Web_App SHALL provide a button to update activity status
13. THE Web_App SHALL display a detail view showing activity information and assigned participants
14. THE Web_App SHALL allow selection of one or more venues for each activity
15. THE Web_App SHALL display the activity's venue history in reverse chronological order when venues have changed over time
16. WHEN creating a new activity, THE Web_App SHALL allow adding venue associations with effective start dates within the activity creation modal form
17. WHEN editing an existing activity, THE Web_App SHALL allow adding, editing, and deleting venue associations within the activity edit modal form

### Requirement 6: Activity-Participant Assignment UI

**User Story:** As a community organizer, I want to assign participants to activities in the web interface, so that I can track who is involved.

#### Acceptance Criteria

1. THE Web_App SHALL provide an interface to assign participants to activities
2. WHEN assigning a participant, THE Web_App SHALL require role selection
3. THE Web_App SHALL display all assigned participants with their roles on the activity detail view
4. THE Web_App SHALL provide a button to remove participant assignments
5. THE Web_App SHALL validate that a role is selected before allowing assignment
6. THE Web_App SHALL prevent duplicate assignments of the same participant with the same role

### Requirement 6A: Venue Management UI

**User Story:** As a community organizer, I want to manage venues in the web interface, so that I can track physical locations where activities occur.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all venues with name, address, and geographic area
2. THE Web_App SHALL provide search functionality to find venues by name or address
3. THE Web_App SHALL provide sorting and filtering for the venue list
4. THE Web_App SHALL provide a form to create new venues
5. THE Web_App SHALL provide a form to edit existing venues
6. THE Web_App SHALL provide a delete button for venues
7. THE Web_App SHALL validate that venue name, address, and geographic area are provided
8. THE Web_App SHALL allow optional fields for latitude, longitude, and venue type
9. THE Web_App SHALL display a detail view showing venue information, associated activities, and participants using it as home address
10. WHEN deleting a venue, THE Web_App SHALL prevent deletion if activities or participants reference it
11. WHEN deleting a venue, THE Web_App SHALL display an error message explaining which entities reference it

### Requirement 6B: Geographic Area Management UI

**User Story:** As a community organizer, I want to manage geographic areas in the web interface, so that I can organize venues hierarchically.

#### Acceptance Criteria

1. THE Web_App SHALL display a hierarchical tree view of all geographic areas
2. THE Web_App SHALL provide a form to create new geographic areas
3. THE Web_App SHALL provide a form to edit existing geographic areas
4. THE Web_App SHALL provide a delete button for geographic areas
5. THE Web_App SHALL validate that geographic area name and type are provided
6. THE Web_App SHALL allow selection of a parent geographic area
7. THE Web_App SHALL prevent circular parent-child relationships
8. THE Web_App SHALL display a detail view showing geographic area information, child areas, and associated venues from the area and all descendant areas (recursive aggregation)
9. WHEN deleting a geographic area, THE Web_App SHALL prevent deletion if venues or child areas reference it
10. WHEN deleting a geographic area, THE Web_App SHALL display an error message explaining which entities reference it
11. THE Web_App SHALL display the full hierarchy path for each geographic area

### Requirement 6C: Map View UI

**User Story:** As a community organizer, I want to view activities on a map, so that I can visualize community engagement by geography.

#### Acceptance Criteria

1. THE Web_App SHALL provide an interactive map view using a mapping library (e.g., Leaflet, Mapbox)
2. THE Web_App SHALL display venue markers on the map for all venues with latitude and longitude
3. THE Web_App SHALL display activity information when a venue marker is clicked
4. THE Web_App SHALL color-code venue markers by activity type or status
5. THE Web_App SHALL provide filtering controls to show/hide activities by type, status, or date range
6. THE Web_App SHALL provide geographic area boundary overlays when available
7. THE Web_App SHALL allow zooming and panning of the map
8. THE Web_App SHALL display a legend explaining marker colors and symbols
9. THE Web_App SHALL provide a button to center the map on a specific venue or geographic area
10. THE Web_App SHALL display participant home addresses as markers when appropriate privacy settings allow

### Requirement 7: Analytics Dashboard

**User Story:** As a community organizer, I want to view comprehensive analytics with flexible grouping and filtering in the web interface, so that I can understand participation patterns, activity trends, and engagement changes over time across different segments of my community.

#### Acceptance Criteria

1. THE Web_App SHALL provide an engagement metrics dashboard
2. THE Web_App SHALL display activities at the start of the selected date range
3. THE Web_App SHALL display activities at the end of the selected date range
4. THE Web_App SHALL display activities started within the selected date range
5. THE Web_App SHALL display activities completed within the selected date range
6. THE Web_App SHALL display activities cancelled within the selected date range
7. THE Web_App SHALL display participants at the start of the selected date range
8. THE Web_App SHALL display participants at the end of the selected date range
9. THE Web_App SHALL display all activity counts in aggregate across all activity types
10. THE Web_App SHALL display all activity counts broken down by activity type
11. THE Web_App SHALL display all participant counts in aggregate across all activity types
12. THE Web_App SHALL display all participant counts broken down by activity type
13. THE Web_App SHALL provide controls to group metrics by one or more dimensions: activity type, venue, geographic area, and date (with weekly, monthly, quarterly, or yearly granularity)
14. THE Web_App SHALL provide filter controls for activity type (point filter)
15. THE Web_App SHALL provide filter controls for venue (point filter)
16. THE Web_App SHALL provide filter controls for geographic area (point filter, includes descendants)
17. THE Web_App SHALL provide filter controls for date range (range filter with start and end dates)
18. THE Web_App SHALL render an "Engagement Summary" table that displays aggregate metrics and dimensional breakdowns
19. THE Web_App SHALL render the first row of the Engagement Summary table with the label "Total" in the first column and aggregate metrics (activities at start, at end, started, completed, cancelled, participants at start, at end) in subsequent columns
20. WHEN multiple grouping dimensions are selected, THE Web_App SHALL leave subsequent dimension cells blank in the first row (Total row)
21. WHEN grouping dimensions are selected, THE Web_App SHALL render additional rows below the Total row showing dimensional breakdowns where breakdown dimension columns appear first followed by metric aggregation columns
22. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render activity type names as hyperlinks to their respective edit forms or detail views
23. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render venue names as hyperlinks to their respective detail views at /venues/:id
24. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render geographic area names as hyperlinks to their respective detail views at /geographic-areas/:id
25. THE Web_App SHALL display each metric aggregation (activities at start, activities at end, activities started, activities completed, activities cancelled, participants at start, participants at end) in its own column in the Engagement Summary table
26. WHEN multiple filters are applied, THE Web_App SHALL apply all filters using AND logic
27. WHEN no date range is specified, THE Web_App SHALL display all-time metrics
28. THE Web_App SHALL display role distribution across all activities within the filtered and grouped results
29. THE Web_App SHALL synchronize all filter parameters (activity type, venue, geographic area, start date, end date) with URL query parameters
30. THE Web_App SHALL synchronize all grouping parameters (group by dimensions and date granularity) with URL query parameters
31. WHEN a user navigates to a URL with analytics filter or grouping query parameters, THE Web_App SHALL apply those parameters automatically to the dashboard
32. WHEN a user changes any filter or grouping parameter, THE Web_App SHALL update the browser URL to reflect the current state
33. THE Web_App SHALL enable browser back/forward navigation to move between different filter and grouping configurations
34. THE Web_App SHALL allow users to share the current analytics view URL with other users to display the same filtered and grouped results
35. THE Web_App SHALL provide a growth analytics dashboard
36. THE Web_App SHALL display time-series charts for new activities
37. THE Web_App SHALL provide time period selection (day, week, month, year)
38. THE Web_App SHALL display percentage changes between periods for activities
39. THE Web_App SHALL display cumulative participant counts over time
40. THE Web_App SHALL provide a geographic area filter for all analytics
41. THE Web_App SHALL display a geographic breakdown chart showing engagement by geographic area
42. THE Web_App SHALL allow drilling down into child geographic areas from the geographic breakdown chart

### Requirement 8: Authentication UI

**User Story:** As a user, I want to log in to the web interface, so that I can access my community data.

#### Acceptance Criteria

1. THE Web_App SHALL provide a login page with email and password fields
2. THE Web_App SHALL validate that email and password are provided
3. THE Web_App SHALL display error messages for invalid credentials
4. THE Web_App SHALL redirect to the main application after successful login
5. THE Web_App SHALL store authentication tokens securely
6. THE Web_App SHALL provide a logout button
7. THE Web_App SHALL redirect to login when tokens expire

### Requirement 9: Authorization UI

**User Story:** As a user, I want appropriate access based on my role, so that I can only perform actions I'm permitted to do.

#### Acceptance Criteria

1. THE Web_App SHALL protect all routes requiring authentication
2. THE Web_App SHALL redirect unauthenticated users to login
3. WHEN a user has ADMINISTRATOR role, THE Web_App SHALL show all features including user management
4. WHEN a user has EDITOR role, THE Web_App SHALL show create, update, and delete features
5. WHEN a user has READ_ONLY role, THE Web_App SHALL hide create, update, and delete features
6. THE Web_App SHALL display appropriate error messages for unauthorized actions

### Requirement 10: Offline Operation

**User Story:** As a community organizer, I want to use the web app offline, so that I can work without internet connectivity.

#### Acceptance Criteria

1. THE Web_App SHALL function with locally cached data when offline
2. THE Web_App SHALL cache all user data to IndexedDB on initial load
3. WHEN offline, THE Web_App SHALL store create, update, and delete operations in a local queue
4. WHEN connectivity is restored, THE Web_App SHALL automatically synchronize queued operations
5. THE Web_App SHALL display current connection status (online/offline)
6. WHEN offline, THE Web_App SHALL indicate which features require connectivity
7. WHEN offline, THE Web_App SHALL disable features that require connectivity

### Requirement 11: Offline Synchronization

**User Story:** As a community organizer, I want my offline changes synchronized automatically, so that my work is saved when I regain connectivity.

#### Acceptance Criteria

1. THE Web_App SHALL detect when connectivity is restored
2. WHEN connectivity is restored, THE Web_App SHALL send all queued operations to the backend
3. WHEN synchronization succeeds, THE Web_App SHALL clear the local queue
4. WHEN synchronization fails, THE Web_App SHALL retry with exponential backoff
5. WHEN conflicts occur, THE Web_App SHALL notify the user
6. THE Web_App SHALL display pending operation count
7. THE Web_App SHALL provide a manual sync button

### Requirement 12: Progressive Web App

**User Story:** As a community organizer, I want PWA capabilities, so that the web app feels like a native application.

#### Acceptance Criteria

1. THE Web_App SHALL be installable as a PWA
2. THE Web_App SHALL provide a web app manifest with icons and colors
3. THE Web_App SHALL use a service worker for offline support
4. THE Web_App SHALL cache static assets for offline access
5. THE Web_App SHALL provide a splash screen during loading

### Requirement 13: Navigation and Layout

**User Story:** As a user, I want intuitive navigation, so that I can easily access different sections of the application.

#### Acceptance Criteria

1. THE Web_App SHALL provide a navigation menu with links to all main sections
2. THE Web_App SHALL highlight the current section in the navigation menu
3. THE Web_App SHALL preserve navigation state when moving between sections
4. THE Web_App SHALL provide a user menu with logout option
5. THE Web_App SHALL display the current user's name and role

### Requirement 14: Form Validation

**User Story:** As a user, I want clear form validation, so that I know when I've entered invalid data.

#### Acceptance Criteria

1. THE Web_App SHALL validate all form inputs before submission
2. THE Web_App SHALL display inline error messages for invalid fields
3. THE Web_App SHALL highlight invalid fields visually
4. THE Web_App SHALL prevent form submission when validation fails
5. THE Web_App SHALL preserve valid field values when validation fails

### Requirement 15: Error Handling

**User Story:** As a user, I want clear error messages, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. THE Web_App SHALL display user-friendly error messages for all errors
2. THE Web_App SHALL use toast notifications for transient errors
3. THE Web_App SHALL use modal dialogs for critical errors
4. THE Web_App SHALL provide actionable guidance in error messages
5. THE Web_App SHALL maintain application state when errors occur
6. THE Web_App SHALL log detailed errors to console for debugging

### Requirement 16: Loading States

**User Story:** As a user, I want visual feedback during operations, so that I know the application is working.

#### Acceptance Criteria

1. THE Web_App SHALL display loading indicators during API requests
2. THE Web_App SHALL disable form submit buttons during submission
3. THE Web_App SHALL display skeleton screens while loading lists
4. THE Web_App SHALL provide progress indicators for long operations
5. THE Web_App SHALL display success messages after successful operations

### Requirement 17: User Management (Admin Only)

**User Story:** As an administrator, I want to manage users in the web interface, so that I can control system access.

#### Acceptance Criteria

1. THE Web_App SHALL provide a user management section for administrators only
2. THE Web_App SHALL display a list of all users
3. THE Web_App SHALL provide a form to create new users
4. THE Web_App SHALL provide a form to edit existing users
5. THE Web_App SHALL allow administrators to assign and modify user roles
6. THE Web_App SHALL hide user management from non-administrators

### Requirement 18: Optimistic Locking and Conflict Resolution

**User Story:** As a user, I want to be notified when my changes conflict with another user's changes, so that I can resolve conflicts appropriately.

#### Acceptance Criteria

1. THE Web_App SHALL include version numbers when updating entities
2. WHEN a version conflict occurs (409 error), THE Web_App SHALL display a conflict notification
3. THE Web_App SHALL provide options to retry with latest version or discard changes
4. THE Web_App SHALL refetch the latest entity data when a conflict is detected
5. THE Web_App SHALL log version conflict details for debugging

### Requirement 19: Rate Limiting Handling

**User Story:** As a user, I want to be informed when I've exceeded rate limits, so that I know when I can retry my actions.

#### Acceptance Criteria

1. WHEN a rate limit is exceeded (429 error), THE Web_App SHALL display a rate limit message
2. THE Web_App SHALL show the retry-after time from response headers
3. THE Web_App SHALL automatically retry after the cooldown period
4. THE Web_App SHALL log rate limit details for debugging
5. THE Web_App SHALL display remaining request counts from rate limit headers when available

### Requirement 20: Date Formatting Consistency

**User Story:** As a user, I want all dates displayed consistently throughout the application, so that I can easily read and compare dates.

#### Acceptance Criteria

1. THE Web_App SHALL render all dates in ISO-8601 format (YYYY-MM-DD)
2. THE Web_App SHALL apply consistent date formatting to activity start dates and end dates
3. THE Web_App SHALL apply consistent date formatting to address history effective dates
4. THE Web_App SHALL apply consistent date formatting to venue history effective dates
5. THE Web_App SHALL apply consistent date formatting to all date fields in tables and detail views
6. THE Web_App SHALL apply consistent date formatting to all date fields in forms and date pickers
7. THE Web_App SHALL apply consistent date formatting to analytics dashboard date ranges

### Requirement 21: Venue Geocoding Integration

**User Story:** As a community organizer, I want to automatically populate venue coordinates from addresses, so that I can quickly add venues to the map without manually looking up coordinates.

#### Acceptance Criteria

1. THE Web_App SHALL integrate with the Nominatim geocoding API for address-to-coordinate conversion
2. WHEN creating or editing a venue, THE Web_App SHALL provide a button to geocode the current address
3. WHEN the geocode button is clicked, THE Web_App SHALL send the venue address to the Nominatim API
4. WHEN the Nominatim API returns coordinates, THE Web_App SHALL populate the latitude and longitude fields
5. WHEN the Nominatim API returns multiple results, THE Web_App SHALL display a selection dialog for the user to choose the correct location
6. WHEN the Nominatim API returns no results, THE Web_App SHALL display an error message indicating the address could not be geocoded
7. THE Web_App SHALL display a loading indicator while the geocoding request is in progress
8. THE Web_App SHALL allow users to manually override geocoded coordinates
9. THE Web_App SHALL respect Nominatim usage policy by including appropriate User-Agent header and rate limiting
10. WHEN offline, THE Web_App SHALL disable the geocode button and display a message that geocoding requires connectivity
11. WHEN creating or editing a venue, THE Web_App SHALL display an interactive map view component positioned to the right of the form
12. WHEN latitude and longitude coordinates are populated, THE Web_App SHALL render a pin on the map at those coordinates
13. WHEN coordinates are populated, THE Web_App SHALL set the map zoom level to a reasonable level for viewing the venue location
14. THE Web_App SHALL provide a graphical interface on the map to drag and reposition the pin
15. WHEN the pin is repositioned on the map, THE Web_App SHALL update the latitude and longitude input fields with the new coordinates
16. WHEN the latitude or longitude input fields are manually edited, THE Web_App SHALL update the pin position on the map
17. THE Web_App SHALL maintain two-way synchronization between the coordinate input fields and the map pin position at all times
18. WHEN the user manually adjusts the map zoom level, THE Web_App SHALL preserve that zoom level during subsequent coordinate updates and only adjust the map center point

### Requirement 22: Hyperlinked Primary Columns in Tables

**User Story:** As a user, I want to click on entity names in tables to view their details, so that I can navigate quickly without needing separate action buttons.

#### Acceptance Criteria

1. THE Web_App SHALL render the primary column value as a hyperlink in all entity list tables (activities, participants, venues, geographic areas, activity types, participant roles, users)
2. WHEN a user clicks on a hyperlinked primary column value, THE Web_App SHALL navigate to the detail view for that entity
3. THE Web_App SHALL NOT include a separate "View" action button in the Actions column when the primary column is hyperlinked
4. THE Web_App SHALL apply hyperlinked primary column treatment to tables on detail pages showing associated records (address history venues, venue history venues, activity participants, venue activities, venue participants)
5. THE Web_App SHALL use CloudScape Link component for all hyperlinked primary column values
6. THE Web_App SHALL maintain consistent link styling across all tables using CloudScape design patterns
7. THE Web_App SHALL preserve Edit and Delete action buttons in the Actions column where appropriate based on user permissions

### Requirement 23: Edit Action Buttons on Detail Pages

**User Story:** As a user, I want to quickly edit records from their detail pages, so that I can make changes without navigating back to the list view.

#### Acceptance Criteria

1. THE Web_App SHALL display an edit action button in the header section of all entity detail pages (participants, activities, venues, geographic areas)
2. THE Web_App SHALL position the edit button as the right-most action in the header when multiple actions are present
3. THE Web_App SHALL use CloudScape Button component with variant="primary" for all detail page edit buttons
4. WHEN a user clicks the edit button, THE Web_App SHALL open the edit form for the current entity
5. THE Web_App SHALL hide the edit button when the user has READ_ONLY role
6. THE Web_App SHALL display the edit button when the user has EDITOR or ADMINISTRATOR role

### Requirement 24: Global Persistent Geographic Area Filter

**User Story:** As a community organizer, I want to set a global geographic area filter that applies to all views, so that I can focus on a specific region without repeatedly filtering each list.

#### Acceptance Criteria

1. THE Web_App SHALL display a geographic area filter selector in the application header component
2. THE Web_App SHALL position the geographic area filter in the header so it is accessible from all views
3. THE Web_App SHALL default the geographic area filter to an empty state displayed as "Global" (no filter applied)
4. WHEN a geographic area is selected in the global filter, THE Web_App SHALL apply the filter recursively to include the selected area and all descendant areas
5. WHEN the global geographic area filter is active, THE Web_App SHALL filter all list views (activities, participants, venues, geographic areas) to show only records associated with venues in the filtered geographic area or its descendants
6. THE Web_App SHALL reflect the selected geographic area filter as a URL query parameter (e.g., ?geographicArea=<id>)
7. WHEN a user navigates to a URL with a geographic area query parameter, THE Web_App SHALL apply that filter automatically
8. THE Web_App SHALL persist the last-selected geographic area filter to localStorage
9. WHEN a user returns to the application, THE Web_App SHALL restore the last-selected geographic area filter from localStorage
10. THE Web_App SHALL provide a visual indicator in the header showing the currently active geographic area filter
11. THE Web_App SHALL provide a way to clear the global filter and return to "Global" (all areas) view

### Requirement 25: High-Cardinality Dropdown Filtering

**User Story:** As a community organizer working with large datasets, I want dropdown lists for venues, participants, and geographic areas to support text-based filtering, so that I can efficiently find and select items even when there are millions of records.

#### Acceptance Criteria

1. THE Web_App SHALL support text-based input filtering for all venue selection dropdowns
2. THE Web_App SHALL support text-based input filtering for all participant selection dropdowns
3. THE Web_App SHALL support text-based input filtering for all geographic area selection dropdowns
4. WHEN a dropdown is opened, THE Web_App SHALL automatically load the first page of results from the backend
5. WHEN a user types text into a dropdown filter field, THE Web_App SHALL asynchronously load filtered results from the backend based on the input text
6. THE Web_App SHALL debounce text input to avoid excessive API requests (minimum 300ms delay)
7. THE Web_App SHALL display a loading indicator while fetching filtered results
8. THE Web_App SHALL support pagination for dropdown results when the filtered set exceeds the page size
9. THE Web_App SHALL use CloudScape Select or Autosuggest components with async loading capabilities
10. WHEN the global geographic area filter is active and sufficiently scoped, THE Web_App SHALL display all matching items in dropdowns for convenience
11. WHEN viewing data at a large geographic scale (country or global), THE Web_App SHALL rely on text-based filtering to manage the large result sets efficiently
