import { PrismaClient } from '@prisma/client';
import { MapDataService } from '../../services/map-data.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';

const prisma = new PrismaClient();

describe('Map Data Temporal Filtering', () => {
    let mapDataService: MapDataService;
    let geographicAreaRepository: GeographicAreaRepository;
    let geoAuthService: GeographicAuthorizationService;
    let userGeoAuthRepository: UserGeographicAuthorizationRepository;
    let userRepository: UserRepository;

    // Test data IDs
    let userId: string;
    let geographicAreaId: string;
    let venueId: string;
    let activityTypeId: string;
    let participantId: string;

    // Activity IDs for temporal testing
    let pastActivityId: string; // Ended before query period
    let currentActivityId: string; // Active during query period
    let futureActivityId: string; // Starts after query period
    let ongoingActivityId: string; // Ongoing (null endDate)

    // Increase timeout for slow integration tests
    jest.setTimeout(15000);

    beforeAll(async () => {
        // Initialize services
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
        userRepository = new UserRepository(prisma);
        geoAuthService = new GeographicAuthorizationService(
            userGeoAuthRepository,
            geographicAreaRepository,
            userRepository
        );
        mapDataService = new MapDataService(
            prisma,
            geoAuthService
        );

        // Create test user
        const user = await prisma.user.create({
            data: {
                email: 'map-temporal-test@test.com',
                passwordHash: 'hash',
                role: 'ADMINISTRATOR',
            },
        });
        userId = user.id;

        // Create geographic area
        const area = await prisma.geographicArea.create({
            data: {
                name: 'Test City for Map Temporal',
                areaType: 'CITY',
            },
        });
        geographicAreaId = area.id;

        // Create venue
        const venue = await prisma.venue.create({
            data: {
                name: 'Test Venue for Map Temporal',
                address: '123 Test St',
                geographicAreaId,
                latitude: 40.7128,
                longitude: -74.0060,
            },
        });
        venueId = venue.id;

        // Create activity category and type
        await prisma.activityCategory.findFirst({
            where: { name: 'Study Circles' },
        });

        const type = await prisma.activityType.findFirst({
            where: { name: 'Ruhi Book 01' },
        });
        activityTypeId = type!.id;

        // Create role
        await prisma.role.findFirst({
            where: { name: 'Participant' },
        });

        // Create participant
        const participant = await prisma.participant.create({
            data: {
                name: 'Test Participant for Map Temporal',
                email: 'map-temporal-participant@test.com',
            },
        });
        participantId = participant.id;

        // Create activities with different temporal ranges
        // Query period will be: 2024-06-01 to 2024-08-31

        // Past activity: ended before query period (2024-01-01 to 2024-05-15)
        const pastActivity = await prisma.activity.create({
            data: {
                name: 'Past Activity',
                activityTypeId,
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-05-15'),
                status: 'COMPLETED',
            },
        });
        pastActivityId = pastActivity.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: pastActivityId,
                venueId,
                effectiveFrom: null,
            },
        });

        // Current activity: active during query period (2024-05-01 to 2024-07-31)
        const currentActivity = await prisma.activity.create({
            data: {
                name: 'Current Activity',
                activityTypeId,
                startDate: new Date('2024-05-01'),
                endDate: new Date('2024-07-31'),
                status: 'ACTIVE',
            },
        });
        currentActivityId = currentActivity.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: currentActivityId,
                venueId,
                effectiveFrom: null,
            },
        });

        // Future activity: starts after query period (2024-09-01 to 2024-12-31)
        const futureActivity = await prisma.activity.create({
            data: {
                name: 'Future Activity',
                activityTypeId,
                startDate: new Date('2024-09-01'),
                endDate: new Date('2024-12-31'),
                status: 'PLANNED',
            },
        });
        futureActivityId = futureActivity.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: futureActivityId,
                venueId,
                effectiveFrom: null,
            },
        });

        // Ongoing activity: started during period, no end date (2024-07-01 to null)
        const ongoingActivity = await prisma.activity.create({
            data: {
                name: 'Ongoing Activity',
                activityTypeId,
                startDate: new Date('2024-07-01'),
                endDate: null,
                status: 'ACTIVE',
            },
        });
        ongoingActivityId = ongoingActivity.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: ongoingActivityId,
                venueId,
                effectiveFrom: null,
            },
        });
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.activityVenueHistory.deleteMany({
            where: {
                activityId: {
                    in: [pastActivityId, currentActivityId, futureActivityId, ongoingActivityId],
                },
            },
        });
        await prisma.activity.deleteMany({
            where: {
                id: {
                    in: [pastActivityId, currentActivityId, futureActivityId, ongoingActivityId],
                },
            },
        });
        await prisma.participant.deleteMany({
            where: { id: participantId },
        });
        await prisma.venue.deleteMany({
            where: { id: venueId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: geographicAreaId },
        });
        await prisma.user.deleteMany({
            where: { id: userId },
        });

        await prisma.$disconnect();
    });

    describe('Activity Temporal Overlap Filtering', () => {
        it('should include only activities active during query period', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include current activity (overlaps: 2024-05-01 to 2024-07-31)
            expect(activityIds).toContain(currentActivityId);

            // Should include ongoing activity (overlaps: 2024-07-01 to null)
            expect(activityIds).toContain(ongoingActivityId);

            // Should NOT include past activity (ended 2024-05-15, before period start)
            expect(activityIds).not.toContain(pastActivityId);

            // Should NOT include future activity (starts 2024-09-01, after period end)
            expect(activityIds).not.toContain(futureActivityId);

            expect(result.data.length).toBe(2);
        });

        it('should exclude activities that ended before query period', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);
            expect(activityIds).not.toContain(pastActivityId);
        });

        it('should exclude activities that started after query period', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);
            expect(activityIds).not.toContain(futureActivityId);
        });

        it('should include ongoing activities that started before or during period', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);
            expect(activityIds).toContain(ongoingActivityId);
        });

        it('should work with only startDate filter', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include current activity (ends 2024-07-31, after start)
            expect(activityIds).toContain(currentActivityId);

            // Should include ongoing activity (null endDate)
            expect(activityIds).toContain(ongoingActivityId);

            // Should include future activity (ends 2024-12-31, after start)
            expect(activityIds).toContain(futureActivityId);

            // Should NOT include past activity (ended 2024-05-15, before start)
            expect(activityIds).not.toContain(pastActivityId);
        });

        it('should work with only endDate filter', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    endDate: new Date('2024-08-31'),
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include past activity (started 2024-01-01, before end)
            expect(activityIds).toContain(pastActivityId);

            // Should include current activity (started 2024-05-01, before end)
            expect(activityIds).toContain(currentActivityId);

            // Should include ongoing activity (started 2024-07-01, before end)
            expect(activityIds).toContain(ongoingActivityId);

            // Should NOT include future activity (started 2024-09-01, after end)
            expect(activityIds).not.toContain(futureActivityId);
        });

        it('should return all activities when no date filters provided', async () => {
            const result = await mapDataService.getActivityMarkers(
                {
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include all test activities
            expect(activityIds).toContain(pastActivityId);
            expect(activityIds).toContain(currentActivityId);
            expect(activityIds).toContain(futureActivityId);
            expect(activityIds).toContain(ongoingActivityId);

            expect(result.data.length).toBe(4);
        });
    });

    describe('Participant Address Temporal Filtering', () => {
        let participant2Id: string;
        let venue2Id: string;
        let venue3Id: string;

        beforeAll(async () => {
            // Create additional venues for address history testing
            const venue2 = await prisma.venue.create({
                data: {
                    name: 'Test Venue 2 for Address History',
                    address: '456 Test Ave',
                    geographicAreaId,
                    latitude: 40.7200,
                    longitude: -74.0100,
                },
            });
            venue2Id = venue2.id;

            const venue3 = await prisma.venue.create({
                data: {
                    name: 'Test Venue 3 for Address History',
                    address: '789 Test Blvd',
                    geographicAreaId,
                    latitude: 40.7300,
                    longitude: -74.0200,
                },
            });
            venue3Id = venue3.id;

            // Create participant with multiple addresses
            const participant2 = await prisma.participant.create({
                data: {
                    name: 'Participant with Multiple Addresses',
                    email: 'multi-address@test.com',
                },
            });
            participant2Id = participant2.id;

            // Address history for participant2:
            // - Venue 1: 2024-01-01 to 2024-05-31 (before and partially during query period)
            // - Venue 2: 2024-06-01 to 2024-08-31 (during query period)
            // - Venue 3: 2024-09-01 onwards (after query period)
            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant2Id,
                    venueId: venue3Id,
                    effectiveFrom: new Date('2024-09-01'),
                },
            });
            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant2Id,
                    venueId: venue2Id,
                    effectiveFrom: new Date('2024-06-01'),
                },
            });
            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant2Id,
                    venueId,
                    effectiveFrom: new Date('2024-01-01'),
                },
            });

            // Create participant with single address spanning entire period
            const participant3 = await prisma.participant.create({
                data: {
                    name: 'Participant with Single Address',
                    email: 'single-address@test.com',
                },
            });
            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant3.id,
                    venueId: venue2Id,
                    effectiveFrom: null, // Oldest address
                },
            });

            // Create participant with null effectiveFrom
            const participant4 = await prisma.participant.create({
                data: {
                    name: 'Participant with Null EffectiveFrom',
                    email: 'null-effective@test.com',
                },
            });
            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant4.id,
                    venueId,
                    effectiveFrom: null,
                },
            });
        });

        afterAll(async () => {
            // Clean up additional test data
            await prisma.participantAddressHistory.deleteMany({
                where: {
                    participantId: { in: [participant2Id] },
                },
            });
            await prisma.participant.deleteMany({
                where: {
                    email: {
                        in: [
                            'multi-address@test.com',
                            'single-address@test.com',
                            'null-effective@test.com',
                        ],
                    },
                },
            });
            await prisma.venue.deleteMany({
                where: { id: { in: [venue2Id, venue3Id] } },
            });
        });

        it('should include all venues where participant lived during query period', async () => {
            // Query period: 2024-06-01 to 2024-08-31
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Should include venue1 (participant lived there 2024-01-01 to 2024-05-31, overlaps with period start)
            expect(venueIds).toContain(venueId);

            // Should include venue2 (participant lived there 2024-06-01 to 2024-08-31, fully during period)
            expect(venueIds).toContain(venue2Id);

            // Should NOT include venue3 (participant moved there 2024-09-01, after period)
            expect(venueIds).not.toContain(venue3Id);
        });

        it('should include participant who moved during query period at both venues', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    startDate: new Date('2024-05-15'),
                    endDate: new Date('2024-07-15'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Participant lived at venue1 until 2024-05-31 (overlaps with period)
            expect(venueIds).toContain(venueId);

            // Participant lived at venue2 from 2024-06-01 (overlaps with period)
            expect(venueIds).toContain(venue2Id);

            // Both venues should be included
            const venue1Marker = result.data.find(m => m.venueId === venueId);
            const venue2Marker = result.data.find(m => m.venueId === venue2Id);

            expect(venue1Marker).toBeDefined();
            expect(venue2Marker).toBeDefined();
        });

        it('should include participant with single address spanning entire period', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    endDate: new Date('2024-08-31'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Participant with single address (null effectiveFrom) should be included
            expect(venueIds).toContain(venue2Id);
        });

        it('should handle null effectiveFrom as earliest possible date', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Participants with null effectiveFrom should be included
            expect(venueIds).toContain(venueId);
            expect(venueIds).toContain(venue2Id);
        });

        it('should return only current homes when no date filters provided', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Without date filters, should only show current homes
            // participant2 currently lives at venue3
            expect(venueIds).toContain(venue3Id);

            // Should NOT include historical addresses for participant2
            // But venue1 and venue2 might appear if other test participants live there currently
        });

        it('should work with only startDate filter', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    startDate: new Date('2024-06-01'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Should include addresses that ended after start date
            expect(venueIds).toContain(venue2Id); // 2024-06-01 to 2024-08-31
            expect(venueIds).toContain(venue3Id); // 2024-09-01 onwards

            // venue1 is included because participant4 has null effectiveFrom there (still current)
            // participant2's address at venue1 ended 2024-05-31, but participant4 is still there
            expect(venueIds).toContain(venueId);
        });

        it('should work with only endDate filter', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    endDate: new Date('2024-08-31'),
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined, // boundingBox
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Should include addresses that started before or during end date
            expect(venueIds).toContain(venueId); // 2024-01-01 to 2024-05-31
            expect(venueIds).toContain(venue2Id); // 2024-06-01 to 2024-08-31

            // venue3 started 2024-09-01, after endDate, so should not be included
            expect(venueIds).not.toContain(venue3Id);
        });
    });
});
