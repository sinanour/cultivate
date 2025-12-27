import { Participant } from '@prisma/client';
import { ParticipantRepository } from '../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { PrismaClient } from '@prisma/client';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';

export interface CreateParticipantInput {
    name: string;
    email: string;
    phone?: string;
    notes?: string;
    homeVenueId?: string;
}

export interface UpdateParticipantInput {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    homeVenueId?: string;
    version?: number;
}

export interface CreateAddressHistoryInput {
    venueId: string;
    effectiveFrom: Date;
}

export interface UpdateAddressHistoryInput {
    venueId?: string;
    effectiveFrom?: Date;
}

export class ParticipantService {
    constructor(
        private participantRepository: ParticipantRepository,
        private addressHistoryRepository: ParticipantAddressHistoryRepository,
        private assignmentRepository: AssignmentRepository,
        private prisma: PrismaClient,
        private geographicAreaRepository: GeographicAreaRepository
    ) { }

    async getAllParticipants(geographicAreaId?: string): Promise<Participant[]> {
        if (!geographicAreaId) {
            return this.participantRepository.findAll();
        }

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
        const areaIds = [geographicAreaId, ...descendantIds];

        // Get all participants with their most recent address
        const allParticipants = await this.prisma.participant.findMany({
            include: {
                addressHistory: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                    include: { venue: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Filter to only those whose current address is in the geographic area
        const filteredParticipants = allParticipants.filter(p =>
            p.addressHistory.length > 0 &&
            areaIds.includes(p.addressHistory[0].venue.geographicAreaId)
        );

        // Remove the included relations for the response
        return filteredParticipants.map(({ addressHistory, ...participant }) => participant as Participant);
    }

    async getAllParticipantsPaginated(page?: number, limit?: number, geographicAreaId?: string): Promise<PaginatedResponse<Participant>> {
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        if (!geographicAreaId) {
            const { data, total } = await this.participantRepository.findAllPaginated(validPage, validLimit);
            return PaginationHelper.createResponse(data, validPage, validLimit, total);
        }

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
        const areaIds = [geographicAreaId, ...descendantIds];

        // Get all participants with their most recent address
        const allParticipants = await this.prisma.participant.findMany({
            include: {
                addressHistory: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                    include: { venue: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Filter to only those whose current address is in the geographic area
        const filteredParticipants = allParticipants.filter(p =>
            p.addressHistory.length > 0 &&
            areaIds.includes(p.addressHistory[0].venue.geographicAreaId)
        );

        // Apply pagination
        const total = filteredParticipants.length;
        const skip = (validPage - 1) * validLimit;
        const paginatedParticipants = filteredParticipants.slice(skip, skip + validLimit);

        // Remove the included relations for the response
        const data = paginatedParticipants.map(({ addressHistory, ...participant }) => participant as Participant);

        return PaginationHelper.createResponse(data, validPage, validLimit, total);
    }

    async getParticipantById(id: string): Promise<Participant> {
        const participant = await this.participantRepository.findById(id);
        if (!participant) {
            throw new Error('Participant not found');
        }
        return participant;
    }

    async searchParticipants(query: string): Promise<Participant[]> {
        if (!query || query.trim().length === 0) {
            return this.participantRepository.findAll();
        }
        return this.participantRepository.search(query);
    }

    async createParticipant(data: CreateParticipantInput): Promise<Participant> {
        // Validate required fields
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Participant name is required');
        }
        if (!data.email || data.email.trim().length === 0) {
            throw new Error('Participant email is required');
        }

        // Validate email format (basic check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            throw new Error('Invalid email format');
        }

        // Validate email uniqueness
        const existing = await this.participantRepository.findByEmail(data.email);
        if (existing) {
            throw new Error('Participant with this email already exists');
        }

        // Validate home venue if provided
        if (data.homeVenueId) {
            const venueExists = await this.prisma.venue.findUnique({
                where: { id: data.homeVenueId },
            });
            if (!venueExists) {
                throw new Error('Home venue not found');
            }
        }

        // Create participant and address history in a transaction
        return this.prisma.$transaction(async (tx) => {
            const participant = await tx.participant.create({
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    notes: data.notes,
                },
            });

            // Create initial address history if home venue provided
            if (data.homeVenueId) {
                await tx.participantAddressHistory.create({
                    data: {
                        participantId: participant.id,
                        venueId: data.homeVenueId,
                        effectiveFrom: new Date(),
                    },
                });
            }

            return participant;
        });
    }

    async updateParticipant(id: string, data: UpdateParticipantInput): Promise<Participant> {
        const existing = await this.participantRepository.findById(id);
        if (!existing) {
            throw new Error('Participant not found');
        }

        // Validate email format if provided
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                throw new Error('Invalid email format');
            }

            // Validate email uniqueness
            const duplicate = await this.participantRepository.findByEmail(data.email);
            if (duplicate && duplicate.id !== id) {
                throw new Error('Participant with this email already exists');
            }
        }

        // Handle home venue update with simplified temporal tracking
        if (data.homeVenueId !== undefined) {
            // Validate venue exists
            if (data.homeVenueId) {
                const venueExists = await this.prisma.venue.findUnique({
                    where: { id: data.homeVenueId },
                });
                if (!venueExists) {
                    throw new Error('Home venue not found');
                }
            }

            // Get current address
            const currentAddress = await this.addressHistoryRepository.getCurrentAddress(id);

            // Only update if venue is different
            if (!currentAddress || currentAddress.venueId !== data.homeVenueId) {
                // Create new address history if new venue provided
                if (data.homeVenueId) {
                    const now = new Date();

                    // Check for duplicate effectiveFrom
                    const hasDuplicate = await this.addressHistoryRepository.hasDuplicateEffectiveFrom(
                        id,
                        now
                    );

                    if (!hasDuplicate) {
                        await this.prisma.participantAddressHistory.create({
                            data: {
                                participantId: id,
                                venueId: data.homeVenueId,
                                effectiveFrom: now,
                            },
                        });
                    }
                }
            }
        }

        // Update participant basic fields
        const updateData: { name?: string; email?: string; phone?: string; notes?: string; version?: number } = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.version !== undefined) updateData.version = data.version;

        try {
            return await this.participantRepository.update(id, updateData);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new Error('VERSION_CONFLICT');
            }
            throw error;
        }
    }

    async deleteParticipant(id: string): Promise<void> {
        const existing = await this.participantRepository.findById(id);
        if (!existing) {
            throw new Error('Participant not found');
        }

        await this.participantRepository.delete(id);
    }

    async getAddressHistory(participantId: string) {
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        return this.addressHistoryRepository.findByParticipantId(participantId);
    }

    async createAddressHistory(participantId: string, data: CreateAddressHistoryInput) {
        // Validate participant exists
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        // Validate venue exists
        const venue = await this.prisma.venue.findUnique({
            where: { id: data.venueId },
        });
        if (!venue) {
            throw new Error('Venue not found');
        }

        // Check for duplicate effectiveFrom
        const hasDuplicate = await this.addressHistoryRepository.hasDuplicateEffectiveFrom(
            participantId,
            data.effectiveFrom
        );
        if (hasDuplicate) {
            throw new Error('An address history record with this effectiveFrom date already exists for this participant');
        }

        return this.addressHistoryRepository.create({
            participantId,
            venueId: data.venueId,
            effectiveFrom: data.effectiveFrom,
        });
    }

    async updateAddressHistory(
        participantId: string,
        historyId: string,
        data: UpdateAddressHistoryInput
    ) {
        // Validate participant exists
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        // Validate address history record exists and belongs to participant
        const history = await this.addressHistoryRepository.findById(historyId);
        if (!history) {
            throw new Error('Address history record not found');
        }
        if (history.participantId !== participantId) {
            throw new Error('Address history record does not belong to this participant');
        }

        // Validate venue if provided
        if (data.venueId) {
            const venue = await this.prisma.venue.findUnique({
                where: { id: data.venueId },
            });
            if (!venue) {
                throw new Error('Venue not found');
            }
        }

        // Check for duplicate effectiveFrom if updating effectiveFrom
        if (data.effectiveFrom) {
            const hasDuplicate = await this.addressHistoryRepository.hasDuplicateEffectiveFrom(
                participantId,
                data.effectiveFrom,
                historyId
            );
            if (hasDuplicate) {
                throw new Error('An address history record with this effectiveFrom date already exists for this participant');
            }
        }

        return this.addressHistoryRepository.update(historyId, data);
    }

    async deleteAddressHistory(participantId: string, historyId: string) {
        // Validate participant exists
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        // Validate address history record exists and belongs to participant
        const history = await this.addressHistoryRepository.findById(historyId);
        if (!history) {
            throw new Error('Address history record not found');
        }
        if (history.participantId !== participantId) {
            throw new Error('Address history record does not belong to this participant');
        }

        await this.addressHistoryRepository.delete(historyId);
    }

    async getParticipantActivities(participantId: string) {
        // Validate participant exists
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        // Get assignments with activity and role details
        return this.assignmentRepository.findByParticipantId(participantId);
    }
}
