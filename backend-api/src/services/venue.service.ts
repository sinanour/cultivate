import { Venue, VenueType } from '@prisma/client';
import { VenueRepository } from '../repositories/venue.repository';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';

export interface CreateVenueInput {
    name: string;
    address: string;
    geographicAreaId: string;
    latitude?: number;
    longitude?: number;
    venueType?: VenueType;
}

export interface UpdateVenueInput {
    name?: string;
    address?: string;
    geographicAreaId?: string;
    latitude?: number;
    longitude?: number;
    venueType?: VenueType;
}

export class VenueService {
    constructor(
        private venueRepository: VenueRepository,
        private geographicAreaRepository: GeographicAreaRepository
    ) { }

    async getAllVenues(): Promise<Venue[]> {
        return this.venueRepository.findAll();
    }

    async getAllVenuesPaginated(page?: number, limit?: number): Promise<PaginatedResponse<Venue>> {
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });
        const { data, total } = await this.venueRepository.findAllPaginated(validPage, validLimit);
        return PaginationHelper.createResponse(data, validPage, validLimit, total);
    }

    async getVenueById(id: string): Promise<Venue> {
        const venue = await this.venueRepository.findById(id);
        if (!venue) {
            throw new Error('Venue not found');
        }
        return venue;
    }

    async searchVenues(query: string): Promise<Venue[]> {
        if (!query || query.trim().length === 0) {
            return this.venueRepository.findAll();
        }
        return this.venueRepository.search(query);
    }

    async createVenue(data: CreateVenueInput): Promise<Venue> {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Venue name is required');
        }

        if (!data.address || data.address.trim().length === 0) {
            throw new Error('Venue address is required');
        }

        if (!data.geographicAreaId) {
            throw new Error('Geographic area ID is required');
        }

        // Validate geographic area exists
        const areaExists = await this.geographicAreaRepository.exists(data.geographicAreaId);
        if (!areaExists) {
            throw new Error('Geographic area not found');
        }

        // Validate latitude range if provided
        if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) {
            throw new Error('Latitude must be between -90 and 90');
        }

        // Validate longitude range if provided
        if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) {
            throw new Error('Longitude must be between -180 and 180');
        }

        return this.venueRepository.create(data);
    }

    async updateVenue(id: string, data: UpdateVenueInput): Promise<Venue> {
        const existing = await this.venueRepository.findById(id);
        if (!existing) {
            throw new Error('Venue not found');
        }

        // Validate geographic area exists if provided
        if (data.geographicAreaId) {
            const areaExists = await this.geographicAreaRepository.exists(data.geographicAreaId);
            if (!areaExists) {
                throw new Error('Geographic area not found');
            }
        }

        // Validate latitude range if provided
        if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) {
            throw new Error('Latitude must be between -90 and 90');
        }

        // Validate longitude range if provided
        if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) {
            throw new Error('Longitude must be between -180 and 180');
        }

        return this.venueRepository.update(id, data);
    }

    async deleteVenue(id: string): Promise<void> {
        const existing = await this.venueRepository.findById(id);
        if (!existing) {
            throw new Error('Venue not found');
        }

        // Check for activity references
        const activityCount = await this.venueRepository.countActivityReferences(id);
        const participantCount = await this.venueRepository.countParticipantReferences(id);

        if (activityCount > 0 || participantCount > 0) {
            const references: string[] = [];
            if (activityCount > 0) references.push(`${activityCount} activity(ies)`);
            if (participantCount > 0) references.push(`${participantCount} participant(s)`);

            throw new Error(`Cannot delete venue. It is referenced by ${references.join(' and ')}`);
        }

        await this.venueRepository.delete(id);
    }

    async getVenueActivities(venueId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) {
            throw new Error('Venue not found');
        }

        return this.venueRepository.findActivities(venueId);
    }

    async getVenueParticipants(venueId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) {
            throw new Error('Venue not found');
        }

        return this.venueRepository.findParticipants(venueId);
    }
}
