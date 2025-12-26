import { PrismaClient, Activity, ActivityStatus } from '@prisma/client';

export interface CreateActivityData {
  name: string;
  activityTypeId: string;
  startDate: Date;
  endDate?: Date;
  status?: ActivityStatus;
}

export interface UpdateActivityData {
  name?: string;
  activityTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ActivityStatus;
  version?: number;
}

export class ActivityRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        activityType: true,
      },
    });
  }

  async findAllPaginated(page: number, limit: number): Promise<{ data: Activity[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          activityType: true,
        },
      }),
      this.prisma.activity.count(),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Activity | null> {
    return this.prisma.activity.findUnique({
      where: { id },
      include: {
        activityType: true,
      },
    });
  }

  async findByType(activityTypeId: string): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { activityTypeId },
      orderBy: { startDate: 'desc' },
      include: {
        activityType: true,
      },
    });
  }

  async findByStatus(status: ActivityStatus): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { status },
      orderBy: { startDate: 'desc' },
      include: {
        activityType: true,
      },
    });
  }

  async create(data: CreateActivityData): Promise<Activity> {
    return this.prisma.activity.create({
      data,
      include: {
        activityType: true,
      },
    });
  }

  async update(id: string, data: UpdateActivityData): Promise<Activity> {
    const { version, ...updateData } = data;

    // If version is provided, check for conflicts
    if (version !== undefined) {
      const current = await this.prisma.activity.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new Error('Activity not found');
      }

      if (current.version !== version) {
        throw new Error('VERSION_CONFLICT');
      }
    }

    return this.prisma.activity.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
      include: {
        activityType: true,
      },
    });
  }

  async delete(id: string): Promise<Activity> {
    return this.prisma.activity.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.activity.count({
      where: { id },
    });
    return count > 0;
  }
}
