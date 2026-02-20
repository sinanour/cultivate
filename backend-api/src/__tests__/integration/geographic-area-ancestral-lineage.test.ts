/**
 * Integration tests for geographic area ancestral lineage filtering
 * 
 * Tests that users with geographic authorization restrictions maintain
 * read-only access to their complete ancestral lineage when fetching
 * children of ancestor areas.
 * 
 * Validates Requirements 5B.66-5B.75
 */

import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

describe('Geographic Area Ancestral Lineage Filtering', () => {
    let prisma: PrismaClient;
    let service: GeographicAreaService;
    let repository: GeographicAreaRepository;
    let authService: GeographicAuthorizationService;
    let authRepo: UserGeographicAuthorizationRepository;
    let userRepo: UserRepository;
    const testSuffix = Date.now();

    let testUserId: string;
    let adminUserId: string;

    // Geographic area hierarchy
    let countryId: string;
    let stateId: string;
    let countyAId: string;  // Contains cityA
    let countyBId: string;  // Contains cityB
    let countyCId: string;  // No user access
    let cityAId: string;    // User has FULL access
    let cityBId: string;    // User has FULL access
    let cityCId: string;    // In countyC, no user access

    beforeAll(async () => {
        prisma = getPrismaClient();
        repository = new GeographicAreaRepository(prisma);
        authRepo = new UserGeographicAuthorizationRepository(prisma);
        userRepo = new UserRepository(prisma);
        authService = new GeographicAuthorizationService(authRepo, repository, userRepo);
        service = new GeographicAreaService(repository, prisma, authService);

        // Create admin user
        const adminUser = await prisma.user.create({
            data: {
                email: `admin-ancestral-${testSuffix}@test.com`,
                passwordHash: 'hashed',
                role: 'ADMINISTRATOR',
            },
        });
        adminUserId = adminUser.id;

        // Create test user with restricted access
        const testUser = await prisma.user.create({
            data: {
                email: `user-ancestral-${testSuffix}@test.com`,
                passwordHash: 'hashed',
                role: 'EDITOR',
            },
        });
        testUserId = testUser.id;

        // Create geographic hierarchy: Country → State → Counties (A, B, C) → Cities (A, B, C)
        const country = await prisma.geographicArea.create({
            data: { name: `Test Country Ancestral ${testSuffix}`, areaType: 'COUNTRY', parentGeographicAreaId: null },
        });
        countryId = country.id;

        const state = await prisma.geographicArea.create({
            data: { name: `Test State Ancestral ${testSuffix}`, areaType: 'STATE', parentGeographicAreaId: countryId },
        });
        stateId = state.id;

        const countyA = await prisma.geographicArea.create({
            data: { name: `County A Ancestral ${testSuffix}`, areaType: 'COUNTY', parentGeographicAreaId: stateId },
        });
        countyAId = countyA.id;

        const countyB = await prisma.geographicArea.create({
            data: { name: `County B Ancestral ${testSuffix}`, areaType: 'COUNTY', parentGeographicAreaId: stateId },
        });
        countyBId = countyB.id;

        const countyC = await prisma.geographicArea.create({
            data: { name: `County C Ancestral ${testSuffix}`, areaType: 'COUNTY', parentGeographicAreaId: stateId },
        });
        countyCId = countyC.id;

        const cityA = await prisma.geographicArea.create({
            data: { name: `City A Ancestral ${testSuffix}`, areaType: 'CITY', parentGeographicAreaId: countyAId },
        });
        cityAId = cityA.id;

        const cityB = await prisma.geographicArea.create({
            data: { name: `City B Ancestral ${testSuffix}`, areaType: 'CITY', parentGeographicAreaId: countyBId },
        });
        cityBId = cityB.id;

        const cityC = await prisma.geographicArea.create({
            data: { name: `City C Ancestral ${testSuffix}`, areaType: 'CITY', parentGeographicAreaId: countyCId },
        });
        cityCId = cityC.id;

        // Grant user FULL access to City A and City B only
        await prisma.userGeographicAuthorization.createMany({
            data: [
                { userId: testUserId, geographicAreaId: cityAId, ruleType: 'ALLOW', createdBy: adminUserId },
                { userId: testUserId, geographicAreaId: cityBId, ruleType: 'ALLOW', createdBy: adminUserId },
            ],
        });
    });

    afterAll(async () => {
        await prisma.userGeographicAuthorization.deleteMany({ where: { userId: testUserId } });
        await prisma.geographicArea.deleteMany({
            where: { id: { in: [cityAId, cityBId, cityCId, countyAId, countyBId, countyCId, stateId, countryId] } },
        });
        await prisma.user.deleteMany({ where: { id: { in: [testUserId, adminUserId] } } });
        await prisma.$disconnect();
    });

    describe('Ancestral Lineage Access', () => {
        it('should return both County A and County B when restricted user expands State (Req 5B.71, 5B.72)', async () => {
            const children = await service.getChildren(stateId, testUserId, 'EDITOR');

            expect(children).toHaveLength(2);
            const countyIds = children.map(c => c.id).sort();
            expect(countyIds).toEqual([countyAId, countyBId].sort());
        });

        it('should NOT return County C when restricted user expands State (Req 5B.70)', async () => {
            const children = await service.getChildren(stateId, testUserId, 'EDITOR');
            const countyIds = children.map(c => c.id);
            expect(countyIds).not.toContain(countyCId);
        });

        it('should return only State when restricted user expands Country (Req 5B.73)', async () => {
            const children = await service.getChildren(countryId, testUserId, 'EDITOR');

            expect(children).toHaveLength(1);
            expect(children[0].id).toBe(stateId);
        });

        it('should return City A when restricted user expands County A (Req 5B.67)', async () => {
            const children = await service.getChildren(countyAId, testUserId, 'EDITOR');

            expect(children).toHaveLength(1);
            expect(children[0].id).toBe(cityAId);
        });

        it('should return City B when restricted user expands County B (Req 5B.67)', async () => {
            const children = await service.getChildren(countyBId, testUserId, 'EDITOR');

            expect(children).toHaveLength(1);
            expect(children[0].id).toBe(cityBId);
        });

        it('should deny access when restricted user tries to expand County C (Req 5B.70, 25.14)', async () => {
            await expect(
                service.getChildren(countyCId, testUserId, 'EDITOR')
            ).rejects.toThrow('You do not have permission to access this geographic area');
        });

        it('should maintain read-only access to complete ancestral path (Req 5B.75)', async () => {
            // Verify user can navigate from root to their authorized areas
            const countryChildren = await service.getChildren(countryId, testUserId, 'EDITOR');
            expect(countryChildren).toHaveLength(1);
            expect(countryChildren[0].id).toBe(stateId);

            const stateChildren = await service.getChildren(stateId, testUserId, 'EDITOR');
            expect(stateChildren.map(c => c.id)).toContain(countyAId);

            const countyChildren = await service.getChildren(countyAId, testUserId, 'EDITOR');
            expect(countyChildren).toHaveLength(1);
            expect(countyChildren[0].id).toBe(cityAId);
        });
    });

    describe('Administrator Bypass', () => {
        it('should return all counties when administrator expands State (Req 25.43)', async () => {
            const children = await service.getChildren(stateId, adminUserId, 'ADMINISTRATOR');

            expect(children).toHaveLength(3);
            const countyIds = children.map(c => c.id).sort();
            expect(countyIds).toEqual([countyAId, countyBId, countyCId].sort());
        });
    });

    describe('Combined with Global Filter', () => {
        it('should apply both authorization and global filter (Req 5B.74)', async () => {
            const children = await service.getChildren(stateId, testUserId, 'EDITOR', cityAId);

            expect(children).toHaveLength(1);
            expect(children[0].id).toBe(countyAId);
        });
    });

    describe('Pagination Support', () => {
        it('should support pagination with ancestral lineage filtering (Req 5B.67)', async () => {
            const result = await service.getChildrenPaginated(stateId, 1, 1, testUserId, 'EDITOR');

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(2);
            expect(result.pagination.totalPages).toBe(2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle unrestricted user (Req 25.42)', async () => {
            const unrestrictedUser = await prisma.user.create({
                data: { email: `unrestricted-ancestral-${testSuffix}@test.com`, passwordHash: 'hashed', role: 'EDITOR' },
            });

            const children = await service.getChildren(stateId, unrestrictedUser.id, 'EDITOR');
            expect(children).toHaveLength(3);

            await prisma.user.delete({ where: { id: unrestrictedUser.id } });
        });

        it('should return empty array when parent has no children', async () => {
            const children = await service.getChildren(cityAId, testUserId, 'EDITOR');
            expect(children).toHaveLength(0);
        });
    });
});
