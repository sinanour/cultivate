# Form Population Audit Summary

## Audit Date
December 26, 2025

## Executive Summary

All 8 form components in the web-frontend application have been audited. **All forms exhibit the same critical bug**: they initialize state using `useState(entity?.field || '')` but do not update when the entity prop changes. This means when a user clicks "Edit" on an existing record, the form opens with empty fields instead of the current values.

## Common Anti-Pattern Identified

All forms follow this problematic pattern:

```typescript
const [name, setName] = useState(entity?.name || '');
```

This only runs once during component mount. When the parent component passes a new `entity` prop (e.g., when switching from create mode to edit mode), the state does not update.

## Detailed Findings

### 1. ActivityTypeForm
**Location:** `web-frontend/src/components/features/ActivityTypeForm.tsx`

**Current Implementation:**
- Prop: `activityType: ActivityType | null`
- State initialization: `useState(activityType?.name || '')`
- **Issue:** No useEffect to update state when `activityType` changes

**Fields Affected:**
- `name` - Not populated on edit

**Additional Notes:**
- Version field is properly handled in submit
- Validation logic is correct
- Version conflict handling is implemented

### 2. ParticipantRoleForm
**Location:** `web-frontend/src/components/features/ParticipantRoleForm.tsx`

**Current Implementation:**
- Prop: `role: ParticipantRole | null`
- State initialization: `useState(role?.name || '')`
- **Issue:** No useEffect to update state when `role` changes

**Fields Affected:**
- `name` - Not populated on edit

**Additional Notes:**
- Version field is properly handled in submit
- Validation logic is correct
- Version conflict handling is implemented

### 3. ParticipantForm
**Location:** `web-frontend/src/components/features/ParticipantForm.tsx`

**Current Implementation:**
- Prop: `participant: Participant | null`
- State initialization for all fields uses `useState(participant?.field || '')`
- **Issue:** No useEffect to update state when `participant` changes

**Fields Affected:**
- `name` - Not populated on edit
- `email` - Not populated on edit
- `phone` - Not populated on edit
- `notes` - Not populated on edit
- `homeVenueId` - Initialized as empty string, not from participant

**Additional Notes:**
- Version field is properly handled in submit
- Validation logic is correct
- Version conflict handling is implemented via useVersionConflict hook
- Home venue selection is particularly problematic - always starts empty

### 4. ActivityForm
**Location:** `web-frontend/src/components/features/ActivityForm.tsx`

**Current Implementation:**
- Prop: `activity: Activity | null`
- State initialization for all fields uses `useState(activity?.field || '')`
- **Issue:** No useEffect to update state when `activity` changes

**Fields Affected:**
- `name` - Not populated on edit
- `activityTypeId` - Not populated on edit
- `status` - Not populated on edit (defaults to 'PLANNED')
- `startDate` - Not populated on edit
- `endDate` - Not populated on edit
- `isOngoing` - Not populated on edit (defaults to false)

**Additional Notes:**
- Version field is properly handled in submit
- Validation logic is correct
- Version conflict handling is implemented via useVersionConflict hook
- Date formatting (split by 'T') is correct
- Conditional endDate logic based on isOngoing is correct

### 5. AssignmentForm
**Location:** `web-frontend/src/components/features/AssignmentForm.tsx`

**Current Implementation:**
- Props: `activityId: string, existingAssignments: Assignment[]`
- **Issue:** This form is for creating NEW assignments only, not editing
- State initialization: All fields start empty

**Fields Affected:**
- N/A - This form doesn't support edit mode

**Additional Notes:**
- This form is correctly implemented for its purpose (create only)
- No edit functionality exists for assignments
- Assignments are removed/deleted, not edited
- **No fix needed for this form**

### 6. VenueForm
**Location:** `web-frontend/src/components/features/VenueForm.tsx`

**Current Implementation:**
- Prop: `venue: Venue | null`
- State initialization for all fields uses `useState(venue?.field || '')`
- **Issue:** No useEffect to update state when `venue` changes

**Fields Affected:**
- `name` - Not populated on edit
- `address` - Not populated on edit
- `geographicAreaId` - Not populated on edit
- `latitude` - Not populated on edit
- `longitude` - Not populated on edit
- `venueType` - Not populated on edit

**Additional Notes:**
- Version field is properly handled in submit
- Validation logic is correct
- Version conflict handling is implemented via useVersionConflict hook
- Number conversion for lat/long is correct

### 7. GeographicAreaForm
**Location:** `web-frontend/src/components/features/GeographicAreaForm.tsx`

**Current Implementation:**
- Prop: `geographicArea: GeographicArea | null`
- State initialization for all fields uses `useState(geographicArea?.field || '')`
- **Issue:** No useEffect to update state when `geographicArea` changes

**Fields Affected:**
- `name` - Not populated on edit
- `areaType` - Not populated on edit
- `parentGeographicAreaId` - Not populated on edit

**Additional Notes:**
- Version field is properly handled in submit
- Validation logic is correct
- Version conflict handling is implemented via useVersionConflict hook
- Circular relationship validation is implemented

### 8. UserForm
**Location:** `web-frontend/src/components/features/UserForm.tsx`

**Current Implementation:**
- Prop: `user: User | null`
- State initialization for all fields uses `useState(user?.field || '')`
- **Issue:** No useEffect to update state when `user` changes

**Fields Affected:**
- `email` - Not populated on edit
- `password` - Correctly starts empty (optional on edit)
- `role` - Not populated on edit (defaults to 'READ_ONLY')

**Additional Notes:**
- No version field handling (User entity doesn't have version in spec)
- Validation logic is correct
- Password is correctly optional on edit

## Root Cause Analysis

The root cause is consistent across all forms:

1. **Initial state only:** `useState()` with entity prop only runs on component mount
2. **No effect hook:** Missing `useEffect` to watch for entity prop changes
3. **Modal reuse:** Forms are likely reused in modals that stay mounted, so switching from create to edit doesn't remount the component

## Impact Assessment

**Severity:** CRITICAL
- Users cannot edit any records without manually re-entering all data
- High risk of data loss (users might not notice fields are empty)
- Extremely poor user experience
- Affects all entity management in the application

**Affected Users:** All users (ADMINISTRATOR, EDITOR roles)

**Affected Entities:**
- Activity Types (7 forms affected)
- Participant Roles (7 forms affected)
- Participants (7 forms affected)
- Activities (7 forms affected)
- Venues (7 forms affected)
- Geographic Areas (7 forms affected)
- Users (7 forms affected)

**Note:** AssignmentForm is not affected as it's create-only.

## Solution Pattern

All forms need this fix:

```typescript
import { useState, useEffect, type FormEvent } from 'react';

export function EntityForm({ entity, onSuccess, onCancel }: EntityFormProps) {
  const [name, setName] = useState('');
  // ... other state

  // Add this useEffect to update form when entity changes
  useEffect(() => {
    if (entity) {
      setName(entity.name || '');
      // ... set other fields
    } else {
      // Reset to defaults for create mode
      setName('');
      // ... reset other fields
    }
  }, [entity]);

  // ... rest of component
}
```

## Priority Order for Fixes

Based on complexity and user impact:

1. **ActivityTypeForm** - Simple (1 field)
2. **ParticipantRoleForm** - Simple (1 field)
3. **UserForm** - Simple (3 fields, no version)
4. **GeographicAreaForm** - Medium (3 fields)
5. **VenueForm** - Medium (6 fields)
6. **ParticipantForm** - Medium (5 fields)
7. **ActivityForm** - Complex (6 fields, conditional logic)

## Testing Strategy

For each fixed form, verify:
1. ✅ Opens empty when creating new entity
2. ✅ Populates all fields when editing existing entity
3. ✅ Updates fields when switching between different entities
4. ✅ Clears fields when switching from edit to create
5. ✅ Preserves validation logic
6. ✅ Preserves version field handling
7. ✅ Preserves conflict resolution

## Next Steps

1. ✅ Audit complete
2. ⏭️ Implement fixes in priority order
3. ⏭️ Test each form after fix
4. ⏭️ Commit each fix individually
5. ⏭️ Integration test all forms together
