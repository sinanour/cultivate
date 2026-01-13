import React, { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { GeographicArea, GeographicAreaWithHierarchy } from '../types';
import { GeographicAreaService } from '../services/api/geographic-area.service';
import { geographicAuthorizationService } from '../services/api/geographic-authorization.service';
import { useAuth } from '../hooks/useAuth';
import { geographicFilterEvents } from '../utils/geographic-filter-events';

interface GlobalGeographicFilterContextType {
  selectedGeographicAreaId: string | null;
  selectedGeographicArea: GeographicArea | null;
  availableAreas: GeographicAreaWithHierarchy[];
  authorizedAreaIds: Set<string>;
  setGeographicAreaFilter: (id: string | null) => void;
  clearFilter: () => void;
  isLoading: boolean;
  isAuthorizedArea: (areaId: string) => boolean;
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
  const [authorizedAreaIds, setAuthorizedAreaIds] = useState<Set<string>>(new Set());
  const [hasAuthorizationRules, setHasAuthorizationRules] = useState<boolean | null>(null); // null = not loaded yet
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
    existingMap: Map<string, GeographicArea>
  ): Promise<GeographicAreaWithHierarchy[]> => {
    // Create a map of all areas we have (from existing + new batch)
    const areaMap = new Map<string, GeographicArea>(existingMap);
    
    // Add new areas to map
    newAreas.forEach(area => areaMap.set(area.id, area));

    // Identify unique parent IDs from new areas
    const uniqueParentIds = new Set<string>();
    for (const area of newAreas) {
      if (area.parentGeographicAreaId) {
        uniqueParentIds.add(area.parentGeographicAreaId);
      }
    }

    // Determine which parent areas are missing from our map
    const missingParentIds = Array.from(uniqueParentIds).filter(parentId => !areaMap.has(parentId));

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
        
        // Filter to only IDs we don't already have
        const ancestorIdsToFetch = Array.from(allAncestorIds).filter(id => !areaMap.has(id));
        
        // Step 3: Fetch full geographic area objects for all ancestors using batch-details endpoint (chunked if > 100)
        if (ancestorIdsToFetch.length > 0) {
          
          const ancestorIdChunks = chunkArray(ancestorIdsToFetch, 100);
          
          for (let i = 0; i < ancestorIdChunks.length; i++) {
            const chunk = ancestorIdChunks[i];
            const ancestorDetailsMap = await GeographicAreaService.getBatchDetails(chunk);
            
            // Add fetched ancestors to our area map
            for (const [ancestorId, ancestorData] of Object.entries(ancestorDetailsMap)) {
              if (ancestorData && !areaMap.has(ancestorId)) {
                areaMap.set(ancestorId, ancestorData);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch batch ancestors:', error);
        // Continue without ancestor data - paths will be incomplete but functional
      }
    }

    // Build hierarchy paths and ancestor arrays for all areas using the complete area map
    const buildHierarchyData = (area: GeographicArea): { hierarchyPath: string; ancestors: GeographicArea[] } => {
      const ancestorNames: string[] = [];
      const ancestorObjects: GeographicArea[] = [];
      let currentId = area.parentGeographicAreaId;
      
      while (currentId) {
        const parent = areaMap.get(currentId);
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

  // Fetch user's authorized areas
  useEffect(() => {
    if (!user) {
      setAuthorizedAreaIds(new Set());
      setHasAuthorizationRules(false); // No user = no rules
      return;
    }

    const fetchAuthorizedAreas = async () => {
      try {
        const authorizedAreas = await geographicAuthorizationService.getAuthorizedAreas(user.id);
        
        // Check if user has any authorization rules
        // If the response is empty, user has unrestricted access
        const hasRules = authorizedAreas.length > 0;
        setHasAuthorizationRules(hasRules);
        
        if (!hasRules) {
          // No authorization rules = unrestricted access
          setAuthorizedAreaIds(new Set());
          return;
        }
        
        // Extract directly authorized area IDs where user can apply filters
        // Only include areas with FULL access that are not descendants or ancestors
        // - FULL access: User has write permissions
        // - !isDescendant: Not inherited from parent ALLOW rule
        // - !isAncestor: Not a read-only ancestor (ancestors have READ_ONLY access)
        const directlyAuthorizedIds = authorizedAreas
          .filter(area => 
            area.accessLevel === 'FULL' && 
            !area.isDescendant && 
            !area.isAncestor
          )
          .map(area => area.geographicAreaId);
        
        setAuthorizedAreaIds(new Set(directlyAuthorizedIds));
      } catch (error) {
        console.error('Failed to fetch authorized areas:', error);
        // On error, assume unrestricted access to avoid blocking user
        setHasAuthorizationRules(false);
        setAuthorizedAreaIds(new Set());
      }
    };

    fetchAuthorizedAreas();
  }, [user]);

  const isAuthorizedArea = (areaId: string): boolean => {
    // If we haven't loaded authorization rules yet, deny access (safe default)
    if (hasAuthorizationRules === null) {
      return false;
    }
    
    // If user has no authorization rules, they have unrestricted access
    if (hasAuthorizationRules === false) {
      return true;
    }
    
    // User has authorization rules - check if this specific area is authorized
    return authorizedAreaIds.has(areaId);
  };

  // Helper to clear filter state and update URL/localStorage
  const clearFilterState = () => {
    setSelectedGeographicAreaId(null);
    localStorage.removeItem(STORAGE_KEY);
    
    // Remove from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('geographicArea');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true });
  };

  // Validate and sync filter from URL whenever URL changes
  useEffect(() => {
    // Skip if we haven't loaded user yet
    if (!user) {
      return;
    }
    
    // Skip if we haven't loaded authorization rules yet
    if (hasAuthorizationRules === null) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const urlGeographicAreaId = searchParams.get('geographicArea');

    if (urlGeographicAreaId) {
      // URL has a geographic area parameter
      // Validate authorization before applying
      const isAuthorized = isAuthorizedArea(urlGeographicAreaId);
      
      if (isAuthorized) {
        // Authorized - apply the filter
        if (selectedGeographicAreaId !== urlGeographicAreaId) {
          setSelectedGeographicAreaId(urlGeographicAreaId);
          localStorage.setItem(STORAGE_KEY, urlGeographicAreaId);
        }
      } else {
        // Unauthorized area - clear from URL and revert to Global
        console.warn(`User not authorized for area ${urlGeographicAreaId}, clearing filter from URL`);
        clearFilterState();
      }
    } else if (selectedGeographicAreaId === null) {
      // No URL parameter and no selected area - check localStorage only on initial load
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        // Validate authorization before applying
        if (isAuthorizedArea(storedId)) {
          setSelectedGeographicAreaId(storedId);
          // Sync to URL
          const newSearchParams = new URLSearchParams(location.search);
          newSearchParams.set('geographicArea', storedId);
          navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
        } else {
          // Unauthorized area - clear from localStorage
          console.warn(`User not authorized for stored area ${storedId}, clearing from localStorage`);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } else if (selectedGeographicAreaId !== null && !urlGeographicAreaId) {
      // We have a selected area but URL doesn't have the parameter
      // This happens when navigating to a new page
      // Re-add the parameter to the URL to maintain the filter
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.set('geographicArea', selectedGeographicAreaId);
      navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
    }
  }, [location.search, location.pathname, hasAuthorizationRules, user]); // Added location.pathname to dependencies

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
        
        // Fetch first page of areas with pagination
        const response = await GeographicAreaService.getGeographicAreas(
          1,  // page 1
          100,  // limit 100 per page
          selectedGeographicAreaId,  // geographicAreaId filter
          searchQuery || undefined,  // search query
          undefined  // depth - no limit, fetch all matching areas
        );

        // Handle both paginated and non-paginated responses
        const areas = Array.isArray(response) ? response : response.data;
        const pagination = Array.isArray(response) ? null : response.pagination;

        // Check if there are more pages
        const hasMore = pagination ? pagination.page < pagination.totalPages : false;
        setHasMorePages(hasMore);
        setCurrentPage(1);

        // Implement intelligent ancestor batching
        const areasWithHierarchy = await buildHierarchyPathsWithBatching(areas, new Map());

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

      const response = await GeographicAreaService.getGeographicAreas(
        nextPage,
        100,
        selectedGeographicAreaId,
        searchQuery || undefined,
        undefined  // No depth limit
      );

      // Handle both paginated and non-paginated responses
      const areas = Array.isArray(response) ? response : response.data;
      const pagination = Array.isArray(response) ? null : response.pagination;

      // Check if there are more pages after this one
      const hasMore = pagination ? pagination.page < pagination.totalPages : false;
      setHasMorePages(hasMore);
      setCurrentPage(nextPage);

      // Build existing area map from current availableAreas
      const existingAreaMap = new Map<string, GeographicArea>();
      availableAreas.forEach(area => existingAreaMap.set(area.id, area));

      // Use the shared helper function
      const newAreasWithHierarchy = await buildHierarchyPathsWithBatching(areas, existingAreaMap);

      // Append new areas to existing ones
      setAvailableAreas(prev => [...prev, ...newAreasWithHierarchy]);
    } catch (error) {
      console.error('Failed to load more geographic areas:', error);
    } finally {
      setIsSearching(false);
    }
  }, [hasMorePages, isSearching, currentPage, selectedGeographicAreaId, searchQuery, availableAreas, buildHierarchyPathsWithBatching]);

  const setGeographicAreaFilter = (id: string | null) => {
    // Validate authorization before setting filter
    if (id && !isAuthorizedArea(id)) {
      console.warn(`User not authorized for area ${id}, clearing filter`);
      clearFilterState();
      return;
    }

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
        authorizedAreaIds,
        setGeographicAreaFilter,
        clearFilter,
        isLoading,
        isAuthorizedArea,
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
