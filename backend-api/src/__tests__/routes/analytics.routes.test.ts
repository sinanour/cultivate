import request from 'supertest';
import express, { Application } from 'express';
import { AnalyticsRoutes } from '../../routes/analytics.routes';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';

jest.mock('../../services/analytics.service');

describe('AnalyticsRoutes', () => {
    let app: Application;
    let mockService: jest.Mocked<AnalyticsService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuthzMiddleware: jest.Mocked<AuthorizationMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockService = new AnalyticsService(null as any, null as any) as jest.Mocked<AnalyticsService>;
        mockAuthMiddleware = new AuthMiddleware(null as any) as jest.Mocked<AuthMiddleware>;
        mockAuthzMiddleware = new AuthorizationMiddleware() as jest.Mocked<AuthorizationMiddleware>;

        mockAuthMiddleware.authenticate = jest.fn().mockReturnValue((req: any, _res: any, next: any) => {
            req.user = { userId: 'user-1', email: 'test@example.com', role: 'EDITOR' };
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
                    { date: '2024-01', uniqueParticipants: 10, uniqueActivities: 5, participantPercentageChange: null, activityPercentageChange: null },
                    { date: '2024-02', uniqueParticipants: 15, uniqueActivities: 8, participantPercentageChange: 50, activityPercentageChange: 60 },
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
        it('should return geographic breakdown', async () => {
            const mockBreakdown = {
                'Downtown': {
                    totalParticipants: 30,
                    totalActivities: 10,
                    activeActivities: 8,
                    activitiesByType: {},
                    participantsByType: {},
                    roleDistribution: {},
                },
                'Uptown': {
                    totalParticipants: 20,
                    totalActivities: 8,
                    activeActivities: 6,
                    activitiesByType: {},
                    participantsByType: {},
                    roleDistribution: {},
                },
            };
            mockService.getGeographicBreakdown = jest.fn().mockResolvedValue(mockBreakdown);

            const response = await request(app)
                .get('/api/analytics/geographic')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockBreakdown);
        });
    });
});
