import request from 'supertest';
import app from '../../index';
import { getPrismaClient } from '../../utils/prisma.client';
import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';
import { UserRole } from '@prisma/client';

const prisma = getPrismaClient();

describe('Token Invalidation Integration Tests', () => {
    let authService: AuthService;
    let userRepository: UserRepository;
    let testUserId: string;
    let adminUserId: string;

    beforeAll(async () => {
        userRepository = new UserRepository(prisma);
        authService = new AuthService(userRepository);

        // Create test users
        const passwordHash = await authService.hashPassword('password123');

        const testUser = await prisma.user.create({
            data: {
                email: 'tokentest@example.com',
                passwordHash,
                role: UserRole.EDITOR,
                displayName: 'Token Test User',
            },
        });
        testUserId = testUser.id;

        const adminUser = await prisma.user.create({
            data: {
                email: 'tokenadmin@example.com',
                passwordHash,
                role: UserRole.ADMINISTRATOR,
                displayName: 'Token Admin User',
            },
        });
        adminUserId = adminUser.id;
    });

    afterAll(async () => {
        // Clean up test users
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: ['tokentest@example.com', 'tokenadmin@example.com'],
                },
            },
        });
    });

    beforeEach(async () => {
        // Reset lastInvalidationTimestamp before each test
        await prisma.user.updateMany({
            where: {
                id: { in: [testUserId, adminUserId] },
            },
            data: {
                lastInvalidationTimestamp: null,
            },
        });
    });

    describe('POST /api/v1/auth/invalidate-tokens', () => {
        it('should invalidate all tokens for current user', async () => {
            // Generate fresh token
            const tokens = await authService.login({
                email: 'tokentest@example.com',
                password: 'password123',
            });

            const response = await request(app)
                .post('/api/v1/auth/invalidate-tokens')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('invalidated');

            // Verify lastInvalidationTimestamp was updated
            const updatedUser = await prisma.user.findUnique({
                where: { id: testUserId },
            });
            expect(updatedUser?.lastInvalidationTimestamp).not.toBeNull();
        });

        it('should reject invalidated token on subsequent requests', async () => {
            // Generate fresh token
            const tokens = await authService.login({
                email: 'tokentest@example.com',
                password: 'password123',
            });

            // First invalidate tokens
            await request(app)
                .post('/api/v1/auth/invalidate-tokens')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            // Wait a moment to ensure timestamp is different
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to use the same token again
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(401);

            expect(response.body.code).toBe('TOKEN_INVALIDATED');
        });

        it('should require authentication', async () => {
            await request(app)
                .post('/api/v1/auth/invalidate-tokens')
                .expect(401);
        });
    });

    describe('POST /api/v1/auth/invalidate-tokens/:userId', () => {
        it('should allow administrator to invalidate tokens for any user', async () => {
            // Generate fresh admin token
            const adminTokens = await authService.login({
                email: 'tokenadmin@example.com',
                password: 'password123',
            });

            const response = await request(app)
                .post(`/api/v1/auth/invalidate-tokens/${testUserId}`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify lastInvalidationTimestamp was updated
            const updatedUser = await prisma.user.findUnique({
                where: { id: testUserId },
            });
            expect(updatedUser?.lastInvalidationTimestamp).not.toBeNull();
        });

        it('should ignore userId parameter for non-administrators', async () => {
            // Generate fresh token for test user
            const tokens = await authService.login({
                email: 'tokentest@example.com',
                password: 'password123',
            });

            // Try to invalidate admin user's tokens (should invalidate own tokens instead)
            const response = await request(app)
                .post(`/api/v1/auth/invalidate-tokens/${adminUserId}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify test user's tokens were invalidated (not admin's)
            const updatedTestUser = await prisma.user.findUnique({
                where: { id: testUserId },
            });
            expect(updatedTestUser?.lastInvalidationTimestamp).not.toBeNull();
        });
    });

    describe('Password change auto-invalidation', () => {
        it('should automatically invalidate tokens when user changes password', async () => {
            // Generate fresh token
            const tokens = await authService.login({
                email: 'tokentest@example.com',
                password: 'password123',
            });

            // Change password
            await request(app)
                .put('/api/v1/users/me/profile')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({
                    currentPassword: 'password123',
                    newPassword: 'newpassword123',
                })
                .expect(200);

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to use old token
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(401);

            expect(response.body.code).toBe('TOKEN_INVALIDATED');

            // Reset password for next test
            await prisma.user.update({
                where: { id: testUserId },
                data: { passwordHash: await authService.hashPassword('password123') },
            });
        });

        it('should automatically invalidate tokens when admin changes user password', async () => {
            // Generate fresh tokens
            const tokens = await authService.login({
                email: 'tokentest@example.com',
                password: 'password123',
            });
            const adminTokens = await authService.login({
                email: 'tokenadmin@example.com',
                password: 'password123',
            });

            // Admin changes test user's password
            await request(app)
                .put(`/api/v1/users/${testUserId}`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    password: 'adminchanged123',
                })
                .expect(200);

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to use old token
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(401);

            expect(response.body.code).toBe('TOKEN_INVALIDATED');

            // Reset password for next test
            await prisma.user.update({
                where: { id: testUserId },
                data: { passwordHash: await authService.hashPassword('password123') },
            });
        });
    });

    describe('Refresh token validation', () => {
        it('should reject invalidated refresh token', async () => {
            // Generate fresh tokens
            const tokens = await authService.login({
                email: 'tokentest@example.com',
                password: 'password123',
            });

            // Invalidate tokens
            await request(app)
                .post('/api/v1/auth/invalidate-tokens')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to refresh with invalidated refresh token
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: tokens.refreshToken })
                .expect(401);

            expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
        });
    });
});
