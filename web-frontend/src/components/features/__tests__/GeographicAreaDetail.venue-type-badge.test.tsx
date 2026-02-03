import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GeographicAreaDetail } from '../GeographicAreaDetail';
import { GeographicAreaService } from '../../../services/api/geographic-area.service';
import type { GeographicArea, Venue } from '../../../types';

// Mock services
vi.mock('../../../services/api/geographic-area.service');
vi.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => ({
        canEdit: () => true,
        canDelete: () => true,
    }),
}));
vi.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', email: 'test@example.com', role: 'ADMINISTRATOR' },
    }),
}));
vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
    useGlobalGeographicFilter: () => ({
        selectedGeographicAreaId: null,
        setGeographicAreaFilter: vi.fn(),
        clearGeographicAreaFilter: vi.fn(),
    }),
}));

const TestWrapper = ({ children, areaId = 'area-1' }: { children: React.ReactNode; areaId?: string }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/geographic-areas/${areaId}`]}>
                <Routes>
                    <Route path="/geographic-areas/:id" element={children} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('GeographicAreaDetail - Venue Type Badge Display', () => {
    const mockGeographicArea: GeographicArea = {
        id: 'area-1',
        name: 'Downtown',
        areaType: 'NEIGHBOURHOOD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock the geographic area query
        vi.mocked(GeographicAreaService.getGeographicArea).mockResolvedValue(mockGeographicArea);
        vi.mocked(GeographicAreaService.getChildren).mockResolvedValue([]);
        vi.mocked(GeographicAreaService.getAncestors).mockResolvedValue([]);
        vi.mocked(GeographicAreaService.getStatistics).mockResolvedValue({
            totalActivities: 0,
            activeActivities: 0,
            totalParticipants: 0,
            totalVenues: 0,
        });
    });

    it('should display Private Residence badge for PRIVATE_RESIDENCE in associated venues list', async () => {
        const mockVenues: Venue[] = [
            {
                id: 'venue-1',
                name: 'John\'s Home',
                address: '123 Main St',
                geographicAreaId: 'area-1',
                venueType: 'PRIVATE_RESIDENCE',
                geographicArea: mockGeographicArea,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
            },
        ];

        vi.mocked(GeographicAreaService.getVenues).mockResolvedValue(mockVenues);

        render(
            <TestWrapper>
                <GeographicAreaDetail />
            </TestWrapper>
        );

        // Wait for the venue to be loaded
        await waitFor(() => {
            expect(screen.getByText('John\'s Home')).toBeDefined();
        });

        // Check that the badge is displayed with correct text
        expect(screen.getByText('Private Residence')).toBeDefined();
    });

    it('should display Public Building badge for PUBLIC_BUILDING in associated venues list', async () => {
        const mockVenues: Venue[] = [
            {
                id: 'venue-2',
                name: 'Community Center',
                address: '456 Oak Ave',
                geographicAreaId: 'area-1',
                venueType: 'PUBLIC_BUILDING',
                geographicArea: mockGeographicArea,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
            },
        ];

        vi.mocked(GeographicAreaService.getVenues).mockResolvedValue(mockVenues);

        render(
            <TestWrapper>
                <GeographicAreaDetail />
            </TestWrapper>
        );

        // Wait for the venue to be loaded
        await waitFor(() => {
            expect(screen.getByText('Community Center')).toBeDefined();
        });

        // Check that the badge is displayed with correct text
        expect(screen.getByText('Public Building')).toBeDefined();
    });

    it('should leave venue type cell blank when venue type is undefined', async () => {
        const mockVenues: Venue[] = [
            {
                id: 'venue-3',
                name: 'Unspecified Venue',
                address: '789 Pine Rd',
                geographicAreaId: 'area-1',
                venueType: undefined,
                geographicArea: mockGeographicArea,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
            },
        ];

        vi.mocked(GeographicAreaService.getVenues).mockResolvedValue(mockVenues);

        render(
            <TestWrapper>
                <GeographicAreaDetail />
            </TestWrapper>
        );

        // Wait for the venue to be loaded
        await waitFor(() => {
            expect(screen.getByText('Unspecified Venue')).toBeDefined();
        });

        // Check that no badge is displayed
        const privateResidenceBadge = screen.queryByText('Private Residence');
        const publicBuildingBadge = screen.queryByText('Public Building');
        expect(privateResidenceBadge).toBeNull();
        expect(publicBuildingBadge).toBeNull();
    });

    it('should display venue type badges for multiple venues with different types', async () => {
        const mockVenues: Venue[] = [
            {
                id: 'venue-1',
                name: 'John\'s Home',
                address: '123 Main St',
                geographicAreaId: 'area-1',
                venueType: 'PRIVATE_RESIDENCE',
                geographicArea: mockGeographicArea,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
            },
            {
                id: 'venue-2',
                name: 'Community Center',
                address: '456 Oak Ave',
                geographicAreaId: 'area-1',
                venueType: 'PUBLIC_BUILDING',
                geographicArea: mockGeographicArea,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
            },
            {
                id: 'venue-3',
                name: 'Unspecified Venue',
                address: '789 Pine Rd',
                geographicAreaId: 'area-1',
                venueType: undefined,
                geographicArea: mockGeographicArea,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
            },
        ];

        vi.mocked(GeographicAreaService.getVenues).mockResolvedValue(mockVenues);

        render(
            <TestWrapper>
                <GeographicAreaDetail />
            </TestWrapper>
        );

        // Wait for all venues to be loaded
        await waitFor(() => {
            expect(screen.getByText('John\'s Home')).toBeDefined();
            expect(screen.getByText('Community Center')).toBeDefined();
            expect(screen.getByText('Unspecified Venue')).toBeDefined();
        });

        // Check that both badge types are displayed
        expect(screen.getByText('Private Residence')).toBeDefined();
        expect(screen.getByText('Public Building')).toBeDefined();
    });
});
