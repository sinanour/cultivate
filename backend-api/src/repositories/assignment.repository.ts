import { PrismaClient, Assignment } from '@prisma/client';

export interface CreateAssignmentData {
  activityId: string;
  participantId: string;
  roleId: string;
  notes?: string;
}

export interface UpdateAssignmentData {
  roleId?: string;
  notes?: string | null;
}

export class AssignmentRepository {
  constructor(private prisma: PrismaClient) {}

  async findByActivityId(activityId: string) {
    return this.prisma.assignment.findMany({
      where: { activityId },
      include: {
        participant: {
          include: {
            participantPopulations: {
              include: {
                population: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByParticipantId(participantId: string) {
    return this.prisma.assignment.findMany({
      where: { participantId },
      include: {
        activity: {
          include: {
            activityType: true,
          },
        },
        role: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDuplicate(
    activityId: string,
    participantId: string,
    roleId: string
  ): Promise<Assignment | null> {
    return this.prisma.assignment.findFirst({
      where: {
        activityId,
        participantId,
        roleId,
      },
    });
  }

  async create(data: CreateAssignmentData): Promise<Assignment> {
    return this.prisma.assignment.create({
      data,
      include: {
        participant: true,
        role: true,
        activity: {
          include: {
            activityType: true,
          },
        },
      },
    });
  }

  async update(activityId: string, participantId: string, data: UpdateAssignmentData): Promise<Assignment> {
    // Find the assignment to update (there might be multiple with different roles)
    // We'll update the first one found, or if roleId is provided, find by that role
    const existing = await this.prisma.assignment.findFirst({
      where: {
        activityId,
        participantId,
      },
    });

    if (!existing) {
      throw new Error('Assignment not found');
    }

    return this.prisma.assignment.update({
      where: { id: existing.id },
      data,
      include: {
        participant: true,
        role: true,
        activity: {
          include: {
            activityType: true,
          },
        },
      },
    });
  }

  async delete(activityId: string, participantId: string): Promise<void> {
    await this.prisma.assignment.deleteMany({
      where: {
        activityId,
        participantId,
      },
    });
  }

  async deleteSpecific(activityId: string, participantId: string, roleId: string): Promise<void> {
    await this.prisma.assignment.deleteMany({
      where: {
        activityId,
        participantId,
        roleId,
      },
    });
  }
}
