# Requirements Document

## Introduction

This document specifies the requirements for a **bulk editing** feature that lets users
review and edit many records of the same entity type at once in a spreadsheet-like table.
The feature targets the three high-volume complex entities in the system — **Venue**,
**Participant**, and **Activity** — where users routinely need to correct, enrich, or
clean up large numbers of records and doing so one detail page at a time is prohibitively slow.

Because these datasets are large, the bulk editing views are **paginated**: the user works
through the data a page at a time rather than loading every record into the browser.

The defining characteristic of the feature is a **two-step (staged) persistence model**.
All edits, additions, and deletions a user makes in a bulk editing session are held as a
local **staged change set** and are *not* written to the database until the user explicitly
clicks **Apply Changes**. At any point before that, the user can **Discard Changes** to
abandon the entire staged change set and return to the last persisted state. This gives the
user a safe, reviewable "shopping cart" of edits that is committed atomically.

This feature builds on the existing list/detail CRUD, pagination, geographic authorization,
and optimistic-concurrency (`version`) infrastructure already present in the backend and
frontend. It does not replace the existing single-record create/edit/delete flows; it adds a
parallel bulk workflow.

## Glossary

- **System**: The complete application including backend API and web frontend.
- **Backend**: The Express/Prisma-based REST API service (`backend-api`).
- **Frontend**: The React/CloudScape web application (`web-frontend`).
- **Bulk_Entity**: An entity type that supports bulk editing. In scope: Venue, Participant, Activity.
- **Bulk_Editing_View**: A paginated, spreadsheet-like CloudScape Table in which multiple records and fields are editable inline.
- **Editable_Field**: A field of a Bulk_Entity that the user is permitted to edit inline in the Bulk_Editing_View.
- **Staged_Change_Set**: The in-memory collection of all pending creates, updates, and deletes made during a bulk editing session, not yet persisted.
- **Staged_Create**: A new record added during the session that does not yet exist in the database.
- **Staged_Update**: A modification to one or more Editable_Fields of an existing record, not yet persisted.
- **Staged_Delete**: An existing record marked for deletion during the session, not yet persisted.
- **Dirty_Record**: A record in the Bulk_Editing_View that has at least one staged change (create, update, or delete).
- **Apply_Changes**: The explicit user action that persists the entire Staged_Change_Set to the database.
- **Discard_Changes**: The explicit user action that abandons the entire Staged_Change_Set.
- **Bulk_Mutation_Request**: A single API request carrying the whole Staged_Change_Set for one entity type.
- **Bulk_Mutation_Transaction**: The single database transaction in which the Backend applies a Bulk_Mutation_Request.
- **Partial_Failure**: A condition where some staged changes in a Bulk_Mutation_Request would succeed and others would fail (e.g., a validation error or a version conflict on one row).
- **Version_Conflict**: A condition where a staged change targets a record whose `version` has changed in the database since it was loaded into the Bulk_Editing_View.
- **Global_Geographic_Filter**: The application-wide filter that restricts data visibility to a specific geographic area and its descendants.
- **Geographic_Authorization**: The backend authorization mechanism that ensures users can only access and modify entities within their authorized geographic areas.
- **Editor_User**: A user whose role permits modifying entities (EDITOR or ADMINISTRATOR), i.e., the roles currently allowed to create/update/delete these entities.

## Requirements

### Requirement 1: Bulk Editing View Entry Point

**User Story:** As an Editor_User, I want to open a bulk editing view for Venues, Participants, or Activities, so that I can edit many records in one place.

#### Acceptance Criteria

1. WHEN an Editor_User views the Venues, Participants, or Activities list page, THE Frontend SHALL display a "Bulk Edit" action that opens the Bulk_Editing_View for that entity type.
2. WHEN a user whose role is READ_ONLY or PII_RESTRICTED views a list page, THE Frontend SHALL NOT present an enabled "Bulk Edit" action.
3. WHEN the Bulk_Editing_View opens, THE Frontend SHALL load the first page of records for that entity type using the existing paginated list API.
4. WHEN the Bulk_Editing_View opens, THE Frontend SHALL inherit any active Global_Geographic_Filter so that only records within the filtered area are shown.
5. THE Frontend SHALL support bulk editing for exactly these Bulk_Entity types: Venue, Participant, and Activity.

### Requirement 2: Spreadsheet-like Inline Editing

**User Story:** As an Editor_User, I want to edit multiple fields across multiple records directly in a table, so that I do not have to open each record individually.

#### Acceptance Criteria

1. WHEN the Bulk_Editing_View is displayed, THE Frontend SHALL render records as rows and Editable_Fields as columns in a CloudScape Table with inline editing enabled.
2. WHEN a user activates a cell for an Editable_Field, THE Frontend SHALL present an input control appropriate to that field's type (text, number, date, enumerated select, or entity reference select).
3. WHEN a user changes a cell value, THE Frontend SHALL record the change in the Staged_Change_Set as part of a Staged_Update (or Staged_Create for a new row) and SHALL NOT call the persistence API at that time.
4. THE Frontend SHALL only allow editing of Editable_Fields and SHALL NOT allow editing of system-managed fields (`id`, `version`, `createdAt`, `updatedAt`).
5. WHEN a cell value violates a field-level validation rule, THE Frontend SHALL display an inline validation error on that cell and SHALL retain the invalid value so the user can correct it.
6. WHEN at least one cell has a validation error, THE Frontend SHALL disable the Apply_Changes action until all errors are resolved.
7. THE set of Editable_Fields per entity SHALL be:
   - **Venue**: name, address, geographicAreaId, latitude, longitude, venueType.
   - **Participant**: name, email, phone, nickname, dateOfBirth, dateOfRegistration, notes.
   - **Activity**: name, activityTypeId, startDate, endDate, status, additionalParticipantCount, notes.

### Requirement 3: Visual Indication of Staged Changes

**User Story:** As an Editor_User, I want to clearly see which records and cells I have changed, added, or deleted, so that I can review my pending work before applying it.

#### Acceptance Criteria

1. WHEN a cell holds a Staged_Update value that differs from the persisted value, THE Frontend SHALL visually mark that cell as changed (e.g., highlighted background or edited indicator).
2. WHEN a record is a Staged_Create, THE Frontend SHALL visually mark the entire row as newly added.
3. WHEN a record is a Staged_Delete, THE Frontend SHALL visually mark the entire row as pending deletion (e.g., struck-through or dimmed) while keeping it visible until changes are applied or discarded.
4. THE Frontend SHALL display a running summary of the Staged_Change_Set showing the count of pending creates, updates, and deletes.
5. WHEN the Staged_Change_Set is empty, THE Frontend SHALL disable both the Apply_Changes and Discard_Changes actions.

### Requirement 4: Pagination with Preserved Staged Changes

**User Story:** As an Editor_User working through a large dataset, I want to navigate between pages without losing my pending edits, so that I can stage changes across many pages before applying.

#### Acceptance Criteria

1. THE Bulk_Editing_View SHALL display records using server-side pagination with a user-selectable page size.
2. WHEN a user navigates to a different page, THE Frontend SHALL preserve the entire Staged_Change_Set for records on previously visited pages.
3. WHEN a user returns to a previously edited page, THE Frontend SHALL re-apply the staged values to the corresponding cells so edits remain visible.
4. WHEN a user navigates between pages, THE Frontend SHALL fetch only the requested page of records from the Backend and SHALL NOT require loading the entire dataset into memory.
5. WHEN the Staged_Change_Set is non-empty and the user attempts to navigate to a different page, THE Frontend SHALL retain the staged changes without prompting (navigation is non-destructive to staged changes).
6. THE Staged_Change_Set SHALL be keyed by stable record identity (record `id` for existing records, a client-generated temporary key for Staged_Creates) so that pagination does not corrupt or duplicate staged entries.

### Requirement 5: Adding Records

**User Story:** As an Editor_User, I want to add new records within the bulk editing view, so that I can create records as part of the same staged change set.

#### Acceptance Criteria

1. WHEN an Editor_User invokes an "Add Row" action, THE Frontend SHALL insert a new editable row representing a Staged_Create with a client-generated temporary key.
2. WHEN a Staged_Create row is added, THE Frontend SHALL NOT call the persistence API until Apply_Changes is invoked.
3. WHEN a Staged_Create row is present, THE Frontend SHALL validate it against the same field-level and required-field rules as the single-record create flow before allowing Apply_Changes.
4. WHEN a user discards a Staged_Create row individually (e.g., via a row "remove" control), THE Frontend SHALL remove it from the Staged_Change_Set without any API call.
5. THE Frontend SHALL allow multiple Staged_Create rows to exist simultaneously within one session.

### Requirement 6: Deleting Records

**User Story:** As an Editor_User, I want to mark records for deletion within the bulk editing view, so that deletions are staged and applied together with my other changes.

#### Acceptance Criteria

1. WHEN an Editor_User marks an existing record for deletion, THE Frontend SHALL record a Staged_Delete in the Staged_Change_Set and SHALL NOT call the persistence API at that time.
2. WHEN a record is marked as a Staged_Delete, THE Frontend SHALL disable inline editing of that record's cells.
3. WHEN a user un-marks a Staged_Delete before applying, THE Frontend SHALL remove the Staged_Delete from the Staged_Change_Set and restore the record to its prior (possibly updated) state.
4. WHEN a user marks a Staged_Create row for removal, THE Frontend SHALL remove it entirely rather than creating a Staged_Delete (there is nothing persisted to delete).
5. WHEN an existing record has both a Staged_Update and is then marked as a Staged_Delete, THE Frontend SHALL treat the record as a Staged_Delete and SHALL NOT send the superseded field updates on Apply_Changes.

### Requirement 7: Discard Changes

**User Story:** As an Editor_User, I want to discard all my staged changes at once, so that I can abandon a bulk editing session without affecting the database.

#### Acceptance Criteria

1. WHEN an Editor_User invokes Discard_Changes, THE Frontend SHALL present a confirmation prompt stating that all pending changes will be lost.
2. WHEN the user confirms Discard_Changes, THE Frontend SHALL clear the entire Staged_Change_Set and SHALL NOT call any persistence API.
3. WHEN Discard_Changes completes, THE Frontend SHALL display the records at their last persisted state with no visual change indicators.
4. WHEN the user cancels the Discard_Changes confirmation, THE Frontend SHALL retain the Staged_Change_Set unchanged.
5. WHEN the user navigates away from the Bulk_Editing_View with a non-empty Staged_Change_Set, THE Frontend SHALL warn the user that unsaved staged changes will be lost before leaving.

### Requirement 8: Apply Changes (Two-Step Persistence)

**User Story:** As an Editor_User, I want to apply all my staged changes with a single explicit action, so that nothing is persisted until I decide to commit.

#### Acceptance Criteria

1. THE Frontend SHALL NOT persist any create, update, or delete to the Backend until the user explicitly invokes Apply_Changes.
2. WHEN an Editor_User invokes Apply_Changes, THE Frontend SHALL present a confirmation summary showing the number of creates, updates, and deletes to be applied.
3. WHEN the user confirms Apply_Changes, THE Frontend SHALL send the entire Staged_Change_Set to the Backend as a single Bulk_Mutation_Request per entity type.
4. WHEN Apply_Changes succeeds, THE Frontend SHALL clear the Staged_Change_Set, reload the current page from the Backend, and display a success message summarizing what was applied.
5. WHEN Apply_Changes fails, THE Frontend SHALL retain the Staged_Change_Set so the user can correct and retry.
6. WHILE an Apply_Changes request is in flight, THE Frontend SHALL disable further edits and the Apply_Changes and Discard_Changes actions, and SHALL show a progress indicator.

### Requirement 9: Backend Bulk Mutation Endpoint

**User Story:** As a developer, I want a backend endpoint that applies a staged change set atomically, so that the frontend can commit bulk edits in one request.

#### Acceptance Criteria

1. THE Backend SHALL provide a `POST /api/{entityType}/bulk` endpoint for each Bulk_Entity (venues, participants, activities) that accepts a Bulk_Mutation_Request containing lists of creates, updates, and deletes.
2. THE Bulk_Mutation_Request SHALL identify each update and delete by record `id`, and each update SHALL carry the record's expected `version` for optimistic-concurrency checking.
3. WHEN the Backend receives a Bulk_Mutation_Request, THE Backend SHALL validate every create and update against the same field-level and reference-integrity rules used by the single-record endpoints before making any change.
4. WHEN all validations pass, THE Backend SHALL apply all creates, updates, and deletes within a single Bulk_Mutation_Transaction.
5. WHEN the Backend applies the Bulk_Mutation_Request, THE Backend SHALL return a response that reports, per submitted change, whether it succeeded and the resulting record (for creates and updates) or a per-change error.
6. WHEN the request body is malformed or exceeds the maximum allowed number of changes, THE Backend SHALL return a 400 status code with a descriptive error and SHALL NOT modify any record.
7. THE Backend SHALL enforce a configurable maximum number of changes per Bulk_Mutation_Request to bound transaction size.

### Requirement 10: Atomic Application and Failure Handling

**User Story:** As a system administrator, I want bulk changes applied atomically, so that a partial failure never leaves the database in an inconsistent state.

#### Acceptance Criteria

1. THE Backend SHALL apply all changes in a Bulk_Mutation_Request within a single Bulk_Mutation_Transaction.
2. WHEN any single change in the Bulk_Mutation_Request fails validation, authorization, or persistence, THE Backend SHALL roll back the entire Bulk_Mutation_Transaction so that no change is persisted.
3. WHEN a Partial_Failure causes rollback, THE Backend SHALL return a 409 or 422 status with per-change error details identifying which changes failed and why, and SHALL indicate that no changes were applied.
4. WHEN the Bulk_Mutation_Transaction completes successfully, THE Backend SHALL commit all changes together.
5. THE Backend SHALL use Prisma's transaction functionality to guarantee atomicity.

### Requirement 11: Optimistic Concurrency in Bulk Updates

**User Story:** As an Editor_User, I want to be told when a record I edited was changed by someone else, so that I do not silently overwrite another user's work.

#### Acceptance Criteria

1. WHEN a Staged_Update is applied, THE Backend SHALL verify that the stored `version` of the record matches the expected `version` supplied in the request.
2. WHEN the stored `version` does not match the expected `version`, THE Backend SHALL treat the change as a Version_Conflict, SHALL roll back the Bulk_Mutation_Transaction, and SHALL report the conflicting record(s) in the response.
3. WHEN the Frontend receives a Version_Conflict response, THE Frontend SHALL identify the affected row(s), SHALL retain the Staged_Change_Set, and SHALL offer the user the ability to refresh the conflicting record(s) and reconcile.
4. WHEN a record is successfully updated, THE Backend SHALL increment its `version` consistent with the single-record update behavior.

### Requirement 12: Geographic Authorization in Bulk Operations

**User Story:** As a system administrator, I want bulk operations to enforce geographic authorization, so that users cannot read or modify records outside their authorized areas even by bypassing the UI.

#### Acceptance Criteria

1. WHEN the Bulk_Editing_View loads records, THE Backend SHALL return only records the user is authorized to access under their Geographic_Authorization and any active Global_Geographic_Filter.
2. WHEN a Bulk_Mutation_Request includes a create or update that would place a record in a geographic area the user is not authorized for, THE Backend SHALL reject that change, roll back the transaction, and return a 403-class per-change error.
3. WHEN a Bulk_Mutation_Request includes a delete or update targeting a record outside the user's authorized areas, THE Backend SHALL reject that change, roll back the transaction, and return a 403-class per-change error.
4. THE Backend SHALL reuse the existing geographic authorization mechanism rather than introducing a parallel authorization path.
5. THE Backend SHALL log geographic authorization failures that occur during bulk operations for audit purposes.

### Requirement 13: Authorization and Role Enforcement

**User Story:** As a system administrator, I want bulk editing restricted to users permitted to modify data, so that read-only users cannot change records.

#### Acceptance Criteria

1. THE Backend SHALL require Editor_User privileges (EDITOR or ADMINISTRATOR) for the `POST /api/{entityType}/bulk` endpoint, consistent with the existing create/update/delete endpoints.
2. WHEN a user without Editor_User privileges calls a bulk endpoint, THE Backend SHALL return a 403 status and SHALL NOT modify any record.
3. THE Backend SHALL record audit log entries for bulk mutations consistent with how single-record mutations are audited.

### Requirement 14: Comprehensive Test Coverage

**User Story:** As a developer, I want comprehensive automated tests for the bulk editing feature, especially on the backend, so that the atomic, authorization, and concurrency guarantees are verified and protected against regression.

#### Acceptance Criteria

1. THE Backend SHALL include unit tests (mocked Prisma) for each bulk service covering: successful mixed create/update/delete, field-level validation failure, reference-integrity failure, version conflict, geographic authorization failure, max-change-count enforcement, and empty change set.
2. THE Backend SHALL include integration tests (real test database) for each bulk endpoint verifying that a successful request commits all changes and a failing request rolls back so that no change is persisted.
3. THE Backend tests SHALL assert that on any Partial_Failure the database is left exactly as it was before the request (no partial writes).
4. THE Backend tests SHALL follow the project's test isolation conventions (unique test data, deterministic predefined-data access, complete cleanup, Prisma disconnect).
5. THE Frontend SHALL include component/hook tests for the Staged_Change_Set state machine covering: staging updates, staging creates, staging deletes, un-staging, preserving staged changes across pagination, discard, apply success, and apply failure retention.
6. THE Frontend SHALL include a test asserting that no persistence API is called until Apply_Changes is invoked.

### Requirement 15: Backward Compatibility

**User Story:** As a developer, I want the bulk editing feature to leave existing flows intact, so that current single-record behavior and existing clients are unaffected.

#### Acceptance Criteria

1. THE bulk editing feature SHALL NOT change the existing single-record create, update, delete, or list endpoints' request or response contracts.
2. THE bulk editing feature SHALL NOT require changes to the Prisma schema or database migrations beyond what the existing entities already provide.
3. THE existing list and detail pages for Venue, Participant, and Activity SHALL continue to function unchanged.
4. THE bulk endpoints SHALL be additive and SHALL NOT alter the behavior of the merge or import endpoints.
