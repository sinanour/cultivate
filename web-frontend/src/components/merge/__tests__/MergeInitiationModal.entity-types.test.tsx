import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MergeInitiationModal } from '../MergeInitiationModal';
import { ParticipantService } from '../../../services/api/participant.service';
import { ActivityService } from '../../../services/api/activity.service';
import { VenueService } from '../../../services/api/venue.service';

// Mock services
vi.mock('../../../services/api/participant.service');
vi.mock('../../../services/api/activity.service');
vi.mock('../../../services/api/venue.service');
vi.mock('../../../services/api/geographic-area.service');
vi.mock('../../../services/api/activity-type.service');
vi.mock('../../../services/api/population.service');

// Mock geographic filter hook
vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
    useGlobalGeographicFilter: () => ({
        selectedGeographicAreaId: null,
    }),
}));

describe('MergeInitiationModal - Entity Type Consistency', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const renderModal = (entityType: 'participant' | 'activity' | 'venue') => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <MergeInitiationModal
                        entityType={entityType}
                        currentEntityId="test-id"
                        currentEntityName="Test Entity"
                        isOpen={true}
                        onDismiss={vi.fn()}
                        onConfirm={vi.fn()}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('should fetch participants when entityType is participant', async () => {
        const mockParticipants = [
            { id: 'p1', name: 'Participant 1', email: 'p1@test.com' },
            { id: 'p2', name: 'Participant 2', email: 'p2@test.com' },
        ];

        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: mockParticipants,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        renderModal('participant');

        await waitFor(() => {
            expect(ParticipantService.getParticipantsFlexible).toHaveBeenCalled();
        });

        // Should NOT call other services
        expect(ActivityService.getActivitiesFlexible).not.toHaveBeenCalled();
        expect(VenueService.getVenuesFlexible).not.toHaveBeenCalled();
    });

    it('should fetch activities when entityType is activity', async () => {
        const mockActivities = [
            { id: 'a1', name: 'Activity 1', activityType: { name: 'Type 1' } },
            { id: 'a2', name: 'Activity 2', activityType: { name: 'Type 2' } },
        ];

        vi.mocked(ActivityService.getActivitiesFlexible).mockResolvedValue({
            data: mockActivities,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        renderModal('activity');

        await waitFor(() => {
            expect(ActivityService.getActivitiesFlexible).toHaveBeenCalled();
        });

        // Should NOT call other services
        expect(ParticipantService.getParticipantsFlexible).not.toHaveBeenCalled();
        expect(VenueService.getVenuesFlexible).not.toHaveBeenCalled();
    });

    it('should fetch venues when entityType is venue', async () => {
        const mockVenues = [
            { id: 'v1', name: 'Venue 1', address: '123 Main St' },
            { id: 'v2', name: 'Venue 2', address: '456 Oak Ave' },
        ];

        vi.mocked(VenueService.getVenuesFlexible).mockResolvedValue({
            data: mockVenues,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        renderModal('venue');

        await waitFor(() => {
            expect(VenueService.getVenuesFlexible).toHaveBeenCalled();
        });

        // Should NOT call other services
        expect(ParticipantService.getParticipantsFlexible).not.toHaveBeenCalled();
        expect(ActivityService.getActivitiesFlexible).not.toHaveBeenCalled();
    });

    it('should use unique cache keys for different entity types', async () => {
        const mockActivities = [
            { id: 'a1', name: 'Activity 1', activityType: { name: 'Type 1' } },
        ];
        const mockVenues = [
            { id: 'v1', name: 'Venue 1', address: '123 Main St' },
        ];

        vi.mocked(ActivityService.getActivitiesFlexible).mockResolvedValue({
            data: mockActivities,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        vi.mocked(VenueService.getVenuesFlexible).mockResolvedValue({
            data: mockVenues,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        // Render activity modal
        const { unmount } = renderModal('activity');

        await waitFor(() => {
            expect(ActivityService.getActivitiesFlexible).toHaveBeenCalled();
        });

        unmount();

        // Clear mocks
        vi.clearAllMocks();

        // Render venue modal - should fetch venues, not use cached activity data
        renderModal('venue');

        await waitFor(() => {
            expect(VenueService.getVenuesFlexible).toHaveBeenCalled();
        });

        // Activity service should NOT be called again
        expect(ActivityService.getActivitiesFlexible).not.toHaveBeenCalled();
    });
});
