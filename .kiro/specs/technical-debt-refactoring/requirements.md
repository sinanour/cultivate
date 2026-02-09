# Requirements Document: Technical Debt Refactoring

## Introduction

This specification addresses systematic technical debt across the codebase by eliminating anti-patterns, reducing code duplication, and establishing single sources of truth. The refactoring focuses on three primary areas: inline literals that should be constants, duplicated frontend UI patterns, and duplicated backend business logic. These improvements will enhance maintainability, reduce bugs from inconsistent implementations, and establish clear patterns for future development.

## Glossary

- **System**: The complete application including backend API and web frontend
- **Backend_API**: The Node.js/TypeScript Express API server
- **Web_Frontend**: The React/TypeScript CloudScape-based web application
- **Route_Handler**: Express route handler functions that process HTTP requests
- **Service_Layer**: Business logic layer containing service classes
- **Query_Parameter**: URL query string parameter used for filtering, pagination, or configuration
- **CloudScape**: AWS design system used for frontend UI components
- **Authorization_Context**: User's geographic area restrictions and authorized area IDs
- **Geographic_Filtering**: Logic that restricts data access based on user's authorized geographic areas
- **Pagination_Parameters**: Query parameters controlling page number and page size
- **Confirmation_Dialog**: UI component that prompts user to confirm destructive actions
- **DRY_Principle**: "Don't Repeat Yourself" - code should have single source of truth
- **Anti_Pattern**: Common coding practice that appears helpful but creates problems

## Requirements

### Requirement 1: Centralized Query Parameter Constants

**User Story:** As a developer, I want all query parameter names defined as constants, so that typos are caught at compile time and parameter names are consistent across the codebase.

#### Acceptance Criteria

1. THE Backend_API SHALL define all query parameter names as string constants in a centralized constants file
2. WHEN a Route_Handler accesses query parameters, THE Backend_API SHALL use the defined constants instead of inline strings
3. THE Backend_API SHALL define constants for pagination parameters (page, limit, pageSize)
4. THE Backend_API SHALL define constants for filtering parameters (geographicAreaId, groupBy, depth)
5. THE Backend_API SHALL define constants for sorting and search parameters
6. WHEN new query parameters are added, THE Backend_API SHALL add them to the centralized constants file
7. THE Backend_API SHALL eliminate all inline query parameter string literals from route handlers

### Requirement 2: Unified Pagination Parsing Utility

**User Story:** As a developer, I want pagination parameters parsed in one place, so that parsing logic is consistent and validation is centralized.

#### Acceptance Criteria

1. THE Backend_API SHALL provide a utility function that parses pagination parameters from request query strings
2. WHEN pagination parameters are present, THE utility function SHALL parse them as integers with proper validation
3. WHEN pagination parameters are invalid, THE utility function SHALL return appropriate error information
4. THE utility function SHALL handle both "limit" and "pageSize" parameter names consistently
5. THE utility function SHALL return undefined for missing pagination parameters
6. WHEN a Route_Handler needs pagination, THE Backend_API SHALL use the centralized utility function
7. THE Backend_API SHALL eliminate duplicated pagination parsing logic from all route handlers

### Requirement 3: Unified Authorization Context Extraction

**User Story:** As a developer, I want authorization context extracted in one place, so that authorization logic is consistent and secure across all endpoints.

#### Acceptance Criteria

1. THE Backend_API SHALL provide a utility function that extracts authorization context from authenticated requests
2. THE utility function SHALL extract authorizedAreaIds from the authenticated user
3. THE utility function SHALL extract hasGeographicRestrictions flag from the authenticated user
4. THE utility function SHALL provide default values when authorization properties are missing
5. WHEN a Route_Handler needs authorization context, THE Backend_API SHALL use the centralized utility function
6. THE Backend_API SHALL eliminate duplicated authorization context extraction from all route handlers

### Requirement 4: Shared Geographic Filtering Service

**User Story:** As a developer, I want geographic filtering logic in one place, so that authorization enforcement is consistent across all data access patterns.

#### Acceptance Criteria

1. THE Backend_API SHALL provide a shared service for geographic filtering logic
2. THE shared service SHALL implement the getEffectiveGeographicAreaIds method once
3. WHEN explicit geographic area filters are provided, THE shared service SHALL validate them against authorized areas
4. WHEN no explicit filters are provided and user has restrictions, THE shared service SHALL apply implicit filtering using authorized areas
5. WHEN no explicit filters are provided and user has no restrictions, THE shared service SHALL return undefined to indicate no filtering
6. THE shared service SHALL expand geographic area hierarchies to include all descendants
7. WHEN Service_Layer classes need geographic filtering, THE Backend_API SHALL use the shared service
8. THE Backend_API SHALL eliminate duplicated getEffectiveGeographicAreaIds implementations from activity.service.ts, participant.service.ts, venue.service.ts, geographic-area.service.ts, analytics.service.ts, and map-data.service.ts

### Requirement 5: Unified Confirmation Dialog Component

**User Story:** As a user, I want consistent confirmation dialogs throughout the application, so that the interface feels cohesive and follows the design system.

#### Acceptance Criteria

1. THE Web_Frontend SHALL provide a reusable ConfirmationDialog component using CloudScape Modal
2. THE ConfirmationDialog SHALL accept customizable title, message, and button labels as props
3. THE ConfirmationDialog SHALL provide confirm and cancel callbacks
4. THE ConfirmationDialog SHALL follow CloudScape design system styling and patterns
5. THE ConfirmationDialog SHALL support both destructive (delete) and non-destructive (update) confirmation types
6. WHEN a component needs user confirmation, THE Web_Frontend SHALL use the ConfirmationDialog component
7. THE Web_Frontend SHALL eliminate all window.confirm() calls from ActivityTypeList.tsx, ActivityDetail.tsx, ParticipantList.tsx, ActivityList.tsx, ParticipantRoleList.tsx, GeographicAuthorizationManager.tsx, VenueDetail.tsx, ActivityCategoryList.tsx, VenueList.tsx, GeographicAreaDetail.tsx, ParticipantDetail.tsx, GeographicAreaList.tsx, UserFormWithAuthorization.tsx, and PopulationList.tsx

### Requirement 6: Consistent Query Parameter Naming

**User Story:** As a developer, I want consistent parameter names across all endpoints, so that the API is predictable and easy to use.

#### Acceptance Criteria

1. THE Backend_API SHALL use "limit" consistently for pagination page size across all endpoints
2. THE Backend_API SHALL eliminate usage of "pageSize" in favor of "limit"
3. WHEN analytics endpoints are refactored, THE Backend_API SHALL update them to use "limit" instead of "pageSize"
4. THE Backend_API SHALL document the standardized parameter naming in API documentation

### Requirement 7: Standardized Constants Pattern

**User Story:** As a developer, I want consistent constant definition patterns across frontend and backend, so that code style is uniform and predictable.

#### Acceptance Criteria

1. THE System SHALL establish a standard pattern for defining constants (enum vs as const)
2. THE Backend_API SHALL use TypeScript enums for constants that represent closed sets of values
3. THE Web_Frontend SHALL use "as const" assertions for constants that represent closed sets of values
4. THE System SHALL document the rationale for different patterns in frontend vs backend
5. WHEN new constants are added, THE System SHALL follow the established pattern for that codebase

### Requirement 8: Array Parameter Normalization Utility

**User Story:** As a developer, I want array query parameters normalized in one place, so that single values and arrays are handled consistently.

#### Acceptance Criteria

1. THE Backend_API SHALL provide a utility function that normalizes query parameters to arrays
2. WHEN a query parameter is a single string, THE utility function SHALL return an array with one element
3. WHEN a query parameter is already an array, THE utility function SHALL return it unchanged
4. WHEN a query parameter is undefined, THE utility function SHALL return undefined
5. WHEN Route_Handlers need to process array parameters, THE Backend_API SHALL use the normalization utility
6. THE Backend_API SHALL eliminate duplicated array normalization logic from route handlers

### Requirement 9: Shared Modal Base Component

**User Story:** As a developer, I want a base modal component for common modal patterns, so that modal implementations are consistent and maintainable.

#### Acceptance Criteria

1. THE Web_Frontend SHALL provide a base modal component using CloudScape Modal
2. THE base modal component SHALL handle common modal state management (open/close)
3. THE base modal component SHALL provide standard header, content, and footer sections
4. THE base modal component SHALL support customizable sizes and styling
5. WHEN components need custom modals, THE Web_Frontend SHOULD extend or compose the base modal component
6. THE Web_Frontend SHALL refactor VersionConflictModal and ImportResultsModal to use the base component where appropriate

### Requirement 10: Centralized Error Code Constants

**User Story:** As a developer, I want error codes defined as constants, so that error handling is consistent and error codes are documented.

#### Acceptance Criteria

1. THE Backend_API SHALL define all error codes as constants in a centralized file
2. THE Backend_API SHALL define constants for validation errors, authorization errors, and business logic errors
3. WHEN error responses are created, THE Backend_API SHALL use the defined error code constants
4. THE Backend_API SHALL eliminate inline error code strings from service and route files
5. THE error code constants SHALL include descriptive names that indicate the error type

### Requirement 11: Centralized Business Logic Constants

**User Story:** As a developer, I want business logic values defined as constants, so that business rules are centralized and easy to update.

#### Acceptance Criteria

1. THE Backend_API SHALL define activity grouping types as constants
2. THE Backend_API SHALL define user role values as constants
3. THE Backend_API SHALL define status values as constants
4. WHEN business logic references these values, THE Backend_API SHALL use the defined constants
5. THE Backend_API SHALL eliminate inline business logic value strings from service files

### Requirement 12: Refactoring Validation and Testing

**User Story:** As a developer, I want comprehensive tests for refactored code, so that I can verify behavior is preserved and no regressions are introduced.

#### Acceptance Criteria

1. WHEN code is refactored, THE System SHALL maintain existing test coverage
2. WHEN new utility functions are created, THE System SHALL add unit tests for them
3. WHEN shared services are created, THE System SHALL add unit tests for them
4. WHEN components are refactored, THE System SHALL verify existing integration tests still pass
5. THE System SHALL run all existing tests to verify no regressions are introduced
6. WHEN pagination utilities are created, THE System SHALL test edge cases (negative numbers, non-numeric values, missing values)
7. WHEN authorization utilities are created, THE System SHALL test with and without geographic restrictions
8. WHEN geographic filtering service is created, THE System SHALL test explicit filtering, implicit filtering, and no filtering scenarios
