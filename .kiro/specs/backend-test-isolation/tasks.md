# Implementation Plan: Integration Test Isolation and Parallel Execution

## Overview

This implementation plan addresses test isolation issues in the backend API integration tests to enable reliable parallel test execution. The plan focuses on eliminating shared state, ensuring unique test data, and providing proper cleanup mechanisms.

## Tasks

- [x] 1. Create TestHelpers utility module
  - [x] 1.1 Create test-helpers.ts file
    - Create `src/__tests__/utils/test-helpers.ts`
    - Export TestHelpers class with static methods
    - _Requirements: 5.1_

  - [x] 1.2 Implement createTestUser helper
    - Accept prisma, role, and optional uniqueSuffix parameters
    - Generate unique email using `test-user-${suffix}@example.com` pattern
    - Create user with provided role and test password hash
    - Return created user object
    - _Requirements: 5.2, 4.1, 4.2_

  - [x] 1.3 Implement createTestGeographicHierarchy helper
    - Accept prisma and optional uniqueSuffix parameters
    - Create 4-level hierarchy: country → province → city → neighbourhood
    - Use unique names with suffix for all areas
    - Return object with all created IDs
    - _Requirements: 5.3_

  - [x] 1.4 Implement getPredefinedActivityType helper
    - Accept prisma and activity type name
    - Query by name with `isPredefined: true` filter
    - Throw descriptive error if not found
    - Return activity type object
    - _Requirements: 5.11, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.5 Implement getPredefinedRole helper
    - Accept prisma and role name
    - Query by name (roles don't have isPredefined flag)
    - Throw descriptive error if not found
    - Return role object
    - _Requirements: 5.12, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.6 Implement cleanupTestData helper
    - Accept prisma and options object with entity ID arrays
    - Delete data in correct dependency order (see design doc)
    - Use try-catch to handle errors without throwing
    - Log errors for debugging
    - Handle geographic areas by deleting children before parents
    - _Requirements: 5.6, 5.7, 5.8, 5.9, 3.1, 3.2, 3.3-3.13_

  - [x] 1.7 Implement safeDelete helper
    - Accept async delete function
    - Execute function in try-catch block
    - Log errors without throwing
    - _Requirements: 3.14_

  - [x] 1.8 Export TestHelpers from utils index
    - Update `src/__tests__/utils/index.ts` to export TestHelpers
    - Ensure easy import: `import { TestHelpers } from '../utils'`
    - _Requirements: 5.1_

  - [ ]* 1.9 Write unit tests for TestHelpers
    - Test createTestUser generates unique emails
    - Test createTestGeographicHierarchy creates correct structure
    - Test getPredefinedActivityType throws on missing type
    - Test getPredefinedRole throws on missing role
    - Test cleanupTestData handles errors gracefully
    - Test cleanupTestData deletes in correct order
    - **Validates: Requirements 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.11, 5.12**

- [x] 2. Update participant-role-date-filtering.test.ts
  - [x] 2.1 Add unique test suffix
    - Add `const testSuffix = Date.now();` at top of describe block
    - _Requirements: 1.1, 1.10_

  - [x] 2.2 Update geographic area creation
    - Change name to `RoleDateTest City ${testSuffix}`
    - _Requirements: 1.2, 8.1, 8.2, 8.3_

  - [x] 2.3 Update venue creation
    - Change name to `RoleDateTest Venue ${testSuffix}`
    - _Requirements: 1.3, 8.1, 8.2, 8.3_

  - [x] 2.4 Update participant creation
    - Change names to include testSuffix: `RoleDateTest Participant 1 ${testSuffix}`
    - _Requirements: 1.4, 8.1, 8.2, 8.3_

  - [x] 2.5 Update activity creation
    - Change names to include testSuffix: `Activity 1 ${testSuffix}`
    - _Requirements: 1.5, 8.1, 8.2, 8.3_

  - [x] 2.6 Replace custom roles with predefined roles
    - Remove role creation code
    - Use `TestHelpers.getPredefinedRole(prisma, 'Tutor')`
    - Use `TestHelpers.getPredefinedRole(prisma, 'Teacher')`
    - Use `TestHelpers.getPredefinedRole(prisma, 'Participant')`
    - Remove role cleanup code
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 2.7 Replace custom activity type with predefined
    - Remove activity type and category creation
    - Use `TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01')`
    - Remove activity type and category cleanup
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 2.8 Verify cleanup order
    - Ensure assignments deleted before activities/participants
    - Ensure venue history deleted before activities/venues
    - Ensure address history deleted before participants/venues
    - Ensure activities deleted before activity types
    - Ensure venues deleted before geographic areas
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 3. Update map-data-optimized.test.ts
  - [x] 3.1 Add unique test suffix
    - Add `const testSuffix = Date.now();`
    - _Requirements: 1.1, 1.10_

  - [x] 3.2 Update user creation
    - Use `TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', testSuffix)`
    - _Requirements: 1.6, 4.1, 4.2_

  - [x] 3.3 Update geographic area creation
    - Change name to `MapOptTest Area ${testSuffix}`
    - _Requirements: 1.2, 8.1, 8.2, 8.3_

  - [x] 3.4 Replace findFirst with deterministic query
    - Use `TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01')`
    - Remove `findFirst()` calls
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Update venue creation
    - Add testSuffix to venue names: `Venue 1 ${testSuffix}`
    - _Requirements: 1.3, 8.1, 8.2, 8.3_

  - [x] 3.6 Update activity creation
    - Add testSuffix to activity names: `Activity 1 ${testSuffix}`
    - _Requirements: 1.5, 8.1, 8.2, 8.3_

- [x] 4. Update geographic-authorization-comprehensive.test.ts
  - [x] 4.1 Add unique test suffix
    - Add `const testSuffix = Date.now();`
    - _Requirements: 1.1, 1.10_

  - [x] 4.2 Update user creation
    - Use `TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix)`
    - _Requirements: 1.6, 4.1, 4.2_

  - [x] 4.3 Update geographic area creation
    - Add testSuffix to all area names
    - Use pattern: `GeoAuthTest Country ${testSuffix}`
    - _Requirements: 1.2, 8.1, 8.2, 8.3_

  - [x] 4.4 Update nested test data creation
    - Add testSuffix to venue, participant, activity names in beforeEach
    - Use pattern: `GeoAuthTest Venue ${testSuffix}`
    - _Requirements: 1.3, 1.4, 1.5, 8.1, 8.2, 8.3_

  - [x] 4.5 Replace custom activity type with predefined
    - Use `TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01')`
    - Remove activity type and category creation/cleanup
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 5. Update grouped-engagement-metrics.test.ts
  - [x] 5.1 Add unique test suffix
    - Add `const testSuffix = Date.now();`
    - _Requirements: 1.1, 1.10_

  - [x] 5.2 Update all entity names with testSuffix
    - Geographic areas: `Test Area ${testSuffix}`
    - Venues: `Test Venue Grouped ${testSuffix}`
    - Participants: `Test Participant ${testSuffix}`
    - Activities: `Test Activity ${testSuffix}`
    - Populations: `Test Population ${testSuffix}`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3_

  - [x] 5.3 Keep predefined data queries (already correct)
    - Queries already use specific names ("Study Circles", "Ruhi Book 01", etc.)
    - No changes needed
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 5.4 Verify cleanup completeness
    - Ensure all created entities are cleaned up
    - Check for orphaned venue history and address history
    - _Requirements: 3.1, 3.11_

- [x] 6. Update map-data-temporal-filtering.test.ts
  - [x] 6.1 Add unique test suffix
    - _Requirements: 1.1, 1.10_

  - [x] 6.2 Update all entity names with testSuffix
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3_

  - [x] 6.3 Replace findFirst with deterministic queries
    - Use TestHelpers for predefined data access
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.4 Verify cleanup order and completeness
    - _Requirements: 3.1, 3.2, 3.11_

- [x] 7. Update geographic-authorization-deny.test.ts
  - [x] 7.1 Add unique test suffix and update entity names
    - _Requirements: 1.1, 1.2, 1.10, 8.1, 8.2, 8.3_

  - [x] 7.2 Use TestHelpers for user creation
    - _Requirements: 4.1, 4.2, 5.2_

- [x] 8. Update pii-restricted-role.test.ts
  - [x] 8.1 Add unique test suffix and update entity names
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.10, 8.1, 8.2, 8.3_

  - [x] 8.2 Replace findFirst with deterministic query
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 8.3 Use TestHelpers for user creation
    - _Requirements: 4.1, 4.2, 5.2_

- [x] 9. Update remaining integration test files
  - [x] 9.1 Update geographic-area-ancestral-lineage.test.ts
  - [x] 9.2 Update geographic-area-batch-endpoints.test.ts
  - [x] 9.3 Update geographic-area-children-filter.test.ts
  - [x] 9.4 Update geographic-area-depth-authorization.test.ts
  - [x] 9.5 Update geographic-area-depth-pagination.test.ts
  - [x] 9.6 Update geographic-area-filter-scope.test.ts
  - [x] 9.7 Update geographic-area-flexible-filtering.test.ts
  - [x] 9.8 Update geographic-area-venues-filtering.test.ts
  - [x] 9.9 Update geographic-authorization.integration.test.ts
  - [x] 9.10 Update geographic-breakdown-authorization.test.ts
  - [x] 9.11 Update growth-additional-participant-count.test.ts
  - [x] 9.12 Update individual-resource-authorization.test.ts
  - [x] 9.13 Update map-data-coordinate-filtering.test.ts
  - [x] 9.14 Update map-data-large-hierarchy.test.ts
  - [x] 9.15 Update participant-population-filtering.test.ts
  - [x] 9.16 Update token-invalidation.test.ts
  - [x] 9.17 Update user-profile.test.ts
  - [x] 9.18 Update activity-notes.test.ts
  - [x] 9.19 Update activity-updated-at-filter.test.ts
  - [x] 9.20 Update additional-participant-count.test.ts
  - [x] 9.21 Update batch-descendants.test.ts
  - [x] 9.22 Update filter-parsing-e2e.test.ts
  - [x] 9.23 Update flexible-filtering.test.ts
  - [x] 9.24 Update analytics-deny-authorization.test.ts
  - _Requirements: 1.1-1.11, 2.1-2.7, 3.1-3.14, 4.1-4.6, 8.1-8.5_

- [x] 10. Enable parallel execution in Jest configuration
  - [x] 10.1 Update jest.config.js
    - Remove or comment out `maxWorkers: 1` line
    - Add `maxWorkers: '50%'` to use half of CPU cores
    - Verify testTimeout is set to 15000ms
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.2 Verify test setup
    - Ensure migrations run once before all tests
    - Ensure each test file creates its own PrismaClient
    - Ensure each test file disconnects in afterAll
    - _Requirements: 7.4, 7.5, 7.6, 7.7_

- [x] 11. Run parallel test verification
  - [x] 11.1 Run tests multiple times sequentially
    - Execute: `for i in {1..5}; do npm test -- --testPathPattern="integration"; done`
    - Verify all tests pass consistently
    - _Requirements: 9.2, 9.3_

  - [x] 11.2 Run tests in parallel
    - Execute: `npm test -- --testPathPattern="integration" --maxWorkers=4`
    - Verify all tests pass
    - Check for any flaky failures
    - _Requirements: 7.1, 7.2_

  - [x] 11.3 Run tests with randomized order
    - Execute: `npm test -- --testPathPattern="integration" --runInBand --randomize`
    - Verify results are consistent regardless of order
    - _Requirements: 9.2, 9.3_

  - [x] 11.4 Measure performance improvement
    - Measure sequential execution time (maxWorkers=1)
    - Measure parallel execution time (maxWorkers=50%)
    - Calculate improvement percentage
    - Verify meets 50% improvement target
    - _Requirements: Success Criteria_

- [x] 12. Update test documentation
  - [x] 12.1 Update test README
    - Document unique identifier requirements
    - Document predefined data access patterns
    - Document cleanup order requirements
    - Document TestHelpers API with examples
    - Add test isolation checklist
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 12.2 Add isolation debugging guide
    - Document how to identify isolation issues
    - Document how to debug flaky tests
    - Provide troubleshooting steps
    - _Requirements: 10.7_

  - [x] 12.3 Create test template
    - Provide template for new integration tests
    - Include all isolation best practices
    - Include TestHelpers usage examples
    - _Requirements: 10.2_

- [x] 13. Checkpoint - Verify all tests pass in parallel
  - Run full test suite with parallel execution
  - Verify zero flaky failures
  - Verify performance improvement achieved
  - Ask user if questions arise

## Implementation Notes

### Priority Order for Test Updates

**Phase 1 (High Risk - Update First):**
1. participant-role-date-filtering.test.ts - Creates custom roles, uses static names
2. map-data-optimized.test.ts - Uses findFirst() without filters
3. geographic-authorization-comprehensive.test.ts - Modifies shared user state
4. grouped-engagement-metrics.test.ts - Complex test data, uses findFirst()

**Phase 2 (Medium Risk):**
5. map-data-temporal-filtering.test.ts
6. geographic-area-*.test.ts files
7. pii-restricted-role.test.ts
8. token-invalidation.test.ts

**Phase 3 (Lower Risk):**
9. Remaining integration tests

### Testing Strategy

After each phase:
1. Run tests sequentially to verify correctness
2. Run tests in parallel to verify isolation
3. Run tests multiple times to catch intermittent failures
4. Check database for orphaned test data

### Rollback Plan

If parallel execution causes issues:
1. Revert jest.config.js to `maxWorkers: 1`
2. Continue with test updates
3. Re-enable parallel execution after all tests updated

### Success Metrics

- [ ] All integration tests pass with `maxWorkers: '50%'`
- [ ] Zero flaky test failures in 10 consecutive runs
- [ ] Test execution time reduced by 50% or more
- [ ] No orphaned test data in database after test runs
- [ ] All tests use unique identifiers
- [ ] All tests use deterministic predefined data access
- [ ] All tests have complete cleanup

## Example: Before and After

### Before (Problematic)

```typescript
describe('My Test', () => {
    let activityTypeId: string;
    
    beforeAll(async () => {
        // ❌ Non-deterministic
        const activityType = await prisma.activityType.findFirst();
        activityTypeId = activityType!.id;
        
        // ❌ Static name - conflicts with parallel tests
        await prisma.geographicArea.create({
            data: { name: 'Test City', areaType: 'CITY' }
        });
    });
    
    afterAll(async () => {
        // ❌ Incomplete cleanup - missing venue history
        await prisma.activity.deleteMany({ ... });
        await prisma.geographicArea.deleteMany({ ... });
    });
});
```

### After (Isolated)

```typescript
describe('My Test', () => {
    const testSuffix = Date.now();
    let activityTypeId: string;
    let geographicAreaId: string;
    let activityIds: string[] = [];
    
    beforeAll(async () => {
        // ✅ Deterministic
        const activityType = await TestHelpers.getPredefinedActivityType(
            prisma,
            'Ruhi Book 01'
        );
        activityTypeId = activityType.id;
        
        // ✅ Unique name
        const area = await prisma.geographicArea.create({
            data: {
                name: `MyTest City ${testSuffix}`,
                areaType: 'CITY'
            }
        });
        geographicAreaId = area.id;
    });
    
    afterAll(async () => {
        // ✅ Complete cleanup in correct order
        await TestHelpers.cleanupTestData(prisma, {
            activityIds,
            geographicAreaIds: [geographicAreaId]
        });
        await prisma.$disconnect();
    });
});
```

## Verification Commands

```bash
# Run tests sequentially (baseline)
npm test -- --testPathPattern="integration" --runInBand

# Run tests in parallel
npm test -- --testPathPattern="integration" --maxWorkers=4

# Run specific test file multiple times
for i in {1..10}; do
  npm test -- --testPathPattern="participant-role-date-filtering.test.ts"
done

# Check for orphaned test data
psql cultivate_test -c "SELECT * FROM participants WHERE name LIKE '%Test%';"
psql cultivate_test -c "SELECT * FROM activities WHERE name LIKE '%Test%';"
psql cultivate_test -c "SELECT * FROM geographic_areas WHERE name LIKE '%Test%';"
```
