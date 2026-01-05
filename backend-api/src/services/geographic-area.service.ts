import { GeographicArea, AreaType, PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { GeographicAreaImportSchema } from '../utils/validation.schemas';
import { AppError } from '../types/errors.types';

export interface CreateGeographicAreaInput {
    name: string;
    areaType: AreaType;
    parentGeographicAreaId?: string;
}

export interface UpdateGeographicAreaInput {
    name?: string;
    areaType?: AreaType;
    parentGeographicAreaId?: string | null;
    version?: number;
}

export interface GeographicAreaStatistics {
    totalActivities: number;
    totalParticipants: number;
    totalVenues: number;
    activeActivities: number;
}

export class GeographicAreaService {
    constructor(
        private geographicAreaRepository: GeographicAreaRepository,
        private prisma: PrismaClient,
        private geographicAuthorizationService: GeographicAuthorizationService
    ) { }

    /**
     * Determines the effective geographic area IDs to filter by, considering:
     * 1. Explicit geographicAreaId parameter (if provided, validate authorization)
     * 2. Implicit filtering based on user's authorized areas (if user has restrictions)
     * 3. No filtering (if user has no restrictions and no explicit filter)
     * 
     * IMPORTANT: authorizedAreaIds already includes descendants and excludes DENY rules.
     * Do NOT expand descendants again during implicit filtering.
     */
    private async getEffectiveGeographicAreaIds(
        explicitGeographicAreaId: string | undefined,
        authorizedAreaIds: string[],
        hasGeographicRestrictions: boolean
    ): Promise<string[] | undefined> {
        // If explicit filter provided
        if (explicitGeographicAreaId) {
            // Validate user has access to this area
            if (hasGeographicRestrictions && !authorizedAreaIds.includes(explicitGeographicAreaId)) {
                throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access this geographic area');
            }

            // Expand to include descendants
            const descendantIds = await this.geographicAreaRepository.findDescendants(explicitGeographicAreaId);
            return [explicitGeographicAreaId, ...descendantIds];
        }

        // No explicit filter - apply implicit filtering if user has restrictions
        if (hasGeographicRestrictions) {
            // IMPORTANT: authorizedAreaIds already has descendants expanded and DENY rules applied
            // Do NOT expand descendants again, as this would re-add denied areas
            return authorizedAreaIds;
        }

        // No restrictions and no explicit filter - return undefined (no filtering)
        return undefined;
    }

    async getAllGeographicAreas(
        geographicAreaId?: string,
        search?: string,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false,
        readOnlyAreaIds: string[] = []
    ): Promise<GeographicArea[]> {
        // Build search filter
        const searchWhere = search ? {
            name: { contains: search, mode: 'insensitive' as const }
        } : {};

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            // No geographic filter
            if (!search) {
                // No filters at all, use repository
                return this.geographicAreaRepository.findAll();
            }
            // Search only, use prisma with search filter
            return this.prisma.geographicArea.findMany({
                where: searchWhere,
                orderBy: { name: 'asc' },
                include: {
                    parent: true,
                },
            });
        }

        // When filtering by geographic area, include the selected area, its descendants, and ancestors
        const selectedArea = geographicAreaId ? await this.geographicAreaRepository.findById(geographicAreaId) : null;

        let allAreaIds: string[];
        if (selectedArea) {
            // Explicit filter: Get ancestors for context
            const ancestors = await this.geographicAreaRepository.findAncestors(geographicAreaId!);
            // Combine: selected area, descendants (from effectiveAreaIds), and ancestors
            allAreaIds = [...new Set([...effectiveAreaIds, ...ancestors.map(a => a.id)])];
        } else {
            // No explicit filter, but user has restrictions
            // Include authorized areas + read-only ancestors for navigation context
            allAreaIds = [...new Set([...effectiveAreaIds, ...readOnlyAreaIds])];
        }

        // Fetch all areas with search filter
        const allAreas = await this.prisma.geographicArea.findMany({
            where: {
                id: { in: allAreaIds },
                ...searchWhere
            },
            orderBy: { name: 'asc' },
            include: {
                parent: true,
            },
        });

        return allAreas;
    }

    async getAllGeographicAreasPaginated(
        page?: number,
        limit?: number,
        geographicAreaId?: string,
        search?: string,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false,
        readOnlyAreaIds: string[] = []
    ): Promise<PaginatedResponse<GeographicArea>> {
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // Build search filter
        const searchWhere = search ? {
            name: { contains: search, mode: 'insensitive' as const }
        } : {};

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            const { data, total } = await this.geographicAreaRepository.findAllPaginated(validPage, validLimit, searchWhere);
            return PaginationHelper.createResponse(data, validPage, validLimit, total);
        }

        // When filtering by geographic area, include the selected area, its descendants, and ancestors
        const selectedArea = geographicAreaId ? await this.geographicAreaRepository.findById(geographicAreaId) : null;

        let allAreaIds: string[];
        if (selectedArea) {
            // Explicit filter: Get ancestors for context
            const ancestors = await this.geographicAreaRepository.findAncestors(geographicAreaId!);
            // Combine: selected area, descendants (from effectiveAreaIds), and ancestors
            allAreaIds = [...new Set([...effectiveAreaIds, ...ancestors.map(a => a.id)])];
        } else {
            // No explicit filter, but user has restrictions
            // Include authorized areas + read-only ancestors for navigation context
            allAreaIds = [...new Set([...effectiveAreaIds, ...readOnlyAreaIds])];
        }

        // Fetch all areas with search filter
        const allAreas = await this.prisma.geographicArea.findMany({
            where: {
                id: { in: allAreaIds },
                ...searchWhere
            },
            orderBy: { name: 'asc' },
            include: {
                parent: true,
            },
        });

        // Apply pagination
        const total = allAreas.length;
        const skip = (validPage - 1) * validLimit;
        const paginatedAreas = allAreas.slice(skip, skip + validLimit);

        return PaginationHelper.createResponse(paginatedAreas, validPage, validLimit, total);
    }

    async getGeographicAreaById(id: string, userId?: string, userRole?: string): Promise<GeographicArea> {
        const area = await this.geographicAreaRepository.findById(id);
        if (!area) {
            throw new Error('Geographic area not found');
        }

        // Enforce geographic authorization if userId is provided
        if (userId) {
            // Administrator bypass
            if (userRole === 'ADMINISTRATOR') {
                return area;
            }

            // Validate authorization (includes read-only access to ancestors)
            const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
                userId,
                id
            );

            if (accessLevel === AccessLevel.NONE) {
                await this.geographicAuthorizationService.logAuthorizationDenial(
                    userId,
                    'GEOGRAPHIC_AREA',
                    id,
                    'GET'
                );
                throw new AppError(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    'You do not have permission to access this geographic area',
                    403
                );
            }
        }

        return area;
    }

    async createGeographicArea(
        data: CreateGeographicAreaInput,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<GeographicArea> {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Geographic area name is required');
        }

        if (!data.areaType) {
            throw new Error('Geographic area type is required');
        }

        // Validate parent exists if provided
        if (data.parentGeographicAreaId) {
            const parentExists = await this.geographicAreaRepository.exists(
                data.parentGeographicAreaId
            );
            if (!parentExists) {
                throw new Error('Parent geographic area not found');
            }

            // Validate user has access to parent area
            if (hasGeographicRestrictions && !authorizedAreaIds.includes(data.parentGeographicAreaId)) {
                throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to create geographic areas under this parent area');
            }
        } else {
            // Creating a top-level area (no parent)
            // Users with geographic restrictions cannot create top-level areas
            if (hasGeographicRestrictions) {
                throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to create top-level geographic areas');
            }
        }

        return this.geographicAreaRepository.create(data);
    }

    async updateGeographicArea(
        id: string,
        data: UpdateGeographicAreaInput,
        userId?: string,
        userRole?: string
    ): Promise<GeographicArea> {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        // Note: For updates, we need FULL access, not just READ_ONLY
        await this.getGeographicAreaById(id, userId, userRole);

        // Additional check: For updates, READ_ONLY access is not sufficient
        if (userId && userRole !== 'ADMINISTRATOR') {
            const accessLevel = await this.geographicAuthorizationService.evaluateAccess(userId, id);
            if (accessLevel !== AccessLevel.FULL) {
                await this.geographicAuthorizationService.logAuthorizationDenial(
                    userId,
                    'GEOGRAPHIC_AREA',
                    id,
                    'PUT'
                );
                throw new AppError(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    'You do not have permission to update this geographic area',
                    403
                );
            }
        }

        const existing = await this.geographicAreaRepository.findById(id);
        if (!existing) {
            throw new Error('Geographic area not found');
        }

        // Build update object - only include fields present in request
        const updateData: UpdateGeographicAreaInput = {};

        if ('name' in data) updateData.name = data.name;
        if ('areaType' in data) updateData.areaType = data.areaType;
        if ('version' in data) updateData.version = data.version;

        // Handle parentGeographicAreaId with explicit null check
        if ('parentGeographicAreaId' in data) {
            const parentId = data.parentGeographicAreaId;

            // Validate parent exists if provided (not null)
            if (parentId !== null && parentId !== undefined) {
                const parentExists = await this.geographicAreaRepository.exists(parentId);
                if (!parentExists) {
                    throw new Error('Parent geographic area not found');
                }

                // Validate user has access to the new parent area
                if (userId) {
                    const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
                        userId,
                        parentId
                    );
                    if (accessLevel === AccessLevel.NONE) {
                        throw new AppError(
                            'GEOGRAPHIC_AUTHORIZATION_DENIED',
                            'You do not have permission to move this geographic area under the specified parent',
                            403
                        );
                    }
                }

                // Prevent setting parent to itself
                if (parentId === id) {
                    throw new Error('Geographic area cannot be its own parent');
                }

                // Prevent circular relationships (setting parent to a descendant)
                const isDescendant = await this.geographicAreaRepository.isDescendantOf(
                    parentId,
                    id
                );
                if (isDescendant) {
                    throw new Error('Cannot create circular parent-child relationship');
                }
            } else if (parentId === null) {
                // Clearing parent (making it a top-level area)
                // Users with geographic restrictions cannot create top-level areas
                if (userId && userRole !== 'ADMINISTRATOR') {
                    const hasRestrictions = await this.geographicAuthorizationService.hasGeographicRestrictions(userId);
                    if (hasRestrictions) {
                        throw new AppError(
                            'GEOGRAPHIC_AUTHORIZATION_DENIED',
                            'You do not have permission to make this a top-level geographic area',
                            403
                        );
                    }
                }
            }

            // Include in update (can be null to clear parent)
            updateData.parentGeographicAreaId = parentId;
        }

        try {
            return await this.geographicAreaRepository.update(id, updateData);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new Error('VERSION_CONFLICT');
            }
            throw error;
        }
    }

    async deleteGeographicArea(
        id: string,
        userId?: string,
        userRole?: string
    ): Promise<void> {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        // Note: For deletes, we need FULL access, not just READ_ONLY
        await this.getGeographicAreaById(id, userId, userRole);

        // Additional check: For deletes, READ_ONLY access is not sufficient
        if (userId && userRole !== 'ADMINISTRATOR') {
            const accessLevel = await this.geographicAuthorizationService.evaluateAccess(userId, id);
            if (accessLevel !== AccessLevel.FULL) {
                await this.geographicAuthorizationService.logAuthorizationDenial(
                    userId,
                    'GEOGRAPHIC_AREA',
                    id,
                    'DELETE'
                );
                throw new AppError(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    'You do not have permission to delete this geographic area',
                    403
                );
            }
        }

        const existing = await this.geographicAreaRepository.findById(id);
        if (!existing) {
            throw new Error('Geographic area not found');
        }

        // Check for venue references
        const venueCount = await this.geographicAreaRepository.countVenueReferences(id);
        if (venueCount > 0) {
            throw new Error(
                `Cannot delete geographic area. It is referenced by ${venueCount} venue(s)`
            );
        }

        // Check for child geographic area references
        const childCount = await this.geographicAreaRepository.countChildReferences(id);
        if (childCount > 0) {
            throw new Error(
                `Cannot delete geographic area. It has ${childCount} child geographic area(s)`
            );
        }

        await this.geographicAreaRepository.delete(id);
    }

    async getChildren(id: string, userId?: string, userRole?: string): Promise<GeographicArea[]> {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        await this.getGeographicAreaById(id, userId, userRole);

        const children = await this.geographicAreaRepository.findChildren(id);

        // Filter out denied children if user has geographic restrictions
        if (userId && userRole !== 'ADMINISTRATOR') {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(userId);

            if (authInfo.hasGeographicRestrictions) {
                // Only include children that are in the authorized list
                return children.filter(child => authInfo.authorizedAreaIds.includes(child.id));
            }
        }

        return children;
    }

    async getAncestors(id: string, userId?: string, userRole?: string): Promise<GeographicArea[]> {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        await this.getGeographicAreaById(id, userId, userRole);

        return this.geographicAreaRepository.findAncestors(id);
    }

    async getVenues(id: string, userId?: string, userRole?: string) {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        await this.getGeographicAreaById(id, userId, userRole);

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(id);
        let areaIds = [id, ...descendantIds];

        // Filter out denied areas if user has geographic restrictions
        if (userId && userRole !== 'ADMINISTRATOR') {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(userId);

            if (authInfo.hasGeographicRestrictions) {
                // Only include areas that are in the authorized list
                areaIds = areaIds.filter(areaId => authInfo.authorizedAreaIds.includes(areaId));
            }
        }

        // Get all venues in authorized areas only
        return this.prisma.venue.findMany({
            where: { geographicAreaId: { in: areaIds } },
            orderBy: { name: 'asc' },
        });
    }

    async getStatistics(id: string, userId?: string, userRole?: string): Promise<GeographicAreaStatistics> {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        await this.getGeographicAreaById(id, userId, userRole);

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(id);
        let areaIds = [id, ...descendantIds];

        // Filter out denied areas if user has geographic restrictions
        if (userId && userRole !== 'ADMINISTRATOR') {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(userId);

            if (authInfo.hasGeographicRestrictions) {
                // Only include areas that are in the authorized list
                areaIds = areaIds.filter(areaId => authInfo.authorizedAreaIds.includes(areaId));
            }
        }

        // Get all venues in authorized areas only
        const venues = await this.prisma.venue.findMany({
            where: { geographicAreaId: { in: areaIds } },
            select: { id: true },
        });

        const venueIds = venues.map((v) => v.id);

        // Count activities associated with these venues
        const totalActivities = await this.prisma.activity.count({
            where: {
                activityVenueHistory: {
                    some: {
                        venueId: { in: venueIds },
                    },
                },
            },
        });

        const activeActivities = await this.prisma.activity.count({
            where: {
                status: { in: ['ACTIVE'] },
                activityVenueHistory: {
                    some: {
                        venueId: { in: venueIds },
                    },
                },
            },
        });

        // Count unique participants with home addresses in these venues
        // Get the most recent address for each participant
        const participantAddresses = await this.prisma.participantAddressHistory.findMany({
            where: {
                venueId: { in: venueIds },
            },
            orderBy: {
                effectiveFrom: 'desc',
            },
        });

        // Get unique participants by taking the most recent address for each
        const uniqueParticipants = new Map<string, boolean>();
        for (const address of participantAddresses) {
            if (!uniqueParticipants.has(address.participantId)) {
                uniqueParticipants.set(address.participantId, true);
            }
        }

        return {
            totalActivities,
            totalParticipants: uniqueParticipants.size,
            totalVenues: venues.length,
            activeActivities,
        };
    }

    async exportGeographicAreasToCSV(): Promise<string> {
        // Get all geographic areas
        const areas = await this.geographicAreaRepository.findAll();

        // Define CSV columns
        const columns = [
            'id',
            'name',
            'areaType',
            'parentGeographicAreaId',
            'parentGeographicAreaName',
            'createdAt',
            'updatedAt'
        ];

        // Transform geographic areas to CSV format
        const data = areas.map(a => ({
            id: a.id,
            name: a.name,
            areaType: a.areaType,
            parentGeographicAreaId: a.parentGeographicAreaId || '',
            parentGeographicAreaName: (a as any).parent?.name || '',
            createdAt: formatDateForCSV(a.createdAt),
            updatedAt: formatDateForCSV(a.updatedAt)
        }));

        return generateCSV({ columns, data });
    }

    async importGeographicAreasFromCSV(fileBuffer: Buffer): Promise<ImportResult> {
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
                const validated = GeographicAreaImportSchema.parse(record);

                // Create or update
                if (validated.id) {
                    // Update existing geographic area
                    await this.updateGeographicArea(validated.id, {
                        name: validated.name,
                        areaType: validated.areaType,
                        parentGeographicAreaId: validated.parentGeographicAreaId
                    });
                } else {
                    // Create new geographic area
                    await this.createGeographicArea({
                        name: validated.name,
                        areaType: validated.areaType,
                        parentGeographicAreaId: validated.parentGeographicAreaId
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
