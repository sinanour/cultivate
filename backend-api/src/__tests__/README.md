# Testing Guide

This document explains the testing patterns used in the backend API and how to write tests that avoid database side effects.

## Test Types

### Unit Tests (`src/__tests__/services/*.test.ts`)

Unit tests verify individual service methods in complete isolation using mocked dependencies. They:
- **DO NOT** connect to a real database
- **DO** use mocked Prisma clients
- **DO** run fast (milliseconds per test)
- **DO** test business logic and validation rules

### Integration Tests (`src/__tests__/integration/*.test.ts`)

Integration tests verify end-to-end functionality with a real database. They:
- **DO** connect to a test database
- **DO** use real Prisma clients
- **DO** test actual database operations
- **DO** require database setup/teardown

## Writing Unit Tests

### Pattern: Mock Prisma Client

Always use the `createMockPrismaClient()` utility for unit tests:

```typescript
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';
import { MyService } from '../../services/my.service';
import { MyRepository } from '../../repositories/my.repository';

describe('MyService', () => {
    let service: MyService;
    let mockPrisma: MockPrismaClient;
    let mockRepository: MyRepository;

    beforeEach(() => {
        // Create a fresh mock Prisma client for each test
        mockPrisma = createMockPrismaClient();
        
        // Create repositories with the mocked Prisma client
        mockRepository = new MyRepository(mockPrisma);
        
        // Create service with mocked repositories
        service = new MyService(mockRepository);
    });

    it('should do something', async () => {
        // Mock the Prisma method that will be called
        mockPrisma.myModel.findMany.mockResolvedValue([
            { id: '1', name: 'Test', createdAt: new Date() }
        ]);

        const result = await service.getSomething();

        expect(result).toBeDefined();
        expect(mockPrisma.myModel.findMany).toHaveBeenCalled();
    });
});
```

### ❌ WRONG: Old Pattern (Creates Database Side Effects)

```typescript
// DON'T DO THIS - it can leak to real database
jest.mock('../../repositories/my.repository');

beforeEach(() => {
    mockRepository = new MyRepository(null as any) as jest.Mocked<MyRepository>;
    service = new MyService(mockRepository);
});
```

### ✅ CORRECT: New Pattern (Fully Isolated)

```typescript
// DO THIS - completely isolated from database
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';

beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    mockRepository = new MyRepository(mockPrisma);
    service = new MyService(mockRepository);
});
```

## Mocking Prisma Methods

### Common Prisma Methods

```typescript
// findMany - returns array
mockPrisma.myModel.findMany.mockResolvedValue([{ id: '1', name: 'Test' }]);

// findUnique - returns single object or null
mockPrisma.myModel.findUnique.mockResolvedValue({ id: '1', name: 'Test' });
mockPrisma.myModel.findUnique.mockResolvedValue(null); // not found

// create - returns created object
mockPrisma.myModel.create.mockResolvedValue({ id: '1', name: 'Test' });

// update - returns updated object
mockPrisma.myModel.update.mockResolvedValue({ id: '1', name: 'Updated' });

// delete - returns deleted object
mockPrisma.myModel.delete.mockResolvedValue({ id: '1', name: 'Deleted' });

// count - returns number
mockPrisma.myModel.count.mockResolvedValue(5);

// $transaction - executes callback with transaction context
mockPrisma.$transaction.mockImplementation(async (callback: any) => {
    const mockTx = {
        myModel: {
            create: jest.fn().mockResolvedValue({ id: '1' }),
            update: jest.fn()
        }
    };
    return await callback(mockTx);
});
```

### Multiple Calls to Same Method

When a method is called multiple times with different results:

```typescript
// First call returns existing, second call returns null
mockPrisma.myModel.findUnique.mockResolvedValueOnce({ id: '1', name: 'Existing' });
mockPrisma.myModel.findUnique.mockResolvedValueOnce(null);
```

## Testing Transactions

Services that use `prisma.$transaction` need special mocking:

```typescript
it('should create with transaction', async () => {
    const mockResult = { id: '1', name: 'Test' };
    
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
            myModel: {
                create: jest.fn().mockResolvedValue(mockResult)
            },
            relatedModel: {
                create: jest.fn()
            }
        };
        return await callback(mockTx);
    });

    const result = await service.createSomething({ name: 'Test' });
    
    expect(result).toEqual(mockResult);
});
```

## Verifying Test Isolation

### Check for Database Side Effects

Run tests and verify no database records are created:

```bash
# Run unit tests
npm test -- --testPathPattern="services/.*\.test\.ts$" --no-coverage

# Check database for test data (should be empty)
# If you see test data in your database, the tests are not properly isolated
```

### Signs of Poor Test Isolation

- Test data appears in your development database
- Tests fail when run in different orders
- Tests are slow (>100ms per test for unit tests)
- Tests fail when database is not running

### Signs of Good Test Isolation

- No database records created during test runs
- Tests run in any order successfully
- Tests are fast (<10ms per test typically)
- Tests run without database connection

## When to Use Each Test Type

### Use Unit Tests When:
- Testing business logic and validation rules
- Testing error handling and edge cases
- Testing data transformations
- You want fast feedback during development

### Use Integration Tests When:
- Testing actual database queries
- Testing complex Prisma relationships
- Testing transaction behavior
- Testing end-to-end API flows

## Integration Test Cleanup

Integration tests MUST clean up ALL created data to avoid database pollution and enable parallel test execution.

### Test Isolation Requirements

**CRITICAL**: All integration tests must follow these isolation rules to enable reliable parallel execution:

1. **Unique Test Data** - Use timestamps or UUIDs in all test data names
2. **Deterministic Predefined Data Access** - Query predefined data by specific name, never use `findFirst()` without filters
3. **Complete Cleanup** - Clean up ALL created data in correct dependency order
4. **Test-Specific Users** - Each test suite creates its own unique users
5. **Use TestHelpers** - Leverage the TestHelpers utility for common operations

### Pattern: Proper Cleanup with TestHelpers

```typescript
import { TestHelpers } from '../utils';

describe('My Integration Test', () => {
    let prisma: PrismaClient;
    const testSuffix = Date.now(); // Unique per test file
    
    let userId: string;
    let activityTypeId: string;
    let activityId: string;
    let geographicAreaId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        
        // Create test user with unique email
        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        userId = user.id;
        
        // Get predefined activity type deterministically
        const activityType = await TestHelpers.getPredefinedActivityType(
            prisma, 
            'Ruhi Book 01'
        );
        activityTypeId = activityType.id;
        
        // Create test data with unique names
        const area = await prisma.geographicArea.create({
            data: { 
                name: `MyTest Area ${testSuffix}`, 
                areaType: 'CITY' 
            },
        });
        geographicAreaId = area.id;
        
        const activity = await prisma.activity.create({
            data: { 
                name: `MyTest Activity ${testSuffix}`, 
                activityTypeId, 
                startDate: new Date(), 
                status: 'PLANNED' 
            },
        });
        activityId = activity.id;
    });

    afterAll(async () => {
        // Use TestHelpers for cleanup
        await TestHelpers.cleanupTestData(prisma, {
            activityIds: [activityId],
            geographicAreaIds: [geographicAreaId],
            userIds: [userId]
        });
        
        await prisma.$disconnect();
    });

    it('should do something', async () => {
        const result = await prisma.activity.findUnique({ 
            where: { id: activityId } 
        });
        expect(result).toBeDefined();
    });
});
```

### TestHelpers Utility

The `TestHelpers` class provides reusable methods for common test operations:

```typescript
// Create test user with unique email
const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', testSuffix);

// Create geographic hierarchy
const { countryId, provinceId, cityId, neighbourhoodId } = 
    await TestHelpers.createTestGeographicHierarchy(prisma, testSuffix);

// Get predefined activity type (deterministic)
const activityType = await TestHelpers.getPredefinedActivityType(
    prisma, 
    'Ruhi Book 01'
);

// Get predefined role (deterministic)
const tutorRole = await TestHelpers.getPredefinedRole(prisma, 'Tutor');

// Clean up test data in correct order
await TestHelpers.cleanupTestData(prisma, {
    assignmentIds: [assignmentId],
    activityIds: [activityId],
    participantIds: [participantId],
    venueIds: [venueId],
    geographicAreaIds: [areaId],
    userIds: [userId]
});
```

### Critical Cleanup Rules

1. **Store IDs of ALL created entities** - including users, geographic areas, venues, etc.
2. **Use unique identifiers** - Add `Date.now()` or UUID to all test data names
3. **Query predefined data by name** - Never use `findFirst()` without specific filters
4. **Clean up in reverse dependency order** - delete children before parents:
   - Assignments → Activities/Participants/Roles
   - Activity Venue History → Activities/Venues
   - Participant Address History → Participants/Venues
   - Participant Populations → Participants/Populations
   - Activities → Activity Types
   - Participants → (no dependencies)
   - Venues → Geographic Areas
   - Activity Types → Activity Categories (only if custom, not predefined)
   - User Geographic Authorizations → Users/Geographic Areas
   - Geographic Areas → Parent Geographic Areas (children first)
   - Users → (no dependencies after auth rules deleted)
5. **Use TestHelpers.cleanupTestData()** - Handles correct order automatically
6. **Handle cascading deletes** - Some entities cascade, others don't
7. **Disconnect Prisma client** - Always call `prisma.$disconnect()` in `afterAll`

### Unique Test Data Pattern

```typescript
// ❌ WRONG: Static names cause conflicts in parallel tests
const area = await prisma.geographicArea.create({
    data: { name: 'Test City', areaType: 'CITY' }
});

// ✅ CORRECT: Unique names prevent conflicts
const testSuffix = Date.now();
const area = await prisma.geographicArea.create({
    data: { 
        name: `MyTest City ${testSuffix}`, 
        areaType: 'CITY' 
    }
});
```

### Deterministic Predefined Data Access

```typescript
// ❌ WRONG: Non-deterministic, causes race conditions
const activityType = await prisma.activityType.findFirst();

// ✅ CORRECT: Deterministic, always gets same entity
const activityType = await TestHelpers.getPredefinedActivityType(
    prisma, 
    'Ruhi Book 01'
);

// ❌ WRONG: Creates custom role, conflicts with other tests
const tutorRole = await prisma.role.create({
    data: { name: 'Tutor' }
});

// ✅ CORRECT: Uses predefined role
const tutorRole = await TestHelpers.getPredefinedRole(prisma, 'Tutor');
```

### Common Cleanup Order

```typescript
// Correct order (children first, parents last)
await prisma.assignment.deleteMany({ where: { activityId } });
await prisma.activityVenueHistory.deleteMany({ where: { activityId } });
await prisma.participantAddressHistory.deleteMany({ where: { participantId } });
await prisma.activity.deleteMany({ where: { id: activityId } });
await prisma.participant.deleteMany({ where: { id: participantId } });
await prisma.venue.deleteMany({ where: { id: venueId } });
await prisma.geographicArea.deleteMany({ where: { id: geographicAreaId } });
await prisma.user.deleteMany({ where: { id: userId } });
```

### Test Isolation Checklist

Before submitting a new integration test, verify:

- [ ] Uses unique suffix (timestamp or UUID) for all created data
- [ ] Queries predefined data by specific name, not `findFirst()`
- [ ] Stores IDs of ALL created entities
- [ ] Cleans up ALL created data in `afterAll`
- [ ] Cleanup order respects foreign key constraints
- [ ] Disconnects Prisma client in `afterAll`
- [ ] Uses TestHelpers for common operations
- [ ] No shared state between tests in different files
- [ ] Test names include descriptive prefix

### Parallel Execution

Tests now run in parallel by default (using 50% of CPU cores). This significantly reduces test execution time but requires proper isolation:

```bash
# Tests run in parallel automatically
npm test -- --testPathPattern="integration"

# Force sequential execution (for debugging)
npm test -- --testPathPattern="integration" --runInBand

# Run with specific worker count
npm test -- --testPathPattern="integration" --maxWorkers=4
```

### Debugging Isolation Issues

If a test fails intermittently:

1. Check if test data names are unique (include testSuffix)
2. Verify cleanup is complete and in correct order
3. Check for `findFirst()` without specific filters
4. Look for shared state (users, predefined data)
5. Run test in isolation: `npm test -- --testPathPattern="specific-test.test.ts"`
6. Run test multiple times: `for i in {1..10}; do npm test -- --testPathPattern="specific-test.test.ts"; done`
7. Check database for orphaned test data after test runs

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (services)
npm test -- --testPathPattern="services/.*\.test\.ts$"

# Run only integration tests
npm test -- --testPathPattern="integration/.*\.test\.ts$"

# Run specific test file
npm test -- --testPathPattern="activity.service.test.ts"

# Run with coverage
npm test -- --coverage
```

## Best Practices

1. **Always use `createMockPrismaClient()`** for unit tests
2. **Never pass `null as any`** to repository constructors
3. **Mock all Prisma methods** that your service calls
4. **Use `mockResolvedValueOnce`** for sequential calls with different results
5. **Keep unit tests fast** - if a test takes >100ms, it might be hitting the database
6. **Separate concerns** - unit tests for logic, integration tests for database
7. **Clean state** - each test should be independent and not rely on previous tests

## Troubleshooting

### "Real Prisma client should not be used in unit tests"

You're trying to use `getPrismaClient()` in a unit test. Use `createMockPrismaClient()` instead.

### Tests creating database records

Your mocks aren't set up correctly. Make sure you're:
1. Using `createMockPrismaClient()`
2. Passing the mock to repository constructors
3. Mocking all Prisma methods your service calls

### Tests failing randomly

Your tests might have shared state or database dependencies. Ensure:
1. Each test creates its own mock client
2. No test relies on data from previous tests
3. All database operations are mocked

## Example: Complete Unit Test

```typescript
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';
import { ActivityTypeService } from '../../services/activity-type.service';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityCategoryRepository } from '../../repositories/activity-category.repository';

describe('ActivityTypeService', () => {
    let service: ActivityTypeService;
    let mockPrisma: MockPrismaClient;
    let mockRepository: ActivityTypeRepository;
    let mockCategoryRepository: ActivityCategoryRepository;

    beforeEach(() => {
        mockPrisma = createMockPrismaClient();
        mockRepository = new ActivityTypeRepository(mockPrisma);
        mockCategoryRepository = new ActivityCategoryRepository(mockPrisma);
        service = new ActivityTypeService(mockRepository, mockCategoryRepository);
    });

    describe('createActivityType', () => {
        it('should create activity type with valid data', async () => {
            const input = { name: 'Test Type', activityCategoryId: 'cultivate-1' };
            const mockType = { 
                id: '1', 
                name: input.name, 
                activityCategoryId: input.activityCategoryId, 
                isPredefined: false, 
                createdAt: new Date(), 
                updatedAt: new Date(), 
                version: 1 
            };
            const mockCategory = { 
                id: 'cultivate-1', 
                name: 'Test Category', 
                isPredefined: true, 
                version: 1, 
                createdAt: new Date(), 
                updatedAt: new Date() 
            };

            // Mock the Prisma calls
            mockPrisma.activityType.findUnique.mockResolvedValue(null); // No duplicate
            mockPrisma.activityCategory.findUnique.mockResolvedValue(mockCategory as any);
            mockPrisma.activityType.create.mockResolvedValue({ 
                ...mockType, 
                activityCategory: mockCategory 
            } as any);

            const result = await service.createActivityType(input);

            expect(result).toBeDefined();
            expect(result.name).toBe(input.name);
            expect(mockPrisma.activityType.create).toHaveBeenCalled();
        });
    });
});
```

This test is completely isolated - no database connection, no side effects, fast execution.
