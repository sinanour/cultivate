# Requirements Document

## Introduction

This document specifies the requirements for a record merging feature that allows users to merge duplicate records across multiple entity types in the system. The feature enables consolidation of duplicate data by moving all related entities from a source record to a destination record, with user-guided field reconciliation for complex entities.

## Glossary

- **System**: The complete application including backend API and web frontend
- **Backend**: The Express/Prisma-based REST API service
- **Frontend**: The React-based web application using CloudScape components
- **Complex_Entity**: An entity type requiring field reconciliation (GeographicArea, Venue, Participant, Activity)
- **Simple_Entity**: An entity type not requiring field reconciliation (ActivityType, Population)
- **Source_Record**: The record being merged from (will be deleted after merge)
- **Destination_Record**: The record being merged into (will be updated and retained)
- **Related_Entity**: An entity that references another entity through a foreign key relationship
- **Reconciliation_Page**: A UI page displaying source and destination field values as selectable cards for user review
- **Field_Card**: A CloudScape Card component with entireCardClickable property allowing users to choose between source and destination field values
- **Merge_Transaction**: A database transaction containing all merge operations
- **Address_History_Entry**: A ParticipantAddressHistory record linking a participant to a venue
- **Assignment**: A relationship between a participant and an activity through the Assignment table

## Requirements

### Requirement 1: Merge Initiation UI

**User Story:** As a user, I want to initiate a merge from the entity detail page, so that I can consolidate duplicate records.

#### Acceptance Criteria

1. WHEN viewing any supported entity detail page, THE Frontend SHALL display a "Merge" action button
2. WHEN a user clicks the "Merge" button, THE Frontend SHALL display a modal or dialog for selecting both the Source_Record and Destination_Record
3. WHEN the merge dialog opens, THE Frontend SHALL pre-populate the Source_Record field with the current entity being viewed
4. THE Frontend SHALL provide a search or selection interface to choose the Destination_Record from existing records of the same entity type
5. THE Frontend SHALL display a "Swap" button in the merge dialog to reverse the source and destination selections
6. WHEN a user clicks the "Swap" button, THE Frontend SHALL exchange the Source_Record and Destination_Record values
7. THE Frontend SHALL provide clear visual indicators showing the merge direction from source to destination
8. WHEN a user selects both source and destination records, THE Frontend SHALL validate that they are different records
9. WHEN the source and destination are the same record, THE Frontend SHALL display an error message and prevent proceeding
10. WHEN valid Source_Record and Destination_Record are selected, THE Frontend SHALL proceed to the appropriate merge flow based on entity type

### Requirement 2: Complex Entity Merge with Reconciliation

**User Story:** As a user, I want to merge complex entity records with field reconciliation, so that I can consolidate duplicate records while choosing the correct field values.

#### Acceptance Criteria

1. WHEN a user initiates a merge for a Complex_Entity, THE Frontend SHALL display a Reconciliation_Page before submitting the merge
2. WHEN displaying the Reconciliation_Page, THE Frontend SHALL use a CloudScape Table component to display field reconciliation options
3. WHEN rendering the reconciliation table, THE Frontend SHALL display one row per field with the field name in the first column
4. WHEN rendering field values in the table, THE Frontend SHALL display each source and destination value as a separate CloudScape Card component with the entireCardClickable property set to true
5. THE Frontend SHALL display the source field value card in the second column of each row
6. THE Frontend SHALL display the destination field value card in the third column of each row
7. WHEN rendering field value cards, THE Frontend SHALL mark all destination field cards as selected by default
8. WHEN rendering field value cards, THE Frontend SHALL ensure exactly one card is selected per row at all times
9. WHEN a user clicks a source field card, THE Frontend SHALL mark it as selected and automatically deselect the corresponding destination field card
10. WHEN a user clicks a destination field card, THE Frontend SHALL mark it as selected and automatically deselect the corresponding source field card
11. WHEN a user clicks an already-selected card, THE Frontend SHALL automatically select the complementary card in the same row
12. THE Frontend SHALL apply visual styling to selected cards to clearly indicate which value will be used (e.g., highlighted border, background color, or checkmark icon)
13. THE Frontend SHALL NOT provide any facility to manually edit field values during the reconciliation process
14. WHEN a user has reviewed field selections, THE Frontend SHALL display a submit button
15. WHEN a user clicks submit, THE Frontend SHALL present a final confirmation dialog before making the API call
16. WHEN the merge succeeds, THE Frontend SHALL display a success message
17. WHEN the merge fails, THE Frontend SHALL display clear error messages from the API response

### Requirement 3: Simple Entity Merge without Reconciliation

**User Story:** As a user, I want to merge simple entity records without field reconciliation, so that I can quickly consolidate duplicate records that don't require field-level review.

#### Acceptance Criteria

1. WHEN a user initiates a merge for a Simple_Entity, THE Frontend SHALL proceed directly to confirmation without displaying a Reconciliation_Page
2. WHEN a user confirms a Simple_Entity merge, THE Frontend SHALL make the API call immediately
3. WHEN the merge succeeds, THE Frontend SHALL display a success message
4. WHEN the merge fails, THE Frontend SHALL display clear error messages from the API response

### Requirement 4: Backend Merge API Endpoint

**User Story:** As a developer, I want a REST API endpoint for merging records, so that the frontend can trigger merge operations.

#### Acceptance Criteria

1. THE Backend SHALL provide a POST endpoint at `/api/{entityType}/{destinationId}/merge` that accepts a source record ID
2. WHEN the endpoint receives a merge request, THE Backend SHALL validate that both source and destination records exist
3. WHEN the endpoint receives a merge request with reconciled fields for Complex_Entity, THE Backend SHALL update the Destination_Record with the provided field values
4. WHEN validation fails, THE Backend SHALL return a 400 status code with a descriptive error message
5. WHEN the merge operation fails, THE Backend SHALL return a 500 status code with a descriptive error message
6. WHEN the merge succeeds, THE Backend SHALL return a 200 status code with the updated destination record

### Requirement 5: Related Entity Migration

**User Story:** As a system administrator, I want all related entities moved from source to destination during merge, so that no data is lost and all relationships are preserved.

#### Acceptance Criteria

1. WHEN merging any entity, THE Backend SHALL identify all Related_Entity records referencing the Source_Record
2. WHEN merging any entity, THE Backend SHALL update all Related_Entity foreign key references to point to the Destination_Record
3. WHEN merging Participant records, THE Backend SHALL move all Address_History_Entry records from source to destination
4. WHEN merging Activity records, THE Backend SHALL move all Assignment records from source to destination
5. WHEN merging GeographicArea records, THE Backend SHALL update all child GeographicArea records to reference the Destination_Record as parent
6. WHEN merging Venue records, THE Backend SHALL move all ActivityVenueHistory and ParticipantAddressHistory records from source to destination
7. WHEN merging ActivityType records, THE Backend SHALL update all Activity records referencing the source ActivityType to reference the destination ActivityType
8. WHEN merging Population records, THE Backend SHALL move all ParticipantPopulation records from source to destination

### Requirement 6: Duplicate Detection and Removal

**User Story:** As a system administrator, I want duplicate related entities removed during merge, so that the destination record doesn't contain redundant data.

#### Acceptance Criteria

1. WHEN merging Participant records, THE Backend SHALL identify duplicate Address_History_Entry records with the same venueId and effectiveFrom date
2. WHEN duplicate Address_History_Entry records are found, THE Backend SHALL keep only one entry and remove duplicates
3. WHEN merging Activity records, THE Backend SHALL identify duplicate Assignment records with the same participantId and roleId
4. WHEN duplicate Assignment records are found, THE Backend SHALL keep only one assignment and remove duplicates
5. WHEN merging GeographicArea records, THE Backend SHALL identify duplicate child GeographicArea records
6. WHEN duplicate child GeographicArea records are found, THE Backend SHALL keep only one reference and remove duplicates
7. WHEN merging Population records, THE Backend SHALL identify duplicate ParticipantPopulation records where a participant already belongs to the destination Population
8. WHEN duplicate ParticipantPopulation records are found, THE Backend SHALL keep only the destination Population membership and remove the source Population membership

### Requirement 7: Atomic Transaction Processing

**User Story:** As a system administrator, I want all merge operations performed atomically, so that partial failures don't leave the database in an inconsistent state.

#### Acceptance Criteria

1. THE Backend SHALL execute all merge operations within a single Merge_Transaction
2. WHEN any operation within the Merge_Transaction fails, THE Backend SHALL rollback all changes
3. THE Backend SHALL use Prisma raw query functionality to ensure transaction atomicity
4. WHEN the Merge_Transaction completes successfully, THE Backend SHALL commit all changes
5. WHEN the Merge_Transaction is rolled back, THE Backend SHALL return an error message indicating the failure reason

### Requirement 8: Source Record Deletion

**User Story:** As a system administrator, I want the source record deleted after successful merge, so that duplicate records are eliminated from the system.

#### Acceptance Criteria

1. WHEN all related entities have been migrated successfully, THE Backend SHALL delete the Source_Record
2. WHEN the Source_Record deletion fails, THE Backend SHALL rollback the entire Merge_Transaction
3. THE Backend SHALL delete the Source_Record only after all other merge operations complete successfully
4. WHEN the Source_Record is deleted, THE Backend SHALL ensure no orphaned related entities remain

### Requirement 9: Mobile-Responsive Reconciliation Layout

**User Story:** As a mobile user, I want the reconciliation page to display properly on small screens, so that I can review and merge records from any device.

#### Acceptance Criteria

1. WHEN the Reconciliation_Page is displayed on mobile devices, THE Frontend SHALL render the table in a responsive layout
2. THE Frontend SHALL use CloudScape Table component's responsive behavior to automatically adapt to small screens
3. WHEN displayed on mobile devices, THE Frontend SHALL ensure cards remain clearly visible and interactive with adequate touch targets
4. WHEN displayed on mobile devices, THE Frontend SHALL maintain the ability to select exactly one card per row

### Requirement 10: Entity Type Support

**User Story:** As a user, I want to merge records across all supported entity types, so that I can consolidate duplicates throughout the system.

#### Acceptance Criteria

1. THE System SHALL support merging for GeographicArea entities
2. THE System SHALL support merging for Venue entities
3. THE System SHALL support merging for Participant entities
4. THE System SHALL support merging for Activity entities
5. THE System SHALL support merging for ActivityType entities
6. THE System SHALL support merging for Population entities
7. WHEN merging GeographicArea, Venue, Participant, or Activity entities, THE System SHALL treat them as Complex_Entity types requiring reconciliation
8. WHEN merging ActivityType or Population entities, THE System SHALL treat them as Simple_Entity types without reconciliation
