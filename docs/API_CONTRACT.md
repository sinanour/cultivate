# API Contract: Community Activity Tracker

## Overview

This document defines the complete API contract between the Backend API and all client applications (Web Frontend, iOS Mobile App, Android Mobile App). All clients must implement this contract to ensure interoperability and data consistency.

**Version**: 1.0.0  
**Base URL**: `https://api.community-tracker.example.com/api`  
**Protocol**: HTTPS only  
**Format**: JSON  
**Authentication**: JWT Bearer tokens

**Note**: API versioning is not currently implemented in the URL path. Future versions will use `/api/v2/...` for breaking changes.

## Authentication

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
    "token": "string (JWT)",
    "refreshToken": "string",
    "user": {
      "id": "string (UUID)",
      "email": "string",
      "name": "string",
      "systemRole": "ADMINISTRATOR | EDITOR | READ_ONLY"
    },
    "expiresIn": 900
  }
}
```

**Note**: `expiresIn` is in seconds (900 = 15 minutes for access tokens)

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
    "token": "string (JWT)",
    "refreshToken": "string",
    "expiresIn": 900
  }
}
```

## Activities

### List Activities

**Endpoint**: `GET /activities`

**Query Parameters**:
- `status` (optional): Filter by status (Planning, Active, Completed, Archived)
- `activityTypeId` (optional): Filter by activity type
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "description": "string",
      "activityType": {
        "id": "string (UUID)",
        "name": "string"
      },
      "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
      "startDate": "string (ISO 8601)",
      "endDate": "string | null (ISO 8601)",
      "venues": [
        {
          "id": "string (UUID)",
          "activityId": "string (UUID)",
          "venueId": "string (UUID)",
          "venue": {
            "id": "string (UUID)",
            "name": "string",
            "address": "string"
          },
          "effectiveFrom": "string (ISO 8601)",
          "effectiveTo": "string | null (ISO 8601)"
        }
      ],
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: Pagination is not currently implemented. The `isOngoing`, `createdBy`, and `version` fields are not included in responses.

### Get Activity

**Endpoint**: `GET /activities/:id`

**Response** (200 OK): Single activity object (same structure as list item)

**Note**: Returns `{ success: true, data: {...} }` wrapper

**Errors**:
- 404: Activity not found

### Create Activity

**Endpoint**: `POST /activities`

**Request**:
```json
{
  "name": "string",
  "description": "string",
  "activityTypeId": "string (UUID)",
  "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
  "startDate": "string (ISO 8601)",
  "endDate": "string | null (ISO 8601)"
}
```

**Response** (201 Created): Activity object wrapped in `{ success: true, data: {...} }`

**Note**: Status values use uppercase (PLANNED not Planning). The `isOngoing` field is not used in requests.

**Errors**:
- 400: Validation error
- 403: Insufficient permissions

### Update Activity

**Endpoint**: `PUT /activities/:id`

**Request**: Same as create (no version field required)

**Response** (200 OK): Updated activity object wrapped in `{ success: true, data: {...} }`

**Errors**:
- 404: Activity not found
- 403: Insufficient permissions

**Note**: Optimistic locking with version field is not currently implemented.

### Delete Activity

**Endpoint**: `DELETE /activities/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Activity deleted successfully"
}
```

**Errors**:
- 404: Activity not found
- 403: Insufficient permissions

**Note**: Returns 200 with JSON body, not 204 No Content

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

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Venue association removed successfully"
}
```

**Note**: The `effectiveTo` query parameter is not required. The association is automatically closed with the current timestamp.

## Participants

### List Participants

**Endpoint**: `GET /participants`

**Query Parameters**:
- `search` (optional): Search by name or email
- `page` (optional, default: 1)
- `limit` (optional, default: 50)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "email": "string | null",
      "phone": "string | null",
      "notes": "string",
      "homeVenueId": "string | null (UUID)",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: Pagination is not currently implemented. The `version` field is not included in responses.

### Get Participant

**Endpoint**: `GET /participants/:id`

**Response** (200 OK): Single participant object wrapped in `{ success: true, data: {...} }`

### Create Participant

**Endpoint**: `POST /participants`

**Request**:
```json
{
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "notes": "string",
  "homeVenueId": "string | null (UUID)"
}
```

**Response** (201 Created): Participant object wrapped in `{ success: true, data: {...} }`

### Update Participant

**Endpoint**: `PUT /participants/:id`

**Request**: Same as create (no version field required)

**Response** (200 OK): Updated participant object wrapped in `{ success: true, data: {...} }`

### Delete Participant

**Endpoint**: `DELETE /participants/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Participant deleted successfully"
}
```

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

## Venues

### List Venues

**Endpoint**: `GET /venues`

**Query Parameters**:
- `geographicAreaId` (optional): Filter by geographic area
- `search` (optional): Search by name or address
- `page` (optional, default: 1)
- `limit` (optional, default: 50)

**Response** (200 OK):
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
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: Pagination is not currently implemented.

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

**Request**: Same as create

**Response** (200 OK): Updated venue object wrapped in `{ success: true, data: {...} }`

### Delete Venue

**Endpoint**: `DELETE /venues/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Venue deleted successfully"
}
```

**Errors**:
- 409: Venue is referenced by activities or participants (returns 400 with code REFERENCED_ENTITY)

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
- `parentId` (optional): Filter by parent area
- `areaType` (optional): Filter by area type
- `page` (optional, default: 1)
- `limit` (optional, default: 50)

**Response** (200 OK):
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
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: Pagination is not currently implemented.

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

**Request**: Same as create

**Response** (200 OK): Updated geographic area object wrapped in `{ success: true, data: {...} }`

### Delete Geographic Area

**Endpoint**: `DELETE /geographic-areas/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Geographic area deleted successfully"
}
```

**Errors**:
- 409: Area is referenced by venues or child areas (returns 400 with code REFERENCED_ENTITY)

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

**Query Parameters**:
- `includeDescendants` (optional, default: true): Include statistics from child areas

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "geographicAreaId": "string (UUID)",
    "totalActivities": "number",
    "totalParticipants": "number",
    "activeActivities": "number",
    "ongoingActivities": "number"
  }
}
```

**Note**: The `includeDescendants` parameter is not currently implemented. Statistics always include descendants.

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
      "participant": {
        "id": "string (UUID)",
        "name": "string",
        "email": "string | null"
      },
      "role": {
        "id": "string (UUID)",
        "name": "string"
      },
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: The `joinedAt` and `notes` fields are not currently included in responses. The `isPredefined` field is not included in role objects.

### Add Participant to Activity

**Endpoint**: `POST /activities/:activityId/participants`

**Request**:
```json
{
  "participantId": "string (UUID)",
  "roleId": "string (UUID)"
}
```

**Response** (201 Created): Activity participant object wrapped in `{ success: true, data: {...} }`

**Note**: The `notes` field is not currently supported in requests.

### Update Activity Participant

**Endpoint**: `PUT /activities/:activityId/participants/:participantId`

**Status**: NOT IMPLEMENTED

**Note**: This endpoint is documented in the contract but not yet implemented in the backend.

### Remove Participant from Activity

**Endpoint**: `DELETE /activities/:activityId/participants/:participantId`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Participant removed from activity successfully"
}
```

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
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: The `isPredefined` field is not currently included in responses.

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
  "name": "string"
}
```

**Response** (200 OK): Updated activity type object wrapped in `{ success: true, data: {...} }`

### Delete Activity Type

**Endpoint**: `DELETE /activity-types/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Activity type deleted successfully"
}
```

**Errors**:
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
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```

**Note**: The endpoint is `/roles` not `/participant-roles`. The `isPredefined` field is not currently included in responses.

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
  "name": "string"
}
```

**Response** (200 OK): Updated participant role object wrapped in `{ success: true, data: {...} }`

### Delete Participant Role

**Endpoint**: `DELETE /roles/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

**Errors**:
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
- `VERSION_CONFLICT`: Optimistic locking conflict
- `CIRCULAR_REFERENCE`: Circular relationship detected
- `REFERENCED_ENTITY`: Entity is referenced and cannot be deleted
- `INTERNAL_ERROR`: Unexpected server error

## Rate Limits

**Status**: NOT IMPLEMENTED

Rate limiting is planned but not currently implemented in the API.

Planned rate limits:
- Authentication endpoints: 5 requests/minute per IP
- Mutation endpoints: 100 requests/minute per user
- Query endpoints: 1000 requests/minute per user

Planned rate limit headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp (Unix)

## Versioning

**Status**: NOT IMPLEMENTED

API versioning in the URL path is not currently implemented. All endpoints use `/api/...` without a version number.

Future breaking changes will increment the major version: `/api/v2/...`

## CORS

CORS is enabled for all origins in development.

Production CORS policy:
- Allowed origins: Configured web frontend domains
- Allowed methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed headers: Authorization, Content-Type
- Max age: 86400 seconds

## Pagination

**Status**: NOT IMPLEMENTED

Pagination is planned but not currently implemented. All list endpoints return complete result sets without pagination.

Planned pagination format:

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

## Timestamps

All timestamps use ISO 8601 format with UTC timezone:
- Format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Example: `2024-01-15T14:30:00.000Z`

## Implementation Checklist

### Backend API
- [ ] Implement all endpoints
- [ ] Add request validation with Zod
- [ ] Implement JWT authentication
- [ ] Add rate limiting
- [ ] Generate OpenAPI specification
- [ ] Add integration tests

### Web Frontend
- [ ] Generate TypeScript types from OpenAPI spec
- [ ] Implement API client with retry logic
- [ ] Add authentication interceptors
- [ ] Implement offline queue
- [ ] Add error handling

### iOS Mobile App
- [ ] Generate Swift models from OpenAPI spec
- [ ] Implement URLSession-based client
- [ ] Add Keychain token storage
- [ ] Implement offline queue
- [ ] Add error handling

### Android Mobile App
- [ ] Generate Kotlin models from OpenAPI spec
- [ ] Implement Retrofit client
- [ ] Add encrypted token storage
- [ ] Implement offline queue with WorkManager
- [ ] Add error handling
