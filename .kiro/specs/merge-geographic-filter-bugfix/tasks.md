# Implementation Plan: Merge Geographic Filter Bugfix

## Overview

This implementation plan fixes the bug where the record merge reconciliation page does not respect the global geographic area filter. The fix ensures proper geographic authorization throughout the merge flow.

## Tasks

- [x] 1. Update ReconciliationPage to respect geographic filter
  - [x] 1.1 Import useGlobalGeographicFilter hook
    - Add import statement for the hook
    - _Requirements: 1.1_
  
  - [x] 1.2 Extract selectedGeographicAreaId from hook
    - Call useGlobalGeographicFilter() in component
    - Destructure selectedGeographicAreaId
    - _Requirements: 1.1_
  
  - [x] 1.3 Update fetchEntity function signature
    - Add geographicAreaId parameter to fetchEntity function
    - Make parameter optional for backward compatibility
    - _Requirements: 1.2, 5.1_
  
  - [x] 1.4 Pass geographicAreaId to entity service calls
    - Update ParticipantService.getParticipant call
    - Update ActivityService.getActivity call
    - Update VenueService.getVenue call
    - Update GeographicAreaService.getGeographicArea call
    - Pass geographicAreaId in params object
    - _Requirements: 1.2_
  
  - [x] 1.5 Add selectedGeographicAreaId to useEffect dependencies
    - Include selectedGeographicAreaId in dependency array
    - Ensure re-fetch when filter changes
    - _Requirements: 1.3_
  
  - [x] 1.6 Improve error handling for geographic authorization
    - Check for 403 status code in error handling
    - Check for geographic-related error messages
    - Display clear error message about geographic restrictions
    - _Requirements: 1.4, 3.1, 3.2, 3.3_
  
  - [x] 1.7 Add "Go Back" button in error state
    - Display button when error occurs
    - Navigate to previous page on click
    - _Requirements: 3.4_

- [x] 2. Verify backend entity services support geographic filtering
  - [x] 2.1 Check ParticipantService.getParticipant method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Check ActivityService.getActivity method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.3 Check VenueService.getVenue method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.4 Check GeographicAreaService.getGeographicArea method
    - Verify method accepts geographicAreaId parameter
    - Verify geographic authorization is enforced
    - Add support if missing
    - _Requirements: 2.1, 2.2_

- [ ] 3. Update merge services to enforce geographic authorization
  - [ ] 3.1 Update ParticipantMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 3.2 Update ActivityMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 3.3 Update VenueMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 3.4 Update GeographicAreaMergeService.merge method
    - Add userId and geographicAreaId parameters
    - Add geographic authorization check before merge
    - Throw 403 error if authorization fails
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 3.5 Update ActivityTypeMergeService.merge method
    - Add userId and geographicAreaId parameters (for consistency)
    - Geographic authorization may not apply to activity types
    - _Requirements: 5.3_
  
  - [ ] 3.6 Update PopulationMergeService.merge method
    - Add userId and geographicAreaId parameters (for consistency)
    - Geographic authorization may not apply to populations
    - _Requirements: 5.3_

- [ ] 4. Update merge API routes to pass geographic filter
  - [ ] 4.1 Update participant merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 2.1_
  
  - [ ] 4.2 Update activity merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 2.1_
  
  - [ ] 4.3 Update venue merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 2.1_
  
  - [ ] 4.4 Update geographic area merge route
    - Extract geographicAreaId from query parameters
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 2.1_
  
  - [ ] 4.5 Update activity type merge route
    - Extract geographicAreaId from query parameters (for consistency)
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 5.3_
  
  - [ ] 4.6 Update population merge route
    - Extract geographicAreaId from query parameters (for consistency)
    - Extract userId from req.user
    - Pass both to merge service
    - _Requirements: 5.3_

- [x] 5. Update frontend merge API service to pass geographic filter
  - [x] 5.1 Update mergeParticipants method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 1.2_
  
  - [x] 5.2 Update mergeActivities method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 1.2_
  
  - [x] 5.3 Update mergeVenues method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 1.2_
  
  - [x] 5.4 Update mergeGeographicAreas method
    - Accept geographicAreaId parameter
    - Pass as query parameter in API call
    - _Requirements: 1.2_
  
  - [x] 5.5 Update ReconciliationPage to pass geographicAreaId to merge API
    - Pass selectedGeographicAreaId to executeMerge function
    - Update executeMerge to pass geographicAreaId to service methods
    - _Requirements: 1.2_

- [ ] 6. Add audit logging for geographic authorization failures
  - [ ] 6.1 Log authorization failures in merge services
    - Log userId, entityIds, and geographicAreaId
    - Log timestamp and failure reason
    - Use existing audit logging infrastructure
    - _Requirements: 2.5_

- [ ] 7. Testing
  - [ ]* 7.1 Write unit test for ReconciliationPage with geographic filter
    - Test that geographicAreaId is passed to fetch functions
    - Test error handling for unauthorized entities
    - Test re-fetch when filter changes
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 7.2 Write unit test for merge services with geographic authorization
    - Test authorization check is performed
    - Test 403 error when entities outside authorized area
    - Test merge proceeds when entities are authorized
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 7.3 Write integration test for merge flow with geographic filter
    - Test complete flow from initiation to completion
    - Test with entities within filtered area
    - Test with entities outside filtered area
    - _Requirements: All requirements_
  
  - [ ]* 7.4 Manual testing with active geographic filter
    - Test merge within filtered area
    - Test merge with entity outside filtered area
    - Verify error messages are clear
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 7.5 Manual testing without geographic filter
    - Test merge works normally
    - Verify backward compatibility
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. Checkpoint - Verify all tests pass
  - Ensure all backend tests pass
  - Ensure all frontend tests pass
  - Verify manual testing scenarios work
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test-related tasks
- The fix maintains backward compatibility by making geographicAreaId optional
- Existing authorization middleware and services are reused
- No database schema changes required
