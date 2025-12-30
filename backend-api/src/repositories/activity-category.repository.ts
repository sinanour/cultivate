import { PrismaClient, ActivityCategory } from '@prisma/client';

export class ActivityCategoryRepository {
    constructor(private prisma: PrismaClient) { }

    async findAll(): Promise<ActivityCategory[]> {
        return this.prisma.activityCategory.findMany({
            orderBy: [{ isPredefined: 'desc' }, { name: 'asc' }],
        });
    }

    async findById(id: string): Promise<ActivityCategory | null> {
        return this.prisma.activityCategory.findUnique({
            where: { id },
        });
    }

    async create(data: { name: string }): Promise<ActivityCategory> {
        return this.prisma.activityCategory.create({
            data: {
                name: data.name,
                isPredefined: false,
            },
        });
    }

    async update(id: string, data: { name: string; version: number }): Promise<ActivityCategory> {
        return this.prisma.activityCategory.update({
            where: { id, version: data.version },
            data: {
                name: data.name,
                version: { increment: 1 },
            },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.activityCategory.delete({
            where: { id },
        });
    }

    async countReferences(id: string): Promise<number> {
        return this.prisma.activityType.count({
            where: { activityCategoryId: id },
        });
    }

    async findByName(name: string): Promise<ActivityCategory | null> {
        return this.prisma.activityCategory.findUnique({
            where: { name },
        });
    }
}
