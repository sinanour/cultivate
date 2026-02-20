import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { TestHelpers } from '../utils';

describe('Geographic Breakdown Authorization Integration Tests', () => {
    let prisma: PrismaClient;
    let analyticsService: AnalyticsService;
    let geographicAuthorizationService: GeographicAuthorizationService;
    let geographicAreaRepository: GeographicAreaRepository;
    let userGeographicAuthorizationRepository: UserGeographicAuthorizationRepository;
    let userRepository: UserRepository;
    const testSuffix = Date.now();

    let cityId: string;
    let neighbourhood1Id: string;
    let neighbourhood2Id: string;
    let userId: string;

    // Track created IDs for cleanup
    const createdIds = {
        users: [] as string[],
        activities: [] as string[],
        participants: [] as string[],
        venues: [] as string[],
        areas: [] as string[],
        roles: [] as string[],
        activityTypes: [] as string[],
        categories: [] as string[],
    };

    beforeAll(async () => {
        prisma = new PrismaClient();
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        userRepository = new UserRepository(prisma);
        userGeographicAuthorizationRepository = new UserGeographicAuthorizationRepository(prisma);
        geographicAuthorizationService = new GeographicAuthorizationService(
            userGeographicAuthorizationRepository,
            geographicAreaRepository,
            userRepository
        );
        analyticsService = new AnalyticsService(
            prisma,
            geographicAreaRepository,
            geographicAuthorizationService
        );

        // Create test data
        // City with two neighbourhoods (use unique names to avoid conflicts)
        const city = await prisma.geographicArea.create({
            data: {
                name: `GeoBreakdown Test City ${testSuffix}`,
                areaType: 'CITY',
            },
        });
        cityId = city.id;
        createdIds.areas.push(city.id);

        const neighbourhood1 = await prisma.geographicArea.create({
            data: {
                name: `GeoBreakdown Allowed Neighbourhood ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        neighbourhood1Id = neighbourhood1.id;
        createdIds.areas.push(neighbourhood1.id);

        const neighbourhood2 = await prisma.geographicArea.create({
            data: {
                name: `GeoBreakdown Denied Neighbourhood ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        neighbourhood2Id = neighbourhood2.id;
        createdIds.areas.push(neighbourhood2.id);

        // Create venues in each neighbourhood
        const venue1 = await prisma.venue.create({
            data: {
                name: `GeoBreakdown Venue in Allowed Area ${testSuffix}`,
                address: '123 Allowed St',
                geographicAreaId: neighbourhood1Id,
            },
        });
        createdIds.venues.push(venue1.id);

        const venue2 = await prisma.venue.create({
            data: {
                name: `GeoBreakdown Venue in Denied Area ${testSuffix}`,
                address: '456 Denied St',
                geographicAreaId: neighbourhood2Id,
            },
        });
        createdIds.venues.push(venue2.id);

        // Create activity type
        const categoryName = `Test Category ${testSuffix}`;
        const category = await prisma.activityCategory.create({
            data: { name: categoryName },
        });
        createdIds.categories.push(category.id);

        const typeName = `Test Type ${testSuffix}`;
        const activityType = await prisma.activityType.create({
            data: {
                name: typeName,
                activityCategoryId: category.id,
            },
        });
        createdIds.activityTypes.push(activityType.id);

        // Create activities in each venue
        const activity1 = await prisma.activity.create({
            data: {
                name: `GeoBreakdown Activity in Allowed Area ${testSuffix}`,
                activityTypeId: activityType.id,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        createdIds.activities.push(activity1.id);

        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity1.id,
                venueId: venue1.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        const activity2 = await prisma.activity.create({
            data: {
                name: `GeoBreakdown Activity in Denied Area ${testSuffix}`,
                activityTypeId: activityType.id,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        createdIds.activities.push(activity2.id);

        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity2.id,
                venueId: venue2.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        // Create participants
        const participant1 = await prisma.participant.create({
            data: { name: `GeoBreakdown Participant in Allowed Area ${testSuffix}` },
        });
        createdIds.participants.push(participant1.id);

        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant1.id,
                venueId: venue1.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        const participant2 = await prisma.participant.create({
            data: { name: `GeoBreakdown Participant in Denied Area ${testSuffix}` },
        });
        createdIds.participants.push(participant2.id);

        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant2.id,
                venueId: venue2.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        // Create role
        const role = await prisma.role.create({
            data: { name: `Test Role ${testSuffix}` },
        });
        createdIds.roles.push(role.id);

        // Create assignments
        await prisma.assignment.create({
            data: {
                activityId: activity1.id,
                participantId: participant1.id,
                roleId: role.id,
            },
        });

        await prisma.assignment.create({
            data: {
                activityId: activity2.id,
                participantId: participant2.id,
                roleId: role.id,
            },
        });

        // Create test user with authorization rules
        const user = await TestHelpers.createTestUser(prisma, 'EDITOR', testSuffix);
        userId = user.id;
        createdIds.users.push(user.id);

        // ALLOW access to the city
        await prisma.userGeographicAuthorization.create({
            data: {
                userId: user.id,
                geographicAreaId: cityId,
                ruleType: 'ALLOW',
                createdBy: user.id,
            },
        });

        // DENY access to neighbourhood2
        await prisma.userGeographicAuthorization.create({
            data: {
                userId: user.id,
                geographicAreaId: neighbourhood2Id,
                ruleType: 'DENY',
                createdBy: user.id,
            },
        });
    });

    afterAll(async () => {
        // Clean up test data using TestHelpers
        await TestHelpers.cleanupTestData(prisma, {
            userIds: createdIds.users,
            activityIds: createdIds.activities,
            participantIds: createdIds.participants,
            venueIds: createdIds.venues,
            geographicAreaIds: createdIds.areas, // Fixed: was 'areaIds'
        });

        // Clean up roles, activity types, and categories separately
        if (createdIds.roles.length > 0) {
            await prisma.role.deleteMany({
                where: { id: { in: createdIds.roles } },
            });
        }
        if (createdIds.activityTypes.length > 0) {
            await prisma.activityType.deleteMany({
                where: { id: { in: createdIds.activityTypes } },
            });
        }
        if (createdIds.categories.length > 0) {
            await prisma.activityCategory.deleteMany({
                where: { id: { in: createdIds.categories } },
            });
        }

        await prisma.$disconnect();
    }, 30000); // 30 second timeout for cleanup

    it('should exclude denied neighbourhoods from geographic breakdown', async () => {
        // Get authorization info for the user
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        // Get geographic breakdown for the city (should show only allowed neighbourhood)
        const result = await analyticsService.getGeographicBreakdown(
            cityId,
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions,
            userId
        );

        // Should only include the allowed neighbourhood, not the denied one
        expect(result.data).toHaveLength(1);
        expect(result.data[0].geographicAreaId).toBe(neighbourhood1Id);
        expect(result.data[0].geographicAreaName).toContain('Allowed Neighbourhood');
        expect(result.data[0].activityCount).toBe(1);
        expect(result.data[0].participantCount).toBe(1);
        expect(result.data[0].participationCount).toBe(1);
        expect(result.pagination).toBeDefined();
    });

    it('should only aggregate metrics from authorized descendants', async () => {
        // Get authorization info for the user
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        // Get geographic breakdown for top-level (should show city with only allowed neighbourhood metrics)
        const result = await analyticsService.getGeographicBreakdown(
            undefined,
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions,
            userId
        );

        // Should include the city
        expect(result.data).toHaveLength(1);
        expect(result.data[0].geographicAreaId).toBe(cityId);
        expect(result.data[0].geographicAreaName).toContain('Test City');

        // Metrics should only include data from allowed neighbourhood (not denied neighbourhood)
        expect(result.data[0].activityCount).toBe(1);  // Only activity from allowed neighbourhood
        expect(result.data[0].participantCount).toBe(1);  // Only participant from allowed neighbourhood
        expect(result.data[0].participationCount).toBe(1);  // Only participation from allowed neighbourhood
        expect(result.pagination).toBeDefined();
    });

    it('should work correctly for users without geographic restrictions', async () => {
        // Create unrestricted user with unique suffix
        const unrestrictedUser = await TestHelpers.createTestUser(prisma, 'EDITOR', `${testSuffix}-unrestricted`);

        // Get geographic breakdown (should show all neighbourhoods)
        const result = await analyticsService.getGeographicBreakdown(
            cityId,
            {},
            [],
            false,
            unrestrictedUser.id
        );

        // Should include both neighbourhoods
        expect(result.data).toHaveLength(2);
        expect(result.data.map(b => b.geographicAreaId).sort()).toEqual(
            [neighbourhood1Id, neighbourhood2Id].sort()
        );
        expect(result.pagination).toBeDefined();

        // Clean up
        await TestHelpers.safeDelete(() =>
            prisma.user.delete({ where: { id: unrestrictedUser.id } })
        );
    });
});
