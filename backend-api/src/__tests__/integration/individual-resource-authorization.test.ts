import { PrismaClient, AuthorizationRuleType, UserRole } from '@prisma/client';
import { ParticipantService } from '../../services/participant.service';
import { ActivityService } from '../../services/activity.service';
import { VenueService } from '../../services/venue.service';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAuthorizationService, AccessLevel } from '../../services/geographic-authorization.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ActivityRepository } from '../../repositories/activity.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { getPrismaClient } from '../../utils/prisma.client';

/**
 * Tests for individual resource access authorization (GET by ID, PUT, DELETE)
 * Ensures that geographic authorization is properly enforced on direct resource access
 */
describe('Individual Resource Access Authorization', () => {
    let prisma: PrismaClient;
    let participantService: ParticipantService;
    let activityService: ActivityService;
    let venueService: VenueService;
    let geographicAreaService: GeographicAreaService;
    let geoAuthService: GeographicAuthorizationService;

    let restrictedUserId: string;
    let adminUserId: string;
    let allowedAreaId: string;
    let deniedAreaId: string;
    let allowedVenueId: string;
    let deniedVenueId: string;
    let allowedParticipantId: string;
    let deniedParticipantId: string;
    let allowedActivityId: string;
    let deniedActivityId: string;
    let activityTypeId: string;
    let categoryId: string;

    beforeAll(async () => {
        prisma = getPrismaClient();

        // Initialize repositories
        const participantRepo = new ParticipantRepository(prisma);
        const activityRepo = new ActivityRepository(prisma);
        const venueRepo = new VenueRepository(prisma);
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const userGeoAuthRepo = new UserGeographicAuthorizationRepository(prisma);
        const userRepo = new UserRepository(prisma);
        const addressHistoryRepo = new ParticipantAddressHistoryRepository(prisma);
        const venueHistoryRepo = new ActivityVenueHistoryRepository(prisma);
        const activityTypeRepo = new ActivityTypeRepository(prisma);
        const assignmentRepo = new AssignmentRepository(prisma);
        const auditLogRepo = new AuditLogRepository(prisma);

        // Initialize services
        geoAuthService = new GeographicAuthorizationService(userGeoAuthRepo, geoAreaRepo, userRepo, auditLogRepo);
        participantService = new ParticipantService(participantRepo, addressHistoryRepo, assignmentRepo, prisma, geoAreaRepo, geoAuthService);
        activityService = new ActivityService(activityRepo, activityTypeRepo, venueHistoryRepo, venueRepo, prisma, geoAreaRepo, geoAuthService);
        venueService = new VenueService(venueRepo, geoAreaRepo, geoAuthService);
        geographicAreaService = new GeographicAreaService(geoAreaRepo, prisma, geoAuthService);

        // Create test users
        const restrictedUser = await prisma.user.create({
            data: { email: `restricted-${Date.now()}@example.com`, passwordHash: 'hash', role: UserRole.EDITOR },
        });
        restrictedUserId = restrictedUser.id;

        const adminUser = await prisma.user.create({
            data: { email: `admin-${Date.now()}@example.com`, passwordHash: 'hash', role: UserRole.ADMINISTRATOR },
        });
        adminUserId = adminUser.id;

        // Create geographic areas
        const allowedArea = await prisma.geographicArea.create({
            data: { name: 'Allowed Area', areaType: 'CITY' },
        });
        allowedAreaId = allowedArea.id;

        const deniedArea = await prisma.geographicArea.create({
            data: { name: 'Denied Area', areaType: 'CITY' },
        });
        deniedAreaId = deniedArea.id;

        // Create authorization rules
        await prisma.userGeographicAuthorization.create({
            data: {
                userId: restrictedUserId,
                geographicAreaId: allowedAreaId,
                ruleType: AuthorizationRuleType.ALLOW,
                createdBy: adminUserId,
            },
        });

        // Create venues
        const allowedVenue = await prisma.venue.create({
            data: { name: 'Allowed Venue', address: '123 Allowed St', geographicAreaId: allowedAreaId },
        });
        allowedVenueId = allowedVenue.id;

        const deniedVenue = await prisma.venue.create({
            data: { name: 'Denied Venue', address: '456 Denied St', geographicAreaId: deniedAreaId },
        });
        deniedVenueId = deniedVenue.id;

        // Create participants
        const allowedParticipant = await prisma.participant.create({
            data: { name: 'Allowed Participant' },
        });
        allowedParticipantId = allowedParticipant.id;

        await prisma.participantAddressHistory.create({
            data: { participantId: allowedParticipantId, venueId: allowedVenueId, effectiveFrom: null },
        });

        const deniedParticipant = await prisma.participant.create({
            data: { name: 'Denied Participant' },
        });
        deniedParticipantId = deniedParticipant.id;

        await prisma.participantAddressHistory.create({
            data: { participantId: deniedParticipantId, venueId: deniedVenueId, effectiveFrom: null },
        });

        // Create activity type and category
        const category = await prisma.activityCategory.create({
            data: { name: `Test Category ${Date.now()}`, isPredefined: false },
        });
        categoryId = category.id;

        const activityType = await prisma.activityType.create({
            data: { name: `Test Type ${Date.now()}`, activityCategoryId: category.id, isPredefined: false },
        });
        activityTypeId = activityType.id;

        // Create activities
        const allowedActivity = await prisma.activity.create({
            data: { name: 'Allowed Activity', activityTypeId: activityType.id, startDate: new Date(), status: 'PLANNED' },
        });
        allowedActivityId = allowedActivity.id;

        await prisma.activityVenueHistory.create({
            data: { activityId: allowedActivityId, venueId: allowedVenueId, effectiveFrom: null },
        });

        const deniedActivity = await prisma.activity.create({
            data: { name: 'Denied Activity', activityTypeId: activityType.id, startDate: new Date(), status: 'PLANNED' },
        });
        deniedActivityId = deniedActivity.id;

        await prisma.activityVenueHistory.create({
            data: { activityId: deniedActivityId, venueId: deniedVenueId, effectiveFrom: null },
        });
    });

    afterAll(async () => {
        // Cleanup in reverse order of dependencies (with safety checks)
        if (allowedActivityId && deniedActivityId) {
            await prisma.activityVenueHistory.deleteMany({ where: { activityId: { in: [allowedActivityId, deniedActivityId] } } });
            await prisma.activity.deleteMany({ where: { id: { in: [allowedActivityId, deniedActivityId] } } });
        }
        if (activityTypeId) {
            await prisma.activityType.delete({ where: { id: activityTypeId } });
        }
        if (categoryId) {
            await prisma.activityCategory.delete({ where: { id: categoryId } });
        }
        if (allowedParticipantId && deniedParticipantId) {
            await prisma.participantAddressHistory.deleteMany({ where: { participantId: { in: [allowedParticipantId, deniedParticipantId] } } });
            await prisma.participant.deleteMany({ where: { id: { in: [allowedParticipantId, deniedParticipantId] } } });
        }
        if (allowedVenueId && deniedVenueId) {
            await prisma.venue.deleteMany({ where: { id: { in: [allowedVenueId, deniedVenueId] } } });
        }
        if (restrictedUserId) {
            await prisma.userGeographicAuthorization.deleteMany({ where: { userId: restrictedUserId } });
            await prisma.auditLog.deleteMany({ where: { userId: restrictedUserId } });
        }
        if (adminUserId) {
            await prisma.auditLog.deleteMany({ where: { userId: adminUserId } });
        }
        if (allowedAreaId && deniedAreaId) {
            await prisma.geographicArea.deleteMany({ where: { id: { in: [allowedAreaId, deniedAreaId] } } });
        }
        if (restrictedUserId && adminUserId) {
            await prisma.user.deleteMany({ where: { id: { in: [restrictedUserId, adminUserId] } } });
        }
        await prisma.$disconnect();
    });

    describe('Participant Access Authorization', () => {
        it('should allow access to participant in authorized area', async () => {
            const participant = await participantService.getParticipantById(allowedParticipantId, restrictedUserId, 'EDITOR');
            expect(participant).toBeDefined();
            expect(participant.id).toBe(allowedParticipantId);
        });

        it('should deny access to participant in unauthorized area', async () => {
            await expect(
                participantService.getParticipantById(deniedParticipantId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });

        it('should allow administrator to access any participant', async () => {
            const participant = await participantService.getParticipantById(deniedParticipantId, adminUserId, 'ADMINISTRATOR');
            expect(participant).toBeDefined();
            expect(participant.id).toBe(deniedParticipantId);
        });

        it('should allow access to participant without address history', async () => {
            const noAddressParticipant = await prisma.participant.create({
                data: { name: 'No Address Participant' },
            });

            const participant = await participantService.getParticipantById(noAddressParticipant.id, restrictedUserId, 'EDITOR');
            expect(participant).toBeDefined();

            await prisma.participant.delete({ where: { id: noAddressParticipant.id } });
        });
    });

    describe('Activity Access Authorization', () => {
        it('should allow access to activity in authorized area', async () => {
            const activity = await activityService.getActivityById(allowedActivityId, restrictedUserId, 'EDITOR');
            expect(activity).toBeDefined();
            expect(activity.id).toBe(allowedActivityId);
        });

        it('should deny access to activity in unauthorized area', async () => {
            await expect(
                activityService.getActivityById(deniedActivityId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });

        it('should allow administrator to access any activity', async () => {
            const activity = await activityService.getActivityById(deniedActivityId, adminUserId, 'ADMINISTRATOR');
            expect(activity).toBeDefined();
            expect(activity.id).toBe(deniedActivityId);
        });

        it('should allow access to activity without venue history', async () => {
            const activityType = await prisma.activityType.findFirst();

            const noVenueActivity = await prisma.activity.create({
                data: {
                    name: 'No Venue Activity',
                    activityTypeId: activityType!.id,
                    startDate: new Date(),
                    status: 'PLANNED',
                },
            });

            const activity = await activityService.getActivityById(noVenueActivity.id, restrictedUserId, 'EDITOR');
            expect(activity).toBeDefined();

            await prisma.activity.delete({ where: { id: noVenueActivity.id } });
        });
    });

    describe('Venue Access Authorization', () => {
        it('should allow access to venue in authorized area', async () => {
            const venue = await venueService.getVenueById(allowedVenueId, restrictedUserId, 'EDITOR');
            expect(venue).toBeDefined();
            expect(venue.id).toBe(allowedVenueId);
        });

        it('should deny access to venue in unauthorized area', async () => {
            await expect(
                venueService.getVenueById(deniedVenueId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });

        it('should allow administrator to access any venue', async () => {
            const venue = await venueService.getVenueById(deniedVenueId, adminUserId, 'ADMINISTRATOR');
            expect(venue).toBeDefined();
            expect(venue.id).toBe(deniedVenueId);
        });
    });

    describe('Geographic Area Access Authorization', () => {
        it('should allow access to authorized geographic area', async () => {
            const area = await geographicAreaService.getGeographicAreaById(allowedAreaId, restrictedUserId, 'EDITOR');
            expect(area).toBeDefined();
            expect(area.id).toBe(allowedAreaId);
        });

        it('should deny access to unauthorized geographic area', async () => {
            await expect(
                geographicAreaService.getGeographicAreaById(deniedAreaId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });

        it('should allow administrator to access any geographic area', async () => {
            const area = await geographicAreaService.getGeographicAreaById(deniedAreaId, adminUserId, 'ADMINISTRATOR');
            expect(area).toBeDefined();
            expect(area.id).toBe(deniedAreaId);
        });

        it('should allow READ_ONLY access to ancestor areas', async () => {
            // Create child area under allowed area
            const childArea = await prisma.geographicArea.create({
                data: { name: 'Child Area', areaType: 'NEIGHBOURHOOD', parentGeographicAreaId: allowedAreaId },
            });

            // ALLOW child area (note: allowedAreaId already has ALLOW rule from setup)
            await prisma.userGeographicAuthorization.create({
                data: {
                    userId: restrictedUserId,
                    geographicAreaId: childArea.id,
                    ruleType: AuthorizationRuleType.ALLOW,
                    createdBy: adminUserId,
                },
            });

            // allowedAreaId should have FULL access (from its own ALLOW rule, not just ancestor access)
            const accessLevel = await geoAuthService.evaluateAccess(restrictedUserId, allowedAreaId);
            expect(accessLevel).toBe(AccessLevel.FULL);

            // Should be able to GET the parent area
            const area = await geographicAreaService.getGeographicAreaById(allowedAreaId, restrictedUserId, 'EDITOR');
            expect(area).toBeDefined();

            // Cleanup
            await prisma.userGeographicAuthorization.deleteMany({ where: { geographicAreaId: childArea.id } });
            await prisma.geographicArea.delete({ where: { id: childArea.id } });
        });
    });

    describe('Update Authorization', () => {
        it('should allow updating participant in authorized area', async () => {
            const updated = await participantService.updateParticipant(
                allowedParticipantId,
                { name: 'Updated Name' },
                restrictedUserId,
                'EDITOR'
            );
            expect(updated.name).toBe('Updated Name');
        });

        it('should deny updating participant in unauthorized area', async () => {
            await expect(
                participantService.updateParticipant(deniedParticipantId, { name: 'Updated' }, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });
    });

    describe('Delete Authorization', () => {
        it('should allow deleting participant in authorized area', async () => {
            // Create temporary participant
            const tempParticipant = await prisma.participant.create({
                data: { name: 'Temp Participant' },
            });
            await prisma.participantAddressHistory.create({
                data: { participantId: tempParticipant.id, venueId: allowedVenueId, effectiveFrom: null },
            });

            await expect(
                participantService.deleteParticipant(tempParticipant.id, restrictedUserId, 'EDITOR')
            ).resolves.not.toThrow();
        });

        it('should deny deleting participant in unauthorized area', async () => {
            await expect(
                participantService.deleteParticipant(deniedParticipantId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });
    });

    describe('Nested Resource Authorization', () => {
        it('should allow accessing nested resources when parent is authorized', async () => {
            const activities = await participantService.getParticipantActivities(allowedParticipantId, restrictedUserId, 'EDITOR');
            expect(activities).toBeDefined();
        });

        it('should deny accessing nested resources when parent is unauthorized', async () => {
            await expect(
                participantService.getParticipantActivities(deniedParticipantId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });

        it('should allow accessing venue activities when venue is authorized', async () => {
            const activities = await venueService.getVenueActivities(allowedVenueId, restrictedUserId, 'EDITOR');
            expect(activities).toBeDefined();
        });

        it('should deny accessing venue activities when venue is unauthorized', async () => {
            await expect(
                venueService.getVenueActivities(deniedVenueId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');
        });
    });

    describe('Audit Logging for Authorization Denials', () => {
        it('should log authorization denial when access is denied', async () => {
            // Clear existing audit logs
            await prisma.auditLog.deleteMany({ where: { userId: restrictedUserId } });

            // Attempt to access denied participant
            await expect(
                participantService.getParticipantById(deniedParticipantId, restrictedUserId, 'EDITOR')
            ).rejects.toThrow('do not have permission');

            // Check audit log
            const auditLogs = await prisma.auditLog.findMany({
                where: { userId: restrictedUserId, actionType: 'AUTHORIZATION_DENIED' },
            });

            expect(auditLogs.length).toBeGreaterThan(0);
            const log = auditLogs[0];
            expect(log.entityType).toBe('PARTICIPANT');
            expect(log.entityId).toBe(deniedParticipantId);
            expect(log.details).toMatchObject({ action: 'GET', reason: 'GEOGRAPHIC_AUTHORIZATION_DENIED' });
        });
    });
});
