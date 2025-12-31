import { Venue, VenueType } from '@prisma/client';
import { VenueRepository } from '../repositories/venue.repository';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { VenueImportSchema } from '../utils/validation.schemas';

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
    latitude?: number | null;
    longitude?: number | null;
    venueType?: VenueType | null;
    version?: number;
}

export class VenueService {
    constructor(
        private venueRepository: VenueRepository,
        private geographicAreaRepository: GeographicAreaRepository
    ) { }

    async getAllVenues(geographicAreaId?: string, search?: string): Promise<Venue[]> {
        // Build search filter
        const searchWhere = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { address: { contains: search, mode: 'insensitive' as const } }
            ]
        } : {};

        if (!geographicAreaId) {
            // No geographic filter, just apply search if provided
            if (search) {
                return this.venueRepository.search(search);
            }
            return this.venueRepository.findAll();
        }

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
        const areaIds = [geographicAreaId, ...descendantIds];

        // Filter venues by geographic area and search
        return this.venueRepository.findByGeographicAreaIds(areaIds, searchWhere);
    }

    async getAllVenuesPaginated(page?: number, limit?: number, geographicAreaId?: string, search?: string): Promise<PaginatedResponse<Venue>> {
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // Build search filter
        const searchWhere = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { address: { contains: search, mode: 'insensitive' as const } }
            ]
        } : {};

        if (!geographicAreaId) {
            // No geographic filter, just apply search if provided
            const { data, total } = await this.venueRepository.findAllPaginated(validPage, validLimit, searchWhere);
            return PaginationHelper.createResponse(data, validPage, validLimit, total);
        }

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
        const areaIds = [geographicAreaId, ...descendantIds];

        // Filter venues by geographic area with pagination and search
        const { data, total } = await this.venueRepository.findByGeographicAreaIdsPaginated(areaIds, validPage, validLimit, searchWhere);
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

        // Validate latitude range if provided (skip validation if explicitly null for clearing)
        if (data.latitude !== undefined && data.latitude !== null && (data.latitude < -90 || data.latitude > 90)) {
            throw new Error('Latitude must be between -90 and 90');
        }

        // Validate longitude range if provided (skip validation if explicitly null for clearing)
        if (data.longitude !== undefined && data.longitude !== null && (data.longitude < -180 || data.longitude > 180)) {
            throw new Error('Longitude must be between -180 and 180');
        }

        try {
            return await this.venueRepository.update(id, data);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new Error('VERSION_CONFLICT');
            }
            throw error;
        }
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

    async exportVenuesToCSV(geographicAreaId?: string): Promise<string> {
        // Get all venues (with geographic filter if provided)
        const venues = await this.getAllVenues(geographicAreaId);

        // Fetch venues with geographic area included
        const venuesWithArea = await Promise.all(
            venues.map(v => this.venueRepository.findById(v.id))
        );

        // Define CSV columns
        const columns = [
            'id',
            'name',
            'address',
            'geographicAreaId',
            'geographicAreaName',
            'latitude',
            'longitude',
            'venueType',
            'createdAt',
            'updatedAt'
        ];

        // Transform venues to CSV format
        const data = venuesWithArea.map(v => ({
            id: v!.id,
            name: v!.name,
            address: v!.address,
            geographicAreaId: v!.geographicAreaId,
            geographicAreaName: (v as any).geographicArea?.name || '',
            latitude: v!.latitude?.toString() || '',
            longitude: v!.longitude?.toString() || '',
            venueType: v!.venueType || '',
            createdAt: formatDateForCSV(v!.createdAt),
            updatedAt: formatDateForCSV(v!.updatedAt)
        }));

        return generateCSV({ columns, data });
    }

    async importVenuesFromCSV(fileBuffer: Buffer): Promise<ImportResult> {
        // Parse CSV
        let records: any[];
        try {
            records = parseCSV(fileBuffer);
        } catch (error) {
            throw new Error(`Invalid CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const result: ImportResult = {
            totalRows: records.length,
            successCount: 0,
            failureCount: 0,
            errors: []
        };

        // Process each record
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNumber = i + 2; // +2 for header row and 0-based index

            try {
                // Validate record
                const validated = VenueImportSchema.parse(record);

                // Create or update
                if (validated.id) {
                    // Update existing venue
                    await this.updateVenue(validated.id, {
                        name: validated.name,
                        address: validated.address,
                        geographicAreaId: validated.geographicAreaId,
                        latitude: validated.latitude,
                        longitude: validated.longitude,
                        venueType: validated.venueType
                    });
                } else {
                    // Create new venue
                    await this.createVenue({
                        name: validated.name,
                        address: validated.address,
                        geographicAreaId: validated.geographicAreaId,
                        latitude: validated.latitude,
                        longitude: validated.longitude,
                        venueType: validated.venueType
                    });
                }

                result.successCount++;
            } catch (error) {
                result.failureCount++;
                const errorMessages: string[] = [];

                if (error instanceof Error) {
                    errorMessages.push(error.message);
                } else if (typeof error === 'object' && error !== null && 'errors' in error) {
                    // Zod validation error
                    const zodError = error as any;
                    errorMessages.push(...zodError.errors.map((e: any) => e.message));
                } else {
                    errorMessages.push('Unknown error');
                }

                result.errors.push({
                    row: rowNumber,
                    data: record,
                    errors: errorMessages
                });
            }
        }

        return result;
    }
}
