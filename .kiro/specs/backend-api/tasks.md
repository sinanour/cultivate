# Implementation Plan: Backend API Package

## Overview

This implementation plan covers the RESTful API service built with Node.js, Express.js, TypeScript, and Prisma ORM. The API provides endpoints for managing activities, participants, venues, geographic areas, analytics, authentication, and offline synchronization.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Initialize Node.js TypeScript project with Express.js
  - Install dependencies: express, prisma, zod, bcrypt, jsonwebtoken, cors
  - Configure TypeScript compiler options
  - Set up ESLint and Prettier
  - Create project directory structure (routes, services, repositories, middleware)
  - _Requirements: Overview_

- [x] 2. Set up Prisma ORM and database schema
  - [x] 2.1 Initialize Prisma with PostgreSQL
    - Configure Prisma schema with database connection
    - Define all entity models (User, ActivityType, Role, Participant, Activity, etc.)
    - Define relationships and foreign keys
    - Add indexes for performance
    - _Requirements: 8.1, 8.4_

  - [x] 2.2 Create initial database migration
    - Generate migration from Prisma schema
    - Include seed data for predefined activity types and roles
    - _Requirements: 1.7, 2.7, 8.6_

  - [ ]* 2.3 Write property test for foreign key constraint enforcement
    - **Property 34: Foreign Key Constraint Enforcement**
    - **Validates: Requirements 8.4**

- [x] 3. Implement authentication system
  - [x] 3.1 Create authentication service
    - Implement password hashing with bcrypt
    - Implement JWT token generation and validation
    - Implement token refresh mechanism
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ]* 3.2 Write property test for invalid credential rejection
    - **Property 42: Invalid Credential Rejection**
    - **Validates: Requirements 10.5**

  - [ ]* 3.3 Write property test for token generation
    - **Property 43: Token Generation on Authentication**
    - **Validates: Requirements 10.6**

  - [ ]* 3.4 Write property test for password hashing
    - **Property 44: Password Hashing**
    - **Validates: Requirements 10.7**

  - [ ]* 3.5 Write property test for token expiration
    - **Property 45: Access Token Expiration**
    - **Property 46: Refresh Token Expiration**
    - **Validates: Requirements 10.8, 10.9**

  - [x] 3.2 Create authentication middleware
    - Validate JWT tokens from Authorization header
    - Extract user information and attach to request
    - Return 401 for missing or invalid tokens
    - _Requirements: 11.1_

  - [ ]* 3.6 Write property test for protected endpoint authentication
    - **Property 47: Protected Endpoint Authentication Requirement**
    - **Validates: Requirements 11.1**

  - [x] 3.3 Create authorization middleware
    - Check user role against required permissions
    - Return 403 for insufficient permissions
    - Support role-based access (ADMINISTRATOR, EDITOR, READ_ONLY)
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 3.7 Write property tests for role-based access
    - **Property 48: Administrator Full Access**
    - **Property 49: Editor Write Access**
    - **Property 50: Read-Only User Restrictions**
    - **Property 51: Unauthorized Action Rejection**
    - **Property 52: Permission Validation Enforcement**
    - **Validates: Requirements 11.3, 11.4, 11.5, 11.6, 11.7**

  - [x] 3.4 Implement authentication routes
    - POST /api/auth/login
    - POST /api/auth/logout
    - POST /api/auth/refresh
    - GET /api/auth/me
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.5 Implement root administrator initialization
    - Extract SRP_ROOT_ADMIN_EMAIL and SRP_ROOT_ADMIN_PASSWORD from environment variables
    - Create database seed script to populate root administrator user
    - Hash root administrator password using bcrypt
    - Assign ADMINISTRATOR role to root administrator user
    - _Requirements: 10.10, 10.11, 10.12, 10.13, 10.14_

  - [ ]* 3.6 Write property tests for root administrator
    - **Property 46A: Root Administrator Environment Variable Extraction**
    - **Property 46B: Root Administrator Password Extraction**
    - **Property 46C: Root Administrator Database Seeding**
    - **Property 46D: Root Administrator Password Hashing**
    - **Property 46E: Root Administrator Role Assignment**
    - **Validates: Requirements 10.10, 10.11, 10.12, 10.13, 10.14**

- [ ] 4. Checkpoint - Verify authentication and authorization
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement activity type management
  - [x] 5.1 Create activity type repository
    - Implement CRUD operations using Prisma
    - Implement reference counting for deletion validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 5.2 Create activity type service
    - Implement business logic for CRUD operations
    - Validate name uniqueness
    - Prevent deletion if activities reference the type
    - _Requirements: 1.5, 1.6_

  - [ ]* 5.3 Write property tests for activity type operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 4: Name Uniqueness Enforcement**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

  - [x] 5.4 Create activity type routes
    - GET /api/activity-types
    - POST /api/activity-types
    - PUT /api/activity-types/:id
    - DELETE /api/activity-types/:id
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.5 Create Zod validation schemas
    - ActivityTypeCreateSchema
    - ActivityTypeUpdateSchema
    - _Requirements: 15.1, 15.4_

- [x] 6. Implement participant role management
  - [x] 6.1 Create participant role repository and service
    - Implement CRUD operations
    - Validate name uniqueness
    - Prevent deletion if assignments reference the role
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 6.2 Write property tests for role operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 4: Name Uniqueness Enforcement**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

  - [x] 6.3 Create participant role routes
    - GET /api/roles
    - POST /api/roles
    - PUT /api/roles/:id
    - DELETE /api/roles/:id
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Implement participant management
  - [x] 7.1 Create participant repository
    - Implement CRUD operations
    - Implement search by name or email
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.2 Create participant service
    - Validate required fields (name, email)
    - Validate email format and uniqueness
    - Handle optional fields (phone, notes, home venue)
    - Implement Type 2 SCD for home venue changes
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ]* 7.3 Write property tests for participant operations
    - **Property 5: Required Field Validation**
    - **Property 6: Email Format Validation**
    - **Property 7: Email Uniqueness Enforcement**
    - **Property 8: Optional Field Acceptance**
    - **Property 17: Participant Search Accuracy**
    - **Property 18: Participant Retrieval by ID**
    - **Validates: Requirements 3.6, 3.7, 3.8, 3.9**

  - [x] 7.4 Create participant routes
    - GET /api/participants
    - GET /api/participants/:id
    - GET /api/participants/search
    - POST /api/participants
    - PUT /api/participants/:id
    - DELETE /api/participants/:id
    - GET /api/participants/:id/address-history
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.12_

- [x] 8. Implement venue management
  - [x] 8.1 Create venue repository
    - Implement CRUD operations
    - Implement search by name or address
    - Implement queries for associated activities and participants
    - _Requirements: 5A.1, 5A.2, 5A.3, 5A.4, 5A.5, 5A.6, 5A.12, 5A.13_

  - [x] 8.2 Create venue service
    - Validate required fields (name, address, geographic area)
    - Validate geographic area exists
    - Handle optional fields (latitude, longitude, venue type)
    - Prevent deletion if activities or participants reference venue
    - _Requirements: 5A.7, 5A.8, 5A.9, 5A.10, 5A.11_

  - [ ]* 8.3 Write property tests for venue operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 5A.3, 5A.4, 5A.5, 5A.10, 5A.11**

  - [x] 8.4 Create venue routes
    - GET /api/venues
    - GET /api/venues/:id
    - GET /api/venues/search
    - POST /api/venues
    - PUT /api/venues/:id
    - DELETE /api/venues/:id
    - GET /api/venues/:id/activities
    - GET /api/venues/:id/participants
    - _Requirements: 5A.1, 5A.2, 5A.3, 5A.4, 5A.5, 5A.6, 5A.12, 5A.13_

- [x] 9. Implement geographic area management
  - [x] 9.1 Create geographic area repository
    - Implement CRUD operations
    - Implement hierarchical queries (children, ancestors)
    - Implement statistics aggregation across hierarchy
    - _Requirements: 5B.1, 5B.2, 5B.3, 5B.4, 5B.5, 5B.12, 5B.13, 5B.14, 5B.15_

  - [x] 9.2 Create geographic area service
    - Validate required fields (name, area type)
    - Validate parent geographic area exists
    - Prevent circular parent-child relationships
    - Prevent deletion if venues or child areas reference area
    - Calculate hierarchical statistics
    - _Requirements: 5B.6, 5B.7, 5B.8, 5B.9, 5B.10, 5B.11, 5B.15_

  - [ ]* 9.3 Write property tests for geographic area operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 5B.3, 5B.4, 5B.5, 5B.11**

  - [x] 9.4 Create geographic area routes
    - GET /api/geographic-areas
    - GET /api/geographic-areas/:id
    - POST /api/geographic-areas
    - PUT /api/geographic-areas/:id
    - DELETE /api/geographic-areas/:id
    - GET /api/geographic-areas/:id/children
    - GET /api/geographic-areas/:id/ancestors
    - GET /api/geographic-areas/:id/venues
    - GET /api/geographic-areas/:id/statistics
    - _Requirements: 5B.1, 5B.2, 5B.3, 5B.4, 5B.5, 5B.12, 5B.13, 5B.14, 5B.15_

- [ ] 10. Checkpoint - Verify core entity management
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement activity management
  - [x] 11.1 Create activity repository
    - Implement CRUD operations
    - Implement filtering by type and status
    - Implement venue association queries
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.12, 4.13, 4.14, 4.15_

  - [x] 11.2 Create activity service
    - Validate required fields (name, activity type, start date)
    - Validate end date for finite activities
    - Allow null end date for ongoing activities
    - Set default status to PLANNED
    - Support status transitions
    - Manage venue associations with temporal tracking
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15_

  - [ ]* 11.3 Write property tests for activity operations
    - **Property 9: Activity Date Validation**
    - **Property 10: Ongoing Activity End Date**
    - **Property 11: Default Status Assignment**
    - **Property 12: Status Value Validation**
    - **Property 19: Activity Retrieval by ID**
    - **Validates: Requirements 4.2, 4.6, 4.7, 4.8, 4.9, 4.10**

  - [x] 11.4 Create activity routes
    - GET /api/activities
    - GET /api/activities/:id
    - POST /api/activities
    - PUT /api/activities/:id
    - DELETE /api/activities/:id
    - GET /api/activities/:id/venues
    - POST /api/activities/:id/venues
    - DELETE /api/activities/:id/venues/:venueId
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.12, 4.13, 4.14_

- [x] 12. Implement activity-participant assignments
  - [x] 12.1 Create assignment repository and service
    - Implement assignment creation and deletion
    - Validate activity, participant, and role exist
    - Prevent duplicate assignments
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 12.2 Write property tests for assignment operations
    - **Property 14: Assignment Reference Validation**
    - **Property 15: Duplicate Assignment Prevention**
    - **Property 16: Assignment Deletion Completeness**
    - **Validates: Requirements 5.5, 5.6, 5.7**

  - [x] 12.3 Create assignment routes
    - GET /api/activities/:id/participants
    - POST /api/activities/:id/participants
    - DELETE /api/activities/:id/participants/:participantId
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 13. Implement analytics engine
  - [x] 13.1 Create analytics service
    - Implement engagement metrics calculation
    - Implement growth metrics calculation
    - Implement geographic breakdown calculation
    - Support date range filtering
    - Support geographic area filtering
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ]* 13.2 Write property tests for analytics calculations
    - **Property 20: Unique Participant Counting**
    - **Property 21: Activity Type Counting**
    - **Property 22: Active Activity Counting**
    - **Property 23: Date Range Filtering**
    - **Property 24: Participant Count Per Type**
    - **Property 25: Role Distribution Calculation**
    - **Property 26: Time Period Grouping**
    - **Property 27: New Participant Counting Per Period**
    - **Property 28: New Activity Counting Per Period**
    - **Property 29: Chronological Ordering**
    - **Property 30: Percentage Change Calculation**
    - **Property 31: Cumulative Count Calculation**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8**

  - [x] 13.3 Create analytics routes
    - GET /api/analytics/engagement
    - GET /api/analytics/growth
    - GET /api/analytics/geographic
    - _Requirements: 6.1, 7.1_

- [x] 14. Implement offline synchronization
  - [x] 14.1 Create sync service
    - Process batch sync operations in transactions
    - Map local IDs to server IDs for new entities
    - Apply last-write-wins conflict resolution
    - Return success/failure for each operation
    - Support CREATE, UPDATE, DELETE operations
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 14.2 Write property tests for synchronization
    - **Property 36: Batch Sync Atomicity**
    - **Property 37: Local to Server ID Mapping**
    - **Property 38: Operation Status Reporting**
    - **Property 39: Last-Write-Wins Conflict Resolution**
    - **Property 40: Conflict Information Reporting**
    - **Property 41: Sync Operation Type Support**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

  - [x] 14.3 Create sync routes
    - POST /api/sync/batch
    - _Requirements: 9.1_

- [x] 15. Implement audit logging
  - [x] 15.1 Create audit logging middleware
    - Log authentication events
    - Log role changes
    - Log entity modifications
    - Record user ID, action type, entity type, entity ID, timestamp
    - Store additional details in JSON format
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 15.2 Write property tests for audit logging
    - **Property 53: Authentication Event Logging**
    - **Property 54: Role Change Logging**
    - **Property 55: Entity Modification Logging**
    - **Property 56: Audit Log Completeness**
    - **Property 57: Audit Log Detail Format**
    - **Property 58: Audit Log Access Restriction**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

- [x] 16. Implement error handling
  - [x] 16.1 Create error handling middleware
    - Format consistent error responses
    - Map error types to HTTP status codes
    - Log errors with stack traces
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 16.2 Write property tests for error handling
    - **Property 59: Consistent Error Format**
    - **Property 60: Validation Error Status Code**
    - **Property 61: Authentication Error Status Code**
    - **Property 62: Authorization Error Status Code**
    - **Property 63: Not Found Error Status Code**
    - **Property 64: Internal Error Status Code**
    - **Property 65: Error Logging with Stack Traces**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7**

- [x] 17. Implement input validation
  - [x] 17.1 Create validation middleware
    - Validate request bodies against Zod schemas
    - Validate query parameters and path parameters
    - Return detailed validation errors
    - Sanitize input to prevent injection attacks
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 17.2 Write property tests for input validation
    - **Property 5: Required Field Validation**
    - **Property 6: Email Format Validation**
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 18. Implement API documentation
  - [x] 18.1 Generate OpenAPI 3.0 specification
    - Document all endpoints with parameters and responses
    - Include example requests and responses
    - Document error responses
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 18.2 Set up Swagger UI
    - Serve interactive API documentation
    - _Requirements: 14.2_

- [x] 19. Create local database setup script
  - [x] 19.1 Create Finch detection and installation script
    - Detect if Finch is installed and running
    - Implement platform-specific Finch installation (brew, yum, apt, direct binary)
    - Provide clear error messages and installation progress
    - _Requirements: 16.2, 16.3, 16.4_

  - [x] 19.2 Implement PostgreSQL container management with Finch
    - Pull latest PostgreSQL container image using Finch
    - Create and start PostgreSQL container with exposed port
    - Configure environment variables (database name, username, password)
    - Set up persistent volume for data
    - _Requirements: 16.5, 16.6, 16.7_

  - [x] 19.3 Add script output and documentation
    - Output connection string for API configuration
    - Provide clear console output for each step
    - Add README documentation for script usage
    - Add npm script command for easy execution
    - Document why Finch is used instead of Docker Desktop
    - _Requirements: 16.8, 16.11_

  - [ ]* 19.4 Write unit tests for script functions
    - Test Finch detection logic
    - Test platform detection
    - Test connection string generation
    - _Requirements: 16.2, 16.3, 16.5, 16.6_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Align implementation with API contract
  - [x] 21.1 Add missing response wrapper fields
    - Add `isPredefined` field to ActivityType and Role responses
    - Add `version` field to all entity responses for optimistic locking
    - Add `isOngoing` field to Activity responses (computed from endDate)
    - Add `createdBy` field to Activity responses
    - _Requirements: API Contract alignment_

  - [x] 21.2 Implement pagination support
    - Add pagination to GET /api/activities endpoint
    - Add pagination to GET /api/participants endpoint
    - Add pagination to GET /api/venues endpoint
    - Add pagination to GET /api/geographic-areas endpoint
    - Return pagination metadata in responses
    - _Requirements: API Contract alignment_

  - [-] 21.3 Add missing assignment endpoints
    - Implement PUT /api/activities/:activityId/participants/:participantId
    - Add `notes` field support to assignment creation and updates
    - Add `joinedAt` field to assignment responses
    - _Requirements: API Contract alignment_

  - [ ] 21.4 Standardize DELETE response codes
    - Update all DELETE endpoints to return 204 No Content instead of 200 OK
    - Remove JSON body from DELETE responses
    - _Requirements: API Contract alignment_

  - [ ] 21.5 Add optimistic locking support
    - Add version field validation to PUT endpoints
    - Return 409 Conflict for version mismatches
    - Increment version on each update
    - _Requirements: API Contract alignment_

  - [ ] 21.6 Implement rate limiting
    - Add rate limiting middleware
    - Configure limits per endpoint type (auth, mutation, query)
    - Add rate limit headers to responses
    - _Requirements: API Contract alignment_

  - [ ] 21.7 Add API versioning support
    - Update base path from /api to /api/v1
    - Update all route registrations
    - Update OpenAPI specification
    - _Requirements: API Contract alignment_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
