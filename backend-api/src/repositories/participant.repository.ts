import { PrismaClient, Participant } from '@prisma/client';

export interface CreateParticipantData {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface UpdateParticipantData {
  name?: string;
  email?: string | null;
  phone?: string;
  notes?: string;
  dateOfBirth?: Date | null;
  dateOfRegistration?: Date | null;
  nickname?: string;
  version?: number;
}

export class ParticipantRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Participant[]> {
    return this.prisma.participant.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findAllPaginated(page: number, limit: number, where?: any): Promise<{ data: Participant[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.participant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.participant.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Participant | null> {
    return this.prisma.participant.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<Participant | null> {
    return this.prisma.participant.findUnique({
      where: { email },
    });
  }

  async search(query: string): Promise<Participant[]> {
    return this.prisma.participant.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreateParticipantData): Promise<Participant> {
    return this.prisma.participant.create({
      data,
    });
  }

  async update(id: string, data: UpdateParticipantData): Promise<Participant> {
    const { version, ...updateData } = data;

    // If version is provided, check for conflicts
    if (version !== undefined) {
      const current = await this.prisma.participant.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new Error('Participant not found');
      }

      if (current.version !== version) {
        throw new Error('VERSION_CONFLICT');
      }
    }

    return this.prisma.participant.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
    });
  }

  async delete(id: string): Promise<Participant> {
    return this.prisma.participant.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.participant.count({
      where: { id },
    });
    return count > 0;
  }
}
