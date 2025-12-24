import { PrismaClient, ActivityType } from '@prisma/client';

export class ActivityTypeRepository {
    constructor(private prisma: PrismaClient) { }

    /**
     * Find all activity types
     */
    async findAll(): Promise<ActivityType[]> {
        return this.prisma.activityType.findMany({
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find activity type by ID
     */
    async findById(id: string): Promise<ActivityType | null> {
        return this.prisma.activityType.findUnique({
            where: { id },
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
    async create(data: { name: string }): Promise<ActivityType> {
        return this.prisma.activityType.create({
            data,
        });
    }

    /**
     * Update an activity type
     */
    async update(id: string, data: { name: string }): Promise<ActivityType> {
        return this.prisma.activityType.update({
            where: { id },
            data,
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
