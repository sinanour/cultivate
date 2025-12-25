import { PrismaClient, AuditLog } from '@prisma/client';

export interface CreateAuditLogData {
    userId: string;
    actionType: string;
    entityType: string;
    entityId: string;
    details: Record<string, any>;
}

export class AuditLogRepository {
    constructor(private prisma: PrismaClient) { }

    async create(data: CreateAuditLogData): Promise<AuditLog> {
        return this.prisma.auditLog.create({
            data,
        });
    }

    async findByUserId(userId: string): Promise<AuditLog[]> {
        return this.prisma.auditLog.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
        });
    }

    async findAll(): Promise<AuditLog[]> {
        return this.prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });
    }

    async findByEntityType(entityType: string): Promise<AuditLog[]> {
        return this.prisma.auditLog.findMany({
            where: { entityType },
            orderBy: { timestamp: 'desc' },
        });
    }

    async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
        return this.prisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { timestamp: 'desc' },
        });
    }
}
