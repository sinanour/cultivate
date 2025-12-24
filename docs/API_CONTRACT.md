# API Contract: Community Activity Tracker

## Overview

This document defines the complete API contract between the Backend API and all client applications (Web Frontend, iOS Mobile App, Android Mobile App). All clients must implement this contract to ensure interoperability and data consistency.

**Version**: 1.0.0  
**Base URL**: `https://api.community-tracker.example.com/api/v1`  
**Protocol**: HTTPS only  
**Format**: JSON  
**Authentication**: JWT Bearer tokens

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
  "token": "string (JWT)",
  "refreshToken": "string",
  "user": {
    "id": "string (UUID)",
    "email": "string",
    "name": "string",
    "systemRole": "Administrator | Editor | ReadOnly"
  },
  "expiresIn": 86400
}
```

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
  "token": "string (JWT)",
  "refreshToken": "string",
  "expiresIn": 86400
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
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "description": "string",
      "activityType": {
        "id": "string (UUID)",
        "name": "string",
        "isPredefined": "boolean"
      },
      "status": "Planning | Active | Completed | Archived",
      "startDate": "string (ISO 8601)",
      "endDate": "string | null (ISO 8601)",
      "isOngoing": "boolean",
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
      "createdBy": "string (UUID)",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)",
      "version": "number"
    }
  ],
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

**Response** (200 OK): Single activity object (same structure as list item)

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
  "status": "Planning | Active | Completed | Archived",
  "startDate": "string (ISO 8601)",
  "endDate": "string | null (ISO 8601)",
  "isOngoing": "boolean"
}
```

**Response** (201 Created): Activity object

**Errors**:
- 400: Validation error
- 403: Insufficient permissions

### Update Activity

**Endpoint**: `PUT /activities/:id`

**Request**: Same as create, plus:
```json
{
  "version": "number"
}
```

**Response** (200 OK): Updated activity object

**Errors**:
- 404: Activity not found
- 409: Version conflict
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
  "venueId": "string (UUID)",
  "effectiveFrom": "string (ISO 8601)"
}
```

**Response** (201 Created): Activity venue association object

### Remove Activity Venue

**Endpoint**: `DELETE /activities/:id/venues/:venueId`

**Query Parameters**:
- `effectiveTo` (required): End date for the association (ISO 8601)

**Response** (204 No Content)

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
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "email": "string | null",
      "phone": "string | null",
      "notes": "string",
      "homeVenueId": "string | null (UUID)",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)",
      "version": "number"
    }
  ],
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

**Response** (200 OK): Single participant object

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

**Response** (201 Created): Participant object

### Update Participant

**Endpoint**: `PUT /participants/:id`

**Request**: Same as create, plus version

**Response** (200 OK): Updated participant object

### Delete Participant

**Endpoint**: `DELETE /participants/:id`

**Response** (204 No Content)

### Get Participant Address History

**Endpoint**: `GET /participants/:id/address-history`

**Response** (200 OK):
```json
{
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
  ],
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

**Response** (200 OK): Single venue object

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

**Response** (201 Created): Venue object

### Update Venue

**Endpoint**: `PUT /venues/:id`

**Request**: Same as create

**Response** (200 OK): Updated venue object

### Delete Venue

**Endpoint**: `DELETE /venues/:id`

**Response** (204 No Content)

**Errors**:
- 409: Venue is referenced by activities or participants

### Search Venues

**Endpoint**: `GET /venues/search`

**Query Parameters**:
- `q` (required): Search query
- `limit` (optional, default: 20)

**Response** (200 OK): Array of venue objects

### Get Venue Activities

**Endpoint**: `GET /venues/:id/activities`

**Response** (200 OK): Array of activities associated with venue

### Get Venue Participants

**Endpoint**: `GET /venues/:id/participants`

**Response** (200 OK): Array of participants with this venue as home

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
  ],
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

**Response** (200 OK): Single geographic area object

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

**Response** (201 Created): Geographic area object

**Errors**:
- 400: Circular relationship detected

### Update Geographic Area

**Endpoint**: `PUT /geographic-areas/:id`

**Request**: Same as create

**Response** (200 OK): Updated geographic area object

### Delete Geographic Area

**Endpoint**: `DELETE /geographic-areas/:id`

**Response** (204 No Content)

**Errors**:
- 409: Area is referenced by venues or child areas

### Get Geographic Area Children

**Endpoint**: `GET /geographic-areas/:id/children`

**Response** (200 OK): Array of child geographic areas

### Get Geographic Area Ancestors

**Endpoint**: `GET /geographic-areas/:id/ancestors`

**Response** (200 OK): Array of ancestor geographic areas (from parent to root)

### Get Geographic Area Venues

**Endpoint**: `GET /geographic-areas/:id/venues`

**Response** (200 OK): Array of venues in this geographic area

### Get Geographic Area Statistics

**Endpoint**: `GET /geographic-areas/:id/statistics`

**Query Parameters**:
- `includeDescendants` (optional, default: true): Include statistics from child areas

**Response** (200 OK):
```json
{
  "geographicAreaId": "string (UUID)",
  "totalActivities": "number",
  "totalParticipants": "number",
  "activeActivities": "number",
  "ongoingActivities": "number"
}
```

## Activity Participants

### List Activity Participants

**Endpoint**: `GET /activities/:activityId/participants`

**Response** (200 OK):
```json
{
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
        "name": "string",
        "isPredefined": "boolean"
      },
      "joinedAt": "string (ISO 8601)",
      "notes": "string"
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
  "notes": "string"
}
```

**Response** (201 Created): Activity participant object

### Update Activity Participant

**Endpoint**: `PUT /activities/:activityId/participants/:participantId`

**Request**:
```json
{
  "roleId": "string (UUID)",
  "notes": "string"
}
```

**Response** (200 OK): Updated activity participant object

### Remove Participant from Activity

**Endpoint**: `DELETE /activities/:activityId/participants/:participantId`

**Response** (204 No Content)

## Activity Types

### List Activity Types

**Endpoint**: `GET /activity-types`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "createdAt": "string (ISO 8601)"
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

**Response** (201 Created): Activity type object

## Participant Roles

### List Participant Roles

**Endpoint**: `GET /participant-roles`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "isPredefined": "boolean",
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

### Create Participant Role

**Endpoint**: `POST /participant-roles`

**Request**:
```json
{
  "name": "string"
}
```

**Response** (201 Created): Participant role object

## Analytics

### Get Engagement Metrics

**Endpoint**: `GET /analytics/engagement`

**Query Parameters**:
- `startDate` (required): Period start (ISO 8601)
- `endDate` (required): Period end (ISO 8601)
- `geographicAreaId` (optional): Filter by geographic area

**Response** (200 OK):
```json
{
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
```

### Get Growth Data

**Endpoint**: `GET /analytics/growth`

**Query Parameters**:
- `startDate` (required): Period start (ISO 8601)
- `endDate` (required): Period end (ISO 8601)
- `interval` (optional, default: "day"): Grouping interval (day, week, month)
- `geographicAreaId` (optional): Filter by geographic area

**Response** (200 OK):
```json
{
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

### Get Geographic Analytics

**Endpoint**: `GET /analytics/geographic`

**Query Parameters**:
- `startDate` (optional): Period start (ISO 8601)
- `endDate` (optional): Period end (ISO 8601)
- `geographicAreaId` (optional): Root geographic area

**Response** (200 OK):
```json
{
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
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {},
    "timestamp": "string (ISO 8601)",
    "requestId": "string (UUID)"
  }
}
```

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

All list endpoints support pagination:

**Query Parameters**:
- `page` (default: 1): Page number
- `limit` (default: 50, max: 100): Items per page

**Response**:
```json
{
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
