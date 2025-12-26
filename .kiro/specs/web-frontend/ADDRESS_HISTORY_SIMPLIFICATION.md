# Address History Model Simplification

## Date
December 26, 2025

## Overview

Simplified the participant address history model by removing the `effectiveTo` field and keeping only the `effectiveFrom` field. This change reduces complexity while maintaining complete historical tracking of address changes.

## Rationale

The original Type 2 SCD model with both `effectiveFrom` and `effectiveTo` dates added unnecessary complexity:

1. **Redundant Information**: The end date of one record is implicitly the start date of the next record
2. **Complex Validation**: Required checking for overlapping date ranges
3. **Automatic Closure Logic**: Required automatically setting the end date of the previous record
4. **More Edge Cases**: More validation rules mean more potential bugs

The simplified model with only `effectiveFrom`:

1. **Simpler Data Entry**: Users only specify when an address became effective
2. **Implicit Ranges**: The effective range is from this record's start date to the next record's start date
3. **Easier Validation**: Only need to prevent duplicate start dates
4. **Clearer Mental Model**: More intuitive for users to understand

## Changes Made Across All Specs

### Web Frontend Spec

**requirements.md:**
- Updated 4.11-4.16 to remove references to effective end dates
- Removed 4.17 (automatic closure of previous address)
- Changed "effective date" to "effective start date" for clarity

**design.md:**
- Updated `ParticipantAddressHistory` interface to remove `effectiveTo` field
- Updated AddressHistoryTable component description
- Updated AddressHistoryForm component description
- Updated Properties 11-13 to reflect simplified model
- Removed Properties 14-15 (date range validation, automatic closure)
- Renumbered subsequent properties (14-64 instead of 16-67)

**tasks.md:**
- Updated task 7.4 (AddressHistoryTable) to show only effective start date
- Updated task 7.5 (AddressHistoryForm) to require only effective start date
- Updated task 7.7 (property tests) to test only required fields and duplicate prevention

### Backend API Spec

**requirements.md:**
- Updated 3.11 to describe simplified address history creation
- Added 3.12-3.17 for complete CRUD operations on address history
- Removed references to effective end dates and automatic closure

**design.md:**
- Updated `ParticipantAddressHistory` model to remove `effectiveTo` field
- Updated Property 89 (address history creation)
- Updated Property 90 (address history retrieval)
- Updated Property 91 (current address identification - now based on most recent effectiveFrom)
- Added Property 92 (duplicate prevention)
- Removed old Property 90 (automatic closure)

### System-Level Spec

**requirements.md:**
- Removed Type_2_SCD from glossary (no longer using strict SCD Type 2 pattern)
- Updated 7A.5 to describe simplified temporal tracking

**design.md:**
- Updated `ParticipantAddressHistory` interface to remove `effectiveTo` field
- Updated Property 17 to reflect simplified temporal consistency

## Data Model Comparison

### Before (Type 2 SCD with Ranges)
```typescript
interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
  effectiveTo?: string;   // null for current address
}
```

**Validation Rules:**
- Require venue and effectiveFrom
- Validate effectiveFrom < effectiveTo
- Prevent overlapping date ranges
- Automatically set effectiveTo of previous record

### After (Simplified Temporal Model)
```typescript
interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
}
```

**Validation Rules:**
- Require venue and effectiveFrom
- Prevent duplicate effectiveFrom dates

## Determining Current Address

**Before**: Current address was the record with `effectiveTo === null`

**After**: Current address is the record with the most recent `effectiveFrom` date

**Implementation**:
```typescript
// Get current address
const currentAddress = addressHistory
  .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];

// Get address at specific date
const addressAtDate = (date: Date) => addressHistory
  .filter(h => new Date(h.effectiveFrom) <= date)
  .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];
```

## User Experience Impact

### Data Entry

**Before**:
- User adds new address with effective start date
- System automatically sets end date of previous address
- User sees both start and end dates in table

**After**:
- User adds new address with effective start date only
- No automatic updates to previous records
- User sees only start dates in table (simpler)

### Display

**Before**:
```
Address History:
123 Main St    | 2024-01-01 to 2024-06-01
456 Oak Ave    | 2024-06-01 to present
```

**After**:
```
Address History:
456 Oak Ave    | Effective from 2024-06-01  ← Current
123 Main St    | Effective from 2024-01-01
```

## Migration Path

If existing data has `effectiveTo` fields:

1. **No data loss**: Simply drop the `effectiveTo` column
2. **No transformation needed**: The `effectiveFrom` dates remain unchanged
3. **Current address**: Determined by most recent `effectiveFrom` instead of null `effectiveTo`

## Benefits Summary

1. ✅ **Simpler Implementation**: Fewer fields, less validation logic
2. ✅ **Easier to Understand**: More intuitive for users
3. ✅ **Fewer Bugs**: Less complex validation means fewer edge cases
4. ✅ **Same Functionality**: Still maintains complete address history
5. ✅ **Point-in-Time Queries**: Can still determine address at any historical date
6. ✅ **Better UX**: Simpler data entry with one date field instead of two

## Files Updated

### Web Frontend Spec
- `.kiro/specs/web-frontend/requirements.md`
- `.kiro/specs/web-frontend/design.md`
- `.kiro/specs/web-frontend/tasks.md`
- `.kiro/specs/web-frontend/ADDRESS_HISTORY_UPDATE.md`

### Backend API Spec
- `.kiro/specs/backend-api/requirements.md`
- `.kiro/specs/backend-api/design.md`

### System-Level Spec
- `.kiro/specs/community-activity-tracker/requirements.md`
- `.kiro/specs/community-activity-tracker/design.md`

## Next Steps

1. ✅ All spec files updated
2. ⏭️ Review changes with stakeholders
3. ⏭️ Update backend database schema (remove effectiveTo column)
4. ⏭️ Update backend API implementation
5. ⏭️ Update frontend components
6. ⏭️ Update tests
7. ⏭️ Update user documentation
