import { AnalyticsService } from '../../services/analytics.service';
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
                    endDate: null,
                    activityType: { name: 'Workshop' },
                    assignments: [
                        {
                            participantId: 'p1',
                            participant: { id: 'p1' },
                            role: { name: 'Participant' },
                        },
                        {
                            participantId: 'p2',
                            participant: { id: 'p2' },
                            role: { name: 'Organizer' },
                        },
                    ],
                },
                {
                    id: '2',
                    name: 'Activity 2',
                    status: 'COMPLETED',
                    endDate: new Date(),
                    activityType: { name: 'Meeting' },
                    assignments: [
                        {
                            participantId: 'p1',
                            participant: { id: 'p1' },
                            role: { name: 'Participant' },
                        },
                    ],
                },
            ];

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getEngagementMetrics();

            expect(result.totalParticipants).toBe(2); // p1 and p2
            expect(result.totalActivities).toBe(2);
            expect(result.activeActivities).toBe(1);
            expect(result.activitiesByType).toEqual({
                Workshop: 1,
                Meeting: 1,
            });
            expect(result.participantsByType).toEqual({
                Workshop: 2, // p1 and p2 in Workshop
                Meeting: 1,  // p1 in Meeting
            });
            expect(result.roleDistribution).toEqual({
                Participant: 2,
                Organizer: 1,
            });
        });

        it('should handle empty data', async () => {
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);

            const result = await service.getEngagementMetrics();

            expect(result.totalParticipants).toBe(0);
            expect(result.totalActivities).toBe(0);
            expect(result.activeActivities).toBe(0);
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);

            await service.getEngagementMetrics({ startDate, endDate });

            expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.any(Array),
                    }),
                })
            );
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

            const result = await service.getGrowthMetrics('MONTH', {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-01'),
            });

            expect(result.timeSeries).toBeDefined();
            expect(result.timeSeries.length).toBeGreaterThan(0);
            expect(result.timeSeries[0]).toHaveProperty('period');
            expect(result.timeSeries[0]).toHaveProperty('newParticipants');
            expect(result.timeSeries[0]).toHaveProperty('newActivities');
            expect(result.timeSeries[0]).toHaveProperty('cumulativeParticipants');
        });

        it('should calculate percentage change correctly', async () => {
            const mockParticipants = [
                { id: 'p1', createdAt: new Date('2024-01-15') },
                { id: 'p2', createdAt: new Date('2024-02-15') },
                { id: 'p3', createdAt: new Date('2024-02-20') },
            ];

            mockPrisma.participant.findMany = jest.fn().mockResolvedValue(mockParticipants);
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);

            const result = await service.getGrowthMetrics('MONTH', {
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
                { id: 'area1', name: 'Area 1', areaType: 'CITY', parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() },
                { id: 'area2', name: 'Area 2', areaType: 'CITY', parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() },
            ];

            mockGeoRepo.findAll = jest.fn().mockResolvedValue(mockAreas);
            mockGeoRepo.findDescendants = jest.fn().mockResolvedValue([]);
            mockPrisma.venue.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.activity.findMany = jest.fn().mockResolvedValue([]);

            const result = await service.getGeographicBreakdown();

            expect(result).toHaveProperty('Area 1');
            expect(result).toHaveProperty('Area 2');
            expect(mockGeoRepo.findAll).toHaveBeenCalled();
        });
    });
});
