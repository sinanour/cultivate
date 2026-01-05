import { PrismaClient, AuthorizationRuleType, UserRole } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

/**
 * Tests for geographic area venues and children filtering with DENY rules
 * 
 * Ensures that when viewing a geographic area's details:
 * - Venues in denied sub-areas are excluded
 * - Children that are denied are excluded
 * - Statistics only include data from authorized sub-areas
 */
describe('Geographic Area Venues and Children Filtering', () => {
    let prisma: PrismaClient;
    let geoAreaService: GeographicAreaService;
    let geoAuthService: GeographicAuthorizationService;
    let restrictedUserId: string;
    let adminUserId: string;

    // Hierarchy: province -> city -> neighbourhood1, neighbourhood2
    let provinceId: string;
    let cityId: string;
    let neighbourhood1Id: string;
    let neighbourhood2Id: string;
    let venue1Id: string; // In neighbourhood1 (allowed)
    let venue2Id: string; // In neighbourhood2 (denied)
    let venue3Id: string; // In city (allowed)

    beforeAll(async () => {
        prisma = getPrismaClient();
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const userGeoAuthRepo = new UserGeographicAuthorizationRepository(prisma);
        const userRepo = new UserRepository(prisma);
        geoAuthService = new GeographicAuthorizationService(userGeoAuthRepo, geoAreaRepo, userRepo);
        geoAreaService = new GeographicAreaService(geoAreaRepo, prisma, geoAuthService);

        // Create test users
        const restrictedUser = await prisma.user.create({
            data: { email: `restricted-venues-${Date.now()}@example.com`, passwordHash: 'hash', role: UserRole.EDITOR },
        });
        restrictedUserId = restrictedUser.id;

        const adminUser = await prisma.user.create({
            data: { email: `admin-venues-${Date.now()}@example.com`, passwordHash: 'hash', role: UserRole.ADMINISTRATOR },
        });
        adminUserId = adminUser.id;

        // Create geographic hierarchy
        const province = await prisma.geographicArea.create({
            data: { name: 'Test Province', areaType: 'PROVINCE' },
        });
        provinceId = province.id;

        const city = await prisma.geographicArea.create({
            data: { name: 'Test City', areaType: 'CITY', parentGeographicAreaId: provinceId },
        });
        cityId = city.id;

        const neighbourhood1 = await prisma.geographicArea.create({
            data: { name: 'Neighbourhood 1', areaType: 'NEIGHBOURHOOD', parentGeographicAreaId: cityId },
        });
        neighbourhood1Id = neighbourhood1.id;

        const neighbourhood2 = await prisma.geographicArea.create({
            data: { name: 'Neighbourhood 2', areaType: 'NEIGHBOURHOOD', parentGeographicAreaId: cityId },
        });
        neighbourhood2Id = neighbourhood2.id;

        // Create venues
        const venue1 = await prisma.venue.create({
            data: { name: 'Venue 1', address: '1 Street', geographicAreaId: neighbourhood1Id },
        });
        venue1Id = venue1.id;

        const venue2 = await prisma.venue.create({
            data: { name: 'Venue 2', address: '2 Street', geographicAreaId: neighbourhood2Id },
        });
        venue2Id = venue2.id;

        const venue3 = await prisma.venue.create({
            data: { name: 'Venue 3', address: '3 Street', geographicAreaId: cityId },
        });
        venue3Id = venue3.id;

        // Create authorization rules: ALLOW province, DENY neighbourhood2
        await prisma.userGeographicAuthorization.create({
            data: {
                userId: restrictedUserId,
                geographicAreaId: provinceId,
                ruleType: AuthorizationRuleType.ALLOW,
                createdBy: adminUserId,
            },
        });

        await prisma.userGeographicAuthorization.create({
            data: {
                userId: restrictedUserId,
                geographicAreaId: neighbourhood2Id,
                ruleType: AuthorizationRuleType.DENY,
                createdBy: adminUserId,
            },
        });
    });

    afterAll(async () => {
        // Cleanup
        await prisma.venue.deleteMany({ where: { id: { in: [venue1Id, venue2Id, venue3Id] } } });
        await prisma.userGeographicAuthorization.deleteMany({ where: { userId: restrictedUserId } });
        await prisma.geographicArea.deleteMany({ where: { id: { in: [neighbourhood2Id, neighbourhood1Id, cityId, provinceId] } } });
        await prisma.user.deleteMany({ where: { id: { in: [restrictedUserId, adminUserId] } } });
        await prisma.$disconnect();
    });

    describe('Venues Filtering with DENY Rules', () => {
        it('should exclude venues in denied sub-areas when getting province venues', async () => {
            // Get venues for province (should exclude neighbourhood2 venues)
            const venues = await geoAreaService.getVenues(provinceId, restrictedUserId, 'EDITOR');

            // Should include venue1 (in neighbourhood1) and venue3 (in city)
            const venueIds = venues.map(v => v.id);
            expect(venueIds).toContain(venue1Id);
            expect(venueIds).toContain(venue3Id);

            // Should NOT include venue2 (in denied neighbourhood2)
            expect(venueIds).not.toContain(venue2Id);
        });

        it('should exclude venues in denied sub-areas when getting city venues', async () => {
            // Get venues for city (should exclude neighbourhood2 venues)
            const venues = await geoAreaService.getVenues(cityId, restrictedUserId, 'EDITOR');

            // Should include venue1 (in neighbourhood1) and venue3 (in city)
            const venueIds = venues.map(v => v.id);
            expect(venueIds).toContain(venue1Id);
            expect(venueIds).toContain(venue3Id);

            // Should NOT include venue2 (in denied neighbourhood2)
            expect(venueIds).not.toContain(venue2Id);
        });

        it('should return all venues for administrator', async () => {
            // Administrator should see all venues
            const venues = await geoAreaService.getVenues(provinceId, adminUserId, 'ADMINISTRATOR');

            const venueIds = venues.map(v => v.id);
            expect(venueIds).toContain(venue1Id);
            expect(venueIds).toContain(venue2Id);
            expect(venueIds).toContain(venue3Id);
        });

        it('should return all venues when no userId provided', async () => {
            // No authorization check when userId not provided
            const venues = await geoAreaService.getVenues(provinceId);

            const venueIds = venues.map(v => v.id);
            expect(venueIds).toContain(venue1Id);
            expect(venueIds).toContain(venue2Id);
            expect(venueIds).toContain(venue3Id);
        });
    });

    describe('Children Filtering with DENY Rules', () => {
        it('should exclude denied children when getting city children', async () => {
            // Get children for city (should exclude neighbourhood2)
            const children = await geoAreaService.getChildren(cityId, restrictedUserId, 'EDITOR');

            // Should include neighbourhood1
            const childIds = children.map(c => c.id);
            expect(childIds).toContain(neighbourhood1Id);

            // Should NOT include neighbourhood2 (denied)
            expect(childIds).not.toContain(neighbourhood2Id);
        });

        it('should return all children for administrator', async () => {
            // Administrator should see all children
            const children = await geoAreaService.getChildren(cityId, adminUserId, 'ADMINISTRATOR');

            const childIds = children.map(c => c.id);
            expect(childIds).toContain(neighbourhood1Id);
            expect(childIds).toContain(neighbourhood2Id);
        });

        it('should return all children when no userId provided', async () => {
            // No authorization check when userId not provided
            const children = await geoAreaService.getChildren(cityId);

            const childIds = children.map(c => c.id);
            expect(childIds).toContain(neighbourhood1Id);
            expect(childIds).toContain(neighbourhood2Id);
        });
    });

    describe('Statistics Filtering with DENY Rules', () => {
        it('should exclude denied areas from statistics calculation', async () => {
            // Create activities in different venues
            const category = await prisma.activityCategory.create({
                data: { name: `Stats Category ${Date.now()}`, isPredefined: false },
            });

            const activityType = await prisma.activityType.create({
                data: { name: `Stats Type ${Date.now()}`, activityCategoryId: category.id, isPredefined: false },
            });

            const activity1 = await prisma.activity.create({
                data: { name: 'Activity 1', activityTypeId: activityType.id, startDate: new Date(), status: 'ACTIVE' },
            });

            await prisma.activityVenueHistory.create({
                data: { activityId: activity1.id, venueId: venue1Id, effectiveFrom: null },
            });

            const activity2 = await prisma.activity.create({
                data: { name: 'Activity 2', activityTypeId: activityType.id, startDate: new Date(), status: 'ACTIVE' },
            });

            await prisma.activityVenueHistory.create({
                data: { activityId: activity2.id, venueId: venue2Id, effectiveFrom: null },
            });

            // Get statistics for province (should exclude neighbourhood2 data)
            const stats = await geoAreaService.getStatistics(provinceId, restrictedUserId, 'EDITOR');

            // Should count venue1 and venue3, but NOT venue2
            expect(stats.totalVenues).toBe(2);

            // Should count activity1 but NOT activity2
            expect(stats.totalActivities).toBe(1);
            expect(stats.activeActivities).toBe(1);

            // Cleanup
            await prisma.activityVenueHistory.deleteMany({ where: { activityId: { in: [activity1.id, activity2.id] } } });
            await prisma.activity.deleteMany({ where: { id: { in: [activity1.id, activity2.id] } } });
            await prisma.activityType.delete({ where: { id: activityType.id } });
            await prisma.activityCategory.delete({ where: { id: category.id } });
        });
    });
});
