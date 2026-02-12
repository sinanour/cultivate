# Requirements Document: Merge Geographic Filter Bugfix

## Introduction

This document specifies the requirements for fixing a bug in the record merge feature where the reconciliation page does not properly respect the global geographic area filter. When a user has an active geographic area filter, the reconciliation page should only fetch and display entities within that filtered area, and the merge operation should enforce geographic authorization.

## Glossary

- **Global_Geographic_Filter**: The application-wide filter that restricts data visibility to a specific geographic area and its descendants
- **Reconciliation_Page**: The UI page that displays source and destination entity fields for user review during a merge operation
- **Geographic_Authorization**: The backend authorization mechanism that ensures users can only access entities within their authorized geographic areas
- **Merge_Operation**: The process of consolidating two entity records, including field reconciliation and related entity migration

## Requirements

### Requirement 1: Reconciliation Page Geographic Filter Enforcement

**User Story:** As a user with an active geographic area filter, I want the reconciliation page to only show entities within my filtered area, so that I cannot accidentally merge entities outside my authorized scope.

#### Acceptance Criteria

1. WHEN a user navigates to the reconciliation page with an active Global_Geographic_Filter, THE ReconciliationPage SHALL fetch source and destination entities using the filtered geographic area ID
2. WHEN fetching entities for reconciliation, THE ReconciliationPage SHALL pass the `geographicAreaId` parameter to the entity fetch functions
3. WHEN the Global_Geographic_Filter changes while on the reconciliation page, THE ReconciliationPage SHALL re-fetch entities with the updated filter
4. WHEN an entity fetch fails due to geographic authorization, THE ReconciliationPage SHALL display a clear error message indicating the entity is not accessible within the current filter
5. WHEN both source and destination entities are successfully fetched within the filtered area, THE ReconciliationPage SHALL display the reconciliation interface normally

### Requirement 2: Merge API Geographic Authorization

**User Story:** As a system administrator, I want the merge API to enforce geographic authorization, so that users cannot merge entities outside their authorized areas even if they bypass the UI.

#### Acceptance Criteria

1. WHEN a merge API request is received, THE Backend SHALL verify that both source and destination entities are within the user's authorized geographic areas
2. WHEN either the source or destination entity is outside the user's authorized areas, THE Backend SHALL return a 403 Forbidden error with a descriptive message
3. WHEN both entities are within authorized areas, THE Backend SHALL proceed with the merge operation normally
4. THE Backend SHALL use the existing geographic authorization middleware to enforce these checks
5. THE Backend SHALL log any geographic authorization failures for audit purposes

### Requirement 3: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when I cannot merge entities due to geographic restrictions, so that I understand why the operation failed.

#### Acceptance Criteria

1. WHEN the reconciliation page cannot fetch an entity due to geographic authorization, THE Frontend SHALL display an Alert component with type "error"
2. THE error message SHALL clearly state which entity (source or destination) is not accessible
3. THE error message SHALL indicate that the entity is outside the current geographic filter
4. THE Frontend SHALL provide a "Go Back" button to return to the previous page
5. WHEN a merge API call fails due to geographic authorization, THE Frontend SHALL display the error message from the API response

### Requirement 4: Merge Initiation Modal Filter Verification

**User Story:** As a user, I want the merge initiation modal to only show entities within my filtered area, so that I cannot select entities outside my authorized scope.

#### Acceptance Criteria

1. WHEN the MergeInitiationModal is displayed with an active Global_Geographic_Filter, THE AsyncEntitySelect components SHALL automatically filter entities by the selected geographic area
2. THE MergeInitiationModal SHALL NOT need to explicitly pass the geographic filter, as AsyncEntitySelect already handles this
3. WHEN a user selects source and destination entities, BOTH entities SHALL be within the filtered geographic area
4. WHEN the user proceeds to reconciliation, THE selected entities SHALL be accessible within the current filter

### Requirement 5: Backward Compatibility

**User Story:** As a developer, I want the fix to maintain backward compatibility, so that the merge feature works correctly both with and without an active geographic filter.

#### Acceptance Criteria

1. WHEN no Global_Geographic_Filter is active, THE ReconciliationPage SHALL fetch entities without geographic restrictions
2. WHEN no Global_Geographic_Filter is active, THE merge API SHALL not apply geographic authorization beyond the user's base permissions
3. THE fix SHALL NOT break existing merge functionality for users without geographic filters
4. THE fix SHALL NOT require changes to the database schema or API contracts
