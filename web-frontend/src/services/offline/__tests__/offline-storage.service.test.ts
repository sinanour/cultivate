import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineStorage, db } from '../offline-storage.service';
import type { Participant, Activity, ActivityType, ParticipantRole } from '../../../types';

describe('OfflineStorage', () => {
    beforeEach(async () => {
        await db.participants.clear();
        await db.activities.clear();
        await db.activityTypes.clear();
        await db.participantRoles.clear();
    });

    describe('syncFromServer', () => {
        it('should sync participants to IndexedDB', async () => {
            const participants: Participant[] = [
                {
                    id: '1',
                    name: 'John Doe',
                    email: 'john@example.com',
                    createdAt: '2024-01-01',
                },
                {
                    id: '2',
                    name: 'Jane Smith',
                    email: 'jane@example.com',
                    createdAt: '2024-01-02',
                },
            ];

            await OfflineStorage.syncFromServer({ participants });

            const stored = await db.participants.toArray();
            expect(stored).toHaveLength(2);
            expect(stored[0].name).toBe('John Doe');
            expect(stored[1].name).toBe('Jane Smith');
        });

        it('should sync activities to IndexedDB', async () => {
            const activities: Activity[] = [
                {
                    id: '1',
                    name: 'Activity 1',
                    activityTypeId: 'type1',
                    startDate: '2024-01-01',
                    status: 'ACTIVE',
                    isOngoing: false,
                    createdAt: '2024-01-01',
                },
            ];

            await OfflineStorage.syncFromServer({ activities });

            const stored = await db.activities.toArray();
            expect(stored).toHaveLength(1);
            expect(stored[0].name).toBe('Activity 1');
        });

        it('should sync activity types to IndexedDB', async () => {
            const activityTypes: ActivityType[] = [
                { id: '1', name: 'Type 1', isPredefined: true },
                { id: '2', name: 'Type 2', isPredefined: false },
            ];

            await OfflineStorage.syncFromServer({ activityTypes });

            const stored = await db.activityTypes.toArray();
            expect(stored).toHaveLength(2);
        });

        it('should sync participant roles to IndexedDB', async () => {
            const participantRoles: ParticipantRole[] = [
                { id: '1', name: 'Role 1', isPredefined: true },
            ];

            await OfflineStorage.syncFromServer({ participantRoles });

            const stored = await db.participantRoles.toArray();
            expect(stored).toHaveLength(1);
        });

        it('should clear existing data before syncing', async () => {
            // Add initial data
            await db.participants.add({
                id: '1',
                name: 'Old User',
                email: 'old@example.com',
                createdAt: '2024-01-01',
            });

            // Sync new data
            const participants: Participant[] = [
                {
                    id: '2',
                    name: 'New User',
                    email: 'new@example.com',
                    createdAt: '2024-01-02',
                },
            ];

            await OfflineStorage.syncFromServer({ participants });

            const stored = await db.participants.toArray();
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe('2');
            expect(stored[0].name).toBe('New User');
        });

        it('should sync multiple entity types at once', async () => {
            const participants: Participant[] = [
                { id: '1', name: 'User', email: 'user@example.com', createdAt: '2024-01-01' },
            ];
            const activityTypes: ActivityType[] = [
                { id: '1', name: 'Type', isPredefined: true },
            ];

            await OfflineStorage.syncFromServer({ participants, activityTypes });

            expect(await db.participants.count()).toBe(1);
            expect(await db.activityTypes.count()).toBe(1);
        });
    });

    describe('getLocalData', () => {
        it('should retrieve participants from IndexedDB', async () => {
            await db.participants.add({
                id: '1',
                name: 'Test User',
                email: 'test@example.com',
                createdAt: '2024-01-01',
            });

            const result = await OfflineStorage.getLocalData<Participant>('participants');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test User');
        });

        it('should return empty array for empty table', async () => {
            const result = await OfflineStorage.getLocalData<Participant>('participants');
            expect(result).toHaveLength(0);
        });

        it('should retrieve activities from IndexedDB', async () => {
            await db.activities.add({
                id: '1',
                name: 'Activity',
                activityTypeId: 'type1',
                startDate: '2024-01-01',
                status: 'ACTIVE',
                isOngoing: false,
                createdAt: '2024-01-01',
            });

            const result = await OfflineStorage.getLocalData<Activity>('activities');
            expect(result).toHaveLength(1);
        });
    });

    describe('clearCache', () => {
        it('should clear all cached data', async () => {
            // Add data to all tables
            await db.participants.add({
                id: '1',
                name: 'User',
                email: 'user@example.com',
                createdAt: '2024-01-01',
            });
            await db.activities.add({
                id: '1',
                name: 'Activity',
                activityTypeId: 'type1',
                startDate: '2024-01-01',
                status: 'ACTIVE',
                isOngoing: false,
                createdAt: '2024-01-01',
            });
            await db.activityTypes.add({ id: '1', name: 'Type', isPredefined: true });

            await OfflineStorage.clearCache();

            expect(await db.participants.count()).toBe(0);
            expect(await db.activities.count()).toBe(0);
            expect(await db.activityTypes.count()).toBe(0);
        });
    });
});
