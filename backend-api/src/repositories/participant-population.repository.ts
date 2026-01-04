import { PrismaClient, ParticipantPopulation, Population } from '@prisma/client';

export type ParticipantPopulationWithPopulation = ParticipantPopulation & {
  population: Population;
};

export class ParticipantPopulationRepository {
  constructor(private prisma: PrismaClient) {}

  async findByParticipant(participantId: string): Promise<ParticipantPopulationWithPopulation[]> {
    return this.prisma.participantPopulation.findMany({
      where: { participantId },
      include: { population: true },
      orderBy: { population: { name: 'asc' } },
    });
  }

  async findByParticipantAndPopulation(
    participantId: string,
    populationId: string
  ): Promise<ParticipantPopulation | null> {
    return this.prisma.participantPopulation.findUnique({
      where: {
        participantId_populationId: {
          participantId,
          populationId,
        },
      },
    });
  }

  async create(participantId: string, populationId: string): Promise<ParticipantPopulation> {
    return this.prisma.participantPopulation.create({
      data: {
        participantId,
        populationId,
      },
    });
  }

  async delete(participantId: string, populationId: string): Promise<void> {
    await this.prisma.participantPopulation.delete({
      where: {
        participantId_populationId: {
          participantId,
          populationId,
        },
      },
    });
  }
}
