import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { TimePeriod, GroupingDimension } from '../../utils/constants';
import { createMockPrismaClient } from '../utils/mock-prisma';

describe('AnalyticsService - Population Filter', () => {
    let analyticsService: AnalyticsService;
    let mockPrisma: any;
    let mockGeographicAreaRepository: GeographicAreaRepository;

    beforeEach(() => {
        mockPrisma = createMockPrismaClient();
        mockGeographicAreaRepository = {
            findDescendants: jest.fn().mockResolvedValue([]),
            findAncestors: jest.fn().mockResolvedValue([]),
            findAll: jest.fn().mockResolvedValue([]),
        } as any;

        analyticsService = new AnalyticsService(mockPrisma, mockGeographicAreaRepository);
    });

    describe('Engagement Metrics with Population Filter', () => {
        it('should count only participants who belong to specified population', async () => {
            const populationId = 'pop-1';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            // Mock activity with 5 participants, 3 in the specified population
            const mockActivities = [
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2024-06-01'),
                    endDate: null,
                    status: 'ACTIVE',
                    activityType: {
                        id: 'type-1',
                        name: 'Test Type',
                        activityCategoryId: 'cat-1',
                        activityCategory: {
                            id: 'cat-1',
                            name: 'Test Category',
                        },
                    },
                    activityVenueHistory: [],
                    assignments: [
                        {
                            id: 'assign-1',
                            participantId: 'participant-1',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-1',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            id: 'assign-2',
                            participantId: 'participant-2',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-2',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            id: 'assign-3',
                            participantId: 'participant-3',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-3',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            id: 'assign-4',
                            participantId: 'participant-4',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-4',
                                participantPopulations: [
                                    { populationId: 'pop-2', population: { id: 'pop-2', name: 'Adults' } },
                                ],
                            },
                        },
                        {
                            id: 'assign-5',
                            participantId: 'participant-5',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-5',
                                participantPopulations: [], // No population
                            },
                        },
                    ],
                },
            ];

            mockPrisma.activity.findMany.mockResolvedValue(mockActivities);

            const metrics = await analyticsService.getEngagementMetrics(
                {
                    startDate,
                    endDate,
                    populationIds: [populationId],
                },
                [],
                false
            );

            // Should count only 3 participants (those in pop-1), not all 5
            expect(metrics.participantsAtEnd).toBe(3);
            expect(metrics.totalParticipants).toBe(3);

            // Should count only 3 participation instances (those in pop-1), not all 5
            expect(metrics.participationAtEnd).toBe(3);
            expect(metrics.totalParticipation).toBe(3);
        });

        it('should count all participants when no population filter is provided', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            // Same mock activity with 5 participants
            const mockActivities = [
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2024-06-01'),
                    endDate: null,
                    status: 'ACTIVE',
                    activityType: {
                        id: 'type-1',
                        name: 'Test Type',
                        activityCategoryId: 'cat-1',
                        activityCategory: {
                            id: 'cat-1',
                            name: 'Test Category',
                        },
                    },
                    activityVenueHistory: [],
                    assignments: [
                        { id: 'assign-1', participantId: 'participant-1', roleId: 'role-1', role: { id: 'role-1', name: 'Participant' }, participant: { id: 'participant-1', participantPopulations: [] } },
                        { id: 'assign-2', participantId: 'participant-2', roleId: 'role-1', role: { id: 'role-1', name: 'Participant' }, participant: { id: 'participant-2', participantPopulations: [] } },
                        { id: 'assign-3', participantId: 'participant-3', roleId: 'role-1', role: { id: 'role-1', name: 'Participant' }, participant: { id: 'participant-3', participantPopulations: [] } },
                        { id: 'assign-4', participantId: 'participant-4', roleId: 'role-1', role: { id: 'role-1', name: 'Participant' }, participant: { id: 'participant-4', participantPopulations: [] } },
                        { id: 'assign-5', participantId: 'participant-5', roleId: 'role-1', role: { id: 'role-1', name: 'Participant' }, participant: { id: 'participant-5', participantPopulations: [] } },
                    ],
                },
            ];

            mockPrisma.activity.findMany.mockResolvedValue(mockActivities);

            const metrics = await analyticsService.getEngagementMetrics(
                {
                    startDate,
                    endDate,
                },
                [],
                false
            );

            // Should count all 5 participants when no filter
            expect(metrics.participantsAtEnd).toBe(5);
            expect(metrics.totalParticipants).toBe(5);

            // Should count all 5 participation instances when no filter
            expect(metrics.participationAtEnd).toBe(5);
            expect(metrics.totalParticipation).toBe(5);
        });

        it('should filter breakdown by type correctly with population filter', async () => {
            const populationId = 'pop-1';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockActivities = [
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2024-06-01'),
                    endDate: null,
                    status: 'ACTIVE',
                    activityType: {
                        id: 'type-1',
                        name: 'Test Type',
                        activityCategoryId: 'cat-1',
                        activityCategory: {
                            id: 'cat-1',
                            name: 'Test Category',
                        },
                    },
                    activityVenueHistory: [],
                    assignments: [
                        {
                            id: 'assign-1',
                            participantId: 'participant-1',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-1',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            id: 'assign-2',
                            participantId: 'participant-2',
                            roleId: 'role-1',
                            role: { id: 'role-1', name: 'Participant' },
                            participant: {
                                id: 'participant-2',
                                participantPopulations: [
                                    { populationId: 'pop-2', population: { id: 'pop-2', name: 'Adults' } },
                                ],
                            },
                        },
                    ],
                },
            ];

            mockPrisma.activity.findMany.mockResolvedValue(mockActivities);

            const metrics = await analyticsService.getEngagementMetrics(
                {
                    startDate,
                    endDate,
                    populationIds: [populationId],
                },
                [],
                false
            );

            // Check breakdown by type
            expect(metrics.activitiesByType).toHaveLength(1);
            expect(metrics.activitiesByType[0].participantsAtEnd).toBe(1); // Only 1 participant in pop-1
            expect(metrics.activitiesByType[0].participationAtEnd).toBe(1); // Only 1 participation in pop-1

            // Check breakdown by category
            expect(metrics.activitiesByCategory).toHaveLength(1);
            expect(metrics.activitiesByCategory[0].participantsAtEnd).toBe(1);
            expect(metrics.activitiesByCategory[0].participationAtEnd).toBe(1);
        });
    });

    describe('Growth Metrics with Population Filter', () => {
        it('should count only participants who belong to specified population in time series', async () => {
            const populationId = 'pop-1';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockActivities = [
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2024-06-01'),
                    endDate: null,
                    status: 'ACTIVE',
                    activityType: {
                        id: 'type-1',
                        name: 'Test Type',
                        activityCategoryId: 'cat-1',
                        activityCategory: {
                            id: 'cat-1',
                            name: 'Test Category',
                        },
                    },
                    assignments: [
                        {
                            participantId: 'participant-1',
                            participant: {
                                id: 'participant-1',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            participantId: 'participant-2',
                            participant: {
                                id: 'participant-2',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            participantId: 'participant-3',
                            participant: {
                                id: 'participant-3',
                                participantPopulations: [
                                    { populationId: 'pop-2', population: { id: 'pop-2', name: 'Adults' } },
                                ],
                            },
                        },
                        {
                            participantId: 'participant-4',
                            participant: {
                                id: 'participant-4',
                                participantPopulations: [], // No population
                            },
                        },
                    ],
                },
            ];

            mockPrisma.activity.findFirst.mockResolvedValue({ startDate: new Date('2024-01-01') });
            mockPrisma.activity.findMany.mockResolvedValue(mockActivities);

            const metrics = await analyticsService.getGrowthMetrics(
                TimePeriod.MONTH,
                {
                    startDate,
                    endDate,
                    populationIds: [populationId],
                },
                [],
                false
            );

            // Each period should count only 2 participants (those in pop-1), not all 4
            expect(metrics.timeSeries.length).toBeGreaterThan(0);

            // Find the period containing the activity (June 2024)
            const junePeriod = metrics.timeSeries.find(p => p.date.includes('2024-06'));
            expect(junePeriod).toBeDefined();
            expect(junePeriod!.uniqueParticipants).toBe(2); // Only 2 participants in pop-1
            expect(junePeriod!.totalParticipation).toBe(2); // Only 2 participation instances
        });

        it('should count all participants when no population filter is provided', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockActivities = [
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2024-06-01'),
                    endDate: null,
                    status: 'ACTIVE',
                    activityType: {
                        id: 'type-1',
                        name: 'Test Type',
                        activityCategoryId: 'cat-1',
                        activityCategory: {
                            id: 'cat-1',
                            name: 'Test Category',
                        },
                    },
                    assignments: [
                        { participantId: 'participant-1', participant: { id: 'participant-1', participantPopulations: [] } },
                        { participantId: 'participant-2', participant: { id: 'participant-2', participantPopulations: [] } },
                        { participantId: 'participant-3', participant: { id: 'participant-3', participantPopulations: [] } },
                        { participantId: 'participant-4', participant: { id: 'participant-4', participantPopulations: [] } },
                    ],
                },
            ];

            mockPrisma.activity.findFirst.mockResolvedValue({ startDate: new Date('2024-01-01') });
            mockPrisma.activity.findMany.mockResolvedValue(mockActivities);

            const metrics = await analyticsService.getGrowthMetrics(
                TimePeriod.MONTH,
                {
                    startDate,
                    endDate,
                },
                [],
                false
            );

            // Find the period containing the activity (June 2024)
            const junePeriod = metrics.timeSeries.find(p => p.date.includes('2024-06'));
            expect(junePeriod).toBeDefined();
            expect(junePeriod!.uniqueParticipants).toBe(4); // All 4 participants
            expect(junePeriod!.totalParticipation).toBe(4); // All 4 participation instances
        });

        it('should filter grouped time series by population', async () => {
            const populationId = 'pop-1';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockActivities = [
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2024-06-01'),
                    endDate: null,
                    status: 'ACTIVE',
                    activityType: {
                        id: 'type-1',
                        name: 'Test Type',
                        activityCategoryId: 'cat-1',
                        activityCategory: {
                            id: 'cat-1',
                            name: 'Test Category',
                        },
                    },
                    assignments: [
                        {
                            participantId: 'participant-1',
                            participant: {
                                id: 'participant-1',
                                participantPopulations: [
                                    { populationId: 'pop-1', population: { id: 'pop-1', name: 'Youth' } },
                                ],
                            },
                        },
                        {
                            participantId: 'participant-2',
                            participant: {
                                id: 'participant-2',
                                participantPopulations: [
                                    { populationId: 'pop-2', population: { id: 'pop-2', name: 'Adults' } },
                                ],
                            },
                        },
                    ],
                },
            ];

            mockPrisma.activity.findFirst.mockResolvedValue({ startDate: new Date('2024-01-01') });
            mockPrisma.activity.findMany.mockResolvedValue(mockActivities);

            const metrics = await analyticsService.getGrowthMetrics(
                TimePeriod.MONTH,
                {
                    startDate,
                    endDate,
                    populationIds: [populationId],
                    groupBy: [GroupingDimension.ACTIVITY_TYPE],
                },
                [],
                false
            );

            expect(metrics.groupedTimeSeries).toBeDefined();
            expect(metrics.groupedTimeSeries!['Test Type']).toBeDefined();

            const junePeriod = metrics.groupedTimeSeries!['Test Type'].find(p => p.date.includes('2024-06'));
            expect(junePeriod).toBeDefined();
            expect(junePeriod!.uniqueParticipants).toBe(1); // Only 1 participant in pop-1
            expect(junePeriod!.totalParticipation).toBe(1); // Only 1 participation instance
        });
    });
});
