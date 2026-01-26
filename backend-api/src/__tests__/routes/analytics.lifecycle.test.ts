import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { AnalyticsRoutes } from '../../routes/analytics.routes';
import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';

describe('AnalyticsRoutes - Activity Lifecycle', () => {
    let app: Express;
    let prisma: PrismaClient;
    let analyticsService: AnalyticsService;
    let geographicAreaRepository: GeographicAreaRepository;

    beforeAll(async () => {
        prisma = new PrismaClient();
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        analyticsService = new AnalyticsService(prisma, geographicAreaRepository);

        // Create Express app
        app = express();
        app.use(express.json());

        // Mock auth middleware
        const authMiddleware = {
            authenticate: () => (req: any, _res: any, next: any) => {
                req.user = { id: 'test-user-id', role: 'ADMINISTRATOR' };
                next();
            },
        } as any;

        const authorizationMiddleware = {
            requireAuthenticated: () => (_req: any, _res: any, next: any) => next(),
        } as any;

        const analyticsRoutes = new AnalyticsRoutes(
            analyticsService,
            authMiddleware,
            authorizationMiddleware,
            prisma
        );

        app.use('/api/v1/analytics', analyticsRoutes.getRouter());
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('GET /api/v1/analytics/activity-lifecycle', () => {
        it('should handle single geographicAreaId parameter correctly', async () => {
            // This test verifies the fix for the bug where single geographicAreaIds
            // were being treated as strings instead of arrays

            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle')
                .query({
                    groupBy: 'type',
                    geographicAreaIds: '2d55ba16-472a-4da8-9b9d-37cce780c100',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should handle multiple geographicAreaIds parameters correctly', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle')
                .query({
                    groupBy: 'type',
                    geographicAreaIds: ['id1', 'id2'],
                });

            // Should fail validation because these aren't valid UUIDs
            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should handle comma-separated geographicAreaIds correctly', async () => {
            const uuid1 = '2d55ba16-472a-4da8-9b9d-37cce780c100';
            const uuid2 = '3e66cb27-583b-5eb9-0c0e-48ddf891d211';

            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle')
                .query({
                    groupBy: 'type',
                    geographicAreaIds: `${uuid1},${uuid2}`,
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should return 400 for invalid UUID in geographicAreaIds', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle')
                .query({
                    groupBy: 'type',
                    geographicAreaIds: 'invalid-uuid',
                });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
            expect(response.body.message).toContain('Invalid');
        });

        it('should return 400 for invalid groupBy parameter', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle')
                .query({
                    groupBy: 'invalid',
                });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for missing groupBy parameter', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle');

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should return empty array when no activities match geographic filter', async () => {
            // Using a valid UUID that doesn't exist in the database
            const response = await request(app)
                .get('/api/v1/analytics/activity-lifecycle')
                .query({
                    groupBy: 'type',
                    geographicAreaIds: '00000000-0000-0000-0000-000000000000',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });
    });
});
