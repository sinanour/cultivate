import request from 'supertest';
import app from '../../index';
import { getPrismaClient } from '../../utils/prisma.client';
import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';
import { UserRole } from '@prisma/client';

const prisma = getPrismaClient();

/**
 * Integration tests for map data filter[] syntax support
 * Verifies that filter[ageCohorts] and filter[roleIds] parameters work correctly
 */
describe('Map Data Filter Syntax Integration Tests', () => {
    let authService: AuthService;
    let userRepository: UserRepository;
    let adminToken: string;
    const testSuffix = Date.now();

    beforeAll(async () => {
        userRepository = new UserRepository(prisma);
        authService = new AuthService(userRepository);

        // Create admin user and login to get token
        const passwordHash = await authService.hashPassword('password123');
        await prisma.user.create({
            data: {
                email: `mapfilter-admin-${testSuffix}@example.com`,
                passwordHash,
                role: UserRole.ADMINISTRATOR,
            },
        });

        // Login to get real token
        const loginResult = await authService.login({
            email: `mapfilter-admin-${testSuffix}@example.com`,
            password: 'password123',
        });
        adminToken = loginResult.accessToken;
    });

    afterAll(async () => {
        await prisma.user.deleteMany({
            where: { email: { contains: `mapfilter-admin-${testSuffix}` } },
        });
    });

    describe('Activity markers with filter[] syntax', () => {
        it('should accept filter[ageCohorts] parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/activities')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[ageCohorts]': 'Child'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });

        it('should accept filter[roleIds] parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/activities')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[roleIds]': '00000000-0000-0000-0000-000000000000'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });

        it('should accept both filter[ageCohorts] and filter[roleIds]', async () => {
            const response = await request(app)
                .get('/api/v1/map/activities')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[ageCohorts]': 'Child,Youth',
                    'filter[roleIds]': '00000000-0000-0000-0000-000000000000,11111111-1111-1111-1111-111111111111'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });

        it('should maintain backward compatibility with top-level ageCohorts parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/activities')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    ageCohorts: 'Child'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });
    });

    describe('Participant home markers with filter[] syntax', () => {
        it('should accept filter[ageCohorts] parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/participant-homes')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[ageCohorts]': 'Youth'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });

        it('should accept filter[roleIds] parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/participant-homes')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[roleIds]': '00000000-0000-0000-0000-000000000000'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });
    });

    describe('Venue markers with filter[] syntax', () => {
        it('should accept and ignore filter[ageCohorts] parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/venues')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[ageCohorts]': 'Adult'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });

        it('should accept and ignore filter[roleIds] parameter', async () => {
            const response = await request(app)
                .get('/api/v1/map/venues')
                .query({
                    page: 1,
                    limit: 100,
                    minLat: 40.60952174235885,
                    maxLat: 40.729177554196376,
                    minLon: -74.14947509765626,
                    maxLon: -74.01283264160158,
                    'filter[roleIds]': '00000000-0000-0000-0000-000000000000'
                })
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.pagination).toBeDefined();
        });
    });
});

