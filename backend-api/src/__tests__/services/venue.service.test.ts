import { VenueService } from '../../services/venue.service';
import { VenueRepository } from '../../repositories/venue.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';

jest.mock('../../repositories/venue.repository');
jest.mock('../../repositories/geographic-area.repository');
jest.mock('../../services/geographic-authorization.service');

describe('VenueService', () => {
    let service: VenueService;
    let mockVenueRepo: jest.Mocked<VenueRepository>;
    let mockGeoRepo: jest.Mocked<GeographicAreaRepository>;
    let mockGeographicAuthService: jest.Mocked<GeographicAuthorizationService>;

    beforeEach(() => {
        mockVenueRepo = new VenueRepository(null as any) as jest.Mocked<VenueRepository>;
        mockGeoRepo = new GeographicAreaRepository(null as any) as jest.Mocked<GeographicAreaRepository>;
        mockGeographicAuthService = new GeographicAuthorizationService(null as any, null as any, null as any) as jest.Mocked<GeographicAuthorizationService>;
        service = new VenueService(mockVenueRepo, mockGeoRepo, mockGeographicAuthService);
        jest.clearAllMocks();
    });

    describe('getAllVenues', () => {
        it('should return all venues', async () => {
            const mockVenues = [
                { id: '1', name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() },
            ];
            mockVenueRepo.findAll = jest.fn().mockResolvedValue(mockVenues);

            const result = await service.getAllVenues();

            expect(result).toEqual(mockVenues);
        });
    });

    describe('getVenueById', () => {
        it('should return venue by ID', async () => {
            const mockVenue = { id: '1', name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };
            mockVenueRepo.findById = jest.fn().mockResolvedValue(mockVenue);

            const result = await service.getVenueById('1');

            expect(result).toEqual(mockVenue);
        });

        it('should throw error for non-existent venue', async () => {
            mockVenueRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getVenueById('invalid-id')).rejects.toThrow('not found');
        });
    });



    describe('createVenue', () => {
        it('should create venue with valid data', async () => {
            const input = { name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1' };
            const mockVenue = { id: '1', ...input, latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };

            mockGeoRepo.exists = jest.fn().mockResolvedValue(true);
            mockVenueRepo.create = jest.fn().mockResolvedValue(mockVenue);

            const result = await service.createVenue(input);

            expect(result).toEqual(mockVenue);
            expect(mockGeoRepo.exists).toHaveBeenCalledWith('area-1');
        });

        it('should throw error for non-existent geographic area', async () => {
            const input = { name: 'Community Center', address: '123 Main St', geographicAreaId: 'invalid-area' };

            mockGeoRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.createVenue(input)).rejects.toThrow('Geographic area not found');
        });

        it('should throw error for missing required fields', async () => {
            await expect(service.createVenue({ name: '', address: '123 Main St', geographicAreaId: 'area-1' })).rejects.toThrow('required');
            await expect(service.createVenue({ name: 'Test', address: '', geographicAreaId: 'area-1' })).rejects.toThrow('required');
        });

        it('should validate latitude range', async () => {
            const input = { name: 'Test', address: '123 Main St', geographicAreaId: 'area-1', latitude: 100 };

            mockGeoRepo.exists = jest.fn().mockResolvedValue(true);

            await expect(service.createVenue(input)).rejects.toThrow('Latitude must be between -90 and 90');
        });

        it('should validate longitude range', async () => {
            const input = { name: 'Test', address: '123 Main St', geographicAreaId: 'area-1', longitude: 200 };

            mockGeoRepo.exists = jest.fn().mockResolvedValue(true);

            await expect(service.createVenue(input)).rejects.toThrow('Longitude must be between -180 and 180');
        });
    });

    describe('updateVenue', () => {
        it('should update venue with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Center' };
            const existing = { id, name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };
            const updated = { ...existing, ...input };

            mockVenueRepo.findById = jest.fn().mockResolvedValue(existing);
            mockVenueRepo.update = jest.fn().mockResolvedValue(updated);

            const result = await service.updateVenue(id, input);

            expect(result).toEqual(updated);
        });

        it('should throw error for non-existent venue', async () => {
            mockVenueRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.updateVenue('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });
    });

    describe('deleteVenue', () => {
        it('should delete venue when not referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };

            mockVenueRepo.findById = jest.fn().mockResolvedValue(existing);
            mockVenueRepo.countActivityReferences = jest.fn().mockResolvedValue(0);
            mockVenueRepo.countParticipantReferences = jest.fn().mockResolvedValue(0);
            mockVenueRepo.delete = jest.fn().mockResolvedValue(undefined);

            await service.deleteVenue(id);

            expect(mockVenueRepo.delete).toHaveBeenCalledWith(id);
        });

        it('should throw error when venue is referenced by activities', async () => {
            const id = '1';
            const existing = { id, name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };

            mockVenueRepo.findById = jest.fn().mockResolvedValue(existing);
            mockVenueRepo.countActivityReferences = jest.fn().mockResolvedValue(3);

            await expect(service.deleteVenue(id)).rejects.toThrow('referenced by');
        });

        it('should throw error when venue is referenced by participants', async () => {
            const id = '1';
            const existing = { id, name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };

            mockVenueRepo.findById = jest.fn().mockResolvedValue(existing);
            mockVenueRepo.countActivityReferences = jest.fn().mockResolvedValue(0);
            mockVenueRepo.countParticipantReferences = jest.fn().mockResolvedValue(2);

            await expect(service.deleteVenue(id)).rejects.toThrow('referenced by');
        });
    });

    describe('getVenueActivities', () => {
        it('should return activities at venue', async () => {
            const venueId = 'venue-1';
            const mockVenue = { id: venueId, name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };
            const mockActivities = [
                { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
            ];

            mockVenueRepo.findById = jest.fn().mockResolvedValue(mockVenue);
            mockVenueRepo.findActivities = jest.fn().mockResolvedValue(mockActivities);

            const result = await service.getVenueActivities(venueId);

            expect(result).toEqual(mockActivities);
        });

        it('should throw error for non-existent venue', async () => {
            mockVenueRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getVenueActivities('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('getVenueParticipants', () => {
        it('should return participants with venue as home', async () => {
            const venueId = 'venue-1';
            const mockVenue = { id: venueId, name: 'Community Center', address: '123 Main St', geographicAreaId: 'area-1', latitude: null, longitude: null, venueType: null, createdAt: new Date(), updatedAt: new Date() };
            const mockParticipants = [
                { id: 'p1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
            ];

            mockVenueRepo.findById = jest.fn().mockResolvedValue(mockVenue);
            mockVenueRepo.findParticipants = jest.fn().mockResolvedValue(mockParticipants);

            const result = await service.getVenueParticipants(venueId);

            expect(result).toEqual(mockParticipants);
        });

        it('should throw error for non-existent venue', async () => {
            mockVenueRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getVenueParticipants('invalid-id')).rejects.toThrow('not found');
        });
    });
});
