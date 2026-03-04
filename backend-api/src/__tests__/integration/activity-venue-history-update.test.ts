import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Activity Venue History Update Integration Tests', () => {
    let editorToken: string;
    let activityId: string;
    let venueId1: string;
    let venueId2: string;
    let venueHistoryId: string;
    let geographicAreaId: string;
    let activityTypeId: string;
    const testSuffix = Date.now();

    beforeAll(async () => {
        // Login as admin to get token
        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: process.env.SRP_ROOT_ADMIN_EMAIL,
                password: process.env.SRP_ROOT_ADMIN_PASSWORD,
            });

        editorToken = loginResponse.body.data.accessToken;

        // Create geographic area
        geographicAreaId = (await prisma.geographicArea.create({
            data: {
                name: `Test Area for Venue History ${testSuffix}`,
                areaType: 'CITY',
            },
        })).id;

        // Get predefined activity type
        const activityType = await prisma.activityType.findFirst({
            where: { isPredefined: true },
        });
        if (!activityType) {
            throw new Error('No predefined activity types found. Run prisma db seed first.');
        }
        activityTypeId = activityType.id;

        // Create venues
        venueId1 = (await prisma.venue.create({
            data: {
                name: `Venue 1 ${testSuffix}`,
                address: '123 Test St',
                geographicAreaId,
            },
        })).id;

        venueId2 = (await prisma.venue.create({
            data: {
                name: `Venue 2 ${testSuffix}`,
                address: '456 Test Ave',
                geographicAreaId,
            },
        })).id;

        // Create activity
        activityId = (await prisma.activity.create({
            data: {
                name: `Test Activity for Venue History ${testSuffix}`,
                activityTypeId,
                startDate: new Date('2025-01-01'),
                status: 'PLANNED',
            },
        })).id;

        // Create initial venue association
        venueHistoryId = (await prisma.activityVenueHistory.create({
            data: {
                activityId,
                venueId: venueId1,
                effectiveFrom: new Date('2025-01-01'),
            },
        })).id;
    });

    afterAll(async () => {
        // Cleanup
        await prisma.activityVenueHistory.deleteMany({
            where: { activityId },
        });
        await prisma.activity.deleteMany({
            where: { id: activityId },
        });
        await prisma.venue.deleteMany({
            where: { id: { in: [venueId1, venueId2] } },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: geographicAreaId },
        });
        await prisma.$disconnect();
    });

    describe('PUT /api/v1/activities/:id/venues/:venueHistoryId', () => {
        it('should update venue association with new venue', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({ venueId: venueId2 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.venueId).toBe(venueId2);
            expect(response.body.data.activityId).toBe(activityId);

            // Reset for next test
            await prisma.activityVenueHistory.update({
                where: { id: venueHistoryId },
                data: { venueId: venueId1 },
            });
        });

        it('should update venue association with new effectiveFrom date', async () => {
            const newDate = '2025-02-01T00:00:00.000Z';
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({ effectiveFrom: newDate });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(new Date(response.body.data.effectiveFrom).toISOString()).toBe(newDate);

            // Reset for next test
            await prisma.activityVenueHistory.update({
                where: { id: venueHistoryId },
                data: { effectiveFrom: new Date('2025-01-01') },
            });
        });

        it('should update venue association with both venue and effectiveFrom', async () => {
            const newDate = '2025-03-01T00:00:00.000Z';
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({
                    venueId: venueId1,
                    effectiveFrom: newDate,
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.venueId).toBe(venueId1);
            expect(new Date(response.body.data.effectiveFrom).toISOString()).toBe(newDate);

            // Reset for next test
            await prisma.activityVenueHistory.update({
                where: { id: venueHistoryId },
                data: { effectiveFrom: new Date('2025-01-01') },
            });
        });

        it('should return 404 when venue history record does not exist', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/00000000-0000-0000-0000-000000000000`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({ venueId: venueId2 });

            expect(response.status).toBe(404);
            expect(response.body.code).toBe('NOT_FOUND');
        });

        it('should return 404 when venue does not exist', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({ venueId: '00000000-0000-0000-0000-000000000000' });

            expect(response.status).toBe(404);
            expect(response.body.code).toBe('NOT_FOUND');
        });

        it('should return 400 when creating duplicate effectiveFrom date', async () => {
            // Create another venue association
            const secondVenueHistory = await prisma.activityVenueHistory.create({
                data: {
                    activityId,
                    venueId: venueId2,
                    effectiveFrom: new Date('2025-04-01'),
                },
            });

            // Try to update first record to have same date as second
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({ effectiveFrom: '2025-04-01T00:00:00.000Z' });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('DUPLICATE_ASSOCIATION');

            // Cleanup
            await prisma.activityVenueHistory.delete({
                where: { id: secondVenueHistory.id },
            });
        });

        it('should return 400 when no fields are provided', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .set('Authorization', `Bearer ${editorToken}`)
                .send({});

            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .put(`/api/v1/activities/${activityId}/venues/${venueHistoryId}`)
                .send({ venueId: venueId2 });

            expect(response.status).toBe(401);
        });
    });
});
