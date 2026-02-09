# Development Patterns and Best Practices

## Backend Development Patterns

### Query Parameter Handling

Always use centralized constants and utilities for query parameters:

```typescript
import { QUERY_PARAMS } from '../utils/constants';
import { parsePaginationParams } from '../utils/query-params.utils';

// ✅ Good: Use constants
const geographicAreaId = req.query[QUERY_PARAMS.GEOGRAPHIC_AREA_ID];

// ❌ Bad: Inline strings
const geographicAreaId = req.query['geographicAreaId'];

// ✅ Good: Use parsing utility
const { pagination, errors } = parsePaginationParams(req.query);
if (errors.length > 0) {
  return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid pagination', details: { errors } });
}

// ❌ Bad: Inline parsing
const page = parseInt(req.query.page as string, 10) || 1;
```

### Authorization Context

Always use the centralized extraction utility:

```typescript
import { extractAuthorizationContext } from '../utils/auth.utils';

// ✅ Good: Use utility
const { authorizedAreaIds, hasGeographicRestrictions, userId, userRole } = 
  extractAuthorizationContext(req);

// ❌ Bad: Inline extraction
const authorizedAreaIds = req.user?.authorizedAreaIds || [];
const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;
```

### Geographic Filtering

Always use the shared `GeographicFilteringService`:

```typescript
import { GeographicFilteringService } from './geographic-filtering.service';

class MyService {
  private geographicFilteringService: GeographicFilteringService;
  
  constructor(prisma: PrismaClient) {
    this.geographicFilteringService = new GeographicFilteringService(prisma);
  }
  
  async getData(geographicAreaId, authorizedAreaIds, hasGeographicRestrictions) {
    // ✅ Good: Use shared service
    const effectiveAreaIds = await this.geographicFilteringService
      .getEffectiveGeographicAreaIds(
        geographicAreaId,
        authorizedAreaIds,
        hasGeographicRestrictions
      );
    
    // ❌ Bad: Duplicate the logic
    // Don't implement getEffectiveGeographicAreaIds in your service
  }
}
```

**For analytics services** that accept array of area IDs:

```typescript
const effectiveAreaIds = await this.geographicFilteringService
  .getEffectiveGeographicAreaIdsForAnalytics(
    geographicAreaIds, // string | string[] | undefined
    authorizedAreaIds,
    hasGeographicRestrictions
  );
```

### Array Parameter Normalization

Use the `normalizeArrayParam` utility for query parameters that can be single values or arrays:

```typescript
import { normalizeArrayParam } from '../utils/query-params.utils';

// ✅ Good: Use utility
const activityTypeIds = normalizeArrayParam(req.query.activityTypeIds);

// ❌ Bad: Inline normalization
const activityTypeIds = Array.isArray(req.query.activityTypeIds) 
  ? req.query.activityTypeIds 
  : [req.query.activityTypeIds];
```

## Frontend Development Patterns

### Confirmation Dialogs

Always use `ConfirmationDialog` instead of `window.confirm()`:

```typescript
import { ConfirmationDialog } from '../common/ConfirmationDialog';

function MyComponent() {
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  
  // ✅ Good: Use ConfirmationDialog
  const handleDelete = (item: Item) => {
    setConfirmDelete(item);
  };
  
  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
      setConfirmDelete(null);
    }
  };
  
  // ❌ Bad: Use window.confirm
  const handleDeleteBad = (item: Item) => {
    if (window.confirm(`Delete ${item.name}?`)) {
      deleteMutation.mutate(item.id);
    }
  };
  
  return (
    <>
      <Button onClick={() => handleDelete(item)}>Delete</Button>
      
      <ConfirmationDialog
        visible={confirmDelete !== null}
        title="Delete Item"
        message={`Are you sure you want to delete "${confirmDelete?.name}"?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
```

**Pattern for multiple confirmations** (e.g., ActivityDetail):

```typescript
const [confirmUpdateStatus, setConfirmUpdateStatus] = useState<string | null>(null);
const [confirmRemoveAssignment, setConfirmRemoveAssignment] = useState<string | null>(null);
const [confirmDelete, setConfirmDelete] = useState(false);

// Each action has its own confirmation dialog
<ConfirmationDialog
  visible={confirmUpdateStatus !== null}
  title="Update Status"
  message={`Update status to ${confirmUpdateStatus}?`}
  variant="normal"
  onConfirm={handleConfirmUpdateStatus}
  onCancel={() => setConfirmUpdateStatus(null)}
/>

<ConfirmationDialog
  visible={confirmRemoveAssignment !== null}
  title="Remove Assignment"
  message="Remove this assignment?"
  variant="destructive"
  onConfirm={handleConfirmRemoveAssignment}
  onCancel={() => setConfirmRemoveAssignment(null)}
/>
```

### Custom Modals

Use `BaseModal` for custom modal implementations:

```typescript
import { BaseModal } from '../common/BaseModal';

function MyComponent() {
  const [visible, setVisible] = useState(false);
  
  return (
    <BaseModal
      visible={visible}
      onDismiss={() => setVisible(false)}
      header="Custom Modal"
      size="large"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setVisible(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <div>Your custom content here</div>
    </BaseModal>
  );
}
```

## Code Examples

### Complete Route Handler Example

```typescript
import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/express.types';
import { QUERY_PARAMS, ErrorCode } from '../utils/constants';
import { parsePaginationParams } from '../utils/query-params.utils';
import { extractAuthorizationContext } from '../utils/auth.utils';

export class MyRoutes {
  private async getItems(req: AuthenticatedRequest, res: Response) {
    try {
      // Parse pagination
      const { pagination, errors } = parsePaginationParams(req.query);
      if (errors.length > 0) {
        return res.status(400).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid pagination parameters',
          details: { errors },
        });
      }
      
      // Extract authorization context
      const { authorizedAreaIds, hasGeographicRestrictions } = 
        extractAuthorizationContext(req);
      
      // Get geographic area filter
      const geographicAreaId = req.query[QUERY_PARAMS.GEOGRAPHIC_AREA_ID] as string | undefined;
      
      // Call service
      const items = await this.myService.getItems(
        pagination.page,
        pagination.limit,
        geographicAreaId,
        authorizedAreaIds,
        hasGeographicRestrictions
      );
      
      res.json({ success: true, data: items });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        code: error.code || ErrorCode.INTERNAL_ERROR,
        message: error.message,
        details: {},
      });
    }
  }
}
```

### Complete Service Example

```typescript
import { PrismaClient } from '@prisma/client';
import { GeographicFilteringService } from './geographic-filtering.service';

export class MyService {
  private geographicFilteringService: GeographicFilteringService;
  
  constructor(private prisma: PrismaClient) {
    this.geographicFilteringService = new GeographicFilteringService(prisma);
  }
  
  async getItems(
    page: number = 1,
    limit: number = 50,
    geographicAreaId: string | undefined,
    authorizedAreaIds: string[],
    hasGeographicRestrictions: boolean
  ) {
    // Get effective geographic area IDs
    const effectiveAreaIds = await this.geographicFilteringService
      .getEffectiveGeographicAreaIds(
        geographicAreaId,
        authorizedAreaIds,
        hasGeographicRestrictions
      );
    
    // Build where clause
    const where: any = {};
    if (effectiveAreaIds) {
      where.geographicAreaId = { in: effectiveAreaIds };
    }
    
    // Query with pagination
    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.item.count({ where }),
    ]);
    
    return { items, total };
  }
}
```

## Testing Patterns

### Testing Utilities

```typescript
import { parsePaginationParams } from '../../utils/query-params.utils';

describe('MyRoute', () => {
  it('should parse pagination parameters', () => {
    const result = parsePaginationParams({ page: '1', limit: '50' });
    expect(result.pagination).toEqual({ page: 1, limit: 50 });
    expect(result.errors).toEqual([]);
  });
});
```

### Testing Services

```typescript
import { GeographicFilteringService } from '../../services/geographic-filtering.service';

jest.mock('../../repositories/geographic-area.repository');

describe('MyService', () => {
  let service: MyService;
  let mockPrisma: PrismaClient;
  
  beforeEach(() => {
    mockPrisma = {} as PrismaClient;
    service = new MyService(mockPrisma);
  });
  
  it('should use geographic filtering service', async () => {
    // Test your service logic
  });
});
```

### Testing Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from '../ConfirmationDialog';

describe('MyComponent', () => {
  it('should show confirmation dialog', () => {
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();
    
    render(
      <ConfirmationDialog
        visible={true}
        message="Delete this?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockOnConfirm).toHaveBeenCalled();
  });
});
```

## Common Pitfalls

### Don't Duplicate Logic

❌ **Bad**: Implementing getEffectiveGeographicAreaIds in your service

```typescript
class MyService {
  private async getEffectiveGeographicAreaIds(...) {
    // Duplicated logic
  }
}
```

✅ **Good**: Using the shared service

```typescript
class MyService {
  private geographicFilteringService: GeographicFilteringService;
  
  constructor(prisma: PrismaClient) {
    this.geographicFilteringService = new GeographicFilteringService(prisma);
  }
}
```

### Don't Use Inline Strings

❌ **Bad**: Inline query parameter strings

```typescript
const page = req.query['page'];
```

✅ **Good**: Use constants

```typescript
const page = req.query[QUERY_PARAMS.PAGE];
```

### Don't Use window.confirm

❌ **Bad**: Using window.confirm

```typescript
if (window.confirm('Delete?')) {
  deleteItem();
}
```

✅ **Good**: Use ConfirmationDialog

```typescript
const [confirmDelete, setConfirmDelete] = useState(false);

<ConfirmationDialog
  visible={confirmDelete}
  message="Delete?"
  onConfirm={handleConfirmDelete}
  onCancel={() => setConfirmDelete(false)}
/>
```

## Questions?

For questions about these patterns, refer to:
- Backend refactoring: `backend-api/docs/REFACTORING.md`
- Code examples: This document
- Test examples: `backend-api/src/__tests__/utils/` and `backend-api/src/__tests__/services/`
