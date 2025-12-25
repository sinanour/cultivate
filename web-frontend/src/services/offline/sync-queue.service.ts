import { db } from './offline-storage.service';
import { ApiClient } from '../api/api.client';

interface QueuedOperation {
    id?: number;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string;
    data: any;
    timestamp: number;
    retries: number;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

export class SyncQueue {
    static async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): Promise<void> {
        try {
            await db.syncQueue.add({
                ...operation,
                timestamp: Date.now(),
                retries: 0,
            });
        } catch (error) {
            console.error('Failed to enqueue operation:', error);
            throw error;
        }
    }

    static async processQueue(): Promise<{ success: number; failed: number }> {
        const operations = await db.syncQueue.toArray();
        let success = 0;
        let failed = 0;

        for (const operation of operations) {
            try {
                await this.executeOperation(operation);
                await db.syncQueue.delete(operation.id!);
                success++;
            } catch (error) {
                console.error('Failed to process operation:', error);

                // Increment retry count
                const newRetries = operation.retries + 1;

                if (newRetries >= MAX_RETRIES) {
                    // Max retries reached, remove from queue
                    await db.syncQueue.delete(operation.id!);
                    failed++;
                } else {
                    // Update retry count
                    await db.syncQueue.update(operation.id!, { retries: newRetries });
                    failed++;
                }
            }
        }

        return { success, failed };
    }

    static async clearQueue(): Promise<void> {
        try {
            await db.syncQueue.clear();
        } catch (error) {
            console.error('Failed to clear sync queue:', error);
            throw error;
        }
    }

    static async getQueueLength(): Promise<number> {
        try {
            return await db.syncQueue.count();
        } catch (error) {
            console.error('Failed to get queue length:', error);
            return 0;
        }
    }

    static getRetryDelay(retries: number): number {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        return BASE_DELAY * Math.pow(2, retries);
    }

    private static async executeOperation(operation: QueuedOperation): Promise<void> {
        const { type, entity, data } = operation;
        const endpoint = this.getEndpoint(entity, data.id);

        switch (type) {
            case 'CREATE':
                await ApiClient.post(endpoint, data);
                break;
            case 'UPDATE':
                await ApiClient.put(endpoint, data);
                break;
            case 'DELETE':
                await ApiClient.delete(endpoint);
                break;
        }
    }

    private static getEndpoint(entity: string, id?: string): string {
        const baseEndpoint = `/${entity}`;
        return id ? `${baseEndpoint}/${id}` : baseEndpoint;
    }
}
