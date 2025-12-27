import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { GeographicArea } from '../types';
import { GeographicAreaService } from '../services/api/geographic-area.service';

interface GlobalGeographicFilterContextType {
  selectedGeographicAreaId: string | null;
  selectedGeographicArea: GeographicArea | null;
  setGeographicAreaFilter: (id: string | null) => void;
  clearFilter: () => void;
  isLoading: boolean;
}

export const GlobalGeographicFilterContext = createContext<GlobalGeographicFilterContextType | undefined>(undefined);

interface GlobalGeographicFilterProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'globalGeographicAreaFilter';

export const GlobalGeographicFilterProvider: React.FC<GlobalGeographicFilterProviderProps> = ({ children }) => {
  const [selectedGeographicAreaId, setSelectedGeographicAreaId] = useState<string | null>(null);
  const [selectedGeographicArea, setSelectedGeographicArea] = useState<GeographicArea | null>(null);
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
        setGeographicAreaFilter,
        clearFilter,
        isLoading,
      }}
    >
      {children}
    </GlobalGeographicFilterContext.Provider>
  );
};
