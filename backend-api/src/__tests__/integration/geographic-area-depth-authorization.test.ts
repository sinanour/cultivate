import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';

describe('Geographic Area Authorization with Depth Parameter', () => {
    let prisma: PrismaClient;
    let geographicAreaService: GeographicAreaService;
    let geographicAreaRepository: GeographicAreaRepository;
    let geographicAuthorizationService: GeographicAuthorizationService;
    let authorizationRepository: UserGeographicAuthorizationRepository;
    let userRepository: UserRepository;
    let auditLogRepository: AuditLogRepository;

    // Test data IDs
    let userId: string;
    let countryId: string;
    let provinceId: string;
    let cityId: string;
    let neighbourhoodId: string;
    let otherCountryId: string;
    let otherProvinceId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        userRepository = new UserRepository(prisma);
        authorizationRepository = new UserGeographicAuthorizationRepository(prisma);
        auditLogRepository = new AuditLogRepository(prisma);
        geographicAuthorizationService = new GeographicAuthorizationService(
            authorizationRepository,
            geographicAreaRepository,
            userRepository,
            auditLogRepository
        );
        geographicAreaService = new GeographicAreaService(
            geographicAreaRepository,
            prisma,
            geographicAuthorizationService
        );
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    beforeEach(async () => {
        // Create test user
        const user = await prisma.user.create({
            data: {
                email: 'test-depth-auth@example.com',
                passwordHash: 'hashed',
                role: 'EDITOR',
            },
        });
        userId = user.id;

        // Create geographic hierarchy:
        // Country 1
        //   - Province 1 (ALLOWED)
        //     - City 1
        //       - Neighbourhood 1
        // Country 2 (NOT ALLOWED)
        //   - Province 2

        const country = await prisma.geographicArea.create({
            data: {
                name: 'Test Country 1',
                areaType: 'COUNTRY',
            },
        });
        countryId = country.id;

        const province = await prisma.geographicArea.create({
            data: {
                name: 'Test Province 1',
                areaType: 'PROVINCE',
                parentGeographicAreaId: countryId,
            },
        });
        provinceId = province.id;

        const city = await prisma.geographicArea.create({
            data: {
                name: 'Test City 1',
                areaType: 'CITY',
                parentGeographicAreaId: provinceId,
            },
        });
        cityId = city.id;

        const neighbourhood = await prisma.geographicArea.create({
            data: {
                name: 'Test Neighbourhood 1',
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        neighbourhoodId = neighbourhood.id;

        // Create another country hierarchy (not allowed)
        const otherCountry = await prisma.geographicArea.create({
            data: {
                name: 'Test Country 2',
                areaType: 'COUNTRY',
            },
        });
        otherCountryId = otherCountry.id;

        const otherProvince = await prisma.geographicArea.create({
            data: {
                name: 'Test Province 2',
                areaType: 'PROVINCE',
                parentGeographicAreaId: otherCountryId,
            },
        });
        otherProvinceId = otherProvince.id;

        // Create ALLOW rule for Province 1 only
        await prisma.userGeographicAuthorization.create({
            data: {
                userId,
                geographicAreaId: provinceId,
                ruleType: 'ALLOW',
                createdBy: userId,
            },
        });
    });

    afterEach(async () => {
        // Clean up in correct order
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId },
        });
        await prisma.geographicArea.deleteMany({
            where: {
                id: {
                    in: [neighbourhoodId, cityId, provinceId, countryId, otherProvinceId, otherCountryId],
                },
            },
        });
        await prisma.user.deleteMany({
            where: { id: userId },
        });
    });

    describe('Unfiltered requests with depth parameter', () => {
        it('should return only authorized areas when depth=0 and no geographicAreaId provided', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make unfiltered request with depth=0
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                depth: 0,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions,
                readOnlyAreaIds: authInfo.readOnlyAreaIds,
            });

            // Should only include authorized areas (province, city, neighbourhood) and read-only ancestors (country)
            // With depth=0, should only return top-level areas the user can see
            const areaIds = areas.map(a => a.id);

            // Should include Country 1 (read-only ancestor)
            expect(areaIds).toContain(countryId);

            // Should NOT include Country 2 (not authorized)
            expect(areaIds).not.toContain(otherCountryId);
        });

        it('should return only authorized areas when depth=1 and no geographicAreaId provided', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make unfiltered request with depth=1
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                depth: 1,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions,
                readOnlyAreaIds: authInfo.readOnlyAreaIds,
            });

            const areaIds = areas.map(a => a.id);

            // Should include Country 1 and Province 1 (depth=1 from top level)
            expect(areaIds).toContain(countryId);
            expect(areaIds).toContain(provinceId);

            // Should NOT include Country 2 or Province 2 (not authorized)
            expect(areaIds).not.toContain(otherCountryId);
            expect(areaIds).not.toContain(otherProvinceId);

            // Should NOT include City 1 or Neighbourhood 1 (depth=1 only goes one level deep)
            expect(areaIds).not.toContain(cityId);
            expect(areaIds).not.toContain(neighbourhoodId);
        });

        it('should return only authorized areas when depth=2 and no geographicAreaId provided', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make unfiltered request with depth=2
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                depth: 2,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions,
                readOnlyAreaIds: authInfo.readOnlyAreaIds,
            });

            const areaIds = areas.map(a => a.id);

            // Should include Country 1, Province 1, and City 1 (depth=2 from top level)
            expect(areaIds).toContain(countryId);
            expect(areaIds).toContain(provinceId);
            expect(areaIds).toContain(cityId);

            // Should NOT include Country 2 or Province 2 (not authorized)
            expect(areaIds).not.toContain(otherCountryId);
            expect(areaIds).not.toContain(otherProvinceId);

            // Should NOT include Neighbourhood 1 (depth=2 only goes two levels deep)
            expect(areaIds).not.toContain(neighbourhoodId);
        });
    });

    describe('Filtered requests with depth parameter', () => {
        it('should include ancestors when explicit geographicAreaId provided with depth', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make filtered request for Province 1 with depth=1
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                geographicAreaId: provinceId,
                depth: 1,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions,
                readOnlyAreaIds: authInfo.readOnlyAreaIds,
            });

            const areaIds = areas.map(a => a.id);

            // Should include Country 1 (ancestor for context)
            expect(areaIds).toContain(countryId);

            // Should include Province 1 (requested area)
            expect(areaIds).toContain(provinceId);

            // Should include City 1 (immediate child, depth=1)
            expect(areaIds).toContain(cityId);

            // Should NOT include Neighbourhood 1 (depth=1 only goes one level deep from province)
            expect(areaIds).not.toContain(neighbourhoodId);

            // Should NOT include any areas from Country 2
            expect(areaIds).not.toContain(otherCountryId);
            expect(areaIds).not.toContain(otherProvinceId);
        });
    });

    describe('Paginated requests with depth parameter', () => {
        it('should apply authorization filtering in paginated flexible method', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make paginated unfiltered request with depth=1
            const result = await geographicAreaService.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 100,
                depth: 1,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions,
                readOnlyAreaIds: authInfo.readOnlyAreaIds,
            });

            const areaIds = result.data.map(a => a.id);

            // Should include authorized areas only
            expect(areaIds).toContain(countryId);
            expect(areaIds).toContain(provinceId);

            // Should NOT include unauthorized areas
            expect(areaIds).not.toContain(otherCountryId);
            expect(areaIds).not.toContain(otherProvinceId);

            // Pagination metadata should reflect filtered count
            expect(result.pagination.total).toBe(areaIds.length);
        });
    });

    describe('Legacy methods with depth parameter', () => {
        it('should apply authorization filtering in legacy getAllGeographicAreas method', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make unfiltered request with depth=1 using legacy method
            const areas = await geographicAreaService.getAllGeographicAreas(
                undefined,
                1,
                authInfo.authorizedAreaIds,
                authInfo.hasGeographicRestrictions,
                authInfo.readOnlyAreaIds
            );

            const areaIds = areas.map(a => a.id);

            // Should include authorized areas only
            expect(areaIds).toContain(countryId);
            expect(areaIds).toContain(provinceId);

            // Should NOT include unauthorized areas
            expect(areaIds).not.toContain(otherCountryId);
            expect(areaIds).not.toContain(otherProvinceId);
        });

        it('should apply authorization filtering in legacy getAllGeographicAreasPaginated method', async () => {
            // Get authorization info
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

            // Make paginated unfiltered request with depth=1 using legacy method
            const result = await geographicAreaService.getAllGeographicAreasPaginated(
                1,
                100,
                undefined,
                1,
                authInfo.authorizedAreaIds,
                authInfo.hasGeographicRestrictions,
                authInfo.readOnlyAreaIds
            );

            const areaIds = result.data.map(a => a.id);

            // Should include authorized areas only
            expect(areaIds).toContain(countryId);
            expect(areaIds).toContain(provinceId);

            // Should NOT include unauthorized areas
            expect(areaIds).not.toContain(otherCountryId);
            expect(areaIds).not.toContain(otherProvinceId);

            // Pagination metadata should reflect filtered count
            expect(result.pagination.total).toBe(areaIds.length);
        });
    });

    describe('Unrestricted users', () => {
        let unrestrictedUserId: string;

        beforeEach(async () => {
            // Create user with no authorization rules (unrestricted)
            const user = await prisma.user.create({
                data: {
                    email: 'unrestricted@example.com',
                    passwordHash: 'hashed',
                    role: 'EDITOR',
                },
            });
            unrestrictedUserId = user.id;
        });

        afterEach(async () => {
            await prisma.user.deleteMany({
                where: { id: unrestrictedUserId },
            });
        });

        it('should return all areas for unrestricted users with depth parameter', async () => {
            // Get authorization info (should have no restrictions)
            const authInfo = await geographicAuthorizationService.getAuthorizationInfo(unrestrictedUserId);

            expect(authInfo.hasGeographicRestrictions).toBe(false);

            // Make unfiltered request with depth=1
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                depth: 1,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions,
                readOnlyAreaIds: authInfo.readOnlyAreaIds,
            });

            const areaIds = areas.map(a => a.id);

            // Should include our test areas (both authorized and unauthorized)
            expect(areaIds).toContain(countryId);
            expect(areaIds).toContain(otherCountryId);

            // May or may not include provinces depending on depth and hierarchy
            // The key point is that BOTH countries are included (no authorization filtering)
            expect(areaIds.length).toBeGreaterThan(2); // At least the two test countries
        });
    });
});
