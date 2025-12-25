import request from 'supertest';
import express, { Application } from 'express';
import { SyncRoutes } from '../../routes/sync.routes';
import { SyncService } from '../../services/sync.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';

jest.mock('../../services/sync.service');

describe('SyncRoutes', () => {
    let app: Application;
    let mockService: jest.Mocked<SyncService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuthzMiddleware: jest.Mocked<AuthorizationMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockService = new SyncService(null as any) as jest.Mocked<SyncService>;
        mockAuthMiddleware = new AuthMiddleware(null as any) as jest.Mocked<AuthMiddleware>;
        mockAuthzMiddleware = new AuthorizationMiddleware() as jest.Mocked<AuthorizationMiddleware>;

        mockAuthMiddleware.authenticate = jest.fn().mockReturnValue((req: any, _res: any, next: any) => {
            req.user = { userId: 'user-1', email: 'test@example.com', role: 'EDITOR' };
            next();
        });

        mockAuthzMiddleware.requireEditor = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        const routes = new SyncRoutes(mockService, mockAuthMiddleware, mockAuthzMiddleware);
        app.use('/api/sync', routes.getRouter());

        jest.clearAllMocks();
    });

    describe('POST /api/sync/batch', () => {
        it('should process batch sync operations', async () => {
            const operations = [
                {
                    operation: 'CREATE',
                    entityType: 'participant',
                    localId: 'local-1',
                    data: { name: 'John Doe', email: 'john@example.com' },
                    timestamp: new Date().toISOString(),
                },
            ];

            const mockResponse = {
                results: [{ success: true, localId: 'local-1', serverId: 'server-1' }],
                idMappings: { 'local-1': 'server-1' },
            };

            mockService.processBatchSync = jest.fn().mockResolvedValue(mockResponse);

            const response = await request(app)
                .post('/api/sync/batch')
                .set('Authorization', 'Bearer valid-token')
                .send({ operations });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(mockResponse);
        });

        it('should handle sync errors', async () => {
            const operations = [
                {
                    operation: 'CREATE',
                    entityType: 'participant',
                    localId: 'local-1',
                    data: { name: 'John Doe', email: 'john@example.com' },
                    timestamp: new Date().toISOString(),
                },
            ];

            mockService.processBatchSync = jest.fn().mockRejectedValue(new Error('Sync failed'));

            const response = await request(app)
                .post('/api/sync/batch')
                .set('Authorization', 'Bearer valid-token')
                .send({ operations });

            expect(response.status).toBe(500);
        });
    });
});
