import { PrismaClient, ParticipantAddressHistory } from '@prisma/client';

export class ParticipantAddressHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all address history records for a participant, ordered by effectiveFrom descending
   */
  async findByParticipantId(participantId: string): Promise<ParticipantAddressHistory[]> {
    return this.prisma.participantAddressHistory.findMany({
      where: { participantId },
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
   * Get the current address (most recent effectiveFrom date)
   */
  async getCurrentAddress(participantId: string): Promise<ParticipantAddressHistory | null> {
    return this.prisma.participantAddressHistory.findFirst({
      where: { participantId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        venue: true,
      },
    });
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
   * Check if a duplicate effectiveFrom exists for the participant
   */
  async hasDuplicateEffectiveFrom(
    participantId: string,
    effectiveFrom: Date,
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
   * Create a new address history record
   */
  async create(data: {
    participantId: string;
    venueId: string;
    effectiveFrom: Date;
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
      effectiveFrom?: Date;
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
