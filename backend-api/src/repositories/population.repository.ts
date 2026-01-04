import { PrismaClient, Population } from '@prisma/client';

export class PopulationRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Population[]> {
    return this.prisma.population.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Population | null> {
    return this.prisma.population.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Population | null> {
    return this.prisma.population.findUnique({
      where: { name },
    });
  }

  async create(data: { name: string }): Promise<Population> {
    return this.prisma.population.create({
      data: {
        name: data.name,
      },
    });
  }

  async update(id: string, data: { name?: string }): Promise<Population> {
    return this.prisma.population.update({
      where: { id },
      data: {
        name: data.name,
        version: { increment: 1 },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.population.delete({
      where: { id },
    });
  }

  async countReferences(id: string): Promise<number> {
    return this.prisma.participantPopulation.count({
      where: { populationId: id },
    });
  }
}
