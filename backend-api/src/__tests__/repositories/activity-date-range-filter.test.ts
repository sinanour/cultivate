import { PrismaClient, ActivityStatus } from '@prisma/client';
import { ActivityRepository } from '../../repositories/activity.repository';

describe('ActivityRepository - Date Range Filtering', () => {
  let prisma: PrismaClient;
  let repository: ActivityRepository;
  let activityTypeId: string;
  let activityCategoryId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new ActivityRepository(prisma);

    // Create test activity category and type with unique names
    const category = await prisma.activityCategory.create({
      data: { name: `Unit Test Category ${Date.now()}` }
    });
    activityCategoryId = category.id;

    const type = await prisma.activityType.create({
      data: {
        name: `Unit Test Type ${Date.now()}`,
        activityCategoryId: activityCategoryId
      }
    });
    activityTypeId = type.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.activity.deleteMany({
      where: { activityTypeId }
    });
    await prisma.activityType.delete({
      where: { id: activityTypeId }
    });
    await prisma.activityCategory.delete({
      where: { id: activityCategoryId }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up activities for this test suite only
    await prisma.activity.deleteMany({
      where: { activityTypeId }
    });
  });

  describe('Interval Overlap Logic', () => {
    it('should include activity spanning entire range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Dec 1, 2024 to Feb 28, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Spanning Range',
          activityTypeId,
          startDate: new Date('2024-12-01T00:00:00.000Z'),
          endDate: new Date('2025-02-28T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Spanning Range');
    });

    it('should include activity starting before range, ending during range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Dec 15, 2024 to Jan 15, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Ending During Range',
          activityTypeId,
          startDate: new Date('2024-12-15T00:00:00.000Z'),
          endDate: new Date('2025-01-15T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Ending During Range');
    });

    it('should include activity starting during range, ending after range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Jan 15, 2025 to Feb 15, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Starting During Range',
          activityTypeId,
          startDate: new Date('2025-01-15T00:00:00.000Z'),
          endDate: new Date('2025-02-15T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Starting During Range');
    });

    it('should include activity entirely contained within range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Jan 10, 2025 to Jan 20, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Contained in Range',
          activityTypeId,
          startDate: new Date('2025-01-10T00:00:00.000Z'),
          endDate: new Date('2025-01-20T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Contained in Range');
    });

    it('should exclude activity entirely before range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Nov 1, 2024 to Nov 30, 2024
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Before Range',
          activityTypeId,
          startDate: new Date('2024-11-01T00:00:00.000Z'),
          endDate: new Date('2024-11-30T23:59:59.999Z'),
          status: ActivityStatus.COMPLETED
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(0);
    });

    it('should exclude activity entirely after range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Mar 1, 2025 to Mar 31, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity After Range',
          activityTypeId,
          startDate: new Date('2025-03-01T00:00:00.000Z'),
          endDate: new Date('2025-03-31T23:59:59.999Z'),
          status: ActivityStatus.PLANNED
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(0);
    });
  });

  describe('Ongoing Activities', () => {
    it('should include ongoing activity starting before range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Dec 1, 2024 to null (ongoing)
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Ongoing Activity Before Range',
          activityTypeId,
          startDate: new Date('2024-12-01T00:00:00.000Z'),
          endDate: null,
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Ongoing Activity Before Range');
    });

    it('should include ongoing activity starting during range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Jan 15, 2025 to null (ongoing)
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Ongoing Activity During Range',
          activityTypeId,
          startDate: new Date('2025-01-15T00:00:00.000Z'),
          endDate: null,
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Ongoing Activity During Range');
    });

    it('should exclude ongoing activity starting after range', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Feb 1, 2025 to null (ongoing)
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Ongoing Activity After Range',
          activityTypeId,
          startDate: new Date('2025-02-01T00:00:00.000Z'),
          endDate: null,
          status: ActivityStatus.PLANNED
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(0);
    });
  });

  describe('Edge Cases (Boundary Dates)', () => {
    it('should include activity starting exactly on filter startDate', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Jan 1, 2025 to Jan 15, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Starting on Filter Start',
          activityTypeId,
          startDate: new Date('2025-01-01T00:00:00.000Z'),
          endDate: new Date('2025-01-15T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Starting on Filter Start');
    });

    it('should include activity ending exactly on filter endDate', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Jan 15, 2025 to Jan 31, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Ending on Filter End',
          activityTypeId,
          startDate: new Date('2025-01-15T00:00:00.000Z'),
          endDate: new Date('2025-01-31T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Ending on Filter End');
    });

    it('should include activity starting exactly on filter endDate', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Jan 31, 2025 to Feb 15, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Starting on Filter End',
          activityTypeId,
          startDate: new Date('2025-01-31T00:00:00.000Z'),
          endDate: new Date('2025-02-15T23:59:59.999Z'),
          status: ActivityStatus.ACTIVE
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Starting on Filter End');
    });

    it('should include activity ending exactly on filter startDate', async () => {
      // Filter: Jan 1-31, 2025
      // Activity: Dec 15, 2024 to Jan 1, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.create({
        data: {
          name: 'Activity Ending on Filter Start',
          activityTypeId,
          startDate: new Date('2024-12-15T00:00:00.000Z'),
          endDate: new Date('2025-01-01T00:00:00.000Z'),
          status: ActivityStatus.COMPLETED
        }
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Activity Ending on Filter Start');
    });

    it('should include activities active on single day filter', async () => {
      // Filter: Jan 15, 2025 (single day)
      // Activity 1: Jan 10 to Jan 20 (spans the day)
      // Activity 2: Jan 15 to Jan 15 (exactly on the day)
      const filterDate = new Date('2025-01-15T00:00:00.000Z');

      await prisma.activity.createMany({
        data: [
          {
            name: 'Activity Spanning Single Day',
            activityTypeId,
            startDate: new Date('2025-01-10T00:00:00.000Z'),
            endDate: new Date('2025-01-20T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity Exactly on Single Day',
            activityTypeId,
            startDate: new Date('2025-01-15T00:00:00.000Z'),
            endDate: new Date('2025-01-15T23:59:59.999Z'),
            status: ActivityStatus.COMPLETED
          }
        ]
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterDate, endDate: filterDate },
        1,
        100
      );

      expect(data).toHaveLength(2);
      const names = data.map(a => a.name).sort();
      expect(names).toEqual([
        'Activity Exactly on Single Day',
        'Activity Spanning Single Day'
      ]);
    });
  });

  describe('Single Date Filters', () => {
    it('should handle only startDate filter (activities ending on or after)', async () => {
      // Filter: startDate = Jan 15, 2025 (no endDate)
      // Should include: activities that end on or after Jan 15 (or are ongoing)
      const filterStart = new Date('2025-01-15T00:00:00.000Z');

      await prisma.activity.createMany({
        data: [
          {
            name: 'Activity Ending After Start',
            activityTypeId,
            startDate: new Date('2025-01-01T00:00:00.000Z'),
            endDate: new Date('2025-01-20T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity Ending Before Start',
            activityTypeId,
            startDate: new Date('2024-12-01T00:00:00.000Z'),
            endDate: new Date('2025-01-10T23:59:59.999Z'),
            status: ActivityStatus.COMPLETED
          },
          {
            name: 'Ongoing Activity',
            activityTypeId,
            startDate: new Date('2025-01-01T00:00:00.000Z'),
            endDate: null,
            status: ActivityStatus.ACTIVE
          }
        ]
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart },
        1,
        100
      );

      expect(data).toHaveLength(2);
      const names = data.map(a => a.name).sort();
      expect(names).toEqual([
        'Activity Ending After Start',
        'Ongoing Activity'
      ]);
    });

    it('should handle only endDate filter (activities starting on or before)', async () => {
      // Filter: endDate = Jan 15, 2025 (no startDate)
      // Should include: activities that start on or before Jan 15
      const filterEnd = new Date('2025-01-15T23:59:59.999Z');

      await prisma.activity.createMany({
        data: [
          {
            name: 'Activity Starting Before End',
            activityTypeId,
            startDate: new Date('2025-01-10T00:00:00.000Z'),
            endDate: new Date('2025-01-20T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity Starting After End',
            activityTypeId,
            startDate: new Date('2025-01-20T00:00:00.000Z'),
            endDate: new Date('2025-01-30T23:59:59.999Z'),
            status: ActivityStatus.PLANNED
          },
          {
            name: 'Ongoing Activity Starting Before',
            activityTypeId,
            startDate: new Date('2025-01-01T00:00:00.000Z'),
            endDate: null,
            status: ActivityStatus.ACTIVE
          }
        ]
      });

      const { data } = await repository.findWithFilters(
        { endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(2);
      const names = data.map(a => a.name).sort();
      expect(names).toEqual([
        'Activity Starting Before End',
        'Ongoing Activity Starting Before'
      ]);
    });
  });

  describe('Multiple Activities in Range', () => {
    it('should return all activities that overlap with the range', async () => {
      // Filter: Jan 1-31, 2025
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.createMany({
        data: [
          {
            name: 'Activity 1: Spanning',
            activityTypeId,
            startDate: new Date('2024-12-01T00:00:00.000Z'),
            endDate: new Date('2025-02-28T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity 2: Before-During',
            activityTypeId,
            startDate: new Date('2024-12-15T00:00:00.000Z'),
            endDate: new Date('2025-01-15T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity 3: During-After',
            activityTypeId,
            startDate: new Date('2025-01-15T00:00:00.000Z'),
            endDate: new Date('2025-02-15T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity 4: Contained',
            activityTypeId,
            startDate: new Date('2025-01-10T00:00:00.000Z'),
            endDate: new Date('2025-01-20T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity 5: Ongoing',
            activityTypeId,
            startDate: new Date('2024-12-01T00:00:00.000Z'),
            endDate: null,
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Activity 6: Before (excluded)',
            activityTypeId,
            startDate: new Date('2024-11-01T00:00:00.000Z'),
            endDate: new Date('2024-11-30T23:59:59.999Z'),
            status: ActivityStatus.COMPLETED
          },
          {
            name: 'Activity 7: After (excluded)',
            activityTypeId,
            startDate: new Date('2025-03-01T00:00:00.000Z'),
            endDate: new Date('2025-03-31T23:59:59.999Z'),
            status: ActivityStatus.PLANNED
          }
        ]
      });

      const { data } = await repository.findWithFilters(
        { startDate: filterStart, endDate: filterEnd },
        1,
        100
      );

      expect(data).toHaveLength(5);
      const names = data.map(a => a.name).sort();
      expect(names).toEqual([
        'Activity 1: Spanning',
        'Activity 2: Before-During',
        'Activity 3: During-After',
        'Activity 4: Contained',
        'Activity 5: Ongoing'
      ]);
    });
  });

  describe('Combined with Other Filters', () => {
    it('should apply date range filter with AND logic to other filters', async () => {
      // Filter: Jan 1-31, 2025 AND status = ACTIVE
      const filterStart = new Date('2025-01-01T00:00:00.000Z');
      const filterEnd = new Date('2025-01-31T23:59:59.999Z');

      await prisma.activity.createMany({
        data: [
          {
            name: 'Active Activity in Range',
            activityTypeId,
            startDate: new Date('2025-01-10T00:00:00.000Z'),
            endDate: new Date('2025-01-20T23:59:59.999Z'),
            status: ActivityStatus.ACTIVE
          },
          {
            name: 'Completed Activity in Range',
            activityTypeId,
            startDate: new Date('2025-01-10T00:00:00.000Z'),
            endDate: new Date('2025-01-20T23:59:59.999Z'),
            status: ActivityStatus.COMPLETED
          }
        ]
      });

      const { data } = await repository.findWithFilters(
        {
          startDate: filterStart,
          endDate: filterEnd,
          status: [ActivityStatus.ACTIVE]
        },
        1,
        100
      );

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Active Activity in Range');
      expect(data[0].status).toBe(ActivityStatus.ACTIVE);
    });
  });
});
