/**
 * Unit tests for ParticipantService.bulkMutate.
 *
 * Participant geo-auth derives from the most-recent address-history entry
 * (same path as `getParticipantById`). This file verifies the full bulk
 * contract against a mocked tx, including the participant-specific geo-auth
 * path and email duplication checks.
 */
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { ParticipantService } from '../../services/participant.service';
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

describe('ParticipantService.bulkMutate', () => {
    let mockPrisma: MockPrismaClient;
    let repo: ParticipantRepository;
    let addressRepo: ParticipantAddressHistoryRepository;
    let assignmentRepo: AssignmentRepository;
    let geoAuth: GeographicAuthorizationService;
    let service: ParticipantService;
    let bulkService: BulkMutationService;
    let auditRepo: AuditLogRepository;

    beforeEach(() => {
        mockPrisma = createMockPrismaClient();
        repo = new ParticipantRepository(mockPrisma);
        addressRepo = new ParticipantAddressHistoryRepository(mockPrisma);
        assignmentRepo = new AssignmentRepository(mockPrisma);
        geoAuth = { logAuthorizationDenial: jest.fn().mockResolvedValue(undefined) } as unknown as GeographicAuthorizationService;
        service = new ParticipantService(repo, addressRepo, assignmentRepo, mockPrisma, geoAuth);
        auditRepo = { create: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
        bulkService = new BulkMutationService(mockPrisma, auditRepo);
    });

    it('empty change set returns success without a transaction', async () => {
        const result = (await service.bulkMutate(
            { creates: [], updates: [], deletes: [] },
            buildAuthCtx(),
            bulkService
        )) as BulkMutationSuccessResponse;
        expect(result.success).toBe(true);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an over-cap request as BULK_TOO_LARGE before any DB work', async () => {
        const creates = Array.from({ length: BULK_MUTATION_MAX_CHANGES + 1 }, (_, i) => ({
            clientKey: `k-${i}`,
            data: { name: 'A' },
        }));
        await expect(
            service.bulkMutate({ creates, updates: [], deletes: [] }, buildAuthCtx(), bulkService)
        ).rejects.toMatchObject({ code: 'BULK_TOO_LARGE', statusCode: 400 });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('mixed valid create+update+delete commits in one transaction', async () => {
        const existing = { id: 'p-1', email: 'a@b.com', version: 2 };
        const createdP = { id: 'p-new', name: 'N', version: 1 };
        const updatedP = { id: 'p-1', name: 'Updated', version: 3 };

        const tx = {
            participant: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(existing) // update - find existing
                    .mockResolvedValueOnce(existing) // delete - find existing
                    .mockResolvedValueOnce(updatedP), // post-update re-fetch
                create: jest.fn().mockResolvedValue(createdP),
                delete: jest.fn().mockResolvedValue(undefined),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            participantAddressHistory: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
        };
        installTxMock(mockPrisma, tx);

        const result = (await service.bulkMutate(
            {
                creates: [{ clientKey: 'c1', data: { name: 'N' } }],
                updates: [{ id: 'p-1', version: 2, data: { name: 'Updated' } }],
                deletes: [{ id: 'p-1', version: 2 }],
            },
            buildAuthCtx(),
            bulkService
        )) as BulkMutationSuccessResponse;

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 1, updated: 1, deleted: 1 });
        expect(tx.participant.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'p-1', version: 2 } })
        );
        expect(auditRepo.create).toHaveBeenCalledTimes(3);
    });

    it('field validation failure (dateOfBirth in future) rolls back', async () => {
        const tx = {
            participant: {
                findUnique: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
                updateMany: jest.fn(),
            },
            participantAddressHistory: { findFirst: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        const future = new Date(Date.now() + 86400000).toISOString();
        await expect(
            service.bulkMutate(
                { creates: [{ clientKey: 'c1', data: { name: 'A', dateOfBirth: future } }], updates: [], deletes: [] },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toBeInstanceOf(BulkError);
        expect(tx.participant.create).not.toHaveBeenCalled();
    });

    it('duplicate email on create rolls back with DUPLICATE_EMAIL', async () => {
        const tx = {
            participant: {
                findUnique: jest.fn().mockResolvedValue({ id: 'other' }),
                create: jest.fn(),
                delete: jest.fn(),
                updateMany: jest.fn(),
            },
            participantAddressHistory: { findFirst: jest.fn() },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [{ clientKey: 'c1', data: { name: 'A', email: 'a@b.com' } }], updates: [], deletes: [] },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({
            errors: expect.arrayContaining([
                expect.objectContaining({ code: 'DUPLICATE_EMAIL' }),
            ]),
        });
    });

    it('version conflict rolls back with BULK_VERSION_CONFLICT', async () => {
        const existing = { id: 'p-1', email: 'a@b.com', version: 5 };
        const tx = {
            participant: {
                findUnique: jest.fn().mockResolvedValueOnce(existing),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                create: jest.fn(),
                delete: jest.fn(),
            },
            participantAddressHistory: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [{ id: 'p-1', version: 2, data: { name: 'X' } }], deletes: [] },
                buildAuthCtx(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VERSION_CONFLICT', statusCode: 409 });
    });

    it('geo-auth denial for restricted user (current address outside authorized areas) rolls back', async () => {
        const existing = { id: 'p-1', email: 'a@b.com', version: 1 };
        const tx = {
            participant: {
                findUnique: jest.fn().mockResolvedValueOnce(existing),
                updateMany: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
            },
            participantAddressHistory: {
                findFirst: jest.fn().mockResolvedValue({
                    venueId: 'v',
                    venue: { geographicAreaId: 'other-area' },
                }),
            },
        };
        installTxMock(mockPrisma, tx);

        await expect(
            service.bulkMutate(
                { creates: [], updates: [{ id: 'p-1', version: 1, data: { name: 'X' } }], deletes: [] },
                buildAuthCtx({ hasGeographicRestrictions: true, authorizedAreaIds: ['area-1'] }),
                bulkService
            )
        ).rejects.toMatchObject({
            code: 'BULK_AUTHORIZATION_DENIED',
            errors: expect.arrayContaining([
                expect.objectContaining({ code: 'GEOGRAPHIC_AUTHORIZATION_DENIED' }),
            ]),
        });
        expect(geoAuth.logAuthorizationDenial).toHaveBeenCalled();
    });

    it('restricted user without any address history is allowed (matches single-record flow)', async () => {
        const existing = { id: 'p-1', email: 'a@b.com', version: 1 };
        const updated = { id: 'p-1', version: 2 };
        const tx = {
            participant: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(existing)
                    .mockResolvedValueOnce(updated),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                create: jest.fn(),
                delete: jest.fn(),
            },
            participantAddressHistory: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        installTxMock(mockPrisma, tx);

        const result = (await service.bulkMutate(
            { creates: [], updates: [{ id: 'p-1', version: 1, data: { name: 'X' } }], deletes: [] },
            buildAuthCtx({ hasGeographicRestrictions: true, authorizedAreaIds: ['area-1'] }),
            bulkService
        )) as BulkMutationSuccessResponse;

        expect(result.success).toBe(true);
        expect(result.applied.updated).toBe(1);
    });
});
