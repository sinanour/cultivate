# Design Document: Merge Entity Selection Bugfix

## Overview

This design document describes the solution for fixing a bug in the MergeInitiationModal component where selected entities disappear from dropdowns if they are not in the first page of results. The fix implements an "ensure included" pattern similar to the existing useGeographicAreaOptions hook, ensuring that selected entities remain visible even when they fall outside the initial result set.

## Problem Statement

The MergeInitiationModal component uses AsyncEntitySelect for selecting source and destination records. When a user selects an entity that is not in the first page of results (e.g., an entity with a name starting with 'Z' when results are alphabetically sorted), the entity disappears from the dropdown after selection. This is particularly problematic when using the swap functionality, as swapping causes both entities to potentially disappear if they're not in the initial results.

The GeographicAreaSelector component already solves this problem through the useGeographicAreaOptions hook, which has an `ensureIncluded` parameter that fetches a specific entity by ID if it's not in the initial results.

## Solution Architecture

### High-Level Approach

1. **Extend AsyncEntitySelect** - Add `ensureIncluded` and `fetchByIdFunction` props to support fetching specific entities by ID
2. **Add Service Methods** - Ensure all entity services provide consistent `getById()` methods
3. **Update MergeInitiationModal** - Pass source and destination IDs as `ensureIncluded` props to AsyncEntitySelect components
4. **Maintain Backward Compatibility** - Make all new props optional to avoid breaking existing usages

### Design Pattern: Ensure Included

The "ensure included" pattern works as follows:

1. Component receives an `ensureIncluded` prop containing an entity ID
2. During initial data fetch, component checks if the ensured entity is in the results
3. If not present, component fetches the entity by ID using a dedicated fetch function
4. Component adds the fetched entity to the options list
5. Component formats the entity using the existing `formatOption` function

This pattern is already successfully implemented in `useGeographicAreaOptions` and will be adapted for `AsyncEntitySelect`.

## Component Changes

### AsyncEntitySelect Component

**New Props:**
```typescript
interface AsyncEntitySelectProps {
  // ... existing props ...
  
  /** ID of a specific entity that must be included in options (e.g., when pre-selected) */
  ensureIncluded?: string | null;
  
  /** Function to fetch a single entity by ID (required when ensureIncluded is provided) */
  fetchByIdFunction?: (id: string) => Promise<any>;
}
```

**Implementation Details:**

1. **Initial Fetch Logic:**
   - Fetch initial batch of entities using existing `fetchFunction`
   - Check if `ensureIncluded` entity is in the results
   - If not present and `fetchByIdFunction` is provided, fetch the entity by ID
   - Add fetched entity to options list
   - Format using existing `formatOption` function

2. **Caching Strategy:**
   - Fetch ensured entity only once during initial load
   - Do NOT refetch when search query changes
   - Use React Query for caching the fetch-by-ID request

3. **Error Handling:**
   - Log errors if ensured entity fetch fails
   - Continue without adding the entity (graceful degradation)
   - Do not block the component from rendering

4. **State Management:**
   - Track whether ensured entity has been fetched
   - Merge ensured entity with search results
   - Maintain ensured entity in options even when search query changes

### MergeInitiationModal Component

**Changes:**

1. **Pass ensureIncluded Props:**
   ```typescript
   <AsyncEntitySelect
     value={sourceId}
     onChange={handleSourceChange}
     entityType={asyncEntityType}
     fetchFunction={fetchFunction}
     fetchByIdFunction={fetchByIdFunction}
     formatOption={formatOption}
     ensureIncluded={sourceId}
     placeholder={`Select source ${entityType}`}
   />
   
   <AsyncEntitySelect
     value={destinationId}
     onChange={handleDestinationChange}
     entityType={asyncEntityType}
     fetchFunction={fetchFunction}
     fetchByIdFunction={fetchByIdFunction}
     formatOption={formatOption}
     ensureIncluded={destinationId}
     placeholder={`Select destination ${entityType}`}
   />
   ```

2. **Update getEntityConfig:**
   - Add `fetchByIdFunction` to the configuration object for each entity type
   - Map entity types to their respective service `getById()` methods

## Service Layer Changes

### Required Service Methods

All entity services must provide a consistent `getById()` method for the AsyncEntitySelect component to fetch ensured entities.

**Existing Methods (No Changes Needed):**
- `GeographicAreaService.getGeographicAreaById(id)` ✓ Already exists
- Backend services already have getById methods ✓

**New Methods Required:**

**Frontend Services:**

1. **ParticipantService.getParticipantById(id)**
   ```typescript
   static async getParticipantById(id: string): Promise<Participant> {
     const response = await apiClient.get<Participant>(`/participants/${id}`);
     return response.data;
   }
   ```

2. **ActivityService.getActivityById(id)**
   ```typescript
   static async getActivityById(id: string): Promise<Activity> {
     const response = await apiClient.get<Activity>(`/activities/${id}`);
     return response.data;
   }
   ```

3. **VenueService.getVenueById(id)**
   ```typescript
   static async getVenueById(id: string): Promise<Venue> {
     const response = await apiClient.get<Venue>(`/venues/${id}`);
     return response.data;
   }
   ```

4. **ActivityTypeService.getActivityTypeById(id)**
   ```typescript
   static async getActivityTypeById(id: string): Promise<ActivityType> {
     const response = await apiClient.get<ActivityType>(`/activity-types/${id}`);
     return response.data;
   }
   ```

5. **PopulationService.getPopulationById(id)**
   ```typescript
   static async getPopulationById(id: string): Promise<Population> {
     const response = await apiClient.get<Population>(`/populations/${id}`);
     return response.data;
   }
   ```

**Note:** All backend endpoints already exist and support GET by ID, so only frontend service methods need to be added.

## Implementation Details

### AsyncEntitySelect Ensure Included Logic

```typescript
// Inside AsyncEntitySelect component

const [ensuredEntity, setEnsuredEntity] = useState<any | null>(null);
const [hasEnsuredFetch, setHasEnsuredFetch] = useState(false);

// Fetch ensured entity if needed
useEffect(() => {
  if (!ensureIncluded || !fetchByIdFunction || hasEnsuredFetch) {
    return;
  }

  const fetchEnsured = async () => {
    try {
      const entity = await fetchByIdFunction(ensureIncluded);
      setEnsuredEntity(entity);
      setHasEnsuredFetch(true);
    } catch (error) {
      console.error('Failed to fetch ensured entity:', error);
      setHasEnsuredFetch(true); // Mark as attempted even on failure
    }
  };

  fetchEnsured();
}, [ensureIncluded, fetchByIdFunction, hasEnsuredFetch]);

// Merge ensured entity with search results
const options: AutosuggestProps.Option[] = useMemo(() => {
  if (!data?.data) return [];
  
  const searchResults = data.data.map((entity) => {
    const formatted = formatOption(entity);
    return {
      value: formatted.value,
      label: formatted.label,
      description: formatted.description,
    };
  });

  // Check if ensured entity is already in results
  if (ensuredEntity && ensureIncluded) {
    const hasEnsured = searchResults.some(opt => opt.value === ensureIncluded);
    if (!hasEnsured) {
      const formatted = formatOption(ensuredEntity);
      searchResults.unshift({
        value: formatted.value,
        label: formatted.label,
        description: formatted.description,
      });
    }
  }

  return searchResults;
}, [data, formatOption, ensuredEntity, ensureIncluded]);
```

### MergeInitiationModal getEntityConfig Update

```typescript
function getEntityConfig(entityType: MergeableEntityType) {
  switch (entityType) {
    case 'participant':
      return {
        asyncEntityType: 'participant' as const,
        fetchFunction: ParticipantService.getParticipantsFlexible,
        fetchByIdFunction: ParticipantService.getParticipantById,
        formatOption: (p: any): AsyncEntitySelectOption => ({
          value: p.id,
          label: p.name,
          description: p.email || undefined,
        }),
      };
    case 'activity':
      return {
        asyncEntityType: 'activity' as const,
        fetchFunction: ActivityService.getActivitiesFlexible,
        fetchByIdFunction: ActivityService.getActivityById,
        formatOption: (a: any): AsyncEntitySelectOption => ({
          value: a.id,
          label: a.name,
          description: a.activityType?.name,
        }),
      };
    // ... similar for other entity types
  }
}
```

## Testing Strategy

### Unit Tests

1. **AsyncEntitySelect with ensureIncluded:**
   - Test that ensured entity is fetched when not in initial results
   - Test that ensured entity is not fetched when already in initial results
   - Test that ensured entity is added to options list
   - Test that component works without ensureIncluded (backward compatibility)
   - Test error handling when fetch-by-ID fails

2. **MergeInitiationModal:**
   - Test that source entity remains visible after selection
   - Test that destination entity remains visible after selection
   - Test that swap functionality works with ensured entities
   - Test that both entities remain visible after swap

### Integration Tests

1. Test complete merge flow with entities not in first page of results
2. Test swap functionality with entities from different pages
3. Test that merge works correctly after swapping ensured entities

## Backward Compatibility

All changes are backward compatible:

1. **AsyncEntitySelect:**
   - `ensureIncluded` prop is optional (defaults to undefined)
   - `fetchByIdFunction` prop is optional (defaults to undefined)
   - When neither prop is provided, component behaves exactly as before
   - Existing usages continue to work without modification

2. **Service Methods:**
   - New `getById()` methods are additions, not modifications
   - Existing service methods remain unchanged
   - No breaking changes to service APIs

## Performance Considerations

1. **Minimal Additional Requests:**
   - Ensured entity is fetched only once during initial load
   - No additional fetches on search query changes
   - Uses React Query caching to avoid duplicate requests

2. **Efficient Merging:**
   - Options list merge happens in useMemo for optimal performance
   - Simple array check to determine if entity is already present
   - Minimal overhead when ensureIncluded is not provided

3. **Error Resilience:**
   - Component continues to function even if ensured entity fetch fails
   - Graceful degradation ensures user can still search and select other entities

## Alternative Approaches Considered

### Alternative 1: Always Fetch Selected Entity
**Approach:** Always fetch the selected entity by ID on every render.
**Rejected Because:** Excessive API requests, poor performance, unnecessary when entity is already in results.

### Alternative 2: Increase Initial Page Size
**Approach:** Fetch more entities initially (e.g., 500 instead of 50).
**Rejected Because:** Doesn't solve the problem for large datasets, increases initial load time, wastes bandwidth.

### Alternative 3: Create Separate Hook for Each Entity Type
**Approach:** Create useParticipantOptions, useActivityOptions, etc., similar to useGeographicAreaOptions.
**Rejected Because:** Code duplication, harder to maintain, AsyncEntitySelect is already generic and reusable.

## Conclusion

This design implements the "ensure included" pattern in AsyncEntitySelect, following the proven approach from useGeographicAreaOptions. The solution is minimal, backward compatible, and solves the bug where selected entities disappear from dropdowns in the MergeInitiationModal component.
