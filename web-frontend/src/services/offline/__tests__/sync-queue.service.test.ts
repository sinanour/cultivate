import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncQueue } from '../sync-queue.service';
import { db } from '../offline-storage.service';

vi.mock('../../api/api.client');

describe('SyncQueue', () => {
    beforeEach(async () => {
        await db.syncQueue.clear();
        vi.clearAllMocks();
    });

    describe('enqueue', () => {
        it('should add operation to queue', async () => {
            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test' },
            });

            const count = await db.syncQueue.count();
            expect(count).toBe(1);

            const operations = await db.syncQueue.toArray();
            expect(operations[0].type).toBe('CREATE');
            expect(operations[0].entity).toBe('participants');
            expect(operations[0].retries).toBe(0);
            expect(operations[0].timestamp).toBeDefined();
        });

        it('should add multiple operations', async () => {
            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test1' },
            });

            await SyncQueue.enqueue({
                type: 'UPDATE',
                entity: 'activities',
                data: { id: '1', name: 'Test2' },
            });

            const count = await db.syncQueue.count();
            expect(count).toBe(2);
        });
    });

    describe('getQueueLength', () => {
        it('should return 0 for empty queue', async () => {
            const length = await SyncQueue.getQueueLength();
            expect(length).toBe(0);
        });

        it('should return correct count', async () => {
            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test' },
            });

            const length = await SyncQueue.getQueueLength();
            expect(length).toBe(1);
        });
    });

    describe('clearQueue', () => {
        it('should clear all operations', async () => {
            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test' },
            });

            await SyncQueue.clearQueue();

            const count = await db.syncQueue.count();
            expect(count).toBe(0);
        });
    });

    describe('getRetryDelay', () => {
        it('should return exponential backoff delays', () => {
            expect(SyncQueue.getRetryDelay(0)).toBe(1000);
            expect(SyncQueue.getRetryDelay(1)).toBe(2000);
            expect(SyncQueue.getRetryDelay(2)).toBe(4000);
            expect(SyncQueue.getRetryDelay(3)).toBe(8000);
            expect(SyncQueue.getRetryDelay(4)).toBe(16000);
        });
    });

    describe('processQueue', () => {
        it('should process CREATE operations successfully', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.post).mockResolvedValue({ id: '1' });

            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test' },
            });

            const result = await SyncQueue.processQueue();

            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
            expect(ApiClient.post).toHaveBeenCalledWith('/participants', { name: 'Test' });

            const count = await db.syncQueue.count();
            expect(count).toBe(0);
        });

        it('should process UPDATE operations successfully', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.put).mockResolvedValue({ id: '1', updated: true });

            await SyncQueue.enqueue({
                type: 'UPDATE',
                entity: 'participants',
                data: { id: '1', name: 'Updated' },
            });

            const result = await SyncQueue.processQueue();

            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
            expect(ApiClient.put).toHaveBeenCalledWith('/participants/1', { id: '1', name: 'Updated' });
        });

        it('should process DELETE operations successfully', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.delete).mockResolvedValue(undefined);

            await SyncQueue.enqueue({
                type: 'DELETE',
                entity: 'participants',
                data: { id: '1' },
            });

            const result = await SyncQueue.processQueue();

            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
            expect(ApiClient.delete).toHaveBeenCalledWith('/participants/1');
        });

        it('should increment retry count on failure', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.post).mockRejectedValue(new Error('Network error'));

            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test' },
            });

            const result = await SyncQueue.processQueue();

            expect(result.success).toBe(0);
            expect(result.failed).toBe(1);

            const operations = await db.syncQueue.toArray();
            expect(operations[0].retries).toBe(1);
        });

        it('should remove operation after max retries', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.post).mockRejectedValue(new Error('Network error'));

            await db.syncQueue.add({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test' },
                timestamp: Date.now(),
                retries: 4,
            });

            const result = await SyncQueue.processQueue();

            expect(result.failed).toBe(1);

            const count = await db.syncQueue.count();
            expect(count).toBe(0);
        });

        it('should process multiple operations', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.post).mockResolvedValue({ id: '1' });
            vi.mocked(ApiClient.put).mockResolvedValue({ id: '2' });

            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test1' },
            });

            await SyncQueue.enqueue({
                type: 'UPDATE',
                entity: 'participants',
                data: { id: '2', name: 'Test2' },
            });

            const result = await SyncQueue.processQueue();

            expect(result.success).toBe(2);
            expect(result.failed).toBe(0);
        });

        it('should handle mixed success and failure', async () => {
            const { ApiClient } = await import('../../api/api.client');
            vi.mocked(ApiClient.post)
                .mockResolvedValueOnce({ id: '1' })
                .mockRejectedValueOnce(new Error('Failed'));

            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test1' },
            });

            await SyncQueue.enqueue({
                type: 'CREATE',
                entity: 'participants',
                data: { name: 'Test2' },
            });

            const result = await SyncQueue.processQueue();

            expect(result.success).toBe(1);
            expect(result.failed).toBe(1);
        });
    });
});
