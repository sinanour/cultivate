import { ParticipantService } from '../../services/participant.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient } from '@prisma/client';

describe('ParticipantService - Address History', () => {
    let service: ParticipantService;
    let participantRepository: ParticipantRepository;
    let addressHistoryRepository: ParticipantAddressHistoryRepository;
    let geographicAreaRepository: GeographicAreaRepository;
    let prisma: PrismaClient;
    let assignmentRepository: any;

    beforeEach(() => {
        prisma = new PrismaClient();
        participantRepository = new ParticipantRepository(prisma);
        addressHistoryRepository = new ParticipantAddressHistoryRepository(prisma);
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        geographicAreaRepository = new GeographicAreaRepository(prisma);
        assignmentRepository = {} as any; // Mock assignment repository for tests
        service = new ParticipantService(participantRepository, addressHistoryRepository, assignmentRepository, prisma, geographicAreaRepository);
    });

    describe('getAddressHistory', () => {
        it('should return address history ordered by effectiveFrom descending', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const history = [
                { id: 'history-3', participantId: 'participant-1', venueId: 'venue-3', effectiveFrom: new Date('2023-03-01'), createdAt: new Date() },
                { id: 'history-2', participantId: 'participant-1', venueId: 'venue-2', effectiveFrom: new Date('2023-02-01'), createdAt: new Date() },
                { id: 'history-1', participantId: 'participant-1', venueId: 'venue-1', effectiveFrom: new Date('2023-01-01'), createdAt: new Date() },
            ];

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findByParticipantId').mockResolvedValue(history as any);

            const result = await service.getAddressHistory('participant-1');

            expect(result).toEqual(history);
            expect(result[0].effectiveFrom!.getTime()).toBeGreaterThan(result[1].effectiveFrom!.getTime());
            expect(result[1].effectiveFrom!.getTime()).toBeGreaterThan(result[2].effectiveFrom!.getTime());
        });

        it('should throw error for non-existent participant', async () => {
            jest.spyOn(participantRepository, 'findById').mockResolvedValue(null);

            await expect(service.getAddressHistory('non-existent')).rejects.toThrow('Participant not found');
        });
    });

    describe('createAddressHistory', () => {
        it('should create address history with valid data', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const venue = { id: 'venue-1', name: 'Venue 1', address: '123 Main St' };
            const effectiveFrom = new Date('2023-01-01');
            const created = { id: 'history-1', participantId: 'participant-1', venueId: 'venue-1', effectiveFrom, createdAt: new Date() };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(prisma.venue, 'findUnique').mockResolvedValue(venue as any);
            jest.spyOn(addressHistoryRepository, 'hasDuplicateEffectiveFrom').mockResolvedValue(false);
            jest.spyOn(addressHistoryRepository, 'create').mockResolvedValue(created as any);

            const result = await service.createAddressHistory('participant-1', { venueId: 'venue-1', effectiveFrom });

            expect(result).toEqual(created);
            expect(addressHistoryRepository.create).toHaveBeenCalledWith({
                participantId: 'participant-1',
                venueId: 'venue-1',
                effectiveFrom,
            });
        });

        it('should throw error for non-existent participant', async () => {
            jest.spyOn(participantRepository, 'findById').mockResolvedValue(null);

            await expect(
                service.createAddressHistory('non-existent', { venueId: 'venue-1', effectiveFrom: new Date() })
            ).rejects.toThrow('Participant not found');
        });

        it('should throw error for non-existent venue', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(prisma.venue, 'findUnique').mockResolvedValue(null);

            await expect(
                service.createAddressHistory('participant-1', { venueId: 'non-existent', effectiveFrom: new Date() })
            ).rejects.toThrow('Venue not found');
        });

        it('should throw error for duplicate effectiveFrom', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const venue = { id: 'venue-1', name: 'Venue 1', address: '123 Main St' };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(prisma.venue, 'findUnique').mockResolvedValue(venue as any);
            jest.spyOn(addressHistoryRepository, 'hasDuplicateEffectiveFrom').mockResolvedValue(true);

            await expect(
                service.createAddressHistory('participant-1', { venueId: 'venue-1', effectiveFrom: new Date() })
            ).rejects.toThrow('An address history record with this effectiveFrom date already exists for this participant');
        });
    });

    describe('updateAddressHistory', () => {
        it('should update address history with valid data', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const history = { id: 'history-1', participantId: 'participant-1', venueId: 'venue-1', effectiveFrom: new Date('2023-01-01'), createdAt: new Date() };
            const venue = { id: 'venue-2', name: 'Venue 2', address: '456 Oak St' };
            const updated = { ...history, venueId: 'venue-2' };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(history as any);
            jest.spyOn(prisma.venue, 'findUnique').mockResolvedValue(venue as any);
            jest.spyOn(addressHistoryRepository, 'update').mockResolvedValue(updated as any);

            const result = await service.updateAddressHistory('participant-1', 'history-1', { venueId: 'venue-2' });

            expect(result).toEqual(updated);
            expect(addressHistoryRepository.update).toHaveBeenCalledWith('history-1', { venueId: 'venue-2' });
        });

        it('should throw error for non-existent participant', async () => {
            jest.spyOn(participantRepository, 'findById').mockResolvedValue(null);

            await expect(
                service.updateAddressHistory('non-existent', 'history-1', { venueId: 'venue-2' })
            ).rejects.toThrow('Participant not found');
        });

        it('should throw error for non-existent address history', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(null);

            await expect(
                service.updateAddressHistory('participant-1', 'non-existent', { venueId: 'venue-2' })
            ).rejects.toThrow('Address history record not found');
        });

        it('should throw error when history does not belong to participant', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const history = { id: 'history-1', participantId: 'participant-2', venueId: 'venue-1', effectiveFrom: new Date('2023-01-01'), createdAt: new Date() };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(history as any);

            await expect(
                service.updateAddressHistory('participant-1', 'history-1', { venueId: 'venue-2' })
            ).rejects.toThrow('Address history record does not belong to this participant');
        });

        it('should throw error for duplicate effectiveFrom when updating', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const history = { id: 'history-1', participantId: 'participant-1', venueId: 'venue-1', effectiveFrom: new Date('2023-01-01'), createdAt: new Date() };
            const newEffectiveFrom = new Date('2023-02-01');

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(history as any);
            jest.spyOn(addressHistoryRepository, 'hasDuplicateEffectiveFrom').mockResolvedValue(true);

            await expect(
                service.updateAddressHistory('participant-1', 'history-1', { effectiveFrom: newEffectiveFrom })
            ).rejects.toThrow('An address history record with this effectiveFrom date already exists for this participant');
        });
    });

    describe('deleteAddressHistory', () => {
        it('should delete address history', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const history = { id: 'history-1', participantId: 'participant-1', venueId: 'venue-1', effectiveFrom: new Date('2023-01-01'), createdAt: new Date() };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(history as any);
            jest.spyOn(addressHistoryRepository, 'delete').mockResolvedValue(undefined);

            await service.deleteAddressHistory('participant-1', 'history-1');

            expect(addressHistoryRepository.delete).toHaveBeenCalledWith('history-1');
        });

        it('should throw error for non-existent participant', async () => {
            jest.spyOn(participantRepository, 'findById').mockResolvedValue(null);

            await expect(
                service.deleteAddressHistory('non-existent', 'history-1')
            ).rejects.toThrow('Participant not found');
        });

        it('should throw error for non-existent address history', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(null);

            await expect(
                service.deleteAddressHistory('participant-1', 'non-existent')
            ).rejects.toThrow('Address history record not found');
        });

        it('should throw error when history does not belong to participant', async () => {
            const participant = { id: 'participant-1', name: 'John Doe', email: 'john@example.com' };
            const history = { id: 'history-1', participantId: 'participant-2', venueId: 'venue-1', effectiveFrom: new Date('2023-01-01'), createdAt: new Date() };

            jest.spyOn(participantRepository, 'findById').mockResolvedValue(participant as any);
            jest.spyOn(addressHistoryRepository, 'findById').mockResolvedValue(history as any);

            await expect(
                service.deleteAddressHistory('participant-1', 'history-1')
            ).rejects.toThrow('Address history record does not belong to this participant');
        });
    });
});
