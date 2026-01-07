import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';

describe('Geographic Breakdown Authorization Integration Tests', () => {
    let prisma: PrismaClient;
    let analyticsService: AnalyticsService;
    let geographicAuthorizationService: GeographicAuthorizationService;
    let geographicAreaRepository: GeographicAreaRepository;
    let userGeographicAuthorizationRepository: UserGeographicAuthorizationRepository;
    let userRepository: UserRepository;

    let cityId: string;
    let neighbourhood1Id: string;
    let neighbourhood2Id: string;
    let userId: string;
    let venue1Id: string;
    let venue2Id: string;
    let activity1Id: string;
    let activity2Id: string;
    let participant1Id: string;
    let participant2Id: string;
    let roleId: string;
    let activityTypeId: string;
    let categoryId: string;

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
        // City with two neighbourhoods
        const city = await prisma.geographicArea.create({
            data: {
                name: 'Test City',
                areaType: 'CITY',
            },
        });
        cityId = city.id;

        const neighbourhood1 = await prisma.geographicArea.create({
            data: {
                name: 'Allowed Neighbourhood',
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        neighbourhood1Id = neighbourhood1.id;

        const neighbourhood2 = await prisma.geographicArea.create({
            data: {
                name: 'Denied Neighbourhood',
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        neighbourhood2Id = neighbourhood2.id;

        // Create venues in each neighbourhood
        const venue1 = await prisma.venue.create({
            data: {
                name: 'Venue in Allowed Area',
                address: '123 Allowed St',
                geographicAreaId: neighbourhood1Id,
            },
        });
        venue1Id = venue1.id;

        const venue2 = await prisma.venue.create({
            data: {
                name: 'Venue in Denied Area',
                address: '456 Denied St',
                geographicAreaId: neighbourhood2Id,
            },
        });
        venue2Id = venue2.id;

        // Create activity type
        const category = await prisma.activityCategory.create({
            data: { name: 'Test Category' },
        });
        categoryId = category.id;

        const activityType = await prisma.activityType.create({
            data: {
                name: 'Test Type',
                activityCategoryId: category.id,
            },
        });
        activityTypeId = activityType.id;

        // Create activities in each venue
        const activity1 = await prisma.activity.create({
            data: {
                name: 'Activity in Allowed Area',
                activityTypeId: activityType.id,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        activity1Id = activity1.id;

        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity1.id,
                venueId: venue1.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        const activity2 = await prisma.activity.create({
            data: {
                name: 'Activity in Denied Area',
                activityTypeId: activityType.id,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        activity2Id = activity2.id;

        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity2.id,
                venueId: venue2.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        // Create participants
        const participant1 = await prisma.participant.create({
            data: { name: 'Participant in Allowed Area' },
        });
        participant1Id = participant1.id;

        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant1.id,
                venueId: venue1.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        const participant2 = await prisma.participant.create({
            data: { name: 'Participant in Denied Area' },
        });
        participant2Id = participant2.id;

        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant2.id,
                venueId: venue2.id,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        // Create role
        const role = await prisma.role.create({
            data: { name: `Test Role ${Date.now()}` },
        });
        roleId = role.id;

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
        const user = await prisma.user.create({
            data: {
                email: 'test@example.com',
                passwordHash: 'hashed',
                role: 'EDITOR',
            },
        });
        userId = user.id;

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
        // Clean up test data - ONLY delete records created by this test
        await prisma.assignment.deleteMany({
            where: {
                OR: [
                    { activityId: activity1Id },
                    { activityId: activity2Id },
                ],
            },
        });
        await prisma.activityVenueHistory.deleteMany({
            where: {
                activityId: { in: [activity1Id, activity2Id] },
            },
        });
        await prisma.activity.deleteMany({
            where: { id: { in: [activity1Id, activity2Id] } },
        });
        await prisma.activityType.deleteMany({
            where: { id: activityTypeId },
        });
        await prisma.activityCategory.deleteMany({
            where: { id: categoryId },
        });
        await prisma.participantAddressHistory.deleteMany({
            where: {
                participantId: { in: [participant1Id, participant2Id] },
            },
        });
        await prisma.participant.deleteMany({
            where: { id: { in: [participant1Id, participant2Id] } },
        });
        await prisma.role.deleteMany({
            where: { id: roleId },
        });
        await prisma.venue.deleteMany({
            where: { id: { in: [venue1Id, venue2Id] } },
        });
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId },
        });
        await prisma.user.deleteMany({
            where: { id: userId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: { in: [neighbourhood1Id, neighbourhood2Id, cityId] } },
        });
        await prisma.$disconnect();
    });

    it('should exclude denied neighbourhoods from geographic breakdown', async () => {
        // Get authorization info for the user
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        // Get geographic breakdown for the city (should show only allowed neighbourhood)
        const breakdown = await analyticsService.getGeographicBreakdown(
            cityId,
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions,
            userId
        );

        // Should only include the allowed neighbourhood, not the denied one
        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].geographicAreaId).toBe(neighbourhood1Id);
        expect(breakdown[0].geographicAreaName).toBe('Allowed Neighbourhood');
        expect(breakdown[0].activityCount).toBe(1);
        expect(breakdown[0].participantCount).toBe(1);
        expect(breakdown[0].participationCount).toBe(1);
    });

    it('should only aggregate metrics from authorized descendants', async () => {
        // Get authorization info for the user
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        // Get geographic breakdown for top-level (should show city with only allowed neighbourhood metrics)
        const breakdown = await analyticsService.getGeographicBreakdown(
            undefined,
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions,
            userId
        );

        // Should include the city
        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].geographicAreaId).toBe(cityId);
        expect(breakdown[0].geographicAreaName).toBe('Test City');

        // Metrics should only include data from allowed neighbourhood (not denied neighbourhood)
        expect(breakdown[0].activityCount).toBe(1);  // Only activity from allowed neighbourhood
        expect(breakdown[0].participantCount).toBe(1);  // Only participant from allowed neighbourhood
        expect(breakdown[0].participationCount).toBe(1);  // Only participation from allowed neighbourhood
    });

    it('should work correctly for users without geographic restrictions', async () => {
        // Create unrestricted user
        const unrestrictedUser = await prisma.user.create({
            data: {
                email: 'unrestricted@example.com',
                passwordHash: 'hashed',
                role: 'EDITOR',
            },
        });

        // Get geographic breakdown (should show all neighbourhoods)
        const breakdown = await analyticsService.getGeographicBreakdown(
            cityId,
            {},
            [],
            false,
            unrestrictedUser.id
        );

        // Should include both neighbourhoods
        expect(breakdown).toHaveLength(2);
        expect(breakdown.map(b => b.geographicAreaId).sort()).toEqual(
            [neighbourhood1Id, neighbourhood2Id].sort()
        );

        // Clean up
        await prisma.user.delete({ where: { id: unrestrictedUser.id } });
    });
});
