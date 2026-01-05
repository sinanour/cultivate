import { PrismaClient, AuthorizationRuleType, UserRole } from '@prisma/client';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

describe('Geographic Authorization - DENY Rule Precedence Tests', () => {
    let prisma: PrismaClient;
    let service: GeographicAuthorizationService;
    let authRepo: UserGeographicAuthorizationRepository;
    let areaRepo: GeographicAreaRepository;
    let userRepo: UserRepository;
    let testUserId: string;
    let cityId: string;
    let neighbourhoodId: string;

    beforeAll(async () => {
        prisma = getPrismaClient();
        authRepo = new UserGeographicAuthorizationRepository(prisma);
        areaRepo = new GeographicAreaRepository(prisma);
        userRepo = new UserRepository(prisma);
        service = new GeographicAuthorizationService(authRepo, areaRepo, userRepo);

        // Create test user
        const user = await prisma.user.create({
            data: {
                email: 'test-deny@example.com',
                passwordHash: 'hash',
                role: UserRole.EDITOR,
            },
        });
        testUserId = user.id;

        // Create test geographic areas (city -> neighbourhood)
        const city = await prisma.geographicArea.create({
            data: {
                name: 'Test City',
                areaType: 'CITY',
            },
        });
        cityId = city.id;

        const neighbourhood = await prisma.geographicArea.create({
            data: {
                name: 'Denied Neighbourhood',
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        neighbourhoodId = neighbourhood.id;
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId: testUserId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: { in: [neighbourhoodId, cityId] } },
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

    describe('DENY Rule Precedence', () => {
        it('should exclude denied neighbourhood from city ALLOW rule', async () => {
            // ALLOW entire city
            await service.createAuthorizationRule(
                testUserId,
                cityId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            // DENY specific neighbourhood
            await service.createAuthorizationRule(
                testUserId,
                neighbourhoodId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            const authInfo = await service.getAuthorizationInfo(testUserId);

            console.log('Authorization Info:', {
                hasRestrictions: authInfo.hasGeographicRestrictions,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                cityId,
                neighbourhoodId,
            });

            // City should be in authorized areas
            expect(authInfo.authorizedAreaIds).toContain(cityId);

            // Denied neighbourhood should NOT be in authorized areas
            expect(authInfo.authorizedAreaIds).not.toContain(neighbourhoodId);
        });

        it('should return correct authorized areas list excluding denied neighbourhood', async () => {
            // ALLOW entire city
            await service.createAuthorizationRule(
                testUserId,
                cityId,
                AuthorizationRuleType.ALLOW,
                testUserId
            );

            // DENY specific neighbourhood
            await service.createAuthorizationRule(
                testUserId,
                neighbourhoodId,
                AuthorizationRuleType.DENY,
                testUserId
            );

            const areas = await service.getAuthorizedAreas(testUserId);

            const cityArea = areas.find(a => a.geographicAreaId === cityId);
            const neighbourhoodArea = areas.find(a => a.geographicAreaId === neighbourhoodId);

            // City should have FULL access
            expect(cityArea?.accessLevel).toBe('FULL');

            // Neighbourhood should have NONE access (denied)
            expect(neighbourhoodArea?.accessLevel).toBe('NONE');
        });
    });
});
