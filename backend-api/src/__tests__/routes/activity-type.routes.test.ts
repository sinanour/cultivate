import request from 'supertest';
import express, { Application } from 'express';
import { ActivityTypeRoutes } from '../../routes/activity-type.routes';
import { ActivityTypeService } from '../../services/activity-type.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../../middleware/audit-logging.middleware';
import { UserRepository } from '../../repositories/user.repository';
import { createMockTokenPayload } from '../helpers/token-payload.helper';
import { UserRole } from '@prisma/client';

jest.mock('../../services/activity-type.service');
jest.mock('../../repositories/user.repository');

describe('ActivityTypeRoutes', () => {
    let app: Application;
    let mockService: jest.Mocked<ActivityTypeService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuthzMiddleware: jest.Mocked<AuthorizationMiddleware>;
    let mockAuditMiddleware: jest.Mocked<AuditLoggingMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockService = new ActivityTypeService(null as any, null as any) as jest.Mocked<ActivityTypeService>;
        const mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
        mockAuthMiddleware = new AuthMiddleware(null as any, mockUserRepository) as jest.Mocked<AuthMiddleware>;
        mockAuthzMiddleware = new AuthorizationMiddleware() as jest.Mocked<AuthorizationMiddleware>;
        mockAuditMiddleware = new AuditLoggingMiddleware(null as any) as jest.Mocked<AuditLoggingMiddleware>;

        // Mock authenticate middleware
        mockAuthMiddleware.authenticate = jest.fn().mockReturnValue((req: any, _res: any, next: any) => {
            req.user = createMockTokenPayload(UserRole.EDITOR);
            next();
        });

        // Mock authorization middleware
        mockAuthzMiddleware.requireAuthenticated = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());
        mockAuthzMiddleware.requireEditor = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        // Mock audit logging middleware
        mockAuditMiddleware.logEntityModification = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        const routes = new ActivityTypeRoutes(mockService, mockAuthMiddleware, mockAuthzMiddleware, mockAuditMiddleware);
        app.use('/api/activity-types', routes.getRouter());

        jest.clearAllMocks();
    });

    describe('GET /api/activity-types', () => {
        it('should return all activity types', async () => {
            const mockTypes = [
                { id: '1', name: 'Workshop', createdAt: new Date(), updatedAt: new Date() },
                { id: '2', name: 'Meeting', createdAt: new Date(), updatedAt: new Date() },
            ];
            mockService.getAllActivityTypes = jest.fn().mockResolvedValue(mockTypes);

            const response = await request(app)
                .get('/api/activity-types')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0]).toMatchObject({ id: '1', name: 'Workshop' });
            expect(response.body.data[1]).toMatchObject({ id: '2', name: 'Meeting' });
        });
    });

    describe('POST /api/activity-types', () => {
        it('should create activity type', async () => {
            const input = { name: 'Workshop', activityCategoryId: '123e4567-e89b-12d3-a456-426614174000' };
            const mockType = { id: '1', ...input, createdAt: new Date(), updatedAt: new Date() };
            mockService.createActivityType = jest.fn().mockResolvedValue(mockType);

            const response = await request(app)
                .post('/api/activity-types')
                .set('Authorization', 'Bearer valid-token')
                .send(input);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toMatchObject({ name: 'Workshop' });
        });

        it('should return 400 for duplicate name', async () => {
            const input = { name: 'Workshop', activityCategoryId: '123e4567-e89b-12d3-a456-426614174000' };
            mockService.createActivityType = jest.fn().mockRejectedValue(new Error('Activity type with this name already exists'));

            const response = await request(app)
                .post('/api/activity-types')
                .set('Authorization', 'Bearer valid-token')
                .send(input);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('code', 'DUPLICATE_NAME');
        });
    });

    describe('PUT /api/activity-types/:id', () => {
        it('should update activity type', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
            const input = { name: 'Updated Workshop' };
            const mockType = { id, ...input, createdAt: new Date(), updatedAt: new Date() };
            mockService.updateActivityType = jest.fn().mockResolvedValue(mockType);

            const response = await request(app)
                .put(`/api/activity-types/${id}`)
                .set('Authorization', 'Bearer valid-token')
                .send(input);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toMatchObject({ name: 'Updated Workshop' });
        });

        it('should return 404 for non-existent activity type', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
            mockService.updateActivityType = jest.fn().mockRejectedValue(new Error('Activity type not found'));

            const response = await request(app)
                .put(`/api/activity-types/${id}`)
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Test' });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('code', 'NOT_FOUND');
        });
    });

    describe('DELETE /api/activity-types/:id', () => {
        it('should delete activity type', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
            mockService.deleteActivityType = jest.fn().mockResolvedValue(undefined);

            const response = await request(app)
                .delete(`/api/activity-types/${id}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(204);
        });

        it('should return 404 for non-existent activity type', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
            mockService.deleteActivityType = jest.fn().mockRejectedValue(new Error('Activity type not found'));

            const response = await request(app)
                .delete(`/api/activity-types/${id}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('code', 'NOT_FOUND');
        });

        it('should return 400 when activity type is referenced', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
            mockService.deleteActivityType = jest.fn().mockRejectedValue(new Error('Cannot delete activity type. It is referenced by 5 activity(ies)'));

            const response = await request(app)
                .delete(`/api/activity-types/${id}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('code', 'REFERENCED_ENTITY');
        });
    });
});
