/**
 * Integration test for POST /api/participants/bulk.
 *
 * Verifies against a real DB:
 *  - Happy path commits a mixed change set.
 *  - Atomic rollback: ONE invalid change (bad version, duplicate email, or
 *    out-of-area target) leaves every pre-existing participant byte-for-byte
 *    unchanged (requirement 14.3).
 *  - Version conflict surfaces as BULK_VERSION_CONFLICT.
 *
 * Follows the project isolation rules.
 */
import { PrismaClient, AuthorizationRuleType } from '@prisma/client';
import { ParticipantService } from '../../services/participant.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { BulkMutationService } from '../../services/bulk-mutation.service';
import { getPrismaClient } from '../../utils/prisma.client';
import { TestHelpers } from '../utils';
import { AuthorizationContext } from '../../utils/auth.utils';

describe('Participant bulk mutations (integration)', () => {
    const testSuffix = Date.now() + '-pbulk';
    let prisma: PrismaClient;
    let service: ParticipantService;
    let bulkService: BulkMutationService;

    let userId: string;
    let areaAId: string;
    let areaBId: string;
    let venueAId: string;
    let venueBId: string;
    const createdParticipantIds: string[] = [];

    beforeAll(async () => {
        prisma = getPrismaClient();
        const repo = new ParticipantRepository(prisma);
        const addressRepo = new ParticipantAddressHistoryRepository(prisma);
        const assignmentRepo = new AssignmentRepository(prisma);
        const userGeoAuthRepo = new UserGeographicAuthorizationRepository(prisma);
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const userRepo = new UserRepository(prisma);
        const auditRepo = new AuditLogRepository(prisma);
        const geoAuth = new GeographicAuthorizationService(userGeoAuthRepo, geoAreaRepo, userRepo, auditRepo);
        service = new ParticipantService(repo, addressRepo, assignmentRepo, prisma, geoAuth);
        bulkService = new BulkMutationService(prisma, auditRepo);

        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        userId = user.id;

        const areaA = await prisma.geographicArea.create({
            data: { name: `BulkPTest Area A ${testSuffix}`, areaType: 'CITY' },
        });
        areaAId = areaA.id;
        const areaB = await prisma.geographicArea.create({
            data: { name: `BulkPTest Area B ${testSuffix}`, areaType: 'CITY' },
        });
        areaBId = areaB.id;

        const vA = await prisma.venue.create({
            data: { name: `BulkPTest Venue A ${testSuffix}`, address: 'a', geographicAreaId: areaAId },
        });
        venueAId = vA.id;
        const vB = await prisma.venue.create({
            data: { name: `BulkPTest Venue B ${testSuffix}`, address: 'b', geographicAreaId: areaBId },
        });
        venueBId = vB.id;
    });

    afterAll(async () => {
        await TestHelpers.cleanupTestData(prisma, {
            participantIds: createdParticipantIds,
            venueIds: [venueAId, venueBId],
            geographicAreaIds: [areaAId, areaBId],
            userIds: [userId],
        });
        await prisma.$disconnect();
    });

    const unrestrictedAuth = (): AuthorizationContext => ({
        authorizedAreaIds: [],
        hasGeographicRestrictions: false,
        userId,
        userRole: 'EDITOR',
    });

    it('happy path: commits mixed creates, updates, and deletes', async () => {
        const toUpdate = await prisma.participant.create({
            data: { name: `P-upd ${testSuffix}`, email: `p-upd-${testSuffix}@test.com` },
        });
        const toDelete = await prisma.participant.create({
            data: { name: `P-del ${testSuffix}`, email: `p-del-${testSuffix}@test.com` },
        });
        createdParticipantIds.push(toUpdate.id, toDelete.id);

        const result = await service.bulkMutate(
            {
                creates: [{ clientKey: 'c1', data: { name: `P-new ${testSuffix}`, email: `p-new-${testSuffix}@test.com` } }],
                updates: [{ id: toUpdate.id, version: toUpdate.version, data: { name: `P-renamed ${testSuffix}` } }],
                deletes: [{ id: toDelete.id, version: toDelete.version }],
            },
            unrestrictedAuth(),
            bulkService
        );

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 1, updated: 1, deleted: 1 });

        const createdId = (result as any).results.creates[0].record.id as string;
        createdParticipantIds.push(createdId);

        const updated = await prisma.participant.findUnique({ where: { id: toUpdate.id } });
        expect(updated?.name).toBe(`P-renamed ${testSuffix}`);
        expect(updated?.version).toBe(toUpdate.version + 1);
        const deleted = await prisma.participant.findUnique({ where: { id: toDelete.id } });
        expect(deleted).toBeNull();
    });

    it('atomic rollback: duplicate-email failure leaves DB equal to pre-state', async () => {
        const existing = await prisma.participant.create({
            data: { name: `P-rb-existing ${testSuffix}`, email: `rb-existing-${testSuffix}@test.com` },
        });
        const toUpdate = await prisma.participant.create({
            data: { name: `P-rb-upd ${testSuffix}`, email: `rb-upd-${testSuffix}@test.com` },
        });
        createdParticipantIds.push(existing.id, toUpdate.id);

        const preState = await prisma.participant.findMany({
            where: { id: { in: [existing.id, toUpdate.id] } },
            orderBy: { id: 'asc' },
        });

        await expect(
            service.bulkMutate(
                {
                    // One valid create would succeed in isolation.
                    creates: [{ clientKey: 'c-ok', data: { name: `P-rb-new ${testSuffix}` } }],
                    // ONE invalid update: email collides with `existing`.
                    updates: [
                        {
                            id: toUpdate.id,
                            version: toUpdate.version,
                            data: { email: `rb-existing-${testSuffix}@test.com` },
                        },
                    ],
                    deletes: [],
                },
                unrestrictedAuth(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VALIDATION_FAILED' });

        // Pre-state preserved.
        const postState = await prisma.participant.findMany({
            where: { id: { in: [existing.id, toUpdate.id] } },
            orderBy: { id: 'asc' },
        });
        expect(postState).toEqual(preState);

        // No stray create.
        const strays = await prisma.participant.findMany({
            where: { name: `P-rb-new ${testSuffix}` },
        });
        expect(strays).toHaveLength(0);
    });

    it('version conflict rolls back and preserves pre-state', async () => {
        const target = await prisma.participant.create({
            data: { name: `P-vc ${testSuffix}`, email: `vc-${testSuffix}@test.com` },
        });
        createdParticipantIds.push(target.id);
        await prisma.participant.update({
            where: { id: target.id },
            data: { version: { increment: 1 } },
        });
        const pre = await prisma.participant.findUnique({ where: { id: target.id } });

        await expect(
            service.bulkMutate(
                {
                    creates: [],
                    updates: [{ id: target.id, version: target.version, data: { name: `vc-wont-${testSuffix}` } }],
                    deletes: [],
                },
                unrestrictedAuth(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VERSION_CONFLICT', statusCode: 409 });
        const post = await prisma.participant.findUnique({ where: { id: target.id } });
        expect(post).toEqual(pre);
    });

    it('restricted user attempting to touch participant outside authorized areas rolls back everything', async () => {
        // Give participant a current address in area B
        const target = await prisma.participant.create({
            data: {
                name: `P-geo ${testSuffix}`,
                email: `geo-${testSuffix}@test.com`,
                addressHistory: {
                    create: { venueId: venueBId, effectiveFrom: new Date() },
                },
            },
        });
        createdParticipantIds.push(target.id);
        const pre = await prisma.participant.findUnique({ where: { id: target.id } });

        await expect(
            service.bulkMutate(
                {
                    creates: [],
                    updates: [{ id: target.id, version: target.version, data: { name: `geo-wont-${testSuffix}` } }],
                    deletes: [],
                },
                {
                    hasGeographicRestrictions: true,
                    authorizedAreaIds: [areaAId],
                    userId,
                    userRole: 'EDITOR',
                },
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_AUTHORIZATION_DENIED' });

        const post = await prisma.participant.findUnique({ where: { id: target.id } });
        expect(post).toEqual(pre);
    });
});
