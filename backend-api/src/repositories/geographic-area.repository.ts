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

  /**
   * Optimized batch ancestor fetching with minimal database round trips.
   * Returns a map of area IDs to their parent IDs (not full ancestor objects).
   * 
   * Algorithm:
   * 1. Fetch initial set of areas to get their parent IDs
   * 2. Build parent map from results
   * 3. Use set subtraction to find missing parent IDs
   * 4. Recursively fetch missing parents until all ancestors are found
   * 5. Build ancestor chains for each requested area
   * 
   * @param areaIds - Array of geographic area IDs to fetch ancestors for
   * @returns Map of area ID to parent ID (e.g., { "area-1": "parent-1", "parent-1": "grandparent-1" })
   */
  async findBatchAncestors(areaIds: string[]): Promise<Record<string, string | null>> {
    const parentMap = new Map<string, string | null>();

    // Start with the requested area IDs
    let idsToFetch = new Set<string>(areaIds);

    // Iteratively fetch areas and their parents until we reach the root
    while (idsToFetch.size > 0) {
      // Fetch all areas in current batch
      const areas = await this.prisma.geographicArea.findMany({
        where: { id: { in: Array.from(idsToFetch) } },
        select: { id: true, parentGeographicAreaId: true },
      });

      // Build parent map from fetched areas
      const newParentIds = new Set<string>();
      for (const area of areas) {
        parentMap.set(area.id, area.parentGeographicAreaId);

        // Collect non-null parent IDs that we haven't seen yet
        if (area.parentGeographicAreaId && !parentMap.has(area.parentGeographicAreaId)) {
          newParentIds.add(area.parentGeographicAreaId);
        }
      }

      // Set subtraction: find parent IDs we need to fetch next
      // (parent IDs that exist but aren't in our map yet)
      idsToFetch = newParentIds;
    }

    // Convert Map to plain object for API response
    const result: Record<string, string | null> = {};
    for (const [areaId, parentId] of parentMap.entries()) {
      result[areaId] = parentId;
    }

    return result;
  }

  /**
   * Fetches complete entity details for multiple geographic areas in a single database query.
   * Complements findBatchAncestors by providing full geographic area objects after ancestor IDs are obtained.
   * 
   * @param areaIds - Array of geographic area IDs to fetch details for
   * @returns Map of area ID to complete geographic area object with childCount
   */
  async findBatchDetails(areaIds: string[]): Promise<Record<string, GeographicArea & { childCount: number }>> {
    // Fetch all requested areas in a single query
    const areas = await this.prisma.geographicArea.findMany({
      where: { id: { in: areaIds } },
      orderBy: { name: 'asc' },
    });

    // Build result map with childCount for each area
    const result: Record<string, GeographicArea & { childCount: number }> = {};

    for (const area of areas) {
      const childCount = await this.countChildren(area.id);
      result[area.id] = {
        ...area,
        childCount,
      };
    }

    return result;
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
