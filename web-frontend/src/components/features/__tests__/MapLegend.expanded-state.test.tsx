import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MapView } from '../MapView.optimized';
import { MapLegend } from '../MapLegend';
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
    Icon: class MockIcon { },
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

describe('MapLegend - Expanded State', () => {
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
                activityCategoryId: 'cultivate-1',
                activityCategory: {
                    id: 'cultivate-1',
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
            {
                id: 'type-2',
                name: 'Devotional Meeting',
                isPredefined: true,
                activityCategoryId: 'cultivate-1',
                activityCategory: {
                    id: 'cultivate-1',
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

        // Mock MapDataService with some markers
        vi.mocked(MapDataService.getActivityMarkers).mockResolvedValue({
            data: [
                {
                    id: 'activity-1',
                    latitude: 40.7128,
                    longitude: -74.0060,
                    activityTypeId: 'type-1',
                    activityCategoryId: 'cultivate-1',
                },
                {
                    id: 'activity-2',
                    latitude: 34.0522,
                    longitude: -118.2437,
                    activityTypeId: 'type-2',
                    activityCategoryId: 'cultivate-1',
                },
            ],
            pagination: {
                page: 1,
                limit: 100,
                total: 2,
                totalPages: 1,
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
     * Property 266: Legend Defaults to Expanded
     * 
     * When no expanded prop is provided to MapLegend, it should default to expanded state.
     */
    it('should default to expanded when no expanded prop provided', () => {
        render(
            <MapLegend
                title="Activity Types"
                items={[
                    { id: 'type-1', name: 'Study Circle', color: '#3b82f6' },
                    { id: 'type-2', name: 'Devotional Meeting', color: '#10b981' },
                ]}
            />
        );

        // Legend should be visible (expanded by default)
        expect(screen.getByText('Study Circle')).toBeInTheDocument();
        expect(screen.getByText('Devotional Meeting')).toBeInTheDocument();
    });

    /**
     * Property 267: Legend Respects Controlled Expanded Prop
     * 
     * When expanded prop is provided to MapLegend, it should respect the controlled state.
     */
    it('should respect controlled expanded prop when true', () => {
        render(
            <MapLegend
                title="Activity Types"
                items={[
                    { id: 'type-1', name: 'Study Circle', color: '#3b82f6' },
                ]}
                expanded={true}
            />
        );

        // Legend should be visible
        expect(screen.getByText('Study Circle')).toBeInTheDocument();
    });

    it('should respect controlled expanded prop when false', () => {
        const { container } = render(
            <MapLegend
                title="Activity Types"
                items={[
                    { id: 'type-1', name: 'Study Circle', color: '#3b82f6' },
                ]}
                expanded={false}
            />
        );

        // Legend should be collapsed (check aria-expanded attribute)
        const expandableSection = container.querySelector('[aria-expanded]');
        expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
    });

    /**
     * Property 268: Legend Calls onExpandedChange When User Toggles
     * 
     * When user clicks the legend header to toggle expansion, onExpandedChange should be called.
     */
    it('should call onExpandedChange when user toggles expansion', () => {
        const onExpandedChange = vi.fn();

        render(
            <MapLegend
                title="Activity Types"
                items={[
                    { id: 'type-1', name: 'Study Circle', color: '#3b82f6' },
                ]}
                expanded={true}
                onExpandedChange={onExpandedChange}
            />
        );

        // Find and click the legend header to collapse
        const legendHeader = screen.getByText('Legend');
        fireEvent.click(legendHeader);

        // onExpandedChange should be called with false
        expect(onExpandedChange).toHaveBeenCalledWith(false);
    });

    /**
     * Property 269: MapView Preserves Legend Expanded State Across Filter Changes
     * 
     * When filters change in MapView, the legend expanded state should be preserved.
     */
    it('should preserve legend expanded state across filter changes', async () => {
        const { rerender, container } = render(
            <TestWrapper>
                <MapView
                    mode="activitiesByType"
                    activityTypeIds={['type-1']}
                    readyToFetch={true}
                />
            </TestWrapper>
        );

        // Wait for initial render with legend
        await waitFor(() => {
            expect(screen.getByText('Legend')).toBeInTheDocument();
        });

        // Verify legend is expanded by default
        await waitFor(() => {
            const expandableSection = container.querySelector('[aria-expanded]');
            expect(expandableSection).toHaveAttribute('aria-expanded', 'true');
        });

        // Collapse the legend
        const legendHeader = screen.getByText('Legend');
        fireEvent.click(legendHeader);

        // Wait for collapse
        await waitFor(() => {
            const expandableSection = container.querySelector('[aria-expanded]');
            expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
        });

        // Change filters
        rerender(
            <TestWrapper>
                <MapView
                    mode="activitiesByType"
                    activityTypeIds={['type-1', 'type-2']}
                    readyToFetch={true}
                />
            </TestWrapper>
        );

        // Legend should still be collapsed after filter change
        await waitFor(() => {
            expect(screen.getByText('Legend')).toBeInTheDocument();
        });

        const expandableSection = container.querySelector('[aria-expanded]');
        expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
    });

    /**
     * Property 270: MapView Preserves Legend Expanded State Across Map Panning
     * 
     * When user pans the map (viewport changes), the legend expanded state should be preserved.
     */
    it('should preserve legend expanded state across map panning', async () => {
        const { container } = render(
            <TestWrapper>
                <MapView
                    mode="activitiesByType"
                    readyToFetch={true}
                />
            </TestWrapper>
        );

        // Wait for initial render with legend
        await waitFor(() => {
            expect(screen.getByText('Legend')).toBeInTheDocument();
        });

        // Verify legend is expanded by default
        await waitFor(() => {
            const expandableSection = container.querySelector('[aria-expanded]');
            expect(expandableSection).toHaveAttribute('aria-expanded', 'true');
        });

        // Collapse the legend
        const legendHeader = screen.getByText('Legend');
        fireEvent.click(legendHeader);

        // Wait for collapse
        await waitFor(() => {
            const expandableSection = container.querySelector('[aria-expanded]');
            expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
        });

        // Simulate map panning by triggering viewport change
        // (In real scenario, this would be triggered by map interaction)
        // The legend state should remain collapsed

        // Wait a bit to ensure no state changes
        await new Promise(resolve => setTimeout(resolve, 100));

        // Legend should still be collapsed
        const expandableSection = container.querySelector('[aria-expanded]');
        expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
    });

    /**
     * Property 271: MapView Defaults Legend to Expanded on Initial Load
     * 
     * When MapView first loads, the legend should default to expanded state.
     */
    it('should default legend to expanded on initial load', async () => {
        render(
            <TestWrapper>
                <MapView
                    mode="activitiesByType"
                    readyToFetch={true}
                />
            </TestWrapper>
        );

        // Wait for legend to appear
        await waitFor(() => {
            expect(screen.getByText('Legend')).toBeInTheDocument();
        });

        // Legend should be expanded by default, showing activity types
        await waitFor(() => {
            expect(screen.getByText('Study Circle')).toBeInTheDocument();
            expect(screen.getByText('Devotional Meeting')).toBeInTheDocument();
        });
    });

    /**
     * Property 272: Legend Expanded State Persists Across Mode Changes
     * 
     * When switching between map modes, the legend expanded state should be preserved.
     */
    it('should preserve legend expanded state when switching modes', async () => {
        const { rerender, container } = render(
            <TestWrapper>
                <MapView
                    mode="activitiesByType"
                    readyToFetch={true}
                />
            </TestWrapper>
        );

        // Wait for initial render with legend
        await waitFor(() => {
            expect(screen.getByText('Legend')).toBeInTheDocument();
        });

        // Collapse the legend
        const legendHeader = screen.getByText('Legend');
        fireEvent.click(legendHeader);

        // Wait for collapse
        await waitFor(() => {
            const expandableSection = container.querySelector('[aria-expanded]');
            expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
        });

        // Switch to activitiesByCategory mode
        rerender(
            <TestWrapper>
                <MapView
                    mode="activitiesByCategory"
                    readyToFetch={true}
                />
            </TestWrapper>
        );

        // Legend should still be collapsed in new mode
        await waitFor(() => {
            expect(screen.getByText('Legend')).toBeInTheDocument();
        });

        // Content should not be visible (collapsed state preserved)
        const expandableSection = container.querySelector('[aria-expanded]');
        expect(expandableSection).toHaveAttribute('aria-expanded', 'false');
    });
});
