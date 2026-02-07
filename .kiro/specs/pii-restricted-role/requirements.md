# Requirements Document

## Introduction

This document specifies requirements for implementing a PII-restricted role in the Cultivate system. The PII_RESTRICTED role provides the most restrictive access level - a highly limited subset of READ_ONLY that completely blocks access to all participant, venue, activity, and map-related APIs and pages. This role enables users to view only aggregate analytics data and the geographic area hierarchy without any access to individual records or location-specific information.

## Glossary

- **System**: The Cultivate application (backend-api and web-frontend)
- **PII_RESTRICTED_Role**: A new system role that completely blocks access to participant, venue, activity, and map-related APIs and pages
- **Participant**: A person tracked in the system with personal information (completely inaccessible to PII_RESTRICTED users)
- **Venue**: A location where activities occur (completely inaccessible to PII_RESTRICTED users)
- **Activity**: A community event or gathering (completely inaccessible to PII_RESTRICTED users)
- **JWT_Token**: JSON Web Token used for authentication and authorization
- **Backend_API**: The server-side API that processes requests and returns data
- **Web_Frontend**: The client-side application that displays data to users
- **Geographic_Authorization**: Permission rules that restrict data access based on geographic areas
- **Aggregate_Analytics**: Summary metrics and statistics that do not expose individual records
- **Venue_Grouping**: A grouping dimension in analytics that reveals venue-specific data (blocked for PII_RESTRICTED users)

## Requirements

### Requirement 1: PII_RESTRICTED Role Definition

**User Story:** As a system administrator, I want to create a new PII_RESTRICTED role, so that I can grant users access to aggregate analytics and geographic area hierarchy without any access to individual participant, venue, or activity records.

#### Acceptance Criteria

1. THE System SHALL define a new role named "PII_RESTRICTED" in the role enumeration
2. THE System SHALL include PII_RESTRICTED as a selectable option when creating or editing user accounts
3. THE System SHALL store the PII_RESTRICTED role in user records alongside existing roles
4. THE System SHALL include the PII_RESTRICTED role in JWT_Tokens for authorization checks
5. WHERE a user has PII_RESTRICTED role, THE System SHALL apply significantly more restrictive permissions than READ_ONLY role
6. THE PII_RESTRICTED role SHALL have no read or write access to participant, venue, activity, or map-related APIs
7. THE PII_RESTRICTED role SHALL have read-only access to geographic area hierarchy
8. THE PII_RESTRICTED role SHALL have read-only access to aggregate analytics (engagement and growth metrics)

### Requirement 2: Participant API Access Denial

**User Story:** As a system administrator, I want PII_RESTRICTED users to have no access to participant APIs, so that they cannot view or modify any participant information.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/participants, THE Backend_API SHALL reject the request with 403 Forbidden
2. WHEN a PII_RESTRICTED user requests GET /api/v1/participants/:id, THE Backend_API SHALL reject the request with 403 Forbidden
3. WHEN a PII_RESTRICTED user requests POST /api/v1/participants, THE Backend_API SHALL reject the request with 403 Forbidden
4. WHEN a PII_RESTRICTED user requests PUT /api/v1/participants/:id, THE Backend_API SHALL reject the request with 403 Forbidden
5. WHEN a PII_RESTRICTED user requests DELETE /api/v1/participants/:id, THE Backend_API SHALL reject the request with 403 Forbidden
6. WHEN a PII_RESTRICTED user requests GET /api/v1/participants/:id/activities, THE Backend_API SHALL reject the request with 403 Forbidden
7. WHEN a PII_RESTRICTED user requests GET /api/v1/participants/:id/address-history, THE Backend_API SHALL reject the request with 403 Forbidden
8. WHEN a PII_RESTRICTED user requests GET /api/v1/participants/:id/populations, THE Backend_API SHALL reject the request with 403 Forbidden
9. WHEN a PII_RESTRICTED user requests POST /api/v1/participants/:id/populations, THE Backend_API SHALL reject the request with 403 Forbidden
10. WHEN a PII_RESTRICTED user requests DELETE /api/v1/participants/:id/populations/:populationId, THE Backend_API SHALL reject the request with 403 Forbidden
11. WHEN a PII_RESTRICTED user requests GET /api/v1/participants/export, THE Backend_API SHALL reject the request with 403 Forbidden
12. WHEN a PII_RESTRICTED user requests POST /api/v1/participants/import, THE Backend_API SHALL reject the request with 403 Forbidden

### Requirement 3: Venue API Access Denial

**User Story:** As a system administrator, I want PII_RESTRICTED users to have no access to venue APIs, so that they cannot view or modify any venue information.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/venues, THE Backend_API SHALL reject the request with 403 Forbidden
2. WHEN a PII_RESTRICTED user requests GET /api/v1/venues/:id, THE Backend_API SHALL reject the request with 403 Forbidden
3. WHEN a PII_RESTRICTED user requests POST /api/v1/venues, THE Backend_API SHALL reject the request with 403 Forbidden
4. WHEN a PII_RESTRICTED user requests PUT /api/v1/venues/:id, THE Backend_API SHALL reject the request with 403 Forbidden
5. WHEN a PII_RESTRICTED user requests DELETE /api/v1/venues/:id, THE Backend_API SHALL reject the request with 403 Forbidden
6. WHEN a PII_RESTRICTED user requests GET /api/v1/venues/:id/activities, THE Backend_API SHALL reject the request with 403 Forbidden
7. WHEN a PII_RESTRICTED user requests GET /api/v1/venues/:id/participants, THE Backend_API SHALL reject the request with 403 Forbidden
8. WHEN a PII_RESTRICTED user requests GET /api/v1/venues/export, THE Backend_API SHALL reject the request with 403 Forbidden
9. WHEN a PII_RESTRICTED user requests POST /api/v1/venues/import, THE Backend_API SHALL reject the request with 403 Forbidden

### Requirement 3A: Activity API Access Denial

**User Story:** As a system administrator, I want PII_RESTRICTED users to have no access to activity APIs, so that they cannot view or modify any activity information.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/activities, THE Backend_API SHALL reject the request with 403 Forbidden
2. WHEN a PII_RESTRICTED user requests GET /api/v1/activities/:id, THE Backend_API SHALL reject the request with 403 Forbidden
3. WHEN a PII_RESTRICTED user requests POST /api/v1/activities, THE Backend_API SHALL reject the request with 403 Forbidden
4. WHEN a PII_RESTRICTED user requests PUT /api/v1/activities/:id, THE Backend_API SHALL reject the request with 403 Forbidden
5. WHEN a PII_RESTRICTED user requests DELETE /api/v1/activities/:id, THE Backend_API SHALL reject the request with 403 Forbidden
6. WHEN a PII_RESTRICTED user requests GET /api/v1/activities/:id/participants, THE Backend_API SHALL reject the request with 403 Forbidden
7. WHEN a PII_RESTRICTED user requests POST /api/v1/activities/:id/participants, THE Backend_API SHALL reject the request with 403 Forbidden
8. WHEN a PII_RESTRICTED user requests PUT /api/v1/activities/:id/participants/:participantId, THE Backend_API SHALL reject the request with 403 Forbidden
9. WHEN a PII_RESTRICTED user requests DELETE /api/v1/activities/:id/participants/:participantId, THE Backend_API SHALL reject the request with 403 Forbidden
10. WHEN a PII_RESTRICTED user requests GET /api/v1/activities/:id/venues, THE Backend_API SHALL reject the request with 403 Forbidden
11. WHEN a PII_RESTRICTED user requests POST /api/v1/activities/:id/venues, THE Backend_API SHALL reject the request with 403 Forbidden
12. WHEN a PII_RESTRICTED user requests DELETE /api/v1/activities/:id/venues/:venueId, THE Backend_API SHALL reject the request with 403 Forbidden
13. WHEN a PII_RESTRICTED user requests GET /api/v1/activities/export, THE Backend_API SHALL reject the request with 403 Forbidden
14. WHEN a PII_RESTRICTED user requests POST /api/v1/activities/import, THE Backend_API SHALL reject the request with 403 Forbidden

### Requirement 3B: Map API Access Denial

**User Story:** As a system administrator, I want PII_RESTRICTED users to have no access to map-related APIs, so that they cannot view location-specific data or markers.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/map/activities, THE Backend_API SHALL reject the request with 403 Forbidden
2. WHEN a PII_RESTRICTED user requests GET /api/v1/map/activities/:id/popup, THE Backend_API SHALL reject the request with 403 Forbidden
3. WHEN a PII_RESTRICTED user requests GET /api/v1/map/participant-homes, THE Backend_API SHALL reject the request with 403 Forbidden
4. WHEN a PII_RESTRICTED user requests GET /api/v1/map/participant-homes/:venueId/popup, THE Backend_API SHALL reject the request with 403 Forbidden
5. WHEN a PII_RESTRICTED user requests GET /api/v1/map/venues, THE Backend_API SHALL reject the request with 403 Forbidden
6. WHEN a PII_RESTRICTED user requests GET /api/v1/map/venues/:id/popup, THE Backend_API SHALL reject the request with 403 Forbidden

### Requirement 4: Frontend Page Access Denial

**User Story:** As a user with PII_RESTRICTED role, I want the frontend to hide all participant, venue, activity, and map pages from navigation and block direct access, so that I only see the pages I'm authorized to access.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user views the navigation menu, THE Web_Frontend SHALL NOT display links to the Participants page
2. WHEN a PII_RESTRICTED user views the navigation menu, THE Web_Frontend SHALL NOT display links to the Venues page
3. WHEN a PII_RESTRICTED user views the navigation menu, THE Web_Frontend SHALL NOT display links to the Activities page
4. WHEN a PII_RESTRICTED user views the navigation menu, THE Web_Frontend SHALL NOT display links to the Map page
5. WHEN a PII_RESTRICTED user attempts to navigate directly to /participants, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
6. WHEN a PII_RESTRICTED user attempts to navigate directly to /participants/:id, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
7. WHEN a PII_RESTRICTED user attempts to navigate directly to /venues, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
8. WHEN a PII_RESTRICTED user attempts to navigate directly to /venues/:id, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
9. WHEN a PII_RESTRICTED user attempts to navigate directly to /activities, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
10. WHEN a PII_RESTRICTED user attempts to navigate directly to /activities/:id, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
11. WHEN a PII_RESTRICTED user attempts to navigate directly to /map, THE Web_Frontend SHALL redirect to an unauthorized page or dashboard
12. WHEN a PII_RESTRICTED user views the dashboard quick links, THE Web_Frontend SHALL NOT display quick links for Participants, Venues, Activities, or Map
13. WHEN a PII_RESTRICTED user views the dashboard quick links, THE Web_Frontend SHALL display quick links for Geographic Areas and Analytics only

### Requirement 5: Geographic Area Read-Only Access

**User Story:** As a user with PII_RESTRICTED role, I want to view the geographic area hierarchy and filter by geographic area, so that I can understand the geographic structure and scope my analytics queries.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/geographic-areas, THE Backend_API SHALL return all geographic areas the user is authorized to access
2. WHEN a PII_RESTRICTED user requests GET /api/v1/geographic-areas/:id, THE Backend_API SHALL return the geographic area details if the user is authorized
3. WHEN a PII_RESTRICTED user requests GET /api/v1/geographic-areas/:id/children, THE Backend_API SHALL return the child geographic areas if the user is authorized
4. WHEN a PII_RESTRICTED user requests POST /api/v1/geographic-areas/batch-ancestors, THE Backend_API SHALL return ancestor data for authorized areas
5. WHEN a PII_RESTRICTED user requests POST /api/v1/geographic-areas/batch-details, THE Backend_API SHALL return details for authorized areas
6. WHEN a PII_RESTRICTED user requests POST /api/v1/geographic-areas, THE Backend_API SHALL reject the request with 403 Forbidden (no write access)
7. WHEN a PII_RESTRICTED user requests PUT /api/v1/geographic-areas/:id, THE Backend_API SHALL reject the request with 403 Forbidden (no write access)
8. WHEN a PII_RESTRICTED user requests DELETE /api/v1/geographic-areas/:id, THE Backend_API SHALL reject the request with 403 Forbidden (no write access)
9. WHEN a PII_RESTRICTED user requests GET /api/v1/geographic-areas/:id/venues, THE Backend_API SHALL reject the request with 403 Forbidden (venues are blocked)
10. WHEN a PII_RESTRICTED user requests GET /api/v1/geographic-areas/:id/statistics, THE Backend_API SHALL reject the request with 403 Forbidden (statistics may expose venue/participant counts)
11. WHEN a PII_RESTRICTED user requests GET /api/v1/geographic-areas/export, THE Backend_API SHALL return geographic area data (export is allowed for read-only access)
12. THE Web_Frontend SHALL display the Geographic Areas page in navigation for PII_RESTRICTED users
13. THE Web_Frontend SHALL allow PII_RESTRICTED users to view the geographic area hierarchy tree
14. THE Web_Frontend SHALL allow PII_RESTRICTED users to use the global geographic area filter
15. THE Web_Frontend SHALL hide edit and delete buttons on geographic area pages for PII_RESTRICTED users

### Requirement 6: Analytics Access with Venue Grouping Restriction

**User Story:** As a user with PII_RESTRICTED role, I want to view engagement and growth analytics without venue grouping, so that I can analyze aggregate trends without accessing venue-specific data.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/analytics/engagement, THE Backend_API SHALL return aggregate engagement metrics
2. WHEN a PII_RESTRICTED user requests GET /api/v1/analytics/growth, THE Backend_API SHALL return aggregate growth metrics
3. WHEN a PII_RESTRICTED user requests GET /api/v1/analytics/activity-lifecycle, THE Backend_API SHALL return activity lifecycle metrics
4. WHEN a PII_RESTRICTED user requests GET /api/v1/analytics/geographic, THE Backend_API SHALL return geographic breakdown metrics
5. WHEN a PII_RESTRICTED user requests engagement metrics with groupBy parameter including 'venue', THE Backend_API SHALL reject the request with 400 Bad Request and error message "Venue grouping is not allowed for PII_RESTRICTED role"
6. WHEN a PII_RESTRICTED user requests engagement metrics with venueIds filter parameter, THE Backend_API SHALL reject the request with 400 Bad Request and error message "Venue filtering is not allowed for PII_RESTRICTED role"
7. WHEN a PII_RESTRICTED user requests growth metrics with venueIds filter parameter, THE Backend_API SHALL reject the request with 400 Bad Request and error message "Venue filtering is not allowed for PII_RESTRICTED role"
8. WHEN a PII_RESTRICTED user requests activity lifecycle metrics with venueIds filter parameter, THE Backend_API SHALL reject the request with 400 Bad Request and error message "Venue filtering is not allowed for PII_RESTRICTED role"
9. WHEN a PII_RESTRICTED user requests geographic breakdown metrics with venueIds filter parameter, THE Backend_API SHALL reject the request with 400 Bad Request and error message "Venue filtering is not allowed for PII_RESTRICTED role"
10. THE Web_Frontend SHALL display the Engagement Analytics page in navigation for PII_RESTRICTED users
11. THE Web_Frontend SHALL display the Growth Analytics page in navigation for PII_RESTRICTED users
12. WHEN a PII_RESTRICTED user views the Engagement Dashboard, THE Web_Frontend SHALL hide the venue grouping option from the FilterGroupingPanel
13. WHEN a PII_RESTRICTED user views the Engagement Dashboard, THE Web_Frontend SHALL hide the venue filter option from the FilterGroupingPanel
14. WHEN a PII_RESTRICTED user views the Growth Dashboard, THE Web_Frontend SHALL hide the venue filter option from the FilterGroupingPanel
15. THE Web_Frontend SHALL allow PII_RESTRICTED users to group by activity category, activity type, and geographic area
16. THE Web_Frontend SHALL allow PII_RESTRICTED users to filter by activity category, activity type, geographic area, and population
17. THE Web_Frontend SHALL display all analytics charts and tables for PII_RESTRICTED users (excluding venue-specific data)

### Requirement 7: Configuration Data Read-Only Access

**User Story:** As a user with PII_RESTRICTED role, I want to view configuration data (activity categories, activity types, roles, populations) without modification access, so that I can understand the system structure.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests GET /api/v1/activity-categories, THE Backend_API SHALL return all activity categories
2. WHEN a PII_RESTRICTED user requests GET /api/v1/activity-types, THE Backend_API SHALL return all activity types
3. WHEN a PII_RESTRICTED user requests GET /api/v1/roles, THE Backend_API SHALL return all roles
4. WHEN a PII_RESTRICTED user requests GET /api/v1/populations, THE Backend_API SHALL return all populations
5. WHEN a PII_RESTRICTED user requests POST /api/v1/activity-categories, THE Backend_API SHALL reject the request with 403 Forbidden
6. WHEN a PII_RESTRICTED user requests PUT /api/v1/activity-categories/:id, THE Backend_API SHALL reject the request with 403 Forbidden
7. WHEN a PII_RESTRICTED user requests DELETE /api/v1/activity-categories/:id, THE Backend_API SHALL reject the request with 403 Forbidden
8. WHEN a PII_RESTRICTED user requests POST /api/v1/activity-types, THE Backend_API SHALL reject the request with 403 Forbidden
9. WHEN a PII_RESTRICTED user requests PUT /api/v1/activity-types/:id, THE Backend_API SHALL reject the request with 403 Forbidden
10. WHEN a PII_RESTRICTED user requests DELETE /api/v1/activity-types/:id, THE Backend_API SHALL reject the request with 403 Forbidden
11. WHEN a PII_RESTRICTED user requests POST /api/v1/roles, THE Backend_API SHALL reject the request with 403 Forbidden
12. WHEN a PII_RESTRICTED user requests PUT /api/v1/roles/:id, THE Backend_API SHALL reject the request with 403 Forbidden
13. WHEN a PII_RESTRICTED user requests DELETE /api/v1/roles/:id, THE Backend_API SHALL reject the request with 403 Forbidden
14. WHEN a PII_RESTRICTED user requests POST /api/v1/populations, THE Backend_API SHALL reject the request with 403 Forbidden
15. WHEN a PII_RESTRICTED user requests PUT /api/v1/populations/:id, THE Backend_API SHALL reject the request with 403 Forbidden
16. WHEN a PII_RESTRICTED user requests DELETE /api/v1/populations/:id, THE Backend_API SHALL reject the request with 403 Forbidden
17. THE Web_Frontend SHALL display the Configuration page in navigation for PII_RESTRICTED users
18. THE Web_Frontend SHALL hide all edit and delete buttons on the Configuration page for PII_RESTRICTED users
19. THE Web_Frontend SHALL hide all create buttons on the Configuration page for PII_RESTRICTED users

### Requirement 8: Geographic Authorization

**User Story:** As a system administrator, I want PII_RESTRICTED users to be subject to geographic authorization rules, so that they only access analytics data within their authorized geographic areas.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests analytics data, THE Backend_API SHALL apply Geographic_Authorization rules
2. WHEN a PII_RESTRICTED user requests analytics data outside their authorized geographic areas, THE Backend_API SHALL reject the request with an authorization error
3. WHEN a PII_RESTRICTED user requests geographic area data outside their authorized areas, THE Backend_API SHALL reject the request with an authorization error
4. WHEN a PII_RESTRICTED user requests analytics data within their authorized geographic areas, THE Backend_API SHALL return the aggregate metrics without venue grouping or venue filtering

### Requirement 9: JWT Token Integration

**User Story:** As a backend developer, I want the PII_RESTRICTED role to be included in JWT tokens, so that authorization checks can be performed on every request.

#### Acceptance Criteria

1. WHEN the System generates a JWT_Token for a PII_RESTRICTED user, THE System SHALL include the PII_RESTRICTED role in the token payload
2. WHEN the Backend_API validates a JWT_Token, THE System SHALL extract the PII_RESTRICTED role for authorization decisions
3. WHEN the Backend_API processes a request with a PII_RESTRICTED token, THE System SHALL apply PII redaction logic before returning responses

### Requirement 10: User Management Interface

**User Story:** As a system administrator, I want to assign the PII_RESTRICTED role through the user management interface, so that I can control which users have restricted access.

#### Acceptance Criteria

1. WHEN an administrator creates a new user, THE Web_Frontend SHALL display PII_RESTRICTED as a role option
2. WHEN an administrator edits an existing user, THE Web_Frontend SHALL display PII_RESTRICTED as a role option
3. WHEN an administrator selects PII_RESTRICTED role, THE System SHALL save the role assignment to the user record
4. WHEN an administrator views a user with PII_RESTRICTED role, THE Web_Frontend SHALL display the role clearly in the user details
