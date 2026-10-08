import type { Participant } from '../../../../types';
import type { BulkEntityConfig } from '../BulkEntityConfig';
import { validateRequiredFields } from '../BulkEntityConfig';

/**
 * Bulk-edit config for Participants (spec section 2.7).
 *
 * Editable fields: name, email, phone, nickname, dateOfBirth,
 * dateOfRegistration, notes.
 */
export const participantBulkConfig: BulkEntityConfig<Participant> = {
    entityName: 'Participants',
    entityPath: 'participants',
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
            field: 'email',
            header: 'Email',
            type: 'text',
            minWidth: 220,
            validate: (v) => {
                if (v == null || v === '') return null;
                if (typeof v !== 'string') return 'Email must be a string';
                if (v.length > 200) return 'Email must be at most 200 characters';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email format';
                return null;
            },
        },
        {
            field: 'phone',
            header: 'Phone',
            type: 'text',
            minWidth: 160,
            validate: (v) =>
                typeof v === 'string' && v.length > 20
                    ? 'Phone must be at most 20 characters'
                    : null,
        },
        {
            field: 'nickname',
            header: 'Nickname',
            type: 'text',
            minWidth: 160,
            validate: (v) =>
                typeof v === 'string' && v.length > 100
                    ? 'Nickname must be at most 100 characters'
                    : null,
        },
        {
            field: 'dateOfBirth',
            header: 'Date of Birth',
            type: 'date',
            minWidth: 160,
            validate: (v) => {
                if (!v) return null;
                const d = typeof v === 'string' ? new Date(v) : (v as Date);
                if (Number.isNaN(d.getTime())) return 'Invalid date';
                if (d >= new Date()) return 'Date of birth must be in the past';
                return null;
            },
        },
        {
            field: 'dateOfRegistration',
            header: 'Date of Registration',
            type: 'date',
            minWidth: 180,
        },
        {
            field: 'notes',
            header: 'Notes',
            type: 'text',
            minWidth: 240,
            validate: (v) =>
                typeof v === 'string' && v.length > 1000
                    ? 'Notes must be at most 1000 characters'
                    : null,
        },
    ],
    emptyRow: () => ({
        name: '',
    }),
    clientValidate: (row) => validateRequiredFields(participantBulkConfig.columns, row),
};
