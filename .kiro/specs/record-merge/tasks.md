# Implementation Plan: Record Merge Feature

## Overview

This implementation plan breaks down the record merge feature into discrete coding tasks. The feature enables users to merge duplicate records across six entity types with field reconciliation for complex entities and atomic database operations.

Implementation follows this sequence:
1. Backend merge services and API endpoints
2. Frontend merge UI components
3. Integration and testing
4. Final validation

## Tasks

- [x] 1. Create backend merge service infrastructure
  - Create base merge service interface and types
  - Define merge request/response types
  - Set up error types for merge operations
  - _Requirements: 4.1, 4.4, 4.5, 4.6_

- [x] 2. Implement participant merge service
  - [x] 2.1 Create ParticipantMergeService class with merge method
    - Implement transaction wrapper using Prisma $transaction
    - Implement record validation (source and destination exist)
    - Implement field reconciliation update logic
    - _Requirements: 4.2, 4.3, 5.1, 5.2_
  
  - [x] 2.2 Implement participant address history migration
    - Write raw SQL to migrate address history records
    - Implement duplicate detection (same venueId and effectiveFrom)
    - Implement duplicate removal logic
    - _Requirements: 5.3, 6.1, 6.2_
  
  - [x] 2.3 Implement participant assignment migration
    - Write raw SQL to migrate assignment records
    - Implement duplicate detection (same activityId and roleId)
    - Implement duplicate removal logic
    - _Requirements: 5.3, 6.3, 6.4_
  
  - [x] 2.4 Implement participant population migration
    - Write raw SQL to migrate population membership records
    - Implement duplicate detection (same populationId)
    - Implement duplicate removal logic
    - _Requirements: 5.3_
  
  - [x] 2.5 Implement source participant deletion
    - Add deletion logic after all migrations complete
    - Verify no orphaned related entities remain
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ]* 2.6 Write property test for participant address history migration
    - **Property 14: Participant address history migration**
    - Generate random participants with address history
    - Test migration excludes duplicates
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.3, 6.1, 6.2_
  
  - [ ]* 2.7 Write property test for participant assignment migration
    - **Property 25: Participant assignment migration**
    - Generate random participants with assignments
    - Test migration excludes duplicates
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.3_
  
  - [ ]* 2.8 Write unit tests for participant merge edge cases
    - Test merge with no related entities
    - Test merge with only duplicate related entities
    - Test merge with mixed duplicate and unique related entities
    - _Requirements: 5.3, 6.1, 6.2_

- [x] 3. Implement activity merge service
  - [x] 3.1 Create ActivityMergeService class with merge method
    - Implement transaction wrapper using Prisma $transaction
    - Implement record validation
    - Implement field reconciliation update logic
    - _Requirements: 4.2, 4.3, 5.1, 5.2_
  
  - [x] 3.2 Implement activity assignment migration
    - Write raw SQL to migrate assignment records
    - Implement duplicate detection (same participantId and roleId)
    - Implement duplicate removal logic
    - _Requirements: 5.4, 6.3, 6.4_
  
  - [x] 3.3 Implement activity venue history migration
    - Write raw SQL to migrate venue history records
    - Implement duplicate detection (same venueId and effectiveFrom)
    - Implement duplicate removal logic
    - _Requirements: 5.4_
  
  - [x] 3.4 Implement source activity deletion
    - Add deletion logic after all migrations complete
    - Verify no orphaned related entities remain
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ]* 3.5 Write property test for activity assignment migration
    - **Property 15: Activity assignment migration**
    - Generate random activities with assignments
    - Test migration excludes duplicates
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.4, 6.3, 6.4_
  
  - [ ]* 3.6 Write unit tests for activity merge edge cases
    - Test merge with no related entities
    - Test merge with only duplicate related entities
    - _Requirements: 5.4, 6.3, 6.4_

- [x] 4. Implement venue merge service
  - [x] 4.1 Create VenueMergeService class with merge method
    - Implement transaction wrapper using Prisma $transaction
    - Implement record validation
    - Implement field reconciliation update logic
    - _Requirements: 4.2, 4.3, 5.1, 5.2_
  
  - [x] 4.2 Implement venue history migration
    - Write raw SQL to migrate activity venue history records
    - Write raw SQL to migrate participant address history records
    - Implement duplicate detection for both history types
    - Implement duplicate removal logic
    - _Requirements: 5.6_
  
  - [x] 4.3 Implement source venue deletion
    - Add deletion logic after all migrations complete
    - Verify no orphaned related entities remain
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ]* 4.4 Write property test for venue history migration
    - **Property 17: Venue history migration**
    - Generate random venues with activity and participant history
    - Test migration excludes duplicates
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.6_

- [x] 5. Implement geographic area merge service
  - [x] 5.1 Create GeographicAreaMergeService class with merge method
    - Implement transaction wrapper using Prisma $transaction
    - Implement record validation
    - Implement field reconciliation update logic
    - _Requirements: 4.2, 4.3, 5.1, 5.2_
  
  - [x] 5.2 Implement geographic area hierarchy migration
    - Write raw SQL to update child geographic areas
    - Implement duplicate detection (same name and areaType)
    - Implement duplicate removal logic
    - _Requirements: 5.5, 6.5, 6.6_
  
  - [x] 5.3 Implement venue reference migration
    - Write raw SQL to update venue geographic area references
    - _Requirements: 5.5_
  
  - [x] 5.4 Implement user authorization migration
    - Write raw SQL to migrate user geographic authorizations
    - Implement duplicate detection (same userId)
    - Implement duplicate removal logic
    - _Requirements: 5.5_
  
  - [x] 5.5 Implement source geographic area deletion
    - Add deletion logic after all migrations complete
    - Verify no orphaned related entities remain
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ]* 5.6 Write property test for geographic area hierarchy migration
    - **Property 16: Geographic area hierarchy migration**
    - Generate random geographic area hierarchies
    - Test migration excludes duplicates
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.5, 6.5, 6.6_

- [x] 6. Implement activity type merge service
  - [x] 6.1 Create ActivityTypeMergeService class with merge method
    - Implement transaction wrapper using Prisma $transaction
    - Implement record validation
    - No field reconciliation needed (simple entity)
    - _Requirements: 4.2, 5.1, 5.2_
  
  - [x] 6.2 Implement activity reference migration
    - Write raw SQL to update activity type references
    - No duplicate detection needed
    - _Requirements: 5.7_
  
  - [x] 6.3 Implement source activity type deletion
    - Add deletion logic after all migrations complete
    - Verify no orphaned related entities remain
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ]* 6.4 Write property test for activity type reference migration
    - **Property 18: Activity type reference migration**
    - Generate random activity types with activities
    - Test all activities updated to reference destination
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.7_

- [x] 7. Implement population merge service
  - [x] 7.1 Create PopulationMergeService class with merge method
    - Implement transaction wrapper using Prisma $transaction
    - Implement record validation
    - No field reconciliation needed (simple entity)
    - _Requirements: 4.2, 5.1, 5.2_
  
  - [x] 7.2 Implement population membership migration
    - Write raw SQL to migrate participant population records
    - Implement duplicate detection (same participantId)
    - Implement duplicate removal logic
    - _Requirements: 5.8, 6.7, 6.8_
  
  - [x] 7.3 Implement source population deletion
    - Add deletion logic after all migrations complete
    - Verify no orphaned related entities remain
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ]* 7.4 Write property test for population membership migration
    - **Property 19: Population membership migration**
    - Generate random populations with participant memberships
    - Test migration excludes duplicates
    - Test source deletion after migration
    - Configure 100 iterations
    - _Requirements: 5.8, 6.7, 6.8_

- [x] 8. Create merge API routes
  - [x] 8.1 Create participant merge route
    - Add POST /api/participants/:destinationId/merge endpoint
    - Implement request validation middleware
    - Implement authorization middleware
    - Call ParticipantMergeService
    - Return appropriate response (200/400/500)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  
  - [x] 8.2 Create activity merge route
    - Add POST /api/activities/:destinationId/merge endpoint
    - Implement request validation middleware
    - Implement authorization middleware
    - Call ActivityMergeService
    - Return appropriate response (200/400/500)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  
  - [x] 8.3 Create venue merge route
    - Add POST /api/venues/:destinationId/merge endpoint
    - Implement request validation middleware
    - Implement authorization middleware
    - Call VenueMergeService
    - Return appropriate response (200/400/500)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  
  - [x] 8.4 Create geographic area merge route
    - Add POST /api/geographic-areas/:destinationId/merge endpoint
    - Implement request validation middleware
    - Implement authorization middleware
    - Call GeographicAreaMergeService
    - Return appropriate response (200/400/500)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  
  - [x] 8.5 Create activity type merge route
    - Add POST /api/activity-types/:destinationId/merge endpoint
    - Implement request validation middleware
    - Implement authorization middleware
    - Call ActivityTypeMergeService
    - Return appropriate response (200/400/500)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  
  - [x] 8.6 Create population merge route
    - Add POST /api/populations/:destinationId/merge endpoint
    - Implement request validation middleware
    - Implement authorization middleware
    - Call PopulationMergeService
    - Return appropriate response (200/400/500)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  
  - [ ]* 8.7 Write unit tests for route validation
    - Test invalid UUID format handling
    - Test missing sourceId handling
    - Test same source and destination handling
    - Test authorization checks
    - _Requirements: 4.2, 4.4_
  
  - [ ]* 8.8 Write property test for error response formats
    - **Property 10: Validation error response format**
    - **Property 11: Operation error response format**
    - **Property 12: Success response format**
    - Generate random valid and invalid requests
    - Test response status codes and structure
    - Configure 100 iterations
    - _Requirements: 4.4, 4.5, 4.6_

- [x] 9. Checkpoint - Backend merge services complete
  - Ensure all backend tests pass
  - Verify all merge services handle transactions correctly
  - Ask the user if questions arise

- [x] 10. Create frontend merge API service
  - Create merge API client functions for all entity types
  - Implement request/response type definitions
  - Implement error handling and parsing
  - _Requirements: 4.1_

- [x] 11. Create MergeInitiationModal component
  - [x] 11.1 Implement modal structure and state management
    - Create component with CloudScape Modal
    - Implement state for source, destination, and validation
    - Pre-populate source with current entity on mount
    - _Requirements: 1.2, 1.3_
  
  - [x] 11.2 Implement destination entity selection
    - Add search/select interface for destination entity
    - Fetch entities of same type from API
    - Display entity names in selection dropdown
    - _Requirements: 1.4_
  
  - [x] 11.3 Implement swap functionality
    - Add "Swap" button with appropriate icon
    - Implement swap logic to exchange source and destination
    - Update UI to reflect swapped values
    - _Requirements: 1.5, 1.6_
  
  - [x] 11.4 Implement validation and confirmation
    - Validate source ≠ destination
    - Display error message if same record selected
    - Enable confirmation button only when valid
    - Route to appropriate flow based on entity type
    - _Requirements: 1.8, 1.9, 1.10_
  
  - [ ]* 11.5 Write unit tests for MergeInitiationModal
    - Test modal opens with pre-populated source
    - Test swap button exchanges values
    - Test validation prevents same-record merge
    - Test routing to reconciliation vs confirmation
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.8, 1.9, 1.10_
  
  - [ ]* 11.6 Write property test for source-destination validation
    - **Property 1: Source-destination validation**
    - Generate random entity pairs
    - Test validation correctly identifies same-record merges
    - Configure 100 iterations
    - _Requirements: 1.8, 1.9_

- [x] 12. Create card-based reconciliation interface
  - [x] 12.1 Implement table structure with CloudScape Table component
    - Create ReconciliationPage with Table component
    - Define columns: Field Name, Source Value (Card), Destination Value (Card)
    - Implement table item interface with field data
    - _Requirements: 2.2, 2.3_
  
  - [x] 12.2 Implement card-based field selection
    - Render source and destination values as Card components with entireCardClickable
    - Implement mutual exclusivity (exactly one selected per row)
    - Set default selection to destination cards
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_
  
  - [x] 12.3 Implement automatic complementary selection
    - Handle card click to toggle selection and auto-deselect complementary card
    - Handle selected card click to auto-select complementary card
    - Ensure exactly one card selected per row at all times
    - _Requirements: 2.9, 2.10, 2.11_
  
  - [x] 12.4 Implement visual styling for selected cards
    - Apply distinct visual treatment to selected cards (border, background, checkmark)
    - Ensure clear visual indication of which value will be used
    - _Requirements: 2.12_
  
  - [ ]* 12.5 Write unit tests for card reconciliation
    - Test default destination card selection
    - Test mutual exclusivity behavior
    - Test automatic complementary selection
    - Test visual styling on selected cards
    - Test no manual editing capability
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13_
  
  - [ ]* 12.6 Write property test for card mutual exclusivity
    - **Property 3: Card mutual exclusivity**
    - Generate random field selections
    - Test exactly one card selected per row
    - Configure 100 iterations
    - _Requirements: 2.8_
  
  - [ ]* 12.7 Write property test for automatic complementary selection
    - **Property 5: Automatic complementary selection**
    - Generate random card interactions
    - Test complementary selection/deselection behavior
    - Configure 100 iterations
    - _Requirements: 2.9, 2.10, 2.11_

- [x] 13. Update ReconciliationPage component
  - [x] 13.1 Implement page structure with table layout
    - Create page component with CloudScape ContentLayout
    - Integrate Table component from task 12
    - Configure responsive behavior for mobile
    - _Requirements: 2.2, 9.1, 9.2_
  
  - [x] 13.2 Implement table data preparation
    - Fetch source and destination entities
    - Transform entity fields into table items
    - Map field names, values, and selection states
    - _Requirements: 2.3_
  
  - [x] 13.3 Implement state management
    - Track field selection states (source or destination)
    - Update state on checkbox changes
    - Build reconciled fields object from selections
    - _Requirements: 2.9, 2.10, 2.11_
  
  - [x] 13.4 Implement submit and confirmation
    - Add submit button (enabled when ready)
    - Show MergeConfirmationDialog on submit
    - Call merge API with selected field values
    - Handle success and error responses
    - _Requirements: 2.14, 2.15, 2.16, 2.17_
  
  - [ ]* 13.5 Write unit tests for ReconciliationPage
    - Test page renders with correct table layout
    - Test table data preparation from entities
    - Test submit button behavior
    - Test confirmation dialog flow
    - Test success and error handling
    - _Requirements: 2.2, 2.3, 2.14, 2.15, 2.16, 2.17_
  
  - [ ]* 13.6 Write property test for field reconciliation application
    - **Property 9: Field reconciliation application**
    - Generate random entities with reconciled fields
    - Test API receives correct reconciled values
    - Configure 100 iterations
    - _Requirements: 4.3_

- [x] 14. Create MergeConfirmationDialog component
  - [x] 14.1 Implement dialog structure
    - Create component with CloudScape Modal
    - Display source and destination names
    - Show warning about irreversible action
    - Add confirm and cancel buttons
    - _Requirements: 2.13_
  
  - [ ]* 14.2 Write unit tests for MergeConfirmationDialog
    - Test dialog displays correct entity names
    - Test confirm button triggers callback
    - Test cancel button dismisses dialog
    - _Requirements: 2.13_

- [x] 15. Create simple entity merge flow
  - [x] 15.1 Implement direct confirmation for simple entities
    - Detect simple entity types (ActivityType, Population)
    - Skip reconciliation page
    - Show MergeConfirmationDialog directly
    - Call merge API on confirmation
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 15.2 Write unit tests for simple entity merge flow
    - Test ActivityType merge skips reconciliation
    - Test Population merge skips reconciliation
    - Test API call made immediately after confirmation
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 15.3 Write property test for entity type routing
    - **Property 2: Entity type routing**
    - Generate random entity types
    - Test complex entities route to reconciliation
    - Test simple entities route to confirmation
    - Configure 100 iterations
    - _Requirements: 1.10, 2.1, 3.1, 10.7, 10.8_

- [x] 16. Add merge button to entity detail pages
  - [x] 16.1 Add merge button to ParticipantDetail component
    - Import ResponsiveButton component
    - Add button with "shrink" icon and "Merge" label
    - Wire button to open MergeInitiationModal
    - _Requirements: 1.1_
  
  - [x] 16.2 Add merge button to ActivityDetail component
    - Import ResponsiveButton component
    - Add button with "shrink" icon and "Merge" label
    - Wire button to open MergeInitiationModal
    - _Requirements: 1.1_
  
  - [x] 16.3 Add merge button to VenueDetail component
    - Import ResponsiveButton component
    - Add button with "shrink" icon and "Merge" label
    - Wire button to open MergeInitiationModal
    - _Requirements: 1.1_
  
  - [x] 16.4 Add merge button to GeographicAreaDetail component
    - Import ResponsiveButton component
    - Add button with "shrink" icon and "Merge" label
    - Wire button to open MergeInitiationModal
    - _Requirements: 1.1_
  
  - [x] 16.5 Add merge button to ActivityTypeDetail component
    - Import ResponsiveButton component
    - Add button with "shrink" icon and "Merge" label
    - Wire button to open MergeInitiationModal
    - _Requirements: 1.1_
  
  - [x] 16.6 Add merge button to PopulationDetail component
    - Import ResponsiveButton component
    - Add button with "shrink" icon and "Merge" label
    - Wire button to open MergeInitiationModal
    - _Requirements: 1.1_
  
  - [ ]* 16.7 Write unit tests for merge button presence
    - Test button exists on all entity detail pages
    - Test button opens MergeInitiationModal
    - _Requirements: 1.1, 1.2_

- [x] 17. Checkpoint - Frontend merge UI complete
  - Ensure all frontend tests pass
  - Verify merge flow works for all entity types
  - Test responsive behavior on mobile devices
  - Ask the user if questions arise

- [x] 18. Integration testing
  - [ ]* 18.1 Write end-to-end test for participant merge
    - Test complete flow from button click to success message
    - Test with field reconciliation
    - Test with related entities
    - _Requirements: All participant requirements_
  
  - [ ]* 18.2 Write end-to-end test for activity merge
    - Test complete flow from button click to success message
    - Test with field reconciliation
    - Test with related entities
    - _Requirements: All activity requirements_
  
  - [ ]* 18.3 Write end-to-end test for simple entity merge
    - Test ActivityType merge flow
    - Test Population merge flow
    - Test no reconciliation page shown
    - _Requirements: 3.1, 3.2, 10.5, 10.6, 10.8_
  
  - [ ]* 18.4 Write property test for transaction atomicity
    - **Property 20: Transaction atomicity**
    - Generate random merge scenarios
    - Simulate failures at various points
    - Test all changes rolled back on failure
    - Configure 100 iterations
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [ ]* 18.5 Write property test for no orphaned entities
    - **Property 24: No orphaned entities**
    - Generate random entities with related entities
    - Execute merge and verify source deleted
    - Test no related entities reference deleted source
    - Configure 100 iterations
    - _Requirements: 8.4_
  
  - [ ]* 18.6 Write property test for complete related entity migration
    - **Property 13: Complete related entity migration**
    - Generate random entities with various related entities
    - Test all foreign keys updated to destination
    - Configure 100 iterations
    - _Requirements: 5.1, 5.2_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Run all unit tests (frontend and backend)
  - Run all property-based tests
  - Run all integration tests
  - Verify test coverage meets goals (>80% frontend, >90% backend)
  - Ask the user if questions arise

## Bugfix Tasks

- [x] 20. Add getById methods to frontend entity services (Bugfix: Entity Selection Persistence)
  - [x] 20.1 Add getParticipantById to ParticipantService
    - Create static method `getParticipantById(id: string): Promise<Participant>`
    - Call GET /api/v1/participants/:id endpoint
    - Return participant data
    - Handle errors appropriately
    - _Requirements: 12.1, 12.7_

  - [x] 20.2 Add getActivityById to ActivityService
    - Create static method `getActivityById(id: string): Promise<Activity>`
    - Call GET /api/v1/activities/:id endpoint
    - Return activity data with activityType populated
    - Handle errors appropriately
    - _Requirements: 12.2, 12.7_

  - [x] 20.3 Add getVenueById to VenueService
    - Create static method `getVenueById(id: string): Promise<Venue>`
    - Call GET /api/v1/venues/:id endpoint
    - Return venue data
    - Handle errors appropriately
    - _Requirements: 12.3, 12.7_

  - [x] 20.4 Add getActivityTypeById to ActivityTypeService
    - Create static method `getActivityTypeById(id: string): Promise<ActivityType>`
    - Call GET /api/v1/activity-types/:id endpoint
    - Return activity type data with activityCategory populated
    - Handle errors appropriately
    - _Requirements: 12.5, 12.7_

  - [x] 20.5 Add getPopulationById to PopulationService
    - Create static method `getPopulationById(id: string): Promise<Population>`
    - Call GET /api/v1/populations/:id endpoint
    - Return population data
    - Handle errors appropriately
    - _Requirements: 12.6, 12.7_

  - [ ]* 20.6 Write unit tests for service getById methods
    - Test successful fetch returns entity
    - Test invalid ID throws error
    - Test network errors are handled
    - _Requirements: 12.7, 12.8_

- [x] 21. Update AsyncEntitySelect component with ensure included support (Bugfix: Entity Selection Persistence)
  - [x] 21.1 Add new props to AsyncEntitySelect interface
    - Add optional `ensureIncluded?: string | null` prop
    - Add optional `fetchByIdFunction?: (id: string) => Promise<any>` prop
    - Update TypeScript interface definition
    - _Requirements: 11.1, 12.9_

  - [x] 21.2 Implement ensured entity fetching logic
    - Add state to track ensured entity
    - Add state to track fetch status
    - Create useEffect to fetch ensured entity on mount
    - Check if `ensureIncluded` and `fetchByIdFunction` are provided
    - Fetch entity by ID using `fetchByIdFunction`
    - Store fetched entity in state
    - Mark fetch as complete (even on error)
    - Log errors to console if fetch fails
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 21.3 Merge ensured entity with search results
    - Update options useMemo to include ensured entity
    - Check if ensured entity is already in search results
    - If not present, format ensured entity using `formatOption`
    - Add formatted entity to beginning of options list
    - Ensure ensured entity remains in options even when search query changes
    - _Requirements: 11.4, 11.8, 12.13, 12.14_

  - [x] 21.4 Implement React Query caching for fetch-by-ID
    - Use useQuery hook for fetching ensured entity
    - Set appropriate cache key
    - Set staleTime to prevent unnecessary refetches
    - Handle loading and error states
    - _Requirements: 11.6, 12.13_

  - [x] 21.5 Ensure backward compatibility
    - Test component works without `ensureIncluded` prop
    - Test component works without `fetchByIdFunction` prop
    - Verify existing usages are not affected
    - Ensure no breaking changes to public API
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ]* 21.6 Write unit tests for AsyncEntitySelect ensure included
    - Test ensured entity is fetched when not in initial results
    - Test ensured entity is not fetched when already in results
    - Test ensured entity is added to options list
    - Test ensured entity remains visible during search
    - Test component works without ensureIncluded (backward compatibility)
    - Test error handling when fetch-by-ID fails
    - _Requirements: 11.1-11.8_

- [x] 22. Update MergeInitiationModal to use ensure included (Bugfix: Entity Selection Persistence)
  - [x] 22.1 Update getEntityConfig to include fetchByIdFunction
    - Add `fetchByIdFunction` property to return object for each entity type
    - Map participant to `ParticipantService.getParticipantById`
    - Map activity to `ActivityService.getActivityById`
    - Map venue to `VenueService.getVenueById`
    - Map geographicArea to `GeographicAreaService.getGeographicAreaById`
    - Map activityType to `ActivityTypeService.getActivityTypeById`
    - Map population to `PopulationService.getPopulationById`
    - _Requirements: 12.10, 12.11, 12.12_

  - [x] 22.2 Pass ensureIncluded to source AsyncEntitySelect
    - Extract `fetchByIdFunction` from getEntityConfig
    - Pass `ensureIncluded={sourceId}` prop to source AsyncEntitySelect
    - Pass `fetchByIdFunction={fetchByIdFunction}` prop to source AsyncEntitySelect
    - _Requirements: 11.9, 11.11_

  - [x] 22.3 Pass ensureIncluded to destination AsyncEntitySelect
    - Extract `fetchByIdFunction` from getEntityConfig
    - Pass `ensureIncluded={destinationId}` prop to destination AsyncEntitySelect
    - Pass `fetchByIdFunction={fetchByIdFunction}` prop to destination AsyncEntitySelect
    - _Requirements: 11.10, 11.12_

  - [x] 22.4 Verify swap functionality with ensured entities
    - Test that swapping updates ensureIncluded props correctly
    - Verify both entities remain visible after swap
    - Ensure AsyncEntitySelect refetches newly ensured entities if needed
    - _Requirements: 11.13, 11.14_

  - [ ]* 22.5 Write integration tests for MergeInitiationModal
    - Test source entity remains visible after selection
    - Test destination entity remains visible after selection
    - Test swap functionality with entities not in first page
    - Test both entities remain visible after swap
    - Test merge flow completes successfully with ensured entities
    - _Requirements: 11.9-11.14_

- [x] 23. Update ReconciliationPage to respect geographic filter (Bugfix: Geographic Filter Enforcement)
  - [x] 23.1 Import useGlobalGeographicFilter hook
    - Add import statement for the hook
    - _Requirements: 13.1_
  
  - [x] 23.2 Extract selectedGeographicAreaId from hook
    - Call useGlobalGeographicFilter() in component
    - Destructure selectedGeographicAreaId
    - _Requirements: 13.1_
  
  - [x] 23.3 Update fetchEntity function signature
    - Add geographicAreaId parameter to fetchEntity function
    - Make parameter optional for backward compatibility
    - _Requirements: 13.2, 16.6_
  
  - [x] 23.4 Pass geographicAreaId to entity service calls
    - Update ParticipantService.getParticipant call
    - Update ActivityService.getActivity call
    - Update VenueService.getVenue call
    - Update GeographicAreaService.getGeographicArea call
    - Pass geographicAreaId in params object
    - _Requirements: 13.2_
  
  - [x] 23.5 Add selectedGeographicAreaId to useEffect dependencies
    - Include selectedGeographicAreaId in dependency array
    - Ensure re-fetch when filter changes
    - _Requirements: 13.3_
  
  - [x] 23.6 Improve error handling for geographic authorization
    - Check for 403 status code in error handling
    - Check for geographic-related error messages
    - Display clear error message about geographic restrictions
    - _Requirements: 13.4, 15.1, 15.2, 15.3_
  
  - [x] 23.7 Add "Go Back" button in error state
    - Display button when error occurs
    - Navigate to previous page on click
    - _Requirements: 15.4_

- [x] 24. Verify backend entity services support geographic filtering (Bugfix: Geographic Filter Enforcement)
  - [x] 24.1 Check ParticipantService.getParticipant method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 14.1, 14.2_
  
  - [x] 24.2 Check ActivityService.getActivity method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 14.1, 14.2_
  
  - [x] 24.3 Check VenueService.getVenue method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 14.1, 14.2_
  
  - [x] 24.4 Check GeographicAreaService.getGeographicArea method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 14.1, 14.2_

- [ ] 25. Update merge services to enforce geographic authorization (Bugfix: Geographic Filter Enforcement)
  - [ ] 25.1 Update ParticipantMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 25.2 Update ActivityMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 25.3 Update VenueMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 25.4 Update GeographicAreaMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 25.5 Update ActivityTypeMergeService.merge method
    - Add userId and geographicAreaId parameters (for consistency)
    - Geographic authorization may not apply to activity types
    - _Requirements: 16.8_
  
  - [ ] 25.6 Update PopulationMergeService.merge method
    - Add userId and geographicAreaId parameters (for consistency)
    - Geographic authorization may not apply to populations
    - _Requirements: 16.8_

- [ ] 26. Update merge API routes to pass geographic filter (Bugfix: Geographic Filter Enforcement)
  - [ ] 26.1 Update participant merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 14.1_
  
  - [ ] 26.2 Update activity merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 14.1_
  
  - [ ] 26.3 Update venue merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 14.1_
  
  - [ ] 26.4 Update geographic area merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 14.1_
  
  - [ ] 26.5 Update activity type merge route
    - Extract geographicAreaId from query parameters (for consistency)
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 16.8_
  
  - [ ] 26.6 Update population merge route
    - Extract geographicAreaId from query parameters (for consistency)
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 16.8_

- [x] 27. Update frontend merge API service to pass geographic filter (Bugfix: Geographic Filter Enforcement)
  - [x] 27.1 Update mergeParticipants method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 13.2_
  
  - [x] 27.2 Update mergeActivities method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 13.2_
  
  - [x] 27.3 Update mergeVenues method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 13.2_
  
  - [x] 27.4 Update mergeGeographicAreas method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 13.2_
  
  - [x] 27.5 Update ReconciliationPage to pass geographicAreaId to merge API
    - Pass selectedGeographicAreaId to executeMerge function
    - Update executeMerge to pass geographicAreaId to service methods
    - _Requirements: 13.2_

- [ ] 28. Add audit logging for geographic authorization failures (Bugfix: Geographic Filter Enforcement)
  - [ ] 28.1 Log authorization failures in merge services
    - Log userId, entityIds, and geographicAreaId
    - Log timestamp and failure reason
    - Use existing audit logging infrastructure
    - _Requirements: 14.5_

- [ ] 29. Testing for bugfixes
  - [ ]* 29.1 Write unit test for ReconciliationPage with geographic filter
    - Test that geographicAreaId is passed to fetch functions
    - Test error handling for unauthorized entities
    - Test re-fetch when filter changes
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 29.2 Write unit test for merge services with geographic authorization
    - Test authorization check is performed
    - Test 403 error when entities outside authorized area
    - Test merge proceeds when entities are authorized
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ]* 29.3 Write integration test for merge flow with geographic filter
    - Test complete flow from initiation to completion
    - Test with entities within filtered area
    - Test with entities outside filtered area
    - _Requirements: All geographic filter requirements_
  
  - [ ]* 29.4 Manual testing with active geographic filter
    - Test merge within filtered area
    - Test merge with entity outside filtered area
    - Verify error messages are clear
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  
  - [ ]* 29.5 Manual testing without geographic filter
    - Test merge works normally
    - Verify backward compatibility
    - _Requirements: 16.6, 16.7, 16.8, 16.9_

- [x] 30. Final checkpoint - Verify all bugfixes work correctly
  - Test MergeInitiationModal with entities not in first page of results
  - Test swap functionality with ensured entities
  - Test ReconciliationPage with active geographic filter
  - Test merge with entities outside geographic filter
  - Verify no regressions in existing functionality
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with minimum 100 iterations
- All merge operations use Prisma $transaction with raw SQL for atomicity
- Frontend uses CloudScape components for consistent UI
- Backend follows existing service/route pattern in the codebase
