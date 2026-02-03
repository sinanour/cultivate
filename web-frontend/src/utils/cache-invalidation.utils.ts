import { QueryClient } from '@tanstack/react-query';

/**
 * Utility functions for cache invalidation during pull-to-refresh operations
 */

export interface CacheInvalidationOptions {
    queryKeys?: string[][];
    clearLocalStorage?: boolean;
    clearIndexedDB?: boolean;
    preserveKeys?: string[]; // Keys to preserve in localStorage
}

/**
 * Invalidates caches for the current page
 * 
 * @param queryClient - React Query client instance
 * @param options - Cache invalidation options
 */
export async function invalidatePageCaches(
    queryClient: QueryClient,
    options: CacheInvalidationOptions = {}
): Promise<void> {
    const {
        queryKeys = [],
        clearLocalStorage = false,
        clearIndexedDB = false,
        preserveKeys = ['accessToken', 'refreshToken', 'user']
    } = options;

    // Invalidate React Query caches
    if (queryKeys.length > 0) {
        // Invalidate specific query keys
        for (const queryKey of queryKeys) {
            await queryClient.invalidateQueries({ queryKey });
        }
    } else {
        // Invalidate all queries
        await queryClient.invalidateQueries();
    }

    // Clear localStorage (selective)
    if (clearLocalStorage) {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (!preserveKeys.includes(key)) {
                localStorage.removeItem(key);
            }
        });
    }

    // Clear IndexedDB (if needed)
    if (clearIndexedDB) {
        // This would clear Dexie.js tables
        // Implementation depends on specific Dexie setup
        // For now, we rely on React Query invalidation
        console.log('IndexedDB clearing not yet implemented');
    }
}

/**
 * Gets query keys for list pages
 */
export function getListPageQueryKeys(entityType: 'participants' | 'activities' | 'venues' | 'geographic-areas'): string[][] {
    return [
        [entityType],
        [`${entityType}-count`],
        [`${entityType}-filters`]
    ];
}

/**
 * Gets query keys for detail pages
 */
export function getDetailPageQueryKeys(entityType: string, entityId: string): string[][] {
    return [
        [entityType, entityId],
        [`${entityType}-${entityId}-related`],
        [`${entityType}-${entityId}-activities`],
        [`${entityType}-${entityId}-participants`],
        [`${entityType}-${entityId}-venues`],
        [`${entityType}-${entityId}-history`]
    ];
}

/**
 * Gets query keys for dashboard pages
 */
export function getDashboardQueryKeys(dashboardType: 'engagement' | 'growth'): string[][] {
    return [
        [`${dashboardType}-metrics`],
        [`${dashboardType}-charts`],
        ['analytics'],
        ['activity-lifecycle']
    ];
}

/**
 * Gets query keys for map view
 */
export function getMapQueryKeys(): string[][] {
    return [
        ['map-markers'],
        ['map-activities'],
        ['map-participant-homes'],
        ['map-venues'],
        ['map-popup']
    ];
}
