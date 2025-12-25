import { PrismaClient } from '@prisma/client';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncOperation {
    operation: SyncOperationType;
    entityType: string;
    localId?: string;
    serverId?: string;
    data?: any;
    timestamp: Date;
}

export interface SyncOperationResult {
    success: boolean;
    localId?: string;
    serverId?: string;
    error?: string;
    conflict?: {
        entityId: string;
        clientTimestamp: Date;
        serverTimestamp: Date;
    };
}

export interface BatchSyncResponse {
    results: SyncOperationResult[];
    idMappings: Record<string, string>;
}

export class SyncService {
    constructor(private prisma: PrismaClient) { }

    async processBatchSync(operations: SyncOperation[]): Promise<BatchSyncResponse> {
        const results: SyncOperationResult[] = [];
        const idMappings: Record<string, string> = {};

        try {
            await this.prisma.$transaction(async (tx) => {
                for (const operation of operations) {
                    try {
                        const result = await this.processOperation(tx, operation, idMappings);
                        results.push(result);

                        // Store ID mapping for CREATE operations
                        if (result.success && operation.operation === 'CREATE' && operation.localId && result.serverId) {
                            idMappings[operation.localId] = result.serverId;
                        }
                    } catch (error) {
                        results.push({
                            success: false,
                            localId: operation.localId,
                            serverId: operation.serverId,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                        throw error; // Rollback transaction
                    }
                }
            });
        } catch (error) {
            // Transaction failed, all operations rolled back
            return {
                results: results.map((r) => ({ ...r, success: false })),
                idMappings: {},
            };
        }

        return { results, idMappings };
    }

    private async processOperation(
        tx: any,
        operation: SyncOperation,
        idMappings: Record<string, string>
    ): Promise<SyncOperationResult> {
        const { entityType, operation: opType, localId, serverId, data, timestamp } = operation;

        // Map local IDs to server IDs in data
        const mappedData = this.mapLocalIds(data, idMappings);

        switch (entityType.toLowerCase()) {
            case 'participant':
                return this.syncParticipant(tx, opType, localId, serverId, mappedData, timestamp);

            case 'activity':
                return this.syncActivity(tx, opType, localId, serverId, mappedData, timestamp);

            case 'activitytype':
                return this.syncActivityType(tx, opType, localId, serverId, mappedData, timestamp);

            case 'role':
                return this.syncRole(tx, opType, localId, serverId, mappedData, timestamp);

            case 'venue':
                return this.syncVenue(tx, opType, localId, serverId, mappedData, timestamp);

            case 'geographicarea':
                return this.syncGeographicArea(tx, opType, localId, serverId, mappedData, timestamp);

            case 'assignment':
                return this.syncAssignment(tx, opType, localId, serverId, mappedData, timestamp);

            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }
    }

    private async syncParticipant(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const participant = await tx.participant.create({ data });
                return { success: true, localId, serverId: participant.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');

                // Check for conflicts (last-write-wins)
                const existing = await tx.participant.findUnique({ where: { id: serverId } });
                if (existing && timestamp && existing.updatedAt > timestamp) {
                    return {
                        success: false,
                        serverId,
                        conflict: {
                            entityId: serverId,
                            clientTimestamp: timestamp,
                            serverTimestamp: existing.updatedAt,
                        },
                    };
                }

                const participant = await tx.participant.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: participant.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.participant.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private async syncActivity(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const activity = await tx.activity.create({ data });
                return { success: true, localId, serverId: activity.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');

                const existing = await tx.activity.findUnique({ where: { id: serverId } });
                if (existing && timestamp && existing.updatedAt > timestamp) {
                    return {
                        success: false,
                        serverId,
                        conflict: {
                            entityId: serverId,
                            clientTimestamp: timestamp,
                            serverTimestamp: existing.updatedAt,
                        },
                    };
                }

                const activity = await tx.activity.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: activity.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.activity.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private async syncActivityType(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        _timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const activityType = await tx.activityType.create({ data });
                return { success: true, localId, serverId: activityType.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');
                const activityType = await tx.activityType.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: activityType.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.activityType.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private async syncRole(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        _timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const role = await tx.role.create({ data });
                return { success: true, localId, serverId: role.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');
                const role = await tx.role.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: role.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.role.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private async syncVenue(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const venue = await tx.venue.create({ data });
                return { success: true, localId, serverId: venue.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');

                const existing = await tx.venue.findUnique({ where: { id: serverId } });
                if (existing && timestamp && existing.updatedAt > timestamp) {
                    return {
                        success: false,
                        serverId,
                        conflict: {
                            entityId: serverId,
                            clientTimestamp: timestamp,
                            serverTimestamp: existing.updatedAt,
                        },
                    };
                }

                const venue = await tx.venue.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: venue.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.venue.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private async syncGeographicArea(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const area = await tx.geographicArea.create({ data });
                return { success: true, localId, serverId: area.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');

                const existing = await tx.geographicArea.findUnique({ where: { id: serverId } });
                if (existing && timestamp && existing.updatedAt > timestamp) {
                    return {
                        success: false,
                        serverId,
                        conflict: {
                            entityId: serverId,
                            clientTimestamp: timestamp,
                            serverTimestamp: existing.updatedAt,
                        },
                    };
                }

                const area = await tx.geographicArea.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: area.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.geographicArea.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private async syncAssignment(
        tx: any,
        operation: SyncOperationType,
        localId?: string,
        serverId?: string,
        data?: any,
        _timestamp?: Date
    ): Promise<SyncOperationResult> {
        switch (operation) {
            case 'CREATE': {
                const assignment = await tx.assignment.create({ data });
                return { success: true, localId, serverId: assignment.id };
            }

            case 'UPDATE': {
                if (!serverId) throw new Error('Server ID required for UPDATE');
                const assignment = await tx.assignment.update({
                    where: { id: serverId },
                    data,
                });
                return { success: true, serverId: assignment.id };
            }

            case 'DELETE': {
                if (!serverId) throw new Error('Server ID required for DELETE');
                await tx.assignment.delete({ where: { id: serverId } });
                return { success: true, serverId };
            }
        }
    }

    private mapLocalIds(data: any, idMappings: Record<string, string>): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const mapped = { ...data };

        // Map common foreign key fields
        const idFields = [
            'activityTypeId',
            'roleId',
            'participantId',
            'activityId',
            'venueId',
            'geographicAreaId',
            'parentGeographicAreaId',
        ];

        for (const field of idFields) {
            if (mapped[field] && idMappings[mapped[field]]) {
                mapped[field] = idMappings[mapped[field]];
            }
        }

        return mapped;
    }
}
