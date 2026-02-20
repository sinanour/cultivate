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
import { TestHelpers } from '../utils';

const prisma = new PrismaClient();

describe('Additional Participant Count Integration', () => {
  let activityService: ActivityService;
  const testSuffix = Date.now();
  let activityTypeId: string;
  let activityId: string;

  beforeAll(async () => {
    // Initialize services
    const activityRepository = new ActivityRepository(prisma);
    const activityTypeRepository = new ActivityTypeRepository(prisma);
    const venueHistoryRepository = new ActivityVenueHistoryRepository(prisma);
    const venueRepository = new VenueRepository(prisma);
    const geographicAreaRepository = new GeographicAreaRepository(prisma);
    const authorizationRepository = new UserGeographicAuthorizationRepository(prisma);
    const userRepository = new UserRepository(prisma);
    const auditLogRepository = new AuditLogRepository(prisma);
    const geographicAuthorizationService = new GeographicAuthorizationService(
      authorizationRepository,
      geographicAreaRepository,
      userRepository,
      auditLogRepository
    );

    activityService = new ActivityService(
      activityRepository,
      activityTypeRepository,
      venueHistoryRepository,
      venueRepository,
      prisma,
      geographicAuthorizationService
    );

    // Get a predefined activity type for testing
    const activityType = await TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01');
    activityTypeId = activityType.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (activityId) {
      try {
        await prisma.activity.delete({ where: { id: activityId } });
      } catch (e) {
        // Ignore if already deleted
      }
    }
    await prisma.$disconnect();
  });

  it('should create activity with additionalParticipantCount', async () => {
    const activity = await activityService.createActivity({
      name: `AdditionalCountTest Activity ${testSuffix}`,
      activityTypeId,
      startDate: new Date('2025-02-01'),
      additionalParticipantCount: 25,
    });

    activityId = activity.id;

    expect(activity.additionalParticipantCount).toBe(25);
    expect(activity.name).toBe(`AdditionalCountTest Activity ${testSuffix}`);
  });

  it('should retrieve activity with additionalParticipantCount', async () => {
    const activity = await activityService.getActivityById(activityId);

    expect(activity.additionalParticipantCount).toBe(25);
  });

  it('should update additionalParticipantCount', async () => {
    const updated = await activityService.updateActivity(
      activityId,
      { additionalParticipantCount: 50 },
      undefined,
      'ADMINISTRATOR'
    );

    expect(updated.additionalParticipantCount).toBe(50);
  });

  it('should clear additionalParticipantCount by setting to null', async () => {
    const updated = await activityService.updateActivity(
      activityId,
      { additionalParticipantCount: null },
      undefined,
      'ADMINISTRATOR'
    );

    expect(updated.additionalParticipantCount).toBeNull();
  });

  it('should create activity without additionalParticipantCount (defaults to null)', async () => {
    const activity = await activityService.createActivity({
      name: `AdditionalCountTest Activity without Count ${testSuffix}`,
      activityTypeId,
      startDate: new Date('2025-02-01'),
    });

    expect(activity.additionalParticipantCount).toBeNull();

    // Clean up
    await prisma.activity.delete({ where: { id: activity.id } });
  });
});
