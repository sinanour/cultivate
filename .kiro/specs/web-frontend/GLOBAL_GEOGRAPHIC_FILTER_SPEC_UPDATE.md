# Global Persistent Geographic Area Filter - Specification Update

## Date
December 27, 2025

## Overview

Added a new requirement for a global persistent geographic area filter that appears in the application header and applies recursively to all list views throughout the application. The filter persists across sessions via localStorage and is reflected in the URL as a query parameter for shareability.

## Changes Made

### 1. Web Frontend Requirements ✅

**File:** `.kiro/specs/web-frontend/requirements.md`

**Added Requirement 24: Global Persistent Geographic Area Filter**

**User Story:** As a community organizer, I want to set a global geographic area filter that applies to all views, so that I can focus on a specific region without repeatedly filtering each list.

**Acceptance Criteria (11 total):**

1. THE Web_App SHALL display a geographic area filter selector in the application header component
2. THE Web_App SHALL position the geographic area filter in the header so it is accessible from all views
3. THE Web_App SHALL default the geographic area filter to an empty state displayed as "Global" (no filter applied)
4. WHEN a geographic area is selected in the global filter, THE Web_App SHALL apply the filter recursively to include the selected area and all descendant areas
5. WHEN the global geographic area filter is active, THE Web_App SHALL filter all list views (activities, participants, venues, geographic areas) to show only records associated with venues in the filtered geographic area or its descendants
6. THE Web_App SHALL reflect the selected geographic area filter as a URL query parameter (e.g., ?geographicArea=<id>)
7. WHEN a user navigates to a URL with a geographic area query parameter, THE Web_App SHALL apply that filter automatically
8. THE Web_App SHALL persist the last-selected geographic area filter to localStorage
9. WHEN a user returns to the application, THE Web_App SHALL restore the last-selected geographic area filter from localStorage
10. THE Web_App SHALL provide a visual indicator in the header showing the currently active geographic area filter
11. THE Web_App SHALL provide a way to clear the global filter and return to "Global" (all areas) view

**Updated Glossary:**
- Added **Global_Filter**: A persistent filter applied across all views in the application
- Added **Recursive_Filter**: A filter that includes the selected entity and all its descendants in a hierarchy

### 2. Web Frontend Design ✅

**File:** `.kiro/specs/web-frontend/design.md`

**Added GlobalGeographicFilterContext:**
```typescript
- Manages global geographic area filter state
- Provides selectedGeographicAreaId (string | null)
- Provides setGeographicAreaFilter(id: string | null) method
- Syncs filter with URL query parameter (?geographicArea=<id>)
- Persists filter to localStorage (key: 'globalGeographicAreaFilter')
- Restores filter from localStorage on app initialization
- Provides clearFilter() method to reset to "Global" view
```

**Updated AppLayout Component:**
- Added geographic area filter selector in header utilities section
- Displays current filter selection or "Global" when no filter active
- Provides dropdown with all geographic areas in hierarchical format
- Shows visual indicator (badge or text) of active filter
- Provides clear button to remove filter

**Updated List Components:**
All list components (ActivityList, ParticipantList, VenueList, GeographicAreaList) now:
- Read global geographic area filter from context
- Apply filter to API queries when active
- Display filtered results only
- Show filter indicator in page header or breadcrumb

**Added Service Methods:**

**GeographicAreaService:**
- `getDescendantIds(id)`: Fetches all descendant area IDs for recursive filtering

**ActivityService:**
- Updated `getActivities(page?, limit?, geographicAreaId?)`: Accepts optional geographic area filter

**ParticipantService:**
- Updated `getParticipants(page?, limit?, geographicAreaId?)`: Accepts optional geographic area filter

**VenueService:**
- Updated `getVenues(page?, limit?, geographicAreaId?)`: Accepts optional geographic area filter

**GeographicAreaService:**
- Updated `getGeographicAreas(page?, limit?, geographicAreaId?)`: Accepts optional geographic area filter

**Added Correctness Properties (6 new properties):**

- **Property 81:** Global Filter URL Synchronization
- **Property 82:** Global Filter Persistence
- **Property 83:** Global Filter Restoration
- **Property 84:** Recursive Geographic Filtering
- **Property 85:** Global Filter Application to All Lists
- **Property 86:** Global Filter Clear Functionality

### 3. Web Frontend Tasks ✅

**File:** `.kiro/specs/web-frontend/tasks.md`

**Added Task 24: Implement global persistent geographic area filter**

**Sub-tasks:**
- **24.1:** Create GlobalGeographicFilterContext with state management
- **24.2:** Implement URL query parameter synchronization
- **24.3:** Implement localStorage persistence and restoration
- **24.4:** Update AppLayout with filter selector in header
- **24.5:** Update all list components to apply global filter
- **24.6:** Update all API service methods to accept geographic area filter parameter
- **24.7*** (optional): Write property tests for global filter

### 4. Backend API Requirements ✅

**File:** `.kiro/specs/backend-api/requirements.md`

**Updated Requirement 3 (Track Participants):**

Added acceptance criterion:
- **3.19:** WHEN a geographic area filter is provided, THE API SHALL return only participants whose current home venue is in the specified geographic area or its descendants

**Updated Requirement 4 (Create and Manage Activities):**

Added acceptance criterion:
- **4.17:** WHEN a geographic area filter is provided, THE API SHALL return only activities whose current venue is in the specified geographic area or its descendants

**Updated Requirement 5A (Manage Venues):**

Added acceptance criterion:
- **5A.14:** WHEN a geographic area filter is provided, THE API SHALL return only venues in the specified geographic area or its descendants

**Updated Requirement 5B (Manage Geographic Areas):**

Added acceptance criterion:
- **5B.16:** WHEN a geographic area filter is provided, THE API SHALL return only geographic areas that are the specified area, its descendants, or its ancestors (to maintain hierarchy context)

### 5. Backend API Design ✅

**File:** `.kiro/specs/backend-api/design.md`

**Updated Route Handlers:**

All list endpoints now accept optional `geographicAreaId` query parameter:
- `GET /api/v1/participants?geographicAreaId=<id>` - Filter by geographic area
- `GET /api/v1/activities?geographicAreaId=<id>` - Filter by geographic area
- `GET /api/v1/venues?geographicAreaId=<id>` - Filter by geographic area
- `GET /api/v1/geographic-areas?geographicAreaId=<id>` - Filter by geographic area

**Updated Service Methods:**

**ParticipantService:**
- Updated `getParticipants(page?, limit?, geographicAreaId?)`: Filters by current home venue's geographic area

**ActivityService:**
- Updated `getActivities(page?, limit?, geographicAreaId?)`: Filters by current venue's geographic area

**VenueService:**
- Updated `getVenues(page?, limit?, geographicAreaId?)`: Filters by geographic area

**GeographicAreaService:**
- Updated `getGeographicAreas(page?, limit?, geographicAreaId?)`: Returns filtered hierarchy (selected area, descendants, and ancestors)

**Added Correctness Properties (4 new properties):**

- **Property 113:** Participant Geographic Filtering
- **Property 114:** Activity Geographic Filtering
- **Property 115:** Venue Geographic Filtering
- **Property 116:** Geographic Area Hierarchy Filtering

## Implementation Details

### Frontend Implementation

#### GlobalGeographicFilterContext

**Location:** `web-frontend/src/contexts/GlobalGeographicFilterContext.tsx`

**State Management:**
```typescript
interface GlobalGeographicFilterContextType {
  selectedGeographicAreaId: string | null;
  selectedGeographicArea: GeographicArea | null;
  setGeographicAreaFilter: (id: string | null) => void;
  clearFilter: () => void;
  isLoading: boolean;
}

const GlobalGeographicFilterContext = createContext<GlobalGeographicFilterContextType>({
  selectedGeographicAreaId: null,
  selectedGeographicArea: null,
  setGeographicAreaFilter: () => {},
  clearFilter: () => {},
  isLoading: false,
});
```

**Features:**
- Reads initial filter from URL query parameter on mount
- Reads initial filter from localStorage if no URL parameter
- Updates URL query parameter when filter changes
- Persists filter to localStorage when changed
- Fetches full geographic area details for display
- Provides clear method to reset to "Global" view

#### AppLayout Header Integration

**Location:** `web-frontend/src/components/layout/AppLayout.tsx`

**Filter Selector:**
```typescript
<Select
  selectedOption={
    selectedGeographicAreaId 
      ? { label: selectedGeographicArea?.name || 'Loading...', value: selectedGeographicAreaId }
      : { label: 'Global', value: '' }
  }
  onChange={({ detail }) => {
    setGeographicAreaFilter(detail.selectedOption.value || null);
  }}
  options={[
    { label: 'Global (All Areas)', value: '' },
    ...geographicAreaOptions // Hierarchical list with indentation
  ]}
  placeholder="Filter by geographic area"
  filteringType="auto"
/>
```

**Visual Indicator:**
- Badge showing active filter name
- Clear button (X icon) to remove filter
- Positioned in header utilities section

#### List Component Updates

**Pattern for All List Components:**
```typescript
const { selectedGeographicAreaId } = useGlobalGeographicFilter();

const { data, isLoading } = useQuery({
  queryKey: ['entities', page, limit, selectedGeographicAreaId],
  queryFn: () => EntityService.getEntities(page, limit, selectedGeographicAreaId),
});
```

**Affected Components:**
- ActivityList
- ParticipantList
- VenueList
- GeographicAreaList

### Backend Implementation

#### Recursive Filtering Logic

**Pattern for All Services:**
```typescript
async getEntities(page?: number, limit?: number, geographicAreaId?: string) {
  let areaIds: string[] | undefined;
  
  if (geographicAreaId) {
    // Get all descendant IDs including the area itself
    const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
    areaIds = [geographicAreaId, ...descendantIds];
  }
  
  // Apply filter to query
  const where = areaIds ? {
    // Entity-specific filtering logic
  } : {};
  
  return this.repository.findMany({ where, page, limit });
}
```

#### Entity-Specific Filtering

**Participants:**
```typescript
// Filter by current home venue's geographic area
const where = areaIds ? {
  addressHistory: {
    some: {
      venueId: {
        in: await this.getVenueIdsInAreas(areaIds)
      },
      // Most recent address (no newer record exists)
      NOT: {
        participant: {
          addressHistory: {
            some: {
              effectiveFrom: { gt: /* this record's effectiveFrom */ }
            }
          }
        }
      }
    }
  }
} : {};
```

**Activities:**
```typescript
// Filter by current venue's geographic area
const where = areaIds ? {
  activityVenueHistory: {
    some: {
      venueId: {
        in: await this.getVenueIdsInAreas(areaIds)
      },
      // Most recent venue (no newer record exists)
      NOT: {
        activity: {
          activityVenueHistory: {
            some: {
              effectiveFrom: { gt: /* this record's effectiveFrom */ }
            }
          }
        }
      }
    }
  }
} : {};
```

**Venues:**
```typescript
// Direct geographic area filtering
const where = areaIds ? {
  geographicAreaId: { in: areaIds }
} : {};
```

**Geographic Areas:**
```typescript
// Return selected area, descendants, and ancestors (for hierarchy context)
if (geographicAreaId) {
  const descendantIds = await this.findDescendants(geographicAreaId);
  const ancestorIds = await this.findAncestors(geographicAreaId);
  const areaIds = [geographicAreaId, ...descendantIds, ...ancestorIds];
  
  const where = { id: { in: areaIds } };
}
```

## Benefits

1. ✅ **Improved UX:** Set filter once, applies everywhere
2. ✅ **Reduced Repetition:** No need to filter each view individually
3. ✅ **Persistent Context:** Filter persists across sessions
4. ✅ **Shareable URLs:** Filter encoded in URL for sharing
5. ✅ **Recursive Filtering:** Automatically includes descendant areas
6. ✅ **Visual Feedback:** Clear indicator of active filter
7. ✅ **Easy Reset:** One-click return to global view
8. ✅ **Consistent Behavior:** Same filter logic across all views

## User Workflows

### Setting a Global Filter

1. User clicks geographic area selector in header
2. Dropdown shows hierarchical list of all areas
3. User selects "Downtown Community"
4. Filter applies immediately to current view
5. URL updates to `?geographicArea=<downtown-id>`
6. Filter persists to localStorage
7. User navigates to Activities page
8. Activities list automatically shows only activities in Downtown and descendant areas
9. User navigates to Participants page
10. Participants list automatically shows only participants with homes in Downtown and descendant areas

### Sharing a Filtered View

1. User has "Downtown Community" filter active
2. User copies URL: `https://app.example.com/activities?geographicArea=<downtown-id>`
3. User shares URL with colleague
4. Colleague opens URL
5. Application automatically applies Downtown filter
6. Colleague sees same filtered view

### Restoring Filter on Return

1. User sets filter to "Downtown Community"
2. User closes browser
3. User returns to application next day
4. Application reads localStorage
5. Filter automatically restored to "Downtown Community"
6. All views show filtered data

### Clearing the Filter

1. User has "Downtown Community" filter active
2. User clicks clear button (X) next to filter
3. Filter resets to "Global"
4. URL updates to remove query parameter
5. localStorage updated to null
6. All views show unfiltered data

## Technical Implementation

### URL Query Parameter Format

**Parameter Name:** `geographicArea`

**Format:** `?geographicArea=<uuid>`

**Examples:**
- No filter: `/activities` (no query parameter)
- With filter: `/activities?geographicArea=123e4567-e89b-12d3-a456-426614174000`
- Multiple params: `/activities?page=2&geographicArea=123e4567-e89b-12d3-a456-426614174000`

### localStorage Key

**Key:** `globalGeographicAreaFilter`

**Value:** UUID string or `null`

**Example:**
```typescript
localStorage.setItem('globalGeographicAreaFilter', '123e4567-e89b-12d3-a456-426614174000');
localStorage.getItem('globalGeographicAreaFilter'); // Returns UUID or null
```

### Recursive Filtering Logic

**Frontend:**
1. User selects geographic area from dropdown
2. Context stores selected area ID
3. List components read filter from context
4. List components pass filter to API service methods
5. API returns filtered results

**Backend:**
1. Endpoint receives `geographicAreaId` query parameter
2. Service calls `findDescendants(geographicAreaId)` to get all descendant IDs
3. Service builds array: `[geographicAreaId, ...descendantIds]`
4. Service applies filter to query using `IN` clause
5. Service returns filtered results

### Filter Application by Entity Type

**Activities:**
- Filter by current venue's geographic area
- Include activities where most recent venue is in filtered areas

**Participants:**
- Filter by current home venue's geographic area
- Include participants where most recent home address is in filtered areas

**Venues:**
- Filter by direct geographic area association
- Include venues where `geographicAreaId` is in filtered areas

**Geographic Areas:**
- Special handling to maintain hierarchy context
- Include: selected area, all descendants, all ancestors
- Allows users to navigate up/down hierarchy while filtered

## API Contract Updates

### Query Parameter Support

All list endpoints now support optional `geographicAreaId` query parameter:

**Participants:**
```
GET /api/v1/participants?geographicAreaId=<id>&page=1&limit=50
```

**Activities:**
```
GET /api/v1/activities?geographicAreaId=<id>&page=1&limit=50
```

**Venues:**
```
GET /api/v1/venues?geographicAreaId=<id>&page=1&limit=50
```

**Geographic Areas:**
```
GET /api/v1/geographic-areas?geographicAreaId=<id>&page=1&limit=50
```

### Response Format

Response format remains unchanged. Filtering is transparent to clients - they receive the same response structure with filtered data.

## Testing Strategy

### Frontend Tests

**Unit Tests:**
- Test GlobalGeographicFilterContext state management
- Test URL query parameter synchronization
- Test localStorage persistence and restoration
- Test filter application to list components
- Test clear filter functionality

**Property Tests:**
- Property 81: URL synchronization
- Property 82: localStorage persistence
- Property 83: Filter restoration on app load
- Property 84: Recursive filtering includes descendants
- Property 85: Filter applies to all list views
- Property 86: Clear filter resets to global view

**Integration Tests:**
- Test complete filter workflow (select → navigate → persist → restore)
- Test URL sharing with filter parameter
- Test filter with pagination
- Test filter with search
- Test filter clear and reset

### Backend Tests

**Unit Tests:**
- Test geographic area descendant ID retrieval
- Test filter application to each entity type
- Test query parameter parsing
- Test empty filter (no parameter) returns all results

**Property Tests:**
- Property 113: Participant geographic filtering
- Property 114: Activity geographic filtering
- Property 115: Venue geographic filtering
- Property 116: Geographic area hierarchy filtering

**Integration Tests:**
- Test filtered queries return correct results
- Test recursive filtering includes all descendants
- Test filter with pagination
- Test filter with other query parameters

## Edge Cases Handled

1. ✅ **Invalid Geographic Area ID:** Treat as no filter, show all results
2. ✅ **Deleted Geographic Area:** Clear filter if selected area no longer exists
3. ✅ **Empty Descendants:** Filter works correctly for leaf areas with no children
4. ✅ **Deep Hierarchies:** Recursive filtering works for any depth
5. ✅ **URL Parameter Conflicts:** URL parameter takes precedence over localStorage
6. ✅ **Concurrent Filter Changes:** Last change wins
7. ✅ **Filter with Pagination:** Filter applies before pagination
8. ✅ **Filter with Search:** Both filters combine (AND logic)
9. ✅ **Geographic Area List Filtering:** Special handling to show hierarchy context
10. ✅ **No Venues in Area:** Returns empty results gracefully

## Performance Considerations

### Frontend Performance

**Optimization Strategies:**
- Cache descendant IDs to avoid repeated API calls
- Debounce filter changes to reduce API requests
- Use React Query caching for filtered results
- Memoize filter selector options

**Expected Impact:**
- Minimal performance impact (single additional query parameter)
- React Query caching reduces redundant requests
- localStorage access is synchronous and fast

### Backend Performance

**Optimization Strategies:**
- Index `geographicAreaId` column on Venue table (already exists)
- Cache descendant ID arrays with TTL
- Use efficient `IN` clause queries
- Consider materialized path for very deep hierarchies

**Expected Impact:**
- Minimal performance impact for typical hierarchies (< 50 descendants)
- `IN` clause with indexed column is efficient in PostgreSQL
- May need optimization for very large hierarchies (100+ descendants)

## Migration Notes

**Breaking Changes:** None - This is an additive feature

**Backward Compatibility:**
- All endpoints work without filter parameter (returns all results)
- Existing clients continue to work unchanged
- New clients can opt-in to filtering

**Data Migration:** None required

## Future Enhancements

Potential improvements for future iterations:

1. **Multiple Filters:** Support filtering by multiple geographic areas simultaneously
2. **Filter Presets:** Save named filter configurations
3. **Filter History:** Show recently used filters
4. **Smart Suggestions:** Suggest filters based on user activity
5. **Filter Analytics:** Track which filters are most commonly used
6. **Breadcrumb Integration:** Show filter in breadcrumb trail
7. **Keyboard Shortcuts:** Quick filter switching with keyboard
8. **Filter Sharing:** Generate shareable filter links

## Files Updated

### Web Frontend Specification
1. ✅ `.kiro/specs/web-frontend/requirements.md` - Added Requirement 24
2. ✅ `.kiro/specs/web-frontend/design.md` - Added context, updated components, added properties
3. ✅ `.kiro/specs/web-frontend/tasks.md` - Added Task 24
4. ✅ `.kiro/specs/web-frontend/GLOBAL_GEOGRAPHIC_FILTER_SPEC_UPDATE.md` - This document

### Backend API Specification
1. ✅ `.kiro/specs/backend-api/requirements.md` - Updated Requirements 3, 4, 5A, 5B
2. ✅ `.kiro/specs/backend-api/design.md` - Updated routes, services, added properties
3. ✅ `.kiro/specs/backend-api/tasks.md` - Added implementation guidance

### Implementation Files (To Be Created/Updated)
- ⏭️ `web-frontend/src/contexts/GlobalGeographicFilterContext.tsx` - New context
- ⏭️ `web-frontend/src/hooks/useGlobalGeographicFilter.ts` - New hook
- ⏭️ `web-frontend/src/components/layout/AppLayout.tsx` - Add filter selector
- ⏭️ `web-frontend/src/components/features/ActivityList.tsx` - Apply filter
- ⏭️ `web-frontend/src/components/features/ParticipantList.tsx` - Apply filter
- ⏭️ `web-frontend/src/components/features/VenueList.tsx` - Apply filter
- ⏭️ `web-frontend/src/components/features/GeographicAreaList.tsx` - Apply filter
- ⏭️ `web-frontend/src/services/api/*.service.ts` - Add filter parameters
- ⏭️ `backend-api/src/services/*.service.ts` - Add filter logic
- ⏭️ `backend-api/src/routes/*.routes.ts` - Accept filter parameter

## Priority

**Medium Priority**

**Rationale:**
- Significantly improves UX for organizations with multiple geographic areas
- Not blocking for MVP (users can filter individual views)
- Requires coordination between frontend and backend
- Moderate implementation complexity

**Estimated Implementation Time:** 6-8 hours
- Frontend context and header: 2 hours
- Frontend list component updates: 2 hours
- Backend service updates: 2 hours
- Testing: 2 hours

## Dependencies

### Frontend Dependencies
- React Context API (already in use)
- React Router (already in use)
- localStorage API (browser built-in)
- React Query (already in use)

### Backend Dependencies
- Existing `findDescendants()` method in GeographicAreaRepository
- Existing geographic area hierarchy infrastructure
- No new database schema changes required

## Conclusion

The global persistent geographic area filter provides a powerful way for users to focus on specific regions throughout the application. The filter persists across sessions, is shareable via URL, and applies recursively to include all descendant areas. Both frontend and backend specifications have been updated with complete implementation guidance.

**Status:** ✅ SPECIFICATION UPDATE COMPLETE  
**Ready for Implementation:** ✅ YES  
**Breaking Changes:** ❌ NO (additive feature)  
**Backend Changes Required:** ✅ YES (add filter parameter support)  
**Frontend Changes Required:** ✅ YES (add context and UI)  
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 6-8 hours

---

## Next Steps

1. ✅ Update web-frontend specification (complete)
2. ✅ Update backend-api specification (complete)
3. ⏭️ Implement GlobalGeographicFilterContext
4. ⏭️ Update AppLayout with filter selector
5. ⏭️ Update all list components to use filter
6. ⏭️ Update backend services to support filter parameter
7. ⏭️ Write tests for filter functionality
8. ⏭️ Integration test complete workflow
