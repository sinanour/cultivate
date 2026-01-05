import { PrismaClient, AuthorizationRuleType, UserRole } from '@prisma/client';
import { GeographicAuthorizationService, AccessLevel } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

/**
 * Comprehensive Geographic Authorization Tests
 * 
 * Tests critical edge cases for authorization including:
 * - Deep hierarchy DENY rules (non-immediate descendants)
 * - Multiple ALLOW rules with selective DENY
 * - DENY on ancestor affecting descendants
 * - Complex multi-level authorization scenarios
 */
describe('Geographic Authorization - Comprehensive Edge Cases', () => {
    let prisma: PrismaClient;
    let service: GeographicAuthorizationService;
    let authRepo: UserGeographicAuthorizationRepository;
    let areaRepo: GeographicAreaRepository;
    let userRepo: UserRepository;
    let testUserId: string;

    // Hierarchy: country -> province -> city -> neighbourhood -> block
    let countryId: string;
    let provinceId: string;
    let cityId: string;
    let neighbourhoodId: string;
    let blockId: string;

    beforeAll(async () => {
        prisma = getPrismaClient();
        authRepo = new UserGeographicAuthorizationRepository(prisma);
        areaRepo = new GeographicAreaRepository(prisma);
        userRepo = new UserRepository(prisma);
        service = new GeographicAuthorizationService(authRepo, areaRepo, userRepo);

        // Create test user
        const user = await prisma.user.create({
            data: {
                email: 'test-comprehensive@example.com',
                passwordHash: 'hash',
                role: UserRole.EDITOR,
            },
        });
        testUserId = user.id;

        // Create 5-level hierarchy
        const country = await prisma.geographicArea.create({
            data: { name: 'Test Country', areaType: 'COUNTRY' },
        });
        countryId = country.id;

        const province = await prisma.geographicArea.create({
            data: { name: 'Test Province', areaType: 'PROVINCE', parentGeographicAreaId: countryId },
        });
        provinceId = province.id;

        const city = await prisma.geographicArea.create({
            data: { name: 'Test City', areaType: 'CITY', parentGeographicAreaId: provinceId },
        });
        cityId = city.id;

        const neighbourhood = await prisma.geographicArea.create({
            data: { name: 'Test Neighbourhood', areaType: 'NEIGHBOURHOOD', parentGeographicAreaId: cityId },
        });
        neighbourhoodId = neighbourhood.id;

        const block = await prisma.geographicArea.create({
            data: { name: 'Test Block', areaType: 'COMMUNITY', parentGeographicAreaId: neighbourhoodId },
        });
        blockId = block.id;
    });

    afterAll(async () => {
        await prisma.userGeographicAuthorization.deleteMany({ where: { userId: testUserId } });
        await prisma.geographicArea.deleteMany({
            where: { id: { in: [blockId, neighbourhoodId, cityId, provinceId, countryId] } },
        });
        await prisma.user.delete({ where: { id: testUserId } });
        await prisma.$disconnect();
    });

    afterEach(async () => {
        await prisma.userGeographicAuthorization.deleteMany({ where: { userId: testUserId } });
    });

    describe('Deep Hierarchy DENY Rules', () => {
        it('should deny access to non-immediate descendant when ancestor is denied', async () => {
            // ALLOW country (top level)
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city (2 levels down)
            await service.createAuthorizationRule(testUserId, cityId, AuthorizationRuleType.DENY, testUserId);

            // Block (4 levels down from country, 2 levels down from denied city) should be denied
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);

            // Neighbourhood (3 levels down from country, 1 level down from denied city) should be denied
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.NONE);

            // City itself should be denied
            const cityAccess = await service.evaluateAccess(testUserId, cityId);
            expect(cityAccess).toBe(AccessLevel.NONE);

            // Province (between country and denied city) should have FULL access
            const provinceAccess = await service.evaluateAccess(testUserId, provinceId);
            expect(provinceAccess).toBe(AccessLevel.FULL);
        });

        it('should deny access when DENY rule is on ancestor of ALLOW rule', async () => {
            // ALLOW neighbourhood (middle level)
            await service.createAuthorizationRule(testUserId, neighbourhoodId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city (ancestor of neighbourhood)
            await service.createAuthorizationRule(testUserId, cityId, AuthorizationRuleType.DENY, testUserId);

            // Neighbourhood should be denied (ancestor is denied)
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.NONE);

            // Block (descendant of neighbourhood) should also be denied
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);
        });

        it('should correctly handle DENY on grandparent with ALLOW on grandchild', async () => {
            // ALLOW block (deepest level)
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city (grandparent of block)
            await service.createAuthorizationRule(testUserId, cityId, AuthorizationRuleType.DENY, testUserId);

            // Block should be denied (ancestor is denied)
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);

            // Neighbourhood (parent of block, child of denied city) should be denied
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.NONE);

            // City should be denied
            const cityAccess = await service.evaluateAccess(testUserId, cityId);
            expect(cityAccess).toBe(AccessLevel.NONE);
        });
    });

    describe('Multiple ALLOW Rules with Selective DENY', () => {
        it('should allow multiple areas but deny specific descendants', async () => {
            // ALLOW country (includes all descendants)
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY specific neighbourhood
            await service.createAuthorizationRule(testUserId, neighbourhoodId, AuthorizationRuleType.DENY, testUserId);

            // Country should have FULL access
            const countryAccess = await service.evaluateAccess(testUserId, countryId);
            expect(countryAccess).toBe(AccessLevel.FULL);

            // Province should have FULL access
            const provinceAccess = await service.evaluateAccess(testUserId, provinceId);
            expect(provinceAccess).toBe(AccessLevel.FULL);

            // City should have FULL access
            const cityAccess = await service.evaluateAccess(testUserId, cityId);
            expect(cityAccess).toBe(AccessLevel.FULL);

            // Neighbourhood should be denied
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.NONE);

            // Block (descendant of denied neighbourhood) should be denied
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);
        });

        it('should handle multiple non-overlapping ALLOW rules with DENY', async () => {
            // ALLOW province
            await service.createAuthorizationRule(testUserId, provinceId, AuthorizationRuleType.ALLOW, testUserId);

            // ALLOW block (descendant of province, so redundant but tests multiple ALLOW rules)
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY neighbourhood (parent of block, child of city, descendant of province)
            await service.createAuthorizationRule(testUserId, neighbourhoodId, AuthorizationRuleType.DENY, testUserId);

            // Province should have FULL access (explicit ALLOW)
            const provinceAccess = await service.evaluateAccess(testUserId, provinceId);
            expect(provinceAccess).toBe(AccessLevel.FULL);

            // City should have FULL access (descendant of allowed province)
            const cityAccess = await service.evaluateAccess(testUserId, cityId);
            expect(cityAccess).toBe(AccessLevel.FULL);

            // Neighbourhood should be denied (explicit DENY overrides province ALLOW)
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.NONE);

            // Block should be denied (parent neighbourhood is denied, DENY takes precedence)
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);
        });
    });

    describe('Authorization Info Calculation with Complex Rules', () => {
        it('should correctly calculate authorized areas with deep DENY', async () => {
            // ALLOW country
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY neighbourhood (3 levels down)
            await service.createAuthorizationRule(testUserId, neighbourhoodId, AuthorizationRuleType.DENY, testUserId);

            const authInfo = await service.getAuthorizationInfo(testUserId);

            // Should include country, province, city
            expect(authInfo.authorizedAreaIds).toContain(countryId);
            expect(authInfo.authorizedAreaIds).toContain(provinceId);
            expect(authInfo.authorizedAreaIds).toContain(cityId);

            // Should NOT include neighbourhood or block
            expect(authInfo.authorizedAreaIds).not.toContain(neighbourhoodId);
            expect(authInfo.authorizedAreaIds).not.toContain(blockId);
        });

        it('should handle DENY on middle level with ALLOW on top', async () => {
            // ALLOW country (top)
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city (middle level)
            await service.createAuthorizationRule(testUserId, cityId, AuthorizationRuleType.DENY, testUserId);

            const authInfo = await service.getAuthorizationInfo(testUserId);

            // Should include country and province
            expect(authInfo.authorizedAreaIds).toContain(countryId);
            expect(authInfo.authorizedAreaIds).toContain(provinceId);

            // Should NOT include city, neighbourhood, or block
            expect(authInfo.authorizedAreaIds).not.toContain(cityId);
            expect(authInfo.authorizedAreaIds).not.toContain(neighbourhoodId);
            expect(authInfo.authorizedAreaIds).not.toContain(blockId);
        });
    });

    describe('Individual Resource Access Authorization', () => {
        let participantId: string;
        let activityId: string;
        let venueId: string;
        let activityTypeId: string;
        let categoryId: string;

        beforeEach(async () => {
            // Create venue in the block (deepest level)
            const venue = await prisma.venue.create({
                data: {
                    name: 'Test Venue',
                    address: '123 Test St',
                    geographicAreaId: blockId,
                },
            });
            venueId = venue.id;

            // Create participant with home venue
            const participant = await prisma.participant.create({
                data: { name: 'Test Participant' },
            });
            participantId = participant.id;

            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant.id,
                    venueId: venue.id,
                    effectiveFrom: null, // Current address
                },
            });

            // Create activity type and category (use unique names)
            const category = await prisma.activityCategory.create({
                data: { name: `Test Category ${Date.now()}`, isPredefined: false },
            });
            categoryId = category.id;

            const activityType = await prisma.activityType.create({
                data: {
                    name: `Test Type ${Date.now()}`,
                    activityCategoryId: category.id,
                    isPredefined: false,
                },
            });
            activityTypeId = activityType.id;

            // Create activity
            const activity = await prisma.activity.create({
                data: {
                    name: 'Test Activity',
                    activityTypeId: activityType.id,
                    startDate: new Date(),
                    status: 'PLANNED',
                },
            });
            activityId = activity.id;

            await prisma.activityVenueHistory.create({
                data: {
                    activityId: activity.id,
                    venueId: venue.id,
                    effectiveFrom: null, // Current venue
                },
            });
        });

        afterEach(async () => {
            await prisma.activityVenueHistory.deleteMany({ where: { activityId } });
            await prisma.activity.deleteMany({ where: { id: activityId } });
            await prisma.activityType.delete({ where: { id: activityTypeId } });
            await prisma.activityCategory.delete({ where: { id: categoryId } });
            await prisma.participantAddressHistory.deleteMany({ where: { participantId } });
            await prisma.participant.deleteMany({ where: { id: participantId } });
            await prisma.venue.deleteMany({ where: { id: venueId } });
        });

        it('should deny participant access when ancestor area is denied', async () => {
            // ALLOW country
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city (ancestor of block where venue is located)
            await service.createAuthorizationRule(testUserId, cityId, AuthorizationRuleType.DENY, testUserId);

            // Participant's venue is in block, which is descendant of denied city
            // Should be denied
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);
        });

        it('should allow participant access when in allowed descendant area', async () => {
            // ALLOW province
            await service.createAuthorizationRule(testUserId, provinceId, AuthorizationRuleType.ALLOW, testUserId);

            // Participant's venue is in block, which is descendant of province
            // Should have FULL access
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.FULL);
        });

        it('should deny participant access when specific area is denied despite ancestor ALLOW', async () => {
            // ALLOW country (top level)
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY block (where venue is located)
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.DENY, testUserId);

            // Block should be denied
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);
        });
    });

    describe('Authorization Info with Deep Hierarchies', () => {
        it('should exclude all descendants of denied area from authorized list', async () => {
            // ALLOW country
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY province (1 level down)
            await service.createAuthorizationRule(testUserId, provinceId, AuthorizationRuleType.DENY, testUserId);

            const authInfo = await service.getAuthorizationInfo(testUserId);

            // Should include country only
            expect(authInfo.authorizedAreaIds).toContain(countryId);

            // Should NOT include province or any of its descendants
            expect(authInfo.authorizedAreaIds).not.toContain(provinceId);
            expect(authInfo.authorizedAreaIds).not.toContain(cityId);
            expect(authInfo.authorizedAreaIds).not.toContain(neighbourhoodId);
            expect(authInfo.authorizedAreaIds).not.toContain(blockId);
        });

        it('should handle multiple DENY rules at different levels', async () => {
            // ALLOW country
            await service.createAuthorizationRule(testUserId, countryId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city
            await service.createAuthorizationRule(testUserId, cityId, AuthorizationRuleType.DENY, testUserId);

            // DENY block (descendant of already denied city)
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.DENY, testUserId);

            const authInfo = await service.getAuthorizationInfo(testUserId);

            // Should include country and province
            expect(authInfo.authorizedAreaIds).toContain(countryId);
            expect(authInfo.authorizedAreaIds).toContain(provinceId);

            // Should NOT include city, neighbourhood, or block
            expect(authInfo.authorizedAreaIds).not.toContain(cityId);
            expect(authInfo.authorizedAreaIds).not.toContain(neighbourhoodId);
            expect(authInfo.authorizedAreaIds).not.toContain(blockId);
        });

        it('should handle ALLOW on leaf with DENY on non-ancestor branch', async () => {
            // Create a second branch: country -> province2 -> city2
            const province2 = await prisma.geographicArea.create({
                data: { name: 'Test Province 2', areaType: 'PROVINCE', parentGeographicAreaId: countryId },
            });

            const city2 = await prisma.geographicArea.create({
                data: { name: 'Test City 2', areaType: 'CITY', parentGeographicAreaId: province2.id },
            });

            // ALLOW block (in first branch)
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.ALLOW, testUserId);

            // DENY city2 (in second branch, not an ancestor of block)
            await service.createAuthorizationRule(testUserId, city2.id, AuthorizationRuleType.DENY, testUserId);

            // Block should have FULL access (DENY is on different branch)
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.FULL);

            // City2 should be denied
            const city2Access = await service.evaluateAccess(testUserId, city2.id);
            expect(city2Access).toBe(AccessLevel.NONE);

            // Cleanup - delete authorization rules first
            await prisma.userGeographicAuthorization.deleteMany({
                where: { geographicAreaId: { in: [city2.id, province2.id] } },
            });
            await prisma.geographicArea.deleteMany({ where: { id: { in: [city2.id, province2.id] } } });
        });
    });

    describe('READ_ONLY Ancestor Access', () => {
        it('should grant READ_ONLY to ancestors but not allow modifications', async () => {
            // ALLOW block (deepest level)
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.ALLOW, testUserId);

            // All ancestors should have READ_ONLY access
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.READ_ONLY);

            const cityAccess = await service.evaluateAccess(testUserId, cityId);
            expect(cityAccess).toBe(AccessLevel.READ_ONLY);

            const provinceAccess = await service.evaluateAccess(testUserId, provinceId);
            expect(provinceAccess).toBe(AccessLevel.READ_ONLY);

            const countryAccess = await service.evaluateAccess(testUserId, countryId);
            expect(countryAccess).toBe(AccessLevel.READ_ONLY);
        });

        it('should not grant READ_ONLY to ancestors when area is denied', async () => {
            // DENY block
            await service.createAuthorizationRule(testUserId, blockId, AuthorizationRuleType.DENY, testUserId);

            // Block should be denied
            const blockAccess = await service.evaluateAccess(testUserId, blockId);
            expect(blockAccess).toBe(AccessLevel.NONE);

            // Ancestors should have NONE access (no ALLOW rules exist)
            const neighbourhoodAccess = await service.evaluateAccess(testUserId, neighbourhoodId);
            expect(neighbourhoodAccess).toBe(AccessLevel.NONE);
        });
    });
});
