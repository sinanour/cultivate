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

describe('MergeInitiationModal - Ensure Included Functionality', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const renderModal = (entityType: 'participant' | 'activity' | 'venue', currentEntityId: string) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <MergeInitiationModal
                        entityType={entityType}
                        currentEntityId={currentEntityId}
                        currentEntityName="Current Entity"
                        isOpen={true}
                        onDismiss={vi.fn()}
                        onConfirm={vi.fn()}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('should fetch and include source participant by ID when not in initial results', async () => {
        const currentParticipant = { id: 'p-current', name: 'Zara Current', email: 'zara@test.com' };
        const otherParticipants = [
            { id: 'p1', name: 'Alice Participant', email: 'alice@test.com' },
            { id: 'p2', name: 'Bob Participant', email: 'bob@test.com' },
        ];

        // Mock getParticipantsFlexible to return participants WITHOUT the current one
        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: otherParticipants,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        // Mock getParticipantById to return the current participant
        vi.mocked(ParticipantService.getParticipantById).mockResolvedValue(currentParticipant);

        renderModal('participant', 'p-current');

        // Wait for both fetches to complete
        await waitFor(() => {
            expect(ParticipantService.getParticipantsFlexible).toHaveBeenCalled();
            expect(ParticipantService.getParticipantById).toHaveBeenCalledWith('p-current');
        });
    });

    it('should NOT fetch participant by ID when already in initial results', async () => {
        const currentParticipant = { id: 'p-current', name: 'Alice Current', email: 'alice@test.com' };
        const allParticipants = [
            currentParticipant,
            { id: 'p2', name: 'Bob Participant', email: 'bob@test.com' },
        ];

        // Mock getParticipantsFlexible to return participants INCLUDING the current one
        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: allParticipants,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        // Mock getParticipantById (should NOT be called)
        vi.mocked(ParticipantService.getParticipantById).mockResolvedValue(currentParticipant);

        renderModal('participant', 'p-current');

        await waitFor(() => {
            expect(ParticipantService.getParticipantsFlexible).toHaveBeenCalled();
        });

        // getParticipantById should NOT be called since the entity is already in results
        expect(ParticipantService.getParticipantById).not.toHaveBeenCalled();
    });

    it('should handle fetch-by-ID errors gracefully', async () => {
        const otherParticipants = [
            { id: 'p1', name: 'Alice Participant', email: 'alice@test.com' },
        ];

        // Mock getParticipantsFlexible to succeed
        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: otherParticipants,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        // Mock getParticipantById to fail
        vi.mocked(ParticipantService.getParticipantById).mockRejectedValue(
            new Error('Participant not found')
        );

        // Should not throw error - component should handle gracefully
        renderModal('participant', 'p-nonexistent');

        await waitFor(() => {
            expect(ParticipantService.getParticipantsFlexible).toHaveBeenCalled();
            expect(ParticipantService.getParticipantById).toHaveBeenCalledWith('p-nonexistent');
        });

        // Modal should still render (graceful degradation)
        expect(screen.getByText('Merge Records')).toBeInTheDocument();
    });
});
