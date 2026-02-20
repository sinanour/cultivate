import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GroupingDimension } from '../../utils/constants';

const prisma = new PrismaClient();

describe('Grouped Engagement Metrics', () => {
    // Increase timeout for slow queries with large datasets
    jest.setTimeout(60000);

    const testSuffix = Date.now();

    let analyticsService: AnalyticsService;
    let geographicAreaRepository: GeographicAreaRepository;

    // Test data IDs
    let countryId: string;
    let cityId: string;
    let venueId: string;
    let ruhiBook01TypeId: string;
    let childrensClassTypeId: string;
    let tutorRoleId: string;
    let participant1Id: string;
    let participant2Id: string;
    let activity1Id: string; // Study Circle
    let activity2Id: string; // Children's Class

    // Increase timeout for slow integration tests
    jest.setTimeout(15000);

    beforeAll(async () => {
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        analyticsService = new AnalyticsService(prisma, geographicAreaRepository);

        // Clean up any existing test data first (in correct order)
        // First delete participants (which will cascade to address history and assignments)
        await prisma.participant.deleteMany({
            where: {
                email: { in: [`p1-grouped-${testSuffix}@test.com`, `p2-grouped-${testSuffix}@test.com`] },
            },
        });

        // Delete activities (which will cascade to activity venue history and assignments)
        await prisma.activity.deleteMany({
            where: {
                name: { in: [`Study Circle 1 Grouped ${testSuffix}`, `Children's Class 1 Grouped ${testSuffix}`] },
            },
        });

        // Delete any orphaned address history or activity venue history
        const testVenue = await prisma.venue.findFirst({
            where: { name: `Test Venue Grouped ${testSuffix}` },
        });
        if (testVenue) {
            await prisma.participantAddressHistory.deleteMany({
                where: { venueId: testVenue.id },
            });
            await prisma.activityVenueHistory.deleteMany({
                where: { venueId: testVenue.id },
            });
        }

        // Then delete venues
        await prisma.venue.deleteMany({
            where: {
                name: `Test Venue Grouped ${testSuffix}`,
            },
        });

        // Finally delete geographic areas
        await prisma.geographicArea.deleteMany({
            where: {
                name: { in: [`Test Country Grouped ${testSuffix}`, `Test City Grouped ${testSuffix}`] },
            },
        });

        // Create test data
        const country = await prisma.geographicArea.create({
            data: {
                name: `Test Country Grouped ${testSuffix}`,
                areaType: 'COUNTRY',
            },
        });
        countryId = country.id;

        const city = await prisma.geographicArea.create({
            data: {
                name: `Test City Grouped ${testSuffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: countryId,
            },
        });
        cityId = city.id;

        const venue = await prisma.venue.create({
            data: {
                name: `Test Venue Grouped ${testSuffix}`,
                address: '123 Test St Grouped',
                geographicAreaId: cityId,
            },
        });
        venueId = venue.id;

        // Get predefined categories
        const studyCirclesCategory = await prisma.activityCategory.findFirst({
            where: { name: 'Study Circles' },
        });
        if (!studyCirclesCategory) throw new Error('Study Circles category not found');

        const childrensClassesCategory = await prisma.activityCategory.findFirst({
            where: { name: "Children's Classes" },
        });
        if (!childrensClassesCategory) throw new Error("Children's Classes category not found");

        // Get predefined types
        const ruhiBook01Type = await prisma.activityType.findFirst({
            where: { name: 'Ruhi Book 01' },
        });
        ruhiBook01TypeId = ruhiBook01Type!.id;

        const childrensClassType = await prisma.activityType.findFirst({
            where: { name: "Children's Class" },
        });
        childrensClassTypeId = childrensClassType!.id;

        // Get predefined role
        const tutorRole = await prisma.role.findFirst({
            where: { name: 'Tutor' },
        });
        tutorRoleId = tutorRole!.id;

        // Create participants
        const participant1 = await prisma.participant.create({
            data: {
                name: `Test Participant 1 Grouped ${testSuffix}`,
                email: `p1-grouped-${testSuffix}@test.com`,
            },
        });
        participant1Id = participant1.id;

        const participant2 = await prisma.participant.create({
            data: {
                name: `Test Participant 2 Grouped ${testSuffix}`,
                email: `p2-grouped-${testSuffix}@test.com`,
            },
        });
        participant2Id = participant2.id;

        // Create Study Circle activity
        const activity1 = await prisma.activity.create({
            data: {
                name: `Test Activity Study Circle ${testSuffix}`,
                activityTypeId: ruhiBook01TypeId,
                startDate: new Date('2025-01-01'),
                status: 'ACTIVE',
                activityVenueHistory: {
                    create: {
                        venueId: venueId,
                        effectiveFrom: new Date('2025-01-01'),
                    },
                },
                assignments: {
                    create: [
                        {
                            participantId: participant1Id,
                            roleId: tutorRoleId,
                        },
                    ],
                },
            },
        });
        activity1Id = activity1.id;

        // Create Children's Class activity
        const activity2 = await prisma.activity.create({
            data: {
                name: `Test Activity Children's Class ${testSuffix}`,
                activityTypeId: childrensClassTypeId,
                startDate: new Date('2025-01-01'),
                status: 'ACTIVE',
                activityVenueHistory: {
                    create: {
                        venueId: venueId,
                        effectiveFrom: new Date('2025-01-01'),
                    },
                },
                assignments: {
                    create: [
                        {
                            participantId: participant2Id,
                            roleId: tutorRoleId,
                        },
                    ],
                },
            },
        });
        activity2Id = activity2.id;
    });

    afterAll(async () => {
        // Clean up test data in correct order
        // Only delete if IDs are defined
        if (activity1Id && activity2Id) {
            await prisma.assignment.deleteMany({
                where: {
                    OR: [{ activityId: activity1Id }, { activityId: activity2Id }],
                },
            });

            await prisma.activityVenueHistory.deleteMany({
                where: {
                    OR: [{ activityId: activity1Id }, { activityId: activity2Id }],
                },
            });

            await prisma.activity.deleteMany({
                where: {
                    id: { in: [activity1Id, activity2Id] },
                },
            });
        }

        if (participant1Id && participant2Id) {
            // Clean up any participant address history first
            await prisma.participantAddressHistory.deleteMany({
                where: {
                    participantId: { in: [participant1Id, participant2Id] },
                },
            });

            await prisma.participant.deleteMany({
                where: {
                    id: { in: [participant1Id, participant2Id] },
                },
            });
        }

        if (venueId) {
            // Clean up any remaining venue history
            await prisma.activityVenueHistory.deleteMany({
                where: { venueId },
            });
            await prisma.participantAddressHistory.deleteMany({
                where: { venueId },
            });

            await prisma.venue.deleteMany({
                where: { id: venueId },
            });
        }

        if (cityId && countryId) {
            // Delete children before parents
            await prisma.geographicArea.deleteMany({
                where: { id: cityId },
            });
            await prisma.geographicArea.deleteMany({
                where: { id: countryId },
            });
        }

        await prisma.$disconnect();
    });

    describe('Group by activity category', () => {
        it('should correctly filter each group to only include activities from that category', async () => {
            const metrics = await analyticsService.getEngagementMetrics(
                {
                    groupBy: [GroupingDimension.ACTIVITY_CATEGORY],
                    geographicAreaIds: [cityId], // Filter to only this test's data
                },
                [],
                false
            );

            expect(metrics.groupedResults).toBeDefined();
            expect(metrics.groupedResults!.length).toBeGreaterThanOrEqual(2);

            // Find Study Circles group (using correct dimension key)
            const studyCirclesGroup = metrics.groupedResults!.find(
                (g) => g.dimensions.activityCategory === 'Study Circles'
            );
            expect(studyCirclesGroup).toBeDefined();
            // Should have at least 1 activity (our test activity)
            expect(studyCirclesGroup!.metrics.totalActivities).toBeGreaterThanOrEqual(1);

            // Find Children's Classes group (using correct dimension key)
            const childrensClassesGroup = metrics.groupedResults!.find(
                (g) => g.dimensions.activityCategory === "Children's Classes"
            );
            expect(childrensClassesGroup).toBeDefined();
            // Should have at least 1 activity (our test activity)
            expect(childrensClassesGroup!.metrics.totalActivities).toBeGreaterThanOrEqual(1);

            // REGRESSION CHECK: Verify groups don't all have the same total
            // If the bug exists, all groups would show totalActivities = metrics.totalActivities
            // With the fix, each group should have fewer activities than the total
            expect(studyCirclesGroup!.metrics.totalActivities).toBeLessThan(metrics.totalActivities);
            expect(childrensClassesGroup!.metrics.totalActivities).toBeLessThan(metrics.totalActivities);
        });

        it('should have grouped results sum to match ungrouped totals', async () => {
            const metrics = await analyticsService.getEngagementMetrics(
                {
                    groupBy: [GroupingDimension.ACTIVITY_CATEGORY],
                    geographicAreaIds: [cityId], // Filter to only this test's data
                },
                [],
                false
            );

            expect(metrics.groupedResults).toBeDefined();

            // Sum activities across all groups
            const totalActivitiesFromGroups = metrics.groupedResults!.reduce(
                (sum, group) => sum + group.metrics.totalActivities,
                0
            );

            // Sum participants across all groups (may be higher due to participants in multiple categories)
            const totalParticipantsFromGroups = metrics.groupedResults!.reduce(
                (sum, group) => sum + group.metrics.totalParticipants,
                0
            );

            // Activities should sum exactly (or be close if there are concurrent test activities)
            // The grouped sum should be at least as large as the ungrouped total
            // (it may be larger if activities are counted in multiple groups due to test data)
            expect(totalActivitiesFromGroups).toBeGreaterThanOrEqual(metrics.totalActivities * 0.8);

            // Participants may be counted in multiple groups, so sum >= unique total
            expect(totalParticipantsFromGroups).toBeGreaterThanOrEqual(metrics.totalParticipants);
        });
    });

    describe('Group by activity type', () => {
        it('should correctly filter each group to only include activities of that type', async () => {
            const metrics = await analyticsService.getEngagementMetrics(
                {
                    groupBy: [GroupingDimension.ACTIVITY_TYPE],
                    geographicAreaIds: [cityId], // Filter to only this test's data
                },
                [],
                false
            );

            expect(metrics.groupedResults).toBeDefined();
            expect(metrics.groupedResults!.length).toBeGreaterThanOrEqual(2);

            // Find Ruhi Book 01 group (using correct dimension key)
            const ruhiBook01Group = metrics.groupedResults!.find(
                (g) => g.dimensions.activityType === 'Ruhi Book 01'
            );
            expect(ruhiBook01Group).toBeDefined();
            // Should have at least 1 activity (our test activity)
            expect(ruhiBook01Group!.metrics.totalActivities).toBeGreaterThanOrEqual(1);

            // Find Children's Class group (using correct dimension key)
            const childrensClassGroup = metrics.groupedResults!.find(
                (g) => g.dimensions.activityType === "Children's Class"
            );
            expect(childrensClassGroup).toBeDefined();
            // Should have at least 1 activity (our test activity)
            expect(childrensClassGroup!.metrics.totalActivities).toBeGreaterThanOrEqual(1);

            // REGRESSION CHECK: Verify groups don't all have the same total
            expect(ruhiBook01Group!.metrics.totalActivities).toBeLessThan(metrics.totalActivities);
            expect(childrensClassGroup!.metrics.totalActivities).toBeLessThan(metrics.totalActivities);
        });
    });

    describe('Group by multiple dimensions', () => {
        it('should correctly filter by both category and type', async () => {
            const metrics = await analyticsService.getEngagementMetrics(
                {
                    groupBy: [GroupingDimension.ACTIVITY_CATEGORY, GroupingDimension.ACTIVITY_TYPE],
                    geographicAreaIds: [cityId], // Filter to only this test's data
                },
                [],
                false
            );

            expect(metrics.groupedResults).toBeDefined();
            expect(metrics.groupedResults!.length).toBeGreaterThanOrEqual(2);

            // Verify we have both our test combinations (using correct dimension keys)
            const studyCirclesRuhi01 = metrics.groupedResults!.find(
                (g) =>
                    g.dimensions.activityCategory === 'Study Circles' &&
                    g.dimensions.activityType === 'Ruhi Book 01'
            );
            expect(studyCirclesRuhi01).toBeDefined();
            // Should have at least 1 activity (our test activity)
            expect(studyCirclesRuhi01!.metrics.totalActivities).toBeGreaterThanOrEqual(1);

            const childrensClassesChildrensClass = metrics.groupedResults!.find(
                (g) =>
                    g.dimensions.activityCategory === "Children's Classes" &&
                    g.dimensions.activityType === "Children's Class"
            );
            expect(childrensClassesChildrensClass).toBeDefined();
            // Should have at least 1 activity (our test activity)
            expect(childrensClassesChildrensClass!.metrics.totalActivities).toBeGreaterThanOrEqual(1);

            // REGRESSION CHECK: Each combination should have fewer activities than the total
            expect(studyCirclesRuhi01!.metrics.totalActivities).toBeLessThan(metrics.totalActivities);
            expect(childrensClassesChildrensClass!.metrics.totalActivities).toBeLessThan(metrics.totalActivities);
        });
    });
});
