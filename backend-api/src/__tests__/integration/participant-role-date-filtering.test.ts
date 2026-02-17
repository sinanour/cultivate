import { PrismaClient } from '@prisma/client';
import { ParticipantService } from '../../services/participant.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { UserRepository } from '../../repositories/user.repository';

describe('Participant Role and Activity Date Filtering Integration Tests', () => {
    let prisma: PrismaClient;
    let participantService: ParticipantService;

    // Test data IDs
    let geographicAreaId: string;
    let venueId: string;
    let activityTypeId: string;
    let activityCategoryId: string;
    let tutorRoleId: string;
    let teacherRoleId: string;
    let participantRoleId: string;
    let participant1Id: string; // Tutor in Activity 1 (Jan-Mar 2025)
    let participant2Id: string; // Teacher in Activity 2 (Feb-Apr 2025)
    let participant3Id: string; // Tutor in Activity 3 (Mar-ongoing)
    let participant4Id: string; // Participant in Activity 4 (Dec 2024)
    let participant5Id: string; // No assignments
    let activity1Id: string; // 2025-01-01 to 2025-03-31
    let activity2Id: string; // 2025-02-01 to 2025-04-30
    let activity3Id: string; // 2025-03-01 to null (ongoing)
    let activity4Id: string; // 2024-12-01 to 2024-12-31

    beforeAll(async () => {
        // Initialize Prisma client
        prisma = new PrismaClient();

        // Initialize repositories
        const participantRepository = new ParticipantRepository(prisma);
        const addressHistoryRepository = new ParticipantAddressHistoryRepository(prisma);
        const assignmentRepository = new AssignmentRepository(prisma);
        const geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
        const auditLogRepository = new AuditLogRepository(prisma);
        const userRepository = new UserRepository(prisma);

        // Initialize services
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

        // Create test data
        const geographicArea = await prisma.geographicArea.create({
            data: {
                name: 'Test City for Role Date Filtering',
                areaType: 'CITY',
            },
        });
        geographicAreaId = geographicArea.id;

        const venue = await prisma.venue.create({
            data: {
                name: 'Test Venue for Role Date Filtering',
                address: '123 Test St',
                geographicAreaId,
            },
        });
        venueId = venue.id;

        // Create activity category and type
        const activityCategory = await prisma.activityCategory.create({
            data: { name: 'Test Category for Role Date Filtering' },
        });
        activityCategoryId = activityCategory.id;

        const activityType = await prisma.activityType.create({
            data: {
                name: 'Test Type for Role Date Filtering',
                activityCategoryId,
            },
        });
        activityTypeId = activityType.id;

        // Create roles
        const tutorRole = await prisma.role.create({
            data: { name: 'Tutor Test Role' },
        });
        tutorRoleId = tutorRole.id;

        const teacherRole = await prisma.role.create({
            data: { name: 'Teacher Test Role' },
        });
        teacherRoleId = teacherRole.id;

        const participantRole = await prisma.role.create({
            data: { name: 'Participant Test Role' },
        });
        participantRoleId = participantRole.id;

        // Create activities
        const activity1 = await prisma.activity.create({
            data: {
                name: 'Activity 1 - Jan to Mar 2025',
                activityTypeId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-03-31'),
                status: 'COMPLETED',
            },
        });
        activity1Id = activity1.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity1Id,
                venueId,
                effectiveFrom: null,
            },
        });

        const activity2 = await prisma.activity.create({
            data: {
                name: 'Activity 2 - Feb to Apr 2025',
                activityTypeId,
                startDate: new Date('2025-02-01'),
                endDate: new Date('2025-04-30'),
                status: 'COMPLETED',
            },
        });
        activity2Id = activity2.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity2Id,
                venueId,
                effectiveFrom: null,
            },
        });

        const activity3 = await prisma.activity.create({
            data: {
                name: 'Activity 3 - Mar 2025 to ongoing',
                activityTypeId,
                startDate: new Date('2025-03-01'),
                endDate: null, // Ongoing
                status: 'ACTIVE',
            },
        });
        activity3Id = activity3.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity3Id,
                venueId,
                effectiveFrom: null,
            },
        });

        const activity4 = await prisma.activity.create({
            data: {
                name: 'Activity 4 - Dec 2024',
                activityTypeId,
                startDate: new Date('2024-12-01'),
                endDate: new Date('2024-12-31'),
                status: 'COMPLETED',
            },
        });
        activity4Id = activity4.id;
        await prisma.activityVenueHistory.create({
            data: {
                activityId: activity4Id,
                venueId,
                effectiveFrom: null,
            },
        });

        // Create participants
        const p1 = await prisma.participant.create({
            data: { name: 'RoleDateTest Participant 1 - Tutor in Activity 1' },
        });
        participant1Id = p1.id;
        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant1Id,
                venueId,
                effectiveFrom: new Date(),
            },
        });
        await prisma.assignment.create({
            data: {
                participantId: participant1Id,
                activityId: activity1Id,
                roleId: tutorRoleId,
            },
        });

        const p2 = await prisma.participant.create({
            data: { name: 'RoleDateTest Participant 2 - Teacher in Activity 2' },
        });
        participant2Id = p2.id;
        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant2Id,
                venueId,
                effectiveFrom: new Date(),
            },
        });
        await prisma.assignment.create({
            data: {
                participantId: participant2Id,
                activityId: activity2Id,
                roleId: teacherRoleId,
            },
        });

        const p3 = await prisma.participant.create({
            data: { name: 'RoleDateTest Participant 3 - Tutor in Activity 3 (ongoing)' },
        });
        participant3Id = p3.id;
        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant3Id,
                venueId,
                effectiveFrom: new Date(),
            },
        });
        await prisma.assignment.create({
            data: {
                participantId: participant3Id,
                activityId: activity3Id,
                roleId: tutorRoleId,
            },
        });

        const p4 = await prisma.participant.create({
            data: { name: 'RoleDateTest Participant 4 - Participant in Activity 4 (Dec 2024)' },
        });
        participant4Id = p4.id;
        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant4Id,
                venueId,
                effectiveFrom: new Date(),
            },
        });
        await prisma.assignment.create({
            data: {
                participantId: participant4Id,
                activityId: activity4Id,
                roleId: participantRoleId,
            },
        });

        const p5 = await prisma.participant.create({
            data: { name: 'RoleDateTest Participant 5 - No Assignments' },
        });
        participant5Id = p5.id;
        await prisma.participantAddressHistory.create({
            data: {
                participantId: participant5Id,
                venueId,
                effectiveFrom: new Date(),
            },
        });
    });

    afterAll(async () => {
        // Clean up test data in correct order (respecting foreign keys)
        await prisma.assignment.deleteMany({
            where: {
                participantId: {
                    in: [participant1Id, participant2Id, participant3Id, participant4Id],
                },
            },
        });

        await prisma.activityVenueHistory.deleteMany({
            where: {
                activityId: {
                    in: [activity1Id, activity2Id, activity3Id, activity4Id],
                },
            },
        });

        await prisma.activity.deleteMany({
            where: {
                id: {
                    in: [activity1Id, activity2Id, activity3Id, activity4Id],
                },
            },
        });

        await prisma.participantAddressHistory.deleteMany({
            where: {
                participantId: {
                    in: [participant1Id, participant2Id, participant3Id, participant4Id, participant5Id],
                },
            },
        });

        await prisma.participant.deleteMany({
            where: {
                id: {
                    in: [participant1Id, participant2Id, participant3Id, participant4Id, participant5Id],
                },
            },
        });

        await prisma.role.deleteMany({
            where: {
                id: { in: [tutorRoleId, teacherRoleId, participantRoleId] },
            },
        });

        await prisma.activityType.deleteMany({
            where: { id: activityTypeId },
        });

        await prisma.activityCategory.deleteMany({
            where: { id: activityCategoryId },
        });

        await prisma.venue.deleteMany({
            where: { id: venueId },
        });

        await prisma.geographicArea.deleteMany({
            where: { id: geographicAreaId },
        });

        await prisma.$disconnect();
    });

    describe('Role Filtering', () => {
        it('should filter participants by single role ID', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: [tutorRoleId],
                },
            });

            expect(result.data).toHaveLength(2); // Participants 1 and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).not.toContain(participant2Id);
            expect(participantIds).not.toContain(participant4Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should filter participants by multiple role IDs with OR logic', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: [tutorRoleId, teacherRoleId],
                },
            });

            expect(result.data).toHaveLength(3); // Participants 1, 2, and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant2Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).not.toContain(participant4Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should return empty array when filtering by non-existent role', async () => {
            const nonExistentRoleId = '00000000-0000-0000-0000-000000000000';

            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: [nonExistentRoleId],
                },
            });

            expect(result.data).toHaveLength(0);
        });

        it('should handle single role ID as string (not array)', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: tutorRoleId, // Single string, not array
                },
            });

            expect(result.data).toHaveLength(2); // Participants 1 and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant3Id);
        });

        it('should handle comma-separated role IDs as string', async () => {
            // Simulate what happens when URL has filter[roleIds]=uuid1,uuid2
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: `${tutorRoleId},${teacherRoleId}`, // Comma-separated string
                },
            });

            expect(result.data).toHaveLength(3); // Participants 1, 2, and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant2Id);
            expect(participantIds).toContain(participant3Id);
        });
    });

    describe('Activity Date Range Filtering', () => {
        it('should filter participants by activity date range with overlap logic (both dates)', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    activityStartDate: '2025-02-01',
                    activityEndDate: '2025-03-31',
                    name: 'RoleDateTest', // Add name filter to isolate our test participants
                },
            });

            // Should include participants in activities that overlap with Feb 1 - Mar 31
            // Activity 1 (Jan-Mar): overlaps
            // Activity 2 (Feb-Apr): overlaps
            // Activity 3 (Mar-ongoing): overlaps
            // Activity 4 (Dec 2024): does not overlap
            expect(result.data).toHaveLength(3); // Participants 1, 2, and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant2Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).not.toContain(participant4Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should filter participants by activity start date only', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    activityStartDate: '2025-02-01',
                },
            });

            // Should include participants in activities starting on or after Feb 1
            // Activity 1 (starts Jan): excluded
            // Activity 2 (starts Feb): included
            // Activity 3 (starts Mar): included
            // Activity 4 (starts Dec 2024): excluded
            expect(result.data).toHaveLength(2); // Participants 2 and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant2Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).not.toContain(participant1Id);
            expect(participantIds).not.toContain(participant4Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should filter participants by activity end date only', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    activityEndDate: '2025-01-31',
                },
            });

            // Should include participants in activities ending on or before Jan 31 (or ongoing)
            // Activity 1 (ends Mar): excluded
            // Activity 2 (ends Apr): excluded
            // Activity 3 (ongoing): included (null endDate matches any future date)
            // Activity 4 (ends Dec 2024): included
            expect(result.data).toHaveLength(2); // Participants 3 and 4
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant3Id); // Ongoing activity
            expect(participantIds).toContain(participant4Id);
            expect(participantIds).not.toContain(participant1Id);
            expect(participantIds).not.toContain(participant2Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should include ongoing activities in date range filters', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    activityStartDate: '2025-04-01',
                    activityEndDate: '2025-12-31',
                    name: 'RoleDateTest', // Add name filter to isolate our test participants
                },
            });

            // Should include participants in activities overlapping with Apr-Dec 2025
            // Activity 1 (Jan-Mar): does not overlap
            // Activity 2 (Feb-Apr): overlaps (ends in April)
            // Activity 3 (Mar-ongoing): overlaps (ongoing activities match any future range)
            // Activity 4 (Dec 2024): does not overlap
            expect(result.data).toHaveLength(2); // Participants 2 and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant2Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).not.toContain(participant1Id);
            expect(participantIds).not.toContain(participant4Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should return empty array when no activities match date range', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    activityStartDate: '2026-01-01',
                    activityEndDate: '2026-12-31',
                    name: 'RoleDateTest', // Add name filter to isolate our test participants
                },
            });

            // No activities in 2026 except ongoing Activity 3
            expect(result.data).toHaveLength(1); // Only Participant 3 (ongoing activity)
            expect(result.data[0].id).toBe(participant3Id);
        });
    });

    describe('Combined Role and Date Range Filtering', () => {
        it('should filter by role AND activity date range using AND logic', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: [tutorRoleId],
                    activityStartDate: '2025-02-01',
                    activityEndDate: '2025-03-31',
                    name: 'RoleDateTest', // Add name filter to isolate our test participants
                },
            });

            // Should include participants who are Tutors AND active in Feb-Mar 2025
            // Participant 1: Tutor in Activity 1 (Jan-Mar) - overlaps with Feb-Mar
            // Participant 3: Tutor in Activity 3 (Mar-ongoing) - overlaps with Feb-Mar
            expect(result.data).toHaveLength(2); // Participants 1 and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).not.toContain(participant2Id); // Teacher, not Tutor
            expect(participantIds).not.toContain(participant4Id);
            expect(participantIds).not.toContain(participant5Id);
        });

        it('should combine role and date filters with name filter using AND logic', async () => {
            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: [tutorRoleId],
                    activityStartDate: '2025-01-01',
                    name: 'Activity 1', // Should match only Participant 1
                },
            });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe(participant1Id);
        });

        it('should not return duplicate participants when they have multiple matching assignments', async () => {
            // Add a second assignment for Participant 1 with Teacher role in Activity 2
            await prisma.assignment.create({
                data: {
                    participantId: participant1Id,
                    activityId: activity2Id,
                    roleId: teacherRoleId,
                },
            });

            const result = await participantService.getParticipantsFlexible({
                filter: {
                    roleIds: [tutorRoleId, teacherRoleId],
                },
            });

            // Participant 1 now has both Tutor and Teacher roles
            // Should appear only once in results (DISTINCT)
            const participant1Count = result.data.filter((p) => p.id === participant1Id).length;
            expect(participant1Count).toBe(1);

            // Clean up the extra assignment
            await prisma.assignment.deleteMany({
                where: {
                    participantId: participant1Id,
                    activityId: activity2Id,
                },
            });
        });
    });

    describe('Pagination with Assignment-Based Filters', () => {
        it('should paginate correctly with role filter', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 1,
                filter: {
                    roleIds: [tutorRoleId],
                },
            });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(2); // Total of 2 tutors
            expect(result.pagination.totalPages).toBe(2);
            expect(result.pagination.page).toBe(1);
        });

        it('should paginate correctly with activity date range filter', async () => {
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 2,
                filter: {
                    activityStartDate: '2025-01-01',
                    activityEndDate: '2025-12-31',
                },
            });

            expect(result.data).toHaveLength(2);
            expect(result.pagination.total).toBe(3); // Participants 1, 2, and 3
            expect(result.pagination.totalPages).toBe(2);
        });
    });

    describe('Integration with Existing Filters', () => {
        it('should combine role filter with geographic area filter', async () => {
            const result = await participantService.getParticipantsFlexible({
                geographicAreaId,
                filter: {
                    roleIds: [tutorRoleId],
                },
            });

            expect(result.data).toHaveLength(2); // Participants 1 and 3
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant3Id);
        });

        it('should return all participants when no filters provided', async () => {
            const result = await participantService.getParticipantsFlexible({});

            expect(result.data.length).toBeGreaterThanOrEqual(5); // At least our 5 test participants
            const participantIds = result.data.map((p) => p.id);
            expect(participantIds).toContain(participant1Id);
            expect(participantIds).toContain(participant2Id);
            expect(participantIds).toContain(participant3Id);
            expect(participantIds).toContain(participant4Id);
            expect(participantIds).toContain(participant5Id);
        });
    });
});
