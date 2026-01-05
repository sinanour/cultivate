# Design Document: Backend API Package

## Overview

The Backend API package is a RESTful API service built with Node.js, Express.js, TypeScript, and Prisma ORM. It serves as the central data management and business logic layer for the Cultivate system, providing endpoints for managing activities, participants, roles, activity types, analytics, authentication, authorization, and offline synchronization.

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
// Activity Category Routes
GET    /api/v1/activity-categories     -> List all activity categories
POST   /api/v1/activity-categories     -> Create activity category
PUT    /api/v1/activity-categories/:id -> Update activity category
DELETE /api/v1/activity-categories/:id -> Delete activity category

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

// Population Routes (Admin Only)
GET    /api/v1/populations             -> List all populations
POST   /api/v1/populations             -> Create population (admin only)
PUT    /api/v1/populations/:id         -> Update population (admin only)
DELETE /api/v1/populations/:id         -> Delete population (admin only)

// Participant Population Association Routes
GET    /api/v1/participants/:id/populations           -> List participant's populations
POST   /api/v1/participants/:id/populations           -> Add participant to population
DELETE /api/v1/participants/:id/populations/:populationId -> Remove participant from population

// User Routes (Admin Only)
GET    /api/v1/users                   -> List all users (admin only)
GET    /api/v1/users/:id               -> Get user by ID (admin only)
POST   /api/v1/users                   -> Create user with optional authorization rules (admin only)
PUT    /api/v1/users/:id               -> Update user (admin only)

// Geographic Authorization Routes (Admin Only)
GET    /api/v1/users/:id/geographic-authorizations -> List user's authorization rules (admin only)
POST   /api/v1/users/:id/geographic-authorizations -> Create authorization rule (admin only)
DELETE /api/v1/users/:id/geographic-authorizations/:authId -> Delete authorization rule (admin only)
GET    /api/v1/users/:id/authorized-areas -> Get user's effective authorized areas (admin only)

// Participant Routes
GET    /api/v1/participants            -> List all participants (supports ?geographicAreaId=<id> and ?search=<text> filters)
GET    /api/v1/participants/:id        -> Get participant by ID
GET    /api/v1/participants/:id/activities -> Get participant's activity assignments
GET    /api/v1/participants/search     -> Search participants
POST   /api/v1/participants            -> Create participant
PUT    /api/v1/participants/:id        -> Update participant
DELETE /api/v1/participants/:id        -> Delete participant

// Activity Routes
GET    /api/v1/activities              -> List all activities (supports ?geographicAreaId=<id> filter)
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
GET    /api/v1/venues                  -> List all venues (supports ?geographicAreaId=<id> and ?search=<text> filters)
GET    /api/v1/venues/:id              -> Get venue by ID
GET    /api/v1/venues/search           -> Search venues
POST   /api/v1/venues                  -> Create venue
PUT    /api/v1/venues/:id              -> Update venue
DELETE /api/v1/venues/:id              -> Delete venue
GET    /api/v1/venues/:id/activities   -> List activities at venue
GET    /api/v1/venues/:id/participants -> List participants with venue as home

// Geographic Area Routes
GET    /api/v1/geographic-areas        -> List all geographic areas (supports ?geographicAreaId=<id> and ?search=<text> filters)
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
GET    /api/v1/analytics/engagement         -> Get engagement metrics (supports geographic filter)
GET    /api/v1/analytics/growth             -> Get growth metrics (supports geographic filter)
GET    /api/v1/analytics/geographic         -> Get engagement metrics by geographic area
GET    /api/v1/analytics/activity-lifecycle -> Get activity lifecycle events (started/completed)

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

- **ActivityCategoryService**: Manages activity category CRUD operations, validates uniqueness, prevents deletion of referenced categories
- **ActivityTypeService**: Manages activity type CRUD operations, validates uniqueness, validates activity category references, prevents deletion of referenced types
- **RoleService**: Manages role CRUD operations, validates uniqueness, prevents deletion of referenced roles
- **PopulationService**: Manages population CRUD operations (admin only for create/update/delete), validates uniqueness, prevents deletion of referenced populations, manages participant-population associations (many-to-many), validates participant and population existence, prevents duplicate associations
- **UserService**: Manages user CRUD operations (admin only), validates email is provided, accepts optional display name, validates email uniqueness, hashes passwords with bcrypt (minimum 8 characters), excludes password hashes from all responses, supports role assignment and modification, allows optional password updates, supports creating users with geographic authorization rules in a single atomic transaction
- **ParticipantService**: Manages participant CRUD operations, validates email format and uniqueness when email is provided, validates dateOfBirth is in the past when provided, validates dateOfRegistration when provided, implements search, manages home venue associations with Type 2 SCD, retrieves participant activity assignments, supports geographic area filtering and text-based search filtering for list queries
- **ActivityService**: Manages activity CRUD operations, validates required fields, handles status transitions, manages venue associations over time, supports geographic area filtering for list queries
- **AssignmentService**: Manages participant-activity assignments, validates references, prevents duplicates
- **VenueService**: Manages venue CRUD operations, validates geographic area references, prevents deletion of referenced venues, retrieves associated activities and current residents (participants whose most recent address history is at the venue), implements search, supports geographic area filtering and text-based search filtering for list queries
- **GeographicAreaService**: Manages geographic area CRUD operations, validates parent references, prevents circular relationships, prevents deletion of referenced areas, calculates hierarchical statistics, supports geographic area filtering and text-based search filtering for list queries (returns selected area, descendants, and ancestors for hierarchy context)
- **AnalyticsService**: Calculates comprehensive engagement and growth metrics with temporal analysis (activities/participants at start/end of date range, activities started/completed/cancelled), supports multi-dimensional grouping (activity category, activity type, venue, geographic area, population, date with weekly/monthly/quarterly/yearly granularity), applies flexible filtering (point filters for activity category, activity type, venue, geographic area, population; range filter for dates), aggregates data hierarchically by specified dimensions, provides activity lifecycle event data (started/completed counts grouped by category or type with filter support including population filtering)
- **SyncService**: Processes batch sync operations, maps local to server IDs, handles conflicts
- **AuthService**: Handles authentication, token generation, password hashing and validation, manages root administrator initialization from environment variables, includes authorized geographic area IDs in JWT token payload
- **GeographicAuthorizationService**: Manages user geographic authorization rules (CRUD operations), evaluates user access to geographic areas (deny-first logic), calculates effective authorized areas (including descendants and ancestors), validates geographic restrictions for create operations, provides authorization filtering for all data access, enforces authorization on individual resource access (GET by ID, PUT, DELETE), validates authorization for nested resource endpoints, provides authorization bypass for administrators, logs all authorization denials
- **AuditService**: Logs user actions, stores audit records, logs geographic authorization rule changes

### 3. Repository Layer

Repositories encapsulate Prisma database access:

- **ActivityCategoryRepository**: CRUD operations for activity categories
- **ActivityTypeRepository**: CRUD operations for activity types
- **RoleRepository**: CRUD operations for roles
- **PopulationRepository**: CRUD operations for populations, reference counting for deletion validation
- **ParticipantPopulationRepository**: CRUD operations for participant-population associations, duplicate prevention
- **UserGeographicAuthorizationRepository**: CRUD operations for geographic authorization rules, queries for user's authorization rules, calculates effective authorized areas with descendants and ancestors
- **UserRepository**: CRUD operations for users, includes findAll, findByEmail, findById, create, and update methods
- **ParticipantRepository**: CRUD operations and text-based search for participants (supports filtering by name/email and geographic area with pagination)
- **ActivityRepository**: CRUD operations and queries for activities
- **AssignmentRepository**: CRUD operations for participant assignments
- **VenueRepository**: CRUD operations and text-based search for venues (supports filtering by name/address and geographic area with pagination), queries for associated activities and current residents (filters participants by most recent address history)
- **GeographicAreaRepository**: CRUD operations for geographic areas with text-based search (supports filtering by name and geographic area with pagination), hierarchical queries for ancestors and descendants, statistics aggregation
- **ParticipantAddressHistoryRepository**: Temporal tracking operations for participant home address changes
- **ActivityVenueHistoryRepository**: Temporal tracking operations for activity-venue associations
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
// Activity Category Schema
ActivityCategoryCreateSchema = {
  name: string (required, min 1 char, max 100 chars)
}

// Activity Type Schema
ActivityTypeCreateSchema = {
  name: string (required, min 1 char, max 100 chars),
  activityCategoryId: string (required, valid UUID)
}

// Role Schema
RoleCreateSchema = {
  name: string (required, min 1 char, max 100 chars)
}

// Population Schema
PopulationCreateSchema = {
  name: string (required, min 1 char, max 100 chars)
}

// Participant Schema
ParticipantCreateSchema = {
  name: string (required, min 1 char, max 200 chars),
  email: string (optional, valid email format if provided),
  phone: string (optional, max 20 chars),
  notes: string (optional, max 1000 chars),
  dateOfBirth: date (optional, must be in the past if provided),
  dateOfRegistration: date (optional),
  nickname: string (optional, max 100 chars)
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
  areaType: enum (required, NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD),
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

// User Schemas (Admin Only)
UserCreateSchema = {
  displayName: string (optional, min 1 char, max 200 chars),
  email: string (required, valid email, unique),
  password: string (required, min 8 chars),
  role: enum (required, ADMINISTRATOR | EDITOR | READ_ONLY),
  authorizationRules: array (optional, array of { geographicAreaId: UUID, ruleType: ALLOW | DENY })
}

UserUpdateSchema = {
  displayName: string (optional, nullable, min 1 char if provided, max 200 chars),
  email: string (optional, valid email, unique),
  password: string (optional, min 8 chars),
  role: enum (optional, ADMINISTRATOR | EDITOR | READ_ONLY)
}

// Activity Lifecycle Query Schema
ActivityLifecycleQuerySchema = {
  startDate: string (optional, ISO 8601 datetime format),
  endDate: string (optional, ISO 8601 datetime format),
  groupBy: enum (required, 'category' | 'type'),
  geographicAreaIds: string[] (optional, array of valid UUIDs),
  activityTypeIds: string[] (optional, array of valid UUIDs),
  venueIds: string[] (optional, array of valid UUIDs)
}
```

### Optional Field Clearing

**Design Pattern for Clearing Optional Fields:**

The API supports clearing optional fields by explicitly sending null or empty string values in update requests. This is distinct from omitting fields, which preserves existing values.

**Field Clearing Behavior:**
- **Field omitted from request**: Existing value is preserved (no change)
- **Field set to null or empty string**: Field is cleared (set to null in database)

**Update Schema Pattern:**
```typescript
// Participant Update Schema
ParticipantUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),  // nullable() allows explicit null
  phone: z.string().max(20).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  dateOfRegistration: z.coerce.date().nullable().optional(),
  nickname: z.string().max(100).nullable().optional()
});

// Venue Update Schema
VenueUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  geographicAreaId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  venueType: z.enum(['PUBLIC_BUILDING', 'PRIVATE_RESIDENCE']).nullable().optional()
});

// Activity Update Schema
ActivityUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  activityTypeId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),  // Can be cleared to make ongoing
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional()
});

// Assignment Update Schema
AssignmentUpdateSchema = z.object({
  roleId: z.string().uuid().optional(),
  notes: z.string().max(1000).nullable().optional()
});
```

**Service Layer Implementation:**

Services must handle both undefined (omit) and null (clear) values:

```typescript
async updateParticipant(id: string, data: ParticipantUpdateData): Promise<Participant> {
  // Build update object - only include fields present in request
  const updateData: any = {};
  
  // For each field, check if it's in the request
  if ('name' in data) updateData.name = data.name;
  if ('email' in data) updateData.email = data.email;  // null clears, undefined omits
  if ('phone' in data) updateData.phone = data.phone;
  if ('notes' in data) updateData.notes = data.notes;
  if ('dateOfBirth' in data) updateData.dateOfBirth = data.dateOfBirth;
  if ('dateOfRegistration' in data) updateData.dateOfRegistration = data.dateOfRegistration;
  if ('nickname' in data) updateData.nickname = data.nickname;
  
  return this.participantRepository.update(id, updateData);
}
```

**Clearable Optional Fields by Entity:**

- **Participant**: email, phone, notes, dateOfBirth, dateOfRegistration, nickname
- **Venue**: latitude, longitude, venueType
- **Activity**: endDate (converts finite activity to ongoing)
- **Assignment**: notes
- **GeographicArea**: parentGeographicAreaId (removes parent, makes it a root area)

**Key Design Points:**
- Uses Zod's `.nullable()` modifier to accept null values
- Services check for field presence using `'field' in data` to distinguish omit vs clear
- Null values are stored as NULL in PostgreSQL
- API responses return null for cleared fields (not empty strings)
- Maintains backward compatibility - clients not aware of clearing continue to work

### Activity Lifecycle Events Endpoint

**GET /api/v1/analytics/activity-lifecycle**

Returns activity lifecycle event data showing activities started and completed within a time period (or all time), grouped by activity category or type.

**Query Parameters:**
- `startDate` (optional): ISO 8601 datetime string - start of analysis period (omit for all history)
- `endDate` (optional): ISO 8601 datetime string - end of analysis period (omit for all history)
- `groupBy` (required): 'category' or 'type' - grouping dimension
- `geographicAreaIds` (optional): Array of geographic area UUIDs - filters to activities at venues in these areas or descendants
- `activityTypeIds` (optional): Array of activity type UUIDs - filters to specific activity types
- `venueIds` (optional): Array of venue UUIDs - filters to activities at specific venues
- `populationIds` (optional): Array of population UUIDs - filters to activities with participants in these populations

**Response:**
```typescript
{
  success: true,
  data: Array<{
    groupName: string,      // Category or type name
    started: number,        // Count of activities started in period
    completed: number       // Count of activities completed in period
  }>
}
```

**Business Logic:**
- When both dates provided: Started count where `startDate >= startDate AND startDate <= endDate`, Completed count where `endDate >= startDate AND endDate <= endDate AND status = COMPLETED`
- When only startDate provided: Started count where `startDate >= startDate`, Completed count where `endDate >= startDate AND status = COMPLETED`
- When only endDate provided: Started count where `startDate <= endDate`, Completed count where `endDate <= endDate AND status = COMPLETED`
- When no dates provided: All started activities, all completed activities (all-time metrics)
- Excludes cancelled activities from both counts
- When multiple filters provided, applies AND logic
- Results sorted alphabetically by groupName
- Returns empty array when no activities match filters

## Data Models

### Database Schema

The API uses Prisma to define the following database models:

**User**
- id: UUID (primary key)
- displayName: String (optional, nullable)
- email: String (unique)
- passwordHash: String
- role: Enum (ADMINISTRATOR, EDITOR, READ_ONLY)
- createdAt: DateTime
- updatedAt: DateTime
- geographicAuthorizations: UserGeographicAuthorization[] (relation)

**UserGeographicAuthorization**
- id: UUID (primary key)
- userId: UUID (foreign key)
- geographicAreaId: UUID (foreign key)
- ruleType: Enum (ALLOW, DENY)
- createdAt: DateTime
- createdBy: UUID (foreign key to User)
- user: User (relation)
- geographicArea: GeographicArea (relation)
- creator: User (relation)
- Unique constraint: (userId, geographicAreaId) to prevent duplicate rules

**ActivityCategory**
- id: UUID (primary key)
- name: String (unique)
- isPredefined: Boolean
- createdAt: DateTime
- updatedAt: DateTime
- activityTypes: ActivityType[] (relation)

**ActivityType**
- id: UUID (primary key)
- name: String (unique)
- activityCategoryId: UUID (foreign key)
- isPredefined: Boolean
- createdAt: DateTime
- updatedAt: DateTime
- activityCategory: ActivityCategory (relation)
- activities: Activity[] (relation)

**Role**
- id: UUID (primary key)
- name: String (unique)
- createdAt: DateTime
- updatedAt: DateTime
- assignments: Assignment[] (relation)

**Population**
- id: UUID (primary key)
- name: String (unique)
- createdAt: DateTime
- updatedAt: DateTime
- participantPopulations: ParticipantPopulation[] (relation)

**ParticipantPopulation**
- id: UUID (primary key)
- participantId: UUID (foreign key)
- populationId: UUID (foreign key)
- createdAt: DateTime
- participant: Participant (relation)
- population: Population (relation)
- Unique constraint: (participantId, populationId) to prevent duplicate associations

**Participant**
- id: UUID (primary key)
- name: String
- email: String (optional, unique if provided)
- phone: String (optional)
- notes: String (optional)
- dateOfBirth: DateTime (optional)
- dateOfRegistration: DateTime (optional)
- nickname: String (optional)
- createdAt: DateTime
- updatedAt: DateTime
- assignments: Assignment[] (relation)
- addressHistory: ParticipantAddressHistory[] (relation)
- participantPopulations: ParticipantPopulation[] (relation)

**ParticipantAddressHistory**
- id: UUID (primary key)
- participantId: UUID (foreign key)
- venueId: UUID (foreign key)
- effectiveFrom: DateTime (optional, nullable)
- createdAt: DateTime
- participant: Participant (relation)
- venue: Venue (relation)
- Unique constraint: (participantId, effectiveFrom) to prevent duplicates including null

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
- areaType: Enum (NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD)
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
- effectiveFrom: DateTime (optional, nullable)
- createdAt: DateTime
- activity: Activity (relation)
- venue: Venue (relation)
- Unique constraint: (activityId, effectiveFrom) to prevent duplicates including null

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
- userId: UUID (foreign key, optional/nullable for pre-authentication events)
- actionType: String
- entityType: String
- entityId: String
- details: JSON
- timestamp: DateTime
- user: User (relation, optional)

### Data Relationships

- ActivityCategory has many ActivityTypes (one-to-many)
- ActivityType belongs to one ActivityCategory (many-to-one)
- ActivityType has many Activities (one-to-many)
- Activity belongs to one ActivityType (many-to-one)
- Activity has many Assignments (one-to-many)
- Activity has many ActivityVenueHistory records (one-to-many)
- Participant has many Assignments (one-to-many)
- Participant has many ParticipantAddressHistory records (one-to-many)
- Participant has many ParticipantPopulation records (one-to-many)
- Population has many ParticipantPopulation records (one-to-many)
- ParticipantPopulation belongs to one Participant and one Population (many-to-one for each)
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
- User has many UserGeographicAuthorization records (one-to-many)
- UserGeographicAuthorization belongs to one User (many-to-one)
- UserGeographicAuthorization belongs to one GeographicArea (many-to-one)
- UserGeographicAuthorization has one creator User (many-to-one)
- GeographicArea has many UserGeographicAuthorization records (one-to-many)

### Temporal Data and Null EffectiveFrom Handling

**ParticipantAddressHistory and ActivityVenueHistory** support optional/nullable `effectiveFrom` dates with special semantics:

**Null EffectiveFrom for Participant Address History:**
- A null `effectiveFrom` date represents the **oldest/initial home address** for a participant
- Only one address history record per participant can have a null `effectiveFrom`
- When determining "current" address, null `effectiveFrom` is treated as the earliest possible date
- Ordering: null values sort to the end (oldest) when ordering by `effectiveFrom DESC`

**Null EffectiveFrom for Activity Venue History:**
- A null `effectiveFrom` date means the venue association **started with the activity** (uses activity's `startDate`)
- Only one venue history record per activity can have a null `effectiveFrom`
- When determining "current" venue, null `effectiveFrom` is treated as equal to the activity's `startDate`
- Ordering: null values are compared using the activity's `startDate` when ordering by `effectiveFrom DESC`

**Implementation Considerations:**

1. **Current Record Determination:**
   - For participants: Current address is the record with the most recent non-null `effectiveFrom`, or the null record if no non-null records exist
   - For activities: Current venue is the record with the most recent non-null `effectiveFrom`, or the null record if no non-null records exist

2. **Filtering and Analytics:**
   - When filtering by geographic area, the system must correctly identify the current venue considering null dates
   - Null `effectiveFrom` for activities should be treated as the activity's `startDate` for temporal queries
   - Null `effectiveFrom` for participants should be treated as the earliest date for temporal queries

3. **Validation:**
   - Database unique constraint on `(participantId, effectiveFrom)` prevents duplicate null values
   - Database unique constraint on `(activityId, effectiveFrom)` prevents duplicate null values
   - Application-level validation provides clear error messages when attempting to create duplicate null records

### Geographic Authorization Architecture

The system implements granular geographic authorization to control user access at the geographic area level:

**Authorization Model:**
- **Allow-listing**: Users can be granted access to specific geographic areas
- **Deny-listing**: Users can be explicitly denied access to specific geographic areas
- **Precedence**: DENY rules take precedence over ALLOW rules
- **Hierarchical Access**: ALLOW rules grant access to the area and all descendants
- **Ancestor Access**: ALLOW rules grant read-only access to all ancestor areas
- **Default Behavior**: Users with no authorization rules have unrestricted access

**Authorization Evaluation Logic:**

```typescript
function evaluateAccess(userId: string, geographicAreaId: string): AccessLevel {
  const rules = getUserAuthorizationRules(userId);
  
  // No rules = unrestricted access
  if (rules.length === 0) {
    return AccessLevel.FULL;
  }
  
  // Check for DENY rules first (including ancestors)
  const ancestors = getAncestors(geographicAreaId);
  for (const rule of rules.filter(r => r.ruleType === 'DENY')) {
    if (rule.geographicAreaId === geographicAreaId || ancestors.includes(rule.geographicAreaId)) {
      return AccessLevel.NONE;
    }
  }
  
  // Check for ALLOW rules
  for (const rule of rules.filter(r => r.ruleType === 'ALLOW')) {
    const descendants = getDescendants(rule.geographicAreaId);
    const ancestors = getAncestors(rule.geographicAreaId);
    
    // Full access to allowed area and descendants
    if (rule.geographicAreaId === geographicAreaId || descendants.includes(geographicAreaId)) {
      return AccessLevel.FULL;
    }
    
    // Read-only access to ancestors
    if (ancestors.includes(geographicAreaId)) {
      return AccessLevel.READ_ONLY;
    }
  }
  
  // No matching rules = no access
  return AccessLevel.NONE;
}
```

**JWT Token Enhancement:**

The JWT token payload is enhanced to include authorized geographic area IDs for efficient authorization checks:

```typescript
interface JWTPayload {
  sub: string;                    // User ID
  email: string;
  systemRole: SystemRole;
  authorizedAreaIds: string[];    // IDs of areas user can access (full access)
  readOnlyAreaIds: string[];      // IDs of ancestor areas (read-only access)
  hasGeographicRestrictions: boolean;  // True if user has any authorization rules
  iat: number;
  exp: number;
}
```

**Implicit Filtering:**

When no explicit `geographicAreaId` parameter is provided in API requests, the system automatically filters results based on the user's authorized areas:

```typescript
async getParticipants(page?, limit?, geographicAreaId?, search?, userId?) {
  // Determine effective geographic filter
  let effectiveAreaIds: string[] | undefined;
  
  if (geographicAreaId) {
    // Explicit filter provided - validate authorization
    if (!isAuthorized(userId, geographicAreaId)) {
      throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
    }
    effectiveAreaIds = [geographicAreaId, ...getDescendants(geographicAreaId)];
  } else {
    // No explicit filter - apply implicit filtering based on authorization
    const authInfo = getUserAuthorizationInfo(userId);
    if (authInfo.hasGeographicRestrictions) {
      effectiveAreaIds = authInfo.authorizedAreaIds;
    }
    // If no restrictions, effectiveAreaIds remains undefined (no filtering)
  }
  
  // Apply geographic filter to query
  return this.participantRepository.findMany({ 
    geographicAreaIds: effectiveAreaIds,
    search,
    page,
    limit
  });
}
```

**Create Operation Validation:**

When users create entities associated with geographic areas, the system validates authorization:

```typescript
async createVenue(data: VenueCreateData, userId: string) {
  // Validate user is authorized to create in this geographic area
  const accessLevel = evaluateAccess(userId, data.geographicAreaId);
  if (accessLevel !== AccessLevel.FULL) {
    throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
  }
  
  return this.venueRepository.create(data);
}

async createGeographicArea(data: GeographicAreaCreateData, userId: string) {
  const authInfo = getUserAuthorizationInfo(userId);
  
  // If user has geographic restrictions
  if (authInfo.hasGeographicRestrictions) {
    // Prevent creating top-level areas
    if (!data.parentGeographicAreaId) {
      throw new ForbiddenError('CANNOT_CREATE_TOP_LEVEL_AREA');
    }
    
    // Validate parent is in authorized areas
    const accessLevel = evaluateAccess(userId, data.parentGeographicAreaId);
    if (accessLevel !== AccessLevel.FULL) {
      throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
    }
  }
  
  return this.geographicAreaRepository.create(data);
}
```

**Individual Resource Access Authorization:**

When users access individual resources by ID (detail views, updates, deletes), the system validates authorization:

```typescript
async getParticipantById(id: string, userId: string) {
  // Fetch participant with current home venue
  const participant = await this.participantRepository.findById(id);
  if (!participant) {
    throw new NotFoundError('Participant not found');
  }
  
  // Determine current home venue from address history
  const currentAddress = await this.getParticipantCurrentAddress(participant.id);
  if (!currentAddress) {
    // No address history - allow access (participant not yet associated with any area)
    return participant;
  }
  
  // Validate authorization to access the venue's geographic area
  const accessLevel = evaluateAccess(userId, currentAddress.venue.geographicAreaId);
  if (accessLevel === AccessLevel.NONE) {
    throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
  }
  
  return participant;
}

async getActivityById(id: string, userId: string) {
  // Fetch activity with current venue
  const activity = await this.activityRepository.findById(id);
  if (!activity) {
    throw new NotFoundError('Activity not found');
  }
  
  // Determine current venue from venue history
  const currentVenue = await this.getActivityCurrentVenue(activity.id);
  if (!currentVenue) {
    // No venue history - allow access (activity not yet associated with any area)
    return activity;
  }
  
  // Validate authorization to access the venue's geographic area
  const accessLevel = evaluateAccess(userId, currentVenue.geographicAreaId);
  if (accessLevel === AccessLevel.NONE) {
    throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
  }
  
  return activity;
}

async getVenueById(id: string, userId: string) {
  // Fetch venue
  const venue = await this.venueRepository.findById(id);
  if (!venue) {
    throw new NotFoundError('Venue not found');
  }
  
  // Validate authorization to access the venue's geographic area
  const accessLevel = evaluateAccess(userId, venue.geographicAreaId);
  if (accessLevel === AccessLevel.NONE) {
    throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
  }
  
  return venue;
}

async getGeographicAreaById(id: string, userId: string) {
  // Fetch geographic area
  const area = await this.geographicAreaRepository.findById(id);
  if (!area) {
    throw new NotFoundError('Geographic area not found');
  }
  
  // Validate authorization (includes read-only access to ancestors)
  const accessLevel = evaluateAccess(userId, id);
  if (accessLevel === AccessLevel.NONE) {
    throw new ForbiddenError('GEOGRAPHIC_AUTHORIZATION_DENIED');
  }
  
  return area;
}
```

**Update and Delete Authorization:**

All update (PUT) and delete (DELETE) operations follow the same authorization pattern as GET operations - they first validate that the user has access to the resource's geographic area before allowing the operation.

**Nested Resource Authorization:**

Nested resource endpoints (e.g., `/participants/:id/activities`, `/venues/:id/participants`) enforce authorization on the parent resource:

```typescript
async getParticipantActivities(participantId: string, userId: string) {
  // First validate access to the participant
  await this.getParticipantById(participantId, userId);  // Throws 403 if not authorized
  
  // If authorized, return activities
  return this.assignmentRepository.findByParticipant(participantId);
}
```

**Administrator Bypass:**

Users with ADMINISTRATOR role bypass geographic authorization checks for administrative operations, allowing them to manage all resources regardless of geographic restrictions.

**Design Rationale:**
- Storing authorized area IDs in JWT reduces database queries for every request
- Deny-first evaluation provides clear security semantics
- Hierarchical access (descendants + ancestors) aligns with geographic hierarchy model
- Implicit filtering ensures users never see unauthorized data in lists
- Individual resource authorization prevents URL-based bypass attacks
- Read-only ancestor access enables navigation context without granting full access
- Consistent authorization across all access patterns (lists, details, updates, deletes, nested resources)
- Administrator bypass enables system management without geographic restrictions

### Referential Integrity

- Foreign key constraints enforce referential integrity
- Cascade deletes are NOT used to prevent accidental data loss
- Deletion of referenced entities (ActivityCategory, ActivityType, Role, Population, Venue, GeographicArea) is prevented by checking for existing references
- Deletion of Activities cascades to Assignments and ActivityVenueHistory (business rule: removing an activity removes all assignments and venue history)
- Deletion of Participants cascades to Assignments, ParticipantAddressHistory, and ParticipantPopulation (business rule: removing a participant removes all assignments, address history, and population memberships)
- Circular parent-child relationships in GeographicArea are prevented by validation logic

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Resource Management Properties

**Property 1: Resource creation persistence**
*For any* valid resource (activity category, activity type, role, participant, activity), creating it via POST should result in the resource being retrievable via GET with the same data.
**Validates: Requirements 1.2, 1.9, 2.2, 3.3, 4.3**

**Property 2: Resource update persistence**
*For any* existing resource and valid update data, updating it via PUT should result in the resource reflecting the new data when retrieved via GET.
**Validates: Requirements 1.3, 1.10, 2.3, 3.4, 4.4**

**Property 3: Resource deletion removes resource**
*For any* existing resource without references, deleting it via DELETE should result in the resource no longer being retrievable via GET (404 response).
**Validates: Requirements 1.4, 1.11, 2.4, 3.5, 4.5**

### Validation Properties

**Property 4: Name uniqueness enforcement**
*For any* activity category, activity type, or role, attempting to create a duplicate with the same name should be rejected with a 400 error.
**Validates: Requirements 1.5, 1.12, 2.5**

**Property 5: Required field validation**
*For any* resource creation request missing required fields (name for participants, name/activityTypeId/startDate for activities, etc.), the API should reject it with a 400 error and detailed validation message.
**Validates: Requirements 3.7, 4.6, 5.4**

**Property 6: Email format validation**
*For any* participant creation or update with an email provided that has an invalid format, the API should reject it with a 400 error.
**Validates: Requirements 3.9**

**Property 7: Email uniqueness enforcement**
*For any* participant, attempting to create or update with a duplicate email (when email is provided) should be rejected with a 400 error.
**Validates: Requirements 3.10**

**Property 8: Optional field acceptance**
*For any* participant creation with or without optional email, phone, notes, dateOfBirth, dateOfRegistration, and nickname fields, the API should accept it and persist the provided values.
**Validates: Requirements 3.8**

**Property 8A: Date of birth validation**
*For any* participant creation or update with a dateOfBirth provided that is not in the past, the API should reject it with a 400 error.
**Validates: Requirements 3.11**

**Property 8B: Date of registration validation**
*For any* participant creation or update with a dateOfRegistration provided that is not a valid date, the API should reject it with a 400 error.
**Validates: Requirements 3.12**

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
*For any* activity category, activity type, or role that is referenced by existing activity types, activities, or assignments, attempting to delete it should be rejected with a 400 error.
**Validates: Requirements 1.6, 1.15, 2.6**

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

**Property 18A: Participant activities retrieval**
*For any* existing participant, retrieving their activities should return all assignments with complete activity and role details.
**Validates: Requirements 3.18**

**Property 19: Activity retrieval by ID**
*For any* existing activity, retrieving it by ID should return the correct activity data including related activity type.
**Validates: Requirements 4.2**

### Analytics Properties

**Property 20: Activities at start of date range counting**
*For any* date range, engagement metrics should correctly count activities that existed (were created and not yet completed or cancelled) at the start of the date range.
**Validates: Requirements 6.2**

**Property 21: Activities at end of date range counting**
*For any* date range, engagement metrics should correctly count activities that existed (were created and not yet completed or cancelled) at the end of the date range.
**Validates: Requirements 6.3**

**Property 22: Activities started within range counting**
*For any* date range, engagement metrics should correctly count activities whose start date falls within the date range.
**Validates: Requirements 6.4**

**Property 23: Activities completed within range counting**
*For any* date range, engagement metrics should correctly count activities whose status changed to COMPLETED within the date range.
**Validates: Requirements 6.5**

**Property 24: Activities cancelled within range counting**
*For any* date range, engagement metrics should correctly count activities whose status changed to CANCELLED within the date range.
**Validates: Requirements 6.6**

**Property 25: Participants at start of date range counting**
*For any* date range, engagement metrics should correctly count unique participants who were assigned to at least one activity at the start of the date range.
**Validates: Requirements 6.7**

**Property 26: Participants at end of date range counting**
*For any* date range, engagement metrics should correctly count unique participants who were assigned to at least one activity at the end of the date range.
**Validates: Requirements 6.8**

**Property 27: Aggregate activity counts**
*For any* engagement metrics request, activity counts should be provided in aggregate across all activity categories and types.
**Validates: Requirements 6.9**

**Property 27A: Activity counts by category breakdown**
*For any* engagement metrics request, activity counts should be broken down by activity category.
**Validates: Requirements 6.10**

**Property 28: Activity counts by type breakdown**
*For any* engagement metrics request, activity counts should be broken down by activity type.
**Validates: Requirements 6.11**

**Property 29: Aggregate participant counts**
*For any* engagement metrics request, participant counts should be provided in aggregate across all activity categories and types.
**Validates: Requirements 6.12**

**Property 29A: Participant counts by category breakdown**
*For any* engagement metrics request, participant counts should be broken down by activity category.
**Validates: Requirements 6.13**

**Property 30: Participant counts by type breakdown**
*For any* engagement metrics request, participant counts should be broken down by activity type.
**Validates: Requirements 6.14**

**Property 31: Multi-dimensional grouping support**
*For any* engagement metrics request with multiple grouping dimensions, the response should organize metrics hierarchically by the specified dimensions in order.
**Validates: Requirements 6.15, 6.21**

**Property 31A: Activity category point filter**
*For any* engagement metrics request with an activity category filter, only activities of the specified category should be included.
**Validates: Requirements 6.16**

**Property 32: Activity type point filter**
*For any* engagement metrics request with an activity type filter, only activities of the specified type should be included.
**Validates: Requirements 6.17**

**Property 33: Venue point filter**
*For any* engagement metrics request with a venue filter, only activities associated with the specified venue should be included.
**Validates: Requirements 6.18**

**Property 34: Geographic area point filter**
*For any* engagement metrics request with a geographic area filter, only activities and participants associated with venues in that geographic area or its descendants should be included.
**Validates: Requirements 6.19, 6.24**

**Property 35: Date range filter**
*For any* engagement metrics request with a date range filter, only activities and participants within the specified date range should be included.
**Validates: Requirements 6.20**

**Property 36: Multiple filter AND logic**
*For any* engagement metrics request with multiple filters, all filters should be applied using AND logic.
**Validates: Requirements 6.22**

**Property 37: All-time metrics without date range**
*For any* engagement metrics request without a date range, metrics should be calculated for all time.
**Validates: Requirements 6.23**

**Property 38: Role distribution calculation**
*For any* engagement metrics request, the response should include role distribution across all activities within the filtered and grouped results.
**Validates: Requirements 6.25**

**Property 39: Date grouping granularity**
*For any* engagement metrics request with date grouping, the system should support weekly, monthly, quarterly, and yearly granularity.
**Validates: Requirements 6.15**

**Property 40: Time period grouping**
*For any* time period parameter (DAY, WEEK, MONTH, YEAR), growth metrics should correctly group data into the specified periods.
**Validates: Requirements 7.2**

**Property 41: Unique participant counting per period**
*For any* time period, growth metrics should count unique participants who were engaged in activities during that period (snapshot, not cumulative).
**Validates: Requirements 7.4**

**Property 42: Unique activity counting per period**
*For any* time period, growth metrics should count unique activities that were active during that period (snapshot, not cumulative).
**Validates: Requirements 7.5**

**Property 43: Chronological ordering**
*For any* growth metrics response, time-series data should be ordered from earliest to latest period.
**Validates: Requirements 7.6**

**Property 44: Percentage change calculation**
*For any* two consecutive time periods, the percentage change for both participants and activities should be calculated as ((current - previous) / previous) * 100.
**Validates: Requirements 7.7**

**Property 45: Optional grouping by activity type**
*For any* growth metrics request with groupBy='type', the response should include separate time-series data for each activity type showing unique participants and activities per period.
**Validates: Requirements 7.10, 7.11**

**Property 46: Optional grouping by activity category**
*For any* growth metrics request with groupBy='category', the response should include separate time-series data for each activity category showing unique participants and activities per period.
**Validates: Requirements 7.12**

**Property 47: Aggregate growth without grouping**
*For any* growth metrics request without a groupBy parameter, the response should include aggregate time-series data across all activity types and categories.
**Validates: Requirements 7.13**

### Activity Lifecycle Events Properties

**Property 47A: Lifecycle started count accuracy**
*For any* activity, if it started within the specified time period, it should be counted exactly once in the "started" series for its corresponding group (category or type).
**Validates: Requirements 6A.6, 6A.8**

**Property 47B: Lifecycle completed count accuracy**
*For any* activity, if it completed within the specified time period and has status COMPLETED, it should be counted exactly once in the "completed" series for its corresponding group (category or type).
**Validates: Requirements 6A.7, 6A.8**

**Property 47C: Lifecycle cancelled exclusion**
*For any* cancelled activity, it should not be counted in either the "started" or "completed" series, regardless of its dates.
**Validates: Requirements 6A.8**

**Property 47D: Lifecycle filter combination**
*For any* combination of filters (geographicAreaIds, activityTypeIds, venueIds), only activities matching all applied filters should be included in the lifecycle event counts.
**Validates: Requirements 6A.9, 6A.10, 6A.11, 6A.12, 6A.13, 6A.14, 6A.15**

**Property 47E: Lifecycle grouping accuracy**
*For any* groupBy parameter ('category' or 'type'), the results should be grouped by the specified dimension with accurate group names.
**Validates: Requirements 6A.4, 6A.5**

**Property 47F: Lifecycle result sorting**
*For any* lifecycle events response, the results should be sorted alphabetically by groupName.
**Validates: Requirements 6A.17**

### Data Persistence Properties

**Property 48: Immediate persistence**
*For any* create or update operation, the data should be immediately retrievable in subsequent GET requests.
**Validates: Requirements 8.2**

**Property 49: Transaction atomicity**
*For any* batch operation affecting multiple tables, either all operations should succeed or all should fail (no partial updates).
**Validates: Requirements 8.3**

**Property 50: Foreign key constraint enforcement**
*For any* operation attempting to create invalid foreign key references, the database should reject it with an error.
**Validates: Requirements 8.4**

**Property 51: Database error handling**
*For any* database operation failure, the API should return an appropriate error response with a descriptive message.
**Validates: Requirements 8.5**

### Synchronization Properties

**Property 52: Batch sync atomicity**
*For any* batch of sync operations, either all operations should succeed or all should fail within a single transaction.
**Validates: Requirements 9.2**

**Property 53: Local to server ID mapping**
*For any* sync operation creating a new entity with a local ID, the response should include a mapping from the local ID to the generated server ID.
**Validates: Requirements 9.3**

**Property 54: Operation status reporting**
*For any* batch sync request, the response should include success or failure status for each individual operation.
**Validates: Requirements 9.4**

**Property 55: Last-write-wins conflict resolution**
*For any* conflicting sync operations on the same entity, the operation with the latest timestamp should be applied.
**Validates: Requirements 9.5**

**Property 56: Conflict information reporting**
*For any* sync conflict, the response should include conflict details identifying the conflicting entity and timestamps.
**Validates: Requirements 9.6**

**Property 57: Sync operation type support**
*For any* sync batch, the API should correctly process CREATE, UPDATE, and DELETE operation types.
**Validates: Requirements 9.7**

### Authentication Properties

**Property 58: Invalid credential rejection**
*For any* login attempt with incorrect email or password, the API should reject it with a 401 error.
**Validates: Requirements 10.5**

**Property 59: Token generation on authentication**
*For any* successful login, the API should return both a JWT access token and a refresh token.
**Validates: Requirements 10.6**

**Property 60: Password hashing**
*For any* user, the password should never be stored in plain text; only the bcrypt hash should be stored.
**Validates: Requirements 10.7**

**Property 61: Access token expiration**
*For any* access token older than 15 minutes, the API should reject it with a 401 error.
**Validates: Requirements 10.8**

**Property 62: Refresh token expiration**
*For any* refresh token older than 7 days, the API should reject it with a 401 error.
**Validates: Requirements 10.9**

**Property 62A: Root administrator environment variable extraction**
*For any* system startup, the root administrator username should be extracted from the SRP_ROOT_ADMIN_EMAIL environment variable.
**Validates: Requirements 10.10**

**Property 62B: Root administrator password extraction**
*For any* system startup, the root administrator password should be extracted from the SRP_ROOT_ADMIN_PASSWORD environment variable.
**Validates: Requirements 10.11**

**Property 62C: Root administrator database seeding**
*For any* database seed operation, a user record should be created with the email from SRP_ROOT_ADMIN_EMAIL and hashed password from SRP_ROOT_ADMIN_PASSWORD.
**Validates: Requirements 10.12, 10.13**

**Property 62D: Root administrator password hashing**
*For any* root administrator user creation during seeding, the password should be hashed using bcrypt before storage.
**Validates: Requirements 10.13**

**Property 62E: Root administrator role assignment**
*For any* root administrator user created during seeding, the user should be assigned the ADMINISTRATOR system role.
**Validates: Requirements 10.14**

### Authorization Properties

**Property 63: Protected endpoint authentication requirement**
*For any* protected endpoint request without a valid JWT token, the API should return 401 Unauthorized.
**Validates: Requirements 11.1**

**Property 64: Administrator full access**
*For any* operation, users with ADMINISTRATOR role should be able to perform it successfully.
**Validates: Requirements 11.3**

**Property 65: Editor write access**
*For any* create, update, or delete operation on activities, participants, or configurations, users with EDITOR role should be able to perform it successfully.
**Validates: Requirements 11.4**

**Property 66: Read-only user restrictions**
*For any* create, update, or delete operation, users with READ_ONLY role should receive a 403 Forbidden error.
**Validates: Requirements 11.5**

**Property 67: Unauthorized action rejection**
*For any* operation that a user's role doesn't permit, the API should return 403 Forbidden.
**Validates: Requirements 11.6**

**Property 68: Permission validation enforcement**
*For any* protected operation, the API should validate user permissions before executing the operation.
**Validates: Requirements 11.7**

### User Management Properties

**Property 68a: User list retrieval**
*For any* GET /api/v1/users request from an administrator, the API should return all users with displayName, email, and role fields without password hashes.
**Validates: Requirements 11A.1, 11A.17, 11A.18**

**Property 68b: User creation validation**
*For any* POST /api/v1/users request with valid displayName, email, password (minimum 8 characters), and role, the API should create a new user with hashed password.
**Validates: Requirements 11A.2, 11A.6, 11A.7, 11A.8, 11A.9, 11A.10**

**Property 68b_auth: User creation with authorization rules**
*For any* POST /api/v1/users request with valid user data and an array of authorization rules, the API should create the user and all authorization rules in a single atomic transaction.
**Validates: Requirements 11A.11, 11A.12**

**Property 68c: User email uniqueness**
*For any* attempt to create or update a user with an email that already exists for a different user, the API should return a DUPLICATE_EMAIL error.
**Validates: Requirements 11A.7, 11A.16**

**Property 68d: User update flexibility**
*For any* PUT /api/v1/users/:id request, the API should allow updating displayName, email, password, and role independently, with password being optional.
**Validates: Requirements 11A.13, 11A.14, 11A.15**

**Property 68e: User management administrator restriction**
*For any* user management endpoint request from a non-administrator, the API should return 403 Forbidden.
**Validates: Requirements 11A.4, 11A.5**

**Property 68f: Password hash exclusion**
*For any* user object returned by the API, the password hash field should not be included in the response.
**Validates: Requirements 11A.18**

**Property 68g: Display name optional acceptance**
*For any* POST /api/v1/users request with or without a displayName, the API should accept it and persist the provided value (or null if not provided).
**Validates: Requirements 11A.6a**

### Audit Logging Properties

**Property 69: Authentication event logging**
*For any* login, logout, or token refresh event, an audit log entry should be created.
**Validates: Requirements 12.1**

**Property 70: Role change logging**
*For any* user role modification, an audit log entry should be created.
**Validates: Requirements 12.2**

**Property 71: Entity modification logging**
*For any* create, update, or delete operation on entities, an audit log entry should be created.
**Validates: Requirements 12.3**

**Property 72: Audit log completeness**
*For any* audit log entry, it should contain action type, entity type, entity ID, and timestamp, with user ID included when available (nullable for pre-authentication events).
**Validates: Requirements 12.4, 12.4a, 12.4b**

**Property 73: Audit log detail format**
*For any* audit log entry, additional details should be stored as valid JSON.
**Validates: Requirements 12.5**

**Property 74: Audit log access restriction**
*For any* request to access audit logs, only users with ADMINISTRATOR role should be able to retrieve them.
**Validates: Requirements 12.6**

### Error Handling Properties

**Property 75: Consistent error format**
*For any* error response, it should include code, message, and details fields in a consistent structure.
**Validates: Requirements 13.1**

**Property 76: Validation error status code**
*For any* request with invalid input data, the API should return 400 Bad Request.
**Validates: Requirements 13.2**

**Property 77: Authentication error status code**
*For any* request with missing or invalid authentication, the API should return 401 Unauthorized.
**Validates: Requirements 13.3**

**Property 78: Authorization error status code**
*For any* request with insufficient permissions, the API should return 403 Forbidden.
**Validates: Requirements 13.4**

**Property 79: Not found error status code**
*For any* request for a non-existent resource, the API should return 404 Not Found.
**Validates: Requirements 13.5**

**Property 80: Internal error status code**
*For any* unexpected server error, the API should return 500 Internal Server Error.
**Validates: Requirements 13.6**

**Property 81: Error logging with stack traces**
*For any* error, the API should log it with a stack trace for debugging purposes.
**Validates: Requirements 13.7**

### Documentation Properties

**Property 82: OpenAPI specification completeness**
*For any* API endpoint, it should be documented in the OpenAPI specification with request and response schemas.
**Validates: Requirements 14.3**

**Property 83: Example documentation**
*For any* API endpoint, the OpenAPI specification should include example requests and responses.
**Validates: Requirements 14.4**

**Property 84: Error response documentation**
*For any* API endpoint, all possible error responses should be documented in the OpenAPI specification.
**Validates: Requirements 14.5**

### Input Validation Properties

**Property 85: Request body validation**
*For any* request with a body, the API should validate it against the defined Zod schema and reject invalid data with 400.
**Validates: Requirements 15.1**

**Property 86: Parameter validation**
*For any* request with query or path parameters, the API should validate them and reject invalid values with 400.
**Validates: Requirements 15.2**

**Property 87: Detailed validation errors**
*For any* validation failure, the error response should include specific details about which fields failed validation and why.
**Validates: Requirements 15.3**

**Property 88: Input sanitization**
*For any* user input, the API should sanitize it to prevent SQL injection, XSS, and other injection attacks.
**Validates: Requirements 15.5**

### Venue Management Properties

**Property 89: Venue creation with geographic area**
*For any* valid venue with name, address, and existing geographic area ID, creating it via POST should result in the venue being retrievable with the correct geographic area association.
**Validates: Requirements 5A.3, 5A.7, 5A.8**

**Property 90: Venue geographic area validation**
*For any* venue creation or update with a non-existent geographic area ID, the API should reject it with a 400 error.
**Validates: Requirements 5A.8**

**Property 91: Venue optional fields**
*For any* venue creation with or without optional latitude, longitude, and venue type fields, the API should accept it and persist the provided values.
**Validates: Requirements 5A.9**

**Property 92: Venue deletion prevention**
*For any* venue referenced by activities or participants, attempting to delete it should be rejected with a 400 error explaining which entities reference it.
**Validates: Requirements 5A.10, 5A.11**

**Property 93: Venue search accuracy**
*For any* search query, all returned venues should have names or addresses that match the query string (case-insensitive).
**Validates: Requirements 5A.6**

**Property 94: Venue activities retrieval**
*For any* venue, retrieving its activities should return all activities currently or historically associated with that venue.
**Validates: Requirements 5A.12**

**Property 95: Venue participants retrieval**
*For any* venue, retrieving its participants should return only participants whose most recent address history record is at this venue (current residents only, not historical).
**Validates: Requirements 5A.13, 5A.14**

### Geographic Area Management Properties

**Property 96: Geographic area creation**
*For any* valid geographic area with name and area type, creating it via POST should result in the geographic area being retrievable.
**Validates: Requirements 5B.3, 5B.6**

**Property 97: Geographic area parent validation**
*For any* geographic area creation with a non-existent parent geographic area ID, the API should reject it with a 400 error.
**Validates: Requirements 5B.8**

**Property 98: Circular relationship prevention**
*For any* geographic area, attempting to set its parent to itself or to one of its descendants should be rejected with a 400 error.
**Validates: Requirements 5B.9**

**Property 99: Geographic area type validation**
*For any* geographic area, the area type should be one of: NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, or WORLD.
**Validates: Requirements 5B.10**

**Property 100: Geographic area deletion prevention**
*For any* geographic area referenced by venues or child geographic areas, attempting to delete it should be rejected with a 400 error.
**Validates: Requirements 5B.11**

**Property 101: Geographic area children retrieval**
*For any* geographic area, retrieving its children should return all geographic areas that have it as their parent.
**Validates: Requirements 5B.12**

**Property 102: Geographic area ancestors retrieval**
*For any* geographic area, retrieving its ancestors should return the complete hierarchy path from the area to the root, ordered from child to root.
**Validates: Requirements 5B.13**

**Property 103: Geographic area venues retrieval**
*For any* geographic area, retrieving its venues should return all venues in that geographic area and all descendant areas (recursive aggregation).
**Validates: Requirements 5B.14**

**Property 104: Geographic area statistics calculation**
*For any* geographic area, the statistics should include activity and participant counts for the area and all its descendants.
**Validates: Requirements 5B.15**

### Participant Address History Properties

**Property 105: Address history creation on venue update**
*For any* participant whose home venue is updated, a new ParticipantAddressHistory record should be created with the new venue and current timestamp as effectiveFrom.
**Validates: Requirements 3.11**

**Property 106: Address history retrieval**
*For any* participant, retrieving their address history should return all ParticipantAddressHistory records ordered by effectiveFrom descending (most recent first).
**Validates: Requirements 3.12**

**Property 107: Current address identification**
*For any* participant with address history, the current address should be the record with the most recent non-null effectiveFrom date, or the record with null effectiveFrom if no non-null records exist.
**Validates: Requirements 3.11**

**Property 108: Address history duplicate prevention**
*For any* participant, attempting to create an address history record with the same effectiveFrom date (including null) as an existing record should be rejected with a 400 error.
**Validates: Requirements 3.20**

**Property 108A: Address history null effectiveFrom uniqueness**
*For any* participant, attempting to create a second address history record with a null effectiveFrom date when one already exists should be rejected with a 400 error.
**Validates: Requirements 3.18, 3.19**

**Property 108B: Address history null effectiveFrom interpretation**
*For any* participant address history record with a null effectiveFrom date, the system should treat it as the oldest home address for that participant.
**Validates: Requirements 3.18**

### Activity Venue Association Properties

**Property 109: Activity venue association creation**
*For any* activity and valid venue ID, associating the venue via POST should result in an ActivityVenueHistory record being created with the current timestamp as effectiveFrom.
**Validates: Requirements 4.11, 4.13**

**Property 110: Activity venue history retrieval**
*For any* activity, retrieving its venues should return all ActivityVenueHistory records ordered by effectiveFrom descending (most recent first).
**Validates: Requirements 4.12, 4.15**

**Property 111: Current venue identification**
*For any* activity with venue history, the current venue should be the record with the most recent non-null effectiveFrom date, or the record with null effectiveFrom if no non-null records exist.
**Validates: Requirements 4.11**

**Property 112: Activity venue duplicate prevention**
*For any* activity, attempting to create a venue association with the same effectiveFrom date (including null) as an existing record should be rejected with a 400 error.
**Validates: Requirements 4.19**

**Property 112A: Activity venue null effectiveFrom uniqueness**
*For any* activity, attempting to create a second venue association with a null effectiveFrom date when one already exists should be rejected with a 400 error.
**Validates: Requirements 4.17, 4.18**

**Property 112B: Activity venue null effectiveFrom interpretation**
*For any* activity venue association with a null effectiveFrom date, the system should treat the venue association start date as the same as the activity start date.
**Validates: Requirements 4.17**

### Geographic Analytics Properties

**Property 113: Geographic area filtering for engagement**
*For any* engagement metrics request with a geographic area filter, only activities and participants associated with venues in that geographic area or its descendants should be included.
**Validates: Requirements 6.21**

**Property 114: Geographic breakdown calculation**
*For any* geographic analytics request, engagement metrics should be correctly grouped and aggregated by geographic area.
**Validates: Requirements 6.9**

**Property 115: Geographic area filtering for growth**
*For any* growth metrics request with a geographic area filter, only activities and participants associated with venues in that geographic area or its descendants should be included.
**Validates: Requirements 7.7, 7.8**

**Property 116: Hierarchical statistics aggregation**
*For any* geographic area, statistics should include data from all descendant geographic areas in the hierarchy.
**Validates: Requirements 5B.15**

**Property 116A: Analytics null effectiveFrom handling for activities**
*For any* activity with a null effectiveFrom date in its venue history, analytics queries should treat the venue association start date as the activity's startDate.
**Validates: Requirements 6.26, 6.28**

**Property 116B: Analytics null effectiveFrom handling for participants**
*For any* participant with a null effectiveFrom date in their address history, analytics queries should treat it as the oldest home address (earlier than any non-null date).
**Validates: Requirements 6.27, 6.29**

**Property 116C: Current venue determination with null dates**
*For any* activity or participant with venue/address history containing null effectiveFrom dates, the system should correctly identify the current venue/address by treating null dates according to their semantic meaning.
**Validates: Requirements 6.26, 6.27, 6.28, 6.29**

### Pagination Properties

**Property 117: Page parameter validation**
*For any* paginated list request with an invalid page number (less than 1), the API should reject it with a 400 error.
**Validates: Requirements 17.5**

**Property 118: Limit parameter validation**
*For any* paginated list request with a limit greater than 100, the API should reject it with a 400 error.
**Validates: Requirements 17.7**

**Property 119: Pagination metadata accuracy**
*For any* paginated list response, the pagination metadata should correctly reflect the total count, current page, limit, and total pages.
**Validates: Requirements 17.8**

**Property 120: Pagination data consistency**
*For any* paginated list request, the returned data should contain exactly the items for the requested page based on the limit.
**Validates: Requirements 17.9**

### Optimistic Locking Properties

**Property 121: Version field inclusion**
*For any* entity response (Activity, Participant, Venue, GeographicArea, ActivityType, Role), it should include a version field.
**Validates: Requirements 18.1**

**Property 122: Version mismatch rejection**
*For any* update request with a version that doesn't match the current entity version, the API should return 409 Conflict.
**Validates: Requirements 18.2, 18.3**

**Property 123: Version increment on update**
*For any* successful update operation, the entity's version number should be incremented by 1.
**Validates: Requirements 18.4**

### Rate Limiting Properties

**Property 124: Authentication rate limit enforcement**
*For any* IP address making more than 5 authentication requests per minute, the API should return 429 Too Many Requests.
**Validates: Requirements 19.1**

**Property 125: Mutation rate limit enforcement**
*For any* authenticated user making more than 100 mutation requests per minute, the API should return 429 Too Many Requests.
**Validates: Requirements 19.2**

**Property 126: Query rate limit enforcement**
*For any* authenticated user making more than 1000 query requests per minute, the API should return 429 Too Many Requests.
**Validates: Requirements 19.3**

**Property 127: Rate limit header inclusion**
*For any* API response, it should include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.
**Validates: Requirements 19.5**

### API Versioning Properties

**Property 128: Version path inclusion**
*For any* API endpoint, it should be accessible via the /api/v1/... path.
**Validates: Requirements 20.1**

**Property 129: Backward compatibility within version**
*For any* endpoint within the same major version, changes should maintain backward compatibility.
**Validates: Requirements 20.2**

### Global Geographic Area Filter Properties

**Property 130: Participant geographic filtering**
*For any* participant list request with a geographic area filter, only participants whose current home venue is in the specified geographic area or its descendants should be returned.
**Validates: Requirements 3.19**

**Property 131: Activity geographic filtering**
*For any* activity list request with a geographic area filter, only activities whose current venue is in the specified geographic area or its descendants should be returned.
**Validates: Requirements 4.17**

**Property 132: Venue geographic filtering**
*For any* venue list request with a geographic area filter, only venues in the specified geographic area or its descendants should be returned.
**Validates: Requirements 5A.14**

**Property 133: Geographic area hierarchy filtering**
*For any* geographic area list request with a geographic area filter, the response should include the specified area, all its descendants, and all its ancestors to maintain hierarchy context.
**Validates: Requirements 5B.16**
*For any* valid geographic area with name and area type, creating it via POST should result in the geographic area being retrievable.
**Validates: Requirements 5B.3, 5B.6**

**Property 81: Geographic area parent validation**
*For any* geographic area creation with a non-existent parent geographic area ID, the API should reject it with a 400 error.
**Validates: Requirements 5B.8**

**Property 82: Circular relationship prevention**
*For any* geographic area, attempting to set its parent to itself or to one of its descendants should be rejected with a 400 error.
**Validates: Requirements 5B.9**

**Property 83: Geographic area type validation**
*For any* geographic area, the area type should be one of: NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, or WORLD.
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
*For any* geographic area, retrieving its venues should return all venues in that geographic area and all descendant areas (recursive aggregation).
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
*For any* participant with address history, the current address should be the record with the most recent non-null effectiveFrom date, or the record with null effectiveFrom if no non-null records exist.
**Validates: Requirements 3.11**

**Property 92: Address history duplicate prevention**
*For any* participant, attempting to create an address history record with the same effectiveFrom date (including null) as an existing record should be rejected with a 400 error.
**Validates: Requirements 3.20**

**Property 92A: Address history null effectiveFrom uniqueness**
*For any* participant, attempting to create a second address history record with a null effectiveFrom date when one already exists should be rejected with a 400 error.
**Validates: Requirements 3.18, 3.19**

**Property 92B: Address history null effectiveFrom interpretation**
*For any* participant address history record with a null effectiveFrom date, the system should treat it as the oldest home address for that participant.
**Validates: Requirements 3.18**

### Activity Venue Association Properties

**Property 93: Activity venue association creation**
*For any* activity and valid venue ID, associating the venue via POST should result in an ActivityVenueHistory record being created with the current timestamp as effectiveFrom.
**Validates: Requirements 4.11, 4.13**

**Property 94: Activity venue history retrieval**
*For any* activity, retrieving its venues should return all ActivityVenueHistory records ordered by effectiveFrom descending (most recent first).
**Validates: Requirements 4.12, 4.15**

**Property 95: Current venue identification**
*For any* activity with venue history, the current venue should be the record with the most recent non-null effectiveFrom date, or the record with null effectiveFrom if no non-null records exist.
**Validates: Requirements 4.11**

**Property 96: Activity venue duplicate prevention**
*For any* activity, attempting to create a venue association with the same effectiveFrom date (including null) as an existing record should be rejected with a 400 error.
**Validates: Requirements 4.19**

**Property 96A: Activity venue null effectiveFrom uniqueness**
*For any* activity, attempting to create a second venue association with a null effectiveFrom date when one already exists should be rejected with a 400 error.
**Validates: Requirements 4.17, 4.18**

**Property 96B: Activity venue null effectiveFrom interpretation**
*For any* activity venue association with a null effectiveFrom date, the system should treat the venue association start date as the same as the activity start date.
**Validates: Requirements 4.17**

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

### Global Geographic Area Filter Properties

**Property 114: Participant geographic filtering**
*For any* participant list request with a geographic area filter, only participants whose current home venue is in the specified geographic area or its descendants should be returned.
**Validates: Requirements 3.19**

**Property 115: Activity geographic filtering**
*For any* activity list request with a geographic area filter, only activities whose current venue is in the specified geographic area or its descendants should be returned.
**Validates: Requirements 4.17**

**Property 116: Venue geographic filtering**
*For any* venue list request with a geographic area filter, only venues in the specified geographic area or its descendants should be returned.
**Validates: Requirements 5A.14**

**Property 117: Geographic area hierarchy filtering**
*For any* geographic area list request with a geographic area filter, the response should include the specified area, all its descendants, and all its ancestors to maintain hierarchy context.
**Validates: Requirements 5B.16**

### High-Cardinality Filtering Properties

**Property 118: Venue text search filtering**
*For any* venue list request with a search query parameter, only venues whose name or address contains the search text (case-insensitive) should be returned.
**Validates: Requirements 21.1, 21.4**

**Property 119: Participant text search filtering**
*For any* participant list request with a search query parameter, only participants whose name or email contains the search text (case-insensitive) should be returned.
**Validates: Requirements 21.2, 21.5**

**Property 120: Geographic area text search filtering**
*For any* geographic area list request with a search query parameter, only geographic areas whose name contains the search text (case-insensitive) should be returned.
**Validates: Requirements 21.3, 21.6**

**Property 121: Combined search and geographic filtering**
*For any* list request with both search and geographicAreaId query parameters, both filters should be applied using AND logic.
**Validates: Requirements 21.7**

**Property 122: Filtered result pagination**
*For any* filtered list request with page and limit parameters, the response should include correctly paginated results and accurate pagination metadata.
**Validates: Requirements 21.8, 21.9**

**Property 123: Search query optimization**
*For any* text-based search query on indexed fields (name, address, email), the database query should use appropriate indexes for efficient execution.
**Validates: Requirements 21.10**

### Activity Lifecycle Query Parameter Normalization Properties

**Property 148: Single geographic area ID normalization**
*For any* single geographic area ID provided as a query parameter, the API should parse it as an array with one element and correctly filter activities.
**Validates: Requirements 6A.24, 6A.13**

**Property 149: Multiple geographic area IDs preservation**
*For any* multiple geographic area IDs provided as query parameters, the API should parse them as an array and correctly filter activities.
**Validates: Requirements 6A.25, 6A.13**

**Property 150: Comma-separated geographic area IDs splitting**
*For any* comma-separated geographic area IDs provided as a query parameter, the API should parse them as separate array elements and correctly filter activities.
**Validates: Requirements 6A.26, 6A.13**

**Property 151: Empty geographic area result handling**
*For any* geographic area filter where no venues exist in those areas, the API should return an empty array.
**Validates: Requirements 6A.29, 6A.21**

**Property 152: Geographic area UUID validation**
*For any* invalid UUID provided in geographicAreaIds parameter, the API should return 400 Bad Request with a descriptive error message.
**Validates: Requirements 6A.30, 6A.31**

**Property 153: Activity lifecycle groupBy validation**
*For any* groupBy parameter value other than 'category' or 'type', the API should return 400 Bad Request.
**Validates: Requirements 6A.3, 6A.22**

**Property 154: Activity lifecycle date validation**
*For any* invalid ISO 8601 datetime string provided for startDate or endDate, the API should return 400 Bad Request.
**Validates: Requirements 6A.2, 6A.22**

### Geographic Authorization Properties

**Property 155: Authorization rule creation**
*For any* valid user ID, geographic area ID, and rule type (ALLOW or DENY), creating an authorization rule via POST should result in the rule being retrievable via GET.
**Validates: Requirements 24.2, 24.5, 24.6**

**Property 156: Duplicate authorization rule prevention**
*For any* user and geographic area combination, attempting to create a second authorization rule should be rejected with a 400 error.
**Validates: Requirements 24.7**

**Property 157: Deny rule precedence**
*For any* user with both ALLOW and DENY rules for overlapping geographic areas, the DENY rule should take precedence and deny access.
**Validates: Requirements 24.9, 24.10**

**Property 158: Descendant access from allow rule**
*For any* user with an ALLOW rule for a geographic area, the user should have full access to that area and all its descendant areas.
**Validates: Requirements 24.11, 24.37**

**Property 159: Ancestor read-only access from allow rule**
*For any* user with an ALLOW rule for a geographic area, the user should have read-only access to all ancestor areas.
**Validates: Requirements 24.12, 24.38**

**Property 160: Unrestricted access with no rules**
*For any* user with no geographic authorization rules, the user should have access to all geographic areas.
**Validates: Requirements 24.13**

**Property 161: Restricted access with rules**
*For any* user with at least one geographic authorization rule, the user should only have access to explicitly authorized areas (and their descendants/ancestors).
**Validates: Requirements 24.14**

**Property 162: Implicit filtering on list endpoints**
*For any* list endpoint request without an explicit geographicAreaId parameter from a user with geographic restrictions, the API should implicitly filter results to only authorized geographic areas.
**Validates: Requirements 24.23**

**Property 163: Explicit filter authorization validation**
*For any* list endpoint request with an explicit geographicAreaId parameter, the API should validate that the user is authorized to access that geographic area and return 403 if not.
**Validates: Requirements 24.24, 24.25**

**Property 164: Venue creation authorization**
*For any* venue creation request, the API should validate that the user is authorized to access the venue's geographic area and return 403 if not.
**Validates: Requirements 24.28**

**Property 165: Activity creation authorization**
*For any* activity creation request with a venue, the API should validate that the user is authorized to access the venue's geographic area and return 403 if not.
**Validates: Requirements 24.29**

**Property 166: Geographic area creation authorization**
*For any* geographic area creation request from a user with geographic restrictions, the API should validate that the parent area is within authorized areas and return 403 if not.
**Validates: Requirements 24.26**

**Property 167: Top-level area creation restriction**
*For any* geographic area creation request without a parent from a user with geographic restrictions, the API should return 403 Forbidden.
**Validates: Requirements 24.27**

**Property 168: Authorization filtering on analytics**
*For any* analytics endpoint request from a user with geographic restrictions, the API should filter results to only include data from authorized geographic areas.
**Validates: Requirements 24.19, 24.20, 24.21**

**Property 169: Authorization filtering on exports**
*For any* export endpoint request from a user with geographic restrictions, the API should export only data from authorized geographic areas.
**Validates: Requirements 24.22**

**Property 170: JWT token includes authorized areas**
*For any* JWT token generated for a user with geographic authorization rules, the token payload should include the authorized area IDs.
**Validates: Requirements 24.33, 24.34, 24.35**

**Property 171: Authorization management admin restriction**
*For any* geographic authorization management endpoint request from a non-administrator, the API should return 403 Forbidden.
**Validates: Requirements 24.31, 24.32**

**Property 172: Authorization rule audit logging**
*For any* geographic authorization rule creation or deletion, an audit log entry should be created.
**Validates: Requirements 24.39**

### Individual Resource Access Authorization Properties

**Property 173: Participant detail access authorization**
*For any* GET /api/v1/participants/:id request, the API should determine the participant's current home venue from their most recent address history record, validate that the venue's geographic area is within the user's authorized areas, and return 403 Forbidden with GEOGRAPHIC_AUTHORIZATION_DENIED if not authorized.
**Validates: Requirements 25.1, 25.5, 25.6, 25.7**

**Property 174: Activity detail access authorization**
*For any* GET /api/v1/activities/:id request, the API should determine the activity's current venue from its most recent venue history record, validate that the venue's geographic area is within the user's authorized areas, and return 403 Forbidden with GEOGRAPHIC_AUTHORIZATION_DENIED if not authorized.
**Validates: Requirements 25.2, 25.8, 25.9, 25.10**

**Property 175: Venue detail access authorization**
*For any* GET /api/v1/venues/:id request, the API should validate that the venue's geographic area is within the user's authorized areas and return 403 Forbidden with GEOGRAPHIC_AUTHORIZATION_DENIED if not authorized.
**Validates: Requirements 25.3, 25.11, 25.12**

**Property 176: Geographic area detail access authorization**
*For any* GET /api/v1/geographic-areas/:id request, the API should validate that the geographic area is within the user's authorized areas (including read-only access to ancestors) and return 403 Forbidden with GEOGRAPHIC_AUTHORIZATION_DENIED if not authorized.
**Validates: Requirements 25.4, 25.13, 25.14**

**Property 177: Participant update authorization**
*For any* PUT /api/v1/participants/:id request, the API should validate that the participant's current home venue's geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.15, 25.23**

**Property 178: Activity update authorization**
*For any* PUT /api/v1/activities/:id request, the API should validate that the activity's current venue's geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.16, 25.24**

**Property 179: Venue update authorization**
*For any* PUT /api/v1/venues/:id request, the API should validate that the venue's geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.17, 25.25**

**Property 180: Geographic area update authorization**
*For any* PUT /api/v1/geographic-areas/:id request, the API should validate that the geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.18, 25.26**

**Property 181: Participant deletion authorization**
*For any* DELETE /api/v1/participants/:id request, the API should validate that the participant's current home venue's geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.19, 25.27**

**Property 182: Activity deletion authorization**
*For any* DELETE /api/v1/activities/:id request, the API should validate that the activity's current venue's geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.20, 25.28**

**Property 183: Venue deletion authorization**
*For any* DELETE /api/v1/venues/:id request, the API should validate that the venue's geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.21, 25.29**

**Property 184: Geographic area deletion authorization**
*For any* DELETE /api/v1/geographic-areas/:id request, the API should validate that the geographic area is within the user's authorized areas and return 403 Forbidden if not authorized.
**Validates: Requirements 25.22, 25.30**

**Property 185: Nested resource access authorization**
*For any* nested resource endpoint (participants/:id/activities, activities/:id/participants, venues/:id/activities, etc.), the API should enforce geographic authorization on the parent resource before returning nested data.
**Validates: Requirements 25.31, 25.32, 25.33, 25.34, 25.35, 25.36, 25.37, 25.38, 25.39, 25.40, 25.41**

**Property 186: Unrestricted user bypass**
*For any* user with no geographic authorization rules, all individual resource access requests should be allowed without geographic authorization checks.
**Validates: Requirements 25.42**

**Property 187: Administrator authorization bypass**
*For any* user with ADMINISTRATOR role, all individual resource access requests should bypass geographic authorization checks for administrative operations.
**Validates: Requirements 25.43**

**Property 188: Authorization denial audit logging**
*For any* geographic authorization denial on individual resource access, an audit log entry should be created with user ID, resource type, resource ID, and attempted action.
**Validates: Requirements 25.45**

**Property 189: Consistent authorization across access patterns**
*For any* resource accessible through multiple endpoints (direct access, nested resources, related entities), geographic authorization should be applied consistently across all access patterns.
**Validates: Requirements 25.44**

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
- **403 Forbidden**: Insufficient permissions for the requested operation, geographic authorization denied
- **404 Not Found**: Resource does not exist
- **500 Internal Server Error**: Unexpected errors, database failures

**Error Codes:**
- `GEOGRAPHIC_AUTHORIZATION_DENIED`: User lacks authorization to access the requested geographic area
- `CANNOT_CREATE_TOP_LEVEL_AREA`: User with geographic restrictions cannot create top-level geographic areas

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

## High-Cardinality Filtering Implementation

### Text-Based Search Support

To support efficient dropdown filtering for high-cardinality entities (venues, participants, geographic areas), all list endpoints accept an optional `search` query parameter that performs case-insensitive partial text matching.

**Query Parameter Pattern:**
```
GET /api/v1/participants?search=john&geographicAreaId=abc123&page=1&limit=50
GET /api/v1/venues?search=community&geographicAreaId=abc123&page=1&limit=50
GET /api/v1/geographic-areas?search=downtown&page=1&limit=50
```

**Implementation Pattern for Services:**

```typescript
async getEntities(
  page?: number, 
  limit?: number, 
  geographicAreaId?: string,
  search?: string
) {
  // Build geographic area filter
  let areaIds: string[] | undefined;
  if (geographicAreaId) {
    const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
    areaIds = [geographicAreaId, ...descendantIds];
  }
  
  // Build search filter
  const searchFilter = search ? this.buildSearchFilter(search) : {};
  
  // Combine filters
  const where = {
    ...this.buildGeographicFilter(areaIds),
    ...searchFilter
  };
  
  return this.repository.findMany({ where, page, limit });
}
```

**Entity-Specific Search Filters:**

**Participants:** Search by name or email
```typescript
const searchFilter = search ? {
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } }
  ]
} : {};
```

**Venues:** Search by name or address
```typescript
const searchFilter = search ? {
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { address: { contains: search, mode: 'insensitive' } }
  ]
} : {};
```

**Geographic Areas:** Search by name
```typescript
const searchFilter = search ? {
  name: { contains: search, mode: 'insensitive' }
} : {};
```

**Database Optimization:**

To ensure efficient text-based searches at scale, the following database indexes should be created:

```sql
-- Participant indexes
CREATE INDEX idx_participants_name ON participants USING gin(name gin_trgm_ops);
CREATE INDEX idx_participants_email ON participants USING gin(email gin_trgm_ops);

-- Venue indexes
CREATE INDEX idx_venues_name ON venues USING gin(name gin_trgm_ops);
CREATE INDEX idx_venues_address ON venues USING gin(address gin_trgm_ops);

-- Geographic Area indexes
CREATE INDEX idx_geographic_areas_name ON geographic_areas USING gin(name gin_trgm_ops);
```

These GIN (Generalized Inverted Index) indexes with trigram operators enable fast case-insensitive partial text matching even with millions of records.

**Key Design Points:**
- Search parameter is optional - endpoints work without it
- Search combines with geographic area filter using AND logic
- Pagination works seamlessly with filtered results
- Uses Prisma's `contains` with `mode: 'insensitive'` for case-insensitive matching
- Database indexes ensure sub-second query performance at scale
- No breaking changes to existing API contract

## Query Parameter Array Normalization

### Problem Statement

Express.js parses query parameters inconsistently for array values:
- Single value: `?geographicAreaIds=abc123` → parsed as `string`
- Multiple values: `?geographicAreaIds=abc123&geographicAreaIds=def456` → parsed as `string[]`

This inconsistency caused a defect in the activity lifecycle endpoint where single geographic area IDs were treated as strings, causing the `.map()` operation to iterate over characters instead of treating it as a single ID.

### Solution: Zod Preprocess

The solution uses Zod's `preprocess` function to normalize query parameters before validation:

```typescript
export const ActivityLifecycleQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['category', 'type']),
  geographicAreaIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        // Flatten any comma-separated values
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      // Single string - split by comma
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid()).optional()
  ),
  // ... same pattern for activityCategoryIds, activityTypeIds, venueIds
});
```

### Normalization Behavior

The preprocess function handles all common query parameter formats:

| Input Format | Example | Normalized Output |
|--------------|---------|-------------------|
| Single value | `?ids=abc123` | `['abc123']` |
| Multiple values | `?ids=abc123&ids=def456` | `['abc123', 'def456']` |
| Comma-separated | `?ids=abc123,def456` | `['abc123', 'def456']` |
| Mixed | `?ids=abc123&ids=def456,ghi789` | `['abc123', 'def456', 'ghi789']` |
| Empty string | `?ids=` | `undefined` |
| Whitespace only | `?ids=  ` | `undefined` |
| Undefined | (no parameter) | `undefined` |

### Empty Result Handling

A second issue was discovered: when a geographic area filter is specified but the area has no venues, the original code would skip the filter entirely and return all activities. The fix adds an early return:

```typescript
// In getActivityLifecycleEvents method
if (geographicAreaIds && geographicAreaIds.length > 0) {
    const venueIdsForAreas = await Promise.all(
        geographicAreaIds.map(areaId => this.getVenueIdsForArea(areaId))
    );
    effectiveVenueIds = venueIdsForAreas.flat();
    
    // If geographic filter is specified but no venues exist in those areas,
    // return empty result immediately
    if (effectiveVenueIds.length === 0) {
        return [];
    }
}
```

### Benefits

- **Backward Compatible**: Existing clients continue to work without changes
- **Flexible**: Supports multiple input formats (single, multiple, comma-separated)
- **Type Safe**: Zod validates UUIDs after normalization
- **Consistent**: Same pattern can be applied to other array query parameters
- **Secure**: Trims whitespace and validates UUIDs to prevent injection attacks

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


## CSV Import and Export

### Overview

The API provides CSV import and export functionality for bulk data operations on Participants, Venues, Activities, and Geographic Areas. This enables community organizers to:
- Bulk load data from external sources (spreadsheets, other systems)
- Share data with stakeholders who prefer spreadsheet formats
- Backup and restore data in a human-readable format
- Understand the required data structure through empty CSV templates

### Export Endpoints

**Endpoint Pattern:**
```
GET /api/v1/participants/export
GET /api/v1/venues/export
GET /api/v1/activities/export
GET /api/v1/geographic-areas/export
```

**Query Parameters:**
- `geographicAreaId` (optional): Filter exports to specific geographic area and descendants

**Response Headers:**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="participants-2025-01-15.csv"
```

**CSV Column Definitions:**

**Participants Export:**
```csv
id,name,email,phone,notes,dateOfBirth,dateOfRegistration,nickname,createdAt,updatedAt
```

**Venues Export:**
```csv
id,name,address,geographicAreaId,geographicAreaName,latitude,longitude,venueType,createdAt,updatedAt
```

**Activities Export:**
```csv
id,name,activityTypeId,activityTypeName,activityCategoryId,activityCategoryName,startDate,endDate,status,createdAt,updatedAt
```

**Geographic Areas Export:**
```csv
id,name,areaType,parentGeographicAreaId,parentGeographicAreaName,createdAt,updatedAt
```

**Empty CSV Behavior:**
When no records exist, the API returns a CSV file with only the header row. This helps users understand the required column structure for imports.

### Import Endpoints

**Endpoint Pattern:**
```
POST /api/v1/participants/import
POST /api/v1/venues/import
POST /api/v1/activities/import
POST /api/v1/geographic-areas/import
```

**Request Format:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- File type: `.csv`
- Maximum size: 10MB

**CSV Column Requirements:**

**Participants Import:**
```csv
name,email,phone,notes,dateOfBirth,dateOfRegistration,nickname
```
Optional: Include `id` column to update existing records

**Venues Import:**
```csv
name,address,geographicAreaId,latitude,longitude,venueType
```
Optional: Include `id` column to update existing records

**Activities Import:**
```csv
name,activityTypeId,startDate,endDate,status
```
Optional: Include `id` column to update existing records

**Geographic Areas Import:**
```csv
name,areaType,parentGeographicAreaId
```
Optional: Include `id` column to update existing records

**Import Behavior:**
- **With ID column**: Rows with existing IDs are treated as updates; rows without IDs are creates
- **Without ID column**: All rows are treated as creates
- **Validation**: Each row is validated using the same rules as POST/PUT endpoints
- **Error Handling**: Invalid rows are skipped; processing continues for remaining rows
- **Transaction**: All successful operations are committed together; failed rows don't affect successful ones

**Response Format:**
```typescript
{
  success: true,
  data: {
    totalRows: number,
    successCount: number,
    failureCount: number,
    errors: Array<{
      row: number,
      data: object,
      errors: string[]
    }>
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalRows": 100,
    "successCount": 95,
    "failureCount": 5,
    "errors": [
      {
        "row": 12,
        "data": { "name": "", "email": "invalid" },
        "errors": ["Name is required", "Invalid email format"]
      },
      {
        "row": 45,
        "data": { "name": "John Doe", "geographicAreaId": "invalid-uuid" },
        "errors": ["Geographic area not found"]
      }
    ]
  }
}
```

### CSV Parsing

**Library**: Use `csv-parse` (Node.js CSV parsing library) for robust CSV handling

**Features:**
- Handles quoted fields with embedded commas
- Handles escaped characters
- Supports different line endings (CRLF, LF)
- Supports both comma and semicolon delimiters
- Automatic header detection
- Stream-based parsing for large files

**Configuration:**
```typescript
import { parse } from 'csv-parse';

const parser = parse({
  columns: true,              // Use first row as column names
  skip_empty_lines: true,     // Ignore empty lines
  trim: true,                 // Trim whitespace from fields
  delimiter: [',', ';'],      // Support both delimiters
  relax_column_count: true,   // Allow variable column counts
  cast: true,                 // Auto-cast types
  cast_date: true             // Parse dates
});
```

### CSV Generation

**Library**: Use `csv-stringify` (Node.js CSV generation library) for consistent formatting

**Features:**
- Proper quoting of fields containing special characters
- Consistent delimiter usage
- UTF-8 encoding
- Stream-based generation for large datasets

**Configuration:**
```typescript
import { stringify } from 'csv-stringify';

const stringifier = stringify({
  header: true,               // Include header row
  quoted: true,               // Quote all fields
  delimiter: ',',             // Use comma delimiter
  record_delimiter: '\n'      // Use LF line endings
});
```

### Service Layer Implementation

**Export Service Pattern:**
```typescript
async exportParticipants(geographicAreaId?: string): Promise<string> {
  // Apply geographic filter if provided
  const participants = await this.participantRepository.findAll({
    geographicAreaId
  });
  
  // Transform to CSV format
  const records = participants.map(p => ({
    id: p.id,
    name: p.name,
    email: p.email || '',
    phone: p.phone || '',
    notes: p.notes || '',
    dateOfBirth: p.dateOfBirth ? formatDate(p.dateOfBirth) : '',
    dateOfRegistration: p.dateOfRegistration ? formatDate(p.dateOfRegistration) : '',
    nickname: p.nickname || '',
    createdAt: formatDate(p.createdAt),
    updatedAt: formatDate(p.updatedAt)
  }));
  
  // Generate CSV
  return stringify(records, { header: true });
}
```

**Import Service Pattern:**
```typescript
async importParticipants(fileBuffer: Buffer): Promise<ImportResult> {
  const records = await this.parseCSV(fileBuffer);
  const results = {
    totalRows: records.length,
    successCount: 0,
    failureCount: 0,
    errors: []
  };
  
  for (const [index, record] of records.entries()) {
    try {
      // Validate record
      const validated = ParticipantImportSchema.parse(record);
      
      // Create or update
      if (record.id) {
        await this.participantRepository.update(record.id, validated);
      } else {
        await this.participantRepository.create(validated);
      }
      
      results.successCount++;
    } catch (error) {
      results.failureCount++;
      results.errors.push({
        row: index + 2, // +2 for header row and 0-based index
        data: record,
        errors: this.extractValidationErrors(error)
      });
    }
  }
  
  return results;
}
```

### Route Handler Implementation

**Export Route:**
```typescript
router.get('/participants/export', 
  authenticate,
  authorize(['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']),
  async (req, res) => {
    const { geographicAreaId } = req.query;
    
    const csv = await participantService.exportParticipants(geographicAreaId);
    const filename = `participants-${formatDate(new Date())}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
);
```

**Import Route:**
```typescript
router.post('/participants/import',
  authenticate,
  authorize(['ADMINISTRATOR', 'EDITOR']),
  upload.single('file'),
  async (req, res) => {
    // Validate file
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({ error: 'File must be a CSV' });
    }
    
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 10MB)' });
    }
    
    // Process import
    const result = await participantService.importParticipants(req.file.buffer);
    
    res.json({
      success: true,
      data: result
    });
  }
);
```

### File Upload Middleware

**Library**: Use `multer` for handling multipart/form-data uploads

**Configuration:**
```typescript
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for processing
  limits: {
    fileSize: 10 * 1024 * 1024,    // 10MB limit
    files: 1                        // Single file only
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});
```

### Validation Schemas

**Import Validation Schemas:**
```typescript
const ParticipantImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
  dateOfBirth: z.coerce.date().optional().or(z.literal('')),
  dateOfRegistration: z.coerce.date().optional().or(z.literal('')),
  nickname: z.string().max(100).optional().or(z.literal(''))
});

const VenueImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  geographicAreaId: z.string().uuid(),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),
  venueType: z.enum(['PUBLIC_BUILDING', 'PRIVATE_RESIDENCE']).optional().or(z.literal(''))
});

const ActivityImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  activityTypeId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().or(z.literal('')),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional()
});

const GeographicAreaImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  areaType: z.enum(['NEIGHBOURHOOD', 'COMMUNITY', 'CITY', 'CLUSTER', 'COUNTY', 'PROVINCE', 'STATE', 'COUNTRY', 'CONTINENT', 'HEMISPHERE', 'WORLD']),
  parentGeographicAreaId: z.string().uuid().optional().or(z.literal(''))
});
```

### Error Handling

**File Upload Errors:**
- **No file**: 400 Bad Request - "No file uploaded"
- **Wrong file type**: 400 Bad Request - "File must be a CSV"
- **File too large**: 413 Payload Too Large - "File exceeds 10MB limit"
- **Invalid CSV format**: 400 Bad Request - "Invalid CSV format"

**Import Validation Errors:**
- Collected per row and returned in response
- Processing continues for valid rows
- Detailed error messages for each failed row

**Export Errors:**
- **Database errors**: 500 Internal Server Error
- **Empty result**: Returns CSV with header row only (not an error)

### Performance Considerations

**Large File Handling:**
- Stream-based parsing prevents memory issues
- Process rows incrementally rather than loading entire file
- Use database transactions for batch inserts
- Consider chunking for very large imports (>10,000 rows)

**Export Optimization:**
- Use database cursors for large result sets
- Stream CSV generation directly to response
- Apply pagination internally if needed
- Consider background job for very large exports

**Database Optimization:**
- Use bulk insert operations where possible
- Batch validation before database operations
- Use prepared statements for repeated operations
- Index foreign key columns for validation queries

### Security Considerations

**Authorization:**
- Export: Available to all authenticated users (ADMINISTRATOR, EDITOR, READ_ONLY)
- Import: Restricted to ADMINISTRATOR and EDITOR roles only

**Input Validation:**
- Validate file type and size before processing
- Sanitize all CSV data to prevent injection attacks
- Validate all foreign key references
- Apply same validation rules as API endpoints

**Data Privacy:**
- Respect geographic area filters on exports
- Audit log all import/export operations
- Include user ID in audit logs
- Consider data sensitivity in error messages

### Correctness Properties

**Property 134: CSV export completeness**
*For any* entity type with existing records, exporting to CSV should include all records (or filtered records if geographic area filter is applied) with all specified columns.
**Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8**

**Property 135: Empty CSV header generation**
*For any* entity type with no records, exporting to CSV should return a file with only the header row containing all column names.
**Validates: Requirements 22.9**

**Property 136: CSV export headers**
*For any* CSV export response, the Content-Type header should be text/csv and Content-Disposition should be attachment with an appropriate filename.
**Validates: Requirements 22.10, 22.11**

**Property 137: CSV import validation**
*For any* CSV import row, the data should be validated using the same rules as the corresponding create endpoint, and invalid rows should be skipped with detailed error messages.
**Validates: Requirements 22.20, 22.21, 22.22**

**Property 138: CSV import create/update behavior**
*For any* CSV import with an id column, rows with existing IDs should be treated as updates and rows without IDs should be treated as creates.
**Validates: Requirements 22.23, 22.24**

**Property 139: CSV file format validation**
*For any* file upload to an import endpoint, non-CSV files should be rejected with a 400 error, and files exceeding 10MB should be rejected with a 413 error.
**Validates: Requirements 22.26, 22.27, 22.28**

**Property 140: CSV delimiter support**
*For any* valid CSV file using either comma or semicolon as field delimiter, the import should parse it correctly.
**Validates: Requirements 22.30**

**Property 141: CSV export geographic filtering**
*For any* export request with a geographicAreaId parameter, only records associated with venues in the specified geographic area or its descendants should be included.
**Validates: Requirements 22.31, 22.32**

### Optional Field Clearing Properties

**Property 142: Optional field clearing for participants**
*For any* participant update request with null or empty string values for optional fields (email, phone, notes, dateOfBirth, dateOfRegistration, nickname), the API should clear those fields and subsequent GET requests should return null for them.
**Validates: Requirements 22.1, 22.5, 22.6**

**Property 143: Optional field clearing for venues**
*For any* venue update request with null or empty string values for optional fields (latitude, longitude, venueType), the API should clear those fields and subsequent GET requests should return null for them.
**Validates: Requirements 22.2, 22.5, 22.6**

**Property 144: Optional field clearing for activities**
*For any* activity update request with null value for endDate, the API should clear the endDate field (converting the activity to ongoing) and subsequent GET requests should return null for endDate.
**Validates: Requirements 22.3, 22.5, 22.6**

**Property 145: Optional field clearing for assignments**
*For any* assignment update request with null or empty string value for notes, the API should clear the notes field and subsequent GET requests should return null for notes.
**Validates: Requirements 22.4, 22.5, 22.6**

**Property 146: Field omission preserves existing values**
*For any* update request where an optional field is omitted (not present in request body), the API should preserve the existing value of that field.
**Validates: Requirements 22.7, 22.8**

**Property 147: Explicit null vs omission distinction**
*For any* update request, the API should distinguish between omitting a field (preserve existing value) and explicitly setting it to null/empty (clear the field).
**Validates: Requirements 22.7, 22.9**

