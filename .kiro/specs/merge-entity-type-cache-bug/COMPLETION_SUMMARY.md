# Merge Entity Type Cache Bug - Fix Complete ✅

## Summary

Fixed a critical bug where the Activity merge modal was displaying venues instead of activities due to React Query cache key collision. The issue was caused by multiple entity types sharing the same `asyncEntityType` value, causing them to share cached data.

## 🐛 Bug Description

**Symptom**: When initiating a merge from the Activity Detail page, the dropdown showed venues (e.g., "Area 013d680e Venue 057") instead of activities.

**Root Cause**: In `MergeInitiationModal.tsx`, the `getEntityConfig` function was incorrectly setting:
- `activity` → `asyncEntityType: 'venue'` ❌
- `activityType` → `asyncEntityType: 'venue'` ❌  
- `population` → `asyncEntityType: 'venue'` ❌

This caused React Query to use the same cache key for all three entity types, resulting in cached venue data being displayed when fetching activities.

## ✅ Fix Implemented

### 1. Updated AsyncEntitySelect Component
**File**: `web-frontend/src/components/common/AsyncEntitySelect.tsx`

Added support for additional entity types:
```typescript
entityType: 'venue' | 'participant' | 'geographic-area' | 'activity' | 'activity-type' | 'population'
```

### 2. Updated MergeInitiationModal Configuration
**File**: `web-frontend/src/components/merge/MergeInitiationModal.tsx`

Fixed entity type mappings:
- `activity` → `asyncEntityType: 'activity'` ✅
- `activityType` → `asyncEntityType: 'activity-type'` ✅
- `population` → `asyncEntityType: 'population'` ✅

### 3. Added Comprehensive Tests
**File**: `web-frontend/src/components/merge/__tests__/MergeInitiationModal.entity-types.test.tsx`

Created 4 new tests to verify:
- ✅ Participant modal fetches participants (not other entities)
- ✅ Activity modal fetches activities (not venues)
- ✅ Venue modal fetches venues (not other entities)
- ✅ Each entity type uses unique cache keys (no cross-contamination)

## 📊 Test Results

### Before Fix
- Activity modal showed venues ❌
- Cache key collision between entity types ❌

### After Fix
- Activity modal shows activities ✅
- Each entity type has unique cache key ✅
- All 441 frontend tests passing ✅
- 4 new tests added specifically for this bug ✅

```
Test Files  55 passed (55)
Tests       441 passed (441)
Duration    25.19s
```

## 🔧 Technical Details

### React Query Cache Keys

React Query uses the `entityType` parameter as part of the cache key:
```typescript
queryKey: [entityType, 'list', debouncedSearch, selectedGeographicAreaId]
```

**Before Fix** (Cache Collision):
```
activity  → ['venue', 'list', '', null]  ❌ Same key as venue!
venue     → ['venue', 'list', '', null]  ❌ Same key as activity!
```

**After Fix** (Unique Keys):
```
activity  → ['activity', 'list', '', null]  ✅ Unique
venue     → ['venue', 'list', '', null]     ✅ Unique
```

### Why This Matters

When cache keys collide:
1. User opens Activity merge modal → Fetches activities → Cached under 'venue' key
2. User opens Venue merge modal → React Query finds 'venue' key → Returns cached activities ❌
3. User sees activities in venue dropdown (or vice versa)

With unique keys:
1. User opens Activity merge modal → Fetches activities → Cached under 'activity' key ✅
2. User opens Venue merge modal → Fetches venues → Cached under 'venue' key ✅
3. Each modal shows correct entity type ✅

## 🎯 Verification

To verify the fix:

1. **Activity Merge**:
   - Navigate to any Activity detail page
   - Click "Merge" button
   - ✅ Dropdown should show activities (not venues)
   - ✅ Activity names should be displayed

2. **Venue Merge**:
   - Navigate to any Venue detail page
   - Click "Merge" button
   - ✅ Dropdown should show venues (not activities)
   - ✅ Venue names and addresses should be displayed

3. **Other Entity Types**:
   - Test Participant, Geographic Area, Activity Type, and Population merges
   - ✅ Each should show the correct entity type

## 📝 Files Modified

1. `web-frontend/src/components/common/AsyncEntitySelect.tsx`
   - Added 'activity', 'activity-type', and 'population' to valid entity types

2. `web-frontend/src/components/merge/MergeInitiationModal.tsx`
   - Fixed asyncEntityType for activity (venue → activity)
   - Fixed asyncEntityType for activityType (venue → activity-type)
   - Fixed asyncEntityType for population (venue → population)

3. `web-frontend/src/components/merge/__tests__/MergeInitiationModal.entity-types.test.tsx`
   - Added comprehensive tests for entity type consistency

## 🚀 Deployment Status

- ✅ Bug fixed
- ✅ Tests added and passing (441 total)
- ✅ Frontend builds successfully
- ✅ No breaking changes
- ✅ Ready for production

The merge initiation modal now correctly displays the appropriate entity type for each merge operation!
