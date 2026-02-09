import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { PrismaClient } from '@prisma/client';

/**
 * Shared service for geographic filtering logic
 * Consolidates duplicated getEffectiveGeographicAreaIds implementations
 */
export class GeographicFilteringService {
    private geographicAreaRepository: GeographicAreaRepository;

    constructor(prisma: PrismaClient) {
        this.geographicAreaRepository = new GeographicAreaRepository(prisma);
    }

    /**
     * Determine effective geographic area IDs for filtering based on:
     * 1. Explicit geographic area filter (if provided)
     * 2. User's authorized areas (if user has geographic restrictions)
     * 3. No filtering (if no explicit filter and no restrictions)
     * 
     * IMPORTANT: This method expands explicit filters to include descendants.
     * Do NOT expand descendants again during implicit filtering.
     * 
     * @param explicitGeographicAreaId - Optional explicit geographic area filter
     * @param authorizedAreaIds - User's authorized geographic area IDs (already expanded)
     * @param hasGeographicRestrictions - Whether user has geographic restrictions
     * @returns Array of area IDs to filter by, or undefined for no filtering
     * @throws Error if user lacks permission for explicit filter
     */
    async getEffectiveGeographicAreaIds(
        explicitGeographicAreaId: string | undefined,
        authorizedAreaIds: string[],
        hasGeographicRestrictions: boolean
    ): Promise<string[] | undefined> {
        // If explicit filter provided
        if (explicitGeographicAreaId) {
            // Validate user has access to this area
            if (hasGeographicRestrictions && !authorizedAreaIds.includes(explicitGeographicAreaId)) {
                throw new Error(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access this geographic area'
                );
            }

            // Expand to include descendants
            const descendantIds = await this.geographicAreaRepository.findBatchDescendants([
                explicitGeographicAreaId,
            ]);
            const allAreaIds = [explicitGeographicAreaId, ...descendantIds];

            // If user has geographic restrictions, filter descendants to only include authorized areas
            // This ensures DENY rules are respected even when an explicit filter is provided
            if (hasGeographicRestrictions) {
                return allAreaIds.filter(id => authorizedAreaIds.includes(id));
            }

            // No restrictions - return all descendants
            return allAreaIds;
        }

        // No explicit filter - apply implicit filtering if user has restrictions
        if (hasGeographicRestrictions) {
            // IMPORTANT: authorizedAreaIds already has descendants expanded and DENY rules applied
            // Do NOT expand descendants again, as this would re-add denied areas
            return authorizedAreaIds;
        }

        // No restrictions and no explicit filter - return undefined (no filtering)
        return undefined;
    }

    /**
     * Variant for analytics service that accepts array of area IDs
     * @param explicitGeographicAreaIds - Optional array of explicit geographic area filters
     * @param authorizedAreaIds - User's authorized geographic area IDs
     * @param hasGeographicRestrictions - Whether user has geographic restrictions
     * @returns Array of area IDs to filter by, or undefined for no filtering
     */
    async getEffectiveGeographicAreaIdsForAnalytics(
        explicitGeographicAreaIds: string | string[] | undefined,
        authorizedAreaIds: string[],
        hasGeographicRestrictions: boolean
    ): Promise<string[] | undefined> {
        // Normalize to array
        const areaIds = explicitGeographicAreaIds
            ? Array.isArray(explicitGeographicAreaIds)
                ? explicitGeographicAreaIds
                : [explicitGeographicAreaIds]
            : undefined;

        // If explicit filters provided
        if (areaIds && areaIds.length > 0) {
            // Validate user has access to all areas
            if (hasGeographicRestrictions) {
                for (const areaId of areaIds) {
                    if (!authorizedAreaIds.includes(areaId)) {
                        throw new Error(
                            'GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access this geographic area'
                        );
                    }
                }
            }

            // Expand all areas to include descendants
            const descendantIds = await this.geographicAreaRepository.findBatchDescendants(areaIds);
            const allAreaIds = [...areaIds, ...descendantIds];

            // If user has restrictions, filter to authorized areas
            if (hasGeographicRestrictions) {
                return allAreaIds.filter(id => authorizedAreaIds.includes(id));
            }

            // No restrictions - return all descendants
            return allAreaIds;
        }

        // No explicit filter - apply implicit filtering if user has restrictions
        if (hasGeographicRestrictions) {
            return authorizedAreaIds;
        }

        // No restrictions and no explicit filter - return undefined
        return undefined;
    }
}
