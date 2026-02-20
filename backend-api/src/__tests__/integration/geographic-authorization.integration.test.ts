import { PrismaClient, AuthorizationRuleType } from '@prisma/client';
import { GeographicAuthorizationService, AccessLevel } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';
import { TestHelpers } from '../utils';

describe('Geographic Authorization Integration Tests', () => {
    let prisma: PrismaClient;
    let service: GeographicAuthorizationService;
    let authRepo: UserGeographicAuthorizationRepository;
    let areaRepo: GeographicAreaRepository;
    let userRepo: UserRepository;
    const testSuffix = Date.now();
    let testUserId: string;
    let testAreaId: string;
    let childAreaId: string;
    let parentAreaId: string;

    beforeAll(async () => {
        prisma = getPrismaClient();
        authRepo = new UserGeographicAuthorizationRepository(prisma);
        areaRepo = new GeographicAreaRepository(prisma);
        userRepo = new UserRepository(prisma);
        service = new GeographicAuthorizationService(authRepo, areaRepo, userRepo);

        // Create test user with unique email
        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        testUserId = user.id;

        // Create test geographic areas (parent -> test -> child) with unique names
        const parent = await prisma.geographicArea.create({
            data: {
                name: `GeoAuthTest Parent Area ${testSuffix}`,
                areaType: 'PROVINCE',
            },
        });
        parentAreaId = parent.id;

        const area = await prisma.geographicArea.create({
            data: {
                name: `GeoAuthTest Area ${testSuffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: parentAreaId,
            },
        });
        testAreaId = area.id;

        const child = await prisma.geographicArea.create({
            data: {
                name: `GeoAuthTest Child Area ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: testAreaId,
            },
        });
        childAreaId = child.id;
    });

    afterAll(async () => {
        // Clean up test data in correct order
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId: testUserId },
        });
        // Delete geographic areas (children before parents)
        await prisma.geographicArea.deleteMany({
            where: { id: childAreaId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: testAreaId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: parentAreaId },
        });
        await prisma.user.delete({ where: { id: testUserId } });
        await prisma.$disconnect();
    });

    afterEach(async () => {
        // Clean up authorization rules after each test
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId: testUserId },
        });
    });

    describe('Authorization Rule Management', () => {
        it('should create ALLOW authorization rule', async () => {
            const rule = await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            expect(rule).toBeDefined();
            expect(rule.userId).toBe(testUserId);
            expect(rule.geographicAreaId).toBe(testAreaId);
            expect(rule.ruleType).toBe(AuthorizationRuleType.ALLOW);
        });

        it('should create DENY authorization rule', async () => {
            const rule = await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            expect(rule).toBeDefined();
            expect(rule.ruleType).toBe(AuthorizationRuleType.DENY);
        });

        it('should prevent duplicate authorization rules', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            await expect(
                service.createAuthorizationRule(
                    testUserId,
                    testAreaId,
                    AuthorizationRuleType.DENY,
                    testUserId
                )
            ).rejects.toThrow('already exists');
        });

        it('should delete authorization rule', async () => {
            const rule = await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            await service.deleteAuthorizationRule(rule.id);

            const rules = await service.getAuthorizationRules(testUserId);
            expect(rules).toHaveLength(0);
        });
    });

    describe('Access Evaluation', () => {
        it('should grant FULL access when no rules exist', async () => {
            const accessLevel = await service.evaluateAccess(testUserId, testAreaId);
            expect(accessLevel).toBe(AccessLevel.FULL);
        });

        it('should grant FULL access to allowed area', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            const accessLevel = await service.evaluateAccess(testUserId, testAreaId);
            expect(accessLevel).toBe(AccessLevel.FULL);
        });

        it('should grant FULL access to descendants of allowed area', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            const accessLevel = await service.evaluateAccess(testUserId, childAreaId);
            expect(accessLevel).toBe(AccessLevel.FULL);
        });

        it('should grant READ_ONLY access to ancestors of allowed area', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            const accessLevel = await service.evaluateAccess(testUserId, parentAreaId);
            expect(accessLevel).toBe(AccessLevel.READ_ONLY);
        });

        it('should deny access with DENY rule', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            const accessLevel = await service.evaluateAccess(testUserId, testAreaId);
            expect(accessLevel).toBe(AccessLevel.NONE);
        });

        it('should apply DENY rule precedence over ALLOW rule', async () => {
            // Create ALLOW rule for parent
            await service.createAuthorizationRule(
                testUserId,
                parentAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            // Create DENY rule for child
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            // DENY should take precedence
            const accessLevel = await service.evaluateAccess(testUserId, testAreaId);
            expect(accessLevel).toBe(AccessLevel.NONE);
        });
    });

    describe('Authorization Info Calculation', () => {
        it('should return unrestricted access when no rules exist', async () => {
            const authInfo = await service.getAuthorizationInfo(testUserId);

            expect(authInfo.hasGeographicRestrictions).toBe(false);
            expect(authInfo.authorizedAreaIds).toEqual([]);
            expect(authInfo.readOnlyAreaIds).toEqual([]);
        });

        it('should calculate authorized areas including descendants', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            const authInfo = await service.getAuthorizationInfo(testUserId);

            expect(authInfo.hasGeographicRestrictions).toBe(true);
            expect(authInfo.authorizedAreaIds).toContain(testAreaId);
            expect(authInfo.authorizedAreaIds).toContain(childAreaId);
            expect(authInfo.readOnlyAreaIds).toContain(parentAreaId);
        });

        it('should exclude denied areas from authorized areas', async () => {
            await service.createAuthorizationRule(
                testUserId,
                parentAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            const authInfo = await service.getAuthorizationInfo(testUserId);

            expect(authInfo.hasGeographicRestrictions).toBe(true);
            expect(authInfo.authorizedAreaIds).toContain(parentAreaId);
            expect(authInfo.authorizedAreaIds).not.toContain(testAreaId);
            expect(authInfo.authorizedAreaIds).not.toContain(childAreaId);
        });
    });

    describe('Authorized Areas Summary', () => {
        it('should return all areas with FULL access when no rules exist', async () => {
            const areas = await service.getAuthorizedAreas(testUserId);

            expect(areas.length).toBeGreaterThan(0);
            expect(areas.every(a => a.accessLevel === AccessLevel.FULL)).toBe(true);
        });

        it('should return allowed areas, descendants, and ancestors', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            const areas = await service.getAuthorizedAreas(testUserId);

            const testArea = areas.find(a => a.geographicAreaId === testAreaId);
            const childArea = areas.find(a => a.geographicAreaId === childAreaId);
            const parentArea = areas.find(a => a.geographicAreaId === parentAreaId);

            expect(testArea?.accessLevel).toBe(AccessLevel.FULL);
            expect(childArea?.accessLevel).toBe(AccessLevel.FULL);
            expect(childArea?.isDescendant).toBe(true);
            expect(parentArea?.accessLevel).toBe(AccessLevel.READ_ONLY);
            expect(parentArea?.isAncestor).toBe(true);
        });

        it('should mark denied areas with NONE access level', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            const areas = await service.getAuthorizedAreas(testUserId);

            const testArea = areas.find(a => a.geographicAreaId === testAreaId);
            const childArea = areas.find(a => a.geographicAreaId === childAreaId);

            expect(testArea?.accessLevel).toBe(AccessLevel.NONE);
            expect(childArea?.accessLevel).toBe(AccessLevel.NONE);
        });

        it('should mark ancestors with isAncestor=true even when they have FULL access from another rule', async () => {
            // Create ALLOW rule for parent (gives FULL access to parent, testArea, and child)
            await service.createAuthorizationRule(
                testUserId,
                parentAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            // Create ALLOW rule for child (makes parent an ancestor)
            await service.createAuthorizationRule(
                testUserId,
                childAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            const areas = await service.getAuthorizedAreas(testUserId);

            const parentArea = areas.find(a => a.geographicAreaId === parentAreaId);
            const testArea = areas.find(a => a.geographicAreaId === testAreaId);
            const childArea = areas.find(a => a.geographicAreaId === childAreaId);

            // Parent should have FULL access (from direct ALLOW rule)
            expect(parentArea?.accessLevel).toBe(AccessLevel.FULL);
            // But it should ALSO be marked as an ancestor (because it's an ancestor of the child ALLOW rule)
            expect(parentArea?.isAncestor).toBe(true);

            // Test area should have FULL access (descendant of parent ALLOW, and ancestor of child ALLOW)
            expect(testArea?.accessLevel).toBe(AccessLevel.FULL);
            // And it should be marked as an ancestor (because it's an ancestor of the child ALLOW rule)
            expect(testArea?.isAncestor).toBe(true);

            // Child should have FULL access (from direct ALLOW rule)
            expect(childArea?.accessLevel).toBe(AccessLevel.FULL);
            // Child is not an ancestor of anything
            expect(childArea?.isAncestor).toBeUndefined();
        });
    });

    describe('Geographic Area Creation Validation', () => {
        it('should allow unrestricted users to create top-level areas', async () => {
            await expect(
                service.validateCreateGeographicArea(testUserId, null)
            ).resolves.not.toThrow();
        });

        it('should prevent restricted users from creating top-level areas', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            await expect(
                service.validateCreateGeographicArea(testUserId, null)
            ).rejects.toThrow('cannot create top-level');
        });

        it('should allow creating child areas under authorized parent', async () => {
            await service.createAuthorizationRule(
                testUserId,
                testAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            await expect(
                service.validateCreateGeographicArea(testUserId, testAreaId)
            ).resolves.not.toThrow();
        });

        it('should prevent creating child areas under unauthorized parent', async () => {
            await service.createAuthorizationRule(
                testUserId,
                childAreaId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            await expect(
                service.validateCreateGeographicArea(testUserId, parentAreaId)
            ).rejects.toThrow('do not have permission');
        });
    });
});
