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

  async findAllPaginated(page: number, limit: number): Promise<{ data: Venue[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.venue.findMany({
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          geographicArea: true,
        },
      }),
      this.prisma.venue.count(),
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
    return this.prisma.venue.update({
      where: { id },
      data,
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
    return this.prisma.participant.findMany({
      where: {
        addressHistory: {
          some: {
            venueId,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
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
}
