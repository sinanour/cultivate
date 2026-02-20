# Design Document: Integration Test Isolation and Parallel Execution

## Overview

This design document describes the implementation of test isolation improvements for the backend API integration tests. The solution enables reliable parallel test execution by eliminating shared state, ensuring unique test data, and providing proper cleanup mechanisms.

## Design Rationale

**Why Unique Identifiers:** Using timestamps or UUIDs in test data names prevents conflicts when multiple tests create similar entities simultaneously. This is simpler than database transaction isolation and works with existing Prisma patterns.

**Why Deterministic Predefined Data Access:** Querying predefined data by specific name instead of `findFirst()` ensures tests get the exact entity they expect, regardless of what other tests are doing.

**Why Test Helper Utilities:** Centralizing common test operations reduces code duplication, ensures consistent patterns, and makes it easier to update isolation strategies across all tests.

**Why Proper Cleanup Order:** Respecting foreign key constraints during cleanup prevents constraint violations and ensures complete data removal.

## Architecture

### Test Data Isolation Strategy

Each test file creates its own isolated test data with unique identifiers:

```typescript
describe('My Integration Test', () => {
    let prisma: PrismaClient;
    const testSuffix = Date.now(); // Unique per test file
    
    beforeAll(async () => {
        prisma = new PrismaClient();
        
        // Create test data with unique names
        const area = await prisma.geographicArea.create({
            data: {
                name: `MyTest Area ${testSuffix}`,
                areaType: 'CITY'
            }
        });
    });
    
    afterAll(async () => {
        // Clean up in reverse dependency order
        await prisma.venue.deleteMany({
            where: { name: { contains: `MyTest` } }
        });
        await prisma.geographicArea.deleteMany({
            where: { name: { contains: `MyTest` } }
        });
        await prisma.$disconnect();
    });
});
```

### Predefined Data Access Pattern

Replace non-deterministic `findFirst()` with specific name queries:

```typescript
// ❌ WRONG: Non-deterministic
const activityType = await prisma.activityType.findFirst();

// ✅ CORRECT: Deterministic
const activityType = await prisma.activityType.findFirst({
    where: { name: 'Ruhi Book 01' }
});
if (!activityType) {
    throw new Error('Predefined activity type "Ruhi Book 01" not found');
}
```

### Test Helper Utilities

Create a centralized `TestHelpers` module:

```typescript
// src/__tests__/utils/test-helpers.ts

export class TestHelpers {
    /**
     * Create a unique test user
     */
    static async createTestUser(
        prisma: PrismaClient,
        role: 'ADMINISTRATOR' | 'EDITOR' | 'READ_ONLY' = 'EDITOR',
        uniqueSuffix?: string
    ) {
        const suffix = uniqueSuffix || Date.now();
        return await prisma.user.create({
            data: {
                email: `test-user-${suffix}@example.com`,
                passwordHash: 'test-hash',
                role
            }
        });
    }

    /**
     * Create a standard geographic hierarchy
     * Returns: { countryId, provinceId, cityId, neighbourhoodId }
     */
    static async createTestGeographicHierarchy(
        prisma: PrismaClient,
        uniqueSuffix?: string
    ) {
        const suffix = uniqueSuffix || Date.now();
        
        const country = await prisma.geographicArea.create({
            data: { name: `Test Country ${suffix}`, areaType: 'COUNTRY' }
        });
        
        const province = await prisma.geographicArea.create({
            data: {
                name: `Test Province ${suffix}`,
                areaType: 'PROVINCE',
                parentGeographicAreaId: country.id
            }
        });
        
        const city = await prisma.geographicArea.create({
            data: {
                name: `Test City ${suffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: province.id
            }
        });
        
        const neighbourhood = await prisma.geographicArea.create({
            data: {
                name: `Test Neighbourhood ${suffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: city.id
            }
        });
        
        return {
            countryId: country.id,
            provinceId: province.id,
            cityId: city.id,
            neighbourhoodId: neighbourhood.id
        };
    }

    /**
     * Get predefined activity type by name
     */
    static async getPredefinedActivityType(
        prisma: PrismaClient,
        name: string
    ) {
        const activityType = await prisma.activityType.findFirst({
            where: { name, isPredefined: true }
        });
        
        if (!activityType) {
            throw new Error(`Predefined activity type "${name}" not found`);
        }
        
        return activityType;
    }

    /**
     * Get predefined role by name
     */
    static async getPredefinedRole(
        prisma: PrismaClient,
        name: string
    ) {
        const role = await prisma.role.findFirst({
            where: { name }
        });
        
        if (!role) {
            throw new Error(`Predefined role "${name}" not found`);
        }
        
        return role;
    }

    /**
     * Clean up test data in correct order
     */
    static async cleanupTestData(
        prisma: PrismaClient,
        options: {
            assignmentIds?: string[];
            activityIds?: string[];
            participantIds?: string[];
            venueIds?: string[];
            geographicAreaIds?: string[];
            activityTypeIds?: string[];
            activityCategoryIds?: string[];
            roleIds?: string[];
            userIds?: string[];
            populationIds?: string[];
        }
    ) {
        try {
            // Delete in reverse dependency order
            
            // 1. Assignments (references activities, participants, roles)
            if (options.assignmentIds?.length) {
                await prisma.assignment.deleteMany({
                    where: { id: { in: options.assignmentIds } }
                });
            }
            
            // 2. Activity venue history (references activities, venues)
            if (options.activityIds?.length) {
                await prisma.activityVenueHistory.deleteMany({
                    where: { activityId: { in: options.activityIds } }
                });
            }
            
            // 3. Participant address history (references participants, venues)
            if (options.participantIds?.length) {
                await prisma.participantAddressHistory.deleteMany({
                    where: { participantId: { in: options.participantIds } }
                });
            }
            
            // 4. Participant populations (references participants, populations)
            if (options.participantIds?.length) {
                await prisma.participantPopulation.deleteMany({
                    where: { participantId: { in: options.participantIds } }
                });
            }
            
            // 5. Activities (references activity types)
            if (options.activityIds?.length) {
                await prisma.activity.deleteMany({
                    where: { id: { in: options.activityIds } }
                });
            }
            
            // 6. Participants
            if (options.participantIds?.length) {
                await prisma.participant.deleteMany({
                    where: { id: { in: options.participantIds } }
                });
            }
            
            // 7. Venues (references geographic areas)
            if (options.venueIds?.length) {
                await prisma.venue.deleteMany({
                    where: { id: { in: options.venueIds } }
                });
            }
            
            // 8. Activity types (references activity categories)
            if (options.activityTypeIds?.length) {
                await prisma.activityType.deleteMany({
                    where: { id: { in: options.activityTypeIds } }
                });
            }
            
            // 9. Activity categories
            if (options.activityCategoryIds?.length) {
                await prisma.activityCategory.deleteMany({
                    where: { id: { in: options.activityCategoryIds } }
                });
            }
            
            // 10. Roles
            if (options.roleIds?.length) {
                await prisma.role.deleteMany({
                    where: { id: { in: options.roleIds } }
                });
            }
            
            // 11. Populations
            if (options.populationIds?.length) {
                await prisma.population.deleteMany({
                    where: { id: { in: options.populationIds } }
                });
            }
            
            // 12. User geographic authorizations (references users, geographic areas)
            if (options.userIds?.length) {
                await prisma.userGeographicAuthorization.deleteMany({
                    where: { userId: { in: options.userIds } }
                });
            }
            
            // 13. Geographic areas (delete children before parents)
            if (options.geographicAreaIds?.length) {
                // Sort by depth (deepest first) - assumes IDs are in creation order
                const sortedIds = [...options.geographicAreaIds].reverse();
                for (const id of sortedIds) {
                    await prisma.geographicArea.deleteMany({
                        where: { id }
                    });
                }
            }
            
            // 14. Users
            if (options.userIds?.length) {
                await prisma.user.deleteMany({
                    where: { id: { in: options.userIds } }
                });
            }
        } catch (error) {
            console.error('Cleanup error:', error);
            // Don't throw - allow other cleanup to proceed
        }
    }

    /**
     * Safe delete that catches and logs errors
     */
    static async safeDelete(deleteFn: () => Promise<any>) {
        try {
            await deleteFn();
        } catch (error) {
            console.error('Safe delete error:', error);
            // Don't throw
        }
    }
}
```

### Updated Test Pattern

Example of properly isolated test:

```typescript
import { PrismaClient } from '@prisma/client';
import { TestHelpers } from '../utils/test-helpers';

describe('Participant Role Filtering', () => {
    let prisma: PrismaClient;
    const testSuffix = Date.now();
    
    // Store all created IDs for cleanup
    let userId: string;
    let geographicAreaId: string;
    let venueId: string;
    let activityTypeId: string;
    let tutorRoleId: string;
    let participantIds: string[] = [];
    let activityIds: string[] = [];
    
    beforeAll(async () => {
        prisma = new PrismaClient();
        
        // Create test user with unique email
        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        userId = user.id;
        
        // Create geographic area with unique name
        const area = await prisma.geographicArea.create({
            data: {
                name: `RoleFilterTest Area ${testSuffix}`,
                areaType: 'CITY'
            }
        });
        geographicAreaId = area.id;
        
        // Create venue with unique name
        const venue = await prisma.venue.create({
            data: {
                name: `RoleFilterTest Venue ${testSuffix}`,
                address: '123 Test St',
                geographicAreaId
            }
        });
        venueId = venue.id;
        
        // Get predefined activity type deterministically
        const activityType = await TestHelpers.getPredefinedActivityType(
            prisma,
            'Ruhi Book 01'
        );
        activityTypeId = activityType.id;
        
        // Get predefined role deterministically
        const tutorRole = await TestHelpers.getPredefinedRole(prisma, 'Tutor');
        tutorRoleId = tutorRole.id;
        
        // Create test participants with unique names
        const p1 = await prisma.participant.create({
            data: { name: `RoleFilterTest P1 ${testSuffix}` }
        });
        participantIds.push(p1.id);
        
        // Create test activities with unique names
        const a1 = await prisma.activity.create({
            data: {
                name: `RoleFilterTest A1 ${testSuffix}`,
                activityTypeId,
                startDate: new Date('2025-01-01'),
                status: 'PLANNED'
            }
        });
        activityIds.push(a1.id);
    });
    
    afterAll(async () => {
        // Use TestHelpers for cleanup
        await TestHelpers.cleanupTestData(prisma, {
            activityIds,
            participantIds,
            venueIds: [venueId],
            geographicAreaIds: [geographicAreaId],
            userIds: [userId]
        });
        
        await prisma.$disconnect();
    });
    
    it('should filter by role', async () => {
        // Test implementation
    });
});
```

## Specific Fixes Required

### Fix 1: participant-role-date-filtering.test.ts

**Issues:**
- Uses static names without timestamps
- Doesn't use TestHelpers
- Creates custom roles instead of using predefined ones

**Fix:**
```typescript
// Add unique suffix
const testSuffix = Date.now();

// Use unique names
const geographicArea = await prisma.geographicArea.create({
    data: {
        name: `RoleDateTest City ${testSuffix}`,
        areaType: 'CITY'
    }
});

// Use predefined roles
const tutorRole = await TestHelpers.getPredefinedRole(prisma, 'Tutor');
const teacherRole = await TestHelpers.getPredefinedRole(prisma, 'Teacher');
const participantRole = await TestHelpers.getPredefinedRole(prisma, 'Participant');

// Don't create custom roles
// Don't clean up predefined roles
```

### Fix 2: map-data-optimized.test.ts

**Issues:**
- Uses `findFirst()` without specific name
- Uses static names

**Fix:**
```typescript
const testSuffix = Date.now();

// Deterministic predefined data access
const activityType = await TestHelpers.getPredefinedActivityType(
    prisma,
    'Ruhi Book 01'
);

// Unique names
const area = await prisma.geographicArea.create({
    data: {
        name: `MapOptTest Area ${testSuffix}`,
        areaType: 'CITY'
    }
});
```

### Fix 3: geographic-authorization-comprehensive.test.ts

**Issues:**
- Creates test user in `beforeAll` and modifies state in tests
- Uses static names for geographic areas

**Fix:**
```typescript
const testSuffix = Date.now();

// Unique geographic area names
const country = await prisma.geographicArea.create({
    data: {
        name: `GeoAuthTest Country ${testSuffix}`,
        areaType: 'COUNTRY'
    }
});

// Create user with unique email
const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);

// Clean up authorization rules in afterEach (already done correctly)
afterEach(async () => {
    await prisma.userGeographicAuthorization.deleteMany({
        where: { userId: testUserId }
    });
});
```

### Fix 4: All Integration Tests

**Common Pattern to Apply:**

1. Add unique suffix at top of describe block
2. Use suffix in all created entity names
3. Use TestHelpers for common operations
4. Query predefined data by specific name
5. Store all created IDs for cleanup
6. Use TestHelpers.cleanupTestData() in afterAll
7. Ensure cleanup order respects foreign keys

## Cleanup Order Reference

**Correct deletion order (children → parents):**

```typescript
// 1. Assignments (references: Activity, Participant, Role)
await prisma.assignment.deleteMany({ ... });

// 2. Activity Venue History (references: Activity, Venue)
await prisma.activityVenueHistory.deleteMany({ ... });

// 3. Participant Address History (references: Participant, Venue)
await prisma.participantAddressHistory.deleteMany({ ... });

// 4. Participant Populations (references: Participant, Population)
await prisma.participantPopulation.deleteMany({ ... });

// 5. Activities (references: ActivityType)
await prisma.activity.deleteMany({ ... });

// 6. Participants (no dependencies)
await prisma.participant.deleteMany({ ... });

// 7. Venues (references: GeographicArea)
await prisma.venue.deleteMany({ ... });

// 8. Activity Types (references: ActivityCategory)
await prisma.activityType.deleteMany({ ... });

// 9. Activity Categories (no dependencies)
await prisma.activityCategory.deleteMany({ ... });

// 10. Roles (no dependencies)
await prisma.role.deleteMany({ ... });

// 11. Populations (no dependencies)
await prisma.population.deleteMany({ ... });

// 12. User Geographic Authorizations (references: User, GeographicArea)
await prisma.userGeographicAuthorization.deleteMany({ ... });

// 13. Geographic Areas (children before parents)
// Delete in reverse creation order
for (const id of geographicAreaIds.reverse()) {
    await prisma.geographicArea.deleteMany({ where: { id } });
}

// 14. Users (no dependencies after auth rules deleted)
await prisma.user.deleteMany({ ... });
```

## Jest Configuration Updates

Update `jest.config.js` to enable parallel execution:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  
  // Enable parallel execution
  maxWorkers: '50%', // Use 50% of CPU cores
  
  // Increase timeout for integration tests
  testTimeout: 15000,
  
  // Other config...
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/__tests__/**'
  ]
};
```

## Migration Strategy

### Phase 1: Create TestHelpers Module

1. Create `src/__tests__/utils/test-helpers.ts`
2. Implement all helper methods
3. Export TestHelpers class
4. Add unit tests for helpers

### Phase 2: Update Existing Tests (Priority Order)

**High Priority (Most Likely to Cause Conflicts):**
1. Tests that create geographic areas with static names
2. Tests that use `findFirst()` without filters
3. Tests that create users with static emails
4. Tests with incomplete cleanup

**Medium Priority:**
5. Tests that create activities with static names
6. Tests that create participants with static names
7. Tests with cleanup order issues

**Low Priority:**
8. Tests that are already mostly isolated
9. Tests that run quickly and rarely conflict

### Phase 3: Enable Parallel Execution

1. Update jest.config.js to enable `maxWorkers: '50%'`
2. Run full test suite multiple times to verify stability
3. Fix any remaining flaky tests
4. Monitor CI/CD for flaky test failures

### Phase 4: Documentation

1. Update test README with isolation guidelines
2. Add examples of properly isolated tests
3. Document TestHelpers API
4. Create test isolation checklist

## Performance Impact

**Expected Improvements:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Test execution time | ~120s (sequential) | ~40s (parallel) | 67% faster |
| Flaky test rate | 5-10% | <1% | 90% reduction |
| Developer confidence | Low | High | Qualitative |

**Trade-offs:**

- Slightly more verbose test setup (unique suffixes)
- Additional helper module to maintain
- More complex cleanup logic
- Better isolation and reliability

## Testing Strategy

### Verify Isolation

Run tests multiple times in different orders:

```bash
# Run 5 times with different seeds
for i in {1..5}; do
  npm test -- --testPathPattern="integration" --runInBand --randomize
done

# Run in parallel
npm test -- --testPathPattern="integration" --maxWorkers=4

# Check for flaky tests
npm test -- --testPathPattern="integration" --maxWorkers=4 --bail
```

### Isolation Checklist

For each integration test file, verify:

- [ ] Uses unique suffix (timestamp or UUID) for all created data
- [ ] Queries predefined data by specific name, not `findFirst()`
- [ ] Stores IDs of ALL created entities
- [ ] Cleans up ALL created data in `afterAll`
- [ ] Cleanup order respects foreign key constraints
- [ ] Disconnects Prisma client in `afterAll`
- [ ] Uses TestHelpers for common operations
- [ ] No shared state between tests in different files
- [ ] Test names include descriptive prefix

## Future Enhancements

### Transaction-Based Isolation (Optional)

For even better isolation, consider wrapping each test in a transaction:

```typescript
export function withTransaction(testFn: (tx: PrismaClient) => Promise<void>) {
    return async () => {
        const prisma = new PrismaClient();
        
        try {
            await prisma.$transaction(async (tx) => {
                await testFn(tx as PrismaClient);
                // Throw error to force rollback
                throw new Error('ROLLBACK');
            });
        } catch (error) {
            if (error.message !== 'ROLLBACK') {
                throw error;
            }
            // Expected rollback
        } finally {
            await prisma.$disconnect();
        }
    };
}

// Usage
it('should do something', withTransaction(async (prisma) => {
    // All operations automatically rolled back
    const user = await prisma.user.create({ ... });
    expect(user).toBeDefined();
}));
```

**Pros:**
- Automatic cleanup
- Perfect isolation
- No manual cleanup code

**Cons:**
- More complex setup
- May not work with all Prisma operations
- Harder to debug
- Requires significant refactoring

**Recommendation:** Start with unique data + proper cleanup. Consider transaction isolation only if flaky tests persist.

## Monitoring and Maintenance

### CI/CD Integration

1. Run integration tests in parallel in CI/CD pipeline
2. Monitor for flaky test failures
3. Set up alerts for test isolation violations
4. Track test execution time trends

### Code Review Checklist

When reviewing new integration tests:

- [ ] Uses unique identifiers in test data names
- [ ] Queries predefined data deterministically
- [ ] Includes complete cleanup in afterAll
- [ ] Cleanup order respects foreign keys
- [ ] Uses TestHelpers where appropriate
- [ ] No shared state with other test files
- [ ] Disconnects Prisma client

### Debugging Isolation Issues

When a test fails intermittently:

1. Check if test data names are unique
2. Verify cleanup is complete and in correct order
3. Check for `findFirst()` without specific filters
4. Look for shared state (users, predefined data)
5. Run test in isolation: `npm test -- --testPathPattern="specific-test.test.ts"`
6. Run test multiple times: `for i in {1..10}; do npm test -- --testPathPattern="specific-test.test.ts"; done`
7. Check database for orphaned test data after test runs
