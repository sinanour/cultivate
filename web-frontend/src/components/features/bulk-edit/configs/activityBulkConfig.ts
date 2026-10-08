import type { Activity } from '../../../../types';
import { ActivityTypeService } from '../../../../services/api/activity-type.service';
import type { BulkEntityConfig } from '../BulkEntityConfig';
import { validateRequiredFields } from '../BulkEntityConfig';

/**
 * Bulk-edit config for Activities (spec section 2.7).
 *
 * Editable fields: name, activityTypeId, startDate, endDate, status,
 * additionalParticipantCount, notes.
 */
export const activityBulkConfig: BulkEntityConfig<Activity> = {
    entityName: 'Activities',
    entityPath: 'activities',
    columns: [
        {
            field: 'name',
            header: 'Name',
            type: 'text',
            required: true,
            minWidth: 200,
            validate: (v) =>
                typeof v === 'string' && v.length > 200
                    ? 'Name must be at most 200 characters'
                    : null,
        },
        {
            field: 'activityTypeId',
            header: 'Activity Type',
            type: 'reference',
            required: true,
            minWidth: 220,
            reference: {
                entityType: 'activity-type',
                fetchFunction: async (params) => {
                    const data = await ActivityTypeService.getActivityTypes();
                    const term = (params.filter?.name as string | undefined)?.toLowerCase();
                    const filtered = term
                        ? data.filter((t: { name: string }) => t.name.toLowerCase().includes(term))
                        : data;
                    return { data: filtered } as { data: unknown[]; pagination?: unknown };
                },
                fetchByIdFunction: async (id) => {
                    const all = await ActivityTypeService.getActivityTypes();
                    return all.find((t: { id: string }) => t.id === id);
                },
                formatOption: (entity) => {
                    const t = entity as { id: string; name: string };
                    return { value: t.id, label: t.name };
                },
                renderLabel: (row) => {
                    const t = (row as { activityType?: { name: string } }).activityType;
                    const id = (row as { activityTypeId?: string }).activityTypeId;
                    return t?.name ?? id ?? '-';
                },
            },
        },
        {
            field: 'startDate',
            header: 'Start Date',
            type: 'date',
            required: true,
            minWidth: 160,
        },
        {
            field: 'endDate',
            header: 'End Date',
            type: 'date',
            minWidth: 160,
            validate: (v, row) => {
                if (!v) return null;
                const start = row.startDate as string | Date | undefined;
                if (!start) return null;
                const startDate = new Date(start);
                const endDate = typeof v === 'string' ? new Date(v) : (v as Date);
                if (Number.isNaN(endDate.getTime())) return 'Invalid date';
                if (endDate < startDate) return 'End date must be on or after start date';
                return null;
            },
        },
        {
            field: 'status',
            header: 'Status',
            type: 'enum',
            minWidth: 160,
            choices: [
                { value: 'PLANNED', label: 'Planned' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
            ],
            // status is `enum().optional()` on the backend (not nullable): a
            // cleared Select stages `null`, which the schema rejects, so omit
            // the field entirely when empty instead of sending `null`.
            serialize: (v) => (v === null || v === undefined || v === '' ? undefined : v),
        },
        {
            field: 'additionalParticipantCount',
            header: 'Additional Participants',
            type: 'number',
            minWidth: 200,
            validate: (v) => {
                if (v == null || v === '') return null;
                if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
                    return 'Additional participant count must be a positive integer';
                }
                return null;
            },
        },
        {
            field: 'notes',
            header: 'Notes',
            type: 'text',
            minWidth: 240,
            validate: (v) =>
                typeof v === 'string' && v.length > 2000
                    ? 'Notes must be at most 2000 characters'
                    : null,
        },
    ],
    emptyRow: () => ({
        name: '',
        activityTypeId: '',
        startDate: '',
        status: 'PLANNED' as Activity['status'],
    }),
    clientValidate: (row) => validateRequiredFields(activityBulkConfig.columns, row),
};
