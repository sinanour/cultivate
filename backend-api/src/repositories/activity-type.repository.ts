import { PrismaClient, ActivityType } from '@prisma/client';

export class ActivityTypeRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all activity types with category information
   */
  async findAll(): Promise<ActivityType[]> {
    return this.prisma.activityType.findMany({
      include: {
        activityCategory: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Find activity type by ID with category information
   */
  async findById(id: string): Promise<ActivityType | null> {
    return this.prisma.activityType.findUnique({
      where: { id },
      include: {
        activityCategory: true,
      },
    });
  }

  /**
   * Find activity type by name
   */
  async findByName(name: string): Promise<ActivityType | null> {
    return this.prisma.activityType.findUnique({
      where: { name },
    });
  }

  /**
   * Create a new activity type
   */
  async create(data: { name: string; activityCategoryId: string }): Promise<ActivityType> {
    return this.prisma.activityType.create({
      data: {
        name: data.name,
        activityCategoryId: data.activityCategoryId,
        isPredefined: false,
      },
      include: {
        activityCategory: true,
      },
    });
  }

  /**
   * Update an activity type
   */
  async update(
    id: string,
    data: { name?: string; activityCategoryId?: string; version?: number }
  ): Promise<ActivityType> {
    const { version, ...updateData } = data;

    // If version is provided, check for conflicts
    if (version !== undefined) {
      const current = await this.prisma.activityType.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new Error('Activity type not found');
      }

      if (current.version !== version) {
        throw new Error('VERSION_CONFLICT');
      }
    }

    return this.prisma.activityType.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
      include: {
        activityCategory: true,
      },
    });
  }

  /**
   * Delete an activity type
   */
  async delete(id: string): Promise<ActivityType> {
    return this.prisma.activityType.delete({
      where: { id },
    });
  }

  /**
   * Count activities referencing this activity type
   */
  async countReferences(id: string): Promise<number> {
    return this.prisma.activity.count({
      where: { activityTypeId: id },
    });
  }

  /**
   * Check if activity type exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.activityType.count({
      where: { id },
    });
    return count > 0;
  }
}
