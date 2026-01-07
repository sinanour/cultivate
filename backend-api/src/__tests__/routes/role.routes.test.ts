import request from 'supertest';
import express, { Application } from 'express';
import { RoleRoutes } from '../../routes/role.routes';
import { RoleService } from '../../services/role.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../../middleware/audit-logging.middleware';
import { UserRepository } from '../../repositories/user.repository';
import { createMockTokenPayload } from '../helpers/token-payload.helper';
import { UserRole } from '@prisma/client';

jest.mock('../../services/role.service');
jest.mock('../../repositories/user.repository');

describe('RoleRoutes', () => {
    let app: Application;
    let mockService: jest.Mocked<RoleService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuthzMiddleware: jest.Mocked<AuthorizationMiddleware>;
    let mockAuditMiddleware: jest.Mocked<AuditLoggingMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockService = new RoleService(null as any) as jest.Mocked<RoleService>;
        const mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
        mockAuthMiddleware = new AuthMiddleware(null as any, mockUserRepository) as jest.Mocked<AuthMiddleware>;
        mockAuthzMiddleware = new AuthorizationMiddleware() as jest.Mocked<AuthorizationMiddleware>;
        mockAuditMiddleware = new AuditLoggingMiddleware(null as any) as jest.Mocked<AuditLoggingMiddleware>;

        mockAuthMiddleware.authenticate = jest.fn().mockReturnValue((req: any, _res: any, next: any) => {
            req.user = createMockTokenPayload(UserRole.EDITOR);
            next();
        });

        mockAuthzMiddleware.requireAuthenticated = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());
        mockAuthzMiddleware.requireEditor = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        // Mock audit logging middleware
        mockAuditMiddleware.logEntityModification = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        const routes = new RoleRoutes(mockService, mockAuthMiddleware, mockAuthzMiddleware, mockAuditMiddleware);
        app.use('/api/roles', routes.getRouter());

        jest.clearAllMocks();
    });

    describe('GET /api/roles', () => {
        it('should return all roles', async () => {
            const mockRoles = [
                { id: '1', name: 'Participant', createdAt: new Date(), updatedAt: new Date() },
                { id: '2', name: 'Organizer', createdAt: new Date(), updatedAt: new Date() },
            ];
            mockService.getAllRoles = jest.fn().mockResolvedValue(mockRoles);

            const response = await request(app)
                .get('/api/roles')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveLength(2);
        });
    });

    describe('POST /api/roles', () => {
        it('should create role', async () => {
            const input = { name: 'Volunteer' };
            const mockRole = { id: '1', ...input, createdAt: new Date(), updatedAt: new Date() };
            mockService.createRole = jest.fn().mockResolvedValue(mockRole);

            const response = await request(app)
                .post('/api/roles')
                .set('Authorization', 'Bearer valid-token')
                .send(input);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toMatchObject({ name: 'Volunteer' });
        });

        it('should return 400 for duplicate name', async () => {
            mockService.createRole = jest.fn().mockRejectedValue(new Error('Role with this name already exists'));

            const response = await request(app)
                .post('/api/roles')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Volunteer' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('code', 'DUPLICATE_NAME');
        });
    });

    describe('PUT /api/roles/:id', () => {
        it('should update role', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000';
            const input = { name: 'Updated Volunteer' };
            const mockRole = { id, ...input, createdAt: new Date(), updatedAt: new Date() };
            mockService.updateRole = jest.fn().mockResolvedValue(mockRole);

            const response = await request(app)
                .put(`/api/roles/${id}`)
                .set('Authorization', 'Bearer valid-token')
                .send(input);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
        });

        it('should return 404 for non-existent role', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000';
            mockService.updateRole = jest.fn().mockRejectedValue(new Error('Role not found'));

            const response = await request(app)
                .put(`/api/roles/${id}`)
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Test' });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('code', 'NOT_FOUND');
        });
    });

    describe('DELETE /api/roles/:id', () => {
        it('should delete role', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000';
            mockService.deleteRole = jest.fn().mockResolvedValue(undefined);

            const response = await request(app)
                .delete(`/api/roles/${id}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(204);
        });

        it('should return 404 for non-existent role', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000';
            mockService.deleteRole = jest.fn().mockRejectedValue(new Error('Role not found'));

            const response = await request(app)
                .delete(`/api/roles/${id}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('code', 'NOT_FOUND');
        });

        it('should return 400 when role is referenced', async () => {
            const id = '123e4567-e89b-12d3-a456-426614174000';
            mockService.deleteRole = jest.fn().mockRejectedValue(new Error('Cannot delete role. It is referenced by 3 assignment(s)'));

            const response = await request(app)
                .delete(`/api/roles/${id}`)
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('code', 'REFERENCED_ENTITY');
        });
    });
});
