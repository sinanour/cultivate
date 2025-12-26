# Temporal Model Simplification - Complete Update

## Date
December 26, 2025

## Overview

Simplified both temporal tracking models in the system by removing `effectiveTo` fields and keeping only `effectiveFrom` fields:

1. **ParticipantAddressHistory** - Tracks participant home address changes
2. **ActivityVenueHistory** - Tracks activity venue changes

This creates a consistent, simplified approach to temporal data across the entire system.

## Rationale

Both models previously used Type 2 SCD with start and end dates, which added unnecessary complexity:

### Problems with Range-Based Model
1. **Redundant Information**: End date of one record is implicitly the start date of the next
2. **Complex Validation**: Required checking for overlapping date ranges
3. **Automatic Closure Logic**: Required complex logic to set end dates
4. **More Edge Cases**: More validation rules increase potential for bugs
5. **Inconsistent Deletion**: DELETE operations had to set effectiveTo instead of removing records

### Benefits of Simplified Model
1. **Simpler Data Entry**: Users only specify when something became effective
2. **Implicit Ranges**: Effective range is from this record's start to next record's start
3. **Easier Validation**: Only need to prevent duplicate start dates
4. **Clearer Mental Model**: More intuitive for users and developers
5. **True Deletion**: DELETE operations actually remove records

## Changes Made

### 1. ParticipantAddressHistory

**Before:**
```typescript
interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
  effectiveTo?: string;   // REMOVED
}
```

**After:**
```typescript
interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
}
```

**Current Address**: Most recent `effectiveFrom` date

### 2. ActivityVenueHistory

**Before:**
```typescript
interface ActivityVenueHistory {
  id: string;
  activityId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
  effectiveTo?: string;   // REMOVED
}
```

**After:**
```typescript
interface ActivityVenueHistory {
  id: string;
  activityId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;
}
```

**Current Venue**: Most recent `effectiveFrom` date

## Spec Files Updated

### Backend API Spec

**design.md:**
- Updated `ParticipantAddressHistory` model
- Updated `ActivityVenueHistory` model
- Updated Properties 89-96 for both models

**requirements.md:**
- Updated 3.11-3.17 for participant address history
- Updated 4.11-4.16 for activity venue history
- Removed glossary reference to Type_2_SCD

**tasks.md:**
- Updated task 7.5 for address history repository
- Will need task 11.5 for venue history repository (similar implementation)

### Web Frontend Spec

**design.md:**
- Updated `ParticipantAddressHistory` interface
- Updated `ActivityVenueHistory` interface
- Updated component descriptions

**requirements.md:**
- Updated 4.11-4.16 for address history management
- Updated 5.14-5.15 for venue history display

**tasks.md:**
- Updated tasks 7.4-7.6 for address history components
- Will need similar tasks for venue history components

### System-Level Spec

**design.md:**
- Updated `ParticipantAddressHistory` interface
- Updated `ActivityVenueHistory` interface
- Updated Property 17 (address history)
- Updated Property 18 (venue history)

**requirements.md:**
- Updated 7A.5 for participant address tracking
- Updated 7A.6-7A.7 for activity venue tracking
- Removed Type_2_SCD from glossary

## Validation Changes

### Removed Validations (Both Models)
- ❌ Effective from date must be before effective to date
- ❌ Date ranges cannot overlap
- ❌ Automatic closure of previous record

### New/Updated Validations (Both Models)
- ✅ Venue/location and effective start date required
- ✅ Prevent duplicate effective start dates
- ✅ Display in reverse chronological order by effective start date

## API Endpoint Changes

### Participant Address History
- GET /api/v1/participants/:id/address-history - Returns history ordered by effectiveFrom desc
- POST /api/v1/participants/:id/address-history - Creates new record
- PUT /api/v1/participants/:id/address-history/:historyId - Updates record
- DELETE /api/v1/participants/:id/address-history/:historyId - Deletes record (true deletion)

### Activity Venue History
- GET /api/v1/activities/:id/venues - Returns history ordered by effectiveFrom desc
- POST /api/v1/activities/:id/venues - Creates new association
- DELETE /api/v1/activities/:id/venues/:venueId - Deletes association (true deletion, not soft delete)

**Note**: DELETE operations now truly remove records instead of setting effectiveTo.

## Property Updates

### Backend API Properties

**ParticipantAddressHistory (Properties 89-92):**
- Property 89: Address history creation (no automatic closure)
- Property 90: Address history retrieval (order by effectiveFrom desc)
- Property 91: Current address (most recent effectiveFrom)
- Property 92: Duplicate prevention (same effectiveFrom)

**ActivityVenueHistory (Properties 93-96):**
- Property 93: Venue association creation (with effectiveFrom)
- Property 94: Venue history retrieval (order by effectiveFrom desc)
- Property 95: Current venue (most recent effectiveFrom)
- Property 96: Duplicate prevention (same effectiveFrom)

### System-Level Properties

- Property 17: Participant address history temporal consistency
- Property 18: Activity venue history temporal tracking

## Implementation Impact

### Database Schema Changes

**ParticipantAddressHistory table:**
- Drop `effectiveTo` column
- Add unique constraint on `[participantId, effectiveFrom]`
- Update indexes

**ActivityVenueHistory table:**
- Drop `effectiveTo` column
- Add unique constraint on `[activityId, effectiveFrom]`
- Update indexes

### Backend API Changes

**Repositories:**
- Remove effectiveTo from all queries
- Update ordering to use effectiveFrom only
- Update duplicate detection to check effectiveFrom only
- Change DELETE operations to actually delete records

**Services:**
- Remove automatic closure logic for both models
- Simplify validation (no overlap checking)
- Update current address/venue logic (most recent effectiveFrom)

**Routes:**
- Update DELETE endpoints to remove records instead of soft delete

### Frontend Changes

**Components:**
- Update history tables to show only effective start date
- Update forms to require only effective start date
- Remove date range validation logic
- Remove automatic closure logic

**Services:**
- Update API client methods
- Simplify validation logic

## Consistency Benefits

By applying the same simplification to both temporal models:

1. ✅ **Consistent Pattern**: Same approach for all temporal tracking
2. ✅ **Easier to Learn**: Developers only need to understand one pattern
3. ✅ **Reduced Complexity**: Half the validation logic across the system
4. ✅ **Better Maintainability**: Changes to temporal logic apply uniformly
5. ✅ **Clearer Documentation**: Single pattern to document and explain

## Migration Path

For both tables:

1. **Database**: Drop `effectiveTo` columns (no data transformation needed)
2. **Backend**: Remove effectiveTo from models, queries, and validation
3. **Frontend**: Remove effectiveTo from interfaces and components
4. **Tests**: Update to test simplified model

## Testing Impact

### Tests Removed (Both Models)
- Date range validation (from < to)
- Overlapping range detection
- Automatic closure logic
- Soft delete logic

### Tests Simplified (Both Models)
- Required field validation (one less field)
- Duplicate detection (only check effectiveFrom)
- Display ordering (single field sort)
- True deletion (simpler than soft delete)

## Documentation Status

✅ **Backend API Spec**
- design.md updated
- requirements.md updated
- tasks.md updated

✅ **Web Frontend Spec**
- design.md updated
- requirements.md updated
- tasks.md updated

✅ **System-Level Spec**
- design.md updated
- requirements.md updated

✅ **Summary Documents**
- ADDRESS_HISTORY_SIMPLIFICATION.md
- TEMPORAL_MODEL_SIMPLIFICATION.md (this document)
- SPEC_UPDATE_SUMMARY.md

## Next Steps

1. ✅ All spec files updated for both models
2. ⏭️ Review changes with stakeholders
3. ⏭️ Update backend database schema (both tables)
4. ⏭️ Update backend implementation (both repositories)
5. ⏭️ Update frontend implementation (both history components)
6. ⏭️ Update tests for both models
7. ⏭️ Update user documentation

## Conclusion

Both temporal tracking models (`ParticipantAddressHistory` and `ActivityVenueHistory`) have been simplified to use only `effectiveFrom` dates. This creates a consistent, maintainable approach to temporal data throughout the system while maintaining complete historical tracking capabilities.

**Key Achievement**: Unified temporal model pattern across the entire system.
