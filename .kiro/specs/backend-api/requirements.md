# Requirements Document: Backend API Package

## Introduction

The Backend API package provides the RESTful API service that implements all business logic, data persistence, authentication, and authorization for the Cultivate system. It serves as the single source of truth for all data and coordinates operations across multiple client applications.

> **Performance Optimizations**: This requirements document covers core API functionality. For detailed performance optimization requirements (database-level aggregation, raw SQL queries, pagination), see:
> - `.kiro/specs/analytics-optimization/requirements.md` - Analytics service optimization requirements
> - `.kiro/specs/geographic-breakdown-optimization/requirements.md` - Geographic breakdown optimization requirements
> - `.kiro/specs/map-data-optimization/requirements.md` - Map data API optimization requirements
> 
> See also: `.kiro/specs/OPTIMIZATION_SPECS.md` for an overview and the "Performance Optimization Cross-References" section at the end of this document.

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
- **Batch_Details_Endpoint**: An API endpoint that accepts multiple entity IDs and returns complete entity details for all specified entities in a single request, complementing the batch-ancestors endpoint by providing full geographic area data after ancestor IDs are fetched
- **High_Cardinality_Field**: A text field with potentially millions of unique values requiring partial matching support (e.g., participant name, email, venue address)
- **Low_Cardinality_Field**: An enumerated field with a limited set of predefined values requiring exact matching only (e.g., activity status, venue type, area type)
- **Partial_Matching**: A filtering technique that matches records containing the search text anywhere within the field value using case-insensitive comparison
- **Attribute_Selection**: A query optimization technique where clients specify which entity attributes to return in the response, reducing payload size and database query overhead
- **Dot_Notation**: A syntax for requesting nested relation fields in the fields parameter (e.g., activityType.name, activityType.activityCategory.name)
- **Population_Badge**: A visual indicator displayed beside a participant's name showing which populations they belong to, enabling quick identification of participant demographics
- **Additional_Participant_Count**: An optional positive integer field on activities that represents approximate attendance beyond individually tracked participants, used for high-level participation tracking in large gatherings

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
6. WHEN creating a participant, THE API SHALL require name
7. WHEN creating a participant, THE API SHALL accept optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields
8. WHEN creating a participant with an email, THE API SHALL validate email format and uniqueness
9. WHEN updating a participant with an email, THE API SHALL validate email format and uniqueness
10. WHEN creating a participant, THE API SHALL accept an optional home venue ID
11. WHEN creating a participant with dateOfBirth, THE API SHALL validate that it is a valid date in the past
12. WHEN creating a participant with dateOfRegistration, THE API SHALL validate that it is a valid date
13. WHEN updating a participant's home venue, THE API SHALL create a new address history record with the venue and effective start date
14. THE API SHALL provide a GET /api/participants/:id/address-history endpoint that returns the participant's home address history ordered by effective start date descending
15. THE API SHALL provide a POST /api/participants/:id/address-history endpoint that creates a new address history record
16. THE API SHALL provide a PUT /api/participants/:id/address-history/:historyId endpoint that updates an existing address history record
17. THE API SHALL provide a DELETE /api/participants/:id/address-history/:historyId endpoint that deletes an address history record
18. WHEN creating an address history record, THE API SHALL require venue ID
19. WHEN creating an address history record, THE API SHALL accept an optional effective start date (effectiveFrom)
20. WHEN creating an address history record with a null effectiveFrom date, THE API SHALL treat it as the oldest home address for that participant
21. THE API SHALL enforce that at most one address history record can have a null effectiveFrom date for any given participant
22. WHEN creating an address history record, THE API SHALL prevent duplicate records with the same effectiveFrom date (including null) for the same participant
23. THE API SHALL provide a GET /api/participants/:id/activities endpoint that returns all activity assignments for the participant with activity and role details
24. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only participants whose current home venue is in the specified geographic area or its descendants

### Requirement 4: Create and Manage Activities

**User Story:** As a community organizer, I want to create and manage activities via API with flexible filtering capabilities, so that I can track what's happening in my community and find specific activities based on multiple criteria.

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
20. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only activities whose current venue is in the specified geographic area or its descendants

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
6. WHEN creating a venue, THE API SHALL require name, address, and geographic area ID
7. WHEN creating a venue, THE API SHALL validate that the geographic area exists
8. WHEN creating a venue, THE API SHALL accept optional fields for latitude, longitude, and venue type (PUBLIC_BUILDING or PRIVATE_RESIDENCE)
9. WHEN deleting a venue, THE API SHALL prevent deletion if activities or participants reference it
10. WHEN deleting a venue, THE API SHALL return an error message explaining which entities reference it
11. THE API SHALL provide a GET /api/venues/:id/activities endpoint that returns all activities associated with a venue
12. THE API SHALL provide a GET /api/venues/:id/participants endpoint that returns all participants with this venue as their current home address
13. WHEN retrieving venue participants, THE API SHALL only include participants whose most recent address history record is at this venue
14. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only venues in the specified geographic area or its descendants

### Requirement 5C: Track Additional Participant Count

**User Story:** As a community organizer, I want to track high-level participation in activities without individually tracking specific individuals, so that I can record approximate attendance for large gatherings while maintaining detailed tracking for core participants.

#### Acceptance Criteria

1. THE API SHALL add an optional additionalParticipantCount field to the Activity model
2. THE additionalParticipantCount field SHALL be nullable and default to null
3. WHEN additionalParticipantCount is provided, THE API SHALL validate that it is a positive integer (greater than 0)
4. WHEN additionalParticipantCount is null or 0, THE API SHALL treat it as having no additional participants
5. THE API SHALL accept additionalParticipantCount in POST /api/v1/activities endpoint (create)
6. THE API SHALL accept additionalParticipantCount in PUT /api/v1/activities/:id endpoint (update)
7. THE API SHALL return additionalParticipantCount in GET /api/v1/activities/:id endpoint responses
8. THE API SHALL return additionalParticipantCount in GET /api/v1/activities endpoint responses (list)
9. WHEN calculating total participant count for an activity, THE API SHALL add additionalParticipantCount to the count of individually assigned participants
10. WHEN calculating total participation for analytics, THE API SHALL include additionalParticipantCount in the participation totals
11. WHEN calculating role distribution for analytics, THE API SHALL attribute all additional participants to the "Participant" role
12. WHEN an activity has 5 individually assigned participants and additionalParticipantCount of 20, THE API SHALL report total participant count as 25
13. WHEN calculating engagement metrics, THE API SHALL include additionalParticipantCount in participation counts but NOT in unique participant counts
14. WHEN calculating growth metrics, THE API SHALL include additionalParticipantCount in participation counts but NOT in unique participant counts
15. WHEN calculating activity lifecycle metrics, THE API SHALL include activities with additionalParticipantCount in activity counts
16. WHEN exporting activities to CSV, THE API SHALL include the additionalParticipantCount field
17. WHEN importing activities from CSV, THE API SHALL accept and validate the additionalParticipantCount field
18. THE API SHALL allow clearing additionalParticipantCount by setting it to null in update requests
19. WHEN additionalParticipantCount is set to null, THE API SHALL store null in the database (not 0)
20. THE API SHALL validate that additionalParticipantCount is an integer when provided (reject decimal values)

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
24. THE API SHALL NOT provide a GET /api/geographic-areas/:id/ancestors endpoint (removed in favor of batch endpoint)
25. THE API SHALL provide a GET /api/geographic-areas/:id/venues endpoint that returns all venues in the geographic area and all descendant areas (recursive aggregation)
26. THE API SHALL provide a GET /api/geographic-areas/:id/statistics endpoint that returns activity and participant statistics for the geographic area and all descendants (recursive aggregation)
27. WHEN a geographic area filter is provided via geographicAreaId query parameter with depth parameter, THE API SHALL return the specified geographic area with children up to the specified depth, plus all ancestors (to maintain hierarchy context for tree view display)
28. THE API SHALL provide a POST /api/v1/geographic-areas/batch-ancestors endpoint that accepts an array of geographic area IDs and returns ancestor data for all specified areas
29. WHEN fetching batch ancestors, THE API SHALL accept a request body with an array of geographic area IDs (areaIds) with a minimum of 1 and maximum of 100 IDs
30. WHEN fetching batch ancestors, THE API SHALL return a map/object where each key is a geographic area ID and each value is its parent ID (or null for root areas), enabling clients to traverse the hierarchy by following parent IDs
31. WHEN fetching batch ancestors for an area that has no parent, THE API SHALL return null as the parent ID for that area
32. WHEN fetching batch ancestors for multiple areas, THE API SHALL use a single WITH RECURSIVE common table expression (CTE) query in PostgreSQL to fetch all ancestors in one database round trip
33. WHEN Prisma ORM cannot efficiently support WITH RECURSIVE CTEs, THE API SHALL use raw SQL queries for ancestor fetching to ensure optimal database performance
34. THE API SHALL optimize all ancestor fetching operations for both low API latency and low database latency
35. THE API SHALL validate that all provided area IDs in the batch ancestors request are valid UUIDs
36. WHEN an invalid UUID is provided in the batch ancestors request, THE API SHALL return 400 Bad Request with a validation error
37. THE API SHALL limit the batch ancestors request to a minimum of 1 and maximum of 100 area IDs per request
38. WHEN fewer than 1 or more than 100 area IDs are provided in a batch ancestors request, THE API SHALL return 400 Bad Request with an error message
39. THE API SHALL provide a POST /api/v1/geographic-areas/batch-details endpoint that accepts an array of geographic area IDs and returns full entity details for all specified areas
40. WHEN fetching batch details, THE API SHALL accept a request body with an array of geographic area IDs (areaIds) with a minimum of 1 and maximum of 100 IDs
41. WHEN fetching batch details, THE API SHALL return a map/object where each key is a geographic area ID and each value is a complete geographic area object with all fields (id, name, areaType, parentGeographicAreaId, childCount, createdAt, updatedAt)
42. WHEN fetching batch details for multiple areas, THE API SHALL optimize the query to fetch all requested areas in a single database operation using WHERE id IN (...) clause
43. THE API SHALL validate that all provided area IDs in the batch details request are valid UUIDs
44. WHEN an invalid UUID is provided in the batch details request, THE API SHALL return 400 Bad Request with a validation error
45. THE API SHALL limit the batch details request to a minimum of 1 and maximum of 100 area IDs per request
46. WHEN fewer than 1 or more than 100 area IDs are provided in a batch details request, THE API SHALL return 400 Bad Request with an error message
47. WHEN fetching batch details for a non-existent area ID, THE API SHALL omit that ID from the response map (not return null or error for individual missing IDs)
48. THE API SHALL apply geographic authorization filtering to the batch details endpoint
49. WHEN a user requests batch details for areas they are not authorized to access, THE API SHALL omit unauthorized areas from the response map
50. THE batch details endpoint SHALL complement the batch ancestors endpoint by allowing the frontend to first fetch ancestor IDs via batch-ancestors, then fetch full details for those ancestors via batch-details in a single round trip
51. THE API SHALL use WITH RECURSIVE common table expressions (CTEs) in PostgreSQL for all descendant fetching operations to minimize database round trips
52. WHEN Prisma ORM cannot efficiently support WITH RECURSIVE CTEs for descendant queries, THE API SHALL use raw SQL queries for descendant fetching to ensure optimal database performance
53. THE API SHALL optimize all descendant fetching operations for both low API latency and low database latency
54. THE API SHALL accept an optional geographicAreaId query parameter on GET /api/v1/geographic-areas/:id/children endpoint
55. WHEN geographicAreaId parameter is provided to the children endpoint and differs from the parent ID being expanded, THE API SHALL filter children to only include those that are in the direct ancestral lineage of the filtered area
56. WHEN geographicAreaId parameter is provided to the children endpoint, THE API SHALL fetch ancestors of the filtered area
57. WHEN geographicAreaId parameter is provided to the children endpoint, THE API SHALL return only children that exist in the ancestor set of the filtered area
58. WHEN geographicAreaId parameter is not provided to the children endpoint, THE API SHALL return all children of the parent area (subject to authorization filtering)
59. WHEN geographicAreaId parameter equals the parent ID being expanded, THE API SHALL return all children of that parent (no ancestral lineage filtering needed)
60. THE children endpoint filtering SHALL enable filtered tree views to show only the relevant branch of the hierarchy when a global filter is active
61. WHEN a user has a global filter set to a leaf node and expands a top-level area, THE API SHALL return only the child that is the direct ancestor of the filtered leaf node
62. WHEN a user has a global filter set to an area and expands the parent of that area, THE API SHALL return the filtered area itself (since it is a direct child of the parent being expanded)
63. THE children endpoint SHALL include both ancestors of the filtered area AND the filtered area itself in the result set when the parent being expanded is an ancestor of the filter
64. WHEN a user has a global filter set to a high-level area and expands a descendant of that area, THE API SHALL return ALL children of the descendant (since all children are within the filtered scope)
65. THE children endpoint SHALL determine the relationship between the filter and the parent being expanded to decide whether to apply ancestral lineage filtering or return all children

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

### Requirement 11B: User Self-Profile Management

**User Story:** As any logged-in user, I want to view and edit my own profile information, so that I can update my display name and password without requiring administrator assistance.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/users/me/profile endpoint that returns the current user's profile information
2. THE API SHALL provide a PUT /api/v1/users/me/profile endpoint that allows the current user to update their own profile
3. THE API SHALL allow any authenticated user (ADMINISTRATOR, EDITOR, or READ_ONLY) to access their own profile endpoints
4. WHEN a user accesses GET /api/v1/users/me/profile, THE API SHALL return the user's id, displayName, email, role, createdAt, and updatedAt fields
5. THE API SHALL NOT return the password hash in the profile response
6. WHEN updating their own profile, THE API SHALL allow users to change their display name
7. WHEN updating their own profile, THE API SHALL NOT allow users to change their email address
8. WHEN updating their own profile, THE API SHALL NOT allow users to change their role
9. WHEN updating their own profile, THE API SHALL NOT allow users to modify their geographic authorization rules
10. WHEN a user attempts to update their password via PUT /api/v1/users/me/profile, THE API SHALL require the currentPassword field in the request body
11. WHEN a user provides a new password, THE API SHALL validate that the currentPassword matches the user's existing password
12. WHEN the currentPassword does not match the existing password, THE API SHALL return 401 Unauthorized with error code INVALID_CURRENT_PASSWORD
13. WHEN the currentPassword matches and a new password is provided, THE API SHALL validate that the new password is at least 8 characters
14. WHEN the new password is valid, THE API SHALL hash the new password using bcrypt and update the user's password
15. WHEN updating profile without providing a new password, THE API SHALL preserve the existing password
16. THE API SHALL validate that display name is between 1 and 200 characters if provided
17. THE API SHALL allow display name to be set to null to clear it
18. THE API SHALL audit profile updates in the audit log with action type PROFILE_UPDATE
19. THE API SHALL return 200 OK with the updated user profile on successful update
20. THE API SHALL return 400 Bad Request for validation errors (invalid display name length, password too short)
21. THE API SHALL return 401 Unauthorized when currentPassword is incorrect during password change attempts

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
7. WHEN exporting activities, THE API SHALL include columns for: id, name, activityTypeId, activityTypeName, activityCategoryId, activityCategoryName, startDate, endDate, status, additionalParticipantCount, createdAt, updatedAt
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
18. WHEN importing activities, THE API SHALL accept CSV files with columns: name, activityTypeId, startDate, endDate, status, additionalParticipantCount
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

### Requirement 28: Flexible Server-Side Filtering with Customizable Attribute Selection

**User Story:** As a frontend developer, I want to filter entity lists by any high-cardinality text field with partial matching and customize which attributes are returned in the response, so that I can efficiently load dropdown options, support advanced filtering in FilterGroupingPanel, and optimize network bandwidth by requesting only the data I need.

#### Acceptance Criteria

**General Filtering Capabilities:**

1. THE API SHALL support server-side filtering on all high-cardinality text fields for GET /api/v1/participants endpoint
2. THE API SHALL support server-side filtering on all high-cardinality text fields for GET /api/v1/venues endpoint
3. THE API SHALL support server-side filtering on all high-cardinality text fields for GET /api/v1/activities endpoint
4. THE API SHALL support server-side filtering on all high-cardinality text fields for GET /api/v1/geographic-areas endpoint
5. THE API SHALL classify the following as high-cardinality text fields requiring partial matching support: participant name, participant email, participant phone, participant nickname, venue name, venue address, activity name, geographic area name
6. THE API SHALL classify the following as low-cardinality enumerated fields NOT requiring partial matching: activity category, activity type, participant role, population, area type, venue type, activity status, user role, authorization rule type
7. WHEN filtering by high-cardinality text fields, THE API SHALL perform case-insensitive partial matching (ILIKE '%text%' or equivalent)
8. WHEN filtering by low-cardinality enumerated fields, THE API SHALL perform exact matching using IN clauses for array parameters
9. THE API SHALL accept filter query parameters in the format ?filter[fieldName]=value for all filterable fields
10. THE API SHALL support multiple filter parameters simultaneously (e.g., ?filter[name]=john&filter[email]=gmail)
11. WHEN multiple filter parameters are provided, THE API SHALL apply all filters using AND logic
12. THE API SHALL continue to support existing specialized filter parameters (geographicAreaId, activityTypeIds, status, etc.) for backward compatibility
13. WHEN both legacy filter parameters and new filter[fieldName] parameters are provided, THE API SHALL apply all filters using AND logic

**Customizable Attribute Selection:**

14. THE API SHALL accept an optional fields query parameter specifying which attributes to return in the response
15. THE fields parameter SHALL accept a comma-separated list of field names (e.g., ?fields=id,name,email)
16. WHEN the fields parameter is provided, THE API SHALL return only the specified attributes for each entity in the response
17. WHEN the fields parameter is omitted, THE API SHALL return all attributes for each entity (default behavior, backward compatible)
18. THE API SHALL validate that all requested field names in the fields parameter are valid attributes of the entity type
19. WHEN an invalid field name is provided in the fields parameter, THE API SHALL return 400 Bad Request with a validation error listing the invalid field names
20. THE API SHALL support requesting nested relation fields using dot notation (e.g., ?fields=id,name,activityType.name,activityType.activityCategory.name)
21. WHEN nested relation fields are requested, THE API SHALL include the necessary database joins to fetch the related data
22. THE API SHALL optimize database queries to SELECT only the requested fields, reducing data transfer and query execution time
23. THE API SHALL support the fields parameter on GET /api/v1/participants endpoint
24. THE API SHALL support the fields parameter on GET /api/v1/venues endpoint
25. THE API SHALL support the fields parameter on GET /api/v1/activities endpoint
26. THE API SHALL support the fields parameter on GET /api/v1/geographic-areas endpoint

**Participant Filtering:**

27. THE API SHALL accept ?filter[name]=text parameter on GET /api/v1/participants to filter by participant name (case-insensitive partial match)
28. THE API SHALL accept ?filter[email]=text parameter on GET /api/v1/participants to filter by participant email (case-insensitive partial match)
29. THE API SHALL accept ?filter[phone]=text parameter on GET /api/v1/participants to filter by participant phone (case-insensitive partial match)
30. THE API SHALL accept ?filter[nickname]=text parameter on GET /api/v1/participants to filter by participant nickname (case-insensitive partial match)
31. THE API SHALL accept ?filter[dateOfBirth]=date parameter on GET /api/v1/participants to filter by exact date of birth
32. THE API SHALL accept ?filter[dateOfRegistration]=date parameter on GET /api/v1/participants to filter by exact date of registration
33. THE API SHALL accept ?filter[populationIds]=uuid1,uuid2 parameter on GET /api/v1/participants to filter by one or more populations (OR logic within dimension)
34. WHEN multiple participant filter parameters are provided, THE API SHALL apply all filters using AND logic

**Venue Filtering:**

35. THE API SHALL accept ?filter[name]=text parameter on GET /api/v1/venues to filter by venue name (case-insensitive partial match)
36. THE API SHALL accept ?filter[address]=text parameter on GET /api/v1/venues to filter by venue address (case-insensitive partial match)
37. THE API SHALL accept ?filter[venueType]=type parameter on GET /api/v1/venues to filter by venue type (exact match, PUBLIC_BUILDING or PRIVATE_RESIDENCE)
38. WHEN multiple venue filter parameters are provided, THE API SHALL apply all filters using AND logic

**Activity Filtering:**

39. THE API SHALL accept ?filter[name]=text parameter on GET /api/v1/activities to filter by activity name (case-insensitive partial match)
40. THE API SHALL accept ?filter[activityTypeIds]=uuid1,uuid2 parameter on GET /api/v1/activities to filter by one or more activity types (OR logic within dimension)
41. THE API SHALL accept ?filter[activityCategoryIds]=uuid1,uuid2 parameter on GET /api/v1/activities to filter by one or more activity categories (OR logic within dimension)
42. THE API SHALL accept ?filter[status]=status1,status2 parameter on GET /api/v1/activities to filter by one or more statuses (OR logic within dimension)
43. THE API SHALL accept ?filter[populationIds]=uuid1,uuid2 parameter on GET /api/v1/activities to filter by one or more populations (OR logic within dimension)
44. THE API SHALL accept ?filter[startDate]=date parameter on GET /api/v1/activities to filter by activities starting on or after the specified date
45. THE API SHALL accept ?filter[endDate]=date parameter on GET /api/v1/activities to filter by activities ending on or before the specified date
46. WHEN multiple activity filter parameters are provided, THE API SHALL apply all filters using AND logic

**Geographic Area Filtering:**

47. THE API SHALL accept ?filter[name]=text parameter on GET /api/v1/geographic-areas to filter by geographic area name (case-insensitive partial match)
48. THE API SHALL accept ?filter[areaType]=type parameter on GET /api/v1/geographic-areas to filter by area type (exact match)
49. THE API SHALL accept ?filter[parentGeographicAreaId]=uuid parameter on GET /api/v1/geographic-areas to filter by parent geographic area (exact match)
50. WHEN multiple geographic area filter parameters are provided, THE API SHALL apply all filters using AND logic
51. THE API SHALL support filtering geographic areas by name in the global geographic area filter dropdown using ?filter[name]=text parameter
52. WHEN a user types in the global geographic area filter dropdown, THE Web_App SHALL send the search text as ?filter[name]=<text> to GET /api/v1/geographic-areas
53. THE API SHALL return geographic areas matching the search text with case-insensitive partial matching on the name field
54. THE API SHALL combine name filtering with other filters (geographicAreaId for scope, depth for lazy loading) using AND logic
55. THE API SHALL optimize geographic area name searches using database indexes on the name field

**Performance and Optimization:**

51. THE API SHALL use database indexes on all high-cardinality text fields to optimize partial matching queries
52. THE API SHALL push all filtering logic down to the database layer using Prisma WHERE clauses
53. THE API SHALL push all field selection logic down to the database layer using Prisma SELECT and INCLUDE clauses
54. THE API SHALL optimize queries to avoid N+1 problems when fetching nested relations
55. THE API SHALL maintain existing pagination behavior (page, limit, total, totalPages) when filters and fields parameters are used
56. THE API SHALL apply geographic authorization filtering before applying custom filters
57. THE API SHALL calculate total count based on all applied filters (geographic authorization + geographicAreaId + filter[] parameters)
58. WHEN no filters are specified, THE API SHALL return all entities subject to geographic authorization and pagination
59. WHEN no fields parameter is specified, THE API SHALL return all entity attributes
60. THE API SHALL create a GIN trigram index on geographic_areas.name field for efficient partial matching
61. THE API SHALL use the pg_trgm PostgreSQL extension for optimized text search on geographic area names

**Example Use Cases:**

60. WHEN a client requests GET /api/v1/participants?filter[email]=@gmail.com&fields=id,email, THE API SHALL return only participants with "@gmail.com" in their email, returning only id and email fields
61. WHEN a client requests GET /api/v1/venues?filter[name]=community&filter[venueType]=PUBLIC_BUILDING&fields=id,name, THE API SHALL return only public building venues with "community" in their name, returning only id and name fields
62. WHEN a client requests GET /api/v1/activities?filter[name]=study&filter[status]=ACTIVE,PLANNED&fields=id,name,activityType.name, THE API SHALL return only active or planned activities with "study" in their name, returning id, name, and the nested activity type name
63. WHEN a client requests GET /api/v1/geographic-areas?filter[areaType]=CITY&fields=id,name,areaType,childCount, THE API SHALL return only city-type geographic areas, returning id, name, areaType, and childCount fields
64. WHEN a client requests GET /api/v1/participants?geographicAreaId=<uuid>&filter[name]=john&fields=id,name, THE API SHALL combine geographic area filtering with name filtering and return only specified fields
65. WHEN a client requests GET /api/v1/geographic-areas?filter[name]=downtown&fields=id,name,areaType, THE API SHALL return only geographic areas with "downtown" in their name (case-insensitive), returning only id, name, and areaType fields
66. WHEN a client requests GET /api/v1/geographic-areas?geographicAreaId=<city-uuid>&filter[name]=park&depth=1&fields=id,name, THE API SHALL return geographic areas within the specified city that have "park" in their name, limited to immediate children, returning only id and name fields
67. WHEN the global geographic area filter dropdown sends GET /api/v1/geographic-areas?filter[name]=van&fields=id,name,areaType, THE API SHALL return all geographic areas with "van" in their name with minimal fields for efficient dropdown rendering

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
33. WHEN startDate and endDate filters are provided for activity markers, THE API SHALL return only activities that were active at any point during the query period (activity overlaps with query period)
34. WHEN an activity started after the endDate filter, THE API SHALL exclude it from activity marker results
35. WHEN an activity ended before the startDate filter, THE API SHALL exclude it from activity marker results
36. WHEN an activity is ongoing (null endDate) and started before or during the query period, THE API SHALL include it in activity marker results
37. WHEN calculating activity temporal overlap, THE API SHALL use the logic: (activity.startDate <= queryEndDate) AND (activity.endDate >= queryStartDate OR activity.endDate IS NULL)
38. THE API SHALL accept optional startDate and endDate query parameters on GET /api/v1/map/participant-homes endpoint
39. WHEN startDate and endDate filters are provided for participant home markers, THE API SHALL return all participant addresses that were active at any point during the query period
40. WHEN determining which addresses were active during a query period, THE API SHALL check if the address effectiveFrom date falls within or before the query period and the next address (if any) started after or during the query period
41. WHEN a participant had multiple addresses during the query period, THE API SHALL include all venues where the participant lived during that period in the marker results
42. WHEN calculating participant address temporal overlap with null effectiveFrom, THE API SHALL treat null as the earliest possible date (older than any non-null date)
43. WHEN a participant's address history spans the entire query period with a single address, THE API SHALL include that venue in the marker results
44. WHEN a participant moved during the query period, THE API SHALL include both the old and new venue addresses in the marker results

### Requirement 29: Include Population Associations in Participant List Responses

**User Story:** As a frontend developer, I want participant list endpoints to include population associations in the response, so that I can display population badges beside participant names without making additional API round trips for each participant.

#### Acceptance Criteria

1. THE API SHALL include population associations in the response for GET /api/v1/participants endpoint
2. WHEN returning participants from GET /api/v1/participants, THE API SHALL include a populations array field for each participant containing the population objects (id, name) the participant belongs to
3. THE API SHALL include population associations in the response for GET /api/v1/venues/:id/participants endpoint
4. WHEN returning participants from GET /api/v1/venues/:id/participants, THE API SHALL include a populations array field for each participant containing the population objects (id, name) the participant belongs to
5. THE API SHALL include population associations in the response for GET /api/v1/activities/:id/participants endpoint
6. WHEN returning participants from GET /api/v1/activities/:id/participants (activity assignments), THE API SHALL include a populations array field for each participant object containing the population objects (id, name) the participant belongs to
7. THE API SHALL optimize population association queries using Prisma's include or select with nested relations to avoid N+1 query problems
8. WHEN a participant belongs to zero populations, THE API SHALL return an empty populations array for that participant
9. WHEN a participant belongs to one or more populations, THE API SHALL return all population associations in the populations array
10. THE populations array SHALL contain population objects with at minimum: id (UUID) and name (string) fields
11. THE API SHALL NOT require an additional query parameter to include populations (they should be included by default in participant list responses)
12. THE API SHALL maintain backward compatibility by adding the populations field to existing participant response schemas
13. THE API SHALL apply the same population inclusion logic to all participant list endpoints consistently
14. THE API SHALL use a single optimized database query with JOIN operations to fetch participants and their populations together
15. WHEN using the fields parameter for attribute selection, THE API SHALL support requesting populations via fields=populations or fields=populations.id,populations.name

### Requirement 30: Coordinate-Based Map Marker Filtering

**User Story:** As a frontend developer, I want map marker endpoints to support filtering by geographic coordinate bounding box, so that the map can load only markers visible in the current viewport, improving performance and enabling users to interrupt large loads by zooming in to a specific region.

#### Acceptance Criteria

1. THE API SHALL accept optional bounding box query parameters on GET /api/v1/map/activities endpoint: minLat, maxLat, minLon, maxLon
2. THE API SHALL accept optional bounding box query parameters on GET /api/v1/map/participant-homes endpoint: minLat, maxLat, minLon, maxLon
3. THE API SHALL accept optional bounding box query parameters on GET /api/v1/map/venues endpoint: minLat, maxLat, minLon, maxLon
4. WHEN bounding box parameters are provided, THE API SHALL validate that minLat <= maxLat and minLon <= maxLon
5. WHEN bounding box parameters are provided, THE API SHALL validate that latitude values are between -90 and 90
6. WHEN bounding box parameters are provided, THE API SHALL validate that longitude values are between -180 and 180
7. WHEN invalid bounding box parameters are provided, THE API SHALL return 400 Bad Request with a descriptive validation error
8. WHEN bounding box parameters are provided, THE API SHALL filter markers to include only those with coordinates within the bounding box
9. THE API SHALL use the following bounding box filter logic: latitude >= minLat AND latitude <= maxLat AND longitude >= minLon AND longitude <= maxLon
10. WHEN bounding box parameters are provided, THE API SHALL combine coordinate filtering with other filters (geographic area, activity type, population, date range) using AND logic
11. WHEN both bounding box and geographicAreaIds filters are provided, THE API SHALL return only markers that satisfy both conditions (within bounding box AND within specified geographic areas)
12. WHEN bounding box parameters are omitted, THE API SHALL return all markers matching other filters without coordinate restrictions
13. THE API SHALL optimize bounding box queries using database indexes on latitude and longitude fields
14. THE API SHALL handle edge cases where the bounding box crosses the international date line (longitude wrapping from 180 to -180)
15. WHEN the bounding box crosses the international date line (minLon > maxLon), THE API SHALL use the logic: latitude >= minLat AND latitude <= maxLat AND (longitude >= minLon OR longitude <= maxLon)
16. THE API SHALL apply bounding box filtering to all map marker endpoints (activities, participant homes, venues)
17. THE API SHALL include the total count of markers within the bounding box in the pagination metadata
18. WHEN the bounding box contains no markers matching the filters, THE API SHALL return an empty data array with total count of 0
19. THE API SHALL maintain batched pagination behavior (100 items per page) when bounding box filtering is active
20. THE API SHALL apply geographic authorization filtering before applying bounding box filtering
21. WHEN a user has geographic restrictions, THE API SHALL first filter to authorized areas, then apply bounding box filtering to the authorized subset
22. THE API SHALL document bounding box parameters in the OpenAPI specification for all map marker endpoints
23. THE API SHALL provide example requests showing bounding box usage in the API documentation
24. WHEN bounding box parameters are provided with partial values (e.g., only minLat and maxLat), THE API SHALL return 400 Bad Request indicating all four parameters are required
25. THE API SHALL treat bounding box parameters as an all-or-nothing set (either all four provided or none)


## Performance Optimization Cross-References

The Backend API package has three performance optimization specifications that detail database-level query optimizations using raw SQL, CTEs, and advanced PostgreSQL features:

### Analytics Service Optimization

**Location**: `.kiro/specs/analytics-optimization/`

**Scope**: Optimizes the AnalyticsService engagement metrics and role distribution queries using:
- Common Table Expressions (CTEs) for complex multi-step queries
- SQL window functions for efficient aggregation
- GROUPING SETS for multi-dimensional analytics with total aggregation
- Optimized wire format with indexed lookups to minimize payload size
- Database-level zero-row filtering using HAVING clauses
- Pagination support with stable ordering

**Key Features**:
- Single-query execution for all engagement metrics (vs. multiple queries)
- 60-75% reduction in query execution time
- 80-90% reduction in memory usage
- 50-75% reduction in payload size with pagination
- Separate optimized endpoint for role distribution analytics

**See**: `.kiro/specs/analytics-optimization/requirements.md` for detailed requirements

### Geographic Breakdown Query Optimization

**Location**: `.kiro/specs/geographic-breakdown-optimization/`

**Scope**: Optimizes the `getGeographicBreakdown()` method using:
- Batch descendant fetching to eliminate N+1 query patterns
- CTE-based aggregation for all geographic areas in a single query
- Push-down predicates for early filtering
- HAVING clauses for zero-metric filtering
- Pagination with page number clamping

**Key Features**:
- Maximum 2-3 database queries (vs. N+1 pattern)
- 60-75% faster query execution
- 80-90% reduction in memory usage
- Automatic page clamping to prevent invalid page requests
- Filters out all areas with zero metrics for cleaner results

**See**: `.kiro/specs/geographic-breakdown-optimization/requirements.md` for detailed requirements

### Map Data API Performance Optimization

**Location**: `.kiro/specs/map-data-optimization/`

**Scope**: Optimizes map marker endpoints using:
- Raw SQL queries with conditional joins based on active filters
- Query variants (base, geographic, population, full) to minimize unnecessary joins
- DISTINCT ON for efficient current venue identification
- Database-level pagination with stable sorting (ORDER BY activity.id)
- Window functions for total count calculation in the same query

**Key Features**:
- Single database round trip (vs. multiple queries)
- 50-80% reduction in query execution time
- Eliminates in-memory pagination
- Stable, deterministic pagination with no duplicates or gaps
- Conditional joins reduce query complexity by 30-40% when filters not present

**See**: `.kiro/specs/map-data-optimization/requirements.md` for detailed requirements

### Implementation Status

All three optimization specifications have been **fully implemented and tested**:
- ✅ All backend tests passing (503/503)
- ✅ All frontend tests passing (273/273)
- ✅ Performance targets met or exceeded
- ✅ Backward compatibility maintained
- ✅ Production-ready

These optimizations are transparent to API consumers and require no changes to existing client code.
