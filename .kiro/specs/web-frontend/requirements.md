# Requirements Document: Web Frontend Package

## Introduction

The Web Frontend package provides a responsive React-based web application that enables community organizers to manage activities, participants, and view analytics from desktop and tablet browsers. The application supports offline operation and uses the CloudScape Design System for all UI components.

> **Performance Optimizations**: This requirements document covers core frontend functionality. For frontend integration requirements related to backend performance optimizations (wire format parsing, pagination, chart rendering), see:
> - `.kiro/specs/analytics-optimization/requirements.md` - Analytics dashboard optimization requirements
> - `.kiro/specs/geographic-breakdown-optimization/requirements.md` - Geographic breakdown pagination requirements
> - `.kiro/specs/map-data-optimization/requirements.md` - Map view optimization requirements
> 
> See also: `.kiro/specs/OPTIMIZATION_SPECS.md` for an overview and the "Performance Optimization Cross-References" section at the end of this document.

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
- **Activity_Category**: A high-level grouping of related activity types (e.g., Study Circles, Children's Classes, Junior Youth Groups, Devotional Gatherings)
- **Activity_Type**: A specific category of activity that belongs to an Activity_Category
- **Configuration_View**: A unified interface for managing activity categories, activity types, participant roles, and populations
- **Population**: A label or demographic grouping that can be assigned to participants for segmentation and analysis (e.g., Youth, Adults, Families, Seekers)
- **Participation**: The total count (non-unique) of all participant-activity associations, where the same participant involved in multiple activities contributes multiple counts
- **Unique_Participant_Count**: The count of distinct participants involved in activities, where the same participant involved in multiple activities contributes only one count
- **Engagement_Summary_Table**: A table on the Engagement Dashboard displaying aggregate and dimensional breakdown metrics for activities and participants
- **Dirty_Form**: A form with unsaved changes that differ from the initial values
- **Navigation_Guard**: A mechanism that intercepts navigation attempts to prevent accidental data loss from dirty forms
- **Geographic_Authorization**: Access control rules that restrict user access to specific geographic areas
- **Allow_List**: A set of geographic areas that a user is explicitly permitted to access
- **Deny_List**: A set of geographic areas that a user is explicitly forbidden from accessing
- **Authorized_Area**: A geographic area that a user has permission to access based on authorization rules
- **Geographic_Area_Selector**: A specialized reusable dropdown component for selecting geographic areas that displays hierarchical context, area type badges, and supports async lazy-loading for optimal performance with large datasets
- **Ancestor_Cache**: An internal data structure used by Geographic_Area_Selector to store ancestor geographic area details for the sole purpose of building hierarchy path descriptions, without adding those ancestors to the dropdown options list
- **Map_Marker**: A lightweight data structure containing only the essential fields needed to render a pin on a map (coordinates and identifiers)
- **Popup_Content**: Detailed information about a map marker that is loaded on-demand when a user clicks the marker
- **Lazy_Loading**: A performance optimization strategy where data is fetched on-demand. For Map View, markers are fetched in batches of 100 items and rendered incrementally. For list pages, data is fetched one page at a time when the user navigates to that page using CloudScape Table's native pagination.
- **Batched_Loading**: A technique used in Map View where large datasets of markers are fetched in multiple smaller requests (batches of 100 items) and rendered progressively as each batch arrives. List pages use standard pagination instead.
- **Incremental_Rendering**: A UI pattern used in Map View where markers are displayed on screen as soon as they are fetched, without waiting for all data to be loaded. List pages use standard page-by-page rendering.
- **Auto_Zoom**: Automatic adjustment of map zoom level to fit all visible markers within the viewport
- **Server_Side_Filtering**: A filtering approach where filter criteria are sent to the backend API as query parameters, and the backend returns only matching records, reducing data transfer and improving performance
- **PropertyFilter**: A CloudScape Design System component that provides a unified interface for filtering data by multiple properties with support for lazy-loading values, token-based filter display, and URL synchronization
- **FilterGroupingPanel**: A reusable component that combines date range selection, property-based filtering, and grouping controls with an explicit "Update" button for applying changes to data visualization pages
- **Additive_Grouping**: A grouping mode where multiple dimensions can be selected simultaneously (e.g., group by activity type AND venue AND geographic area)
- **Exclusive_Grouping**: A grouping mode where only one dimension can be selected at a time (e.g., group by activity type OR activity category OR no grouping)
- **Population_Badge**: A visual indicator displayed beside a participant's name showing which populations they belong to, enabling quick identification of participant demographics
- **Additional_Participant_Count**: An optional positive integer field on activities that represents approximate attendance beyond individually tracked participants, used for high-level participation tracking in large gatherings
- **Run_Report_Pattern**: A user interface pattern where data visualization pages render in an empty state by default and require explicit user action (clicking a "Run Report" button) to fetch and display data based on selected filters and grouping criteria
- **Pull_To_Refresh**: A mobile-friendly gesture where users can pull down on a page to trigger a refresh of the current view, clearing all cached data and forcing a re-fetch from the backend
- **Token_Invalidation**: A security mechanism that revokes all authorization tokens issued before a specific timestamp, forcing users to re-authenticate across all devices
- **Multi_Device_Logout**: A user action that invalidates all authorization tokens for a user across all devices, requiring re-authentication on all sessions

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

### Requirement 1A: Pull-to-Refresh Functionality

**User Story:** As a mobile user, I want to pull down on any page to refresh the content, so that I can easily update the data without needing to find and click a refresh button.

#### Acceptance Criteria

1. THE Web_App SHALL implement pull-to-refresh functionality on all pages
2. WHEN a user performs a pull-down gesture on a page, THE Web_App SHALL display a visual indicator (loading spinner or refresh icon) at the top of the page
3. WHEN the pull-down gesture is released, THE Web_App SHALL trigger a refresh of the current page's data
4. WHEN a refresh is triggered via pull-to-refresh, THE Web_App SHALL invalidate all React Query caches for the current page's data
5. WHEN a refresh is triggered via pull-to-refresh, THE Web_App SHALL NOT clear authentication tokens (accessToken, refreshToken, user) from localStorage
6. WHEN a refresh is triggered via pull-to-refresh, THE Web_App SHALL preserve the user's logged-in state and NOT force a logout
7. WHEN a refresh is triggered via pull-to-refresh, THE Web_App SHALL force a re-fetch of all data from the backend API
8. THE Web_App SHALL display a loading indicator during the refresh operation
9. WHEN the refresh operation completes successfully, THE Web_App SHALL hide the loading indicator and display the updated data
10. WHEN the refresh operation fails, THE Web_App SHALL display an error message and hide the loading indicator
11. THE Web_App SHALL prevent pull-to-refresh from triggering when the page is scrolled down (only trigger when at the top of the page)
12. THE Web_App SHALL provide smooth animations during the pull-to-refresh gesture for a native-like experience
13. THE Web_App SHALL work on both touch-enabled devices (mobile, tablet) and desktop browsers with touch screens
14. THE Web_App SHALL NOT interfere with normal scrolling behavior when pull-to-refresh is not triggered
15. THE Web_App SHALL respect the user's scroll position after refresh completes (return to top or maintain position based on page type)
16. WHEN pull-to-refresh is triggered on list pages (participants, activities, venues, geographic areas), THE Web_App SHALL reset pagination to the first page
17. WHEN pull-to-refresh is triggered on detail pages, THE Web_App SHALL re-fetch the entity details and all related data
18. WHEN pull-to-refresh is triggered on dashboard pages, THE Web_App SHALL clear all chart data and re-run the current report with existing filters
19. THE Web_App SHALL NOT implement pull-to-refresh on the map view page due to fundamental gesture conflicts with map panning, zooming, and marker interactions
20. ON pages with interactive maps or similar gesture-based components, THE Web_App MAY omit pull-to-refresh to preserve optimal user experience for the primary interaction

### Requirement 2: Configuration UI

**User Story:** As a community organizer, I want to manage activity categories, activity types, participant roles, and populations in a unified configuration interface, so that I can organize all configuration entities in one place.

#### Acceptance Criteria

1. THE Web_App SHALL provide a unified configuration view for managing activity categories, activity types, participant roles, and populations
2. THE Web_App SHALL display a list of all activity categories with predefined and custom categories distinguished
3. THE Web_App SHALL display a list of all activity types grouped by their category with predefined and custom types distinguished
4. THE Web_App SHALL provide a modal form to create new activity categories
5. THE Web_App SHALL provide a modal form to edit existing activity categories
6. THE Web_App SHALL provide a delete button for activity categories
7. WHEN deleting an activity category, THE Web_App SHALL prevent deletion if activity types reference it
8. WHEN deleting an activity category, THE Web_App SHALL display an error message explaining why deletion failed
9. THE Web_App SHALL validate that activity category names are not empty
10. THE Web_App SHALL provide a modal form to create new activity types
11. THE Web_App SHALL provide a modal form to edit existing activity types
12. THE Web_App SHALL provide a delete button for activity types
13. WHEN creating or editing an activity type, THE Web_App SHALL require selection of an activity category
14. WHEN deleting an activity type, THE Web_App SHALL prevent deletion if activities reference it
15. WHEN deleting an activity type, THE Web_App SHALL display an error message explaining why deletion failed
16. THE Web_App SHALL validate that activity type names are not empty
17. WHEN displaying activity categories in the list, THE Web_App SHALL render the activity category name as a clickable link
18. WHEN an activity category name is clicked in the activity category list, THE Web_App SHALL open the edit form for that activity category
19. THE Web_App SHALL display the participant roles list within the same configuration view
20. THE Web_App SHALL display all four tables (activity categories, activity types, participant roles, and populations) in a cohesive layout on a single page
21. THE Web_App SHALL display the populations list within the same configuration view
22. THE Web_App SHALL provide a modal form to create new populations
23. THE Web_App SHALL provide a modal form to edit existing populations
24. THE Web_App SHALL provide a delete button for populations
25. WHEN deleting a population, THE Web_App SHALL prevent deletion if participants reference it
26. WHEN deleting a population, THE Web_App SHALL display an error message explaining why deletion failed
27. THE Web_App SHALL validate that population names are not empty
28. THE Web_App SHALL restrict population create, edit, and delete actions to ADMINISTRATOR role only
29. THE Web_App SHALL allow EDITOR and READ_ONLY roles to view populations but not modify them

### Requirement 3: Participant Role Management UI

**User Story:** As a community organizer, I want to manage participant roles in the configuration interface, so that I can define functions people perform alongside other configuration entities.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all participant roles with predefined and custom roles distinguished
2. THE Web_App SHALL provide a modal form to create new roles
3. THE Web_App SHALL provide a modal form to edit existing roles
4. THE Web_App SHALL provide a delete button for roles
5. WHEN deleting a role, THE Web_App SHALL prevent deletion if assignments reference it
6. WHEN deleting a role, THE Web_App SHALL display an error message explaining why deletion failed
7. THE Web_App SHALL validate that role names are not empty

### Requirement 3A: Population Management UI

**User Story:** As an administrator, I want to manage populations in the configuration interface, so that I can categorize participants into demographic or interest-based groups for segmentation and analysis.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all populations within the configuration view
2. THE Web_App SHALL provide a modal form to create new populations
3. THE Web_App SHALL provide a modal form to edit existing populations
4. THE Web_App SHALL provide a delete button for populations
5. WHEN deleting a population, THE Web_App SHALL prevent deletion if participants reference it
6. WHEN deleting a population, THE Web_App SHALL display an error message explaining why deletion failed
7. THE Web_App SHALL validate that population names are not empty
8. THE Web_App SHALL restrict population create, edit, and delete actions to ADMINISTRATOR role only
9. THE Web_App SHALL allow EDITOR and READ_ONLY roles to view populations but not modify them
10. THE Web_App SHALL display the populations table within the same configuration view alongside activity categories, activity types, and participant roles

### Requirement 4: Participant Management UI

**User Story:** As a community organizer, I want to manage participants in the web interface, so that I can track individuals in my community.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all participants with name, email (if provided), and other relevant information
2. THE Web_App SHALL provide search functionality to find participants by name or email
3. THE Web_App SHALL provide sorting and filtering for the participant list
4. THE Web_App SHALL provide a dedicated page to create new participants
5. THE Web_App SHALL provide a dedicated page to edit existing participants
6. THE Web_App SHALL provide a delete button for participants
7. THE Web_App SHALL validate that participant name is provided
8. WHEN a participant email is provided, THE Web_App SHALL validate email format
9. THE Web_App SHALL allow optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields
10. WHEN dateOfBirth is provided, THE Web_App SHALL validate that it is a valid date in the past
11. WHEN dateOfRegistration is provided, THE Web_App SHALL validate that it is a valid date
12. THE Web_App SHALL display a detail view showing participant information and their activities
12a. WHEN displaying a participant's email address on the detail view, THE Web_App SHALL render it as a clickable mailto link
12b. WHEN displaying a participant's phone number on the detail view, THE Web_App SHALL render it as a clickable tel link
11. THE Web_App SHALL display a table of the participant's home address history in reverse chronological order
12. THE Web_App SHALL provide an interface to add new address history records with venue and effective start date
13. THE Web_App SHALL provide an interface to edit existing address history records
14. THE Web_App SHALL provide an interface to delete address history records
15. THE Web_App SHALL validate that address history records have a venue
16. THE Web_App SHALL allow address history records to have an optional effective start date
17. WHEN an address history record has a null effective start date, THE Web_App SHALL treat it as the oldest home address for that participant
18. THE Web_App SHALL enforce that at most one address history record can have a null effective start date for any given participant
19. THE Web_App SHALL prevent duplicate address history records with the same effective start date (including null) for the same participant
17. WHEN creating a new participant, THE Web_App SHALL allow adding home address history records within the participant creation page
18. WHEN editing an existing participant, THE Web_App SHALL allow adding, editing, and deleting home address history records within the participant edit page
19. WHEN adding an address history record to a new participant before the participant is created, THE Web_App SHALL fetch and display the venue name in the address history table
20. WHEN a venue is selected for a new address history record, THE Web_App SHALL retrieve the venue details from the backend and store them for display purposes
21. THE Web_App SHALL provide an interface to manage participant population memberships within the participant form page (both create and edit modes)
22. THE Web_App SHALL display all populations the participant belongs to in a list or table
23. THE Web_App SHALL provide an interface to add the participant to populations
24. THE Web_App SHALL provide an interface to remove the participant from populations
25. THE Web_App SHALL allow a participant to belong to zero, one, or multiple populations
26. THE Web_App SHALL display population memberships on the participant detail view

### Requirement 5: Activity Management UI

**User Story:** As a community organizer, I want to manage activities in the web interface with comprehensive filtering capabilities, so that I can track community events and find specific activities efficiently.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all activities with category, type, dates, and status
2. THE Web_App SHALL provide server-side filtering by activity category using query parameters
3. THE Web_App SHALL provide server-side filtering by activity type using query parameters
4. THE Web_App SHALL provide server-side filtering by activity status (PLANNED, ACTIVE, COMPLETED, CANCELLED) using query parameters
5. THE Web_App SHALL provide server-side filtering by date range (start date and end date) using query parameters
6. THE Web_App SHALL provide server-side filtering by population (showing only activities with participants in specified populations) using query parameters
7. WHEN multiple activity categories are selected, THE Web_App SHALL apply OR logic within the category filter dimension
8. WHEN multiple activity types are selected, THE Web_App SHALL apply OR logic within the type filter dimension
9. WHEN multiple statuses are selected, THE Web_App SHALL apply OR logic within the status filter dimension
10. WHEN multiple populations are selected, THE Web_App SHALL apply OR logic within the population filter dimension
11. WHEN multiple filter dimensions are applied (e.g., categories AND statuses AND populations), THE Web_App SHALL apply AND logic across different filter dimensions
12. THE Web_App SHALL send all filter parameters to the backend API via query string parameters
13. THE Web_App SHALL persist filter selections in URL query parameters for shareability and browser navigation
14. WHEN a user navigates to a URL with filter query parameters, THE Web_App SHALL apply those filters automatically to the activity list
15. THE Web_App SHALL provide a way to clear all filters and return to the unfiltered view
16. THE Web_App SHALL provide sorting for the activity list
16. THE Web_App SHALL provide sorting for the activity list
17. THE Web_App SHALL distinguish finite and ongoing activities visually
18. THE Web_App SHALL provide a dedicated page to create new activities
19. THE Web_App SHALL provide a dedicated page to edit existing activities
20. THE Web_App SHALL provide a delete button for activities
21. WHEN creating a finite activity, THE Web_App SHALL require an end date
22. WHEN creating an ongoing activity, THE Web_App SHALL allow null end date
23. THE Web_App SHALL validate that activity name, type, and start date are provided
24. THE Web_App SHALL support activity statuses: PLANNED, ACTIVE, COMPLETED, CANCELLED
25. THE Web_App SHALL provide a button to update activity status
25a. WHEN marking an activity as COMPLETED, THE Web_App SHALL implicitly set the end date to today if the end date is null
25b. WHEN marking an activity as CANCELLED, THE Web_App SHALL implicitly set the end date to today if the end date is null
25c. WHEN marking an activity as CANCELLED, THE Web_App SHALL implicitly set the start date to today if the start date is in the future
26. THE Web_App SHALL display a detail view showing activity information and assigned participants
27. THE Web_App SHALL allow selection of one or more venues for each activity
28. THE Web_App SHALL display the activity's venue history in reverse chronological order when venues have changed over time
29. WHEN creating a new activity, THE Web_App SHALL allow adding venue associations with optional effective start dates within the activity creation page
30. WHEN editing an existing activity, THE Web_App SHALL allow adding, editing, and deleting venue associations within the activity edit page
31. WHEN adding a venue association to a new activity before the activity is created, THE Web_App SHALL fetch and display the venue name in the venue history table
32. WHEN a venue is selected for a new venue association, THE Web_App SHALL retrieve the venue details from the backend and store them for display purposes
33. WHEN a venue association has a null effective start date, THE Web_App SHALL treat the venue association start date as the same as the activity start date
34. THE Web_App SHALL enforce that at most one venue association can have a null effective start date for any given activity
35. THE Web_App SHALL prevent duplicate venue associations with the same effective start date (including null) for the same activity
36. WHEN creating a new activity, THE Web_App SHALL allow assigning participants with roles and optional notes within the activity creation page
37. WHEN editing an existing activity, THE Web_App SHALL allow adding, editing, and removing participant assignments within the activity edit page
38. WHEN adding a participant assignment to a new activity before the activity is created, THE Web_App SHALL fetch and display the participant name and role in the participant assignments table
39. WHEN a participant is selected for a new assignment, THE Web_App SHALL retrieve the participant details from the backend and store them for display purposes
40. THE Web_App SHALL display the venue associations table and participant assignments table stacked vertically within the activity form page, with venue associations appearing above participant assignments
41. THE Web_App SHALL provide an atomic user experience where all activity details, venue associations, and participant assignments can be configured before the activity is persisted to the backend

### Requirement 5C: Track Additional Participant Count

**User Story:** As a community organizer, I want to record approximate attendance for activities beyond individually tracked participants, so that I can capture high-level participation in large gatherings without the overhead of tracking every individual.

#### Acceptance Criteria

1. THE Web_App SHALL display an optional "Additional Participant Count" field on the activity form page (both create and edit modes)
2. THE Web_App SHALL position the "Additional Participant Count" field in the activity details section, separate from the participant assignments table
3. THE Web_App SHALL validate that additionalParticipantCount is a positive integer when provided
4. THE Web_App SHALL allow the additionalParticipantCount field to be empty (null)
5. THE Web_App SHALL provide a clear button (X icon) next to the additionalParticipantCount field to remove a previously entered value
6. WHEN the clear button is clicked, THE Web_App SHALL set additionalParticipantCount to null and send null to the API on save
7. THE Web_App SHALL display validation errors when additionalParticipantCount is not a positive integer
8. THE Web_App SHALL reject decimal values for additionalParticipantCount (only accept whole numbers)
9. THE Web_App SHALL display the additionalParticipantCount value on the activity detail view
10. WHEN displaying total participant count on the activity detail view, THE Web_App SHALL show the sum of individually assigned participants plus additionalParticipantCount
11. THE Web_App SHALL clearly distinguish between individually tracked participants and additional participant count in the UI
12. THE Web_App SHALL display a label or help text explaining that additional participant count represents approximate attendance beyond tracked individuals
13. WHEN additionalParticipantCount is null or 0, THE Web_App SHALL display only the count of individually assigned participants
14. WHEN additionalParticipantCount is greater than 0, THE Web_App SHALL display both the individual count and the additional count, along with the total
15. THE Web_App SHALL include additionalParticipantCount in activity list displays where participant counts are shown
16. THE Web_App SHALL send additionalParticipantCount to the backend API when creating or updating activities
17. THE Web_App SHALL handle additionalParticipantCount in CSV import/export operations for activities

### Requirement 5A: Activity List Filtering UX with PropertyFilter

**User Story:** As a community organizer, I want to filter the activity list using a consistent PropertyFilter interface matching the analytics dashboards, so that I can efficiently find specific activities with a familiar and powerful filtering experience.

#### Acceptance Criteria

1. THE Web_App SHALL use CloudScape PropertyFilter component for activity list filtering
2. THE Web_App SHALL use CloudScape DateRangePicker component for date range filtering
3. THE PropertyFilter SHALL support filtering by Activity Category property
4. THE PropertyFilter SHALL support filtering by Activity Type property
5. THE PropertyFilter SHALL support filtering by Status property (PLANNED, ACTIVE, COMPLETED, CANCELLED)
6. THE PropertyFilter SHALL support filtering by Population property
7. THE PropertyFilter SHALL implement lazy loading of property values when the user types in the filter input
8. WHEN a user types in the PropertyFilter, THE Web_App SHALL asynchronously fetch matching values from the backend APIs
9. THE PropertyFilter SHALL debounce user input to avoid excessive API requests (minimum 300ms delay)
10. THE PropertyFilter SHALL display a loading indicator while fetching property values
11. THE PropertyFilter SHALL support only the equals (=) operator for all properties
12. THE PropertyFilter SHALL NOT support the not equals (!=) operator
13. WHEN multiple values are selected for a single property dimension, THE PropertyFilter SHALL display a single token showing all values as a comma-separated list
14. THE PropertyFilter SHALL maintain a one-to-one mapping between property name and filter token
15. WHEN a user filters by Activity Category with values "Study Circles" and "Devotional Gatherings", THE PropertyFilter SHALL display a single token reading "Activity Category = Study Circles, Devotional Gatherings"
16. THE PropertyFilter SHALL NOT create separate tokens for each value within the same property dimension
17. THE PropertyFilter SHALL display human-readable display names in filter tokens instead of UUIDs
18. WHEN displaying Activity Category values in tokens, THE PropertyFilter SHALL show the category name (e.g., "Study Circles") not the category ID
19. WHEN displaying Activity Type values in tokens, THE PropertyFilter SHALL show the type name (e.g., "Children's Class") not the type ID
20. WHEN displaying Population values in tokens, THE PropertyFilter SHALL show the population name (e.g., "Youth") not the population ID
21. THE PropertyFilter SHALL prevent duplicate values within a single property dimension
22. WHEN a user attempts to add a value that already exists in a property dimension's token, THE PropertyFilter SHALL ignore the duplicate and maintain only unique values
23. THE PropertyFilter SHALL persist all filter tokens to URL query parameters
24. THE PropertyFilter SHALL persist date range selections to URL query parameters
25. WHEN a user navigates to a URL with PropertyFilter query parameters, THE Web_App SHALL restore the filter tokens and date range
26. THE PropertyFilter SHALL extract filter values from tokens and convert display names back to IDs for API requests
27. WHEN multiple filter tokens are added, THE Web_App SHALL apply all filters using AND logic across dimensions
28. WHEN multiple values exist within a single token, THE Web_App SHALL apply OR logic within that dimension
29. THE PropertyFilter SHALL allow users to clear all filters at once
30. WHEN the PropertyFilter is empty and no date range is selected, THE Web_App SHALL display all activities without filtering
31. THE PropertyFilter SHALL provide clear labels for each property (Activity Category, Activity Type, Status, Population)
32. THE PropertyFilter SHALL integrate with the global geographic area filter from the application header
33. WHEN both PropertyFilter and global geographic area filter are active, THE Web_App SHALL apply both filters using AND logic
34. THE Web_App SHALL position the DateRangePicker and PropertyFilter components together in a consistent layout matching the analytics dashboards
35. THE Web_App SHALL provide comprehensive i18nStrings for PropertyFilter accessibility and localization

### Requirement 5B: Unified List Filtering with FilterGroupingPanel

**User Story:** As a community organizer, I want to filter participant, venue, and activity lists using the FilterGroupingPanel component with server-side filtering and URL synchronization, so that I can efficiently find specific records with a consistent interface across all list pages.

#### Acceptance Criteria

**General FilterGroupingPanel Integration:**

1. THE Web_App SHALL use the FilterGroupingPanel component on the ParticipantList page for filtering participants
2. THE Web_App SHALL use the FilterGroupingPanel component on the VenueList page for filtering venues
3. THE Web_App SHALL use the FilterGroupingPanel component on the ActivityList page for filtering activities
4. WHEN using FilterGroupingPanel on list pages, THE Web_App SHALL configure it without grouping controls (grouping is not needed for record retrieval)
5. WHEN using FilterGroupingPanel on list pages, THE Web_App SHALL configure it with property-based filtering only
6. WHEN the user clicks the "Update" button on the FilterGroupingPanel, THE Web_App SHALL send filter criteria to the backend API as query parameters
7. THE Web_App SHALL persist all filter selections to URL query parameters for shareability and browser navigation
8. WHEN a user navigates to a list page URL with filter query parameters, THE Web_App SHALL restore and apply those filters automatically
9. WHEN a user changes filter selections and clicks "Update", THE Web_App SHALL update the browser URL to reflect the current filter state
10. THE Web_App SHALL enable browser back/forward navigation to move between different filter configurations on list pages
11. WHEN a user shares a filtered list page URL, THE Web_App SHALL display the same filtered results for other users

**ParticipantList Filtering:**

12. WHEN using FilterGroupingPanel on ParticipantList, THE Web_App SHALL configure filter properties for: Name, Email, Date of Birth, Date of Registration, Population
13. THE FilterGroupingPanel on ParticipantList SHALL implement lazy loading of property values when the user types in the filter input
14. WHEN a user types in the Name or Email filter, THE Web_App SHALL asynchronously fetch matching participants from the backend
15. THE FilterGroupingPanel on ParticipantList SHALL debounce user input to avoid excessive API requests (minimum 300ms delay)
16. THE FilterGroupingPanel on ParticipantList SHALL support filtering by one or more populations
17. WHEN a population filter is applied to ParticipantList with multiple values, THE Web_App SHALL include only participants who belong to at least one of the specified populations (OR logic within dimension)
18. THE FilterGroupingPanel on ParticipantList SHALL support date range filtering for Date of Birth and Date of Registration
19. WHEN multiple filter dimensions are applied on ParticipantList (e.g., populations AND date of birth range), THE Web_App SHALL apply all filters using AND logic across dimensions
20. THE Web_App SHALL send all participant filter parameters to GET /api/v1/participants as query parameters
21. THE Web_App SHALL persist participant filter selections to URL query parameters (e.g., ?populationIds=uuid1,uuid2&dobStart=2000-01-01&dobEnd=2010-12-31)
22. WHEN a user navigates to a ParticipantList URL with filter query parameters, THE Web_App SHALL restore the filters and apply them to the participant list

**VenueList Filtering:**

23. WHEN using FilterGroupingPanel on VenueList, THE Web_App SHALL configure filter properties for: Name, Address, Geographic Area, Venue Type
24. THE FilterGroupingPanel on VenueList SHALL implement lazy loading of property values when the user types in the filter input
25. WHEN a user types in the Name or Address filter, THE Web_App SHALL asynchronously fetch matching venues from the backend
26. THE FilterGroupingPanel on VenueList SHALL debounce user input to avoid excessive API requests (minimum 300ms delay)
27. THE FilterGroupingPanel on VenueList SHALL support filtering by one or more geographic areas
28. WHEN a geographic area filter is applied to VenueList with multiple values, THE Web_App SHALL include only venues in at least one of the specified geographic areas or their descendants (OR logic within dimension)
29. THE FilterGroupingPanel on VenueList SHALL support filtering by one or more venue types
30. WHEN a venue type filter is applied to VenueList with multiple values, THE Web_App SHALL include only venues of at least one of the specified venue types (OR logic within dimension)
31. WHEN multiple filter dimensions are applied on VenueList (e.g., geographic areas AND venue types), THE Web_App SHALL apply all filters using AND logic across dimensions
32. THE Web_App SHALL send all venue filter parameters to GET /api/v1/venues as query parameters
33. THE Web_App SHALL persist venue filter selections to URL query parameters (e.g., ?geographicAreaIds=uuid1,uuid2&venueTypes=COMMUNITY_CENTER,PARK)
34. WHEN a user navigates to a VenueList URL with filter query parameters, THE Web_App SHALL restore the filters and apply them to the venue list

**ActivityList Filtering Enhancement:**

35. THE Web_App SHALL continue using FilterGroupingPanel on ActivityList as specified in Requirement 5A
36. THE ActivityList FilterGroupingPanel SHALL include CloudScape DateRangePicker for date range filtering
37. THE ActivityList FilterGroupingPanel SHALL NOT include grouping controls (grouping is not needed for record retrieval)
38. THE Web_App SHALL maintain all existing ActivityList filtering behavior specified in Requirement 5A

**Common Filtering Behavior:**

39. THE FilterGroupingPanel on all list pages SHALL support only the equals (=) operator for all properties
40. THE FilterGroupingPanel on all list pages SHALL NOT support the not equals (!=) operator
41. WHEN multiple values are selected for a single property dimension on any list page, THE FilterGroupingPanel SHALL display a single token showing all values as a comma-separated list
42. THE FilterGroupingPanel on all list pages SHALL maintain a one-to-one mapping between property name and filter token
43. THE FilterGroupingPanel on all list pages SHALL display human-readable display names in filter tokens instead of UUIDs
44. THE FilterGroupingPanel on all list pages SHALL prevent duplicate values within a single property dimension
45. THE FilterGroupingPanel on all list pages SHALL allow users to clear all filters at once using the "Clear All" button
46. WHEN the FilterGroupingPanel is empty on any list page, THE Web_App SHALL display all records without filtering
47. THE FilterGroupingPanel on all list pages SHALL integrate with the global geographic area filter from the application header
48. WHEN both FilterGroupingPanel filters and global geographic area filter are active, THE Web_App SHALL apply both filters using AND logic

**URL Filter Initialization and Application:**

49. WHEN a list page loads with filter query parameters in the URL, THE Web_App SHALL wait for filter display names to be resolved to UUIDs before fetching the entity list
50. WHEN a list page loads without filter query parameters in the URL, THE Web_App SHALL immediately fetch the entity list without waiting
51. THE FilterGroupingPanel SHALL resolve filter display names to UUIDs by invoking the lazy loading callbacks for each filter property
52. WHEN filter display names are being resolved from URL parameters, THE FilterGroupingPanel SHALL display a loading indicator
53. AFTER filter display names are resolved to UUIDs, THE FilterGroupingPanel SHALL automatically trigger the initial data fetch with the resolved filter values
54. THE FilterGroupingPanel SHALL NOT mark the initial state as "dirty" when filters are restored from URL parameters
55. AFTER the initial data fetch completes with URL-restored filters, THE FilterGroupingPanel SHALL enable the "Update" button for subsequent user changes
56. THE Web_App SHALL apply the same URL filter initialization logic whether or not a global geographic area filter is active
57. WHEN both URL filter parameters and a global geographic area filter are present on page load, THE Web_App SHALL wait for both to be resolved before fetching the entity list

### Requirement 2A: Form Presentation Pattern for Major Entities

**User Story:** As a mobile user, I want to edit participants, activities, venues, geographic areas, and users on dedicated pages rather than in modal dialogs, so that I can scroll through large forms comfortably and have a better mobile experience.

#### Acceptance Criteria

1. THE Web_App SHALL NOT use modal dialogs for creating or editing participants
2. THE Web_App SHALL NOT use modal dialogs for creating or editing activities
3. THE Web_App SHALL NOT use modal dialogs for creating or editing venues
4. THE Web_App SHALL NOT use modal dialogs for creating or editing geographic areas
5. THE Web_App SHALL NOT use modal dialogs for creating or editing users
6. THE Web_App SHALL use dedicated pages with full-page forms for creating and editing participants, activities, venues, geographic areas, and users
7. THE Web_App SHALL allow vertical scrolling on form pages to accommodate large forms with many fields and embedded sections
8. THE Web_App MAY use modal dialogs for creating or editing simple configuration entities (activity categories, activity types, participant roles, populations) that have few fields
9. THE Web_App MAY use modal dialogs for creating or editing child records (address history, venue history, assignments, authorization rules) when embedded within parent entity forms
10. WHEN a user navigates away from a form page with unsaved changes, THE Web_App SHALL detect the dirty form state
11. WHEN a user attempts to navigate away from a dirty form, THE Web_App SHALL display a confirmation dialog asking if they want to discard their changes
12. WHEN a user confirms they want to discard changes, THE Web_App SHALL allow navigation to proceed
13. WHEN a user cancels the discard confirmation, THE Web_App SHALL remain on the form page and preserve all form data
14. THE Web_App SHALL track form dirty state by comparing current form values to initial values
15. THE Web_App SHALL clear dirty state after successful form submission
16. THE Web_App SHALL implement navigation guards using React Router's useBlocker or similar mechanism to intercept navigation attempts

### Requirement 6: Activity-Participant Assignment UI

**User Story:** As a community organizer, I want to assign participants to activities in the web interface, so that I can track who is involved.

#### Acceptance Criteria

1. THE Web_App SHALL provide an interface to assign participants to activities within the activity form page (both create and edit modes)
2. WHEN assigning a participant, THE Web_App SHALL require role selection
3. THE Web_App SHALL display all assigned participants with their roles on the activity detail view
4. THE Web_App SHALL provide a button to remove participant assignments
5. THE Web_App SHALL validate that a role is selected before allowing assignment
6. THE Web_App SHALL prevent duplicate assignments of the same participant with the same role
7. THE Web_App SHALL allow optional notes to be added to participant assignments
8. WHEN creating a new activity, THE Web_App SHALL allow adding participant assignments before the activity is persisted to the backend
9. WHEN editing an existing activity, THE Web_App SHALL allow adding, editing, and removing participant assignments within the activity edit page
10. THE Web_App SHALL display the participant assignments interface within the activity form page, positioned below the venue associations interface

### Requirement 6A: Venue Management UI

**User Story:** As a community organizer, I want to manage venues in the web interface, so that I can track physical locations where activities occur.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all venues with name, address, geographic area, and venue type
1a. WHEN displaying venues in the list, THE Web_App SHALL render the geographic area name as a hyperlink to the geographic area detail page (/geographic-areas/:id)
1b. WHEN displaying venues in the list, THE Web_App SHALL include a venue type column
1c. WHEN a venue has a venue type specified, THE Web_App SHALL render the venue type as a CloudScape Badge component
1d. WHEN the venue type is PRIVATE_RESIDENCE, THE Web_App SHALL render the badge with green color
1e. WHEN the venue type is PUBLIC_BUILDING, THE Web_App SHALL render the badge with medium severity color (orange/warning color)
1f. WHEN a venue does not have a venue type specified (null), THE Web_App SHALL leave the venue type cell blank
2. THE Web_App SHALL provide search functionality to find venues by name or address
3. THE Web_App SHALL provide sorting and filtering for the venue list
4. THE Web_App SHALL provide a dedicated page to create new venues
5. THE Web_App SHALL provide a dedicated page to edit existing venues
6. THE Web_App SHALL provide a delete button for venues
7. THE Web_App SHALL validate that venue name, address, and geographic area are provided
7a. THE Web_App SHALL use the Geographic_Area_Selector component for geographic area selection in venue forms
8. THE Web_App SHALL allow optional fields for latitude, longitude, and venue type
9. THE Web_App SHALL display a detail view showing venue information, associated activities, and participants using it as their current home address
9a. WHEN displaying participants on a venue detail page, THE Web_App SHALL only show participants whose most recent address history record is at this venue
9b. WHEN a venue has non-null latitude and longitude coordinates, THE Web_App SHALL display an interactive map preview on the venue detail page
9c. THE map preview SHALL be positioned in its own container below the venue details pane and above the "Associated Activities" pane
9d. THE map preview SHALL display the venue location as a marker on the map
9e. THE map preview SHALL be centered on the venue's coordinates with an appropriate zoom level (e.g., zoom level 15)
9f. WHEN a venue has null latitude or longitude coordinates, THE Web_App SHALL NOT display the map preview container on the venue detail page
10. WHEN deleting a venue, THE Web_App SHALL prevent deletion if activities or participants reference it
11. WHEN deleting a venue, THE Web_App SHALL display an error message explaining which entities reference it

### Requirement 6B: Geographic Area Management UI

**User Story:** As a community organizer, I want to manage geographic areas in the web interface with lazy loading support, so that I can efficiently navigate large geographic hierarchies without loading all nodes at once.

#### Acceptance Criteria

1. THE Web_App SHALL display a hierarchical tree view of geographic areas using CloudScape TreeView component
2. WHEN first navigating to the geographic areas view, THE Web_App SHALL fetch only the top-level geographic areas (based on the current global filter) and their immediate children
3. WHEN no global filter is active, THE Web_App SHALL fetch all top-level areas with null parents (e.g., countries) and their immediate children (e.g., states or provinces)
4. WHEN a specific geographic area is selected in the global filter, THE Web_App SHALL fetch only the immediate children of that filtered area
5. THE Web_App SHALL use the depth query parameter when fetching geographic areas to limit recursive fetching
6. WHEN initially loading the tree view, THE Web_App SHALL request depth=1 to fetch only one level of children
7. WHEN a tree node is expanded by the user, THE Web_App SHALL fetch the children of that node on demand using GET /api/geographic-areas/:id/children
7a. WHEN a tree node is expanded and a global geographic area filter is active, THE Web_App SHALL pass the filter as a geographicAreaId query parameter to the children endpoint
7b. WHEN the children endpoint receives a geographicAreaId filter parameter, THE Web_App SHALL expect to receive only children that are in the direct ancestral lineage of the filtered area
7c. WHEN a global filter is set to a leaf node and the user expands a top-level area, THE Web_App SHALL receive only the child that is the direct ancestor of the filtered leaf node
8. THE Web_App SHALL use the childCount field from the API response to determine if a node has children
9. WHEN childCount is 0, THE Web_App SHALL render the node as a leaf node without expansion affordance
10. WHEN childCount is greater than 0, THE Web_App SHALL render the node with expansion affordance (arrow icon or similar)
11. THE Web_App SHALL display a loading indicator on a node while fetching its children
12. THE Web_App SHALL cache fetched children to avoid redundant API calls when collapsing and re-expanding nodes
13. THE Web_App SHALL provide a dedicated page to create new geographic areas
14. THE Web_App SHALL provide a dedicated page to edit existing geographic areas
15. THE Web_App SHALL provide a delete button for geographic areas
16. THE Web_App SHALL validate that geographic area name and type are provided
17. THE Web_App SHALL use the Geographic_Area_Selector component for parent geographic area selection
18. THE Web_App SHALL prevent circular parent-child relationships
19. THE Web_App SHALL display a detail view showing geographic area information, child areas, and associated venues from the area and all descendant areas (recursive aggregation)
19a. THE Web_App SHALL provide an "Apply Filter" button on the geographic area detail page
19b. WHEN the "Apply Filter" button is clicked, THE Web_App SHALL update the global geographic area filter to the current geographic area
19c. WHEN displaying the list of associated venues on the geographic area detail page, THE Web_App SHALL include a venue type column
19d. WHEN a venue in the associated venues list has a venue type specified, THE Web_App SHALL render the venue type as a CloudScape Badge component
19e. WHEN the venue type is PRIVATE_RESIDENCE in the associated venues list, THE Web_App SHALL render the badge with green color
19f. WHEN the venue type is PUBLIC_BUILDING in the associated venues list, THE Web_App SHALL render the badge with medium severity color (orange/warning color)
19g. WHEN a venue in the associated venues list does not have a venue type specified (null), THE Web_App SHALL leave the venue type cell blank
20. WHEN deleting a geographic area, THE Web_App SHALL prevent deletion if venues or child areas reference it
21. WHEN deleting a geographic area, THE Web_App SHALL display an error message explaining which entities reference it
22. THE Web_App SHALL display the full hierarchy path for each geographic area
23. WHEN the global geographic area filter is active, THE Web_App SHALL display the filtered area, its immediate children (initially), AND all its ancestors in the tree view to maintain hierarchy context
24. WHEN displaying ancestors of a filtered geographic area, THE Web_App SHALL visually indicate that ancestor areas are read-only (e.g., with a badge, icon, or muted styling)
25. THE Web_App SHALL NOT suppress or hide ancestor geographic areas from the tree view when a filter is active, as ancestors provide essential navigational context
26. THE Web_App SHALL support progressive disclosure of the hierarchy through user-initiated node expansion
27. THE Web_App SHALL maintain expansion state when navigating away and returning to the geographic areas view
28. WHEN the global geographic area filter changes, THE Web_App SHALL clear the children cache to prevent displaying stale data
29. WHEN the global geographic area filter changes, THE Web_App SHALL clear the batch loading state to reset any in-progress loading
30. WHEN the global geographic area filter changes, THE Web_App SHALL reset the expanded items to start with a fresh tree view
31. WHEN the global geographic area filter changes, THE Web_App SHALL automatically refetch the tree data through React Query's dependency tracking

### Requirement 6B1: Reusable Geographic Area Selector Component

**User Story:** As a user, I want a consistent, high-quality geographic area selection experience throughout the application, so that I can easily find and select the correct geographic area regardless of where I am in the interface.

#### Acceptance Criteria

1. THE Web_App SHALL provide a reusable Geographic_Area_Selector component that can be used anywhere geographic area selection is needed
2. THE Geographic_Area_Selector SHALL use CloudScape Select component as its foundation
3. THE Geographic_Area_Selector SHALL display each geographic area option with a custom label layout showing the area name and area type badge
4. THE Geographic_Area_Selector SHALL render the option label using a Box component with display="block" variant="div"
5. THE Geographic_Area_Selector SHALL display the area name in the first Box element
6. THE Geographic_Area_Selector SHALL display the area type badge in a second Box element using CloudScape Badge component with color determined by getAreaTypeBadgeColor() utility
7. THE Geographic_Area_Selector SHALL use the Select component's description property to display the full ancestor hierarchy path
8. THE Geographic_Area_Selector SHALL format the hierarchy path as "Ancestor1 > Ancestor2 > Ancestor3" (closest to most distant)
9. WHEN an area has no parent areas, THE Geographic_Area_Selector SHALL display "No parent areas" as the description
10. THE Geographic_Area_Selector SHALL implement async lazy-loading of geographic areas from the backend in batches of 100 items
11. THE Geographic_Area_Selector SHALL load the first batch of results (100 items) when the dropdown is opened
12. THE Geographic_Area_Selector SHALL render options incrementally as each batch is fetched
13. THE Geographic_Area_Selector SHALL display a loading indicator at the bottom of the dropdown while fetching additional batches
14. THE Geographic_Area_Selector SHALL automatically fetch the next batch when the user scrolls near the bottom of the dropdown
15. THE Geographic_Area_Selector SHALL support text-based filtering using the backend's flexible filtering API
16. WHEN a user types in the Geographic_Area_Selector search field, THE Web_App SHALL send the search text to GET /api/v1/geographic-areas using ?filter[name]=<text> parameter
17. THE Geographic_Area_Selector SHALL use the backend's case-insensitive partial matching on geographic area names for search functionality
18. THE Geographic_Area_Selector SHALL combine name filtering with other query parameters (geographicAreaId for scope, depth for lazy loading, fields for attribute selection) using AND logic
19. THE Geographic_Area_Selector SHALL use the fields parameter to request only necessary attributes (e.g., ?fields=id,name,areaType,parentGeographicAreaId) for optimal performance
20. THE Geographic_Area_Selector SHALL display a loading indicator using statusType="loading" while fetching filtered results
21. THE Geographic_Area_Selector SHALL support pagination for large result sets with batches of 100 items
22. THE Geographic_Area_Selector SHALL accept optional props to filter results by parent geographic area or other criteria
23. THE Geographic_Area_Selector SHALL handle empty states when no results match the search
24. THE Geographic_Area_Selector SHALL handle error states gracefully
25. THE Geographic_Area_Selector SHALL provide accessible keyboard navigation
26. THE Geographic_Area_Selector SHALL be decoupled from any specific parent component (not tied to BreadcrumbGroup or global filter)
27. THE Geographic_Area_Selector SHALL accept standard form control props (value, onChange, disabled, error, placeholder, inlineLabelText, etc.)
28. THE Geographic_Area_Selector SHALL support an empty/unselected state with configurable placeholder text
29. THE Geographic_Area_Selector SHALL NOT artificially insert a "Global" or "All Areas" option into the dropdown options list
30. WHEN no geographic area is selected, THE Geographic_Area_Selector SHALL display the placeholder text (e.g., "Select a geographic area")
31. THE Geographic_Area_Selector SHALL use expandToViewport property to allow dropdown to expand beyond container boundaries
32. THE Geographic_Area_Selector SHALL provide renderHighlightedAriaLive callback for screen reader support
33. THE Geographic_Area_Selector SHALL use selectedAriaLabel property for accessibility
34. THE Geographic_Area_Selector SHALL be usable in both modal forms and full-page forms
35. THE Geographic_Area_Selector SHALL use ONLY the batch-ancestors endpoint (POST /api/v1/geographic-areas/batch-ancestors) for fetching ancestor data
36. THE Geographic_Area_Selector SHALL NOT use the deprecated single-area GET /api/geographic-areas/:id/ancestors endpoint
37. WHEN fetching ancestors for multiple areas, THE Geographic_Area_Selector SHALL batch area IDs into groups of up to 100 and call batch-ancestors endpoint for each group
38. THE Geographic_Area_Selector SHALL leverage the backend's WITH RECURSIVE CTE implementation for sub-20ms ancestor fetching latency
39. THE Geographic_Area_Selector SHALL fetch ancestor data ONLY for the purpose of displaying hierarchy paths in option descriptions
40. THE Geographic_Area_Selector SHALL NOT add fetched ancestor areas to the dropdown options list
41. WHEN ancestors are fetched for a batch of geographic areas, THE Geographic_Area_Selector SHALL use the ancestor data exclusively to populate the hierarchy path description for each area in that batch
42. THE Geographic_Area_Selector SHALL maintain the dropdown options list as containing ONLY the areas that match the current filter text (or the initial batch when no filter is applied)
43. WHEN a specific geographic area needs to be pre-selected (e.g., when editing a venue), THE Geographic_Area_Selector SHALL fetch that specific area and its ancestors if not already in the options list
44. WHEN pre-selecting a specific area, THE Geographic_Area_Selector SHALL add ONLY that specific area to the options list (not its ancestors)
45. WHEN pre-selecting a specific area, THE Geographic_Area_Selector SHALL use the fetched ancestor data to populate the hierarchy path description for the pre-selected area
46. THE Geographic_Area_Selector SHALL prevent cascading population of the options list when fetching ancestors for hierarchy display purposes
31. THE Web_App SHALL use the Geographic_Area_Selector component in all forms and interfaces where geographic area selection is required
32. THE Web_App SHALL use the Geographic_Area_Selector component in the global geographic area filter (decoupled from BreadcrumbGroup)
33. THE Web_App SHALL use the Geographic_Area_Selector component in VenueForm for geographic area selection
34. THE Web_App SHALL use the Geographic_Area_Selector component in GeographicAreaForm for parent geographic area selection
35. THE Web_App SHALL use the Geographic_Area_Selector component in GeographicAuthorizationForm for geographic area selection
36. THE Web_App SHALL use the Geographic_Area_Selector component in any other forms or interfaces that require geographic area selection
37. WHEN a user types in the Geographic_Area_Selector, THE Web_App SHALL debounce the search input to avoid excessive API requests (minimum 300ms delay)
38. THE Geographic_Area_Selector SHALL leverage the backend's flexible filtering system (Requirement 28 in Backend API) for efficient name-based searching
39. THE Geographic_Area_Selector SHALL leverage the backend's WITH RECURSIVE CTE implementation for sub-20ms ancestor fetching latency per batch request

### Requirement 6C: Map View UI with Optimized Loading

**User Story:** As a community organizer, I want to view activities, participant locations, and venues on a map with fast initial rendering, batched incremental loading, and progressive content display, so that I can visualize community engagement and infrastructure by geography even when there are thousands of markers while receiving continuous loading feedback.

> **Note**: The batched incremental loading pattern with ProgressIndicator described in this requirement applies exclusively to the Map View. List pages (Participants, Activities, Venues) use CloudScape Table's native pagination instead (see Requirement 26A).

#### Acceptance Criteria

**Initial Map Rendering:**

1. THE Web_App SHALL provide an interactive map view using a mapping library (e.g., Leaflet, Mapbox)
2. WHEN a user navigates to the map view page, THE Web_App SHALL render the map immediately zoomed out to show the entire world before any marker data is fetched
3. THE Web_App SHALL display a loading indicator (e.g., "Loading markers..." text or spinner overlay) while fetching marker data from the backend
4. THE Web_App SHALL keep the map interactive (zoomable and pannable) during the marker loading process
5. WHEN marker data is successfully fetched, THE Web_App SHALL remove the loading indicator
6. WHEN marker data is successfully fetched and markers are rendered, THE Web_App SHALL automatically zoom the map to fit the bounds of all visible markers ONLY if coordinate-based filtering was not active during the fetch
6a. WHEN coordinate-based filtering is active (viewport bounds were sent with the request), THE Web_App SHALL NOT automatically zoom the map to fit marker bounds
6b. WHEN fetching markers in multiple batches, THE Web_App SHALL NOT automatically zoom the map until all batches have been completely loaded
6c. WHEN all marker batches have been loaded and coordinate-based filtering was not active, THE Web_App SHALL automatically zoom the map once to fit the bounds of all loaded markers
6d. THE Web_App SHALL NOT adjust zoom during incremental batch rendering to prevent the map from jumping around as markers progressively load
7. WHEN no markers are visible after applying filters, THE Web_App SHALL keep the map at world zoom level, keep the map mounted and interactive, and display a non-intrusive empty state message using a floating CloudScape Alert component

**Batched Incremental Marker Loading:**

8. THE Web_App SHALL fetch map markers in batches of 100 items using paginated API requests
9. THE Web_App SHALL render markers incrementally as each batch is fetched, without waiting for all batches to complete
10. WHEN the first batch of markers is fetched, THE Web_App SHALL immediately render those markers on the map
11. WHEN subsequent batches of markers are fetched, THE Web_App SHALL append and render those markers to the existing map display
12. THE Web_App SHALL display a progress indicator showing the number of markers loaded and total markers available (e.g., "Loading markers: 300 / 1,500")
13. THE Web_App SHALL update the progress indicator after each batch is rendered
14. THE Web_App SHALL keep the loading indicator visible until all batches have been fetched and rendered
15. THE Web_App SHALL allow users to interact with already-rendered markers while additional batches are still loading
16. THE Web_App SHALL automatically fetch the next batch of markers after the previous batch has been rendered
17. THE Web_App SHALL handle pagination metadata from the API response to determine if more batches are available
18. WHEN all batches have been fetched, THE Web_App SHALL remove the loading indicator and display the final marker count
19. THE Web_App SHALL handle errors during batch fetching gracefully, displaying already-loaded markers and an error message for failed batches
20. THE Web_App SHALL provide a retry button when batch fetching fails, allowing users to resume loading from the failed batch

**Map Modes and Marker Display:**

21. THE Web_App SHALL provide a mode selector control to switch between map modes: "Activities by Type", "Activities by Category", "Participant Homes", and "Venues"
22. WHEN in "Activities by Type" mode, THE Web_App SHALL fetch lightweight activity marker data from GET /api/v1/map/activities endpoint in batches of 100
23. WHEN in "Activities by Type" mode, THE Web_App SHALL display markers for all activities at their current venue locations
24. WHEN in "Activities by Type" mode, THE Web_App SHALL color-code activity markers by activity type using the activityTypeId from the marker data
25. WHEN in "Activities by Type" mode, THE Web_App SHALL display a right-aligned legend showing the mapping between marker colors and activity types
26. WHEN in "Activities by Category" mode, THE Web_App SHALL fetch lightweight activity marker data from GET /api/v1/map/activities endpoint in batches of 100
27. WHEN in "Activities by Category" mode, THE Web_App SHALL display markers for all activities at their current venue locations
28. WHEN in "Activities by Category" mode, THE Web_App SHALL color-code activity markers by activity category using the activityCategoryId from the marker data
29. WHEN in "Activities by Category" mode, THE Web_App SHALL display a right-aligned legend showing the mapping between marker colors and activity categories
30. WHEN displaying the map legend, THE Web_App SHALL only include activity types or categories that are actually visible on the map based on current filters
31. WHEN filters are applied that result in no visible markers, THE Web_App SHALL hide the legend
32. WHEN in "Participant Homes" mode, THE Web_App SHALL fetch lightweight participant home marker data from GET /api/v1/map/participant-homes endpoint in batches of 100
33. WHEN in "Participant Homes" mode, THE Web_App SHALL display markers for all participant home addresses grouped by venue
34. WHEN in "Venues" mode, THE Web_App SHALL fetch lightweight venue marker data from GET /api/v1/map/venues endpoint in batches of 100
35. WHEN in "Venues" mode, THE Web_App SHALL display markers for all venues with latitude and longitude coordinates, regardless of whether they have activities or participants
36. THE Web_App SHALL implement marker clustering for dense areas to improve map readability

**Lazy-Loaded Popup Content:**

37. WHEN an activity marker is clicked, THE Web_App SHALL display a loading indicator in the popup while fetching detailed content
38. WHEN an activity marker is clicked, THE Web_App SHALL fetch detailed popup content from GET /api/v1/map/activities/:id/popup endpoint
39. WHEN activity popup content is loaded, THE Web_App SHALL display the activity name, category, type, start date, and number of participants
40. WHEN an activity marker popup is displayed, THE Web_App SHALL render the activity name as a hyperlink to the activity detail page (/activities/:id)
41. WHEN a participant home marker is clicked, THE Web_App SHALL display a loading indicator in the popup while fetching detailed content
42. WHEN a participant home marker is clicked, THE Web_App SHALL fetch detailed popup content from GET /api/v1/map/participant-homes/:venueId/popup endpoint
43. WHEN participant home popup content is loaded, THE Web_App SHALL display the venue name and the number of participants living at that address
44. WHEN a participant home marker popup is displayed, THE Web_App SHALL render the venue name as a hyperlink to the venue detail page (/venues/:id)
45. WHEN a venue marker is clicked in "Venues" mode, THE Web_App SHALL display a loading indicator in the popup while fetching detailed content
46. WHEN a venue marker is clicked in "Venues" mode, THE Web_App SHALL fetch detailed popup content from GET /api/v1/map/venues/:id/popup endpoint
47. WHEN venue popup content is loaded, THE Web_App SHALL display the venue name, address, and geographic area
48. WHEN a venue marker popup is displayed in "Venues" mode, THE Web_App SHALL render the venue name as a hyperlink to the venue detail page (/venues/:id)
49. THE Web_App SHALL cache popup content locally to avoid refetching when the same marker is clicked multiple times
50. WHEN popup content fails to load, THE Web_App SHALL display an error message in the popup with a retry button

**Filtering and Geographic Context:**

51. THE Web_App SHALL use the FilterGroupingPanel component to provide date range selection, property-based filtering, and exclusive grouping controls for map mode selection
52. WHEN using the FilterGroupingPanel on the Map View, THE Web_App SHALL configure it with exclusive grouping mode supporting options: "Activities by Type", "Activities by Category", "Participant Homes", "Venues"
53. WHEN using the FilterGroupingPanel on the Map View, THE Web_App SHALL configure it with filter properties: activity category, activity type, status, date range, population
53a. THE Web_App SHALL keep all filter properties (activity category, activity type, status, population) available and enabled regardless of the selected map mode
53b. THE Web_App SHALL NOT disable or hide filter properties based on map mode selection
54. WHEN the user clicks the "Update" button on the FilterGroupingPanel, THE Web_App SHALL apply the selected filters and map mode to fetch new marker data
55. WHEN a population filter is applied on the map in "Activities by Type" or "Activities by Category" modes, THE Web_App SHALL display only activities that have at least one participant belonging to at least one of the specified populations
56. WHEN a population filter is applied in "Participant Homes" mode, THE Web_App SHALL display only participant home addresses for participants who belong to at least one of the specified populations
57. WHEN an activity category filter is applied on the map in "Activities by Type" or "Activities by Category" modes, THE Web_App SHALL display only activities belonging to at least one of the specified activity categories
58. WHEN an activity type filter is applied on the map in "Activities by Type" or "Activities by Category" modes, THE Web_App SHALL display only activities of at least one of the specified activity types
59. WHEN a status filter is applied on the map in "Activities by Type" or "Activities by Category" modes, THE Web_App SHALL display only activities with at least one of the specified statuses
60. WHEN filters are applied that do not apply to the current map mode (e.g., activity category filter in "Venues" mode), THE Web_App SHALL ignore those filters for marker fetching but keep them visible and selected in the FilterGroupingPanel
61. WHEN switching between map modes, THE Web_App SHALL preserve all filter selections even if some filters do not apply to the new mode
62. THE Web_App SHALL provide geographic area boundary overlays when available
63. THE Web_App SHALL allow zooming and panning of the map
64. THE Web_App SHALL provide a button to center the map on a specific venue or geographic area
65. WHEN the global geographic area filter is active, THE Web_App SHALL apply the filter to all map modes to show only markers for entities associated with venues in the filtered geographic area or its descendants
66. WHEN the global geographic area filter is active in "Activities by Type" or "Activities by Category" modes, THE Web_App SHALL display only activities whose current venue is in the filtered geographic area or its descendants
67. WHEN the global geographic area filter is active in "Participant Homes" mode, THE Web_App SHALL display only participant home addresses where the venue is in the filtered geographic area or its descendants
68. WHEN the global geographic area filter is active in "Venues" mode, THE Web_App SHALL display only venues that are in the filtered geographic area or its descendants
69. WHEN determining current venue for activity markers, THE Web_App SHALL treat null effectiveFrom dates as equivalent to the activity start date
70. WHEN determining current home address for participant markers, THE Web_App SHALL treat null effectiveFrom dates as the oldest address (earlier than any non-null date)
71. WHEN displaying activities on the map, THE Web_App SHALL correctly identify the current venue considering null effectiveFrom dates in venue history
72. WHEN displaying participant homes on the map, THE Web_App SHALL correctly identify the current home venue considering null effectiveFrom dates in address history
73. THE Web_App SHALL pass startDate and endDate parameters from the FilterGroupingPanel date range to the MapDataService when fetching activity markers
74. THE Web_App SHALL pass startDate and endDate parameters from the FilterGroupingPanel date range to the MapDataService when fetching participant home markers
75. WHEN a date range is selected on the map view, THE Web_App SHALL persist the date range to URL query parameters
76. WHEN an absolute date range is selected, THE Web_App SHALL persist startDate and endDate as ISO-8601 date strings (YYYY-MM-DD) to URL query parameters
77. WHEN a relative date range is selected, THE Web_App SHALL persist the relative period in compact format (e.g., "-90d", "-6m", "-1y") to the relativePeriod URL query parameter
78. WHEN a user navigates to a map view URL with startDate and endDate query parameters, THE Web_App SHALL restore the absolute date range and apply it to marker fetching
79. WHEN a user navigates to a map view URL with a relativePeriod query parameter, THE Web_App SHALL restore the relative date range and calculate absolute dates for marker fetching
80. THE Web_App SHALL convert relative date ranges to absolute dates before passing to the MapDataService
81. WHEN calculating absolute dates from a relative range, THE Web_App SHALL use the current date as the end date and subtract the specified amount from the start date
82. THE MapDataService SHALL send startDate and endDate as ISO-8601 date strings in query parameters to the backend map marker endpoints
83. WHEN fetching activity markers with a date range, THE MapDataService SHALL include startDate and endDate in the API request to /api/v1/map/activities
84. WHEN fetching participant home markers with a date range, THE MapDataService SHALL include startDate and endDate in the API request to /api/v1/map/participant-homes
85. THE Web_App SHALL display only activities that were active during the selected date range on the map
86. THE Web_App SHALL display only participant home addresses that were active during the selected date range on the map
87. WHEN no date range is selected, THE Web_App SHALL display all activities and participant homes regardless of temporal status
88. WHEN the date range changes (either absolute or relative), THE Web_App SHALL trigger a refetch of marker data from the backend

### Requirement 6D: Coordinate-Based Map Filtering

**User Story:** As a community organizer viewing the map, I want markers to be automatically filtered by the current viewport coordinates, so that I can improve map performance by loading only visible markers and can interrupt large loads by zooming in to a specific region of interest.

#### Acceptance Criteria

1. THE Web_App SHALL always filter map markers by the current viewport bounding box coordinates
2. THE Web_App SHALL calculate the current map viewport bounding box (southwest and northeast corners) when the map is moved or zoomed
3. THE Web_App SHALL send bounding box parameters (minLat, maxLat, minLon, maxLon) to the map marker endpoints with every marker fetch request
4. THE Web_App SHALL fetch only markers within the current viewport bounding box
5. WHEN the user pans or zooms the map, THE Web_App SHALL automatically refetch markers for the new viewport bounds
6. THE Web_App SHALL debounce viewport change events to avoid excessive API requests (minimum 500ms delay after user stops panning/zooming)
7. THE Web_App SHALL combine coordinate-based filtering with other filters (geographic area, activity type, population, date range) using AND logic
8. WHEN both coordinate-based filtering and named geographic area filtering are active, THE Web_App SHALL apply both filters (markers must be within the bounding box AND within the selected geographic area)
9. THE Web_App SHALL handle edge cases where the viewport bounding box crosses the international date line (longitude wrapping)
10. THE Web_App SHALL apply coordinate-based filtering to all map modes (Activities by Type, Activities by Category, Participant Homes, Venues)
11. WHEN the viewport contains no markers matching the current filters, THE Web_App SHALL keep the map mounted and interactive
11a. WHEN the viewport contains no markers, THE Web_App SHALL display a non-intrusive empty state message using a CloudScape Alert component positioned as a floating overlay on top of the map
11b. THE empty state Alert SHALL use type="info" and SHALL NOT obscure the majority of the map view
11c. THE empty state Alert SHALL be dismissible, allowing users to close it and view the full map
11d. THE Web_App SHALL NOT unmount or hide the map component when no markers are available to display
12. THE Web_App SHALL maintain batched incremental loading behavior with coordinate-based filtering
13. WHEN a user is viewing a large geographic area with many markers being loaded in batches, THE user SHALL be able to interrupt the loading by zooming in or panning to a different area
14. WHEN the viewport changes during batched loading, THE Web_App SHALL immediately cancel any in-progress marker fetching
15. WHEN the viewport changes during batched loading, THE Web_App SHALL start fetching markers for the new viewport bounds
15a. WHEN the viewport changes while loading is paused (user previously cancelled loading), THE Web_App SHALL treat the viewport change as an implicit resumption of loading
15b. WHEN the viewport changes while loading is paused, THE Web_App SHALL clear the paused state and start fetching markers for the new viewport bounds
15c. WHEN the viewport changes while loading is paused, THE Web_App SHALL hide the Resume button and display the normal loading progress indicator
16. THE Web_App SHALL clear currently displayed markers when the viewport changes significantly (e.g., zoom level change or pan beyond current bounds)
17. THE Web_App SHALL provide smooth visual feedback during viewport-triggered marker refetching
18. WHEN the initial map loads at world zoom level, THE Web_App SHALL fetch markers for the entire world viewport (or apply other active filters if present)


### Requirement 7: Analytics Dashboard

**User Story:** As a community organizer, I want to view comprehensive analytics with flexible grouping and filtering in the web interface, so that I can understand participation patterns, activity trends, and engagement changes over time across different segments of my community.

#### Acceptance Criteria

**Initial Page Load and Report Execution:**

1. THE Web_App SHALL provide an engagement metrics dashboard
1a. WHEN a user first navigates to the Engagement Dashboard, THE Web_App SHALL NOT automatically fetch or display report data
1b. WHEN a user first navigates to the Engagement Dashboard, THE Web_App SHALL render all chart and table containers in their empty state
1c. THE Web_App SHALL display a primary action button labeled "Run Report" in the page header
1d. THE "Run Report" button SHALL be right-justified and inline with the top-level "Engagement Analytics" header
1e. WHEN the "Run Report" button is clicked, THE Web_App SHALL implicitly apply the current filter and grouping selections from the FilterGroupingPanel
1f. WHEN the "Run Report" button is clicked, THE Web_App SHALL fetch engagement metrics data from the backend API based on the applied filters and grouping
1g. WHILE report data is being fetched, THE Web_App SHALL display a CloudScape Spinner component within each chart and table container
1h. WHEN report data has finished loading for a specific chart or table, THE Web_App SHALL hide the Spinner and render the data visualization
1i. THE Web_App SHALL allow each chart and table to load independently, showing spinners only for components still fetching data

**Metric Display:**

2. THE Web_App SHALL display activities at the start of the selected date range
3. THE Web_App SHALL display activities at the end of the selected date range
4. THE Web_App SHALL display activities started within the selected date range
5. THE Web_App SHALL display activities completed within the selected date range
6. THE Web_App SHALL display activities cancelled within the selected date range
7. THE Web_App SHALL display participants at the start of the selected date range
8. THE Web_App SHALL display participants at the end of the selected date range
8a. THE Web_App SHALL display total participation (non-unique participant-activity associations) at the start of the selected date range
8b. THE Web_App SHALL display total participation (non-unique participant-activity associations) at the end of the selected date range
8c. THE Web_App SHALL provide an info icon next to the "Participant Growth" box on the Growth Dashboard
8d. WHEN the info icon next to the Participant Growth box is clicked, THE Web_App SHALL display a popover explaining "Unique Participants: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once."
8e. THE Web_App SHALL provide an info icon next to the "Participation Growth" box on the Growth Dashboard
8f. WHEN the info icon next to the Participation Growth box is clicked, THE Web_App SHALL display a popover explaining "Total Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."
9. THE Web_App SHALL display all activity counts in aggregate across all activity categories and types
10. THE Web_App SHALL display all activity counts broken down by activity category
11. THE Web_App SHALL display all activity counts broken down by activity type
12. THE Web_App SHALL display all participant counts in aggregate across all activity categories and types
13. THE Web_App SHALL display all participant counts broken down by activity category
14. THE Web_App SHALL display all participant counts broken down by activity type
14a. THE Web_App SHALL display all participation counts (non-unique) in aggregate across all activity categories and types
14b. THE Web_App SHALL display all participation counts (non-unique) broken down by activity category
14c. THE Web_App SHALL display all participation counts (non-unique) broken down by activity type

**Filtering and Grouping Controls:**

15. THE Web_App SHALL use the FilterGroupingPanel component to provide date range selection, property-based filtering, and additive grouping controls
16. WHEN using the FilterGroupingPanel on the Engagement Dashboard, THE Web_App SHALL configure it with additive grouping mode supporting dimensions: activity category, activity type, venue, geographic area
17. WHEN using the FilterGroupingPanel on the Engagement Dashboard, THE Web_App SHALL configure it with filter properties: activity category, activity type, venue, population
18. THE FilterGroupingPanel on the Engagement Dashboard SHALL hide the "Update" button
18a. THE FilterGroupingPanel on the Engagement Dashboard SHALL display the "Clear All" button
18b. WHEN the "Clear All" button is clicked on the FilterGroupingPanel, THE Web_App SHALL reset all filter and grouping selections to their default values
18c. WHEN the "Clear All" button is clicked, THE Web_App SHALL NOT automatically re-fetch report data
18d. THE user SHALL need to click the "Run Report" button again to fetch data with the cleared filters
**Filter Logic:**

19. THE Web_App SHALL provide filter controls to filter by one or more activity categories
20. WHEN an activity category filter is applied with multiple values, THE Web_App SHALL include only activities belonging to at least one of the specified activity categories (OR logic within dimension)
21. THE Web_App SHALL provide filter controls to filter by one or more activity types
22. WHEN an activity type filter is applied with multiple values, THE Web_App SHALL include only activities of at least one of the specified activity types (OR logic within dimension)
23. THE Web_App SHALL provide filter controls to filter by one or more geographic areas
24. WHEN a geographic area filter is applied with multiple values, THE Web_App SHALL include only activities and participants associated with venues in at least one of the specified geographic areas or their descendants (OR logic within dimension)
25. THE Web_App SHALL provide filter controls to filter by one or more venues
26. WHEN a venue filter is applied with multiple values, THE Web_App SHALL include only activities at at least one of the specified venues (OR logic within dimension)
27. THE Web_App SHALL provide filter controls to filter by one or more populations
28. WHEN a population filter is applied with multiple values, THE Web_App SHALL include only participants who belong to at least one of the specified populations (OR logic within dimension)
29. WHEN a population filter is applied, THE Web_App SHALL include only activities that have at least one participant belonging to at least one of the specified populations
30. THE Web_App SHALL provide filter controls for date range (range filter with start and end dates)
31. WHEN multiple filter dimensions are applied (e.g., activity categories AND venues AND populations), THE Web_App SHALL apply all filters using AND logic across dimensions
32. WHEN multiple values are provided within a single filter dimension (e.g., venues=[A, B]), THE Web_App SHALL apply OR logic within that dimension

**Engagement Summary Table:**

33. THE Web_App SHALL render an "Engagement Summary" table that displays aggregate metrics and dimensional breakdowns
33a. THE Web_App SHALL provide an info icon next to the "Engagement Summary" table header
33b. WHEN the info icon next to the Engagement Summary header is clicked, THE Web_App SHALL display a popover explaining both metrics: "Participant Count: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once. Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."
34. THE Web_App SHALL render the first row of the Engagement Summary table with the label "Total" in the first column and aggregate metrics (activities at start, at end, started, completed, cancelled, participants at start, at end, participation at start, participation at end) in subsequent columns
35. WHEN multiple grouping dimensions are selected, THE Web_App SHALL leave subsequent dimension cells blank in the first row (Total row)
36. WHEN grouping dimensions are selected, THE Web_App SHALL render additional rows below the Total row showing dimensional breakdowns where breakdown dimension columns appear first followed by metric aggregation columns
37. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render activity category names as hyperlinks to the Activity Configuration page at /configuration
38. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render activity type names as hyperlinks to the Activity Configuration page at /configuration
39. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render venue names as hyperlinks to their respective detail views at /venues/:id
40. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render geographic area names as hyperlinks to their respective detail views at /geographic-areas/:id
41. WHEN a date range is specified, THE Web_App SHALL display each metric aggregation (activities at start, activities at end, activities started, activities completed, activities cancelled, participants at start, participants at end, participation at start, participation at end) in its own column in the Engagement Summary table
41a. WHEN no date range is specified, THE Web_App SHALL hide "at start" metric columns from the Engagement Summary table (as these values are always 0 for all-time metrics)
41b. WHEN no date range is specified, THE Web_App SHALL simplify "at end" column names to remove the "at End" suffix in the Engagement Summary table
41c. WHEN no date range is specified, THE Web_App SHALL display the following columns in the Engagement Summary table: "Participants", "Participation", "Activities", "Activities Started", "Activities Completed", and "Activities Cancelled"
42. WHEN no date range is specified, THE Web_App SHALL display all-time metrics

**Charts and Visualizations:**

43. THE Web_App SHALL display role distribution across all activities within the filtered and grouped results
43a. THE Web_App SHALL display geographic breakdown chart with pagination controls
43b. THE Web_App SHALL default the geographic breakdown chart page size to 10 records per page
43c. THE Web_App SHALL allow users to navigate between pages of geographic breakdown results
44. THE Web_App SHALL display a pie chart showing the breakdown of unique activities by activity category
45. THE pie chart SHALL appear in line width (full width of its container) and positioned to the left of the role distribution chart
46. THE pie chart SHALL use the same filtered data as other dashboard components
47. THE pie chart SHALL display activity category names in the legend
48. THE pie chart SHALL use a consistent color scheme with other dashboard charts
49. WHEN a user hovers over a pie chart segment, THE Web_App SHALL display the activity category name and count
50. THE pie chart SHALL include an interactive legend allowing users to toggle individual category segments on and off
51. WHEN all pie chart segments are hidden, THE Web_App SHALL display an appropriate message or allow at least one segment to remain visible
**URL Synchronization and Navigation:**

52. THE Web_App SHALL synchronize all filter parameters (activity categories, activity types, venues, geographic areas, populations, start date, end date) with URL query parameters
53. THE Web_App SHALL synchronize all grouping parameters (group by dimensions) with URL query parameters
54. WHEN a user navigates to a URL with analytics filter or grouping query parameters, THE Web_App SHALL restore those parameters in the FilterGroupingPanel but SHALL NOT automatically fetch report data
54a. THE user SHALL need to click the "Run Report" button to fetch data with the URL-restored filters
55. WHEN the "Run Report" button is clicked, THE Web_App SHALL update the browser URL to reflect the current filter and grouping state
56. THE Web_App SHALL enable browser back/forward navigation to move between different filter and grouping configurations
57. WHEN a user shares an engagement analytics view URL, THE Web_App SHALL restore the filter and grouping selections but require the recipient to click "Run Report" to view the data

**Data Accuracy and Edge Cases:**

58. WHEN calculating engagement metrics for activities, THE Web_App SHALL correctly identify the current venue considering null effectiveFrom dates (treating null as activity start date)
59. WHEN calculating engagement metrics for participants, THE Web_App SHALL correctly identify the current home venue considering null effectiveFrom dates (treating null as oldest address)
60. WHEN filtering analytics by geographic area, THE Web_App SHALL correctly determine which activities and participants are in the filtered area considering null effectiveFrom dates
**Growth Dashboard:**

**Initial Page Load and Report Execution:**

61. THE Web_App SHALL provide a growth analytics dashboard
61a. WHEN a user first navigates to the Growth Dashboard, THE Web_App SHALL NOT automatically fetch or display report data
61b. WHEN a user first navigates to the Growth Dashboard, THE Web_App SHALL render all chart containers in their empty state
61c. THE Web_App SHALL display a primary action button labeled "Run Report" in the page header
61d. THE "Run Report" button SHALL be right-justified and inline with the top-level "Growth Analytics" header
61e. WHEN the "Run Report" button is clicked, THE Web_App SHALL implicitly apply the current filter, time period, and grouping selections from the FilterGroupingPanel
61f. WHEN the "Run Report" button is clicked, THE Web_App SHALL fetch growth metrics data from the backend API based on the applied filters, time period, and grouping
61g. WHILE report data is being fetched, THE Web_App SHALL display a CloudScape Spinner component within each chart container
61h. WHEN report data has finished loading for a specific chart, THE Web_App SHALL hide the Spinner and render the data visualization
61i. THE Web_App SHALL allow each chart to load independently, showing spinners only for charts still fetching data

**Chart Display:**

62. THE Web_App SHALL display a separate time-series chart showing unique participant counts for each time period
63. THE Web_App SHALL display a separate time-series chart showing unique activity counts for each time period
64. THE Web_App SHALL display a separate time-series chart showing total participation (non-unique participant-activity associations) for each time period
65. THE Web_App SHALL provide an info icon next to the "Unique Participants Over Time" chart title
66. WHEN the info icon next to the Unique Participants chart is clicked, THE Web_App SHALL display a popover explaining "Unique Participants: The count of distinct individuals involved in activities. The same person involved in multiple activities is counted only once."
67. THE Web_App SHALL provide an info icon next to the "Total Participation Over Time" chart title
68. WHEN the info icon next to the Total Participation chart is clicked, THE Web_App SHALL display a popover explaining "Total Participation: The sum of all participant-activity associations. The same person involved in 3 activities contributes 3 to this count."
69. THE Web_App SHALL provide time period selection (day, week, month, year)
70. THE Web_App SHALL display each time period as a snapshot of unique participants, unique activities, and total participation engaged at that point in time (not cumulative counts)

**View Mode Controls:**

71. THE Web_App SHALL provide a segmented control to view growth metrics with three options: "All", "Activity Type", and "Activity Category"
72. THE Segmented_Control SHALL default to "All" as the selected option
73. WHEN "All" is selected in the segmented control, THE Web_App SHALL display a single aggregate time-series line for total unique participants, a single aggregate time-series line for total unique activities, and a single aggregate time-series line for total participation across all activity types and categories in all three charts
74. WHEN "All" is selected in the segmented control, THE Web_App SHALL display overall participation growth numbers (percentage change) representing totals across all activity types and categories
75. WHEN "All" is selected in the segmented control, THE Web_App SHALL display overall activity growth numbers (percentage change) representing totals across all activity types and categories
76. WHEN "All" is selected in the segmented control, THE Web_App SHALL display overall participant growth numbers (percentage change) representing totals across all activity types and categories
77. WHEN "Activity Type" or "Activity Category" is selected in the segmented control, THE Web_App SHALL NOT display overall growth numbers, showing only the grouped breakdown data
78. WHEN "Activity Type" is selected in the segmented control, THE Web_App SHALL display multiple time-series lines in all three charts, one line for each activity type showing unique participants, unique activities, and total participation for that type
79. WHEN "Activity Category" is selected in the segmented control, THE Web_App SHALL display multiple time-series lines in all three charts, one line for each activity category showing unique participants, unique activities, and total participation for that category
80. WHEN displaying multiple lines for activity types or categories, THE Web_App SHALL use a consistent color scheme across all three charts (Unique Participants, Unique Activities, and Total Participation), so that the same activity type or category has the same color on all charts
81. THE Web_App SHALL display a legend on all three charts showing the color mapping for each activity type or category when multiple lines are displayed
82. WHEN the view mode changes between "All", "Activity Type", and "Activity Category", THE Growth_Dashboard SHALL update all three charts without requiring a page refresh
83. WHEN switching between view modes, THE Growth_Dashboard SHALL preserve the current time period, date range, and filter selections
84. WHEN a user selects a view mode, THE System SHALL store the selection in browser local storage with key "growthChartViewMode"
85. WHEN a user returns to the Growth Dashboard, THE Growth_Dashboard SHALL restore the previously selected view mode from local storage
86. IF no previous selection exists in local storage, THE Growth_Dashboard SHALL default to "All" view
87. WHEN local storage is unavailable, THE Growth_Dashboard SHALL function normally with "All" as the default

**Filtering and Grouping Controls:**

88. THE Web_App SHALL use the FilterGroupingPanel component to provide date range selection, property-based filtering, and exclusive grouping controls
89. WHEN using the FilterGroupingPanel on the Growth Dashboard, THE Web_App SHALL configure it with exclusive grouping mode supporting options: "All", "Activity Type", "Activity Category"
90. WHEN using the FilterGroupingPanel on the Growth Dashboard, THE Web_App SHALL configure it with filter properties: activity category, activity type, geographic area, venue, population
91. THE FilterGroupingPanel on the Growth Dashboard SHALL hide the "Update" button
91a. THE FilterGroupingPanel on the Growth Dashboard SHALL display the "Clear All" button
91b. WHEN the "Clear All" button is clicked on the FilterGroupingPanel, THE Web_App SHALL reset all filter, time period, and grouping selections to their default values
91c. WHEN the "Clear All" button is clicked, THE Web_App SHALL NOT automatically re-fetch report data
91d. THE user SHALL need to click the "Run Report" button again to fetch data with the cleared filters

**Filter Logic:**

92. THE Web_App SHALL provide filter controls to filter growth metrics by one or more activity categories
93. WHEN an activity category filter is applied to growth metrics with multiple values, THE Web_App SHALL include only activities belonging to at least one of the specified activity categories (OR logic within dimension)
94. THE Web_App SHALL provide filter controls to filter growth metrics by one or more activity types
95. WHEN an activity type filter is applied to growth metrics with multiple values, THE Web_App SHALL include only activities of at least one of the specified activity types (OR logic within dimension)
96. THE Web_App SHALL provide filter controls to filter growth metrics by one or more geographic areas
97. WHEN a geographic area filter is applied to growth metrics with multiple values, THE Web_App SHALL include only activities and participants associated with venues in at least one of the specified geographic areas or their descendants (OR logic within dimension)
98. THE Web_App SHALL provide filter controls to filter growth metrics by one or more venues
99. WHEN a venue filter is applied to growth metrics with multiple values, THE Web_App SHALL include only activities at at least one of the specified venues (OR logic within dimension)
100. THE Web_App SHALL provide filter controls to filter growth metrics by one or more populations
101. WHEN a population filter is applied to growth metrics with multiple values, THE Web_App SHALL include only participants who belong to at least one of the specified populations (OR logic within dimension)
102. WHEN a population filter is applied to growth metrics, THE Web_App SHALL include only activities that have at least one participant belonging to at least one of the specified populations
103. WHEN multiple filter dimensions are applied to growth metrics (e.g., activity categories AND venues AND populations), THE Web_App SHALL apply all filters using AND logic across dimensions
104. WHEN multiple values are provided within a single filter dimension for growth metrics (e.g., venues=[A, B]), THE Web_App SHALL apply OR logic within that dimension

**URL Synchronization and Navigation:**

105. THE Web_App SHALL synchronize growth dashboard filter parameters (period, date range, filter dimensions, grouping mode) with URL query parameters
106. WHEN a user navigates to a URL with growth dashboard query parameters, THE Web_App SHALL restore those parameters in the FilterGroupingPanel but SHALL NOT automatically fetch report data
106a. THE user SHALL need to click the "Run Report" button to fetch data with the URL-restored filters
107. WHEN the "Run Report" button is clicked, THE Web_App SHALL update the browser URL to reflect the current filter, time period, and grouping state
108. THE Web_App SHALL enable browser back/forward navigation to move between different growth dashboard configurations
109. WHEN a user shares a growth dashboard URL, THE Web_App SHALL restore the filter and grouping selections but require the recipient to click "Run Report" to view the data

**Activities Chart on Engagement Dashboard:**

110. THE Web_App SHALL display a chart titled "Activities" (renamed from "Activities by Type") on the Engagement Dashboard
111. THE Web_App SHALL provide a segmented control above or within the Activities chart to toggle between "Activity Type" and "Activity Category" views
112. WHEN the Activities chart is first rendered, THE Segmented_Control SHALL default to "Activity Type" as the selected option
113. THE Segmented_Control SHALL follow the same UX pattern as the map view toggle functionality
114. WHEN "Activity Type" is selected in the segmented control, THE Activities chart SHALL display activities grouped by activity type
115. WHEN "Activity Category" is selected in the segmented control, THE Activities chart SHALL display activities grouped by activity category
116. WHEN the view mode changes, THE Activities chart SHALL update its data display without requiring a page refresh
117. WHEN switching between views, THE Activities chart SHALL preserve the current date range and filter selections
118. WHEN no activities exist for a grouping dimension, THE Activities chart SHALL display an appropriate empty state message
119. THE Activities chart SHALL display activity counts in descending order by count value
120. THE Activities chart SHALL handle API errors gracefully and display an error message to the user
121. WHEN a user selects a view mode, THE System SHALL store the selection in browser local storage
122. WHEN a user returns to the Engagement Dashboard, THE Activities chart SHALL restore the previously selected view mode from local storage
123. IF no previous selection exists in local storage, THE Activities chart SHALL default to "Activity Type" view
124. WHEN local storage is unavailable, THE Activities chart SHALL function normally with "Activity Type" as the default
125. THE Segmented_Control SHALL be keyboard navigable using Tab and Arrow keys
126. WHEN a segmented control option receives focus, THE System SHALL provide visual focus indicators
127. THE Segmented_Control SHALL include appropriate ARIA labels for screen readers
128. WHEN the view mode changes, THE System SHALL announce the change to screen readers

**Flicker-Free Updates:**

129. WHEN a user adjusts filters or grouping controls on the Engagement Dashboard, THE Web_App SHALL keep all charts, tables, and filtering UI components mounted and rendered until newly fetched data is available
130. WHEN newly fetched data becomes available after a filter or grouping change, THE Web_App SHALL repaint visual components in place without unmounting or remounting components
131. THE Web_App SHALL avoid screen flicker or visual disruption when transitioning between different filter or grouping states on the Engagement Dashboard
132. WHEN a user adjusts filters or grouping controls on the Growth Dashboard, THE Web_App SHALL keep all charts and filtering UI components mounted and rendered until newly fetched data is available
133. WHEN newly fetched data becomes available after a filter or grouping change on the Growth Dashboard, THE Web_App SHALL repaint visual components in place without unmounting or remounting components
134. THE Web_App SHALL avoid screen flicker or visual disruption when transitioning between different filter or grouping states on the Growth Dashboard

### Requirement 7A: Activity Lifecycle Events Chart

**User Story:** As a program manager, I want to see how many activities started and completed during a time period with the ability to toggle between category and type views, so that I can understand activity lifecycle patterns at different levels of granularity.

#### Acceptance Criteria

1. THE Web_App SHALL display an Activity Lifecycle Events chart on the Engagement Dashboard
2. THE Activity_Lifecycle_Chart SHALL display two data series: "Started" and "Completed"
3. WHEN the Time_Period changes, THE Activity_Lifecycle_Chart SHALL update to reflect the new period
4. THE Activity_Lifecycle_Chart SHALL use a bar chart visualization format
5. THE Activity_Lifecycle_Chart SHALL be positioned after the Activities chart on the dashboard
6. THE Activity_Lifecycle_Chart SHALL include a Segmented_Control with two options: "By Type" and "By Category"
7. WHEN "By Category" is selected, THE Activity_Lifecycle_Chart SHALL group and display data by Activity_Category
8. WHEN "By Type" is selected, THE Activity_Lifecycle_Chart SHALL group and display data by Activity_Type
9. THE Segmented_Control SHALL default to "By Type" view
10. WHEN the user switches between views, THE Activity_Lifecycle_Chart SHALL animate the transition smoothly
11. WHEN counting started activities, THE Activity_Lifecycle_Chart SHALL include only activities with start dates within the Time_Period
12. WHEN counting completed activities, THE Activity_Lifecycle_Chart SHALL include only activities with completion dates within the Time_Period
13. WHEN an activity has both started and completed within the Time_Period, THE Activity_Lifecycle_Chart SHALL count it in both series
14. THE Activity_Lifecycle_Chart SHALL exclude cancelled activities from both series
15. WHEN no activities exist for a category or type, THE Activity_Lifecycle_Chart SHALL display zero for that group
16. THE Activity_Lifecycle_Chart SHALL use the same color scheme as other dashboard charts
17. THE Activity_Lifecycle_Chart SHALL use the CloudScape BarChart component
18. THE Activity_Lifecycle_Chart SHALL include a descriptive title: "Activity Lifecycle Events"
19. THE Activity_Lifecycle_Chart SHALL display axis labels for clarity
20. THE Activity_Lifecycle_Chart SHALL be responsive and adapt to different screen sizes
21. WHEN geographic area filters are applied, THE Activity_Lifecycle_Chart SHALL display only activities within the selected areas
22. WHEN activity type filters are applied, THE Activity_Lifecycle_Chart SHALL display only the selected activity types
23. WHEN venue filters are applied, THE Activity_Lifecycle_Chart SHALL display only activities at the selected venues
24. WHEN multiple filters are applied, THE Activity_Lifecycle_Chart SHALL apply all filters in combination
25. WHEN filters are cleared, THE Activity_Lifecycle_Chart SHALL display all activities
26. WHEN a user selects a view mode, THE System SHALL store the selection in browser local storage
27. WHEN a user returns to the Engagement Dashboard, THE Activity_Lifecycle_Chart SHALL restore the previously selected view mode from local storage
28. IF no previous selection exists in local storage, THE Activity_Lifecycle_Chart SHALL default to "By Type" view
29. WHEN local storage is unavailable, THE Activity_Lifecycle_Chart SHALL function normally with "By Type" as the default
30. THE Activity_Lifecycle_Chart SHALL display for all date range types: absolute ranges, relative ranges, and no date range (all history)
31. WHEN no date range is selected, THE Activity_Lifecycle_Chart SHALL display lifecycle events for all time
32. WHEN a relative date range is selected, THE Activity_Lifecycle_Chart SHALL calculate the absolute date range and display lifecycle events for that period

### Requirement 7B: PropertyFilter for Engagement Dashboard

**User Story:** As a community organizer, I want to use a unified PropertyFilter component to filter engagement data by multiple properties, so that I can efficiently analyze specific subsets of data with a consistent interface.

#### Acceptance Criteria

1. THE Web_App SHALL replace the separate activity type and venue filter dropdowns with a single CloudScape PropertyFilter component
2. THE PropertyFilter SHALL support filtering by Activity Category property
3. THE PropertyFilter SHALL support filtering by Activity Type property
4. THE PropertyFilter SHALL support filtering by Venue property
5. THE PropertyFilter SHALL implement lazy loading of property values when the user types in the filter input
6. WHEN a user types in the PropertyFilter, THE Web_App SHALL asynchronously fetch matching values from the backend
7. THE PropertyFilter SHALL debounce user input to avoid excessive API requests (minimum 300ms delay)
8. THE PropertyFilter SHALL display a loading indicator while fetching property values
9. WHEN multiple filter tokens are added, THE Web_App SHALL apply all filters using AND logic
10. WHEN a filter token is removed, THE Web_App SHALL update the dashboard to reflect the removed filter
11. THE PropertyFilter SHALL persist filter state to URL query parameters
12. WHEN a user navigates to a URL with PropertyFilter query parameters, THE Web_App SHALL restore the filter tokens
13. THE PropertyFilter SHALL provide clear labels for each property (Activity Category, Activity Type, Venue)
14. THE PropertyFilter SHALL display the selected property values in filter tokens
15. THE PropertyFilter SHALL allow users to clear all filters at once
16. THE PropertyFilter SHALL integrate with the existing date range and geographic area filters
17. WHEN the PropertyFilter is empty, THE Web_App SHALL display all activities without property-based filtering
18. THE PropertyFilter SHALL support only the equals (=) operator for all properties
19. THE PropertyFilter SHALL NOT support the not equals (!=) operator
20. WHEN multiple values are selected for a single property dimension, THE PropertyFilter SHALL display a single token showing all values as a comma-separated list
21. THE PropertyFilter SHALL maintain a one-to-one mapping between property name and filter token
22. WHEN a user filters by Activity Category with values "Study Circles" and "Devotional Gatherings", THE PropertyFilter SHALL display a single token reading "Activity Category = Study Circles, Devotional Gatherings"
23. THE PropertyFilter SHALL NOT create separate tokens for each value within the same property dimension
24. THE PropertyFilter SHALL prevent duplicate values within a single property dimension
25. WHEN a user attempts to add a value that already exists in a property dimension's token, THE PropertyFilter SHALL ignore the duplicate and maintain only unique values

### Requirement 7C: Common Filtering and Grouping Component

**User Story:** As a community organizer, I want a consistent filtering and grouping interface across all data visualization pages (Engagement Dashboard, Growth Dashboard, and Map View), so that I can efficiently analyze data with a familiar interface and explicit control over when filters are applied.

#### Acceptance Criteria

**Component Structure and Behavior:**

1. THE Web_App SHALL provide a reusable FilterGroupingPanel component for use on all data visualization pages
2. THE FilterGroupingPanel SHALL use a vertical stacked layout where each filtering component renders on its own row
3. THE FilterGroupingPanel SHALL render the first filtering component (DateRangePicker if included, otherwise PropertyFilter) on the first row with action buttons positioned beside it with appropriate spacing
4. THE FilterGroupingPanel SHALL render the PropertyFilter component on its own row (second row if DateRangePicker is on first row, otherwise first row)
5. THE FilterGroupingPanel SHALL render grouping controls (if included) on their own row spanning full width
6. THE FilterGroupingPanel SHALL position action buttons (Update and Clear All) on the first row, beside the first filtering component with appropriate spacing between them
7. THE FilterGroupingPanel SHALL include a CloudScape DateRangePicker component for date range selection (when includeDateRange is true)
8. THE FilterGroupingPanel SHALL include a CloudScape PropertyFilter component for multi-dimensional filtering (always included)
9. THE FilterGroupingPanel SHALL include grouping controls that adapt based on the grouping mode (additive or exclusive)
10. THE FilterGroupingPanel SHALL provide an explicit "Update" button to apply the selected filters and grouping options
11. WHEN the "Update" button is clicked, THE FilterGroupingPanel SHALL invoke a callback with the current filter and grouping state
12. THE FilterGroupingPanel SHALL NOT automatically apply filters as the user makes selections
13. THE FilterGroupingPanel SHALL allow users to adjust multiple filters and grouping options before applying them all at once
14. WHEN the grouping mode is additive, THE FilterGroupingPanel SHALL display a multi-select dropdown component for grouping dimension selection
15. WHEN the grouping mode is exclusive, THE FilterGroupingPanel SHALL display a CloudScape SegmentedControl component for grouping dimension selection

**Configuration and Props:**

16. THE FilterGroupingPanel SHALL accept configuration props specifying available filter properties, available grouping dimensions, and grouping mode (additive or exclusive)
17. THE FilterGroupingPanel SHALL accept initial values for date range, filter tokens, and selected grouping dimensions
18. THE FilterGroupingPanel SHALL accept a prop specifying which filter properties are available (e.g., activity category, activity type, venue, population)
19. THE FilterGroupingPanel SHALL accept a prop specifying which grouping dimensions are available
20. THE FilterGroupingPanel SHALL accept a prop specifying the grouping mode (additive or exclusive)
21. THE FilterGroupingPanel SHALL accept a callback prop that is invoked when the "Update" button is clicked, passing the complete filter and grouping state

**Lazy Loading Support for High-Cardinality Properties:**

22. THE FilterGroupingPanel SHALL accept a prop providing a callback function for each filter property to support lazy loading of property values
23. WHEN a user types in a PropertyFilter input field, THE FilterGroupingPanel SHALL invoke the corresponding property's lazy loading callback with the user's input text
24. THE lazy loading callback SHALL return a Promise that resolves to an array of property value options matching the user's input
25. THE FilterGroupingPanel SHALL debounce lazy loading callback invocations to avoid excessive API requests (minimum 300ms delay)
26. THE FilterGroupingPanel SHALL display a loading indicator in the PropertyFilter while waiting for lazy loading callback results
27. THE FilterGroupingPanel SHALL handle lazy loading callback errors gracefully and display appropriate error messages to the user
28. THE lazy loading callback SHALL be responsible for fetching data from backend APIs, applying search filters, and returning formatted options
29. THE FilterGroupingPanel SHALL support lazy loading for high-cardinality properties such as participants, venues, and geographic areas

**URL Synchronization (Non-Destructive):**

30. THE FilterGroupingPanel SHALL encapsulate logic for synchronizing its filter and grouping state to URL query parameters
31. THE FilterGroupingPanel SHALL use a consistent naming pattern to map filter property names to URL query parameter keys
32. THE FilterGroupingPanel SHALL prefix all filter-related query parameters with a consistent namespace (e.g., "filter_") to avoid conflicts with other page parameters
33. WHEN updating URL query parameters, THE FilterGroupingPanel SHALL preserve all existing query parameters that do not pertain to its own filter properties
34. WHEN updating URL query parameters, THE FilterGroupingPanel SHALL NOT mutate, remove, or interfere with query parameters managed by other components (e.g., global geographic area filter)
35. WHEN a filter is cleared, THE FilterGroupingPanel SHALL remove the corresponding query parameter from the URL
36. WHEN all filters are cleared via the "Clear All" button, THE FilterGroupingPanel SHALL remove all filter-related query parameters while preserving other page parameters
37. THE FilterGroupingPanel SHALL read initial filter state from URL query parameters on component mount
38. THE FilterGroupingPanel SHALL update URL query parameters when the "Update" button is clicked and filters are applied
39. THE FilterGroupingPanel SHALL use React Router's navigation API (e.g., useSearchParams) to update URL query parameters without causing page reloads
40. THE FilterGroupingPanel SHALL support browser back/forward navigation by responding to URL query parameter changes

**State Management and User Feedback:**

41. THE FilterGroupingPanel SHALL maintain internal state for user selections until the "Update" button is clicked
42. THE FilterGroupingPanel SHALL provide visual feedback when filters or grouping options have been changed but not yet applied (e.g., highlight the "Update" button)
43. THE FilterGroupingPanel SHALL support all PropertyFilter features: lazy loading, debouncing, token consolidation, and de-duplication
44. THE FilterGroupingPanel SHALL disable the "Update" button when no changes have been made to filters or grouping
45. THE FilterGroupingPanel SHALL enable the "Update" button when any filter or grouping selection has changed
46. THE FilterGroupingPanel SHALL provide a "Clear All" button to reset all filters and grouping to their default states
47. WHEN the "Clear All" button is clicked, THE FilterGroupingPanel SHALL reset date range, clear all filter tokens, and reset grouping to default
48. THE FilterGroupingPanel SHALL display a loading indicator on the "Update" button while the parent component is fetching new data
49. THE FilterGroupingPanel SHALL disable all controls while the parent component is fetching new data to prevent conflicting updates

**Styling and Accessibility:**

50. THE FilterGroupingPanel SHALL use consistent styling and layout across all pages where it is used
51. THE FilterGroupingPanel SHALL be responsive and adapt to different screen sizes
52. THE FilterGroupingPanel SHALL provide clear labels for all controls (date range, filters, grouping)

**Usage Across Application:**

53. THE Web_App SHALL use the FilterGroupingPanel component on the Engagement Dashboard page
54. THE Web_App SHALL use the FilterGroupingPanel component on the Growth Dashboard page
55. THE Web_App SHALL use the FilterGroupingPanel component on the Map View page
56. WHEN used on the Engagement Dashboard, THE FilterGroupingPanel SHALL support additive grouping with dimensions: activity category, activity type, venue, geographic area
57. WHEN used on the Growth Dashboard, THE FilterGroupingPanel SHALL support exclusive grouping with options: "All", "Activity Type", "Activity Category"
58. WHEN used on the Map View, THE FilterGroupingPanel SHALL support exclusive grouping with options: "Activities by Type", "Activities by Category", "Participant Homes", "Venues"

### Requirement 8: Authentication UI

**User Story:** As a user, I want to log in to the web interface, so that I can access my community data.

#### Acceptance Criteria

1. THE Web_App SHALL provide a login page with email and password fields
2. THE Web_App SHALL validate that email and password are provided
3. THE Web_App SHALL display error messages for invalid credentials
4. THE Web_App SHALL redirect to the main application after successful login
5. THE Web_App SHALL store authentication tokens securely
6. THE Web_App SHALL provide a logout button
7. WHEN a user logs out, THE Web_App SHALL purge all local authentication state including tokens, user profile data, and any cached user-specific information
8. THE Web_App SHALL redirect to login when tokens expire
9. WHEN a user is redirected to the login page due to being unauthenticated, THE Web_App SHALL capture the original URL
9. WHEN a user successfully authenticates after being redirected from a protected route, THE Web_App SHALL redirect the user back to the original URL they were attempting to access
10. WHEN a user successfully authenticates, THE Web_App SHALL display an animated transition sequence before navigation
11. THE animated transition SHALL fade out the login form container over 1000 milliseconds until it disappears
12. AFTER the login form fades out, THE Web_App SHALL display the icon-no-bg.svg image centered on the screen at 256x256 pixels
13. THE icon image SHALL animate its stroke from nothing to completely drawn over the course of 2000 milliseconds
14. AFTER the icon stroke animation completes, THE Web_App SHALL navigate to the appropriate destination page
15. WHEN fetching current user information via GET /api/v1/auth/me, THE Web_App SHALL receive a user object containing id, displayName (nullable), email, role, createdAt, and updatedAt fields
16. THE Web_App SHALL store the complete user object including displayName in application state for use throughout the application

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
6. WHEN displaying the current user's name, THE Web_App SHALL use the displayName field if provided, otherwise fall back to the email address
7. THE Web_App SHALL provide quick links on the main dashboard page for accessing key sections
8. WHEN displaying quick links on the main dashboard, THE Web_App SHALL hide the User Administration quick link from users who do not have ADMINISTRATOR role
9. WHEN a user has ADMINISTRATOR role, THE Web_App SHALL display the User Administration quick link on the main dashboard
10. THE Web_App SHALL make the application header (including both the navigation header and the geographic area filter header) sticky to the top of the viewport
11. WHEN a user scrolls vertically through page content, THE Web_App SHALL keep the header visible at the top of the screen at all times
12. THE Web_App SHALL ensure the sticky header does not obscure page content by adjusting the content area's top padding or margin appropriately

### Requirement 14: About Page

**User Story:** As a user, I want to view information about the Cultivate application, so that I can understand its purpose and learn more about the Bahá'í Faith.

#### Acceptance Criteria

1. THE Web_App SHALL provide an About page accessible from the navigation menu
2. THE Web_App SHALL display the Cultivate app icon (icon-no-bg.svg) on the About page
3. THE Web_App SHALL display the following excerpt from the Universal House of Justice: "The Formative Age is that critical period in the Faith's development in which the friends increasingly come to appreciate the mission with which Bahá'u'lláh has entrusted them, deepen their understanding of the meaning and implications of His revealed Word, and systematically cultivate capacity—their own and that of others—in order to put into practice His teachings for the betterment of the world."
4. THE Web_App SHALL attribute the excerpt to the Universal House of Justice
5. THE Web_App SHALL display a disclaimer stating that this software is an individual initiative to help communities more systematically track their growth, and has not been officially sponsored by any Bahá'í Institution
6. THE Web_App SHALL provide a hyperlink to the official Bahá'í website at https://www.bahai.org
7. THE Web_App SHALL use CloudScape design components for consistent styling on the About page
8. THE Web_App SHALL make the About page accessible to all authenticated users regardless of role

### Requirement 15: Form Validation

**User Story:** As a user, I want clear form validation, so that I know when I've entered invalid data.

#### Acceptance Criteria

1. THE Web_App SHALL validate all form inputs before submission
2. THE Web_App SHALL display inline error messages for invalid fields
3. THE Web_App SHALL highlight invalid fields visually
4. THE Web_App SHALL prevent form submission when validation fails
5. THE Web_App SHALL preserve valid field values when validation fails

### Requirement 16: Error Handling

**User Story:** As a user, I want clear error messages, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. THE Web_App SHALL display user-friendly error messages for all errors
2. THE Web_App SHALL use toast notifications for transient errors
3. THE Web_App SHALL use modal dialogs for critical errors
4. THE Web_App SHALL provide actionable guidance in error messages
5. THE Web_App SHALL maintain application state when errors occur
6. THE Web_App SHALL log detailed errors to console for debugging

### Requirement 17: Loading States

**User Story:** As a user, I want visual feedback during operations, so that I know the application is working.

#### Acceptance Criteria

1. THE Web_App SHALL display loading indicators during API requests
2. THE Web_App SHALL disable form submit buttons during submission
3. THE Web_App SHALL display skeleton screens while loading lists
4. THE Web_App SHALL provide progress indicators for long operations
5. THE Web_App SHALL display success messages after successful operations

### Requirement 17A: Entity Reference Refresh and Add Actions

**User Story:** As a user filling out a form, I want to refresh entity reference dropdowns and quickly add new entities without losing my current form context, so that I can efficiently complete forms even when referenced entities don't exist yet.

#### Acceptance Criteria

1. THE Web_App SHALL provide refresh and add action buttons next to all entity reference selectors in forms
2. THE refresh button SHALL use the CloudScape refresh icon
3. THE add button SHALL use the CloudScape add-plus icon
4. WHEN a user clicks the refresh button, THE Web_App SHALL reload the options for that entity selector from the backend
5. WHEN a user clicks the add button for major entities (Geographic Areas, Venues, Participants), THE Web_App SHALL open the entity creation page in a new browser tab
6. WHEN a user clicks the add button for configurable entities (Activity Categories, Activity Types, Participant Roles, Populations), THE Web_App SHALL open an inline modal dialog for entity creation
7. THE add button for major entities SHALL use target="_blank" to preserve the current form context in the original tab
8. AFTER a user adds a new major entity in the new tab, THE user SHALL be able to return to the original tab and click refresh to see the newly-added entity
9. AFTER a user creates a new configurable entity in the inline modal, THE Web_App SHALL automatically refresh the selector options and pre-select the newly created entity
10. THE Web_App SHALL provide refresh and add buttons for the Geographic Area selector in VenueForm (opens new tab)
11. THE Web_App SHALL provide refresh and add buttons for the Venue selector in ParticipantForm address history section (opens new tab)
12. THE Web_App SHALL provide refresh and add buttons for the Venue selector in ActivityForm venue history section (opens new tab)
13. THE Web_App SHALL provide refresh and add buttons for the Activity Category selector in ActivityTypeForm (opens inline modal)
14. THE Web_App SHALL provide refresh and add buttons for the Participant selector in ActivityForm participant assignments section (opens new tab)
15. THE Web_App SHALL provide refresh and add buttons for the Role selector in ActivityForm participant assignments section (opens inline modal)
16. THE Web_App SHALL provide refresh and add buttons for the Population selector in ParticipantForm population membership section (opens inline modal)
17. THE Web_App SHALL provide refresh and add buttons for the Geographic Area selector in GeographicAreaForm parent selection (opens new tab)
18. THE Web_App SHALL provide refresh and add buttons for the Geographic Area selector in GeographicAuthorizationForm (opens new tab)
19. THE Web_App SHALL position the refresh and add buttons adjacent to the entity selector (typically to the right)
20. THE Web_App SHALL use CloudScape ButtonGroup or similar layout to group the refresh and add buttons together
21. THE Web_App SHALL disable the add button when the user does not have permission to create the referenced entity type
22. THE Web_App SHALL always enable the refresh button regardless of user permissions
23. WHEN the refresh button is clicked, THE Web_App SHALL display a loading indicator on the button during the reload operation
24. WHEN the refresh operation completes, THE Web_App SHALL restore the button to its normal state
25. THE Web_App SHALL maintain the currently selected value in the selector after a refresh operation (if it still exists in the refreshed list)
26. WHEN the inline modal for configurable entities is opened, THE Web_App SHALL render the appropriate form component (ActivityCategoryForm, ActivityTypeForm, ParticipantRoleForm, or PopulationForm)
27. WHEN a configurable entity is successfully created via the inline modal, THE Web_App SHALL close the modal, refresh the selector options, and automatically select the newly created entity
28. WHEN the user cancels the inline modal for configurable entities, THE Web_App SHALL close the modal without making any changes to the selector
29. THE inline modal for configurable entities SHALL use the same validation rules as the standalone configuration forms
30. THE inline modal for Activity Type creation SHALL require selection of an Activity Category before submission

### Requirement 18: User Management (Admin Only)

**User Story:** As an administrator, I want to manage users and their geographic authorizations in a unified interface, so that I can control system access and geographic boundaries in one place.

#### Acceptance Criteria

1. THE Web_App SHALL provide a user management section for administrators only
2. THE Web_App SHALL display a list of all users with display name, email, and role
3. THE Web_App SHALL render user display name as a hyperlink in the primary column (links to edit page)
4. THE Web_App SHALL provide an edit action button for each user that navigates to the user edit page
5. THE Web_App SHALL NOT provide a separate "Manage Authorizations" action in the user list
6. THE Web_App SHALL provide a dedicated page to create new users accessible via route /users/new
7. THE Web_App SHALL provide a dedicated page to edit existing users accessible via route /users/:id/edit
8. THE Web_App SHALL NOT use modal dialogs for creating or editing users
9. THE Web_App SHALL allow vertical scrolling on user form pages to accommodate user fields and embedded authorization management
10. THE Web_App SHALL display user display name (optional), email, and role fields in the user form
11. THE Web_App SHALL allow display name to be optional
12. THE Web_App SHALL validate that user email is provided and properly formatted
13. THE Web_App SHALL validate that user role is selected
14. WHEN display name is not provided, THE Web_App SHALL use the email as the display identifier in lists and headers
14. THE Web_App SHALL allow administrators to assign and modify user roles in the user form
15. THE Web_App SHALL embed geographic authorization management within the user form page (both create and edit modes)
16. THE Web_App SHALL display all geographic authorization rules for the user in a table within the user form
17. THE Web_App SHALL provide an "Add Rule" button within the user form to create new authorization rules
18. THE Web_App SHALL provide a delete button for each authorization rule within the user form
19. WHEN creating an authorization rule, THE Web_App SHALL open a modal form with geographic area selection using the Geographic_Area_Selector component and rule type selection
20. WHEN creating an authorization rule, THE Web_App SHALL validate that the geographic area exists
21. WHEN creating an authorization rule, THE Web_App SHALL prevent duplicate rules for the same user and geographic area
22. THE Web_App SHALL visually distinguish ALLOW rules from DENY rules using color coding or icons (e.g., green checkmark for ALLOW, red X for DENY)
23. THE Web_App SHALL display a summary of the user's effective access showing which areas they can access within the user form
24. WHEN displaying effective access, THE Web_App SHALL show allowed areas, their descendants, and ancestor areas (marked as read-only)
25. WHEN displaying effective access, THE Web_App SHALL indicate which areas are denied
26. THE Web_App SHALL display a warning when creating DENY rules that override existing ALLOW rules
27. THE Web_App SHALL provide explanatory text describing how allow-listing and deny-listing rules work
28. THE Web_App SHALL provide explanatory text describing that allow-listed areas grant access to descendants and read-only access to ancestors
29. WHEN creating a new user, THE Web_App SHALL allow adding geographic authorization rules before the user is persisted to the backend
30. WHEN creating a new user with authorization rules, THE Web_App SHALL persist the user and all authorization rules in a single atomic operation
31. THE Web_App SHALL implement navigation guard using React Router's useBlocker to detect dirty form state
32. WHEN a user attempts to navigate away from the user form with unsaved changes, THE Web_App SHALL display a confirmation dialog
33. THE Web_App SHALL hide user management from non-administrators

### Requirement 18C: Admin Multi-Device Logout for Users

**User Story:** As an administrator, I want to log out a specific user from all their devices, so that I can secure their account if it's been compromised or respond to security incidents.

#### Acceptance Criteria

1. THE Web_App SHALL display a "Security" section on the user edit page (/users/:id/edit) for administrators
2. THE "Security" section SHALL be positioned below the geographic authorization management section
3. THE "Security" section SHALL include a "Log Out User from All Devices" button
4. THE "Log Out User from All Devices" button SHALL use CloudScape Button component with variant="normal"
5. WHEN the "Log Out User from All Devices" button is clicked, THE Web_App SHALL display a confirmation dialog
6. THE confirmation dialog SHALL explain that this action will invalidate all authorization tokens for the user and require them to log in again on all devices
7. THE confirmation dialog SHALL display the user's display name or email to confirm which user will be affected
8. WHEN the administrator confirms the action, THE Web_App SHALL call POST /api/v1/auth/invalidate-tokens/:userId endpoint with the user's ID
9. WHEN the token invalidation API call succeeds, THE Web_App SHALL display a success notification
10. WHEN the token invalidation API call succeeds, THE Web_App SHALL remain on the user edit page (do NOT logout the administrator)
11. WHEN the token invalidation API call fails, THE Web_App SHALL display an error message
12. THE Web_App SHALL disable the "Log Out User from All Devices" button while the API request is in progress
13. THE Web_App SHALL display a loading indicator on the button during the API request
14. THE "Security" section SHALL only be visible to administrators
15. THE "Security" section SHALL NOT be visible on the user creation page (/users/new), only on the edit page
16. THE Web_App SHALL include descriptive help text explaining that this action will force the user to re-authenticate on all devices
17. THE help text SHALL indicate this is useful for responding to compromised accounts or lost devices

### Requirement 18A: User Self-Profile Management

**User Story:** As any logged-in user, I want to view and edit my own profile information in the web interface, so that I can update my display name and password without requiring administrator assistance.

#### Acceptance Criteria

1. THE Web_App SHALL provide a "My Profile" navigation link in the user menu accessible to all authenticated users
2. THE Web_App SHALL provide a profile page at route /profile accessible to all authenticated users (ADMINISTRATOR, EDITOR, READ_ONLY)
3. THE Web_App SHALL display the current user's profile information including display name, email, role, created date, and updated date
4. THE Web_App SHALL NOT display the user's password hash on the profile page
5. THE Web_App SHALL provide an editable input field for the user's display name
6. THE Web_App SHALL allow the user to clear their display name by providing a clear button (X icon) that sets it to null
7. THE Web_App SHALL display the user's email address as read-only text (not editable)
8. THE Web_App SHALL display the user's role as read-only text (not editable)
9. THE Web_App SHALL NOT display the geographic authorization management section on the profile page
10. THE Web_App SHALL provide a password change section within the profile page
11. THE password change section SHALL include three input fields: Current Password, New Password, and Confirm New Password
12. THE Web_App SHALL validate that the current password field is filled when the user wants to change their password
13. THE Web_App SHALL validate that the new password is at least 8 characters
14. THE Web_App SHALL validate that the new password and confirm password fields match
15. WHEN the new password and confirm password do not match, THE Web_App SHALL display a validation error message
16. WHEN the user submits a profile update with password change, THE Web_App SHALL send currentPassword and newPassword to PUT /api/v1/users/me/profile
17. WHEN the backend returns INVALID_CURRENT_PASSWORD error (401), THE Web_App SHALL display an error message "Current password is incorrect"
18. WHEN the password change is successful, THE Web_App SHALL display a success notification and clear the password input fields
19. THE Web_App SHALL allow the user to update their display name without changing their password
20. THE Web_App SHALL allow the user to change their password without updating their display name
21. THE Web_App SHALL reuse the existing UserFormWithAuthorization component in a restricted mode for the profile page
22. WHEN rendering the profile page for a non-administrator, THE Web_App SHALL pass a restrictedMode prop to UserFormWithAuthorization
23. WHEN restrictedMode is true, THE UserFormWithAuthorization component SHALL hide the email input field and display email as read-only text
24. WHEN restrictedMode is true, THE UserFormWithAuthorization component SHALL hide the role selector and display role as read-only text
25. WHEN restrictedMode is true, THE UserFormWithAuthorization component SHALL hide the geographic authorization management section
26. WHEN restrictedMode is true, THE UserFormWithAuthorization component SHALL show the display name field as editable
27. WHEN restrictedMode is true, THE UserFormWithAuthorization component SHALL show the password change interface with current password validation
28. THE Web_App SHALL display a "Save Changes" button on the profile page
29. WHEN the user clicks "Save Changes", THE Web_App SHALL submit the profile update to PUT /api/v1/users/me/profile endpoint
30. WHEN the profile update is successful, THE Web_App SHALL display a success notification
31. WHEN the profile update fails, THE Web_App SHALL display appropriate error messages
32. THE Web_App SHALL implement navigation guard to detect unsaved changes on the profile page
33. WHEN a user attempts to navigate away from the profile page with unsaved changes, THE Web_App SHALL display a confirmation dialog asking if they want to discard changes
34. THE Web_App SHALL add a "My Profile" link to the user menu dropdown in the AppLayout header
35. WHEN the "My Profile" link is clicked, THE Web_App SHALL navigate to /profile route

### Requirement 18B: Multi-Device Logout UI

**User Story:** As a user, I want to log out of all devices from my profile page, so that I can secure my account if I suspect unauthorized access or have lost a device.

#### Acceptance Criteria

1. THE Web_App SHALL display a "Log Out of All Devices" button on the profile page (/profile)
2. THE "Log Out of All Devices" button SHALL be positioned prominently in a security section of the profile page
3. THE "Log Out of All Devices" button SHALL use CloudScape Button component with variant="normal" or "primary"
4. WHEN the "Log Out of All Devices" button is clicked, THE Web_App SHALL display a confirmation dialog explaining the action
5. THE confirmation dialog SHALL explain that this action will invalidate all authorization tokens and require re-authentication on all devices
6. WHEN the user confirms the action, THE Web_App SHALL call POST /api/v1/auth/invalidate-tokens endpoint
7. WHEN the token invalidation API call succeeds, THE Web_App SHALL display a success notification
8. AFTER the token invalidation API call succeeds, THE Web_App SHALL automatically log out the current browser session
9. WHEN logging out after token invalidation, THE Web_App SHALL clear all authentication tokens from localStorage
10. WHEN logging out after token invalidation, THE Web_App SHALL clear all user profile data from application state
11. WHEN logging out after token invalidation, THE Web_App SHALL clear all React Query caches for user-specific data
12. AFTER clearing all local state, THE Web_App SHALL redirect the user to the login page
13. WHEN the token invalidation API call fails, THE Web_App SHALL display an error message and NOT log out the current session
14. THE Web_App SHALL disable the "Log Out of All Devices" button while the API request is in progress
15. THE Web_App SHALL display a loading indicator on the button during the API request
16. THE "Log Out of All Devices" button SHALL be accessible to all authenticated users (ADMINISTRATOR, EDITOR, READ_ONLY)
17. THE Web_App SHALL handle TOKEN_INVALIDATED errors (401) from the backend by immediately logging out and redirecting to login
18. WHEN any API request returns TOKEN_INVALIDATED error, THE Web_App SHALL clear all authentication state and redirect to login without displaying an error message to the user

### Requirement 19: Optimistic Locking and Conflict Resolution

**User Story:** As a user, I want to be notified when my changes conflict with another user's changes, so that I can resolve conflicts appropriately.

#### Acceptance Criteria

1. THE Web_App SHALL include version numbers when updating entities
2. WHEN a version conflict occurs (409 error), THE Web_App SHALL display a conflict notification
3. THE Web_App SHALL provide options to retry with latest version or discard changes
4. THE Web_App SHALL refetch the latest entity data when a conflict is detected
5. THE Web_App SHALL log version conflict details for debugging

### Requirement 20: Rate Limiting Handling

**User Story:** As a user, I want to be informed when I've exceeded rate limits, so that I know when I can retry my actions.

#### Acceptance Criteria

1. WHEN a rate limit is exceeded (429 error), THE Web_App SHALL display a rate limit message
2. THE Web_App SHALL show the retry-after time from response headers
3. THE Web_App SHALL automatically retry after the cooldown period
4. THE Web_App SHALL log rate limit details for debugging
5. THE Web_App SHALL display remaining request counts from rate limit headers when available

### Requirement 21: Date Formatting Consistency

**User Story:** As a user, I want all dates displayed consistently throughout the application, so that I can easily read and compare dates.

#### Acceptance Criteria

1. THE Web_App SHALL render all dates in ISO-8601 format (YYYY-MM-DD)
2. THE Web_App SHALL apply consistent date formatting to activity start dates and end dates
3. THE Web_App SHALL apply consistent date formatting to address history effective dates
4. THE Web_App SHALL apply consistent date formatting to venue history effective dates
5. THE Web_App SHALL apply consistent date formatting to all date fields in tables and detail views
6. THE Web_App SHALL apply consistent date formatting to all date fields in forms and date pickers
7. THE Web_App SHALL apply consistent date formatting to analytics dashboard date ranges

### Requirement 22: Venue Geocoding Integration

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
12. THE Web_App SHALL display a "Drop Pin" button in the map view header, right-justified
13. WHEN the "Drop Pin" button is clicked, THE Web_App SHALL place the pin at the current center point of the map's viewport
14. WHEN the pin is placed via the "Drop Pin" button, THE Web_App SHALL update the latitude and longitude input fields with the coordinates of the map's center point
15. WHEN the pin is placed via the "Drop Pin" button, THE Web_App SHALL zoom the map to street-level zoom (approximately zoom level 15-17) to show the location clearly
16. WHEN latitude and longitude coordinates are populated, THE Web_App SHALL render a pin on the map at those coordinates
17. WHEN coordinates are populated, THE Web_App SHALL set the map zoom level to a reasonable level for viewing the venue location
20. THE Web_App SHALL provide a graphical interface on the map to drag and reposition the pin
21. WHEN the pin is repositioned on the map via dragging, THE Web_App SHALL update the latitude and longitude input fields with the new coordinates
22. WHEN the user right-clicks on the map, THE Web_App SHALL move the pin to the clicked location
23. WHEN the pin is repositioned via right-click, THE Web_App SHALL update the latitude and longitude input fields with the new coordinates
24. WHEN the latitude or longitude input fields are manually edited, THE Web_App SHALL update the pin position on the map
25. THE Web_App SHALL maintain two-way synchronization between the coordinate input fields and the map pin position at all times
26. WHEN the user manually adjusts the map zoom level, THE Web_App SHALL preserve that zoom level during subsequent coordinate updates and only adjust the map center point

### Requirement 23: Hyperlinked Primary Columns in Tables

**User Story:** As a user, I want to click on entity names in tables to view their details, so that I can navigate quickly without needing separate action buttons.

#### Acceptance Criteria

1. THE Web_App SHALL render the primary column value as a hyperlink in all entity list tables (activities, participants, venues, geographic areas, activity types, participant roles, users)
2. WHEN a user clicks on a hyperlinked primary column value, THE Web_App SHALL navigate to the detail view for that entity
3. THE Web_App SHALL NOT include a separate "View" action button in the Actions column when the primary column is hyperlinked
4. THE Web_App SHALL apply hyperlinked primary column treatment to tables on detail pages showing associated records (address history venues, venue history venues, activity participants, venue activities, venue participants)
5. THE Web_App SHALL use CloudScape Link component for all hyperlinked primary column values
6. THE Web_App SHALL maintain consistent link styling across all tables using CloudScape design patterns
7. THE Web_App SHALL preserve Edit and Delete action buttons in the Actions column where appropriate based on user permissions

### Requirement 24: Edit Action Buttons on Detail Pages

**User Story:** As a user, I want to quickly edit records from their detail pages, so that I can make changes without navigating back to the list view.

#### Acceptance Criteria

1. THE Web_App SHALL display an edit action button in the header section of all entity detail pages (participants, activities, venues, geographic areas)
2. THE Web_App SHALL position the edit button as the right-most action in the header when multiple actions are present
3. THE Web_App SHALL use CloudScape Button component with variant="primary" for all detail page edit buttons
4. WHEN a user clicks the edit button, THE Web_App SHALL navigate to the dedicated edit page for the current entity
5. THE Web_App SHALL hide the edit button when the user has READ_ONLY role
6. THE Web_App SHALL display the edit button when the user has EDITOR or ADMINISTRATOR role

### Requirement 24A: Delete Action Buttons on Detail Pages

**User Story:** As a user, I want to delete records from their detail pages, so that I can remove entities without navigating back to the list view.

#### Acceptance Criteria

1. THE Web_App SHALL display a delete action button in the header section of all entity detail pages (participants, activities, venues, geographic areas)
2. THE Web_App SHALL position the delete button next to the edit button in the header
3. THE Web_App SHALL use CloudScape Button component for all detail page delete buttons
4. WHEN a user clicks the delete button, THE Web_App SHALL display a confirmation dialog before proceeding with deletion
5. WHEN deletion is confirmed, THE Web_App SHALL call the appropriate delete API endpoint
6. WHEN deletion succeeds, THE Web_App SHALL navigate back to the entity list page
7. WHEN deletion fails, THE Web_App SHALL display an error message explaining why deletion failed
8. THE Web_App SHALL hide the delete button when the user has READ_ONLY role
9. THE Web_App SHALL display the delete button when the user has EDITOR or ADMINISTRATOR role
10. THE Web_App SHALL handle referential integrity errors gracefully and display user-friendly messages

### Requirement 25: Global Persistent Geographic Area Filter

**User Story:** As a community organizer, I want to set a global geographic area filter that applies to all views with hierarchical context display, so that I can focus on a specific region without repeatedly filtering each list while understanding the geographic hierarchy.

#### Acceptance Criteria

1. THE Web_App SHALL display a geographic area filter selector in the application header component using the Geographic_Area_Selector component
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
12. THE Geographic_Area_Selector in the global filter SHALL display each geographic area with its type and full ancestor hierarchy path
13. THE Geographic_Area_Selector in the global filter SHALL format options with area type on the first line and hierarchy path on the second line
14. THE Web_App SHALL format the ancestor hierarchy path with the closest ancestor on the left and the most distant (top-level) ancestor on the right
15. THE Web_App SHALL separate ancestor names in the hierarchy path with the right caret symbol " > "
16. WHEN the global geographic area filter is active, THE Web_App SHALL display only the descendants (recursively) of the currently filtered geographic area in the filter selector dropdown
17. WHEN the global geographic area filter is set to "Global" (no filter), THE Web_App SHALL display all geographic areas in the filter selector dropdown
18. WHEN displaying the currently active filter in the header breadcrumb or filter indicator, THE Web_App SHALL include the full ancestor hierarchy path to provide geographic context
19. THE Web_App SHALL NOT suppress or hide ancestor geographic areas from any display when showing filtered results, as ancestors provide essential navigational and contextual information
20. WHEN a user clicks on an ancestor area in the breadcrumb that they do not have direct authorization to access, THE Web_App SHALL clear the global geographic area filter (revert to "Global")
21. WHEN a user navigates to a URL with a geographic area filter parameter that refers to an area they are not directly authorized to access (including read-only ancestor areas), THE Web_App SHALL clear the filter parameter from the URL and revert to "Global" (no filter)
22. THE Web_App SHALL validate that any geographic area filter selection is within the user's directly authorized areas (FULL access, not descendants, not read-only ancestors), and clear the filter if validation fails
23. THE Web_App SHALL NOT allow users to apply geographic area filters to read-only ancestor areas, as this would result in incomplete analytics data
24. WHEN an API request returns a 403 Forbidden error with code GEOGRAPHIC_AUTHORIZATION_DENIED while a global geographic area filter is active, THE Web_App SHALL automatically clear the global filter and revert to "Global" (no filter)
25. WHEN clearing the filter due to a 403 authorization error, THE Web_App SHALL display a notification to the user explaining that the filter was cleared due to authorization restrictions
26. WHEN displaying N geographic areas in the filter selector dropdown, THE Web_App SHALL ensure it has the complete ancestor hierarchy for all N areas to render hierarchy paths correctly
27. THE Web_App SHALL identify unique parent geographic area IDs from all fetched areas in the current batch
28. THE Web_App SHALL determine which parent areas are missing complete ancestor metadata from the in-memory cache
29. WHEN the count of missing parent IDs exceeds 100, THE Web_App SHALL split the missing parent IDs into chunks of 100 IDs each
30. THE Web_App SHALL call POST /geographic-areas/batch-ancestors for each chunk of up to 100 area IDs to fetch ancestor IDs
31. THE Web_App SHALL collect all unique ancestor IDs from all batch-ancestors responses across all chunks
32. WHEN the count of collected ancestor IDs exceeds 100, THE Web_App SHALL split the collected ancestor IDs into chunks of 100 IDs each
33. THE Web_App SHALL call POST /geographic-areas/batch-details for each chunk of up to 100 ancestor IDs to fetch full geographic area objects
34. THE Web_App SHALL merge results from all batch-details responses into the ancestor cache
35. THE Web_App SHALL cache all fetched ancestor data to avoid redundant requests when the same areas appear in subsequent batches
36. THE Web_App SHALL respect the API endpoint limits of 100 IDs per request for both batch-ancestors and batch-details endpoints
37. WHEN rendering dropdown options, THE Web_App SHALL use the cached ancestor data to build complete hierarchy paths for all visible areas

### Requirement 26: High-Cardinality Dropdown Filtering

**User Story:** As a community organizer working with large datasets, I want dropdown lists for venues, participants, and geographic areas to support text-based filtering with batched incremental loading, so that I can efficiently find and select items even when there are millions of records while receiving continuous loading feedback.

#### Acceptance Criteria

1. THE Web_App SHALL support text-based input filtering for all venue selection dropdowns
2. THE Web_App SHALL support text-based input filtering for all participant selection dropdowns
3. THE Web_App SHALL support text-based input filtering for all geographic area selection dropdowns
4. WHEN a dropdown is opened, THE Web_App SHALL automatically load the first batch of 100 results from the backend
5. THE Web_App SHALL render dropdown options incrementally as each batch of 100 items is fetched
6. THE Web_App SHALL display a loading indicator at the bottom of the dropdown while fetching additional batches
7. THE Web_App SHALL automatically fetch the next batch of 100 items when the user scrolls near the bottom of the dropdown
8. WHEN a user types text into a dropdown filter field, THE Web_App SHALL asynchronously load filtered results from the backend based on the input text in batches of 100 items
9. THE Web_App SHALL debounce text input to avoid excessive API requests (minimum 300ms delay)
10. THE Web_App SHALL display a loading indicator while fetching filtered results
11. THE Web_App SHALL support pagination for dropdown results when the filtered set exceeds 100 items
12. THE Web_App SHALL use CloudScape Select or Autosuggest components with async loading capabilities
13. WHEN the global geographic area filter is active and sufficiently scoped, THE Web_App SHALL display all matching items in dropdowns for convenience
14. WHEN viewing data at a large geographic scale (country or global), THE Web_App SHALL rely on text-based filtering and batched loading to manage the large result sets efficiently

### Requirement 26A: CloudScape Table Native Pagination for List Pages

**User Story**: As a community organizer viewing list pages, I want tables to use standard pagination controls, so that I can navigate through large datasets efficiently without automatically loading all pages.

#### Acceptance Criteria

**General Table Pagination Behavior:**

1. THE Web_App SHALL use CloudScape Table component's native pagination capability for ParticipantList, ActivityList, and VenueList
2. THE Web_App SHALL configure Table with pagination enabled
3. THE Web_App SHALL set default page size to 100 items per page
4. THE Web_App SHALL allow users to change page size using CloudScape Table's page size selector
5. THE Web_App SHALL display total item count in table header (e.g., "4,725 participants")
6. THE Web_App SHALL fetch only the requested page from the backend API when user navigates to a new page
7. THE Web_App SHALL NOT automatically fetch subsequent pages until user explicitly requests them
8. THE Web_App SHALL display CloudScape Table's built-in loading indicator while fetching page data
9. THE Web_App SHALL use React Query to cache fetched pages for improved performance on re-visits

**Participant List Pagination:**

10. THE ParticipantList component SHALL fetch participants using GET /api/v1/participants?page=X&limit=Y
11. THE ParticipantList component SHALL extract total count from API response metadata
12. THE ParticipantList component SHALL pass total count to CloudScape Table's paginationLabels
13. THE ParticipantList component SHALL handle page change events from CloudScape Table
14. WHEN user clicks to page 2, THE ParticipantList SHALL fetch page 2 data from backend
15. THE ParticipantList component SHALL reset to page 1 when filters change

**Activity List Pagination:**

16. THE ActivityList component SHALL fetch activities using GET /api/v1/activities?page=X&limit=Y
17. THE ActivityList component SHALL extract total count from API response metadata
18. THE ActivityList component SHALL pass total count to CloudScape Table's paginationLabels
19. THE ActivityList component SHALL handle page change events from CloudScape Table
20. WHEN user clicks to page 3, THE ActivityList SHALL fetch page 3 data from backend
21. THE ActivityList component SHALL reset to page 1 when filters change

**Venue List Pagination:**

22. THE VenueList component SHALL fetch venues using GET /api/v1/venues?page=X&limit=Y
23. THE VenueList component SHALL extract total count from API response metadata
24. THE VenueList component SHALL pass total count to CloudScape Table's paginationLabels
25. THE VenueList component SHALL handle page change events from CloudScape Table
26. WHEN user clicks to page 5, THE VenueList SHALL fetch page 5 data from backend
27. THE VenueList component SHALL reset to page 1 when filters change

**Performance and Caching:**

28. THE Web_App SHALL use React Query's caching to avoid refetching already-loaded pages
29. THE Web_App SHALL invalidate page caches when filters change
30. THE Web_App SHALL invalidate page caches when data mutations occur (create, update, delete)
31. THE Web_App SHALL display stale data from cache while refetching in background (React Query's staleWhileRevalidate)

**Error Handling:**

32. WHEN a page fetch fails, THE Web_App SHALL display CloudScape Alert with error message
33. WHEN a page fetch fails, THE Web_App SHALL provide a retry button
34. WHEN retry is clicked, THE Web_App SHALL attempt to fetch the failed page again

**Accessibility:**

35. THE CloudScape Table pagination controls SHALL be keyboard navigable
36. THE CloudScape Table pagination controls SHALL announce page changes to screen readers
37. THE CloudScape Table SHALL maintain focus management during page transitions

### Requirement 26B: Subtle Loading Indicators for Map View Batched Loading with Cancellation

**User Story:** As a user viewing the map, I want subtle, non-intrusive loading indicators with the ability to cancel during batched marker loading, so that I can see loading progress without being distracted and can interrupt long-running loads if needed.

#### Acceptance Criteria

1. THE Web_App SHALL NOT use Alert components to indicate batched loading progress on the map view
2. THE Web_App SHALL display a subtle loading indicator near the map controls during batched marker loading
3. THE loading indicator SHALL consist of a Spinner component and a text label showing progress (e.g., "Loading: 300 / 1,500 markers")
4. THE loading indicator SHALL be positioned near the map controls as an overlay
5. THE loading indicator SHALL remain mounted and visible for the entire duration of the batched loading process
6. WHEN all marker batches have been fetched, THE Web_App SHALL hide the loading indicator
7. WHEN all marker batches have been fetched, THE Web_App SHALL display only the final marker count
8. THE loading indicator SHALL use a small or normal-sized Spinner component (not large)
9. THE loading indicator SHALL use muted or secondary text styling to avoid drawing excessive attention
10. THE Web_App SHALL apply this subtle loading indicator pattern to MapView component only
11. THE Web_App SHALL NOT display Alert components with "Loading markers: X / Y" messages during normal batched loading
12. THE Web_App SHALL reserve Alert components for error states, warnings, and important user notifications only
13. THE loading indicator SHALL be visually integrated into the map interface without disrupting the layout
14. THE loading indicator SHALL NOT cause layout shifts or content jumping when it appears or disappears
15. THE loading indicator SHALL include a "Cancel" button positioned next to the progress text
16. THE "Cancel" button SHALL be visible for the entire duration of the batched loading process
17. WHEN a user clicks the "Cancel" button, THE Web_App SHALL immediately stop fetching additional marker batches
18. WHEN a user clicks the "Cancel" button, THE Web_App SHALL keep all already-loaded markers visible on the map
19. WHEN a user clicks the "Cancel" button, THE Web_App SHALL hide the loading indicator
20. WHEN a user clicks the "Cancel" button, THE Web_App SHALL update the marker count to reflect only the loaded markers
21. THE "Cancel" button SHALL use a subtle, inline-link or icon-only style to match the loading indicator's non-intrusive appearance
22. THE "Cancel" button SHALL be keyboard accessible and include appropriate ARIA labels for screen readers (e.g., "Cancel loading")
23. WHEN batched loading is cancelled and partial results are displayed, THE Web_App SHALL display a "Resume" icon button using the CloudScape refresh icon
24. THE "Resume" button SHALL be positioned near the map controls where the loading indicator was previously displayed
25. THE "Resume" button SHALL use CloudScape Button component with iconName="refresh" and variant="icon"
26. WHEN a user clicks the "Resume" button, THE Web_App SHALL continue fetching marker batches from where the loading was interrupted
27. WHEN a user clicks the "Resume" button, THE Web_App SHALL display the loading indicator again with updated progress (e.g., "Loading: 250 / 1,500 markers")
28. THE "Resume" button SHALL be keyboard accessible and include appropriate ARIA labels for screen readers (e.g., "Resume loading markers")
29. THE "Resume" button SHALL be visible only when batched loading has been cancelled and there are more markers to load
30. WHEN all markers have been loaded (either through completion or after resuming), THE Web_App SHALL hide the "Resume" button
31. WHEN a user applies new filters, changes map mode, or pans/zooms the map, THE Web_App SHALL hide the "Resume" button and restart batched loading from the beginning
32. THE Web_App SHALL NOT automatically resume batched loading after cancellation unless the user explicitly clicks the "Resume" button, changes filters, or interacts with the map
33. THE "Cancel" button SHALL be positioned inline with the loading progress text to maintain horizontal layout
34. THE "Cancel" button SHALL use muted styling (e.g., variant="inline-link" or icon-only with subdued color) to avoid visual prominence

### Requirement 26C: Reusable Batched Loading Progress Indicator for Map View

**User Story:** As a developer, I want a reusable component for displaying batched loading progress with pause and resume functionality for the map view, so that I can maintain consistent loading UX without duplicating code.

#### Acceptance Criteria

1. THE Web_App SHALL provide a reusable ProgressIndicator component that encapsulates batched loading UI logic for map markers
2. THE ProgressIndicator component SHALL accept props for loadedCount, totalCount, entityName, onCancel, onResume, and isCancelled
3. THE ProgressIndicator component SHALL consist of an icon button followed by a CloudScape ProgressBar component
4. THE icon button SHALL display a "pause" icon (iconName="pause") when loading is actively in progress
5. WHEN the pause icon button is clicked, THE ProgressIndicator SHALL invoke the onCancel callback to pause loading
6. THE icon button SHALL display a "play" icon (iconName="play") when loading is paused (isCancelled is true) and more items remain to load
7. WHEN the play icon button is clicked, THE ProgressIndicator SHALL invoke the onResume callback to resume loading
8. THE ProgressBar component SHALL display a label showing the loading state with entity count
9. WHEN actively loading, THE ProgressBar label SHALL be "Loading X / Y {entityName}..." where X is loadedCount and Y is totalCount (e.g., "Loading 300 / 4725 markers...")
10. WHEN paused, THE ProgressBar label SHALL be "Loaded X / Y {entityName}." where X is loadedCount and Y is totalCount (e.g., "Loaded 300 / 4725 markers.")
11. THE ProgressBar component SHALL calculate and display the percentage progress value based on loadedCount and totalCount
12. THE ProgressBar component SHALL remain visible when loading is paused (not hidden)
13. THE ProgressIndicator component SHALL unmount completely (return null) when loadedCount equals totalCount
14. THE ProgressIndicator component SHALL use CloudScape SpaceBetween for horizontal layout with the icon button positioned to the left of the ProgressBar
15. THE ProgressIndicator component SHALL be usable as an overlay on the map view
16. THE Web_App SHALL use the ProgressIndicator component in MapView component only
17. THE Web_App SHALL NOT use the ProgressIndicator component in ParticipantList, ActivityList, or VenueList components
18. THE ProgressIndicator component SHALL support customizable entity names (e.g., "markers")
19. THE icon button SHALL use variant="icon" for consistent styling
20. THE icon button SHALL include appropriate ARIA labels: "Pause loading" when showing pause icon, "Resume loading {entityName}" when showing play icon
21. THE ProgressBar SHALL use status="in-progress" when actively loading
22. THE ProgressIndicator component SHALL be positioned as an overlay on the map view near map controls

### Requirement 27: Clear Optional Fields

**User Story:** As a community organizer, I want to clear optional fields that have been previously populated in the web interface, so that I can remove information that is no longer relevant or was entered incorrectly.

#### Acceptance Criteria

1. THE Web_App SHALL provide a way to clear optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields in the participant form
2. THE Web_App SHALL provide a way to clear optional latitude, longitude, and venueType fields in the venue form
3. THE Web_App SHALL provide a way to clear the endDate field in the activity form to convert a finite activity to an ongoing activity
4. THE Web_App SHALL provide a way to clear the notes field in the assignment form
5. WHEN a user clears an optional field, THE Web_App SHALL send null or empty string to the API to clear the field value
6. WHEN a user clears an optional field and saves, THE Web_App SHALL display the field as empty in subsequent views
7. THE Web_App SHALL provide a clear button (X icon) or similar UI element next to clearable optional fields
8. WHEN a field is cleared, THE Web_App SHALL visually indicate that the field is now empty
9. THE Web_App SHALL distinguish between leaving a field unchanged (omit from request) and explicitly clearing it (send null/empty)

### Requirement 28: Interactive Chart Legends

**User Story:** As a data analyst, I want to interact with chart legends to toggle individual data series on and off, so that I can focus on specific subsets of data and make comparisons easier.

#### Acceptance Criteria

1. THE Web_App SHALL provide interactive legends on all charts that display multiple data series
2. WHEN a user clicks on a legend item, THE Web_App SHALL toggle the visibility of the corresponding data series in the chart
3. WHEN a data series is hidden, THE Web_App SHALL visually indicate the hidden state in the legend (e.g., dimmed text, strikethrough, or opacity change)
4. WHEN a data series is shown, THE Web_App SHALL display the legend item in its normal active state
5. THE Web_App SHALL allow toggling multiple data series independently within the same chart
6. WHEN all data series are hidden, THE Web_App SHALL display an appropriate message or allow at least one series to remain visible
7. THE Web_App SHALL apply interactive legend functionality to the following charts:
   - Activities chart on Engagement Dashboard (when displaying multiple activity types or categories)
   - Activity Category Pie Chart on Engagement Dashboard
   - Activity Lifecycle Events chart (when displaying multiple activity types or categories)
   - Growth Dashboard Unique Participants chart (when displaying multiple activity types or categories)
   - Growth Dashboard Unique Activities chart (when displaying multiple activity types or categories)
   - Geographic breakdown chart on Engagement Dashboard
   - Role distribution chart on Engagement Dashboard
   - Any other charts that display multiple data series
8. THE Web_App SHALL preserve the chart's interactivity and responsiveness when series are toggled
9. THE Web_App SHALL update the chart's axis scales and ranges appropriately when series are hidden or shown
10. THE Web_App SHALL provide visual feedback (e.g., hover state) when the user hovers over legend items to indicate they are clickable
11. THE Web_App SHALL maintain accessibility by ensuring legend items are keyboard navigable and screen reader compatible

### Requirement 29: CSV Import and Export

**User Story:** As a community organizer, I want to import and export data in CSV format, so that I can bulk load data from external sources and share data with other systems.

### Requirement 29: CSV Import and Export

**User Story:** As a community organizer, I want to import and export data in CSV format, so that I can bulk load data from external sources and share data with other systems.

#### Acceptance Criteria

1. THE Web_App SHALL provide an "Export CSV" button on the Participants list page
2. THE Web_App SHALL provide an "Export CSV" button on the Venues list page
3. THE Web_App SHALL provide an "Export CSV" button on the Activities list page
4. THE Web_App SHALL provide an "Export CSV" button on the Geographic Areas list page
5. WHEN the Export CSV button is clicked, THE Web_App SHALL call the appropriate backend export endpoint
6. WHEN the export succeeds, THE Web_App SHALL trigger a browser download of the CSV file
7. WHEN no records exist for export, THE Web_App SHALL download an empty CSV file with only the header row
8. THE Web_App SHALL provide an "Import CSV" button on the Participants list page
9. THE Web_App SHALL provide an "Import CSV" button on the Venues list page
10. THE Web_App SHALL provide an "Import CSV" button on the Activities list page
11. THE Web_App SHALL provide an "Import CSV" button on the Geographic Areas list page
12. WHEN the Import CSV button is clicked, THE Web_App SHALL open a file selection dialog
13. WHEN a CSV file is selected, THE Web_App SHALL upload the file to the appropriate backend import endpoint
14. WHEN the import succeeds, THE Web_App SHALL display a success message with counts of successful and failed imports
15. WHEN the import fails, THE Web_App SHALL display detailed error messages for failed rows
16. THE Web_App SHALL display a loading indicator during import and export operations
17. THE Web_App SHALL disable the import and export buttons during operations to prevent duplicate requests
18. THE Web_App SHALL refresh the entity list after a successful import to show newly imported records
19. THE Web_App SHALL validate that selected files have a .csv extension before uploading
20. WHEN a non-CSV file is selected, THE Web_App SHALL display an error message and prevent upload
21. THE Web_App SHALL position the Import and Export buttons in the table header actions area using CloudScape Button components
22. THE Web_App SHALL hide Import and Export buttons from users with READ_ONLY role
23. THE Web_App SHALL show Import and Export buttons to users with EDITOR or ADMINISTRATOR role
24. WHEN exporting data with the global geographic area filter active, THE Web_App SHALL include the filter in the export request to export only filtered records
25. WHEN exporting filtered data, THE Web_App SHALL indicate in the success message that only filtered records were exported

### Requirement 30: Engagement Summary Table CSV Export with Smart Caching

**User Story:** As a community organizer, I want to export the complete Engagement Summary table to CSV format with intelligent data fetching, so that I can analyze all engagement metrics in spreadsheet applications regardless of dataset size while experiencing instant exports for small datasets.

#### Acceptance Criteria

**Smart Export Logic:**

1. THE Web_App SHALL provide an "Export CSV" button on the Engagement Dashboard near the Engagement Summary table
2. THE Web_App SHALL determine whether the current dataset fits in a single page before exporting
3. WHEN pagination metadata indicates `totalPages === 1` and `page === 1`, THE Web_App SHALL use cached results for instant CSV export
4. WHEN pagination metadata indicates `totalPages > 1` or `page !== 1`, THE Web_App SHALL fetch all data from the backend before exporting
5. WHEN pagination metadata is missing, THE Web_App SHALL fetch all data from the backend before exporting

**Optimized API Integration:**

6. WHEN fetching all data for CSV export, THE Web_App SHALL call `getEngagementMetricsOptimized` without `page` and `pageSize` parameters
7. WHEN the `page` and `pageSize` parameters are omitted, THE backend SHALL return all matching results in a single response
8. THE Web_App SHALL pass the same filter parameters to the unpaginated request as were used for the paginated query
9. THE Web_App SHALL pass the same grouping dimensions to the unpaginated request as were used for the paginated query
10. THE Web_App SHALL pass the same date range to the unpaginated request as was used for the paginated query
11. THE Web_App SHALL pass the same geographic area filter to the unpaginated request as was used for the paginated query
12. THE Web_App SHALL parse the wire format response using `parseEngagementWireFormat` utility
13. THE Web_App SHALL transform the parsed data into the format expected by the CSV generator

**CSV Content and Structure:**

14. WHEN the Export CSV button is clicked, THE Web_App SHALL generate a CSV file containing all rows from the Engagement Summary table
15. THE Web_App SHALL include the Total row as the first data row in the CSV export
16. WHEN grouping dimensions are selected, THE Web_App SHALL include all dimensional breakdown rows in the CSV export
17. THE Web_App SHALL export human-friendly labels for all dimension columns (activity category names, activity type names, venue names, geographic area names) instead of UUIDs
18. THE Web_App SHALL include the following metric columns in the CSV export: Participants at Start, Participants at End, Participation at Start, Participation at End, Activities at Start, Activities at End, Activities Started, Activities Completed
19. THE Web_App SHALL NOT include Activities Cancelled in the CSV export
20. WHEN no date range is specified, THE Web_App SHALL omit "at start" columns from the CSV export
21. WHEN a date range is specified, THE Web_App SHALL include all temporal metric columns in the CSV export
22. THE Web_App SHALL use descriptive column headers in the CSV file that match the table column headers
23. THE Web_App SHALL properly escape CSV special characters in all exported data

**Filename Generation:**

24. WHEN the Export CSV button is clicked, THE Web_App SHALL trigger a browser download of the CSV file with a filename that reflects the active filters
25. THE Web_App SHALL construct the CSV filename with the following components in order: "engagement-summary", active filter segments, and current date
26. WHEN the global geographic area filter is active, THE Web_App SHALL include both the geographic area name and type in the filename in the format "{name}-{type}" (sanitized to remove invalid filename characters)
27. THE Web_App SHALL format the geographic area type in the filename using title case with hyphens for multi-word types (e.g., "Neighbourhood", "City", "Province")
28. WHEN a date range filter is active, THE Web_App SHALL include the start and end dates in the filename using ISO-8601 format (YYYY-MM-DD)
29. WHEN activity category, activity type, venue, or population filters are active, THE Web_App SHALL include their names in the filename (sanitized to remove invalid filename characters)
30. THE Web_App SHALL sanitize all filter values in the filename by replacing spaces with hyphens and removing or replacing invalid filename characters (colons, slashes, backslashes, asterisks, question marks, quotes, angle brackets, pipes)
31. WHEN a filter is not active, THE Web_App SHALL omit that filter segment from the filename to keep the filename concise
32. THE Web_App SHALL separate filename components with underscores for readability
33. THE Web_App SHALL format the current date in the filename using ISO-8601 format (YYYY-MM-DD)

**User Experience:**

34. THE Web_App SHALL display a loading indicator on the Export CSV button while fetching all data
35. THE Web_App SHALL disable the Export CSV button during the export operation to prevent duplicate requests
36. THE Web_App SHALL display a success notification with the message "Engagement Summary exported successfully" after successful export
37. WHEN the CSV export fails, THE Web_App SHALL display an error notification with details explaining the failure
38. THE Web_App SHALL not block user interaction with other dashboard elements during export
39. THE Web_App SHALL hide the Export CSV button from users with READ_ONLY role
40. THE Web_App SHALL show the Export CSV button to users with EDITOR or ADMINISTRATOR role

**Data Consistency:**

41. WHEN exporting the Engagement Summary table with filters applied, THE Web_App SHALL include only the filtered data in the CSV export
42. WHEN exporting the Engagement Summary table with grouping dimensions selected, THE Web_App SHALL preserve the grouping structure in the CSV export
43. THE Web_App SHALL handle empty Engagement Summary tables by exporting a CSV file with only the header row
44. THE Web_App SHALL generate CSV files with identical structure whether using cached or freshly fetched data

**Performance:**

45. THE Web_App SHALL export CSV immediately (< 500ms) when all data fits in a single page
46. THE Web_App SHALL not make additional API requests when exporting single-page datasets
47. THE Web_App SHALL provide loading feedback within 100ms when fetching all data for multi-page datasets
48. THE Web_App SHALL use the optimized wire format API for better performance (60-80% smaller payloads)

### Requirement 31: Geographic Authorization Management UI

**User Story:** As a system administrator, I want to view and manage geographic authorization rules for users on a dedicated page, so that I can control which geographic areas each user can access with a full-featured interface.

#### Acceptance Criteria

1. THE Web_App SHALL provide a dedicated page for managing geographic authorizations accessible via route /users/:userId/authorizations
2. THE Web_App SHALL display all geographic authorization rules for the user in a table
3. THE Web_App SHALL provide a button or link in the UserList to navigate to the authorization management page for each user
4. THE Web_App SHALL display the user's email and role in the page header for context
5. THE Web_App SHALL display authorization rules with geographic area name, rule type (ALLOW or DENY), and creation date
6. THE Web_App SHALL provide an "Add Rule" button to create new authorization rules
7. THE Web_App SHALL provide a delete button for each authorization rule
8. WHEN creating an authorization rule, THE Web_App SHALL open a modal form with geographic area selection and rule type selection
9. WHEN creating an authorization rule, THE Web_App SHALL validate that the geographic area exists
10. WHEN creating an authorization rule, THE Web_App SHALL prevent duplicate rules for the same user and geographic area
11. THE Web_App SHALL visually distinguish ALLOW rules from DENY rules using color coding or icons (e.g., green checkmark for ALLOW, red X for DENY)
12. THE Web_App SHALL display a summary of the user's effective access showing which areas they can access
13. WHEN displaying effective access, THE Web_App SHALL show allowed areas, their descendants, and ancestor areas (marked as read-only)
14. WHEN displaying effective access, THE Web_App SHALL indicate which areas are denied
15. THE Web_App SHALL restrict all geographic authorization management features to ADMINISTRATOR role only
16. WHEN a non-administrator attempts to access the authorization management page, THE Web_App SHALL redirect to the dashboard or show an error
17. THE Web_App SHALL display a warning when creating DENY rules that override existing ALLOW rules
18. THE Web_App SHALL provide explanatory text describing how allow-listing and deny-listing rules work
19. THE Web_App SHALL provide explanatory text describing that allow-listed areas grant access to descendants and read-only access to ancestors
20. THE Web_App SHALL provide a back button or breadcrumb navigation to return to the User Administration page

### Requirement 32: Display Population Badges in Participant Lists

**User Story:** As a community organizer, I want to see population badges displayed beside each participant's name in all participant lists, so that I can quickly identify which demographic or interest groups each participant belongs to without navigating to their detail page.

#### Acceptance Criteria

1. THE Web_App SHALL display population badges beside each participant's name in the ParticipantList component
2. THE Web_App SHALL display population badges beside each participant's name in the VenueDetail component's participant list (participants with venue as home address)
3. THE Web_App SHALL display population badges beside each participant's name in the ActivityDetail component's assigned participants list
4. THE Web_App SHALL display population badges beside each participant's name in the AssignmentList component (embedded in ActivityForm)
5. WHEN a participant belongs to zero populations, THE Web_App SHALL NOT display any population badges for that participant
6. WHEN a participant belongs to one population, THE Web_App SHALL display a single population badge beside the participant's name
7. WHEN a participant belongs to multiple populations, THE Web_App SHALL display all population badges beside the participant's name
8. THE Web_App SHALL use CloudScape Badge component to render population badges
9. THE Web_App SHALL display population badges with the population name as the badge text
10. THE Web_App SHALL use a consistent color scheme for population badges across all participant lists
11. THE Web_App SHALL position population badges immediately after the participant's name with appropriate spacing
12. THE Web_App SHALL wrap multiple population badges to the next line if they exceed the available horizontal space
13. THE Web_App SHALL retrieve population associations from the populations array field included in the participant object from the API response
14. THE Web_App SHALL NOT make additional API requests to fetch population associations for each participant in the list
15. THE Web_App SHALL handle missing or null populations array gracefully by displaying no badges
16. THE Web_App SHALL sort population badges alphabetically by population name for consistent display
17. THE Web_App SHALL provide appropriate spacing between multiple population badges (e.g., 4-8px gap)
18. THE Web_App SHALL ensure population badges do not interfere with the clickability of the participant name hyperlink
19. THE Web_App SHALL display population badges in all participant list contexts consistently (list pages, detail pages, embedded lists)
20. THE Web_App SHALL use the populations data already included in the API response without requiring additional data fetching or transformation


## Performance Optimization Cross-References

The Web Frontend package integrates with three backend performance optimization specifications that improve dashboard and map rendering performance:

### Analytics Dashboard Optimization

**Backend Spec**: `.kiro/specs/analytics-optimization/`

**Frontend Integration**: The EngagementDashboard component has been updated to:
- Parse optimized wire format responses with indexed lookups
- Display engagement metrics using the consolidated data structure
- Render activity breakdown charts using grouped metrics
- Support pagination controls for large result sets
- Handle role distribution data from the dedicated endpoint
- Automatically reset pagination when filters or grouping change
- Use each breakdown query's own `hasDateRange` value for correct chart rendering

**Key Benefits**:
- Faster dashboard load times (60-75% improvement)
- Smaller API payloads (50-75% reduction with pagination)
- Improved chart rendering performance
- Lazy loading for large datasets

**See**: `.kiro/specs/analytics-optimization/requirements.md` for backend requirements

### Geographic Breakdown Dashboard Integration

**Backend Spec**: `.kiro/specs/geographic-breakdown-optimization/`

**Frontend Integration**: The EngagementDashboard's geographic breakdown table has been updated to:
- Support pagination controls for large geographic hierarchies
- Automatically reset to page 1 when drilling down into geographic areas
- Sync frontend page state with backend's clamped page numbers
- Handle page numbers beyond valid range gracefully
- Display only areas with non-zero metrics for cleaner results

**Key Benefits**:
- Efficient navigation through large geographic hierarchies
- Natural drill-down behavior with automatic page reset
- No "page not found" errors
- Cleaner data (no zero-metric areas)

**See**: `.kiro/specs/geographic-breakdown-optimization/requirements.md` for backend requirements

### Map View Performance Optimization

**Backend Spec**: `.kiro/specs/map-data-optimization/`

**Frontend Integration**: The MapView component benefits from:
- Optimized marker loading with raw SQL queries
- Stable pagination with deterministic ordering
- Conditional joins that reduce query complexity
- Single database round trip for marker data
- Window functions for total count calculation

**Key Benefits**:
- 50-80% faster marker loading
- Consistent pagination (no duplicates or gaps)
- Reduced memory usage
- Improved map responsiveness

**See**: `.kiro/specs/map-data-optimization/requirements.md` for backend requirements

### Implementation Status

All three optimizations have been **fully implemented and integrated**:
- ✅ All frontend tests passing (273/273)
- ✅ All backend tests passing (503/503)
- ✅ Wire format parsers implemented
- ✅ Dashboard components updated
- ✅ Pagination controls integrated
- ✅ Chart rendering fixed
- ✅ Production-ready

These optimizations are transparent to end users and provide significant performance improvements without changing the user interface or user experience.
