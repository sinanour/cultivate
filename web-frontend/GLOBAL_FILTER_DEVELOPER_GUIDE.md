# Global Geographic Area Filter - Developer Guide

## Quick Start

### Using the Filter in a New Component

If you need to add the global geographic area filter to a new list component, follow these steps:

#### 1. Import the Hook
```typescript
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
```

#### 2. Get the Filter State
```typescript
export function MyNewList() {
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  
  // ... rest of component
}
```

#### 3. Update Your Query
```typescript
const { data: items = [], isLoading } = useQuery({
  queryKey: ['myItems', selectedGeographicAreaId], // Include filter in cache key
  queryFn: () => MyService.getItems(undefined, undefined, selectedGeographicAreaId),
});
```

#### 4. Update Your Service Method
```typescript
export class MyService {
  static async getItems(
    page?: number, 
    limit?: number, 
    geographicAreaId?: string | null
  ): Promise<MyItem[]> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
    
    const query = params.toString();
    return ApiClient.get<MyItem[]>(`/my-items${query ? `?${query}` : ''}`);
  }
}
```

That's it! Your component now respects the global filter.

## Hook API Reference

### `useGlobalGeographicFilter()`

Returns an object with the following properties:

```typescript
interface GlobalGeographicFilterContextType {
  // Current selected geographic area ID (null if "Global" is selected)
  selectedGeographicAreaId: string | null;
  
  // Full geographic area object (null if "Global" is selected)
  selectedGeographicArea: GeographicArea | null;
  
  // Function to set the filter
  setGeographicAreaFilter: (id: string | null) => void;
  
  // Function to clear the filter (same as setGeographicAreaFilter(null))
  clearFilter: () => void;
  
  // Loading state while fetching geographic area details
  isLoading: boolean;
}
```

### Usage Examples

#### Example 1: Basic Usage
```typescript
const { selectedGeographicAreaId } = useGlobalGeographicFilter();

// Use in query
const { data } = useQuery({
  queryKey: ['items', selectedGeographicAreaId],
  queryFn: () => fetchItems(selectedGeographicAreaId),
});
```

#### Example 2: Display Filter Info
```typescript
const { selectedGeographicArea } = useGlobalGeographicFilter();

return (
  <div>
    {selectedGeographicArea ? (
      <p>Filtered by: {selectedGeographicArea.name}</p>
    ) : (
      <p>Showing all areas</p>
    )}
  </div>
);
```

#### Example 3: Programmatically Set Filter
```typescript
const { setGeographicAreaFilter } = useGlobalGeographicFilter();

const handleAreaClick = (areaId: string) => {
  setGeographicAreaFilter(areaId);
};
```

#### Example 4: Clear Filter
```typescript
const { clearFilter } = useGlobalGeographicFilter();

const handleShowAll = () => {
  clearFilter();
};
```

## Best Practices

### 1. Always Include Filter in Query Keys
```typescript
// ✅ GOOD - Filter changes trigger refetch
queryKey: ['items', selectedGeographicAreaId]

// ❌ BAD - Filter changes won't trigger refetch
queryKey: ['items']
```

### 2. Handle Null Values
```typescript
// The filter can be null (meaning "Global")
// Make sure your service handles this:

static async getItems(geographicAreaId?: string | null) {
  const params = new URLSearchParams();
  
  // Only add parameter if it has a value
  if (geographicAreaId) {
    params.append('geographicAreaId', geographicAreaId);
  }
  
  // ...
}
```

### 3. Use Loading States
```typescript
const { isLoading: isFilterLoading } = useGlobalGeographicFilter();
const { data, isLoading: isDataLoading } = useQuery({...});

const isLoading = isFilterLoading || isDataLoading;
```

### 4. Consider Filter in Empty States
```typescript
{items.length === 0 && (
  <Box textAlign="center">
    <b>No items found</b>
    <Box variant="p">
      {selectedGeographicAreaId 
        ? 'No items in this geographic area. Try selecting a different area or clearing the filter.'
        : 'No items to display.'}
    </Box>
  </Box>
)}
```

## Common Patterns

### Pattern 1: Filter-Aware Table Header
```typescript
<Header
  counter={`(${filteredItems.length})`}
  description={
    selectedGeographicArea 
      ? `Filtered by ${selectedGeographicArea.name}`
      : 'Showing all areas'
  }
>
  My Items
</Header>
```

### Pattern 2: Conditional Actions Based on Filter
```typescript
const { selectedGeographicAreaId } = useGlobalGeographicFilter();

const canCreateItem = () => {
  // Only allow creation if a specific area is selected
  return selectedGeographicAreaId !== null;
};
```

### Pattern 3: Filter-Aware Export
```typescript
const handleExport = () => {
  const filename = selectedGeographicArea
    ? `items-${selectedGeographicArea.name}.csv`
    : 'items-all-areas.csv';
    
  exportData(items, filename);
};
```

## Troubleshooting

### Issue: Filter not working
**Check:**
1. Is `GlobalGeographicFilterProvider` wrapping your app in `App.tsx`?
2. Is the filter ID included in your React Query `queryKey`?
3. Does your service method accept and use the `geographicAreaId` parameter?
4. Does your backend API support the `geographicAreaId` query parameter?

### Issue: Filter resets on page navigation
**Check:**
1. The filter should persist automatically via localStorage and URL
2. Make sure you're not clearing localStorage elsewhere
3. Check browser console for errors in the context

### Issue: Filter shows wrong data
**Check:**
1. Verify the React Query cache key includes the filter ID
2. Check that the backend is actually filtering the data
3. Use React Query DevTools to inspect the cache

### Issue: TypeScript errors
**Check:**
1. Import the hook from the correct path: `'../../hooks/useGlobalGeographicFilter'`
2. Ensure `GeographicArea` type is imported from `'../../types'`
3. Check that your service method signature matches the pattern

## Testing Your Implementation

### Manual Test Checklist
- [ ] Filter selector appears in header
- [ ] Selecting an area updates the list
- [ ] Badge shows selected area name
- [ ] Clear button removes filter
- [ ] Filter persists on page reload
- [ ] Filter persists when navigating between pages
- [ ] URL updates with filter parameter
- [ ] Loading states work correctly
- [ ] Empty states show appropriate messages

### Unit Test Example
```typescript
import { renderHook } from '@testing-library/react';
import { useGlobalGeographicFilter } from './useGlobalGeographicFilter';

describe('useGlobalGeographicFilter', () => {
  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useGlobalGeographicFilter());
    }).toThrow('useGlobalGeographicFilter must be used within a GlobalGeographicFilterProvider');
  });
});
```

## Additional Resources

- [CloudScape Select Component](https://cloudscape.design/components/select/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [React Context API](https://react.dev/reference/react/useContext)

## Support

If you encounter issues or have questions:
1. Check this guide first
2. Review the implementation in existing list components
3. Check the browser console for errors
4. Review the `GlobalGeographicFilterContext.tsx` implementation
