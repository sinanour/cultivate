# Technical Debt Refactoring Documentation

## Overview

This document describes the technical debt refactoring completed to eliminate code duplication, centralize constants, and establish consistent patterns across the codebase.

## Backend Refactoring

### Query Parameter Constants

All query parameter names are now centralized in `src/utils/constants.ts`:

```typescript
export const QUERY_PARAMS = {
  // Pagination
  PAGE: 'page',
  LIMIT: 'limit',
  
  // Filtering
  GEOGRAPHIC_AREA_ID: 'geographicAreaId',
  DEPTH: 'depth',
  
  // Grouping and Analytics
  GROUP_BY: 'groupBy',
  START_DATE: 'startDate',
  END_DATE: 'endDate',
  TIME_PERIOD: 'timePeriod',
  GRANULARITY: 'granularity',
  
  // Sorting
  SORT_BY: 'sortBy',
  SORT_ORDER: 'sortOrder',
} as const;
```

**Usage**: Import and use constants instead of inline strings:

```typescript
import { QUERY_PARAMS } from '../utils/constants';

// Instead of: const page = req.query['page']
const page = req.query[QUERY_PARAMS.PAGE];
```

### Pagination Parsing Utilities

Centralized pagination parsing in `src/utils/query-params.utils.ts`:

```typescript
import { parsePaginationParams } from '../utils/query-params.utils';

const { pagination, errors } = parsePaginationParams(req.query);
if (errors.length > 0) {
  return res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: 'Invalid pagination parameters',
    details: { errors },
  });
}

// Use pagination.page and pagination.limit
```

**Features**:
- Validates page >= 1
- Validates limit between 1 and MAX_LIMIT (100)
- Returns structured errors for invalid inputs
- Handles missing parameters gracefully

### Authorization Context Extraction

Centralized authorization context extraction in `src/utils/auth.utils.ts`:

```typescript
import { extractAuthorizationContext } from '../utils/auth.utils';

const { authorizedAreaIds, hasGeographicRestrictions, userId, userRole } = 
  extractAuthorizationContext(req);
```

**Features**:
- Extracts all authorization-related fields in one call
- Provides safe defaults for missing fields
- Type-safe with explicit interface

### Geographic Filtering Service

Shared service for geographic filtering logic in `src/services/geographic-filtering.service.ts`:

```typescript
import { GeographicFilteringService } from './geographic-filtering.service';

class MyService {
  private geographicFilteringService: GeographicFilteringService;
  
  constructor(prisma: PrismaClient) {
    this.geographicFilteringService = new GeographicFilteringService(prisma);
  }
  
  async myMethod(geographicAreaId, authorizedAreaIds, hasGeographicRestrictions) {
    const effectiveAreaIds = await this.geographicFilteringService
      .getEffectiveGeographicAreaIds(
        geographicAreaId,
        authorizedAreaIds,
        hasGeographicRestrictions
      );
    
    // Use effectiveAreaIds for filtering
  }
}
```

**Features**:
- Validates explicit filters against authorized areas
- Expands geographic area hierarchies to include descendants
- Handles implicit filtering for restricted users
- Returns undefined for no filtering (unrestricted users)
- Throws authorization errors for denied access

**Analytics Variant**: For services that accept array of area IDs:

```typescript
const effectiveAreaIds = await this.geographicFilteringService
  .getEffectiveGeographicAreaIdsForAnalytics(
    geographicAreaIds, // string | string[] | undefined
    authorizedAreaIds,
    hasGeographicRestrictions
  );
```

## API Changes

### Standardized Query Parameters

All endpoints now use consistent parameter names:

- **Pagination**: `page` and `limit` (not `pageSize`)
- **Geographic Filtering**: `geographicAreaId`
- **Date Filtering**: `startDate` and `endDate`
- **Grouping**: `groupBy`
- **Sorting**: `sortBy` and `sortOrder`

### Pagination Parameter: `limit`

All endpoints now use `limit` for pagination page size. The `pageSize` parameter has been deprecated.

**Example**:
```
GET /api/venues?page=1&limit=50
GET /api/analytics/engagement-optimized?page=1&limit=25
GET /api/analytics/geographic?page=1&limit=100
```

## Frontend Refactoring

### ConfirmationDialog Component

Unified confirmation dialog component in `src/components/common/ConfirmationDialog.tsx`:

```typescript
import { ConfirmationDialog } from '../common/ConfirmationDialog';

function MyComponent() {
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  
  const handleDelete = (item: Item) => {
    setConfirmDelete(item);
  };
  
  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
      setConfirmDelete(null);
    }
  };
  
  return (
    <>
      {/* Your component JSX */}
      
      <ConfirmationDialog
        visible={confirmDelete !== null}
        title="Delete Item"
        message={`Are you sure you want to delete "${confirmDelete?.name}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
```

**Props**:
- `visible`: boolean - Controls dialog visibility
- `title`: string (optional) - Dialog title (default: "Confirm Action")
- `message`: string - Confirmation message
- `confirmLabel`: string (optional) - Confirm button label (default: "Confirm")
- `cancelLabel`: string (optional) - Cancel button label (default: "Cancel")
- `variant`: 'destructive' | 'normal' (optional) - Visual variant (default: "normal")
- `onConfirm`: () => void - Callback when confirmed
- `onCancel`: () => void - Callback when cancelled

**Variants**:
- `destructive`: For delete operations (red styling)
- `normal`: For update operations (standard styling)

### BaseModal Component

Reusable modal wrapper in `src/components/common/BaseModal.tsx`:

```typescript
import { BaseModal } from '../common/BaseModal';

function MyComponent() {
  const [visible, setVisible] = useState(false);
  
  return (
    <BaseModal
      visible={visible}
      onDismiss={() => setVisible(false)}
      header="My Modal"
      size="large"
    >
      <div>Modal content goes here</div>
    </BaseModal>
  );
}
```

**Props**:
- `visible`: boolean - Controls modal visibility
- `onDismiss`: () => void - Callback when modal is dismissed
- `header`: string - Modal header text
- `children`: ReactNode - Modal content
- `footer`: ReactNode (optional) - Custom footer (default: Close button)
- `size`: ModalProps.Size (optional) - Modal size (default: "medium")

## Migration Summary

### Backend Services Migrated

The following services now use `GeographicFilteringService`:
- `venue.service.ts`
- `participant.service.ts`
- `activity.service.ts`
- `geographic-area.service.ts`
- `analytics.service.ts`
- `map-data.service.ts`

### Frontend Components Migrated

The following components now use `ConfirmationDialog`:
- `GeographicAuthorizationManager.tsx`
- `UserFormWithAuthorization.tsx`
- `VenueList.tsx`
- `ParticipantList.tsx`
- `ActivityList.tsx`
- `GeographicAreaList.tsx`
- `VenueDetail.tsx`
- `ParticipantDetail.tsx`
- `GeographicAreaDetail.tsx`
- `ActivityDetail.tsx`

All `window.confirm()` calls have been replaced with the new `ConfirmationDialog` component.

## Testing

### Unit Tests Added

- **Query Parameter Constants**: 6 tests
- **Pagination Parsing**: 20 tests
- **Authorization Context Extraction**: 9 tests
- **Array Normalization**: 10 tests
- **Geographic Filtering Service**: 18 tests
- **BaseModal Component**: 7 tests
- **ConfirmationDialog Component**: 9 tests

**Total**: 79 new unit tests

### Test Results

- **Backend**: 678 tests passing
- **No regressions** introduced by refactoring
- All existing integration tests continue to pass

## Benefits

### Maintainability
- Single source of truth for query parameters
- Centralized validation logic
- Consistent error handling
- Easier to update business rules

### Type Safety
- TypeScript catches typos at compile time
- Explicit interfaces for all utilities
- Better IDE autocomplete support

### User Experience
- Consistent confirmation dialogs across the application
- Better accessibility (CloudScape Modal vs window.confirm)
- Improved visual design

### Security
- Centralized authorization logic reduces risk of security bugs
- Consistent validation prevents bypass attempts
- Authorization errors are logged and auditable

## Future Enhancements

### Backend
- Add caching for geographic area descendant lookups
- Create comprehensive validation middleware
- Add OpenAPI schema validation

### Frontend
- Add "Don't ask again" checkbox to confirmations
- Add confirmation with input (type name to confirm)
- Add multi-step confirmations
- Add keyboard shortcuts

## Breaking Changes

None. All refactoring maintains backward compatibility.

## Deprecations

- `pageSize` query parameter is deprecated in favor of `limit` (both still work)
