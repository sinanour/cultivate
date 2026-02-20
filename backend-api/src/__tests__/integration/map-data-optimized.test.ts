import { PrismaClient } from '@prisma/client';
import { MapDataService } from '../../services/map-data.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { ActivityStatus } from '../../utils/constants';
import { TestHelpers } from '../utils';

const prisma = new PrismaClient();

describe('Map Data Optimized Implementation', () => {
    let mapDataService: MapDataService;
    let userId: string;
    let geographicAreaId: string;
    let activityTypeId: string;
    const testSuffix = Date.now();

    // Test data IDs
    let activity1Id: string;
    let activity2Id: string;
    let activity3Id: string;

    jest.setTimeout(15000);

    beforeAll(async () => {
        // Initialize services
        const geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
        const userRepository = new UserRepository(prisma);
        const geoAuthService = new GeographicAuthorizationService(
            userGeoAuthRepository,
            geographicAreaRepository,
            userRepository
        );
        mapDataService = new MapDataService(prisma, geoAuthService);

        // Create test data
        const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', testSuffix);
        userId = user.id;

        const area = await prisma.geographicArea.create({
            data: {
                name: `MapOptTest Area ${testSuffix}`,
                areaType: 'CITY',
            },
        });
        geographicAreaId = area.id;

        const activityType = await TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01');
        activityTypeId = activityType.id;

        // Create venues with coordinates
        const venue1 = await prisma.venue.create({
            data: {
                name: `Venue 1 ${testSuffix}`,
                address: '123 Main St',
                geographicAreaId,
                latitude: 40.7,
                longitude: -74.0,
            },
        });

        const venue2 = await prisma.venue.create({
            data: {
                name: `Venue 2 ${testSuffix}`,
                address: '456 Oak Ave',
                geographicAreaId,
                latitude: 40.8,
                longitude: -74.1,
            },
        });

        const venue3 = await prisma.venue.create({
            data: {
                name: `Venue 3 ${testSuffix}`,
                address: '789 Pine Rd',
                geographicAreaId,
                latitude: 40.6,
                longitude: -73.9,
            },
        });

        // Create activities
        const activity1 = await prisma.activity.create({
            data: {
                name: `Activity 1 ${testSuffix}`,
                activityTypeId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-12-31'),
                status: 'ACTIVE',
            },
        });
        activity1Id = activity1.id;

        const activity2 = await prisma.activity.create({
            data: {
                name: `Activity 2 ${testSuffix}`,
                activityTypeId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-12-31'),
                status: 'ACTIVE',
            },
        });
        activity2Id = activity2.id;

        const activity3 = await prisma.activity.create({
            data: {
                name: `Activity 3 ${testSuffix}`,
                activityTypeId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-12-31'),
                status: 'ACTIVE',
            },
        });
        activity3Id = activity3.id;

        // Create venue history
        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity1Id,
                venueId: venue1.id,
                effectiveFrom: null,
            },
        });

        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity2Id,
                venueId: venue2.id,
                effectiveFrom: null,
            },
        });

        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity3Id,
                venueId: venue3.id,
                effectiveFrom: null,
            },
        });
    });

    afterAll(async () => {
        // Cleanup
        await prisma.activityVenueHistory.deleteMany({
            where: {
                activityId: { in: [activity1Id, activity2Id, activity3Id] },
            },
        });
        await prisma.activity.deleteMany({
            where: {
                id: { in: [activity1Id, activity2Id, activity3Id] },
            },
        });
        await prisma.venue.deleteMany({
            where: { geographicAreaId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: geographicAreaId },
        });
        await prisma.user.deleteMany({
            where: { id: userId },
        });

        await prisma.$disconnect();
    });

    describe('Optimized Query Execution', () => {
        it('should return activity markers with stable ordering', async () => {
            const result = await mapDataService.getActivityMarkers(
                {},
                userId,
                undefined,
                1,
                100
            );

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.pagination.total).toBeGreaterThan(0);

            // Verify IDs are in order
            const ids = result.data.map(m => m.id);
            const sortedIds = [...ids].sort();
            expect(ids).toEqual(sortedIds);
        });

        it('should return consistent results across pages', async () => {
            // Fetch page 1
            const page1 = await mapDataService.getActivityMarkers(
                {},
                userId,
                undefined,
                1,
                2
            );

            // Fetch page 2
            const page2 = await mapDataService.getActivityMarkers(
                {},
                userId,
                undefined,
                2,
                2
            );

            // Verify no duplicates
            const page1Ids = page1.data.map(m => m.id);
            const page2Ids = page2.data.map(m => m.id);

            for (const id of page1Ids) {
                expect(page2Ids).not.toContain(id);
            }

            // Verify total count is consistent
            expect(page1.pagination.total).toBe(page2.pagination.total);
        });

        it('should include all required fields in markers', async () => {
            const result = await mapDataService.getActivityMarkers(
                {},
                userId,
                undefined,
                1,
                100
            );

            if (result.data.length > 0) {
                const marker = result.data[0];
                expect(marker).toHaveProperty('id');
                expect(marker).toHaveProperty('latitude');
                expect(marker).toHaveProperty('longitude');
                expect(marker).toHaveProperty('activityTypeId');
                expect(marker).toHaveProperty('activityCategoryId');
                expect(typeof marker.latitude).toBe('number');
                expect(typeof marker.longitude).toBe('number');
            }
        });

        it('should handle empty result sets', async () => {
            const result = await mapDataService.getActivityMarkers(
                { status: ActivityStatus.CANCELLED }, // Assuming no cancelled activities
                userId,
                undefined,
                1,
                100
            );

            expect(result.data).toEqual([]);
            expect(result.pagination.total).toBe(0);
            expect(result.pagination.totalPages).toBe(0);
        });

        it('should respect pagination limits', async () => {
            const result = await mapDataService.getActivityMarkers(
                {},
                userId,
                undefined,
                1,
                10
            );

            expect(result.data.length).toBeLessThanOrEqual(10);
            expect(result.pagination.limit).toBe(10);
        });
    });
});
