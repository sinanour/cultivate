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
- **Activity_Category**: A high-level grouping of related activity types (e.g., Study Circles, Children's Classes, Junior Youth Groups, Devotional Gatherings)
- **Activity_Type**: A specific category of activity that belongs to an Activity_Category
- **Configuration_View**: A unified interface for managing both activity categories and activity types
- **Engagement_Summary_Table**: A table on the Engagement Dashboard displaying aggregate and dimensional breakdown metrics for activities and participants

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

### Requirement 2: Activity Configuration UI

**User Story:** As a community organizer, I want to manage activity categories and types in a unified interface, so that I can organize activities at multiple levels of granularity.

#### Acceptance Criteria

1. THE Web_App SHALL provide a unified configuration view for managing both activity categories and activity types
2. THE Web_App SHALL display a list of all activity categories with predefined and custom categories distinguished
3. THE Web_App SHALL display a list of all activity types grouped by their category with predefined and custom types distinguished
4. THE Web_App SHALL provide a form to create new activity categories
5. THE Web_App SHALL provide a form to edit existing activity categories
6. THE Web_App SHALL provide a delete button for activity categories
7. WHEN deleting an activity category, THE Web_App SHALL prevent deletion if activity types reference it
8. WHEN deleting an activity category, THE Web_App SHALL display an error message explaining why deletion failed
9. THE Web_App SHALL validate that activity category names are not empty
10. THE Web_App SHALL provide a form to create new activity types
11. THE Web_App SHALL provide a form to edit existing activity types
12. THE Web_App SHALL provide a delete button for activity types
13. WHEN creating or editing an activity type, THE Web_App SHALL require selection of an activity category
14. WHEN deleting an activity type, THE Web_App SHALL prevent deletion if activities reference it
15. WHEN deleting an activity type, THE Web_App SHALL display an error message explaining why deletion failed
16. THE Web_App SHALL validate that activity type names are not empty
17. WHEN displaying activity categories in the list, THE Web_App SHALL render the activity category name as a clickable link
18. WHEN an activity category name is clicked in the activity category list, THE Web_App SHALL open the edit form for that activity category

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

1. THE Web_App SHALL display a list of all participants with name, email (if provided), and other relevant information
2. THE Web_App SHALL provide search functionality to find participants by name or email
3. THE Web_App SHALL provide sorting and filtering for the participant list
4. THE Web_App SHALL provide a form to create new participants
5. THE Web_App SHALL provide a form to edit existing participants
6. THE Web_App SHALL provide a delete button for participants
7. THE Web_App SHALL validate that participant name is provided
8. WHEN a participant email is provided, THE Web_App SHALL validate email format
9. THE Web_App SHALL allow optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields
10. WHEN dateOfBirth is provided, THE Web_App SHALL validate that it is a valid date in the past
11. WHEN dateOfRegistration is provided, THE Web_App SHALL validate that it is a valid date
12. THE Web_App SHALL display a detail view showing participant information and their activities
11. THE Web_App SHALL display a table of the participant's home address history in reverse chronological order
12. THE Web_App SHALL provide an interface to add new address history records with venue and effective start date
13. THE Web_App SHALL provide an interface to edit existing address history records
14. THE Web_App SHALL provide an interface to delete address history records
15. THE Web_App SHALL validate that address history records have a venue
16. THE Web_App SHALL allow address history records to have an optional effective start date
17. WHEN an address history record has a null effective start date, THE Web_App SHALL treat it as the oldest home address for that participant
18. THE Web_App SHALL enforce that at most one address history record can have a null effective start date for any given participant
19. THE Web_App SHALL prevent duplicate address history records with the same effective start date (including null) for the same participant
17. WHEN creating a new participant, THE Web_App SHALL allow adding home address history records within the participant creation modal form
18. WHEN editing an existing participant, THE Web_App SHALL allow adding, editing, and deleting home address history records within the participant edit modal form
19. WHEN adding an address history record to a new participant before the participant is created, THE Web_App SHALL fetch and display the venue name in the address history table
20. WHEN a venue is selected for a new address history record, THE Web_App SHALL retrieve the venue details from the backend and store them for display purposes

### Requirement 5: Activity Management UI

**User Story:** As a community organizer, I want to manage activities in the web interface, so that I can track community events.

#### Acceptance Criteria

1. THE Web_App SHALL display a list of all activities with category, type, dates, and status
2. THE Web_App SHALL provide filtering by activity category, activity type, and status
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
16. WHEN creating a new activity, THE Web_App SHALL allow adding venue associations with optional effective start dates within the activity creation modal form
17. WHEN editing an existing activity, THE Web_App SHALL allow adding, editing, and deleting venue associations within the activity edit modal form
18. WHEN adding a venue association to a new activity before the activity is created, THE Web_App SHALL fetch and display the venue name in the venue history table
19. WHEN a venue is selected for a new venue association, THE Web_App SHALL retrieve the venue details from the backend and store them for display purposes
20. WHEN a venue association has a null effective start date, THE Web_App SHALL treat the venue association start date as the same as the activity start date
21. THE Web_App SHALL enforce that at most one venue association can have a null effective start date for any given activity
22. THE Web_App SHALL prevent duplicate venue associations with the same effective start date (including null) for the same activity

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
1a. WHEN displaying venues in the list, THE Web_App SHALL render the geographic area name as a hyperlink to the geographic area detail page (/geographic-areas/:id)
2. THE Web_App SHALL provide search functionality to find venues by name or address
3. THE Web_App SHALL provide sorting and filtering for the venue list
4. THE Web_App SHALL provide a form to create new venues
5. THE Web_App SHALL provide a form to edit existing venues
6. THE Web_App SHALL provide a delete button for venues
7. THE Web_App SHALL validate that venue name, address, and geographic area are provided
8. THE Web_App SHALL allow optional fields for latitude, longitude, and venue type
9. THE Web_App SHALL display a detail view showing venue information, associated activities, and participants using it as their current home address
9a. WHEN displaying participants on a venue detail page, THE Web_App SHALL only show participants whose most recent address history record is at this venue
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

**User Story:** As a community organizer, I want to view activities, participant locations, and venues on a map, so that I can visualize community engagement and infrastructure by geography.

#### Acceptance Criteria

1. THE Web_App SHALL provide an interactive map view using a mapping library (e.g., Leaflet, Mapbox)
2. THE Web_App SHALL provide a mode selector control to switch between three map modes: "Activities", "Participant Homes", and "Venues"
3. WHEN in "Activities" mode, THE Web_App SHALL display markers for all activities at their current venue locations
4. WHEN in "Activities" mode, THE Web_App SHALL color-code activity markers by activity category
5. WHEN in "Activities" mode, THE Web_App SHALL display a right-aligned legend showing the mapping between marker colors and activity categories
5a. WHEN displaying the map legend in "Activities" mode, THE Web_App SHALL only include activity types that are actually visible on the map based on current filters
5b. WHEN displaying the map legend in "Activity Categories" mode, THE Web_App SHALL only include activity categories that are actually visible on the map based on current filters
5c. WHEN filters are applied that result in no visible markers, THE Web_App SHALL hide the legend
6. WHEN an activity marker is clicked, THE Web_App SHALL display a popup showing the activity name, category, type, start date, and number of participants
7. WHEN an activity marker popup is displayed, THE Web_App SHALL render the activity name as a hyperlink to the activity detail page (/activities/:id)
8. WHEN in "Participant Homes" mode, THE Web_App SHALL display markers for all participant home addresses (current venue from address history)
9. WHEN a participant home marker is clicked, THE Web_App SHALL display a popup showing the venue name and the number of participants living at that address
10. WHEN a participant home marker popup is displayed, THE Web_App SHALL render the venue name as a hyperlink to the venue detail page (/venues/:id)
11. WHEN in "Venues" mode, THE Web_App SHALL display markers for all venues with latitude and longitude coordinates, regardless of whether they have activities or participants
12. WHEN a venue marker is clicked in "Venues" mode, THE Web_App SHALL display a popup showing the venue name, address, and geographic area
13. WHEN a venue marker popup is displayed in "Venues" mode, THE Web_App SHALL render the venue name as a hyperlink to the venue detail page (/venues/:id)
14. THE Web_App SHALL provide filtering controls to show/hide activities by category, type, status, or date range
15. THE Web_App SHALL provide geographic area boundary overlays when available
16. THE Web_App SHALL allow zooming and panning of the map
17. THE Web_App SHALL provide a button to center the map on a specific venue or geographic area
18. THE Web_App SHALL implement marker clustering for dense areas to improve map readability
19. WHEN the global geographic area filter is active, THE Web_App SHALL apply the filter to all map modes to show only markers for entities associated with venues in the filtered geographic area or its descendants
20. WHEN the global geographic area filter is active in "Activities" mode, THE Web_App SHALL display only activities whose current venue is in the filtered geographic area or its descendants
21. WHEN the global geographic area filter is active in "Participant Homes" mode, THE Web_App SHALL display only participant home addresses where the venue is in the filtered geographic area or its descendants
22. WHEN the global geographic area filter is active in "Venues" mode, THE Web_App SHALL display only venues that are in the filtered geographic area or its descendants
23. WHEN determining current venue for activity markers, THE Web_App SHALL treat null effectiveFrom dates as equivalent to the activity start date
24. WHEN determining current home address for participant markers, THE Web_App SHALL treat null effectiveFrom dates as the oldest address (earlier than any non-null date)
25. WHEN displaying activities on the map, THE Web_App SHALL correctly identify the current venue considering null effectiveFrom dates in venue history
26. WHEN displaying participant homes on the map, THE Web_App SHALL correctly identify the current home venue considering null effectiveFrom dates in address history

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
9. THE Web_App SHALL display all activity counts in aggregate across all activity categories and types
10. THE Web_App SHALL display all activity counts broken down by activity category
11. THE Web_App SHALL display all activity counts broken down by activity type
12. THE Web_App SHALL display all participant counts in aggregate across all activity categories and types
13. THE Web_App SHALL display all participant counts broken down by activity category
14. THE Web_App SHALL display all participant counts broken down by activity type
15. THE Web_App SHALL provide controls to group metrics by one or more dimensions: activity category, activity type, venue, and geographic area
16. THE Web_App SHALL provide filter controls for activity category (point filter)
17. THE Web_App SHALL provide filter controls for activity type (point filter)
18. THE Web_App SHALL provide filter controls for venue (point filter)
19. THE Web_App SHALL provide filter controls for geographic area (point filter, includes descendants)
20. THE Web_App SHALL provide filter controls for date range (range filter with start and end dates)
21. THE Web_App SHALL render an "Engagement Summary" table that displays aggregate metrics and dimensional breakdowns
22. THE Web_App SHALL render the first row of the Engagement Summary table with the label "Total" in the first column and aggregate metrics (activities at start, at end, started, completed, cancelled, participants at start, at end) in subsequent columns
23. WHEN multiple grouping dimensions are selected, THE Web_App SHALL leave subsequent dimension cells blank in the first row (Total row)
24. WHEN grouping dimensions are selected, THE Web_App SHALL render additional rows below the Total row showing dimensional breakdowns where breakdown dimension columns appear first followed by metric aggregation columns
25. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render activity category names as hyperlinks to the Activity Configuration page at /configuration
26. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render activity type names as hyperlinks to the Activity Configuration page at /configuration
27. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render venue names as hyperlinks to their respective detail views at /venues/:id
28. WHEN rendering dimensional breakdown rows in the table, THE Web_App SHALL render geographic area names as hyperlinks to their respective detail views at /geographic-areas/:id
29. THE Web_App SHALL display each metric aggregation (activities at start, activities at end, activities started, activities completed, activities cancelled, participants at start, participants at end) in its own column in the Engagement Summary table
30. WHEN multiple filters are applied, THE Web_App SHALL apply all filters using AND logic
31. WHEN no date range is specified, THE Web_App SHALL display all-time metrics
32. THE Web_App SHALL display role distribution across all activities within the filtered and grouped results
32a. THE Web_App SHALL display a pie chart showing the breakdown of unique activities by activity category
32b. THE pie chart SHALL appear in line width (full width of its container) and positioned to the left of the role distribution chart
32c. THE pie chart SHALL use the same filtered data as other dashboard components
32d. THE pie chart SHALL display activity category names in the legend
32e. THE pie chart SHALL use a consistent color scheme with other dashboard charts
32f. WHEN a user hovers over a pie chart segment, THE Web_App SHALL display the activity category name and count
32g. THE pie chart SHALL include an interactive legend allowing users to toggle individual category segments on and off
32h. WHEN all pie chart segments are hidden, THE Web_App SHALL display an appropriate message or allow at least one segment to remain visible
33. THE Web_App SHALL synchronize all filter parameters (activity category, activity type, venue, geographic area, start date, end date) with URL query parameters
34. THE Web_App SHALL synchronize all grouping parameters (group by dimensions) with URL query parameters
35. WHEN a user navigates to a URL with analytics filter or grouping query parameters, THE Web_App SHALL apply those parameters automatically to the dashboard
36. WHEN a user changes any filter or grouping parameter, THE Web_App SHALL update the browser URL to reflect the current state
37. THE Web_App SHALL enable browser back/forward navigation to move between different filter and grouping configurations
38. THE Web_App SHALL allow users to share the current analytics view URL with other users to display the same filtered and grouped results
38a. WHEN calculating engagement metrics for activities, THE Web_App SHALL correctly identify the current venue considering null effectiveFrom dates (treating null as activity start date)
38b. WHEN calculating engagement metrics for participants, THE Web_App SHALL correctly identify the current home venue considering null effectiveFrom dates (treating null as oldest address)
38c. WHEN filtering analytics by geographic area, THE Web_App SHALL correctly determine which activities and participants are in the filtered area considering null effectiveFrom dates
39. THE Web_App SHALL provide a growth analytics dashboard
40. THE Web_App SHALL display a separate time-series chart showing unique participant counts for each time period
41. THE Web_App SHALL display a separate time-series chart showing unique activity counts for each time period
42. THE Web_App SHALL provide time period selection (day, week, month, year)
43. THE Web_App SHALL display each time period as a snapshot of unique participants and activities engaged at that point in time (not cumulative counts)
44. THE Web_App SHALL provide a segmented control to view growth metrics with three options: "All", "Activity Type", and "Activity Category"
45. THE Segmented_Control SHALL default to "All" as the selected option
46. WHEN "All" is selected in the segmented control, THE Web_App SHALL display a single aggregate time-series line for total unique participants and a single aggregate time-series line for total unique activities across all activity types and categories in both charts
46a. WHEN "All" is selected in the segmented control, THE Web_App SHALL display overall participation and activity growth numbers representing totals across all activity types and categories
46b. WHEN "Activity Type" or "Activity Category" is selected in the segmented control, THE Web_App SHALL NOT display overall participation and activity growth numbers, showing only the grouped breakdown data
47. WHEN "Activity Type" is selected in the segmented control, THE Web_App SHALL display multiple time-series lines in both charts, one line for each activity type showing unique participants and unique activities for that type
48. WHEN "Activity Category" is selected in the segmented control, THE Web_App SHALL display multiple time-series lines in both charts, one line for each activity category showing unique participants and unique activities for that category
49. WHEN displaying multiple lines for activity types or categories, THE Web_App SHALL use a consistent color scheme across both the Unique Participants chart and the Unique Activities chart, so that the same activity type or category has the same color on both charts
50. THE Web_App SHALL display a legend on both charts showing the color mapping for each activity type or category when multiple lines are displayed
51. WHEN the view mode changes between "All", "Activity Type", and "Activity Category", THE Growth_Dashboard SHALL update both charts without requiring a page refresh
52. WHEN switching between view modes, THE Growth_Dashboard SHALL preserve the current time period, date range, and geographic area filter selections
53. WHEN a user selects a view mode, THE System SHALL store the selection in browser local storage with key "growthChartViewMode"
54. WHEN a user returns to the Growth Dashboard, THE Growth_Dashboard SHALL restore the previously selected view mode from local storage
55. IF no previous selection exists in local storage, THE Growth_Dashboard SHALL default to "All" view
56. WHEN local storage is unavailable, THE Growth_Dashboard SHALL function normally with "All" as the default
48. THE Web_App SHALL provide a geographic area filter for all analytics
49. THE Web_App SHALL display a geographic breakdown chart showing engagement by geographic area
50. THE Web_App SHALL allow drilling down into child geographic areas from the geographic breakdown chart
57a. THE Web_App SHALL synchronize growth dashboard filter parameters (period, date range, grouping mode) with URL query parameters
57b. WHEN a user navigates to a URL with growth dashboard query parameters, THE Web_App SHALL apply those parameters automatically to the dashboard
57c. WHEN a user changes any filter or grouping parameter on the growth dashboard, THE Web_App SHALL update the browser URL to reflect the current state
57d. THE Web_App SHALL enable browser back/forward navigation to move between different growth dashboard configurations
57e. WHEN a user shares a growth dashboard URL, THE Web_App SHALL display the same filtered and grouped results for other users
58. THE Web_App SHALL display a chart titled "Activities" (renamed from "Activities by Type") on the Engagement Dashboard
59. THE Web_App SHALL provide a segmented control above or within the Activities chart to toggle between "Activity Type" and "Activity Category" views
60. WHEN the Activities chart is first rendered, THE Segmented_Control SHALL default to "Activity Type" as the selected option
61. THE Segmented_Control SHALL follow the same UX pattern as the map view toggle functionality
62. WHEN "Activity Type" is selected in the segmented control, THE Activities chart SHALL display activities grouped by activity type
63. WHEN "Activity Category" is selected in the segmented control, THE Activities chart SHALL display activities grouped by activity category
64. WHEN the view mode changes, THE Activities chart SHALL update its data display without requiring a page refresh
65. WHEN switching between views, THE Activities chart SHALL preserve the current date range and filter selections
66. WHEN no activities exist for a grouping dimension, THE Activities chart SHALL display an appropriate empty state message
67. THE Activities chart SHALL display activity counts in descending order by count value
68. THE Activities chart SHALL handle API errors gracefully and display an error message to the user
69. WHEN a user selects a view mode, THE System SHALL store the selection in browser local storage
70. WHEN a user returns to the Engagement Dashboard, THE Activities chart SHALL restore the previously selected view mode from local storage
71. IF no previous selection exists in local storage, THE Activities chart SHALL default to "Activity Type" view
72. WHEN local storage is unavailable, THE Activities chart SHALL function normally with "Activity Type" as the default
73. THE Segmented_Control SHALL be keyboard navigable using Tab and Arrow keys
74. WHEN a segmented control option receives focus, THE System SHALL provide visual focus indicators
75. THE Segmented_Control SHALL include appropriate ARIA labels for screen readers
76. WHEN the view mode changes, THE System SHALL announce the change to screen readers

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
8. WHEN a user is redirected to the login page due to being unauthenticated, THE Web_App SHALL capture the original URL
9. WHEN a user successfully authenticates after being redirected from a protected route, THE Web_App SHALL redirect the user back to the original URL they were attempting to access
10. WHEN a user successfully authenticates, THE Web_App SHALL display an animated transition sequence before navigation
11. THE animated transition SHALL fade out the login form container over 1000 milliseconds until it disappears
12. AFTER the login form fades out, THE Web_App SHALL display the icon-no-bg.svg image centered on the screen at 256x256 pixels
13. THE icon image SHALL animate its stroke from nothing to completely drawn over the course of 2000 milliseconds
14. AFTER the icon stroke animation completes, THE Web_App SHALL navigate to the appropriate destination page

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
6. THE Web_App SHALL provide quick links on the main dashboard page for accessing key sections
7. WHEN displaying quick links on the main dashboard, THE Web_App SHALL hide the User Administration quick link from users who do not have ADMINISTRATOR role
8. WHEN a user has ADMINISTRATOR role, THE Web_App SHALL display the User Administration quick link on the main dashboard
9. THE Web_App SHALL make the application header (including both the navigation header and the geographic area filter header) sticky to the top of the viewport
10. WHEN a user scrolls vertically through page content, THE Web_App SHALL keep the header visible at the top of the screen at all times
11. THE Web_App SHALL ensure the sticky header does not obscure page content by adjusting the content area's top padding or margin appropriately

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

### Requirement 23A: Delete Action Buttons on Detail Pages

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

### Requirement 24: Global Persistent Geographic Area Filter

**User Story:** As a community organizer, I want to set a global geographic area filter that applies to all views with hierarchical context display, so that I can focus on a specific region without repeatedly filtering each list while understanding the geographic hierarchy.

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
12. WHEN displaying geographic areas in the filter selector dropdown, THE Web_App SHALL show the geographic area type for each item
13. WHEN displaying geographic areas in the filter selector dropdown, THE Web_App SHALL show the full ancestor hierarchy path below the geographic area type
14. THE Web_App SHALL format the ancestor hierarchy path with the closest ancestor on the left and the most distant (top-level) ancestor on the right
15. THE Web_App SHALL separate ancestor names in the hierarchy path with the right caret symbol " > "
16. WHEN the global geographic area filter is active, THE Web_App SHALL display only the descendants (recursively) of the currently filtered geographic area in the filter selector dropdown
17. WHEN the global geographic area filter is set to "Global" (no filter), THE Web_App SHALL display all geographic areas in the filter selector dropdown

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


### Requirement 26: Clear Optional Fields

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

### Requirement 27: Interactive Chart Legends

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

### Requirement 28: CSV Import and Export

**User Story:** As a community organizer, I want to import and export data in CSV format, so that I can bulk load data from external sources and share data with other systems.

### Requirement 28: CSV Import and Export

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

### Requirement 29: Engagement Summary Table CSV Export

**User Story:** As a community organizer, I want to export the Engagement Summary table to CSV format, so that I can analyze engagement metrics in spreadsheet applications and share reports with stakeholders.

#### Acceptance Criteria

1. THE Web_App SHALL provide an "Export CSV" button on the Engagement Dashboard near the Engagement Summary table
2. WHEN the Export CSV button is clicked, THE Web_App SHALL generate a CSV file containing all rows from the Engagement Summary table
3. THE Web_App SHALL include the Total row as the first data row in the CSV export
4. WHEN grouping dimensions are selected, THE Web_App SHALL include all dimensional breakdown rows in the CSV export
5. THE Web_App SHALL export human-friendly labels for all dimension columns (activity category names, activity type names, venue names, geographic area names) instead of UUIDs
6. THE Web_App SHALL include all metric columns in the CSV export: activities at start, activities at end, activities started, activities completed, activities cancelled, participants at start, participants at end
7. THE Web_App SHALL use descriptive column headers in the CSV file that match the table column headers
8. WHEN the Export CSV button is clicked, THE Web_App SHALL trigger a browser download of the CSV file with a filename that includes "engagement-summary" and the current date
9. THE Web_App SHALL display a loading indicator while generating the CSV export
10. THE Web_App SHALL disable the Export CSV button during the export operation to prevent duplicate requests
11. THE Web_App SHALL display a success notification after the CSV file is downloaded
12. WHEN the CSV export fails, THE Web_App SHALL display an error message explaining the failure
13. THE Web_App SHALL hide the Export CSV button from users with READ_ONLY role
14. THE Web_App SHALL show the Export CSV button to users with EDITOR or ADMINISTRATOR role
15. WHEN exporting the Engagement Summary table with filters applied, THE Web_App SHALL include only the filtered data in the CSV export
16. WHEN exporting the Engagement Summary table with grouping dimensions selected, THE Web_App SHALL preserve the grouping structure in the CSV export
17. THE Web_App SHALL format dates in the CSV filename using ISO-8601 format (YYYY-MM-DD)
18. THE Web_App SHALL handle empty Engagement Summary tables by exporting a CSV file with only the header row
