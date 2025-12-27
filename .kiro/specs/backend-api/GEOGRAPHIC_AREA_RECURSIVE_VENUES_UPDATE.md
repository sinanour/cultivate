# Geographic Area Recursive Venues - Backend Specification Update

## Date
December 26, 2025

## Overview

Updated the backend-api specification to clarify that the `GET /geographic-areas/:id/venues` endpoint should return venues recursively from the geographic area and all its descendant areas. This matches the recursive behavior already implemented for the statistics endpoint.

## Changes Made

### 1. Requirements Document ✅

**File:** `.kiro/specs/backend-api/requirements.md`

**Updated Requirement 5B.14:**

**Before:**
```markdown
14. THE API SHALL provide a GET /api/geographic-areas/:id/venues endpoint that returns all venues in the geographic area
```

**After:**
```markdown
14. THE API SHALL provide a GET /api/geographic-areas/:id/venues endpoint that returns all venues in the geographic area and all descendant areas (recursive aggregation)
```

### 2. Design Document ✅

**File:** `.kiro/specs/backend-api/design.md`

**Updated Property 87:**

**Before:**
```markdown
**Property 87: Geographic area venues retrieval**
*For any* geographic area, retrieving its venues should return all venues directly associated with that geographic area.
**Validates: Requirements 5B.14**
```

**After:**
```markdown
**Property 87: Geographic area venues retrieval**
*For any* geographic area, retrieving its venues should return all venues in that geographic area and all descendant areas (recursive aggregation).
**Validates: Requirements 5B.14**
```

### 3. API Contract ✅

**File:** `docs/API_CONTRACT.md`

**Updated Endpoint Documentation:**

**Before:**
```markdown
### Get Geographic Area Venues

**Endpoint**: `GET /geographic-areas/:id/venues`

**Response** (200 OK): Array of venues in this geographic area wrapped in `{ success: true, data: [...] }`
```

**After:**
```markdown
### Get Geographic Area Venues

**Endpoint**: `GET /geographic-areas/:id/venues`

**Response** (200 OK): Array of venues in this geographic area **and all descendant areas (recursive)** wrapped in `{ success: true, data: [...] }`

**Note**: This endpoint returns venues recursively, including all venues in child geographic areas and their descendants. This matches the recursive behavior of the statistics endpoint.
```

## Rationale

### Consistency with Statistics

The `GET /geographic-areas/:id/statistics` endpoint already implements recursive aggregation:

```typescript
// From backend-api/src/services/geographic-area.service.ts
async getStatistics(id: string): Promise<GeographicAreaStatistics> {
  // Get all descendant IDs including the area itself
  const descendantIds = await this.geographicAreaRepository.findDescendants(id);
  const areaIds = [id, ...descendantIds];

  // Get all venues in this area and descendants
  const venues = await this.prisma.venue.findMany({
    where: { geographicAreaId: { in: areaIds } },
    select: { id: true },
  });
  
  // ... calculate statistics
}
```

The venues endpoint should follow the same pattern for consistency.

### User Experience

When viewing a high-level geographic area (e.g., City), users expect to see:
- **Statistics:** Total counts including all descendant areas ✅ (already implemented)
- **Venues List:** All venues including those in descendant areas ❌ (currently missing)

Without recursive aggregation, the venues list appears incomplete and inconsistent with the statistics.

### Example Scenario

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
```
GET /geographic-areas/1/statistics
→ { totalVenues: 3 }  ✅ Correct (includes A1, A1-1, B1)

GET /geographic-areas/1/venues
→ []  ❌ Incorrect (should include A1, A1-1, B1)
```

**Expected Behavior (After Fix):**
```
GET /geographic-areas/1/statistics
→ { totalVenues: 3 }  ✅

GET /geographic-areas/1/venues
→ [Venue A1, Venue A1-1, Venue B1]  ✅
```

## Implementation Required

### Backend Service Update

**File:** `backend-api/src/services/geographic-area.service.ts`

**Current Implementation:**
```typescript
async getVenues(id: string) {
  const area = await this.geographicAreaRepository.findById(id);
  if (!area) {
    throw new Error('Geographic area not found');
  }

  return this.geographicAreaRepository.findVenues(id);  // Only direct venues
}
```

**Required Implementation:**
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

### Testing Required

**File:** `backend-api/src/__tests__/services/geographic-area.service.test.ts`

Add test cases for recursive venue retrieval:

```typescript
describe('GeographicAreaService.getVenues', () => {
  it('should return venues from area and all descendants', async () => {
    // Setup: City > Community > Neighbourhood
    // City: 0 venues, Community: 1 venue, Neighbourhood: 2 venues
    
    const venues = await service.getVenues(cityId);
    
    expect(venues).toHaveLength(3);
    expect(venues.map(v => v.name)).toContain('Community Venue');
    expect(venues.map(v => v.name)).toContain('Neighbourhood Venue 1');
    expect(venues.map(v => v.name)).toContain('Neighbourhood Venue 2');
  });

  it('should return only direct venues when no descendants exist', async () => {
    // Setup: Leaf area with 2 venues
    
    const venues = await service.getVenues(leafAreaId);
    
    expect(venues).toHaveLength(2);
  });

  it('should return empty array when area and descendants have no venues', async () => {
    const venues = await service.getVenues(emptyAreaId);
    
    expect(venues).toHaveLength(0);
  });

  it('should order venues by name ascending', async () => {
    const venues = await service.getVenues(areaId);
    
    const names = venues.map(v => v.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });
});
```

## Benefits

1. ✅ **Consistency:** Venues list matches statistics counts
2. ✅ **User Experience:** Complete venue information at any hierarchy level
3. ✅ **Efficiency:** Users don't need to query each child area individually
4. ✅ **Data Integrity:** No confusion about missing venues
5. ✅ **Follows Existing Pattern:** Uses same approach as `getStatistics()`

## Implementation Checklist

### Backend Changes
- [ ] Update `GeographicAreaService.getVenues()` method
- [ ] Add test cases for recursive venue retrieval
- [ ] Verify all existing tests still pass
- [ ] Test with multi-level hierarchies
- [ ] Test with empty areas
- [ ] Test with leaf areas (no descendants)

### Documentation Updates
- [x] Update backend-api requirements.md
- [x] Update backend-api design.md
- [x] Update API contract (docs/API_CONTRACT.md)
- [x] Create this summary document

### Frontend Verification
- [ ] Verify frontend displays recursive results correctly
- [ ] No frontend code changes needed

## Related Frontend Updates

The web-frontend specification has also been updated:

**Files Updated:**
- `.kiro/specs/web-frontend/requirements.md` - Updated Requirement 6B.8
- `.kiro/specs/web-frontend/design.md` - Updated GeographicAreaDetail description
- `.kiro/specs/web-frontend/GEOGRAPHIC_AREA_RECURSIVE_QUERY_REQUIREMENT.md` - Detailed analysis
- `.kiro/specs/web-frontend/GEOGRAPHIC_AREA_RECURSIVE_FIX_SUMMARY.md` - Summary

See web-frontend spec documents for complete frontend perspective.

## Priority

**High Priority** - This is a user-facing inconsistency that makes the geographic area detail view appear broken. The statistics show venue counts that don't match the venues list.

## Estimated Implementation Time

**Backend Fix:** 15-30 minutes
- Update service method: 5 minutes
- Add test cases: 10-15 minutes
- Verify and test: 10 minutes

## Files Modified

### Specification Documents
1. ✅ `.kiro/specs/backend-api/requirements.md` - Updated Requirement 5B.14
2. ✅ `.kiro/specs/backend-api/design.md` - Updated Property 87
3. ✅ `docs/API_CONTRACT.md` - Updated endpoint documentation
4. ✅ `.kiro/specs/backend-api/GEOGRAPHIC_AREA_RECURSIVE_VENUES_UPDATE.md` - This document

### Implementation Files (To Be Updated)
- ⏭️ `backend-api/src/services/geographic-area.service.ts` - Update getVenues() method
- ⏭️ `backend-api/src/__tests__/services/geographic-area.service.test.ts` - Add test cases

### Frontend Files (No Changes Needed)
- ✅ `web-frontend/src/components/features/GeographicAreaDetail.tsx` - Already correct
- ✅ `web-frontend/src/services/api/geographic-area.service.ts` - Already correct

## Conclusion

The backend-api specification has been updated to clarify that the geographic area venues endpoint should return venues recursively from all descendant areas. This matches the recursive behavior already implemented for statistics and provides a consistent, complete user experience.

**Status:** ✅ SPECIFICATION UPDATE COMPLETE  
**Implementation Required:** ✅ YES  
**Breaking Changes:** ❌ NO (enhancement, not breaking change)  
**Frontend Changes Required:** ❌ NO  
**Priority:** 🔴 HIGH  
**Ready for Implementation:** ✅ YES

---

## Next Steps

1. ✅ Update backend-api specification (complete)
2. ⏭️ Implement backend fix in `GeographicAreaService.getVenues()`
3. ⏭️ Add backend tests for recursive venue retrieval
4. ⏭️ Run full test suite to verify no regressions
5. ⏭️ Verify frontend displays recursive results correctly
6. ⏭️ Consider similar enhancement for activities (future)
