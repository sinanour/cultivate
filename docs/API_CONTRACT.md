# API Contract: Community Activity Tracker

## Overview

This document defines the complete API contract between the Backend API and all client applications (Web Frontend, iOS Mobile App, Android Mobile App). All clients must implement this contract to ensure interoperability and data consistency.

**Version**: 1.0.0  
**Base URL**: `https://api.community-tracker.example.com/api/v1`  
**Protocol**: HTTPS only  
**Format**: JSON  
**Authentication**: JWT Bearer tokens

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### JWT Token Payload

Access tokens contain the following payload:

```json
{
  "userId": "string (UUID)",
  "email": "string",
  "role": "ADMINISTRATOR | EDITOR | READ_ONLY",
  "iat": "number (issued at timestamp)",
  "exp": "number (expiration timestamp)"
}
```

Clients should decode the JWT token to extract user information. The token is signed and should not be modified.

### Token Expiration

- **Access Token**: 15 minutes (900 seconds)
- **Refresh Token**: 7 days (604800 seconds)

Clients should refresh the access token before it expires using the refresh token.

### Login

**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)",
    "refreshToken": "string"
  }
}
```

**Note**: The JWT access token contains the user information (userId, email, role) in its payload. Clients should decode the token to extract user details. Access tokens expire after 15 minutes (900 seconds).

**Errors**:
- 401: Invalid credentials
- 400: Validation error

### Refresh Token

**Endpoint**: `POST /auth/refresh`

**Request**:
```json
{
  "refreshToken": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)",
    "refreshToken": "string"
  }
}
```

**Note**: Returns new access token and refresh token. Refresh tokens expire after 7 days.

**Errors**:
- 401: Invalid or expired refresh token

### Logout

**Endpoint**: `POST /auth/logout`

**Request**: None (requires authentication)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note**: JWT tokens are stateless, so logout is primarily handled client-side by removing tokens from storage. This endpoint is provided for consistency and potential future server-side token invalidation.

### Get Current User

**Endpoint**: `GET /auth/me`

**Request**: None (requires authentication)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "email": "string",
    "role": "ADMINISTRATOR | EDITOR | READ_ONLY",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Errors**:
- 401: Not authenticated
- 404: User not found

## Activities

### List Activities

**Endpoint**: `GET /activities`

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50, max: 100): Items per page

**Response** (200 OK):

**Without Pagination** (when page and limit not provided):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "activityTypeId": "string (UUID)",
      "activityType": {
        "id": "string (UUID)",
        "name": "string",
        "isPredefined": "boolean",
        "version": "number"
      },
      "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
      "startDate": "string (ISO 8601)",
      "endDate": "string | null (ISO 8601)",
      "isOngoing": "boolean",
      "createdBy": "string | null (UUID)",
      "version": "number",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**With Pagination** (when page or limit provided):
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

### Get Activity

**Endpoint**: `GET /activities/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "activityTypeId": "string (UUID)",
    "activityType": {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "version": "number"
    },
    "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
    "startDate": "string (ISO 8601)",
    "endDate": "string | null (ISO 8601)",
    "isOngoing": "boolean",
    "createdBy": "string | null (UUID)",
    "version": "number",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Errors**:
- 404: Activity not found

### Create Activity

**Endpoint**: `POST /activities`

**Request**:
```json
{
  "name": "string",
  "activityTypeId": "string (UUID)",
  "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED (optional, defaults to PLANNED)",
  "startDate": "string (ISO 8601)",
  "endDate": "string | null (ISO 8601, optional)"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "activityTypeId": "string (UUID)",
    "activityType": {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "version": "number"
    },
    "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
    "startDate": "string (ISO 8601)",
    "endDate": "string | null (ISO 8601)",
    "isOngoing": "boolean",
    "createdBy": "string | null (UUID)",
    "version": "number",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Errors**:
- 400: Validation error
- 403: Insufficient permissions

### Update Activity

**Endpoint**: `PUT /activities/:id`

**Request**:
```json
{
  "name": "string (optional)",
  "activityTypeId": "string (UUID, optional)",
  "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED (optional)",
  "startDate": "string (ISO 8601, optional)",
  "endDate": "string | null (ISO 8601, optional)",
  "version": "number (optional, for optimistic locking)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "activityTypeId": "string (UUID)",
    "activityType": {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "version": "number"
    },
    "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
    "startDate": "string (ISO 8601)",
    "endDate": "string | null (ISO 8601)",
    "isOngoing": "boolean",
    "createdBy": "string | null (UUID)",
    "version": "number",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Errors**:
- 404: Activity not found
- 409: Version conflict (when version provided doesn't match current version)
- 403: Insufficient permissions

### Delete Activity

**Endpoint**: `DELETE /activities/:id`

**Response** (204 No Content)

**Errors**:
- 404: Activity not found
- 403: Insufficient permissions

### Get Activity Venues

**Endpoint**: `GET /activities/:id/venues`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "activityId": "string (UUID)",
      "venueId": "string (UUID)",
      "venue": {
        "id": "string (UUID)",
        "name": "string",
        "address": "string",
        "latitude": "number | null",
        "longitude": "number | null"
      },
      "effectiveFrom": "string (ISO 8601)",
      "effectiveTo": "string | null (ISO 8601)"
    }
  ]
}
```

### Add Activity Venue

**Endpoint**: `POST /activities/:id/venues`

**Request**:
```json
{
  "venueId": "string (UUID)"
}
```

**Response** (201 Created): Activity venue association object wrapped in `{ success: true, data: {...} }`

**Note**: The `effectiveFrom` field is automatically set to the current timestamp and is not included in the request.

### Remove Activity Venue

**Endpoint**: `DELETE /activities/:id/venues/:venueId`

**Response** (204 No Content)

## Participants

### List Participants

**Endpoint**: `GET /participants`

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50, max: 100): Items per page

**Response** (200 OK):

**Without Pagination**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "email": "string",
      "phone": "string | null",
      "notes": "string | null",
      "version": "number",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**With Pagination**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

### Get Participant

**Endpoint**: `GET /participants/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "email": "string",
    "phone": "string | null",
    "notes": "string | null",
    "version": "number",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

### Create Participant

**Endpoint**: `POST /participants`

**Request**:
```json
{
  "name": "string",
  "email": "string",
  "phone": "string (optional)",
  "notes": "string (optional)",
  "homeVenueId": "string (UUID, optional)"
}
```

**Response** (201 Created): Participant object wrapped in `{ success: true, data: {...} }`

### Update Participant

**Endpoint**: `PUT /participants/:id`

**Request**:
```json
{
  "name": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "notes": "string (optional)",
  "homeVenueId": "string (UUID, optional)",
  "version": "number (optional, for optimistic locking)"
}
```

**Response** (200 OK): Updated participant object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Participant not found
- 409: Version conflict

### Delete Participant

**Endpoint**: `DELETE /participants/:id`

**Response** (204 No Content)

### Get Participant Address History

**Endpoint**: `GET /participants/:id/address-history`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "participantId": "string (UUID)",
      "venueId": "string (UUID)",
      "venue": {
        "id": "string (UUID)",
        "name": "string",
        "address": "string"
      },
      "effectiveFrom": "string (ISO 8601)",
      "effectiveTo": "string | null (ISO 8601)"
    }
  ]
}
```

### Get Participant Activities

**Endpoint**: `GET /participants/:id/activities`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "activityId": "string (UUID)",
      "participantId": "string (UUID)",
      "roleId": "string (UUID)",
      "notes": "string | null",
      "activity": {
        "id": "string (UUID)",
        "name": "string",
        "activityTypeId": "string (UUID)",
        "activityType": {
          "id": "string (UUID)",
          "name": "string",
          "isPredefined": "boolean"
        },
        "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
        "startDate": "string (ISO 8601)",
        "endDate": "string | null (ISO 8601)",
        "isOngoing": "boolean"
      },
      "role": {
        "id": "string (UUID)",
        "name": "string",
        "isPredefined": "boolean"
      },
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

**Errors**:
- 404: Participant not found

## Venues

### List Venues

**Endpoint**: `GET /venues`

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50, max: 100): Items per page

**Response** (200 OK):

**Without Pagination**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "address": "string",
      "geographicAreaId": "string (UUID)",
      "geographicArea": {
        "id": "string (UUID)",
        "name": "string",
        "areaType": "string"
      },
      "latitude": "number | null",
      "longitude": "number | null",
      "venueType": "PUBLIC_BUILDING | PRIVATE_RESIDENCE | null",
      "version": "number",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**With Pagination**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

### Get Venue

**Endpoint**: `GET /venues/:id`

**Response** (200 OK): Single venue object wrapped in `{ success: true, data: {...} }`

### Create Venue

**Endpoint**: `POST /venues`

**Request**:
```json
{
  "name": "string",
  "address": "string",
  "geographicAreaId": "string (UUID)",
  "latitude": "number | null",
  "longitude": "number | null",
  "venueType": "PUBLIC_BUILDING | PRIVATE_RESIDENCE | null"
}
```

**Response** (201 Created): Venue object wrapped in `{ success: true, data: {...} }`

### Update Venue

**Endpoint**: `PUT /venues/:id`

**Request**:
```json
{
  "name": "string (optional)",
  "address": "string (optional)",
  "geographicAreaId": "string (UUID, optional)",
  "latitude": "number (optional)",
  "longitude": "number (optional)",
  "venueType": "PUBLIC_BUILDING | PRIVATE_RESIDENCE (optional)",
  "version": "number (optional, for optimistic locking)"
}
```

**Response** (200 OK): Updated venue object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Venue not found
- 409: Version conflict

### Delete Venue

**Endpoint**: `DELETE /venues/:id`

**Response** (204 No Content)

**Errors**:
- 404: Venue not found
- 400: Venue is referenced by activities or participants (code: REFERENCED_ENTITY)

### Search Venues

**Endpoint**: `GET /venues/search`

**Query Parameters**:
- `q` (required): Search query

**Response** (200 OK): Array of venue objects wrapped in `{ success: true, data: [...] }`

**Note**: The `limit` parameter is not currently implemented.

### Get Venue Activities

**Endpoint**: `GET /venues/:id/activities`

**Response** (200 OK): Array of activities associated with venue wrapped in `{ success: true, data: [...] }`

### Get Venue Participants

**Endpoint**: `GET /venues/:id/participants`

**Response** (200 OK): Array of participants with this venue as home wrapped in `{ success: true, data: [...] }`

## Geographic Areas

### List Geographic Areas

**Endpoint**: `GET /geographic-areas`

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50, max: 100): Items per page

**Response** (200 OK):

**Without Pagination**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "areaType": "NEIGHBOURHOOD | COMMUNITY | CITY | CLUSTER | COUNTY | PROVINCE | STATE | COUNTRY | CUSTOM",
      "parentGeographicAreaId": "string | null (UUID)",
      "parent": {
        "id": "string (UUID)",
        "name": "string",
        "areaType": "string"
      } | null,
      "version": "number",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**With Pagination**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

### Get Geographic Area

**Endpoint**: `GET /geographic-areas/:id`

**Response** (200 OK): Single geographic area object wrapped in `{ success: true, data: {...} }`

### Create Geographic Area

**Endpoint**: `POST /geographic-areas`

**Request**:
```json
{
  "name": "string",
  "areaType": "NEIGHBOURHOOD | COMMUNITY | CITY | CLUSTER | COUNTY | PROVINCE | STATE | COUNTRY | CUSTOM",
  "parentGeographicAreaId": "string | null (UUID)"
}
```

**Response** (201 Created): Geographic area object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 400: Circular relationship detected

### Update Geographic Area

**Endpoint**: `PUT /geographic-areas/:id`

**Request**:
```json
{
  "name": "string (optional)",
  "areaType": "NEIGHBOURHOOD | COMMUNITY | CITY | CLUSTER | COUNTY | PROVINCE | STATE | COUNTRY | CUSTOM (optional)",
  "parentGeographicAreaId": "string | null (UUID, optional)",
  "version": "number (optional, for optimistic locking)"
}
```

**Response** (200 OK): Updated geographic area object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Geographic area not found
- 409: Version conflict
- 400: Circular relationship detected

### Delete Geographic Area

**Endpoint**: `DELETE /geographic-areas/:id`

**Response** (204 No Content)

**Errors**:
- 404: Geographic area not found
- 400: Area is referenced by venues or child areas (code: REFERENCED_ENTITY)

### Get Geographic Area Children

**Endpoint**: `GET /geographic-areas/:id/children`

**Response** (200 OK): Array of child geographic areas wrapped in `{ success: true, data: [...] }`

### Get Geographic Area Ancestors

**Endpoint**: `GET /geographic-areas/:id/ancestors`

**Response** (200 OK): Array of ancestor geographic areas (from parent to root) wrapped in `{ success: true, data: [...] }`

### Get Geographic Area Venues

**Endpoint**: `GET /geographic-areas/:id/venues`

**Response** (200 OK): Array of venues in this geographic area wrapped in `{ success: true, data: [...] }`

### Get Geographic Area Statistics

**Endpoint**: `GET /geographic-areas/:id/statistics`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalActivities": "number",
    "totalParticipants": "number",
    "totalVenues": "number",
    "activeActivities": "number"
  }
}
```

**Note**: Statistics always include descendants. The `includeDescendants` parameter and `ongoingActivities` field are not currently implemented.

## Activity Participants

### List Activity Participants

**Endpoint**: `GET /activities/:activityId/participants`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "activityId": "string (UUID)",
      "participantId": "string (UUID)",
      "roleId": "string (UUID)",
      "notes": "string | null",
      "participant": {
        "id": "string (UUID)",
        "name": "string",
        "email": "string"
      },
      "role": {
        "id": "string (UUID)",
        "name": "string",
        "isPredefined": "boolean",
        "version": "number"
      },
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

### Add Participant to Activity

**Endpoint**: `POST /activities/:activityId/participants`

**Request**:
```json
{
  "participantId": "string (UUID)",
  "roleId": "string (UUID)",
  "notes": "string (optional)"
}
```

**Response** (201 Created): Activity participant object wrapped in `{ success: true, data: {...} }`

### Update Activity Participant

**Endpoint**: `PUT /activities/:activityId/participants/:participantId`

**Request**:
```json
{
  "roleId": "string (UUID, optional)",
  "notes": "string (optional)"
}
```

**Response** (200 OK): Updated activity participant object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Activity or participant not found

### Remove Participant from Activity

**Endpoint**: `DELETE /activities/:activityId/participants/:participantId`

**Response** (204 No Content)

## Activity Types

### List Activity Types

**Endpoint**: `GET /activity-types`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "version": "number",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

### Create Activity Type

**Endpoint**: `POST /activity-types`

**Request**:
```json
{
  "name": "string"
}
```

**Response** (201 Created): Activity type object wrapped in `{ success: true, data: {...} }`

### Update Activity Type

**Endpoint**: `PUT /activity-types/:id`

**Request**:
```json
{
  "name": "string",
  "version": "number (optional, for optimistic locking)"
}
```

**Response** (200 OK): Updated activity type object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Activity type not found
- 409: Version conflict

### Delete Activity Type

**Endpoint**: `DELETE /activity-types/:id`

**Response** (204 No Content)

**Errors**:
- 404: Activity type not found
- 400: Activity type is referenced by activities (code: REFERENCED_ENTITY)

## Participant Roles

### List Participant Roles

**Endpoint**: `GET /roles`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "version": "number",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: The endpoint is `/roles` not `/participant-roles`.

### Create Participant Role

**Endpoint**: `POST /roles`

**Request**:
```json
{
  "name": "string"
}
```

**Response** (201 Created): Participant role object wrapped in `{ success: true, data: {...} }`

### Update Participant Role

**Endpoint**: `PUT /roles/:id`

**Request**:
```json
{
  "name": "string",
  "version": "number (optional, for optimistic locking)"
}
```

**Response** (200 OK): Updated participant role object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Role not found
- 409: Version conflict

### Delete Participant Role

**Endpoint**: `DELETE /roles/:id`

**Response** (204 No Content)

**Errors**:
- 404: Role not found
- 400: Role is referenced by assignments (code: REFERENCED_ENTITY)

## Analytics

### Get Engagement Metrics

**Endpoint**: `GET /analytics/engagement`

**Query Parameters**:
- `startDate` (optional): Period start (ISO 8601)
- `endDate` (optional): Period end (ISO 8601)
- `geographicAreaId` (optional): Filter by geographic area

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalActivities": "number",
    "activeActivities": "number",
    "totalParticipants": "number",
    "activeParticipants": "number",
    "participationRate": "number",
    "retentionRate": "number",
    "averageActivitySize": "number",
    "geographicBreakdown": [
      {
        "geographicAreaId": "string (UUID)",
        "geographicAreaName": "string",
        "activityCount": "number",
        "participantCount": "number"
      }
    ],
    "periodStart": "string (ISO 8601)",
    "periodEnd": "string (ISO 8601)"
  }
}
```

**Note**: Date parameters are optional, not required.

### Get Growth Data

**Endpoint**: `GET /analytics/growth`

**Query Parameters**:
- `startDate` (optional): Period start (ISO 8601)
- `endDate` (optional): Period end (ISO 8601)
- `period` (optional, default: "DAY"): Grouping interval (DAY, WEEK, MONTH, YEAR)
- `geographicAreaId` (optional): Filter by geographic area

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "date": "string (ISO 8601)",
      "newParticipants": "number",
      "newActivities": "number",
      "cumulativeParticipants": "number",
      "cumulativeActivities": "number"
    }
  ]
}
```

**Note**: The parameter is `period` not `interval`, and date parameters are optional.

### Get Geographic Analytics

**Endpoint**: `GET /analytics/geographic`

**Query Parameters**:
- `startDate` (optional): Period start (ISO 8601)
- `endDate` (optional): Period end (ISO 8601)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "geographicAreaId": "string (UUID)",
      "geographicAreaName": "string",
      "areaType": "string",
      "totalActivities": "number",
      "activeActivities": "number",
      "totalParticipants": "number",
      "activeParticipants": "number"
    }
  ]
}
```

**Note**: The `geographicAreaId` filter parameter is not currently implemented for this endpoint.

## Synchronization

### Batch Sync

**Endpoint**: `POST /sync/batch`

**Request**:
```json
{
  "clientId": "string (UUID)",
  "operations": [
    {
      "id": "string (UUID)",
      "entityType": "Activity | Participant | ActivityParticipant | Venue | GeographicArea",
      "entityId": "string (UUID)",
      "operation": "CREATE | UPDATE | DELETE",
      "data": {},
      "timestamp": "string (ISO 8601)",
      "version": "number"
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "operationId": "string (UUID)",
        "success": "boolean",
        "error": {
          "code": "string",
          "message": "string"
        } | null,
        "entity": {} | null
      }
    ],
    "syncState": {
      "clientId": "string (UUID)",
      "lastSyncTimestamp": "string (ISO 8601)",
      "pendingOperations": "number",
      "conflictCount": "number"
    }
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "code": "string",
  "message": "string",
  "details": {}
}
```

**Note**: The `timestamp` and `requestId` fields are not currently included in error responses.

### Error Codes

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

## Rate Limits

Rate limiting is implemented on all API endpoints:

- Authentication endpoints: 5 requests/minute per IP
- Mutation endpoints: 100 requests/minute per user
- Query endpoints: 1000 requests/minute per user

Rate limit headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp (Unix)

## Versioning

API version is included in the URL path: `/api/v1/...`

Breaking changes will increment the major version: `/api/v2/...`

## CORS

CORS is enabled for all origins in development.

Production CORS policy:
- Allowed origins: Configured web frontend domains
- Allowed methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed headers: Authorization, Content-Type
- Max age: 86400 seconds

## Pagination

Pagination is implemented on all list endpoints:

**Query Parameters**:
- `page` (default: 1): Page number
- `limit` (default: 50, max: 100): Items per page

**Response**:
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

**Note**: Pagination is optional. If `page` or `limit` parameters are not provided, all results are returned without pagination metadata.

## Timestamps

All timestamps use ISO 8601 format with UTC timezone:
- Format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Example: `2024-01-15T14:30:00.000Z`

## Implementation Checklist

### Backend API
- [x] Implement all endpoints
- [x] Add request validation with Zod
- [x] Implement JWT authentication
- [x] Add rate limiting
- [x] Generate OpenAPI specification
- [x] Add integration tests
- [x] Implement pagination
- [x] Implement optimistic locking
- [x] Add API versioning

### Web Frontend
- [ ] Generate TypeScript types from OpenAPI spec
- [ ] Implement API client with retry logic
- [ ] Add authentication interceptors
- [ ] Implement offline queue
- [ ] Add error handling
- [ ] Handle pagination
- [ ] Handle optimistic locking (version conflicts)
- [ ] Handle rate limiting (429 responses)

### iOS Mobile App
- [ ] Generate Swift models from OpenAPI spec
- [ ] Implement URLSession-based client
- [ ] Add Keychain token storage
- [ ] Implement offline queue
- [ ] Add error handling
- [ ] Handle pagination
- [ ] Handle optimistic locking
- [ ] Handle rate limiting

### Android Mobile App
- [ ] Generate Kotlin models from OpenAPI spec
- [ ] Implement Retrofit client
- [ ] Add encrypted token storage
- [ ] Implement offline queue with WorkManager
- [ ] Add error handling
- [ ] Handle pagination
- [ ] Handle optimistic locking
- [ ] Handle rate limiting

## Key Implementation Notes

### Optimistic Locking

All entities (Activity, Participant, Venue, GeographicArea, ActivityType, Role) support optimistic locking:

1. **Version Field**: All entities include a `version` field (integer, starts at 1)
2. **Update Requests**: Optionally include `version` field in PUT requests
3. **Version Check**: If version provided, server validates it matches current version
4. **Conflict Response**: Returns 409 Conflict if version mismatch
5. **Version Increment**: Server increments version on successful update

**Example Update with Optimistic Locking**:
```json
PUT /api/v1/activities/123

{
  "name": "Updated Activity",
  "version": 3
}

// Success: Returns updated activity with version: 4
// Conflict: Returns 409 with VERSION_CONFLICT code
```

### Pagination

All list endpoints support optional pagination:

1. **Optional**: Pagination is opt-in via query parameters
2. **Without Pagination**: Returns all results in `data` array
3. **With Pagination**: Include `page` or `limit` parameter to get paginated response
4. **Metadata**: Paginated responses include `pagination` object with page, limit, total, totalPages
5. **Limits**: Default limit is 50, maximum is 100

**Example Paginated Request**:
```
GET /api/v1/activities?page=2&limit=25
```

### Rate Limiting

Rate limits are enforced per endpoint type:

1. **Authentication**: 5 requests/minute per IP address
2. **Mutations** (POST, PUT, DELETE): 100 requests/minute per user
3. **Queries** (GET): 1000 requests/minute per user
4. **Headers**: All responses include X-RateLimit-* headers
5. **Exceeded**: Returns 429 Too Many Requests with RATE_LIMIT_EXCEEDED code

### Computed Fields

Some fields are computed by the server and not stored in the database:

1. **isPredefined** (ActivityType, Role): True if the entity is a seeded predefined value
2. **isOngoing** (Activity): True if endDate is null

### Authentication Flow

1. **Login**: POST /api/v1/auth/login with email/password
2. **Token**: Receive JWT access token (15 min expiry) and refresh token (7 day expiry)
3. **Requests**: Include `Authorization: Bearer <token>` header
4. **Refresh**: POST /api/v1/auth/refresh with refresh token before access token expires
5. **Logout**: POST /api/v1/auth/logout (client-side token removal)
