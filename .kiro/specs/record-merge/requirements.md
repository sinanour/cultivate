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
- **AsyncEntitySelect**: A reusable dropdown component for selecting entities with lazy loading and search
- **Ensure_Included**: A pattern where a specific entity ID is fetched and added to dropdown options if not present in initial results
- **Global_Geographic_Filter**: The application-wide filter that restricts data visibility to a specific geographic area and its descendants
- **Geographic_Authorization**: The backend authorization mechanism that ensures users can only access entities within their authorized geographic areas

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

### Requirement 11: Entity Selection Persistence

**User Story:** As a user initiating a merge, I want the currently selected entity to remain visible in the dropdown even if it's not in the first page of results, so that I can see what I've selected and swap source/destination without losing my selection.

#### Acceptance Criteria

1. THE AsyncEntitySelect component SHALL accept an optional `ensureIncluded` prop containing an entity ID
2. WHEN the `ensureIncluded` prop is provided, THE AsyncEntitySelect component SHALL fetch that specific entity by ID if it's not in the initial results
3. WHEN fetching the ensured entity, THE AsyncEntitySelect component SHALL use the appropriate service method to fetch by ID
4. WHEN the ensured entity is fetched successfully, THE AsyncEntitySelect component SHALL add it to the options list
5. WHEN the ensured entity fetch fails, THE AsyncEntitySelect component SHALL log the error and continue without adding it
6. THE AsyncEntitySelect component SHALL fetch the ensured entity only once during the initial load
7. THE AsyncEntitySelect component SHALL NOT refetch the ensured entity when the search query changes
8. WHEN the ensured entity is already present in the initial results, THE AsyncEntitySelect component SHALL NOT fetch it again
9. THE MergeInitiationModal component SHALL pass the `sourceId` as the `ensureIncluded` prop to the source AsyncEntitySelect
10. THE MergeInitiationModal component SHALL pass the `destinationId` as the `ensureIncluded` prop to the destination AsyncEntitySelect
11. WHEN the source entity is selected, THE source AsyncEntitySelect SHALL ensure that entity remains in the options list
12. WHEN the destination entity is selected, THE destination AsyncEntitySelect SHALL ensure that entity remains in the options list
13. WHEN the user clicks the "Swap" button, THE MergeInitiationModal SHALL update both `ensureIncluded` props to reflect the swapped IDs
14. WHEN the swap occurs, THE AsyncEntitySelect components SHALL fetch and display the newly ensured entities if not already present

### Requirement 12: Entity Service Fetch by ID Support

**User Story:** As a developer, I want all entity services to provide a consistent fetch-by-ID method, so that AsyncEntitySelect can fetch ensured entities for any entity type.

#### Acceptance Criteria

1. THE ParticipantService SHALL provide a `getParticipantById(id)` method
2. THE ActivityService SHALL provide an `getActivityById(id)` method
3. THE VenueService SHALL provide a `getVenueById(id)` method
4. THE GeographicAreaService SHALL already provide a `getGeographicAreaById(id)` method (existing)
5. THE ActivityTypeService SHALL provide a `getActivityTypeById(id)` method
6. THE PopulationService SHALL provide a `getPopulationById(id)` method
7. WHEN any fetch-by-ID method is called with a valid ID, THE service SHALL return the entity with all necessary fields for display
8. WHEN any fetch-by-ID method is called with an invalid ID, THE service SHALL throw an appropriate error
9. THE AsyncEntitySelect component SHALL accept an optional `fetchByIdFunction` prop
10. WHEN the `fetchByIdFunction` prop is provided, THE AsyncEntitySelect component SHALL use it to fetch the ensured entity
11. WHEN the `fetchByIdFunction` prop is not provided, THE AsyncEntitySelect component SHALL attempt to derive the fetch-by-ID method from the entity type
12. THE AsyncEntitySelect component SHALL support fetch-by-ID for all entity types: participant, activity, venue, geographic-area, activity-type, population
13. WHEN fetching by ID, THE AsyncEntitySelect component SHALL format the fetched entity using the provided `formatOption` function
14. WHEN fetching by ID, THE AsyncEntitySelect component SHALL add the formatted entity to the options list if not already present

### Requirement 13: Geographic Filter Enforcement in Reconciliation

**User Story:** As a user with an active geographic area filter, I want the reconciliation page to only show entities within my filtered area, so that I cannot accidentally merge entities outside my authorized scope.

#### Acceptance Criteria

1. WHEN a user navigates to the reconciliation page with an active Global_Geographic_Filter, THE ReconciliationPage SHALL fetch source and destination entities using the filtered geographic area ID
2. WHEN fetching entities for reconciliation, THE ReconciliationPage SHALL pass the `geographicAreaId` parameter to the entity fetch functions
3. WHEN the Global_Geographic_Filter changes while on the reconciliation page, THE ReconciliationPage SHALL re-fetch entities with the updated filter
4. WHEN an entity fetch fails due to geographic authorization, THE ReconciliationPage SHALL display a clear error message indicating the entity is not accessible within the current filter
5. WHEN both source and destination entities are successfully fetched within the filtered area, THE ReconciliationPage SHALL display the reconciliation interface normally
6. WHEN the MergeInitiationModal is displayed with an active Global_Geographic_Filter, THE AsyncEntitySelect components SHALL automatically filter entities by the selected geographic area
7. WHEN a user selects source and destination entities, BOTH entities SHALL be within the filtered geographic area
8. WHEN the user proceeds to reconciliation, THE selected entities SHALL be accessible within the current filter

### Requirement 14: Geographic Authorization in Merge API

**User Story:** As a system administrator, I want the merge API to enforce geographic authorization, so that users cannot merge entities outside their authorized areas even if they bypass the UI.

#### Acceptance Criteria

1. WHEN a merge API request is received, THE Backend SHALL verify that both source and destination entities are within the user's authorized geographic areas
2. WHEN either the source or destination entity is outside the user's authorized areas, THE Backend SHALL return a 403 Forbidden error with a descriptive message
3. WHEN both entities are within authorized areas, THE Backend SHALL proceed with the merge operation normally
4. THE Backend SHALL use the existing geographic authorization middleware to enforce these checks
5. THE Backend SHALL log any geographic authorization failures for audit purposes

### Requirement 15: Geographic Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when I cannot merge entities due to geographic restrictions, so that I understand why the operation failed.

#### Acceptance Criteria

1. WHEN the reconciliation page cannot fetch an entity due to geographic authorization, THE Frontend SHALL display an Alert component with type "error"
2. THE error message SHALL clearly state which entity (source or destination) is not accessible
3. THE error message SHALL indicate that the entity is outside the current geographic filter
4. THE Frontend SHALL provide a "Go Back" button to return to the previous page
5. WHEN a merge API call fails due to geographic authorization, THE Frontend SHALL display the error message from the API response

### Requirement 16: Backward Compatibility

**User Story:** As a developer, I want the bugfixes to maintain backward compatibility, so that the merge feature works correctly both with and without active filters or in existing usage scenarios.

#### Acceptance Criteria

1. THE AsyncEntitySelect component SHALL continue to work without the `ensureIncluded` prop (optional)
2. THE AsyncEntitySelect component SHALL continue to work without the `fetchByIdFunction` prop (optional)
3. WHEN neither `ensureIncluded` nor `fetchByIdFunction` are provided, THE AsyncEntitySelect component SHALL behave exactly as before
4. THE AsyncEntitySelect component SHALL NOT break any existing usages in the codebase
5. THE AsyncEntitySelect component SHALL maintain the same public API surface (no breaking changes)
6. WHEN no Global_Geographic_Filter is active, THE ReconciliationPage SHALL fetch entities without geographic restrictions
7. WHEN no Global_Geographic_Filter is active, THE merge API SHALL not apply geographic authorization beyond the user's base permissions
8. THE bugfixes SHALL NOT break existing merge functionality for users without geographic filters
9. THE bugfixes SHALL NOT require changes to the database schema or API contracts
