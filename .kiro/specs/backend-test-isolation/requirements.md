# Requirements: Integration Test Isolation and Parallel Execution

## Overview

This document specifies requirements for improving integration test isolation in the backend API to enable reliable parallel test execution. The current implementation has several isolation issues that cause flaky tests when running concurrently.

## Glossary

- **Test_Isolation**: The property that each test can run independently without affecting or being affected by other tests
- **Parallel_Execution**: Running multiple test files simultaneously to reduce total test execution time
- **Database_Pollution**: When test data from one test affects the results of another test
- **Shared_State**: Data or resources that multiple tests access simultaneously, causing race conditions
- **Test_Database**: A separate database instance used exclusively for running tests
- **Transaction_Rollback**: A technique where each test runs in a database transaction that is rolled back after the test completes
- **Unique_Test_Data**: Test data with unique identifiers (timestamps, UUIDs) to prevent conflicts between parallel tests
- **Predefined_Data**: Seed data that exists in the database before tests run (activity categories, types, roles)
- **Test_Fixture**: Reusable test data setup code that creates consistent test scenarios
- **Cleanup_Order**: The sequence in which test data must be deleted to respect foreign key constraints

## Current Problems

### Problem 1: Shared Predefined Data Access

**Issue:** Multiple tests query predefined data (activity categories, types, roles) using `findFirst()` without filters, causing race conditions when tests run in parallel.

**Example:**
```typescript
// Test A and Test B both run this simultaneously
const activityType = await prisma.activityType.findFirst();
```

**Impact:** Tests may get different activity types depending on timing, causing unpredictable results.

### Problem 2: Non-Unique Test Data Names

**Issue:** Some tests create data with static names that can conflict when tests run in parallel.

**Example:**
```typescript
// Multiple tests create this simultaneously
await prisma.geographicArea.create({
    data: { name: 'Test City', areaType: 'CITY' }
});
```

**Impact:** Unique constraint violations or tests operating on wrong data.

### Problem 3: Incomplete Cleanup

**Issue:** Some tests don't clean up all created data, leaving orphaned records that affect subsequent test runs.

**Example:**
```typescript
afterAll(async () => {
    // Cleans up activities but forgets activityVenueHistory
    await prisma.activity.deleteMany({ where: { id: activityId } });
});
```

**Impact:** Foreign key constraint violations, database pollution, incorrect test results.

### Problem 4: Cleanup Order Violations

**Issue:** Tests delete data in wrong order, causing foreign key constraint violations.

**Example:**
```typescript
// WRONG: Tries to delete parent before children
await prisma.geographicArea.deleteMany({ where: { id: parentId } });
await prisma.venue.deleteMany({ where: { geographicAreaId: parentId } });
```

**Impact:** Cleanup fails, leaving orphaned data.

### Problem 5: Shared Test User

**Issue:** Some tests use a single test user created in `beforeAll`, causing conflicts when tests modify user state in parallel.

**Example:**
```typescript
beforeAll(async () => {
    testUser = await prisma.user.create({ ... });
});

// Test A modifies user
it('test A', async () => {
    await prisma.user.update({ where: { id: testUser.id }, data: { role: 'EDITOR' } });
});

// Test B expects original user state
it('test B', async () => {
    expect(testUser.role).toBe('ADMINISTRATOR'); // FAILS if Test A ran first
});
```

**Impact:** Tests fail depending on execution order.

## Requirements

### Requirement 1: Unique Test Data Identifiers

**User Story:** As a developer, I want all test data to have unique identifiers, so that parallel tests don't conflict with each other.

#### Acceptance Criteria

1. ALL integration tests SHALL use timestamps or UUIDs in test data names to ensure uniqueness
2. WHEN creating geographic areas, THE test SHALL include `Date.now()` or UUID in the name
3. WHEN creating venues, THE test SHALL include `Date.now()` or UUID in the name
4. WHEN creating participants, THE test SHALL include `Date.now()` or UUID in the name
5. WHEN creating activities, THE test SHALL include `Date.now()` or UUID in the name
6. WHEN creating users, THE test SHALL include `Date.now()` in the email address
7. WHEN creating activity categories (non-predefined), THE test SHALL include `Date.now()` in the name
8. WHEN creating activity types (non-predefined), THE test SHALL include `Date.now()` in the name
9. WHEN creating roles (non-predefined), THE test SHALL include `Date.now()` in the name
10. THE unique identifier SHALL be generated once per test suite in `beforeAll` and reused across tests in that suite
11. THE unique identifier SHALL NOT be shared between different test files

### Requirement 2: Deterministic Predefined Data Access

**User Story:** As a developer, I want tests to access predefined data deterministically, so that parallel tests don't interfere with each other.

#### Acceptance Criteria

1. WHEN accessing predefined activity categories, THE test SHALL query by specific name (e.g., "Study Circles") instead of using `findFirst()`
2. WHEN accessing predefined activity types, THE test SHALL query by specific name (e.g., "Ruhi Book 01") instead of using `findFirst()`
3. WHEN accessing predefined roles, THE test SHALL query by specific name (e.g., "Tutor") instead of using `findFirst()`
4. WHEN a predefined entity is not found, THE test SHALL throw a descriptive error indicating which entity is missing
5. THE test SHALL NOT modify predefined data (categories, types, roles with `isPredefined: true`)
6. WHEN a test needs a custom activity type or category, THE test SHALL create a non-predefined entity with a unique name
7. ALL queries for predefined data SHALL use `findUnique({ where: { name: 'Specific Name' } })` or `findFirst({ where: { name: 'Specific Name' } })`

### Requirement 3: Complete and Ordered Cleanup

**User Story:** As a developer, I want all test data to be cleaned up completely and in the correct order, so that tests don't leave orphaned data.

#### Acceptance Criteria

1. ALL integration tests SHALL clean up ALL created data in `afterAll` or `afterEach` hooks
2. THE cleanup SHALL delete data in reverse dependency order (children before parents):
   - Assignment → Activity/Participant/Role
   - ActivityVenueHistory → Activity/Venue
   - ParticipantAddressHistory → Participant/Venue
   - ParticipantPopulation → Participant/Population
   - Activity → ActivityType
   - ActivityType → ActivityCategory
   - Venue → GeographicArea
   - GeographicArea → ParentGeographicArea
   - UserGeographicAuthorization → User/GeographicArea
3. WHEN deleting assignments, THE test SHALL delete them before deleting activities or participants
4. WHEN deleting activity venue history, THE test SHALL delete it before deleting activities or venues
5. WHEN deleting participant address history, THE test SHALL delete it before deleting participants or venues
6. WHEN deleting activities, THE test SHALL delete them before deleting activity types
7. WHEN deleting activity types, THE test SHALL delete them before deleting activity categories
8. WHEN deleting venues, THE test SHALL delete them before deleting geographic areas
9. WHEN deleting child geographic areas, THE test SHALL delete them before deleting parent geographic areas
10. WHEN deleting user geographic authorizations, THE test SHALL delete them before deleting users or geographic areas
11. THE test SHALL store IDs of ALL created entities in variables for cleanup
12. THE test SHALL use `deleteMany({ where: { id: { in: [id1, id2, ...] } } })` for batch cleanup
13. THE test SHALL disconnect Prisma client in `afterAll` hook
14. WHEN cleanup fails, THE test SHALL log the error but not throw (to allow other cleanup to proceed)

### Requirement 4: Test-Specific Users

**User Story:** As a developer, I want each test suite to create its own test users, so that parallel tests don't share user state.

#### Acceptance Criteria

1. WHEN a test needs a user, THE test SHALL create a unique user in `beforeAll` or `beforeEach`
2. THE test user email SHALL include `Date.now()` or UUID to ensure uniqueness
3. THE test SHALL NOT reuse users from other test files
4. THE test SHALL clean up created users in `afterAll` or `afterEach`
5. WHEN a test modifies user state (role, authorization rules, lastInvalidationTimestamp), THE test SHALL either:
   - Create the user in `beforeEach` and clean up in `afterEach` (isolated per test)
   - OR reset the user state in `afterEach` to original values
6. THE test SHALL NOT assume any specific user exists in the database except predefined seed data

### Requirement 5: Test Helper Utilities

**User Story:** As a developer, I want reusable test helper utilities, so that I can write tests more efficiently with consistent patterns.

#### Acceptance Criteria

1. THE test suite SHALL provide a `TestHelpers` utility module with common test operations
2. THE TestHelpers SHALL provide `createTestUser(prisma, role, uniqueSuffix?)` method that creates a unique test user
3. THE TestHelpers SHALL provide `createTestGeographicHierarchy(prisma, uniqueSuffix?)` method that creates a standard geographic area hierarchy
4. THE TestHelpers SHALL provide `createTestActivity(prisma, activityTypeId, venueId, uniqueSuffix?)` method that creates a unique test activity
5. THE TestHelpers SHALL provide `createTestParticipant(prisma, venueId, uniqueSuffix?)` method that creates a unique test participant
6. THE TestHelpers SHALL provide `cleanupTestData(prisma, options)` method that deletes test data in correct order
7. THE cleanupTestData method SHALL accept options specifying which entity IDs to delete
8. THE cleanupTestData method SHALL handle foreign key constraints by deleting in correct order
9. THE cleanupTestData method SHALL catch and log errors without throwing
10. ALL helper methods SHALL use unique identifiers (timestamps, UUIDs) in generated data
11. THE TestHelpers SHALL provide `getPredefinedActivityType(prisma, name)` method that safely retrieves predefined types
12. THE TestHelpers SHALL provide `getPredefinedRole(prisma, name)` method that safely retrieves predefined roles

### Requirement 6: Database Transaction Isolation (Optional Enhancement)

**User Story:** As a developer, I want each test to run in a database transaction that rolls back automatically, so that tests are completely isolated without manual cleanup.

#### Acceptance Criteria

1. THE test framework MAY provide a `withTransaction(testFn)` helper that wraps tests in transactions
2. WHEN using transaction isolation, THE test SHALL run all database operations within a transaction
3. WHEN the test completes, THE transaction SHALL be rolled back automatically
4. THE transaction isolation SHALL work with Prisma's transaction API
5. THE transaction isolation SHALL be optional - tests can opt-in via helper function
6. WHEN transaction isolation is used, THE test SHALL NOT need manual cleanup in `afterEach`
7. THE transaction isolation SHALL handle nested transactions correctly

**Note:** This is an optional enhancement. The primary approach is unique test data + proper cleanup.

### Requirement 7: Parallel Execution Configuration

**User Story:** As a developer, I want Jest configured for optimal parallel execution, so that tests run fast while maintaining isolation.

#### Acceptance Criteria

1. THE jest.config.js SHALL enable parallel execution by removing or commenting out `maxWorkers: 1`
2. THE jest.config.js SHALL use `maxWorkers: '50%'` to utilize half of available CPU cores
3. THE jest.config.js SHALL set appropriate test timeout (15000ms for integration tests)
4. THE test setup SHALL verify database connection before running tests
5. THE test setup SHALL run migrations once before all tests (not per test file)
6. WHEN tests run in parallel, EACH test file SHALL create its own PrismaClient instance
7. WHEN tests run in parallel, EACH test file SHALL disconnect its PrismaClient in `afterAll`

### Requirement 8: Test Naming Conventions

**User Story:** As a developer, I want consistent test naming conventions, so that test data is easily identifiable and debuggable.

#### Acceptance Criteria

1. ALL test data names SHALL include a descriptive prefix indicating the test context
2. THE prefix SHALL be unique per test file (e.g., "RoleDateTest", "MapOptTest", "GeoAuthTest")
3. THE prefix SHALL be combined with entity type and timestamp (e.g., "RoleDateTest Participant 1 - ${Date.now()}")
4. WHEN debugging, THE developer SHALL be able to identify which test created data by examining the name
5. THE test SHALL use consistent naming patterns across all entity types

### Requirement 9: Isolation Verification

**User Story:** As a developer, I want to verify that tests are properly isolated, so that I can catch isolation issues early.

#### Acceptance Criteria

1. THE test suite SHALL provide a script to verify test isolation
2. THE verification script SHALL run tests multiple times in different orders
3. THE verification script SHALL detect if test results change based on execution order
4. THE verification script SHALL report any tests that fail isolation checks
5. THE test suite SHALL include a pre-commit hook that runs isolation verification
6. WHEN isolation issues are detected, THE script SHALL provide actionable guidance on fixing them

### Requirement 10: Documentation and Examples

**User Story:** As a developer, I want clear documentation and examples for writing isolated tests, so that I can write tests correctly the first time.

#### Acceptance Criteria

1. THE test README SHALL document all isolation requirements
2. THE test README SHALL provide examples of properly isolated tests
3. THE test README SHALL document common isolation pitfalls and how to avoid them
4. THE test README SHALL document the TestHelpers API with usage examples
5. THE test README SHALL document the correct cleanup order for all entity types
6. THE test README SHALL include a checklist for reviewing test isolation
7. THE test README SHALL document how to debug isolation issues

## Implementation Priority

**Phase 1 (Critical):**
- Requirement 1: Unique Test Data Identifiers
- Requirement 2: Deterministic Predefined Data Access
- Requirement 3: Complete and Ordered Cleanup
- Requirement 7: Parallel Execution Configuration

**Phase 2 (Important):**
- Requirement 4: Test-Specific Users
- Requirement 5: Test Helper Utilities
- Requirement 8: Test Naming Conventions

**Phase 3 (Optional):**
- Requirement 6: Database Transaction Isolation
- Requirement 9: Isolation Verification
- Requirement 10: Documentation and Examples

## Success Criteria

1. ALL integration tests pass when run in parallel with `maxWorkers: '50%'`
2. Tests produce consistent results regardless of execution order
3. No database pollution between test runs
4. Test execution time reduced by 50% or more compared to sequential execution
5. Zero flaky test failures in CI/CD pipeline
