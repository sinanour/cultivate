import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VenueDetail } from '../VenueDetail';
import { VenueService } from '../../../services/api/venue.service';
import { GeographicAreaService } from '../../../services/api/geographic-area.service';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ position }: any) => <div data-testid="marker" data-position={JSON.stringify(position)} />,
}));

// Mock leaflet
vi.mock('leaflet', () => ({
    default: {
        Icon: {
            Default: {
                prototype: {},
                mergeOptions: vi.fn(),
            },
        },
    },
}));

// Mock services
vi.mock('../../../services/api/venue.service');
vi.mock('../../../services/api/geographic-area.service');

const mockVenueWithCoordinates = {
    id: 'venue-1',
    name: 'Community Center',
    address: '123 Main St',
    latitude: 49.2827,
    longitude: -123.1207,
    venueType: 'PUBLIC_BUILDING',
    geographicAreaId: 'area-1',
    geographicArea: {
        id: 'area-1',
        name: 'Vancouver',
        areaType: 'CITY',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
};

const mockVenueWithoutCoordinates = {
    id: 'venue-2',
    name: 'Local Hall',
    address: '456 Oak Ave',
    latitude: null,
    longitude: null,
    venueType: null,
    geographicAreaId: 'area-1',
    geographicArea: {
        id: 'area-1',
        name: 'Vancouver',
        areaType: 'CITY',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
};

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'EDITOR' as const,
    displayName: 'Test User',
};

function TestWrapper({ children, venueId }: { children: React.ReactNode; venueId: string }) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <MemoryRouter initialEntries={[`/venues/${venueId}`]}>
                    <Routes>
                        <Route path="/venues/:id" element={children} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}

describe('VenueDetail - Map Preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock VenueService methods
        vi.mocked(VenueService.getVenueActivities).mockResolvedValue([]);
        vi.mocked(VenueService.getVenueParticipants).mockResolvedValue([]);

        // Mock GeographicAreaService
        vi.mocked(GeographicAreaService.getAncestors).mockResolvedValue([]);
    });

    it('should display map preview when venue has coordinates', async () => {
        vi.mocked(VenueService.getVenue).mockResolvedValue(mockVenueWithCoordinates);

        render(
            <TestWrapper venueId="venue-1">
                <VenueDetail />
            </TestWrapper>
        );

        // Wait for venue data to load
        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeInTheDocument();
        });

        // Check that map container is rendered
        const mapContainer = screen.getByTestId('map-container');
        expect(mapContainer).toBeInTheDocument();

        // Check that marker is rendered with correct position
        const marker = screen.getByTestId('marker');
        expect(marker).toBeInTheDocument();
        const position = JSON.parse(marker.getAttribute('data-position') || '[]');
        expect(position).toEqual([49.2827, -123.1207]);

        // Check that "Location" header is present
        expect(screen.getByText('Location')).toBeInTheDocument();
    });

    it('should NOT display map preview when venue has null latitude', async () => {
        const venueWithNullLat = {
            ...mockVenueWithCoordinates,
            latitude: null,
        };
        vi.mocked(VenueService.getVenue).mockResolvedValue(venueWithNullLat);

        render(
            <TestWrapper venueId="venue-1">
                <VenueDetail />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeInTheDocument();
        });

        // Map container should NOT be rendered
        expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
        expect(screen.queryByText('Location')).not.toBeInTheDocument();
    });

    it('should NOT display map preview when venue has null longitude', async () => {
        const venueWithNullLon = {
            ...mockVenueWithCoordinates,
            longitude: null,
        };
        vi.mocked(VenueService.getVenue).mockResolvedValue(venueWithNullLon);

        render(
            <TestWrapper venueId="venue-1">
                <VenueDetail />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeInTheDocument();
        });

        // Map container should NOT be rendered
        expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
        expect(screen.queryByText('Location')).not.toBeInTheDocument();
    });

    it('should NOT display map preview when venue has both null coordinates', async () => {
        vi.mocked(VenueService.getVenue).mockResolvedValue(mockVenueWithoutCoordinates);

        render(
            <TestWrapper venueId="venue-2">
                <VenueDetail />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Local Hall')).toBeInTheDocument();
        });

        // Map container should NOT be rendered
        expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
        expect(screen.queryByText('Location')).not.toBeInTheDocument();
    });

    it('should position map preview between venue details and associated activities', async () => {
        vi.mocked(VenueService.getVenue).mockResolvedValue(mockVenueWithCoordinates);

        const { container } = render(
            <TestWrapper venueId="venue-1">
                <VenueDetail />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeInTheDocument();
        });

        // Get all headers in order
        const headers = Array.from(container.querySelectorAll('h3, h2')).map(
            (el) => el.textContent
        );

        // Find indices
        const locationIndex = headers.findIndex((h) => h?.includes('Location'));
        const activitiesIndex = headers.findIndex((h) => h?.includes('Associated Activities'));

        // Map preview should come before activities
        expect(locationIndex).toBeGreaterThan(-1);
        expect(activitiesIndex).toBeGreaterThan(-1);
        expect(locationIndex).toBeLessThan(activitiesIndex);
    });

    it('should display marker at correct coordinates', async () => {
        const customCoordinates = {
            ...mockVenueWithCoordinates,
            latitude: 51.5074,
            longitude: -0.1278,
        };
        vi.mocked(VenueService.getVenue).mockResolvedValue(customCoordinates);

        render(
            <TestWrapper venueId="venue-1">
                <VenueDetail />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeInTheDocument();
        });

        const marker = screen.getByTestId('marker');
        const position = JSON.parse(marker.getAttribute('data-position') || '[]');
        expect(position).toEqual([51.5074, -0.1278]);
    });

    it('should render map with tile layer', async () => {
        vi.mocked(VenueService.getVenue).mockResolvedValue(mockVenueWithCoordinates);

        render(
            <TestWrapper venueId="venue-1">
                <VenueDetail />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeInTheDocument();
        });

        // Check that tile layer is rendered
        expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
    });
});
