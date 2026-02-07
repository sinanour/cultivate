# Design Document: PII-Restricted Role

## Overview

This design implements a new PII_RESTRICTED role in the Cultivate system that provides highly restricted access - completely blocking all participant, venue, activity, and map-related APIs and pages. The implementation spans both backend-api and web-frontend packages, requiring changes to authorization logic, route protection, and UI navigation.

The core design principle is **complete access denial**: Rather than redacting sensitive fields, the system completely blocks access to entire resource categories at the API and UI levels.

### Key Design Decisions

1. **Complete API blocking**: Reject all requests to participant, venue, activity, and map endpoints with 403 Forbidden
2. **Frontend route protection**: Hide navigation links and redirect unauthorized page access attempts
3. **Analytics access with restrictions**: Allow engagement and growth analytics but block venue grouping and venue filtering
4. **Geographic area read-only**: Allow viewing geographic hierarchy for filtering context but block write operations
5. **Configuration read-only**: Allow viewing activity categories, types, roles, and populations but block modifications
6. **Role hierarchy**: PII_RESTRICTED is the most restrictive role, providing access only to aggregate analytics and geographic structure

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Frontend                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Protection                                    │  │
│  │  - Block /participants, /venues, /activities, /map   │  │
│  │  - Allow /geographic-areas, /analytics               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Navigation Filtering                                │  │
│  │  - Hide blocked pages from menu                      │  │
│  │  - Show only authorized pages                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Analytics UI Restrictions                           │  │
│  │  - Suppress venue grouping option                    │  │
│  │  - Suppress venue filter option                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP + JWT
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authorization Middleware                            │  │
│  │  - JWT validation                                    │  │
│  │  - Role extraction                                   │  │
│  │  - Endpoint access control                           │  │
│  │  - Geographic authorization                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Blocked Endpoints (403 Forbidden)                   │  │
│  │  - All /participants/* endpoints                     │  │
│  │  - All /venues/* endpoints                           │  │
│  │  - All /activities/* endpoints                       │  │
│  │  - All /map/* endpoints                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Allowed Endpoints (with restrictions)               │  │
│  │  - /geographic-areas/* (read-only)                   │  │
│  │  - /analytics/* (no venue grouping/filtering)        │  │
│  │  - /activity-categories, /activity-types (read-only) │  │
│  │  - /roles, /populations (read-only)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Authentication**: User logs in, receives JWT token containing PII_RESTRICTED role
2. **Request**: Frontend sends API request with JWT token in Authorization header
3. **Authorization**: Backend validates JWT, extracts role, checks endpoint access
4. **Access Control**: 
   - If endpoint is blocked for PII_RESTRICTED: Return 403 Forbidden immediately
   - If endpoint is allowed: Apply geographic authorization and parameter validation
5. **Parameter Validation**: For analytics endpoints, reject venue grouping and venue filtering
6. **Data Retrieval**: Business logic retrieves aggregate data (no individual records)
7. **Response**: Aggregate data returned to frontend
8. **Display**: Frontend renders analytics and geographic hierarchy only

## Components and Interfaces

### Backend Components

#### 1. Role Enumeration

```typescript
enum UserRole {
  ADMINISTRATOR = 'ADMINISTRATOR',
  EDITOR = 'EDITOR',
  READ_ONLY = 'READ_ONLY',
  PII_RESTRICTED = 'PII_RESTRICTED'
}
```

#### 2. Endpoint Access Control

```typescript
// Blocked endpoint patterns for PII_RESTRICTED role
const BLOCKED_ENDPOINTS = [
  /^\/api\/v1\/participants/,
  /^\/api\/v1\/venues/,
  /^\/api\/v1\/activities/,
  /^\/api\/v1\/map/
]

function isEndpointBlocked(path: string, role: UserRole): boolean {
  if (role !== UserRole.PII_RESTRICTED) {
    return false
  }
  
  return BLOCKED_ENDPOINTS.some(pattern => pattern.test(path))
}

function enforceEndpointAccess(req: Request, context: AuthorizationContext): void {
  if (isEndpointBlocked(req.path, context.role)) {
    throw new AuthorizationError(
      'PII_RESTRICTED role does not have access to this endpoint',
      403
    )
  }
}
```

#### 3. Analytics Parameter Validation

```typescript
interface AnalyticsQueryParams {
  groupBy?: string[]
  venueIds?: string[]
  activityCategoryIds?: string[]
  activityTypeIds?: string[]
  geographicAreaIds?: string[]
  populationIds?: string[]
  startDate?: string
  endDate?: string
}

function validateAnalyticsParams(
  params: AnalyticsQueryParams,
  role: UserRole
): void {
  if (role !== UserRole.PII_RESTRICTED) {
    return  // No restrictions for other roles
  }
  
  // Block venue grouping
  if (params.groupBy?.includes('venue')) {
    throw new ValidationError(
      'Venue grouping is not allowed for PII_RESTRICTED role',
      400
    )
  }
  
  // Block venue filtering
  if (params.venueIds && params.venueIds.length > 0) {
    throw new ValidationError(
      'Venue filtering is not allowed for PII_RESTRICTED role',
      400
    )
  }
}
```

#### 3. Authorization Middleware

```typescript
interface AuthorizationContext {
  userId: string
  role: UserRole
  authorizedGeographicAreas: string[]
}

function extractAuthContext(jwtToken: string): AuthorizationContext {
  const decoded = verifyJWT(jwtToken)
  return {
    userId: decoded.userId,
    role: decoded.role,
    authorizedGeographicAreas: decoded.geographicAreas
  }
}

function enforceReadOnlyForPIIRestricted(
  context: AuthorizationContext,
  operation: string,
  resourceType: string
): void {
  if (context.role !== UserRole.PII_RESTRICTED) {
    return  // No restrictions for other roles
  }
  
  // Block all write operations
  if (operation !== 'READ') {
    throw new AuthorizationError(
      'PII_RESTRICTED role has read-only access',
      403
    )
  }
  
  // Block read access to certain resource types
  const blockedResources = [
    'participant',
    'venue',
    'activity',
    'assignment',
    'address-history',
    'venue-history'
  ]
  
  if (blockedResources.includes(resourceType)) {
    throw new AuthorizationError(
      `PII_RESTRICTED role does not have access to ${resourceType} resources`,
      403
    )
  }
}
```

#### 4. Route-Level Authorization Middleware

```typescript
// Apply to all routes to check PII_RESTRICTED access
function checkPIIRestrictedAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const context = extractAuthContext(req.headers.authorization)
  
  if (context.role !== UserRole.PII_RESTRICTED) {
    return next()  // No restrictions for other roles
  }
  
  // Check if endpoint is completely blocked
  if (isEndpointBlocked(req.path, context.role)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ENDPOINT_ACCESS_DENIED',
        message: 'PII_RESTRICTED role does not have access to this endpoint'
      }
    })
  }
  
  // For analytics endpoints, validate parameters
  if (req.path.startsWith('/api/v1/analytics')) {
    try {
      validateAnalyticsParams(req.query, context.role)
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: error.message
        }
      })
    }
  }
  
  next()
}
```

### Frontend Components

#### 1. Route Protection

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
}

function ProtectedRoute({ children, allowedRoles, redirectTo = '/dashboard' }: ProtectedRouteProps) {
  const { user } = useAuth()
  
  if (!user) {
    return <Navigate to="/login" />
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={redirectTo} />
  }
  
  return <>{children}</>
}

// Usage in route configuration
const routes = [
  {
    path: '/participants',
    element: (
      <ProtectedRoute allowedRoles={[UserRole.ADMINISTRATOR, UserRole.EDITOR, UserRole.READ_ONLY]}>
        <ParticipantList />
      </ProtectedRoute>
    )
  },
  {
    path: '/analytics/engagement',
    element: (
      <ProtectedRoute allowedRoles={[UserRole.ADMINISTRATOR, UserRole.EDITOR, UserRole.READ_ONLY, UserRole.PII_RESTRICTED]}>
        <EngagementDashboard />
      </ProtectedRoute>
    )
  }
]
```

#### 2. Navigation Filtering

```typescript
interface NavItem {
  label: string
  path: string
  allowedRoles: UserRole[]
}

const navigationItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', allowedRoles: [ALL_ROLES] },
  { label: 'Geographic Areas', path: '/geographic-areas', allowedRoles: [ALL_ROLES] },
  { label: 'Participants', path: '/participants', allowedRoles: [ADMIN, EDITOR, READ_ONLY] },
  { label: 'Venues', path: '/venues', allowedRoles: [ADMIN, EDITOR, READ_ONLY] },
  { label: 'Activities', path: '/activities', allowedRoles: [ADMIN, EDITOR, READ_ONLY] },
  { label: 'Map', path: '/map', allowedRoles: [ADMIN, EDITOR, READ_ONLY] },
  { label: 'Analytics', path: '/analytics', allowedRoles: [ALL_ROLES] },
  { label: 'Configuration', path: '/configuration', allowedRoles: [ALL_ROLES] }
]

function Navigation() {
  const { user } = useAuth()
  
  const visibleItems = navigationItems.filter(item =>
    item.allowedRoles.includes(user.role)
  )
  
  return (
    <nav>
      {visibleItems.map(item => (
        <NavLink key={item.path} to={item.path}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

#### 3. Analytics UI Restrictions

```typescript
interface FilterGroupingPanelProps {
  // ... other props
  suppressVenueOptions?: boolean  // Hide venue grouping and filtering
}

function EngagementDashboard() {
  const { user } = useAuth()
  const suppressVenueOptions = user.role === UserRole.PII_RESTRICTED
  
  return (
    <FilterGroupingPanel
      groupingDimensions={[
        'activityCategory',
        'activityType',
        'geographicArea',
        // 'venue' excluded when suppressVenueOptions is true
        ...(!suppressVenueOptions ? ['venue'] : [])
      ]}
      filterProperties={{
        activityCategory: { loadItems: loadActivityCategories },
        activityType: { loadItems: loadActivityTypes },
        geographicArea: { loadItems: loadGeographicAreas },
        population: { loadItems: loadPopulations },
        // venue excluded when suppressVenueOptions is true
        ...(!suppressVenueOptions ? { venue: { loadItems: loadVenues } } : {})
      }}
      suppressVenueOptions={suppressVenueOptions}
      onUpdate={handleFilterUpdate}
    />
  )
}
```

#### 2. User Management Form

```typescript
interface UserFormProps {
  user?: User
  onSave: (user: User) => void
}

function UserForm({ user, onSave }: UserFormProps) {
  const roleOptions = [
    { value: UserRole.ADMINISTRATOR, label: 'Administrator' },
    { value: UserRole.EDITOR, label: 'Editor' },
    { value: UserRole.READ_ONLY, label: 'Read Only' },
    { value: UserRole.PII_RESTRICTED, label: 'PII Restricted' }
  ]
  
  return (
    <form>
      <select name="role" defaultValue={user?.role}>
        {roleOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Other form fields */}
    </form>
  )
}
```

## Data Models

### User Model (Extended)

```typescript
interface User {
  id: string
  username: string
  email: string
  role: UserRole  // Now includes PII_RESTRICTED
  authorizedGeographicAreas: string[]
  createdAt: Date
  updatedAt: Date
}
```

### JWT Token Payload

```typescript
interface JWTPayload {
  userId: string
  username: string
  role: UserRole  // Includes PII_RESTRICTED
  geographicAreas: string[]
  iat: number  // Issued at
  exp: number  // Expiration
}
```

### Analytics Query Validation

```typescript
interface EngagementQueryParams {
  groupBy?: string[]
  activityCategoryIds?: string[]
  activityTypeIds?: string[]
  geographicAreaIds?: string[]
  venueIds?: string[]  // Blocked for PII_RESTRICTED
  populationIds?: string[]
  startDate?: string
  endDate?: string
}

// Validation applied before processing analytics requests
function validateEngagementQuery(
  params: EngagementQueryParams,
  role: UserRole
): void {
  if (role !== UserRole.PII_RESTRICTED) {
    return
  }
  
  if (params.groupBy?.includes('venue')) {
    throw new ValidationError(
      'Venue grouping is not allowed for PII_RESTRICTED role'
    )
  }
  
  if (params.venueIds && params.venueIds.length > 0) {
    throw new ValidationError(
      'Venue filtering is not allowed for PII_RESTRICTED role'
    )
  }
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system - essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: JWT Token Role Inclusion

*For any* user with PII_RESTRICTED role, when a JWT token is generated, the token payload SHALL contain the PII_RESTRICTED role value.

**Validates: Requirements 1.4**

### Property 2: User Role Persistence

*For any* user created or updated with PII_RESTRICTED role, when the user record is retrieved from storage, the role field SHALL equal PII_RESTRICTED.

**Validates: Requirements 1.3**

### Property 3: Participant API Complete Blocking

*For any* participant-related API endpoint, when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 403 Forbidden.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12**

### Property 4: Venue API Complete Blocking

*For any* venue-related API endpoint, when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 403 Forbidden.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

### Property 5: Activity API Complete Blocking

*For any* activity-related API endpoint, when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 403 Forbidden.

**Validates: Requirements 3A.1, 3A.2, 3A.3, 3A.4, 3A.5, 3A.6, 3A.7, 3A.8, 3A.9, 3A.10, 3A.11, 3A.12, 3A.13, 3A.14**

### Property 6: Map API Complete Blocking

*For any* map-related API endpoint, when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 403 Forbidden.

**Validates: Requirements 3B.1, 3B.2, 3B.3, 3B.4, 3B.5, 3B.6**

### Property 7: Frontend Navigation Filtering

*For any* PII_RESTRICTED user viewing the navigation menu, the frontend SHALL NOT display links to Participants, Venues, Activities, or Map pages.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 8: Frontend Route Protection

*For any* attempt by a PII_RESTRICTED user to navigate directly to blocked pages (/participants, /venues, /activities, /map), the frontend SHALL redirect to an authorized page.

**Validates: Requirements 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11**

### Property 9: Geographic Area Read-Only Access

*For any* geographic area read endpoint, when requested by a user with PII_RESTRICTED role, the backend SHALL return the data if the user is authorized for that geographic area.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 10: Geographic Area Write Blocking

*For any* geographic area write endpoint (POST, PUT, DELETE), when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 403 Forbidden.

**Validates: Requirements 5.6, 5.7, 5.8**

### Property 11: Analytics Venue Grouping Rejection

*For any* analytics request with venue grouping parameter, when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 400 Bad Request.

**Validates: Requirements 6.5**

### Property 12: Analytics Venue Filtering Rejection

*For any* analytics request with venueIds filter parameter, when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 400 Bad Request.

**Validates: Requirements 6.6, 6.7, 6.8, 6.9**

### Property 13: Frontend Venue Option Suppression

*For any* PII_RESTRICTED user viewing analytics dashboards, the frontend SHALL NOT display venue grouping or venue filtering options in the FilterGroupingPanel.

**Validates: Requirements 6.12, 6.13, 6.14**

### Property 14: Configuration Read-Only Access

*For any* configuration resource (activity categories, activity types, roles, populations), when requested via GET by a user with PII_RESTRICTED role, the backend SHALL return the data without redaction.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 15: Configuration Write Blocking

*For any* configuration resource write endpoint (POST, PUT, DELETE), when requested by a user with PII_RESTRICTED role, the backend SHALL reject the request with 403 Forbidden.

**Validates: Requirements 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16**

### Property 16: Geographic Authorization Enforcement

*For any* data request by a user with PII_RESTRICTED role, the backend API SHALL apply geographic authorization rules and reject requests for data outside the user's authorized geographic areas.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 17: JWT Role Extraction

*For any* JWT token containing the PII_RESTRICTED role, when validated by the backend API, the system SHALL correctly extract the role for use in authorization decisions.

**Validates: Requirements 9.2**

## Error Handling

### Authorization Errors

**Scenario**: PII_RESTRICTED user attempts to access blocked endpoint (participants, venues, activities, map)
- **Error Type**: `AuthorizationError`
- **HTTP Status**: 403 Forbidden
- **Error Code**: `ENDPOINT_ACCESS_DENIED`
- **Message**: "PII_RESTRICTED role does not have access to this endpoint"
- **Logging**: Log user ID, attempted endpoint, and timestamp

**Scenario**: PII_RESTRICTED user attempts write operation on allowed resource
- **Error Type**: `AuthorizationError`
- **HTTP Status**: 403 Forbidden
- **Error Code**: `READ_ONLY_ACCESS`
- **Message**: "PII_RESTRICTED role has read-only access"
- **Logging**: Log user ID, attempted operation, resource type, and timestamp

**Scenario**: PII_RESTRICTED user requests data outside authorized geographic areas
- **Error Type**: `AuthorizationError`
- **HTTP Status**: 403 Forbidden
- **Error Code**: `GEOGRAPHIC_AUTHORIZATION_DENIED`
- **Message**: "Access denied: resource outside authorized geographic areas"
- **Logging**: Log user ID, requested resource, and geographic area

### Validation Errors

**Scenario**: PII_RESTRICTED user attempts venue grouping in analytics
- **Error Type**: `ValidationError`
- **HTTP Status**: 400 Bad Request
- **Error Code**: `INVALID_GROUPING_PARAMETER`
- **Message**: "Venue grouping is not allowed for PII_RESTRICTED role"
- **Logging**: Log user ID, attempted grouping parameters, and timestamp

**Scenario**: PII_RESTRICTED user attempts venue filtering in analytics
- **Error Type**: `ValidationError`
- **HTTP Status**: 400 Bad Request
- **Error Code**: `INVALID_FILTER_PARAMETER`
- **Message**: "Venue filtering is not allowed for PII_RESTRICTED role"
- **Logging**: Log user ID, attempted filter parameters, and timestamp

### JWT Validation Errors

**Scenario**: JWT token missing role claim
- **Error Type**: `InvalidTokenError`
- **HTTP Status**: 401 Unauthorized
- **Message**: "Invalid token: missing role claim"
- **Logging**: Log token ID and validation failure reason

**Scenario**: JWT token contains invalid role value
- **Error Type**: `InvalidTokenError`
- **HTTP Status**: 401 Unauthorized
- **Message**: "Invalid token: unrecognized role value"
- **Logging**: Log token ID and invalid role value

### Frontend Error Handling

**Scenario**: PII_RESTRICTED user attempts to navigate to blocked page
- **Behavior**: Redirect to dashboard or unauthorized page
- **User Message**: "You do not have permission to access this page"
- **Logging**: Log attempted navigation and user role

**Scenario**: API returns endpoint access denied error
- **Behavior**: Display error message to user
- **User Message**: "You do not have permission to access this resource"
- **Logging**: Log error details and user action

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library Selection**:
- Backend (TypeScript/Node.js): Use `fast-check` library
- Frontend (TypeScript/React): Use `fast-check` library

**Configuration**:
- Each property test MUST run a minimum of 100 iterations
- Each property test MUST be tagged with a comment referencing the design property
- Tag format: `// Feature: pii-restricted-role, Property {number}: {property_text}`

**Property Test Implementation**:
- Each correctness property listed above MUST be implemented as a SINGLE property-based test
- Tests should generate random valid inputs (participants, venues, users, roles)
- Tests should verify the property holds for all generated inputs

**Example Property Test Structure**:

```typescript
// Feature: pii-restricted-role, Property 3: Participant PII Field Redaction
test('PII_RESTRICTED role redacts all participant PII fields', () => {
  fc.assert(
    fc.property(
      participantArbitrary(),  // Generate random participants
      (participant) => {
        const redacted = redactionService.redactParticipant(
          participant,
          UserRole.PII_RESTRICTED
        )
        
        // Verify all PII fields are null
        expect(redacted.name).toBeNull()
        expect(redacted.email).toBeNull()
        expect(redacted.phone).toBeNull()
        expect(redacted.notes).toBeNull()
        expect(redacted.dateOfBirth).toBeNull()
        expect(redacted.dateOfRegistration).toBeNull()
        expect(redacted.nickname).toBeNull()
        
        // Verify UUID is preserved
        expect(redacted.id).toBe(participant.id)
      }
    ),
    { numRuns: 100 }
  )
})
```

### Unit Testing

**Backend Unit Tests**:
- Test PIIRedactionService with specific participant and venue examples
- Test authorization middleware with different role combinations
- Test JWT token generation and validation with PII_RESTRICTED role
- Test error handling for unauthorized operations
- Test geographic authorization with specific area configurations

**Frontend Unit Tests**:
- Test ParticipantDisplay component with null name values
- Test VenueDisplay component with null name values
- Test UserForm component includes PII_RESTRICTED option
- Test error handling when API returns authorization errors
- Test graceful degradation with unexpected null values

**Integration Tests**:
- Test end-to-end flow: login as PII_RESTRICTED user → request participant data → verify redaction
- Test end-to-end flow: login as PII_RESTRICTED user → attempt write operation → verify rejection
- Test end-to-end flow: login as PII_RESTRICTED user → request data outside geographic area → verify rejection
- Test end-to-end flow: login as different roles → verify different redaction behaviors

### Test Coverage Goals

- **Backend**: 90%+ code coverage for PIIRedactionService and authorization middleware
- **Frontend**: 85%+ code coverage for role-aware display components
- **Property Tests**: All 14 correctness properties implemented
- **Integration Tests**: All critical user flows covered

### Testing Priorities

1. **High Priority**: Property tests for PII redaction (Properties 3-6)
2. **High Priority**: Unit tests for authorization enforcement (Property 11)
3. **Medium Priority**: Property tests for frontend display (Properties 7-10)
4. **Medium Priority**: Integration tests for end-to-end flows
5. **Low Priority**: Unit tests for specific edge cases
