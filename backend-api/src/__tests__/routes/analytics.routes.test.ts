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

        const routes = new AnalyticsRoutes(mockService, mockAuthMiddleware, mockAuthzMiddleware);
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
                    { date: '2024-01', uniqueParticipants: 10, uniqueActivities: 5 },
                    { date: '2024-02', uniqueParticipants: 15, uniqueActivities: 8 },
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
            mockService.getGeographicBreakdown = jest.fn().mockResolvedValue(mockBreakdown);

            const response = await request(app)
                .get('/api/analytics/geographic')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockBreakdown);
            expect(mockService.getGeographicBreakdown).toHaveBeenCalledWith(
                undefined, // parentGeographicAreaId
                expect.objectContaining({}), // filters
                expect.any(Array), // authorizedAreaIds
                expect.any(Boolean), // hasGeographicRestrictions
                expect.any(String) // userId
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
            mockService.getGeographicBreakdown = jest.fn().mockResolvedValue(mockBreakdown);

            const response = await request(app)
                .get(`/api/analytics/geographic?parentGeographicAreaId=${parentId}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockBreakdown);
            expect(mockService.getGeographicBreakdown).toHaveBeenCalledWith(
                parentId,
                expect.objectContaining({}),
                expect.any(Array),
                expect.any(Boolean),
                expect.any(String) // userId
            );
        });
    });
});
