# Design Document: PII-Restricted Role

## Overview

This design implements a new PII_RESTRICTED role in the Cultivate system that provides read-only access while redacting all personally identifiable information (PII). The implementation spans both backend-api and web-frontend packages, requiring changes to authorization logic, data serialization, and UI rendering.

The core design principle is **defense in depth**: PII redaction occurs at the API response layer (not database query layer) to ensure consistent behavior across all endpoints and prevent accidental PII leakage through new endpoints or code paths.

### Key Design Decisions

1. **Response-layer redaction**: Apply PII filtering after data retrieval but before serialization, ensuring all endpoints automatically inherit redaction logic
2. **UUID-based identification**: Use UUIDs as the primary identifier for participants when names are redacted
3. **Address substitution**: Display venue addresses instead of names, as addresses are less personally identifying
4. **Role hierarchy**: PII_RESTRICTED is more restrictive than READ_ONLY, inheriting read-only permissions plus additional PII restrictions
5. **Graceful degradation**: Frontend handles null values elegantly, displaying alternative identifiers without errors

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Frontend                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Role-aware UI Components                            │  │
│  │  - ParticipantDisplay (shows UUID for PII_RESTRICTED)│  │
│  │  - VenueDisplay (shows address for PII_RESTRICTED)   │  │
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
│  │  - Geographic authorization                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Response Serialization Layer                        │  │
│  │  - PII Redaction Filter                              │  │
│  │  - Role-based field filtering                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                                │  │
│  │  - Participant service                               │  │
│  │  - Venue service                                     │  │
│  │  - User service                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Access Layer                                   │  │
│  │  - Database queries (unchanged)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Authentication**: User logs in, receives JWT token containing role information
2. **Request**: Frontend sends API request with JWT token in Authorization header
3. **Authorization**: Backend validates JWT, extracts role, applies geographic authorization
4. **Data Retrieval**: Business logic retrieves data from database (no filtering at this layer)
5. **PII Redaction**: Response serialization layer applies role-based field filtering
6. **Response**: Redacted data returned to frontend
7. **Display**: Frontend renders data using role-aware components

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

#### 2. PII Redaction Service

```typescript
interface PIIRedactionService {
  // Redact participant PII fields based on user role
  redactParticipant(participant: Participant, role: UserRole): Participant
  
  // Redact venue PII fields based on user role
  redactVenue(venue: Venue, role: UserRole): Venue
  
  // Redact address history venue information
  redactAddressHistory(history: AddressHistory[], role: UserRole): AddressHistory[]
}

class PIIRedactionServiceImpl implements PIIRedactionService {
  redactParticipant(participant: Participant, role: UserRole): Participant {
    if (role !== UserRole.PII_RESTRICTED) {
      return participant
    }
    
    return {
      id: participant.id,  // UUID preserved
      name: null,
      email: null,
      phone: null,
      notes: null,
      dateOfBirth: null,
      dateOfRegistration: null,
      nickname: null,
      addressHistory: [],  // Home addresses are PII - return empty array
      // Other non-PII fields preserved
      ...preserveNonPIIFields(participant)
    }
  }
  
  redactVenue(venue: Venue, role: UserRole): Venue {
    if (role !== UserRole.PII_RESTRICTED) {
      return venue
    }
    
    return {
      ...venue,
      name: null,  // Name redacted
      participants: [],  // Participant associations are PII - return empty array
      address: venue.address,  // Address preserved
      latitude: venue.latitude,
      longitude: venue.longitude,
      geographicAreaId: venue.geographicAreaId
      // Other non-PII fields preserved
    }
  }
  
  // redactAddressHistory method removed - no longer needed
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

function enforceReadOnlyForPIIRestricted(context: AuthorizationContext, operation: string): void {
  if (context.role === UserRole.PII_RESTRICTED && operation !== 'READ') {
    throw new AuthorizationError('PII_RESTRICTED role has read-only access')
  }
}
```

#### 4. Response Serialization Interceptor

```typescript
interface ResponseInterceptor {
  intercept(data: any, context: AuthorizationContext): any
}

class PIIRedactionInterceptor implements ResponseInterceptor {
  constructor(private redactionService: PIIRedactionService) {}
  
  intercept(data: any, context: AuthorizationContext): any {
    if (context.role !== UserRole.PII_RESTRICTED) {
      return data
    }
    
    // Handle single objects
    if (isParticipant(data)) {
      return this.redactionService.redactParticipant(data, context.role)
    }
    if (isVenue(data)) {
      return this.redactionService.redactVenue(data, context.role)
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.intercept(item, context))
    }
    
    // Handle nested objects
    if (typeof data === 'object' && data !== null) {
      const result = {}
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.intercept(value, context)
      }
      return result
    }
    
    return data
  }
}
```

### Frontend Components

#### 1. Role-Aware Display Components

```typescript
interface DisplayProps {
  participant?: Participant
  venue?: Venue
  currentUserRole: UserRole
}

function ParticipantDisplay({ participant, currentUserRole }: DisplayProps) {
  if (!participant) return null
  
  // For PII_RESTRICTED users, display UUID instead of name
  const displayName = currentUserRole === UserRole.PII_RESTRICTED
    ? participant.id
    : participant.name || participant.id
  
  return <span>{displayName}</span>
}

function VenueDisplay({ venue, currentUserRole }: DisplayProps) {
  if (!venue) return null
  
  // For PII_RESTRICTED users, display address instead of name
  const displayName = currentUserRole === UserRole.PII_RESTRICTED
    ? venue.address
    : venue.name || venue.address
  
  return <span>{displayName}</span>
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

### Participant Model (Response)

```typescript
interface Participant {
  id: string  // UUID - always present
  name: string | null  // Null for PII_RESTRICTED
  email: string | null  // Null for PII_RESTRICTED
  phone: string | null  // Null for PII_RESTRICTED
  notes: string | null  // Null for PII_RESTRICTED
  dateOfBirth: Date | null  // Null for PII_RESTRICTED
  dateOfRegistration: Date | null  // Null for PII_RESTRICTED
  nickname: string | null  // Null for PII_RESTRICTED
  addressHistory: AddressHistory[]  // Empty array for PII_RESTRICTED (home addresses are PII)
  // Non-PII fields always present
  status: string
  tags: string[]
  customFields: Record<string, any>
}
```

### Venue Model (Response)

```typescript
interface Venue {
  id: string  // UUID - always present
  name: string | null  // Null for PII_RESTRICTED
  address: string  // Always present
  latitude: number  // Always present
  longitude: number  // Always present
  geographicAreaId: string  // Always present
  participants: Participant[]  // Empty array for PII_RESTRICTED (home addresses are PII)
  // Other non-PII fields always present
  capacity: number
  type: string
  amenities: string[]
}
```

### Address History Model

```typescript
interface AddressHistory {
  id: string
  participantId: string
  venue: Venue  // Not returned for PII_RESTRICTED (entire array is empty)
  startDate: Date
  endDate: Date | null
  isPrimary: boolean
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

### Property 3: Participant PII Field Redaction

*For any* participant object, when requested by a user with PII_RESTRICTED role, the response SHALL have null values for all PII fields (name, email, phone, notes, dateOfBirth, dateOfRegistration, nickname) while preserving the UUID field, and SHALL return an empty array for addressHistory.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

### Property 4: Participant Address History Complete Hiding

*For any* participant with address history, when requested by a user with PII_RESTRICTED role, the addressHistory field SHALL be an empty array (not redacted records, but completely hidden).

**Validates: Requirements 2.9, 2.10**

### Property 5: Venue Name Redaction

*For any* venue object, when requested by a user with PII_RESTRICTED role, the response SHALL have a null value for the name field.

**Validates: Requirements 3.1**

### Property 6: Venue Non-PII Field Preservation and Participant Association Hiding

*For any* venue object, when requested by a user with PII_RESTRICTED role, the response SHALL contain all non-PII fields (address, latitude, longitude, geographicAreaId) with their original values, and SHALL return an empty array for any participant associations.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

### Property 7: Frontend Participant UUID Display

*For any* participant rendered in the frontend for a user with PII_RESTRICTED role, the displayed identifier SHALL be the participant UUID, not the name.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 8: Frontend Null Value Handling

*For any* participant with null field values, when rendered in the frontend, the system SHALL not throw errors and SHALL display alternative identifiers gracefully.

**Validates: Requirements 4.4**

### Property 9: Frontend Venue Address Display

*For any* venue rendered in the frontend for a user with PII_RESTRICTED role, the displayed identifier SHALL be the venue address, not the name.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: Frontend Venue Null Name Fallback

*For any* venue with a null name field, when rendered in the frontend, the system SHALL display the address field as the fallback identifier.

**Validates: Requirements 5.4**

### Property 11: Write Operation Rejection

*For any* create, update, or delete operation attempted by a user with PII_RESTRICTED role, the backend API SHALL reject the request with an authorization error.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 12: Non-PII Resource Access

*For any* non-PII resource (analytics dashboards, geographic areas, activity types, activity categories, roles, populations), when requested by a user with PII_RESTRICTED role, the response SHALL contain all fields without redaction.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

### Property 13: Geographic Authorization Enforcement

*For any* data request by a user with PII_RESTRICTED role, the backend API SHALL apply geographic authorization rules and reject requests for data outside the user's authorized geographic areas.

**Validates: Requirements 8.1, 8.2**

### Property 14: JWT Role Extraction

*For any* JWT token containing the PII_RESTRICTED role, when validated by the backend API, the system SHALL correctly extract the role for use in authorization decisions.

**Validates: Requirements 9.2**

## Error Handling

### Authorization Errors

**Scenario**: PII_RESTRICTED user attempts write operation
- **Error Type**: `AuthorizationError`
- **HTTP Status**: 403 Forbidden
- **Message**: "PII_RESTRICTED role has read-only access"
- **Logging**: Log user ID, attempted operation, and timestamp

**Scenario**: PII_RESTRICTED user requests data outside authorized geographic areas
- **Error Type**: `AuthorizationError`
- **HTTP Status**: 403 Forbidden
- **Message**: "Access denied: resource outside authorized geographic areas"
- **Logging**: Log user ID, requested resource, and geographic area

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

**Scenario**: API returns unexpected null values
- **Behavior**: Display fallback identifier (UUID for participants, address for venues)
- **User Message**: None (graceful degradation)
- **Logging**: Log warning with entity type and ID

**Scenario**: API returns authorization error
- **Behavior**: Display error message to user
- **User Message**: "You do not have permission to perform this action"
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
