import { PrismaClient } from '@prisma/client';

export interface RawQueryResult {
    activityTypeId?: string | null;
    activityCategoryId?: string | null;
    geographicAreaId?: string | null;
    venueId?: string | null;
    activitiesAtStart?: number;
    participantsAtStart?: number;
    participationAtStart?: number;
    activitiesAtEnd?: number;
    participantsAtEnd?: number;
    participationAtEnd?: number;
    activitiesStarted?: number;
    activitiesCompleted?: number;
    activeActivities?: number;
    uniqueParticipants?: number;
    totalParticipation?: number;
}

export interface DimensionLookups {
    activityTypes: Map<string, string>;
    activityCategories: Map<string, string>;
    geographicAreas: Map<string, string>;
    venues: Map<string, string>;
}

export class QueryExecutor {
    constructor(private prisma: PrismaClient) { }

    async executeEngagementQuery(
        sql: string,
        parameters: Record<string, any>
    ): Promise<RawQueryResult[]> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Replace parameter placeholders with Prisma.sql template
                let query = sql;
                const paramValues: any[] = [];

                // Replace @paramName with $1, $2, etc.
                let paramIndex = 1;
                for (const [key, value] of Object.entries(parameters)) {
                    query = query.replace(new RegExp(`@${key}`, 'g'), `$${paramIndex}`);
                    paramValues.push(value);
                    paramIndex++;
                }

                // Execute raw query with timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Query timeout')), 30000);
                });

                const queryPromise = this.prisma.$queryRawUnsafe<RawQueryResult[]>(
                    query,
                    ...paramValues
                );

                const results = await Promise.race([queryPromise, timeoutPromise]) as RawQueryResult[];

                // Convert BigInt values to numbers for JSON serialization
                const convertedResults = results.map(row => {
                    const converted: any = {};
                    for (const [key, value] of Object.entries(row)) {
                        if (typeof value === 'bigint') {
                            converted[key] = Number(value);
                        } else {
                            converted[key] = value;
                        }
                    }
                    return converted as RawQueryResult;
                });

                return convertedResults;
            } catch (error) {
                lastError = error as Error;
                console.error(`Query execution attempt ${attempt} failed:`, error);

                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
                }
            }
        }

        // All retries failed
        console.error('Query execution failed after all retries:', lastError);
        throw new Error(`Database query failed: ${lastError?.message}`);
    }

    async fetchDimensionLookups(dimensionIds: {
        activityTypeIds?: string[];
        activityCategoryIds?: string[];
        geographicAreaIds?: string[];
        venueIds?: string[];
    }): Promise<DimensionLookups> {
        const lookups: DimensionLookups = {
            activityTypes: new Map(),
            activityCategories: new Map(),
            geographicAreas: new Map(),
            venues: new Map(),
        };

        // Fetch activity types
        if (dimensionIds.activityTypeIds && dimensionIds.activityTypeIds.length > 0) {
            const types = await this.prisma.activityType.findMany({
                where: {
                    id: { in: dimensionIds.activityTypeIds },
                },
                select: {
                    id: true,
                    name: true,
                },
            });

            for (const type of types) {
                lookups.activityTypes.set(type.id, type.name);
            }
        }

        // Fetch activity categories
        if (dimensionIds.activityCategoryIds && dimensionIds.activityCategoryIds.length > 0) {
            const categories = await this.prisma.activityCategory.findMany({
                where: {
                    id: { in: dimensionIds.activityCategoryIds },
                },
                select: {
                    id: true,
                    name: true,
                },
            });

            for (const category of categories) {
                lookups.activityCategories.set(category.id, category.name);
            }
        }

        // Fetch geographic areas
        if (dimensionIds.geographicAreaIds && dimensionIds.geographicAreaIds.length > 0) {
            const areas = await this.prisma.geographicArea.findMany({
                where: {
                    id: { in: dimensionIds.geographicAreaIds },
                },
                select: {
                    id: true,
                    name: true,
                },
            });

            for (const area of areas) {
                lookups.geographicAreas.set(area.id, area.name);
            }
        }

        // Fetch venues
        if (dimensionIds.venueIds && dimensionIds.venueIds.length > 0) {
            const venues = await this.prisma.venue.findMany({
                where: {
                    id: { in: dimensionIds.venueIds },
                },
                select: {
                    id: true,
                    name: true,
                },
            });

            for (const venue of venues) {
                lookups.venues.set(venue.id, venue.name);
            }
        }

        return lookups;
    }

    /**
     * Execute COUNT query to get total number of records
     */
    async executeCountQuery(
        sql: string,
        parameters: Record<string, any>
    ): Promise<number> {
        try {
            // Replace parameter placeholders
            let query = sql;
            const paramValues: any[] = [];

            let paramIndex = 1;
            for (const [key, value] of Object.entries(parameters)) {
                query = query.replace(new RegExp(`@${key}`, 'g'), `$${paramIndex}`);
                paramValues.push(value);
                paramIndex++;
            }

            const result = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
                query,
                ...paramValues
            );

            // Convert BigInt to number
            return Number(result[0]?.total || 0);
        } catch (error) {
            console.error('COUNT query failed:', error);
            throw new Error(`Failed to execute COUNT query: ${(error as Error).message}`);
        }
    }

    /**
     * Execute main query and COUNT query in parallel
     */
    async executeEngagementQueryWithCount(
        mainSql: string,
        countSql: string,
        parameters: Record<string, any>
    ): Promise<{ results: RawQueryResult[]; totalCount: number }> {
        // Execute both queries in parallel
        const [results, totalCount] = await Promise.all([
            this.executeEngagementQuery(mainSql, parameters),
            this.executeCountQuery(countSql, parameters),
        ]);

        return {
            results,
            totalCount,
        };
    }
}
