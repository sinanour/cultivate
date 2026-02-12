# Implementation Plan: Merge Entity Selection Bugfix

## Overview

This implementation plan fixes a bug where selected entities disappear from dropdowns in the MergeInitiationModal component when they are not in the first page of results. The fix adds "ensure included" functionality to AsyncEntitySelect, following the pattern established by useGeographicAreaOptions.

## Tasks

- [x] 1. Add getById methods to frontend entity services
  - [x] 1.1 Add getParticipantById to ParticipantService
    - Create static method `getParticipantById(id: string): Promise<Participant>`
    - Call GET /api/v1/participants/:id endpoint
    - Return participant data
    - Handle errors appropriately
    - _Requirements: 3.1, 3.7_

  - [x] 1.2 Add getActivityById to ActivityService
    - Create static method `getActivityById(id: string): Promise<Activity>`
    - Call GET /api/v1/activities/:id endpoint
    - Return activity data with activityType populated
    - Handle errors appropriately
    - _Requirements: 3.2, 3.7_

  - [x] 1.3 Add getVenueById to VenueService
    - Create static method `getVenueById(id: string): Promise<Venue>`
    - Call GET /api/v1/venues/:id endpoint
    - Return venue data
    - Handle errors appropriately
    - _Requirements: 3.3, 3.7_

  - [x] 1.4 Add getActivityTypeById to ActivityTypeService
    - Create static method `getActivityTypeById(id: string): Promise<ActivityType>`
    - Call GET /api/v1/activity-types/:id endpoint
    - Return activity type data with activityCategory populated
    - Handle errors appropriately
    - _Requirements: 3.5, 3.7_

  - [x] 1.5 Add getPopulationById to PopulationService
    - Create static method `getPopulationById(id: string): Promise<Population>`
    - Call GET /api/v1/populations/:id endpoint
    - Return population data
    - Handle errors appropriately
    - _Requirements: 3.6, 3.7_

  - [ ]* 1.6 Write unit tests for service getById methods
    - Test successful fetch returns entity
    - Test invalid ID throws error
    - Test network errors are handled
    - _Requirements: 3.7, 3.8_

- [x] 2. Update AsyncEntitySelect component with ensure included support
  - [x] 2.1 Add new props to AsyncEntitySelect interface
    - Add optional `ensureIncluded?: string | null` prop
    - Add optional `fetchByIdFunction?: (id: string) => Promise<any>` prop
    - Update TypeScript interface definition
    - _Requirements: 1.1, 4.1, 4.2_

  - [x] 2.2 Implement ensured entity fetching logic
    - Add state to track ensured entity: `const [ensuredEntity, setEnsuredEntity] = useState<any | null>(null)`
    - Add state to track fetch status: `const [hasEnsuredFetch, setHasEnsuredFetch] = useState(false)`
    - Create useEffect to fetch ensured entity on mount
    - Check if `ensureIncluded` and `fetchByIdFunction` are provided
    - Fetch entity by ID using `fetchByIdFunction`
    - Store fetched entity in state
    - Mark fetch as complete (even on error)
    - Log errors to console if fetch fails
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x] 2.3 Merge ensured entity with search results
    - Update options useMemo to include ensured entity
    - Check if ensured entity is already in search results
    - If not present, format ensured entity using `formatOption`
    - Add formatted entity to beginning of options list
    - Ensure ensured entity remains in options even when search query changes
    - _Requirements: 1.4, 1.8_

  - [x] 2.4 Implement React Query caching for fetch-by-ID
    - Use useQuery hook for fetching ensured entity
    - Set appropriate cache key: `[entityType, 'byId', ensureIncluded]`
    - Set staleTime to prevent unnecessary refetches
    - Handle loading and error states
    - _Requirements: 1.6, 4.5_

  - [x] 2.5 Ensure backward compatibility
    - Test component works without `ensureIncluded` prop
    - Test component works without `fetchByIdFunction` prop
    - Verify existing usages are not affected
    - Ensure no breaking changes to public API
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 2.6 Write unit tests for AsyncEntitySelect ensure included
    - Test ensured entity is fetched when not in initial results
    - Test ensured entity is not fetched when already in results
    - Test ensured entity is added to options list
    - Test ensured entity remains visible during search
    - Test component works without ensureIncluded (backward compatibility)
    - Test error handling when fetch-by-ID fails
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 3. Update MergeInitiationModal to use ensure included
  - [x] 3.1 Update getEntityConfig to include fetchByIdFunction
    - Add `fetchByIdFunction` property to return object for each entity type
    - Map participant to `ParticipantService.getParticipantById`
    - Map activity to `ActivityService.getActivityById`
    - Map venue to `VenueService.getVenueById`
    - Map geographicArea to `GeographicAreaService.getGeographicAreaById`
    - Map activityType to `ActivityTypeService.getActivityTypeById`
    - Map population to `PopulationService.getPopulationById`
    - _Requirements: 4.3, 4.4_

  - [x] 3.2 Pass ensureIncluded to source AsyncEntitySelect
    - Extract `fetchByIdFunction` from getEntityConfig
    - Pass `ensureIncluded={sourceId}` prop to source AsyncEntitySelect
    - Pass `fetchByIdFunction={fetchByIdFunction}` prop to source AsyncEntitySelect
    - _Requirements: 2.1, 2.3_

  - [x] 3.3 Pass ensureIncluded to destination AsyncEntitySelect
    - Extract `fetchByIdFunction` from getEntityConfig
    - Pass `ensureIncluded={destinationId}` prop to destination AsyncEntitySelect
    - Pass `fetchByIdFunction={fetchByIdFunction}` prop to destination AsyncEntitySelect
    - _Requirements: 2.2, 2.4_

  - [x] 3.4 Verify swap functionality with ensured entities
    - Test that swapping updates ensureIncluded props correctly
    - Verify both entities remain visible after swap
    - Ensure AsyncEntitySelect refetches newly ensured entities if needed
    - _Requirements: 2.5, 2.6_

  - [ ]* 3.5 Write integration tests for MergeInitiationModal
    - Test source entity remains visible after selection
    - Test destination entity remains visible after selection
    - Test swap functionality with entities not in first page
    - Test both entities remain visible after swap
    - Test merge flow completes successfully with ensured entities
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4. Checkpoint - Verify bugfix works correctly
  - Test MergeInitiationModal with entities not in first page of results
  - Test swap functionality with ensured entities
  - Verify no regressions in existing AsyncEntitySelect usages
  - Ensure all tests pass
  - Ask the user if questions arise

- [x] 5. Final validation
  - [x] 5.1 Test all entity types in MergeInitiationModal
    - Test participant merge with ensured entities
    - Test activity merge with ensured entities
    - Test venue merge with ensured entities
    - Test geographic area merge with ensured entities
    - Test activity type merge with ensured entities
    - Test population merge with ensured entities
    - _Requirements: All requirements_

  - [x] 5.2 Verify backward compatibility
    - Check all existing AsyncEntitySelect usages still work
    - Verify no breaking changes introduced
    - Test components that don't use ensureIncluded
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.3 Write property tests for ensure included pattern
    - **Property 1: Ensured Entity Visibility**
    - Generate random entity selections
    - Test ensured entities remain visible across search queries
    - Configure 100 iterations
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 5.4 Write property tests for swap with ensured entities
    - **Property 2: Swap Preserves Entity Visibility**
    - Generate random entity pairs
    - Test swap updates ensureIncluded correctly
    - Test both entities remain visible after swap
    - Configure 100 iterations
    - _Requirements: 2.5, 2.6_

## Notes

- Tasks marked with `*` are optional test-related sub-tasks
- All backend endpoints already exist, only frontend service methods need to be added
- The implementation follows the proven pattern from useGeographicAreaOptions
- All changes are backward compatible with existing code
- The fix ensures a better user experience when merging entities
