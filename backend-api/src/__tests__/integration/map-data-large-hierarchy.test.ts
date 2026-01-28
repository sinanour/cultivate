import { PrismaClient } from '@prisma/client';
import { MapDataService } from '../../services/map-data.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserRepository } from '../../repositories/user.repository';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { TestHelpers } from '../utils';

describe('Map Data Large Geographic Hierarchy', () => {
    // Increase timeout for entire suite due to large data volumes
    jest.setTimeout(60000);
    let prisma: PrismaClient;
    let mapDataService: MapDataService;
    let geoAuthService: GeographicAuthorizationService;
    let userId: string;
    let rootAreaId: string;
    const createdIds: {
        areas: string[];
        venues: string[];
        participants: string[];
    } = {
        areas: [],
        venues: [],
        participants: [],
    };

    beforeAll(async () => {
        prisma = new PrismaClient();
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const userRepo = new UserRepository(prisma);
        const authRepo = new UserGeographicAuthorizationRepository(prisma);
        geoAuthService = new GeographicAuthorizationService(authRepo, geoAreaRepo, userRepo);
        mapDataService = new MapDataService(prisma, geoAreaRepo, geoAuthService);

        // Clean up any existing test data from previous runs
        // Must delete in correct order to respect foreign key constraints
        
        // 1. Delete participant address history
        await prisma.participantAddressHistory.deleteMany({
            where: {
                participant: {
                    email: { contains: 'large-hierarchy-participant' },
                },
            },
        });
        
        // 2. Delete participants
        await prisma.participant.deleteMany({
            where: {
                email: { contains: 'large-hierarchy-participant' },
            },
        });
        
        // 3. Delete ALL venues that might be from this test (must be before areas)
        // First, find all test areas (only match this test's specific patterns)
        const testAreas = await prisma.geographicArea.findMany({
            where: {
                OR: [
                    { name: { startsWith: 'Test Neighbourhood Test' } }, // Only match "Test Neighbourhood Test City..."
                    { name: { startsWith: 'Test City Test' } }, // Only match "Test City Test Province..."
                    { name: { startsWith: 'Test Province ' } }, // Match "Test Province 0", "Test Province 1", etc.
                    { name: 'Test Root Country' }, // Exact match
                ],
            },
            select: { id: true },
        });
        const testAreaIds = testAreas.map(a => a.id);
        
        // Delete any authorization rules referencing these areas
        if (testAreaIds.length > 0) {
            await prisma.userGeographicAuthorization.deleteMany({
                where: {
                    geographicAreaId: { in: testAreaIds },
                },
            });
        }
        
        // Delete activity venue history for venues in these areas
        if (testAreaIds.length > 0) {
            // First delete activity venue history referencing these venues
            await prisma.activityVenueHistory.deleteMany({
                where: {
                    venue: {
                        geographicAreaId: { in: testAreaIds },
                    },
                },
            });
            
            // Now safe to delete venues
            await prisma.venue.deleteMany({
                where: {
                    geographicAreaId: { in: testAreaIds },
                },
            });
        }
        
        // 4. Delete ALL authorization rules for these areas (again, in case other tests created them)
        if (testAreaIds.length > 0) {
            await prisma.userGeographicAuthorization.deleteMany({
                where: {
                    geographicAreaId: { in: testAreaIds },
                },
            });
        }
        
        // 5. Now safe to delete geographic areas using the IDs we found
        if (testAreaIds.length > 0) {
            await prisma.geographicArea.deleteMany({
                where: {
                    id: { in: testAreaIds },
                },
            });
        }
        
        // 6. Delete test user
        await prisma.user.deleteMany({
            where: {
                email: 'large-hierarchy-test@example.com',
            },
        });

        // Create test user
        const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR');
        userId = user.id;

        // Create a large geographic hierarchy to test bind variable limits
        // Structure: 1 root → 10 level-1 areas → 100 level-2 areas → 1000 level-3 areas = 1,111 total areas
        // With 3 venues per leaf area = 3,000 venues
        // This tests that we can handle thousands of IDs without hitting the bind variable limit

        // Create root area
        const rootArea = await prisma.geographicArea.create({
            data: {
                name: 'Test Root Country',
                areaType: 'COUNTRY',
                parentGeographicAreaId: null,
            },
        });
        rootAreaId = rootArea.id;
        createdIds.areas.push(rootArea.id);

        // Create level 1 areas (10 provinces)
        const level1Areas: any[] = [];
        for (let i = 0; i < 10; i++) {
            const area = await prisma.geographicArea.create({
                data: {
                    name: `Test Province ${i}`,
                    areaType: 'PROVINCE',
                    parentGeographicAreaId: rootArea.id,
                },
            });
            level1Areas.push(area);
            createdIds.areas.push(area.id);
        }

        // Create level 2 areas (10 cities per province = 100 cities)
        const level2Areas: any[] = [];
        for (const province of level1Areas) {
            for (let i = 0; i < 10; i++) {
                const area = await prisma.geographicArea.create({
                    data: {
                        name: `Test City ${province.name}-${i}`,
                        areaType: 'CITY',
                        parentGeographicAreaId: province.id,
                    },
                });
                level2Areas.push(area);
                createdIds.areas.push(area.id);
            }
        }

        // Create level 3 areas (10 neighbourhoods per city = 1000 neighbourhoods)
        const level3Areas: any[] = [];
        for (const city of level2Areas) {
            for (let i = 0; i < 10; i++) {
                const area = await prisma.geographicArea.create({
                    data: {
                        name: `Test Neighbourhood ${city.name}-${i}`,
                        areaType: 'NEIGHBOURHOOD',
                        parentGeographicAreaId: city.id,
                    },
                });
                level3Areas.push(area);
                createdIds.areas.push(area.id);
            }
        }

        // Create 3 venues per leaf area (3000 venues total)
        for (const neighbourhood of level3Areas) {
            for (let i = 0; i < 3; i++) {
                const venue = await prisma.venue.create({
                    data: {
                        name: `Test Venue ${neighbourhood.name}-${i}`,
                        address: `${i} Test Street`,
                        geographicAreaId: neighbourhood.id,
                        latitude: 49.0 + Math.random() * 0.1,
                        longitude: -123.0 + Math.random() * 0.1,
                    },
                });
                createdIds.venues.push(venue.id);
            }
        }

        // Create 10 participants with addresses at various venues
        for (let i = 0; i < 10; i++) {
            const participant = await prisma.participant.create({
                data: {
                    name: `Test Participant ${i}`,
                    email: `large-hierarchy-participant-${i}@example.com`,
                },
            });
            createdIds.participants.push(participant.id);

            // Assign to a venue - ensure index stays within bounds (0-2999)
            const venueIndex = Math.min(i * 300, createdIds.venues.length - 1);
            await prisma.participantAddressHistory.create({
                data: {
                    participantId: participant.id,
                    venueId: createdIds.venues[venueIndex],
                    effectiveFrom: new Date('2024-01-01'),
                },
            });
        }
    }, 60000); // 60 second timeout for large data creation

    afterAll(async () => {
        // Clean up test data in correct order to respect foreign key constraints
        // 1. Delete participant address history (references participants and venues)
        await prisma.participantAddressHistory.deleteMany({
            where: { participantId: { in: createdIds.participants } },
        });

        // 2. Delete participants
        await prisma.participant.deleteMany({
            where: { id: { in: createdIds.participants } },
        });

        // 3. Delete venues (references geographic areas)
        await prisma.venue.deleteMany({
            where: { id: { in: createdIds.venues } },
        });

        // 4. Delete geographic areas (must be after venues)
        await prisma.geographicArea.deleteMany({
            where: { id: { in: createdIds.areas } },
        });

        // 5. Delete user (if it was created)
        if (userId) {
            await TestHelpers.safeDelete(() =>
                prisma.user.delete({ where: { id: userId } })
            );
        }

        await prisma.$disconnect();
    }, 60000); // 60 second timeout for cleanup

    describe('Large Hierarchy Filtering', () => {
        it('should handle filtering by root area with 1000+ descendant areas and 3000+ venues without bind variable errors', async () => {
            // This test verifies that we can filter by a root geographic area
            // that has 1,111 descendant areas and 3,000 venues without hitting
            // PostgreSQL's 32,767 bind variable limit

            const startTime = Date.now();

            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    geographicAreaIds: [rootAreaId],
                },
                userId
            );

            const executionTime = Date.now() - startTime;

            // Verify query completed successfully
            expect(result).toBeDefined();
            expect(result.data).toBeInstanceOf(Array);
            expect(result.pagination).toBeDefined();

            // Verify we got the expected participants
            expect(result.pagination.total).toBe(10); // 10 participants at 10 different venues

            // Verify performance is acceptable (< 500ms target)
            expect(executionTime).toBeLessThan(500);

            console.log(`[Test] Large hierarchy query completed in ${executionTime}ms`);
            console.log(`[Test] Filtered ${createdIds.areas.length} areas, ${createdIds.venues.length} venues`);
            console.log(`[Test] Returned ${result.data.length} venue markers`);
        });

        it('should handle pagination correctly with large hierarchy', async () => {
            // Test that pagination works correctly when filtering by large hierarchy
            const page1 = await mapDataService.getParticipantHomeMarkers(
                {
                    geographicAreaIds: [rootAreaId],
                },
                userId,
                undefined,
                1,
                5
            );

            const page2 = await mapDataService.getParticipantHomeMarkers(
                {
                    geographicAreaIds: [rootAreaId],
                },
                userId,
                undefined,
                2,
                5
            );

            // Verify pagination metadata
            expect(page1.pagination.page).toBe(1);
            expect(page1.pagination.limit).toBe(5);
            expect(page1.pagination.total).toBe(10);
            expect(page1.pagination.totalPages).toBe(2);

            expect(page2.pagination.page).toBe(2);
            expect(page2.pagination.limit).toBe(5);
            expect(page2.pagination.total).toBe(10);

            // Verify no overlap between pages
            const page1VenueIds = new Set(page1.data.map(m => m.venueId));
            const page2VenueIds = new Set(page2.data.map(m => m.venueId));

            for (const venueId of page2VenueIds) {
                expect(page1VenueIds.has(venueId)).toBe(false);
            }
        });

        it('should combine large hierarchy filter with population filter', async () => {
            // Create a population and assign some participants
            const population = await prisma.population.create({
                data: {
                    name: 'Test Population Large Hierarchy',
                },
            });

            // Assign first 5 participants to population
            for (let i = 0; i < 5; i++) {
                await prisma.participantPopulation.create({
                    data: {
                        participantId: createdIds.participants[i],
                        populationId: population.id,
                    },
                });
            }

            try {
                const result = await mapDataService.getParticipantHomeMarkers(
                    {
                        geographicAreaIds: [rootAreaId],
                        populationIds: [population.id],
                    },
                    userId
                );

                // Should only return participants in the population
                expect(result.pagination.total).toBe(5);
            } finally {
                // Cleanup
                await prisma.participantPopulation.deleteMany({
                    where: { populationId: population.id },
                });
                await prisma.population.delete({
                    where: { id: population.id },
                });
            }
        });

        it('should combine large hierarchy filter with temporal filter', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    geographicAreaIds: [rootAreaId],
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                },
                userId
            );

            // All participants have addresses effective from 2024-01-01
            expect(result.pagination.total).toBe(10);
        });

        it('should combine large hierarchy filter with bounding box', async () => {
            const result = await mapDataService.getParticipantHomeMarkers(
                {
                    geographicAreaIds: [rootAreaId],
                },
                userId,
                {
                    minLat: 49.0,
                    maxLat: 49.2,
                    minLon: -123.2,
                    maxLon: -122.9,
                }
            );

            // Venues have random coordinates in range 49.0-49.1 lat, -123.0 to -122.9 lon
            // So all should be within this bounding box
            expect(result.pagination.total).toBeGreaterThan(0);
            expect(result.pagination.total).toBeLessThanOrEqual(10);
        });
    });
});
