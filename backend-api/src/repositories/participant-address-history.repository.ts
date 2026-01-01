import { PrismaClient, ParticipantAddressHistory } from '@prisma/client';

export class ParticipantAddressHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all address history records for a participant, ordered by effectiveFrom descending
   * Null effectiveFrom values (oldest address) are sorted to the end
   */
  async findByParticipantId(participantId: string): Promise<ParticipantAddressHistory[]> {
    const records = await this.prisma.participantAddressHistory.findMany({
      where: { participantId },
      include: {
        venue: {
          include: {
            geographicArea: true,
          },
        },
      },
    });

    // Sort manually to handle null effectiveFrom (treat as oldest)
    return records.sort((a, b) => {
      if (a.effectiveFrom === null && b.effectiveFrom === null) return 0;
      if (a.effectiveFrom === null) return 1; // null goes to end (oldest)
      if (b.effectiveFrom === null) return -1; // null goes to end (oldest)
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime(); // Descending order
    });
  }

  /**
   * Get the current address (most recent non-null effectiveFrom, or null record if no non-null exists)
   */
  async getCurrentAddress(participantId: string): Promise<ParticipantAddressHistory | null> {
    const records = await this.prisma.participantAddressHistory.findMany({
      where: { participantId },
      include: {
        venue: true,
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
   * Find a specific address history record by ID
   */
  async findById(id: string): Promise<ParticipantAddressHistory | null> {
    return this.prisma.participantAddressHistory.findUnique({
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
   * Check if a duplicate effectiveFrom exists for the participant (including null)
   */
  async hasDuplicateEffectiveFrom(
    participantId: string,
    effectiveFrom: Date | null,
    excludeId?: string
  ): Promise<boolean> {
    const existing = await this.prisma.participantAddressHistory.findFirst({
      where: {
        participantId,
        effectiveFrom,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return existing !== null;
  }

  /**
   * Check if a null effectiveFrom exists for the participant
   */
  async hasNullEffectiveFrom(participantId: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.participantAddressHistory.findFirst({
      where: {
        participantId,
        effectiveFrom: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return existing !== null;
  }

  /**
   * Create a new address history record
   */
  async create(data: {
    participantId: string;
    venueId: string;
    effectiveFrom: Date | null;
  }): Promise<ParticipantAddressHistory> {
    return this.prisma.participantAddressHistory.create({
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
   * Update an existing address history record
   */
  async update(
    id: string,
    data: {
      venueId?: string;
      effectiveFrom?: Date | null;
    }
  ): Promise<ParticipantAddressHistory> {
    return this.prisma.participantAddressHistory.update({
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
   * Delete an address history record
   */
  async delete(id: string): Promise<void> {
    await this.prisma.participantAddressHistory.delete({
      where: { id },
    });
  }
}
