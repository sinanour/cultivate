import { PrismaClient, ActivityVenueHistory } from '@prisma/client';

export class ActivityVenueHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all venue history records for an activity, ordered by effectiveFrom descending
   * Null effectiveFrom values are treated as the activity start date for ordering
   */
  async findByActivityId(activityId: string): Promise<ActivityVenueHistory[]> {
    const records = await this.prisma.activityVenueHistory.findMany({
      where: { activityId },
      include: {
        venue: {
          include: {
            geographicArea: true,
          },
        },
        activity: {
          select: {
            startDate: true,
          },
        },
      },
    });

    // Sort manually to handle null effectiveFrom (treat as activity startDate)
    return records.sort((a, b) => {
      const dateA = a.effectiveFrom || a.activity.startDate;
      const dateB = b.effectiveFrom || b.activity.startDate;
      return dateB.getTime() - dateA.getTime(); // Descending order
    });
  }

  /**
   * Get the current venue (most recent non-null effectiveFrom, or null record if no non-null exists)
   */
  async getCurrentVenue(activityId: string): Promise<ActivityVenueHistory | null> {
    const records = await this.prisma.activityVenueHistory.findMany({
      where: { activityId },
      include: {
        venue: true,
        activity: {
          select: {
            startDate: true,
          },
        },
      },
    });

    if (records.length === 0) return null;

    // Find the most recent non-null effectiveFrom
    const nonNullRecords = records.filter(r => r.effectiveFrom !== null);
    if (nonNullRecords.length > 0) {
      return nonNullRecords.reduce((latest, current) => {
        return current.effectiveFrom! > latest.effectiveFrom! ? current : latest;
      });
    }

    // If all records have null effectiveFrom, return the null record
    return records[0];
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
   * Check if a duplicate effectiveFrom exists for the activity (including null)
   */
  async hasDuplicateEffectiveFrom(
    activityId: string,
    effectiveFrom: Date | null,
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
   * Check if a null effectiveFrom exists for the activity
   */
  async hasNullEffectiveFrom(activityId: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.activityVenueHistory.findFirst({
      where: {
        activityId,
        effectiveFrom: null,
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
    effectiveFrom: Date | null;
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
      effectiveFrom?: Date | null;
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
