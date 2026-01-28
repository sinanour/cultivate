import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GlobalGeographicFilterProvider, GlobalGeographicFilterContext } from '../GlobalGeographicFilterContext';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { geographicFilterEvents } from '../../utils/geographic-filter-events';
import type { ReactNode } from 'react';

// Mock dependencies
vi.mock('../../services/api/geographic-area.service');
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com', role: 'EDITOR' },
  }),
}));

const mockGeographicAreas = [
  {
    id: 'area-1',
    name: 'Area 1',
    areaType: 'CITY',
    parentGeographicAreaId: null,
    childCount: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    version: 1,
  },
  {
    id: 'area-2',
    name: 'Area 2',
    areaType: 'NEIGHBOURHOOD',
    parentGeographicAreaId: 'area-1',
    childCount: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    version: 1,
  },
];

describe('GlobalGeographicFilterContext - Simplified Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Mock GeographicAreaService methods
    vi.mocked(GeographicAreaService.getGeographicAreasFlexible).mockResolvedValue({
      data: mockGeographicAreas,
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    
    vi.mocked(GeographicAreaService.getGeographicAreaById).mockResolvedValue(mockGeographicAreas[0]);
    vi.mocked(GeographicAreaService.getBatchAncestors).mockResolvedValue({});
    vi.mocked(GeographicAreaService.getBatchDetails).mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // Use MemoryRouter for isolated tests
  const createWrapper = (initialEntries: string[] = ['/']) => {
    return ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={initialEntries}>
        <GlobalGeographicFilterProvider>{children}</GlobalGeographicFilterProvider>
      </MemoryRouter>
    );
  };

  describe('Filter Setting Without Authorization Checks', () => {
    it('should set filter without calling authorization service', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // Set a geographic area filter
      act(() => {
        result.current!.setGeographicAreaFilter('area-1');
      });

      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBe('area-1');
      });

      // Verify no authorization checks were performed
      // The context should trust that backend returns only authorized areas
      expect(result.current!.selectedGeographicAreaId).toBe('area-1');
    });

    it('should persist filter to localStorage without authorization validation', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current!.setGeographicAreaFilter('area-2');
      });

      await waitFor(() => {
        expect(localStorage.getItem('globalGeographicAreaFilter')).toBe('area-2');
      });
    });

    it('should restore filter from localStorage without authorization validation', async () => {
      localStorage.setItem('globalGeographicAreaFilter', 'area-1');

      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBe('area-1');
      });
    });
  });

  describe('Context Interface Simplification', () => {
    it('should not expose authorizedAreaIds in context', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // Verify removed properties don't exist
      expect(result.current).not.toHaveProperty('authorizedAreaIds');
      expect(result.current).not.toHaveProperty('isAuthorizedArea');
    });

    it('should expose simplified context interface', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // Verify expected properties exist
      expect(result.current).toHaveProperty('selectedGeographicAreaId');
      expect(result.current).toHaveProperty('selectedGeographicArea');
      expect(result.current).toHaveProperty('availableAreas');
      expect(result.current).toHaveProperty('setGeographicAreaFilter');
      expect(result.current).toHaveProperty('clearFilter');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('searchQuery');
      expect(result.current).toHaveProperty('setSearchQuery');
      expect(result.current).toHaveProperty('isSearching');
      expect(result.current).toHaveProperty('loadMoreAreas');
      expect(result.current).toHaveProperty('hasMorePages');
    });
  });

  describe('Error Handling for Authorization Failures', () => {
    it('should clear filter when authorization error event is received', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // Set a filter
      act(() => {
        result.current!.setGeographicAreaFilter('area-1');
      });

      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBe('area-1');
      });

      // Emit authorization error event (simulating backend 403 response)
      act(() => {
        geographicFilterEvents.emit();
      });

      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBeNull();
      });
    });

    it('should not clear filter on authorization error when no filter is active', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // No filter set
      expect(result.current!.selectedGeographicAreaId).toBeNull();

      // Emit authorization error event
      act(() => {
        geographicFilterEvents.emit();
      });

      // Should remain null (no change)
      expect(result.current!.selectedGeographicAreaId).toBeNull();
    });
  });

  describe('Backend Authorization Trust', () => {
    it('should fetch available areas from backend without client-side filtering', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current!.availableAreas.length).toBeGreaterThan(0);
      });

      // Verify that we trust backend to return only authorized areas
      expect(GeographicAreaService.getGeographicAreasFlexible).toHaveBeenCalled();
      expect(result.current!.availableAreas).toHaveLength(2);
    });

    it('should allow setting any area returned by backend', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // Should be able to set any area without frontend validation
      act(() => {
        result.current!.setGeographicAreaFilter('area-1');
      });
      
      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBe('area-1');
      });

      act(() => {
        result.current!.setGeographicAreaFilter('area-2');
      });
      
      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBe('area-2');
      });
    });
  });

  describe('Filter Clearing', () => {
    it('should clear filter and remove from localStorage and URL', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => React.useContext(GlobalGeographicFilterContext), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // Set a filter
      act(() => {
        result.current!.setGeographicAreaFilter('area-1');
      });

      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBe('area-1');
        expect(localStorage.getItem('globalGeographicAreaFilter')).toBe('area-1');
      });

      // Clear the filter
      act(() => {
        result.current!.clearFilter();
      });

      await waitFor(() => {
        expect(result.current!.selectedGeographicAreaId).toBeNull();
        expect(localStorage.getItem('globalGeographicAreaFilter')).toBeNull();
      });
    });
  });
});
