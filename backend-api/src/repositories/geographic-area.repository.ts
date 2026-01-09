import { PrismaClient, GeographicArea, AreaType } from '@prisma/client';

export interface CreateGeographicAreaData {
  name: string;
  areaType: AreaType;
  parentGeographicAreaId?: string;
}

export interface UpdateGeographicAreaData {
  name?: string;
  areaType?: AreaType;
  parentGeographicAreaId?: string | null;
  version?: number;
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

  async findAllPaginated(page: number, limit: number, where?: any): Promise<{ data: GeographicArea[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.geographicArea.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          parent: true,
        },
      }),
      this.prisma.geographicArea.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<GeographicArea | null> {
    const area = await this.prisma.geographicArea.findUnique({
      where: { id },
      include: {
        parent: true,
      },
    });

    if (!area) return null;

    // Add childCount
    const childCount = await this.countChildren(id);
    return {
      ...area,
      childCount,
    } as any;
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
    const { version, ...updateData } = data;

    // If version is provided, check for conflicts
    if (version !== undefined) {
      const current = await this.prisma.geographicArea.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!current) {
        throw new Error('Geographic area not found');
      }

      if (current.version !== version) {
        throw new Error('VERSION_CONFLICT');
      }
    }

    return this.prisma.geographicArea.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
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
    const children = await this.prisma.geographicArea.findMany({
      where: { parentGeographicAreaId: id },
      orderBy: { name: 'asc' },
    });

    // Add childCount to each child
    const childrenWithCount = await Promise.all(
      children.map(async (child) => ({
        ...child,
        childCount: await this.countChildren(child.id),
      }))
    );

    return childrenWithCount as any;
  }

  async countChildren(id: string): Promise<number> {
    return this.prisma.geographicArea.count({
      where: { parentGeographicAreaId: id },
    });
  }

  async findWithDepth(parentId: string | null, depth: number): Promise<GeographicArea[]> {
    // Fetch areas at this level
    const areas = await this.prisma.geographicArea.findMany({
      where: { parentGeographicAreaId: parentId },
      orderBy: { name: 'asc' },
      include: {
        parent: true,
      },
    });

    // Add childCount to each area
    const areasWithCount = await Promise.all(
      areas.map(async (area) => ({
        ...area,
        childCount: await this.countChildren(area.id),
      }))
    );

    // If depth > 0, recursively fetch children
    if (depth > 0) {
      const areasWithChildren = await Promise.all(
        areasWithCount.map(async (area) => {
          const children = await this.findWithDepth(area.id, depth - 1);
          return {
            ...area,
            children: children.length > 0 ? children : undefined,
          };
        })
      );
      return areasWithChildren as any;
    }

    return areasWithCount as any;
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
