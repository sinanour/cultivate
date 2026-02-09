import { PrismaClient } from '@prisma/client';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { ActivityStatus } from '../utils/constants';
import { ActivityMarkerQueryBuilder } from '../utils/activity-marker-query-builder';
import {
    ParticipantHomeMarkerQueryBuilder,
    ParticipantHomeMarkerRow
} from '../utils/participant-home-marker-query-builder';
import { GeographicFilteringService } from './geographic-filtering.service';

export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

export interface ActivityMarker {
    id: string;
    latitude: number;
    longitude: number;
    activityTypeId: string;
    activityCategoryId: string;
}

export interface ActivityPopupContent {
    id: string;
    name: string;
    activityTypeName: string;
    activityCategoryName: string;
    startDate: string;
    participantCount: number;
}

export interface ParticipantHomeMarker {
    venueId: string;
    latitude: number;
    longitude: number;
    participantCount: number;
}

export interface ParticipantHomePopupContent {
    venueId: string;
    venueName: string;
    participantCount: number;
    participantNames: string[];
}

export interface VenueMarker {
    id: string;
    latitude: number;
    longitude: number;
}

export interface VenuePopupContent {
    id: string;
    name: string;
    address: string;
    geographicAreaName: string;
}

/**
 * Raw SQL query result row for activity markers
 */
interface ActivityMarkerRow {
    id: string;
    latitude: any; // Prisma Decimal type
    longitude: any; // Prisma Decimal type
    activityTypeId: string;
    activityCategoryId: string;
    total_count: bigint; // PostgreSQL COUNT returns bigint
}

export interface MapFilters {
    geographicAreaIds?: string[];
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
    startDate?: Date;
    endDate?: Date;
    status?: ActivityStatus;
}

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export class MapDataService {
    private geographicFilteringService: GeographicFilteringService;

    constructor(
        private prisma: PrismaClient,
        private geoAuthService: GeographicAuthorizationService
    ) {
        this.geographicFilteringService = new GeographicFilteringService(prisma);
    }

    /**
     * Get lightweight activity marker data for map rendering with pagination
     * Uses optimized raw SQL with conditional joins for best performance
     */
    async getActivityMarkers(
        filters: MapFilters,
        userId: string,
        boundingBox?: BoundingBox,
        page: number = 1,
        limit: number = 100
    ): Promise<PaginatedResponse<ActivityMarker>> {
        // Enforce maximum limit
        const effectiveLimit = Math.min(limit, 100);
        const skip = (page - 1) * effectiveLimit;

        // Get user's authorization info
        const authInfo = await this.geoAuthService.getAuthorizationInfo(userId);

        // Get effective geographic area IDs based on authorization
        const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIdsForAnalytics(
            filters.geographicAreaIds,
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions
        );

        // If user has restrictions and no authorized areas, return empty
        if (effectiveAreaIds !== undefined && effectiveAreaIds.length === 0) {
            return {
                data: [],
                pagination: {
                    page,
                    limit: effectiveLimit,
                    total: 0,
                    totalPages: 0,
                },
            };
        }

        // Get venue IDs in authorized geographic areas
        let effectiveVenueIds: string[] | undefined;
        if (effectiveAreaIds) {
            effectiveVenueIds = await this.getVenueIdsForAreas(effectiveAreaIds);
            if (effectiveVenueIds.length === 0) {
                return {
                    data: [],
                    pagination: {
                        page,
                        limit: effectiveLimit,
                        total: 0,
                        totalPages: 0,
                    },
                };
            }
        }

        // Build optimized query
        const queryBuilder = new ActivityMarkerQueryBuilder(
            filters,
            effectiveVenueIds,
            boundingBox,
            effectiveLimit,
            skip
        );

        const startTime = Date.now();
        const variant = queryBuilder.getVariant();

        // Execute raw SQL query
        const sql = queryBuilder.build();

        const results = await this.prisma.$queryRawUnsafe<ActivityMarkerRow[]>(sql);

        const executionTime = Date.now() - startTime;

        // Log performance in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[MapData] Activity markers query completed:`, {
                variant,
                executionTime: `${executionTime}ms`,
                rowsReturned: results.length,
                totalCount: results.length > 0 ? Number(results[0].total_count) : 0,
                filters: {
                    hasPopulation: !!filters.populationIds,
                    hasGeographic: !!effectiveVenueIds,
                    hasBoundingBox: !!boundingBox,
                    hasDateRange: !!(filters.startDate || filters.endDate),
                },
            });
        }

        // Extract total count from window function
        const total = results.length > 0 ? Number(results[0].total_count) : 0;

        // Transform to markers
        const markers: ActivityMarker[] = results.map(row => ({
            id: row.id,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            activityTypeId: row.activityTypeId,
            activityCategoryId: row.activityCategoryId,
        }));

        return {
            data: markers,
            pagination: {
                page,
                limit: effectiveLimit,
                total,
                totalPages: Math.ceil(total / effectiveLimit),
            },
        };
    }

    /**
     * Get detailed popup content for an activity marker
     */
    async getActivityPopupContent(
        activityId: string,
        userId: string
    ): Promise<ActivityPopupContent | null> {
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: {
                id: true,
                name: true,
                startDate: true,
                additionalParticipantCount: true,
                activityType: {
                    select: {
                        name: true,
                        activityCategory: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                activityVenueHistory: {
                    select: {
                        venue: {
                            select: {
                                geographicAreaId: true,
                            },
                        },
                    },
                    orderBy: {
                        effectiveFrom: 'desc',
                    },
                    take: 1,
                },
                assignments: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!activity) {
            return null;
        }

        // Check geographic authorization
        const currentVenue = activity.activityVenueHistory[0];
        if (currentVenue) {
            const accessLevel = await this.geoAuthService.evaluateAccess(
                userId,
                currentVenue.venue.geographicAreaId
            );
            if (accessLevel === AccessLevel.NONE) {
                return null;
            }
        }

        // Calculate total participant count: individually assigned + additional
        const individualCount = activity.assignments.length;
        const additionalCount = activity.additionalParticipantCount || 0;
        const totalParticipantCount = individualCount + additionalCount;

        return {
            id: activity.id,
            name: activity.name,
            activityTypeName: activity.activityType.name,
            activityCategoryName: activity.activityType.activityCategory.name,
            startDate: activity.startDate.toISOString(),
            participantCount: totalParticipantCount,
        };
    }

    /**
     * Get lightweight participant home marker data grouped by venue with pagination
     * Uses optimized raw SQL with CTEs to avoid bind variable limits
     */
    async getParticipantHomeMarkers(
        filters: Pick<MapFilters, 'geographicAreaIds' | 'populationIds' | 'startDate' | 'endDate'>,
        userId: string,
        boundingBox?: BoundingBox,
        page: number = 1,
        limit: number = 100
    ): Promise<PaginatedResponse<ParticipantHomeMarker>> {
        // Enforce maximum limit
        const effectiveLimit = Math.min(limit, 100);
        const skip = (page - 1) * effectiveLimit;

        // Get effective venue IDs using CTE-based expansion
        // This expands geographic areas at database level to avoid large ID arrays
        const effectiveVenueIds = await this.getEffectiveVenueIdsWithCTE(
            filters.geographicAreaIds,
            userId
        );

        // If empty array, return empty result
        if (effectiveVenueIds !== undefined && effectiveVenueIds.length === 0) {
            return {
                data: [],
                pagination: {
                    page,
                    limit: effectiveLimit,
                    total: 0,
                    totalPages: 0,
                },
            };
        }

        // Build query using CTE-based query builder
        // Uses array parameters with unnest() to avoid bind variable limits
        const queryBuilder = new ParticipantHomeMarkerQueryBuilder({
            venueIds: effectiveVenueIds,
            populationIds: filters.populationIds,
            startDate: filters.startDate,
            endDate: filters.endDate,
            boundingBox,
            limit: effectiveLimit,
            skip,
        });

        const startTime = Date.now();
        const sql = queryBuilder.build();
        const params = queryBuilder.getParams();

        // Execute raw SQL query with array parameters
        const results = await this.prisma.$queryRawUnsafe<ParticipantHomeMarkerRow[]>(
            sql,
            ...params
        );

        const executionTime = Date.now() - startTime;

        // Log performance in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[MapData] Participant home markers query completed:`, {
                variant: queryBuilder.getVariant(),
                executionTime: `${executionTime}ms`,
                venuesReturned: results.length,
                totalCount: results.length > 0 ? Number(results[0].total_count) : 0,
                filters: {
                    geographicAreas: filters.geographicAreaIds?.length || 0,
                    venueIds: effectiveVenueIds?.length || 'all',
                    hasPopulation: !!filters.populationIds,
                    hasBoundingBox: !!boundingBox,
                    hasDateRange: !!(filters.startDate || filters.endDate),
                },
            });
        }

        // Extract total count and transform results
        const total = results.length > 0 ? Number(results[0].total_count) : 0;
        const markers: ParticipantHomeMarker[] = results.map(row => ({
            venueId: row.venueId,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            participantCount: Number(row.participantCount),
        }));

        return {
            data: markers,
            pagination: {
                page,
                limit: effectiveLimit,
                total,
                totalPages: Math.ceil(total / effectiveLimit),
            },
        };
    }

    /**
     * Get detailed popup content for a participant home marker
     */
    async getParticipantHomePopupContent(
        venueId: string,
        userId: string
    ): Promise<ParticipantHomePopupContent | null> {
        const venue = await this.prisma.venue.findUnique({
            where: { id: venueId },
            select: {
                id: true,
                name: true,
                geographicAreaId: true,
            },
        });

        if (!venue) {
            return null;
        }

        // Check geographic authorization
        const accessLevel = await this.geoAuthService.evaluateAccess(
            userId,
            venue.geographicAreaId
        );
        if (accessLevel === AccessLevel.NONE) {
            return null;
        }

        // Get participants with this venue as current home
        const participants = await this.prisma.participant.findMany({
            where: {
                addressHistory: {
                    some: {
                        venueId: venueId,
                    },
                },
            },
            include: {
                addressHistory: {
                    orderBy: {
                        effectiveFrom: 'desc',
                    },
                    take: 1,
                    include: {
                        venue: {
                            select: {
                                id: true,
                            },
                        },
                    },
                },
            },
        });

        // Filter to only participants where this is their current home
        const currentResidents = participants.filter(
            p => p.addressHistory[0]?.venue.id === venueId
        );

        return {
            venueId: venue.id,
            venueName: venue.name,
            participantCount: currentResidents.length,
            participantNames: currentResidents.map(p => p.name),
        };
    }

    /**
     * Get lightweight venue marker data for map rendering with pagination
     */
    async getVenueMarkers(
        filters: Pick<MapFilters, 'geographicAreaIds'>,
        userId: string,
        boundingBox?: BoundingBox,
        page: number = 1,
        limit: number = 100
    ): Promise<PaginatedResponse<VenueMarker>> {
        // Enforce maximum limit
        const effectiveLimit = Math.min(limit, 100);
        const skip = (page - 1) * effectiveLimit;

        // Get user's authorization info
        const authInfo = await this.geoAuthService.getAuthorizationInfo(userId);

        // Get effective geographic area IDs based on authorization
        const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIdsForAnalytics(
            filters.geographicAreaIds,
            authInfo.authorizedAreaIds,
            authInfo.hasGeographicRestrictions
        );

        // If user has restrictions and no authorized areas, return empty
        if (effectiveAreaIds !== undefined && effectiveAreaIds.length === 0) {
            return {
                data: [],
                pagination: {
                    page,
                    limit: effectiveLimit,
                    total: 0,
                    totalPages: 0,
                },
            };
        }

        // Build venue where clause
        const venueWhere: any = {
            // Must have coordinates
            latitude: { not: null },
            longitude: { not: null },
        };

        // Apply bounding box filter
        if (boundingBox) {
            Object.assign(venueWhere, this.buildCoordinateFilter(boundingBox));
        }

        // Apply geographic filter
        if (effectiveAreaIds) {
            venueWhere.geographicAreaId = { in: effectiveAreaIds };
        }

        // Get total count
        const total = await this.prisma.venue.count({
            where: venueWhere,
        });

        // Fetch venues (paginated)
        const venues = await this.prisma.venue.findMany({
            where: venueWhere,
            skip,
            take: effectiveLimit,
            select: {
                id: true,
                latitude: true,
                longitude: true,
            },
        });

        // Transform to markers
        const markers = venues.map(venue => ({
            id: venue.id,
            latitude: venue.latitude!.toNumber(),
            longitude: venue.longitude!.toNumber(),
        }));

        return {
            data: markers,
            pagination: {
                page,
                limit: effectiveLimit,
                total,
                totalPages: Math.ceil(total / effectiveLimit),
            },
        };
    }

    /**
     * Get detailed popup content for a venue marker
     */
    async getVenuePopupContent(
        venueId: string,
        userId: string
    ): Promise<VenuePopupContent | null> {
        const venue = await this.prisma.venue.findUnique({
            where: { id: venueId },
            include: {
                geographicArea: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        if (!venue) {
            return null;
        }

        // Check geographic authorization
        const accessLevel = await this.geoAuthService.evaluateAccess(
            userId,
            venue.geographicAreaId
        );
        if (accessLevel === AccessLevel.NONE) {
            return null;
        }

        return {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            geographicAreaName: venue.geographicArea.name,
        };
    }

    /**
     * Get venue IDs for given geographic area IDs
     */
    private async getVenueIdsForAreas(areaIds: string[]): Promise<string[]> {
        const venues = await this.prisma.venue.findMany({
            where: {
                geographicAreaId: { in: areaIds },
            },
            select: {
                id: true,
            },
        });
        return venues.map(v => v.id);
    }

    /**
     * Get effective venue IDs using database-level expansion with CTEs
     * Expands geographic areas and fetches venue IDs in a single query
     * Returns undefined if no geographic filtering needed
     * 
     * Uses WITH RECURSIVE to expand area hierarchies at database level,
     * avoiding large ID arrays in Node.js and bind variable limits
     */
    private async getEffectiveVenueIdsWithCTE(
        filterAreaIds: string[] | undefined,
        userId: string
    ): Promise<string[] | undefined> {
        const authInfo = await this.geoAuthService.getAuthorizationInfo(userId);

        // Determine which geographic areas to filter by
        let rootAreaIds: string[] | undefined;

        if (filterAreaIds && filterAreaIds.length > 0) {
            // Explicit filter provided
            if (authInfo.hasGeographicRestrictions) {
                // Intersect with authorized areas
                const authorizedSet = new Set(authInfo.authorizedAreaIds);
                rootAreaIds = filterAreaIds.filter(id => authorizedSet.has(id));

                if (rootAreaIds.length === 0) {
                    return []; // No authorized areas in filter
                }
            } else {
                rootAreaIds = filterAreaIds;
            }
        } else if (authInfo.hasGeographicRestrictions) {
            // No explicit filter - use authorized areas
            rootAreaIds = authInfo.authorizedAreaIds;
        } else {
            // No filtering needed
            return undefined;
        }

        // Expand areas and get venues at database level using WITH RECURSIVE
        // This avoids fetching large ID arrays into Node.js memory
        // Use $queryRawUnsafe with inline UUIDs (safe since validated by service layer)
        const uuidList = rootAreaIds.map(id => `'${id}'`).join(', ');

        const result = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `WITH RECURSIVE area_tree AS (
                -- Base case: root areas
                SELECT id FROM geographic_areas 
                WHERE id::text IN (${uuidList})
                
                UNION ALL
                
                -- Recursive case: descendants
                SELECT ga.id 
                FROM geographic_areas ga
                JOIN area_tree at ON ga."parentGeographicAreaId" = at.id
            )
            SELECT DISTINCT v.id::text as id
            FROM venues v
            JOIN area_tree at ON v."geographicAreaId" = at.id`
        );

        return result.map(row => row.id);
    }

    /**
     * Build coordinate filter for bounding box
     * Handles international date line crossing
     */
    private buildCoordinateFilter(boundingBox: BoundingBox): any {
        const { minLat, maxLat, minLon, maxLon } = boundingBox;

        // Check if bounding box crosses international date line
        const crossesDateLine = minLon > maxLon;

        if (crossesDateLine) {
            // Crossing date line: longitude >= minLon OR longitude <= maxLon
            return {
                latitude: {
                    gte: minLat,
                    lte: maxLat,
                },
                OR: [
                    { longitude: { gte: minLon } },
                    { longitude: { lte: maxLon } },
                ],
            };
        } else {
            // Normal case: longitude between minLon and maxLon
            return {
                latitude: {
                    gte: minLat,
                    lte: maxLat,
                },
                longitude: {
                    gte: minLon,
                    lte: maxLon,
                },
            };
        }
    }
}
