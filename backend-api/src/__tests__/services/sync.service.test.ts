import { SyncService } from '../../services/sync.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

describe('SyncService', () => {
    let service: SyncService;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockTransaction: any;

    beforeEach(() => {
        mockTransaction = {
            participant: {
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                findUnique: jest.fn(),
            },
            activity: {
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                findUnique: jest.fn(),
            },
        };

        mockPrisma = {
            $transaction: jest.fn().mockImplementation(async (callback) => {
                return await callback(mockTransaction);
            }),
        } as any;

        service = new SyncService(mockPrisma);
        jest.clearAllMocks();
    });

    describe('processBatchSync', () => {
        it('should process CREATE operations successfully', async () => {
            const operations = [
                {
                    operation: 'CREATE' as const,
                    entityType: 'participant',
                    localId: 'local-1',
                    data: { name: 'John Doe', email: 'john@example.com' },
                    timestamp: new Date(),
                },
            ];

            mockTransaction.participant.create.mockResolvedValue({
                id: 'server-1',
                name: 'John Doe',
                email: 'john@example.com',
            });

            const result = await service.processBatchSync(operations);

            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(true);
            expect(result.results[0].serverId).toBe('server-1');
            expect(result.idMappings['local-1']).toBe('server-1');
        });

        it('should process UPDATE operations successfully', async () => {
            const operations = [
                {
                    operation: 'UPDATE' as const,
                    entityType: 'participant',
                    serverId: 'server-1',
                    data: { name: 'Jane Doe' },
                    timestamp: new Date(),
                },
            ];

            mockTransaction.participant.findUnique.mockResolvedValue({
                id: 'server-1',
                updatedAt: new Date('2024-01-01'),
            });

            mockTransaction.participant.update.mockResolvedValue({
                id: 'server-1',
                name: 'Jane Doe',
            });

            const result = await service.processBatchSync(operations);

            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(true);
        });

        it('should process DELETE operations successfully', async () => {
            const operations = [
                {
                    operation: 'DELETE' as const,
                    entityType: 'participant',
                    serverId: 'server-1',
                    timestamp: new Date(),
                },
            ];

            mockTransaction.participant.delete.mockResolvedValue({});

            const result = await service.processBatchSync(operations);

            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(true);
        });

        it('should detect conflicts with last-write-wins', async () => {
            const clientTimestamp = new Date('2024-01-01');
            const serverTimestamp = new Date('2024-01-02');

            const operations = [
                {
                    operation: 'UPDATE' as const,
                    entityType: 'participant',
                    serverId: 'server-1',
                    data: { name: 'Updated Name' },
                    timestamp: clientTimestamp,
                },
            ];

            mockTransaction.participant.findUnique.mockResolvedValue({
                id: 'server-1',
                updatedAt: serverTimestamp,
            });

            const result = await service.processBatchSync(operations);

            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(false);
            expect(result.results[0].conflict).toBeDefined();
            expect(result.results[0].conflict?.serverTimestamp).toEqual(serverTimestamp);
        });

        it('should rollback all operations on error', async () => {
            const operations = [
                {
                    operation: 'CREATE' as const,
                    entityType: 'participant',
                    localId: 'local-1',
                    data: { name: 'John Doe', email: 'john@example.com' },
                    timestamp: new Date(),
                },
                {
                    operation: 'CREATE' as const,
                    entityType: 'participant',
                    localId: 'local-2',
                    data: { name: 'Jane Doe', email: 'jane@example.com' },
                    timestamp: new Date(),
                },
            ];

            mockTransaction.participant.create
                .mockResolvedValueOnce({ id: 'server-1' })
                .mockRejectedValueOnce(new Error('Database error'));

            const result = await service.processBatchSync(operations);

            // All operations should fail due to transaction rollback
            expect(result.results.every(r => !r.success)).toBe(true);
            expect(result.idMappings).toEqual({});
        });

        it('should map local IDs to server IDs in subsequent operations', async () => {
            const operations = [
                {
                    operation: 'CREATE' as const,
                    entityType: 'participant',
                    localId: 'local-p1',
                    data: { name: 'John Doe', email: 'john@example.com' },
                    timestamp: new Date(),
                },
                {
                    operation: 'CREATE' as const,
                    entityType: 'activity',
                    localId: 'local-a1',
                    data: {
                        name: 'Activity 1',
                        activityTypeId: 'type-1',
                        participantId: 'local-p1', // Reference to first operation
                    },
                    timestamp: new Date(),
                },
            ];

            mockTransaction.participant.create.mockResolvedValue({
                id: 'server-p1',
            });

            mockTransaction.activity.create.mockResolvedValue({
                id: 'server-a1',
            });

            const result = await service.processBatchSync(operations);

            expect(result.results).toHaveLength(2);
            expect(result.results.every(r => r.success)).toBe(true);
            expect(result.idMappings['local-p1']).toBe('server-p1');
            expect(result.idMappings['local-a1']).toBe('server-a1');
        });

        it('should handle unsupported entity types', async () => {
            const operations = [
                {
                    operation: 'CREATE' as const,
                    entityType: 'unsupported',
                    localId: 'local-1',
                    data: {},
                    timestamp: new Date(),
                },
            ];

            const result = await service.processBatchSync(operations);

            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(false);
            expect(result.results[0].error).toContain('Unsupported entity type');
        });
    });
});
