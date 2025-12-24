import { PrismaClient, Participant } from '@prisma/client';

export interface CreateParticipantData {
    name: string;
    email: string;
    phone?: string;
    notes?: string;
}

export interface UpdateParticipantData {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
}

export class ParticipantRepository {
    constructor(private prisma: PrismaClient) { }

    async findAll(): Promise<Participant[]> {
        return this.prisma.participant.findMany({
            orderBy: { name: 'asc' },
        });
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
        return this.prisma.participant.update({
            where: { id },
            data,
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
