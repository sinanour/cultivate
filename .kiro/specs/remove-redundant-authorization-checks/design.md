# Design Document: Remove Redundant Authorization Checks

## Overview

This design document describes the refactoring of the GlobalGeographicFilterContext to remove redundant frontend authorization checks. The current implementation fetches authorized areas and validates filter selections before allowing users to set the global geographic filter. This is unnecessary because the backend API already enforces geographic authorization on all endpoints.

The refactoring simplifies the frontend code, reduces API calls, and establishes a clear separation of concerns: the backend enforces authorization, and the frontend handles authorization errors gracefully.

## Current Architecture Problems

### Problem 1: Redundant Authorization Fetching

The GlobalGeographicFilterContext currently:
1. Fetches authorized areas via `getAuthorizedAreas(user.id)` on user change
2. Extracts directly authorized area IDs and stores them in `authorizedAreaIds` state
3. Validates filter selections against this set before allowing filter changes

This is redundant because:
- The backend already filters geographic areas based on user authorization
- When fetching available areas, the backend only returns areas the user can access
- The frontend validation provides no additional security or functionality

### Problem 2: Complex State Management

The current implementation maintains multiple pieces of authorization state:
- `authorizedAreaIds`: Set of area IDs the user can filter by
- `hasAuthorizationRules`: Boolean indicating if user has any rules
- `isAuthorizedArea()`: Method to check if an area is authorized

This complexity is unnecessary when the backend handles authorization.

### Problem 3: Validation in Multiple Places

Authorization validation occurs in:
- URL sync useEffect (validates URL parameter)
- localStorage restoration (validates stored filter)
- setGeographicAreaFilter method (validates new filter)

Each validation point adds complexity and potential for bugs.

## Proposed Architecture

### Simplified Authorization Model

**Backend Responsibility:**
- Enforce all geographic authorization rules
- Filter geographic areas based on user permissions
- Return 403 errors for unauthorized access attempts

**Frontend Responsibility:**
- Display geographic areas returned by backend (all are authorized)
- Handle 403 authorization errors by clearing filter and showing message
- Trust backend authorization enforcement

### Removed Components

**State Variables:**
- `authorizedAreaIds: Set<string>` - No longer needed
- `hasAuthorizationRules: boolean | null` - No longer needed

**Methods:**
- `isAuthorizedArea(areaId: string): boolean` - No longer needed

**Effects:**
- useEffect that fetches authorized areas on user change - Removed
- Authorization validation in URL sync useEffect - Removed
- Authorization validation in setGeographicAreaFilter - Removed
- Authorization validation in localStorage restoration - Removed

### Preserved Components

**GeographicAuthorizationManager:**
- Continues to use `getAuthorizedAreas()` for displaying effective access summary
- This is the legitimate use case: administrators viewing user permissions
- No changes needed to this component

**Error Handling:**
- Subscription to `geographicFilterEvents` - Preserved
- Clearing filter on authorization error - Preserved
- This handles cases where backend returns 403 for unauthorized access

## Implementation Details

### GlobalGeographicFilterContext Changes

**Context Interface:**
```typescript
interface GlobalGeographicFilterContextType {
  selectedGeographicAreaId: string | null;
  selectedGeographicArea: GeographicArea | null;
  availableAreas: GeographicAreaWithHierarchy[];
  // REMOVED: authorizedAreaIds: Set<string>;
  setGeographicAreaFilter: (id: string | null) => void;
  clearFilter: () => void;
  isLoading: boolean;
  // REMOVED: isAuthorizedArea: (areaId: string) => boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  loadMoreAreas: () => Promise<void>;
  hasMorePages: boolean;
}
```

**Simplified setGeographicAreaFilter:**
```typescript
const setGeographicAreaFilter = (id: string | null) => {
  // No authorization validation - trust backend
  setSelectedGeographicAreaId(id);

  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('geographicArea', id);
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  } else {
    clearFilterState();
  }
};
```

**Simplified URL Sync useEffect:**
```typescript
useEffect(() => {
  if (!user) {
    return;
  }

  const searchParams = new URLSearchParams(location.search);
  const urlGeographicAreaId = searchParams.get('geographicArea');

  if (urlGeographicAreaId) {
    // Apply filter from URL without validation
    if (selectedGeographicAreaId !== urlGeographicAreaId) {
      setSelectedGeographicAreaId(urlGeographicAreaId);
      localStorage.setItem(STORAGE_KEY, urlGeographicAreaId);
    }
  } else if (selectedGeographicAreaId === null) {
    // Restore from localStorage without validation
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) {
      setSelectedGeographicAreaId(storedId);
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.set('geographicArea', storedId);
      navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
    }
  } else if (selectedGeographicAreaId !== null && !urlGeographicAreaId) {
    // Sync selected area to URL
    const newSearchParams = new URLSearchParams(location.search);
    newSearchParams.set('geographicArea', selectedGeographicAreaId);
    navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
  }
}, [location.search, location.pathname, user]);
```

**Removed useEffect:**
```typescript
// DELETE THIS ENTIRE EFFECT:
// useEffect(() => {
//   if (!user) {
//     setAuthorizedAreaIds(new Set());
//     setHasAuthorizationRules(false);
//     return;
//   }
//
//   const fetchAuthorizedAreas = async () => {
//     const authorizedAreas = await geographicAuthorizationService.getAuthorizedAreas(user.id);
//     // ... validation logic ...
//   };
//
//   fetchAuthorizedAreas();
// }, [user]);
```

### Error Handling Flow

**When Backend Returns 403:**
1. API client intercepts 403 response
2. API client emits geographic authorization error event via `geographicFilterEvents`
3. GlobalGeographicFilterContext receives event via subscription
4. Context clears the filter and reverts to "Global" view
5. User sees error message from the API response

This flow already exists and will continue to work correctly.

## Benefits

### 1. Reduced Complexity
- Removes ~80 lines of authorization validation code
- Eliminates 3 state variables related to authorization
- Simplifies context interface

### 2. Fewer API Calls
- Eliminates one API call per user session (getAuthorizedAreas on login)
- Reduces initial page load time

### 3. Single Source of Truth
- Backend is the sole authority for authorization decisions
- No risk of frontend/backend authorization inconsistencies
- Easier to maintain and debug authorization logic

### 4. Better Separation of Concerns
- Backend: Enforce authorization rules
- Frontend: Display authorized data and handle errors
- Clear responsibility boundaries

## Migration Strategy

### Phase 1: Update GlobalGeographicFilterContext
1. Remove authorization-related state variables
2. Remove authorization validation from filter setting logic
3. Remove authorization validation from URL/localStorage sync
4. Update context interface to remove authorization methods
5. Simplify provider value

### Phase 2: Update Dependent Components
1. Search for any components using `authorizedAreaIds` from context
2. Search for any components using `isAuthorizedArea()` from context
3. Update or remove those usages (likely none exist)

### Phase 3: Testing
1. Verify global filter works correctly with authorized areas
2. Verify backend returns 403 for unauthorized areas
3. Verify filter clears automatically on 403 errors
4. Verify GeographicAuthorizationManager still works for admin use case

## Backward Compatibility

This change is backward compatible because:
- The context interface changes are internal to the context
- No external components currently use the removed properties
- The filter behavior remains the same from the user's perspective
- Error handling for unauthorized access remains functional

## Security Considerations

This change does NOT reduce security because:
- Backend authorization enforcement is unchanged
- Frontend never had the authority to grant access
- Frontend validation was purely cosmetic
- Backend always validates authorization on every request
- 403 errors are still handled and displayed to users

The frontend's role is to provide a good user experience, not to enforce security. Security enforcement belongs in the backend.
