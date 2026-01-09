# Requirements Document: Backend API Package

## Introduction

The Backend API package provides the RESTful API service that implements all business logic, data persistence, authentication, and authorization for the Cultivate system. It serves as the single source of truth for all data and coordinates operations across multiple client applications.

## Glossary

- **API**: Application Programming Interface - the RESTful HTTP service
- **Endpoint**: A specific API URL that handles a particular operation
- **JWT**: JSON Web Token - authentication token format
- **Prisma**: TypeScript ORM for database access
- **Middleware**: Express.js functions that process requests
- **Service_Layer**: Business logic components
- **Sync_Operation**: A batched offline change from a client
- **Audit_Log**: A record of user actions for security and compliance
- **Venue**: A physical location where activities occur, representing either a public building or private residence with an address
- **Geographic_Area**: A hierarchical geographic region (neighbourhood, community, city, cluster, county, province, state, country, continent, hemisphere, world)
- **Activity_Category**: A high-level grouping of related activity types (e.g., Study Circles, Children's Classes, Junior Youth Groups, Devotional Gatherings)
- **Activity_Type**: A specific category of activity that belongs to an Activity_Category
- **Population**: A label or demographic grouping that can be assigned to participants for segmentation and analysis (e.g., Youth, Adults, Families, Seekers)
- **Participation**: The total count (non-unique) of all participant-activity associations, where the same participant involved in multiple activities contributes multiple counts
- **Unique_Participant_Count**: The count of distinct participants involved in activities, where the same participant involved in multiple activities contributes only one count
- **Geographic_Authorization**: Access control rules that restrict user access to specific geographic areas
- **Allow_List**: A set of geographic areas that a user is explicitly permitted to access
- **Deny_List**: A set of geographic areas that a user is explicitly forbidden from accessing
- **Authorized_Area**: A geographic area that a user has permission to access based on authorization rules
- **Map_Marker**: A lightweight data structure containing only the essential fields needed to render a pin on a map (coordinates and identifiers)
- **Popup_Content**: Detailed information about a map marker that is loaded on-demand when a user clicks the marker
- **Lazy_Loading**: A performance optimization strategy where data is fetched in batches of 100 items using paginated APIs and rendered incrementally to reduce latency and provide continuous loading feedback to the user
- **Batched_Loading**: A technique where large datasets are fetched in multiple smaller requests (batches of 100 items) and rendered progressively as each batch arrives
- **Incremental_Rendering**: A UI pattern where entities are displayed on screen as soon as they are fetched, without waiting for all data to be loaded

## Requirements

### Requirement 1: Manage Activity Categories and Types

**User Story:** As a community organizer, I want to define and manage activity categories and types via API, so that I can organize and categorize different kinds of community-building activities at multiple levels of granularity.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/activity-categories endpoint that returns all activity categories
2. THE API SHALL provide a POST /api/v1/activity-categories endpoint that creates a new activity category
3. THE API SHALL provide a PUT /api/v1/activity-categories/:id endpoint that updates an activity category
4. THE API SHALL provide a DELETE /api/v1/activity-categories/:id endpoint that deletes an activity category
5. WHEN creating an activity category, THE API SHALL validate that the name is provided and unique
6. WHEN deleting an activity category, THE API SHALL prevent deletion if activity types reference it
7. THE API SHALL seed the following predefined activity categories on initial database setup: "Study Circles", "Children's Classes", "Junior Youth Groups", "Devotional Gatherings"
8. THE API SHALL provide a GET /api/v1/activity-types endpoint that returns all activity types
9. THE API SHALL provide a POST /api/v1/activity-types endpoint that creates a new activity type
10. THE API SHALL provide a PUT /api/v1/activity-types/:id endpoint that updates an activity type
11. THE API SHALL provide a DELETE /api/v1/activity-types/:id endpoint that deletes an activity type
12. WHEN creating an activity type, THE API SHALL validate that the name is provided and unique
13. WHEN creating an activity type, THE API SHALL require an activity category ID
14. WHEN creating an activity type, THE API SHALL validate that the activity category exists
15. WHEN deleting an activity type, THE API SHALL prevent deletion if activities reference it
16. THE API SHALL seed the following predefined activity types on initial database setup with their corresponding categories:
    - Category "Children's Classes": "Children's Class"
    - Category "Junior Youth Groups": "Junior Youth Group"
    - Category "Devotional Gatherings": "Devotional Gathering"
    - Category "Study Circles": "Ruhi Book 01", "Ruhi Book 02", "Ruhi Book 03", "Ruhi Book 03A", "Ruhi Book 03B", "Ruhi Book 03C", "Ruhi Book 03D", "Ruhi Book 04", "Ruhi Book 05", "Ruhi Book 05A", "Ruhi Book 05B", "Ruhi Book 06", "Ruhi Book 07", "Ruhi Book 08", "Ruhi Book 09", "Ruhi Book 10", "Ruhi Book 11", "Ruhi Book 12", "Ruhi Book 13", "Ruhi Book 14"
17. WHEN retrieving activity types, THE API SHALL include the associated activity category information

### Requirement 2: Manage Participant Roles

**User Story:** As a community organizer, I want to define and manage participant roles via API, so that I can track the different functions people perform in activities.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/roles endpoint that returns all participant roles (note: endpoint is /roles not /participant-roles)
2. THE API SHALL provide a POST /api/roles endpoint that creates a new role
3. THE API SHALL provide a PUT /api/roles/:id endpoint that updates a role
4. THE API SHALL provide a DELETE /api/roles/:id endpoint that deletes a role
5. WHEN creating a role, THE API SHALL validate that the name is provided and unique
6. WHEN deleting a role, THE API SHALL prevent deletion if assignments reference it
7. THE API SHALL seed the following predefined roles on initial database setup: "Tutor", "Teacher", "Animator", "Host", "Participant"

### Requirement 2A: Manage Populations

**User Story:** As an administrator, I want to define and manage populations via API, so that I can categorize participants into demographic or interest-based groups for segmentation and analysis.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/populations endpoint that returns all populations
2. THE API SHALL provide a POST /api/v1/populations endpoint that creates a new population
3. THE API SHALL provide a PUT /api/v1/populations/:id endpoint that updates a population
4. THE API SHALL provide a DELETE /api/v1/populations/:id endpoint that deletes a population
5. WHEN creating a population, THE API SHALL validate that the name is provided and unique
6. WHEN deleting a population, THE API SHALL prevent deletion if participants reference it
7. THE API SHALL support many-to-many relationships between participants and populations
8. THE API SHALL provide a GET /api/v1/participants/:id/populations endpoint that returns all populations for a participant
9. THE API SHALL provide a POST /api/v1/participants/:id/populations endpoint that adds a participant to a population
10. THE API SHALL provide a DELETE /api/v1/participants/:id/populations/:populationId endpoint that removes a participant from a population
11. WHEN adding a participant to a population, THE API SHALL validate that both the participant and population exist
12. WHEN adding a participant to a population, THE API SHALL prevent duplicate associations (same participant and population)
13. THE API SHALL allow a participant to belong to zero, one, or multiple populations
14. THE API SHALL restrict population management endpoints (create, update, delete) to ADMINISTRATOR role only
15. THE API SHALL allow EDITOR and READ_ONLY roles to view populations but not modify them

### Requirement 3: Track Participants

**User Story:** As a community organizer, I want to register and track individuals via API, so that I can maintain a record of everyone involved in community activities.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/participants endpoint that returns all participants
2. THE API SHALL provide a GET /api/participants/:id endpoint that returns a specific participant
3. THE API SHALL provide a POST /api/participants endpoint that creates a new participant
4. THE API SHALL provide a PUT /api/participants/:id endpoint that updates a participant
5. THE API SHALL provide a DELETE /api/participants/:id endpoint that deletes a participant
6. THE API SHALL provide a GET /api/participants/search endpoint that searches by name or email
7. WHEN creating a participant, THE API SHALL require name
8. WHEN creating a participant, THE API SHALL accept optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields
9. WHEN creating a participant with an email, THE API SHALL validate email format and uniqueness
10. WHEN updating a participant with an email, THE API SHALL validate email format and uniqueness
10. WHEN creating a participant, THE API SHALL accept an optional home venue ID
11. WHEN creating a participant with dateOfBirth, THE API SHALL validate that it is a valid date in the past
12. WHEN creating a participant with dateOfRegistration, THE API SHALL validate that it is a valid date
13. WHEN updating a participant's home venue, THE API SHALL create a new address history record with the venue and effective start date
12. THE API SHALL provide a GET /api/participants/:id/address-history endpoint that returns the participant's home address history ordered by effective start date descending
13. THE API SHALL provide a POST /api/participants/:id/address-history endpoint that creates a new address history record
14. THE API SHALL provide a PUT /api/participants/:id/address-history/:historyId endpoint that updates an existing address history record
15. THE API SHALL provide a DELETE /api/participants/:id/address-history/:historyId endpoint that deletes an address history record
16. WHEN creating an address history record, THE API SHALL require venue ID
17. WHEN creating an address history record, THE API SHALL accept an optional effective start date (effectiveFrom)
18. WHEN creating an address history record with a null effectiveFrom date, THE API SHALL treat it as the oldest home address for that participant
19. THE API SHALL enforce that at most one address history record can have a null effectiveFrom date for any given participant
20. WHEN creating an address history record, THE API SHALL prevent duplicate records with the same effectiveFrom date (including null) for the same participant
18. THE API SHALL provide a GET /api/participants/:id/activities endpoint that returns all activity assignments for the participant with activity and role details
19. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only participants whose current home venue is in the specified geographic area or its descendants

### Requirement 4: Create and Manage Activities

**User Story:** As a community organizer, I want to create and manage activities via API, so that I can track what's happening in my community.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/activities endpoint that returns all activities
2. THE API SHALL provide a GET /api/activities/:id endpoint that returns a specific activity
3. THE API SHALL provide a POST /api/activities endpoint that creates a new activity
4. THE API SHALL provide a PUT /api/activities/:id endpoint that updates an activity
5. THE API SHALL provide a DELETE /api/activities/:id endpoint that deletes an activity
6. WHEN creating an activity, THE API SHALL require name, activity type ID, and start date
7. WHEN creating a finite activity, THE API SHALL require an end date
8. WHEN creating an ongoing activity, THE API SHALL allow null end date
9. WHEN creating an activity, THE API SHALL set status to PLANNED by default
10. THE API SHALL support activity statuses: PLANNED, ACTIVE, COMPLETED, CANCELLED
11. WHEN creating or updating an activity, THE API SHALL accept one or more venue IDs
12. THE API SHALL provide a GET /api/activities/:id/venues endpoint that returns all venues associated with an activity ordered by effective start date descending
13. THE API SHALL provide a POST /api/activities/:id/venues endpoint that associates a venue with an activity
14. THE API SHALL provide a DELETE /api/activities/:id/venues/:venueId endpoint that removes a venue association
15. THE API SHALL track the effective start date for each activity-venue association to support venue changes over time
16. WHEN creating an activity-venue association, THE API SHALL accept an optional effective start date (effectiveFrom)
17. WHEN creating an activity-venue association with a null effectiveFrom date, THE API SHALL treat the venue association start date as the same as the activity start date
18. THE API SHALL enforce that at most one activity-venue association can have a null effectiveFrom date for any given activity
19. WHEN creating an activity-venue association, THE API SHALL prevent duplicate records with the same effectiveFrom date (including null) for the same activity
17. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only activities whose current venue is in the specified geographic area or its descendants

### Requirement 5: Assign Participants to Activities

**User Story:** As a community organizer, I want to assign participants to activities with specific roles via API, so that I can track who is involved and what they do.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/activities/:id/participants endpoint that returns participants for an activity
2. THE API SHALL provide a POST /api/activities/:id/participants endpoint that assigns a participant to an activity
3. THE API SHALL provide a DELETE /api/activities/:id/participants/:participantId endpoint that removes a participant from an activity
4. WHEN assigning a participant, THE API SHALL require participant ID and role ID
5. WHEN assigning a participant, THE API SHALL validate that the activity, participant, and role exist
6. WHEN assigning a participant, THE API SHALL prevent duplicate assignments (same participant, activity, and role)
7. WHEN removing a participant, THE API SHALL delete the assignment immediately

### Requirement 5A: Manage Venues

**User Story:** As a community organizer, I want to create and manage venues via API, so that I can track the physical locations where activities occur.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/venues endpoint that returns all venues
2. THE API SHALL provide a GET /api/venues/:id endpoint that returns a specific venue
3. THE API SHALL provide a POST /api/venues endpoint that creates a new venue
4. THE API SHALL provide a PUT /api/venues/:id endpoint that updates a venue
5. THE API SHALL provide a DELETE /api/venues/:id endpoint that deletes a venue
6. THE API SHALL provide a GET /api/venues/search endpoint that searches venues by name or address
7. WHEN creating a venue, THE API SHALL require name, address, and geographic area ID
8. WHEN creating a venue, THE API SHALL validate that the geographic area exists
9. WHEN creating a venue, THE API SHALL accept optional fields for latitude, longitude, and venue type (PUBLIC_BUILDING or PRIVATE_RESIDENCE)
10. WHEN deleting a venue, THE API SHALL prevent deletion if activities or participants reference it
11. WHEN deleting a venue, THE API SHALL return an error message explaining which entities reference it
12. THE API SHALL provide a GET /api/venues/:id/activities endpoint that returns all activities associated with a venue
13. THE API SHALL provide a GET /api/venues/:id/participants endpoint that returns all participants with this venue as their current home address
14. WHEN retrieving venue participants, THE API SHALL only include participants whose most recent address history record is at this venue
15. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only venues in the specified geographic area or its descendants

### Requirement 5B: Manage Geographic Areas

**User Story:** As a community organizer, I want to create and manage geographic areas via API with support for lazy loading and depth-limited fetching, so that I can organize venues hierarchically and efficiently navigate large geographic hierarchies without loading all nodes at once.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/geographic-areas endpoint that returns geographic areas with optional depth limiting
2. THE API SHALL accept an optional depth query parameter on GET /api/geographic-areas to limit the recursive depth of children fetched
3. WHEN depth parameter is omitted, THE API SHALL fetch all descendant nodes recursively (backward-compatible behavior)
4. WHEN depth parameter is 0, THE API SHALL return only the requested geographic areas without any children
5. WHEN depth parameter is 1, THE API SHALL return the requested geographic areas with their immediate children only
6. WHEN depth parameter is N, THE API SHALL return the requested geographic areas with children up to N levels deep
7. WHEN a geographicAreaId filter is provided with a depth parameter, THE API SHALL apply the depth limit starting from the filtered geographic area
8. WHEN no geographicAreaId filter is provided with a depth parameter, THE API SHALL return top-level areas (null parent) with children up to the specified depth
9. THE API SHALL provide a GET /api/geographic-areas/:id endpoint that returns a specific geographic area with child count
10. WHEN returning a geographic area, THE API SHALL include a childCount field indicating the number of immediate children
11. WHEN childCount is 0, THE frontend SHALL know the area is a leaf node without making an additional API call
12. WHEN childCount is greater than 0, THE frontend SHALL know the area has children that can be fetched on demand
13. THE API SHALL provide a POST /api/geographic-areas endpoint that creates a new geographic area
14. THE API SHALL provide a PUT /api/geographic-areas/:id endpoint that updates a geographic area
15. THE API SHALL provide a DELETE /api/geographic-areas/:id endpoint that deletes a geographic area
16. WHEN creating a geographic area, THE API SHALL require name and area type
17. WHEN creating a geographic area, THE API SHALL accept an optional parent geographic area ID
18. WHEN creating a geographic area, THE API SHALL validate that the parent geographic area exists if provided
19. WHEN creating a geographic area, THE API SHALL prevent circular parent-child relationships
20. THE API SHALL support area types: NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD
21. WHEN deleting a geographic area, THE API SHALL prevent deletion if venues or child geographic areas reference it
22. THE API SHALL provide a GET /api/geographic-areas/:id/children endpoint that returns all immediate child geographic areas with their child counts
23. WHEN fetching children via GET /api/geographic-areas/:id/children, THE API SHALL include childCount for each returned child area
24. THE API SHALL provide a GET /api/geographic-areas/:id/ancestors endpoint that returns the full hierarchy path to the root
25. THE API SHALL provide a GET /api/geographic-areas/:id/venues endpoint that returns all venues in the geographic area and all descendant areas (recursive aggregation)
26. THE API SHALL provide a GET /api/geographic-areas/:id/statistics endpoint that returns activity and participant statistics for the geographic area and all descendants (recursive aggregation)
27. WHEN a geographic area filter is provided via geographicAreaId query parameter with depth parameter, THE API SHALL return the specified geographic area with children up to the specified depth, plus all ancestors (to maintain hierarchy context for tree view display)

### Requirement 6: Analyze Community Engagement

**User Story:** As a community organizer, I want to analyze community engagement metrics via API with flexible grouping and filtering dimensions, so that I can understand participation patterns, activity trends, and engagement changes over time across different segments of my community.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/analytics/engagement endpoint that returns engagement metrics
2. WHEN calculating engagement metrics with a date range, THE API SHALL count activities that existed at the start of the date range
3. WHEN calculating engagement metrics with a date range, THE API SHALL count activities that existed at the end of the date range
4. WHEN calculating engagement metrics with a date range, THE API SHALL count activities that were started within the date range
5. WHEN calculating engagement metrics with a date range, THE API SHALL count activities that were completed within the date range
6. WHEN calculating engagement metrics with a date range, THE API SHALL count activities that were cancelled within the date range
7. WHEN calculating engagement metrics with a date range, THE API SHALL count unique participants at the start of the date range
8. WHEN calculating engagement metrics with a date range, THE API SHALL count unique participants at the end of the date range
8a. WHEN calculating engagement metrics with a date range, THE API SHALL count total participation (non-unique participant-activity associations) at the start of the date range
8b. WHEN calculating engagement metrics with a date range, THE API SHALL count total participation (non-unique participant-activity associations) at the end of the date range
9. THE API SHALL provide activity counts in aggregate across all activity categories and types
10. THE API SHALL provide activity counts broken down by activity category
11. THE API SHALL provide activity counts broken down by activity type
12. THE API SHALL provide participant counts in aggregate across all activity categories and types
13. THE API SHALL provide participant counts broken down by activity category
14. THE API SHALL provide participant counts broken down by activity type
14a. THE API SHALL provide participation counts (non-unique) in aggregate across all activity categories and types
14b. THE API SHALL provide participation counts (non-unique) broken down by activity category
14c. THE API SHALL provide participation counts (non-unique) broken down by activity type
15. THE API SHALL support grouping engagement metrics by one or more dimensions: activity category, activity type, venue, geographic area, population, and date (with weekly, monthly, quarterly, or yearly granularity)
16. WHEN calculating engagement metrics, THE API SHALL accept an optional activityCategoryIds array filter to filter by one or more activity categories
17. WHEN an activityCategoryIds filter is provided, THE API SHALL include only activities belonging to at least one of the specified activity categories (OR logic within dimension)
18. WHEN calculating engagement metrics, THE API SHALL accept an optional activityTypeIds array filter to filter by one or more activity types
19. WHEN an activityTypeIds filter is provided, THE API SHALL include only activities of at least one of the specified activity types (OR logic within dimension)
20. WHEN calculating engagement metrics, THE API SHALL accept an optional geographicAreaIds array filter to filter by one or more geographic areas
21. WHEN a geographicAreaIds filter is provided, THE API SHALL include only activities and participants associated with venues in at least one of the specified geographic areas or their descendants (OR logic within dimension)
22. WHEN calculating engagement metrics, THE API SHALL accept an optional venueIds array filter to filter by one or more venues
23. WHEN a venueIds filter is provided, THE API SHALL include only activities at at least one of the specified venues (OR logic within dimension)
24. WHEN calculating engagement metrics, THE API SHALL accept an optional populationIds array filter to filter by one or more populations
25. WHEN a populationIds filter is provided, THE API SHALL include only participants who belong to at least one of the specified populations (OR logic within dimension)
26. WHEN a populationIds filter is provided, THE API SHALL include only activities that have at least one participant belonging to at least one of the specified populations
27. WHEN a populationIds filter is provided, THE API SHALL calculate participant counts based only on participants who belong to at least one of the specified populations
28. WHEN a populationIds filter is provided, THE API SHALL calculate participation counts based only on participant-activity associations where the participant belongs to at least one of the specified populations
29. WHEN a populationIds filter is provided and an activity has 5 participants with 3 belonging to at least one of the specified populations, THE API SHALL count 3 participants (not 5) and 3 participation instances (not 5) for that activity
30. WHEN calculating engagement metrics, THE API SHALL accept optional start and end date filters (range filter)
31. WHEN multiple filter dimensions are provided (e.g., activityCategoryIds AND venueIds AND populationIds), THE API SHALL apply all filters using AND logic across dimensions
32. WHEN multiple values are provided within a single filter dimension (e.g., venueIds=[A, B]), THE API SHALL apply OR logic within that dimension (venue IN (A, B))
33. WHEN multiple grouping dimensions are specified, THE API SHALL return metrics organized hierarchically by the specified dimensions in order
34. WHEN no date range is provided, THE API SHALL calculate metrics for all time
35. THE API SHALL return role distribution across all activities within the filtered and grouped results
36. WHEN determining current venue for activities with venue history, THE API SHALL treat null effectiveFrom dates as equivalent to the activity start date
37. WHEN determining current home address for participants with address history, THE API SHALL treat null effectiveFrom dates as the oldest address (earlier than any non-null date)
38. WHEN filtering or aggregating by venue, THE API SHALL correctly identify the current venue for activities considering null effectiveFrom dates
39. WHEN filtering or aggregating by participant location, THE API SHALL correctly identify the current home venue for participants considering null effectiveFrom dates
40. THE API SHALL use Zod preprocess to normalize array query parameters (activityCategoryIds, activityTypeIds, geographicAreaIds, venueIds, populationIds) before validation
41. WHEN a single value is provided for an array parameter, THE API SHALL parse it as an array with one element
42. WHEN multiple values are provided for an array parameter (e.g., ?venueIds=id1&venueIds=id2), THE API SHALL parse them as an array with multiple elements
43. WHEN comma-separated values are provided for an array parameter (e.g., ?venueIds=id1,id2), THE API SHALL parse them as an array with multiple elements

### Requirement 6A: Activity Lifecycle Events Analytics

**User Story:** As a program manager, I want to retrieve activity lifecycle event data (started and completed activities) via API grouped by category or type, so that I can analyze activity patterns and trends.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/analytics/activity-lifecycle endpoint that returns activity lifecycle event data
2. THE API SHALL accept optional startDate and endDate query parameters in ISO 8601 datetime format
3. THE API SHALL require a groupBy query parameter with values 'category' or 'type'
4. WHEN groupBy is 'category', THE API SHALL group results by activity category
5. WHEN groupBy is 'type', THE API SHALL group results by activity type
6. WHEN both startDate and endDate are provided, THE API SHALL count activities started within the date range (startDate >= startDate AND startDate <= endDate)
7. WHEN both startDate and endDate are provided, THE API SHALL count activities completed within the date range (endDate >= startDate AND endDate <= endDate AND status = COMPLETED)
8. WHEN only startDate is provided, THE API SHALL count activities started on or after startDate and completed on or after startDate
9. WHEN only endDate is provided, THE API SHALL count activities started on or before endDate and completed on or before endDate
10. WHEN neither startDate nor endDate is provided, THE API SHALL count all activities started and all activities completed (all-time metrics)
11. THE API SHALL exclude cancelled activities from both started and completed counts
12. THE API SHALL support optional geographicAreaIds query parameter to filter by one or more geographic areas
13. WHEN geographicAreaIds filter is provided, THE API SHALL include only activities at venues in the specified geographic areas or their descendants
14. THE API SHALL support optional activityTypeIds query parameter to filter by one or more activity types
15. WHEN activityTypeIds filter is provided, THE API SHALL include only activities of the specified types
16. THE API SHALL support optional venueIds query parameter to filter by one or more venues
17. WHEN venueIds filter is provided, THE API SHALL include only activities at the specified venues
17a. THE API SHALL support optional populationIds query parameter to filter by one or more populations
17b. WHEN populationIds filter is provided, THE API SHALL include only activities that have at least one participant belonging to at least one of the specified populations
18. WHEN multiple filters are provided, THE API SHALL apply all filters using AND logic
19. THE API SHALL return an array of objects with groupName, started count, and completed count
20. THE API SHALL sort results alphabetically by groupName
21. WHEN no activities match the filters, THE API SHALL return an empty array
22. THE API SHALL validate all query parameters and return 400 Bad Request for invalid inputs
23. THE API SHALL return 200 OK with the lifecycle event data on success
24. WHEN a single geographicAreaIds value is provided as a query parameter, THE API SHALL parse it as an array with one element
25. WHEN multiple geographicAreaIds values are provided (e.g., `?geographicAreaIds=id1&geographicAreaIds=id2`), THE API SHALL parse them as an array with multiple elements
26. WHEN a comma-separated geographicAreaIds value is provided (e.g., `?geographicAreaIds=id1,id2`), THE API SHALL parse them as an array with multiple elements
27. WHEN no geographicAreaIds parameter is provided, THE API SHALL treat it as undefined and return unfiltered results
28. THE API SHALL apply the same array parsing logic to activityCategoryIds, activityTypeIds, and venueIds query parameters
29. WHEN a geographic area filter is applied and no venues exist in those areas, THE API SHALL return an empty array
30. THE API SHALL validate that all provided geographic area IDs are valid UUIDs
31. WHEN an invalid UUID is provided in any array parameter, THE API SHALL return a 400 Bad Request error with a descriptive message
32. THE API SHALL use Zod preprocess to normalize array query parameters before validation

### Requirement 6B: Geographic Breakdown Analytics

**User Story:** As a community organizer, I want to retrieve engagement metrics grouped by immediate child geographic areas via API, so that I can analyze engagement patterns at the next level of geographic hierarchy and drill down progressively through the hierarchy.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/analytics/geographic endpoint that returns engagement metrics grouped by geographic area
2. THE API SHALL accept an optional parentGeographicAreaId query parameter to specify which geographic area's children to analyze
3. WHEN parentGeographicAreaId is provided, THE API SHALL return metrics for all immediate children of the specified geographic area
4. WHEN parentGeographicAreaId is not provided (null or omitted), THE API SHALL return metrics for all top-level geographic areas (areas with null parent)
5. FOR each geographic area in the breakdown, THE API SHALL calculate metrics by aggregating all activities and participants from that area and all its descendant areas (recursive aggregation)
6. THE API SHALL return an array of objects with geographicAreaId, geographicAreaName, areaType, activityCount, participantCount, and participationCount
7. THE API SHALL accept optional startDate and endDate query parameters to filter by date range
8. WHEN a date range is provided, THE API SHALL include only activities and participants within that date range
9. THE API SHALL accept optional activityCategoryIds, activityTypeIds, venueIds, and populationIds array filters
10. WHEN filters are provided, THE API SHALL apply all filters using AND logic before grouping by geographic area
11. THE API SHALL sort results alphabetically by geographicAreaName
12. WHEN no geographic areas match the criteria, THE API SHALL return an empty array
13. THE API SHALL validate all query parameters and return 400 Bad Request for invalid inputs
14. THE API SHALL return 200 OK with the geographic breakdown data on success
15. WHEN a user has geographic authorization restrictions with DENY rules, THE API SHALL exclude denied geographic areas and all their descendants from the breakdown results
16. WHEN calculating metrics for a geographic area with denied descendants, THE API SHALL only aggregate data from authorized descendant areas (excluding denied areas and their descendants)
17. WHEN a geographic area has both allowed and denied descendants, THE API SHALL include only the metrics from allowed descendants in the aggregation

### Requirement 7: Track Growth Over Time

**User Story:** As a community organizer, I want to track unique participant counts, unique activity counts, and total participation over time via API with flexible filtering by multiple dimensions and optional grouping by activity type or category, so that I can measure community development and understand engagement patterns at each point in the chronological history across different segments of my community.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/analytics/growth endpoint that returns growth metrics
2. WHEN calculating growth metrics, THE API SHALL accept a time period parameter (DAY, WEEK, MONTH, YEAR)
3. WHEN calculating growth metrics, THE API SHALL accept optional start and end date filters
4. WHEN calculating growth metrics, THE API SHALL count unique participants engaged in activities during each time period
5. WHEN calculating growth metrics, THE API SHALL count unique activities that were active during each time period
5a. WHEN calculating growth metrics, THE API SHALL count total participation (non-unique participant-activity associations) during each time period
6. THE API SHALL return time-series data ordered chronologically where each period represents a snapshot of unique participants, unique activities, and total participation at that point in time
7. THE API SHALL calculate percentage change between consecutive periods for participants, activities, and participation
8. WHEN calculating growth metrics, THE API SHALL accept an optional activityCategoryIds array filter to filter by one or more activity categories
9. WHEN an activityCategoryIds filter is provided, THE API SHALL include only activities belonging to at least one of the specified activity categories (OR logic within dimension)
10. WHEN calculating growth metrics, THE API SHALL accept an optional activityTypeIds array filter to filter by one or more activity types
11. WHEN an activityTypeIds filter is provided, THE API SHALL include only activities of at least one of the specified activity types (OR logic within dimension)
12. WHEN calculating growth metrics, THE API SHALL accept an optional geographicAreaIds array filter to filter by one or more geographic areas
13. WHEN a geographicAreaIds filter is provided, THE API SHALL include only activities and participants associated with venues in at least one of the specified geographic areas or their descendants (OR logic within dimension)
14. WHEN calculating growth metrics, THE API SHALL accept an optional venueIds array filter to filter by one or more venues
15. WHEN a venueIds filter is provided, THE API SHALL include only activities at at least one of the specified venues (OR logic within dimension)
16. WHEN calculating growth metrics, THE API SHALL accept an optional populationIds array filter to filter by one or more populations
17. WHEN a populationIds filter is provided, THE API SHALL include only participants who belong to at least one of the specified populations (OR logic within dimension)
18. WHEN a populationIds filter is provided, THE API SHALL include only activities that have at least one participant belonging to at least one of the specified populations
19. WHEN a populationIds filter is provided, THE API SHALL calculate unique participant counts based only on participants who belong to at least one of the specified populations
20. WHEN a populationIds filter is provided, THE API SHALL calculate total participation counts based only on participant-activity associations where the participant belongs to at least one of the specified populations
21. WHEN a populationIds filter is provided and an activity has 5 participants with 3 belonging to at least one of the specified populations, THE API SHALL count 3 unique participants (not 5) and 3 participation instances (not 5) for that activity in the time period
22. WHEN multiple filter dimensions are provided (e.g., activityCategoryIds AND venueIds AND populationIds), THE API SHALL apply all filters using AND logic across dimensions
23. WHEN multiple values are provided within a single filter dimension (e.g., venueIds=[A, B]), THE API SHALL apply OR logic within that dimension (venue IN (A, B))
24. THE API SHALL accept an optional groupBy query parameter with string values 'type' or 'category' (not 'activityType' or 'activityCategory')
25. WHEN groupBy is 'type', THE API SHALL convert the value to the internal GroupingDimension.ACTIVITY_TYPE enum and return separate time-series data for each activity type in the groupedTimeSeries field
26. WHEN groupBy is 'category', THE API SHALL convert the value to the internal GroupingDimension.ACTIVITY_CATEGORY enum and return separate time-series data for each activity category in the groupedTimeSeries field
27. WHEN no groupBy parameter is provided, THE API SHALL return aggregate time-series data in the timeSeries field with groupedTimeSeries undefined
28. WHEN groupBy is specified, THE API SHALL return an empty timeSeries array and populate the groupedTimeSeries object with activity type or category names as keys
29. WHEN returning time-series data, THE API SHALL include unique participant counts, unique activity counts, and total participation counts for each time period
30. THE API SHALL use Zod preprocess to normalize array query parameters (activityCategoryIds, activityTypeIds, geographicAreaIds, venueIds, populationIds) before validation
31. WHEN a single value is provided for an array parameter, THE API SHALL parse it as an array with one element
32. WHEN multiple values are provided for an array parameter (e.g., ?venueIds=id1&venueIds=id2), THE API SHALL parse them as an array with multiple elements
33. WHEN comma-separated values are provided for an array parameter (e.g., ?venueIds=id1,id2), THE API SHALL parse them as an array with multiple elements

### Requirement 8: Persist Data

**User Story:** As a system user, I want my data to be saved reliably via API, so that I don't lose information about activities and participants.

#### Acceptance Criteria

1. THE API SHALL use Prisma ORM to interact with the PostgreSQL database
2. THE API SHALL persist all create and update operations immediately
3. THE API SHALL use database transactions for operations affecting multiple tables
4. THE API SHALL enforce referential integrity through foreign key constraints
5. THE API SHALL return appropriate error messages when database operations fail
6. THE API SHALL use database migrations to manage schema changes

### Requirement 9: Support Offline Synchronization

**User Story:** As a mobile or web user, I want to synchronize offline changes via API, so that my work is saved when I regain connectivity.

#### Acceptance Criteria

1. THE API SHALL provide a POST /api/sync/batch endpoint that accepts multiple sync operations
2. WHEN processing sync operations, THE API SHALL execute all operations in a single transaction
3. WHEN processing sync operations, THE API SHALL map local IDs to server IDs for new entities
4. WHEN processing sync operations, THE API SHALL return success or failure for each operation
5. WHEN sync conflicts occur, THE API SHALL apply last-write-wins based on timestamp
6. WHEN sync conflicts occur, THE API SHALL return conflict information to the client
7. THE API SHALL support CREATE, UPDATE, and DELETE operation types

### Requirement 10: Authenticate Users

**User Story:** As a system administrator, I want secure user authentication via API, so that only authorized users can access the system.

#### Acceptance Criteria

1. THE API SHALL provide a POST /api/auth/login endpoint that authenticates users
2. THE API SHALL provide a POST /api/auth/logout endpoint that invalidates tokens
3. THE API SHALL provide a POST /api/auth/refresh endpoint that refreshes access tokens
4. THE API SHALL provide a GET /api/auth/me endpoint that returns current user information
4a. WHEN a client requests GET /api/auth/me, THE API SHALL return a user object containing id, displayName (nullable), email, role, createdAt, and updatedAt fields
4b. THE API SHALL NOT return the passwordHash field in the /api/auth/me response
5. WHEN authenticating, THE API SHALL validate email and password
6. WHEN authenticating, THE API SHALL return a JWT access token and refresh token
7. WHEN authenticating, THE API SHALL hash passwords using bcrypt
8. THE API SHALL expire access tokens after 15 minutes
9. THE API SHALL expire refresh tokens after 7 days
10. THE API SHALL recognize a root administrator whose username is extracted from the SRP_ROOT_ADMIN_EMAIL environment variable
11. THE API SHALL recognize a root administrator whose password is extracted from the SRP_ROOT_ADMIN_PASSWORD environment variable
12. WHEN the database is seeded, THE API SHALL populate the users table with a root administrator user
13. WHEN creating the root administrator user, THE API SHALL hash the password from SRP_ROOT_ADMIN_PASSWORD using bcrypt
14. WHEN creating the root administrator user, THE API SHALL assign the ADMINISTRATOR system role

### Requirement 11: Authorize User Actions

**User Story:** As a system administrator, I want role-based authorization via API, so that users can only perform actions they're permitted to do.

#### Acceptance Criteria

1. THE API SHALL require a valid JWT token for all protected endpoints
2. THE API SHALL support three system roles: ADMINISTRATOR, EDITOR, READ_ONLY
3. WHEN a user has ADMINISTRATOR role, THE API SHALL allow all operations including user management
4. WHEN a user has EDITOR role, THE API SHALL allow create, update, and delete operations on activities, participants, and configurations
5. WHEN a user has READ_ONLY role, THE API SHALL allow only GET operations
6. WHEN a user attempts an unauthorized action, THE API SHALL return 403 Forbidden
7. THE API SHALL validate user permissions before executing any operation

### Requirement 11A: Manage Users

**User Story:** As an administrator, I want to manage user accounts and their geographic authorizations via API, so that I can control system access, assign appropriate roles, and define geographic boundaries in a unified interface.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/users endpoint that returns all users
2. THE API SHALL provide a POST /api/v1/users endpoint that creates a new user
3. THE API SHALL provide a PUT /api/v1/users/:id endpoint that updates an existing user
3a. THE API SHALL provide a DELETE /api/v1/users/:id endpoint that deletes an existing user
3b. WHEN deleting a user, THE API SHALL also delete all associated geographic authorization rules
3c. WHEN deleting a user, THE API SHALL prevent deletion of the last administrator user
4. THE API SHALL restrict all user management endpoints to ADMINISTRATOR role only
5. WHEN a non-administrator attempts to access user management endpoints, THE API SHALL return 403 Forbidden
6. WHEN creating a user, THE API SHALL validate that email and password are provided
6a. WHEN creating a user, THE API SHALL accept an optional display name field
7. WHEN creating a user, THE API SHALL validate that email is unique
8. WHEN creating a user, THE API SHALL validate that password is at least 8 characters
9. WHEN creating a user, THE API SHALL hash the password using bcrypt before storing
10. WHEN creating a user, THE API SHALL require a role selection (ADMINISTRATOR, EDITOR, or READ_ONLY)
11. WHEN creating a user, THE API SHALL accept an optional array of geographic authorization rules
12. WHEN creating a user with authorization rules, THE API SHALL create the user and all authorization rules in a single atomic transaction
13. WHEN updating a user, THE API SHALL allow changing display name, email, password, and role
14. WHEN updating a user with a new password, THE API SHALL hash the password using bcrypt
15. WHEN updating a user without providing a password, THE API SHALL preserve the existing password
16. WHEN updating a user's email, THE API SHALL validate that the new email is unique
17. THE API SHALL return user objects with id, displayName (nullable), email, role, createdAt, and updatedAt fields
18. THE API SHALL NOT return password hashes in any API response
19. THE API SHALL provide a GET /api/v1/users/:id/geographic-authorizations endpoint that returns all geographic authorization rules for a user
20. THE API SHALL provide a POST /api/v1/users/:id/geographic-authorizations endpoint that creates a new geographic authorization rule
21. THE API SHALL provide a DELETE /api/v1/users/:id/geographic-authorizations/:authId endpoint that deletes a geographic authorization rule
22. THE API SHALL provide a GET /api/v1/users/:id/authorized-areas endpoint that returns the user's effective authorized areas
23. WHEN creating an authorization rule, THE API SHALL validate that the user and geographic area exist
24. WHEN creating an authorization rule, THE API SHALL prevent duplicate rules for the same user and geographic area
25. THE API SHALL support ALLOW and DENY rule types for geographic authorization
26. THE API SHALL apply deny-first logic when evaluating geographic authorization (DENY rules take precedence over ALLOW rules)
27. THE API SHALL grant access to descendants when an ALLOW rule is applied to a geographic area
28. THE API SHALL grant read-only access to ancestors when an ALLOW rule is applied to a geographic area
29. THE API SHALL audit all geographic authorization rule changes in the audit log

### Requirement 12: Audit User Actions

**User Story:** As a system administrator, I want audit logging via API, so that I can track user actions for security and compliance.

#### Acceptance Criteria

1. THE API SHALL log all authentication events (login, logout, token refresh)
2. THE API SHALL log all role changes
3. THE API SHALL log all entity modifications (create, update, delete)
4. WHEN logging actions, THE API SHALL record user ID (when available), action type, entity type, entity ID, and timestamp
4a. WHEN logging authentication events, THE API SHALL support nullable user ID for pre-authentication events (e.g., failed login attempts)
4b. WHEN logging successful login events, THE API SHALL extract and record the authenticated user's ID from the response
5. WHEN logging actions, THE API SHALL store additional details in JSON format
6. THE API SHALL provide audit logs to administrators only
7. WHEN a user ID cannot be determined, THE API SHALL create the audit log without a user ID rather than failing the request

### Requirement 13: Handle Errors Gracefully

**User Story:** As a client developer, I want consistent error responses from API, so that I can handle errors appropriately.

#### Acceptance Criteria

1. THE API SHALL return consistent error response format with code, message, and details
2. THE API SHALL return 400 Bad Request for validation errors
3. THE API SHALL return 401 Unauthorized for missing or invalid authentication
4. THE API SHALL return 403 Forbidden for insufficient permissions
5. THE API SHALL return 404 Not Found for non-existent resources
6. THE API SHALL return 500 Internal Server Error for unexpected errors
7. THE API SHALL log all errors with stack traces for debugging

### Requirement 14: Document API Endpoints

**User Story:** As a client developer, I want API documentation, so that I can integrate with the API correctly.

#### Acceptance Criteria

1. THE API SHALL provide an OpenAPI 3.0 specification for all endpoints
2. THE API SHALL serve interactive API documentation via Swagger UI
3. THE API SHALL document all request parameters, request bodies, and response formats
4. THE API SHALL provide example requests and responses for all endpoints
5. THE API SHALL document all error responses

### Requirement 15: Validate Input Data

**User Story:** As a backend developer, I want input validation, so that invalid data is rejected before processing.

#### Acceptance Criteria

1. THE API SHALL validate all request bodies against schemas
2. THE API SHALL validate all query parameters and path parameters
3. THE API SHALL return detailed validation errors for invalid input
4. THE API SHALL use Zod for schema validation
5. THE API SHALL sanitize input to prevent injection attacks

### Requirement 16: Provide Local Database Setup Script

**User Story:** As a developer, I want an optional script to set up a local PostgreSQL database using Finch, so that I can easily run integration tests without manual database configuration using freely available open-source tools.

#### Acceptance Criteria

1. THE API package SHALL include an optional sidecar script for local database setup
2. WHEN the script is executed, THE script SHALL detect if Finch is properly installed on the system
3. WHEN Finch is not installed, THE script SHALL install Finch using the appropriate platform-specific package manager (brew for macOS, yum for RHEL/CentOS, apt for Debian/Ubuntu)
4. THE script SHALL use Finch (not Docker Desktop) as the container runtime for maximum compatibility and open-source availability
5. WHEN Finch is installed or after installation, THE script SHALL download the latest PostgreSQL container image
6. WHEN the PostgreSQL image is downloaded, THE script SHALL start a PostgreSQL container with the database port exposed for API connection
7. THE script SHALL configure the container with appropriate environment variables for database name, username, and password
8. THE script SHALL provide clear console output indicating the progress and completion status of each step
9. THE script SHALL NOT be included in the production deployment of the API service
10. THE script SHALL be located in a development utilities directory within the backend-api package
11. WHEN the container is running, THE script SHALL output the connection string for the API to use

### Requirement 17: Implement Pagination with Total Count

**User Story:** As a client developer, I want paginated list endpoints with total count metadata, so that I can efficiently load large datasets in batches, render incrementally, and provide progress feedback to users without overwhelming the client or network.

#### Acceptance Criteria

1. THE API SHALL support pagination on GET /api/v1/activities endpoint
2. THE API SHALL support pagination on GET /api/v1/participants endpoint
3. THE API SHALL support pagination on GET /api/v1/venues endpoint
4. THE API SHALL support pagination on GET /api/v1/geographic-areas endpoint
5. WHEN pagination is requested, THE API SHALL accept page and limit query parameters
6. THE API SHALL default to page 1 and limit 100 if not specified
7. THE API SHALL enforce a maximum limit of 100 items per page
8. WHEN returning paginated results, THE API SHALL include pagination metadata with page, limit, total, and totalPages
9. THE API SHALL calculate and return the total count of matching records on every paginated request, including the first page
10. THE API SHALL optimize total count queries to avoid performance degradation on large datasets
11. THE API SHALL wrap paginated data in a consistent response format with data and pagination fields
12. THE API SHALL return the total count even when filters are applied, reflecting the filtered result set size

### Requirement 18: Support Optimistic Locking

**User Story:** As a client developer, I want optimistic locking on updates, so that I can prevent lost updates when multiple users edit the same resource.

#### Acceptance Criteria

1. THE API SHALL include a version field in all entity responses
2. WHEN updating an entity, THE API SHALL require the current version number in the request
3. WHEN the provided version does not match the current version, THE API SHALL return 409 Conflict
4. WHEN an update succeeds, THE API SHALL increment the version number
5. THE API SHALL apply optimistic locking to Activity, Participant, Venue, GeographicArea, ActivityType, and Role entities

### Requirement 19: Implement Rate Limiting

**User Story:** As a system administrator, I want rate limiting on API endpoints, so that I can prevent abuse and ensure fair resource usage.

#### Acceptance Criteria

1. THE API SHALL limit authentication endpoints to 5 requests per minute per IP address
2. THE API SHALL limit mutation endpoints to 100 requests per minute per authenticated user
3. THE API SHALL limit query endpoints to 1000 requests per minute per authenticated user
4. WHEN rate limits are exceeded, THE API SHALL return 429 Too Many Requests
5. THE API SHALL include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers in all responses
6. THE API SHALL reset rate limit counters at the specified reset time

### Requirement 20: Version API Endpoints

**User Story:** As a client developer, I want versioned API endpoints, so that I can rely on stable contracts and migrate to new versions when ready.

#### Acceptance Criteria

1. THE API SHALL include version number in the URL path as /api/v1/...
2. THE API SHALL maintain backward compatibility within the same major version
3. WHEN breaking changes are introduced, THE API SHALL increment the major version to /api/v2/...
4. THE API SHALL document version changes in the OpenAPI specification
5. THE API SHALL support multiple API versions simultaneously during transition periods

### Requirement 21: High-Cardinality Entity Filtering with Batched Loading

**User Story:** As a client developer working with large datasets, I want API endpoints to support efficient text-based filtering and batched pagination for venues, participants, and geographic areas, so that dropdown lists and table views can scale to millions of records with low initial latency, incremental rendering, and continuous progress feedback.

#### Acceptance Criteria

1. THE API SHALL support text-based filtering on GET /api/v1/venues endpoint via a query parameter (e.g., ?search=text)
2. THE API SHALL support text-based filtering on GET /api/v1/participants endpoint via a query parameter (e.g., ?search=text)
3. THE API SHALL support text-based filtering on GET /api/v1/geographic-areas endpoint via a query parameter (e.g., ?search=text)
4. WHEN a search query parameter is provided for venues, THE API SHALL return only venues whose name or address contains the search text (case-insensitive partial match)
5. WHEN a search query parameter is provided for participants, THE API SHALL return only participants whose name or email contains the search text (case-insensitive partial match)
6. WHEN a search query parameter is provided for geographic areas, THE API SHALL return only geographic areas whose name contains the search text (case-insensitive partial match)
7. WHEN both search and geographicAreaId query parameters are provided, THE API SHALL apply both filters using AND logic
8. THE API SHALL support pagination on all filtered results using page and limit query parameters with batches of 100 items
9. WHEN returning filtered and paginated results, THE API SHALL include pagination metadata (page, limit, total, totalPages)
10. THE API SHALL return the total count of matching records on the first page request to enable progress indicators
11. THE API SHALL optimize database queries for text-based filtering using appropriate indexes on name, address, and email fields
12. THE API SHALL return the first page of results by default when no page parameter is specified
13. THE API SHALL limit the maximum page size to 100 items to prevent performance issues
14. THE API SHALL calculate total count efficiently using database COUNT queries optimized for large datasets

### Requirement 22: Clear Optional Fields

**User Story:** As a community organizer, I want to clear optional fields that have been previously populated, so that I can remove information that is no longer relevant or was entered incorrectly.

#### Acceptance Criteria

1. WHEN updating a participant, THE API SHALL accept null or empty string values for optional fields (email, phone, notes, dateOfBirth, dateOfRegistration, nickname) to clear them
2. WHEN updating a venue, THE API SHALL accept null or empty string values for optional fields (latitude, longitude, venueType) to clear them
3. WHEN updating an activity, THE API SHALL accept null value for endDate to convert a finite activity to an ongoing activity
4. WHEN updating an assignment, THE API SHALL accept null or empty string value for notes to clear the notes field
5. WHEN a null or empty string value is provided for an optional field, THE API SHALL set the field to null in the database
6. WHEN retrieving an entity with cleared optional fields, THE API SHALL return null for those fields
7. THE API SHALL distinguish between omitting a field (no change) and explicitly setting it to null/empty (clear the field)
8. WHEN a field is omitted from an update request, THE API SHALL preserve the existing value
9. WHEN a field is explicitly set to null or empty string in an update request, THE API SHALL clear the field value

### Requirement 23: CSV Import and Export

**User Story:** As a community organizer, I want to import and export data in CSV format via API, so that I can bulk load data from external sources and share data with other systems.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/participants/export endpoint that exports all participants to CSV format
2. THE API SHALL provide a GET /api/v1/venues/export endpoint that exports all venues to CSV format
3. THE API SHALL provide a GET /api/v1/activities/export endpoint that exports all activities to CSV format
4. THE API SHALL provide a GET /api/v1/geographic-areas/export endpoint that exports all geographic areas to CSV format
5. WHEN exporting participants, THE API SHALL include columns for: id, name, email, phone, notes, dateOfBirth, dateOfRegistration, nickname, createdAt, updatedAt
6. WHEN exporting venues, THE API SHALL include columns for: id, name, address, geographicAreaId, geographicAreaName, latitude, longitude, venueType, createdAt, updatedAt
7. WHEN exporting activities, THE API SHALL include columns for: id, name, activityTypeId, activityTypeName, activityCategoryId, activityCategoryName, startDate, endDate, status, createdAt, updatedAt
8. WHEN exporting geographic areas, THE API SHALL include columns for: id, name, areaType, parentGeographicAreaId, parentGeographicAreaName, createdAt, updatedAt
9. WHEN no records exist for export, THE API SHALL return an empty CSV with only the header row containing column names
10. THE API SHALL set the Content-Type header to text/csv for all export responses
11. THE API SHALL set the Content-Disposition header to attachment with an appropriate filename for all export responses
12. THE API SHALL provide a POST /api/v1/participants/import endpoint that accepts CSV file uploads
13. THE API SHALL provide a POST /api/v1/venues/import endpoint that accepts CSV file uploads
14. THE API SHALL provide a POST /api/v1/activities/import endpoint that accepts CSV file uploads
15. THE API SHALL provide a POST /api/v1/geographic-areas/import endpoint that accepts CSV file uploads
16. WHEN importing participants, THE API SHALL accept CSV files with columns: name, email, phone, notes, dateOfBirth, dateOfRegistration, nickname
17. WHEN importing venues, THE API SHALL accept CSV files with columns: name, address, geographicAreaId, latitude, longitude, venueType
18. WHEN importing activities, THE API SHALL accept CSV files with columns: name, activityTypeId, startDate, endDate, status
19. WHEN importing geographic areas, THE API SHALL accept CSV files with columns: name, areaType, parentGeographicAreaId
20. WHEN importing CSV data, THE API SHALL validate each row according to the same validation rules as the create endpoints
21. WHEN importing CSV data, THE API SHALL skip rows with validation errors and continue processing remaining rows
22. WHEN importing CSV data, THE API SHALL return a summary response with counts of successful imports, failed imports, and detailed error messages for failed rows
23. WHEN importing CSV data with an id column present, THE API SHALL treat rows with existing IDs as updates and rows without IDs as creates
24. WHEN importing CSV data without an id column, THE API SHALL treat all rows as creates
25. THE API SHALL support multipart/form-data file uploads for all import endpoints
26. THE API SHALL validate that uploaded files are valid CSV format
27. THE API SHALL limit CSV file uploads to a maximum size of 10MB
28. WHEN a CSV file exceeds the size limit, THE API SHALL return 413 Payload Too Large
29. THE API SHALL parse CSV files with proper handling of quoted fields, escaped characters, and different line endings
30. THE API SHALL support both comma and semicolon as field delimiters in CSV files
31. WHEN exporting data, THE API SHALL respect the global geographic area filter if provided via geographicAreaId query parameter
32. WHEN exporting with a geographic area filter, THE API SHALL include only records associated with venues in the specified geographic area or its descendants

### Requirement 24: Geographic Authorization

**User Story:** As a system administrator, I want to control user access by geographic area with granular allow-listing and deny-listing rules, so that I can restrict users to specific regions and ensure data security across geographic boundaries.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/users/:id/geographic-authorizations endpoint that returns all geographic authorization rules for a user
2. THE API SHALL provide a POST /api/v1/users/:id/geographic-authorizations endpoint that creates a new geographic authorization rule
3. THE API SHALL provide a DELETE /api/v1/users/:id/geographic-authorizations/:authId endpoint that deletes a geographic authorization rule
4. THE API SHALL support two authorization rule types: ALLOW and DENY
5. WHEN creating a geographic authorization rule, THE API SHALL require user ID, geographic area ID, and rule type (ALLOW or DENY)
6. WHEN creating a geographic authorization rule, THE API SHALL validate that the user and geographic area exist
7. WHEN creating a geographic authorization rule, THE API SHALL prevent duplicate rules for the same user and geographic area combination
8. THE API SHALL store geographic authorization rules in a UserGeographicAuthorization table with userId, geographicAreaId, ruleType, createdAt, and createdBy fields
9. WHEN evaluating user access to a geographic area, THE API SHALL first check for DENY rules
10. WHEN a DENY rule exists for a geographic area or any of its ancestors, THE API SHALL deny access regardless of ALLOW rules
11. WHEN no DENY rules apply and an ALLOW rule exists for a geographic area, THE API SHALL grant access to that area and all its descendants
12. WHEN an ALLOW rule exists for a geographic area, THE API SHALL grant read-only access to all ancestor areas
13. WHEN a user has no geographic authorization rules, THE API SHALL grant access to all geographic areas (unrestricted access)
14. WHEN a user has at least one geographic authorization rule, THE API SHALL restrict access to only the authorized areas
15. THE API SHALL apply geographic authorization filtering to GET /api/v1/participants endpoint
16. THE API SHALL apply geographic authorization filtering to GET /api/v1/activities endpoint
17. THE API SHALL apply geographic authorization filtering to GET /api/v1/venues endpoint
18. THE API SHALL apply geographic authorization filtering to GET /api/v1/geographic-areas endpoint
19. THE API SHALL apply geographic authorization filtering to GET /api/analytics/engagement endpoint
20. THE API SHALL apply geographic authorization filtering to GET /api/analytics/growth endpoint
21. THE API SHALL apply geographic authorization filtering to GET /api/analytics/activity-lifecycle endpoint
22. THE API SHALL apply geographic authorization filtering to all export endpoints
23. WHEN a user requests a list endpoint without an explicit geographicAreaId parameter, THE API SHALL implicitly filter results to only authorized geographic areas
24. WHEN a user requests a list endpoint with an explicit geographicAreaId parameter, THE API SHALL validate that the user is authorized to access that geographic area
25. WHEN a user requests an unauthorized geographic area, THE API SHALL return 403 Forbidden with error code GEOGRAPHIC_AUTHORIZATION_DENIED
26. WHEN a user attempts to create a geographic area, THE API SHALL validate that the parent area (if provided) is within the user's authorized areas
27. WHEN a user attempts to create a top-level geographic area (no parent) and has geographic restrictions, THE API SHALL return 403 Forbidden
28. WHEN a user attempts to create a venue, THE API SHALL validate that the venue's geographic area is within the user's authorized areas
29. WHEN a user attempts to create an activity with a venue, THE API SHALL validate that the venue's geographic area is within the user's authorized areas
30. WHEN a user attempts to update a venue's geographic area, THE API SHALL validate that the new geographic area is within the user's authorized areas
31. THE API SHALL restrict geographic authorization management endpoints to ADMINISTRATOR role only
32. WHEN a non-administrator attempts to access geographic authorization endpoints, THE API SHALL return 403 Forbidden
33. THE API SHALL include the user's authorized geographic area IDs in the JWT token payload for efficient authorization checks
34. WHEN generating a JWT token, THE API SHALL query the user's geographic authorization rules and include the authorized area IDs in the token
35. WHEN validating a JWT token, THE API SHALL extract the authorized area IDs and use them for authorization filtering
36. THE API SHALL provide a GET /api/v1/users/:id/authorized-areas endpoint that returns the complete list of geographic areas the user can access (including descendants of allowed areas and ancestors for read-only access)
37. WHEN calculating authorized areas, THE API SHALL expand ALLOW rules to include all descendant areas
38. WHEN calculating authorized areas, THE API SHALL include ancestor areas with read-only flag
39. WHEN an area is an ancestor of any allowed area, THE API SHALL mark it with isAncestor=true even if that area also has FULL access from another ALLOW rule
40. WHEN returning authorized areas, THE API SHALL ensure that any area serving as an ancestor for navigation context is always marked with isAncestor=true to distinguish it from areas that are directly allowed for filtering purposes
41. THE API SHALL audit all geographic authorization rule changes in the audit log

### Requirement 25: Geographic Authorization for Individual Resource Access

**User Story:** As a system administrator, I want geographic authorization to be enforced on individual resource access (detail views, updates, deletes), so that users cannot bypass authorization by directly accessing resources via URL or UUID even when they are denied access to those geographic areas.

#### Acceptance Criteria

1. THE API SHALL enforce geographic authorization on GET /api/v1/participants/:id endpoint
2. THE API SHALL enforce geographic authorization on GET /api/v1/activities/:id endpoint
3. THE API SHALL enforce geographic authorization on GET /api/v1/venues/:id endpoint
4. THE API SHALL enforce geographic authorization on GET /api/v1/geographic-areas/:id endpoint
5. WHEN a user requests a participant by ID, THE API SHALL determine the participant's current home venue from their most recent address history record
6. WHEN a user requests a participant by ID, THE API SHALL validate that the participant's current home venue's geographic area is within the user's authorized areas
7. WHEN a user requests a participant by ID and the participant is not authorized, THE API SHALL return 403 Forbidden with error code GEOGRAPHIC_AUTHORIZATION_DENIED
8. WHEN a user requests an activity by ID, THE API SHALL determine the activity's current venue from its most recent venue history record
9. WHEN a user requests an activity by ID, THE API SHALL validate that the activity's current venue's geographic area is within the user's authorized areas
10. WHEN a user requests an activity by ID and the activity is not authorized, THE API SHALL return 403 Forbidden with error code GEOGRAPHIC_AUTHORIZATION_DENIED
11. WHEN a user requests a venue by ID, THE API SHALL validate that the venue's geographic area is within the user's authorized areas
12. WHEN a user requests a venue by ID and the venue is not authorized, THE API SHALL return 403 Forbidden with error code GEOGRAPHIC_AUTHORIZATION_DENIED
13. WHEN a user requests a geographic area by ID, THE API SHALL validate that the geographic area is within the user's authorized areas (including read-only access to ancestors)
14. WHEN a user requests a geographic area by ID and the area is not authorized, THE API SHALL return 403 Forbidden with error code GEOGRAPHIC_AUTHORIZATION_DENIED
15. THE API SHALL enforce geographic authorization on PUT /api/v1/participants/:id endpoint
16. THE API SHALL enforce geographic authorization on PUT /api/v1/activities/:id endpoint
17. THE API SHALL enforce geographic authorization on PUT /api/v1/venues/:id endpoint
18. THE API SHALL enforce geographic authorization on PUT /api/v1/geographic-areas/:id endpoint
19. THE API SHALL enforce geographic authorization on DELETE /api/v1/participants/:id endpoint
20. THE API SHALL enforce geographic authorization on DELETE /api/v1/activities/:id endpoint
21. THE API SHALL enforce geographic authorization on DELETE /api/v1/venues/:id endpoint
22. THE API SHALL enforce geographic authorization on DELETE /api/v1/geographic-areas/:id endpoint
23. WHEN a user attempts to update a participant and the participant is not in an authorized area, THE API SHALL return 403 Forbidden
24. WHEN a user attempts to update an activity and the activity is not in an authorized area, THE API SHALL return 403 Forbidden
25. WHEN a user attempts to update a venue and the venue is not in an authorized area, THE API SHALL return 403 Forbidden
26. WHEN a user attempts to update a geographic area and the area is not authorized, THE API SHALL return 403 Forbidden
27. WHEN a user attempts to delete a participant and the participant is not in an authorized area, THE API SHALL return 403 Forbidden
28. WHEN a user attempts to delete an activity and the activity is not in an authorized area, THE API SHALL return 403 Forbidden
29. WHEN a user attempts to delete a venue and the venue is not in an authorized area, THE API SHALL return 403 Forbidden
30. WHEN a user attempts to delete a geographic area and the area is not authorized, THE API SHALL return 403 Forbidden
31. THE API SHALL enforce geographic authorization on GET /api/v1/participants/:id/activities endpoint
32. THE API SHALL enforce geographic authorization on GET /api/v1/participants/:id/address-history endpoint
33. THE API SHALL enforce geographic authorization on GET /api/v1/participants/:id/populations endpoint
34. THE API SHALL enforce geographic authorization on GET /api/v1/activities/:id/participants endpoint
35. THE API SHALL enforce geographic authorization on GET /api/v1/activities/:id/venues endpoint
36. THE API SHALL enforce geographic authorization on GET /api/v1/venues/:id/activities endpoint
37. THE API SHALL enforce geographic authorization on GET /api/v1/venues/:id/participants endpoint
38. THE API SHALL enforce geographic authorization on GET /api/v1/geographic-areas/:id/children endpoint
39. THE API SHALL enforce geographic authorization on GET /api/v1/geographic-areas/:id/ancestors endpoint
40. THE API SHALL enforce geographic authorization on GET /api/v1/geographic-areas/:id/venues endpoint
41. THE API SHALL enforce geographic authorization on GET /api/v1/geographic-areas/:id/statistics endpoint
42. WHEN a user has no geographic authorization rules (unrestricted access), THE API SHALL allow access to all resources
43. WHEN a user has ADMINISTRATOR role, THE API SHALL bypass geographic authorization checks for administrative operations
44. THE API SHALL apply geographic authorization consistently across all resource access patterns (direct access, nested resources, related entities)
45. THE API SHALL log all geographic authorization denials in the audit log with user ID, resource type, resource ID, and attempted action


### Requirement 26: Generate Fake Data for Load Testing

**User Story:** As a developer, I want a script to generate realistic fake data in the local database, so that I can perform load testing and validate system performance with large datasets.

#### Acceptance Criteria

1. THE API package SHALL include a fake data generation script located in the scripts directory
2. THE script SHALL use the same environment variables for database connectivity as the main API application
3. WHEN the script is executed, THE script SHALL prompt the user for confirmation before proceeding with data generation
4. WHEN the NODE_ENV environment variable is not set to "development", THE script SHALL refuse to run and exit with an error message
5. THE script SHALL accept configurable parameters for the number of records to create for each entity type: geographic areas, venues, participants, and activities
6. THE script SHALL default to creating 10,000 geographic areas when no parameter is provided
7. THE script SHALL default to creating 1,000,000 venues when no parameter is provided
8. THE script SHALL default to creating 10,000,000 participants when no parameter is provided
9. THE script SHALL default to creating 20,000,000 activities when no parameter is provided
10. THE script SHALL use deterministic naming patterns for all generated entities
11. THE script SHALL use the MD5 hash of the entity name, formatted as a UUID, to populate the unique identifier field
12. THE script SHALL use database upsert operations to ensure idempotency (running the script multiple times produces the same result)
13. WHEN generating geographic areas, THE script SHALL create 2% as COUNTRY type, 5% as STATE type, 3% as PROVINCE type, 20% as CLUSTER type, 30% as CITY type, and 40% as NEIGHBOURHOOD type
14. WHEN generating geographic areas, THE script SHALL assign null parent only to COUNTRY type areas
15. WHEN generating geographic areas, THE script SHALL assign parents to non-country areas where the parent type is logically higher in the hierarchy (e.g., cities can belong to clusters, counties, provinces, states, or countries, but never to neighbourhoods)
16. WHEN generating geographic areas, THE script SHALL ensure that for a given country, all immediate sub-divisions have a consistent type (either all provinces, all states, or all clusters)
17. WHEN generating venues, THE script SHALL use a naming pattern that incorporates the geographic area name followed by "venue" followed by a serial number
18. WHEN generating venues, THE script SHALL assign venues only to leaf-node geographic areas (areas with no children)
19. WHEN generating venues, THE script SHALL distribute venues evenly across all leaf-node geographic areas using pseudo-random logic (e.g., UUID modulo number of leaf areas)
20. WHEN generating venues for a given geographic area, THE script SHALL assign latitude and longitude coordinates within a 10km radius of a central point
21. WHEN generating venues for different geographic areas, THE script SHALL use different central coordinates distributed around the globe
22. WHEN generating participants, THE script SHALL use a simple and predictable naming pattern
23. WHEN generating participants, THE script SHALL assign each participant to a venue as their home address using pseudo-random logic (e.g., UUID modulo number of venues)
24. WHEN generating activities, THE script SHALL use a simple and predictable naming pattern
25. WHEN generating activities, THE script SHALL assign each activity to a venue using pseudo-random logic (e.g., UUID modulo number of venues)
26. WHEN generating activities, THE script SHALL assign between 3 and 15 participants to each activity using pseudo-random logic based on the activity UUID
27. WHEN generating activities, THE script SHALL assign a role to each participant-activity assignment using pseudo-random logic
28. THE script SHALL provide progress output during execution showing the number of records created for each entity type
29. THE script SHALL complete successfully and output a summary of all created records
30. THE script SHALL handle database connection errors gracefully and provide clear error messages
31. THE script SHALL support a removal mode via a --remove flag that deletes all auto-generated fake data
32. WHEN the --remove flag is provided, THE script SHALL prompt the user for confirmation before proceeding with data deletion
33. WHEN the --remove flag is provided and NODE_ENV is not set to "development", THE script SHALL refuse to run and exit with an error message
34. WHEN removing fake data, THE script SHALL identify records by their deterministic naming patterns (e.g., names starting with "COUNTRY ", "Participant ", "Activity ", "Area ")
35. WHEN removing fake data, THE script SHALL delete records in the correct order to respect foreign key constraints (assignments first, then activities, then participants, then venues, then geographic areas)
36. WHEN removing fake data, THE script SHALL NOT delete predefined seed data (activity categories, activity types, roles, root administrator)
37. WHEN removing fake data, THE script SHALL NOT delete manually created records that don't match the deterministic naming patterns
38. WHEN removing fake data, THE script SHALL provide progress output showing the number of records deleted for each entity type
39. WHEN removing fake data, THE script SHALL complete successfully and output a summary of all deleted records
40. THE script SHALL allow mixing auto-generated fake data with manually entered test data, enabling selective removal of only the auto-generated records

### Requirement 27: Provide Optimized Map Data API Endpoints

**User Story:** As a frontend developer, I want specialized API endpoints that provide lightweight location data for map markers with batched pagination and support lazy-loaded popup content, so that the map can render quickly with thousands of markers through incremental rendering and provide loading feedback to the user.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/map/activities endpoint that returns lightweight activity marker data with pagination support
2. WHEN fetching activity markers, THE API SHALL return only the minimal fields needed for map rendering: id, latitude, longitude, activityTypeId, activityCategoryId
3. THE API SHALL NOT include activity name, participant details, or other verbose fields in the activity markers response
4. THE API SHALL support pagination on GET /api/v1/map/activities endpoint using page and limit query parameters
5. THE API SHALL default to limit 100 items per page for map marker endpoints when limit is not specified
6. THE API SHALL enforce a maximum limit of 100 items per page for map marker endpoints
7. WHEN returning paginated map marker results, THE API SHALL include pagination metadata with page, limit, total, and totalPages
8. THE API SHALL provide a GET /api/v1/map/activities/:id/popup endpoint that returns detailed popup content for a specific activity marker
9. WHEN fetching activity popup content, THE API SHALL return: id, name, activityTypeName, activityCategoryName, startDate, participantCount
10. THE API SHALL provide a GET /api/v1/map/participant-homes endpoint that returns lightweight participant home marker data with pagination support
11. WHEN fetching participant home markers, THE API SHALL return only the minimal fields needed for map rendering: venueId, latitude, longitude, participantCount (count of participants at that venue)
12. THE API SHALL group participant homes by venue to avoid duplicate markers for the same address
13. THE API SHALL support pagination on GET /api/v1/map/participant-homes endpoint using page and limit query parameters
14. THE API SHALL provide a GET /api/v1/map/participant-homes/:venueId/popup endpoint that returns detailed popup content for a specific participant home marker
15. WHEN fetching participant home popup content, THE API SHALL return: venueId, venueName, participantCount, participantNames (array of names)
16. THE API SHALL provide a GET /api/v1/map/venues endpoint that returns lightweight venue marker data with pagination support
17. WHEN fetching venue markers, THE API SHALL return only the minimal fields needed for map rendering: id, latitude, longitude
18. THE API SHALL NOT include venue name, address, or geographic area details in the venue markers response
19. THE API SHALL support pagination on GET /api/v1/map/venues endpoint using page and limit query parameters
20. THE API SHALL provide a GET /api/v1/map/venues/:id/popup endpoint that returns detailed popup content for a specific venue marker
21. WHEN fetching venue popup content, THE API SHALL return: id, name, address, geographicAreaName
22. THE API SHALL apply geographic authorization filtering to all map data endpoints
23. WHEN a user has geographic restrictions, THE API SHALL return only markers for venues in authorized geographic areas
24. THE API SHALL support optional filter query parameters on all map marker endpoints: geographicAreaIds, activityCategoryIds, activityTypeIds, venueIds, populationIds, startDate, endDate, status
25. WHEN filters are provided to map marker endpoints, THE API SHALL apply the same filtering logic as the analytics endpoints (OR within dimensions, AND across dimensions)
26. THE API SHALL optimize map marker queries for performance by using database indexes on latitude, longitude, and foreign key fields
27. THE API SHALL return map marker data in a flat array format optimized for client-side rendering
28. THE API SHALL include appropriate cache headers on map marker responses to enable client-side caching
29. WHEN determining current venue for activity markers, THE API SHALL correctly handle null effectiveFrom dates (treat as activity startDate)
30. WHEN determining current home venue for participant home markers, THE API SHALL correctly handle null effectiveFrom dates (treat as oldest address)
31. THE API SHALL exclude activities and participants without venue coordinates from map marker responses
32. THE API SHALL exclude venues without latitude or longitude coordinates from venue marker responses
