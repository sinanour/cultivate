/**
 * Tests for AnalyticsService - Growth Metrics by Age Cohort
 * 
 * Tests fractional activity counts and historical age cohort evaluation
 */

import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { TimePeriod, GroupingDimension, AgeCohort } from '../../utils/constants';

const prisma = new PrismaClient();

describe('AnalyticsService - Growth Metrics by Age Cohort', () => {
    let analyticsService: AnalyticsService;
    let geographicAreaRepository: GeographicAreaRepository;

    let activityTypeId: string;
    let activityCategoryId: string;
    let roleId: string;
    let geographicAreaId: string;
    let venueId: string;

    beforeAll(async () => {
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        analyticsService = new AnalyticsService(
            prisma,
            geographicAreaRepository
        );

        // Create test data
        const category = await prisma.activityCategory.create({
            data: { name: `Test Category ${Date.now()}`, isPredefined: false },
        });
        activityCategoryId = category.id;

        const type = await prisma.activityType.create({
            data: {
                name: `Test Type ${Date.now()}`,
                activityCategoryId,
                isPredefined: false,
            },
        });
        activityTypeId = type.id;

        const role = await prisma.role.create({
            data: { name: `Test Role ${Date.now()}` },
        });
        roleId = role.id;

        const area = await prisma.geographicArea.create({
            data: {
                name: `Test Area ${Date.now()}`,
                areaType: 'CITY',
            },
        });
        geographicAreaId = area.id;

        const venue = await prisma.venue.create({
            data: {
                name: `Test Venue ${Date.now()}`,
                address: '123 Test St',
                geographicAreaId,
            },
        });
        venueId = venue.id;
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.assignment.deleteMany({
            where: {
                activity: {
                    activityTypeId,
                },
            },
        });
        await prisma.activity.deleteMany({ where: { activityTypeId } });
        await prisma.activityType.deleteMany({ where: { id: activityTypeId } });
        await prisma.activityCategory.deleteMany({ where: { id: activityCategoryId } });
        await prisma.participant.deleteMany({
            where: {
                name: {
                    startsWith: 'Age Cohort Test Participant',
                },
            },
        });
        await prisma.role.deleteMany({ where: { id: roleId } });
        await prisma.venue.deleteMany({ where: { id: venueId } });
        await prisma.geographicArea.deleteMany({ where: { id: geographicAreaId } });

        await prisma.$disconnect();
    });

    describe('Fractional Activity Counts', () => {
        it('should calculate fractional activities based on participant age distribution', async () => {
            // Create participants with different ages

            // Youth: born 2010-06-15 (15 years old at 2025-12-31)
            const youth = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant Youth',
                    dateOfBirth: new Date('2010-06-15'),
                },
            });

            // Junior Youth: born 2012-06-15, 2013-06-15, 2014-06-15 (13, 12, 11 years old)
            const juniorYouth1 = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant JY1',
                    dateOfBirth: new Date('2012-06-15'),
                },
            });
            const juniorYouth2 = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant JY2',
                    dateOfBirth: new Date('2013-06-15'),
                },
            });
            const juniorYouth3 = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant JY3',
                    dateOfBirth: new Date('2014-06-15'),
                },
            });

            // Create activity with these participants
            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity',
                    activityTypeId,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    status: 'ACTIVE',
                },
            });

            // Assign participants to activity
            await prisma.assignment.createMany({
                data: [
                    { activityId: activity.id, participantId: youth.id, roleId },
                    { activityId: activity.id, participantId: juniorYouth1.id, roleId },
                    { activityId: activity.id, participantId: juniorYouth2.id, roleId },
                    { activityId: activity.id, participantId: juniorYouth3.id, roleId },
                ],
            });

            // Get growth metrics grouped by age cohort
            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.YEAR,
                {
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            // Verify response structure
            expect(result.timeSeries).toEqual([]);
            expect(result.groupedTimeSeries).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.YOUTH]).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.JUNIOR_YOUTH]).toBeDefined();

            // Get the 2025 data point
            const youthData = result.groupedTimeSeries![AgeCohort.YOUTH][0];
            const juniorYouthData = result.groupedTimeSeries![AgeCohort.JUNIOR_YOUTH][0];

            // Verify fractional activity counts
            // 1 Youth out of 4 total = 0.25 activities
            expect(youthData.uniqueActivities).toBeCloseTo(0.25, 2);

            // 3 Junior Youth out of 4 total = 0.75 activities
            expect(juniorYouthData.uniqueActivities).toBeCloseTo(0.75, 2);

            // Verify whole number participant counts
            expect(youthData.uniqueParticipants).toBe(1);
            expect(juniorYouthData.uniqueParticipants).toBe(3);

            // Verify whole number participation counts
            expect(youthData.totalParticipation).toBe(1);
            expect(juniorYouthData.totalParticipation).toBe(3);

            // Clean up
            await prisma.assignment.deleteMany({ where: { activityId: activity.id } });
            await prisma.activity.delete({ where: { id: activity.id } });
            await prisma.participant.deleteMany({
                where: {
                    id: {
                        in: [youth.id, juniorYouth1.id, juniorYouth2.id, juniorYouth3.id],
                    },
                },
            });
        });

        it('should include all six age cohorts in response even with zero values', async () => {
            // Create activity with only one age cohort
            const child = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant Child Only',
                    dateOfBirth: new Date('2020-01-01'), // 5 years old
                },
            });

            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity Child Only',
                    activityTypeId,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    status: 'ACTIVE',
                },
            });

            await prisma.assignment.create({
                data: {
                    activityId: activity.id,
                    participantId: child.id,
                    roleId,
                },
            });

            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.YEAR,
                {
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            // Verify all six cohorts are present
            expect(result.groupedTimeSeries![AgeCohort.CHILD]).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.JUNIOR_YOUTH]).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.YOUTH]).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.YOUNG_ADULT]).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.ADULT]).toBeDefined();
            expect(result.groupedTimeSeries![AgeCohort.UNKNOWN]).toBeDefined();

            // Verify only Child cohort has data
            const childData = result.groupedTimeSeries![AgeCohort.CHILD][0];
            expect(childData.uniqueActivities).toBe(1);
            expect(childData.uniqueParticipants).toBe(1);

            // Verify other cohorts have zero values
            const youthData = result.groupedTimeSeries![AgeCohort.YOUTH][0];
            expect(youthData.uniqueActivities).toBe(0);
            expect(youthData.uniqueParticipants).toBe(0);

            // Clean up
            await prisma.assignment.deleteMany({ where: { activityId: activity.id } });
            await prisma.activity.delete({ where: { id: activity.id } });
            await prisma.participant.delete({ where: { id: child.id } });
        });
    });

    describe('Historical Age Cohort Evaluation', () => {
        it('should evaluate participant age at each time period evaluation date', async () => {
            // Create participant who transitions from Junior Youth to Youth
            // Born 2010-12-31, will be 14 on 2024-12-31 (Junior Youth) and 15 on 2025-12-31 (Youth)
            const participant = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant Transition',
                    dateOfBirth: new Date('2010-12-31'),
                },
            });

            // Create activity spanning 2024-2025
            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity Multi-Year',
                    activityTypeId,
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2025-12-31'),
                    status: 'ACTIVE',
                },
            });

            await prisma.assignment.create({
                data: {
                    activityId: activity.id,
                    participantId: participant.id,
                    roleId,
                },
            });

            // Get growth metrics for 2024-2025 by year
            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.YEAR,
                {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2025-12-31'),
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            // In 2024 (evaluation date 2024-12-31), participant is 14 years old (Junior Youth)
            const juniorYouth2024 = result.groupedTimeSeries![AgeCohort.JUNIOR_YOUTH][0];
            expect(juniorYouth2024.uniqueParticipants).toBe(1);
            expect(juniorYouth2024.uniqueActivities).toBe(1);

            // In 2025 (evaluation date 2025-12-31), participant is 15 years old (Youth)
            const youth2025 = result.groupedTimeSeries![AgeCohort.YOUTH][1];
            expect(youth2025.uniqueParticipants).toBe(1);
            expect(youth2025.uniqueActivities).toBe(1);

            // Verify Junior Youth has zero in 2025
            const juniorYouth2025 = result.groupedTimeSeries![AgeCohort.JUNIOR_YOUTH][1];
            expect(juniorYouth2025.uniqueParticipants).toBe(0);
            expect(juniorYouth2025.uniqueActivities).toBe(0);

            // Clean up
            await prisma.assignment.deleteMany({ where: { activityId: activity.id } });
            await prisma.activity.delete({ where: { id: activity.id } });
            await prisma.participant.delete({ where: { id: participant.id } });
        });

        it('should use last day of month as evaluation date for MONTH period', async () => {
            // Create participant born on Feb 28, 2010 (will be 15 on Feb 28, 2025)
            const participant = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant Month Eval',
                    dateOfBirth: new Date('2010-02-28'),
                },
            });

            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity Month',
                    activityTypeId,
                    startDate: new Date('2025-02-01'),
                    endDate: new Date('2025-02-28'),
                    status: 'ACTIVE',
                },
            });

            await prisma.assignment.create({
                data: {
                    activityId: activity.id,
                    participantId: participant.id,
                    roleId,
                },
            });

            // Get growth metrics for February 2025 by month
            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.MONTH,
                {
                    startDate: new Date('2025-02-01'),
                    endDate: new Date('2025-02-28'),
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            // On Feb 28, 2025 (last day of month), participant is exactly 15 years old (Youth)
            const youthData = result.groupedTimeSeries![AgeCohort.YOUTH][0];
            expect(youthData.uniqueParticipants).toBe(1);
            expect(youthData.uniqueActivities).toBe(1);

            // Clean up
            await prisma.assignment.deleteMany({ where: { activityId: activity.id } });
            await prisma.activity.delete({ where: { id: activity.id } });
            await prisma.participant.delete({ where: { id: participant.id } });
        });
    });

    describe('Filter Application with Age Cohort Grouping', () => {
        it('should apply population filter before grouping by age cohort', async () => {
            // Create population
            const population = await prisma.population.create({
                data: { name: `Test Population ${Date.now()}` },
            });

            // Create participants: 1 Youth in population, 1 Junior Youth not in population
            const youthInPop = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Youth In Pop',
                    dateOfBirth: new Date('2010-01-01'), // 15 years old
                },
            });
            await prisma.participantPopulation.create({
                data: {
                    participantId: youthInPop.id,
                    populationId: population.id,
                },
            });

            const juniorYouthNotInPop = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test JY Not In Pop',
                    dateOfBirth: new Date('2013-01-01'), // 12 years old
                },
            });

            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity Pop Filter',
                    activityTypeId,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    status: 'ACTIVE',
                },
            });

            await prisma.assignment.createMany({
                data: [
                    { activityId: activity.id, participantId: youthInPop.id, roleId },
                    { activityId: activity.id, participantId: juniorYouthNotInPop.id, roleId },
                ],
            });

            // Get growth metrics with population filter
            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.YEAR,
                {
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    populationIds: [population.id],
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            // Only Youth in population should be counted
            const youthData = result.groupedTimeSeries![AgeCohort.YOUTH][0];
            expect(youthData.uniqueParticipants).toBe(1);
            expect(youthData.uniqueActivities).toBe(1); // 100% of filtered participants are Youth

            // Junior Youth not in population should NOT be counted
            const juniorYouthData = result.groupedTimeSeries![AgeCohort.JUNIOR_YOUTH][0];
            expect(juniorYouthData.uniqueParticipants).toBe(0);
            expect(juniorYouthData.uniqueActivities).toBe(0);

            // Clean up
            await prisma.assignment.deleteMany({ where: { activityId: activity.id } });
            await prisma.activity.delete({ where: { id: activity.id } });
            await prisma.participantPopulation.deleteMany({ where: { participantId: youthInPop.id } });
            await prisma.participant.deleteMany({
                where: {
                    id: { in: [youthInPop.id, juniorYouthNotInPop.id] },
                },
            });
            await prisma.population.delete({ where: { id: population.id } });
        });
    });

    describe('Edge Cases', () => {
        it('should handle participants with null dateOfBirth (Unknown cohort)', async () => {
            const unknownParticipant = await prisma.participant.create({
                data: {
                    name: 'Age Cohort Test Participant Unknown',
                    dateOfBirth: null,
                },
            });

            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity Unknown',
                    activityTypeId,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    status: 'ACTIVE',
                },
            });

            await prisma.assignment.create({
                data: {
                    activityId: activity.id,
                    participantId: unknownParticipant.id,
                    roleId,
                },
            });

            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.YEAR,
                {
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            const unknownData = result.groupedTimeSeries![AgeCohort.UNKNOWN][0];
            expect(unknownData.uniqueParticipants).toBe(1);
            expect(unknownData.uniqueActivities).toBe(1);

            // Clean up
            await prisma.assignment.deleteMany({ where: { activityId: activity.id } });
            await prisma.activity.delete({ where: { id: activity.id } });
            await prisma.participant.delete({ where: { id: unknownParticipant.id } });
        });

        it('should handle activities with no participants', async () => {
            const activity = await prisma.activity.create({
                data: {
                    name: 'Age Cohort Test Activity No Participants',
                    activityTypeId,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    status: 'ACTIVE',
                },
            });

            const result = await analyticsService.getGrowthMetrics(
                TimePeriod.YEAR,
                {
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'),
                    groupBy: GroupingDimension.AGE_COHORT,
                }
            );

            // All cohorts should have zero values
            Object.values(AgeCohort).forEach(cohort => {
                const cohortData = result.groupedTimeSeries![cohort][0];
                expect(cohortData.uniqueParticipants).toBe(0);
                expect(cohortData.uniqueActivities).toBe(0);
                expect(cohortData.totalParticipation).toBe(0);
            });

            // Clean up
            await prisma.activity.delete({ where: { id: activity.id } });
        });
    });
});
