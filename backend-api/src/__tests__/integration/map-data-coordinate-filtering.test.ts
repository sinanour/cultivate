import { PrismaClient } from '@prisma/client';
import { MapDataService, BoundingBox } from '../../services/map-data.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';

const prisma = new PrismaClient();

describe('Map Data Coordinate-Based Filtering', () => {
    let mapDataService: MapDataService;
    let geographicAreaRepository: GeographicAreaRepository;
    let geoAuthService: GeographicAuthorizationService;

    // Test data IDs
    let userId: string;
    let geographicAreaId: string;
    let activityTypeId: string;

    // Venue IDs at different coordinates
    let nwVenueId: string; // Northwest: 40.8, -74.1
    let neVenueId: string; // Northeast: 40.8, -73.9
    let swVenueId: string; // Southwest: 40.6, -74.1
    let seVenueId: string; // Southeast: 40.6, -73.9
    let centerVenueId: string; // Center: 40.7, -74.0

    // Activity IDs
    let nwActivityId: string;
    let neActivityId: string;
    let swActivityId: string;
    let seActivityId: string;
    let centerActivityId: string;

    // Participant IDs
    let nwParticipantId: string;
    let neParticipantId: string;
    let swParticipantId: string;
    let seParticipantId: string;
    let centerParticipantId: string;

    jest.setTimeout(15000);

    beforeAll(async () => {
        // Initialize services
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
        const userRepository = new UserRepository(prisma);
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
                email: 'map-coordinate-test@test.com',
                passwordHash: 'hash',
                role: 'ADMINISTRATOR',
            },
        });
        userId = user.id;

        // Create geographic area
        const area = await prisma.geographicArea.create({
            data: {
                name: 'Test City for Coordinate Filtering',
                areaType: 'CITY',
            },
        });
        geographicAreaId = area.id;

        // Get activity type
        const type = await prisma.activityType.findFirst({
            where: { name: 'Ruhi Book 01' },
        });
        activityTypeId = type!.id;

        // Create venues at different coordinates
        const nwVenue = await prisma.venue.create({
            data: {
                name: 'Northwest Venue',
                address: '1 NW St',
                geographicAreaId,
                latitude: 40.8,
                longitude: -74.1,
            },
        });
        nwVenueId = nwVenue.id;

        const neVenue = await prisma.venue.create({
            data: {
                name: 'Northeast Venue',
                address: '2 NE St',
                geographicAreaId,
                latitude: 40.8,
                longitude: -73.9,
            },
        });
        neVenueId = neVenue.id;

        const swVenue = await prisma.venue.create({
            data: {
                name: 'Southwest Venue',
                address: '3 SW St',
                geographicAreaId,
                latitude: 40.6,
                longitude: -74.1,
            },
        });
        swVenueId = swVenue.id;

        const seVenue = await prisma.venue.create({
            data: {
                name: 'Southeast Venue',
                address: '4 SE St',
                geographicAreaId,
                latitude: 40.6,
                longitude: -73.9,
            },
        });
        seVenueId = seVenue.id;

        const centerVenue = await prisma.venue.create({
            data: {
                name: 'Center Venue',
                address: '5 Center St',
                geographicAreaId,
                latitude: 40.7,
                longitude: -74.0,
            },
        });
        centerVenueId = centerVenue.id;

        // Create activities at each venue
        const nwActivity = await prisma.activity.create({
            data: {
                name: 'NW Activity',
                activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        nwActivityId = nwActivity.id;
        await prisma.activityVenueHistory.create({
            data: { activityId: nwActivityId, venueId: nwVenueId, effectiveFrom: null },
        });

        const neActivity = await prisma.activity.create({
            data: {
                name: 'NE Activity',
                activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        neActivityId = neActivity.id;
        await prisma.activityVenueHistory.create({
            data: { activityId: neActivityId, venueId: neVenueId, effectiveFrom: null },
        });

        const swActivity = await prisma.activity.create({
            data: {
                name: 'SW Activity',
                activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        swActivityId = swActivity.id;
        await prisma.activityVenueHistory.create({
            data: { activityId: swActivityId, venueId: swVenueId, effectiveFrom: null },
        });

        const seActivity = await prisma.activity.create({
            data: {
                name: 'SE Activity',
                activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        seActivityId = seActivity.id;
        await prisma.activityVenueHistory.create({
            data: { activityId: seActivityId, venueId: seVenueId, effectiveFrom: null },
        });

        const centerActivity = await prisma.activity.create({
            data: {
                name: 'Center Activity',
                activityTypeId,
                startDate: new Date('2024-01-01'),
                status: 'ACTIVE',
            },
        });
        centerActivityId = centerActivity.id;
        await prisma.activityVenueHistory.create({
            data: { activityId: centerActivityId, venueId: centerVenueId, effectiveFrom: null },
        });

        // Create participants at each venue
        const nwParticipant = await prisma.participant.create({
            data: { name: 'NW Participant', email: 'nw@test.com' },
        });
        nwParticipantId = nwParticipant.id;
        await prisma.participantAddressHistory.create({
            data: { participantId: nwParticipantId, venueId: nwVenueId, effectiveFrom: null },
        });

        const neParticipant = await prisma.participant.create({
            data: { name: 'NE Participant', email: 'ne@test.com' },
        });
        neParticipantId = neParticipant.id;
        await prisma.participantAddressHistory.create({
            data: { participantId: neParticipantId, venueId: neVenueId, effectiveFrom: null },
        });

        const swParticipant = await prisma.participant.create({
            data: { name: 'SW Participant', email: 'sw@test.com' },
        });
        swParticipantId = swParticipant.id;
        await prisma.participantAddressHistory.create({
            data: { participantId: swParticipantId, venueId: swVenueId, effectiveFrom: null },
        });

        const seParticipant = await prisma.participant.create({
            data: { name: 'SE Participant', email: 'se@test.com' },
        });
        seParticipantId = seParticipant.id;
        await prisma.participantAddressHistory.create({
            data: { participantId: seParticipantId, venueId: seVenueId, effectiveFrom: null },
        });

        const centerParticipant = await prisma.participant.create({
            data: { name: 'Center Participant', email: 'center@test.com' },
        });
        centerParticipantId = centerParticipant.id;
        await prisma.participantAddressHistory.create({
            data: { participantId: centerParticipantId, venueId: centerVenueId, effectiveFrom: null },
        });
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.activityVenueHistory.deleteMany({
            where: {
                activityId: {
                    in: [nwActivityId, neActivityId, swActivityId, seActivityId, centerActivityId],
                },
            },
        });
        await prisma.activity.deleteMany({
            where: {
                id: {
                    in: [nwActivityId, neActivityId, swActivityId, seActivityId, centerActivityId],
                },
            },
        });
        await prisma.participantAddressHistory.deleteMany({
            where: {
                participantId: {
                    in: [nwParticipantId, neParticipantId, swParticipantId, seParticipantId, centerParticipantId],
                },
            },
        });
        await prisma.participant.deleteMany({
            where: {
                id: {
                    in: [nwParticipantId, neParticipantId, swParticipantId, seParticipantId, centerParticipantId],
                },
            },
        });
        await prisma.venue.deleteMany({
            where: {
                id: {
                    in: [nwVenueId, neVenueId, swVenueId, seVenueId, centerVenueId],
                },
            },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: geographicAreaId },
        });
        await prisma.user.deleteMany({
            where: { id: userId },
        });

        await prisma.$disconnect();
    });

    describe('Activity Marker Coordinate Filtering', () => {
        it('should return only activities within bounding box', async () => {
            // Bounding box covering northwest and northeast quadrants
            // minLat: 40.7, maxLat: 40.9, minLon: -74.2, maxLon: -73.8
            const boundingBox: BoundingBox = {
                minLat: 40.7,
                maxLat: 40.9,
                minLon: -74.2,
                maxLon: -73.8,
            };

            const result = await mapDataService.getActivityMarkers(
                {
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                boundingBox,
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include NW (40.8, -74.1) and NE (40.8, -73.9)
            expect(activityIds).toContain(nwActivityId);
            expect(activityIds).toContain(neActivityId);

            // Should NOT include SW (40.6, -74.1) or SE (40.6, -73.9) - below minLat
            expect(activityIds).not.toContain(swActivityId);
            expect(activityIds).not.toContain(seActivityId);

            // Center (40.7, -74.0) is on the boundary - should be included
            expect(activityIds).toContain(centerActivityId);

            expect(result.data.length).toBe(3);
        });

        it('should return all activities when no bounding box provided', async () => {
            const result = await mapDataService.getActivityMarkers(
                {},
                userId,
                undefined,
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include all activities
            expect(activityIds).toContain(nwActivityId);
            expect(activityIds).toContain(neActivityId);
            expect(activityIds).toContain(swActivityId);
            expect(activityIds).toContain(seActivityId);
            expect(activityIds).toContain(centerActivityId);

            expect(result.data.length).toBeGreaterThanOrEqual(5);
        });

        it('should combine bounding box with geographic area filter', async () => {
            // Small bounding box covering only center
            const boundingBox: BoundingBox = {
                minLat: 40.65,
                maxLat: 40.75,
                minLon: -74.05,
                maxLon: -73.95,
            };

            const result = await mapDataService.getActivityMarkers(
                {
                    geographicAreaIds: [geographicAreaId],
                },
                userId,
                boundingBox,
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should only include center activity
            expect(activityIds).toContain(centerActivityId);
            expect(result.data.length).toBe(1);
        });

        it('should return empty array when bounding box contains no markers', async () => {
            // Bounding box far from any venues
            const boundingBox: BoundingBox = {
                minLat: 50.0,
                maxLat: 51.0,
                minLon: -75.0,
                maxLon: -74.0,
            };

            const result = await mapDataService.getActivityMarkers(
                {},
                userId,
                boundingBox,
                1,
                100
            );

            expect(result.data.length).toBe(0);
            expect(result.pagination.total).toBe(0);
        });
    });

    describe('Participant Home Marker Coordinate Filtering', () => {
        it('should return only participant homes within bounding box', async () => {
            // Bounding box covering northwest and northeast quadrants
            const boundingBox: BoundingBox = {
                minLat: 40.7,
                maxLat: 40.9,
                minLon: -74.2,
                maxLon: -73.8,
            };

            const result = await mapDataService.getParticipantHomeMarkers(
                {},
                userId,
                boundingBox,
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Should include NW and NE venues
            expect(venueIds).toContain(nwVenueId);
            expect(venueIds).toContain(neVenueId);

            // Should NOT include SW or SE venues
            expect(venueIds).not.toContain(swVenueId);
            expect(venueIds).not.toContain(seVenueId);

            // Center should be included
            expect(venueIds).toContain(centerVenueId);
        });

        it('should return all participant homes when no bounding box provided', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {},
                userId,
                undefined,
                1,
                100
            );

            const venueIds = result.data.map(m => m.venueId);

            // Should include all venues
            expect(venueIds).toContain(nwVenueId);
            expect(venueIds).toContain(neVenueId);
            expect(venueIds).toContain(swVenueId);
            expect(venueIds).toContain(seVenueId);
            expect(venueIds).toContain(centerVenueId);
        });
    });

    describe('Venue Marker Coordinate Filtering', () => {
        it('should return only venues within bounding box', async () => {
            // Bounding box covering southwest and southeast quadrants
            const boundingBox: BoundingBox = {
                minLat: 40.5,
                maxLat: 40.7,
                minLon: -74.2,
                maxLon: -73.8,
            };

            const result = await mapDataService.getVenueMarkers(
                {},
                userId,
                boundingBox,
                1,
                100
            );

            const venueIds = result.data.map(m => m.id);

            // Should include SW and SE venues
            expect(venueIds).toContain(swVenueId);
            expect(venueIds).toContain(seVenueId);

            // Should NOT include NW or NE venues
            expect(venueIds).not.toContain(nwVenueId);
            expect(venueIds).not.toContain(neVenueId);

            // Center should be included (on boundary)
            expect(venueIds).toContain(centerVenueId);
        });

        it('should return all venues when no bounding box provided', async () => {
            const result = await mapDataService.getVenueMarkers(
                {
                    geographicAreaIds: [geographicAreaId], // Filter to our test area only
                },
                userId,
                undefined,
                1,
                100
            );

            const venueIds = result.data.map(m => m.id);

            // Should include all test venues
            expect(venueIds).toContain(nwVenueId);
            expect(venueIds).toContain(neVenueId);
            expect(venueIds).toContain(swVenueId);
            expect(venueIds).toContain(seVenueId);
            expect(venueIds).toContain(centerVenueId);

            // Should have exactly 5 venues from our test area
            expect(result.data.length).toBe(5);
        });
    });

    describe('International Date Line Handling', () => {
        let pacificVenueId: string;
        let pacificActivityId: string;

        beforeAll(async () => {
            // Create venue near international date line (Pacific Ocean)
            const pacificVenue = await prisma.venue.create({
                data: {
                    name: 'Pacific Venue',
                    address: 'Pacific Ocean',
                    geographicAreaId,
                    latitude: 0.0,
                    longitude: 179.5, // Near date line
                },
            });
            pacificVenueId = pacificVenue.id;

            // Create activity at Pacific venue
            const pacificActivity = await prisma.activity.create({
                data: {
                    name: 'Pacific Activity',
                    activityTypeId,
                    startDate: new Date('2024-01-01'),
                    status: 'ACTIVE',
                },
            });
            pacificActivityId = pacificActivity.id;
            await prisma.activityVenueHistory.create({
                data: { activityId: pacificActivityId, venueId: pacificVenueId, effectiveFrom: null },
            });
        });

        afterAll(async () => {
            await prisma.activityVenueHistory.deleteMany({
                where: { activityId: pacificActivityId },
            });
            await prisma.activity.deleteMany({
                where: { id: pacificActivityId },
            });
            await prisma.venue.deleteMany({
                where: { id: pacificVenueId },
            });
        });

        it('should handle bounding box crossing international date line', async () => {
            // Bounding box crossing date line: 170 to -170 (wraps around)
            const boundingBox: BoundingBox = {
                minLat: -10.0,
                maxLat: 10.0,
                minLon: 170.0,
                maxLon: -170.0, // minLon > maxLon indicates date line crossing
            };

            const result = await mapDataService.getActivityMarkers(
                {},
                userId,
                boundingBox,
                1,
                100
            );

            const activityIds = result.data.map(m => m.id);

            // Should include Pacific activity (179.5 is >= 170.0)
            expect(activityIds).toContain(pacificActivityId);
        });
    });
});
