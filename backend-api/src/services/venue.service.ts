import { Venue, VenueType } from '@prisma/client';
import { VenueRepository } from '../repositories/venue.repository';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { VenueImportSchema } from '../utils/validation.schemas';
import { AppError } from '../types/errors.types';
import { buildWhereClause, buildSelectClause, getValidFieldNames } from '../utils/query-builder.util';
import { transformParticipantResponses } from '../utils/participant.utils';
import { GeographicFilteringService } from './geographic-filtering.service';
import { PrismaClient } from '@prisma/client';

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

export interface FlexibleVenueQuery {
    page?: number;
    limit?: number;
    geographicAreaId?: string;
    // Removed legacy search parameter - use filter.name or filter.address instead
    filter?: Record<string, any>;
    fields?: string[];
    authorizedAreaIds?: string[];
    hasGeographicRestrictions?: boolean;
}

export class VenueService {
    private geographicFilteringService: GeographicFilteringService;

    constructor(
        private venueRepository: VenueRepository,
        private geographicAreaRepository: GeographicAreaRepository,
        private geographicAuthorizationService: GeographicAuthorizationService,
        prisma: PrismaClient
    ) {
        this.geographicFilteringService = new GeographicFilteringService(prisma);
    }

    async getAllVenues(
        geographicAreaId?: string,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<Venue[]> {
        // Removed legacy search parameter - use filter API instead

        // Determine effective geographic area IDs using shared service
        const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            // No geographic filter
            return this.venueRepository.findAll();
        }

        // Filter venues by geographic area
        return this.venueRepository.findByGeographicAreaIds(effectiveAreaIds, {});
    }

    /**
     * Get venues with flexible filtering and customizable attribute selection
     */
    async getVenuesFlexible(query: FlexibleVenueQuery): Promise<PaginatedResponse<Venue>> {
        const { page, limit, geographicAreaId, filter, fields, authorizedAreaIds = [], hasGeographicRestrictions = false } = query;
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // Removed legacy search parameter handling - use filter.name or filter.address instead

        // Build flexible filter where clause
        const flexibleWhere = filter ? buildWhereClause('venue', filter) : undefined;

        // Build select clause for attribute selection
        let select: any = undefined;
        if (fields && fields.length > 0) {
            try {
                const validFields = getValidFieldNames('venue');
                select = buildSelectClause(fields, validFields);
            } catch (error) {
                throw new AppError('INVALID_FIELDS', (error as Error).message, 400);
            }
        }

        // Determine effective geographic area IDs using shared service
        const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            // No geographic filter, just apply flexible filters
            const { data, total } = await this.venueRepository.findAllPaginated(validPage, validLimit, flexibleWhere, select);
            return PaginationHelper.createResponse(data, validPage, validLimit, total);
        }

        // Filter venues by geographic area with pagination and flexible filters
        const { data, total } = await this.venueRepository.findByGeographicAreaIdsPaginated(effectiveAreaIds, validPage, validLimit, flexibleWhere, select);
        return PaginationHelper.createResponse(data, validPage, validLimit, total);
    }

    async getVenueById(id: string, userId?: string, userRole?: string): Promise<Venue> {
        const venue = await this.venueRepository.findById(id);
        if (!venue) {
            throw new Error('Venue not found');
        }

        // Enforce geographic authorization if userId is provided
        if (userId) {
            // Administrator bypass
            if (userRole === 'ADMINISTRATOR') {
                return venue;
            }

            // Validate authorization to access the venue's geographic area
            const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
                userId,
                venue.geographicAreaId
            );

            if (accessLevel === AccessLevel.NONE) {
                await this.geographicAuthorizationService.logAuthorizationDenial(
                    userId,
                    'VENUE',
                    id,
                    'GET'
                );
                throw new AppError(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    'You do not have permission to access this venue',
                    403
                );
            }
        }

        return venue;
    }

    // Removed deprecated searchVenues method - use getVenuesFlexible with filter instead

    async createVenue(
        data: CreateVenueInput,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<Venue> {
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

        // Validate user has access to this geographic area
        if (hasGeographicRestrictions && !authorizedAreaIds.includes(data.geographicAreaId)) {
            throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to create venues in this geographic area');
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

    async updateVenue(
        id: string,
        data: UpdateVenueInput,
        userId?: string,
        userRole?: string
    ): Promise<Venue> {
        // Validate authorization by calling getVenueById (which enforces geographic authorization)
        await this.getVenueById(id, userId, userRole);

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

            // Validate user has access to the new geographic area
            if (userId) {
                const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
                    userId,
                    data.geographicAreaId
                );
                if (accessLevel === AccessLevel.NONE) {
                    throw new AppError(
                        'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        'You do not have permission to move this venue to the specified geographic area',
                        403
                    );
                }
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

    async deleteVenue(
        id: string,
        userId?: string,
        userRole?: string
    ): Promise<void> {
        // Validate authorization by calling getVenueById (which enforces geographic authorization)
        await this.getVenueById(id, userId, userRole);

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

    async getVenueActivities(venueId: string, userId?: string, userRole?: string) {
        // Validate authorization by calling getVenueById (which enforces geographic authorization)
        await this.getVenueById(venueId, userId, userRole);

        return this.venueRepository.findActivities(venueId);
    }

    async getVenueParticipants(venueId: string, userId?: string, userRole?: string) {
        // Validate authorization by calling getVenueById (which enforces geographic authorization)
        await this.getVenueById(venueId, userId, userRole);

        const participants = await this.venueRepository.findParticipants(venueId);
        // Transform to include flattened populations array
        return transformParticipantResponses(participants);
    }

    async exportVenuesToCSV(
        geographicAreaId?: string,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<string> {
        // Get all venues (with geographic filter if provided)
        const venues = await this.getAllVenues(geographicAreaId, authorizedAreaIds, hasGeographicRestrictions);

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
