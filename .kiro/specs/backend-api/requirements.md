# Requirements Document: Backend API Package

## Introduction

The Backend API package provides the RESTful API service that implements all business logic, data persistence, authentication, and authorization for the Community Activity Tracker system. It serves as the single source of truth for all data and coordinates operations across multiple client applications.

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
- **Geographic_Area**: A hierarchical geographic region (neighbourhood, community, city, county, province, state, country, etc.)

## Requirements

### Requirement 1: Manage Activity Types

**User Story:** As a community organizer, I want to define and manage activity types via API, so that I can categorize different kinds of community-building activities.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/v1/activity-types endpoint that returns all activity types
2. THE API SHALL provide a POST /api/v1/activity-types endpoint that creates a new activity type
3. THE API SHALL provide a PUT /api/v1/activity-types/:id endpoint that updates an activity type
4. THE API SHALL provide a DELETE /api/v1/activity-types/:id endpoint that deletes an activity type
5. WHEN creating an activity type, THE API SHALL validate that the name is provided and unique
6. WHEN deleting an activity type, THE API SHALL prevent deletion if activities reference it
7. THE API SHALL seed the following predefined activity types on initial database setup: "Children's Class", "Junior Youth Group", "Devotional Gathering", "Ruhi Book 1", "Ruhi Book 2", "Ruhi Book 3", "Ruhi Book 3A", "Ruhi Book 3B", "Ruhi Book 3C", "Ruhi Book 3D", "Ruhi Book 4", "Ruhi Book 5", "Ruhi Book 5A", "Ruhi Book 5B", "Ruhi Book 6", "Ruhi Book 7", "Ruhi Book 8", "Ruhi Book 9", "Ruhi Book 10", "Ruhi Book 11", "Ruhi Book 12", "Ruhi Book 13", "Ruhi Book 14"

### Requirement 2: Manage Participant Roles

**User Story:** As a community organizer, I want to define and manage participant roles via API, so that I can track the different functions people perform in activities.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/roles endpoint that returns all participant roles (note: endpoint is /roles not /participant-roles)
2. THE API SHALL provide a POST /api/roles endpoint that creates a new role
3. THE API SHALL provide a PUT /api/roles/:id endpoint that updates a role
4. THE API SHALL provide a DELETE /api/roles/:id endpoint that deletes a role
5. WHEN creating a role, THE API SHALL validate that the name is provided and unique
6. WHEN deleting a role, THE API SHALL prevent deletion if assignments reference it
7. THE API SHALL seed predefined roles (Facilitator, Animator, Host, Teacher) on initial database setup

### Requirement 3: Track Participants

**User Story:** As a community organizer, I want to register and track individuals via API, so that I can maintain a record of everyone involved in community activities.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/participants endpoint that returns all participants
2. THE API SHALL provide a GET /api/participants/:id endpoint that returns a specific participant
3. THE API SHALL provide a POST /api/participants endpoint that creates a new participant
4. THE API SHALL provide a PUT /api/participants/:id endpoint that updates a participant
5. THE API SHALL provide a DELETE /api/participants/:id endpoint that deletes a participant
6. THE API SHALL provide a GET /api/participants/search endpoint that searches by name or email
7. WHEN creating a participant, THE API SHALL require name and email
8. WHEN creating a participant, THE API SHALL validate email format and uniqueness
9. WHEN creating a participant, THE API SHALL accept optional phone and notes fields
10. WHEN creating a participant, THE API SHALL accept an optional home venue ID
11. WHEN updating a participant's home venue, THE API SHALL create a new address history record with the venue and effective start date
12. THE API SHALL provide a GET /api/participants/:id/address-history endpoint that returns the participant's home address history ordered by effective start date descending
13. THE API SHALL provide a POST /api/participants/:id/address-history endpoint that creates a new address history record
14. THE API SHALL provide a PUT /api/participants/:id/address-history/:historyId endpoint that updates an existing address history record
15. THE API SHALL provide a DELETE /api/participants/:id/address-history/:historyId endpoint that deletes an address history record
16. WHEN creating an address history record, THE API SHALL require venue ID and effective start date
17. WHEN creating an address history record, THE API SHALL prevent duplicate records with the same effective start date for the same participant
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
16. WHEN creating an activity-venue association, THE API SHALL prevent duplicate records with the same effective start date for the same activity
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
13. THE API SHALL provide a GET /api/venues/:id/participants endpoint that returns all participants with this venue as their home address
14. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return only venues in the specified geographic area or its descendants

### Requirement 5B: Manage Geographic Areas

**User Story:** As a community organizer, I want to create and manage geographic areas via API, so that I can organize venues hierarchically and report on statistics at different geographic levels.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/geographic-areas endpoint that returns all geographic areas
2. THE API SHALL provide a GET /api/geographic-areas/:id endpoint that returns a specific geographic area
3. THE API SHALL provide a POST /api/geographic-areas endpoint that creates a new geographic area
4. THE API SHALL provide a PUT /api/geographic-areas/:id endpoint that updates a geographic area
5. THE API SHALL provide a DELETE /api/geographic-areas/:id endpoint that deletes a geographic area
6. WHEN creating a geographic area, THE API SHALL require name and area type
7. WHEN creating a geographic area, THE API SHALL accept an optional parent geographic area ID
8. WHEN creating a geographic area, THE API SHALL validate that the parent geographic area exists if provided
9. WHEN creating a geographic area, THE API SHALL prevent circular parent-child relationships
10. THE API SHALL support area types: NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CUSTOM
11. WHEN deleting a geographic area, THE API SHALL prevent deletion if venues or child geographic areas reference it
12. THE API SHALL provide a GET /api/geographic-areas/:id/children endpoint that returns all child geographic areas
13. THE API SHALL provide a GET /api/geographic-areas/:id/ancestors endpoint that returns the full hierarchy path to the root
14. THE API SHALL provide a GET /api/geographic-areas/:id/venues endpoint that returns all venues in the geographic area and all descendant areas (recursive aggregation)
15. THE API SHALL provide a GET /api/geographic-areas/:id/statistics endpoint that returns activity and participant statistics for the geographic area and all descendants (recursive aggregation)
16. WHEN a geographic area filter is provided via geographicAreaId query parameter, THE API SHALL return the specified geographic area, all its descendants, and all its ancestors (to maintain hierarchy context for tree view display)

### Requirement 6: Analyze Community Engagement

**User Story:** As a community organizer, I want to analyze community engagement metrics via API, so that I can understand participation patterns and growth.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/analytics/engagement endpoint that returns engagement metrics
2. WHEN calculating engagement metrics, THE API SHALL count total unique participants
3. WHEN calculating engagement metrics, THE API SHALL count total activities by type
4. WHEN calculating engagement metrics, THE API SHALL count active and ongoing activities
5. WHEN calculating engagement metrics, THE API SHALL accept optional start and end date filters
6. WHEN date filters are provided, THE API SHALL include only activities overlapping the date range
7. THE API SHALL return participant counts per activity type
8. THE API SHALL return role distribution across all activities
9. WHEN calculating engagement metrics, THE API SHALL accept an optional geographic area ID filter
10. WHEN a geographic area filter is provided, THE API SHALL include only activities and participants associated with venues in that geographic area or its descendants
11. THE API SHALL provide a GET /api/analytics/geographic endpoint that returns engagement metrics grouped by geographic area

### Requirement 7: Track Growth Over Time

**User Story:** As a community organizer, I want to track how activities and participation grow over time via API, so that I can measure community development.

#### Acceptance Criteria

1. THE API SHALL provide a GET /api/analytics/growth endpoint that returns growth metrics
2. WHEN calculating growth metrics, THE API SHALL accept a time period parameter (DAY, WEEK, MONTH, YEAR)
3. WHEN calculating growth metrics, THE API SHALL accept optional start and end date filters
4. WHEN calculating growth metrics, THE API SHALL count new participants per time period
5. WHEN calculating growth metrics, THE API SHALL count new activities per time period
6. THE API SHALL return time-series data ordered chronologically
7. THE API SHALL calculate percentage change between consecutive periods
8. THE API SHALL calculate cumulative participant count over time
9. WHEN calculating growth metrics, THE API SHALL accept an optional geographic area ID filter
10. WHEN a geographic area filter is provided, THE API SHALL include only activities and participants associated with venues in that geographic area or its descendants

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

### Requirement 12: Audit User Actions

**User Story:** As a system administrator, I want audit logging via API, so that I can track user actions for security and compliance.

#### Acceptance Criteria

1. THE API SHALL log all authentication events (login, logout, token refresh)
2. THE API SHALL log all role changes
3. THE API SHALL log all entity modifications (create, update, delete)
4. WHEN logging actions, THE API SHALL record user ID, action type, entity type, entity ID, and timestamp
5. WHEN logging actions, THE API SHALL store additional details in JSON format
6. THE API SHALL provide audit logs to administrators only

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

### Requirement 17: Implement Pagination

**User Story:** As a client developer, I want paginated list endpoints, so that I can efficiently load large datasets without overwhelming the client or network.

#### Acceptance Criteria

1. THE API SHALL support pagination on GET /api/activities endpoint
2. THE API SHALL support pagination on GET /api/participants endpoint
3. THE API SHALL support pagination on GET /api/venues endpoint
4. THE API SHALL support pagination on GET /api/geographic-areas endpoint
5. WHEN pagination is requested, THE API SHALL accept page and limit query parameters
6. THE API SHALL default to page 1 and limit 50 if not specified
7. THE API SHALL enforce a maximum limit of 100 items per page
8. WHEN returning paginated results, THE API SHALL include pagination metadata with page, limit, total, and totalPages
9. THE API SHALL wrap paginated data in a consistent response format with data and pagination fields

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
