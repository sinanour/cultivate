# Design Document: Record Merge Feature

## Overview

This document describes the design for a record merging feature that enables users to consolidate duplicate records across multiple entity types. The feature provides a user-friendly interface for field reconciliation on complex entities and atomic database operations to ensure data integrity during the merge process.

The system supports merging for six entity types:
- **Complex entities** (requiring field reconciliation): GeographicArea, Venue, Participant, Activity
- **Simple entities** (no field reconciliation): ActivityType, Population

The merge process follows these high-level steps:
1. User initiates merge from entity detail page
2. User selects source and destination records with ability to swap direction
3. For complex entities: user reconciles field values through interactive UI
4. System performs atomic transaction to migrate related entities and update references
5. System removes duplicates and deletes source record
6. User receives confirmation of success or detailed error message

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Entity Detail    │  │  Merge Components                │ │
│  │ Pages            │  │  - MergeInitiationModal          │ │
│  │ - Participant    │  │  - ReconciliationPage            │ │
│  │ - Activity       │  │  - FieldReconciliationRow        │ │
│  │ - Venue          │  │  - MergeConfirmationDialog       │ │
│  │ - GeographicArea │  │                                  │ │
│  │ - ActivityType   │  │                                  │ │
│  │ - Population     │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST /api/{entityType}/{id}/merge
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Merge Routes     │  │  Merge Services                  │ │
│  │ - participants   │  │  - ParticipantMergeService       │ │
│  │ - activities     │  │  - ActivityMergeService          │ │
│  │ - venues         │  │  - VenueMergeService             │ │
│  │ - geographic-    │  │  - GeographicAreaMergeService    │ │
│  │   areas          │  │  - ActivityTypeMergeService      │ │
│  │ - activity-types │  │  - PopulationMergeService        │ │
│  │ - populations    │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Prisma Raw Queries (Transaction)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  - Atomic transactions via Prisma $transaction              │
│  - Foreign key updates                                       │
│  - Duplicate detection and removal                           │
│  - Source record deletion                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Merge Initiation**:
   - User clicks "Merge" button on entity detail page
   - Frontend opens MergeInitiationModal with current entity pre-populated as source
   - User selects destination entity (or swaps to make current entity the destination)
   - Frontend validates source ≠ destination

2. **Field Reconciliation** (Complex Entities Only):
   - Frontend fetches both source and destination records
   - ReconciliationPage displays three-column layout (source | selector | destination)
   - User reviews fields and selects "Take Source" or "Keep Target" for each field
   - Destination fields are editable; manual edits auto-select "Keep Target"
   - User confirms selections

3. **Merge Execution**:
   - Frontend sends POST request to `/api/{entityType}/{destinationId}/merge`
   - Request body contains: `{ sourceId, reconciledFields? }`
   - Backend validates request and initiates transaction

4. **Transaction Processing**:
   - Update destination record with reconciled fields (if provided)
   - Identify all related entities referencing source
   - Update foreign keys to point to destination
   - Detect and remove duplicates
   - Delete source record
   - Commit transaction or rollback on any failure

5. **Response Handling**:
   - Success: Frontend displays success message and redirects to destination entity
   - Failure: Frontend displays error message with details

## Components and Interfaces

### Frontend Components

#### Merge Button

**Purpose**: Action button on entity detail pages to initiate merge

**Implementation**:
- Component: ResponsiveButton (custom component used throughout the application)
- Icon: "shrink" from CloudScape icon library
- Label: "Merge"
- Placement: In the action buttons section of entity detail pages

#### MergeInitiationModal

**Purpose**: Dialog for selecting source and destination records for merge

**Props**:
```typescript
interface MergeInitiationModalProps {
  entityType: EntityType;
  currentEntityId: string;
  currentEntityName: string;
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: (sourceId: string, destinationId: string) => void;
}
```

**State**:
```typescript
interface MergeInitiationState {
  sourceId: string;
  destinationId: string;
  sourceEntity: Entity | null;
  destinationEntity: Entity | null;
  validationError: string | null;
}
```

**Behavior**:
- Pre-populates `sourceId` with `currentEntityId` on mount
- Provides search/select interface for destination entity
- Implements "Swap" button to exchange source and destination
- Validates source ≠ destination before allowing confirmation
- Displays clear visual indicators for merge direction (e.g., arrow icon)

#### ReconciliationPage

**Purpose**: Table-based interface with card selection for field-by-field reconciliation

**Props**:
```typescript
interface ReconciliationPageProps {
  entityType: ComplexEntityType;
  sourceEntity: ComplexEntity;
  destinationEntity: ComplexEntity;
  onSubmit: (reconciledFields: Record<string, any>) => void;
  onCancel: () => void;
}
```

**State**:
```typescript
interface ReconciliationState {
  fieldSelections: Record<string, 'source' | 'destination'>;
}
```

**Layout**:
- Uses CloudScape `Table` component
- Columns: Field Name | Source Value (Card) | Destination Value (Card)
- Each row represents one field to reconcile
- Source and destination values rendered as Card components with entireCardClickable
- Responsive: Table automatically adapts to mobile screens

**Table Structure**:
```typescript
interface ReconciliationTableItem {
  fieldName: string;
  fieldLabel: string;
  sourceValue: any;
  destinationValue: any;
  selectedValue: 'source' | 'destination';
}
```

**Column Definitions**:
1. Field Name: Display field label (non-interactive)
2. Source Value: Card with entireCardClickable containing source value (interactive)
3. Destination Value: Card with entireCardClickable containing destination value (interactive)

**Card Behavior**:
- Default: All destination cards marked as selected
- Mutual exclusivity: Exactly one card selected per row
- Clicking source card: Marks it as selected, auto-deselects destination card
- Clicking destination card: Marks it as selected, auto-deselects source card
- Clicking selected card: Auto-selects the complementary card in same row
- Visual styling: Selected cards have distinct visual treatment (highlighted border, background, or checkmark)

**No Manual Editing**:
- Field values are not editable
- Users can only choose between source or destination values by clicking cards
- No text inputs or other editing controls
#### MergeConfirmationDialog

**Purpose**: Final confirmation before executing merge

**Props**:
```typescript
interface MergeConfirmationDialogProps {
  entityType: EntityType;
  sourceName: string;
  destinationName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Content**:
- Clear message: "Merge {sourceName} into {destinationName}?"
- Warning: "This action cannot be undone. The source record will be deleted."
- Confirm and Cancel buttons

### Backend API

#### Merge Endpoint

**Route**: `POST /api/{entityType}/{destinationId}/merge`

**Path Parameters**:
- `entityType`: One of `participants`, `activities`, `venues`, `geographic-areas`, `activity-types`, `populations`
- `destinationId`: UUID of destination record

**Request Body**:
```typescript
interface MergeRequest {
  sourceId: string;
  reconciledFields?: Record<string, any>; // Only for complex entities
}
```

**Response**:
```typescript
// Success (200)
interface MergeResponse {
  success: true;
  destinationEntity: Entity;
  message: string;
}

// Error (400/500)
interface MergeErrorResponse {
  success: false;
  error: string;
  details?: string;
}
```

**Validation**:
- Source and destination IDs must be valid UUIDs
- Both records must exist
- Source and destination must be different records
- User must have permission to modify both records (via authorization middleware)

#### Merge Service Interface

Each entity type has a dedicated merge service implementing this interface:

```typescript
interface MergeService<T> {
  /**
   * Merge source record into destination record
   * @param sourceId - ID of record to merge from (will be deleted)
   * @param destinationId - ID of record to merge into (will be updated)
   * @param reconciledFields - Optional field updates for destination
   * @returns Updated destination record
   * @throws Error if merge fails
   */
  merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<T>
  ): Promise<T>;
}
```

### Merge Service Implementations

Each merge service follows this pattern:

```typescript
class EntityMergeService {
  async merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<Entity>
  ): Promise<Entity> {
    return await prisma.$transaction(async (tx) => {
      // Step 1: Validate records exist
      const source = await this.validateRecord(tx, sourceId);
      const destination = await this.validateRecord(tx, destinationId);
      
      // Step 2: Update destination with reconciled fields (if provided)
      if (reconciledFields) {
        await this.updateDestination(tx, destinationId, reconciledFields);
      }
      
      // Step 3: Migrate related entities
      await this.migrateRelatedEntities(tx, sourceId, destinationId);
      
      // Step 4: Remove duplicates
      await this.removeDuplicates(tx, destinationId);
      
      // Step 5: Delete source record
      await this.deleteSource(tx, sourceId);
      
      // Step 6: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }
  
  private async migrateRelatedEntities(
    tx: PrismaTransaction,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Entity-specific migration logic
  }
  
  private async removeDuplicates(
    tx: PrismaTransaction,
    destinationId: string
  ): Promise<void> {
    // Entity-specific duplicate removal logic
  }
}
```

## Data Models

### Entity-Specific Merge Logic

#### Participant Merge

**Related Entities to Migrate**:
- `ParticipantAddressHistory`: Move all address history records
- `Assignment`: Move all activity assignments
- `ParticipantPopulation`: Move all population memberships

**Duplicate Detection**:
- Address History: Same `venueId` AND same `effectiveFrom` date
- Assignments: Same `activityId` AND same `roleId`
- Population Memberships: Same `populationId`

**Migration SQL** (using Prisma raw queries):
```sql
-- Migrate address history
UPDATE participant_address_history
SET participant_id = $destinationId
WHERE participant_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM participant_address_history
    WHERE participant_id = $destinationId
      AND venue_id = participant_address_history.venue_id
      AND effective_from = participant_address_history.effective_from
  );

-- Delete duplicate address history
DELETE FROM participant_address_history
WHERE participant_id = $sourceId;

-- Migrate assignments
UPDATE assignments
SET participant_id = $destinationId
WHERE participant_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE participant_id = $destinationId
      AND activity_id = assignments.activity_id
      AND role_id = assignments.role_id
  );

-- Delete duplicate assignments
DELETE FROM assignments
WHERE participant_id = $sourceId;

-- Migrate population memberships
UPDATE participant_populations
SET participant_id = $destinationId
WHERE participant_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM participant_populations
    WHERE participant_id = $destinationId
      AND population_id = participant_populations.population_id
  );

-- Delete duplicate population memberships
DELETE FROM participant_populations
WHERE participant_id = $sourceId;

-- Delete source participant
DELETE FROM participants WHERE id = $sourceId;
```

#### Activity Merge

**Related Entities to Migrate**:
- `Assignment`: Move all participant assignments
- `ActivityVenueHistory`: Move all venue history records

**Duplicate Detection**:
- Assignments: Same `participantId` AND same `roleId`
- Venue History: Same `venueId` AND same `effectiveFrom` date

**Migration SQL**:
```sql
-- Migrate assignments
UPDATE assignments
SET activity_id = $destinationId
WHERE activity_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM assignments
    WHERE activity_id = $destinationId
      AND participant_id = assignments.participant_id
      AND role_id = assignments.role_id
  );

-- Delete duplicate assignments
DELETE FROM assignments
WHERE activity_id = $sourceId;

-- Migrate venue history
UPDATE activity_venue_history
SET activity_id = $destinationId
WHERE activity_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM activity_venue_history
    WHERE activity_id = $destinationId
      AND venue_id = activity_venue_history.venue_id
      AND effective_from = activity_venue_history.effective_from
  );

-- Delete duplicate venue history
DELETE FROM activity_venue_history
WHERE activity_id = $sourceId;

-- Delete source activity
DELETE FROM activities WHERE id = $sourceId;
```

#### Venue Merge

**Related Entities to Migrate**:
- `ActivityVenueHistory`: Move all activity venue records
- `ParticipantAddressHistory`: Move all participant address records

**Duplicate Detection**:
- Activity Venue History: Same `activityId` AND same `effectiveFrom` date
- Participant Address History: Same `participantId` AND same `effectiveFrom` date

**Migration SQL**:
```sql
-- Migrate activity venue history
UPDATE activity_venue_history
SET venue_id = $destinationId
WHERE venue_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM activity_venue_history
    WHERE venue_id = $destinationId
      AND activity_id = activity_venue_history.activity_id
      AND effective_from = activity_venue_history.effective_from
  );

-- Delete duplicate activity venue history
DELETE FROM activity_venue_history
WHERE venue_id = $sourceId;

-- Migrate participant address history
UPDATE participant_address_history
SET venue_id = $destinationId
WHERE venue_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM participant_address_history
    WHERE venue_id = $destinationId
      AND participant_id = participant_address_history.participant_id
      AND effective_from = participant_address_history.effective_from
  );

-- Delete duplicate participant address history
DELETE FROM participant_address_history
WHERE venue_id = $sourceId;

-- Delete source venue
DELETE FROM venues WHERE id = $sourceId;
```

#### GeographicArea Merge

**Related Entities to Migrate**:
- `GeographicArea` (children): Update parent reference
- `Venue`: Update geographic area reference
- `UserGeographicAuthorization`: Move authorization records

**Duplicate Detection**:
- Child Geographic Areas: Same `name` AND same `areaType`
- Venues: Same `name` AND same `address`
- User Authorizations: Same `userId`

**Migration SQL**:
```sql
-- Migrate child geographic areas
UPDATE geographic_areas
SET parent_geographic_area_id = $destinationId
WHERE parent_geographic_area_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM geographic_areas
    WHERE parent_geographic_area_id = $destinationId
      AND name = geographic_areas.name
      AND area_type = geographic_areas.area_type
  );

-- Delete duplicate child geographic areas
DELETE FROM geographic_areas
WHERE parent_geographic_area_id = $sourceId;

-- Migrate venues
UPDATE venues
SET geographic_area_id = $destinationId
WHERE geographic_area_id = $sourceId;

-- Migrate user authorizations
UPDATE user_geographic_authorizations
SET geographic_area_id = $destinationId
WHERE geographic_area_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM user_geographic_authorizations
    WHERE geographic_area_id = $destinationId
      AND user_id = user_geographic_authorizations.user_id
  );

-- Delete duplicate user authorizations
DELETE FROM user_geographic_authorizations
WHERE geographic_area_id = $sourceId;

-- Delete source geographic area
DELETE FROM geographic_areas WHERE id = $sourceId;
```

#### ActivityType Merge

**Related Entities to Migrate**:
- `Activity`: Update activity type reference

**Duplicate Detection**:
- None (activities can have duplicate activity types)

**Migration SQL**:
```sql
-- Migrate activities
UPDATE activities
SET activity_type_id = $destinationId
WHERE activity_type_id = $sourceId;

-- Delete source activity type
DELETE FROM activity_types WHERE id = $sourceId;
```

#### Population Merge

**Related Entities to Migrate**:
- `ParticipantPopulation`: Move all participant memberships

**Duplicate Detection**:
- Participant Populations: Same `participantId`

**Migration SQL**:
```sql
-- Migrate participant populations
UPDATE participant_populations
SET population_id = $destinationId
WHERE population_id = $sourceId
  AND NOT EXISTS (
    SELECT 1 FROM participant_populations
    WHERE population_id = $destinationId
      AND participant_id = participant_populations.participant_id
  );

-- Delete duplicate participant populations
DELETE FROM participant_populations
WHERE population_id = $sourceId;

-- Delete source population
DELETE FROM populations WHERE id = $sourceId;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I've identified the following redundancies and consolidations:

**Redundancies to eliminate**:
- 3.3 and 3.4 are duplicates of 2.14 and 2.15 (success/error messages)
- Multiple properties about duplicate detection (6.1, 6.3, 6.5, 6.7) can be consolidated into entity-specific properties
- Multiple properties about duplicate removal (6.2, 6.4, 6.6, 6.8) can be consolidated into entity-specific properties
- Properties 5.3-5.8 about specific entity migrations can be consolidated into a general migration property with entity-specific tests

**Properties to consolidate**:
- Related entity migration (5.1, 5.2) with specific entity migrations (5.3-5.8) → Single property about complete migration
- Duplicate detection and removal pairs can be combined into single properties per entity type
- Transaction properties (7.1, 7.2, 7.4, 7.5) can be consolidated into atomicity property

**Final property count**: ~25 unique properties (down from 68 criteria)

### Correctness Properties

Property 1: Source-destination validation
*For any* merge initiation with selected source and destination records, if the source ID equals the destination ID, then the system should display an error and prevent proceeding.
**Validates: Requirements 1.8, 1.9**

Property 2: Entity type routing
*For any* valid merge initiation, the system should route to reconciliation page for complex entities (GeographicArea, Venue, Participant, Activity) and to confirmation dialog for simple entities (ActivityType, Population).
**Validates: Requirements 1.10, 2.1, 3.1, 10.7, 10.8**

Property 3: Card mutual exclusivity
*For any* field row in the reconciliation table, exactly one card (either source or destination) should be selected at all times.
**Validates: Requirements 2.8**

Property 4: Default destination selection
*For any* field row in the reconciliation table, the destination card should be selected by default.
**Validates: Requirements 2.7**

Property 5: Automatic complementary selection
*For any* card in the reconciliation table, when a user clicks it, if it is not already selected, it should become selected and the complementary card in the same row should be automatically deselected; when a user clicks an already-selected card, the complementary card should be automatically selected.
**Validates: Requirements 2.9, 2.10, 2.11**

Property 6: Selected card visual styling
*For any* selected card in the reconciliation table, the card should have distinct visual styling applied to clearly indicate selection.
**Validates: Requirements 2.12**

Property 7: No manual field editing
*For any* field value in the reconciliation table, the system should not provide any facility to manually edit the value.
**Validates: Requirements 2.13**

Property 8: Record existence validation
*For any* merge API request with source and destination IDs, if either record does not exist in the database, then the API should return a 400 error with descriptive message.
**Validates: Requirements 4.2**

Property 9: Field reconciliation application
*For any* complex entity merge with reconciled fields, the destination record should be updated with all provided field values before related entity migration.
**Validates: Requirements 4.3**

Property 10: Validation error response format
*For any* merge API request that fails validation, the response should have status code 400 and include a descriptive error message.
**Validates: Requirements 4.4**

Property 11: Operation error response format
*For any* merge API request that fails during execution, the response should have status code 500 and include a descriptive error message.
**Validates: Requirements 4.5**

Property 12: Success response format
*For any* successful merge operation, the response should have status code 200 and include the complete updated destination record.
**Validates: Requirements 4.6**

Property 13: Complete related entity migration
*For any* entity merge, all records with foreign keys referencing the source record should be updated to reference the destination record instead.
**Validates: Requirements 5.1, 5.2**

Property 14: Participant address history migration
*For any* participant merge, all address history records from the source participant should be migrated to the destination participant, excluding duplicates with matching venue ID and effective date.
**Validates: Requirements 5.3, 6.1, 6.2**

Property 15: Activity assignment migration
*For any* activity merge, all assignment records from the source activity should be migrated to the destination activity, excluding duplicates with matching participant ID and role ID.
**Validates: Requirements 5.4, 6.3, 6.4**

Property 16: Geographic area hierarchy migration
*For any* geographic area merge, all child geographic areas referencing the source as parent should be updated to reference the destination as parent, excluding duplicates with matching name and area type.
**Validates: Requirements 5.5, 6.5, 6.6**

Property 17: Venue history migration
*For any* venue merge, all activity venue history and participant address history records referencing the source venue should be migrated to the destination venue, excluding duplicates with matching entity ID and effective date.
**Validates: Requirements 5.6**

Property 18: Activity type reference migration
*For any* activity type merge, all activities referencing the source activity type should be updated to reference the destination activity type.
**Validates: Requirements 5.7**

Property 19: Population membership migration
*For any* population merge, all participant population records from the source population should be migrated to the destination population, excluding duplicates where the participant already belongs to the destination population.
**Validates: Requirements 5.8, 6.7, 6.8**

Property 20: Transaction atomicity
*For any* merge operation, either all database changes (field updates, migrations, deletions) should be committed together, or all changes should be rolled back if any operation fails.
**Validates: Requirements 7.1, 7.2, 7.4**

Property 21: Rollback error reporting
*For any* merge transaction that is rolled back due to failure, the API response should include an error message indicating the specific failure reason.
**Validates: Requirements 7.5**

Property 22: Source deletion after migration
*For any* successful merge operation, the source record should be deleted only after all related entities have been successfully migrated to the destination.
**Validates: Requirements 8.1, 8.3**

Property 23: Deletion failure rollback
*For any* merge operation where source record deletion fails, the entire transaction should be rolled back and no changes should be persisted.
**Validates: Requirements 8.2**

Property 24: No orphaned entities
*For any* completed merge operation, there should be no related entity records still referencing the deleted source record.
**Validates: Requirements 8.4**

Property 25: Participant assignment migration
*For any* participant merge, all assignment records from the source participant should be migrated to the destination participant, excluding duplicates with matching activity ID and role ID.
**Validates: Requirements 5.3** (Note: This was implied but not explicitly stated in requirements - assignments are related to participants)

## Error Handling

### Validation Errors (400 Bad Request)

**Invalid Request Format**:
- Missing required fields (sourceId)
- Invalid UUID format for IDs
- Response: `{ success: false, error: "Invalid request format", details: "..." }`

**Record Not Found**:
- Source record does not exist
- Destination record does not exist
- Response: `{ success: false, error: "Record not found", details: "Source/Destination record with ID {id} not found" }`

**Same Record Merge**:
- Source ID equals destination ID
- Response: `{ success: false, error: "Invalid merge", details: "Cannot merge a record with itself" }`

**Authorization Errors**:
- User lacks permission to modify source or destination
- Response: `{ success: false, error: "Unauthorized", details: "Insufficient permissions to merge these records" }`

### Operation Errors (500 Internal Server Error)

**Transaction Failures**:
- Database connection lost during transaction
- Constraint violation during migration
- Unexpected error during any transaction step
- Response: `{ success: false, error: "Merge operation failed", details: "..." }`
- All changes are rolled back

**Duplicate Detection Failures**:
- Error identifying duplicates
- Response: `{ success: false, error: "Duplicate detection failed", details: "..." }`
- Transaction is rolled back

**Deletion Failures**:
- Source record cannot be deleted
- Foreign key constraints prevent deletion
- Response: `{ success: false, error: "Source deletion failed", details: "..." }`
- Transaction is rolled back

### Frontend Error Handling

**Network Errors**:
- Display: "Network error. Please check your connection and try again."
- Action: Allow user to retry

**Timeout Errors**:
- Display: "Request timed out. The merge may still be processing. Please refresh and check the destination record."
- Action: Provide refresh button

**API Errors**:
- Display error message from API response
- For 400 errors: Display validation details
- For 500 errors: Display generic error with option to contact support

**Optimistic UI Updates**:
- Do not use optimistic updates for merge operations
- Always wait for API confirmation before updating UI
- Reason: Merge is a destructive operation that cannot be easily undone

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Test specific UI interactions (button clicks, modal opening)
- Test specific API endpoints with known data
- Test error handling with specific error scenarios
- Test component rendering with specific props

**Property-Based Tests**: Verify universal properties across all inputs
- Test merge operations with randomly generated entities
- Test duplicate detection with various duplicate scenarios
- Test transaction rollback with simulated failures
- Test field reconciliation with random field values

Both approaches are complementary and necessary for ensuring correctness.

### Property-Based Testing Configuration

**Library Selection**:
- Frontend: Use `fast-check` (already in package.json)
- Backend: Use `fast-check` with Jest

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `// Feature: record-merge, Property {number}: {property_text}`

**Example Property Test Structure**:
```typescript
// Feature: record-merge, Property 14: Participant address history migration
describe('Participant merge address history migration', () => {
  it('should migrate all address history excluding duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        participantArbitrary,
        participantArbitrary,
        addressHistoryArrayArbitrary,
        async (source, destination, addressHistory) => {
          // Setup: Create source with address history
          // Execute: Merge source into destination
          // Verify: All non-duplicate history migrated
          // Verify: Duplicates removed
          // Verify: Source deleted
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Strategy

**Frontend Unit Tests**:
- Component rendering tests (using React Testing Library)
- User interaction tests (button clicks, form inputs)
- Modal and dialog behavior tests
- API integration tests (using MSW for mocking)
- Responsive layout tests (viewport size changes)

**Backend Unit Tests**:
- Route handler tests (request/response validation)
- Service method tests (with mocked Prisma client)
- Validation logic tests
- Error handling tests
- Authorization middleware tests

**Integration Tests**:
- End-to-end merge flow tests (frontend → backend → database)
- Transaction rollback tests (with real database)
- Duplicate detection tests (with real database)
- Performance tests (merge with large numbers of related entities)

### Test Data Generation

**Arbitraries for Property Tests**:
```typescript
// Entity arbitraries
const participantArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.emailAddress(),
  phone: fc.option(fc.string()),
  // ... other fields
});

const activityArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  activityTypeId: fc.uuid(),
  startDate: fc.date(),
  // ... other fields
});

// Related entity arbitraries
const addressHistoryArbitrary = fc.record({
  id: fc.uuid(),
  participantId: fc.uuid(),
  venueId: fc.uuid(),
  effectiveFrom: fc.date(),
});

const assignmentArbitrary = fc.record({
  id: fc.uuid(),
  activityId: fc.uuid(),
  participantId: fc.uuid(),
  roleId: fc.uuid(),
});

// Duplicate generators
const duplicateAddressHistoryArbitrary = (venueId: string, effectiveFrom: Date) =>
  fc.record({
    id: fc.uuid(),
    participantId: fc.uuid(),
    venueId: fc.constant(venueId),
    effectiveFrom: fc.constant(effectiveFrom),
  });
```

### Test Coverage Goals

**Frontend**:
- Component coverage: >80%
- Integration test coverage: All critical user flows
- Property test coverage: All universal UI properties

**Backend**:
- Service coverage: >90%
- Route coverage: 100%
- Property test coverage: All merge operations and data integrity properties

### Continuous Integration

**Pre-commit Hooks**:
- Run unit tests
- Run linting and type checking

**CI Pipeline**:
- Run all unit tests
- Run all property-based tests
- Run integration tests
- Generate coverage reports
- Fail build if coverage drops below thresholds

## Implementation Notes

### Prisma Transaction Usage

All merge operations must use Prisma's `$transaction` API with raw queries for atomicity:

```typescript
await prisma.$transaction(async (tx) => {
  // All operations here are atomic
  await tx.$executeRaw`UPDATE ...`;
  await tx.$executeRaw`DELETE ...`;
});
```

**Why raw queries?**:
- Prisma's ORM methods may not provide sufficient control for complex migrations
- Raw SQL ensures precise control over UPDATE and DELETE operations
- Raw queries allow for efficient duplicate detection using NOT EXISTS clauses
- Transaction isolation is guaranteed by PostgreSQL

### Performance Considerations

**Large Related Entity Sets**:
- Merges with thousands of related entities may take several seconds
- Consider adding progress indicators for long-running operations
- Consider implementing batch processing for very large datasets

**Database Indexes**:
- Ensure foreign key columns are indexed for efficient updates
- Ensure composite unique constraints exist for duplicate detection
- Example: Index on (participant_id, venue_id, effective_from) for address history

**Query Optimization**:
- Use NOT EXISTS instead of NOT IN for duplicate detection (better performance)
- Use single UPDATE statements instead of loops where possible
- Minimize round trips between application and database

### Security Considerations

**Authorization**:
- Verify user has permission to modify both source and destination records
- Use existing authorization middleware
- Check geographic area permissions for entities with geographic relationships

**Audit Logging**:
- Log all merge operations with source ID, destination ID, and user ID
- Log field changes for complex entity merges
- Log rollback events with failure reasons

**Input Validation**:
- Validate all UUIDs are properly formatted
- Validate reconciled fields match entity schema
- Sanitize all user inputs to prevent SQL injection (Prisma handles this)

### Mobile Considerations

**Responsive Layout**:
- CloudScape ColumnLayout automatically handles responsive behavior
- Test on various mobile devices and screen sizes
- Ensure touch targets are large enough (minimum 44x44 pixels)

**Performance**:
- Minimize data transferred for reconciliation page
- Consider pagination for entities with many fields
- Use loading states to indicate progress

**Offline Support**:
- Merge operations require network connectivity
- Display clear message if offline
- Do not queue merge operations for later (too risky)

### Future Enhancements

**Potential Improvements**:
- Bulk merge: Merge multiple source records into single destination
- Merge preview: Show what will change before executing merge
- Merge history: Track all merges for audit purposes
- Undo merge: Ability to reverse a merge (complex, requires careful design)
- Smart field suggestions: AI-powered suggestions for field reconciliation
- Conflict resolution: Handle cases where related entities have conflicting data

**Not in Scope for Initial Release**:
- Merge across different entity types
- Partial merges (selecting which related entities to migrate)
- Scheduled merges
- Merge approval workflows
