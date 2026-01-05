import { PrismaClient, AuthorizationRuleType } from '@prisma/client';

export class UserGeographicAuthorizationRepository {
  constructor(private prisma: PrismaClient) {}

  async findByUserId(userId: string) {
    return this.prisma.userGeographicAuthorization.findMany({
      where: { userId },
      include: {
        geographicArea: true,
        creator: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserAndArea(userId: string, geographicAreaId: string) {
    return this.prisma.userGeographicAuthorization.findUnique({
      where: {
        userId_geographicAreaId: {
          userId,
          geographicAreaId,
        },
      },
    });
  }

  async create(data: {
    userId: string;
    geographicAreaId: string;
    ruleType: AuthorizationRuleType;
    createdBy: string;
  }) {
    return this.prisma.userGeographicAuthorization.create({
      data,
      include: {
        geographicArea: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.userGeographicAuthorization.delete({
      where: { id },
    });
  }

  async deleteByUserAndArea(userId: string, geographicAreaId: string) {
    return this.prisma.userGeographicAuthorization.delete({
      where: {
        userId_geographicAreaId: {
          userId,
          geographicAreaId,
        },
      },
    });
  }
}
