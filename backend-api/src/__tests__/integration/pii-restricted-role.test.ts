import request from 'supertest';
import app from '../../index';
import { getPrismaClient } from '../../utils/prisma.client';
import { UserRole } from '@prisma/client';
import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';
import * as bcrypt from 'bcrypt';

const prisma = getPrismaClient();

describe('PII_RESTRICTED Role Integration Tests', () => {
    let authService: AuthService;
    let userRepository: UserRepository;
    let testParticipantId: string;
    let testVenueId: string;
    let testActivityId: string;
    let testGeographicAreaId: string;
    let testActivityTypeId: string;
    let piiRestrictedToken: string;
    let adminToken: string;

    beforeAll(async () => {
        userRepository = new UserRepository(prisma);
        authService = new AuthService(userRepository);

        // Create test geographic area
        const geographicArea = await prisma.geographicArea.create({
            data: {
                name: 'Test Area PII',
                areaType: 'CITY',
            },
        });
        testGeographicAreaId = geographicArea.id;

        // Create test venue
        const venue = await prisma.venue.create({
            data: {
                name: 'Test Community Center PII',
                address: '123 Test Street',
                geographicAreaId: testGeographicAreaId,
                latitude: 40.7128,
                longitude: -74.0060,
            },
        });
        testVenueId = venue.id;

        // Create test participant
        const participant = await prisma.participant.create({
            data: {
                name: 'John Doe PII Test',
                email: 'john.pii.test@example.com',
                phone: '+1234567890',
                notes: 'Test notes',
                dateOfBirth: new Date('1990-01-01'),
                nickname: 'Johnny',
            },
        });
        testParticipantId = participant.id;

        // Get activity type for test activity
        const activityType = await prisma.activityType.findFirst();
        testActivityTypeId = activityType!.id;

        // Create test activity
        const activity = await prisma.activity.create({
            data: {
                name: 'Test Activity PII',
                activityTypeId: testActivityTypeId,
                startDate: new Date(),
                status: 'PLANNED',
            },
        });
        testActivityId = activity.id;

        // Create PII_RESTRICTED user
        const piiRestrictedPasswordHash = await bcrypt.hash('pii123', 10);
        await prisma.user.create({
            data: {
                email: 'pii.integration@test.com',
                passwordHash: piiRestrictedPasswordHash,
                role: UserRole.PII_RESTRICTED,
                displayName: 'PII Restricted User',
            },
        });

        // Create admin user for comparison
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                email: 'admin.pii.test@test.com',
                passwordHash: adminPasswordHash,
                role: UserRole.ADMINISTRATOR,
                displayName: 'Admin User',
            },
        });

        // Get tokens
        const piiTokens = await authService.login({
            email: 'pii.integration@test.com',
            password: 'pii123',
        });
        piiRestrictedToken = piiTokens.accessToken;

        const adminTokens = await authService.login({
            email: 'admin.pii.test@test.com',
            password: 'admin123',
        });
        adminToken = adminTokens.accessToken;
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.activity.deleteMany({ where: { name: { contains: 'Test Activity PII' } } });
        await prisma.participant.deleteMany({ where: { email: { contains: 'pii.test@example.com' } } });
        await prisma.venue.deleteMany({ where: { name: { contains: 'Test Community Center PII' } } });
        await prisma.geographicArea.deleteMany({ where: { name: { contains: 'Test Area PII' } } });
        await prisma.user.deleteMany({ where: { email: { contains: 'pii.integration@test.com' } } });
        await prisma.user.deleteMany({ where: { email: { contains: 'admin.pii.test@test.com' } } });
    });

    describe('JWT Token Generation', () => {
        it('should include PII_RESTRICTED role in JWT token', async () => {
            const payload = authService.validateAccessToken(piiRestrictedToken);
            expect(payload.role).toBe(UserRole.PII_RESTRICTED);
        });
    });

    describe('Participant API Complete Blocking', () => {
        it('should block GET /api/v1/participants for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/participants')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block GET /api/v1/participants/:id for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get(`/api/v1/participants/${testParticipantId}`)
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should allow GET /api/v1/participants for ADMINISTRATOR', async () => {
            const response = await request(app)
                .get('/api/v1/participants')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
        });
    });

    describe('Venue API Complete Blocking', () => {
        it('should block GET /api/v1/venues for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/venues')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block GET /api/v1/venues/:id for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get(`/api/v1/venues/${testVenueId}`)
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });
    });

    describe('Activity API Complete Blocking', () => {
        it('should block GET /api/v1/activities for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/activities')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block GET /api/v1/activities/:id for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get(`/api/v1/activities/${testActivityId}`)
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });
    });

    describe('Map API Complete Blocking', () => {
        it('should block GET /api/v1/map/activities for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/map/activities')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block GET /api/v1/map/venues for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/map/venues')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block GET /api/v1/map/participant-homes for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/map/participant-homes')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });
    });

    describe('Geographic Area Read-Only Access', () => {
        it('should allow GET /api/v1/geographic-areas for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/geographic-areas')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should allow GET /api/v1/geographic-areas/:id for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get(`/api/v1/geographic-areas/${testGeographicAreaId}`)
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should block GET /api/v1/geographic-areas/:id/venues for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get(`/api/v1/geographic-areas/${testGeographicAreaId}/venues`)
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block GET /api/v1/geographic-areas/:id/statistics for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get(`/api/v1/geographic-areas/${testGeographicAreaId}/statistics`)
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ENDPOINT_ACCESS_DENIED');
        });

        it('should block POST /api/v1/geographic-areas for PII_RESTRICTED', async () => {
            const response = await request(app)
                .post('/api/v1/geographic-areas')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .send({
                    name: 'New Area',
                    areaType: 'NEIGHBOURHOOD',
                });

            expect(response.status).toBe(403);
        });
    });

    describe('Analytics Access with Venue Restrictions', () => {
        it('should allow GET /api/v1/analytics/engagement without venue grouping', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/engagement')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .query({ startDate: '2024-01-01T00:00:00Z', endDate: '2024-12-31T23:59:59Z' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should block venue grouping in engagement analytics', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/engagement')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .query({ groupBy: 'venue' });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_GROUPING_PARAMETER');
            expect(response.body.error.message).toContain('Venue grouping is not allowed');
        });

        it('should block venue filtering in engagement analytics', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/engagement')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .query({ venueIds: testVenueId });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_FILTER_PARAMETER');
            expect(response.body.error.message).toContain('Venue filtering is not allowed');
        });

        it('should allow GET /api/v1/analytics/growth without venue filtering', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/growth')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .query({ period: 'MONTH' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should block venue filtering in growth analytics', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/growth')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .query({ period: 'MONTH', venueIds: testVenueId });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_FILTER_PARAMETER');
        });
    });

    describe('Configuration Read-Only Access', () => {
        it('should allow GET /api/v1/activity-categories for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/activity-categories')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should allow GET /api/v1/activity-types for PII_RESTRICTED', async () => {
            const response = await request(app)
                .get('/api/v1/activity-types')
                .set('Authorization', `Bearer ${piiRestrictedToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should block POST /api/v1/activity-categories for PII_RESTRICTED', async () => {
            const response = await request(app)
                .post('/api/v1/activity-categories')
                .set('Authorization', `Bearer ${piiRestrictedToken}`)
                .send({ name: 'New Category' });

            expect(response.status).toBe(403);
        });
    });
});