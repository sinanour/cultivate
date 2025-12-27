import { ParticipantService } from '../../services/participant.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('../../repositories/participant.repository');
jest.mock('../../repositories/participant-address-history.repository');
jest.mock('../../repositories/geographic-area.repository');
jest.mock('@prisma/client');

describe('ParticipantService', () => {
    let service: ParticipantService;
    let mockParticipantRepo: jest.Mocked<ParticipantRepository>;
    let mockAddressHistoryRepo: jest.Mocked<ParticipantAddressHistoryRepository>;
    let mockGeographicAreaRepo: jest.Mocked<GeographicAreaRepository>;
    let mockPrisma: jest.Mocked<PrismaClient>;

    beforeEach(() => {
        mockParticipantRepo = new ParticipantRepository(null as any) as jest.Mocked<ParticipantRepository>;
        mockAddressHistoryRepo = new ParticipantAddressHistoryRepository(null as any) as jest.Mocked<ParticipantAddressHistoryRepository>;
        mockGeographicAreaRepo = new GeographicAreaRepository(null as any) as jest.Mocked<GeographicAreaRepository>;

        const mockTx = {
            participant: {
                create: jest.fn().mockResolvedValue({ id: '1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() }),
            },
            participantAddressHistory: {
                create: jest.fn().mockResolvedValue({}),
                update: jest.fn().mockResolvedValue({}),
            },
        };

        mockPrisma = {
            $transaction: jest.fn().mockImplementation(async (callback) => {
                return await callback(mockTx);
            }),
            venue: {
                findUnique: jest.fn(),
            },
        } as any;

        const mockAssignmentRepo = {} as any;

        service = new ParticipantService(mockParticipantRepo, mockAddressHistoryRepo, mockAssignmentRepo, mockPrisma, mockGeographicAreaRepo);
        jest.clearAllMocks();
    });

    describe('getAllParticipants', () => {
        it('should return all participants', async () => {
            const mockParticipants = [
                { id: '1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
                { id: '2', name: 'Jane Doe', email: 'jane@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
            ];
            mockParticipantRepo.findAll = jest.fn().mockResolvedValue(mockParticipants);

            const result = await service.getAllParticipants();

            expect(result).toEqual(mockParticipants);
        });
    });

    describe('getParticipantById', () => {
        it('should return participant by ID', async () => {
            const mockParticipant = { id: '1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };
            mockParticipantRepo.findById = jest.fn().mockResolvedValue(mockParticipant);

            const result = await service.getParticipantById('1');

            expect(result).toEqual(mockParticipant);
        });

        it('should throw error for non-existent participant', async () => {
            mockParticipantRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getParticipantById('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('searchParticipants', () => {
        it('should search participants by query', async () => {
            const mockParticipants = [
                { id: '1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
            ];
            mockParticipantRepo.search = jest.fn().mockResolvedValue(mockParticipants);

            const result = await service.searchParticipants('John');

            expect(result).toEqual(mockParticipants);
            expect(mockParticipantRepo.search).toHaveBeenCalledWith('John');
        });

        it('should return all participants for empty query', async () => {
            const mockParticipants = [
                { id: '1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
            ];
            mockParticipantRepo.findAll = jest.fn().mockResolvedValue(mockParticipants);

            const result = await service.searchParticipants('');

            expect(result).toEqual(mockParticipants);
            expect(mockParticipantRepo.findAll).toHaveBeenCalled();
        });
    });

    describe('createParticipant', () => {
        it('should create participant with valid data', async () => {
            const input = { name: 'John Doe', email: 'john@example.com', phone: '123-456-7890', notes: 'Test notes' };

            mockParticipantRepo.findByEmail = jest.fn().mockResolvedValue(null);

            const result = await service.createParticipant(input);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name', 'John Doe');
            expect(mockParticipantRepo.findByEmail).toHaveBeenCalledWith('john@example.com');
        });

        it('should create participant with home venue', async () => {
            const input = { name: 'John Doe', email: 'john@example.com', homeVenueId: 'venue-1' };

            mockParticipantRepo.findByEmail = jest.fn().mockResolvedValue(null);
            mockPrisma.venue.findUnique = jest.fn().mockResolvedValue({ id: 'venue-1' });

            const result = await service.createParticipant(input);

            expect(result).toHaveProperty('id');
            expect(mockPrisma.venue.findUnique).toHaveBeenCalledWith({ where: { id: 'venue-1' } });
        });

        it('should throw error for duplicate email', async () => {
            const input = { name: 'John Doe', email: 'john@example.com' };
            const existing = { id: '1', name: 'Existing', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

            mockParticipantRepo.findByEmail = jest.fn().mockResolvedValue(existing);

            await expect(service.createParticipant(input)).rejects.toThrow('already exists');
        });

        it('should throw error for missing required fields', async () => {
            await expect(service.createParticipant({ name: '', email: 'test@example.com' })).rejects.toThrow('required');
            await expect(service.createParticipant({ name: 'John', email: '' })).rejects.toThrow('required');
        });

        it('should throw error for invalid email format', async () => {
            const input = { name: 'John Doe', email: 'invalid-email' };

            await expect(service.createParticipant(input)).rejects.toThrow('Invalid email');
        });

        it('should throw error for non-existent home venue', async () => {
            const input = { name: 'John Doe', email: 'john@example.com', homeVenueId: 'invalid-venue' };

            mockParticipantRepo.findByEmail = jest.fn().mockResolvedValue(null);
            mockPrisma.venue.findUnique = jest.fn().mockResolvedValue(null);

            await expect(service.createParticipant(input)).rejects.toThrow('not found');
        });
    });

    describe('updateParticipant', () => {
        it('should update participant with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Name', email: 'updated@example.com' };
            const existing = { id, name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };
            const updated = { ...existing, ...input };

            mockParticipantRepo.findById = jest.fn().mockResolvedValue(existing);
            mockParticipantRepo.findByEmail = jest.fn().mockResolvedValue(null);
            mockAddressHistoryRepo.getCurrentAddress = jest.fn().mockResolvedValue(null);
            mockParticipantRepo.update = jest.fn().mockResolvedValue(updated);

            const result = await service.updateParticipant(id, input);

            expect(result).toEqual(updated);
        });

        it('should throw error for non-existent participant', async () => {
            mockParticipantRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.updateParticipant('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });

        it('should throw error for duplicate email', async () => {
            const id = '1';
            const input = { email: 'duplicate@example.com' };
            const existing = { id, name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };
            const duplicate = { id: '2', name: 'Other', email: 'duplicate@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

            mockParticipantRepo.findById = jest.fn().mockResolvedValue(existing);
            mockParticipantRepo.findByEmail = jest.fn().mockResolvedValue(duplicate);

            await expect(service.updateParticipant(id, input)).rejects.toThrow('already exists');
        });
    });

    describe('deleteParticipant', () => {
        it('should delete participant', async () => {
            const id = '1';
            const existing = { id, name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

            mockParticipantRepo.findById = jest.fn().mockResolvedValue(existing);
            mockParticipantRepo.delete = jest.fn().mockResolvedValue(undefined);

            await service.deleteParticipant(id);

            expect(mockParticipantRepo.delete).toHaveBeenCalledWith(id);
        });

        it('should throw error for non-existent participant', async () => {
            mockParticipantRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.deleteParticipant('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('getAddressHistory', () => {
        it('should return address history for participant', async () => {
            const participantId = '1';
            const mockParticipant = { id: '1', name: 'John Doe', email: 'john@example.com', phone: null, notes: null, createdAt: new Date(), updatedAt: new Date() };
            const mockHistory = [
                { id: '1', participantId, venueId: 'venue-1', effectiveFrom: new Date('2024-01-01'), createdAt: new Date() },
            ];

            mockParticipantRepo.findById = jest.fn().mockResolvedValue(mockParticipant);
            mockAddressHistoryRepo.findByParticipantId = jest.fn().mockResolvedValue(mockHistory);

            const result = await service.getAddressHistory(participantId);

            expect(result).toEqual(mockHistory);
            expect(mockAddressHistoryRepo.findByParticipantId).toHaveBeenCalledWith(participantId);
        });

        it('should throw error for non-existent participant', async () => {
            mockParticipantRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getAddressHistory('invalid-id')).rejects.toThrow('not found');
        });
    });
});
