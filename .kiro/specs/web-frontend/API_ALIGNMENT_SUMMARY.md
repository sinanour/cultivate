# Web Frontend API Alignment Summary

## Overview

This document summarizes the changes made to align the web-frontend spec with the API contract defined in `/docs/API_CONTRACT.md`.

## Key Changes Made

### 1. Data Model Updates

**Activity Status Values:**
- **Before:** `'ACTIVE' | 'COMPLETED'`
- **After:** `'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'`
- **Impact:** Activity forms and filters need to support all four status values

**Version Fields Added:**
- Added `version: number` field to: ActivityType, ParticipantRole, Participant, Venue, GeographicArea, Activity
- **Purpose:** Support optimistic locking to prevent concurrent update conflicts

**User Model:**
- Added `createdAt` and `updatedAt` fields
- Removed `name` field (not in API contract)

**Activity Model:**
- Added `createdBy?: string` field
- Added `version: number` field
- Updated status enum

**Assignment Model:**
- Added `notes?: string` field
- Added `createdAt: string` field

**Geographic Area Statistics:**
- **Before:** Included `geographicAreaId` and `ongoingActivities`
- **After:** Includes `totalVenues` instead, removed `ongoingActivities`

**Engagement Metrics:**
- **Before:** Simple counts and arrays
- **After:** Comprehensive metrics including `activeParticipants`, `participationRate`, `retentionRate`, `averageActivitySize`, structured `geographicBreakdown` with IDs and names

**Growth Metrics:**
- **Before:** Arrays of objects with date/count pairs
- **After:** Single object per data point with all metrics

**Added GeographicAnalytics Interface:**
- New interface for geographic breakdown data

### 2. API Service Updates

**Authentication:**
- Token expiration times documented: Access token 15 min, Refresh token 7 days
- Added `decodeToken()` method to extract user info from JWT
- Updated `getCurrentUser()` to fetch from `/auth/me` endpoint

**Endpoint Paths:**
- Participant roles endpoint: `/roles` (not `/participant-roles`)

**Pagination:**
- All list endpoints support optional pagination via `page` and `limit` query parameters
- When pagination params provided, response includes pagination metadata
- Without params, all results returned

**Optimistic Locking:**
- All update methods now accept optional `version` parameter
- Version conflicts return 409 status with `VERSION_CONFLICT` error code

**Activity Service:**
- Added `getActivityParticipants()` method
- Added `getActivityVenues()` method
- Added `addActivityVenue()` and `removeActivityVenue()` methods
- Removed `markComplete()` (use `updateActivity()` with status instead)

**Assignment Service:**
- Renamed methods to match API: `addParticipant()`, `updateParticipant()`, `removeParticipant()`
- Added `notes` parameter support
- Updated to use `/activities/:activityId/participants` endpoints

**Analytics Service:**
- All date parameters are optional (not required)
- Growth metrics uses `period` parameter (not `interval`)
- Period values: DAY, WEEK, MONTH, YEAR
- Added `getGeographicAnalytics()` method

**Sync Service:**
- Added new `SyncService` for batch synchronization
- Uses `/sync/batch` endpoint

### 3. Response Format

**Standard Wrapper:**
All successful responses wrapped in:
```typescript
{
  success: boolean;
  data: T;
  pagination?: {...};
}
```

**Error Format:**
```typescript
{
  code: string;
  message: string;
  details?: any;
}
```

### 4. Error Codes

Added comprehensive error code documentation:
- `VALIDATION_ERROR`
- `AUTHENTICATION_REQUIRED`
- `INSUFFICIENT_PERMISSIONS`
- `NOT_FOUND`
- `VERSION_CONFLICT` (new)
- `CIRCULAR_REFERENCE`
- `REFERENCED_ENTITY`
- `DUPLICATE_EMAIL`
- `DUPLICATE_NAME`
- `DUPLICATE_ASSIGNMENT`
- `INVALID_REFERENCE`
- `RATE_LIMIT_EXCEEDED` (new)
- `INTERNAL_ERROR`

### 5. Rate Limiting

**Documented Limits:**
- Authentication endpoints: 5 requests/minute per IP
- Mutation endpoints: 100 requests/minute per user
- Query endpoints: 1000 requests/minute per user

**Headers:**
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### 6. Error Handling Updates

**Added 409 Conflict Handling:**
- Detect VERSION_CONFLICT errors
- Display conflict notification
- Provide retry/discard options
- Refetch latest data

**Added 429 Rate Limit Handling:**
- Display rate limit exceeded message
- Show retry-after time
- Automatic retry after cooldown
- Log rate limit details

### 7. Requirements Updates

**Requirement 5 (Activity Management):**
- Updated acceptance criteria 11: Changed from "mark finite activities as complete" to "support activity statuses: PLANNED, ACTIVE, COMPLETED, CANCELLED"
- Updated acceptance criteria 12: Changed from "provide a button to mark finite activities as complete" to "provide a button to update activity status"

**New Requirement 18: Optimistic Locking and Conflict Resolution**
- Handle version conflicts
- Display conflict notifications
- Provide resolution options
- Refetch latest data

**New Requirement 19: Rate Limiting Handling**
- Handle rate limit errors
- Display retry-after time
- Automatic retry
- Show remaining request counts

### 8. Queued Operation Format

Updated `QueuedOperation` interface:
- Changed `type` to `operation`
- Changed `entity` to `entityType` with specific enum values
- Added `entityId` field
- Changed `timestamp` from number to string (ISO 8601)
- Added optional `version` field

## Implementation Impact

### High Priority Changes

1. **Update Activity Status Handling:**
   - Activity forms need to support all four status values
   - Activity list filters need all four options
   - Update status transition logic

2. **Implement Optimistic Locking:**
   - Include version in all update requests
   - Handle 409 conflicts with user-friendly UI
   - Refetch and merge logic

3. **Update API Client:**
   - Wrap all responses in standard format
   - Parse error codes correctly
   - Handle pagination metadata

4. **Add Rate Limiting:**
   - Detect 429 errors
   - Implement retry logic
   - Display rate limit info

### Medium Priority Changes

1. **Update Data Models:**
   - Add version fields to all entities
   - Update Activity status enum
   - Add notes to assignments
   - Update analytics interfaces

2. **Update Service Methods:**
   - Add version parameters
   - Update endpoint paths
   - Add new methods (getActivityVenues, etc.)

3. **Update Error Handling:**
   - Add VERSION_CONFLICT handling
   - Add RATE_LIMIT_EXCEEDED handling
   - Update error code mapping

### Low Priority Changes

1. **Update Documentation:**
   - Document token expiration times
   - Document rate limits
   - Document pagination behavior

2. **Update Tests:**
   - Test optimistic locking
   - Test rate limiting
   - Test new status values

## Testing Considerations

1. **Optimistic Locking Tests:**
   - Simulate concurrent updates
   - Test conflict resolution UI
   - Test version mismatch scenarios

2. **Rate Limiting Tests:**
   - Test rate limit detection
   - Test retry logic
   - Test cooldown periods

3. **Status Transition Tests:**
   - Test all four status values
   - Test status transitions
   - Test status filters

4. **Pagination Tests:**
   - Test with and without pagination params
   - Test pagination metadata
   - Test page boundaries

## Migration Notes

### Breaking Changes

1. **Activity Status:** Existing code expecting only ACTIVE/COMPLETED needs updating
2. **Response Format:** All API responses now wrapped in `{ success, data }` format
3. **Endpoint Paths:** `/participant-roles` → `/roles`
4. **Analytics Parameters:** `interval` → `period`

### Backward Compatibility

- Pagination is optional, so existing code without pagination params will continue to work
- Version parameter is optional on updates, so existing code will work (but won't have conflict detection)

## Next Steps

1. Review this alignment summary
2. Update implementation tasks in tasks.md
3. Begin implementation starting with high-priority changes
4. Update tests to cover new functionality
5. Update user documentation

## Questions for Review

1. Should we implement optimistic locking immediately or phase it in?
2. How should we handle the transition from 2 status values to 4?
3. Should rate limiting be visible to users or handled silently?
4. Do we need migration scripts for existing offline queue data?
