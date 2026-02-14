import { Participant } from '@prisma/client';
import { ParticipantRepository } from '../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { PrismaClient } from '@prisma/client';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { ParticipantImportSchema } from '../utils/validation.schemas';
import { AppError } from '../types/errors.types';
import { buildWhereClause, buildSelectClause, getValidFieldNames } from '../utils/query-builder.util';
import { transformParticipantResponses, transformParticipantResponse } from '../utils/participant.utils';
import { GeographicFilteringService } from './geographic-filtering.service';
import { calculateAgeCohort, buildAgeCohortFilter, AgeCohort } from '../utils/age-cohort.utils';

export interface CreateParticipantInput {
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
    dateOfBirth?: string;
    dateOfRegistration?: string;
    nickname?: string;
    homeVenueId?: string;
}

export interface UpdateParticipantInput {
    name?: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    dateOfBirth?: string | null;
    dateOfRegistration?: string | null;
    nickname?: string | null;
    homeVenueId?: string | null;
    version?: number;
}

export interface CreateAddressHistoryInput {
    venueId: string;
    effectiveFrom: Date | null;
}

export interface UpdateAddressHistoryInput {
    venueId?: string;
    effectiveFrom?: Date | null;
}

export interface FlexibleParticipantQuery {
    page?: number;
    limit?: number;
    geographicAreaId?: string;
    // Removed legacy search parameter - use filter.name or filter.email instead
    filter?: Record<string, any>;
    fields?: string[];
    authorizedAreaIds?: string[];
    hasGeographicRestrictions?: boolean;
}

export class ParticipantService {
    private geographicFilteringService: GeographicFilteringService;

    constructor(
        private participantRepository: ParticipantRepository,
        private addressHistoryRepository: ParticipantAddressHistoryRepository,
        private assignmentRepository: AssignmentRepository,
        private prisma: PrismaClient,
        private geographicAuthorizationService: GeographicAuthorizationService
    ) {
        this.geographicFilteringService = new GeographicFilteringService(prisma);
    }

    async getAllParticipants(geographicAreaId?: string, authorizedAreaIds: string[] = [], hasGeographicRestrictions: boolean = false): Promise<Participant[]> {
    // Removed legacy search parameter - use filter API instead

        // Determine effective geographic area IDs using shared service
        const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            // No geographic filter
            return this.participantRepository.findAll();
        }

        // Use effective area IDs for filtering
        const areaIds = effectiveAreaIds;

        // Get all participants with their most recent address
        type ParticipantWithAddress = Participant & {
            addressHistory: Array<{
                venue: { id: string; geographicAreaId: string };
            }>;
        };

        const allParticipants = await this.prisma.participant.findMany({
            include: {
                addressHistory: {
                    where: {
                        venue: {}, // Only include address history with valid venues (venue exists)
                    },
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                    include: { venue: true }
                }
            },
            orderBy: { name: 'asc' }
        }) as ParticipantWithAddress[];

        // Filter to only those whose current address is in the geographic area
        const filteredParticipants = allParticipants.filter(p =>
            p.addressHistory.length > 0 &&
            p.addressHistory[0].venue && // Ensure venue exists
            areaIds.includes(p.addressHistory[0].venue.geographicAreaId)
        );

        // Remove the included relations for the response
        return filteredParticipants.map(({ addressHistory, ...participant }) => participant as Participant);
    }

    /**
     * Get participants with flexible filtering and customizable attribute selection
     * Supports unified filter[fieldName] + fields parameters
     */
    async getParticipantsFlexible(query: FlexibleParticipantQuery): Promise<PaginatedResponse<Participant>> {
        const { page, limit, geographicAreaId, filter, fields, authorizedAreaIds = [], hasGeographicRestrictions = false } = query;
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // Removed legacy search parameter handling - use filter.name or filter.email instead

        // Extract ageCohorts from filter for special handling (requires date range conversion)
        let ageCohortWhere: any = undefined;
        let filterWithoutCohorts = filter;

        if (filter?.ageCohorts) {
            // Normalize to array
            const cohortsRaw = filter.ageCohorts;
            const cohorts = Array.isArray(cohortsRaw)
                ? cohortsRaw
                : (typeof cohortsRaw === 'string'
                    ? cohortsRaw.split(',').map(v => v.trim()).filter(v => v.length > 0)
                    : [cohortsRaw]);

            if (cohorts.length > 0) {
                // Validate cohort names
                const validCohorts = Object.values(AgeCohort);
                const invalidCohorts = cohorts.filter(c => !validCohorts.includes(c as AgeCohort));
                if (invalidCohorts.length > 0) {
                    throw new AppError(
                        'VALIDATION_ERROR',
                        `Invalid age cohort names: ${invalidCohorts.join(', ')}. Valid values are: ${validCohorts.join(', ')}`,
                        400
                    );
                }

                // Convert cohorts to date range conditions
                ageCohortWhere = buildAgeCohortFilter(cohorts as AgeCohort[]);
            }

            // Remove ageCohorts from filter object to avoid passing to buildWhereClause
            const { ageCohorts: _, ...restFilter } = filter;
            filterWithoutCohorts = restFilter;
        }

        // Extract populationIds from filter for special handling (many-to-many relationship)
        let populationWhere: any = undefined;
        let filterWithoutPopulations = filterWithoutCohorts;

        if (filterWithoutCohorts?.populationIds) {
            // Normalize to array (handle comma-separated strings)
            const populationIdsRaw = filterWithoutCohorts.populationIds;
            const populationIds = Array.isArray(populationIdsRaw)
                ? populationIdsRaw
                : (typeof populationIdsRaw === 'string'
                    ? populationIdsRaw.split(',').map(v => v.trim()).filter(v => v.length > 0)
                    : [populationIdsRaw]);

            if (populationIds.length > 0) {
                // Build nested query for many-to-many relationship through ParticipantPopulation
                populationWhere = {
                    participantPopulations: {
                        some: {
                            populationId: { in: populationIds }
                        }
                    }
                };
            }

            // Remove populationIds from filter object to avoid passing to buildWhereClause
            const { populationIds: _, ...restFilter } = filterWithoutCohorts;
            filterWithoutPopulations = restFilter;
        }

        // Build flexible filter where clause (without populationIds and ageCohorts)
        const flexibleWhere = filterWithoutPopulations ? buildWhereClause('participant', filterWithoutPopulations) : undefined;

        // Merge all filters using AND logic
        const whereClauses = [ageCohortWhere, populationWhere, flexibleWhere].filter(Boolean);
        let combinedWhere: any = undefined;
        if (whereClauses.length > 1) {
            combinedWhere = { AND: whereClauses };
        } else if (whereClauses.length === 1) {
            combinedWhere = whereClauses[0];
        }

        // Build select clause for attribute selection
        let select: any = undefined;
        if (fields && fields.length > 0) {
            try {
                const validFields = getValidFieldNames('participant');
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
            const { data, total } = await this.participantRepository.findAllPaginated(validPage, validLimit, combinedWhere, select);
            const transformedData = select ? data : transformParticipantResponses(data);

            return PaginationHelper.createResponse(transformedData, validPage, validLimit, total);
        }

        // Use effective area IDs for filtering
        const areaIds = effectiveAreaIds;

        // Get all participants with their most recent address
        type ParticipantWithAddress = Participant & {
            addressHistory: Array<{
                venue: { id: string; geographicAreaId: string };
            }>;
        };

        // Build query options
        const queryOptions: any = {
            where: combinedWhere,
            orderBy: { name: 'asc' }
        };

        if (select) {
            queryOptions.select = select;
        } else {
            queryOptions.include = {
                addressHistory: {
                    where: {
                        venue: {}, // Only include address history with valid venues
                    },
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                    include: { venue: true }
                },
                participantPopulations: {
                    include: {
                        population: {
                            select: { id: true, name: true }
                        }
                    }
                }
            };
        }

        const allParticipants = await this.prisma.participant.findMany(queryOptions) as any;

        // When using select, we need to fetch address history separately for filtering
        let filteredParticipants: any[];
        if (select) {
            // Fetch participant IDs that match geographic filter
            const participantsWithAddress = await this.prisma.participant.findMany({
                where: combinedWhere,
                include: {
                    addressHistory: {
                        where: { venue: {} },
                        orderBy: { effectiveFrom: 'desc' },
                        take: 1,
                        include: { venue: true }
                    }
                }
            }) as ParticipantWithAddress[];

            const matchingIds = participantsWithAddress
                .filter(p =>
                    p.addressHistory.length > 0 &&
                    p.addressHistory[0].venue &&
                    areaIds.includes(p.addressHistory[0].venue.geographicAreaId)
                )
                .map(p => p.id);

            // Filter selected participants to only those matching geographic filter
            filteredParticipants = allParticipants.filter((p: any) => matchingIds.includes(p.id));
        } else {
            // Filter to only those whose current address is in the geographic area
            filteredParticipants = allParticipants.filter((p: ParticipantWithAddress) =>
                p.addressHistory.length > 0 &&
                p.addressHistory[0].venue &&
                areaIds.includes(p.addressHistory[0].venue.geographicAreaId)
            );
        }

        // Apply pagination
        const total = filteredParticipants.length;
        const skip = (validPage - 1) * validLimit;
        const paginatedParticipants = filteredParticipants.slice(skip, skip + validLimit);

        // Remove the included relations for the response (if not using select) and transform populations + add ageCohort
        const data = select
            ? paginatedParticipants
            : paginatedParticipants.map(({ addressHistory, ...participant }: any) => {
                // Transform to include flattened populations array and ageCohort
                return transformParticipantResponse(participant);
            });

        return PaginationHelper.createResponse(data, validPage, validLimit, total);
    }

    async getParticipantById(id: string, userId?: string, userRole?: string): Promise<Participant & { ageCohort: string }> {
        const participant = await this.participantRepository.findById(id);
        if (!participant) {
            throw new Error('Participant not found');
        }

        // Enforce geographic authorization if userId is provided
        if (userId) {
            // Administrator bypass
            if (userRole === 'ADMINISTRATOR') {
                return {
                    ...participant,
                    ageCohort: calculateAgeCohort(participant.dateOfBirth)
                };
            }

            // Determine participant's current home venue from address history
            const currentAddress = await this.addressHistoryRepository.getCurrentAddress(id);

            if (currentAddress) {
                // Get the venue to access its geographic area
                const venue = await this.prisma.venue.findUnique({
                    where: { id: currentAddress.venueId },
                });

                if (venue) {
                    // Validate authorization to access the venue's geographic area
                    const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
                        userId,
                        venue.geographicAreaId
                    );

                    if (accessLevel === AccessLevel.NONE) {
                        // Log authorization denial
                        await this.geographicAuthorizationService.logAuthorizationDenial(
                            userId,
                            'PARTICIPANT',
                            id,
                            'GET'
                        );

                        throw new AppError(
                            'GEOGRAPHIC_AUTHORIZATION_DENIED',
                            'You do not have permission to access this participant',
                            403
                        );
                    }
                }
            }
            // If no address history, allow access (participant not yet associated with any area)
        }

        return {
            ...participant,
            ageCohort: calculateAgeCohort(participant.dateOfBirth)
        };
    }

    // Removed deprecated searchParticipants method - use getParticipantsFlexible with filter instead

    async createParticipant(data: CreateParticipantInput): Promise<Participant> {
        // Validate required fields
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Participant name is required');
        }

        // Validate email format if provided
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                throw new Error('Invalid email format');
            }

            // Validate email uniqueness
            const existing = await this.participantRepository.findByEmail(data.email);
            if (existing) {
                throw new Error('Participant with this email already exists');
            }
        }

        // Validate dateOfBirth is in the past if provided
        if (data.dateOfBirth) {
            const dob = new Date(data.dateOfBirth);
            if (dob >= new Date()) {
                throw new Error('Date of birth must be in the past');
            }
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
                    email: data.email || null,
                    phone: data.phone,
                    notes: data.notes,
                    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
                    dateOfRegistration: data.dateOfRegistration ? new Date(data.dateOfRegistration) : null,
                    nickname: data.nickname,
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

    async updateParticipant(id: string, data: UpdateParticipantInput, userId?: string, userRole?: string): Promise<Participant> {
        // Validate authorization by calling getParticipantById (which enforces geographic authorization)
        await this.getParticipantById(id, userId, userRole);

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

        // Validate dateOfBirth is in the past if provided
        if (data.dateOfBirth) {
            const dob = new Date(data.dateOfBirth);
            if (dob >= new Date()) {
                throw new Error('Date of birth must be in the past');
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

                // Validate user has access to the new venue's geographic area
                if (userId) {
                    const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
                        userId,
                        venueExists.geographicAreaId
                    );
                    if (accessLevel === AccessLevel.NONE) {
                        throw new AppError(
                            'GEOGRAPHIC_AUTHORIZATION_DENIED',
                            'You do not have permission to assign this participant to the specified venue',
                            403
                        );
                    }
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
        // Use 'in' operator to distinguish between undefined (omit) and null (clear)
        const updateData: {
            name?: string;
            email?: string | null;
            phone?: string | null;
            notes?: string | null;
            dateOfBirth?: Date | null;
            dateOfRegistration?: Date | null;
            nickname?: string | null;
            version?: number;
        } = {};
        if ('name' in data) updateData.name = data.name;
        if ('email' in data) updateData.email = data.email;
        if ('phone' in data) updateData.phone = data.phone;
        if ('notes' in data) updateData.notes = data.notes;
        if ('dateOfBirth' in data) {
            updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
        }
        if ('dateOfRegistration' in data) {
            updateData.dateOfRegistration = data.dateOfRegistration ? new Date(data.dateOfRegistration) : null;
        }
        if ('nickname' in data) updateData.nickname = data.nickname;
        if ('version' in data) updateData.version = data.version;

        try {
            return await this.participantRepository.update(id, updateData);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new Error('VERSION_CONFLICT');
            }
            throw error;
        }
    }

    async deleteParticipant(id: string, userId?: string, userRole?: string): Promise<void> {
        // Validate authorization by calling getParticipantById (which enforces geographic authorization)
        await this.getParticipantById(id, userId, userRole);

        await this.participantRepository.delete(id);
    }

    async getAddressHistory(participantId: string, userId?: string, userRole?: string) {
        // Validate authorization by calling getParticipantById (which enforces geographic authorization)
        await this.getParticipantById(participantId, userId, userRole);

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

        // Use provided effectiveFrom, or null if not provided
        const effectiveDate = data.effectiveFrom !== undefined ? data.effectiveFrom : null;

        // Check for duplicate effectiveFrom (including null)
        const hasDuplicate = await this.addressHistoryRepository.hasDuplicateEffectiveFrom(
            participantId,
            effectiveDate
        );
        if (hasDuplicate) {
            throw new Error(
                effectiveDate === null
                    ? 'An address history record with null effective date (initial address) already exists for this participant'
                    : 'An address history record with this effectiveFrom date already exists for this participant'
            );
        }

        // Validate at most one null effectiveFrom per participant
        if (effectiveDate === null) {
            const hasNullDate = await this.addressHistoryRepository.hasNullEffectiveFrom(participantId);
            if (hasNullDate) {
                throw new Error('Only one address history record can have a null effective date per participant');
            }
        }

        return this.addressHistoryRepository.create({
            participantId,
            venueId: data.venueId,
            effectiveFrom: effectiveDate,
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

    async getParticipantActivities(participantId: string, userId?: string, userRole?: string) {
        // Validate authorization by calling getParticipantById (which enforces geographic authorization)
        await this.getParticipantById(participantId, userId, userRole);

        // Get assignments with activity and role details
        return this.assignmentRepository.findByParticipantId(participantId);
    }

    async exportParticipantsToCSV(geographicAreaId?: string): Promise<string> {
        // Get all participants (with geographic filter if provided)
        const participants = await this.getAllParticipants(geographicAreaId);

        // Define CSV columns
        const columns = [
            'id',
            'name',
            'email',
            'phone',
            'notes',
            'dateOfBirth',
            'ageCohort',
            'dateOfRegistration',
            'nickname',
            'createdAt',
            'updatedAt'
        ];

        // Transform participants to CSV format with ageCohort
        const data = participants.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email || '',
            phone: p.phone || '',
            notes: p.notes || '',
            dateOfBirth: formatDateForCSV(p.dateOfBirth),
            ageCohort: calculateAgeCohort(p.dateOfBirth),
            dateOfRegistration: formatDateForCSV(p.dateOfRegistration),
            nickname: p.nickname || '',
            createdAt: formatDateForCSV(p.createdAt),
            updatedAt: formatDateForCSV(p.updatedAt)
        }));

        return generateCSV({ columns, data });
    }

    async importParticipantsFromCSV(fileBuffer: Buffer): Promise<ImportResult> {
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
                const validated = ParticipantImportSchema.parse(record);

                // Create or update
                if (validated.id) {
                    // Update existing participant
                    await this.updateParticipant(validated.id, {
                        name: validated.name,
                        email: validated.email,
                        phone: validated.phone,
                        notes: validated.notes,
                        dateOfBirth: validated.dateOfBirth,
                        dateOfRegistration: validated.dateOfRegistration,
                        nickname: validated.nickname
                    });
                } else {
                    // Create new participant
                    await this.createParticipant({
                        name: validated.name,
                        email: validated.email,
                        phone: validated.phone,
                        notes: validated.notes,
                        dateOfBirth: validated.dateOfBirth,
                        dateOfRegistration: validated.dateOfRegistration,
                        nickname: validated.nickname
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
