import { PrismaClient, ParticipantAddressHistory } from '@prisma/client';

export class ParticipantAddressHistoryRepository {
  constructor(private prisma: PrismaClient) {}

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

  async getCurrentAddress(participantId: string): Promise<ParticipantAddressHistory | null> {
    return this.prisma.participantAddressHistory.findFirst({
      where: {
        participantId,
        effectiveTo: null,
      },
      include: {
        venue: true,
      },
    });
  }

  async create(data: {
    participantId: string;
    venueId: string;
    effectiveFrom: Date;
  }): Promise<ParticipantAddressHistory> {
    return this.prisma.participantAddressHistory.create({
      data,
    });
  }

  async closeCurrentAddress(
    participantId: string,
    effectiveTo: Date
  ): Promise<ParticipantAddressHistory | null> {
    const current = await this.getCurrentAddress(participantId);
    if (!current) {
      return null;
    }

    return this.prisma.participantAddressHistory.update({
      where: { id: current.id },
      data: { effectiveTo },
    });
  }
}
