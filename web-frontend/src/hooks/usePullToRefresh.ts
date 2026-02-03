import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface PullToRefreshOptions {
    onRefresh: () => Promise<void> | void;
    queryKeys?: string[][]; // Specific query keys to invalidate
    clearLocalStorage?: boolean;
    clearIndexedDB?: boolean;
}

export interface PullToRefreshState {
    isRefreshing: boolean;
    error: Error | null;
}

/**
 * Custom hook for implementing pull-to-refresh functionality
 * 
 * @param options - Configuration options for pull-to-refresh
 * @returns State and trigger function for pull-to-refresh
 * 
 * @example
 * ```tsx
 * const { isRefreshing, error, triggerRefresh } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await refetchData();
 *   },
 *   queryKeys: [['participants'], ['activities']],
 *   clearLocalStorage: true
 * });
 * ```
 */
export function usePullToRefresh(options: PullToRefreshOptions): PullToRefreshState & {
    triggerRefresh: () => Promise<void>;
} {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const triggerRefresh = useCallback(async () => {
        try {
            setIsRefreshing(true);
            setError(null);

            // Invalidate React Query caches
            if (options.queryKeys && options.queryKeys.length > 0) {
                // Invalidate specific query keys
                for (const queryKey of options.queryKeys) {
                    await queryClient.invalidateQueries({ queryKey });
                }
            } else {
                // Invalidate all queries if no specific keys provided
                await queryClient.invalidateQueries();
            }

            // Clear localStorage if requested
            if (options.clearLocalStorage) {
                // Clear page-specific localStorage keys
                // Note: This is a selective clear - we don't want to clear auth tokens
                const keysToPreserve = ['accessToken', 'refreshToken', 'user'];
                const allKeys = Object.keys(localStorage);
                allKeys.forEach(key => {
                    if (!keysToPreserve.includes(key)) {
                        localStorage.removeItem(key);
                    }
                });
            }

            // Clear IndexedDB if requested
            if (options.clearIndexedDB) {
                // This would clear Dexie.js tables
                // Implementation depends on specific Dexie setup
                // For now, we'll rely on React Query invalidation
            }

            // Execute the custom refresh callback
            await options.onRefresh();

        } catch (err) {
            setError(err instanceof Error ? err : new Error('Refresh failed'));
            console.error('Pull-to-refresh error:', err);
        } finally {
            setIsRefreshing(false);
        }
    }, [options, queryClient]);

    return {
        isRefreshing,
        error,
        triggerRefresh
    };
}
