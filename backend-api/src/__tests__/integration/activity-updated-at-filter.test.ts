/**
 * Integration tests for Activity updatedAt timestamp filtering
 */

import { PrismaClient } from '@prisma/client';
import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';

const prisma = new PrismaClient();

describe('Activity updatedAt Filter Integration Tests', () => {
    let activityService: ActivityService;
    let testAreaId: string;
    let testVenueId: string;
    let testActivityTypeId: string;
    let oldActivityId: string;
    let recentActivityId: string;
    let middleActivityId: string;

    beforeAll(async () => {
        // Initialize repositories and services
        const activityRepository = new ActivityRepository(prisma);
        const activityTypeRepository = new ActivityTypeRepository(prisma);
        const activityVenueHistoryRepository = new ActivityVenueHistoryRepository(prisma);
        const venueRepository = new VenueRepository(prisma);
        const geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
        const userRepository = new UserRepository(prisma);
        const auditLogRepository = new AuditLogRepository(prisma);
        const geoAuthService = new GeographicAuthorizationService(
            userGeoAuthRepository,
            geographicAreaRepository,
            userRepository,
            auditLogRepository
        );

        activityService = new ActivityService(
            activityRepository,
            activityTypeRepository,
            activityVenueHistoryRepository,
            venueRepository,
            prisma,
            geoAuthService
        );

        // Create test data
        const area = await prisma.geographicArea.create({
            data: {
                name: 'Test City for UpdatedAt Filter',
                areaType: 'CITY',
            },
        });
        testAreaId = area.id;

        const venue = await prisma.venue.create({
            data: {
                name: 'Test Venue for UpdatedAt Filter',
                address: '123 Test St',
                geographicAreaId: testAreaId,
            },
        });
        testVenueId = venue.id;

        // Get a predefined activity type
        const activityType = await prisma.activityType.findFirst({
            where: { isPredefined: true },
        });
        if (!activityType) {
            throw new Error('No predefined activity type found');
        }
        testActivityTypeId = activityType.id;

        // Create activities with different updatedAt timestamps
        // We'll manually set updatedAt to specific dates for testing

        // Old activity (updated 60 days ago)
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 60);
        const oldActivity = await prisma.activity.create({
            data: {
                name: 'Old Activity',
                activityTypeId: testActivityTypeId,
                startDate: new Date('2025-01-01'),
                status: 'PLANNED',
                updatedAt: oldDate,
            },
        });
        oldActivityId = oldActivity.id;

        // Middle activity (updated 30 days ago)
        const middleDate = new Date();
        middleDate.setDate(middleDate.getDate() - 30);
        const middleActivity = await prisma.activity.create({
            data: {
                name: 'Middle Activity',
                activityTypeId: testActivityTypeId,
                startDate: new Date('2025-01-15'),
                status: 'ACTIVE',
                updatedAt: middleDate,
            },
        });
        middleActivityId = middleActivity.id;

        // Recent activity (updated 5 days ago)
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 5);
        const recentActivity = await prisma.activity.create({
            data: {
                name: 'Recent Activity',
                activityTypeId: testActivityTypeId,
                startDate: new Date('2025-02-01'),
                status: 'COMPLETED',
                updatedAt: recentDate,
            },
        });
        recentActivityId = recentActivity.id;

        // Create venue history for all activities
        await prisma.activityVenueHistory.create({
            data: {
                activityId: oldActivityId,
                venueId: testVenueId,
                effectiveFrom: null,
            },
        });

        await prisma.activityVenueHistory.create({
            data: {
                activityId: middleActivityId,
                venueId: testVenueId,
                effectiveFrom: null,
            },
        });

        await prisma.activityVenueHistory.create({
            data: {
                activityId: recentActivityId,
                venueId: testVenueId,
                effectiveFrom: null,
            },
        });
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.activityVenueHistory.deleteMany({
            where: {
                activityId: { in: [oldActivityId, middleActivityId, recentActivityId] },
            },
        });

        await prisma.activity.deleteMany({
            where: {
                id: { in: [oldActivityId, middleActivityId, recentActivityId] },
            },
        });

        await prisma.venue.deleteMany({
            where: { id: testVenueId },
        });

        await prisma.geographicArea.deleteMany({
            where: { id: testAreaId },
        });

        await prisma.$disconnect();
    });

    describe('updatedAt Filter - On-or-After (gte)', () => {
        it('should return activities updated on or after the specified date', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 40); // 40 days ago

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { gte: cutoffDate.toISOString() } },
            });

            // Should return middle (30 days ago) and recent (5 days ago) activities
            expect(result.data.length).toBe(2);
            const activityIds = result.data.map(a => a.id);
            expect(activityIds).toContain(middleActivityId);
            expect(activityIds).toContain(recentActivityId);
            expect(activityIds).not.toContain(oldActivityId);
        });
    });

    describe('updatedAt Filter - On-or-Before (lte)', () => {
        it('should return activities updated on or before the specified date', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 40); // 40 days ago

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { lte: cutoffDate.toISOString() } },
            });

            // Should return only old activity (60 days ago)
            expect(result.data.length).toBe(1);
            expect(result.data[0].id).toBe(oldActivityId);
        });
    });

    describe('updatedAt Filter - Strictly After (gt)', () => {
        it('should return activities updated strictly after the specified date', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 29); // 29 days ago (between middle and recent)

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { gt: cutoffDate.toISOString() } },
            });

            // Should return only recent activity (5 days ago), not middle (30 days) or old (60 days)
            expect(result.data.length).toBe(1);
            expect(result.data[0].id).toBe(recentActivityId);
        });
    });

    describe('updatedAt Filter - Strictly Before (lt)', () => {
        it('should return activities updated strictly before the specified date', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 29); // 29 days ago (between middle and recent)

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { lt: cutoffDate.toISOString() } },
            });

            // Should return old (60 days) and middle (30 days), not recent (5 days)
            expect(result.data.length).toBe(2);
            const activityIds = result.data.map(a => a.id);
            expect(activityIds).toContain(oldActivityId);
            expect(activityIds).toContain(middleActivityId);
            expect(activityIds).not.toContain(recentActivityId);
        });
    });

    describe('updatedAt Filter - Between (gte + lte)', () => {
        it('should return activities updated within the specified date range', async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 50); // 50 days ago

            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 20); // 20 days ago

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: {
                    updatedAt: {
                        gte: startDate.toISOString(),
                        lte: endDate.toISOString(),
                    },
                },
            });

            // Should return only middle activity (30 days ago)
            expect(result.data.length).toBe(1);
            expect(result.data[0].id).toBe(middleActivityId);
        });
    });

    describe('updatedAt Filter - Default Ordering', () => {
        it('should order activities by updatedAt descending when updatedAt filter is active', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 70); // 70 days ago (includes all)

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { gte: cutoffDate.toISOString() } },
            });

            // Should return all 3 activities ordered by updatedAt descending
            expect(result.data.length).toBe(3);
            // Most recent first
            expect(result.data[0].id).toBe(recentActivityId);
            expect(result.data[1].id).toBe(middleActivityId);
            expect(result.data[2].id).toBe(oldActivityId);
        });
    });

    describe('updatedAt Filter - Combined with Other Filters', () => {
        it('should combine updatedAt filter with status filter using AND logic', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 40); // 40 days ago

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: {
                    updatedAt: { gte: cutoffDate.toISOString() },
                    status: ['ACTIVE'],
                },
            });

            // Should return only middle activity (ACTIVE and updated 30 days ago)
            expect(result.data.length).toBe(1);
            expect(result.data[0].id).toBe(middleActivityId);
            expect(result.data[0].status).toBe('ACTIVE');
        });

        it('should combine updatedAt filter with name filter using AND logic', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 40); // 40 days ago

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: {
                    updatedAt: { gte: cutoffDate.toISOString() },
                    name: 'Recent',
                },
            });

            // Should return only recent activity (name contains "Recent" and updated 5 days ago)
            expect(result.data.length).toBe(1);
            expect(result.data[0].id).toBe(recentActivityId);
            expect(result.data[0].name).toBe('Recent Activity');
        });
    });

    describe('updatedAt Filter - Date-Only Input', () => {
        it('should treat date-only input as start of day', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 40);
            const dateOnly = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { gte: dateOnly } },
            });

            // Should work the same as full datetime
            expect(result.data.length).toBe(2);
            const activityIds = result.data.map(a => a.id);
            expect(activityIds).toContain(middleActivityId);
            expect(activityIds).toContain(recentActivityId);
        });
    });

    describe('updatedAt Filter - Pagination', () => {
        it('should include updatedAt filter in total count calculation', async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 40); // 40 days ago

            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { updatedAt: { gte: cutoffDate.toISOString() } },
            });

            // Total should reflect filtered count
            expect(result.pagination.total).toBe(2);
            expect(result.data.length).toBe(2);
        });
    });
});
