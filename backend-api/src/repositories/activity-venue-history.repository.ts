import { PrismaClient, ActivityVenueHistory } from '@prisma/client';

export class ActivityVenueHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all venue history records for an activity, ordered by effectiveFrom descending
   */
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

  /**
   * Get the current venue (most recent effectiveFrom date)
   */
  async getCurrentVenue(activityId: string): Promise<ActivityVenueHistory | null> {
    return this.prisma.activityVenueHistory.findFirst({
      where: { activityId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        venue: true,
      },
    });
  }

  /**
   * Find a specific venue history record by ID
   */
  async findById(id: string): Promise<ActivityVenueHistory | null> {
    return this.prisma.activityVenueHistory.findUnique({
      where: { id },
      include: {
        venue: {
          include: {
            geographicArea: true,
          },
        },
      },
    });
  }

  /**
   * Check if a duplicate effectiveFrom exists for the activity
   */
  async hasDuplicateEffectiveFrom(
    activityId: string,
    effectiveFrom: Date,
    excludeId?: string
  ): Promise<boolean> {
    const existing = await this.prisma.activityVenueHistory.findFirst({
      where: {
        activityId,
        effectiveFrom,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return existing !== null;
  }

  /**
   * Create a new venue history record
   */
  async create(data: {
    activityId: string;
    venueId: string;
    effectiveFrom: Date;
  }): Promise<ActivityVenueHistory> {
    return this.prisma.activityVenueHistory.create({
      data,
      include: {
        venue: {
          include: {
            geographicArea: true,
          },
        },
      },
    });
  }

  /**
   * Update an existing venue history record
   */
  async update(
    id: string,
    data: {
      venueId?: string;
      effectiveFrom?: Date;
    }
  ): Promise<ActivityVenueHistory> {
    return this.prisma.activityVenueHistory.update({
      where: { id },
      data,
      include: {
        venue: {
          include: {
            geographicArea: true,
          },
        },
      },
    });
  }

  /**
   * Delete a venue history record
   */
  async delete(id: string): Promise<void> {
    await this.prisma.activityVenueHistory.delete({
      where: { id },
    });
  }
}
