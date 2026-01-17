import { useState, useEffect, useCallback, useRef } from 'react';
import { GeographicAreaService } from '../services/api/geographic-area.service';
import type { GeographicArea, GeographicAreaWithHierarchy } from '../types';

interface UseGeographicAreaOptionsParams {
    /** ID of a specific area that must be included (e.g., when editing) */
    ensureIncluded?: string | null;
    /** Filter to exclude a specific area (e.g., prevent self-reference) */
    excludeAreaId?: string | null;
}

/**
 * Custom hook for managing geographic area options with lazy loading and search.
 * Implements the same pattern as GlobalGeographicFilterContext for consistent UX.
 */
export function useGeographicAreaOptions({
    ensureIncluded,
    excludeAreaId,
}: UseGeographicAreaOptionsParams = {}) {
    const [options, setOptions] = useState<GeographicAreaWithHierarchy[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const ancestorCacheRef = useRef<Map<string, GeographicArea>>(new Map());

    const buildHierarchyPaths = useCallback(async (
        areas: GeographicArea[]
    ): Promise<GeographicAreaWithHierarchy[]> => {
        const ancestorCache = ancestorCacheRef.current;

        // Add new areas to cache
        areas.forEach(area => ancestorCache.set(area.id, area));

        // Identify unique parent IDs
        const uniqueParentIds = new Set<string>();
        for (const area of areas) {
            if (area.parentGeographicAreaId) {
                uniqueParentIds.add(area.parentGeographicAreaId);
            }
        }

        // Determine which parents are missing from cache
        const missingParentIds = Array.from(uniqueParentIds).filter(id => !ancestorCache.has(id));

        // Fetch missing ancestors
        if (missingParentIds.length > 0) {
            try {
                // Chunk parent IDs if > 100
                const parentIdChunks: string[][] = [];
                for (let i = 0; i < missingParentIds.length; i += 100) {
                    parentIdChunks.push(missingParentIds.slice(i, i + 100));
                }

                // Fetch parent maps for all chunks
                const allParentMaps: Record<string, string | null>[] = [];
                for (const chunk of parentIdChunks) {
                    const parentMap = await GeographicAreaService.getBatchAncestors(chunk);
                    allParentMaps.push(parentMap);
                }

                // Merge all parent maps
                const mergedParentMap: Record<string, string | null> = {};
                for (const map of allParentMaps) {
                    Object.assign(mergedParentMap, map);
                }

                // Collect all ancestor IDs
                const allAncestorIds = new Set<string>();
                for (const [areaId, parentId] of Object.entries(mergedParentMap)) {
                    allAncestorIds.add(areaId);
                    if (parentId) {
                        allAncestorIds.add(parentId);
                    }
                }

                // Fetch details for ancestors not in cache (chunked if > 100)
                const ancestorIdsToFetch = Array.from(allAncestorIds).filter(id => !ancestorCache.has(id));
                if (ancestorIdsToFetch.length > 0) {
                    const ancestorIdChunks: string[][] = [];
                    for (let i = 0; i < ancestorIdsToFetch.length; i += 100) {
                        ancestorIdChunks.push(ancestorIdsToFetch.slice(i, i + 100));
                    }

                    for (const chunk of ancestorIdChunks) {
                        const ancestorDetailsMap = await GeographicAreaService.getBatchDetails(chunk);
                        for (const [id, data] of Object.entries(ancestorDetailsMap)) {
                            if (data) {
                                ancestorCache.set(id, data);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch ancestors:', error);
            }
        }

        // Build hierarchy paths using cache
        return areas.map(area => {
            const ancestors: GeographicArea[] = [];
            let currentId = area.parentGeographicAreaId;

            while (currentId) {
                const parent = ancestorCache.get(currentId);
                if (!parent) break;
                ancestors.push(parent);
                currentId = parent.parentGeographicAreaId;
            }

            const hierarchyPath = ancestors.length > 0
                ? ancestors.map(a => a.name).join(' > ')
                : '';

            return {
                ...area,
                ancestors,
                hierarchyPath,
            } as GeographicAreaWithHierarchy;
        });
    }, []);

    const fetchAreas = useCallback(async (query: string) => {
        try {
            setIsLoading(true);

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            const response = await GeographicAreaService.getGeographicAreasFlexible({
                page: 1,
                limit: 100,
                filter: query ? { name: query } : undefined,
                depth: undefined,
            });

            const areas = Array.isArray(response) ? response : response.data;

            // Ensure included area is present (e.g., when editing)
            if (ensureIncluded) {
                const hasIncluded = areas.some((a: GeographicArea) => a.id === ensureIncluded);
                if (!hasIncluded) {
                    try {
                        const includedArea = await GeographicAreaService.getGeographicAreaById(ensureIncluded);
                        areas.push(includedArea);
                    } catch (error) {
                        console.error('Failed to fetch included area:', error);
                    }
                }
            }

            // Build hierarchy paths
            const areasWithHierarchy = await buildHierarchyPaths(areas);

            // Filter out excluded area if specified
            const filteredAreas = excludeAreaId
                ? areasWithHierarchy.filter(a => a.id !== excludeAreaId)
                : areasWithHierarchy;

            setOptions(filteredAreas);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to fetch geographic areas:', error);
            setOptions([]);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [ensureIncluded, excludeAreaId, buildHierarchyPaths]);

    // Fetch initial batch
    useEffect(() => {
        fetchAreas('');
    }, [fetchAreas]);

    // Handle search with debouncing
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery) {
            searchTimeoutRef.current = setTimeout(() => {
                fetchAreas(searchQuery);
            }, 300);
        } else {
            fetchAreas('');
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [searchQuery, fetchAreas]);

    const handleLoadItems = useCallback((filteringText: string) => {
        setSearchQuery(filteringText);
    }, []);

    const refetch = useCallback(() => {
        // Clear cache and refetch
        ancestorCacheRef.current.clear();
        fetchAreas(searchQuery);
    }, [searchQuery, fetchAreas]);

    return {
        options,
        isLoading,
        handleLoadItems,
        refetch,
    };
}
