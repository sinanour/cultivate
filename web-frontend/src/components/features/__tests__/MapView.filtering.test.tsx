import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MapView } from '../MapView.optimized';
import { MapDataService } from '../../../services/api/map-data.service';
import { ActivityTypeService } from '../../../services/api/activity-type.service';
import { GlobalGeographicFilterProvider } from '../../../contexts/GlobalGeographicFilterContext';

// Mock Leaflet and react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    getBounds: () => ({
      getSouthWest: () => ({ lat: -10, lng: -10 }),
      getNorthEast: () => ({ lat: 10, lng: 10 }),
    }),
    fitBounds: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: any) => <div data-testid="marker-cluster">{children}</div>,
}));

vi.mock('leaflet', () => ({
  Icon: class MockIcon {},
  divIcon: () => ({}),
  point: () => ({}),
}));

// Mock services
vi.mock('../../../services/api/map-data.service');
vi.mock('../../../services/api/activity-type.service');

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'ADMINISTRATOR',
      displayName: 'Test User',
    },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('MapView - Comprehensive Filtering', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Mock ActivityTypeService
    vi.mocked(ActivityTypeService.getActivityTypes).mockResolvedValue([
      {
        id: 'type-1',
        name: 'Study Circle',
        isPredefined: true,
        activityCategory: {
          id: 'cat-1',
          name: 'Core Activities',
          isPredefined: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          version: 1,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: 1,
      },
    ]);

    // Default mock for MapDataService
    vi.mocked(MapDataService.getActivityMarkers).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      },
    });

    vi.mocked(MapDataService.getParticipantHomeMarkers).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      },
    });

    vi.mocked(MapDataService.getVenueMarkers).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <GlobalGeographicFilterProvider>
          {children}
        </GlobalGeographicFilterProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );

  /**
   * Property 254: Activity Category Filter Application in Activity Modes
   * 
   * Validates: Requirements 6C.53, 6C.57
   * 
   * When activity category filter is applied in "Activities by Type" or "Activities by Category" modes,
   * the filter should be passed to the MapDataService.
   */
  it('should apply activity category filter in activity modes', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="activitiesByType"
          activityCategoryIds={['cat-1', 'cat-2']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.activityCategoryIds).toEqual(['cat-1', 'cat-2']);
  });

  /**
   * Property 255: Activity Type Filter Application in Activity Modes
   * 
   * Validates: Requirements 6C.53, 6C.58
   * 
   * When activity type filter is applied in "Activities by Type" or "Activities by Category" modes,
   * the filter should be passed to the MapDataService.
   */
  it('should apply activity type filter in activity modes', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="activitiesByCategory"
          activityTypeIds={['type-1', 'type-2']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.activityTypeIds).toEqual(['type-1', 'type-2']);
  });

  /**
   * Property 256: Status Filter Application in Activity Modes
   * 
   * Validates: Requirements 6C.53, 6C.59
   * 
   * When status filter is applied in "Activities by Type" or "Activities by Category" modes,
   * the filter should be passed to the MapDataService.
   */
  it('should apply status filter in activity modes', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="activitiesByType"
          status="ACTIVE,PLANNED"
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.status).toBe('ACTIVE,PLANNED');
  });

  /**
   * Property 257: Population Filter Application in Activity Modes
   * 
   * Validates: Requirements 6C.53, 6C.55
   * 
   * When population filter is applied in "Activities by Type" or "Activities by Category" modes,
   * the filter should be passed to the MapDataService.
   */
  it('should apply population filter in activity modes', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="activitiesByType"
          populationIds={['pop-1', 'pop-2']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.populationIds).toEqual(['pop-1', 'pop-2']);
  });

  /**
   * Property 258: Population Filter Application in Participant Homes Mode
   * 
   * Validates: Requirements 6C.53, 6C.56
   * 
   * When population filter is applied in "Participant Homes" mode,
   * the filter should be passed to the MapDataService.
   */
  it('should apply population filter in participant homes mode', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="participantHomes"
          populationIds={['pop-1', 'pop-2']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getParticipantHomeMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getParticipantHomeMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.populationIds).toEqual(['pop-1', 'pop-2']);
  });

  /**
   * Property 259: Activity Filters Ignored in Venues Mode
   * 
   * Validates: Requirements 6C.60
   * 
   * When activity category, activity type, or status filters are applied in "Venues" mode,
   * they should be ignored (not passed to MapDataService).
   */
  it('should ignore activity filters in venues mode', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="venues"
          activityCategoryIds={['cat-1']}
          activityTypeIds={['type-1']}
          status="ACTIVE"
          populationIds={['pop-1']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getVenueMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getVenueMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    // Venues mode should not receive activity-specific filters
    expect(filters.activityCategoryIds).toBeUndefined();
    expect(filters.activityTypeIds).toBeUndefined();
    expect(filters.status).toBeUndefined();
    expect(filters.populationIds).toBeUndefined();
  });

  /**
   * Property 260: Activity Filters Ignored in Participant Homes Mode
   * 
   * Validates: Requirements 6C.60
   * 
   * When activity category, activity type, or status filters are applied in "Participant Homes" mode,
   * they should be ignored (not passed to MapDataService), but population filter should be applied.
   */
  it('should ignore activity filters but apply population filter in participant homes mode', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="participantHomes"
          activityCategoryIds={['cat-1']}
          activityTypeIds={['type-1']}
          status="ACTIVE"
          populationIds={['pop-1']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getParticipantHomeMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getParticipantHomeMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    // Participant homes mode should not receive activity-specific filters
    expect(filters.activityCategoryIds).toBeUndefined();
    expect(filters.activityTypeIds).toBeUndefined();
    expect(filters.status).toBeUndefined();
    
    // But should receive population filter
    expect(filters.populationIds).toEqual(['pop-1']);
  });

  /**
   * Property 261: Filter Preservation Across Mode Changes
   * 
   * Validates: Requirements 6C.61
   * 
   * When switching between map modes, all filter selections should be preserved
   * even if some filters don't apply to the new mode.
   */
  it('should preserve filter selections when switching modes', async () => {
    const { rerender } = render(
      <TestWrapper>
        <MapView
          mode="activitiesByType"
          activityCategoryIds={['cat-1']}
          activityTypeIds={['type-1']}
          status="ACTIVE"
          populationIds={['pop-1']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    // Verify filters were applied in activity mode
    let callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    let filters = callArgs[0];
    expect(filters.activityCategoryIds).toEqual(['cat-1']);
    expect(filters.activityTypeIds).toEqual(['type-1']);
    expect(filters.status).toBe('ACTIVE');
    expect(filters.populationIds).toEqual(['pop-1']);

    // Switch to venues mode with same filter props
    rerender(
      <TestWrapper>
        <MapView
          mode="venues"
          activityCategoryIds={['cat-1']}
          activityTypeIds={['type-1']}
          status="ACTIVE"
          populationIds={['pop-1']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getVenueMarkers).toHaveBeenCalled();
    });

    // Verify activity filters are ignored in venues mode
    callArgs = vi.mocked(MapDataService.getVenueMarkers).mock.calls[0];
    filters = callArgs[0];
    expect(filters.activityCategoryIds).toBeUndefined();
    expect(filters.activityTypeIds).toBeUndefined();
    expect(filters.status).toBeUndefined();
    expect(filters.populationIds).toBeUndefined();

    // Switch back to activity mode
    rerender(
      <TestWrapper>
        <MapView
          mode="activitiesByCategory"
          activityCategoryIds={['cat-1']}
          activityTypeIds={['type-1']}
          status="ACTIVE"
          populationIds={['pop-1']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      // Should be called again with activity mode
      expect(vi.mocked(MapDataService.getActivityMarkers).mock.calls.length).toBeGreaterThan(1);
    });

    // Verify filters are re-applied in activity mode
    const lastCallIndex = vi.mocked(MapDataService.getActivityMarkers).mock.calls.length - 1;
    callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[lastCallIndex];
    filters = callArgs[0];
    expect(filters.activityCategoryIds).toEqual(['cat-1']);
    expect(filters.activityTypeIds).toEqual(['type-1']);
    expect(filters.status).toBe('ACTIVE');
    expect(filters.populationIds).toEqual(['pop-1']);
  });

  /**
   * Property 262: All Filters Available Regardless of Mode
   * 
   * Validates: Requirements 6C.53a, 6C.53b
   * 
   * All filter properties should remain available and enabled regardless of map mode.
   * This is tested at the MapViewPage level where FilterGroupingPanel is configured.
   */
  it('should accept all filter props regardless of map mode', async () => {
    // Test that MapView component accepts all filter props in all modes
    const modes: Array<'activitiesByType' | 'activitiesByCategory' | 'participantHomes' | 'venues'> = [
      'activitiesByType',
      'activitiesByCategory', 
      'participantHomes',
      'venues'
    ];

    for (const mode of modes) {
      const { unmount } = render(
        <TestWrapper>
          <MapView
            mode={mode}
            activityCategoryIds={['cat-1']}
            activityTypeIds={['type-1']}
            status="ACTIVE"
            populationIds={['pop-1']}
            readyToFetch={true}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument();
      });

      // Component should render without errors for all modes with all filters
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
      
      unmount();
    }
  });

  /**
   * Property 263: Combined Filter Application
   * 
   * Validates: Requirements 6C.53, 6C.57, 6C.58, 6C.59, 6C.55
   * 
   * When multiple filters are applied together in activity modes,
   * all applicable filters should be passed to the MapDataService.
   */
  it('should apply all applicable filters together in activity modes', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="activitiesByType"
          activityCategoryIds={['cat-1', 'cat-2']}
          activityTypeIds={['type-1']}
          status="ACTIVE,PLANNED"
          populationIds={['pop-1', 'pop-2']}
          startDate="2024-01-01"
          endDate="2024-12-31"
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.activityCategoryIds).toEqual(['cat-1', 'cat-2']);
    expect(filters.activityTypeIds).toEqual(['type-1']);
    expect(filters.status).toBe('ACTIVE,PLANNED');
    expect(filters.populationIds).toEqual(['pop-1', 'pop-2']);
    expect(filters.startDate).toBe('2024-01-01');
    expect(filters.endDate).toBe('2024-12-31');
  });

  /**
   * Property 264: Date Range Filter Application Across Modes
   * 
   * Validates: Requirements 6C.70, 6C.71
   * 
   * Date range filters should be applied to both activity markers and participant home markers.
   */
  it('should apply date range filter to activity markers', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="activitiesByType"
          startDate="2024-01-01"
          endDate="2024-12-31"
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getActivityMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getActivityMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.startDate).toBe('2024-01-01');
    expect(filters.endDate).toBe('2024-12-31');
  });

  it('should apply date range filter to participant home markers', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="participantHomes"
          startDate="2024-01-01"
          endDate="2024-12-31"
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getParticipantHomeMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getParticipantHomeMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    expect(filters.startDate).toBe('2024-01-01');
    expect(filters.endDate).toBe('2024-12-31');
  });

  /**
   * Property 265: Empty Filters in Venues Mode
   * 
   * Validates: Requirements 6C.60
   * 
   * In venues mode, activity-specific and population filters should not be passed
   * to the MapDataService (only geographic area filter applies).
   */
  it('should not pass activity or population filters in venues mode', async () => {
    render(
      <TestWrapper>
        <MapView
          mode="venues"
          activityCategoryIds={['cat-1']}
          activityTypeIds={['type-1']}
          status="ACTIVE"
          populationIds={['pop-1']}
          readyToFetch={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(MapDataService.getVenueMarkers).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(MapDataService.getVenueMarkers).mock.calls[0];
    const filters = callArgs[0];
    
    // Only geographic area filter should be present (if any)
    expect(filters.activityCategoryIds).toBeUndefined();
    expect(filters.activityTypeIds).toBeUndefined();
    expect(filters.status).toBeUndefined();
    expect(filters.populationIds).toBeUndefined();
  });
});
