import React, { createContext, useState, useEffect, type ReactNode } from 'react';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

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
          console.log('User has unrestricted access (no authorization rules)');
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
        
        console.log(`User has authorization rules. Direct authorization for ${directlyAuthorizedIds.length} areas:`, directlyAuthorizedIds);
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
      console.log('Waiting for authorization rules to load before validating filter...');
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const urlGeographicAreaId = searchParams.get('geographicArea');

    if (urlGeographicAreaId) {
      // URL has a geographic area parameter
      // Validate authorization before applying
      const isAuthorized = isAuthorizedArea(urlGeographicAreaId);
      console.log(`Validating URL parameter ${urlGeographicAreaId}: ${isAuthorized ? 'AUTHORIZED' : 'UNAUTHORIZED'}`);
      
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

  // Fetch available areas based on current filter scope
  useEffect(() => {
    const fetchAvailableAreas = async () => {
      try {
        // Fetch areas based on current filter with depth=1 for lazy loading
        // When filter is active, only fetch descendants with depth=1
        // When filter is "Global", fetch all top-level areas with depth=1
        // The backend will include childCount for each area
        const areas = await GeographicAreaService.getGeographicAreas(
          undefined, 
          undefined, 
          selectedGeographicAreaId,
          undefined,
          1  // depth=1 for lazy loading in dropdown too
        );

        // For dropdown display, we need hierarchy paths
        // Instead of fetching ancestors for each area (thousands of API calls),
        // we'll build the hierarchy path from the parent relationships in the data
        const areaMap = new Map<string, GeographicArea>();
        areas.forEach(area => areaMap.set(area.id, area));

        const buildHierarchyPath = (area: GeographicArea): string => {
          const ancestors: string[] = [];
          let currentId = area.parentGeographicAreaId;
          
          // Walk up the parent chain using the data we already have
          while (currentId) {
            const parent = areaMap.get(currentId);
            if (!parent) break;
            ancestors.push(parent.name);
            currentId = parent.parentGeographicAreaId;
          }
          
          // Return path from closest to most distant
          return ancestors.length > 0 ? ancestors.join(' > ') : '';
        };

        const areasWithHierarchy = areas.map(area => ({
          ...area,
          ancestors: [], // We don't need the full ancestor objects for dropdown
          hierarchyPath: buildHierarchyPath(area),
        } as GeographicAreaWithHierarchy));

        setAvailableAreas(areasWithHierarchy);
      } catch (error) {
        console.error('Failed to fetch available geographic areas:', error);
        setAvailableAreas([]);
      }
    };

    fetchAvailableAreas();
  }, [selectedGeographicAreaId]);

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
      }}
    >
      {children}
    </GlobalGeographicFilterContext.Provider>
  );
};
