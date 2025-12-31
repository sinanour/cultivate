import { PrismaClient, Venue, VenueType } from '@prisma/client';

export interface CreateVenueData {
  name: string;
  address: string;
  geographicAreaId: string;
  latitude?: number;
  longitude?: number;
  venueType?: VenueType;
}

export interface UpdateVenueData {
  name?: string;
  address?: string;
  geographicAreaId?: string;
  latitude?: number;
  longitude?: number;
  venueType?: VenueType;
  version?: number;
}

export class VenueRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Venue[]> {
    return this.prisma.venue.findMany({
      orderBy: { name: 'asc' },
      include: {
        geographicArea: true,
      },
    });
  }

  async findAllPaginated(page: number, limit: number, where?: any): Promise<{ data: Venue[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          geographicArea: true,
        },
      }),
      this.prisma.venue.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Venue | null> {
    return this.prisma.venue.findUnique({
      where: { id },
      include: {
        geographicArea: true,
      },
    });
  }

  async search(query: string): Promise<Venue[]> {
    return this.prisma.venue.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      include: {
        geographicArea: true,
      },
    });
  }

  async create(data: CreateVenueData): Promise<Venue> {
    return this.prisma.venue.create({
      data,
      include: {
        geographicArea: true,
      },
    });
  }

  async update(id: string, data: UpdateVenueData): Promise<Venue> {
    const { version, ...updateData } = data;

    // If version is provided, check for conflicts
    if (version !== undefined) {
      const current = await this.prisma.venue.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new Error('Venue not found');
      }

      if (current.version !== version) {
        throw new Error('VERSION_CONFLICT');
      }
    }

    return this.prisma.venue.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
      include: {
        geographicArea: true,
      },
    });
  }

  async delete(id: string): Promise<Venue> {
    return this.prisma.venue.delete({
      where: { id },
    });
  }

  async findActivities(venueId: string) {
    return this.prisma.activity.findMany({
      where: {
        activityVenueHistory: {
          some: {
            venueId,
          },
        },
      },
      include: {
        activityType: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findParticipants(venueId: string) {
    // Get all participants with their address history
    const participants = await this.prisma.participant.findMany({
      include: {
        addressHistory: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Filter to only those whose most recent (current) address is at this venue
    const currentResidents = participants.filter(p => {
      if (p.addressHistory.length === 0) return false;
      const mostRecentAddress = p.addressHistory[0]; // Already sorted desc
      return mostRecentAddress.venueId === venueId;
    });

    // Remove the addressHistory from the response
    return currentResidents.map(({ addressHistory, ...participant }) => participant);
  }

  async countActivityReferences(venueId: string): Promise<number> {
    return this.prisma.activityVenueHistory.count({
      where: { venueId },
    });
  }

  async countParticipantReferences(venueId: string): Promise<number> {
    return this.prisma.participantAddressHistory.count({
      where: { venueId },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.venue.count({
      where: { id },
    });
    return count > 0;
  }

  async findByGeographicAreaIds(areaIds: string[], searchWhere?: any): Promise<Venue[]> {
    const where = {
      geographicAreaId: { in: areaIds },
      ...searchWhere
    };

    return this.prisma.venue.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        geographicArea: true,
      },
    });
  }

  async findByGeographicAreaIdsPaginated(areaIds: string[], page: number, limit: number, searchWhere?: any): Promise<{ data: Venue[]; total: number }> {
    const skip = (page - 1) * limit;
    const where = {
      geographicAreaId: { in: areaIds },
      ...searchWhere
    };

    const [data, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          geographicArea: true,
        },
      }),
      this.prisma.venue.count({ where }),
    ]);

    return { data, total };
  }
}
