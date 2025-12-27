import { GeographicArea, AreaType, PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';

export interface CreateGeographicAreaInput {
    name: string;
    areaType: AreaType;
    parentGeographicAreaId?: string;
}

export interface UpdateGeographicAreaInput {
    name?: string;
    areaType?: AreaType;
    parentGeographicAreaId?: string;
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
        private prisma: PrismaClient
    ) { }

    async getAllGeographicAreas(): Promise<GeographicArea[]> {
        return this.geographicAreaRepository.findAll();
    }

    async getAllGeographicAreasPaginated(page?: number, limit?: number): Promise<PaginatedResponse<GeographicArea>> {
        const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });
        const { data, total } = await this.geographicAreaRepository.findAllPaginated(validPage, validLimit);
        return PaginationHelper.createResponse(data, validPage, validLimit, total);
    }

    async getGeographicAreaById(id: string): Promise<GeographicArea> {
        const area = await this.geographicAreaRepository.findById(id);
        if (!area) {
            throw new Error('Geographic area not found');
        }
        return area;
    }

    async createGeographicArea(data: CreateGeographicAreaInput): Promise<GeographicArea> {
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
        }

        return this.geographicAreaRepository.create(data);
    }

    async updateGeographicArea(
        id: string,
        data: UpdateGeographicAreaInput
    ): Promise<GeographicArea> {
        const existing = await this.geographicAreaRepository.findById(id);
        if (!existing) {
            throw new Error('Geographic area not found');
        }

        // Validate parent exists if provided
        if (data.parentGeographicAreaId) {
            const parentExists = await this.geographicAreaRepository.exists(
                data.parentGeographicAreaId
            );
            if (!parentExists) {
                throw new Error('Parent geographic area not found');
            }

            // Prevent setting parent to itself
            if (data.parentGeographicAreaId === id) {
                throw new Error('Geographic area cannot be its own parent');
            }

            // Prevent circular relationships (setting parent to a descendant)
            const isDescendant = await this.geographicAreaRepository.isDescendantOf(
                data.parentGeographicAreaId,
                id
            );
            if (isDescendant) {
                throw new Error('Cannot create circular parent-child relationship');
            }
        }

        try {
            return await this.geographicAreaRepository.update(id, data);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new Error('VERSION_CONFLICT');
            }
            throw error;
        }
    }

    async deleteGeographicArea(id: string): Promise<void> {
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

    async getChildren(id: string): Promise<GeographicArea[]> {
        const area = await this.geographicAreaRepository.findById(id);
        if (!area) {
            throw new Error('Geographic area not found');
        }

        return this.geographicAreaRepository.findChildren(id);
    }

    async getAncestors(id: string): Promise<GeographicArea[]> {
        const area = await this.geographicAreaRepository.findById(id);
        if (!area) {
            throw new Error('Geographic area not found');
        }

        return this.geographicAreaRepository.findAncestors(id);
    }

    async getVenues(id: string) {
        const area = await this.geographicAreaRepository.findById(id);
        if (!area) {
            throw new Error('Geographic area not found');
        }

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(id);
        const areaIds = [id, ...descendantIds];

        // Get all venues in this area and descendants (recursive)
        return this.prisma.venue.findMany({
            where: { geographicAreaId: { in: areaIds } },
            orderBy: { name: 'asc' },
        });
    }

    async getStatistics(id: string): Promise<GeographicAreaStatistics> {
        const area = await this.geographicAreaRepository.findById(id);
        if (!area) {
            throw new Error('Geographic area not found');
        }

        // Get all descendant IDs including the area itself
        const descendantIds = await this.geographicAreaRepository.findDescendants(id);
        const areaIds = [id, ...descendantIds];

        // Get all venues in this area and descendants
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
}
