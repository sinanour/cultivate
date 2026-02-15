import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Activity Notes Field', () => {
    let authToken: string;
    let activityTypeId: string;
    let venueId: string;
    let geographicAreaId: string;
    let activityId: string;

    beforeAll(async () => {
        // Create test user
        const userResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: process.env.SRP_ROOT_ADMIN_EMAIL,
                password: process.env.SRP_ROOT_ADMIN_PASSWORD,
            });

        authToken = userResponse.body.data.accessToken;

        // Create test geographic area
        const geoArea = await prisma.geographicArea.create({
            data: {
                name: 'Test Area for Notes',
                areaType: 'CITY',
            },
        });
        geographicAreaId = geoArea.id;

        // Create test venue
        const venue = await prisma.venue.create({
            data: {
                name: 'Test Venue for Notes',
                address: '123 Test St',
                geographicAreaId,
            },
        });
        venueId = venue.id;

        // Get activity type
        const activityType = await prisma.activityType.findFirst();
        activityTypeId = activityType!.id;
    });

    afterAll(async () => {
        // Cleanup
        if (activityId) {
            await prisma.activityVenueHistory.deleteMany({ where: { activityId } });
            await prisma.activity.deleteMany({ where: { id: activityId } });
        }
        await prisma.venue.deleteMany({ where: { id: venueId } });
        await prisma.geographicArea.deleteMany({ where: { id: geographicAreaId } });
        await prisma.$disconnect();
    });

    describe('POST /api/v1/activities with notes', () => {
        it('should create activity with notes', async () => {
            const response = await request(app)
                .post('/api/v1/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Activity with Notes',
                    activityTypeId,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 86400000).toISOString(),
                    status: 'PLANNED',
                    notes: 'This is a test note for the activity.',
                    venueIds: [venueId],
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.notes).toBe('This is a test note for the activity.');
            activityId = response.body.data.id;
        });

        it('should create activity without notes (null)', async () => {
            const response = await request(app)
                .post('/api/v1/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Activity without Notes',
                    activityTypeId,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 86400000).toISOString(),
                    status: 'PLANNED',
                    venueIds: [venueId],
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.notes).toBeNull();

            // Cleanup
            await prisma.activityVenueHistory.deleteMany({ where: { activityId: response.body.data.id } });
            await prisma.activity.deleteMany({ where: { id: response.body.data.id } });
        });

        it('should reject notes exceeding 2000 characters', async () => {
            const longNotes = 'a'.repeat(2001);
            const response = await request(app)
                .post('/api/v1/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Activity with Long Notes',
                    activityTypeId,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 86400000).toISOString(),
                    status: 'PLANNED',
                    notes: longNotes,
                    venueIds: [venueId],
                });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/v1/activities/:id with notes', () => {
        it('should return activity with notes', async () => {
            const response = await request(app)
                .get(`/api/v1/activities/${activityId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.notes).toBe('This is a test note for the activity.');
        });
    });

    describe('PUT /api/v1/activities/:id with notes', () => {
        it('should update activity notes', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    notes: 'Updated notes for the activity.',
                    version: 1,
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.notes).toBe('Updated notes for the activity.');
        });

        it('should clear activity notes by setting to null', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    notes: null,
                    version: 2,
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.notes).toBeNull();
        });

        it('should reject notes exceeding 2000 characters on update', async () => {
            const longNotes = 'b'.repeat(2001);
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    notes: longNotes,
                    version: 3,
                });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/v1/activities with notes', () => {
        it('should include notes in activity list', async () => {
            // Get current activity to check version
            const currentActivity = await prisma.activity.findUnique({
                where: { id: activityId },
            });

            // Set notes back to a value
            await request(app)
                .put(`/api/v1/activities/${activityId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    notes: 'Notes for list test',
                    version: currentActivity!.version,
                });

            const response = await request(app)
                .get('/api/v1/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const activityWithNotes = response.body.data.find((a: any) => a.id === activityId);
            expect(activityWithNotes).toBeDefined();
            expect(activityWithNotes.notes).toBe('Notes for list test');
        });
    });
});
