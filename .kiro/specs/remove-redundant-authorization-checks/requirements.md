# Requirements Document: Remove Redundant Authorization Checks

## Introduction

The GlobalGeographicFilterContext currently fetches and validates user authorization for geographic areas before allowing filter selection. This is redundant because the backend API already enforces geographic authorization on all endpoints. This spec removes the unnecessary frontend authorization checks while preserving the legitimate use case in the GeographicAuthorizationManager component.

## Glossary

- **GlobalGeographicFilterContext**: React context that manages the global geographic area filter state across the application
- **GeographicAuthorizationService**: Service class that provides methods for managing user geographic authorization rules
- **getAuthorizedAreas**: API method that returns the effective list of geographic areas a user can access based on their authorization rules
- **Backend_Authorization**: Authorization enforcement performed by the backend API that filters data based on user permissions
- **Frontend_Authorization**: Authorization checks performed in the frontend before making API requests
- **GeographicAuthorizationManager**: Admin-only component for managing user authorization rules and viewing effective access

## Requirements

### Requirement 1: Remove Redundant Authorization Checks from Global Filter

**User Story:** As a developer, I want to remove redundant authorization checks from the GlobalGeographicFilterContext, so that the frontend relies on backend authorization enforcement and reduces unnecessary API calls.

#### Acceptance Criteria

1. THE GlobalGeographicFilterContext SHALL NOT call geographicAuthorizationService.getAuthorizedAreas()
2. THE GlobalGeographicFilterContext SHALL NOT maintain an authorizedAreaIds state
3. THE GlobalGeographicFilterContext SHALL NOT validate whether a geographic area is authorized before setting the filter
4. THE GlobalGeographicFilterContext SHALL remove the isAuthorizedArea() method from its context interface
5. THE GlobalGeographicFilterContext SHALL remove the authorizedAreaIds property from its context interface
6. THE GlobalGeographicFilterContext SHALL allow users to select any geographic area returned by the backend API
7. WHEN a user attempts to set a filter to an unauthorized geographic area, THE backend API SHALL return an authorization error
8. WHEN the backend returns an authorization error, THE GlobalGeographicFilterContext SHALL clear the filter and revert to "Global" view
9. THE GlobalGeographicFilterContext SHALL continue to subscribe to geographic authorization error events from geographicFilterEvents
10. WHEN a geographic authorization error event is received, THE GlobalGeographicFilterContext SHALL clear the current filter
11. THE GlobalGeographicFilterContext SHALL simplify its logic by trusting that the backend only returns authorized geographic areas
12. THE GlobalGeographicFilterContext SHALL remove the hasAuthorizationRules state variable
13. THE GlobalGeographicFilterContext SHALL remove the useEffect that fetches authorized areas on user change
14. THE GlobalGeographicFilterContext SHALL remove authorization validation from the URL sync useEffect
15. THE GlobalGeographicFilterContext SHALL remove authorization validation from the setGeographicAreaFilter method
16. THE GlobalGeographicFilterContext SHALL remove authorization validation from localStorage restoration logic

### Requirement 2: Preserve Authorization Checks in Admin Components

**User Story:** As an administrator, I want to continue seeing effective access summaries when managing user permissions, so that I can understand the impact of authorization rules.

#### Acceptance Criteria

1. THE GeographicAuthorizationManager component SHALL continue to call geographicAuthorizationService.getAuthorizedAreas()
2. THE GeographicAuthorizationManager component SHALL display the effective access summary showing full access, read-only access, and denied areas
3. THE GeographicAuthorizationManager component SHALL use the getAuthorizedAreas() method to populate the effective access summary
4. THE GeographicAuthorizationService class SHALL retain the getAuthorizedAreas() method for use by admin components
5. THE getAuthorizedAreas() method SHALL remain available for legitimate administrative use cases

### Requirement 3: Simplify Context Interface

**User Story:** As a developer, I want a simplified GlobalGeographicFilterContext interface, so that the code is easier to understand and maintain.

#### Acceptance Criteria

1. THE GlobalGeographicFilterContextType interface SHALL NOT include authorizedAreaIds property
2. THE GlobalGeographicFilterContextType interface SHALL NOT include isAuthorizedArea method
3. THE GlobalGeographicFilterContext provider value SHALL NOT include authorizedAreaIds
4. THE GlobalGeographicFilterContext provider value SHALL NOT include isAuthorizedArea
5. ANY components that currently use authorizedAreaIds from the context SHALL be updated to remove that dependency
6. ANY components that currently use isAuthorizedArea from the context SHALL be updated to remove that dependency
7. THE simplified context SHALL maintain all other existing functionality (filter selection, available areas, search, pagination)

### Requirement 4: Backend Authorization Enforcement

**User Story:** As a user, I want geographic authorization to be enforced consistently by the backend, so that I cannot access unauthorized data regardless of frontend state.

#### Acceptance Criteria

1. THE backend API SHALL continue to enforce geographic authorization on all endpoints that return geographic data
2. WHEN a user requests geographic areas via GET /api/v1/geographic-areas, THE backend SHALL return only areas the user is authorized to access
3. WHEN a user requests activities, participants, or venues filtered by geographic area, THE backend SHALL enforce authorization and return only authorized data
4. WHEN a user attempts to access an unauthorized geographic area, THE backend SHALL return a 403 Forbidden error
5. THE frontend SHALL handle 403 authorization errors gracefully by clearing the filter and displaying an error message
6. THE frontend SHALL trust that any geographic area returned by the backend is authorized for the current user
