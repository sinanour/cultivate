import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../../services/analytics.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { TimePeriod } from '../../utils/constants';
import { TestHelpers } from '../utils';

const prisma = new PrismaClient();

describe('Growth Metrics with Additional Participant Count', () => {
  let analyticsService: AnalyticsService;
  const testSuffix = Date.now();
  let activityTypeId: string;
  let activityId: string;
  let participantId: string;
  let roleId: string;

  beforeAll(async () => {
    const geographicAreaRepository = new GeographicAreaRepository(prisma);

    analyticsService = new AnalyticsService(prisma, geographicAreaRepository);

    // Get predefined data deterministically
    const activityType = await TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01');
    activityTypeId = activityType.id;

    const role = await TestHelpers.getPredefinedRole(prisma, 'Participant');
    roleId = role.id;

    // Create test participant with unique name
    const participant = await prisma.participant.create({
      data: {
        name: `GrowthTest Participant ${testSuffix}`,
        email: `test-growth-${testSuffix}@example.com`,
      },
    });
    participantId = participant.id;

    // Create test activity with additionalParticipantCount
    const activity = await prisma.activity.create({
      data: {
        name: `GrowthTest Activity ${testSuffix}`,
        activityTypeId,
        startDate: new Date('2025-01-15'),
        status: 'ACTIVE',
        additionalParticipantCount: 30,
      },
    });
    activityId = activity.id;

    // Add one individual assignment
    await prisma.assignment.create({
      data: {
        activityId: activity.id,
        participantId: participant.id,
        roleId,
      },
    });
  });

  afterAll(async () => {
    // Clean up
    if (activityId) {
      await prisma.assignment.deleteMany({ where: { activityId } });
      await prisma.activity.delete({ where: { id: activityId } });
    }
    if (participantId) {
      await prisma.participant.delete({ where: { id: participantId } });
    }
    await prisma.$disconnect();
  });

  it('should include additionalParticipantCount in growth metrics participation', async () => {
    const metrics = await analyticsService.getGrowthMetrics(
      TimePeriod.MONTH,
      {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      },
      [],
      false
    );

    // Find the period containing our activity (January 2025)
    const januaryPeriod = metrics.timeSeries.find(p => p.date.includes('2025-01'));

    expect(januaryPeriod).toBeDefined();
    
    // Should have 1 unique participant (the individually assigned one)
    expect(januaryPeriod!.uniqueParticipants).toBeGreaterThanOrEqual(1);
    
    // Should have 31 total participation (1 individual + 30 additional)
    expect(januaryPeriod!.totalParticipation).toBeGreaterThanOrEqual(31);
    
    // Participation should be much higher than unique participants
    expect(januaryPeriod!.totalParticipation).toBeGreaterThan(januaryPeriod!.uniqueParticipants);
  });

  it('should not include additionalParticipantCount in unique participant counts', async () => {
    const metrics = await analyticsService.getGrowthMetrics(
      TimePeriod.MONTH,
      {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      },
      [],
      false
    );

    const januaryPeriod = metrics.timeSeries.find(p => p.date.includes('2025-01'));

    expect(januaryPeriod).toBeDefined();
    
    // Unique participants should only count individually assigned (not the 30 additional)
    // The difference should be at least 29 (30 additional - 1 individual)
    const difference = januaryPeriod!.totalParticipation - januaryPeriod!.uniqueParticipants;
    expect(difference).toBeGreaterThanOrEqual(29);
  });
});
