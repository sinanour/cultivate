import React, { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { GeographicArea, GeographicAreaWithHierarchy } from '../types';
import { GeographicAreaService } from '../services/api/geographic-area.service';
import { useAuth } from '../hooks/useAuth';
import { geographicFilterEvents } from '../utils/geographic-filter-events';

interface GlobalGeographicFilterContextType {
  selectedGeographicAreaId: string | null;
  selectedGeographicArea: GeographicArea | null;
  availableAreas: GeographicAreaWithHierarchy[];
  setGeographicAreaFilter: (id: string | null) => void;
  clearFilter: () => void;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  loadMoreAreas: () => Promise<void>;
  hasMorePages: boolean;
}

export const GlobalGeographicFilterContext = createContext<GlobalGeographicFilterContextType | undefined>(undefined);

interface GlobalGeographicFilterProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'globalGeographicAreaFilter';

export const GlobalGeographicFilterProvider: React.FC<GlobalGeographicFilterProviderProps> = ({ children }) => {
  const [selectedGeographicAreaId, setSelectedGeographicAreaId] = useState<string | null>(null);
  const [selectedGeographicArea, setSelectedGeographicArea] = useState<GeographicArea | null>(null);
  const [availableAreas, setAvailableAreas] = useState<GeographicAreaWithHierarchy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isClearingRef = useRef(false); // Track intentional clearing to prevent re-sync
  
  // Persistent ancestor cache across all batches (used ONLY for hierarchy paths, NOT for dropdown options)
  const ancestorCacheRef = useRef<Map<string, GeographicArea>>(new Map());

  // Helper function to chunk an array into smaller arrays of specified size
  const chunkArray = <T,>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  // Helper function to build hierarchy paths with intelligent ancestor batching
  const buildHierarchyPathsWithBatching = useCallback(async (
    newAreas: GeographicArea[],
    existingAncestorCache: Map<string, GeographicArea>
  ): Promise<GeographicAreaWithHierarchy[]> => {
    // Create a map for ancestor data ONLY (not for dropdown options)
    // This cache is used exclusively for building hierarchy paths
    const ancestorCache = new Map<string, GeographicArea>(existingAncestorCache);
    
    // Add new areas to ancestor cache (they might be parents of future areas)
    newAreas.forEach(area => ancestorCache.set(area.id, area));

    // Identify unique parent IDs from new areas
    const uniqueParentIds = new Set<string>();
    for (const area of newAreas) {
      if (area.parentGeographicAreaId) {
        uniqueParentIds.add(area.parentGeographicAreaId);
      }
    }

    // Determine which parent areas are missing from our cache
    const missingParentIds = Array.from(uniqueParentIds).filter(parentId => !ancestorCache.has(parentId));

    // If we have missing parents, fetch their complete ancestor chains in batches
    if (missingParentIds.length > 0) {
      try {
        
        // Step 1: Fetch ancestor IDs using batch-ancestors endpoint (chunked if > 100)
        const parentIdChunks = chunkArray(missingParentIds, 100);
        
        const allParentMaps: Record<string, string | null>[] = [];
        for (let i = 0; i < parentIdChunks.length; i++) {
          const chunk = parentIdChunks[i];
          const parentMap = await GeographicAreaService.getBatchAncestors(chunk);
          allParentMaps.push(parentMap);
        }
        
        // Step 2: Collect all unique area IDs from all parent maps (both keys and values)
        const allAncestorIds = new Set<string>();
        for (const parentMap of allParentMaps) {
          for (const [areaId, parentId] of Object.entries(parentMap)) {
            allAncestorIds.add(areaId);
            if (parentId) {
              allAncestorIds.add(parentId);
            }
          }
        }
        
        // Filter to only IDs we don't already have in cache
        const ancestorIdsToFetch = Array.from(allAncestorIds).filter(id => !ancestorCache.has(id));
        
        // Step 3: Fetch full geographic area objects for all ancestors using batch-details endpoint (chunked if > 100)
        if (ancestorIdsToFetch.length > 0) {
          
          const ancestorIdChunks = chunkArray(ancestorIdsToFetch, 100);
          
          for (let i = 0; i < ancestorIdChunks.length; i++) {
            const chunk = ancestorIdChunks[i];
            const ancestorDetailsMap = await GeographicAreaService.getBatchDetails(chunk);
            
            // Add fetched ancestors to our cache (NOT to dropdown options)
            for (const [ancestorId, ancestorData] of Object.entries(ancestorDetailsMap)) {
              if (ancestorData && !ancestorCache.has(ancestorId)) {
                ancestorCache.set(ancestorId, ancestorData);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch batch ancestors:', error);
        // Continue without ancestor data - paths will be incomplete but functional
      }
    }

    // Build hierarchy paths and ancestor arrays for all areas using the ancestor cache
    const buildHierarchyData = (area: GeographicArea): { hierarchyPath: string; ancestors: GeographicArea[] } => {
      const ancestorNames: string[] = [];
      const ancestorObjects: GeographicArea[] = [];
      let currentId = area.parentGeographicAreaId;
      
      while (currentId) {
        const parent = ancestorCache.get(currentId);
        if (!parent) {
          console.warn(`Missing parent ${currentId} for area ${area.name} (${area.id})`);
          break;
        }
        ancestorNames.push(parent.name);
        ancestorObjects.push(parent);
        currentId = parent.parentGeographicAreaId;
      }
      
      return {
        hierarchyPath: ancestorNames.length > 0 ? ancestorNames.join(' > ') : '',
        ancestors: ancestorObjects, // Ordered from closest parent to most distant ancestor
      };
    };

    // CRITICAL: Return ONLY the newAreas with hierarchy paths
    // Do NOT return ancestors from the cache
    const result = newAreas.map(area => {
      const { hierarchyPath, ancestors } = buildHierarchyData(area);
      return {
        ...area,
        ancestors,
        hierarchyPath,
      } as GeographicAreaWithHierarchy;
    });

    return result;
  }, []);

  // Helper to clear filter state and update URL/localStorage
  const clearFilterState = () => {
    isClearingRef.current = true; // Mark that we're intentionally clearing
    setSelectedGeographicAreaId(null);
    localStorage.removeItem(STORAGE_KEY);
    
    // Remove from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('geographicArea');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true });
    
    // Reset clearing flag after a short delay to allow state to propagate
    setTimeout(() => {
      isClearingRef.current = false;
    }, 100);
  };

  // Sync filter with URL and localStorage
  // Backend handles authorization - we trust that any area we can fetch is authorized
  useEffect(() => {
    if (!user) {
      return;
    }

    // Skip if we're in the middle of intentionally clearing
    if (isClearingRef.current) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const urlGeographicAreaId = searchParams.get('geographicArea');

    if (urlGeographicAreaId) {
      // URL has a geographic area parameter - apply it
      if (selectedGeographicAreaId !== urlGeographicAreaId) {
        setSelectedGeographicAreaId(urlGeographicAreaId);
        localStorage.setItem(STORAGE_KEY, urlGeographicAreaId);
      }
    } else if (selectedGeographicAreaId === null) {
      // No URL parameter and no selected area - check localStorage
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        setSelectedGeographicAreaId(storedId);
        // Sync to URL
        const newSearchParams = new URLSearchParams(location.search);
        newSearchParams.set('geographicArea', storedId);
        navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
      }
    } else if (selectedGeographicAreaId !== null && !urlGeographicAreaId) {
      // We have a selected area but URL doesn't have the parameter
      // Re-add the parameter to the URL to maintain the filter
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.set('geographicArea', selectedGeographicAreaId);
      navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
    }
  }, [location.search, location.pathname, user]);

  // Fetch geographic area details when ID changes
  useEffect(() => {
    if (!selectedGeographicAreaId) {
      setSelectedGeographicArea(null);
      return;
    }

    const fetchGeographicArea = async () => {
      setIsLoading(true);
      try {
        const area = await GeographicAreaService.getGeographicAreaById(selectedGeographicAreaId);
        setSelectedGeographicArea(area);
      } catch (error) {
        console.error('Failed to fetch geographic area:', error);
        // Clear invalid filter
        clearFilterState();
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeographicArea();
  }, [selectedGeographicAreaId]);

  // Fetch available areas based on current filter scope and search query
  useEffect(() => {
    // Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const fetchAvailableAreas = async () => {
      try {
        setIsSearching(true);
        abortControllerRef.current = new AbortController();
        
        // Clear ancestor cache when starting a new search
        ancestorCacheRef.current.clear();
        
        // Fetch first page of areas with pagination
        const response = await GeographicAreaService.getGeographicAreasFlexible({
          page: 1,
          limit: 100,
          geographicAreaId: selectedGeographicAreaId,
          filter: searchQuery ? { name: searchQuery } : undefined,
          depth: undefined  // No depth limit, fetch all matching areas
        });

        // Handle both paginated and non-paginated responses
        const areas = Array.isArray(response) ? response : response.data;
        const pagination = Array.isArray(response) ? null : response.pagination;

        // Check if there are more pages
        const hasMore = pagination ? pagination.page < pagination.totalPages : false;
        setHasMorePages(hasMore);
        setCurrentPage(1);

        // Implement intelligent ancestor batching
        // Pass the persistent ancestor cache
        const areasWithHierarchy = await buildHierarchyPathsWithBatching(areas, ancestorCacheRef.current);

        setAvailableAreas(areasWithHierarchy);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Request was aborted, ignore
          return;
        }
        console.error('Failed to fetch available geographic areas:', error);
        setAvailableAreas([]);
        setHasMorePages(false);
      } finally {
        setIsSearching(false);
        abortControllerRef.current = null;
      }
    };

    // Debounce search queries (300ms delay)
    if (searchQuery) {
      searchTimeoutRef.current = setTimeout(() => {
        fetchAvailableAreas();
      }, 300);
    } else {
      // No search query - fetch immediately
      fetchAvailableAreas();
    }

    // Cleanup timeout and abort controller on unmount or when dependencies change
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedGeographicAreaId, searchQuery, buildHierarchyPathsWithBatching]);

  // Load more areas when user scrolls to bottom (if more pages available)
  const loadMoreAreas = useCallback(async () => {
    if (!hasMorePages || isSearching) {
      return;
    }

    try {
      setIsSearching(true);
      const nextPage = currentPage + 1;

      const response = await GeographicAreaService.getGeographicAreasFlexible({
        page: nextPage,
        limit: 100,
        geographicAreaId: selectedGeographicAreaId,
        filter: searchQuery ? { name: searchQuery } : undefined,
        depth: undefined  // No depth limit
      });

      // Handle both paginated and non-paginated responses
      const areas = Array.isArray(response) ? response : response.data;
      const pagination = Array.isArray(response) ? null : response.pagination;

      // Check if there are more pages after this one
      const hasMore = pagination ? pagination.page < pagination.totalPages : false;
      setHasMorePages(hasMore);
      setCurrentPage(nextPage);

      // Use the persistent ancestor cache (NOT the availableAreas)
      // This ensures we reuse ancestor data across batches without adding ancestors to options
      const newAreasWithHierarchy = await buildHierarchyPathsWithBatching(areas, ancestorCacheRef.current);

      // Append new areas to existing ones (ancestors are NOT included)
      setAvailableAreas(prev => [...prev, ...newAreasWithHierarchy]);
    } catch (error) {
      console.error('Failed to load more geographic areas:', error);
    } finally {
      setIsSearching(false);
    }
  }, [hasMorePages, isSearching, currentPage, selectedGeographicAreaId, searchQuery, buildHierarchyPathsWithBatching]);

  const setGeographicAreaFilter = (id: string | null) => {
    // Backend handles authorization - trust that returned areas are authorized
    setSelectedGeographicAreaId(id);

    if (id) {
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, id);

      // Update URL
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('geographicArea', id);
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    } else {
      clearFilterState();
    }
  };

  const clearFilter = () => {
    clearFilterState();
  };

  // Subscribe to geographic authorization error events
  useEffect(() => {
    const unsubscribe = geographicFilterEvents.subscribe(() => {
      // Only clear if a filter is actually active
      if (selectedGeographicAreaId) {
        console.warn('Clearing geographic filter due to authorization error');
        clearFilterState();
        
        // Show notification to user
        // Note: This could be enhanced with a toast notification system
        // For now, we rely on the error message from the API call itself
      }
    });

    return unsubscribe;
  }, [selectedGeographicAreaId]);

  return (
    <GlobalGeographicFilterContext.Provider
      value={{
        selectedGeographicAreaId,
        selectedGeographicArea,
        availableAreas,
        setGeographicAreaFilter,
        clearFilter,
        isLoading,
        searchQuery,
        setSearchQuery,
        isSearching,
        loadMoreAreas,
        hasMorePages,
      }}
    >
      {children}
    </GlobalGeographicFilterContext.Provider>
  );
};
