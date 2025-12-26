# Address History Management Update

## Date
December 26, 2025

## Overview

Updated the web-frontend spec to properly handle participant home address history using a simplified temporal model. Instead of tracking effective date ranges with both start and end dates, the system now uses only an effective start date for each address record. The most recent record (by effective start date) represents the current address.

## Changes Made

### 1. Requirements Document Updates

**Requirement 4: Participant Management UI**

Updated acceptance criteria to include simplified address history management:

- **4.11**: Display a table of the participant's home address history in reverse chronological order
- **4.12**: Provide an interface to add new address history records with venue and effective start date
- **4.13**: Provide an interface to edit existing address history records
- **4.14**: Provide an interface to delete address history records
- **4.15**: Validate that address history records have a venue and effective start date
- **4.16**: Prevent duplicate address history records with the same effective start date for the same participant

**Removed**: Previous criteria about overlapping date ranges and automatic closure of previous addresses (no longer needed with simplified model).

### 2. Design Document Updates

**Component Updates:**

Updated components for simplified address history:

- **AddressHistoryTable**: Displays history in reverse chronological order by effective start date, highlights most recent address
- **AddressHistoryForm**: Modal form for adding/editing address records with only effective start date (no end date)

**Data Model Updates:**

Simplified `ParticipantAddressHistory` interface:
```typescript
interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;  // ISO 8601 date - only field needed
}
```

**Correctness Properties:**

Updated properties (11-13) for simplified address history:

- **Property 11**: Address History Display Order - records displayed in reverse chronological order by effective start date
- **Property 12**: Address History Required Fields - venue and effective start date required
- **Property 13**: Address History Duplicate Prevention - prevent duplicate effective start dates

Removed properties for:
- Date range validation (from < to) - no longer applicable
- Non-overlapping ranges - no longer applicable
- Automatic closure - no longer applicable

All subsequent properties renumbered (14-64 instead of 16-67).

### 3. Tasks Document Updates

**Task 7: Implement participant management UI**

Updated sub-tasks for simplified model:

- **7.4**: Create AddressHistoryTable component - show venue and effective start date only
- **7.5**: Create AddressHistoryForm component - require only effective start date
- **7.6**: Implement ParticipantAddressHistoryService - simplified CRUD operations
- **7.6**: Write property test for address history display order
- **7.7**: Write property tests for simplified validation (required fields, duplicate prevention)

## Simplified Temporal Model

The address history implementation uses a simplified approach:

**Data Structure:**
```typescript
interface ParticipantAddressHistory {
  id: string;
  participantId: string;
  venueId: string;
  venue?: Venue;
  effectiveFrom: string;  // ISO 8601 date
}
```

**Key Characteristics:**

1. **Historical Tracking**: Every address change is preserved with its effective start date
2. **Current Address**: Record with the most recent effective start date represents current address
3. **Simplicity**: No end dates to manage or validate
4. **Implicit Ranges**: The effective range is from this record's start date to the next record's start date (or present for the most recent)

**User Workflow:**

1. User views participant detail page
2. Address history table shows all historical addresses in reverse chronological order (most recent first)
3. Most recent address is highlighted
4. User clicks "Add Address" to create new address record with effective start date
5. New record becomes the most recent address
6. User can edit historical records to correct dates or venues
7. User can delete historical records if entered in error

**Advantages Over Range-Based Model:**

1. **Simpler Data Entry**: Users only specify when an address became effective, not when it ended
2. **No Overlap Validation**: No need to check for overlapping date ranges
3. **No Automatic Closure**: No complex logic to close previous addresses
4. **Easier to Understand**: More intuitive mental model for users
5. **Fewer Edge Cases**: Simpler validation rules reduce bugs

## API Endpoints

The implementation uses these Backend API endpoints:

- `GET /participants/:id/address-history` - Fetch address history
- `POST /participants/:id/address-history` - Create new address record
- `PUT /participants/:id/address-history/:historyId` - Update existing record
- `DELETE /participants/:id/address-history/:historyId` - Delete address record

## Benefits

1. **Complete History**: Full audit trail of participant address changes
2. **Point-in-Time Queries**: Can determine participant's address at any historical date by finding the most recent record before that date
3. **Data Integrity**: Prevents duplicate effective start dates
4. **User-Friendly**: Simpler data entry with only one date field
5. **Flexibility**: Users can correct historical data through edit/delete operations

## Testing Strategy

**Unit Tests:**
- Test address history table rendering with various data
- Test form validation for required fields
- Test duplicate effective start date prevention
- Test reverse chronological ordering

**Property Tests:**
- Property 11: Verify reverse chronological ordering by effective start date
- Property 12: Verify required field validation (venue and effective start date)
- Property 13: Verify duplicate effective start date prevention

## Migration Considerations

**Existing Data:**
If address history records currently have `effectiveTo` fields, migration would involve:

1. For each address history record:
   - Keep the `effectiveFrom` field (rename to `effectiveFrom` if needed)
   - Drop the `effectiveTo` field
   - No data transformation needed

2. Update database schema to remove `effectiveTo` column

**Note**: This migration would be handled by the backend, not the frontend.

## Next Steps

1. Review this simplified update with stakeholders
2. Implement the new components (AddressHistoryTable, AddressHistoryForm)
3. Implement the ParticipantAddressHistoryService
4. Update ParticipantDetail to integrate address history table
5. Write unit and property tests
6. Update user documentation

## Questions for Review

1. Should users be able to add future-dated addresses (effective start date in the future)?
2. Should there be a limit on how far back historical addresses can be edited?
3. Should deleting an address history record require confirmation?
4. Should the system prevent deletion of the most recent address?
