import { describe, it, expect } from 'vitest';
import {
    serializeBulkRow,
    serializeBulkValue,
    toIsoDateTime,
    type BulkColumnDef,
} from '../BulkEntityConfig';
import { participantBulkConfig } from '../configs/participantBulkConfig';
import { activityBulkConfig } from '../configs/activityBulkConfig';
import { venueBulkConfig } from '../configs/venueBulkConfig';

/**
 * Serializer tests - the pure boundary that converts display-friendly staged
 * values into the exact shape the backend bulk Zod schemas expect.
 *
 * These lock in the fixes for the frontend/backend validation mismatches:
 *   - date-only `YYYY-MM-DD` -> full ISO 8601 (the reported 400)
 *   - cleared optional field -> `null` on update, omitted on create
 *   - cleared non-nullable optional enum (activity.status) -> omitted
 */

describe('toIsoDateTime', () => {
    it('expands a date-only string to a full ISO 8601 date-time', () => {
        expect(toIsoDateTime('2020-01-15')).toBe('2020-01-15T00:00:00.000Z');
    });

    it('passes an already-ISO string through as a valid ISO date-time', () => {
        expect(toIsoDateTime('2020-01-15T12:34:56.000Z')).toBe('2020-01-15T12:34:56.000Z');
    });

    it('maps empty / null / undefined to null', () => {
        expect(toIsoDateTime('')).toBeNull();
        expect(toIsoDateTime(null)).toBeNull();
        expect(toIsoDateTime(undefined)).toBeNull();
    });

    it('returns an unparseable value unchanged (so the backend reports it)', () => {
        expect(toIsoDateTime('not-a-date')).toBe('not-a-date');
    });
});

describe('serializeBulkValue - type-based defaults', () => {
    const dateCol: BulkColumnDef<{ d: string }> = { field: 'd', header: 'D', type: 'date' };
    const textCol: BulkColumnDef<{ t: string }> = { field: 't', header: 'T', type: 'text' };

    it('date column -> ISO on both create and update', () => {
        expect(serializeBulkValue(dateCol, '2020-01-15', 'create')).toBe('2020-01-15T00:00:00.000Z');
        expect(serializeBulkValue(dateCol, '2020-01-15', 'update')).toBe('2020-01-15T00:00:00.000Z');
    });

    it('empty date -> omitted on create, null on update', () => {
        expect(serializeBulkValue(dateCol, '', 'create')).toBeUndefined();
        expect(serializeBulkValue(dateCol, '', 'update')).toBeNull();
    });

    it('empty text -> omitted on create, null on update', () => {
        expect(serializeBulkValue(textCol, '', 'create')).toBeUndefined();
        expect(serializeBulkValue(textCol, '', 'update')).toBeNull();
    });

    it('honors an explicit column serialize hook over the default', () => {
        const col: BulkColumnDef<{ x: string }> = {
            field: 'x',
            header: 'X',
            type: 'enum',
            serialize: (v) => (v === null || v === undefined || v === '' ? undefined : v),
        };
        expect(serializeBulkValue(col, null, 'update')).toBeUndefined();
        expect(serializeBulkValue(col, 'ACTIVE', 'update')).toBe('ACTIVE');
    });
});

describe('serializeBulkRow - participant', () => {
    it('converts both date fields to ISO on update (the reported 400)', () => {
        const out = serializeBulkRow(
            participantBulkConfig.columns,
            { dateOfBirth: '1990-05-20', dateOfRegistration: '2021-03-01' } as never,
            'update'
        );
        expect(out.dateOfBirth).toBe('1990-05-20T00:00:00.000Z');
        expect(out.dateOfRegistration).toBe('2021-03-01T00:00:00.000Z');
    });

    it('nulls a cleared optional field on update but omits it on create', () => {
        expect(
            serializeBulkRow(participantBulkConfig.columns, { email: '' } as never, 'update')
        ).toEqual({ email: null });
        expect(
            serializeBulkRow(participantBulkConfig.columns, { email: '' } as never, 'create')
        ).toEqual({});
    });

    it('only emits fields present in the staged partial', () => {
        const out = serializeBulkRow(
            participantBulkConfig.columns,
            { name: 'Jane' } as never,
            'update'
        );
        expect(out).toEqual({ name: 'Jane' });
    });
});

describe('serializeBulkRow - activity', () => {
    it('converts startDate and endDate to ISO', () => {
        const out = serializeBulkRow(
            activityBulkConfig.columns,
            { startDate: '2024-06-01', endDate: '2024-06-02' } as never,
            'update'
        );
        expect(out.startDate).toBe('2024-06-01T00:00:00.000Z');
        expect(out.endDate).toBe('2024-06-02T00:00:00.000Z');
    });

    it('omits a cleared status (non-nullable optional enum) on update', () => {
        const out = serializeBulkRow(
            activityBulkConfig.columns,
            { status: null } as never,
            'update'
        );
        expect('status' in out).toBe(false);
    });

    it('keeps a chosen status value', () => {
        const out = serializeBulkRow(
            activityBulkConfig.columns,
            { status: 'ACTIVE' } as never,
            'update'
        );
        expect(out.status).toBe('ACTIVE');
    });
});

describe('serializeBulkRow - venue', () => {
    it('nulls a cleared nullable venueType on update (clearing allowed)', () => {
        const out = serializeBulkRow(
            venueBulkConfig.columns,
            { venueType: '' } as never,
            'update'
        );
        expect(out).toEqual({ venueType: null });
    });

    it('passes numeric lat/long through unchanged', () => {
        const out = serializeBulkRow(
            venueBulkConfig.columns,
            { latitude: 12.5, longitude: -0.1 } as never,
            'update'
        );
        expect(out).toEqual({ latitude: 12.5, longitude: -0.1 });
    });
});
