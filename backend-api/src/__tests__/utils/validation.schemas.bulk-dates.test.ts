import {
    ParticipantBulkMutationSchema,
    ActivityBulkMutationSchema,
} from '../../utils/validation.schemas';

/**
 * Contract tests for the date fields in the bulk-mutation schemas.
 *
 * These lock in the frontend/backend contract behind the reported
 * VALIDATION_ERROR: the schemas validate dates with `z.string().datetime()`,
 * which REQUIRES a full ISO 8601 date-time and REJECTS a bare `YYYY-MM-DD`.
 * The frontend bulk-edit serializer (serializeBulkRow) is responsible for
 * expanding the CloudScape DatePicker's date-only value to full ISO before
 * sending; these tests pin the backend half of that contract so a future
 * schema change that would re-break the frontend is caught here.
 */

describe('Bulk mutation schemas - date field contract', () => {
    describe('ParticipantBulkMutationSchema (updates)', () => {
        const build = (data: Record<string, unknown>) => ({
            creates: [],
            updates: [{ id: '11111111-1111-1111-1111-111111111111', version: 1, data }],
            deletes: [],
        });

        it('accepts a full ISO 8601 dateOfBirth / dateOfRegistration', () => {
            const result = ParticipantBulkMutationSchema.safeParse(
                build({
                    dateOfBirth: '1990-05-20T00:00:00.000Z',
                    dateOfRegistration: '2021-03-01T00:00:00.000Z',
                })
            );
            expect(result.success).toBe(true);
        });

        it('rejects a bare YYYY-MM-DD dateOfBirth (the pre-fix frontend payload)', () => {
            const result = ParticipantBulkMutationSchema.safeParse(
                build({ dateOfBirth: '1990-05-20' })
            );
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(JSON.stringify(result.error.issues)).toContain('Invalid date of birth format');
            }
        });

        it('rejects a bare YYYY-MM-DD dateOfRegistration', () => {
            const result = ParticipantBulkMutationSchema.safeParse(
                build({ dateOfRegistration: '2021-03-01' })
            );
            expect(result.success).toBe(false);
        });

        it('accepts null for a cleared nullable date on update', () => {
            const result = ParticipantBulkMutationSchema.safeParse(
                build({ dateOfBirth: null, dateOfRegistration: null })
            );
            expect(result.success).toBe(true);
        });
    });

    describe('ActivityBulkMutationSchema (updates)', () => {
        const build = (data: Record<string, unknown>) => ({
            creates: [],
            updates: [{ id: '22222222-2222-2222-2222-222222222222', version: 1, data }],
            deletes: [],
        });

        it('accepts full ISO 8601 startDate / endDate', () => {
            const result = ActivityBulkMutationSchema.safeParse(
                build({
                    startDate: '2024-06-01T00:00:00.000Z',
                    endDate: '2024-06-02T00:00:00.000Z',
                })
            );
            expect(result.success).toBe(true);
        });

        it('rejects a bare YYYY-MM-DD startDate', () => {
            const result = ActivityBulkMutationSchema.safeParse(
                build({ startDate: '2024-06-01' })
            );
            expect(result.success).toBe(false);
        });
    });
});
