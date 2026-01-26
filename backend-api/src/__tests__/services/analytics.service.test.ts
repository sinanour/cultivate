import { AnalyticsService, TimePeriod } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient, ActivityStatus } from '@prisma/client';

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
            geographicArea: {
                findMany: jest.fn(),
                count: jest.fn(),
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
        it('should calculate unique participant and activity counts for time periods', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date('2024-01-10'),
                    endDate: new Date('2024-01-31'),
                    status: ActivityStatus.COMPLETED,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p1', createdAt: new Date('2024-01-10') },
                        { participantId: 'p2', createdAt: new Date('2024-01-15') },
                    ]
                },
                {
                    id: 'a2',
                    startDate: new Date('2024-02-10'),
                    endDate: null, // Ongoing
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p2', createdAt: new Date('2024-02-10') },
                        { participantId: 'p3', createdAt: new Date('2024-02-15') },
                    ]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-01'),
            });

            expect(result.timeSeries).toBeDefined();
            expect(result.timeSeries.length).toBeGreaterThan(0);
            expect(result.timeSeries[0]).toHaveProperty('date');
            expect(result.timeSeries[0]).toHaveProperty('uniqueParticipants');
            expect(result.timeSeries[0]).toHaveProperty('uniqueActivities');
        });

        it('should calculate unique counts correctly for both participants and activities', async () => {
            const mockActivities = [
                {
                    id: 'a1',
                    startDate: new Date('2024-01-15'),
                    endDate: new Date('2024-01-31'),
                    status: ActivityStatus.COMPLETED,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p1', createdAt: new Date('2024-01-15') },
                    ]
                },
                {
                    id: 'a2',
                    startDate: new Date('2024-02-15'),
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p1', createdAt: new Date('2024-02-15') },
                        { participantId: 'p2', createdAt: new Date('2024-02-15') },
                    ]
                },
                {
                    id: 'a3',
                    startDate: new Date('2024-02-20'),
                    endDate: null,
                    status: ActivityStatus.ACTIVE,
                    activityType: {
                        name: 'Type 1',
                        activityCategory: { name: 'Category 1' }
                    },
                    assignments: [
                        { participantId: 'p3', createdAt: new Date('2024-02-20') },
                    ]
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getGrowthMetrics(TimePeriod.MONTH, {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-01'),
            });

            // Verify unique counts are calculated correctly
            expect(result.timeSeries[0].uniqueParticipants).toBe(1);
            expect(result.timeSeries[0].uniqueActivities).toBe(1);

            // Second period should have more participants and activities
            if (result.timeSeries.length > 1) {
                expect(result.timeSeries[1].uniqueParticipants).toBeGreaterThan(result.timeSeries[0].uniqueParticipants);
                expect(result.timeSeries[1].uniqueActivities).toBeGreaterThan(result.timeSeries[0].uniqueActivities);
            }
        });
    });

    describe('getGeographicBreakdown', () => {
        it('should return top-level areas when no parent is specified', async () => {
            const mockAreas = [
                { id: 'area1', name: 'Area 1', areaType: 'CITY', parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: 'area2', name: 'Area 2', areaType: 'CITY', parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];

            mockPrisma.geographicArea.findMany = jest.fn().mockResolvedValue(mockAreas);
            mockPrisma.geographicArea.groupBy = jest.fn().mockResolvedValue([]);
            mockGeoRepo.findBatchDescendants = jest.fn().mockResolvedValue([]);
            mockPrisma.$queryRawUnsafe = jest.fn()
                .mockResolvedValueOnce([{ total: BigInt(2) }])  // COUNT query first
                .mockResolvedValueOnce([
                    { geographicAreaId: 'area1', activityCount: BigInt(0), participantCount: BigInt(0), participationCount: BigInt(0) },
                    { geographicAreaId: 'area2', activityCount: BigInt(0), participantCount: BigInt(0), participationCount: BigInt(0) },
                ]);

            const result = await service.getGeographicBreakdown(undefined, {}, [], false);

            expect(result.data).toHaveLength(2);
            expect(result.data[0].geographicAreaName).toBe('Area 1');
            expect(result.data[1].geographicAreaName).toBe('Area 2');
            expect(result.pagination.totalRecords).toBe(2);
            expect(mockPrisma.geographicArea.findMany).toHaveBeenCalledWith({
                where: { parentGeographicAreaId: null },
                orderBy: { name: 'asc' },
            });
        });

        it('should return immediate children when parent is specified', async () => {
            const parentId = 'parent-area-id';
            const mockChildren = [
                { id: 'child1', name: 'Child 1', areaType: 'NEIGHBOURHOOD', parentGeographicAreaId: parentId, createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: 'child2', name: 'Child 2', areaType: 'NEIGHBOURHOOD', parentGeographicAreaId: parentId, createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];

            mockPrisma.geographicArea.findMany = jest.fn().mockResolvedValue(mockChildren);
            mockPrisma.geographicArea.groupBy = jest.fn().mockResolvedValue([]);
            mockGeoRepo.findBatchDescendants = jest.fn().mockResolvedValue([]);
            mockPrisma.$queryRawUnsafe = jest.fn()
                .mockResolvedValueOnce([{ total: BigInt(2) }])  // COUNT query first
                .mockResolvedValueOnce([
                    { geographicAreaId: 'child1', activityCount: BigInt(0), participantCount: BigInt(0), participationCount: BigInt(0) },
                    { geographicAreaId: 'child2', activityCount: BigInt(0), participantCount: BigInt(0), participationCount: BigInt(0) },
                ]);

            const result = await service.getGeographicBreakdown(parentId, {}, [], false);

            expect(result.data).toHaveLength(2);
            expect(result.data[0].geographicAreaName).toBe('Child 1');
            expect(result.data[1].geographicAreaName).toBe('Child 2');
            expect(result.pagination.totalRecords).toBe(2);
            expect(mockPrisma.geographicArea.findMany).toHaveBeenCalledWith({
                where: { parentGeographicAreaId: parentId },
                orderBy: { name: 'asc' },
            });
        });
    });
});
