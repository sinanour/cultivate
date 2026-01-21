import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { PrismaClient, AreaType } from '@prisma/client';

jest.mock('../../repositories/geographic-area.repository');
jest.mock('../../services/geographic-authorization.service');
jest.mock('@prisma/client');

describe('GeographicAreaService', () => {
    let service: GeographicAreaService;
    let mockRepository: jest.Mocked<GeographicAreaRepository>;
    let mockGeographicAuthService: jest.Mocked<GeographicAuthorizationService>;
    let mockPrisma: jest.Mocked<PrismaClient>;

    beforeEach(() => {
        mockRepository = new GeographicAreaRepository(null as any) as jest.Mocked<GeographicAreaRepository>;
        mockGeographicAuthService = new GeographicAuthorizationService(null as any, null as any, null as any) as jest.Mocked<GeographicAuthorizationService>;
        mockPrisma = {
            venue: {
                count: jest.fn(),
                findMany: jest.fn(),
            },
            geographicArea: {
                count: jest.fn(),
            },
            activity: {
                count: jest.fn(),
            },
            assignment: {
                count: jest.fn(),
            },
            participantAddressHistory: {
                findMany: jest.fn(),
            },
        } as any;

        service = new GeographicAreaService(mockRepository, mockPrisma, mockGeographicAuthService);
        jest.clearAllMocks();
    });

    describe('getAllGeographicAreas', () => {
        it('should return all geographic areas', async () => {
            const mockAreas = [
                { id: '1', name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() },
            ];
            mockRepository.findAll = jest.fn().mockResolvedValue(mockAreas);

            const result = await service.getAllGeographicAreas();

            expect(result).toEqual(mockAreas);
        });
    });

    describe('getGeographicAreaById', () => {
        it('should return geographic area by ID', async () => {
            const mockArea = { id: '1', name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };
            mockRepository.findById = jest.fn().mockResolvedValue(mockArea);

            const result = await service.getGeographicAreaById('1');

            expect(result).toEqual(mockArea);
        });

        it('should throw error for non-existent area', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getGeographicAreaById('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('createGeographicArea', () => {
        it('should create geographic area with valid data', async () => {
            const input = { name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType };
            const mockArea = { id: '1', ...input, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };

            mockRepository.create = jest.fn().mockResolvedValue(mockArea);

            const result = await service.createGeographicArea(input);

            expect(result).toEqual(mockArea);
        });

        it('should throw error for missing required fields', async () => {
            await expect(service.createGeographicArea({ name: '', areaType: 'NEIGHBOURHOOD' as AreaType })).rejects.toThrow('required');
        });

        it('should validate parent area exists', async () => {
            const input = { name: 'Suburb', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: 'parent-1' };
            const mockArea = { id: '1', ...input, createdAt: new Date(), updatedAt: new Date() };

            mockRepository.exists = jest.fn().mockResolvedValue(true);
            mockRepository.create = jest.fn().mockResolvedValue(mockArea);

            const result = await service.createGeographicArea(input);

            expect(result).toEqual(mockArea);
            expect(mockRepository.exists).toHaveBeenCalledWith('parent-1');
        });

        it('should throw error for non-existent parent area', async () => {
            const input = { name: 'Suburb', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: 'invalid-parent' };

            mockRepository.exists = jest.fn().mockResolvedValue(false);

            await expect(service.createGeographicArea(input)).rejects.toThrow('Parent geographic area not found');
        });
    });

    describe('updateGeographicArea', () => {
        it('should update geographic area with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Downtown' };
            const existing = { id, name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };
            const updated = { ...existing, ...input };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.update = jest.fn().mockResolvedValue(updated);

            const result = await service.updateGeographicArea(id, input);

            expect(result).toEqual(updated);
        });

        it('should throw error for non-existent area', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.updateGeographicArea('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });

        it('should prevent circular parent-child relationships', async () => {
            const id = 'area-1';
            const input = { parentGeographicAreaId: 'area-2' };
            const existing = { id, name: 'Area 1', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.exists = jest.fn().mockResolvedValue(true);
            mockRepository.isDescendantOf = jest.fn().mockResolvedValue(true);

            await expect(service.updateGeographicArea(id, input)).rejects.toThrow('circular');
        });
    });

    describe('deleteGeographicArea', () => {
        it('should delete area when not referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countVenueReferences = jest.fn().mockResolvedValue(0);
            mockRepository.countChildReferences = jest.fn().mockResolvedValue(0);
            mockRepository.delete = jest.fn().mockResolvedValue(undefined);

            await service.deleteGeographicArea(id);

            expect(mockRepository.delete).toHaveBeenCalledWith(id);
        });

        it('should throw error when area has venues', async () => {
            const id = '1';
            const existing = { id, name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countVenueReferences = jest.fn().mockResolvedValue(3);

            await expect(service.deleteGeographicArea(id)).rejects.toThrow('referenced by');
        });

        it('should throw error when area has child areas', async () => {
            const id = '1';
            const existing = { id, name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countVenueReferences = jest.fn().mockResolvedValue(0);
            mockRepository.countChildReferences = jest.fn().mockResolvedValue(2);

            await expect(service.deleteGeographicArea(id)).rejects.toThrow('child geographic area');
        });
    });

    describe('getChildren', () => {
        it('should return child areas', async () => {
            const parentId = 'parent-1';
            const mockParent = { id: parentId, name: 'City', areaType: 'CITY' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };
            const mockChildren = [
                { id: 'child-1', name: 'Suburb', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: parentId, createdAt: new Date(), updatedAt: new Date() },
            ];

            mockRepository.findById = jest.fn().mockResolvedValue(mockParent);
            mockRepository.findChildren = jest.fn().mockResolvedValue(mockChildren);

            const result = await service.getChildren(parentId);

            expect(result).toEqual(mockChildren);
        });
    });

    describe('getBatchAncestors', () => {
        it('should return ancestor parent map', async () => {
            const areaId = '550e8400-e29b-41d4-a716-446655440001';
            const parentId = '550e8400-e29b-41d4-a716-446655440002';

            // Mock the repository to return a parent map
            mockRepository.findBatchAncestors = jest.fn().mockResolvedValue({
                [areaId]: parentId,
                [parentId]: null
            });

            const result = await service.getBatchAncestors([areaId]);

            // Should return parent map format
            expect(result).toEqual({
                [areaId]: parentId,
                [parentId]: null
            });
        });
    });

    describe('getVenues', () => {
        it('should return venues in area and descendants', async () => {
            const areaId = 'area-1';
            const mockArea = { id: areaId, name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockVenues = [
                { id: 'venue-1', name: 'Community Center', address: '123 Main St', geographicAreaId: areaId, latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: 'venue-2', name: 'Park', address: '456 Oak Ave', geographicAreaId: 'child-area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];

            mockRepository.findById = jest.fn().mockResolvedValue(mockArea);
            mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(['child-area-1', 'child-area-2']);
            (mockPrisma.venue.findMany as jest.Mock).mockResolvedValue(mockVenues);

            const result = await service.getVenues(areaId);

            expect(result).toEqual(mockVenues);
            expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith([areaId]);
            expect(mockPrisma.venue.findMany).toHaveBeenCalledWith({
                where: { geographicAreaId: { in: [areaId, 'child-area-1', 'child-area-2'] } },
                orderBy: { name: 'asc' },
            });
        });

        it('should return empty array when area has no venues', async () => {
            const areaId = 'area-1';
            const mockArea = { id: areaId, name: 'Empty Area', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockRepository.findById = jest.fn().mockResolvedValue(mockArea);
            mockRepository.findBatchDescendants = jest.fn().mockResolvedValue([]);
            (mockPrisma.venue.findMany as jest.Mock).mockResolvedValue([]);

            const result = await service.getVenues(areaId);

            expect(result).toEqual([]);
        });

        it('should throw error for non-existent area', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getVenues('non-existent')).rejects.toThrow('Geographic area not found');
        });
    });

    describe('getStatistics', () => {
        it('should calculate statistics for area and descendants', async () => {
            const areaId = 'area-1';
            const mockArea = { id: areaId, name: 'Downtown', areaType: 'NEIGHBOURHOOD' as AreaType, parentGeographicAreaId: null, createdAt: new Date(), updatedAt: new Date() };
            const mockDescendants = ['child-1', 'child-2'];

            mockRepository.findById = jest.fn().mockResolvedValue(mockArea);
            mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(mockDescendants);
            mockPrisma.venue.findMany = jest.fn().mockResolvedValue([
                { id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }, { id: 'v5' }
            ]);
            mockPrisma.venue.count = jest.fn().mockResolvedValue(5);
            mockPrisma.activity.count = jest.fn().mockResolvedValue(10);
            mockPrisma.assignment.count = jest.fn().mockResolvedValue(25);
            mockPrisma.participantAddressHistory.findMany = jest.fn().mockResolvedValue([
                { participantId: 'p1' },
                { participantId: 'p2' },
                { participantId: 'p3' },
            ]);

            const result = await service.getStatistics(areaId);

            expect(result).toHaveProperty('totalVenues', 5);
            expect(result).toHaveProperty('totalActivities', 10);
            expect(result).toHaveProperty('totalParticipants', 3);
            expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith([areaId]);
        });
    });
});
