import Dexie, { type EntityTable } from 'dexie';
import type { Participant, Activity, ActivityType, ParticipantRole, Assignment } from '../../types';

interface QueuedOperation {
    id?: number;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string;
    data: any;
    timestamp: number;
    retries: number;
}

class OfflineDatabase extends Dexie {
    participants!: EntityTable<Participant, 'id'>;
    activities!: EntityTable<Activity, 'id'>;
    activityTypes!: EntityTable<ActivityType, 'id'>;
    participantRoles!: EntityTable<ParticipantRole, 'id'>;
    assignments!: EntityTable<Assignment, 'id'>;
    syncQueue!: EntityTable<QueuedOperation, 'id'>;

    constructor() {
        super('CultivateDB');

        this.version(1).stores({
            participants: 'id, name, email',
            activities: 'id, name, activityTypeId, status',
            activityTypes: 'id, name',
            participantRoles: 'id, name',
            assignments: 'id, activityId, participantId, roleId',
            syncQueue: '++id, timestamp, entity',
        });
    }
}

export const db = new OfflineDatabase();

export class OfflineStorage {
    static async syncFromServer(data: {
        participants?: Participant[];
        activities?: Activity[];
        activityTypes?: ActivityType[];
        participantRoles?: ParticipantRole[];
        assignments?: Assignment[];
    }): Promise<void> {
        try {
            if (data.participants) {
                await db.participants.clear();
                await db.participants.bulkAdd(data.participants);
            }
            if (data.activities) {
                await db.activities.clear();
                await db.activities.bulkAdd(data.activities);
            }
            if (data.activityTypes) {
                await db.activityTypes.clear();
                await db.activityTypes.bulkAdd(data.activityTypes);
            }
            if (data.participantRoles) {
                await db.participantRoles.clear();
                await db.participantRoles.bulkAdd(data.participantRoles);
            }
            if (data.assignments) {
                await db.assignments.clear();
                await db.assignments.bulkAdd(data.assignments);
            }
        } catch (error) {
            console.error('Failed to sync data to IndexedDB:', error);
            throw error;
        }
    }

    static async getLocalData<T>(table: 'participants' | 'activities' | 'activityTypes' | 'participantRoles' | 'assignments'): Promise<T[]> {
        try {
            return await db[table].toArray() as T[];
        } catch (error) {
            console.error(`Failed to get local data from ${table}:`, error);
            return [];
        }
    }

    static async clearCache(): Promise<void> {
        try {
            await db.participants.clear();
            await db.activities.clear();
            await db.activityTypes.clear();
            await db.participantRoles.clear();
            await db.assignments.clear();
        } catch (error) {
            console.error('Failed to clear cache:', error);
            throw error;
        }
    }
}
