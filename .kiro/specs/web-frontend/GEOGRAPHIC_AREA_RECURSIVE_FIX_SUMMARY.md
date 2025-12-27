# Geographic Area Recursive Query - Fix Summary

## Date
December 26, 2025

## Issue

The GeographicAreaDetailPage displays venues only from the specific geographic area, not including venues from descendant (child) geographic areas. This is inconsistent with the statistics display, which correctly aggregates data recursively.

## What Was Updated

### 1. Specification Documents ✅

**File:** `.kiro/specs/web-frontend/requirements.md`
- Updated Requirement 6B.8 to clarify recursive behavior
- Changed from: "associated venues"
- Changed to: "associated venues from the area and all descendant areas (recursive aggregation)"

**File:** `.kiro/specs/web-frontend/design.md`
- Updated GeographicAreaDetail component description
- Added explicit note about recursive venue aggregation
- Clarified that venue list should match statistics recursive behavior

**File:** `.kiro/specs/web-frontend/GEOGRAPHIC_AREA_RECURSIVE_QUERY_REQUIREMENT.md`
- Created comprehensive documentation of the issue
- Provided detailed analysis of root cause
- Included code examples for backend fix
- Documented testing considerations

### 2. Root Cause Identified ✅

**Backend Issue:**
The backend `GeographicAreaService.getVenues()` method currently only returns venues directly in the specified geographic area:

```typescript
// Current (incorrect)
async getVenues(id: string) {
  const area = await this.geographicAreaRepository.findById(id);
  if (!area) {
    throw new Error('Geographic area not found');
  }
  return this.geographicAreaRepository.findVenues(id); // Only direct venues
}
```

**Should be (following getStatistics pattern):**
```typescript
// Correct (recursive)
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

## What Needs to Be Done

### Backend Changes Required ⏭️

**Priority:** High

**File:** `backend-api/src/services/geographic-area.service.ts`

1. Update the `getVenues()` method to include descendants
2. Follow the same pattern already used in `getStatistics()`
3. Use the existing `findDescendants()` repository method

**Estimated Time:** 15-30 minutes

**Testing:**
- Add test cases for recursive venue retrieval
- Test with multi-level hierarchies
- Test with empty areas
- Test with leaf areas (no descendants)

### API Contract Update ⏭️

**File:** `docs/API_CONTRACT.md`

Update the venues endpoint documentation:

```markdown
### Get Geographic Area Venues

**Endpoint**: `GET /geographic-areas/:id/venues`

**Response** (200 OK): Array of venues in this geographic area **and all descendant areas** wrapped in `{ success: true, data: [...] }`

**Note**: This endpoint returns venues recursively, including all venues in child geographic areas and their descendants. This matches the behavior of the statistics endpoint.
```

### Frontend Changes ❌

**No frontend changes required.** The frontend implementation is already correct. Once the backend is fixed, the frontend will automatically display the recursive results.

## Example Scenario

**Geographic Hierarchy:**
```
City (ID: 1)
├── Community A (ID: 2)
│   ├── Venue A1
│   └── Neighbourhood A1 (ID: 4)
│       └── Venue A1-1
└── Community B (ID: 3)
    └── Venue B1
```

**Current Behavior (Incorrect):**
- View City detail page
- Statistics: "Total Venues: 3" ✅ (correct - includes A1, A1-1, B1)
- Venues list: Shows 0 venues ❌ (incorrect - should show A1, A1-1, B1)

**Expected Behavior (After Fix):**
- View City detail page
- Statistics: "Total Venues: 3" ✅
- Venues list: Shows 3 venues (A1, A1-1, B1) ✅

## Benefits of Fix

1. **Consistency:** Venues list matches statistics counts
2. **User Experience:** Users see complete venue information at any hierarchy level
3. **Efficiency:** Users don't need to navigate to each child area individually
4. **Data Integrity:** No confusion about missing venues

## Implementation Pattern

The fix follows an existing pattern in the codebase:

**Already Implemented (Correct):**
- `getStatistics()` - Recursively aggregates from descendants ✅
- `findDescendants()` - Repository method exists and is tested ✅

**Needs Implementation:**
- `getVenues()` - Should follow same pattern as `getStatistics()` ⏭️

## Testing Strategy

### Backend Tests

```typescript
describe('GeographicAreaService.getVenues', () => {
  it('should return venues from area and all descendants', async () => {
    // City > Community > Neighbourhood
    // City: 0 venues, Community: 1 venue, Neighbourhood: 2 venues
    const venues = await service.getVenues(cityId);
    expect(venues).toHaveLength(3);
  });

  it('should return only direct venues when no descendants', async () => {
    const venues = await service.getVenues(leafAreaId);
    expect(venues).toHaveLength(2);
  });

  it('should return empty array when no venues in hierarchy', async () => {
    const venues = await service.getVenues(emptyAreaId);
    expect(venues).toHaveLength(0);
  });
});
```

### Frontend Tests

No new tests required. Existing tests will pass once backend is fixed.

## Related Issues

**Activities Display:**
The GeographicAreaDetail component does not currently display activities. If activities should also be displayed recursively in the future, a similar endpoint would be needed:

- `GET /geographic-areas/:id/activities` - Returns activities at venues in this area and descendants

This is not currently in the requirements and should be considered a separate feature request.

## Files Modified

### Specification Documents
1. ✅ `.kiro/specs/web-frontend/requirements.md` - Updated Requirement 6B.8
2. ✅ `.kiro/specs/web-frontend/design.md` - Updated GeographicAreaDetail description
3. ✅ `.kiro/specs/web-frontend/GEOGRAPHIC_AREA_RECURSIVE_QUERY_REQUIREMENT.md` - Created detailed analysis

### Implementation Files (To Be Modified)
- ⏭️ `backend-api/src/services/geographic-area.service.ts` - Update getVenues() method
- ⏭️ `backend-api/src/__tests__/services/geographic-area.service.test.ts` - Add tests
- ⏭️ `docs/API_CONTRACT.md` - Update documentation

### Implementation Files (No Changes Needed)
- ✅ `web-frontend/src/components/features/GeographicAreaDetail.tsx` - Already correct
- ✅ `web-frontend/src/services/api/geographic-area.service.ts` - Already correct

## Conclusion

The geographic area venues query should be recursive to match the statistics behavior. This is a backend-only fix that requires no frontend changes. The specification documents have been updated to clarify this requirement.

**Status:** ✅ SPECIFICATION UPDATED  
**Backend Fix Required:** ✅ YES  
**Frontend Changes Required:** ❌ NO  
**Breaking Changes:** ❌ NO  
**Priority:** 🔴 HIGH  
**Estimated Backend Fix Time:** 15-30 minutes

---

## Next Steps

1. ✅ Update web-frontend specification (complete)
2. ⏭️ Implement backend fix in `GeographicAreaService.getVenues()`
3. ⏭️ Add backend tests for recursive venue retrieval
4. ⏭️ Update API contract documentation
5. ⏭️ Verify frontend displays recursive results correctly
6. ⏭️ Consider similar fix for activities (future enhancement)
