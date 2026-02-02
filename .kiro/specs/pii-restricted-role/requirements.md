# Requirements Document

## Introduction

This document specifies requirements for implementing a PII-restricted role in the Cultivate system. The PII_RESTRICTED role provides the most restrictive access level - a subset of READ_ONLY that denies access to all personally identifiable information (PII). This role enables users to view aggregate data and system structure without exposing personal details.

## Glossary

- **System**: The Cultivate application (backend-api and web-frontend)
- **PII_RESTRICTED_Role**: A new system role that restricts access to personally identifiable information
- **Participant**: A person tracked in the system with personal information
- **Venue**: A location where activities occur
- **JWT_Token**: JSON Web Token used for authentication and authorization
- **Backend_API**: The server-side API that processes requests and returns data
- **Web_Frontend**: The client-side application that displays data to users
- **UUID**: Universally Unique Identifier used as a non-identifying key
- **Address_History**: A collection of venue associations for a participant over time
- **Geographic_Authorization**: Permission rules that restrict data access based on geographic areas

## Requirements

### Requirement 1: PII_RESTRICTED Role Definition

**User Story:** As a system administrator, I want to create a new PII_RESTRICTED role, so that I can grant users access to aggregate data without exposing personal information.

#### Acceptance Criteria

1. THE System SHALL define a new role named "PII_RESTRICTED" in the role enumeration
2. THE System SHALL include PII_RESTRICTED as a selectable option when creating or editing user accounts
3. THE System SHALL store the PII_RESTRICTED role in user records alongside existing roles
4. THE System SHALL include the PII_RESTRICTED role in JWT_Tokens for authorization checks
5. WHERE a user has PII_RESTRICTED role, THE System SHALL apply more restrictive permissions than READ_ONLY role

### Requirement 2: Participant Data Redaction

**User Story:** As a user with PII_RESTRICTED role, I want participant personal information and home address associations to be completely hidden, so that I can view system data without accessing sensitive location details.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return the participant UUID
2. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the name field
3. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the email field
4. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the phone field
5. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the notes field
6. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the dateOfBirth field
7. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the dateOfRegistration field
8. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return null for the nickname field
9. WHEN a PII_RESTRICTED user requests participant data, THE Backend_API SHALL return an empty array for Address_History (home addresses are PII)
10. WHEN a PII_RESTRICTED user requests participant address history via dedicated endpoint, THE Backend_API SHALL return an empty array

### Requirement 3: Venue Data Redaction

**User Story:** As a user with PII_RESTRICTED role, I want venue names and participant associations to be hidden, so that I can view location data without identifying specific venues or their residents.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests venue data, THE Backend_API SHALL return null for the venue name field
2. WHEN a PII_RESTRICTED user requests venue data, THE Backend_API SHALL return the venue address field
3. WHEN a PII_RESTRICTED user requests venue data, THE Backend_API SHALL return the venue latitude field
4. WHEN a PII_RESTRICTED user requests venue data, THE Backend_API SHALL return the venue longitude field
5. WHEN a PII_RESTRICTED user requests venue data, THE Backend_API SHALL return the venue geographicAreaId field
6. WHEN a PII_RESTRICTED user requests venue data, THE Backend_API SHALL return all non-PII venue fields without redaction
7. WHEN a PII_RESTRICTED user requests venue data with participant associations, THE Backend_API SHALL return an empty array for the participants field (home addresses are PII)
8. WHEN a PII_RESTRICTED user requests participants at a venue via dedicated endpoint, THE Backend_API SHALL return an empty array

### Requirement 4: Frontend Participant Display

**User Story:** As a user with PII_RESTRICTED role, I want the frontend to display participant UUIDs instead of names and hide home address information, so that I can reference participants without seeing personal or location information.

#### Acceptance Criteria

1. WHEN the Web_Frontend renders a participant name for a PII_RESTRICTED user, THE System SHALL display the participant UUID
2. WHEN the Web_Frontend renders a participant detail view for a PII_RESTRICTED user, THE System SHALL display only the UUID as the identifier
3. WHEN the Web_Frontend renders a participant list for a PII_RESTRICTED user, THE System SHALL display UUIDs in place of names
4. WHEN the Web_Frontend receives null values for participant fields, THE System SHALL handle them gracefully without errors
5. WHEN the Web_Frontend renders a participant detail view for a PII_RESTRICTED user, THE System SHALL hide the Address History section entirely
6. WHEN the Web_Frontend renders a participant detail view for a PII_RESTRICTED user, THE System SHALL NOT display any home address information

### Requirement 5: Frontend Venue Display

**User Story:** As a user with PII_RESTRICTED role, I want the frontend to display venue addresses instead of names and hide participant associations, so that I can identify locations without seeing venue names or resident information.

#### Acceptance Criteria

1. WHEN the Web_Frontend renders a venue name for a PII_RESTRICTED user, THE System SHALL display the venue address
2. WHEN the Web_Frontend renders a venue detail view for a PII_RESTRICTED user, THE System SHALL display the address as the primary identifier
3. WHEN the Web_Frontend renders a venue list for a PII_RESTRICTED user, THE System SHALL display addresses in place of names
4. WHEN the Web_Frontend receives null values for venue name field, THE System SHALL display the address field instead
5. WHEN the Web_Frontend renders a venue detail view for a PII_RESTRICTED user, THE System SHALL hide the "Participants with Home Address Here" section entirely
6. WHEN the Web_Frontend renders a venue detail view for a PII_RESTRICTED user, THE System SHALL NOT display any participant association information

### Requirement 6: Read-Only Access Permissions

**User Story:** As a system administrator, I want PII_RESTRICTED users to have read-only access, so that they cannot modify data while viewing aggregate information.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user attempts to create a resource, THE Backend_API SHALL reject the request with an authorization error
2. WHEN a PII_RESTRICTED user attempts to update a resource, THE Backend_API SHALL reject the request with an authorization error
3. WHEN a PII_RESTRICTED user attempts to delete a resource, THE Backend_API SHALL reject the request with an authorization error
4. WHEN a PII_RESTRICTED user requests to read a resource, THE Backend_API SHALL process the request with PII redaction applied

### Requirement 7: Non-PII Data Access

**User Story:** As a user with PII_RESTRICTED role, I want to view non-PII data without restriction, so that I can analyze aggregate metrics and system structure.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests analytics dashboards, THE System SHALL return aggregate metrics without redaction
2. WHEN a PII_RESTRICTED user requests geographic area data, THE System SHALL return all fields without redaction
3. WHEN a PII_RESTRICTED user requests activity type data, THE System SHALL return all fields without redaction
4. WHEN a PII_RESTRICTED user requests activity category data, THE System SHALL return all fields without redaction
5. WHEN a PII_RESTRICTED user requests role data, THE System SHALL return all fields without redaction
6. WHEN a PII_RESTRICTED user requests population data, THE System SHALL return all fields without redaction

### Requirement 8: Geographic Authorization

**User Story:** As a system administrator, I want PII_RESTRICTED users to be subject to geographic authorization rules, so that they only access data within their authorized geographic areas.

#### Acceptance Criteria

1. WHEN a PII_RESTRICTED user requests data, THE Backend_API SHALL apply Geographic_Authorization rules
2. WHEN a PII_RESTRICTED user requests data outside their authorized geographic areas, THE Backend_API SHALL reject the request with an authorization error
3. WHEN a PII_RESTRICTED user requests data within their authorized geographic areas, THE Backend_API SHALL return the data with PII redaction applied

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
