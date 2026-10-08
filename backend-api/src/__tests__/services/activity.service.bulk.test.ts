/**
 * Unit tests for ActivityService.bulkMutate.
 *
 * Activity geo-auth derives from the activity's current venue (most-recent
 * activity-venue-history entry), matching getActivityById. These tests cover
 * the full bulk contract.
 */
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { ActivityService } from '../../services/activity.service';
import { BulkMutationService } from '../../services/bulk-mutation.service';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { BulkError, BulkMutationSuccessResponse } from '../../types/bulk-mutation.types';
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

function installTxMock(mockPrisma: MockPrismaClient, txShape: any) {
    (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => cb(txShape));
}

describe('ActivityService.bulkMutate', () => {
    let mockPrisma: MockPrismaClient;
    let repo: ActivityRepository;
    let typeRepo: ActivityTypeRepository;
    let historyRepo: ActivityVenueHistoryRepository;
    let venueRepo: VenueRepository;
    let geoAuth: GeographicAuthorizationService;
    let service: ActivityService;
    let bulkService: BulkMutationService;
    let auditRepo: AuditLogRepository;

    beforeEach(() => {
        mockPrisma = createMockPrismaClient();
        repo = new ActivityRepository(mockPrisma);
        typeRepo = new ActivityTypeRepository(mockPrisma);
        historyRepo = new ActivityVenueHistoryRepository(mockPrisma);
        venueRepo = new VenueRepository(mockPrisma);
        geoAuth = { logAuthorizationDenial: jest.fn().mockResolvedValue(undefined) } as unknown as GeographicAuthorizationService;
        service = new ActivityService(repo, typeRepo, historyRepo, venueRepo, mockPrisma, geoAuth);
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
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('over-cap request throws BULK_TOO_LARGE', async () => {
        const now = new Date().toISOString();
        const creates = Array.from({ length: BULK_MUTATION_MAX_CHANGES + 1 }, (_, i) => ({
            clientKey: `k-${i}`,
            data: { name: 'A', activityTypeId: 'at-1', startDate: now },
        }));
        await expect(
            service.bulkMutate({ creates, updates: [], deletes: [] }, buildAuthCtx(), bulkService)
        ).rejects.toMatchObject({ code: 'BULK_TOO_LARGE' });
    });

    it('mixed valid create+update+delete commits in one transaction', async () => {
        const now = new Date();
        const existing = { id: 'a-1', startDate: now, endDate: null, version: 1 };
        const created = { id: 'a-new', name: 'C', version: 1 };
        const updated = { id: 'a-1', name: 'U', version: 2 };

        const tx = {
            activity: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(existing) // validateUpdate
                    .mockResolvedValueOnce(existing) // validateDelete
                    .mockResolvedValueOnce(updated), // post-update re-fetch
                create: jest.fn().mockResolvedValue(created),
                delete: jest.fn().mockResolvedValue(undefined),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            activityType: { findUnique: jest.fn().mockResolvedValue({ id: 'at-1' }) },
            activityVenueHistory: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        installTxMock(mockPrisma, tx);

        const result = (await service.bulkMutate(
            {
                creates: [
                    {
                        clientKey: 'c1',
                        data: { name: 'C', activityTypeId: 'at-1', startDate: now.toISOString() },
                    },
                ],
                updates: [{ id: 'a-1', version: 1, data: { name: 'U' } }],
                deletes: [{ id: 'a-1', version: 1 }],
            },
            buildAuthCtx(),
            bulkService
        )) as BulkMutationSuccessResponse;

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 1, updated: 1, deleted: 1 });
        expect(auditRepo.create).toHaveBeenCalledTimes(3);
    });

    it('field validation failure (end before start) rolls back', async () => {
        const tx = {
            activity: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), updateMany: jest.fn() },
            activityType: { findUnique: jest.fn().mockResolvedValue({ id: 'at-1' }) },
            activityVenueHistory: { findFirst: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                {
                    creates: [
                        {
                            clientKey: 'c1',
                            data: {
                                name: 'A',
                                activityTypeId: 'at-1',
                                startDate: '2026-01-02T00:00:00Z',
                                endDate: '2026-01-01T00:00:00Z',
                            },
                        },
                    ],
                    updates: [],
                    deletes: [],
                },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toBeInstanceOf(BulkError);
        expect(tx.activity.create).not.toHaveBeenCalled();
    });

    it('reference-integrity failure (unknown activityTypeId) rolls back', async () => {
        const tx = {
            activity: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), updateMany: jest.fn() },
            activityType: { findUnique: jest.fn().mockResolvedValue(null) },
            activityVenueHistory: { findFirst: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                {
                    creates: [
                        {
                            clientKey: 'c1',
                            data: { name: 'A', activityTypeId: 'at-missing', startDate: new Date().toISOString() },
                        },
                    ],
                    updates: [],
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
    });

    it('version conflict rolls back with BULK_VERSION_CONFLICT', async () => {
        const existing = { id: 'a-1', startDate: new Date(), endDate: null, version: 3 };
        const tx = {
            activity: {
                findUnique: jest.fn().mockResolvedValueOnce(existing),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                create: jest.fn(),
                delete: jest.fn(),
            },
            activityType: { findUnique: jest.fn().mockResolvedValue({ id: 'at-1' }) },
            activityVenueHistory: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [{ id: 'a-1', version: 1, data: { name: 'X' } }], deletes: [] },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VERSION_CONFLICT' });
    });

    it('geo-auth denial via current venue outside authorized areas rolls back', async () => {
        const existing = { id: 'a-1', startDate: new Date(), endDate: null, version: 1 };
        const tx = {
            activity: {
                findUnique: jest.fn().mockResolvedValueOnce(existing),
                updateMany: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
            },
            activityType: { findUnique: jest.fn().mockResolvedValue({ id: 'at-1' }) },
            activityVenueHistory: {
                findFirst: jest.fn().mockResolvedValue({ venueId: 'v', venue: { geographicAreaId: 'other-area' } }),
            },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [{ id: 'a-1', version: 1, data: { name: 'X' } }], deletes: [] },
                buildAuthCtx({ hasGeographicRestrictions: true, authorizedAreaIds: ['area-1'] }),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_AUTHORIZATION_DENIED' });
        expect(geoAuth.logAuthorizationDenial).toHaveBeenCalled();
    });
});
