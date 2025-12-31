import { AnalyticsService, TimePeriod } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient, ActivityStatus } from '@prisma/client';

jest.mock('@prisma/client');
jest.mock('../../repositories/geographic-area.repository');

describe('AnalyticsService - Growth Metrics Edge Cases', () => {
    let service: AnalyticsService;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockGeoRepo: jest.Mocked<GeographicAreaRepository>;

    beforeEach(() => {
        mockPrisma = {
            activity: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
        } as any;

        mockGeoRepo = {
            findDescendants: jest.fn().mockResolvedValue([]),
        } as any;

        service = new AnalyticsService(mockPrisma, mockGeoRepo);
    });

    describe('Finite activity end date handling', () => {
        it('should NOT count activities after their end date has passed', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date(Date.UTC(2024, 0, 10)), // Jan 10, 2024
                    endDate: new Date(Date.UTC(2024, 0, 31, 23, 59, 59)), // Jan 31, 2024 end of day
                    status: ActivityStatus.COMPLETED,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p1', createdAt: new Date(Date.UTC(2024, 0, 10)) },
                    ]
                },
                {
                    id: 'a2',
                    startDate: new Date(Date.UTC(2024, 1, 1)), // Feb 1, 2024
                    endDate: null, // Ongoing
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p2', createdAt: new Date(Date.UTC(2024, 1, 1)) },
                    ]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date(Date.UTC(2024, 0, 1)), // Jan 1, 2024
                endDate: new Date(Date.UTC(2024, 2, 31, 23, 59, 59)), // Mar 31, 2024
            });

            expect(result.timeSeries.length).toBe(3); // Jan, Feb, Mar

            // January: Should count activity a1 (active during Jan)
            const janData = result.timeSeries[0];
            expect(janData.date).toBe('2024-01');
            expect(janData.uniqueActivities).toBe(1); // Only a1
            expect(janData.uniqueParticipants).toBe(1); // Only p1

            // February: Should count activity a2 (started in Feb), but NOT a1 (ended Jan 31)
            const febData = result.timeSeries[1];
            expect(febData.date).toBe('2024-02');
            expect(febData.uniqueActivities).toBe(1); // Only a2, NOT a1
            expect(febData.uniqueParticipants).toBe(1); // Only p2, NOT p1

            // March: Should count activity a2 (still ongoing), but NOT a1 (ended Jan 31)
            const marData = result.timeSeries[2];
            expect(marData.date).toBe('2024-03');
            expect(marData.uniqueActivities).toBe(1); // Only a2, NOT a1
            expect(marData.uniqueParticipants).toBe(1); // Only p2, NOT p1
        });

        it('should count activities that span multiple periods correctly', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date(Date.UTC(2024, 0, 15)), // Jan 15, 2024
                    endDate: new Date(Date.UTC(2024, 2, 15)), // Mar 15, 2024 - spans Jan, Feb, Mar
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p1', createdAt: new Date(Date.UTC(2024, 0, 15)) },
                    ]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date(Date.UTC(2024, 0, 1)), // Jan 1, 2024
                endDate: new Date(Date.UTC(2024, 3, 30)), // Apr 30, 2024
            });

            expect(result.timeSeries.length).toBe(4); // Jan, Feb, Mar, Apr

            // January: Should count a1 (started Jan 15, active during Jan)
            expect(result.timeSeries[0].date).toBe('2024-01');
            expect(result.timeSeries[0].uniqueActivities).toBe(1);

            // February: Should count a1 (still active during Feb)
            expect(result.timeSeries[1].date).toBe('2024-02');
            expect(result.timeSeries[1].uniqueActivities).toBe(1);

            // March: Should count a1 (active until Mar 15)
            expect(result.timeSeries[2].date).toBe('2024-03');
            expect(result.timeSeries[2].uniqueActivities).toBe(1);

            // April: Should NOT count a1 (ended Mar 15, before April started)
            expect(result.timeSeries[3].date).toBe('2024-04');
            expect(result.timeSeries[3].uniqueActivities).toBe(0);
        });

        it('should handle activities that end exactly on period boundary', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date(Date.UTC(2024, 0, 1)), // Jan 1, 2024
                    endDate: new Date(Date.UTC(2024, 0, 31, 23, 59, 59)), // Jan 31, 2024 end of day
                    status: ActivityStatus.COMPLETED,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p1', createdAt: new Date(Date.UTC(2024, 0, 1)) },
                    ]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date(Date.UTC(2024, 0, 1)), // Jan 1, 2024
                endDate: new Date(Date.UTC(2024, 1, 28)), // Feb 28, 2024
            });

            expect(result.timeSeries.length).toBe(2); // Jan, Feb

            // January: Should count a1 (active during Jan)
            expect(result.timeSeries[0].date).toBe('2024-01');
            expect(result.timeSeries[0].uniqueActivities).toBe(1);

            // February: Should NOT count a1 (ended before Feb started)
            expect(result.timeSeries[1].date).toBe('2024-02');
            expect(result.timeSeries[1].uniqueActivities).toBe(0);
        });
    });

    describe('GroupBy functionality', () => {
        it('should return grouped time series when groupBy is specified', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date(Date.UTC(2024, 0, 15)), // Jan 15, 2024
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Study Circle',
                        activityCategory: { name: 'Core Activities' }
                    },
                    assignments: [
                        { participantId: 'p1' },
                        { participantId: 'p2' },
                    ]
                },
                {
                    id: 'a2',
                    startDate: new Date(Date.UTC(2024, 0, 20)), // Jan 20, 2024
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Children\'s Class',
                        activityCategory: { name: 'Core Activities' }
                    },
                    assignments: [
                        { participantId: 'p3' },
                    ]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date(Date.UTC(2024, 0, 1)),
                endDate: new Date(Date.UTC(2024, 1, 28)),
                groupBy: ['activityType' as any],
            });

            // Should return empty timeSeries and populated groupedTimeSeries
            expect(result.timeSeries).toEqual([]);
            expect(result.groupedTimeSeries).toBeDefined();
            expect(Object.keys(result.groupedTimeSeries!)).toContain('Study Circle');
            expect(Object.keys(result.groupedTimeSeries!)).toContain('Children\'s Class');

            // Check Study Circle data
            const studyCircleData = result.groupedTimeSeries!['Study Circle'];
            expect(studyCircleData.length).toBe(2); // Jan, Feb
            expect(studyCircleData[0].date).toBe('2024-01');
            expect(studyCircleData[0].uniqueActivities).toBe(1);
            expect(studyCircleData[0].uniqueParticipants).toBe(2);

            // Check Children's Class data
            const childrenClassData = result.groupedTimeSeries!['Children\'s Class'];
            expect(childrenClassData.length).toBe(2); // Jan, Feb
            expect(childrenClassData[0].date).toBe('2024-01');
            expect(childrenClassData[0].uniqueActivities).toBe(1);
            expect(childrenClassData[0].uniqueParticipants).toBe(1);
        });

        it('should return grouped time series by category when groupBy=category', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date(Date.UTC(2024, 0, 15)),
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Study Circle',
                        activityCategory: { name: 'Core Activities' }
                    },
                    assignments: [{ participantId: 'p1' }]
                },
                {
                    id: 'a2',
                    startDate: new Date(Date.UTC(2024, 0, 20)),
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Children\'s Class',
                        activityCategory: { name: 'Core Activities' }
                    },
                    assignments: [{ participantId: 'p2' }]
                },
                {
                    id: 'a3',
                    startDate: new Date(Date.UTC(2024, 0, 25)),
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Community Event',
                        activityCategory: { name: 'Social Activities' }
                    },
                    assignments: [{ participantId: 'p3' }]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date(Date.UTC(2024, 0, 1)),
                endDate: new Date(Date.UTC(2024, 1, 28)),
                groupBy: ['activityCategory' as any],
            });

            expect(result.timeSeries).toEqual([]);
            expect(result.groupedTimeSeries).toBeDefined();
            expect(Object.keys(result.groupedTimeSeries!)).toContain('Core Activities');
            expect(Object.keys(result.groupedTimeSeries!)).toContain('Social Activities');

            // Core Activities should have 2 activities and 2 participants
            const coreData = result.groupedTimeSeries!['Core Activities'];
            expect(coreData[0].uniqueActivities).toBe(2);
            expect(coreData[0].uniqueParticipants).toBe(2);

            // Social Activities should have 1 activity and 1 participant
            const socialData = result.groupedTimeSeries!['Social Activities'];
            expect(socialData[0].uniqueActivities).toBe(1);
            expect(socialData[0].uniqueParticipants).toBe(1);
        });
    });
});
