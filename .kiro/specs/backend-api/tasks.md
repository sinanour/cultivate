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
    - Include seed data for predefined activity categories: "Study Circles", "Children's Classes", "Junior Youth Groups", "Devotional Gatherings"
    - Include seed data for predefined activity types with category mappings:
      - Category "Children's Classes": "Children's Class"
      - Category "Junior Youth Groups": "Junior Youth Group"
      - Category "Devotional Gatherings": "Devotional Gathering"
      - Category "Study Circles": "Ruhi Book 1", "Ruhi Book 2", "Ruhi Book 3", "Ruhi Book 3A", "Ruhi Book 3B", "Ruhi Book 3C", "Ruhi Book 3D", "Ruhi Book 4", "Ruhi Book 5", "Ruhi Book 5A", "Ruhi Book 5B", "Ruhi Book 6", "Ruhi Book 7", "Ruhi Book 8", "Ruhi Book 9", "Ruhi Book 10", "Ruhi Book 11", "Ruhi Book 12", "Ruhi Book 13", "Ruhi Book 14"
    - Include seed data for predefined roles: "Tutor", "Teacher", "Animator", "Host", "Participant"
    - _Requirements: 1.7, 1.16, 2.7, 8.6_

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

- [x] 4. Checkpoint - Verify authentication and authorization
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement activity category and type management
  - [x] 5.1 Create activity category repository
    - Implement CRUD operations using Prisma
    - Implement reference counting for deletion validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 5.2 Create activity category service
    - Implement business logic for CRUD operations
    - Validate name uniqueness
    - Prevent deletion if activity types reference the category
    - _Requirements: 1.5, 1.6_

  - [ ]* 5.3 Write property tests for activity category operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 4: Name Uniqueness Enforcement**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

  - [x] 5.4 Create activity category routes
    - GET /api/v1/activity-categories
    - POST /api/v1/activity-categories
    - PUT /api/v1/activity-categories/:id
    - DELETE /api/v1/activity-categories/:id
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.5 Create activity type repository
    - Implement CRUD operations using Prisma
    - Implement reference counting for deletion validation
    - Include activity category relation in queries
    - _Requirements: 1.8, 1.9, 1.10, 1.11, 1.15, 1.17_

  - [x] 5.6 Create activity type service
    - Implement business logic for CRUD operations
    - Validate name uniqueness
    - Validate activity category exists
    - Prevent deletion if activities reference the type
    - _Requirements: 1.12, 1.13, 1.14, 1.15_

  - [ ]* 5.7 Write property tests for activity type operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 4: Name Uniqueness Enforcement**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 1.9, 1.10, 1.11, 1.12, 1.15**

  - [x] 5.8 Create activity type routes
    - GET /api/v1/activity-types
    - POST /api/v1/activity-types
    - PUT /api/v1/activity-types/:id
    - DELETE /api/v1/activity-types/:id
    - _Requirements: 1.8, 1.9, 1.10, 1.11_

  - [x] 5.9 Create Zod validation schemas
    - ActivityCategoryCreateSchema
    - ActivityCategoryUpdateSchema
    - ActivityTypeCreateSchema (with activityCategoryId)
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

- [x] 6A. Implement user management (admin only)
  - [x] 6A.1 Update user repository
    - Add findAll() method to list all users
    - Add update() method for flexible user updates
    - _Requirements: 11A.1, 11A.11_

  - [x] 6A.2 Create user service
    - Implement getAllUsers() - returns users without password hashes
    - Implement createUser() - validates email, password (min 8 chars), role; hashes password with bcrypt
    - Implement updateUser() - allows updating email, password, role; validates email uniqueness; hashes new passwords
    - Validate email uniqueness on create and update
    - Exclude password hashes from all responses
    - _Requirements: 11A.1, 11A.2, 11A.3, 11A.6, 11A.7, 11A.8, 11A.9, 11A.10, 11A.11, 11A.12, 11A.13, 11A.14, 11A.15, 11A.16_

  - [x] 6A.3 Create user routes
    - GET /api/v1/users (admin only)
    - POST /api/v1/users (admin only)
    - PUT /api/v1/users/:id (admin only)
    - Restrict all endpoints to ADMINISTRATOR role using requireAdmin() middleware
    - Return 403 Forbidden for non-administrators
    - _Requirements: 11A.1, 11A.2, 11A.3, 11A.4, 11A.5_

  - [x] 6A.4 Add validation schemas
    - Create UserCreateSchema (email, password min 8 chars, role enum)
    - Create UserUpdateSchema (optional email, password, role)
    - _Requirements: 11A.6, 11A.7, 11A.8, 11A.10_

  - [x] 6A.5 Register user routes in main app
    - Import UserService and UserRoutes
    - Instantiate userService with userRepository
    - Instantiate userRoutes with userService, authMiddleware, authorizationMiddleware
    - Register routes at /api/v1/users with smartRateLimiter
    - _Requirements: 11A.1, 11A.2, 11A.3_

  - [ ]* 6A.6 Write property tests for user management
    - **Property 68a: User List Retrieval**
    - **Property 68b: User Creation Validation**
    - **Property 68c: User Email Uniqueness**
    - **Property 68d: User Update Flexibility**
    - **Property 68e: User Management Administrator Restriction**
    - **Property 68f: Password Hash Exclusion**
    - **Validates: Requirements 11A.1, 11A.2, 11A.4, 11A.5, 11A.6, 11A.7, 11A.8, 11A.9, 11A.10, 11A.11, 11A.12, 11A.13, 11A.14, 11A.15, 11A.16**

- [x] 7. Implement participant management
  - [x] 7.1 Create participant repository
    - Implement CRUD operations
    - Implement search by name or email
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.2 Create participant service
    - Validate required fields (name, email)
    - Validate email format and uniqueness
    - Handle optional fields (phone, notes, home venue)
    - Implement simplified temporal tracking for home venue changes
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ]* 7.3 Write property tests for participant operations
    - **Property 5: Required Field Validation**
    - **Property 6: Email Format Validation**
    - **Property 7: Email Uniqueness Enforcement**
    - **Property 8: Optional Field Acceptance**
    - **Property 17: Participant Search Accuracy**
    - **Property 18: Participant Retrieval by ID**
    - **Property 18A: Participant Activities Retrieval**
    - **Validates: Requirements 3.6, 3.7, 3.8, 3.9, 3.18**

  - [x] 7.4 Create participant routes
    - GET /api/participants
    - GET /api/participants/:id
    - GET /api/participants/:id/activities
    - GET /api/participants/search
    - POST /api/participants
    - PUT /api/participants/:id
    - DELETE /api/participants/:id
    - GET /api/participants/:id/address-history
    - POST /api/participants/:id/address-history
    - PUT /api/participants/:id/address-history/:historyId
    - DELETE /api/participants/:id/address-history/:historyId
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.12, 3.13, 3.14, 3.15, 3.18_

  - [x] 7.5 Create participant address history repository
    - Implement CRUD operations for address history
    - Implement ordering by effectiveFrom descending
    - Implement duplicate effectiveFrom prevention
    - _Requirements: 3.12, 3.13, 3.14, 3.15, 3.16, 3.17_

  - [ ]* 7.6 Write property tests for address history operations
    - **Property 89: Address History Creation on Venue Update**
    - **Property 90: Address History Retrieval**
    - **Property 91: Current Address Identification**
    - **Property 92: Address History Duplicate Prevention**
    - **Validates: Requirements 3.11, 3.12, 3.17**

- [x] 8. Implement venue management
  - [x] 8.1 Create venue repository
    - Implement CRUD operations
    - Implement search by name or address
    - Implement queries for associated activities
    - Implement query for current residents (participants whose most recent address history is at venue)
    - _Requirements: 5A.1, 5A.2, 5A.3, 5A.4, 5A.5, 5A.6, 5A.12, 5A.13, 5A.14_

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
    - **Property 95: Venue Participants Retrieval** (current residents only)
    - **Validates: Requirements 5A.3, 5A.4, 5A.5, 5A.10, 5A.11, 5A.13, 5A.14**

  - [x] 8.4 Create venue routes
    - GET /api/venues
    - GET /api/venues/:id
    - GET /api/venues/search
    - POST /api/venues
    - PUT /api/venues/:id
    - DELETE /api/venues/:id
    - GET /api/venues/:id/activities
    - GET /api/venues/:id/participants (returns current residents only)
    - _Requirements: 5A.1, 5A.2, 5A.3, 5A.4, 5A.5, 5A.6, 5A.12, 5A.13, 5A.14_

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

- [x] 10. Checkpoint - Verify core entity management
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
    - Manage venue associations with simplified temporal tracking
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

  - [ ] 11.5 Create activity venue history repository
    - Implement CRUD operations for venue history
    - Implement ordering by effectiveFrom descending
    - Implement duplicate effectiveFrom prevention
    - _Requirements: 4.12, 4.13, 4.14, 4.15, 4.16_

  - [ ]* 11.6 Write property tests for venue history operations
    - **Property 93: Activity Venue Association Creation**
    - **Property 94: Activity Venue History Retrieval**
    - **Property 95: Current Venue Identification**
    - **Property 96: Activity Venue Duplicate Prevention**
    - **Validates: Requirements 4.11, 4.12, 4.13, 4.15, 4.16**

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
    - Implement comprehensive engagement metrics calculation with temporal analysis
    - Calculate activities at start and end of date range
    - Calculate activities started, completed, and cancelled within date range
    - Calculate participants at start and end of date range
    - Provide aggregate counts and breakdowns by activity category and activity type
    - Support multi-dimensional grouping (activity category, activity type, venue, geographic area, date with weekly/monthly/quarterly/yearly granularity)
    - Support flexible filtering (point filters for activity category, activity type, venue, geographic area; range filter for dates)
    - Apply multiple filters using AND logic
    - Calculate role distribution within filtered and grouped results
    - Implement growth metrics calculation
    - Implement geographic breakdown calculation
    - Support date range filtering
    - Support geographic area filtering
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 6.16, 6.17, 6.18, 6.19, 6.20, 6.21, 6.22, 6.23, 6.24, 6.25, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 13.2 Write property tests for analytics calculations
    - **Property 20: Activities at Start of Date Range Counting**
    - **Property 21: Activities at End of Date Range Counting**
    - **Property 22: Activities Started Within Range Counting**
    - **Property 23: Activities Completed Within Range Counting**
    - **Property 24: Activities Cancelled Within Range Counting**
    - **Property 25: Participants at Start of Date Range Counting**
    - **Property 26: Participants at End of Date Range Counting**
    - **Property 27: Aggregate Activity Counts**
    - **Property 27A: Activity Counts by Category Breakdown**
    - **Property 28: Activity Counts by Type Breakdown**
    - **Property 29: Aggregate Participant Counts**
    - **Property 29A: Participant Counts by Category Breakdown**
    - **Property 30: Participant Counts by Type Breakdown**
    - **Property 31: Multi-Dimensional Grouping Support**
    - **Property 31A: Activity Category Point Filter**
    - **Property 32: Activity Type Point Filter**
    - **Property 33: Venue Point Filter**
    - **Property 34: Geographic Area Point Filter**
    - **Property 35: Date Range Filter**
    - **Property 36: Multiple Filter AND Logic**
    - **Property 37: All-Time Metrics Without Date Range**
    - **Property 38: Role Distribution Calculation**
    - **Property 39: Date Grouping Granularity**
    - **Property 40: Time Period Grouping**
    - **Property 41: New Activity Counting Per Period**
    - **Property 42: Chronological Ordering**
    - **Property 43: Percentage Change Calculation for Activities**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 6.16, 6.17, 6.18, 6.19, 6.20, 6.21, 6.22, 6.23, 6.24, 6.25, 7.2, 7.4, 7.5, 7.6**

  - [x] 13.3 Create analytics routes
    - GET /api/analytics/engagement
    - GET /api/analytics/growth
    - GET /api/analytics/geographic
    - _Requirements: 6.1, 7.1_

  - [x] 13.4 Add activity lifecycle events endpoint
    - Implement getActivityLifecycleEvents method in AnalyticsService
    - Handle optional startDate and endDate parameters
    - When both dates provided: count activities started/completed within range
    - When only startDate: count activities started/completed on or after startDate
    - When only endDate: count activities started/completed on or before endDate
    - When no dates: count all activities started/completed (all-time)
    - Exclude cancelled activities from both counts
    - Group by activity category or type based on groupBy parameter
    - Apply optional filters (geographicAreaIds, activityTypeIds, venueIds) using AND logic
    - Sort results alphabetically by groupName
    - Create ActivityLifecycleQuerySchema validation schema with optional dates
    - Add GET /api/analytics/activity-lifecycle route with validation
    - Return array of {groupName, started, completed} objects
    - _Requirements: 6A.1, 6A.2, 6A.3, 6A.4, 6A.5, 6A.6, 6A.7, 6A.8, 6A.9, 6A.10, 6A.11, 6A.12, 6A.13, 6A.14, 6A.15, 6A.16, 6A.17, 6A.18, 6A.19, 6A.20, 6A.21, 6A.22, 6A.23_

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

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Align implementation with API contract
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

  - [x] 21.3 Add missing assignment endpoints
    - Implement PUT /api/activities/:activityId/participants/:participantId
    - Add `notes` field support to assignment creation and updates
    - Add `joinedAt` field to assignment responses
    - _Requirements: API Contract alignment_

  - [x] 21.4 Standardize DELETE response codes
    - Update all DELETE endpoints to return 204 No Content instead of 200 OK
    - Remove JSON body from DELETE responses
    - _Requirements: API Contract alignment_

  - [x] 21.5 Add optimistic locking support
    - Add version field validation to PUT endpoints
    - Return 409 Conflict for version mismatches
    - Increment version on each update
    - _Requirements: API Contract alignment_

  - [x] 21.6 Implement rate limiting
    - Add rate limiting middleware
    - Configure limits per endpoint type (auth, mutation, query)
    - Add rate limit headers to responses
    - _Requirements: API Contract alignment_

  - [x] 21.7 Add API versioning support
    - Update base path from /api to /api/v1
    - Update all route registrations
    - Update OpenAPI specification
    - _Requirements: API Contract alignment_

- [x] 22. Implement high-cardinality text-based filtering
  - [x] 22.1 Add search parameter support to participant endpoints
    - Update ParticipantService.getParticipants to accept search parameter
    - Implement case-insensitive partial matching on name and email fields
    - Combine search filter with geographic area filter using AND logic
    - Ensure pagination works with filtered results
    - _Requirements: 21.2, 21.5, 21.7, 21.8, 21.9_

  - [x] 22.2 Add search parameter support to venue endpoints
    - Update VenueService.getVenues to accept search parameter
    - Implement case-insensitive partial matching on name and address fields
    - Combine search filter with geographic area filter using AND logic
    - Ensure pagination works with filtered results
    - _Requirements: 21.1, 21.4, 21.7, 21.8, 21.9_

  - [x] 22.3 Add search parameter support to geographic area endpoints
    - Update GeographicAreaService.getGeographicAreas to accept search parameter
    - Implement case-insensitive partial matching on name field
    - Combine search filter with geographic area filter using AND logic
    - Ensure pagination works with filtered results
    - _Requirements: 21.3, 21.6, 21.7, 21.8, 21.9_

  - [x] 22.4 Create database indexes for text search optimization
    - Add GIN trigram indexes on participants.name and participants.email
    - Add GIN trigram indexes on venues.name and venues.address
    - Add GIN trigram index on geographic_areas.name
    - Create Prisma migration for index creation
    - Enable pg_trgm extension in PostgreSQL
    - _Requirements: 21.10_

  - [x] 22.5 Update route handlers to accept search query parameter
    - Update GET /api/v1/participants route to accept ?search parameter
    - Update GET /api/v1/venues route to accept ?search parameter
    - Update GET /api/v1/geographic-areas route to accept ?search parameter
    - Validate search parameter (optional string, max 200 chars)
    - Pass search parameter to service layer
    - _Requirements: 21.1, 21.2, 21.3_

  - [x] 22.6 Update OpenAPI documentation
    - Document search query parameter for participants endpoint
    - Document search query parameter for venues endpoint
    - Document search query parameter for geographic areas endpoint
    - Include examples showing combined search and geographic filtering
    - _Requirements: 21.1, 21.2, 21.3, 21.7_

  - [ ]* 22.7 Write property tests for text-based filtering
    - **Property 118: Venue Text Search Filtering**
    - **Property 119: Participant Text Search Filtering**
    - **Property 120: Geographic Area Text Search Filtering**
    - **Property 121: Combined Search and Geographic Filtering**
    - **Property 122: Filtered Result Pagination**
    - **Property 123: Search Query Optimization**
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10**

## Global Geographic Area Filter Implementation Notes

**Query Parameter Support:**
All list endpoints (participants, activities, venues, geographic areas) now support an optional `geographicAreaId` query parameter for filtering results to a specific geographic area and its descendants.

**Implementation Pattern for Services:**

```typescript
async getEntities(page?: number, limit?: number, geographicAreaId?: string) {
  let areaIds: string[] | undefined;
  
  if (geographicAreaId) {
    // Get all descendant IDs including the area itself
    const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
    areaIds = [geographicAreaId, ...descendantIds];
  }
  
  // Apply filter to query based on entity type
  const where = this.buildGeographicFilter(areaIds);
  
  return this.repository.findMany({ where, page, limit });
}
```

**Entity-Specific Filtering Logic:**

**Participants:** Filter by current home venue's geographic area
```typescript
const where = areaIds ? {
  addressHistory: {
    some: {
      venue: {
        geographicAreaId: { in: areaIds }
      },
      // Most recent address (no newer record exists)
      NOT: {
        participant: {
          addressHistory: {
            some: {
              effectiveFrom: { gt: /* this record's effectiveFrom */ }
            }
          }
        }
      }
    }
  }
} : {};
```

**Activities:** Filter by current venue's geographic area
```typescript
const where = areaIds ? {
  activityVenueHistory: {
    some: {
      venue: {
        geographicAreaId: { in: areaIds }
      },
      // Most recent venue (no newer record exists)
      NOT: {
        activity: {
          activityVenueHistory: {
            some: {
              effectiveFrom: { gt: /* this record's effectiveFrom */ }
            }
          }
        }
      }
    }
  }
} : {};
```

**Venues:** Direct geographic area filtering
```typescript
const where = areaIds ? {
  geographicAreaId: { in: areaIds }
} : {};
```

**Geographic Areas:** Special handling for hierarchy context
```typescript
if (geographicAreaId) {
  const descendantIds = await this.findDescendants(geographicAreaId);
  const ancestorIds = await this.findAncestors(geographicAreaId);
  const areaIds = [geographicAreaId, ...descendantIds, ...ancestorIds];
  
  const where = { id: { in: areaIds } };
}
```

**Key Points:**
- Filter is optional - endpoints work without it (return all results)
- Filtering is recursive - includes all descendant areas
- Uses existing `findDescendants()` method from GeographicAreaRepository
- Participants and Activities filter by "current" venue (most recent history record)
- Geographic Areas include ancestors to maintain tree view context
- No database schema changes required
- Backward compatible with existing clients

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
