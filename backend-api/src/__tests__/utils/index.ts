/**
 * Test Utilities Index
 * 
 * This module exports reusable test utilities for backend API tests.
 * 
 * Usage Examples:
 * 
 * 1. Generate unique email:
 *    import { TestHelpers } from './__tests__/utils';
 *    const email = TestHelpers.generateUniqueEmail('admin');
 * 
 * 2. Create test user:
 *    const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR');
 * 
 * 3. Safe delete (handles missing records):
 *    await TestHelpers.safeDelete(() => 
 *      prisma.user.delete({ where: { id: userId } })
 *    );
 * 
 * 4. Clean up test data:
 *    await TestHelpers.cleanupTestData(prisma, {
 *      userIds: [userId1, userId2],
 *      activityIds: [activityId],
 *      venueIds: [venueId],
 *      areaIds: [areaId1, areaId2]
 *    });
 * 
 * 5. Create minimal test data:
 *    const { areaId, venueId, participantId } = 
 *      await TestHelpers.createMinimalTestData(prisma);
 */

export { TestHelpers } from './test-helpers';
