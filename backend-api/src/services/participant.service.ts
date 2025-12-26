import { Participant } from '@prisma/client';
import { ParticipantRepository } from '../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../repositories/participant-address-history.repository';
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

export class ParticipantService {
    constructor(
        private participantRepository: ParticipantRepository,
        private addressHistoryRepository: ParticipantAddressHistoryRepository,
        private prisma: PrismaClient
    ) { }

    async getAllParticipants(): Promise<Participant[]> {
        return this.participantRepository.findAll();
    }

    async getAllParticipantsPaginated(page?: number, limit?: number): Promise<PaginatedResponse<Participant>> {
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });
        const { data, total } = await this.participantRepository.findAllPaginated(validPage, validLimit);
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

        // Handle home venue update with Type 2 SCD
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
                await this.prisma.$transaction(async (tx) => {
                    const now = new Date();

                    // Close current address if exists
                    if (currentAddress) {
                        await tx.participantAddressHistory.update({
                            where: { id: currentAddress.id },
                            data: { effectiveTo: now },
                        });
                    }

                    // Create new address history if new venue provided
                    if (data.homeVenueId) {
                        await tx.participantAddressHistory.create({
                            data: {
                                participantId: id,
                                venueId: data.homeVenueId,
                                effectiveFrom: now,
                            },
                        });
                    }
                });
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
}
