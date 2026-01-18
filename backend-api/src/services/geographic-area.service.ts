import { GeographicArea, AreaType, PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { GeographicAreaImportSchema } from '../utils/validation.schemas';
import { AppError } from '../types/errors.types';
import { buildWhereClause, buildSelectClause, getValidFieldNames } from '../utils/query-builder.util';

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

export interface FlexibleGeographicAreaQuery {
    page?: number;
    limit?: number;
    geographicAreaId?: string;
    depth?: number;
    filter?: Record<string, any>;
    fields?: string[];
    authorizedAreaIds?: string[];
    hasGeographicRestrictions?: boolean;
    readOnlyAreaIds?: string[];
}

export class GeographicAreaService {
    constructor(
        private geographicAreaRepository: GeographicAreaRepository,
        private prisma: PrismaClient,
        private geographicAuthorizationService: GeographicAuthorizationService
    ) { }

    /**
     * Flattens a nested geographic area structure (with children property) into a flat array
     */
    private flattenGeographicAreas(areas: any[]): GeographicArea[] {
        const result: GeographicArea[] = [];

        for (const area of areas) {
            // Add the area itself (without children property)
            const { children, ...areaWithoutChildren } = area;
            result.push(areaWithoutChildren);

            // Recursively add children
            if (children && children.length > 0) {
                result.push(...this.flattenGeographicAreas(children));
            }
        }

        return result;
    }

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
            const allAreaIds = [explicitGeographicAreaId, ...descendantIds];

            // If user has geographic restrictions, filter descendants to only include authorized areas
            // This ensures DENY rules are respected even when an explicit filter is provided
            if (hasGeographicRestrictions) {
                return allAreaIds.filter(id => authorizedAreaIds.includes(id));
            }

            // No restrictions - return all descendants
            return allAreaIds;
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
        depth?: number,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false,
        readOnlyAreaIds: string[] = []
    ): Promise<GeographicArea[]> {
        // Removed legacy search parameter - use filter API instead

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        // If depth is specified, use depth-limited fetching
        if (depth !== undefined) {
            if (effectiveAreaIds) {
                // User has geographic restrictions
                if (geographicAreaId) {
                    // Explicit filter: fetch from the specified area
                    const requestedArea = await this.geographicAreaRepository.findById(geographicAreaId);
                    if (!requestedArea) {
                        throw new Error('Geographic area not found');
                    }

                    // Fetch children of the requested area
                    // Note: findWithDepth has an off-by-one - depth=N fetches N+1 levels
                    // So to get depth levels, we need to call with depth-1
                    const fetchDepth = Math.max(0, depth - 1);
                    const children = await this.geographicAreaRepository.findWithDepth(geographicAreaId, fetchDepth);

                    // Flatten and combine with requested area
                    const flatChildren = this.flattenGeographicAreas(children);
                    const allAreas = [requestedArea, ...flatChildren];

                    // Filter to only authorized areas
                    const allowedAreaIds = new Set(effectiveAreaIds);
                    const readOnlyIds = new Set(readOnlyAreaIds);
                    const authorizedAreas = allAreas.filter(area =>
                        allowedAreaIds.has(area.id) || readOnlyIds.has(area.id)
                    );

                    // Fetch and filter ancestors for context
                    const ancestors = await this.geographicAreaRepository.findAncestors(geographicAreaId);
                    const authorizedAncestors = ancestors.filter(a =>
                        allowedAreaIds.has(a.id) || readOnlyIds.has(a.id)
                    );
                    return [...authorizedAncestors, ...authorizedAreas];
                } else {
                    // No explicit filter - fetch from authorized top-level areas only
                    // Find which authorized areas are top-level (have no parent or parent is not authorized)
                    const allAuthorizedIds = [...effectiveAreaIds, ...readOnlyAreaIds];
                    const allAuthorizedAreas = await this.prisma.geographicArea.findMany({
                        where: { id: { in: allAuthorizedIds } },
                        include: { parent: true },
                    });

                    // Find top-level authorized areas (no parent or parent not in authorized set)
                    const authorizedSet = new Set(allAuthorizedIds);
                    const topLevelAuthorizedAreas = allAuthorizedAreas.filter(area =>
                        !area.parentGeographicAreaId || !authorizedSet.has(area.parentGeographicAreaId)
                    );

                    // Fetch children for each top-level authorized area
                    const areasWithChildren = await Promise.all(
                        topLevelAuthorizedAreas.map(async (topArea) => {
                            if (depth === 0) {
                                return [topArea];
                            }
                            // findWithDepth(parentId, depth) fetches children of parentId up to depth levels
                            // Note: findWithDepth has an off-by-one - depth=N fetches N+1 levels
                            // So to get depth levels, we need to call with depth-1
                            const fetchDepth = Math.max(0, depth - 1);
                            const children = await this.geographicAreaRepository.findWithDepth(topArea.id, fetchDepth);

                            // Flatten the nested structure
                            const flatChildren = this.flattenGeographicAreas(children);

                            // Filter children to only authorized
                            const allowedAreaIds = new Set(effectiveAreaIds);
                            const readOnlyIds = new Set(readOnlyAreaIds);
                            const authorizedChildren = flatChildren.filter(child =>
                                allowedAreaIds.has(child.id) || readOnlyIds.has(child.id)
                            );
                            return [topArea, ...authorizedChildren];
                        })
                    );

                    return areasWithChildren.flat();
                }
            } else {
            // No restrictions - fetch normally
                const parentId = geographicAreaId || null;
                const areas = await this.geographicAreaRepository.findWithDepth(parentId, depth);

                if (geographicAreaId) {
                    const ancestors = await this.geographicAreaRepository.findAncestors(geographicAreaId);
                    return [...ancestors, ...areas];
                }

                return areas;
            }
        }

        if (!effectiveAreaIds) {
            // No geographic filter, use repository
            const areas = await this.geographicAreaRepository.findAll();
            // Add childCount to each area
            return Promise.all(areas.map(async (area) => ({
                ...area,
                childCount: await this.geographicAreaRepository.countChildren(area.id),
            }))) as any;
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

        // Fetch all areas
        const allAreas = await this.prisma.geographicArea.findMany({
            where: {
                id: { in: allAreaIds }
            },
            orderBy: { name: 'asc' },
            include: {
                parent: true,
            },
        });

        // Add childCount to each area
        return Promise.all(allAreas.map(async (area) => ({
            ...area,
            childCount: await this.geographicAreaRepository.countChildren(area.id),
        }))) as any;
    }

    // Removed deprecated filterAreasRecursively method - use filter API instead

    async getAllGeographicAreasPaginated(
        page?: number,
        limit?: number,
        geographicAreaId?: string,
        depth?: number,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false,
        readOnlyAreaIds: string[] = []
    ): Promise<PaginatedResponse<GeographicArea>> {
        // Removed legacy search parameter - use filter API instead
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // If depth is specified, use non-paginated depth-limited fetching
        // (pagination doesn't make sense with hierarchical depth-limited data)
        if (depth !== undefined) {
            const areas = await this.getAllGeographicAreas(
                geographicAreaId,
                depth,
                authorizedAreaIds,
                hasGeographicRestrictions,
                readOnlyAreaIds
            );
            return PaginationHelper.createResponse(areas, validPage, validLimit, areas.length);
        }

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            const { data, total } = await this.geographicAreaRepository.findAllPaginated(validPage, validLimit, {});
            // Add childCount to each area
            const dataWithCount = await Promise.all(data.map(async (area) => ({
                ...area,
                childCount: await this.geographicAreaRepository.countChildren(area.id),
            })));
            return PaginationHelper.createResponse(dataWithCount as any, validPage, validLimit, total);
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

        // Fetch all areas
        const allAreas = await this.prisma.geographicArea.findMany({
            where: {
                id: { in: allAreaIds }
            },
            orderBy: { name: 'asc' },
            include: {
                parent: true,
            },
        });

        // Add childCount to each area
        const allAreasWithCount = await Promise.all(allAreas.map(async (area) => ({
            ...area,
            childCount: await this.geographicAreaRepository.countChildren(area.id),
        })));

        // Apply pagination
        const total = allAreasWithCount.length;
        const skip = (validPage - 1) * validLimit;
        const paginatedAreas = allAreasWithCount.slice(skip, skip + validLimit);

        return PaginationHelper.createResponse(paginatedAreas as any, validPage, validLimit, total);
    }

    /**
     * Get geographic areas with flexible filtering and customizable attribute selection (non-paginated)
     * Supports filter[name], filter[areaType], filter[parentGeographicAreaId] and fields parameter
     */
    async getAllGeographicAreasFlexible(query: FlexibleGeographicAreaQuery): Promise<GeographicArea[]> {
        const {
            geographicAreaId,
            depth,
            filter,
            fields,
            authorizedAreaIds = [],
            hasGeographicRestrictions = false,
            readOnlyAreaIds = []
        } = query;

        // Build flexible filter where clause
        const flexibleWhere = filter ? buildWhereClause('geographicArea', filter) : undefined;

        // Build select clause for attribute selection
        let select: any = undefined;
        if (fields && fields.length > 0) {
            try {
                const validFields = getValidFieldNames('geographicArea');
                select = buildSelectClause(fields, validFields);
            } catch (error) {
                throw new AppError('INVALID_FIELDS', (error as Error).message, 400);
            }
        }

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        // If depth is specified, use depth-limited fetching
        if (depth !== undefined) {
            let areas: GeographicArea[];

            if (effectiveAreaIds) {
                // User has geographic restrictions
                if (geographicAreaId) {
                    // Explicit filter: fetch from the specified area
                    const requestedArea = await this.geographicAreaRepository.findById(geographicAreaId);
                    if (!requestedArea) {
                        throw new Error('Geographic area not found');
                    }

                    // Fetch children of the requested area
                    // Note: findWithDepth has an off-by-one - depth=N fetches N+1 levels
                    // So to get depth levels, we need to call with depth-1
                    const fetchDepth = Math.max(0, depth - 1);
                    const children = await this.geographicAreaRepository.findWithDepth(geographicAreaId, fetchDepth);

                    // Flatten and combine with requested area
                    const flatChildren = this.flattenGeographicAreas(children);
                    const allAreas = [requestedArea, ...flatChildren];

                    // Filter to only authorized areas
                    const allowedAreaIds = new Set(effectiveAreaIds);
                    const readOnlyIds = new Set(readOnlyAreaIds);
                    let authorizedAreas = allAreas.filter(area =>
                        allowedAreaIds.has(area.id) || readOnlyIds.has(area.id)
                    );

                    // Apply flexible filter if provided
                    if (flexibleWhere) {
                        const queryOptions: any = {
                            where: {
                                AND: [
                                    { id: { in: authorizedAreas.map(a => a.id) } },
                                    flexibleWhere
                                ]
                            },
                            orderBy: { name: 'asc' }
                        };

                        if (select) {
                            queryOptions.select = select;
                        }

                        authorizedAreas = await this.prisma.geographicArea.findMany(queryOptions);
                    }

                    // Fetch and filter ancestors for context
                    const ancestors = await this.geographicAreaRepository.findAncestors(geographicAreaId);
                    const authorizedAncestors = ancestors.filter(a =>
                        allowedAreaIds.has(a.id) || readOnlyIds.has(a.id)
                    );
                    return [...authorizedAncestors, ...authorizedAreas];
                } else {
                    // No explicit filter - fetch from authorized top-level areas only
                    // Find which authorized areas are top-level (have no parent or parent is not authorized)
                    const allAuthorizedIds = [...effectiveAreaIds, ...readOnlyAreaIds];
                    const allAuthorizedAreas = await this.prisma.geographicArea.findMany({
                        where: { id: { in: allAuthorizedIds } },
                        include: { parent: true },
                    });

                    // Find top-level authorized areas (no parent or parent not in authorized set)
                    const authorizedSet = new Set(allAuthorizedIds);
                    const topLevelAuthorizedAreas = allAuthorizedAreas.filter(area =>
                        !area.parentGeographicAreaId || !authorizedSet.has(area.parentGeographicAreaId)
                    );


                    // Fetch children for each top-level authorized area
                    const areasWithChildren = await Promise.all(
                        topLevelAuthorizedAreas.map(async (topArea) => {
                            if (depth === 0) {
                                return [topArea];
                            }
                            // findWithDepth(parentId, depth) fetches children of parentId up to depth levels
                            // Note: findWithDepth has an off-by-one - depth=N fetches N+1 levels
                            // So to get depth levels, we need to call with depth-1
                            const fetchDepth = Math.max(0, depth - 1);
                            const children = await this.geographicAreaRepository.findWithDepth(topArea.id, fetchDepth);

                            // Flatten the nested structure
                            const flatChildren = this.flattenGeographicAreas(children);

                            // Filter children to only authorized
                            const allowedAreaIds = new Set(effectiveAreaIds);
                            const readOnlyIds = new Set(readOnlyAreaIds);
                            const authorizedChildren = flatChildren.filter(child =>
                                allowedAreaIds.has(child.id) || readOnlyIds.has(child.id)
                            );
                            return [topArea, ...authorizedChildren];
                        })
                    );

                    let flatAreas = areasWithChildren.flat();

                    // Apply flexible filter if provided
                    if (flexibleWhere) {
                        const queryOptions: any = {
                            where: {
                                AND: [
                                    { id: { in: flatAreas.map(a => a.id) } },
                                    flexibleWhere
                                ]
                            },
                            orderBy: { name: 'asc' }
                        };

                        if (select) {
                            queryOptions.select = select;
                        }

                        flatAreas = await this.prisma.geographicArea.findMany(queryOptions);
                    }

                    return flatAreas;
                }
            } else {
            // No restrictions - fetch normally
                const parentId = geographicAreaId || null;
                areas = await this.geographicAreaRepository.findWithDepth(parentId, depth);

                // Apply flexible filter if provided
                let filteredAreas = areas;
                if (flexibleWhere) {
                    const queryOptions: any = {
                        where: {
                            AND: [
                                { id: { in: areas.map(a => a.id) } },
                                flexibleWhere
                            ]
                        },
                        orderBy: { name: 'asc' }
                    };

                    if (select) {
                        queryOptions.select = select;
                    }

                    filteredAreas = await this.prisma.geographicArea.findMany(queryOptions);
                }

                if (geographicAreaId) {
                    const ancestors = await this.geographicAreaRepository.findAncestors(geographicAreaId);
                    return [...ancestors, ...filteredAreas];
                }

                return filteredAreas;
            }
        }

        if (!effectiveAreaIds) {
            // No geographic filter, fetch all areas with flexible filter
            const queryOptions: any = {
                where: flexibleWhere,
                orderBy: { name: 'asc' }
            };

            if (select) {
                queryOptions.select = select;
            }

            const areas = await this.prisma.geographicArea.findMany(queryOptions);

            // Add childCount if not using custom select
            if (!select) {
                return Promise.all(areas.map(async (area: any) => ({
                    ...area,
                    childCount: await this.geographicAreaRepository.countChildren(area.id),
                }))) as any;
            }

            return areas;
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

        // Fetch all areas with flexible filter
        const whereClause = flexibleWhere
            ? { AND: [{ id: { in: allAreaIds } }, flexibleWhere] }
            : { id: { in: allAreaIds } };

        const queryOptions: any = {
            where: whereClause,
            orderBy: { name: 'asc' }
        };

        if (select) {
            queryOptions.select = select;
        } else {
            queryOptions.include = { parent: true };
        }

        const allAreas = await this.prisma.geographicArea.findMany(queryOptions);

        // Add childCount if not using custom select
        if (!select) {
            return Promise.all(allAreas.map(async (area: any) => ({
                ...area,
                childCount: await this.geographicAreaRepository.countChildren(area.id),
            }))) as any;
        }

        return allAreas;
    }

    /**
     * Get geographic areas with flexible filtering and customizable attribute selection (paginated)
     * Supports filter[name], filter[areaType], filter[parentGeographicAreaId] and fields parameter
     */
    async getAllGeographicAreasPaginatedFlexible(query: FlexibleGeographicAreaQuery): Promise<PaginatedResponse<GeographicArea>> {
        const {
            page,
            limit,
            geographicAreaId,
            depth,
            filter,
            fields,
            authorizedAreaIds = [],
            hasGeographicRestrictions = false,
            readOnlyAreaIds = []
        } = query;

        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // Build flexible filter where clause
        const flexibleWhere = filter ? buildWhereClause('geographicArea', filter) : undefined;

        // Build select clause for attribute selection
        let select: any = undefined;
        if (fields && fields.length > 0) {
            try {
                const validFields = getValidFieldNames('geographicArea');
                select = buildSelectClause(fields, validFields);
            } catch (error) {
                throw new AppError('INVALID_FIELDS', (error as Error).message, 400);
            }
        }

        // If depth is specified, use non-paginated depth-limited fetching
        // (pagination doesn't make sense with hierarchical depth-limited data)
        if (depth !== undefined) {
            const areas = await this.getAllGeographicAreasFlexible({
                geographicAreaId,
                depth,
                filter,
                fields,
                authorizedAreaIds,
                hasGeographicRestrictions,
                readOnlyAreaIds
            });
            return PaginationHelper.createResponse(areas, validPage, validLimit, areas.length);
        }

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaId,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        if (!effectiveAreaIds) {
            // No geographic filter, just apply flexible filters with pagination
            const whereClause = flexibleWhere || {};

            const queryOptions: any = {
                where: whereClause,
                skip: (validPage - 1) * validLimit,
                take: validLimit,
                orderBy: { name: 'asc' }
            };

            if (select) {
                queryOptions.select = select;
            }

            const [data, total] = await Promise.all([
                this.prisma.geographicArea.findMany(queryOptions),
                this.prisma.geographicArea.count({ where: whereClause })
            ]);

            // Add childCount if not using custom select
            if (!select) {
                const dataWithCount = await Promise.all(data.map(async (area: any) => ({
                    ...area,
                    childCount: await this.geographicAreaRepository.countChildren(area.id),
                })));
                return PaginationHelper.createResponse(dataWithCount as any, validPage, validLimit, total);
            }

            return PaginationHelper.createResponse(data as any, validPage, validLimit, total);
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

        // Fetch all areas with flexible filter
        const whereClause = flexibleWhere
            ? { AND: [{ id: { in: allAreaIds } }, flexibleWhere] }
            : { id: { in: allAreaIds } };

        const queryOptions: any = {
            where: whereClause,
            orderBy: { name: 'asc' }
        };

        if (select) {
            queryOptions.select = select;
        } else {
            queryOptions.include = { parent: true };
        }

        const [allAreas, total] = await Promise.all([
            this.prisma.geographicArea.findMany(queryOptions),
            this.prisma.geographicArea.count({ where: whereClause })
        ]);

        // Add childCount if not using custom select
        let allAreasWithCount: any[];
        if (!select) {
            allAreasWithCount = await Promise.all(allAreas.map(async (area: any) => ({
                ...area,
                childCount: await this.geographicAreaRepository.countChildren(area.id),
            })));
        } else {
            allAreasWithCount = allAreas;
        }

        // Apply pagination
        const skip = (validPage - 1) * validLimit;
        const paginatedAreas = allAreasWithCount.slice(skip, skip + validLimit);

        return PaginationHelper.createResponse(paginatedAreas as any, validPage, validLimit, total);
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

    async getChildrenPaginated(
        id: string,
        page?: number,
        limit?: number,
        userId?: string,
        userRole?: string
    ): Promise<PaginatedResponse<GeographicArea>> {
        // Validate authorization by calling getGeographicAreaById (which enforces geographic authorization)
        await this.getGeographicAreaById(id, userId, userRole);

        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

        // Get all children first
        const allChildren = await this.geographicAreaRepository.findChildren(id);

        // Filter out denied children if user has geographic restrictions
        let filteredChildren = allChildren;
        if (userId && userRole !== 'ADMINISTRATOR') {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(userId);

            if (authInfo.hasGeographicRestrictions) {
                // Only include children that are in the authorized list
                filteredChildren = allChildren.filter(child => authInfo.authorizedAreaIds.includes(child.id));
            }
        }

        // Apply pagination
        const total = filteredChildren.length;
        const skip = (validPage - 1) * validLimit;
        const paginatedChildren = filteredChildren.slice(skip, skip + validLimit);

        return PaginationHelper.createResponse(paginatedChildren, validPage, validLimit, total);
    }

    /**
     * Get batch ancestors for multiple geographic areas.
     * Returns a simplified parent map where each area ID maps to its parent ID.
     * Clients can traverse the hierarchy by following parent IDs.
     * 
     * @param areaIds - Array of geographic area IDs (min 1, max 100)
     * @param userId - Optional user ID for authorization filtering
     * @param userRole - Optional user role for authorization bypass
     * @returns Map of area ID to parent ID (e.g., { "area-1": "parent-1", "parent-1": null })
     */
    async getBatchAncestors(
        areaIds: string[],
        userId?: string,
        userRole?: string
    ): Promise<Record<string, string | null>> {
        // Validate array length (min 1, max 100)
        if (areaIds.length < 1 || areaIds.length > 100) {
            throw new AppError(
                'VALIDATION_ERROR',
                'Must provide between 1 and 100 area IDs',
                400
            );
        }

        // Validate all IDs are valid UUIDs (basic format check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const areaId of areaIds) {
            if (!uuidRegex.test(areaId)) {
                throw new AppError(
                    'VALIDATION_ERROR',
                    `Invalid UUID format: ${areaId}`,
                    400
                );
            }
        }

        // Call repository method to fetch batch ancestors (returns parent map)
        const parentMap = await this.geographicAreaRepository.findBatchAncestors(areaIds);

        // Apply geographic authorization filtering if user is not an administrator
        if (userId && userRole !== 'ADMINISTRATOR') {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(userId);

            if (authInfo.hasGeographicRestrictions) {
                // Filter parent map to only include authorized areas
                const filteredResult: Record<string, string | null> = {};
                const authorizedSet = new Set([...authInfo.authorizedAreaIds, ...authInfo.readOnlyAreaIds]);

                for (const [areaId, parentId] of Object.entries(parentMap)) {
                    // Only include this entry if the area itself is authorized
                    if (authorizedSet.has(areaId)) {
                        // If parent is not authorized, set to null (appears as root)
                        filteredResult[areaId] = parentId && authorizedSet.has(parentId) ? parentId : null;
                    }
                }

                return filteredResult;
            }
        }

        return parentMap;
    }

    /**
     * Fetches complete entity details for multiple geographic areas in a single optimized request.
     * Complements getBatchAncestors by providing full geographic area objects after ancestor IDs are obtained.
     * 
     * @param areaIds - Array of geographic area IDs (min 1, max 100)
     * @param userId - Optional user ID for authorization filtering
     * @param userRole - Optional user role for authorization bypass
     * @returns Map of area ID to complete geographic area object with childCount
     */
    async getBatchDetails(
        areaIds: string[],
        userId?: string,
        userRole?: string
    ): Promise<Record<string, GeographicArea & { childCount: number }>> {
        // Validate array length (min 1, max 100)
        if (areaIds.length < 1 || areaIds.length > 100) {
            throw new AppError(
                'VALIDATION_ERROR',
                'Must provide between 1 and 100 area IDs',
                400
            );
        }

        // Validate all IDs are valid UUIDs (basic format check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const areaId of areaIds) {
            if (!uuidRegex.test(areaId)) {
                throw new AppError(
                    'VALIDATION_ERROR',
                    `Invalid UUID format: ${areaId}`,
                    400
                );
            }
        }

        // Call repository method to fetch batch details
        const detailsMap = await this.geographicAreaRepository.findBatchDetails(areaIds);

        // Apply geographic authorization filtering if user is not an administrator
        if (userId && userRole !== 'ADMINISTRATOR') {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(userId);

            if (authInfo.hasGeographicRestrictions) {
                // Filter details map to only include authorized areas
                const filteredResult: Record<string, GeographicArea & { childCount: number }> = {};
                const authorizedSet = new Set([...authInfo.authorizedAreaIds, ...authInfo.readOnlyAreaIds]);

                for (const [areaId, areaData] of Object.entries(detailsMap)) {
                    // Only include this entry if the area is authorized
                    if (authorizedSet.has(areaId)) {
                        filteredResult[areaId] = areaData;
                    }
                }

                return filteredResult;
            }
        }

        return detailsMap;
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
