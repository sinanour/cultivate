import request from 'supertest';
import express, { Application } from 'express';
import { AuthRoutes } from '../../routes/auth.routes';
import { AuthService } from '../../services/auth.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuditLoggingMiddleware } from '../../middleware/audit-logging.middleware';
import { UserRepository } from '../../repositories/user.repository';
import { createMockTokenPayload } from '../helpers/token-payload.helper';
import { UserRole } from '@prisma/client';

jest.mock('../../services/auth.service');
jest.mock('../../repositories/user.repository');

describe('AuthRoutes', () => {
    let app: Application;
    let mockAuthService: jest.Mocked<AuthService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuditMiddleware: jest.Mocked<AuditLoggingMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockAuthService = new AuthService(null as any) as jest.Mocked<AuthService>;
        const mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
        mockAuthMiddleware = new AuthMiddleware(null as any, mockUserRepository) as jest.Mocked<AuthMiddleware>;
        mockAuditMiddleware = new AuditLoggingMiddleware(null as any) as jest.Mocked<AuditLoggingMiddleware>;

        // Mock authenticate middleware
        mockAuthMiddleware.authenticate = jest.fn().mockReturnValue((req: any, _res: any, next: any) => {
            req.user = createMockTokenPayload(UserRole.EDITOR);
            next();
        });

        // Mock audit logging middleware
        mockAuditMiddleware.logAuthenticationEvent = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());

        const authRoutes = new AuthRoutes(mockAuthService, mockAuthMiddleware, mockAuditMiddleware);
        app.use('/api/auth', authRoutes.getRouter());

        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
            mockAuthService.login = jest.fn().mockResolvedValue(tokens);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(tokens);
        });

        it('should return 401 for invalid credentials', async () => {
            mockAuthService.login = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should refresh access token', async () => {
            const tokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
            mockAuthService.refreshAccessToken = jest.fn().mockResolvedValue(tokens);

            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'valid-refresh-token' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toEqual(tokens);
        });

        it('should return 401 for invalid refresh token', async () => {
            mockAuthService.refreshAccessToken = jest.fn().mockRejectedValue(new Error('Invalid refresh token'));

            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'invalid-token' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('code', 'INVALID_REFRESH_TOKEN');
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user info', async () => {
            const userInfo = { id: 'user-1', email: 'test@example.com', role: 'EDITOR', createdAt: new Date(), updatedAt: new Date() };
            mockAuthService.getUserInfo = jest.fn().mockResolvedValue(userInfo);

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toMatchObject({
                id: 'user-1',
                email: 'test@example.com',
                role: 'EDITOR',
            });
        });

        it('should return 404 for non-existent user', async () => {
            mockAuthService.getUserInfo = jest.fn().mockRejectedValue(new Error('User not found'));

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('code', 'USER_NOT_FOUND');
        });
    });
});
