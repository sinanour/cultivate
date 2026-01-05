import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../../repositories/activity-venue-history.repository';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { ActivityStatus } from '@prisma/client';
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';

describe('ActivityService', () => {
    let service: ActivityService;
    let mockPrisma: MockPrismaClient;
    let mockActivityRepo: ActivityRepository;
    let mockActivityTypeRepo: ActivityTypeRepository;
    let mockVenueHistoryRepo: ActivityVenueHistoryRepository;
    let mockVenueRepo: VenueRepository;
    let mockGeographicAreaRepo: GeographicAreaRepository;
    let mockGeographicAuthService: jest.Mocked<GeographicAuthorizationService>;

    beforeEach(() => {
        // Create a fresh mock Prisma client for each test
        mockPrisma = createMockPrismaClient();

        // Create repositories with the mocked Prisma client
        mockActivityRepo = new ActivityRepository(mockPrisma);
        mockActivityTypeRepo = new ActivityTypeRepository(mockPrisma);
        mockVenueHistoryRepo = new ActivityVenueHistoryRepository(mockPrisma);
        mockVenueRepo = new VenueRepository(mockPrisma);
        mockGeographicAreaRepo = new GeographicAreaRepository(mockPrisma);

        // Mock the GeographicAuthorizationService
        mockGeographicAuthService = {
            evaluateAccess: jest.fn(),
            getAuthorizationRules: jest.fn(),
            createAuthorizationRule: jest.fn(),
            deleteAuthorizationRule: jest.fn(),
            getAuthorizedAreas: jest.fn(),
            hasGeographicRestrictions: jest.fn(),
        } as any;

        service = new ActivityService(
            mockActivityRepo,
            mockActivityTypeRepo,
            mockVenueHistoryRepo,
            mockVenueRepo,
            mockPrisma,
            mockGeographicAreaRepo,
            mockGeographicAuthService
        );
    });

    describe('getAllActivities', () => {
        it('should return all activities', async () => {
            const mockActivities = [
                { id: '1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];
            mockPrisma.activity.findMany.mockResolvedValue(mockActivities as any);

            const result = await service.getAllActivities();

            expect(result).toEqual(mockActivities.map(a => ({ ...a, isOngoing: true })));
        });
    });

    describe('getActivityById', () => {
        it('should return activity by ID', async () => {
            const mockActivity = { id: '1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);

            const result = await service.getActivityById('1');

            expect(result).toEqual({ ...mockActivity, isOngoing: true });
        });

        it('should throw error for non-existent activity', async () => {
            mockPrisma.activity.findUnique.mockResolvedValue(null);

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
                updatedAt: now,
                version: 1,
                activityType: { id: 'type-1', name: 'Test Type', activityCategoryId: 'cat-1', createdAt: now, updatedAt: now, version: 1, isPredefined: false }
            };

            mockPrisma.activityType.count.mockResolvedValue(1); // exists check
            mockPrisma.$transaction.mockImplementation(async (callback: any) => {
                const mockTx = {
                    activity: {
                        create: jest.fn().mockResolvedValue(mockActivity)
                    },
                    activityVenueHistory: {
                        create: jest.fn()
                    }
                };
                return await callback(mockTx);
            });

            const result = await service.createActivity(input);

            expect(result).toMatchObject({
                id: '1',
                name: 'Workshop',
                activityTypeId: 'type-1',
                endDate: null,
                status: 'PLANNED'
            });
            expect(result.startDate).toBeInstanceOf(Date);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should throw error for non-existent activity type', async () => {
            const input = { name: 'Workshop', activityTypeId: 'invalid-type', startDate: new Date() };

            mockPrisma.activityType.count.mockResolvedValue(0); // exists check fails

            await expect(service.createActivity(input)).rejects.toThrow('Activity type not found');
        });

        it('should throw error for missing required fields', async () => {
            await expect(service.createActivity({ name: '', activityTypeId: 'type-1', startDate: new Date() })).rejects.toThrow('required');
        });

        it('should throw error when end date is before start date', async () => {
            const startDate = new Date('2024-12-31');
            const endDate = new Date('2024-01-01');
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate, endDate };

            mockPrisma.activityType.count.mockResolvedValue(1); // exists check

            await expect(service.createActivity(input)).rejects.toThrow('End date must be on or after start date');
        });

        it('should allow end date to equal start date for one-day activities', async () => {
            const sameDate = new Date('2024-12-31');
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate: sameDate, endDate: sameDate };
            const mockActivity = {
                id: '1',
                ...input,
                status: 'PLANNED' as ActivityStatus,
                createdAt: sameDate,
                updatedAt: sameDate,
                version: 1,
                activityType: { id: 'type-1', name: 'Test Type', activityCategoryId: 'cat-1', createdAt: sameDate, updatedAt: sameDate, version: 1, isPredefined: false }
            };

            mockPrisma.activityType.count.mockResolvedValue(1); // exists check
            mockPrisma.$transaction.mockImplementation(async (callback: any) => {
                const mockTx = {
                    activity: {
                        create: jest.fn().mockResolvedValue(mockActivity)
                    },
                    activityVenueHistory: {
                        create: jest.fn()
                    }
                };
                return await callback(mockTx);
            });

            // The key test is that this doesn't throw an error about dates
            await expect(service.createActivity(input)).resolves.toBeDefined();
        });

        it('should set default status to PLANNED', async () => {
            const input = { name: 'Workshop', activityTypeId: 'type-1', startDate: new Date() };
            const mockActivity = {
                id: '1',
                ...input,
                endDate: null,
                status: 'PLANNED' as ActivityStatus,
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1,
                activityType: { id: 'type-1', name: 'Test Type', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1, isPredefined: false }
            };

            mockPrisma.activityType.count.mockResolvedValue(1); // exists check
            mockPrisma.$transaction.mockImplementation(async (callback: any) => {
                const mockTx = {
                    activity: {
                        create: jest.fn().mockResolvedValue(mockActivity)
                    },
                    activityVenueHistory: {
                        create: jest.fn()
                    }
                };
                return await callback(mockTx);
            });

            const result = await service.createActivity(input);

            expect(result).toHaveProperty('status', 'PLANNED');
        });
    });

    describe('updateActivity', () => {
        it('should update activity with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Workshop' };
            const existing = { id, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const updated = { ...existing, ...input, version: 2 };

            mockPrisma.activity.findUnique.mockResolvedValue(existing as any);
            mockPrisma.activity.update.mockResolvedValue(updated as any);

            const result = await service.updateActivity(id, input);

            expect(result).toEqual({ ...updated, isOngoing: true });
        });

        it('should throw error for non-existent activity', async () => {
            mockPrisma.activity.findUnique.mockResolvedValue(null);

            await expect(service.updateActivity('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });
    });

    describe('deleteActivity', () => {
        it('should delete activity', async () => {
            const id = '1';
            const existing = { id, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockPrisma.activity.findUnique.mockResolvedValue(existing as any);
            mockPrisma.activity.delete.mockResolvedValue(existing as any);

            await service.deleteActivity(id);

            expect(mockPrisma.activity.delete).toHaveBeenCalledWith({ where: { id } });
        });

        it('should throw error for non-existent activity', async () => {
            mockPrisma.activity.findUnique.mockResolvedValue(null);

            await expect(service.deleteActivity('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('getActivityVenues', () => {
        it('should return venue history for activity', async () => {
            const activityId = 'activity-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockVenueHistory = [
                { id: '1', activityId, venueId: 'venue-1', effectiveFrom: new Date(), createdAt: new Date() },
            ];

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.activityVenueHistory.findMany.mockResolvedValue(mockVenueHistory as any);

            const result = await service.getActivityVenues(activityId);

            expect(result).toEqual(mockVenueHistory);
        });

        it('should throw error for non-existent activity', async () => {
            mockPrisma.activity.findUnique.mockResolvedValue(null);

            await expect(service.getActivityVenues('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('associateVenue', () => {
        it('should associate venue with activity', async () => {
            const activityId = 'activity-1';
            const venueId = 'venue-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockVenue = { id: venueId, name: 'Test Venue', address: '123 Main St', geographicAreaId: 'area-1', createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockHistory = { id: '1', activityId, venueId, effectiveFrom: new Date(), createdAt: new Date() };

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.venue.findUnique.mockResolvedValue(mockVenue as any);
            mockPrisma.activityVenueHistory.findFirst.mockResolvedValue(null);
            mockPrisma.activityVenueHistory.create.mockResolvedValue(mockHistory as any);

            const result = await service.associateVenue(activityId, venueId, undefined, [], false);

            expect(result).toEqual(mockHistory);
        });

        it('should throw error for non-existent activity', async () => {
            mockPrisma.activity.findUnique.mockResolvedValue(null);

            await expect(service.associateVenue('invalid-activity', 'venue-1', undefined, [], false)).rejects.toThrow('Activity not found');
        });

        it('should throw error for non-existent venue', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.venue.findUnique.mockResolvedValue(null);

            await expect(service.associateVenue('activity-1', 'invalid-venue', undefined, [], false)).rejects.toThrow('Venue not found');
        });

        it('should throw error for duplicate effective date', async () => {
            const activityId = 'activity-1';
            const venueId = 'venue-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockVenue = { id: venueId, name: 'Test Venue', address: '123 Main St', geographicAreaId: 'area-1', createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const existingHistory = { id: '1', activityId, venueId: 'other-venue', effectiveFrom: null, createdAt: new Date() };

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.venue.findUnique.mockResolvedValue(mockVenue as any);
            mockPrisma.activityVenueHistory.findFirst.mockResolvedValue(existingHistory as any);

            await expect(service.associateVenue(activityId, venueId, null, [], false)).rejects.toThrow('A venue association with null effective date (activity start) already exists');
        });
    });

    describe('removeVenueAssociation', () => {
        it('should remove venue association', async () => {
            const activityId = 'activity-1';
            const venueHistoryId = 'history-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockHistory = { id: venueHistoryId, activityId, venueId: 'venue-1', effectiveFrom: new Date(), createdAt: new Date() };

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.activityVenueHistory.findUnique.mockResolvedValue(mockHistory as any);
            mockPrisma.activityVenueHistory.delete.mockResolvedValue(mockHistory as any);

            await service.removeVenueAssociation(activityId, venueHistoryId);

            expect(mockPrisma.activityVenueHistory.delete).toHaveBeenCalledWith({ where: { id: venueHistoryId } });
        });

        it('should throw error for non-existent activity', async () => {
            mockPrisma.activity.findUnique.mockResolvedValue(null);

            await expect(service.removeVenueAssociation('invalid-activity', 'history-1')).rejects.toThrow('Activity not found');
        });

        it('should throw error when venue history not found', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.activityVenueHistory.findUnique.mockResolvedValue(null);

            await expect(service.removeVenueAssociation('activity-1', 'history-1')).rejects.toThrow('Venue association not found');
        });

        it('should throw error when venue history belongs to different activity', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE' as ActivityStatus, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockHistory = { id: 'history-1', activityId: 'different-activity', venueId: 'venue-1', effectiveFrom: new Date(), createdAt: new Date() };

            mockPrisma.activity.findUnique.mockResolvedValue(mockActivity as any);
            mockPrisma.activityVenueHistory.findUnique.mockResolvedValue(mockHistory as any);

            await expect(service.removeVenueAssociation('activity-1', 'history-1')).rejects.toThrow('Venue association not found');
        });
    });
});
