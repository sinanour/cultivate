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
      - Category "Study Circles": "Ruhi Book 01", "Ruhi Book 02", "Ruhi Book 03", "Ruhi Book 03A", "Ruhi Book 03B", "Ruhi Book 03C", "Ruhi Book 03D", "Ruhi Book 04", "Ruhi Book 05", "Ruhi Book 05A", "Ruhi Book 05B", "Ruhi Book 06", "Ruhi Book 07", "Ruhi Book 08", "Ruhi Book 09", "Ruhi Book 10", "Ruhi Book 11", "Ruhi Book 12", "Ruhi Book 13", "Ruhi Book 14"
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

- [x] 6B. Implement population management (admin only)
  - [x] 6B.1 Create population repository
    - Implement CRUD operations using Prisma
    - Implement reference counting for deletion validation
    - _Requirements: 2A.1, 2A.2, 2A.3, 2A.4, 2A.6_

  - [x] 6B.2 Create population service
    - Implement business logic for CRUD operations
    - Validate name uniqueness
    - Prevent deletion if participants reference the population
    - Restrict create/update/delete to ADMINISTRATOR role
    - Allow all roles to view populations
    - _Requirements: 2A.5, 2A.6, 2A.14, 2A.15_

  - [ ]* 6B.3 Write property tests for population operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 4: Name Uniqueness Enforcement**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Validates: Requirements 2A.2, 2A.3, 2A.4, 2A.5, 2A.6**

  - [x] 6B.4 Create population routes
    - GET /api/v1/populations (all roles)
    - POST /api/v1/populations (admin only)
    - PUT /api/v1/populations/:id (admin only)
    - DELETE /api/v1/populations/:id (admin only)
    - _Requirements: 2A.1, 2A.2, 2A.3, 2A.4, 2A.14, 2A.15_

  - [x] 6B.5 Create participant-population association repository
    - Implement CRUD operations for associations
    - Implement duplicate prevention (same participant and population)
    - _Requirements: 2A.7, 2A.8, 2A.9, 2A.10, 2A.12_

  - [x] 6B.6 Create participant-population association routes
    - GET /api/v1/participants/:id/populations
    - POST /api/v1/participants/:id/populations
    - DELETE /api/v1/participants/:id/populations/:populationId
    - Validate participant and population exist
    - Prevent duplicate associations
    - _Requirements: 2A.8, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13_

  - [x] 6B.7 Create Zod validation schemas
    - PopulationCreateSchema
    - PopulationUpdateSchema
    - ParticipantPopulationCreateSchema
    - _Requirements: 15.1, 15.4_

  - [ ]* 6B.8 Write property tests for participant-population associations
    - **Property 164: Participant Population Association Creation**
    - **Property 165: Duplicate Association Prevention**
    - **Property 166: Association Deletion Completeness**
    - **Property 167: Multiple Population Membership Support**
    - **Validates: Requirements 2A.7, 2A.8, 2A.9, 2A.10, 2A.11, 2A.12, 2A.13**

- [ ] 6A. Implement unified user management with embedded authorization (admin only)
  - [ ] 6A.1 Create Prisma migration for displayName field
    - Add displayName String field to User model (optional, nullable)
    - Update seed script to include displayName for root administrator (optional)
    - _Requirements: 11A.6a, 11A.17_

  - [ ] 6A.2 Update user repository
    - Add findAll() method to list all users
    - Add findById(id) method to get single user
    - Add update() method for flexible user updates
    - Include displayName in all queries
    - _Requirements: 11A.1, 11A.13, 11A.17_

  - [x] 6A.3 Update user service
    - Update getAllUsers() to return users with displayName field (nullable, without password hashes)
    - Add getUser(id) method to fetch single user
    - Update createUser() to accept optional displayName, validate email, password (min 8 chars), role; hash password with bcrypt
    - Add support for optional authorizationRules array in createUser()
    - When authorizationRules provided, create user and all rules in single atomic transaction using Prisma transaction
    - Update updateUser() to allow updating displayName (nullable), email, password, role; validate email uniqueness; hash new passwords
    - Validate email uniqueness on create and update
    - Exclude password hashes from all responses
    - _Requirements: 11A.1, 11A.2, 11A.3, 11A.6, 11A.7, 11A.8, 11A.9, 11A.10, 11A.11, 11A.12, 11A.13, 11A.14, 11A.15, 11A.16, 11A.17, 11A.18_

  - [x] 6A.4 Update user routes
    - Update GET /api/v1/users to return displayName field (admin only)
    - Add GET /api/v1/users/:id to fetch single user (admin only)
    - Update POST /api/v1/users to accept displayName and optional authorizationRules array (admin only)
    - Update PUT /api/v1/users/:id to accept displayName (admin only)
    - Add DELETE /api/v1/users/:id to delete user (admin only)
    - Restrict all endpoints to ADMINISTRATOR role using requireAdmin() middleware
    - Return 403 Forbidden for non-administrators
    - _Requirements: 11A.1, 11A.2, 11A.3, 11A.3a, 11A.4, 11A.5, 11A.6, 11A.13, 11A.17_

  - [ ] 6A.4a Implement user deletion service method
    - Add deleteUser(id) method to UserService
    - Validate user exists before deletion
    - Check if user is the last administrator (count administrators)
    - Prevent deletion if user is the last administrator (throw error)
    - Delete all associated geographic authorization rules in transaction
    - Delete user record
    - Return success
    - _Requirements: 11A.3a, 11A.3b, 11A.3c_

  - [ ] 6A.5 Update validation schemas
    - Update UserCreateSchema to accept optional displayName (min 1 char if provided, max 200 chars)
    - Add optional authorizationRules array to UserCreateSchema with geographicAreaId and ruleType fields
    - Update UserUpdateSchema to include optional nullable displayName
    - _Requirements: 11A.6a, 11A.11, 11A.13_

  - [ ] 6A.6 Update OpenAPI documentation
    - Document displayName field in User schema
    - Document authorizationRules array in POST /users request body
    - Document GET /users/:id endpoint
    - Update examples to include displayName
    - _Requirements: 11A.6, 11A.11, 11A.13, 11A.17_

  - [ ]* 6A.7 Write property tests for unified user management
    - **Property 68a: User List Retrieval** (with displayName)
    - **Property 68b: User Creation Validation** (with displayName)
    - **Property 68b_auth: User Creation with Authorization Rules**
    - **Property 68c: User Email Uniqueness**
    - **Property 68d: User Update Flexibility** (with displayName)
    - **Property 68e: User Management Administrator Restriction**
    - **Property 68f: Password Hash Exclusion**
    - **Property 68g: Display Name Optional Acceptance**
    - **Property 68h: User Deletion with Cascade**
    - **Property 68i: Last Administrator Deletion Prevention**
    - **Validates: Requirements 11A.1, 11A.2, 11A.3a, 11A.3b, 11A.3c, 11A.4, 11A.5, 11A.6, 11A.7, 11A.8, 11A.9, 11A.10, 11A.11, 11A.12, 11A.13, 11A.14, 11A.15, 11A.16, 11A.17, 11A.18**

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
    - Implement ordering by effectiveFrom descending (null values treated as oldest)
    - Implement duplicate effectiveFrom prevention (including null)
    - Validate at most one null effectiveFrom per participant
    - _Requirements: 3.12, 3.13, 3.14, 3.15, 3.17, 3.18, 3.19, 3.20_

  - [ ]* 7.6 Write property tests for address history operations
    - **Property 89: Address History Creation on Venue Update**
    - **Property 90: Address History Retrieval**
    - **Property 91: Current Address Identification**
    - **Property 92: Address History Duplicate Prevention**
    - **Property 92A: Address History Null EffectiveFrom Uniqueness**
    - **Property 92B: Address History Null EffectiveFrom Interpretation**
    - **Validates: Requirements 3.11, 3.12, 3.18, 3.19, 3.20**

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
    - Implement hierarchical queries (children, ancestors) with depth limiting support
    - Implement child count calculation for each geographic area
    - Implement statistics aggregation across hierarchy
    - _Requirements: 5B.1, 5B.2, 5B.3, 5B.4, 5B.5, 5B.9, 5B.10, 5B.22, 5B.23, 5B.24, 5B.25, 5B.26_

  - [x] 9.2 Create geographic area service
    - Validate required fields (name, area type)
    - Validate area type is one of: NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD
    - Validate parent geographic area exists
    - Prevent circular parent-child relationships
    - Prevent deletion if venues or child areas reference area
    - Calculate hierarchical statistics
    - Support depth-limited fetching for lazy loading (depth parameter)
    - Include childCount in all geographic area responses
    - _Requirements: 5B.2, 5B.3, 5B.4, 5B.5, 5B.6, 5B.7, 5B.8, 5B.9, 5B.10, 5B.16, 5B.17, 5B.18, 5B.19, 5B.20, 5B.21, 5B.26_

  - [ ]* 9.3 Write property tests for geographic area operations
    - **Property 1: Resource Creation Persistence**
    - **Property 2: Resource Update Persistence**
    - **Property 3: Resource Deletion Removes Resource**
    - **Property 13: Referenced Entity Deletion Prevention**
    - **Property 116D: Depth-Limited Fetching**
    - **Property 116E: Child Count Accuracy**
    - **Validates: Requirements 5B.3, 5B.4, 5B.5, 5B.10, 5B.11, 5B.13, 5B.14, 5B.15, 5B.21, 5B.22, 5B.23**

  - [x] 9.4 Create geographic area routes
    - GET /api/geographic-areas (with optional depth parameter)
    - GET /api/geographic-areas/:id (returns childCount)
    - POST /api/geographic-areas
    - PUT /api/geographic-areas/:id
    - DELETE /api/geographic-areas/:id
    - GET /api/geographic-areas/:id/children (returns childCount for each child)
    - GET /api/geographic-areas/:id/ancestors
    - GET /api/geographic-areas/:id/venues
    - GET /api/geographic-areas/:id/statistics
    - _Requirements: 5B.1, 5B.2, 5B.9, 5B.13, 5B.14, 5B.15, 5B.22, 5B.23, 5B.24, 5B.25, 5B.26_

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

  - [x] 11.5 Create activity venue history repository
    - Implement CRUD operations for venue history
    - Implement ordering by effectiveFrom descending (null values treated as using activity startDate)
    - Implement duplicate effectiveFrom prevention (including null)
    - Validate at most one null effectiveFrom per activity
    - _Requirements: 4.12, 4.13, 4.14, 4.15, 4.17, 4.18, 4.19_

  - [ ]* 11.6 Write property tests for venue history operations
    - **Property 93: Activity Venue Association Creation**
    - **Property 94: Activity Venue History Retrieval**
    - **Property 95: Current Venue Identification**
    - **Property 96: Activity Venue Duplicate Prevention**
    - **Property 96A: Activity Venue Null EffectiveFrom Uniqueness**
    - **Property 96B: Activity Venue Null EffectiveFrom Interpretation**
    - **Validates: Requirements 4.11, 4.12, 4.13, 4.17, 4.18, 4.19**

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
    - Calculate total participation (non-unique participant-activity associations) at start and end of date range
    - Provide aggregate counts and breakdowns by activity category and activity type
    - Support multi-dimensional grouping (activity category, activity type, venue, geographic area, population, date with weekly/monthly/quarterly/yearly granularity)
    - Support flexible filtering (point filters for activity category, activity type, venue, geographic area, population; range filter for dates)
    - Apply multiple filters using AND logic
    - Calculate role distribution within filtered and grouped results
    - Implement growth metrics calculation with unique participant counts, unique activity counts, and total participation counts per period (snapshots, not cumulative)
    - Support multi-dimensional filtering for growth metrics with OR logic within dimensions and AND logic across dimensions:
      - activityCategoryIds array filter (OR logic: category IN (A, B))
      - activityTypeIds array filter (OR logic: type IN (A, B))
      - geographicAreaIds array filter (OR logic: area IN (A, B) including descendants)
      - venueIds array filter (OR logic: venue IN (A, B))
      - populationIds array filter (OR logic: participant in at least one population)
      - Multiple dimensions combined with AND logic (e.g., category AND venue AND population)
    - Support optional grouping by activity type or category for growth metrics
    - Use Zod preprocess to normalize array query parameters (single value, multiple parameters, comma-separated)
    - Implement geographic breakdown calculation:
      - Accept optional parentGeographicAreaId parameter
      - When parentGeographicAreaId provided: return metrics for immediate children of that parent
      - When parentGeographicAreaId not provided: return metrics for all top-level areas (null parent)
      - For each area: aggregate metrics from the area and all its descendants (recursive)
      - Return geographicAreaId, geographicAreaName, areaType, activityCount, participantCount, participationCount
    - Support date range filtering
    - Support geographic area filtering
    - Support population filtering (include only participants in specified populations, include only activities with at least one participant in specified populations)
    - When population filter is active, calculate participant counts based only on participants in specified populations
    - When population filter is active, calculate participation counts based only on participant-activity associations where participant is in specified populations
    - For activities with mixed participants (some in population, some not), count only the participants who match the population filter
    - Handle null effectiveFrom dates: treat as activity startDate for activities, as oldest date for participants
    - Correctly identify current venue/address when effectiveFrom is null
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.8a, 6.8b, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.14a, 6.14b, 6.14c, 6.15, 6.16, 6.17, 6.18, 6.19, 6.19a, 6.19b, 6.19c, 6.19d, 6.19e, 6.19f, 6.20, 6.21, 6.22, 6.23, 6.24, 6.25, 6.26, 6.27, 6.28, 6.29, 6B.1, 6B.2, 6B.3, 6B.4, 6B.5, 6B.6, 6B.7, 6B.8, 6B.9, 6B.10, 6B.11, 6B.12, 6B.13, 6B.14, 7.1, 7.2, 7.3, 7.4, 7.5, 7.5a, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27, 7.28, 7.29, 7.30, 7.31, 7.32, 7.33_

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
    - **Property 30A: Participation at Start of Date Range Counting**
    - **Property 30B: Participation at End of Date Range Counting**
    - **Property 30C: Aggregate Participation Counts**
    - **Property 30D: Participation Counts by Category Breakdown**
    - **Property 30E: Participation Counts by Type Breakdown**
    - **Property 30F: Population Filter Participant Count Scoping**
    - **Property 30G: Population Filter Participation Count Scoping**
    - **Property 30H: Population Filter Partial Activity Participant Counting**
    - **Property 31: Multi-Dimensional Grouping Support**
    - **Property 31A: Engagement Metrics Activity Category Filter**
    - **Property 31B: Engagement Metrics Activity Type Filter**
    - **Property 31C: Engagement Metrics Geographic Area Filter**
    - **Property 31D: Engagement Metrics Venue Filter**
    - **Property 31E: Engagement Metrics Population Filter Participant Inclusion**
    - **Property 31F: Engagement Metrics Population Filter Activity Inclusion**
    - **Property 31G: Engagement Metrics Population Filter Participant Count Scoping**
    - **Property 31H: Engagement Metrics Population Filter Participation Count Scoping**
    - **Property 32: Engagement Metrics Multi-Dimensional Filter AND Logic**
    - **Property 33: Engagement Metrics Within-Dimension OR Logic**
    - **Property 34: Date Range Filter**
    - **Property 35: All-Time Metrics Without Date Range**
    - **Property 36: Role Distribution Calculation**
    - **Property 37: Engagement Metrics Array Parameter Normalization**
    - **Property 38: Date Grouping Granularity**
    - **Property 39: Time Period Grouping**
    - **Property 40: Unique Participant Counting Per Period**
    - **Property 41: Unique Activity Counting Per Period**
    - **Property 42A: Total Participation Counting Per Period**
    - **Property 43: Chronological Ordering**
    - **Property 44: Percentage Change Calculation**
    - **Property 45: Optional Grouping by Activity Type**
    - **Property 46: Optional Grouping by Activity Category**
    - **Property 47: Aggregate Growth Without Grouping**
    - **Property 47_participation: Time-Series Participation Data Inclusion**
    - **Property 47G: Growth Metrics Activity Category Filter**
    - **Property 47H: Growth Metrics Activity Type Filter**
    - **Property 47I: Growth Metrics Geographic Area Filter**
    - **Property 47J: Growth Metrics Venue Filter**
    - **Property 47K: Growth Metrics Population Filter Participant Inclusion**
    - **Property 47L: Growth Metrics Population Filter Activity Inclusion**
    - **Property 47M: Growth Metrics Population Filter Participant Count Scoping**
    - **Property 47N: Growth Metrics Population Filter Participation Count Scoping**
    - **Property 47O: Growth Metrics Population Filter Partial Activity Participant Counting**
    - **Property 47P: Growth Metrics Multi-Dimensional Filter AND Logic**
    - **Property 47Q: Growth Metrics Within-Dimension OR Logic**
    - **Property 47R: Growth Metrics Array Parameter Normalization**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.8a, 6.8b, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.14a, 6.14b, 6.14c, 6.15, 6.16, 6.17, 6.18, 6.19, 6.20, 6.21, 6.22, 6.23, 6.24, 6.25, 6.26, 6.27, 6.28, 6.29, 6.30, 6.31, 6.32, 6.33, 6.34, 6.35, 6.36, 6.37, 6.38, 6.39, 6.40, 6.41, 6.42, 6.43, 7.2, 7.4, 7.5, 7.5a, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27, 7.28, 7.29, 7.30, 7.31, 7.32, 7.33**

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
    - Apply optional filters (geographicAreaIds, activityTypeIds, venueIds, populationIds) using AND logic
    - When populationIds filter provided: include only activities with at least one participant in specified populations
    - Sort results alphabetically by groupName
    - Create ActivityLifecycleQuerySchema validation schema with optional dates and populationIds
    - Add GET /api/analytics/activity-lifecycle route with validation
    - Return array of {groupName, started, completed} objects
    - _Requirements: 6A.1, 6A.2, 6A.3, 6A.4, 6A.5, 6A.6, 6A.7, 6A.8, 6A.9, 6A.10, 6A.11, 6A.12, 6A.13, 6A.14, 6A.15, 6A.16, 6A.17, 6A.17a, 6A.17b, 6A.18, 6A.19, 6A.20, 6A.21, 6A.22, 6A.23_

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

- [ ] 23. Enhance Participant entity with additional optional fields
  - [ ] 23.1 Create Prisma migration for new participant fields
    - Make email field optional/nullable in Participant model
    - Add dateOfBirth field (DateTime, optional)
    - Add dateOfRegistration field (DateTime, optional)
    - Add nickname field (String, optional, max 100 chars)
    - Update unique constraint on email to handle nulls properly
    - _Requirements: 3.8, 3.11, 3.12_

  - [ ] 23.2 Update validation schemas
    - Update ParticipantCreateSchema to make email optional
    - Add dateOfBirth validation (optional, must be in past)
    - Add dateOfRegistration validation (optional, valid date)
    - Add nickname validation (optional, max 100 chars)
    - Update ParticipantUpdateSchema with same validations
    - _Requirements: 3.8, 3.9, 3.10, 3.11, 3.12_

  - [ ] 23.3 Update ParticipantService
    - Update email validation to only validate format when email is provided
    - Update email uniqueness check to only validate when email is provided
    - Add dateOfBirth validation (must be in past if provided)
    - Add dateOfRegistration validation (must be valid date if provided)
    - Update service methods to handle new optional fields
    - _Requirements: 3.9, 3.10, 3.11, 3.12_

  - [ ] 23.4 Update API responses
    - Include new fields in participant response objects
    - Update OpenAPI specification with new fields
    - Ensure backward compatibility with existing clients
    - _Requirements: 3.8, 3.11, 3.12_

  - [ ]* 23.5 Write property tests for new participant fields
    - **Property 8A: Date of Birth Validation**
    - **Property 8B: Date of Registration Validation**
    - **Property 124: Optional Email Acceptance**
    - **Property 125: Email Validation When Provided**
    - **Property 126: Email Uniqueness When Provided**
    - **Validates: Requirements 3.8, 3.9, 3.10, 3.11, 3.12**

  - [ ] 23.6 Update seed data and test fixtures
    - Update any seed data to work with optional email
    - Update test fixtures to include new fields
    - Ensure existing tests still pass
    - _Requirements: 3.8, 3.11, 3.12_

- [ ] 24. Checkpoint - Verify participant enhancements
  - Ensure all tests pass, ask the user if questions arise.

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
      // Handles null effectiveFrom (oldest address) by checking if any record has a non-null date
      NOT: {
        participant: {
          addressHistory: {
            some: {
              OR: [
                // Another record with a later date
                { effectiveFrom: { gt: /* this record's effectiveFrom */ } },
                // This record is null but another non-null record exists
                {
                  AND: [
                    { effectiveFrom: { not: null } },
                    /* this record's effectiveFrom is null */
                  ]
                }
              ]
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
      // Handles null effectiveFrom (uses activity startDate) by checking if any record has a non-null date
      NOT: {
        activity: {
          activityVenueHistory: {
            some: {
              OR: [
                // Another record with a later date
                { effectiveFrom: { gt: /* this record's effectiveFrom */ } },
                // This record is null but another non-null record exists
                {
                  AND: [
                    { effectiveFrom: { not: null } },
                    /* this record's effectiveFrom is null */
                  ]
                }
              ]
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


- [x] 25. Implement CSV Import and Export
  - [x] 25.1 Install CSV parsing and generation libraries
    - Install csv-parse for CSV parsing
    - Install csv-stringify for CSV generation
    - Install multer for file upload handling
    - Configure multer for memory storage with 10MB limit
    - _Requirements: 22.25, 22.27_

  - [x] 25.2 Create CSV export service methods
    - Implement exportParticipants(geographicAreaId?) in ParticipantService
    - Implement exportVenues(geographicAreaId?) in VenueService
    - Implement exportActivities(geographicAreaId?) in ActivityService
    - Implement exportGeographicAreas() in GeographicAreaService
    - Apply geographic area filter when provided
    - Transform entity data to CSV format with proper column mapping
    - Use csv-stringify to generate CSV with headers
    - Return empty CSV with header row when no records exist
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.31, 22.32_

  - [x] 25.3 Create CSV import service methods
    - Implement importParticipants(fileBuffer) in ParticipantService
    - Implement importVenues(fileBuffer) in VenueService
    - Implement importActivities(fileBuffer) in ActivityService
    - Implement importGeographicAreas(fileBuffer) in GeographicAreaService
    - Use csv-parse to parse CSV with proper configuration (handle quotes, delimiters, line endings)
    - Validate each row using existing Zod schemas
    - Skip invalid rows and collect error details
    - Treat rows with id column as updates, rows without as creates
    - Return ImportResult with success/failure counts and detailed errors
    - _Requirements: 22.12, 22.13, 22.14, 22.15, 22.16, 22.17, 22.18, 22.19, 22.20, 22.21, 22.22, 22.23, 22.24, 22.29, 22.30_

  - [x] 25.4 Create CSV export routes
    - Add GET /api/v1/participants/export route
    - Add GET /api/v1/venues/export route
    - Add GET /api/v1/activities/export route
    - Add GET /api/v1/geographic-areas/export route
    - Set Content-Type header to text/csv
    - Set Content-Disposition header with filename
    - Support geographicAreaId query parameter for filtering
    - Restrict to authenticated users (all roles)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.10, 22.11, 22.31_

  - [x] 25.5 Create CSV import routes
    - Add POST /api/v1/participants/import route
    - Add POST /api/v1/venues/import route
    - Add POST /api/v1/activities/import route
    - Add POST /api/v1/geographic-areas/import route
    - Use multer middleware for file upload handling
    - Validate file type (.csv extension)
    - Validate file size (max 10MB)
    - Return 400 for invalid file type
    - Return 413 for file too large
    - Restrict to EDITOR and ADMINISTRATOR roles
    - _Requirements: 22.12, 22.13, 22.14, 22.15, 22.25, 22.26, 22.27, 22.28_

  - [x] 25.6 Create validation schemas for CSV import
    - Create ParticipantImportSchema with optional id field
    - Create VenueImportSchema with optional id field
    - Create ActivityImportSchema with optional id field
    - Create GeographicAreaImportSchema with optional id field
    - Handle empty string values for optional fields
    - Use coerce for date and number fields
    - _Requirements: 22.16, 22.17, 22.18, 22.19, 22.20_

  - [x] 25.7 Update OpenAPI documentation
    - Document export endpoints with response headers
    - Document import endpoints with multipart/form-data
    - Include CSV column definitions in documentation
    - Add examples for import/export operations
    - Document error responses for file validation
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.12, 22.13, 22.14, 22.15_

  - [ ]* 25.8 Write property tests for CSV operations
    - **Property 134: CSV Export Completeness**
    - **Property 135: Empty CSV Header Generation**
    - **Property 136: CSV Export Headers**
    - **Property 137: CSV Import Validation**
    - **Property 138: CSV Import Create/Update Behavior**
    - **Property 139: CSV File Format Validation**
    - **Property 140: CSV Delimiter Support**
    - **Property 141: CSV Export Geographic Filtering**
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10, 22.11, 22.20, 22.21, 22.22, 22.23, 22.24, 22.26, 22.27, 22.28, 22.30, 22.31, 22.32**

- [ ] 26. Checkpoint - Verify CSV import/export functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Implement optional field clearing support
  - [ ] 27.1 Update Zod validation schemas for nullable optional fields
    - Update ParticipantUpdateSchema to use .nullable() for email, phone, notes, dateOfBirth, dateOfRegistration, nickname
    - Update VenueUpdateSchema to use .nullable() for latitude, longitude, venueType
    - Update ActivityUpdateSchema to use .nullable() for endDate
    - Update AssignmentUpdateSchema to use .nullable() for notes
    - Update GeographicAreaUpdateSchema to use .nullable() for parentGeographicAreaId
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

  - [ ] 27.2 Update service layer to handle field clearing
    - Update ParticipantService.updateParticipant to distinguish between omitted fields (preserve) and null fields (clear)
    - Update VenueService.updateVenue to handle nullable optional fields
    - Update ActivityService.updateActivity to handle nullable endDate
    - Update AssignmentService.updateAssignment to handle nullable notes
    - Update GeographicAreaService.updateGeographicArea to handle nullable parentGeographicAreaId
    - Use 'field' in data checks to detect field presence
    - Pass null values through to repository layer
    - _Requirements: 22.5, 22.7, 22.8, 22.9_

  - [ ] 27.3 Update repository layer to handle null values
    - Ensure Prisma update operations correctly set fields to null
    - Verify database schema allows null for optional fields
    - Test that null values are persisted correctly
    - _Requirements: 22.5, 22.6_

  - [ ] 27.4 Update OpenAPI documentation
    - Document that optional fields can be cleared by sending null
    - Provide examples showing field clearing
    - Explain distinction between omitting fields vs sending null
    - _Requirements: 22.7, 22.9_

  - [ ]* 27.5 Write property tests for optional field clearing
    - **Property 142: Optional Field Clearing for Participants**
    - **Property 143: Optional Field Clearing for Venues**
    - **Property 144: Optional Field Clearing for Activities**
    - **Property 145: Optional Field Clearing for Assignments**
    - **Property 146: Field Omission Preserves Existing Values**
    - **Property 147: Explicit Null vs Omission Distinction**
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9**

- [ ] 28. Checkpoint - Verify optional field clearing functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 29. Fix activity lifecycle geographic filter parameter parsing
  - [x] 29.1 Update ActivityLifecycleQuerySchema in validation.schemas.ts
    - Replace `.transform()` with `.preprocess()` for array parameter normalization
    - Handle single string values by converting to array
    - Handle multiple values by preserving array
    - Handle comma-separated values by splitting and flattening
    - Trim whitespace from all values
    - Filter out empty strings
    - Apply same pattern to geographicAreaIds, activityCategoryIds, activityTypeIds, and venueIds
    - _Requirements: 6A.24, 6A.25, 6A.26, 6A.27, 6A.28, 6A.32_

  - [x] 29.2 Fix empty venue list handling in getActivityLifecycleEvents
    - Add early return when geographic filter yields no venues
    - Return empty array immediately if effectiveVenueIds.length === 0 after geographic filter
    - Prevent returning all activities when filter should return none
    - _Requirements: 6A.13, 6A.29, 6A.21_

  - [x] 29.3 Create integration tests for activity lifecycle filtering
    - Test single geographicAreaId parameter → filters correctly
    - Test multiple geographicAreaIds parameters → filters correctly
    - Test comma-separated geographicAreaIds → filters correctly
    - Test invalid UUID → returns 400 with validation error
    - Test invalid groupBy → returns 400 with validation error
    - Test missing groupBy → returns 400 with validation error
    - Test geographic filter with no matching activities → returns empty array
    - _Requirements: 6A.24, 6A.25, 6A.26, 6A.13, 6A.29, 6A.21, 6A.30, 6A.31, 6A.3, 6A.22_

  - [ ]* 29.4 Write property tests for query parameter normalization
    - **Property 148: Single Geographic Area ID Normalization**
    - **Property 149: Multiple Geographic Area IDs Preservation**
    - **Property 150: Comma-Separated Geographic Area IDs Splitting**
    - **Property 151: Empty Geographic Area Result Handling**
    - **Property 152: Geographic Area UUID Validation**
    - **Property 153: Activity Lifecycle GroupBy Validation**
    - **Property 154: Activity Lifecycle Date Validation**
    - **Validates: Requirements 6A.24, 6A.25, 6A.26, 6A.13, 6A.29, 6A.21, 6A.30, 6A.31, 6A.3, 6A.2, 6A.22**

- [x] 30. Checkpoint - Verify activity lifecycle geographic filter fix
  - Verified with original failing request: `/api/v1/analytics/activity-lifecycle?groupBy=type&geographicAreaIds=2d55ba16-472a-4da8-9b9d-37cce780c100`
  - Confirmed response is now filtered correctly
  - Confirmed empty results are returned when no activities match
  - Confirmed validation errors are returned for invalid inputs
  - All tests pass


- [x] 31. Fix audit logging implementation
  - [x] 31.1 Instantiate AuditLoggingMiddleware in index.ts
    - Import AuditLogRepository
    - Create auditLogRepository instance with Prisma client
    - Create auditLoggingMiddleware instance with auditLogRepository
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 31.2 Apply audit logging to authentication routes
    - Add logAuthenticationEvent('LOGIN') to POST /api/v1/auth/login
    - Add logAuthenticationEvent('LOGOUT') to POST /api/v1/auth/logout
    - Add logAuthenticationEvent('REFRESH') to POST /api/v1/auth/refresh
    - _Requirements: 12.1_

  - [x] 31.3 Apply audit logging to user management routes
    - Add logRoleChange() to PUT /api/v1/users/:id when role is modified
    - Add logEntityModification('USER') to POST /api/v1/users
    - Add logEntityModification('USER') to PUT /api/v1/users/:id
    - _Requirements: 12.2, 12.3_

  - [x] 31.4 Apply audit logging to entity modification routes
    - Add logEntityModification('PARTICIPANT') to POST, PUT, DELETE /api/v1/participants
    - Add logEntityModification('ACTIVITY') to POST, PUT, DELETE /api/v1/activities
    - Add logEntityModification('VENUE') to POST, PUT, DELETE /api/v1/venues
    - Add logEntityModification('GEOGRAPHIC_AREA') to POST, PUT, DELETE /api/v1/geographic-areas
    - Add logEntityModification('ACTIVITY_CATEGORY') to POST, PUT, DELETE /api/v1/activity-categories
    - Add logEntityModification('ACTIVITY_TYPE') to POST, PUT, DELETE /api/v1/activity-types
    - Add logEntityModification('ROLE') to POST, PUT, DELETE /api/v1/roles
    - Add logEntityModification('ASSIGNMENT') to POST, PUT, DELETE /api/v1/activities/:id/participants
    - _Requirements: 12.3_

  - [x] 31.5 Verify audit logging functionality
    - Test that authentication events are logged
    - Test that role changes are logged
    - Test that entity modifications are logged
    - Verify audit log entries contain correct user ID, action type, entity type, entity ID, and timestamp
    - Verify audit log details are stored as JSON
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 31.6 Write integration tests for audit logging
    - Test authentication event logging
    - Test role change logging
    - Test entity modification logging
    - Test audit log retrieval (administrator only)
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

- [x] 31A. Fix audit logging foreign key constraint violation
  - [x] 31A.1 Make userId nullable in AuditLog Prisma model
    - Update AuditLog model to make userId field optional (userId String?)
    - Update foreign key relation to handle nullable userId
    - Create Prisma migration for schema change
    - _Requirements: 12.1, 12.4_

  - [x] 31A.2 Update AuditLogRepository to handle nullable userId
    - Update create() method to accept optional userId
    - Ensure repository can create audit logs without userId
    - _Requirements: 12.1, 12.4_

  - [x] 31A.3 Fix logAuthenticationEvent to handle pre-authentication state
    - For LOGIN events, extract userId from response body after successful authentication
    - Parse response JSON to get the authenticated user's ID
    - Only create audit log if userId can be determined from response
    - For LOGOUT and REFRESH, use req.user.userId (already authenticated)
    - Remove fallback to email or 'unknown' string
    - _Requirements: 12.1_

  - [x] 31A.4 Update audit logging to gracefully handle missing userId
    - Ensure all audit logging methods check for valid userId before logging
    - Log warning when userId cannot be determined but don't fail the request
    - Update error handling to be more informative
    - _Requirements: 12.1, 12.4_

  - [ ]* 31A.5 Write integration tests for nullable userId audit logs
    - Test that audit logs can be created without userId
    - Test that LOGIN events correctly extract userId from response
    - Test that failed authentication doesn't create audit logs
    - **Validates: Requirements 12.1, 12.4**

- [x] 32. Checkpoint - Verify audit logging is working
  - Ensure all tests pass, ask the user if questions arise.
  - Verify audit log table contains entries after creating/modifying records
  - Verify no foreign key constraint violations occur

- [ ] 33. Implement geographic authorization system
  - [x] 33.0 Fix createdBy foreign key constraint violation and test failures
    - **Fixed Foreign Key Constraint:**
      - Added validation in UserService.createUser() to check that createdBy user exists before creating authorization rules
      - Added validation in GeographicAuthorizationService.createAuthorizationRule() to check that createdBy user exists
      - Updated AuthMiddleware.authenticate() to validate user still exists in database after token validation
      - Updated AuthMiddleware.optionalAuthenticate() to validate user still exists in database
    - **Fixed Test Failures:**
      - Updated AuthMiddleware constructor to require UserRepository parameter
      - Updated all route test files to pass UserRepository to AuthMiddleware constructor
      - Updated auth.middleware.test.ts to mock UserRepository and test user existence validation
      - Fixed ActivityTypeService tests to use correct predefined type names ("Ruhi Book 01" not "Ruhi Book 1")
      - Added maxWorkers: 1 to jest.config.js to run tests sequentially and avoid database conflicts
    - **Result:** All 329 tests now passing
    - _Requirements: 24.8, 11A.11, 11A.12_

  - [ ] 33.1 Create Prisma migration for UserGeographicAuthorization table
    - Add UserGeographicAuthorization model with userId, geographicAreaId, ruleType (ALLOW/DENY), createdAt, createdBy
    - Add unique constraint on (userId, geographicAreaId)
    - Add foreign key constraints to User and GeographicArea
    - Add index on userId for efficient queries
    - _Requirements: 24.8_

  - [ ] 33.2 Create UserGeographicAuthorizationRepository
    - Implement findByUserId(userId) to get all rules for a user
    - Implement create(data) to create new authorization rule
    - Implement delete(id) to remove authorization rule
    - Implement findByUserAndArea(userId, geographicAreaId) to check for duplicates
    - _Requirements: 24.1, 24.2, 24.3, 24.7_

  - [ ] 33.3 Create GeographicAuthorizationService
    - Implement getAuthorizationRules(userId) to retrieve all rules
    - Implement createAuthorizationRule(userId, geographicAreaId, ruleType, createdBy) with validation
    - Implement deleteAuthorizationRule(authId, userId) with admin check
    - Implement evaluateAccess(userId, geographicAreaId) with deny-first logic
    - Implement getAuthorizedAreas(userId) to calculate effective access (allowed areas + descendants + ancestors)
    - Implement hasGeographicRestrictions(userId) to check if user has any rules
    - Validate user and geographic area exist when creating rules
    - Prevent duplicate rules for same user and area
    - _Requirements: 24.5, 24.6, 24.7, 24.9, 24.10, 24.11, 24.12, 24.13, 24.14, 24.36, 24.37, 24.38_

  - [ ] 33.3a Fix ancestor marking in getAuthorizedAreas
    - Update getAuthorizedAreas() method to properly mark ancestors with isAncestor=true even when they have FULL access from another rule
    - After processing all ALLOW rules, iterate through all allowed areas again
    - For each allowed area, fetch its ancestors
    - For each ancestor, if it exists in authorizedAreas map, set isAncestor=true (preserving existing accessLevel)
    - This ensures ancestors are always marked for filtering purposes, even if they have FULL access
    - _Requirements: 24.38, 24.39, 24.40_

  - [ ] 33.4 Create geographic authorization routes
    - GET /api/v1/users/:id/geographic-authorizations (admin only)
    - POST /api/v1/users/:id/geographic-authorizations (admin only)
    - DELETE /api/v1/users/:id/geographic-authorizations/:authId (admin only)
    - GET /api/v1/users/:id/authorized-areas (admin only)
    - Restrict all endpoints to ADMINISTRATOR role
    - Return 403 for non-administrators
    - _Requirements: 24.1, 24.2, 24.3, 24.31, 24.32, 24.36_

  - [ ] 33.5 Create validation schemas
    - Create GeographicAuthorizationCreateSchema (geographicAreaId UUID, ruleType enum ALLOW/DENY)
    - Validate required fields
    - _Requirements: 24.5_

  - [ ]* 33.6 Write property tests for authorization rules
    - **Property 155: Authorization Rule Creation**
    - **Property 156: Duplicate Authorization Rule Prevention**
    - **Property 157: Deny Rule Precedence**
    - **Property 158: Descendant Access from Allow Rule**
    - **Property 159: Ancestor Read-Only Access from Allow Rule**
    - **Property 160: Unrestricted Access with No Rules**
    - **Property 161: Restricted Access with Rules**
    - **Property 171: Authorization Management Admin Restriction**
    - **Validates: Requirements 24.2, 24.5, 24.6, 24.7, 24.9, 24.10, 24.11, 24.12, 24.13, 24.14, 24.31, 24.32**

  - [ ] 33.7 Enhance JWT token payload with authorized area IDs
    - Update AuthService.generateToken() to query user's authorization rules
    - Calculate authorized area IDs (areas with full access + descendants)
    - Calculate read-only area IDs (ancestors of allowed areas)
    - Add authorizedAreaIds, readOnlyAreaIds, and hasGeographicRestrictions to JWT payload
    - Update JWT token interface definition
    - _Requirements: 24.33, 24.34, 24.35_

  - [ ] 33.8 Update authentication middleware to extract authorization info
    - Extract authorizedAreaIds, readOnlyAreaIds, and hasGeographicRestrictions from JWT
    - Attach to request object for use in services
    - _Requirements: 24.35_

  - [ ] 33.9 Apply geographic authorization filtering to ParticipantService
    - Update getParticipants() to apply implicit filtering when no geographicAreaId provided
    - Validate explicit geographicAreaId against user's authorized areas
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if unauthorized
    - _Requirements: 24.15, 24.23, 24.24, 24.25_

  - [ ] 33.10 Apply geographic authorization filtering to ActivityService
    - Update getActivities() to apply implicit filtering when no geographicAreaId provided
    - Validate explicit geographicAreaId against user's authorized areas
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if unauthorized
    - Validate venue authorization when creating activities
    - _Requirements: 24.16, 24.23, 24.24, 24.25, 24.29_

  - [ ] 33.11 Apply geographic authorization filtering to VenueService
    - Update getVenues() to apply implicit filtering when no geographicAreaId provided
    - Validate explicit geographicAreaId against user's authorized areas
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if unauthorized
    - Validate geographic area authorization when creating venues
    - Validate geographic area authorization when updating venue's geographicAreaId
    - _Requirements: 24.17, 24.23, 24.24, 24.25, 24.28, 24.30_

  - [ ] 33.12 Apply geographic authorization filtering to GeographicAreaService
    - Update getGeographicAreas() to apply implicit filtering when no geographicAreaId provided
    - Validate explicit geographicAreaId against user's authorized areas
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if unauthorized
    - Validate parent area authorization when creating geographic areas
    - Prevent creating top-level areas when user has geographic restrictions
    - Return 403 CANNOT_CREATE_TOP_LEVEL_AREA if restricted user attempts to create top-level area
    - _Requirements: 24.18, 24.23, 24.24, 24.25, 24.26, 24.27_

  - [ ] 33.13 Apply geographic authorization filtering to AnalyticsService
    - Update getEngagementMetrics() to apply implicit filtering based on authorized areas
    - Update getGrowthMetrics() to apply implicit filtering based on authorized areas
    - Update getActivityLifecycleEvents() to apply implicit filtering based on authorized areas
    - Validate explicit geographicAreaId filters against user's authorized areas
    - _Requirements: 24.19, 24.20, 24.21, 24.23, 24.24, 24.25_

  - [ ] 33.13a Fix geographic breakdown to respect deny rules
    - Update getGeographicBreakdown() to filter out denied areas from results
    - For each child area in the breakdown, check if user has FULL access using evaluateAccess()
    - Exclude areas where evaluateAccess() returns NONE or READ_ONLY
    - When calculating metrics for an area, only include venues from authorized descendant areas
    - Get authorized descendant IDs by filtering all descendants through evaluateAccess()
    - Only aggregate metrics from venues in authorized descendant areas (excluding denied areas and their descendants)
    - Ensure metrics accurately reflect only the authorized subset of the geographic hierarchy
    - _Requirements: 6B.15, 6B.16, 6B.17_

  - [ ] 33.14 Apply geographic authorization filtering to CSV export endpoints
    - Update exportParticipants() to apply implicit filtering based on authorized areas
    - Update exportVenues() to apply implicit filtering based on authorized areas
    - Update exportActivities() to apply implicit filtering based on authorized areas
    - Update exportGeographicAreas() to apply implicit filtering based on authorized areas
    - _Requirements: 24.22, 24.23_

  - [ ] 33.15 Add audit logging for authorization rule changes
    - Log authorization rule creation with user ID, geographic area ID, and rule type
    - Log authorization rule deletion with user ID, geographic area ID, and rule type
    - Use existing audit logging middleware
    - _Requirements: 24.39_

  - [ ]* 33.16 Write property tests for authorization filtering
    - **Property 162: Implicit Filtering on List Endpoints**
    - **Property 163: Explicit Filter Authorization Validation**
    - **Property 164: Venue Creation Authorization**
    - **Property 165: Activity Creation Authorization**
    - **Property 166: Geographic Area Creation Authorization**
    - **Property 167: Top-Level Area Creation Restriction**
    - **Property 168: Authorization Filtering on Analytics**
    - **Property 169: Authorization Filtering on Exports**
    - **Property 170: JWT Token Includes Authorized Areas**
    - **Property 172: Authorization Rule Audit Logging**
    - **Validates: Requirements 24.15, 24.16, 24.17, 24.18, 24.19, 24.20, 24.21, 24.22, 24.23, 24.24, 24.25, 24.26, 24.27, 24.28, 24.29, 24.30, 24.33, 24.34, 24.35, 24.39**

  - [x] 33.17 Enforce geographic authorization on individual participant access
    - Inject GeographicAuthorizationService into ParticipantService constructor
    - Update ParticipantService.getParticipantById() to accept userId parameter
    - Determine participant's current home venue from most recent address history record
    - Call GeographicAuthorizationService.evaluateAccess() with userId and venue's geographicAreaId
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if access level is NONE
    - Allow access if participant has no address history (not yet associated with any area)
    - Update updateParticipant() to call getParticipantById() first for authorization check
    - Update deleteParticipant() to call getParticipantById() first for authorization check
    - Update route handlers to pass req.user.id to service methods
    - _Requirements: 25.1, 25.5, 25.6, 25.7, 25.15, 25.19, 25.23, 25.27_

  - [ ] 33.18 Enforce geographic authorization on individual activity access
    - Inject GeographicAuthorizationService into ActivityService constructor
    - Update ActivityService.getActivityById() to accept userId parameter
    - Determine activity's current venue from most recent venue history record
    - Call GeographicAuthorizationService.evaluateAccess() with userId and venue's geographicAreaId
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if access level is NONE
    - Allow access if activity has no venue history (not yet associated with any area)
    - Update updateActivity() to call getActivityById() first for authorization check
    - Update deleteActivity() to call getActivityById() first for authorization check
    - Update route handlers to pass req.user.id to service methods
    - _Requirements: 25.2, 25.8, 25.9, 25.10, 25.16, 25.20, 25.24, 25.28_

  - [ ] 33.19 Enforce geographic authorization on individual venue access
    - Inject GeographicAuthorizationService into VenueService constructor
    - Update VenueService.getVenueById() to accept userId parameter
    - Call GeographicAuthorizationService.evaluateAccess() with userId and venue's geographicAreaId
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if access level is NONE
    - Update updateVenue() to call getVenueById() first for authorization check
    - Update deleteVenue() to call getVenueById() first for authorization check
    - Update route handlers to pass req.user.id to service methods
    - _Requirements: 25.3, 25.11, 25.12, 25.17, 25.21, 25.25, 25.29_

  - [ ] 33.20 Enforce geographic authorization on individual geographic area access
    - Inject GeographicAuthorizationService into GeographicAreaService constructor
    - Update GeographicAreaService.getGeographicAreaById() to accept userId parameter
    - Call GeographicAuthorizationService.evaluateAccess() with userId and the area ID
    - Return 403 GEOGRAPHIC_AUTHORIZATION_DENIED if access level is NONE
    - Allow read-only access to ancestor areas (AccessLevel.READ_ONLY is sufficient for GET)
    - Update updateGeographicArea() to call getGeographicAreaById() first for authorization check (requires FULL access)
    - Update deleteGeographicArea() to call getGeographicAreaById() first for authorization check (requires FULL access)
    - Update route handlers to pass req.user.id to service methods
    - _Requirements: 25.4, 25.13, 25.14, 25.18, 25.22, 25.26, 25.30_

  - [ ] 33.21 Enforce geographic authorization on nested resource endpoints
    - Update ParticipantService.getParticipantActivities() to call getParticipantById() first (validates parent participant authorization)
    - Update ParticipantService.getAddressHistory() to call getParticipantById() first (validates parent participant authorization)
    - Update ParticipantService.getParticipantPopulations() to call getParticipantById() first (validates parent participant authorization)
    - Update ActivityService.getActivityParticipants() to call getActivityById() first (validates parent activity authorization)
    - Update ActivityService.getActivityVenues() to call getActivityById() first (validates parent activity authorization)
    - Update VenueService.getVenueActivities() to call getVenueById() first (validates parent venue authorization)
    - Update VenueService.getVenueParticipants() to call getVenueById() first (validates parent venue authorization)
    - Update GeographicAreaService.getChildren() to call getGeographicAreaById() first (validates parent area authorization)
    - Update GeographicAreaService.getAncestors() to call getGeographicAreaById() first (validates parent area authorization)
    - Update GeographicAreaService.getVenues() to call getGeographicAreaById() first (validates parent area authorization)
    - Update GeographicAreaService.getStatistics() to call getGeographicAreaById() first (validates parent area authorization)
    - Ensure all nested endpoint route handlers pass userId to service methods
    - _Requirements: 25.31, 25.32, 25.33, 25.34, 25.35, 25.36, 25.37, 25.38, 25.39, 25.40, 25.41_

  - [ ] 33.22 Implement administrator bypass for geographic authorization
    - Update GeographicAuthorizationService.evaluateAccess() to accept optional userRole parameter
    - Check if userRole is ADMINISTRATOR at the start of evaluateAccess()
    - Return AccessLevel.FULL for administrators regardless of authorization rules
    - Update all service methods to pass user role when calling evaluateAccess()
    - Ensure bypass applies to all resource access operations
    - _Requirements: 25.43_

  - [ ] 33.23 Implement unrestricted user bypass
    - Verify GeographicAuthorizationService.evaluateAccess() already returns FULL when no rules exist
    - Ensure this bypass applies to all resource access operations
    - Test that users with no authorization rules can access all resources
    - _Requirements: 25.42_

  - [ ] 33.24 Add audit logging for authorization denials
    - Inject AuditService into GeographicAuthorizationService constructor
    - Update evaluateAccess() to log when AccessLevel.NONE is returned
    - Include user ID, resource type (geographic area), resource ID, and attempted action in audit log
    - Update service methods to pass resource type context when calling evaluateAccess()
    - _Requirements: 25.45_

  - [ ]* 33.25 Write property tests for individual resource access authorization
    - **Property 173: Participant Detail Access Authorization**
    - **Property 174: Activity Detail Access Authorization**
    - **Property 175: Venue Detail Access Authorization**
    - **Property 176: Geographic Area Detail Access Authorization**
    - **Property 177: Participant Update Authorization**
    - **Property 178: Activity Update Authorization**
    - **Property 179: Venue Update Authorization**
    - **Property 180: Geographic Area Update Authorization**
    - **Property 181: Participant Deletion Authorization**
    - **Property 182: Activity Deletion Authorization**
    - **Property 183: Venue Deletion Authorization**
    - **Property 184: Geographic Area Deletion Authorization**
    - **Property 185: Nested Resource Access Authorization**
    - **Property 186: Unrestricted User Bypass**
    - **Property 187: Administrator Authorization Bypass**
    - **Property 188: Authorization Denial Audit Logging**
    - **Property 189: Consistent Authorization Across Access Patterns**
    - **Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10, 25.11, 25.12, 25.13, 25.14, 25.15, 25.16, 25.17, 25.18, 25.19, 25.20, 25.21, 25.22, 25.23, 25.24, 25.25, 25.26, 25.27, 25.28, 25.29, 25.30, 25.31, 25.32, 25.33, 25.34, 25.35, 25.36, 25.37, 25.38, 25.39, 25.40, 25.41, 25.42, 25.43, 25.44, 25.45**

- [ ] 34. Checkpoint - Verify geographic authorization system
  - Ensure all tests pass, ask the user if questions arise.
  - Test authorization rules with ALLOW and DENY combinations
  - Test implicit filtering on all list endpoints
  - Test individual resource access authorization (GET, PUT, DELETE by ID)
  - Test nested resource endpoint authorization
  - Test create operation validation
  - Test administrator bypass
  - Test unrestricted user bypass
  - Verify JWT token includes authorized area IDs
  - Verify authorization denials are logged


- [x] 35. Fix unit test database isolation
  - [x] 35.1 Create mock Prisma client factory for unit tests
    - Create a test utility that generates a fully mocked Prisma client
    - Mock all Prisma model methods (findMany, findUnique, create, update, delete, etc.)
    - Ensure mocked client returns empty results by default
    - Provide helper functions to set up specific mock responses per test
    - _Requirements: Testing best practices, test isolation_

  - [x] 35.2 Update service unit tests to use mocked Prisma client
    - Replace `new Repository(null as any)` pattern with properly mocked repositories
    - Inject mocked Prisma client into repository constructors
    - Ensure no real database connections are made during unit tests
    - Verify tests run in complete isolation without side effects
    - Update activity-type.service.test.ts to use mocked Prisma
    - Update activity.service.test.ts to use mocked Prisma
    - Update all other service test files to use mocked Prisma
    - _Requirements: Testing best practices, test isolation_

  - [x] 35.3 Add test database cleanup utilities
    - Create beforeEach/afterEach hooks that reset mock state
    - Ensure each test starts with a clean slate
    - Document the proper pattern for writing isolated unit tests
    - _Requirements: Testing best practices, test isolation_

  - [x] 35.4 Separate integration tests from unit tests
    - Move tests that require real database to integration test directory
    - Keep unit tests purely in-memory with mocks
    - Update Jest configuration to distinguish between unit and integration tests
    - Add separate npm scripts for running unit vs integration tests
    - _Requirements: Testing best practices, test organization_

  - [x] 35.5 Write documentation for test patterns
    - Document the difference between unit tests (mocked) and integration tests (real DB)
    - Provide examples of proper mock setup for repositories and services
    - Explain when to use unit tests vs integration tests
    - Add guidelines for avoiding test side effects
    - _Requirements: Testing best practices, documentation_

- [x] 36. Checkpoint - Verify unit test isolation
  - Run unit tests and confirm no database side effects
  - Verify no test data persists in the database after test runs
  - Ensure tests can run in any order without failures
  - Confirm tests run faster without database I/O

- [x] 37. Fix dangerous integration test cleanup code
  - **CRITICAL FIX:** Fixed geographic-breakdown-authorization.test.ts which was calling `deleteMany({})` with NO WHERE CLAUSE
  - This was deleting ALL records from ALL tables including seed data and production data
  - Updated cleanup to only delete specific test-created records using tracked IDs
  - Added database safety check in test setup to prevent running tests against non-test databases
  - Reviewed all 6 integration test files - all others already had safe cleanup patterns
  - **Result:** All integration tests now use safe, scoped cleanup that only deletes test data
  - _Requirements: Testing best practices, data safety_

- [x] 38. Fix analytics to respect DENY authorization rules
  - **Issue:** When explicitly filtering by a geographic area (e.g., city), analytics was including ALL descendants including denied areas
  - **Root Cause:** getEffectiveGeographicAreaIds() was expanding explicit filters to all descendants without checking authorization
  - **Fix:** Updated getEffectiveGeographicAreaIds() to filter descendants against authorizedAreaIds when user has geographic restrictions
  - **Logic:** When explicit filter provided + user has restrictions → expand descendants but only include those in authorizedAreaIds
  - **Created Test:** analytics-deny-authorization.test.ts with 4 test cases covering engagement, growth, lifecycle, and explicit filtering
  - **Result:** All 333 tests passing, analytics now correctly excludes denied areas from all metrics
  - _Requirements: 24.15, 24.16, 24.17, 24.18, 24.19, 24.20, 24.21, 6B.15, 6B.16, 6B.17_


- [x] 39. Fix grouped engagement metrics filter regression
  - **Issue:** Grouped engagement metrics are not applying dimension filters correctly
  - **Root Cause:** `queryActualDimensionCombinations()` builds filters using legacy single-value properties (activityCategoryId, activityTypeId, venueId, geographicAreaId) but `getEngagementMetrics()` expects array-based properties (activityCategoryIds, activityTypeIds, venueIds, geographicAreaIds)
  - **Impact:** When groupBy dimensions are specified, each group's metrics include ALL activities instead of only activities matching that group's dimension values
  - **Fix Required:** Update `queryActualDimensionCombinations()` to use array-based filter properties when building combination filters
  - _Requirements: 6.15, 6.31, 6.33_

  - [x] 39.1 Update queryActualDimensionCombinations to use array-based filters
    - Change `combination.filters.activityCategoryId = value.id;` to `combination.filters.activityCategoryIds = [value.id];`
    - Change `combination.filters.activityTypeId = value.id;` to `combination.filters.activityTypeIds = [value.id];`
    - Change `combination.filters.venueId = value.id;` to `combination.filters.venueIds = [value.id];`
    - Change `combination.filters.geographicAreaId = value.id;` to `combination.filters.geographicAreaIds = [value.id];`
    - Ensure all dimension filters are passed as single-element arrays
    - _Requirements: 6.15, 6.31, 6.33_

  - [x]* 39.2 Write integration test for grouped engagement metrics
    - Create test data with multiple activity categories and types
    - Request engagement metrics with groupBy=['category']
    - Verify each group's metrics only include activities from that category
    - Verify grouped results match ungrouped results when summed
    - Test with multiple grouping dimensions (category + type)
    - **Validates: Requirements 6.15, 6.31, 6.33**

  - [x] 39.3 Verify fix doesn't break existing functionality
    - Run all existing analytics integration tests
    - Verify ungrouped metrics still work correctly
    - Verify geographic filtering still works with grouped metrics
    - Verify population filtering still works with grouped metrics
    - _Requirements: 6.15, 6.16, 6.17, 6.18, 6.19, 6.20, 6.21, 6.24, 6.25, 6.26, 6.27, 6.28, 6.29, 6.31, 6.33_

- [x] 40. Checkpoint - Verify grouped engagement metrics fix
  - Ensure all tests pass, ask the user if questions arise.
  - Test grouped metrics with single dimension (category, type, venue, geographic area)
  - Test grouped metrics with multiple dimensions
  - Verify each group's metrics are correctly filtered
  - Verify grouped results sum to match ungrouped totals


- [x] 41. Implement fake data generation script for load testing
  - [x] 41.1 Create script structure and safety mechanisms
    - Create generate-fake-data.ts in backend-api/scripts directory
    - Implement NODE_ENV check (exit if not "development")
    - Implement user confirmation prompt with summary of records to be created
    - Parse command-line arguments for configurable record counts (--areas, --venues, --participants, --activities)
    - Set default values (10K areas, 1M venues, 10M participants, 20M activities)
    - Use same DATABASE_URL environment variable as main API
    - Handle database connection errors gracefully with clear error messages
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.30_

  - [ ]* 41.2 Write property test for environment safety check
    - **Property 190: Environment Safety Check**
    - **Validates: Requirements 26.4**

  - [x] 41.3 Implement deterministic UUID generation
    - Create generateDeterministicUUID(name: string) function
    - Use crypto.createHash('md5') to hash the entity name
    - Format MD5 hash as UUID (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
    - Ensure same name always produces same UUID
    - _Requirements: 26.11_

  - [ ]* 41.4 Write property tests for UUID generation
    - **Property 191: Deterministic Naming**
    - **Property 192: MD5-Based UUID Determinism**
    - **Validates: Requirements 26.10, 26.11, 26.22, 26.24**

  - [x] 41.5 Implement geographic area generation
    - Calculate type distribution (2% COUNTRY, 5% STATE, 3% PROVINCE, 20% CLUSTER, 30% CITY, 40% NEIGHBOURHOOD)
    - Generate countries first with null parent
    - For each country, randomly select subdivision type (STATE, PROVINCE, or CLUSTER) and use consistently
    - Generate remaining areas with proper parent assignment based on hierarchy rules
    - Use deterministic naming: "{Type} {Serial}" (e.g., "Country 000001")
    - Use batch upsert operations (1000 records per batch)
    - Provide progress output during generation
    - _Requirements: 26.10, 26.11, 26.12, 26.13, 26.14, 26.15, 26.16, 26.28_

  - [ ]* 41.6 Write property tests for geographic area generation
    - **Property 193: Script Idempotency**
    - **Property 194: Geographic Area Type Distribution**
    - **Property 195: Country Parent Assignment**
    - **Property 196: Hierarchical Parent Type Validation**
    - **Property 197: Country Subdivision Consistency**
    - **Validates: Requirements 26.12, 26.13, 26.14, 26.15, 26.16**

  - [x] 41.7 Implement venue generation
    - Identify all leaf-node geographic areas (areas with no children)
    - Distribute venues evenly across leaf nodes using UUID modulo logic
    - Generate venue names: "{GeographicAreaName} Venue {Serial}"
    - Assign base coordinates to each geographic area (distributed globally)
    - Generate venue coordinates within 10km radius using golden angle distribution
    - Use batch upsert operations
    - Provide progress output during generation
    - _Requirements: 26.7, 26.10, 26.11, 26.12, 26.17, 26.18, 26.19, 26.20, 26.21, 26.28_

  - [ ]* 41.8 Write property tests for venue generation
    - **Property 198: Venue Naming Pattern**
    - **Property 199: Venue Leaf-Node Assignment**
    - **Property 200: Venue Distribution Across Leaf Nodes**
    - **Property 201: Venue Coordinate Proximity**
    - **Property 202: Geographic Area Coordinate Diversity**
    - **Validates: Requirements 26.17, 26.18, 26.19, 26.20, 26.21**

  - [x] 41.9 Implement participant generation
    - Generate participant names: "Participant {Serial}" with zero-padded 8-digit serial
    - Assign each participant to a venue using UUID modulo logic
    - Create ParticipantAddressHistory record for each participant with null effectiveFrom (oldest address)
    - Use batch upsert operations for both participants and address history
    - Provide progress output during generation
    - _Requirements: 26.8, 26.10, 26.11, 26.12, 26.22, 26.23, 26.28_

  - [ ]* 41.10 Write property test for participant generation
    - **Property 203: Participant Venue Assignment**
    - **Validates: Requirements 26.23**

  - [x] 41.11 Implement activity generation
    - Generate activity names: "Activity {Serial}" with zero-padded 8-digit serial
    - Assign each activity to a venue using UUID modulo logic
    - Assign random activity type using UUID modulo logic
    - Set startDate to random date in past year
    - Set endDate to random date after startDate (or null for 10% of activities)
    - Set status to PLANNED (70%), ACTIVE (20%), or COMPLETED (10%)
    - Create ActivityVenueHistory record for each activity with null effectiveFrom
    - Use batch upsert operations
    - Provide progress output during generation
    - _Requirements: 26.9, 26.10, 26.11, 26.12, 26.24, 26.25, 26.28_

  - [ ]* 41.12 Write property tests for activity generation
    - **Property 204: Activity Venue Assignment**
    - **Property 205: Activity Participant Count Range**
    - **Validates: Requirements 26.25, 26.26**

  - [x] 41.13 Implement activity-participant assignment generation
    - For each activity, determine participant count (3-15) using UUID modulo logic
    - Assign participants to activity using UUID modulo logic
    - Assign role to each assignment using UUID modulo logic
    - Create Assignment records with deterministic UUIDs
    - Use batch upsert operations
    - Provide progress output during generation
    - _Requirements: 26.11, 26.12, 26.26, 26.27, 26.28_

  - [ ]* 41.14 Write property test for assignment generation
    - **Property 206: Assignment Role Assignment**
    - **Validates: Requirements 26.27**

  - [x] 41.15 Add npm script and documentation
    - Add "generate-fake-data" script to package.json
    - Create README section documenting script usage
    - Document command-line parameters
    - Document safety mechanisms
    - Provide examples of different configurations
    - _Requirements: 26.5, 26.6, 26.7, 26.8, 26.9_

  - [x] 41.16 Output generation summary
    - Track counts of created records for each entity type
    - Output final summary with total counts
    - Include execution time in summary
    - _Requirements: 26.29_

- [x] 42. Checkpoint - Verify fake data generation script
  - Ensure all tests pass, ask the user if questions arise.
  - Run script with small dataset (100 areas, 1000 venues, 10000 participants, 20000 activities)
  - Verify idempotency by running script twice and checking database state
  - Verify geographic hierarchy is correct
  - Verify venue coordinates are properly distributed
  - Verify activities have correct participant counts
  - Test with different parameter configurations


- [x] 43. Implement fake data removal functionality
  - [x] 43.1 Add --remove flag support to script
    - Parse --remove flag from command-line arguments
    - Add removal mode to script flow (skip generation, run removal instead)
    - Apply same NODE_ENV check for removal mode
    - Prompt user for confirmation before deletion with summary of records to be deleted
    - _Requirements: 26.31, 26.32, 26.33_

  - [ ]* 43.2 Write property test for removal environment safety check
    - **Property 207: Removal Environment Safety Check**
    - **Validates: Requirements 26.33**

  - [x] 43.3 Implement pattern-based fake data identification
    - Define regex patterns for each entity type (geographic areas, venues, participants, activities)
    - Create functions to identify fake data records by name patterns
    - Ensure patterns match the deterministic naming used in generation
    - _Requirements: 26.34_

  - [ ]* 43.4 Write property tests for pattern-based identification
    - **Property 208: Pattern-Based Identification**
    - **Property 209: Manual Data Preservation**
    - **Validates: Requirements 26.34, 26.37**

  - [x] 43.5 Implement fake data removal with correct deletion order
    - Delete assignments first (WHERE activity.name matches pattern AND participant.name matches pattern)
    - Delete activity venue history (WHERE activity.name matches pattern)
    - Delete activities (WHERE name matches pattern)
    - Delete participant address history (WHERE participant.name matches pattern)
    - Delete participant population associations (WHERE participant.name matches pattern)
    - Delete participants (WHERE name matches pattern)
    - Delete venues (WHERE name matches pattern)
    - Delete geographic areas (WHERE name matches pattern)
    - Use Prisma deleteMany with where clauses for pattern matching
    - Track deletion counts for each entity type
    - _Requirements: 26.34, 26.35, 26.36, 26.37_

  - [ ]* 43.6 Write property tests for deletion order and preservation
    - **Property 210: Predefined Data Preservation**
    - **Property 211: Foreign Key Constraint Order**
    - **Validates: Requirements 26.35, 26.36**

  - [x] 43.7 Add progress output and summary for removal
    - Output progress during deletion for each entity type
    - Show count of deleted records for each entity type
    - Output final summary with total deletion counts
    - Include execution time in summary
    - _Requirements: 26.38, 26.39_

  - [x] 43.8 Update documentation for removal functionality
    - Add --remove flag documentation to scripts README
    - Provide examples of removal usage
    - Document pattern matching logic
    - Explain preservation of manual and predefined data
    - Add troubleshooting section for removal
    - _Requirements: 26.31, 26.40_

- [x] 44. Checkpoint - Verify fake data removal functionality
  - Ensure all tests pass, ask the user if questions arise.
  - Generate small dataset with fake data
  - Manually create some test records (non-matching patterns)
  - Run removal script and verify only fake data is deleted
  - Verify manual records are preserved
  - Verify predefined seed data is preserved
  - Test idempotency (running removal twice should be safe)
  - Verify foreign key constraints are not violated during deletion


- [x] 45. Implement Map Data API endpoints for optimized map visualization with batched pagination
  - [x] 45.1 Create MapDataService with pagination support
    - Implement getActivityMarkers() method to return lightweight activity marker data with pagination
    - Accept page and limit parameters (default limit: 100, max: 100)
    - Query activities with current venue coordinates (handle null effectiveFrom as activity startDate)
    - Return only id, latitude, longitude, activityTypeId, activityCategoryId fields
    - Return pagination metadata with page, limit, total, totalPages
    - Calculate total count efficiently for progress indicators
    - Exclude activities without venue or without coordinates
    - Apply geographic authorization filtering
    - Support all filter parameters (geographicAreaIds, activityCategoryIds, activityTypeIds, venueIds, populationIds, startDate, endDate, status)
    - Apply OR logic within dimensions, AND logic across dimensions
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.22, 27.23, 27.24, 27.25, 27.26, 27.27, 27.29, 27.31_

  - [x] 45.2 Implement activity popup content method
    - Implement getActivityPopupContent(activityId) method
    - Return id, name, activityTypeName, activityCategoryName, startDate, participantCount
    - Join with activityType and activityCategory tables for names
    - Count participants via assignments table
    - Apply geographic authorization filtering
    - _Requirements: 27.8, 27.9, 27.22_

  - [x] 45.3 Implement participant home marker methods with pagination
    - Implement getParticipantHomeMarkers() method with pagination support
    - Accept page and limit parameters (default limit: 100, max: 100)
    - Query participants grouped by current home venue
    - Return venueId, latitude, longitude, participantCount
    - Return pagination metadata with total count
    - Handle null effectiveFrom as oldest address
    - Apply geographic authorization filtering
    - Support geographicAreaIds and populationIds filters
    - Exclude participants without home venue or coordinates
    - _Requirements: 27.10, 27.11, 27.12, 27.13, 27.22, 27.23, 27.24, 27.25, 27.30, 27.32_

  - [x] 45.4 Implement participant home popup content method
    - Implement getParticipantHomePopupContent(venueId) method
    - Return venueId, venueName, participantCount, participantNames array
    - Query participants with venue as current home
    - Apply geographic authorization filtering
    - _Requirements: 27.14, 27.15, 27.22_

  - [x] 45.5 Implement venue marker methods with pagination
    - Implement getVenueMarkers() method with pagination support
    - Accept page and limit parameters (default limit: 100, max: 100)
    - Query all venues with non-null latitude and longitude
    - Return id, latitude, longitude
    - Return pagination metadata with total count
    - Apply geographic authorization filtering
    - Support geographicAreaIds filter
    - Exclude venues without coordinates
    - _Requirements: 27.16, 27.17, 27.18, 27.19, 27.22, 27.23, 27.24, 27.25, 27.27, 27.32_

  - [x] 45.6 Implement venue popup content method
    - Implement getVenuePopupContent(venueId) method
    - Return id, name, address, geographicAreaName
    - Join with geographicArea table
    - Apply geographic authorization filtering
    - _Requirements: 27.20, 27.21, 27.22_

  - [x] 45.7 Create map data routes with pagination
    - Add GET /api/v1/map/activities route with filter validation and pagination parameters
    - Add GET /api/v1/map/activities/:id/popup route
    - Add GET /api/v1/map/participant-homes route with filter validation and pagination parameters
    - Add GET /api/v1/map/participant-homes/:venueId/popup route
    - Add GET /api/v1/map/venues route with filter validation and pagination parameters
    - Add GET /api/v1/map/venues/:id/popup route
    - Restrict all routes to authenticated users
    - _Requirements: 27.1, 27.8, 27.10, 27.14, 27.16, 27.20, 27.22_

  - [x] 45.8 Create validation schemas for map data endpoints with pagination
    - Create MapActivityMarkersQuerySchema with optional filter arrays and pagination parameters (page, limit)
    - Create MapParticipantHomeMarkersQuerySchema with optional filter arrays and pagination parameters
    - Create MapVenueMarkersQuerySchema with optional filter arrays and pagination parameters
    - Validate page is positive integer, limit is 1-100
    - Use Zod preprocess for array parameter normalization
    - _Requirements: 27.4, 27.5, 27.6, 27.7, 27.13, 27.19, 27.24, 27.25_

  - [x] 45.9 Add database indexes for map query optimization
    - Create index on venues (latitude, longitude) for coordinate queries
    - Create index on activityVenueHistory (activityId, effectiveFrom) for current venue determination
    - Create index on participantAddressHistory (participantId, effectiveFrom) for current address determination
    - Create composite indexes for common filter combinations
    - _Requirements: 27.26_

  - [x] 45.10 Update OpenAPI documentation
    - Document all six map data endpoints with pagination parameters
    - Include request parameters and response schemas with pagination metadata
    - Add examples showing batched loading with page/limit parameters
    - Document total count in pagination metadata
    - _Requirements: 27.1, 27.8, 27.10, 27.14, 27.16, 27.20_

  - [ ]* 45.11 Write property tests for map data endpoints with pagination
    - **Property 212: Activity Marker Lightweight Response**
    - **Property 213: Activity Popup Content Completeness**
    - **Property 214: Participant Home Marker Grouping**
    - **Property 215: Venue Marker Coordinate Filtering**
    - **Property 216: Map Data Geographic Authorization**
    - **Property 217: Map Data Filter Application**
    - **Property 218: Map Data Pagination Metadata**
    - **Property 219: Map Data Total Count Accuracy**
    - **Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9, 27.10, 27.11, 27.12, 27.13, 27.14, 27.15, 27.16, 27.17, 27.18, 27.19, 27.20, 27.21, 27.22, 27.23, 27.24, 27.25, 27.26, 27.27, 27.28, 27.29, 27.30, 27.31, 27.32**
    - Apply geographic authorization check on activity access
    - _Requirements: 27.4, 27.5, 27.16_

  - [x] 45.3 Implement participant home marker methods
    - Implement getParticipantHomeMarkers() method
    - Query participants grouped by current home venue
    - Determine current home from most recent address history (handle null effectiveFrom as oldest)
    - Return venueId, latitude, longitude, participantCount (one record per venue)
    - Exclude participants without home venue or without coordinates
    - Apply geographic authorization filtering
    - Support geographicAreaIds and populationIds filters
    - _Requirements: 27.6, 27.7, 27.8, 27.16, 27.17, 27.18, 27.19, 27.24, 27.25_

  - [x] 45.4 Implement participant home popup content method
    - Implement getParticipantHomePopupContent(venueId) method
    - Return venueId, venueName, participantCount, participantNames array
    - Query participants where current home venue matches venueId
    - Apply geographic authorization check on venue access
    - _Requirements: 27.9, 27.10, 27.16_

  - [x] 45.5 Implement venue marker methods
    - Implement getVenueMarkers() method
    - Query all venues with non-null latitude and longitude
    - Return only id, latitude, longitude fields
    - Apply geographic authorization filtering
    - Support geographicAreaIds filter
    - _Requirements: 27.11, 27.12, 27.13, 27.16, 27.17, 27.18, 27.19, 27.26_

  - [x] 45.6 Implement venue popup content method
    - Implement getVenuePopupContent(venueId) method
    - Return id, name, address, geographicAreaName
    - Join with geographicArea table for area name
    - Apply geographic authorization check on venue access
    - _Requirements: 27.14, 27.15, 27.16_

  - [x] 45.7 Create map data routes
    - Add GET /api/v1/map/activities route with filter validation
    - Add GET /api/v1/map/activities/:id/popup route
    - Add GET /api/v1/map/participant-homes route with filter validation
    - Add GET /api/v1/map/participant-homes/:venueId/popup route
    - Add GET /api/v1/map/venues route with filter validation
    - Add GET /api/v1/map/venues/:id/popup route
    - Restrict all routes to authenticated users
    - Add cache headers (Cache-Control: public, max-age=60) for marker endpoints
    - _Requirements: 27.1, 27.4, 27.6, 27.9, 27.11, 27.14, 27.22_

  - [x] 45.8 Create validation schemas for map data endpoints
    - Create MapActivityMarkersQuerySchema with optional filter arrays
    - Create MapParticipantHomeMarkersQuerySchema with optional filter arrays
    - Create MapVenueMarkersQuerySchema with optional filter arrays
    - Use Zod preprocess for array parameter normalization
    - _Requirements: 27.18, 27.19_

  - [x] 45.9 Add database indexes for map query optimization
    - Create index on venues (latitude, longitude) for coordinate queries
    - Create index on activityVenueHistory (activityId, effectiveFrom) for current venue determination
    - Create index on participantAddressHistory (participantId, effectiveFrom) for current home determination
    - Create Prisma migration for index creation
    - _Requirements: 27.20_

  - [x] 45.10 Update OpenAPI documentation
    - Document all six map data endpoints
    - Include request parameters and response schemas
    - Provide examples for marker and popup responses
    - Document cache headers
    - _Requirements: 27.1, 27.4, 27.6, 27.9, 27.11, 27.14_

  - [ ]* 45.11 Write property tests for map data endpoints
    - **Property 212: Activity Marker Lightweight Response**
    - **Property 213: Activity Popup Content Completeness**
    - **Property 214: Participant Home Marker Grouping**
    - **Property 215: Participant Home Popup Content**
    - **Property 216: Venue Marker Lightweight Response**
    - **Property 217: Venue Popup Content Completeness**
    - **Property 218: Map Data Geographic Authorization**
    - **Property 219: Map Data Filter Application**
    - **Property 220: Coordinate Exclusion for Missing Data**
    - **Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9, 27.10, 27.11, 27.12, 27.13, 27.14, 27.15, 27.16, 27.17, 27.18, 27.19, 27.23, 27.24, 27.25, 27.26**

- [ ] 46. Checkpoint - Verify map data API endpoints
  - Ensure all tests pass, ask the user if questions arise.
  - Test activity markers endpoint with various filters
  - Test popup content endpoints return correct data
  - Test participant home grouping by venue
  - Verify geographic authorization is applied
  - Verify coordinates are excluded when null
  - Test performance with large datasets
