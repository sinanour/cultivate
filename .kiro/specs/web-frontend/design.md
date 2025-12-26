# Design Document: Web Frontend Package

## Overview

The Web Frontend package is a Progressive Web Application (PWA) built with React 18+, TypeScript, and Vite that provides community organizers with a responsive interface for managing activities, participants, and viewing analytics. The application uses AWS CloudScape Design System for all UI components and supports offline operation through IndexedDB and Service Workers.

The frontend communicates with the Backend API package for data persistence and authentication, while maintaining local caches for offline functionality. The design prioritizes user experience through clear navigation, comprehensive form validation, and real-time feedback during operations.

## Architecture

### Technology Stack

**Core Framework:**
- React 18+ with TypeScript for type safety and modern React features (concurrent rendering, automatic batching)
- Vite for fast development server and optimized production builds
- React Router v6 for client-side routing and navigation

**UI Components:**
- AWS CloudScape Design System exclusively for all UI elements
- Ensures consistency with AWS design patterns and accessibility standards

**State Management:**
- React Query (TanStack Query) for server state management, caching, and synchronization
- React Context API for global UI state (theme, user session, offline status)
- Local component state for form inputs and UI interactions

**Offline Support:**
- IndexedDB via Dexie.js for structured local data storage
- Service Worker for asset caching and offline detection
- Custom sync queue for pending operations during offline periods

**Build and Development:**
- Vite for module bundling and hot module replacement
- TypeScript for compile-time type checking
- ESLint and Prettier for code quality

### Application Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components (forms, tables, etc.)
│   ├── layout/         # Layout components (navigation, header, etc.)
│   └── features/       # Feature-specific components
├── pages/              # Route-level page components
├── hooks/              # Custom React hooks
├── services/           # API client and business logic
│   ├── api/           # Backend API integration
│   ├── offline/       # Offline storage and sync
│   └── auth/          # Authentication service
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── contexts/           # React contexts
└── App.tsx            # Root application component
```

### Design Rationale

**CloudScape Design System:** Chosen for its comprehensive component library, built-in accessibility, and consistency with AWS ecosystem. Reduces custom CSS and ensures professional appearance.

**React Query:** Selected for its powerful caching, automatic background refetching, and optimistic updates. Simplifies server state management and reduces boilerplate compared to Redux.

**Dexie.js:** Provides a clean, promise-based API over IndexedDB with better TypeScript support than raw IndexedDB API. Handles schema versioning and migrations.

**Vite:** Offers significantly faster development experience than webpack-based tools through native ES modules and optimized production builds.

## Components and Interfaces

### Core Components

#### 1. Authentication Components

**LoginPage**
- Renders email and password input fields using CloudScape FormField and Input
- Validates inputs before submission
- Displays error messages using CloudScape Alert component
- Redirects to dashboard on successful authentication

**ProtectedRoute**
- Wrapper component that checks authentication status
- Redirects to login if user is not authenticated
- Checks user role for authorization
- Conditionally renders children based on permissions

#### 2. Layout Components

**AppLayout**
- Uses CloudScape AppLayout component for consistent structure
- Renders navigation sidebar with links to all sections
- Displays user menu with name, role, and logout option
- Shows connection status indicator (online/offline)
- Highlights current active section

**Navigation**
- Renders navigation items based on user role
- Hides admin-only sections from non-administrators
- Maintains navigation state across route changes

#### 3. Activity Type Management

**ActivityTypeList**
- Displays table of activity types using CloudScape Table
- Distinguishes predefined vs custom types with badges
- Provides edit and delete actions per row
- Handles delete validation (prevents deletion if referenced)

**ActivityTypeForm**
- Modal form for creating/editing activity types
- Validates name is not empty
- Submits to API and updates cache

#### 4. Participant Role Management

**ParticipantRoleList**
- Displays table of roles using CloudScape Table
- Distinguishes predefined vs custom roles with badges
- Provides edit and delete actions per row
- Handles delete validation (prevents deletion if referenced)

**ParticipantRoleForm**
- Modal form for creating/editing roles
- Validates name is not empty
- Submits to API and updates cache

#### 5. Participant Management

**ParticipantList**
- Displays table with search, sort, and filter capabilities
- Uses CloudScape Table with pagination
- Provides actions for edit, delete, and view details
- Implements client-side search across name and email

**ParticipantForm**
- Modal form for creating/editing participants
- Validates name, email format, and required fields
- Supports optional phone and notes fields
- Displays inline validation errors

**ParticipantDetail**
- Shows participant information in detail view
- Lists all activities the participant is assigned to
- Displays roles for each activity assignment

#### 6. Activity Management

**ActivityList**
- Displays table with filtering by type and status
- Visually distinguishes finite vs ongoing activities
- Provides sort capabilities
- Shows activity dates and status badges

**ActivityForm**
- Modal form for creating/editing activities
- Conditionally requires end date for finite activities
- Allows null end date for ongoing activities
- Validates name, type, and start date
- Provides date pickers using CloudScape DatePicker

**ActivityDetail**
- Shows activity information in detail view
- Lists all assigned participants with their roles
- Provides interface to add/remove participant assignments
- Shows "Mark Complete" button for finite activities

#### 7. Assignment Management

**AssignmentForm**
- Interface to assign participants to activities
- Requires role selection from dropdown
- Validates role is selected
- Prevents duplicate assignments (same participant + role)

**AssignmentList**
- Displays assigned participants on activity detail
- Shows participant name and role
- Provides remove button for each assignment

#### 8. Venue Management

**VenueList**
- Displays table of venues with name, address, and geographic area
- Uses CloudScape Table with search, sort, and filter capabilities
- Provides actions for edit, delete, and view details
- Implements client-side search across name and address

**VenueForm**
- Modal form for creating/editing venues
- Validates name, address, and geographic area are required
- Provides dropdown for geographic area selection
- Supports optional latitude, longitude, and venue type fields
- Displays inline validation errors
- Handles delete validation (prevents deletion if referenced)

**VenueDetail**
- Shows venue information in detail view
- Lists all activities associated with the venue (current and historical)
- Lists all participants with this venue as their home address
- Displays geographic area hierarchy path

#### 9. Geographic Area Management

**GeographicAreaList**
- Displays hierarchical tree view of geographic areas using CloudScape Tree component
- Shows area type badges for each geographic area
- Provides expand/collapse functionality for hierarchy navigation
- Provides actions for edit, delete, and view details
- Handles delete validation (prevents deletion if referenced)

**GeographicAreaForm**
- Modal form for creating/editing geographic areas
- Validates name and area type are required
- Provides dropdown for area type selection (NEIGHBOURHOOD, COMMUNITY, CITY, etc.)
- Provides dropdown for parent geographic area selection
- Prevents circular parent-child relationships
- Displays inline validation errors

**GeographicAreaDetail**
- Shows geographic area information in detail view
- Displays full hierarchy path from root to current area
- Lists all child geographic areas
- Lists all venues in the geographic area
- Shows statistics (activity and participant counts) for the area and descendants

#### 10. Map View

**MapView**
- Renders interactive map using Leaflet or Mapbox GL JS
- Displays venue markers for all venues with coordinates
- Uses different marker colors/icons for activity types and statuses
- Implements marker clustering for dense areas
- Provides popup with activity information on marker click
- Includes map controls for zoom, pan, and center
- Displays legend explaining marker colors and symbols

**MapFilters**
- Provides filter controls for activity type, status, and date range
- Updates map markers based on selected filters
- Allows showing/hiding participant home addresses
- Provides geographic area boundary toggle
- Includes button to center map on specific venue or geographic area

**MapPopup**
- Displays activity information when venue marker is clicked
- Shows venue name and address
- Lists activities at the venue with dates and status
- Provides link to activity detail view

#### 11. Analytics Dashboards

**EngagementDashboard**
- Displays summary metrics using CloudScape Cards
- Shows total participants, total activities, active activities, ongoing activities
- Renders charts for activities by type and role distribution
- Provides date range filter using CloudScape DateRangePicker
- Provides geographic area filter dropdown
- Displays geographic breakdown chart showing engagement by geographic area
- Allows drilling down into child geographic areas
- Uses recharts library for data visualization

**GrowthDashboard**
- Displays time-series charts for new participants and activities
- Provides time period selector (day, week, month, year)
- Shows percentage changes between periods
- Displays cumulative counts over time
- Provides geographic area filter dropdown
- Uses recharts for line and area charts

#### 9. User Management (Admin Only)

**UserList**
- Displays table of all users (admin only)
- Shows email, name, and role
- Provides edit action per row

**UserForm**
- Modal form for creating/editing users
- Allows role assignment and modification
- Only accessible to administrators

### Service Layer

#### API Service

**AuthService**
- `login(email, password)`: Authenticates user and returns JWT tokens (access token expires in 15 minutes, refresh token in 7 days)
- `logout()`: Clears tokens and redirects to login
- `refreshToken(refreshToken)`: Refreshes expired access token using refresh token
- `getCurrentUser()`: Fetches current user info from `/auth/me` endpoint
- `decodeToken(token)`: Decodes JWT to extract user information (userId, email, role)

**ActivityTypeService**
- `getActivityTypes()`: Fetches all activity types from `/activity-types`
- `createActivityType(data)`: Creates new activity type
- `updateActivityType(id, data, version?)`: Updates existing activity type with optional version for optimistic locking
- `deleteActivityType(id)`: Deletes activity type (validates references, returns REFERENCED_ENTITY error if referenced)

**ParticipantRoleService**
- `getRoles()`: Fetches all roles from `/roles` endpoint
- `createRole(data)`: Creates new role
- `updateRole(id, data, version?)`: Updates existing role with optional version for optimistic locking
- `deleteRole(id)`: Deletes role (validates references, returns REFERENCED_ENTITY error if referenced)

**ParticipantService**
- `getParticipants(page?, limit?)`: Fetches all participants with optional pagination
- `getParticipant(id)`: Fetches single participant
- `createParticipant(data)`: Creates new participant with optional homeVenueId
- `updateParticipant(id, data, version?)`: Updates existing participant with optional version for optimistic locking
- `deleteParticipant(id)`: Deletes participant
- `getAddressHistory(id)`: Fetches participant's home address history from `/participants/:id/address-history`

**ActivityService**
- `getActivities(page?, limit?)`: Fetches all activities with optional pagination
- `getActivity(id)`: Fetches single activity with activityType populated
- `createActivity(data)`: Creates new activity (status defaults to PLANNED if not provided)
- `updateActivity(id, data, version?)`: Updates existing activity with optional version for optimistic locking
- `deleteActivity(id)`: Deletes activity
- `getActivityParticipants(id)`: Fetches participants assigned to activity from `/activities/:id/participants`
- `getActivityVenues(id)`: Fetches venue history for activity from `/activities/:id/venues`
- `addActivityVenue(activityId, venueId)`: Associates venue with activity
- `removeActivityVenue(activityId, venueId)`: Removes venue association

**AssignmentService**
- `addParticipant(activityId, participantId, roleId, notes?)`: Creates assignment via `/activities/:activityId/participants`
- `updateParticipant(activityId, participantId, roleId?, notes?)`: Updates assignment
- `removeParticipant(activityId, participantId)`: Removes assignment via `/activities/:activityId/participants/:participantId`
- `getActivityParticipants(activityId)`: Fetches assignments for activity

**VenueService**
- `getVenues(page?, limit?)`: Fetches all venues with optional pagination
- `getVenue(id)`: Fetches single venue with geographicArea populated
- `searchVenues(query)`: Searches venues by name or address via `/venues/search?q=`
- `createVenue(data)`: Creates new venue
- `updateVenue(id, data, version?)`: Updates existing venue with optional version for optimistic locking
- `deleteVenue(id)`: Deletes venue (validates references, returns REFERENCED_ENTITY error if referenced)
- `getVenueActivities(id)`: Fetches activities associated with venue from `/venues/:id/activities`
- `getVenueParticipants(id)`: Fetches participants with venue as home from `/venues/:id/participants`

**GeographicAreaService**
- `getGeographicAreas(page?, limit?)`: Fetches all geographic areas with optional pagination
- `getGeographicArea(id)`: Fetches single geographic area with parent populated
- `createGeographicArea(data)`: Creates new geographic area (validates circular relationships)
- `updateGeographicArea(id, data, version?)`: Updates existing geographic area with optional version for optimistic locking
- `deleteGeographicArea(id)`: Deletes geographic area (validates references, returns REFERENCED_ENTITY error if referenced)
- `getChildren(id)`: Fetches child geographic areas from `/geographic-areas/:id/children`
- `getAncestors(id)`: Fetches hierarchy path to root from `/geographic-areas/:id/ancestors`
- `getVenues(id)`: Fetches venues in geographic area from `/geographic-areas/:id/venues`
- `getStatistics(id)`: Fetches statistics for geographic area and descendants from `/geographic-areas/:id/statistics`

**ParticipantAddressHistoryService**
- `getAddressHistory(participantId)`: Fetches participant's home address history from `/participants/:id/address-history`

**AnalyticsService**
- `getEngagementMetrics(startDate?, endDate?, geographicAreaId?)`: Fetches engagement data from `/analytics/engagement` with optional filters
- `getGrowthMetrics(startDate?, endDate?, period?, geographicAreaId?)`: Fetches growth data from `/analytics/growth` with optional filters (period: DAY, WEEK, MONTH, YEAR)
- `getGeographicAnalytics(startDate?, endDate?)`: Fetches geographic breakdown from `/analytics/geographic`

**UserService** (Admin only)
- `getUsers()`: Fetches all users (admin only)
- `createUser(data)`: Creates new user (admin only)
- `updateUser(id, data)`: Updates user including role (admin only)

#### Sync Service

**SyncService**
- `batchSync(clientId, operations)`: Sends batch of operations to `/sync/batch` endpoint
- `processSyncResults(results)`: Handles sync results including conflicts and errors

#### Offline Service

**OfflineStorage**
- Uses Dexie.js to manage IndexedDB database
- Stores tables for: participants, activities, activityTypes, roles, assignments
- `syncFromServer()`: Fetches all data and stores locally
- `getLocalData(table)`: Retrieves data from IndexedDB
- `clearCache()`: Clears all local data

**SyncQueue**
- Stores pending operations in IndexedDB queue table
- `enqueue(operation)`: Adds operation to queue
- `processQueue()`: Sends all queued operations to server
- `clearQueue()`: Removes processed operations
- Implements exponential backoff for retries

**ConnectionMonitor**
- Listens to online/offline events
- Updates global connection state
- Triggers sync when connectivity restored
- Provides `isOnline()` status check

## Data Models

### Frontend Data Types

```typescript
interface User {
  id: string;
  email: string;
  role: 'ADMINISTRATOR' | 'EDITOR' | 'READ_ONLY';
  createdAt: string;
  updatedAt: string;
}

interface ActivityType {
  id: string;
  name: string;
  isPredefined: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantRole {
  id: string;
  name: string;
  isPredefined: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  geographicAreaId: string;
  geographicArea?: GeographicArea;
  latitude?: number;
  longitude?: number;
  venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface GeographicArea {
  id: string;
  name: string;
  areaType: 'NEIGHBOURHOOD' | 'COMMUNITY' | 'CITY' | 'CLUSTER' | 'COUNTY' | 'PROVINCE' | 'STATE' | 'COUNTRY' | 'CUSTOM';
  parentGeographicAreaId?: string;
  parent?: GeographicArea;
  children?: GeographicArea[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface GeographicAreaStatistics {
  totalActivities: number;
  totalParticipants: number;
  totalVenues: number;
  activeActivities: number;
}

interface Activity {
  id: string;
  name: string;
  activityTypeId: string;
  activityType?: ActivityType;
  startDate: string;
  endDate?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  isOngoing: boolean;
  createdBy?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ActivityVenueHistory {
  id: string;
  activityId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface Assignment {
  id: string;
  activityId: string;
  participantId: string;
  roleId: string;
  notes?: string;
  participant?: Participant;
  role?: ParticipantRole;
  createdAt: string;
}

interface EngagementMetrics {
  totalActivities: number;
  activeActivities: number;
  totalParticipants: number;
  activeParticipants: number;
  participationRate: number;
  retentionRate: number;
  averageActivitySize: number;
  geographicBreakdown: {
    geographicAreaId: string;
    geographicAreaName: string;
    activityCount: number;
    participantCount: number;
  }[];
  periodStart: string;
  periodEnd: string;
}

interface GrowthMetrics {
  date: string;
  newParticipants: number;
  newActivities: number;
  cumulativeParticipants: number;
  cumulativeActivities: number;
}

interface GeographicAnalytics {
  geographicAreaId: string;
  geographicAreaName: string;
  areaType: string;
  totalActivities: number;
  activeActivities: number;
  totalParticipants: number;
  activeParticipants: number;
}

interface QueuedOperation {
  id: string;
  entityType: 'Activity' | 'Participant' | 'ActivityParticipant' | 'Venue' | 'GeographicArea' | 'ActivityType' | 'Role';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: string;
  version?: number;
  retries: number;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface APIError {
  code: string;
  message: string;
  details?: any;
}
```

### API Request/Response Types

All API requests and responses follow the Backend API package specifications. The frontend transforms these into the above data models for internal use.

**Response Format:**
All successful API responses are wrapped in a standard format:
```typescript
{
  success: true,
  data: T,
  pagination?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

**Error Response Format:**
```typescript
{
  code: string,
  message: string,
  details?: any
}
```

**Error Codes:**
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_REQUIRED`: Missing or invalid token
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `NOT_FOUND`: Resource not found
- `VERSION_CONFLICT`: Optimistic locking conflict (version mismatch)
- `CIRCULAR_REFERENCE`: Circular relationship detected
- `REFERENCED_ENTITY`: Entity is referenced and cannot be deleted
- `DUPLICATE_EMAIL`: Email already exists
- `DUPLICATE_NAME`: Name already exists
- `DUPLICATE_ASSIGNMENT`: Assignment already exists
- `INVALID_REFERENCE`: Referenced entity does not exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

**Rate Limiting:**
- Authentication endpoints: 5 requests/minute per IP
- Mutation endpoints (POST, PUT, DELETE): 100 requests/minute per user
- Query endpoints (GET): 1000 requests/minute per user

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp (Unix)

**Pagination:**
Pagination is optional on list endpoints. When `page` or `limit` query parameters are provided, the response includes pagination metadata. Without these parameters, all results are returned.

**Optimistic Locking:**
All entities support optimistic locking via the `version` field. When updating an entity, include the current version number in the request. If the version doesn't match, a `VERSION_CONFLICT` error (409) is returned.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Type/Role Distinction in Lists

*For any* list of activity types or participant roles, the rendered output should visually distinguish predefined items from custom items.

**Validates: Requirements 2.1, 3.1**

### Property 2: Referential Integrity on Deletion

*For any* entity (activity type or participant role) that has references from other entities, attempting to delete it should be prevented and return an error.

**Validates: Requirements 2.5, 3.5**

### Property 3: Deletion Error Messages

*For any* failed deletion operation, the application should display an error message explaining why the deletion failed.

**Validates: Requirements 2.6, 3.6**

### Property 4: Non-Empty Name Validation

*For any* string composed entirely of whitespace or empty string, attempting to use it as a name for activity types or participant roles should be rejected.

**Validates: Requirements 2.7, 3.7**

### Property 5: Participant List Display

*For any* participant, the list view should include both the participant's name and email in the rendered output.

**Validates: Requirements 4.1**

### Property 6: Participant Search Functionality

*For any* search query and participant list, the search results should only include participants whose name or email contains the search term (case-insensitive).

**Validates: Requirements 4.2**

### Property 7: Required Field Validation

*For any* form submission with missing required fields (participant name/email, activity name/type/start date, login email/password), the validation should fail and prevent submission.

**Validates: Requirements 4.7, 5.10, 8.2**

### Property 8: Email Format Validation

*For any* string that doesn't match valid email format (missing @, invalid domain, etc.), attempting to use it as an email should be rejected.

**Validates: Requirements 4.8**

### Property 9: Optional Field Acceptance

*For any* participant form submission with or without phone and notes fields, the submission should succeed if all required fields are valid.

**Validates: Requirements 4.9**

### Property 10: Participant Detail View Completeness

*For any* participant, the detail view should display the participant's information and all activities they are assigned to.

**Validates: Requirements 4.10**

### Property 11: Activity List Display

*For any* activity, the list view should include the activity type, dates, and status in the rendered output.

**Validates: Requirements 5.1**

### Property 12: Activity Filtering

*For any* filter criteria (activity type or status) and activity list, the filtered results should only include activities matching the criteria.

**Validates: Requirements 5.2**

### Property 13: Finite vs Ongoing Activity Distinction

*For any* activity list containing both finite and ongoing activities, the rendered output should visually distinguish between the two types.

**Validates: Requirements 5.4**

### Property 14: Finite Activity End Date Requirement

*For any* finite activity submission without an end date, the validation should fail and prevent creation.

**Validates: Requirements 5.8**

### Property 15: Ongoing Activity Null End Date

*For any* ongoing activity submission with null end date, the validation should succeed if all other required fields are valid.

**Validates: Requirements 5.9**

### Property 16: Activity Detail View Completeness

*For any* activity, the detail view should display the activity information and all assigned participants with their roles.

**Validates: Requirements 5.12**

### Property 17: Assignment Role Requirement

*For any* participant assignment attempt without a role selected, the validation should fail and prevent assignment.

**Validates: Requirements 6.2, 6.5**

### Property 18: Assignment Display Completeness

*For any* activity with assignments, the detail view should display all assigned participants along with their roles.

**Validates: Requirements 6.3**

### Property 19: Duplicate Assignment Prevention

*For any* attempt to create an assignment with the same participant and role combination that already exists for an activity, the operation should be prevented.

**Validates: Requirements 6.6**

### Property 20: Engagement Metrics Accuracy

*For any* dataset, the engagement metrics should correctly calculate total participants, total activities, active activities, and ongoing activities counts.

**Validates: Requirements 7.2, 7.3**

### Property 21: Chart Data Aggregation

*For any* dataset, the chart data for activities by type and role distribution should correctly aggregate counts for each category.

**Validates: Requirements 7.4, 7.5**

### Property 22: Time-Series Data Calculation

*For any* time period and dataset, the time-series charts should correctly calculate new participants and activities for each time unit.

**Validates: Requirements 7.8**

### Property 23: Percentage Change Calculation

*For any* two time periods, the percentage change calculation should correctly compute the relative change between periods.

**Validates: Requirements 7.10**

### Property 24: Cumulative Count Calculation

*For any* time series data, the cumulative counts should correctly sum all previous values up to each point in time.

**Validates: Requirements 7.11**

### Property 25: Unauthenticated Access Protection

*For any* protected route, attempting to access it without authentication should redirect to the login page.

**Validates: Requirements 9.1, 9.2**

### Property 26: Unauthorized Action Error Messages

*For any* unauthorized action attempt, the application should display an appropriate error message.

**Validates: Requirements 9.6**

### Property 27: Offline Data Caching

*For any* user data loaded from the API, the data should be stored in IndexedDB for offline access.

**Validates: Requirements 10.2**

### Property 28: Offline Operation Queueing

*For any* create, update, or delete operation performed while offline, the operation should be added to the local sync queue.

**Validates: Requirements 10.3**

### Property 29: Offline Feature Indication

*For any* feature that requires connectivity, when offline, the feature should be visually indicated as unavailable and disabled.

**Validates: Requirements 10.6, 10.7**

### Property 30: Sync Queue Processing

*For any* queued operations when connectivity is restored, all operations should be sent to the backend and the queue should be cleared upon success.

**Validates: Requirements 11.2, 11.3**

### Property 31: Sync Retry with Exponential Backoff

*For any* failed synchronization attempt, the retry delay should increase exponentially with each subsequent failure.

**Validates: Requirements 11.4**

### Property 32: Pending Operation Count Display

*For any* number of pending operations in the sync queue, the displayed count should match the actual queue length.

**Validates: Requirements 11.6**

### Property 33: Active Navigation Highlighting

*For any* current route, the corresponding navigation item should be visually highlighted.

**Validates: Requirements 13.2**

### Property 34: Navigation State Persistence

*For any* navigation between sections, the navigation state (expanded/collapsed items, scroll position) should be preserved.

**Validates: Requirements 13.3**

### Property 35: Form Validation Error Display

*For any* invalid form field, the field should be visually highlighted and display an inline error message.

**Validates: Requirements 14.2, 14.3**

### Property 36: Invalid Form Submission Prevention

*For any* form with validation errors, the submit button should be disabled or submission should be prevented.

**Validates: Requirements 14.4**

### Property 37: Valid Field Value Preservation

*For any* form with validation errors, all valid field values should remain unchanged after validation fails.

**Validates: Requirements 14.5**

### Property 38: Error Notification Type

*For any* error, transient errors should display toast notifications while critical errors should display modal dialogs.

**Validates: Requirements 15.2, 15.3**

### Property 39: Error State Preservation

*For any* error occurrence, the application state should remain unchanged (no data loss or corruption).

**Validates: Requirements 15.5**

### Property 40: Error Console Logging

*For any* error, detailed error information should be logged to the browser console.

**Validates: Requirements 15.6**

### Property 41: Loading State Indicators

*For any* asynchronous operation (API request, data loading, long operation), appropriate loading indicators should be displayed (spinners, skeleton screens, or progress bars).

**Validates: Requirements 16.1, 16.3, 16.4**

### Property 42: Form Button Disabling During Submission

*For any* form submission in progress, the submit button should be disabled to prevent duplicate submissions.

**Validates: Requirements 16.2**

### Property 43: Success Message Display

*For any* successful operation (create, update, delete), a success message should be displayed to the user.

**Validates: Requirements 16.5**

### Property 44: Venue List Display

*For any* venue, the list view should include the venue's name, address, and geographic area in the rendered output.

**Validates: Requirements 6A.1**

### Property 45: Venue Search Functionality

*For any* search query and venue list, the search results should only include venues whose name or address contains the search term (case-insensitive).

**Validates: Requirements 6A.2**

### Property 46: Venue Required Field Validation

*For any* venue form submission with missing required fields (name, address, or geographic area), the validation should fail and prevent submission.

**Validates: Requirements 6A.7**

### Property 47: Venue Optional Field Acceptance

*For any* venue form submission with or without optional latitude, longitude, and venue type fields, the submission should succeed if all required fields are valid.

**Validates: Requirements 6A.8**

### Property 48: Venue Deletion Prevention

*For any* venue referenced by activities or participants, attempting to delete it should be prevented and display an error message explaining which entities reference it.

**Validates: Requirements 6A.10, 6A.11**

### Property 49: Venue Detail View Completeness

*For any* venue, the detail view should display the venue information, associated activities, and participants using it as home address.

**Validates: Requirements 6A.9**

### Property 50: Geographic Area Hierarchical Display

*For any* set of geographic areas, the list view should display them in a hierarchical tree structure showing parent-child relationships.

**Validates: Requirements 6B.1**

### Property 51: Geographic Area Required Field Validation

*For any* geographic area form submission with missing required fields (name or area type), the validation should fail and prevent submission.

**Validates: Requirements 6B.5**

### Property 52: Circular Relationship Prevention

*For any* geographic area, attempting to set its parent to itself or to one of its descendants should be prevented with a validation error.

**Validates: Requirements 6B.7**

### Property 53: Geographic Area Deletion Prevention

*For any* geographic area referenced by venues or child geographic areas, attempting to delete it should be prevented and display an error message explaining which entities reference it.

**Validates: Requirements 6B.9, 6B.10**

### Property 54: Geographic Area Hierarchy Path Display

*For any* geographic area, the detail view should display the full hierarchy path from root to the current area.

**Validates: Requirements 6B.11**

### Property 55: Map Venue Marker Display

*For any* venue with latitude and longitude coordinates, a marker should be displayed on the map at the correct location.

**Validates: Requirements 6C.2**

### Property 56: Map Marker Activity Information

*For any* venue marker clicked on the map, a popup should display showing activity information for that venue.

**Validates: Requirements 6C.3**

### Property 57: Map Marker Color Coding

*For any* set of venues on the map, markers should be color-coded based on activity type or status to visually distinguish them.

**Validates: Requirements 6C.4**

### Property 58: Map Filter Application

*For any* filter criteria (activity type, status, or date range) applied to the map, only venues with activities matching the criteria should display markers.

**Validates: Requirements 6C.5**

### Property 59: Map Legend Display

*For any* map view, a legend should be displayed explaining the meaning of marker colors and symbols.

**Validates: Requirements 6C.8**

### Property 60: Participant Home Address Display

*For any* participant with a home venue, the detail view should display their current home address and address history when the venue has changed over time.

**Validates: Requirements 4.11, 4.12**

### Property 61: Activity Venue Display

*For any* activity with associated venues, the detail view should display all current and historical venue associations with their effective date ranges.

**Validates: Requirements 5.13, 5.14**

### Property 62: Geographic Area Filter Application

*For any* analytics dashboard with a geographic area filter applied, only activities and participants associated with venues in that geographic area or its descendants should be included in the metrics.

**Validates: Requirements 7.12**

### Property 63: Geographic Breakdown Chart Display

*For any* engagement metrics, the geographic breakdown chart should correctly display engagement data grouped by geographic area.

**Validates: Requirements 7.13**

### Property 64: Geographic Area Drill-Down

*For any* geographic area in the breakdown chart, clicking it should allow drilling down into child geographic areas to view more detailed statistics.

**Validates: Requirements 7.14**

## Error Handling

### Client-Side Errors

**Validation Errors:**
- Display inline error messages using CloudScape FormField error prop
- Highlight invalid fields with red border
- Prevent form submission until all errors resolved
- Preserve valid field values during validation

**Network Errors:**
- Detect offline status and queue operations
- Display toast notification for transient network failures
- Provide retry mechanism for failed requests
- Show connection status indicator in header

**Authentication Errors:**
- Redirect to login on 401 Unauthorized
- Clear tokens and session data
- Display error message explaining authentication failure
- Preserve intended destination for post-login redirect

**Authorization Errors:**
- Display modal dialog for 403 Forbidden
- Explain which permission is required
- Provide link to contact administrator
- Maintain current page state

### Server-Side Errors

**400 Bad Request:**
- Parse validation errors from response
- Display field-specific errors in form
- Highlight problematic fields

**404 Not Found:**
- Display user-friendly "resource not found" message
- Provide navigation back to list view
- Log error details to console

**409 Conflict (Version Mismatch):**
- Detect VERSION_CONFLICT error code
- Display conflict notification to user
- Provide options: retry with latest version, discard changes, or view differences
- Refetch latest entity data

**500 Internal Server Error:**
- Display generic error message to user
- Log full error details to console
- Provide retry option
- Maintain application state

**429 Too Many Requests:**
- Display rate limit exceeded message
- Show retry-after time from X-RateLimit-Reset header
- Automatically retry after cooldown period
- Log rate limit details

### Offline Handling

**Offline Detection:**
- Listen to `online` and `offline` events
- Update global connection state
- Display offline indicator in header
- Disable features requiring connectivity

**Queue Management:**
- Store failed operations in IndexedDB queue
- Retry automatically when online
- Display pending operation count
- Provide manual sync button

**Conflict Resolution:**
- Detect conflicts during sync (version mismatch)
- Display conflict notification to user
- Provide options: keep local, keep server, or merge
- Log conflict details for debugging

### Error Logging

**Console Logging:**
- Log all errors with full stack traces
- Include request/response details for API errors
- Log user actions leading to error
- Include timestamp and user context

**Error Boundaries:**
- Implement React Error Boundaries for component crashes
- Display fallback UI with error message
- Provide "Report Error" button
- Log component stack to console

## Testing Strategy

### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions using Jest and React Testing Library.

**Component Testing:**
- Test component rendering with various props
- Test user interactions (clicks, form inputs)
- Test conditional rendering based on state
- Test error states and edge cases
- Mock API calls and external dependencies

**Service Testing:**
- Test API client methods with mocked responses
- Test error handling for network failures
- Test data transformation logic
- Test authentication token management

**Utility Testing:**
- Test validation functions with valid and invalid inputs
- Test date formatting and parsing
- Test data aggregation and calculation functions

**Example Unit Tests:**
- Login form displays error for invalid credentials
- Activity form requires end date for finite activities
- Delete button is disabled when entity has references
- Offline indicator appears when connection lost
- Admin-only features hidden from non-admin users

### Property-Based Testing

Property-based tests verify universal properties across all inputs using fast-check library. Each test runs a minimum of 100 iterations with randomly generated inputs.

**Test Configuration:**
- Use fast-check for property-based testing
- Configure 100+ iterations per test
- Tag each test with feature name and property number
- Reference design document property in test comments

**Generator Strategy:**
- Create smart generators that constrain to valid input space
- Generate realistic test data (valid emails, dates, etc.)
- Include edge cases in generators (empty strings, boundary values)
- Compose generators for complex data structures

**Property Test Examples:**
- For any activity type with references, deletion should be prevented (Property 2)
- For any whitespace-only string, name validation should fail (Property 4)
- For any search term, results should only include matching participants (Property 6)
- For any dataset, metric calculations should be accurate (Property 20)
- For any offline operation, it should be queued for sync (Property 28)

**Test Tagging Format:**
```typescript
// Feature: web-frontend, Property 6: Participant Search Functionality
test('search results only include matching participants', () => {
  fc.assert(
    fc.property(
      fc.array(participantGenerator()),
      fc.string(),
      (participants, searchTerm) => {
        const results = searchParticipants(participants, searchTerm);
        return results.every(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests verify end-to-end flows and component interactions using Playwright or Cypress.

**Test Scenarios:**
- Complete user workflows (login → create activity → assign participant)
- Offline operation and synchronization
- Authentication and authorization flows
- Form submission and validation
- Navigation and routing

### Visual Regression Testing

Visual tests ensure UI consistency across changes using Percy or Chromatic.

**Test Coverage:**
- All major pages and components
- Different screen sizes (768px, 1024px, 1920px)
- Different user roles (admin, editor, read-only)
- Error states and loading states

### Accessibility Testing

Accessibility tests ensure WCAG 2.1 AA compliance using axe-core.

**Test Coverage:**
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus management
- ARIA labels and roles

## Implementation Notes

### State Management Strategy

**Server State (React Query):**
- Cache API responses with automatic invalidation
- Optimistic updates for better UX
- Background refetching for data freshness
- Automatic retry on failure

**Global UI State (Context):**
- User session and authentication
- Theme preferences
- Connection status
- Notification queue

**Local Component State:**
- Form inputs and validation
- UI interactions (modals, dropdowns)
- Temporary UI state

### Offline-First Architecture

**Data Flow:**
1. User performs action
2. Check connection status
3. If online: Send to API, update cache
4. If offline: Store in queue, update local cache
5. When online: Process queue, sync with server

**Conflict Resolution:**
- Use optimistic locking with version numbers
- Detect conflicts during sync
- Prompt user to resolve conflicts
- Provide clear options (local, server, merge)

### Performance Optimization

**Code Splitting:**
- Lazy load routes with React.lazy()
- Split vendor bundles
- Preload critical routes

**Memoization:**
- Use React.memo for expensive components
- Use useMemo for expensive calculations
- Use useCallback for stable function references

**Virtual Scrolling:**
- Implement virtual scrolling for large lists
- Use react-window or react-virtual

**Image Optimization:**
- Lazy load images
- Use appropriate image formats (WebP)
- Provide responsive images

### Security Considerations

**Token Storage:**
- Store access tokens in memory only (expires in 15 minutes)
- Store refresh tokens in localStorage or httpOnly cookies (expires in 7 days)
- Clear tokens on logout
- Decode JWT access token to extract user information (userId, email, role)

**XSS Prevention:**
- Sanitize user inputs
- Use React's built-in XSS protection
- Avoid dangerouslySetInnerHTML

**CSRF Protection:**
- Include CSRF tokens in state-changing requests
- Validate tokens on backend

**Content Security Policy:**
- Implement strict CSP headers
- Whitelist trusted sources
- Report violations

### Accessibility Requirements

**Keyboard Navigation:**
- All interactive elements accessible via keyboard
- Logical tab order
- Visible focus indicators
- Keyboard shortcuts for common actions

**Screen Reader Support:**
- Semantic HTML elements
- ARIA labels and roles
- Live regions for dynamic content
- Descriptive link text

**Visual Accessibility:**
- Minimum 4.5:1 contrast ratio for text
- Minimum 3:1 contrast ratio for UI components
- No information conveyed by color alone
- Resizable text up to 200%

### Browser Support

**Target Browsers:**
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

**Progressive Enhancement:**
- Core functionality works without JavaScript
- Enhanced features for modern browsers
- Graceful degradation for older browsers

### Deployment Considerations

**Build Optimization:**
- Minification and compression
- Tree shaking for unused code
- Asset optimization (images, fonts)
- Source maps for debugging

**CDN Strategy:**
- Serve static assets from CDN
- Cache-busting with content hashes
- Preload critical resources

**Monitoring:**
- Error tracking with Sentry or similar
- Performance monitoring with Web Vitals
- User analytics for feature usage
- A/B testing infrastructure
