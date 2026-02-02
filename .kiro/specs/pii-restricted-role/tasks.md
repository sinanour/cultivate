# Implementation Plan: PII-Restricted Role

## Overview

This implementation plan breaks down the PII-restricted role feature into discrete coding tasks. The approach follows a layered implementation strategy: first establishing the role infrastructure (enum, JWT, database), then implementing backend redaction logic, and finally updating frontend components to handle redacted data.

## Tasks

- [x] 1. Add PII_RESTRICTED role to system infrastructure
  - [x] 1.1 Add PII_RESTRICTED to UserRole enum in backend-api
    - Update the UserRole enum definition to include PII_RESTRICTED
    - Update any role validation logic to accept the new role
    - _Requirements: 1.1_
  
  - [x] 1.2 Add PII_RESTRICTED to UserRole enum in web-frontend
    - Update the frontend UserRole enum to match backend
    - Ensure type consistency across frontend codebase
    - _Requirements: 1.1_
  
  - [x] 1.3 Update JWT token generation to include PII_RESTRICTED role
    - Modify JWT payload generation to include role field
    - Ensure PII_RESTRICTED role is properly encoded in tokens
    - _Requirements: 1.4, 9.1_
  
  - [ ]*  1.4 Write property test for JWT role inclusion
    - **Property 1: JWT Token Role Inclusion**
    - **Validates: Requirements 1.4**
  
  - [x] 1.5 Update database schema to support PII_RESTRICTED role
    - Add migration to allow PII_RESTRICTED as a valid role value
    - Update any role constraints or indexes
    - _Requirements: 1.3_
  
  - [ ]*  1.6 Write property test for user role persistence
    - **Property 2: User Role Persistence**
    - **Validates: Requirements 1.3**

- [x] 2. Implement backend PII redaction service
  - [x] 2.1 Create PIIRedactionService interface and implementation
    - Implement redactParticipant method with field-level redaction
    - Implement redactVenue method with name redaction
    - Implement redactAddressHistory method for nested venue redaction
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]*  2.2 Write property test for participant PII field redaction
    - **Property 3: Participant PII Field Redaction**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**
  
  - [ ]*  2.3 Write property test for participant address history redaction
    - **Property 4: Participant Address History Redaction**
    - **Validates: Requirements 2.9**
  
  - [ ]*  2.4 Write property test for venue name redaction
    - **Property 5: Venue Name Redaction**
    - **Validates: Requirements 3.1**
  
  - [ ]*  2.5 Write property test for venue non-PII field preservation
    - **Property 6: Venue Non-PII Field Preservation**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

- [x] 3. Implement response serialization interceptor
  - [x] 3.1 Create PIIRedactionInterceptor class
    - Implement intercept method to recursively process response data
    - Add type detection for Participant and Venue objects
    - Handle arrays and nested objects
    - Wire interceptor into API response pipeline
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]*  3.2 Write unit tests for response interceptor
    - Test single object redaction
    - Test array redaction
    - Test nested object redaction
    - Test pass-through for non-PII_RESTRICTED roles
    - _Requirements: 2.1, 3.1_

- [x] 4. Checkpoint - Ensure backend redaction tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement authorization middleware updates
  - [x] 5.1 Update authorization middleware to extract PII_RESTRICTED role from JWT
    - Modify extractAuthContext to handle PII_RESTRICTED role
    - Ensure role is available in request context
    - _Requirements: 9.2_
  
  - [x] 5.2 Implement read-only enforcement for PII_RESTRICTED role
    - Add enforceReadOnlyForPIIRestricted function
    - Reject CREATE, UPDATE, DELETE operations for PII_RESTRICTED users
    - Return appropriate authorization errors
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]*  5.3 Write property test for write operation rejection
    - **Property 11: Write Operation Rejection**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  
  - [ ]*  5.4 Write property test for JWT role extraction
    - **Property 14: JWT Role Extraction**
    - **Validates: Requirements 9.2**

- [x] 6. Implement geographic authorization for PII_RESTRICTED role
  - [x] 6.1 Update geographic authorization logic to apply to PII_RESTRICTED users
    - Ensure geographic area checks apply to PII_RESTRICTED role
    - Reject requests outside authorized areas
    - _Requirements: 8.1, 8.2_
  
  - [ ]*  6.2 Write property test for geographic authorization enforcement
    - **Property 13: Geographic Authorization Enforcement**
    - **Validates: Requirements 8.1, 8.2**

- [x] 7. Verify non-PII resource access for PII_RESTRICTED role
  - [x] 7.1 Ensure analytics, geographic areas, and other non-PII resources are not redacted
    - Verify PIIRedactionInterceptor does not redact non-PII resource types
    - Test that analytics dashboards return full data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]*  7.2 Write property test for non-PII resource access
    - **Property 12: Non-PII Resource Access**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 8. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement frontend role-aware display components
  - [x] 9.1 Create ParticipantDisplay component with UUID fallback
    - Implement component to display UUID when user has PII_RESTRICTED role
    - Handle null name values gracefully
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 9.2 Create VenueDisplay component with address fallback
    - Implement component to display address when user has PII_RESTRICTED role
    - Handle null name values gracefully
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]*  9.3 Write property test for frontend participant UUID display
    - **Property 7: Frontend Participant UUID Display**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ]*  9.4 Write property test for frontend null value handling
    - **Property 8: Frontend Null Value Handling**
    - **Validates: Requirements 4.4**
  
  - [ ]*  9.5 Write property test for frontend venue address display
    - **Property 9: Frontend Venue Address Display**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  
  - [ ]*  9.6 Write property test for frontend venue null name fallback
    - **Property 10: Frontend Venue Null Name Fallback**
    - **Validates: Requirements 5.4**

- [x] 10. Update user management interface
  - [x] 10.1 Add PII_RESTRICTED option to user creation form
    - Update role dropdown to include PII_RESTRICTED option
    - Add descriptive label for the role
    - _Requirements: 1.2, 10.1_
  
  - [x] 10.2 Add PII_RESTRICTED option to user edit form
    - Update role dropdown to include PII_RESTRICTED option
    - Ensure existing PII_RESTRICTED users display correctly
    - _Requirements: 1.2, 10.2_
  
  - [x] 10.3 Update user detail view to display PII_RESTRICTED role
    - Show PII_RESTRICTED role clearly in user details
    - Add visual indicator or description for the role
    - _Requirements: 10.4_
  
  - [ ]*  10.4 Write unit test for user form role options
    - Test that PII_RESTRICTED appears in role dropdown
    - Test that form can save PII_RESTRICTED role
    - _Requirements: 1.2, 10.1, 10.2_

- [x] 11. Replace existing participant and venue name displays with role-aware components
  - [x] 11.1 Update participant list views to use ParticipantDisplay component
    - Replace direct name rendering with ParticipantDisplay
    - Ensure all participant list views are updated
    - _Requirements: 4.3_
  
  - [x] 11.2 Update participant detail views to use ParticipantDisplay component
    - Replace direct name rendering with ParticipantDisplay
    - Ensure all participant detail views are updated
    - _Requirements: 4.2_
  
  - [x] 11.3 Update venue list views to use VenueDisplay component
    - Replace direct name rendering with VenueDisplay
    - Ensure all venue list views are updated
    - _Requirements: 5.3_
  
  - [x] 11.4 Update venue detail views to use VenueDisplay component
    - Replace direct name rendering with VenueDisplay
    - Ensure all venue detail views are updated
    - _Requirements: 5.2_

- [x] 12. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]*  13. Write integration tests for end-to-end flows
  - [ ]*  13.1 Write integration test for PII_RESTRICTED user viewing participant data
    - Test login → request participant → verify redaction
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  
  - [ ]*  13.2 Write integration test for PII_RESTRICTED user attempting write operation
    - Test login → attempt create/update/delete → verify rejection
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]*  13.3 Write integration test for PII_RESTRICTED user with geographic restrictions
    - Test login → request data outside area → verify rejection
    - _Requirements: 8.1, 8.2_
  
  - [ ]*  13.4 Write integration test comparing different role behaviors
    - Test same data request with different roles
    - Verify different redaction behaviors
    - _Requirements: 1.5_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end user flows
- The implementation follows a backend-first approach to ensure data security before UI updates
