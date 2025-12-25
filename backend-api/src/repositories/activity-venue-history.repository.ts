import { PrismaClient, ActivityVenueHistory } from '@prisma/client';

export class ActivityVenueHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  async findByActivityId(activityId: string): Promise<ActivityVenueHistory[]> {
    return this.prisma.activityVenueHistory.findMany({
      where: { activityId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        venue: {
          include: {
            geographicArea: true,
          },
        },
      },
    });
  }

  async getCurrentVenues(activityId: string): Promise<ActivityVenueHistory[]> {
    return this.prisma.activityVenueHistory.findMany({
      where: {
        activityId,
        effectiveTo: null,
      },
      include: {
        venue: true,
      },
    });
  }

  async create(data: {
    activityId: string;
    venueId: string;
    effectiveFrom: Date;
  }): Promise<ActivityVenueHistory> {
    return this.prisma.activityVenueHistory.create({
      data,
      include: {
        venue: true,
      },
    });
  }

  async closeVenueAssociation(
    activityId: string,
    venueId: string,
    effectiveTo: Date
  ): Promise<ActivityVenueHistory | null> {
    const current = await this.prisma.activityVenueHistory.findFirst({
      where: {
        activityId,
        venueId,
        effectiveTo: null,
      },
    });

    if (!current) {
      return null;
    }

    return this.prisma.activityVenueHistory.update({
      where: { id: current.id },
      data: { effectiveTo },
    });
  }
}
