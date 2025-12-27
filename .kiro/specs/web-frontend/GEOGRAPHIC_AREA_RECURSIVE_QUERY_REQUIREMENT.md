# Geographic Area Recursive Query Requirement

## Date
December 26, 2025

## Issue Summary

The GeographicAreaDetailPage currently displays venues and activities only for the specific geographic area, not including venues and activities from descendant (child) geographic areas. This is inconsistent with the statistics display, which already aggregates data recursively from all descendants.

## Current Behavior

**GeographicAreaDetail Component:**
- Fetches venues using `GET /geographic-areas/:id/venues`
- Backend returns only venues where `geographicAreaId === id` (non-recursive)
- Statistics correctly include descendants (already implemented)

**Example:**
```
City (ID: 1)
├── Community A (ID: 2)
│   └── Venue A1
└── Community B (ID: 3)
    └── Venue B1

When viewing City detail page:
- Statistics: Shows 2 venues (correct - includes A1 and B1)
- Venues list: Shows 0 venues (incorrect - should show A1 and B1)
```

## Expected Behavior

When viewing a geographic area detail page, the venues and activities should be aggregated recursively from:
1. The geographic area itself
2. All direct children
3. All descendants (children of children, recursively)

This matches the behavior already implemented for statistics.

## Root Cause

**Backend Implementation Gap:**

The backend `GeographicAreaService.getVenues()` method currently calls:
```typescript
return this.geographicAreaRepository.findVenues(id);
```

Which queries:
```typescript
return this.prisma.venue.findMany({
  where: { geographicAreaId: id },  // Only direct match
  orderBy: { name: 'asc' },
});
```

**Correct Implementation (following getStatistics pattern):**
```typescript
async getVenues(id: string) {
  const area = await this.geographicAreaRepository.findById(id);
  if (!area) {
    throw new Error('Geographic area not found');
  }

  // Get all descendant IDs including the area itself
  const descendantIds = await this.geographicAreaRepository.findDescendants(id);
  const areaIds = [id, ...descendantIds];

  // Get all venues in this area and descendants
  return this.prisma.venue.findMany({
    where: { geographicAreaId: { in: areaIds } },
    orderBy: { name: 'asc' },
  });
}
```

## Impact

**User Experience:**
- Users viewing a high-level geographic area (e.g., City) see incomplete venue lists
- Users must navigate to each child area individually to see all venues
- Inconsistent with statistics which show aggregated counts

**Data Integrity:**
- Statistics show "Total Venues: 10" but venue list shows 0 venues
- Confusing and appears broken to users

## Solution

### Backend Changes Required

**File:** `backend-api/src/services/geographic-area.service.ts`

Update the `getVenues()` method to include descendants:

```typescript
async getVenues(id: string) {
  const area = await this.geographicAreaRepository.findById(id);
  if (!area) {
    throw new Error('Geographic area not found');
  }

  // Get all descendant IDs including the area itself
  const descendantIds = await this.geographicAreaRepository.findDescendants(id);
  const areaIds = [id, ...descendantIds];

  // Get all venues in this area and descendants
  return this.prisma.venue.findMany({
    where: { geographicAreaId: { in: areaIds } },
    orderBy: { name: 'asc' },
  });
}
```

**Note:** The `findDescendants()` method already exists and is used by `getStatistics()`.

### Frontend Changes

**No frontend changes required.** The frontend already correctly calls the backend endpoint. Once the backend is fixed, the frontend will automatically display the recursive results.

### API Contract Update

**File:** `docs/API_CONTRACT.md`

Update the venues endpoint documentation to clarify recursive behavior:

```markdown
### Get Geographic Area Venues

**Endpoint**: `GET /geographic-areas/:id/venues`

**Response** (200 OK): Array of venues in this geographic area **and all descendant areas** wrapped in `{ success: true, data: [...] }`

**Note**: This endpoint returns venues recursively, including all venues in child geographic areas and their descendants. This matches the behavior of the statistics endpoint.
```

### Specification Updates

**File:** `.kiro/specs/web-frontend/design.md`

Update the GeographicAreaDetail component description to clarify recursive behavior:

**Current:**
```markdown
**GeographicAreaDetail**
- Shows geographic area information in detail view
- Displays full hierarchy path from root to current area
- Lists all child geographic areas
- Lists all venues in the geographic area
- Shows statistics (activity and participant counts) for the area and descendants
```

**Updated:**
```markdown
**GeographicAreaDetail**
- Shows geographic area information in detail view
- Displays full hierarchy path from root to current area
- Lists all child geographic areas
- Lists all venues in the geographic area **and all descendant areas (recursive)**
- Shows statistics (activity and participant counts) for the area and descendants (recursive)
```

**File:** `.kiro/specs/web-frontend/requirements.md`

Update Requirement 6B.8 to clarify recursive behavior:

**Current:**
```markdown
8. THE Web_App SHALL display a detail view showing geographic area information, child areas, and associated venues
```

**Updated:**
```markdown
8. THE Web_App SHALL display a detail view showing geographic area information, child areas, and associated venues from the area and all descendant areas (recursive)
```

## Testing Considerations

### Backend Tests

Add test cases to verify recursive venue retrieval:

```typescript
describe('GeographicAreaService.getVenues', () => {
  it('should return venues from area and all descendants', async () => {
    // Setup: City > Community > Neighbourhood
    // City has no venues
    // Community has 1 venue
    // Neighbourhood has 2 venues
    
    const venues = await service.getVenues(cityId);
    
    expect(venues).toHaveLength(3); // All venues from descendants
  });

  it('should return only direct venues when no descendants', async () => {
    // Setup: Leaf area with 2 venues
    
    const venues = await service.getVenues(leafAreaId);
    
    expect(venues).toHaveLength(2);
  });

  it('should return empty array when area and descendants have no venues', async () => {
    const venues = await service.getVenues(emptyAreaId);
    
    expect(venues).toHaveLength(0);
  });
});
```

### Frontend Tests

No new frontend tests required. Existing tests will pass once backend is fixed.

## Priority

**High Priority** - This is a user-facing bug that makes the geographic area detail view appear broken and inconsistent with the statistics display.

## Implementation Order

1. ✅ Document the issue (this document)
2. ⏭️ Update backend `getVenues()` method to include descendants
3. ⏭️ Update backend tests
4. ⏭️ Update API contract documentation
5. ⏭️ Update web-frontend specification documents
6. ⏭️ Verify frontend displays recursive results correctly

## Related Files

### Backend
- `backend-api/src/services/geographic-area.service.ts` - Needs update
- `backend-api/src/repositories/geographic-area.repository.ts` - Already has `findDescendants()` method
- `backend-api/src/__tests__/services/geographic-area.service.test.ts` - Needs new tests
- `docs/API_CONTRACT.md` - Needs documentation update

### Frontend
- `web-frontend/src/components/features/GeographicAreaDetail.tsx` - No changes needed
- `web-frontend/src/services/api/geographic-area.service.ts` - No changes needed
- `.kiro/specs/web-frontend/design.md` - Needs clarification
- `.kiro/specs/web-frontend/requirements.md` - Needs clarification

## Notes

- The `getStatistics()` method already implements the correct recursive pattern
- The `findDescendants()` repository method already exists and is tested
- This is a simple fix that follows an existing pattern in the codebase
- No database schema changes required
- No API contract breaking changes (only clarification)

## Activities Display

**Note:** The GeographicAreaDetail component does not currently display activities. If activities should also be displayed recursively, a similar endpoint would need to be added:

**Potential Future Enhancement:**
- `GET /geographic-areas/:id/activities` - Returns activities at venues in this area and descendants

This would require:
1. New backend endpoint
2. New frontend service method
3. New section in GeographicAreaDetail component
4. Similar recursive implementation pattern

However, this is not currently in the requirements and should be considered a separate feature request.

## Conclusion

The geographic area venues query should be recursive to match the statistics behavior and provide a complete view of all venues within a geographic area hierarchy. This is a backend fix that requires no frontend changes.

**Status:** ✅ DOCUMENTED  
**Backend Fix Required:** ✅ YES  
**Frontend Changes Required:** ❌ NO  
**Breaking Changes:** ❌ NO  
**Estimated Backend Fix Time:** 15-30 minutes
