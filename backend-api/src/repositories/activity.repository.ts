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
  endDate?: Date | null;
  status?: ActivityStatus;
  version?: number;
}

export interface ActivityFilters {
  activityTypeIds?: string[];
  activityCategoryIds?: string[];
  status?: ActivityStatus[];
  populationIds?: string[];
  startDate?: Date;
  endDate?: Date;
  geographicAreaIds?: string[];
}

export class ActivityRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        activityType: {
          include: {
            activityCategory: true,
          },
        },
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
          activityType: {
            include: {
              activityCategory: true,
            },
          },
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
        activityType: {
          include: {
            activityCategory: true,
          },
        },
      },
    });
  }

  async findByType(activityTypeId: string): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { activityTypeId },
      orderBy: { startDate: 'desc' },
      include: {
        activityType: {
          include: {
            activityCategory: true,
          },
        },
      },
    });
  }

  async findByStatus(status: ActivityStatus): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { status },
      orderBy: { startDate: 'desc' },
      include: {
        activityType: {
          include: {
            activityCategory: true,
          },
        },
      },
    });
  }

  async create(data: CreateActivityData): Promise<Activity> {
    return this.prisma.activity.create({
      data,
      include: {
        activityType: {
          include: {
            activityCategory: true,
          },
        },
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
        activityType: {
          include: {
            activityCategory: true,
          },
        },
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

  async findWithFilters(
    filters: ActivityFilters,
    page: number,
    limit: number
  ): Promise<{ data: Activity[]; total: number }> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    const andConditions: any[] = [];

    // Activity type filter (OR logic within dimension)
    if (filters.activityTypeIds && filters.activityTypeIds.length > 0) {
      andConditions.push({ activityTypeId: { in: filters.activityTypeIds } });
    }

    // Activity category filter (OR logic within dimension)
    if (filters.activityCategoryIds && filters.activityCategoryIds.length > 0) {
      andConditions.push({
        activityType: {
          activityCategoryId: { in: filters.activityCategoryIds }
        }
      });
    }

    // Status filter (OR logic within dimension)
    if (filters.status && filters.status.length > 0) {
      andConditions.push({ status: { in: filters.status } });
    }

    // Start date filter (activities starting on or after this date)
    if (filters.startDate) {
      andConditions.push({ startDate: { gte: filters.startDate } });
    }

    // End date filter (activities ending on or before this date, or ongoing)
    if (filters.endDate) {
      andConditions.push({
        OR: [
          { endDate: { lte: filters.endDate } },
          { endDate: null }
        ]
      });
    }

    // Population filter (activities with at least one participant in specified populations)
    if (filters.populationIds && filters.populationIds.length > 0) {
      andConditions.push({
        assignments: {
          some: {
            participant: {
              participantPopulations: {
                some: {
                  populationId: { in: filters.populationIds }
                }
              }
            }
          }
        }
      });
    }

    // Geographic area filter (activities at venues in specified areas)
    // This filter requires checking the CURRENT venue (most recent venue history)
    if (filters.geographicAreaIds && filters.geographicAreaIds.length > 0) {
      andConditions.push({
        activityVenueHistory: {
          some: {
            venue: {
              geographicAreaId: { in: filters.geographicAreaIds }
            }
          }
        }
      });
    }

    // Apply all conditions with AND logic
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          activityType: {
            include: {
              activityCategory: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { data, total };
  }
}
