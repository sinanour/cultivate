/**
 * Integration test for POST /api/venues/bulk.
 *
 * Uses a real test database to verify end-to-end:
 *  - Happy path commits every change together.
 *  - On any partial failure (bad reference, stale version, unauthorized area)
 *    the entire change set rolls back AND every pre-existing row is left
 *    byte-for-byte unchanged (the "database equals pre-state" assertion
 *    required by requirement 14.3).
 *  - Version conflicts return 409 and change nothing.
 *  - Non-editor users receive 403 - but the role gate is enforced at the
 *    route middleware layer so we exercise that in the route-handler test;
 *    at the service level a restricted-area violation on an authorized
 *    EDITOR exercises the geographic authorization path and rolls back.
 *
 * Follows the project test-isolation rules: unique suffixes, deterministic
 * predefined-data access, TestHelpers.cleanupTestData, prisma.$disconnect.
 */
import { PrismaClient, AuthorizationRuleType } from '@prisma/client';
import { VenueService } from '../../services/venue.service';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { BulkMutationService } from '../../services/bulk-mutation.service';
import { BulkError } from '../../types/bulk-mutation.types';
import { getPrismaClient } from '../../utils/prisma.client';
import { TestHelpers } from '../utils';
import { AuthorizationContext } from '../../utils/auth.utils';

describe('Venue bulk mutations (integration)', () => {
    const testSuffix = Date.now() + '-vbulk';
    let prisma: PrismaClient;
    let venueService: VenueService;
    let bulkService: BulkMutationService;
    let auditRepo: AuditLogRepository;

    let userId: string;
    let areaAId: string;
    let areaBId: string;
    const createdVenueIds: string[] = [];

    beforeAll(async () => {
        prisma = getPrismaClient();
        const venueRepo = new VenueRepository(prisma);
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const userGeoAuthRepo = new UserGeographicAuthorizationRepository(prisma);
        const userRepo = new UserRepository(prisma);
        auditRepo = new AuditLogRepository(prisma);
        const geoAuth = new GeographicAuthorizationService(userGeoAuthRepo, geoAreaRepo, userRepo, auditRepo);
        venueService = new VenueService(venueRepo, geoAreaRepo, geoAuth, prisma);
        bulkService = new BulkMutationService(prisma, auditRepo);

        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        userId = user.id;

        const areaA = await prisma.geographicArea.create({
            data: { name: `BulkVenueTest Area A ${testSuffix}`, areaType: 'CITY' },
        });
        areaAId = areaA.id;
        const areaB = await prisma.geographicArea.create({
            data: { name: `BulkVenueTest Area B ${testSuffix}`, areaType: 'CITY' },
        });
        areaBId = areaB.id;
    });

    afterAll(async () => {
        await TestHelpers.cleanupTestData(prisma, {
            venueIds: createdVenueIds,
            geographicAreaIds: [areaAId, areaBId],
            userIds: [userId],
        });
        await prisma.$disconnect();
    });

    const unrestrictedAuth: AuthorizationContext = {
        authorizedAreaIds: [],
        hasGeographicRestrictions: false,
        userId: '',
        userRole: 'EDITOR',
    };

    it('happy path: commits mixed creates, updates, and deletes atomically', async () => {
        // Seed one venue to update and one to delete
        const toUpdate = await prisma.venue.create({
            data: { name: `V-to-update ${testSuffix}`, address: '1', geographicAreaId: areaAId },
        });
        const toDelete = await prisma.venue.create({
            data: { name: `V-to-delete ${testSuffix}`, address: '2', geographicAreaId: areaAId },
        });
        createdVenueIds.push(toUpdate.id, toDelete.id);

        const result = await venueService.bulkMutate(
            {
                creates: [
                    { clientKey: 'c1', data: { name: `V-new ${testSuffix}`, address: '3', geographicAreaId: areaAId } },
                ],
                updates: [{ id: toUpdate.id, version: toUpdate.version, data: { name: `V-renamed ${testSuffix}` } }],
                deletes: [{ id: toDelete.id, version: toDelete.version }],
            },
            { ...unrestrictedAuth, userId },
            bulkService
        );

        expect(result.success).toBe(true);
        expect(result.applied).toEqual({ created: 1, updated: 1, deleted: 1 });

        // Track the new venue so cleanup removes it
        const createdId = (result as any).results.creates[0].record.id as string;
        createdVenueIds.push(createdId);

        // Verify DB state
        const updated = await prisma.venue.findUnique({ where: { id: toUpdate.id } });
        expect(updated?.name).toBe(`V-renamed ${testSuffix}`);
        expect(updated?.version).toBe(toUpdate.version + 1);
        const deleted = await prisma.venue.findUnique({ where: { id: toDelete.id } });
        expect(deleted).toBeNull();
        const created = await prisma.venue.findUnique({ where: { id: createdId } });
        expect(created?.name).toBe(`V-new ${testSuffix}`);
    });

    it('atomic rollback: one bad reference leaves the DB equal to its pre-state', async () => {
        // Seed two venues that will be targeted
        const existing1 = await prisma.venue.create({
            data: { name: `V-rb-1 ${testSuffix}`, address: 'x', geographicAreaId: areaAId },
        });
        const existing2 = await prisma.venue.create({
            data: { name: `V-rb-2 ${testSuffix}`, address: 'y', geographicAreaId: areaAId },
        });
        createdVenueIds.push(existing1.id, existing2.id);

        // Snapshot pre-state - the integration must leave this unchanged.
        const preState = await prisma.venue.findMany({
            where: { id: { in: [existing1.id, existing2.id] } },
            orderBy: { id: 'asc' },
        });

        await expect(
            venueService.bulkMutate(
                {
                    // One valid create to show it isn't persisted.
                    creates: [
                        { clientKey: 'c-ok', data: { name: `Would-be-new ${testSuffix}`, address: 'z', geographicAreaId: areaAId } },
                    ],
                    // One valid update.
                    updates: [
                        { id: existing1.id, version: existing1.version, data: { name: `renamed-${testSuffix}` } },
                        // One invalid - references a geographicAreaId that doesn't exist.
                        { id: existing2.id, version: existing2.version, data: { geographicAreaId: '00000000-0000-0000-0000-000000000000' } },
                    ],
                    deletes: [],
                },
                { ...unrestrictedAuth, userId },
                bulkService
            )
        ).rejects.toBeInstanceOf(BulkError);

        // Assert DB is byte-for-byte equal to pre-state.
        const postState = await prisma.venue.findMany({
            where: { id: { in: [existing1.id, existing2.id] } },
            orderBy: { id: 'asc' },
        });
        expect(postState).toEqual(preState);

        // And the "would be new" venue was NOT created.
        const strays = await prisma.venue.findMany({
            where: { name: `Would-be-new ${testSuffix}` },
        });
        expect(strays).toHaveLength(0);
    });

    it('version conflict rolls back with BULK_VERSION_CONFLICT and persists nothing', async () => {
        const target = await prisma.venue.create({
            data: { name: `V-vc ${testSuffix}`, address: 'q', geographicAreaId: areaAId },
        });
        createdVenueIds.push(target.id);

        // Bump the version out-of-band so the next bulk request's expected version is stale.
        await prisma.venue.update({
            where: { id: target.id },
            data: { version: { increment: 1 } },
        });

        const pre = await prisma.venue.findUnique({ where: { id: target.id } });

        await expect(
            venueService.bulkMutate(
                {
                    creates: [],
                    // target.version is now stale (we bumped it)
                    updates: [{ id: target.id, version: target.version, data: { name: `wont-apply-${testSuffix}` } }],
                    deletes: [],
                },
                { ...unrestrictedAuth, userId },
                bulkService
            )
        ).rejects.toMatchObject({ code: 'BULK_VERSION_CONFLICT', statusCode: 409 });

        const post = await prisma.venue.findUnique({ where: { id: target.id } });
        expect(post).toEqual(pre);
    });

    it('restricted user attempting to touch an unauthorized area rolls back everything', async () => {
        // Grant the user access to areaA only.
        const authRule = await prisma.userGeographicAuthorization.create({
            data: {
                userId,
                geographicAreaId: areaAId,
                ruleType: AuthorizationRuleType.ALLOW,
                createdBy: userId,
            },
        });

        const inA = await prisma.venue.create({
            data: { name: `V-r-A ${testSuffix}`, address: 'a', geographicAreaId: areaAId },
        });
        const inB = await prisma.venue.create({
            data: { name: `V-r-B ${testSuffix}`, address: 'b', geographicAreaId: areaBId },
        });
        createdVenueIds.push(inA.id, inB.id);

        const preStateB = await prisma.venue.findUnique({ where: { id: inB.id } });
        const preStateA = await prisma.venue.findUnique({ where: { id: inA.id } });

        try {
            await expect(
                venueService.bulkMutate(
                    {
                        creates: [],
                        // Target in B is unauthorized; target in A is fine - the whole thing should roll back.
                        updates: [
                            { id: inA.id, version: inA.version, data: { name: `wont-${testSuffix}` } },
                            { id: inB.id, version: inB.version, data: { name: `wont-${testSuffix}` } },
                        ],
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

            // Nothing changed.
            const postB = await prisma.venue.findUnique({ where: { id: inB.id } });
            const postA = await prisma.venue.findUnique({ where: { id: inA.id } });
            expect(postB).toEqual(preStateB);
            expect(postA).toEqual(preStateA);
        } finally {
            // Clean up the authorization rule so later tests see no restrictions.
            await prisma.userGeographicAuthorization.deleteMany({ where: { id: authRule.id } });
        }
    });
});
