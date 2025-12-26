# Design Document: Backend API Package

## Overview

The Backend API package is a RESTful API service built with Node.js, Express.js, TypeScript, and Prisma ORM. It serves as the central data management and business logic layer for the Community Activity Tracker system, providing endpoints for managing activities, participants, roles, activity types, analytics, authentication, authorization, and offline synchronization.

The API follows a layered architecture with clear separation between routing, business logic, data access, and cross-cutting concerns like authentication and validation. It uses PostgreSQL as the primary data store and implements JWT-based authentication with role-based authorization.

## Architecture

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (jsonwebtoken library)
- **Validation**: Zod
- **Password Hashing**: bcrypt
- **Documentation**: OpenAPI 3.0 with Swagger UI

### Layered Architecture

The API follows a three-layer architecture:

1. **Presentation Layer (Routes/Controllers)**
   - Express route handlers
   - Request/response transformation
   - HTTP-specific logic
   - Input validation using Zod schemas

2. **Business Logic Layer (Services)**
   - Core business rules
   - Transaction coordination
   - Domain logic
   - Analytics calculations

3. **Data Access Layer (Repositories)**
   - Prisma ORM interactions
   - Database queries
   - Data mapping

### Cross-Cutting Concerns

- **Authentication Middleware**: JWT token validation
- **Authorization Middleware**: Role-based access control
- **Error Handling Middleware**: Consistent error responses
- **Audit Logging Middleware**: Action tracking
- **Validation Middleware**: Request validation using Zod

### Design Rationale

**Why Express.js?** Express is lightweight, widely adopted, and provides excellent middleware support for cross-cutting concerns like authentication and validation.

**Why Prisma?** Prisma provides type-safe database access, automatic migrations, and excellent TypeScript integration, reducing boilerplate and preventing runtime errors.

**Why JWT?** JWT tokens are stateless, scalable, and work well with mobile and web clients. They eliminate the need for server-side session storage.

**Why Zod?** Zod provides runtime type validation with TypeScript inference, ensuring request data matches expected schemas before processing.

## Components and Interfaces

### 1. Route Handlers

Route handlers define API endpoints and delegate to service layer:

```typescript
// Activity Type Routes
GET    /api/v1/activity-types          -> List all activity types
POST   /api/v1/activity-types          -> Create activity type
PUT    /api/v1/activity-types/:id      -> Update activity type
DELETE /api/v1/activity-types/:id      -> Delete activity type

// Role Routes
GET    /api/v1/roles                   -> List all roles
POST   /api/v1/roles                   -> Create role
PUT    /api/v1/roles/:id               -> Update role
DELETE /api/v1/roles/:id               -> Delete role

// Participant Routes
GET    /api/v1/participants            -> List all participants
GET    /api/v1/participants/:id        -> Get participant by ID
GET    /api/v1/participants/search     -> Search participants
POST   /api/v1/participants            -> Create participant
PUT    /api/v1/participants/:id        -> Update participant
DELETE /api/v1/participants/:id        -> Delete participant

// Activity Routes
GET    /api/v1/activities              -> List all activities
GET    /api/v1/activities/:id          -> Get activity by ID
POST   /api/v1/activities              -> Create activity
PUT    /api/v1/activities/:id          -> Update activity
DELETE /api/v1/activities/:id          -> Delete activity

// Activity Participant Assignment Routes
GET    /api/v1/activities/:id/participants           -> List activity participants
POST   /api/v1/activities/:id/participants           -> Assign participant
PUT    /api/v1/activities/:id/participants/:participantId -> Update participant assignment
DELETE /api/v1/activities/:id/participants/:participantId -> Remove participant

// Activity Venue Association Routes
GET    /api/v1/activities/:id/venues                 -> List activity venues
POST   /api/v1/activities/:id/venues                 -> Associate venue with activity
DELETE /api/v1/activities/:id/venues/:venueId        -> Remove venue association

// Venue Routes
GET    /api/v1/venues                  -> List all venues
GET    /api/v1/venues/:id              -> Get venue by ID
GET    /api/v1/venues/search           -> Search venues
POST   /api/v1/venues                  -> Create venue
PUT    /api/v1/venues/:id              -> Update venue
DELETE /api/v1/venues/:id              -> Delete venue
GET    /api/v1/venues/:id/activities   -> List activities at venue
GET    /api/v1/venues/:id/participants -> List participants with venue as home

// Geographic Area Routes
GET    /api/v1/geographic-areas        -> List all geographic areas
GET    /api/v1/geographic-areas/:id    -> Get geographic area by ID
POST   /api/v1/geographic-areas        -> Create geographic area
PUT    /api/v1/geographic-areas/:id    -> Update geographic area
DELETE /api/v1/geographic-areas/:id    -> Delete geographic area
GET    /api/v1/geographic-areas/:id/children   -> List child geographic areas
GET    /api/v1/geographic-areas/:id/ancestors  -> Get hierarchy path to root
GET    /api/v1/geographic-areas/:id/venues     -> List venues in geographic area
GET    /api/v1/geographic-areas/:id/statistics -> Get statistics for geographic area

// Participant Address History Routes
GET    /api/v1/participants/:id/address-history -> Get participant's home address history

// Analytics Routes
GET    /api/v1/analytics/engagement    -> Get engagement metrics (supports geographic filter)
GET    /api/v1/analytics/growth        -> Get growth metrics (supports geographic filter)
GET    /api/v1/analytics/geographic    -> Get engagement metrics by geographic area

// Sync Routes
POST   /api/v1/sync/batch              -> Batch sync operations

// Auth Routes
POST   /api/v1/auth/login              -> Authenticate user
POST   /api/v1/auth/logout             -> Invalidate token
POST   /api/v1/auth/refresh            -> Refresh access token
GET    /api/v1/auth/me                 -> Get current user

// Documentation Routes
GET    /api/v1/docs                    -> Swagger UI
GET    /api/v1/docs/openapi.json       -> OpenAPI specification
```

### 2. Service Layer

Services implement business logic and coordinate operations:

- **ActivityTypeService**: Manages activity type CRUD operations, validates uniqueness, prevents deletion of referenced types
- **RoleService**: Manages role CRUD operations, validates uniqueness, prevents deletion of referenced roles
- **ParticipantService**: Manages participant CRUD operations, validates email format and uniqueness, implements search, manages home venue associations with Type 2 SCD
- **ActivityService**: Manages activity CRUD operations, validates required fields, handles status transitions, manages venue associations over time
- **AssignmentService**: Manages participant-activity assignments, validates references, prevents duplicates
- **VenueService**: Manages venue CRUD operations, validates geographic area references, prevents deletion of referenced venues, implements search
- **GeographicAreaService**: Manages geographic area CRUD operations, validates parent references, prevents circular relationships, prevents deletion of referenced areas, calculates hierarchical statistics
- **AnalyticsService**: Calculates engagement and growth metrics, applies date and geographic filters, aggregates data by geographic area
- **SyncService**: Processes batch sync operations, maps local to server IDs, handles conflicts
- **AuthService**: Handles authentication, token generation, password hashing and validation, manages root administrator initialization from environment variables
- **AuditService**: Logs user actions, stores audit records

### 3. Repository Layer

Repositories encapsulate Prisma database access:

- **ActivityTypeRepository**: CRUD operations for activity types
- **RoleRepository**: CRUD operations for roles
- **ParticipantRepository**: CRUD operations and search for participants
- **ActivityRepository**: CRUD operations and queries for activities
- **AssignmentRepository**: CRUD operations for participant assignments
- **VenueRepository**: CRUD operations and search for venues, queries for associated activities and participants
- **GeographicAreaRepository**: CRUD operations for geographic areas, hierarchical queries for ancestors and descendants, statistics aggregation
- **ParticipantAddressHistoryRepository**: Temporal tracking operations for participant home address changes
- **ActivityVenueHistoryRepository**: Temporal tracking operations for activity-venue associations
- **UserRepository**: User authentication and management
- **AuditLogRepository**: Audit log storage and retrieval

### 4. Middleware Components

**Authentication Middleware**
- Validates JWT tokens from Authorization header
- Extracts user information and attaches to request
- Returns 401 for missing or invalid tokens

**Authorization Middleware**
- Checks user role against required permissions
- Returns 403 for insufficient permissions
- Supports role-based access: ADMINISTRATOR, EDITOR, READ_ONLY

**Validation Middleware**
- Validates request body, query params, and path params using Zod schemas
- Returns 400 with detailed validation errors
- Sanitizes input to prevent injection attacks

**Error Handling Middleware**
- Catches all errors from route handlers
- Formats consistent error responses
- Logs errors with stack traces
- Maps error types to HTTP status codes

**Audit Logging Middleware**
- Logs authentication events, role changes, and entity modifications
- Records user ID, action type, entity type, entity ID, timestamp, and details
- Stores logs in database for administrator access

### 5. Validation Schemas

Zod schemas define request validation rules:

```typescript
// Activity Type Schema
ActivityTypeCreateSchema = {
  name: string (required, min 1 char, max 100 chars)
}

// Role Schema
RoleCreateSchema = {
  name: string (required, min 1 char, max 100 chars)
}

// Participant Schema
ParticipantCreateSchema = {
  name: string (required, min 1 char, max 200 chars),
  email: string (required, valid email format),
  phone: string (optional, max 20 chars),
  notes: string (optional, max 1000 chars)
}

// Activity Schema
ActivityCreateSchema = {
  name: string (required, min 1 char, max 200 chars),
  activityTypeId: string (required, valid UUID),
  startDate: date (required),
  endDate: date (optional, must be after startDate if provided),
  status: enum (optional, defaults to PLANNED)
}

// Assignment Schema
AssignmentCreateSchema = {
  participantId: string (required, valid UUID),
  roleId: string (required, valid UUID)
}

// Venue Schema
VenueCreateSchema = {
  name: string (required, min 1 char, max 200 chars),
  address: string (required, min 1 char, max 500 chars),
  geographicAreaId: string (required, valid UUID),
  latitude: number (optional, range -90 to 90),
  longitude: number (optional, range -180 to 180),
  venueType: enum (optional, PUBLIC_BUILDING or PRIVATE_RESIDENCE)
}

// Geographic Area Schema
GeographicAreaCreateSchema = {
  name: string (required, min 1 char, max 200 chars),
  areaType: enum (required, NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CUSTOM),
  parentGeographicAreaId: string (optional, valid UUID)
}

// Sync Operation Schema
SyncOperationSchema = {
  operation: enum (CREATE, UPDATE, DELETE),
  entityType: string (required),
  localId: string (optional),
  serverId: string (optional),
  data: object (required for CREATE/UPDATE),
  timestamp: date (required)
}

// Auth Schemas
LoginSchema = {
  email: string (required, valid email),
  password: string (required, min 8 chars)
}
```

## Data Models

### Database Schema

The API uses Prisma to define the following database models:

**User**
- id: UUID (primary key)
- email: String (unique)
- passwordHash: String
- role: Enum (ADMINISTRATOR, EDITOR, READ_ONLY)
- createdAt: DateTime
- updatedAt: DateTime

**ActivityType**
- id: UUID (primary key)
- name: String (unique)
- createdAt: DateTime
- updatedAt: DateTime
- activities: Activity[] (relation)

**Role**
- id: UUID (primary key)
- name: String (unique)
- createdAt: DateTime
- updatedAt: DateTime
- assignments: Assignment[] (relation)

**Participant**
- id: UUID (primary key)
- name: String
- email: String (unique)
- phone: String (optional)
- notes: String (optional)
- createdAt: DateTime
- updatedAt: DateTime
- assignments: Assignment[] (relation)
- addressHistory: ParticipantAddressHistory[] (relation)

**ParticipantAddressHistory**
- id: UUID (primary key)
- participantId: UUID (foreign key)
- venueId: UUID (foreign key)
- effectiveFrom: DateTime
- createdAt: DateTime
- participant: Participant (relation)
- venue: Venue (relation)

**Venue**
- id: UUID (primary key)
- name: String
- address: String
- geographicAreaId: UUID (foreign key)
- latitude: Decimal (optional)
- longitude: Decimal (optional)
- venueType: Enum (PUBLIC_BUILDING, PRIVATE_RESIDENCE, optional)
- createdAt: DateTime
- updatedAt: DateTime
- geographicArea: GeographicArea (relation)
- activityVenueHistory: ActivityVenueHistory[] (relation)
- participantAddressHistory: ParticipantAddressHistory[] (relation)

**GeographicArea**
- id: UUID (primary key)
- name: String
- areaType: Enum (NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CUSTOM)
- parentGeographicAreaId: UUID (foreign key, optional)
- createdAt: DateTime
- updatedAt: DateTime
- parent: GeographicArea (self-relation, optional)
- children: GeographicArea[] (self-relation)
- venues: Venue[] (relation)

**Activity**
- id: UUID (primary key)
- name: String
- activityTypeId: UUID (foreign key)
- startDate: DateTime
- endDate: DateTime (optional)
- status: Enum (PLANNED, ACTIVE, COMPLETED, CANCELLED)
- createdAt: DateTime
- updatedAt: DateTime
- activityType: ActivityType (relation)
- assignments: Assignment[] (relation)
- activityVenueHistory: ActivityVenueHistory[] (relation)

**ActivityVenueHistory**
- id: UUID (primary key)
- activityId: UUID (foreign key)
- venueId: UUID (foreign key)
- effectiveFrom: DateTime
- createdAt: DateTime
- activity: Activity (relation)
- venue: Venue (relation)

**Assignment**
- id: UUID (primary key)
- activityId: UUID (foreign key)
- participantId: UUID (foreign key)
- roleId: UUID (foreign key)
- createdAt: DateTime
- activity: Activity (relation)
- participant: Participant (relation)
- role: Role (relation)
- Unique constraint: (activityId, participantId, roleId)

**AuditLog**
- id: UUID (primary key)
- userId: UUID (foreign key)
- actionType: String
- entityType: String
- entityId: String
- details: JSON
- timestamp: DateTime
- user: User (relation)

### Data Relationships

- ActivityType has many Activities (one-to-many)
- Activity belongs to one ActivityType (many-to-one)
- Activity has many Assignments (one-to-many)
- Activity has many ActivityVenueHistory records (one-to-many)
- Participant has many Assignments (one-to-many)
- Participant has many ParticipantAddressHistory records (one-to-many)
- Role has many Assignments (one-to-many)
- Assignment belongs to one Activity, one Participant, and one Role (many-to-one for each)
- Venue belongs to one GeographicArea (many-to-one)
- Venue has many ActivityVenueHistory records (one-to-many)
- Venue has many ParticipantAddressHistory records (one-to-many)
- GeographicArea has many Venues (one-to-many)
- GeographicArea has many child GeographicAreas (one-to-many, self-referential)
- GeographicArea belongs to one parent GeographicArea (many-to-one, self-referential, optional)
- ActivityVenueHistory belongs to one Activity and one Venue (many-to-one for each)
- ParticipantAddressHistory belongs to one Participant and one Venue (many-to-one for each)
- User has many AuditLogs (one-to-many)

### Referential Integrity

- Foreign key constraints enforce referential integrity
- Cascade deletes are NOT used to prevent accidental data loss
- Deletion of referenced entities (ActivityType, Role, Venue, GeographicArea) is prevented by checking for existing references
- Deletion of Activities cascades to Assignments and ActivityVenueHistory (business rule: removing an activity removes all assignments and venue history)
- Deletion of Participants cascades to Assignments and ParticipantAddressHistory (business rule: removing a participant removes all assignments and address history)
- Circular parent-child relationships in GeographicArea are prevented by validation logic

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Resource Management Properties

**Property 1: Resource creation persistence**
*For any* valid resource (activity type, role, participant, activity), creating it via POST should result in the resource being retrievable via GET with the same data.
**Validates: Requirements 1.2, 2.2, 3.3, 4.3**

**Property 2: Resource update persistence**
*For any* existing resource and valid update data, updating it via PUT should result in the resource reflecting the new data when retrieved via GET.
**Validates: Requirements 1.3, 2.3, 3.4, 4.4**

**Property 3: Resource deletion removes resource**
*For any* existing resource without references, deleting it via DELETE should result in the resource no longer being retrievable via GET (404 response).
**Validates: Requirements 1.4, 2.4, 3.5, 4.5**

### Validation Properties

**Property 4: Name uniqueness enforcement**
*For any* activity type or role, attempting to create a duplicate with the same name should be rejected with a 400 error.
**Validates: Requirements 1.5, 2.5**

**Property 5: Required field validation**
*For any* resource creation request missing required fields, the API should reject it with a 400 error and detailed validation message.
**Validates: Requirements 3.7, 4.6, 5.4**

**Property 6: Email format validation**
*For any* participant creation or update with an invalid email format, the API should reject it with a 400 error.
**Validates: Requirements 3.8**

**Property 7: Email uniqueness enforcement**
*For any* participant, attempting to create or update with a duplicate email should be rejected with a 400 error.
**Validates: Requirements 3.8**

**Property 8: Optional field acceptance**
*For any* participant creation with or without optional phone and notes fields, the API should accept it and persist the provided values.
**Validates: Requirements 3.9**

**Property 9: Activity date validation**
*For any* finite activity, attempting to create it without an end date should be rejected with a 400 error.
**Validates: Requirements 4.7**

**Property 10: Ongoing activity end date**
*For any* ongoing activity, creating it without an end date should be accepted and the end date should be null.
**Validates: Requirements 4.8**

**Property 11: Default status assignment**
*For any* new activity created without specifying status, the status should default to PLANNED.
**Validates: Requirements 4.9**

**Property 12: Status value validation**
*For any* activity, attempting to set status to a value other than PLANNED, ACTIVE, COMPLETED, or CANCELLED should be rejected with a 400 error.
**Validates: Requirements 4.10**

### Referential Integrity Properties

**Property 13: Referenced entity deletion prevention**
*For any* activity type or role that is referenced by existing activities or assignments, attempting to delete it should be rejected with a 400 error.
**Validates: Requirements 1.6, 2.6**

**Property 14: Assignment reference validation**
*For any* assignment creation with non-existent activity, participant, or role IDs, the API should reject it with a 400 error.
**Validates: Requirements 5.5**

**Property 15: Duplicate assignment prevention**
*For any* existing assignment, attempting to create another assignment with the same activity, participant, and role should be rejected with a 400 error.
**Validates: Requirements 5.6**

**Property 16: Assignment deletion completeness**
*For any* assignment, deleting it should result in the assignment no longer appearing in the activity's participant list.
**Validates: Requirements 5.7**

### Search and Query Properties

**Property 17: Participant search accuracy**
*For any* search query, all returned participants should have names or emails that match the query string (case-insensitive).
**Validates: Requirements 3.6**

**Property 18: Participant retrieval by ID**
*For any* existing participant, retrieving it by ID should return the correct participant data.
**Validates: Requirements 3.2**

**Property 19: Activity retrieval by ID**
*For any* existing activity, retrieving it by ID should return the correct activity data including related activity type.
**Validates: Requirements 4.2**

### Analytics Properties

**Property 20: Unique participant counting**
*For any* set of activities, the engagement metrics should count each participant only once regardless of how many activities they're assigned to.
**Validates: Requirements 6.2**

**Property 21: Activity type counting**
*For any* set of activities, the engagement metrics should correctly count activities grouped by type.
**Validates: Requirements 6.3**

**Property 22: Active activity counting**
*For any* set of activities, the engagement metrics should correctly count activities with ACTIVE or ongoing status.
**Validates: Requirements 6.4**

**Property 23: Date range filtering**
*For any* date range filter, engagement metrics should include only activities whose date ranges overlap with the filter range.
**Validates: Requirements 6.5, 6.6**

**Property 24: Participant count per type**
*For any* set of activities, the engagement metrics should correctly count unique participants per activity type.
**Validates: Requirements 6.7**

**Property 25: Role distribution calculation**
*For any* set of activities, the engagement metrics should correctly count assignments grouped by role.
**Validates: Requirements 6.8**

**Property 26: Time period grouping**
*For any* time period parameter (DAY, WEEK, MONTH, YEAR), growth metrics should correctly group data into the specified periods.
**Validates: Requirements 7.2**

**Property 27: New participant counting per period**
*For any* time period, growth metrics should count only participants created within that period.
**Validates: Requirements 7.4**

**Property 28: New activity counting per period**
*For any* time period, growth metrics should count only activities created within that period.
**Validates: Requirements 7.5**

**Property 29: Chronological ordering**
*For any* growth metrics response, time-series data should be ordered from earliest to latest period.
**Validates: Requirements 7.6**

**Property 30: Percentage change calculation**
*For any* two consecutive time periods, the percentage change should be calculated as ((current - previous) / previous) * 100.
**Validates: Requirements 7.7**

**Property 31: Cumulative count calculation**
*For any* time period, the cumulative participant count should equal the sum of all new participants up to and including that period.
**Validates: Requirements 7.8**

### Data Persistence Properties

**Property 32: Immediate persistence**
*For any* create or update operation, the data should be immediately retrievable in subsequent GET requests.
**Validates: Requirements 8.2**

**Property 33: Transaction atomicity**
*For any* batch operation affecting multiple tables, either all operations should succeed or all should fail (no partial updates).
**Validates: Requirements 8.3**

**Property 34: Foreign key constraint enforcement**
*For any* operation attempting to create invalid foreign key references, the database should reject it with an error.
**Validates: Requirements 8.4**

**Property 35: Database error handling**
*For any* database operation failure, the API should return an appropriate error response with a descriptive message.
**Validates: Requirements 8.5**

### Synchronization Properties

**Property 36: Batch sync atomicity**
*For any* batch of sync operations, either all operations should succeed or all should fail within a single transaction.
**Validates: Requirements 9.2**

**Property 37: Local to server ID mapping**
*For any* sync operation creating a new entity with a local ID, the response should include a mapping from the local ID to the generated server ID.
**Validates: Requirements 9.3**

**Property 38: Operation status reporting**
*For any* batch sync request, the response should include success or failure status for each individual operation.
**Validates: Requirements 9.4**

**Property 39: Last-write-wins conflict resolution**
*For any* conflicting sync operations on the same entity, the operation with the latest timestamp should be applied.
**Validates: Requirements 9.5**

**Property 40: Conflict information reporting**
*For any* sync conflict, the response should include conflict details identifying the conflicting entity and timestamps.
**Validates: Requirements 9.6**

**Property 41: Sync operation type support**
*For any* sync batch, the API should correctly process CREATE, UPDATE, and DELETE operation types.
**Validates: Requirements 9.7**

### Authentication Properties

**Property 42: Invalid credential rejection**
*For any* login attempt with incorrect email or password, the API should reject it with a 401 error.
**Validates: Requirements 10.5**

**Property 43: Token generation on authentication**
*For any* successful login, the API should return both a JWT access token and a refresh token.
**Validates: Requirements 10.6**

**Property 44: Password hashing**
*For any* user, the password should never be stored in plain text; only the bcrypt hash should be stored.
**Validates: Requirements 10.7**

**Property 45: Access token expiration**
*For any* access token older than 15 minutes, the API should reject it with a 401 error.
**Validates: Requirements 10.8**

**Property 46: Refresh token expiration**
*For any* refresh token older than 7 days, the API should reject it with a 401 error.
**Validates: Requirements 10.9**

**Property 46A: Root administrator environment variable extraction**
*For any* system startup, the root administrator username should be extracted from the SRP_ROOT_ADMIN_EMAIL environment variable.
**Validates: Requirements 10.10**

**Property 46B: Root administrator password extraction**
*For any* system startup, the root administrator password should be extracted from the SRP_ROOT_ADMIN_PASSWORD environment variable.
**Validates: Requirements 10.11**

**Property 46C: Root administrator database seeding**
*For any* database seed operation, a user record should be created with the email from SRP_ROOT_ADMIN_EMAIL and hashed password from SRP_ROOT_ADMIN_PASSWORD.
**Validates: Requirements 10.12, 10.13**

**Property 46D: Root administrator password hashing**
*For any* root administrator user creation during seeding, the password should be hashed using bcrypt before storage.
**Validates: Requirements 10.13**

**Property 46E: Root administrator role assignment**
*For any* root administrator user created during seeding, the user should be assigned the ADMINISTRATOR system role.
**Validates: Requirements 10.14**

### Authorization Properties

**Property 47: Protected endpoint authentication requirement**
*For any* protected endpoint request without a valid JWT token, the API should return 401 Unauthorized.
**Validates: Requirements 11.1**

**Property 48: Administrator full access**
*For any* operation, users with ADMINISTRATOR role should be able to perform it successfully.
**Validates: Requirements 11.3**

**Property 49: Editor write access**
*For any* create, update, or delete operation on activities, participants, or configurations, users with EDITOR role should be able to perform it successfully.
**Validates: Requirements 11.4**

**Property 50: Read-only user restrictions**
*For any* create, update, or delete operation, users with READ_ONLY role should receive a 403 Forbidden error.
**Validates: Requirements 11.5**

**Property 51: Unauthorized action rejection**
*For any* operation that a user's role doesn't permit, the API should return 403 Forbidden.
**Validates: Requirements 11.6**

**Property 52: Permission validation enforcement**
*For any* protected operation, the API should validate user permissions before executing the operation.
**Validates: Requirements 11.7**

### Audit Logging Properties

**Property 53: Authentication event logging**
*For any* login, logout, or token refresh event, an audit log entry should be created.
**Validates: Requirements 12.1**

**Property 54: Role change logging**
*For any* user role modification, an audit log entry should be created.
**Validates: Requirements 12.2**

**Property 55: Entity modification logging**
*For any* create, update, or delete operation on entities, an audit log entry should be created.
**Validates: Requirements 12.3**

**Property 56: Audit log completeness**
*For any* audit log entry, it should contain user ID, action type, entity type, entity ID, and timestamp.
**Validates: Requirements 12.4**

**Property 57: Audit log detail format**
*For any* audit log entry, additional details should be stored as valid JSON.
**Validates: Requirements 12.5**

**Property 58: Audit log access restriction**
*For any* request to access audit logs, only users with ADMINISTRATOR role should be able to retrieve them.
**Validates: Requirements 12.6**

### Error Handling Properties

**Property 59: Consistent error format**
*For any* error response, it should include code, message, and details fields in a consistent structure.
**Validates: Requirements 13.1**

**Property 60: Validation error status code**
*For any* request with invalid input data, the API should return 400 Bad Request.
**Validates: Requirements 13.2**

**Property 61: Authentication error status code**
*For any* request with missing or invalid authentication, the API should return 401 Unauthorized.
**Validates: Requirements 13.3**

**Property 62: Authorization error status code**
*For any* request with insufficient permissions, the API should return 403 Forbidden.
**Validates: Requirements 13.4**

**Property 63: Not found error status code**
*For any* request for a non-existent resource, the API should return 404 Not Found.
**Validates: Requirements 13.5**

**Property 64: Internal error status code**
*For any* unexpected server error, the API should return 500 Internal Server Error.
**Validates: Requirements 13.6**

**Property 65: Error logging with stack traces**
*For any* error, the API should log it with a stack trace for debugging purposes.
**Validates: Requirements 13.7**

### Documentation Properties

**Property 66: OpenAPI specification completeness**
*For any* API endpoint, it should be documented in the OpenAPI specification with request and response schemas.
**Validates: Requirements 14.3**

**Property 67: Example documentation**
*For any* API endpoint, the OpenAPI specification should include example requests and responses.
**Validates: Requirements 14.4**

**Property 68: Error response documentation**
*For any* API endpoint, all possible error responses should be documented in the OpenAPI specification.
**Validates: Requirements 14.5**

### Input Validation Properties

**Property 69: Request body validation**
*For any* request with a body, the API should validate it against the defined Zod schema and reject invalid data with 400.
**Validates: Requirements 15.1**

**Property 70: Parameter validation**
*For any* request with query or path parameters, the API should validate them and reject invalid values with 400.
**Validates: Requirements 15.2**

**Property 71: Detailed validation errors**
*For any* validation failure, the error response should include specific details about which fields failed validation and why.
**Validates: Requirements 15.3**

**Property 72: Input sanitization**
*For any* user input, the API should sanitize it to prevent SQL injection, XSS, and other injection attacks.
**Validates: Requirements 15.5**

### Venue Management Properties

**Property 73: Venue creation with geographic area**
*For any* valid venue with name, address, and existing geographic area ID, creating it via POST should result in the venue being retrievable with the correct geographic area association.
**Validates: Requirements 5A.3, 5A.7, 5A.8**

**Property 74: Venue geographic area validation**
*For any* venue creation or update with a non-existent geographic area ID, the API should reject it with a 400 error.
**Validates: Requirements 5A.8**

**Property 75: Venue optional fields**
*For any* venue creation with or without optional latitude, longitude, and venue type fields, the API should accept it and persist the provided values.
**Validates: Requirements 5A.9**

**Property 76: Venue deletion prevention**
*For any* venue referenced by activities or participants, attempting to delete it should be rejected with a 400 error explaining which entities reference it.
**Validates: Requirements 5A.10, 5A.11**

**Property 77: Venue search accuracy**
*For any* search query, all returned venues should have names or addresses that match the query string (case-insensitive).
**Validates: Requirements 5A.6**

**Property 78: Venue activities retrieval**
*For any* venue, retrieving its activities should return all activities currently or historically associated with that venue.
**Validates: Requirements 5A.12**

**Property 79: Venue participants retrieval**
*For any* venue, retrieving its participants should return all participants who currently or historically had this venue as their home address.
**Validates: Requirements 5A.13**

### Geographic Area Management Properties

**Property 80: Geographic area creation**
*For any* valid geographic area with name and area type, creating it via POST should result in the geographic area being retrievable.
**Validates: Requirements 5B.3, 5B.6**

**Property 81: Geographic area parent validation**
*For any* geographic area creation with a non-existent parent geographic area ID, the API should reject it with a 400 error.
**Validates: Requirements 5B.8**

**Property 82: Circular relationship prevention**
*For any* geographic area, attempting to set its parent to itself or to one of its descendants should be rejected with a 400 error.
**Validates: Requirements 5B.9**

**Property 83: Geographic area type validation**
*For any* geographic area, the area type should be one of: NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, or CUSTOM.
**Validates: Requirements 5B.10**

**Property 84: Geographic area deletion prevention**
*For any* geographic area referenced by venues or child geographic areas, attempting to delete it should be rejected with a 400 error.
**Validates: Requirements 5B.11**

**Property 85: Geographic area children retrieval**
*For any* geographic area, retrieving its children should return all geographic areas that have it as their parent.
**Validates: Requirements 5B.12**

**Property 86: Geographic area ancestors retrieval**
*For any* geographic area, retrieving its ancestors should return the complete hierarchy path from the area to the root, ordered from child to root.
**Validates: Requirements 5B.13**

**Property 87: Geographic area venues retrieval**
*For any* geographic area, retrieving its venues should return all venues directly associated with that geographic area.
**Validates: Requirements 5B.14**

**Property 88: Geographic area statistics calculation**
*For any* geographic area, the statistics should include activity and participant counts for the area and all its descendants.
**Validates: Requirements 5B.15**

### Participant Address History Properties

**Property 89: Address history creation on venue update**
*For any* participant whose home venue is updated, a new ParticipantAddressHistory record should be created with the new venue and current timestamp as effectiveFrom.
**Validates: Requirements 3.11**

**Property 90: Address history retrieval**
*For any* participant, retrieving their address history should return all ParticipantAddressHistory records ordered by effectiveFrom descending (most recent first).
**Validates: Requirements 3.12**

**Property 91: Current address identification**
*For any* participant with address history, the current address should be the record with the most recent effectiveFrom date.
**Validates: Requirements 3.11**

**Property 92: Address history duplicate prevention**
*For any* participant, attempting to create an address history record with the same effectiveFrom date as an existing record should be rejected with a 400 error.
**Validates: Requirements 3.17**

### Activity Venue Association Properties

**Property 93: Activity venue association creation**
*For any* activity and valid venue ID, associating the venue via POST should result in an ActivityVenueHistory record being created with the current timestamp as effectiveFrom.
**Validates: Requirements 4.11, 4.13**

**Property 94: Activity venue history retrieval**
*For any* activity, retrieving its venues should return all ActivityVenueHistory records ordered by effectiveFrom descending (most recent first).
**Validates: Requirements 4.12, 4.15**

**Property 95: Current venue identification**
*For any* activity with venue history, the current venue should be the record with the most recent effectiveFrom date.
**Validates: Requirements 4.11**

**Property 96: Activity venue duplicate prevention**
*For any* activity, attempting to create a venue association with the same effectiveFrom date as an existing record should be rejected with a 400 error.
**Validates: Requirements 4.15**

### Geographic Analytics Properties

**Property 97: Geographic area filtering for engagement**
*For any* engagement metrics request with a geographic area filter, only activities and participants associated with venues in that geographic area or its descendants should be included.
**Validates: Requirements 6.9, 6.10**

**Property 98: Geographic breakdown calculation**
*For any* geographic analytics request, engagement metrics should be correctly grouped and aggregated by geographic area.
**Validates: Requirements 6.11**

**Property 99: Geographic area filtering for growth**
*For any* growth metrics request with a geographic area filter, only activities and participants associated with venues in that geographic area or its descendants should be included.
**Validates: Requirements 7.9, 7.10**

**Property 100: Hierarchical statistics aggregation**
*For any* geographic area, statistics should include data from all descendant geographic areas in the hierarchy.
**Validates: Requirements 5B.15**

### Pagination Properties

**Property 101: Page parameter validation**
*For any* paginated list request with an invalid page number (less than 1), the API should reject it with a 400 error.
**Validates: Requirements 17.5**

**Property 102: Limit parameter validation**
*For any* paginated list request with a limit greater than 100, the API should reject it with a 400 error.
**Validates: Requirements 17.7**

**Property 103: Pagination metadata accuracy**
*For any* paginated list response, the pagination metadata should correctly reflect the total count, current page, limit, and total pages.
**Validates: Requirements 17.8**

**Property 104: Pagination data consistency**
*For any* paginated list request, the returned data should contain exactly the items for the requested page based on the limit.
**Validates: Requirements 17.9**

### Optimistic Locking Properties

**Property 105: Version field inclusion**
*For any* entity response (Activity, Participant, Venue, GeographicArea, ActivityType, Role), it should include a version field.
**Validates: Requirements 18.1**

**Property 106: Version mismatch rejection**
*For any* update request with a version that doesn't match the current entity version, the API should return 409 Conflict.
**Validates: Requirements 18.2, 18.3**

**Property 107: Version increment on update**
*For any* successful update operation, the entity's version number should be incremented by 1.
**Validates: Requirements 18.4**

### Rate Limiting Properties

**Property 108: Authentication rate limit enforcement**
*For any* IP address making more than 5 authentication requests per minute, the API should return 429 Too Many Requests.
**Validates: Requirements 19.1**

**Property 109: Mutation rate limit enforcement**
*For any* authenticated user making more than 100 mutation requests per minute, the API should return 429 Too Many Requests.
**Validates: Requirements 19.2**

**Property 110: Query rate limit enforcement**
*For any* authenticated user making more than 1000 query requests per minute, the API should return 429 Too Many Requests.
**Validates: Requirements 19.3**

**Property 111: Rate limit header inclusion**
*For any* API response, it should include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.
**Validates: Requirements 19.5**

### API Versioning Properties

**Property 112: Version path inclusion**
*For any* API endpoint, it should be accessible via the /api/v1/... path.
**Validates: Requirements 20.1**

**Property 113: Backward compatibility within version**
*For any* endpoint within the same major version, changes should maintain backward compatibility.
**Validates: Requirements 20.2**

## Error Handling

### Error Response Format

All errors follow a consistent format:

```typescript
{
  code: string,        // Error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
  message: string,     // Human-readable error message
  details: object      // Additional error details (e.g., validation errors)
}
```

### Error Types and Status Codes

- **400 Bad Request**: Validation errors, invalid input, business rule violations
- **401 Unauthorized**: Missing or invalid JWT token, expired token
- **403 Forbidden**: Insufficient permissions for the requested operation
- **404 Not Found**: Resource does not exist
- **500 Internal Server Error**: Unexpected errors, database failures

### Error Handling Strategy

1. **Validation Errors**: Caught by validation middleware, return 400 with field-specific errors
2. **Authentication Errors**: Caught by auth middleware, return 401
3. **Authorization Errors**: Caught by authorization middleware, return 403
4. **Business Logic Errors**: Thrown by services, caught by error middleware, return appropriate status
5. **Database Errors**: Caught by repositories, wrapped in appropriate error types
6. **Unexpected Errors**: Caught by global error handler, logged with stack trace, return 500

### Logging

- All errors are logged with stack traces using a structured logging library
- Logs include request ID, user ID (if authenticated), timestamp, and error details
- Sensitive information (passwords, tokens) is never logged

## Testing Strategy

### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions for individual components:

- **Service Layer Tests**: Test business logic with mocked repositories
- **Repository Layer Tests**: Test database queries with test database
- **Middleware Tests**: Test authentication, authorization, validation, and error handling
- **Validation Schema Tests**: Test Zod schemas with valid and invalid inputs

Focus areas for unit tests:
- Edge cases (empty inputs, boundary values, null/undefined)
- Error conditions (database failures, validation failures)
- Integration points between layers
- Specific examples demonstrating correct behavior

### Property-Based Testing

Property-based tests verify universal properties across all inputs using a property testing library (fast-check for TypeScript):

- **Minimum 100 iterations per property test** to ensure comprehensive input coverage
- Each property test references its design document property using the tag format:
  ```typescript
  // Feature: backend-api, Property 1: Resource creation persistence
  ```
- Properties test universal behaviors that should hold for all valid inputs
- Generators create random but valid test data (activities, participants, assignments, etc.)

Property testing library: **fast-check** (TypeScript property-based testing library)

### Integration Testing

Integration tests verify end-to-end API behavior:

- Test complete request/response cycles
- Use test database with migrations
- Test authentication and authorization flows
- Test multi-step operations (create activity, assign participants, calculate analytics)

### Test Database

- Use separate PostgreSQL database for testing
- Run migrations before tests
- Seed with test data
- Clean up after each test

### Testing Balance

- Unit tests handle specific examples and edge cases
- Property tests handle comprehensive input coverage
- Integration tests handle end-to-end flows
- Together they provide comprehensive coverage without excessive redundancy

## Local Development Database Setup

### Finch-Based PostgreSQL Script

The API package includes an optional sidecar script for local development and integration testing:

**Purpose**: Automate PostgreSQL database setup using Finch for local testing without manual configuration

**Container Runtime**: Uses **Finch** (not Docker Desktop) for maximum compatibility and open-source availability. Finch is an open-source container development tool that provides a Docker-compatible CLI.

**Location**: `scripts/setup-local-db.js` (Node.js for cross-platform compatibility)

**Functionality**:
1. **Finch Detection**: Checks if Finch is installed and running
2. **Finch Installation**: Automatically installs Finch if missing using platform-specific package managers:
   - macOS: Homebrew (`brew install finch`)
   - RHEL/CentOS: yum (download and install from GitHub releases)
   - Debian/Ubuntu: apt (download and install from GitHub releases)
   - Linux: Direct binary installation from GitHub releases
3. **PostgreSQL Image**: Pulls the latest official PostgreSQL container image
4. **Container Management**: 
   - Creates and starts a PostgreSQL container using Finch
   - Exposes port 5432 for API connection
   - Configures environment variables (database name, username, password)
   - Sets up persistent volume for data
5. **Output**: Provides connection string and status information

**Configuration**:
```bash
# Default container configuration
CONTAINER_NAME=srp-postgres-local
POSTGRES_DB=srp_dev
POSTGRES_USER=srp_user
POSTGRES_PASSWORD=srp_dev_password
POSTGRES_PORT=5432
```

**Usage**:
```bash
# Run the setup script
npm run setup-local-db

# Or directly
node scripts/setup-local-db.js
```

**Connection String Output**:
```
postgresql://srp_user:srp_dev_password@localhost:5432/srp_dev
```

**Design Rationale**:
- **Open Source**: Finch is fully open-source and freely available without licensing restrictions
- **Docker Compatibility**: Finch provides a Docker-compatible CLI, making it a drop-in replacement
- **Developer Experience**: Eliminates manual database setup steps
- **Consistency**: Ensures all developers use the same database configuration
- **Isolation**: Containers prevent conflicts with other PostgreSQL installations
- **CI/CD Ready**: Can be used in continuous integration pipelines
- **Non-Production**: Clearly separated from production deployment artifacts

**Why Finch over Docker Desktop**:
- Freely available without commercial licensing concerns
- Open-source and community-driven
- Lighter weight and faster startup
- Native integration with containerd
- Better suited for development and testing workflows

**Exclusions**:
- NOT included in production Docker images
- NOT part of the API service deployment
- Located in development utilities directory
- Documented as development-only tooling
