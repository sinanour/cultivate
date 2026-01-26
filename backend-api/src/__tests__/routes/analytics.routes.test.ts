import request from 'supertest';
import express, { Application } from 'express';
import { AnalyticsRoutes } from '../../routes/analytics.routes';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';
import { UserRepository } from '../../repositories/user.repository';
import { createMockTokenPayload } from '../helpers/token-payload.helper';
import { UserRole } from '@prisma/client';

jest.mock('../../services/analytics.service');
jest.mock('../../repositories/user.repository');

describe('AnalyticsRoutes', () => {
    let app: Application;
    let mockService: jest.Mocked<AnalyticsService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuthzMiddleware: jest.Mocked<AuthorizationMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockService = new AnalyticsService(null as any, null as any) as jest.Mocked<AnalyticsService>;
        const mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
        mockAuthMiddleware = new AuthMiddleware(null as any, mockUserRepository) as jest.Mocked<AuthMiddleware>;
        mockAuthzMiddleware = new AuthorizationMiddleware() as jest.Mocked<AuthorizationMiddleware>;

        mockAuthMiddleware.authenticate = jest.fn().mockReturnValue((req: any, _res: any, next: any) => {
            req.user = createMockTokenPayload(UserRole.EDITOR);
            next();
        });

        mockAuthzMiddleware.requireAuthenticated = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        const routes = new AnalyticsRoutes(mockService, mockAuthMiddleware, mockAuthzMiddleware, null as any);
        app.use('/api/analytics', routes.getRouter());

        jest.clearAllMocks();
    });

    describe('GET /api/analytics/engagement', () => {
        it('should return engagement metrics', async () => {
            const mockMetrics = {
                totalParticipants: 50,
                totalActivities: 20,
                activeActivities: 15,
                activitiesByType: { Workshop: 10, Meeting: 10 },
                participantsByType: { Workshop: 30, Meeting: 20 },
                roleDistribution: { Participant: 40, Organizer: 10 },
            };
            mockService.getEngagementMetrics = jest.fn().mockResolvedValue(mockMetrics);

            const response = await request(app)
                .get('/api/analytics/engagement')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockMetrics);
        });
    });

    describe('GET /api/analytics/growth', () => {
        it('should return growth metrics with unique counts per period', async () => {
            const mockMetrics = {
                timeSeries: [
                    { date: '2024-01', uniqueParticipants: 10, uniqueActivities: 5, totalParticipation: 12 },
                    { date: '2024-02', uniqueParticipants: 15, uniqueActivities: 8, totalParticipation: 18 },
                ],
            };
            mockService.getGrowthMetrics = jest.fn().mockResolvedValue(mockMetrics);

            const response = await request(app)
                .get('/api/analytics/growth')
                .query({ period: 'MONTH' })
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockMetrics);
        });

        it('should return grouped time series when groupBy=type', async () => {
            const mockMetrics = {
                timeSeries: [],
                groupedTimeSeries: {
                    'Study Circle': [
                        { date: '2024-01', uniqueParticipants: 5, uniqueActivities: 2, totalParticipation: 6 },
                        { date: '2024-02', uniqueParticipants: 7, uniqueActivities: 3, totalParticipation: 8 },
                    ],
                    'Children\'s Class': [
                        { date: '2024-01', uniqueParticipants: 8, uniqueActivities: 3, totalParticipation: 10 },
                        { date: '2024-02', uniqueParticipants: 10, uniqueActivities: 4, totalParticipation: 12 },
                    ],
                },
            };
            mockService.getGrowthMetrics = jest.fn().mockResolvedValue(mockMetrics);

            const response = await request(app)
                .get('/api/analytics/growth')
                .query({ period: 'MONTH', groupBy: 'type' })
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.timeSeries).toEqual([]);
            expect(response.body.data.groupedTimeSeries).toBeDefined();
            expect(Object.keys(response.body.data.groupedTimeSeries)).toContain('Study Circle');
            expect(Object.keys(response.body.data.groupedTimeSeries)).toContain('Children\'s Class');
        });

        it('should return grouped time series when groupBy=category', async () => {
            const mockMetrics = {
                timeSeries: [],
                groupedTimeSeries: {
                    'Core Activities': [
                        { date: '2024-01', uniqueParticipants: 12, uniqueActivities: 5, totalParticipation: 15 },
                        { date: '2024-02', uniqueParticipants: 15, uniqueActivities: 6, totalParticipation: 18 },
                    ],
                    'Social Activities': [
                        { date: '2024-01', uniqueParticipants: 8, uniqueActivities: 3, totalParticipation: 9 },
                        { date: '2024-02', uniqueParticipants: 10, uniqueActivities: 4, totalParticipation: 11 },
                    ],
                },
            };
            mockService.getGrowthMetrics = jest.fn().mockResolvedValue(mockMetrics);

            const response = await request(app)
                .get('/api/analytics/growth')
                .query({ period: 'MONTH', groupBy: 'category' })
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.timeSeries).toEqual([]);
            expect(response.body.data.groupedTimeSeries).toBeDefined();
            expect(Object.keys(response.body.data.groupedTimeSeries)).toContain('Core Activities');
            expect(Object.keys(response.body.data.groupedTimeSeries)).toContain('Social Activities');
        });

        it('should reject invalid groupBy values', async () => {
            const response = await request(app)
                .get('/api/analytics/growth')
                .query({ period: 'MONTH', groupBy: 'invalid' })
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('GET /api/analytics/geographic', () => {
        it('should return geographic breakdown for top-level areas', async () => {
            const mockBreakdown = [
                {
                    geographicAreaId: 'area1',
                    geographicAreaName: 'Downtown',
                    areaType: 'NEIGHBOURHOOD',
                    activityCount: 10,
                    participantCount: 30,
                    participationCount: 45,
                    hasChildren: true,
                },
                {
                    geographicAreaId: 'area2',
                    geographicAreaName: 'Uptown',
                    areaType: 'NEIGHBOURHOOD',
                    activityCount: 8,
                    participantCount: 20,
                    participationCount: 28,
                    hasChildren: false,
                },
            ];
            const mockResponse = {
                data: mockBreakdown,
                pagination: {
                    page: 1,
                    pageSize: 2,
                    totalRecords: 2,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };
            mockService.getGeographicBreakdown = jest.fn().mockResolvedValue(mockResponse);

            const response = await request(app)
                .get('/api/analytics/geographic')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockBreakdown);
            expect(response.body.pagination).toBeDefined();
            expect(mockService.getGeographicBreakdown).toHaveBeenCalledWith(
                undefined, // parentGeographicAreaId
                expect.objectContaining({}), // filters
                expect.any(Array), // authorizedAreaIds
                expect.any(Boolean), // hasGeographicRestrictions
                expect.any(String), // userId
                undefined // pagination
            );
        });

        it('should return children when parentGeographicAreaId is provided', async () => {
            const parentId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID
            const mockBreakdown = [
                {
                    geographicAreaId: 'child1',
                    geographicAreaName: 'Child 1',
                    areaType: 'CITY',
                    activityCount: 5,
                    participantCount: 15,
                    participationCount: 20,
                    hasChildren: true,
                },
            ];
            const mockResponse = {
                data: mockBreakdown,
                pagination: {
                    page: 1,
                    pageSize: 1,
                    totalRecords: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };
            mockService.getGeographicBreakdown = jest.fn().mockResolvedValue(mockResponse);

            const response = await request(app)
                .get(`/api/analytics/geographic?parentGeographicAreaId=${parentId}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockBreakdown);
            expect(response.body.pagination).toBeDefined();
            expect(mockService.getGeographicBreakdown).toHaveBeenCalledWith(
                parentId,
                expect.objectContaining({
                    activityCategoryIds: undefined,
                    activityTypeIds: undefined,
                    venueIds: undefined,
                    populationIds: undefined,
                }),
                expect.any(Array),
                expect.any(Boolean),
                expect.any(String), // userId
                undefined // pagination
            );
        });
    });
});
