import { AnalyticsService, TimePeriod } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');
jest.mock('../../repositories/geographic-area.repository');

describe('AnalyticsService', () => {
    let service: AnalyticsService;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockGeoRepo: jest.Mocked<GeographicAreaRepository>;

    beforeEach(() => {
        mockPrisma = {
            activity: {
                findMany: jest.fn(),
            },
            participant: {
                findMany: jest.fn(),
            },
            venue: {
                findMany: jest.fn(),
            },
        } as any;

        mockGeoRepo = new GeographicAreaRepository(null as any) as jest.Mocked<GeographicAreaRepository>;
        service = new AnalyticsService(mockPrisma, mockGeoRepo);
        jest.clearAllMocks();
    });

    describe('getEngagementMetrics', () => {
        it('should calculate engagement metrics correctly', async () => {
            const mockActivities = [
                {
                    id: '1',
                    name: 'Activity 1',
                    status: 'ACTIVE',
                    createdAt: new Date('2024-01-01'),
                    updatedAt: new Date('2024-01-01'),
                    startDate: new Date('2024-01-01'),
                    endDate: null,
                    activityTypeId: 'type1',
                    activityType: {
                        id: 'type1',
                        name: 'Workshop',
                        activityCategoryId: 'cat1',
                        activityCategory: { id: 'cat1', name: 'Educational' },
                    },
                    activityVenueHistory: [],
                    assignments: [
                        {
                            participantId: 'p1',
                            roleId: 'r1',
                            createdAt: new Date('2024-01-01'),
                            participant: { id: 'p1' },
                            role: { id: 'r1', name: 'Participant' },
                        },
                        {
                            participantId: 'p2',
                            roleId: 'r2',
                            createdAt: new Date('2024-01-01'),
                            participant: { id: 'p2' },
                            role: { id: 'r2', name: 'Organizer' },
                        },
                    ],
                },
                {
                    id: '2',
                    name: 'Activity 2',
                    status: 'COMPLETED',
                    createdAt: new Date('2024-01-01'),
                    updatedAt: new Date('2024-02-01'),
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-02-01'),
                    activityTypeId: 'type2',
                    activityType: {
                        id: 'type2',
                        name: 'Meeting',
                        activityCategoryId: 'cat2',
                        activityCategory: { id: 'cat2', name: 'Social' },
                    },
                    activityVenueHistory: [],
                    assignments: [
                        {
                            participantId: 'p1',
                            roleId: 'r1',
                            createdAt: new Date('2024-01-01'),
                            participant: { id: 'p1' },
                            role: { id: 'r1', name: 'Participant' },
                        },
                    ],
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);
            mockPrisma.participant.findMany = jest.fn().mockResolvedValue([]);
            mockGeoRepo.findAll = jest.fn().mockResolvedValue([]);

            const result = await service.getEngagementMetrics();

            expect(result.totalParticipants).toBe(2); // p1 and p2
            expect(result.totalActivities).toBe(2);
            expect(result.activitiesByType).toHaveLength(2);
            expect(result.activitiesByType.find(t => t.activityTypeName === 'Workshop')).toBeDefined();
            expect(result.activitiesByType.find(t => t.activityTypeName === 'Meeting')).toBeDefined();
            expect(result.activitiesByCategory).toHaveLength(2);
            expect(result.activitiesByCategory.find(c => c.activityCategoryName === 'Educational')).toBeDefined();
            expect(result.activitiesByCategory.find(c => c.activityCategoryName === 'Social')).toBeDefined();
            expect(result.roleDistribution).toHaveLength(2);
            expect(result.roleDistribution.find(r => r.roleName === 'Participant')).toBeDefined();
            expect(result.roleDistribution.find(r => r.roleName === 'Organizer')).toBeDefined();
        });

        it('should handle empty data', async () => {
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.participant.findMany = jest.fn().mockResolvedValue([]);
            mockGeoRepo.findAll = jest.fn().mockResolvedValue([]);

            const result = await service.getEngagementMetrics();

            expect(result.totalParticipants).toBe(0);
            expect(result.totalActivities).toBe(0);
            expect(result.activitiesByType).toHaveLength(0);
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.participant.findMany = jest.fn().mockResolvedValue([]);
            mockGeoRepo.findAll = jest.fn().mockResolvedValue([]);

            await service.getEngagementMetrics({ startDate, endDate });

            expect(mockPrisma.activity.findMany).toHaveBeenCalled();
        });
    });

    describe('getGrowthMetrics', () => {
        it('should calculate growth metrics for time periods', async () => {
            const mockParticipants = [
                { id: 'p1', createdAt: new Date('2024-01-15') },
                { id: 'p2', createdAt: new Date('2024-02-15') },
                { id: 'p3', createdAt: new Date('2024-02-20') },
            ];

            const mockActivities = [
                { id: 'a1', createdAt: new Date('2024-01-10') },
                { id: 'a2', createdAt: new Date('2024-02-10') },
            ];

            mockPrisma.participant.findMany = jest.fn().mockResolvedValue(mockParticipants);
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-01'),
            });

            expect(result.timeSeries).toBeDefined();
            expect(result.timeSeries.length).toBeGreaterThan(0);
            expect(result.timeSeries[0]).toHaveProperty('date');
            expect(result.timeSeries[0]).toHaveProperty('newActivities');
            expect(result.timeSeries[0]).toHaveProperty('cumulativeParticipants');
            expect(result.timeSeries[0]).toHaveProperty('cumulativeActivities');
        });

        it('should calculate percentage change correctly', async () => {
            const mockActivities = [
                { id: 'a1', createdAt: new Date('2024-01-15') },
                { id: 'a2', createdAt: new Date('2024-02-15') },
                { id: 'a3', createdAt: new Date('2024-02-20') },
            ];

            mockPrisma.participant.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-01'),
            });

            // First period should have null percentage change
            expect(result.timeSeries[0].percentageChange).toBeNull();

            // Subsequent periods should have calculated percentage change
            if (result.timeSeries.length > 1) {
                expect(result.timeSeries[1].percentageChange).toBeDefined();
            }
        });
    });

    describe('getGeographicBreakdown', () => {
        it('should calculate metrics for each geographic area', async () => {
            const mockAreas = [
                { id: 'area1', name: 'Area 1', areaType: 'CITY', parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: 'area2', name: 'Area 2', areaType: 'CITY', parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];

            mockGeoRepo.findAll = jest.fn().mockResolvedValue(mockAreas);
            mockGeoRepo.findDescendants = jest.fn().mockResolvedValue([]);
            mockPrisma.venue.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.participant.findMany = jest.fn().mockResolvedValue([]);

            const result = await service.getGeographicBreakdown();

            expect(result).toHaveProperty('Area 1');
            expect(result).toHaveProperty('Area 2');
            expect(mockGeoRepo.findAll).toHaveBeenCalled();
        });
    });
});
