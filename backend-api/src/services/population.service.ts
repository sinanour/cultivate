import { Population } from '@prisma/client';
import { PopulationRepository } from '../repositories/population.repository';
import { ParticipantPopulationRepository } from '../repositories/participant-population.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { AppError } from '../types/errors.types';

export class PopulationService {
    constructor(
        private populationRepository: PopulationRepository,
        private participantPopulationRepository: ParticipantPopulationRepository,
        private participantRepository: ParticipantRepository
    ) { }

    async getAllPopulations(): Promise<Population[]> {
        return this.populationRepository.findAll();
    }

    async getPopulationById(id: string): Promise<Population> {
        const population = await this.populationRepository.findById(id);
        if (!population) {
            throw new AppError('NOT_FOUND', 'Population not found', 404);
        }
        return population;
    }

    async createPopulation(data: { name: string }): Promise<Population> {
        // Validate name uniqueness
        const existing = await this.populationRepository.findByName(data.name);
        if (existing) {
            throw new AppError('DUPLICATE_NAME', 'Population name already exists', 400);
        }

        return this.populationRepository.create(data);
    }

    async updatePopulation(id: string, data: { name?: string }): Promise<Population> {
        // Check if population exists
        await this.getPopulationById(id);

        // Validate name uniqueness if name is being updated
        if (data.name) {
            const existing = await this.populationRepository.findByName(data.name);
            if (existing && existing.id !== id) {
                throw new AppError('DUPLICATE_NAME', 'Population name already exists', 400);
            }
        }

        return this.populationRepository.update(id, data);
    }

    async deletePopulation(id: string): Promise<void> {
        // Check if population exists
        await this.getPopulationById(id);

        // Check for references
        const refCount = await this.populationRepository.countReferences(id);
        if (refCount > 0) {
            throw new AppError(
                'REFERENCED_ENTITY',
                `Cannot delete population: ${refCount} participant(s) reference it`,
                400
            );
        }

        await this.populationRepository.delete(id);
    }

    // Participant-Population Association Methods

    async getParticipantPopulations(participantId: string) {
        // Verify participant exists
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new AppError('NOT_FOUND', 'Participant not found', 404);
        }

        return this.participantPopulationRepository.findByParticipant(participantId);
    }

    async addParticipantToPopulation(participantId: string, populationId: string) {
        // Verify participant exists
        const participant = await this.participantRepository.findById(participantId);
        if (!participant) {
            throw new AppError('NOT_FOUND', 'Participant not found', 404);
        }

        // Verify population exists
        const population = await this.populationRepository.findById(populationId);
        if (!population) {
            throw new AppError('NOT_FOUND', 'Population not found', 404);
        }

        // Check for duplicate association
        const existing = await this.participantPopulationRepository.findByParticipantAndPopulation(
            participantId,
            populationId
        );
        if (existing) {
            throw new AppError(
                'DUPLICATE_ASSOCIATION',
                'Participant is already in this population',
                400
            );
        }

        return this.participantPopulationRepository.create(participantId, populationId);
    }

    async removeParticipantFromPopulation(participantId: string, populationId: string) {
        // Verify association exists
        const existing = await this.participantPopulationRepository.findByParticipantAndPopulation(
            participantId,
            populationId
        );
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Association not found', 404);
        }

        await this.participantPopulationRepository.delete(participantId, populationId);
    }
}
