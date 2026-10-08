/**
 * Unit tests for VenueService.bulkMutate (bulk editing).
 *
 * Uses `createMockPrismaClient()` and a mocked `$transaction` whose callback
 * is invoked with a mock `tx`. Asserts the atomic-all-or-nothing contract:
 * on any per-change validation / version / authorization failure the service
 * throws a BulkError and no `tx` write has been attempted.
 */
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { VenueService } from '../../services/venue.service';
import { BulkMutationService } from '../../services/bulk-mutation.service';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { BulkError, BulkMutationSuccessResponse } from '../../types/bulk-mutation.types';
import { AppError } from '../../types/errors.types';
import { AuthorizationContext } from '../../utils/auth.utils';
import { BULK_MUTATION_MAX_CHANGES } from '../../utils/validation.schemas';

function buildAuthCtx(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
    return {
        authorizedAreaIds: ['area-1'],
        hasGeographicRestrictions: false,
        userId: 'user-1',
        userRole: 'EDITOR',
        ...overrides,
    };
}

/**
 * Install a `$transaction` mock that invokes its callback with a tx object
 * built from the given overrides, so the service under test can call
 * `tx.venue.findUnique` etc. and the test can also assert on tx operations.
 */
function installTxMock(mockPrisma: MockPrismaClient, txShape: any) {
    (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => cb(txShape));
}

describe('VenueService.bulkMutate', () => {
    let mockPrisma: MockPrismaClient;
    let venueRepo: VenueRepository;
    let geoRepo: GeographicAreaRepository;
    let geoAuth: GeographicAuthorizationService;
    let service: VenueService;
    let bulkService: BulkMutationService;
    let auditRepo: AuditLogRepository;

    beforeEach(() => {
        mockPrisma = createMockPrismaClient();
        venueRepo = new VenueRepository(mockPrisma);
        geoRepo = new GeographicAreaRepository(mockPrisma);
        geoAuth = {
            evaluateAccess: jest.fn(),
            logAuthorizationDenial: jest.fn().mockResolvedValue(undefined),
        } as unknown as GeographicAuthorizationService;
        service = new VenueService(venueRepo, geoRepo, geoAuth, mockPrisma);
        auditRepo = { create: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
        bulkService = new BulkMutationService(mockPrisma, auditRepo);
    });

    it('empty change set returns success without opening a transaction', async () => {
        const result = (await service.bulkMutate(
            { creates: [], updates: [], deletes: [] },
            buildAuthCtx(),
            bulkService
        )) as BulkMutationSuccessResponse;

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 0, updated: 0, deleted: 0 });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('over-cap request throws AppError before any DB work', async () => {
        const creates = Array.from({ length: BULK_MUTATION_MAX_CHANGES + 1 }, (_, i) => ({
            clientKey: `k-${i}`,
            data: { name: 'X', address: 'A', geographicAreaId: 'area-1' },
        }));
        await expect(
            service.bulkMutate({ creates, updates: [], deletes: [] }, buildAuthCtx(), bulkService)
        ).rejects.toMatchObject({ code: 'BULK_TOO_LARGE', statusCode: 400 });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('mixed valid create+update+delete commits inside one transaction', async () => {
        const existingVenue = { id: 'v-1', geographicAreaId: 'area-1', version: 3 };
        const createdVenue = { id: 'v-new', name: 'New', address: 'A', geographicAreaId: 'area-1', version: 1 };
        const updatedVenue = { id: 'v-1', name: 'Updated', version: 4, geographicAreaId: 'area-1' };

        jest.spyOn(geoRepo, 'exists').mockResolvedValue(true);

        const tx = {
            venue: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(existingVenue) // validateUpdate
                    .mockResolvedValueOnce(existingVenue) // validateDelete pre-check
                    .mockResolvedValueOnce(updatedVenue), // post-update re-fetch
                create: jest.fn().mockResolvedValue(createdVenue),
                delete: jest.fn().mockResolvedValue(undefined),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            activityVenueHistory: { count: jest.fn().mockResolvedValue(0) },
            participantAddressHistory: { count: jest.fn().mockResolvedValue(0) },
        };
        installTxMock(mockPrisma, tx);

        const result = (await service.bulkMutate(
            {
                creates: [
                    {
                        clientKey: 'c1',
                        data: { name: 'New', address: 'A', geographicAreaId: 'area-1' },
                    },
                ],
                updates: [{ id: 'v-1', version: 3, data: { name: 'Updated' } }],
                deletes: [{ id: 'v-1', version: 3 }],
            },
            buildAuthCtx(),
            bulkService
        )) as BulkMutationSuccessResponse;

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 1, updated: 1, deleted: 1 });
        expect(tx.venue.create).toHaveBeenCalled();
        expect(tx.venue.delete).toHaveBeenCalled();
        expect(tx.venue.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'v-1', version: 3 } })
        );
        // Audit entries: one per applied change.
        expect(auditRepo.create).toHaveBeenCalledTimes(3);
    });

    it('field validation failure on one change rolls back - no tx writes attempted', async () => {
        jest.spyOn(geoRepo, 'exists').mockResolvedValue(true);
        const tx = {
            venue: {
                findUnique: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
                updateMany: jest.fn(),
            },
            activityVenueHistory: { count: jest.fn() },
            participantAddressHistory: { count: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                {
                    creates: [
                        {
                            clientKey: 'c1',
                            // latitude out of range should fail validateCreate
                            data: { name: 'X', address: 'A', geographicAreaId: 'area-1', latitude: 999 },
                        },
                    ],
                    updates: [],
                    deletes: [],
                },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toBeInstanceOf(BulkError);

        expect(tx.venue.create).not.toHaveBeenCalled();
        expect(tx.venue.updateMany).not.toHaveBeenCalled();
        expect(tx.venue.delete).not.toHaveBeenCalled();
    });

    it('reference-integrity failure (missing geographic area) rolls back', async () => {
        jest.spyOn(geoRepo, 'exists').mockResolvedValue(false);
        const tx = {
            venue: {
                findUnique: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
                updateMany: jest.fn(),
            },
            activityVenueHistory: { count: jest.fn() },
            participantAddressHistory: { count: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                {
                    creates: [
                        {
                            clientKey: 'c1',
                            data: { name: 'X', address: 'A', geographicAreaId: 'missing' },
                        },
                    ],
                    updates: [],
                    deletes: [],
                },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({
            code: 'BULK_VALIDATION_FAILED',
            errors: expect.arrayContaining([
                expect.objectContaining({ code: 'INVALID_REFERENCE' }),
            ]),
        });
        expect(tx.venue.create).not.toHaveBeenCalled();
    });

    it('version conflict is surfaced as BULK_VERSION_CONFLICT and rolls back', async () => {
        const existing = { id: 'v-1', geographicAreaId: 'area-1', version: 7 };
        const tx = {
            venue: {
                findUnique: jest.fn().mockResolvedValueOnce(existing),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                create: jest.fn(),
                delete: jest.fn(),
            },
            activityVenueHistory: { count: jest.fn() },
            participantAddressHistory: { count: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [{ id: 'v-1', version: 3, data: { name: 'X' } }], deletes: [] },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VERSION_CONFLICT', statusCode: 409 });

        expect(tx.venue.create).not.toHaveBeenCalled();
    });

    it('geo-auth denial on update rolls back and logs denial', async () => {
        const existing = { id: 'v-1', geographicAreaId: 'other-area', version: 2 };
        const tx = {
            venue: { findUnique: jest.fn().mockResolvedValueOnce(existing), updateMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
            activityVenueHistory: { count: jest.fn() },
            participantAddressHistory: { count: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [{ id: 'v-1', version: 2, data: { name: 'X' } }], deletes: [] },
                buildAuthCtx({ hasGeographicRestrictions: true, authorizedAreaIds: ['area-1'] }),
                bulkService
            )
        ).rejects.toMatchObject({
            code: 'BULK_AUTHORIZATION_DENIED',
            statusCode: 422,
            errors: expect.arrayContaining([
                expect.objectContaining({ code: 'GEOGRAPHIC_AUTHORIZATION_DENIED' }),
            ]),
        });

        expect(geoAuth.logAuthorizationDenial).toHaveBeenCalled();
        expect(tx.venue.updateMany).not.toHaveBeenCalled();
    });

    it('REFERENCED_ENTITY delete failure rolls back when a referenced venue is targeted', async () => {
        const existing = { id: 'v-1', geographicAreaId: 'area-1' };
        const tx = {
            venue: { findUnique: jest.fn().mockResolvedValueOnce(existing), updateMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
            activityVenueHistory: { count: jest.fn().mockResolvedValue(2) },
            participantAddressHistory: { count: jest.fn().mockResolvedValue(0) },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [], deletes: [{ id: 'v-1', version: 1 }] },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VALIDATION_FAILED' });
        expect(tx.venue.delete).not.toHaveBeenCalled();
    });

    it('null auditLogRepository is tolerated (no audit side effects)', async () => {
        const bulkServiceNoAudit = new BulkMutationService(mockPrisma);
        const createdVenue = { id: 'v-new', name: 'N', address: 'A', geographicAreaId: 'area-1', version: 1 };

        jest.spyOn(geoRepo, 'exists').mockResolvedValue(true);
        const tx = {
            venue: {
                findUnique: jest.fn(),
                create: jest.fn().mockResolvedValue(createdVenue),
                delete: jest.fn(),
                updateMany: jest.fn(),
            },
            activityVenueHistory: { count: jest.fn() },
            participantAddressHistory: { count: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        const result = (await service.bulkMutate(
            {
                creates: [{ clientKey: 'c1', data: { name: 'N', address: 'A', geographicAreaId: 'area-1' } }],
                updates: [],
                deletes: [],
            },
            buildAuthCtx(),
            bulkServiceNoAudit
        )) as BulkMutationSuccessResponse;

        expect(result.success).toBe(true);
        expect(result.applied.created).toBe(1);
    });

    it('AppError (e.g. INVALID_REFERENCE on update) rolls back and surfaces the code', async () => {
        const existing = { id: 'v-1', geographicAreaId: 'area-1', version: 1 };
        jest.spyOn(geoRepo, 'exists').mockResolvedValue(false);
        const tx = {
            venue: { findUnique: jest.fn().mockResolvedValueOnce(existing), updateMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
            activityVenueHistory: { count: jest.fn() },
            participantAddressHistory: { count: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                {
                    creates: [],
                    updates: [{ id: 'v-1', version: 1, data: { geographicAreaId: 'other-area' } }],
                    deletes: [],
                },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({
            errors: expect.arrayContaining([
                expect.objectContaining({ code: 'INVALID_REFERENCE' }),
            ]),
        });
        // Guard - this verifies the AppError variable is actually imported.
        expect(AppError).toBeDefined();
    });
});
