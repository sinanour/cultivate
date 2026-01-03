import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient, ActivityStatus } from '@prisma/client';

jest.mock('../../repositories/activity.repository');
jest.mock('../../repositories/activity-type.repository');
jest.mock('../../repositories/activity-venue-history.repository');
jest.mock('../../repositories/venue.repository');
jest.mock('../../repositories/geographic-area.repository');
jest.mock('@prisma/client');

describe('ActivityService', () => {
    let service: ActivityService;
    let mockActivityRepo: jest.Mocked<ActivityRepository>;
    let mockActivityTypeRepo: jest.Mocked<ActivityTypeRepository>;
    let mockVenueHistoryRepo: jest.Mocked<ActivityVenueHistoryRepository>;
    let mockVenueRepo: jest.Mocked<VenueRepository>;
    let mockGeographicAreaRepo: jest.Mocked<GeographicAreaRepository>;
    let mockPrisma: jest.Mocked<PrismaClient>;

    beforeEach(() => {
        mockActivityRepo = new ActivityRepository(null as any) as jest.Mocked<ActivityRepository>;
        mockActivityTypeRepo = new ActivityTypeRepository(null as any) as jest.Mocked<ActivityTypeRepository>;
        mockVenueHistoryRepo = new ActivityVenueHistoryRepository(null as any) as jest.Mocked<ActivityVenueHistoryRepository>;
        mockVenueRepo = new VenueRepository(null as any) as jest.Mocked<VenueRepository>;
        mockGeographicAreaRepo = new GeographicAreaRepository(null as any) as jest.Mocked<GeographicAreaRepository>;

        const mockTx = {
            activity: {
                create: jest.fn().mockResolvedValue({ id: '1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'PLANNED', createdAt: new Date(), updatedAt: new Date() }),
            },
            activityVenueHistory: {
                create: jest.fn().mockResolvedValue({}),
            },
        };

        mockPrisma = {
            $transaction: jest.fn().mockImplementation(async (callback) => {
                return await callback(mockTx);
            }),
        } as any;

        service = new ActivityService(mockActivityRepo, mockActivityTypeRepo, mockVenueHistoryRepo, mockVenueRepo, mockPrisma, mockGeographicAreaRepo);
        jest.clearAllMocks();
    });

    describe('getAllActivities', () => {
        it('should return all activities', async () => {
            const mockActivities = [
                { id: '1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), isOngoing: true },
            ];
            mockActivityRepo.findAll = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getAllActivities();

            expect(result).toEqual(mockActivities);
        });
    });

    describe('getActivityById', () => {
        it('should return activity by ID', async () => {
            const mockActivity = { id: '1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), isOngoing: true };
            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);

            const result = await service.getActivityById('1');

            expect(result).toEqual(mockActivity);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getActivityById('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('createActivity', () => {
        it('should create activity with valid data', async () => {
            const now = new Date();
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate: now };
            const mockActivity = {
                id: '1',
                ...input,
                endDate: null,
                status: 'PLANNED' as ActivityStatus,
                createdAt: now,
                updatedAt: now
            };

            mockActivityTypeRepo.exists = jest.fn().mockResolvedValue(true);
            mockActivityRepo.create = jest.fn().mockResolvedValue(mockActivity);

            const result = await service.createActivity(input);

            expect(result).toMatchObject({
                id: '1',
                name: 'Workshop',
                activityTypeId: 'type-1',
                endDate: null,
                status: 'PLANNED',
            });
            expect(result.startDate).toBeInstanceOf(Date);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
            expect(mockActivityTypeRepo.exists).toHaveBeenCalledWith('type-1');
        });

        it('should throw error for non-existent activity type', async () => {
            const input = { name: 'Workshop', activityTypeId: 'invalid-type', startDate: new Date() };

            mockActivityTypeRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.createActivity(input)).rejects.toThrow('Activity type not found');
        });

        it('should throw error for missing required fields', async () => {
            await expect(service.createActivity({ name: '', activityTypeId: 'type-1', startDate: new Date() })).rejects.toThrow('required');
        });

        it('should throw error when end date is before start date', async () => {
            const startDate = new Date('2024-12-31');
            const endDate = new Date('2024-01-01');
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate, endDate };

            mockActivityTypeRepo.exists = jest.fn().mockResolvedValue(true);

            await expect(service.createActivity(input)).rejects.toThrow('End date must be on or after start date');
        });

        it('should allow end date to equal start date for one-day activities', async () => {
            const sameDate = new Date('2024-12-31');
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate: sameDate, endDate: sameDate };

            mockActivityTypeRepo.exists = jest.fn().mockResolvedValue(true);

            // The key test is that this doesn't throw an error about dates
            await expect(service.createActivity(input)).resolves.toBeDefined();
        });

        it('should set default status to PLANNED', async () => {
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate: new Date() };

            mockActivityTypeRepo.exists = jest.fn().mockResolvedValue(true);

            const result = await service.createActivity(input);

            expect(result).toHaveProperty('status', 'PLANNED');
        });
    });

    describe('updateActivity', () => {
        it('should update activity with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Workshop' };
            const existing = { id, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), isOngoing: true };
            const updated = { ...existing, ...input };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(existing);
            mockActivityRepo.update = jest.fn().mockResolvedValue(updated);

            const result = await service.updateActivity(id, input);

            expect(result).toEqual(updated);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.updateActivity('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });
    });

    describe('deleteActivity', () => {
        it('should delete activity', async () => {
            const id = '1';
            const existing = { id, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(existing);
            mockActivityRepo.delete = jest.fn().mockResolvedValue(undefined);

            await service.deleteActivity(id);

            expect(mockActivityRepo.delete).toHaveBeenCalledWith(id);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.deleteActivity('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('getActivityVenues', () => {
        it('should return venue history for activity', async () => {
            const activityId = 'activity-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };
            const mockVenueHistory = [
                { id: '1', activityId, venueId: 'venue-1', effectiveFrom: new Date(), createdAt: new Date() },
            ];

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueHistoryRepo.findByActivityId = jest.fn().mockResolvedValue(mockVenueHistory);

            const result = await service.getActivityVenues(activityId);

            expect(result).toEqual(mockVenueHistory);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getActivityVenues('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('associateVenue', () => {
        it('should associate venue with activity', async () => {
            const activityId = 'activity-1';
            const venueId = 'venue-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };
            const mockHistory = { id: '1', activityId, venueId, effectiveFrom: new Date(), createdAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueRepo.exists = jest.fn().mockResolvedValue(true);
            mockVenueHistoryRepo.hasDuplicateEffectiveFrom = jest.fn().mockResolvedValue(false);
            mockVenueHistoryRepo.create = jest.fn().mockResolvedValue(mockHistory);

            const result = await service.associateVenue(activityId, venueId);

            expect(result).toEqual(mockHistory);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.associateVenue('invalid-activity', 'venue-1')).rejects.toThrow('Activity not found');
        });

        it('should throw error for non-existent venue', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.associateVenue('activity-1', 'invalid-venue')).rejects.toThrow('Venue not found');
        });

        it('should throw error for duplicate effective date', async () => {
            const activityId = 'activity-1';
            const venueId = 'venue-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueRepo.exists = jest.fn().mockResolvedValue(true);
            mockVenueHistoryRepo.hasDuplicateEffectiveFrom = jest.fn().mockResolvedValue(true);
            mockVenueHistoryRepo.hasNullEffectiveFrom = jest.fn().mockResolvedValue(false);

            await expect(service.associateVenue(activityId, venueId, null)).rejects.toThrow('A venue association with null effective date (activity start) already exists');
        });
    });

    describe('removeVenueAssociation', () => {
        it('should remove venue association', async () => {
            const activityId = 'activity-1';
            const venueHistoryId = 'history-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };
            const mockHistory = { id: venueHistoryId, activityId, venueId: 'venue-1', effectiveFrom: new Date(), createdAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueHistoryRepo.findById = jest.fn().mockResolvedValue(mockHistory);
            mockVenueHistoryRepo.delete = jest.fn().mockResolvedValue(undefined);

            await service.removeVenueAssociation(activityId, venueHistoryId);

            expect(mockVenueHistoryRepo.delete).toHaveBeenCalledWith(venueHistoryId);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.removeVenueAssociation('invalid-activity', 'history-1')).rejects.toThrow('Activity not found');
        });

        it('should throw error when venue history not found', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueHistoryRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.removeVenueAssociation('activity-1', 'history-1')).rejects.toThrow('Venue association not found');
        });

        it('should throw error when venue history belongs to different activity', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date() };
            const mockHistory = { id: 'history-1', activityId: 'different-activity', venueId: 'venue-1', effectiveFrom: new Date(), createdAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockVenueHistoryRepo.findById = jest.fn().mockResolvedValue(mockHistory);

            await expect(service.removeVenueAssociation('activity-1', 'history-1')).rejects.toThrow('Venue association not found');
        });
    });
});
