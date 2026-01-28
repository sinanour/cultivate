import { PrismaClient, UserRole, AuthorizationRuleType } from '@prisma/client';
import { AnalyticsService, TimePeriod } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { TestHelpers } from '../utils';

describe('Analytics with DENY Authorization Rules', () => {
    let prisma: PrismaClient;
    let analyticsService: AnalyticsService;
    let geographicAuthorizationService: GeographicAuthorizationService;
    let geographicAreaRepository: GeographicAreaRepository;

    let cityId: string;
    let allowedNeighbourhoodId: string;
    let deniedNeighbourhoodId: string;
    let userId: string;
    let allowedVenueId: string;
    let deniedVenueId: string;
    let allowedActivityId: string;
    let deniedActivityId: string;
    let categoryId: string;
    let activityTypeId: string;
    let roleId: string;
    let allowedParticipantId: string;
    let deniedParticipantId: string;

    // Increase timeout for slow integration tests
    jest.setTimeout(15000);

    beforeAll(async () => {
        prisma = new PrismaClient();
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userRepository = new UserRepository(prisma);
        const authRepo = new UserGeographicAuthorizationRepository(prisma);
        geographicAuthorizationService = new GeographicAuthorizationService(
            authRepo,
            geographicAreaRepository,
            userRepository
        );
        analyticsService = new AnalyticsService(
            prisma,
            geographicAreaRepository,
            geographicAuthorizationService
        );

        // Create geographic hierarchy: City -> Allowed Neighbourhood, Denied Neighbourhood
        const city = await prisma.geographicArea.create({
            data: { name: 'Richmond City', areaType: 'CITY' },
        });
        cityId = city.id;

        const allowedNeighbourhood = await prisma.geographicArea.create({
            data: {
                name: 'Steveston',
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        allowedNeighbourhoodId = allowedNeighbourhood.id;

        const deniedNeighbourhood = await prisma.geographicArea.create({
            data: {
                name: 'Thompson',
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        deniedNeighbourhoodId = deniedNeighbourhood.id;

        // Create venues
        const allowedVenue = await prisma.venue.create({
            data: {
                name: 'Steveston Community Centre',
                address: '123 Allowed St',
                geographicAreaId: allowedNeighbourhoodId,
            },
        });
        allowedVenueId = allowedVenue.id;

        const deniedVenue = await prisma.venue.create({
            data: {
                name: 'Thompson Community Centre',
                address: '456 Denied St',
                geographicAreaId: deniedNeighbourhoodId,
            },
        });
        deniedVenueId = deniedVenue.id;

        // Create activity category and type
        const category = await prisma.activityCategory.create({
            data: { name: `Test Category ${Date.now()}` },
        });
        categoryId = category.id;

        const activityType = await prisma.activityType.create({
            data: {
                name: `Test Type ${Date.now()}`,
                activityCategoryId: categoryId,
            },
        });
        activityTypeId = activityType.id;

        // Create activities
        const allowedActivity = await prisma.activity.create({
            data: {
                name: 'Activity in Allowed Area',
                activityTypeId: activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        allowedActivityId = allowedActivity.id;

        await prisma.activityVenueHistory.create({
            data: {
                activityId: allowedActivityId,
                venueId: allowedVenueId,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        const deniedActivity = await prisma.activity.create({
            data: {
                name: 'Activity in Denied Area',
                activityTypeId: activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        deniedActivityId = deniedActivity.id;

        await prisma.activityVenueHistory.create({
            data: {
                activityId: deniedActivityId,
                venueId: deniedVenueId,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        // Create participants
        const allowedParticipant = await prisma.participant.create({
            data: { name: 'Allowed Participant' },
        });
        allowedParticipantId = allowedParticipant.id;

        await prisma.participantAddressHistory.create({
            data: {
                participantId: allowedParticipantId,
                venueId: allowedVenueId,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        const deniedParticipant = await prisma.participant.create({
            data: { name: 'Denied Participant' },
        });
        deniedParticipantId = deniedParticipant.id;

        await prisma.participantAddressHistory.create({
            data: {
                participantId: deniedParticipantId,
                venueId: deniedVenueId,
                effectiveFrom: new Date('2024-01-01'),
            },
        });

        // Create role and assignments
        const role = await prisma.role.create({
            data: { name: `Test Role ${Date.now()}` },
        });
        roleId = role.id;

        await prisma.assignment.create({
            data: {
                activityId: allowedActivityId,
                participantId: allowedParticipantId,
                roleId: roleId,
            },
        });

        await prisma.assignment.create({
            data: {
                activityId: deniedActivityId,
                participantId: deniedParticipantId,
                roleId: roleId,
            },
        });

        // Create user with ALLOW city, DENY Thompson neighbourhood
        const user = await prisma.user.create({
            data: {
                email: `test-analytics-deny-${Date.now()}@example.com`,
                passwordHash: 'hashed',
                role: UserRole.EDITOR,
            },
        });
        userId = user.id;

        // ALLOW entire city
        await prisma.userGeographicAuthorization.create({
            data: {
                userId: user.id,
                geographicAreaId: cityId,
                ruleType: AuthorizationRuleType.ALLOW,
                createdBy: user.id,
            },
        });

        // DENY Thompson neighbourhood
        await prisma.userGeographicAuthorization.create({
            data: {
                userId: user.id,
                geographicAreaId: deniedNeighbourhoodId,
                ruleType: AuthorizationRuleType.DENY,
                createdBy: user.id,
            },
        });
    });

    afterAll(async () => {
        // Clean up in reverse dependency order
        await prisma.assignment.deleteMany({
            where: {
                OR: [
                    { activityId: allowedActivityId },
                    { activityId: deniedActivityId },
                ],
            },
        });
        await prisma.activityVenueHistory.deleteMany({
            where: { activityId: { in: [allowedActivityId, deniedActivityId] } },
        });
        await prisma.activity.deleteMany({
            where: { id: { in: [allowedActivityId, deniedActivityId] } },
        });
        await prisma.activityType.delete({ where: { id: activityTypeId } });
        await prisma.activityCategory.delete({ where: { id: categoryId } });
        await prisma.participantAddressHistory.deleteMany({
            where: { participantId: { in: [allowedParticipantId, deniedParticipantId] } },
        });
        await prisma.participant.deleteMany({
            where: { id: { in: [allowedParticipantId, deniedParticipantId] } },
        });
        await prisma.role.delete({ where: { id: roleId } });
        await prisma.venue.deleteMany({
            where: { id: { in: [allowedVenueId, deniedVenueId] } },
        });
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId },
        });
        await TestHelpers.safeDelete(() =>
            prisma.user.delete({ where: { id: userId } })
        );
        await prisma.geographicArea.deleteMany({
            where: { id: { in: [allowedNeighbourhoodId, deniedNeighbourhoodId, cityId] } },
        });
        await prisma.$disconnect();
    }, 30000); // 30 second timeout

    it('should exclude denied neighbourhood from engagement metrics', async () => {
        // Get authorization info
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        console.log('Authorization Info:', {
            hasRestrictions: authInfo.hasGeographicRestrictions,
            authorizedAreaIds: authInfo.authorizedAreaIds,
            cityId,
            allowedNeighbourhoodId,
            deniedNeighbourhoodId,
        });

        // Get engagement metrics with implicit filtering
        const metrics = await analyticsService.getEngagementMetrics(
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions
        );

        console.log('Engagement Metrics:', {
            totalActivities: metrics.totalActivities,
            totalParticipants: metrics.totalParticipants,
        });

        // Should only count activity and participant in allowed neighbourhood
        expect(metrics.totalActivities).toBe(1);
        expect(metrics.totalParticipants).toBe(1);
    });

    it('should exclude denied neighbourhood from growth metrics', async () => {
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        const metrics = await analyticsService.getGrowthMetrics(
            TimePeriod.MONTH,
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions
        );

        // Should only count activity and participant in allowed neighbourhood
        expect(metrics.timeSeries.length).toBeGreaterThan(0);
        const latestPeriod = metrics.timeSeries[metrics.timeSeries.length - 1];
        expect(latestPeriod.uniqueActivities).toBe(1);
        expect(latestPeriod.uniqueParticipants).toBe(1);
    });

    it('should exclude denied neighbourhood from lifecycle events', async () => {
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        const events = await analyticsService.getActivityLifecycleEvents(
            undefined,
            undefined,
            'type',
            {},
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions
        );

        // Should only count activity in allowed neighbourhood
        expect(events.length).toBeGreaterThan(0);
        const totalStarted = events.reduce((sum, e) => sum + e.started, 0);
        expect(totalStarted).toBe(1);
    });

    it('should exclude denied neighbourhood when explicitly filtering by city', async () => {
        const authInfo = await geographicAuthorizationService.getAuthorizationInfo(userId);

        console.log('Testing explicit city filter:', {
            cityId,
            authorizedAreaIds: authInfo.authorizedAreaIds,
        });

        // Explicitly filter by city (which has a denied child)
        const metrics = await analyticsService.getEngagementMetrics(
            { geographicAreaId: cityId },
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions
        );

        console.log('Metrics with explicit city filter:', {
            totalActivities: metrics.totalActivities,
            totalParticipants: metrics.totalParticipants,
        });

        // Should only count activity and participant in allowed neighbourhood
        // NOT the denied neighbourhood
        expect(metrics.totalActivities).toBe(1);
        expect(metrics.totalParticipants).toBe(1);
    });
});
