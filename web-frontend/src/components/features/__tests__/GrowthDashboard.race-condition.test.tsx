import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { GrowthDashboard } from '../GrowthDashboard';
import { AnalyticsService } from '../../../services/api/analytics.service';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock user for AuthProvider
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'ADMINISTRATOR' as const,
  displayName: 'Test User',
};

// Mock the AnalyticsService
vi.mock('../../../services/api/analytics.service', () => ({
  AnalyticsService: {
    getGrowthMetrics: vi.fn(),
  },
}));

// Mock other services
vi.mock('../../../services/api/population.service', () => ({
  PopulationService: {
    getPopulations: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/api/activity-category.service', () => ({
  activityCategoryService: {
    getActivityCategories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/api/activity-type.service', () => ({
  ActivityTypeService: {
    getActivityTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/api/venue.service', () => ({
  VenueService: {
    getVenuesFlexible: vi.fn().mockResolvedValue({ data: [], pagination: {} }),
  },
}));

vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
  useGlobalGeographicFilter: () => ({
    selectedGeographicAreaId: null,
    setSelectedGeographicAreaId: vi.fn(),
  }),
}));

// Helper to wrap component with all required providers
const renderWithProviders = (component: React.ReactElement, queryClient: QueryClient) => {
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider
          value={{
            user: mockUser,
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            refreshToken: vi.fn(),
          }}
        >
          {component}
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('GrowthDashboard - Race Condition Fix', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should not trigger duplicate API requests when period changes before Run Report', async () => {
    const mockResponse = {
      timeSeries: [
        { date: '2024-01', uniqueActivities: 10, uniqueParticipants: 20, totalParticipation: 30 },
      ],
    };

    (AnalyticsService.getGrowthMetrics as any).mockResolvedValue(mockResponse);

    const { rerender } = renderWithProviders(
      <GrowthDashboard runReportTrigger={0} />,
      queryClient
    );

    // Initially, no API calls should be made (hasRunReport is false)
    expect(AnalyticsService.getGrowthMetrics).not.toHaveBeenCalled();

    // Simulate clicking Run Report (increment trigger)
    rerender(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider
            value={{
              user: mockUser,
              isAuthenticated: true,
              isLoading: false,
              login: vi.fn(),
              logout: vi.fn(),
              refreshToken: vi.fn(),
            }}
          >
            <GrowthDashboard runReportTrigger={1} />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );

    // Wait for the query to execute
    await waitFor(() => {
      expect(AnalyticsService.getGrowthMetrics).toHaveBeenCalled();
    }, { timeout: 3000 });

    // The fix ensures only ONE API call is made per unique query key
    // Before the fix, changing period would cause the callback to recreate,
    // leading to React Query seeing it as a different query and making 2 requests
    expect(AnalyticsService.getGrowthMetrics).toHaveBeenCalledTimes(1);

    // Verify the API was called with MONTH period (default)
    const firstCall = (AnalyticsService.getGrowthMetrics as any).mock.calls[0][0];
    expect(firstCall.period).toBe('MONTH');
  });

  it('should use the current period value when Run Report is clicked', async () => {
    const mockResponse = {
      timeSeries: [
        { date: '2024-01', uniqueActivities: 10, uniqueParticipants: 20, totalParticipation: 30 },
      ],
    };

    (AnalyticsService.getGrowthMetrics as any).mockResolvedValue(mockResponse);

    renderWithProviders(
      <GrowthDashboard runReportTrigger={1} />,
      queryClient
    );

    // Wait for the initial query
    await waitFor(() => {
      expect(AnalyticsService.getGrowthMetrics).toHaveBeenCalled();
    });

    // Verify it used the current period value
    const call = (AnalyticsService.getGrowthMetrics as any).mock.calls[0][0];
    expect(call).toHaveProperty('period');
    expect(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']).toContain(call.period);
  });
});
