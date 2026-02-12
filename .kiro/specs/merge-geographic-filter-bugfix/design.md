# Design Document: Merge Geographic Filter Bugfix

## Overview

This document describes the design for fixing a bug where the record merge reconciliation page does not respect the global geographic area filter. The fix ensures that:

1. The reconciliation page only fetches entities within the filtered geographic area
2. The merge API enforces geographic authorization on both source and destination entities
3. Clear error messages are displayed when entities are not accessible due to geographic restrictions
4. The fix maintains backward compatibility with non-filtered scenarios

## Root Cause Analysis

The bug occurs because the `ReconciliationPage` component directly calls entity service methods (e.g., `ParticipantService.getParticipant(id)`) without passing the `geographicAreaId` parameter. This bypasses the geographic filter that is properly applied in other parts of the application.

In contrast, the `MergeInitiationModal` uses `AsyncEntitySelect`, which correctly applies the geographic filter by reading from `useGlobalGeographicFilter()` and passing `geographicAreaId` to fetch functions.

## Architecture

### Current Flow (Buggy)

```
User with active filter → MergeInitiationModal (filtered ✓)
  → ReconciliationPage (NOT filtered ✗)
    → Direct entity fetch without geographicAreaId
      → Backend returns entity regardless of filter
        → User sees entity outside filtered area
```

### Fixed Flow

```
User with active filter → MergeInitiationModal (filtered ✓)
  → ReconciliationPage (filtered ✓)
    → Entity fetch WITH geographicAreaId
      → Backend enforces geographic authorization
        → User only sees entities within filtered area
          → Clear error if entity not accessible
```

## Components to Modify

### 1. ReconciliationPage Component

**File**: `web-frontend/src/pages/merge/ReconciliationPage.tsx`

**Changes Required**:

1. Import and use `useGlobalGeographicFilter` hook
2. Pass `geographicAreaId` to entity fetch functions
3. Handle geographic authorization errors gracefully
4. Re-fetch entities when filter changes

**Implementation**:

```typescript
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';

export default function ReconciliationPage() {
  // ... existing state ...
  
  // Add geographic filter
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  
  // Fetch source and destination entities
  useEffect(() => {
    if (!state?.sourceId || !state?.destinationId || !entityType) {
      setError('Missing required parameters');
      setIsLoading(false);
      return;
    }

    const fetchEntities = async () => {
      try {
        setIsLoading(true);
        
        // Fetch with geographic filter
        const [source, destination] = await Promise.all([
          fetchEntity(entityType, state.sourceId, selectedGeographicAreaId),
          fetchEntity(entityType, state.destinationId, selectedGeographicAreaId),
        ]);

        setSourceEntity(source);
        setDestinationEntity(destination);
        
        // ... rest of initialization ...
      } catch (err: any) {
        // Handle geographic authorization errors
        if (err.status === 403 || err.message?.includes('geographic')) {
          setError('One or both entities are not accessible within the current geographic filter. Please adjust your filter or select different entities.');
        } else {
          setError(err.message || 'Failed to load entities');
        }
        setIsLoading(false);
      }
    };

    fetchEntities();
  }, [state, entityType, selectedGeographicAreaId]); // Add selectedGeographicAreaId to dependencies
  
  // ... rest of component ...
}
```

**Updated fetchEntity Function**:

```typescript
async function fetchEntity(
  entityType: ComplexEntityType,
  id: string,
  geographicAreaId: string | null
): Promise<ComplexEntity> {
  const params = geographicAreaId ? { geographicAreaId } : {};
  
  switch (entityType) {
    case 'participant':
      return await ParticipantService.getParticipant(id, params);
    case 'activity':
      return await ActivityService.getActivity(id, params);
    case 'venue':
      return await VenueService.getVenue(id, params);
    case 'geographicArea':
      return await GeographicAreaService.getGeographicArea(id, params);
  }
}
```

### 2. Backend Entity Services

**Files**: 
- `backend-api/src/services/participant.service.ts`
- `backend-api/src/services/activity.service.ts`
- `backend-api/src/services/venue.service.ts`
- `backend-api/src/services/geographic-area.service.ts`

**Changes Required**:

Verify that the `getById` methods already support the `geographicAreaId` parameter and enforce authorization. If not, add this support.

**Expected Signature**:

```typescript
async getParticipant(
  id: string,
  options?: { geographicAreaId?: string }
): Promise<Participant> {
  // If geographicAreaId provided, verify entity is within that area
  // If not authorized, throw 403 error
  // Otherwise, return entity
}
```

### 3. Backend Merge Services

**Files**:
- `backend-api/src/services/merge/participant-merge.service.ts`
- `backend-api/src/services/merge/activity-merge.service.ts`
- `backend-api/src/services/merge/venue-merge.service.ts`
- `backend-api/src/services/merge/geographic-area-merge.service.ts`

**Changes Required**:

Add geographic authorization checks at the beginning of the `merge` method.

**Implementation**:

```typescript
async merge(
  sourceId: string,
  destinationId: string,
  reconciledFields?: Partial<Entity>,
  userId?: string,
  geographicAreaId?: string
): Promise<Entity> {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Validate records exist
    const source = await this.validateRecord(tx, sourceId);
    const destination = await this.validateRecord(tx, destinationId);
    
    // Step 2: Verify geographic authorization if filter is active
    if (geographicAreaId && userId) {
      await this.verifyGeographicAuthorization(
        tx,
        [source, destination],
        userId,
        geographicAreaId
      );
    }
    
    // Step 3: Continue with merge...
    // ... rest of merge logic ...
  });
}

private async verifyGeographicAuthorization(
  tx: PrismaTransaction,
  entities: Entity[],
  userId: string,
  geographicAreaId: string
): Promise<void> {
  // Use existing authorization service to verify access
  // Throw 403 error if not authorized
}
```

### 4. Backend Merge Routes

**File**: `backend-api/src/routes/merge.routes.ts`

**Changes Required**:

Extract `geographicAreaId` from request query parameters and pass to merge service.

**Implementation**:

```typescript
router.post(
  '/participants/:destinationId/merge',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body;
      const userId = req.user?.id;
      const geographicAreaId = req.query.geographicAreaId as string | undefined;

      const result = await participantMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields,
        userId,
        geographicAreaId
      );

      res.json({
        success: true,
        destinationEntity: result,
        message: 'Participants merged successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
```

## Error Handling

### Frontend Error Display

When an entity fetch fails due to geographic authorization:

```typescript
<Alert type="error" header="Geographic Authorization Error">
  One or both entities are not accessible within the current geographic filter.
  The {entityType} you are trying to merge may be outside your authorized area.
  <br /><br />
  Please adjust your geographic filter or select different entities to merge.
</Alert>
```

### Backend Error Response

When merge fails due to geographic authorization:

```json
{
  "success": false,
  "error": "Geographic authorization failed",
  "details": "One or both entities are not within the authorized geographic area",
  "status": 403
}
```

## Testing Strategy

### Unit Tests

1. Test `ReconciliationPage` with active geographic filter
   - Verify `geographicAreaId` is passed to fetch functions
   - Verify error handling for unauthorized entities
   - Verify re-fetch when filter changes

2. Test merge services with geographic authorization
   - Verify authorization check is performed
   - Verify 403 error when entities outside authorized area
   - Verify merge proceeds when entities are authorized

### Integration Tests

1. Test complete merge flow with geographic filter
   - User with filter selects entities within area
   - Reconciliation page loads successfully
   - Merge completes successfully

2. Test merge flow with unauthorized entities
   - User with filter attempts to merge entity outside area
   - Reconciliation page displays error
   - Merge API returns 403 error

### Manual Testing

1. Test with active geographic filter
   - Select entities within filtered area
   - Verify reconciliation page works
   - Complete merge successfully

2. Test with entities outside filter
   - Attempt to access entity outside filtered area
   - Verify clear error message
   - Verify cannot proceed with merge

3. Test without geographic filter
   - Verify merge works normally
   - Verify backward compatibility

## Backward Compatibility

The fix maintains backward compatibility by:

1. Making `geographicAreaId` an optional parameter in all functions
2. Only applying geographic authorization when `geographicAreaId` is provided
3. Not changing API contracts or database schema
4. Using existing authorization middleware and services

When no geographic filter is active:
- `selectedGeographicAreaId` will be `null`
- Functions will not pass `geographicAreaId` parameter
- Backend will not apply geographic authorization
- Merge works as before

## Security Considerations

### Defense in Depth

The fix implements multiple layers of security:

1. **Frontend Filter**: `AsyncEntitySelect` prevents selecting entities outside filter
2. **Frontend Validation**: `ReconciliationPage` verifies entities are accessible
3. **Backend Authorization**: Merge services enforce geographic authorization
4. **Audit Logging**: Geographic authorization failures are logged

### Authorization Bypass Prevention

Even if a user bypasses the frontend (e.g., by manipulating URLs or API calls directly), the backend will enforce geographic authorization and reject unauthorized merge attempts.

## Implementation Notes

### Service Method Signatures

Most entity service methods already support optional parameters for filtering. The fix leverages this existing pattern:

```typescript
// Existing pattern
getParticipants(params?: { geographicAreaId?: string, ... })

// Apply same pattern to getById methods
getParticipant(id: string, params?: { geographicAreaId?: string })
```

### React Query Cache Invalidation

When the geographic filter changes, React Query will automatically re-fetch data due to the `selectedGeographicAreaId` being included in the dependency array of the `useEffect` hook.

### Error Message Consistency

Use consistent error messages across the application:
- "Geographic authorization failed"
- "Entity not accessible within current geographic filter"
- "Please adjust your geographic filter or select different entities"

## Correctness Properties

Property 1: Geographic filter enforcement in reconciliation
*For any* reconciliation page load with an active geographic filter, the page should only fetch entities within the filtered geographic area.
**Validates: Requirements 1.1, 1.2**

Property 2: Geographic authorization in merge API
*For any* merge API request with a geographic filter, the backend should verify both source and destination entities are within the user's authorized geographic areas.
**Validates: Requirements 2.1, 2.2, 2.3**

Property 3: Clear error messages for geographic restrictions
*For any* failed entity fetch or merge operation due to geographic restrictions, the system should display a clear error message indicating the geographic authorization failure.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

Property 4: Backward compatibility without filter
*For any* merge operation without an active geographic filter, the system should function exactly as before the fix.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**
