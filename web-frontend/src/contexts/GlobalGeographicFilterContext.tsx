import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { GeographicArea, GeographicAreaWithHierarchy } from '../types';
import { GeographicAreaService } from '../services/api/geographic-area.service';

interface GlobalGeographicFilterContextType {
  selectedGeographicAreaId: string | null;
  selectedGeographicArea: GeographicArea | null;
  availableAreas: GeographicAreaWithHierarchy[];
  setGeographicAreaFilter: (id: string | null) => void;
  clearFilter: () => void;
  isLoading: boolean;
  formatAreaOption: (area: GeographicAreaWithHierarchy) => { label: string; description: string };
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
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize filter from URL or localStorage
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlGeographicAreaId = searchParams.get('geographicArea');

    if (urlGeographicAreaId) {
      // URL parameter takes precedence
      setSelectedGeographicAreaId(urlGeographicAreaId);
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, urlGeographicAreaId);
    } else {
      // Restore from localStorage
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        setSelectedGeographicAreaId(storedId);
        // Sync to URL
        const newSearchParams = new URLSearchParams(location.search);
        newSearchParams.set('geographicArea', storedId);
        navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
      }
    }
  }, []); // Only run on mount

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
        clearFilter();
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
        // Fetch areas based on current filter
        // When filter is active, only fetch descendants
        // When filter is "Global", fetch all areas
        const areas = await GeographicAreaService.getGeographicAreas(
          undefined, 
          undefined, 
          selectedGeographicAreaId
        );

        // Fetch ancestors for each area to build hierarchy paths
        const areasWithHierarchy = await Promise.all(
          areas.map(async (area) => {
            try {
              const ancestors = await GeographicAreaService.getAncestors(area.id);
              // Build hierarchy path: closest ancestor to most distant
              const hierarchyPath = ancestors.length > 0
                ? ancestors.map(a => a.name).join(' > ')
                : '';
              
              return {
                ...area,
                ancestors,
                hierarchyPath,
              } as GeographicAreaWithHierarchy;
            } catch (error) {
              console.error(`Failed to fetch ancestors for area ${area.id}:`, error);
              return {
                ...area,
                ancestors: [],
                hierarchyPath: '',
              } as GeographicAreaWithHierarchy;
            }
          })
        );

        setAvailableAreas(areasWithHierarchy);
      } catch (error) {
        console.error('Failed to fetch available geographic areas:', error);
        setAvailableAreas([]);
      }
    };

    fetchAvailableAreas();
  }, [selectedGeographicAreaId]);

  const formatAreaOption = (area: GeographicAreaWithHierarchy) => {
    return {
      label: area.name,
      description: area.hierarchyPath || 'No parent areas',
    };
  };

  const setGeographicAreaFilter = (id: string | null) => {
    setSelectedGeographicAreaId(id);

    if (id) {
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, id);

      // Update URL
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('geographicArea', id);
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    } else {
      // Clear from localStorage
      localStorage.removeItem(STORAGE_KEY);

      // Remove from URL
      const searchParams = new URLSearchParams(location.search);
      searchParams.delete('geographicArea');
      const newSearch = searchParams.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true });
    }
  };

  const clearFilter = () => {
    setGeographicAreaFilter(null);
  };

  return (
    <GlobalGeographicFilterContext.Provider
      value={{
        selectedGeographicAreaId,
        selectedGeographicArea,
        availableAreas,
        setGeographicAreaFilter,
        clearFilter,
        isLoading,
        formatAreaOption,
      }}
    >
      {children}
    </GlobalGeographicFilterContext.Provider>
  );
};
