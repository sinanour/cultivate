import { PrismaClient, GeographicArea, AreaType } from '@prisma/client';

export interface CreateGeographicAreaData {
  name: string;
  areaType: AreaType;
  parentGeographicAreaId?: string;
}

export interface UpdateGeographicAreaData {
  name?: string;
  areaType?: AreaType;
  parentGeographicAreaId?: string;
}

export class GeographicAreaRepository {
  constructor(private prisma: PrismaClient) { }

  async findAll(): Promise<GeographicArea[]> {
    return this.prisma.geographicArea.findMany({
      orderBy: { name: 'asc' },
      include: {
        parent: true,
      },
    });
  }

  async findAllPaginated(page: number, limit: number): Promise<{ data: GeographicArea[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.geographicArea.findMany({
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          parent: true,
        },
      }),
      this.prisma.geographicArea.count(),
    ]);

    return { data, total };
  }

  async findAllPaginated(page: number, limit: number): Promise<{ data: GeographicArea[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.geographicArea.findMany({
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          parent: true,
        },
      }),
      this.prisma.geographicArea.count(),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<GeographicArea | null> {
    return this.prisma.geographicArea.findUnique({
      where: { id },
      include: {
        parent: true,
      },
    });
  }

  async create(data: CreateGeographicAreaData): Promise<GeographicArea> {
    return this.prisma.geographicArea.create({
      data,
      include: {
        parent: true,
      },
    });
  }

  async update(id: string, data: UpdateGeographicAreaData): Promise<GeographicArea> {
    return this.prisma.geographicArea.update({
      where: { id },
      data,
      include: {
        parent: true,
      },
    });
  }

  async delete(id: string): Promise<GeographicArea> {
    return this.prisma.geographicArea.delete({
      where: { id },
    });
  }

  async findChildren(id: string): Promise<GeographicArea[]> {
    return this.prisma.geographicArea.findMany({
      where: { parentGeographicAreaId: id },
      orderBy: { name: 'asc' },
    });
  }

  async findAncestors(id: string): Promise<GeographicArea[]> {
    const ancestors: GeographicArea[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const area: GeographicArea | null = await this.prisma.geographicArea.findUnique({
        where: { id: currentId },
      });

      if (!area || !area.parentGeographicAreaId) break;

      const parent: GeographicArea | null = await this.prisma.geographicArea.findUnique({
        where: { id: area.parentGeographicAreaId },
      });

      if (parent) {
        ancestors.push(parent);
      }

      currentId = area.parentGeographicAreaId;
    }

    return ancestors;
  }

  async findDescendants(id: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue: string[] = [id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.geographicArea.findMany({
        where: { parentGeographicAreaId: currentId },
        select: { id: true },
      });

      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  async findVenues(id: string) {
    return this.prisma.venue.findMany({
      where: { geographicAreaId: id },
      orderBy: { name: 'asc' },
    });
  }

  async countVenueReferences(id: string): Promise<number> {
    return this.prisma.venue.count({
      where: { geographicAreaId: id },
    });
  }

  async countChildReferences(id: string): Promise<number> {
    return this.prisma.geographicArea.count({
      where: { parentGeographicAreaId: id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.geographicArea.count({
      where: { id },
    });
    return count > 0;
  }

  async isDescendantOf(childId: string, ancestorId: string): Promise<boolean> {
    const ancestors = await this.findAncestors(childId);
    return ancestors.some((a) => a.id === ancestorId);
  }
}
