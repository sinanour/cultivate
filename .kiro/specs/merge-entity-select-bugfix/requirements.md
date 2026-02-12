# Requirements Document: Merge Entity Selection Bugfix

## Introduction

This document specifies the requirements for fixing a bug in the MergeInitiationModal component where selected entities disappear from the dropdown if they are not in the first page of results. This occurs because the AsyncEntitySelect component lacks the "ensure included" functionality that exists in the GeographicAreaSelector component.

## Glossary

- **MergeInitiationModal**: The dialog component used to select source and destination records for merging
- **AsyncEntitySelect**: A reusable dropdown component for selecting entities with lazy loading and search
- **GeographicAreaSelector**: A specialized dropdown component for selecting geographic areas with hierarchy display
- **useGeographicAreaOptions**: A custom hook that manages geographic area options with lazy loading and ensures specific entities are included
- **Ensure_Included**: A pattern where a specific entity ID is fetched and added to the dropdown options if not present in the initial results
- **Source_Record**: The record being merged from (will be deleted after merge)
- **Destination_Record**: The record being merged into (will be updated and retained)
- **Entity_Type**: One of: participant, activity, venue, geographicArea, activityType, population

## Requirements

### Requirement 1: AsyncEntitySelect Ensure Included Support

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

### Requirement 2: MergeInitiationModal Integration

**User Story:** As a user initiating a merge, I want both the source and destination entities to remain visible in their respective dropdowns after selection, so that I can review my selections and use the swap functionality without entities disappearing.

#### Acceptance Criteria

1. THE MergeInitiationModal component SHALL pass the `sourceId` as the `ensureIncluded` prop to the source AsyncEntitySelect
2. THE MergeInitiationModal component SHALL pass the `destinationId` as the `ensureIncluded` prop to the destination AsyncEntitySelect
3. WHEN the source entity is selected, THE source AsyncEntitySelect SHALL ensure that entity remains in the options list
4. WHEN the destination entity is selected, THE destination AsyncEntitySelect SHALL ensure that entity remains in the options list
5. WHEN the user clicks the "Swap" button, THE MergeInitiationModal SHALL update both `ensureIncluded` props to reflect the swapped IDs
6. WHEN the swap occurs, THE AsyncEntitySelect components SHALL fetch and display the newly ensured entities if not already present

### Requirement 3: Entity Service Fetch by ID Support

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

### Requirement 4: AsyncEntitySelect Fetch by ID Configuration

**User Story:** As a developer, I want AsyncEntitySelect to know how to fetch entities by ID for each entity type, so that the ensure included functionality works correctly.

#### Acceptance Criteria

1. THE AsyncEntitySelect component SHALL accept an optional `fetchByIdFunction` prop
2. WHEN the `fetchByIdFunction` prop is provided, THE AsyncEntitySelect component SHALL use it to fetch the ensured entity
3. WHEN the `fetchByIdFunction` prop is not provided, THE AsyncEntitySelect component SHALL attempt to derive the fetch-by-ID method from the entity type
4. THE AsyncEntitySelect component SHALL support fetch-by-ID for all entity types: participant, activity, venue, geographic-area, activity-type, population
5. WHEN fetching by ID, THE AsyncEntitySelect component SHALL format the fetched entity using the provided `formatOption` function
6. WHEN fetching by ID, THE AsyncEntitySelect component SHALL add the formatted entity to the options list if not already present

### Requirement 5: Backward Compatibility

**User Story:** As a developer, I want the AsyncEntitySelect changes to be backward compatible, so that existing usages continue to work without modification.

#### Acceptance Criteria

1. THE AsyncEntitySelect component SHALL continue to work without the `ensureIncluded` prop (optional)
2. THE AsyncEntitySelect component SHALL continue to work without the `fetchByIdFunction` prop (optional)
3. WHEN neither `ensureIncluded` nor `fetchByIdFunction` are provided, THE AsyncEntitySelect component SHALL behave exactly as before
4. THE AsyncEntitySelect component SHALL NOT break any existing usages in the codebase
5. THE AsyncEntitySelect component SHALL maintain the same public API surface (no breaking changes)

## Success Criteria

1. Users can select source and destination entities in MergeInitiationModal without them disappearing
2. The swap functionality works correctly with ensured entities
3. All entity types support the ensure included pattern
4. No existing AsyncEntitySelect usages are broken
5. The implementation follows the same pattern as useGeographicAreaOptions for consistency
