import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { ActivityStatus } from '../utils/constants';
import { ActivityMarkerQueryBuilder } from '../utils/activity-marker-query-builder';

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
    constructor(
        private prisma: PrismaClient,
        private geographicAreaRepository: GeographicAreaRepository,
        private geoAuthService: GeographicAuthorizationService
    ) { }

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

        // Get effective geographic area IDs based on authorization
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            filters.geographicAreaIds,
            userId
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
            include: {
                activityType: {
                    include: {
                        activityCategory: true,
                    },
                },
                activityVenueHistory: {
                    include: {
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

        return {
            id: activity.id,
            name: activity.name,
            activityTypeName: activity.activityType.name,
            activityCategoryName: activity.activityType.activityCategory.name,
            startDate: activity.startDate.toISOString(),
            participantCount: activity.assignments.length,
        };
    }

    /**
     * Get lightweight participant home marker data grouped by venue with pagination
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

        // Get effective geographic area IDs based on authorization
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            filters.geographicAreaIds,
            userId
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

        // Build participant where clause
        const participantWhere: any = {
            // Must have address history with valid venue
            addressHistory: {
                some: {
                    venue: {}, // Venue exists (not null)
                },
            },
        };

        // Apply population filter
        if (filters.populationIds && filters.populationIds.length > 0) {
            participantWhere.participantPopulations = {
                some: {
                    populationId: { in: filters.populationIds },
                },
            };
        }

        // Fetch participants with address history
        const participants = await this.prisma.participant.findMany({
            where: participantWhere,
            include: {
                addressHistory: {
                    where: boundingBox ? {
                        venue: this.buildCoordinateFilter(boundingBox),
                    } : {
                        venue: {}, // Only include address history with valid venues (venue exists)
                    },
                    include: {
                        venue: {
                            select: {
                                id: true,
                                latitude: true,
                                longitude: true,
                                geographicAreaId: true,
                            },
                        },
                    },
                    orderBy: {
                        effectiveFrom: 'desc',
                    },
                },
            },
        });

        // Group by home venue(s) - temporal filtering if dates provided
        const venueParticipantMap = new Map<string, number>();

        for (const participant of participants) {
            if (participant.addressHistory.length === 0) continue;

            // Determine which addresses were active during query period
            let activeAddresses: typeof participant.addressHistory;

            if (filters.startDate || filters.endDate) {
                // Temporal filtering: find all addresses active during query period
                // Address history is ordered DESC (most recent first)
                activeAddresses = [];

                for (let i = 0; i < participant.addressHistory.length; i++) {
                    const currentAddress = participant.addressHistory[i];
                    const previousAddress = i > 0 ? participant.addressHistory[i - 1] : null; // Previous is newer

                    // Determine the effective date range for this address
                    // addressStart: when this address became effective (null = earliest possible)
                    // addressEnd: when the next (newer) address became effective (null = still current)

                    const addressStart = currentAddress.effectiveFrom;
                    const addressEnd = previousAddress?.effectiveFrom; // When next address started (or null if still current)

                    // Check if this address overlaps with query period
                    let isActive = false;

                    if (filters.startDate && filters.endDate) {
                        // Both dates: address overlaps if it started before/during period AND ended after period start (or still active)
                        const startedBeforePeriodEnd = addressStart === null || addressStart <= filters.endDate;
                        const endedAfterPeriodStart = addressEnd === null || addressEnd === undefined || addressEnd > filters.startDate;
                        isActive = startedBeforePeriodEnd && endedAfterPeriodStart;
                    } else if (filters.startDate) {
                        // Only startDate: address must end after start (or still active)
                        isActive = addressEnd === null || addressEnd === undefined || addressEnd > filters.startDate;
                    } else if (filters.endDate) {
                        // Only endDate: address must start before/during end
                        isActive = addressStart === null || addressStart <= filters.endDate;
                    }

                    if (isActive) {
                        activeAddresses.push(currentAddress);
                    }
                }
            } else {
                // No date filters: use current home only (most recent)
                activeAddresses = [participant.addressHistory[0]];
            }

            // Add all active addresses to the map
            for (const address of activeAddresses) {
                // Skip if venue has no coordinates
                if (
                    address.venue.latitude === null ||
                    address.venue.longitude === null
                ) {
                    continue;
                }

                // Apply geographic filter
                if (effectiveVenueIds && !effectiveVenueIds.includes(address.venue.id)) {
                    continue;
                }

                // Increment count for this venue
                const count = venueParticipantMap.get(address.venue.id) || 0;
                venueParticipantMap.set(address.venue.id, count + 1);
            }
        }

        // Get total count of unique venues
        const venueIds = Array.from(venueParticipantMap.keys());
        const total = venueIds.length;

        // Apply pagination to venue IDs
        const paginatedVenueIds = venueIds.slice(skip, skip + effectiveLimit);

        // Fetch venue coordinates for markers
        const venues = await this.prisma.venue.findMany({
            where: {
                id: { in: paginatedVenueIds },
            },
            select: {
                id: true,
                latitude: true,
                longitude: true,
            },
        });

        // Transform to markers
        const markers: ParticipantHomeMarker[] = venues.map(venue => ({
            venueId: venue.id,
            latitude: venue.latitude!.toNumber(),
            longitude: venue.longitude!.toNumber(),
            participantCount: venueParticipantMap.get(venue.id) || 0,
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

        // Get effective geographic area IDs based on authorization
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            filters.geographicAreaIds,
            userId
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
     * Get effective geographic area IDs based on filters and authorization
     */
    private async getEffectiveGeographicAreaIds(
        filterAreaIds: string[] | undefined,
        userId: string
    ): Promise<string[] | undefined> {
        // Get user's authorized area IDs
        const authInfo = await this.geoAuthService.getAuthorizationInfo(userId);

        // If explicit filter provided
        if (filterAreaIds && filterAreaIds.length > 0) {
            // Expand to include descendants using batch processing
            const descendants = await this.geographicAreaRepository.findBatchDescendants(filterAreaIds);
            const expandedIds = new Set<string>([...filterAreaIds, ...descendants]);

            // If user has restrictions, intersect with authorized areas
            if (authInfo.hasGeographicRestrictions) {
                const authorizedSet = new Set(authInfo.authorizedAreaIds);
                return Array.from(expandedIds).filter(id => authorizedSet.has(id));
            }

            return Array.from(expandedIds);
        }

        // No explicit filter - apply implicit filtering
        if (authInfo.hasGeographicRestrictions) {
            return authInfo.authorizedAreaIds;
        }

        return undefined; // No filtering
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
