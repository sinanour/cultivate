# Test Utilities

This directory contains reusable test utilities for backend API tests.

## TestHelpers Class

The `TestHelpers` class provides utilities for test isolation, unique data generation, and proper cleanup.

### Methods

#### `generateUniqueEmail(prefix?: string): string`

Generates a unique email address for testing using timestamp and counter.

**Parameters:**
- `prefix` (optional): Email prefix (default: 'test')

**Returns:** Unique email in format: `prefix-timestamp-counter@example.com`

**Example:**
```typescript
import { TestHelpers } from '../utils';

const email1 = TestHelpers.generateUniqueEmail(); 
// test-1706380800000-1@example.com

const email2 = TestHelpers.generateUniqueEmail('admin'); 
// admin-1706380800000-2@example.com
```

#### `safeDelete<T>(deleteOperation: () => Promise<T>): Promise<T | null>`

Safely deletes a record, handling the case where it doesn't exist.

**Parameters:**
- `deleteOperation`: Function that performs the delete operation

**Returns:** Deleted record or null if it didn't exist

**Example:**
```typescript
// Won't throw if user doesn't exist
await TestHelpers.safeDelete(() => 
  prisma.user.delete({ where: { id: userId } })
);
```

#### `createTestUser(prisma: PrismaClient, role?: UserRole, displayName?: string): Promise<User>`

Creates a test user with unique email.

**Parameters:**
- `prisma`: Prisma client instance
- `role` (optional): User role (default: 'EDITOR')
- `displayName` (optional): Display name

**Returns:** Created user object

**Example:**
```typescript
const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', 'Test Admin');
const userId = user.id;
```

#### `cleanupTestData(prisma: PrismaClient, data: CleanupData): Promise<void>`

Cleans up test data in correct order respecting foreign key constraints.

**Parameters:**
- `prisma`: Prisma client instance
- `data`: Object containing arrays of IDs to delete

**CleanupData Interface:**
```typescript
{
  userIds?: string[];
  activityIds?: string[];
  participantIds?: string[];
  venueIds?: string[];
  areaIds?: string[];
  populationIds?: string[];
}
```

**Deletion Order:**
1. Assignments (references activities, participants, roles)
2. Activity venue history (references activities, venues)
3. Activities
4. Participant populations (references participants, populations)
5. Participant address history (references participants, venues)
6. Participants
7. Venues (references geographic areas)
8. Authorization rules (references areas, users)
9. Geographic areas
10. Populations
11. User authorization rules (references users)
12. Users

**Example:**
```typescript
const createdIds = {
  users: [] as string[],
  activities: [] as string[],
  participants: [] as string[],
  venues: [] as string[],
  areas: [] as string[],
};

// Track IDs as you create entities
const user = await TestHelpers.createTestUser(prisma);
createdIds.users.push(user.id);

const area = await prisma.geographicArea.create({...});
createdIds.areas.push(area.id);

// Clean up in afterAll
afterAll(async () => {
  await TestHelpers.cleanupTestData(prisma, createdIds);
  await prisma.$disconnect();
}, 30000);
```

#### `createMinimalTestData(prisma: PrismaClient): Promise<MinimalTestData>`

Creates minimal test data for common scenarios.

**Returns:**
```typescript
{
  areaId: string;
  venueId: string;
  participantId: string;
  activityTypeId: string;
  roleId: string;
}
```

**Example:**
```typescript
const { areaId, venueId, participantId, activityTypeId, roleId } = 
  await TestHelpers.createMinimalTestData(prisma);

// Use the IDs in your test
const activity = await prisma.activity.create({
  data: {
    name: 'Test Activity',
    activityTypeId,
    startDate: new Date(),
  },
});
```

## Best Practices

### Test Isolation

1. **Use unique emails**: Always use `TestHelpers.generateUniqueEmail()` or `TestHelpers.createTestUser()`
2. **Track created IDs**: Store all created entity IDs in a `createdIds` object
3. **Clean up in afterAll**: Use `TestHelpers.cleanupTestData()` with proper timeout
4. **Use safeDelete**: Wrap delete operations in `TestHelpers.safeDelete()` to handle missing records

### Example Test Structure

```typescript
import { PrismaClient } from '@prisma/client';
import { TestHelpers } from '../utils';

describe('My Integration Test', () => {
  let prisma: PrismaClient;
  let userId: string;
  
  const createdIds = {
    users: [] as string[],
    activities: [] as string[],
    participants: [] as string[],
    venues: [] as string[],
    areas: [] as string[],
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData(prisma, createdIds);
    await prisma.$disconnect();
  }, 30000); // 30 second timeout

  beforeEach(async () => {
    // Create fresh user for each test
    const user = await TestHelpers.createTestUser(prisma);
    userId = user.id;
    createdIds.users.push(user.id);
  });

  it('should do something', async () => {
    // Create test data
    const area = await prisma.geographicArea.create({
      data: { name: 'Test Area', areaType: 'CITY' },
    });
    createdIds.areas.push(area.id);

    // Test logic here
    expect(area).toBeDefined();
  });
});
```

### Timeouts

- **Default**: 10 seconds (configured in jest.config.js)
- **Integration tests**: Use default or increase per-test if needed
- **Large data tests**: Use `jest.setTimeout(60000)` at suite level
- **Cleanup hooks**: Add timeout to afterAll: `afterAll(async () => {...}, 30000)`

### Parallel Execution

Tests run in parallel by default. Ensure:
- Each test uses unique data (unique emails, unique names with timestamps)
- Tests don't depend on data from other tests
- Cleanup is thorough and handles missing records gracefully

## Troubleshooting

### "Unique constraint failed on email"
- Use `TestHelpers.generateUniqueEmail()` or `TestHelpers.createTestUser()`
- Don't hardcode emails like 'test@example.com'

### "Foreign key constraint violated"
- Check cleanup order in `TestHelpers.cleanupTestData()`
- Delete child entities before parent entities
- Delete authorization rules before deleting areas or users

### "Record to delete does not exist"
- Use `TestHelpers.safeDelete()` to handle missing records
- Check if beforeAll completed successfully before afterAll runs

### "Test timeout"
- Increase timeout for slow tests: `jest.setTimeout(30000)`
- Add timeout to hooks: `afterAll(async () => {...}, 30000)`
- Optimize data creation with batch operations

### "Worker process failed to exit"
- Ensure `await prisma.$disconnect()` in afterAll
- Close all database connections
- Clear any timers or intervals
