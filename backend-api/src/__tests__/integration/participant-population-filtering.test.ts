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

describe('Participant Population Filtering Integration Tests', () => {
  let prisma: PrismaClient;
  let participantService: ParticipantService;
  
  // Test data IDs
  let geographicAreaId: string;
  let venueId: string;
  let population1Id: string;
  let population2Id: string;
  let population3Id: string;
  let participant1Id: string; // In population1
  let participant2Id: string; // In population2
  let participant3Id: string; // In both population1 and population2
  let participant4Id: string; // In population3
  let participant5Id: string; // In no populations

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
      geographicAreaRepository,
      geoAuthService
    );

    // Create test data
    const geographicArea = await prisma.geographicArea.create({
      data: {
        name: 'Test City for Population Filtering',
        areaType: 'CITY',
      },
    });
    geographicAreaId = geographicArea.id;

    const venue = await prisma.venue.create({
      data: {
        name: 'Test Venue for Population Filtering',
        address: '123 Test St',
        geographicAreaId,
      },
    });
    venueId = venue.id;

    // Create populations
    const pop1 = await prisma.population.create({
      data: { name: 'Youth Population' },
    });
    population1Id = pop1.id;

    const pop2 = await prisma.population.create({
      data: { name: 'Adult Population' },
    });
    population2Id = pop2.id;

    const pop3 = await prisma.population.create({
      data: { name: 'Senior Population' },
    });
    population3Id = pop3.id;

    // Create participants
    const p1 = await prisma.participant.create({
      data: { name: 'Participant 1 - Youth Only' },
    });
    participant1Id = p1.id;
    await prisma.participantAddressHistory.create({
      data: {
        participantId: participant1Id,
        venueId,
        effectiveFrom: new Date(),
      },
    });
    await prisma.participantPopulation.create({
      data: {
        participantId: participant1Id,
        populationId: population1Id,
      },
    });

    const p2 = await prisma.participant.create({
      data: { name: 'Participant 2 - Adult Only' },
    });
    participant2Id = p2.id;
    await prisma.participantAddressHistory.create({
      data: {
        participantId: participant2Id,
        venueId,
        effectiveFrom: new Date(),
      },
    });
    await prisma.participantPopulation.create({
      data: {
        participantId: participant2Id,
        populationId: population2Id,
      },
    });

    const p3 = await prisma.participant.create({
      data: { name: 'Participant 3 - Youth and Adult' },
    });
    participant3Id = p3.id;
    await prisma.participantAddressHistory.create({
      data: {
        participantId: participant3Id,
        venueId,
        effectiveFrom: new Date(),
      },
    });
    await prisma.participantPopulation.create({
      data: {
        participantId: participant3Id,
        populationId: population1Id,
      },
    });
    await prisma.participantPopulation.create({
      data: {
        participantId: participant3Id,
        populationId: population2Id,
      },
    });

    const p4 = await prisma.participant.create({
      data: { name: 'Participant 4 - Senior Only' },
    });
    participant4Id = p4.id;
    await prisma.participantAddressHistory.create({
      data: {
        participantId: participant4Id,
        venueId,
        effectiveFrom: new Date(),
      },
    });
    await prisma.participantPopulation.create({
      data: {
        participantId: participant4Id,
        populationId: population3Id,
      },
    });

    const p5 = await prisma.participant.create({
      data: { name: 'Participant 5 - No Populations' },
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
    // Clean up test data
    await prisma.participantPopulation.deleteMany({
      where: {
        participantId: {
          in: [participant1Id, participant2Id, participant3Id, participant4Id],
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

    await prisma.population.deleteMany({
      where: {
        id: { in: [population1Id, population2Id, population3Id] },
      },
    });

    await prisma.venue.deleteMany({
      where: { id: venueId },
    });

    await prisma.geographicArea.deleteMany({
      where: { id: geographicAreaId },
    });

    await prisma.$disconnect();
  });

  describe('Population Filtering', () => {
    it('should filter participants by single population ID', async () => {
      const result = await participantService.getParticipantsFlexible({
        filter: {
          populationIds: [population1Id],
        },
      });

      expect(result.data).toHaveLength(2); // Participant 1 and 3
      const participantIds = result.data.map((p) => p.id);
      expect(participantIds).toContain(participant1Id);
      expect(participantIds).toContain(participant3Id);
      expect(participantIds).not.toContain(participant2Id);
      expect(participantIds).not.toContain(participant4Id);
      expect(participantIds).not.toContain(participant5Id);
    });

    it('should filter participants by multiple population IDs with OR logic', async () => {
      const result = await participantService.getParticipantsFlexible({
        filter: {
          populationIds: [population1Id, population2Id],
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

    it('should return empty array when filtering by non-existent population', async () => {
      const nonExistentPopulationId = '00000000-0000-0000-0000-000000000000';
      
      const result = await participantService.getParticipantsFlexible({
        filter: {
          populationIds: [nonExistentPopulationId],
        },
      });

      expect(result.data).toHaveLength(0);
    });

    it('should combine population filter with name filter using AND logic', async () => {
      const result = await participantService.getParticipantsFlexible({
        filter: {
          populationIds: [population1Id],
          name: 'Youth Only', // Should match only Participant 1
        },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(participant1Id);
    });

    it('should handle population filter with field selection', async () => {
      const result = await participantService.getParticipantsFlexible({
        filter: {
          populationIds: [population2Id],
        },
        fields: ['id', 'name'],
      });

      expect(result.data).toHaveLength(2); // Participants 2 and 3
      const participantIds = result.data.map((p) => p.id);
      expect(participantIds).toContain(participant2Id);
      expect(participantIds).toContain(participant3Id);
      
      // Verify only requested fields are returned
      result.data.forEach((p) => {
        expect(Object.keys(p)).toEqual(['id', 'name']);
      });
    });

    it('should handle population filter with geographic area filter', async () => {
      const result = await participantService.getParticipantsFlexible({
        geographicAreaId,
        filter: {
          populationIds: [population1Id],
        },
      });

      expect(result.data).toHaveLength(2); // Participants 1 and 3
      const participantIds = result.data.map((p) => p.id);
      expect(participantIds).toContain(participant1Id);
      expect(participantIds).toContain(participant3Id);
    });

    it('should handle single population ID as string (not array)', async () => {
      const result = await participantService.getParticipantsFlexible({
        filter: {
          populationIds: population1Id, // Single string, not array
        },
      });

      expect(result.data).toHaveLength(2); // Participant 1 and 3
      const participantIds = result.data.map((p) => p.id);
      expect(participantIds).toContain(participant1Id);
      expect(participantIds).toContain(participant3Id);
    });

    it('should return all participants when no population filter provided', async () => {
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
