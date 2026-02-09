import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { PrismaClient, ActivityStatus } from '@prisma/client';
import { createMockPrismaClient } from '../utils/mock-prisma';

describe('ActivityService - Additional Participant Count', () => {
    let activityService: ActivityService;
    let mockPrisma: PrismaClient;
    let activityRepository: ActivityRepository;
    let activityTypeRepository: ActivityTypeRepository;

    beforeEach(() => {
        mockPrisma = createMockPrismaClient();
        activityRepository = new ActivityRepository(mockPrisma);
        activityTypeRepository = new ActivityTypeRepository(mockPrisma);
        const venueHistoryRepository = new ActivityVenueHistoryRepository(mockPrisma);
        const venueRepository = new VenueRepository(mockPrisma);
        const geographicAreaRepository = new GeographicAreaRepository(mockPrisma);
        const geographicAuthorizationService = new GeographicAuthorizationService(
            {} as any,
            geographicAreaRepository,
            {} as any,
            {} as any
        );

        activityService = new ActivityService(
            activityRepository,
            activityTypeRepository,
            venueHistoryRepository,
            venueRepository,
            mockPrisma,
            geographicAuthorizationService
        );
    });

    describe('Validation', () => {
        it('should reject zero additionalParticipantCount', async () => {
            jest.spyOn(activityTypeRepository, 'exists').mockResolvedValue(true);

            await expect(
                activityService.createActivity({
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2025-01-01'),
                    additionalParticipantCount: 0,
                })
            ).rejects.toThrow('Additional participant count must be a positive integer');
        });

        it('should reject negative additionalParticipantCount', async () => {
            jest.spyOn(activityTypeRepository, 'exists').mockResolvedValue(true);

            await expect(
                activityService.createActivity({
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2025-01-01'),
                    additionalParticipantCount: -5,
                })
            ).rejects.toThrow('Additional participant count must be a positive integer');
        });

        it('should reject decimal additionalParticipantCount', async () => {
            jest.spyOn(activityTypeRepository, 'exists').mockResolvedValue(true);

            await expect(
                activityService.createActivity({
                    name: 'Test Activity',
                    activityTypeId: 'type-1',
                    startDate: new Date('2025-01-01'),
                    additionalParticipantCount: 10.5,
                })
            ).rejects.toThrow('Additional participant count must be an integer');
        });

        it('should reject zero when updating additionalParticipantCount', async () => {
            const existingActivity = {
                id: 'activity-1',
                name: 'Test Activity',
                activityTypeId: 'type-1',
                startDate: new Date('2025-01-01'),
                endDate: null,
                status: ActivityStatus.PLANNED,
                additionalParticipantCount: null,
                createdBy: null,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            jest.spyOn(activityRepository, 'findById').mockResolvedValue(existingActivity as any);

            await expect(
                activityService.updateActivity(
                    'activity-1',
                    { additionalParticipantCount: 0 },
                    'user-1',
                    'ADMINISTRATOR'
                )
            ).rejects.toThrow('Additional participant count must be a positive integer');
        });

        it('should reject decimal when updating additionalParticipantCount', async () => {
            const existingActivity = {
                id: 'activity-1',
                name: 'Test Activity',
                activityTypeId: 'type-1',
                startDate: new Date('2025-01-01'),
                endDate: null,
                status: ActivityStatus.PLANNED,
                additionalParticipantCount: null,
                createdBy: null,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            jest.spyOn(activityRepository, 'findById').mockResolvedValue(existingActivity as any);

            await expect(
                activityService.updateActivity(
                    'activity-1',
                    { additionalParticipantCount: 10.5 },
                    'user-1',
                    'ADMINISTRATOR'
                )
            ).rejects.toThrow('Additional participant count must be an integer');
        });
    });
});
