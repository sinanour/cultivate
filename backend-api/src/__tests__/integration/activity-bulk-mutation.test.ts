/**
 * Integration test for POST /api/activities/bulk.
 *
 * Verifies against a real DB:
 *  - Happy path commits a mixed change set.
 *  - Atomic rollback: ONE invalid change leaves pre-existing activities
 *    byte-for-byte unchanged (requirement 14.3).
 *  - Version conflict surfaces as BULK_VERSION_CONFLICT.
 */
import { PrismaClient } from '@prisma/client';
import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { BulkMutationService } from '../../services/bulk-mutation.service';
import { getPrismaClient } from '../../utils/prisma.client';
import { TestHelpers } from '../utils';
import { AuthorizationContext } from '../../utils/auth.utils';

describe('Activity bulk mutations (integration)', () => {
    const testSuffix = Date.now() + '-abulk';
    let prisma: PrismaClient;
    let service: ActivityService;
    let bulkService: BulkMutationService;

    let userId: string;
    let activityTypeId: string;
    let areaAId: string;
    let areaBId: string;
    let venueAId: string;
    let venueBId: string;
    const createdActivityIds: string[] = [];

    beforeAll(async () => {
        prisma = getPrismaClient();
        const repo = new ActivityRepository(prisma);
        const typeRepo = new ActivityTypeRepository(prisma);
        const historyRepo = new ActivityVenueHistoryRepository(prisma);
        const venueRepo = new VenueRepository(prisma);
        const userGeoAuthRepo = new UserGeographicAuthorizationRepository(prisma);
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const userRepo = new UserRepository(prisma);
        const auditRepo = new AuditLogRepository(prisma);
        const geoAuth = new GeographicAuthorizationService(userGeoAuthRepo, geoAreaRepo, userRepo, auditRepo);
        service = new ActivityService(repo, typeRepo, historyRepo, venueRepo, prisma, geoAuth);
        bulkService = new BulkMutationService(prisma, auditRepo);

        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        userId = user.id;

        const activityType = await TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01');
        activityTypeId = activityType.id;

        const areaA = await prisma.geographicArea.create({
            data: { name: `BulkActTest Area A ${testSuffix}`, areaType: 'CITY' },
        });
        areaAId = areaA.id;
        const areaB = await prisma.geographicArea.create({
            data: { name: `BulkActTest Area B ${testSuffix}`, areaType: 'CITY' },
        });
        areaBId = areaB.id;

        const vA = await prisma.venue.create({
            data: { name: `BulkActTest Venue A ${testSuffix}`, address: 'a', geographicAreaId: areaAId },
        });
        venueAId = vA.id;
        const vB = await prisma.venue.create({
            data: { name: `BulkActTest Venue B ${testSuffix}`, address: 'b', geographicAreaId: areaBId },
        });
        venueBId = vB.id;
    });

    afterAll(async () => {
        await TestHelpers.cleanupTestData(prisma, {
            activityIds: createdActivityIds,
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

    it('happy path: commits mixed creates, updates, and deletes atomically', async () => {
        const toUpdate = await prisma.activity.create({
            data: { name: `A-upd ${testSuffix}`, activityTypeId, startDate: new Date(), status: 'PLANNED' },
        });
        const toDelete = await prisma.activity.create({
            data: { name: `A-del ${testSuffix}`, activityTypeId, startDate: new Date(), status: 'PLANNED' },
        });
        createdActivityIds.push(toUpdate.id, toDelete.id);

        const result = await service.bulkMutate(
            {
                creates: [{
                    clientKey: 'c1',
                    data: { name: `A-new ${testSuffix}`, activityTypeId, startDate: new Date().toISOString() },
                }],
                updates: [{ id: toUpdate.id, version: toUpdate.version, data: { name: `A-renamed ${testSuffix}` } }],
                deletes: [{ id: toDelete.id, version: toDelete.version }],
            },
            unrestrictedAuth(),
            bulkService
        );

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 1, updated: 1, deleted: 1 });

        const createdId = (result as any).results.creates[0].record.id as string;
        createdActivityIds.push(createdId);

        const updated = await prisma.activity.findUnique({ where: { id: toUpdate.id } });
        expect(updated?.name).toBe(`A-renamed ${testSuffix}`);
        expect(updated?.version).toBe(toUpdate.version + 1);
        const deleted = await prisma.activity.findUnique({ where: { id: toDelete.id } });
        expect(deleted).toBeNull();
    });

    it('atomic rollback: one invalid change (unknown activityTypeId) leaves DB equal to pre-state', async () => {
        const existing1 = await prisma.activity.create({
            data: { name: `A-rb-1 ${testSuffix}`, activityTypeId, startDate: new Date(), status: 'PLANNED' },
        });
        const existing2 = await prisma.activity.create({
            data: { name: `A-rb-2 ${testSuffix}`, activityTypeId, startDate: new Date(), status: 'PLANNED' },
        });
        createdActivityIds.push(existing1.id, existing2.id);

        const preState = await prisma.activity.findMany({
            where: { id: { in: [existing1.id, existing2.id] } },
            orderBy: { id: 'asc' },
        });

        await expect(
            service.bulkMutate(
                {
                    creates: [{
                        clientKey: 'c-ok',
                        data: { name: `A-rb-new ${testSuffix}`, activityTypeId, startDate: new Date().toISOString() },
                    }],
                    updates: [
                        { id: existing1.id, version: existing1.version, data: { name: `A-ren-${testSuffix}` } },
                        // Invalid - unknown activityTypeId
                        { id: existing2.id, version: existing2.version, data: { activityTypeId: '00000000-0000-0000-0000-000000000000' } },
                    ],
                    deletes: [],
                },
                unrestrictedAuth(),
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VALIDATION_FAILED' });

        const postState = await prisma.activity.findMany({
            where: { id: { in: [existing1.id, existing2.id] } },
            orderBy: { id: 'asc' },
        });
        expect(postState).toEqual(preState);

        const strays = await prisma.activity.findMany({
            where: { name: `A-rb-new ${testSuffix}` },
        });
        expect(strays).toHaveLength(0);
    });

    it('version conflict rolls back with BULK_VERSION_CONFLICT and preserves pre-state', async () => {
        const target = await prisma.activity.create({
            data: { name: `A-vc ${testSuffix}`, activityTypeId, startDate: new Date(), status: 'PLANNED' },
        });
        createdActivityIds.push(target.id);
        await prisma.activity.update({
            where: { id: target.id },
            data: { version: { increment: 1 } },
        });
        const pre = await prisma.activity.findUnique({ where: { id: target.id } });

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
        const post = await prisma.activity.findUnique({ where: { id: target.id } });
        expect(post).toEqual(pre);
    });

    it('restricted user attempting to touch activity whose current venue is outside authorized areas rolls back', async () => {
        const target = await prisma.activity.create({
            data: {
                name: `A-geo ${testSuffix}`,
                activityTypeId,
                startDate: new Date(),
                status: 'PLANNED',
                activityVenueHistory: {
                    create: { venueId: venueBId, effectiveFrom: new Date() },
                },
            },
        });
        createdActivityIds.push(target.id);
        const pre = await prisma.activity.findUnique({ where: { id: target.id } });

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

        const post = await prisma.activity.findUnique({ where: { id: target.id } });
        expect(post).toEqual(pre);
    });
});
