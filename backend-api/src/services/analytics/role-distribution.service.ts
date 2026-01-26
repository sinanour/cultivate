import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { RoleDistributionQueryBuilder, RoleDistributionFilters, RawRoleDistributionResult } from './role-distribution-query-builder';

export interface RoleDistributionWireFormat {
    data: Array<[number, number]>;  // [roleIndex, count]
    lookups: {
        roles: Array<{ id: string; name: string }>;
    };
    metadata: {
        columns: string[];
    };
}

/**
 * Service for fetching optimized role distribution analytics
 */
export class RoleDistributionService {
    private queryBuilder: RoleDistributionQueryBuilder;

    constructor(
        private prisma: PrismaClient,
        private geographicAreaRepository: GeographicAreaRepository
    ) {
        this.queryBuilder = new RoleDistributionQueryBuilder();
    }

    /**
     * Get role distribution with database-level aggregation
     */
    async getRoleDistribution(
        filters: RoleDistributionFilters,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<RoleDistributionWireFormat> {
        try {
            // Apply geographic authorization filtering
            const effectiveFilters = await this.applyGeographicAuthorization(
                filters,
                authorizedAreaIds,
                hasGeographicRestrictions
            );

            // Build and execute query
            const { sql, parameters } = this.queryBuilder.buildRoleDistributionQuery(effectiveFilters);
            const results = await this.executeQuery(sql, parameters);

            // Fetch role lookups
            const roleIds = results.map(r => r.roleId);
            const roleLookups = await this.fetchRoleLookups(roleIds);

            // Transform to wire format
            return this.transformToWireFormat(results, roleLookups);
        } catch (error: any) {
            console.error('Error fetching role distribution:', error);

            // Re-throw authorization errors
            if (error.code === 'GEOGRAPHIC_AUTHORIZATION_DENIED') {
                throw error;
            }

            // Wrap other errors
            const wrappedError: any = new Error('Failed to fetch role distribution');
            wrappedError.code = 'ROLE_DISTRIBUTION_ERROR';
            wrappedError.statusCode = 500;
            wrappedError.details = { originalError: error.message };
            throw wrappedError;
        }
    }

    /**
     * Apply geographic authorization filtering
     */
    private async applyGeographicAuthorization(
        filters: RoleDistributionFilters,
        authorizedAreaIds: string[],
        hasGeographicRestrictions: boolean
    ): Promise<RoleDistributionFilters> {
        const effectiveFilters = { ...filters };

        // Handle geographic area filtering with authorization
        if (hasGeographicRestrictions) {
            if (effectiveFilters.geographicAreaIds && effectiveFilters.geographicAreaIds.length > 0) {
                // Validate user has access to requested areas
                effectiveFilters.geographicAreaIds = effectiveFilters.geographicAreaIds.filter((id) =>
                    authorizedAreaIds.includes(id)
                );

                // If no authorized areas remain, throw error
                if (effectiveFilters.geographicAreaIds.length === 0) {
                    const error: any = new Error('Access denied to requested geographic areas');
                    error.code = 'GEOGRAPHIC_AUTHORIZATION_DENIED';
                    error.statusCode = 403;
                    throw error;
                }

                // Expand to include descendants
                const descendantIds = await this.geographicAreaRepository.findBatchDescendants(
                    effectiveFilters.geographicAreaIds
                );
                const allExpandedIds = new Set<string>([
                    ...effectiveFilters.geographicAreaIds,
                    ...descendantIds,
                ]);

                // Filter descendants to only authorized areas
                effectiveFilters.geographicAreaIds = Array.from(allExpandedIds).filter((id) =>
                    authorizedAreaIds.includes(id)
                );
            } else {
                // No explicit filter - apply implicit filtering
                effectiveFilters.geographicAreaIds = authorizedAreaIds;
            }
        } else {
            // No geographic restrictions
            if (effectiveFilters.geographicAreaIds && effectiveFilters.geographicAreaIds.length > 0) {
                // Expand to include descendants
                const descendantIds = await this.geographicAreaRepository.findBatchDescendants(
                    effectiveFilters.geographicAreaIds
                );
                effectiveFilters.geographicAreaIds = [
                    ...effectiveFilters.geographicAreaIds,
                    ...descendantIds,
                ];
            }
        }

        return effectiveFilters;
    }

    /**
     * Execute the role distribution query
     */
    private async executeQuery(
        sql: string,
        parameters: any[]
    ): Promise<RawRoleDistributionResult[]> {
        try {
            // Execute query with positional parameters
            const results = await this.prisma.$queryRawUnsafe<RawRoleDistributionResult[]>(
                sql,
                ...parameters
            );

            // Convert BigInt to number
            return results.map(row => ({
                roleId: row.roleId,
                assignmentCount: typeof row.assignmentCount === 'bigint'
                    ? Number(row.assignmentCount)
                    : row.assignmentCount as any,
            }));
        } catch (error) {
            console.error('Role distribution query failed:', error);
            throw error;
        }
    }

    /**
     * Fetch role name lookups
     */
    private async fetchRoleLookups(roleIds: string[]): Promise<Map<string, string>> {
        if (roleIds.length === 0) {
            return new Map();
        }

        const roles = await this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true, name: true },
        });

        return new Map(roles.map(r => [r.id, r.name]));
    }

    /**
     * Transform query results to wire format
     */
    private transformToWireFormat(
        results: RawRoleDistributionResult[],
        roleLookups: Map<string, string>
    ): RoleDistributionWireFormat {
        // Build roles lookup array (ordered by result order)
        const rolesArray: Array<{ id: string; name: string }> = [];
        const roleIdToIndex = new Map<string, number>();

        results.forEach((result, index) => {
            const roleName = roleLookups.get(result.roleId) || 'Unknown Role';
            rolesArray.push({
                id: result.roleId,
                name: roleName,
            });
            roleIdToIndex.set(result.roleId, index);
        });

        // Build data rows: [roleIndex, count]
        const data: Array<[number, number]> = results.map((result, index) => [
            index,  // roleIndex
            Number(result.assignmentCount),  // count
        ]);

        return {
            data,
            lookups: {
                roles: rolesArray,
            },
            metadata: {
                columns: ['roleIndex', 'count'],
            },
        };
    }
}
