/**
 * Integration tests for flexible server-side filtering with customizable attribute selection
 */

import { PrismaClient } from '@prisma/client';
import { ParticipantService } from '../../services/participant.service';
import { VenueService } from '../../services/venue.service';
import { ActivityService } from '../../services/activity.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';

const prisma = new PrismaClient();

describe('Flexible Filtering Integration Tests', () => {
    let participantService: ParticipantService;
    let venueService: VenueService;
    let activityService: ActivityService;
    let geographicAreaRepository: GeographicAreaRepository;
    let testAreaId: string;
    let testVenueId: string;
    let testParticipant1Id: string;
    let testParticipant2Id: string;
    let testActivityId: string;
    let testActivityTypeId: string;

    beforeAll(async () => {
        // Initialize repositories and services
        const participantRepository = new ParticipantRepository(prisma);
        const venueRepository = new VenueRepository(prisma);
        const activityRepository = new ActivityRepository(prisma);
        const activityTypeRepository = new ActivityTypeRepository(prisma);
        const activityVenueHistoryRepository = new ActivityVenueHistoryRepository(prisma);
        const addressHistoryRepository = new ParticipantAddressHistoryRepository(prisma);
        const assignmentRepository = new AssignmentRepository(prisma);
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
        const userRepository = new UserRepository(prisma);
        const auditLogRepository = new AuditLogRepository(prisma);
        const geoAuthService = new GeographicAuthorizationService(
            userGeoAuthRepository,
            geographicAreaRepository,
            userRepository,
            auditLogRepository
        );

        participantService = new ParticipantService(
            participantRepository,
            addressHistoryRepository,
            assignmentRepository,
            prisma,
            geoAuthService
        );

        venueService = new VenueService(venueRepository, geographicAreaRepository, geoAuthService, prisma);
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
                name: 'Test City for Flexible Filtering',
                areaType: 'CITY',
            },
        });
        testAreaId = area.id;

        const venue = await prisma.venue.create({
            data: {
                name: 'Test Venue for Flexible Filtering',
                address: '123 Test St',
                geographicAreaId: testAreaId,
            },
        });
        testVenueId = venue.id;

        // Create participants with different attributes
        const participant1 = await prisma.participant.create({
            data: {
                name: 'John Doe',
                email: 'john@gmail.com',
                phone: '555-1234',
                nickname: 'Johnny',
            },
        });
        testParticipant1Id = participant1.id;

        const participant2 = await prisma.participant.create({
            data: {
                name: 'Jane Smith',
                email: 'jane@yahoo.com',
                phone: '555-5678',
            },
        });
        testParticipant2Id = participant2.id;

        // Create address history
        await prisma.participantAddressHistory.create({
            data: {
                participantId: testParticipant1Id,
                venueId: testVenueId,
                effectiveFrom: null,
            },
        });

        await prisma.participantAddressHistory.create({
            data: {
                participantId: testParticipant2Id,
                venueId: testVenueId,
                effectiveFrom: null,
            },
        });

        // Get a predefined activity type
        const activityType = await prisma.activityType.findFirst();
        testActivityTypeId = activityType!.id;

        // Create activity
        const activity = await prisma.activity.create({
            data: {
                name: 'Study Circle Meeting',
                activityTypeId: testActivityTypeId,
                startDate: new Date(),
                status: 'ACTIVE',
            },
        });
        testActivityId = activity.id;

        // Create activity venue history
        await prisma.activityVenueHistory.create({
            data: {
                activityId: testActivityId,
                venueId: testVenueId,
                effectiveFrom: null,
            },
        });
    });

    afterAll(async () => {
        // Clean up test data
        if (testActivityId) {
            await prisma.activityVenueHistory.deleteMany({ where: { activityId: testActivityId } });
            await prisma.activity.delete({ where: { id: testActivityId } });
        }
        if (testParticipant1Id) {
            await prisma.participantAddressHistory.deleteMany({ where: { participantId: testParticipant1Id } });
            await prisma.participant.delete({ where: { id: testParticipant1Id } });
        }
        if (testParticipant2Id) {
            await prisma.participantAddressHistory.deleteMany({ where: { participantId: testParticipant2Id } });
            await prisma.participant.delete({ where: { id: testParticipant2Id } });
        }
        if (testVenueId) {
            await prisma.venue.delete({ where: { id: testVenueId } });
        }
        if (testAreaId) {
            await prisma.geographicArea.delete({ where: { id: testAreaId } });
        }
        await prisma.$disconnect();
    });

    describe('Participant Flexible Filtering', () => {
        it('should filter participants by email with partial matching', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 100,
                filter: { email: 'gmail' },
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.every(p => p.email?.toLowerCase().includes('gmail'))).toBe(true);
        });

        it('should return only requested fields', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 100,
                fields: ['id', 'name', 'email'],
            });

            expect(result.data.length).toBeGreaterThan(0);
            const firstParticipant = result.data[0] as any;
            expect(firstParticipant).toHaveProperty('id');
            expect(firstParticipant).toHaveProperty('name');
            expect(firstParticipant).toHaveProperty('email');
            // Should not have other fields like phone, notes, etc.
            expect(firstParticipant).not.toHaveProperty('phone');
        });

        it('should combine multiple filters with AND logic', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 100,
                filter: {
                    name: 'John',
                    email: 'gmail',
                },
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.every(p =>
                p.name.toLowerCase().includes('john') &&
                p.email?.toLowerCase().includes('gmail')
            )).toBe(true);
        });

        it('should work with filter parameter for name search', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 100,
                filter: { name: 'John' },
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.some(p => p.name.includes('John'))).toBe(true);
        });
    });

    describe('Venue Flexible Filtering', () => {
        it('should filter venues by name with partial matching', async () => {
            const result = await venueService.getVenuesFlexible({
                page: 1,
                limit: 100,
                filter: { name: 'Test' },
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.every(v => v.name.toLowerCase().includes('test'))).toBe(true);
        });

        it('should return only requested fields for venues', async () => {
            const result = await venueService.getVenuesFlexible({
                page: 1,
                limit: 100,
                fields: ['id', 'name', 'address'],
            });

            expect(result.data.length).toBeGreaterThan(0);
            const firstVenue = result.data[0] as any;
            expect(firstVenue).toHaveProperty('id');
            expect(firstVenue).toHaveProperty('name');
            expect(firstVenue).toHaveProperty('address');
            // Should not have geographicArea relation
            expect(firstVenue).not.toHaveProperty('geographicArea');
        });
    });

    describe('Activity Flexible Filtering', () => {
        it('should filter activities by name with partial matching', async () => {
            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                filter: { name: 'Study' },
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.every(a => a.name.toLowerCase().includes('study'))).toBe(true);
        });

        it('should return only requested fields for activities', async () => {
            const result = await activityService.getActivitiesFlexible({
                page: 1,
                limit: 100,
                fields: ['id', 'name', 'status'],
            });

            expect(result.data.length).toBeGreaterThan(0);
            const firstActivity = result.data[0] as any;
            expect(firstActivity).toHaveProperty('id');
            expect(firstActivity).toHaveProperty('name');
            expect(firstActivity).toHaveProperty('status');
            // Should not have activityType relation
            expect(firstActivity).not.toHaveProperty('activityType');
        });
    });

    describe('Backward Compatibility', () => {
        it('should work with flexible query method', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 100,
                geographicAreaId: testAreaId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false
            });

            expect(result.data).toBeDefined();
            expect(result.pagination).toBeDefined();
        });

        it('should work with flexible venue query method', async () => {
            const result = await venueService.getVenuesFlexible({
                page: 1,
                limit: 100,
                geographicAreaId: testAreaId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false
            });

            expect(result.data).toBeDefined();
            expect(result.pagination).toBeDefined();
        });
    });
});
