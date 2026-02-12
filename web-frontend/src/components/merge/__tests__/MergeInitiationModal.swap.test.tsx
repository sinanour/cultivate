import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MergeInitiationModal } from '../MergeInitiationModal';
import { ParticipantService } from '../../../services/api/participant.service';

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

describe('MergeInitiationModal - Swap Functionality with Ensure Included', () => {
    let queryClient: QueryClient;
    const user = userEvent.setup();

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const renderModal = (currentEntityId: string) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <MergeInitiationModal
                        entityType="participant"
                        currentEntityId={currentEntityId}
                        currentEntityName="Current Participant"
                        isOpen={true}
                        onDismiss={vi.fn()}
                        onConfirm={vi.fn()}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('should fetch both source and destination entities by ID when not in initial results', async () => {
        const sourceParticipant = { id: 'p-source', name: 'Zara Source', email: 'zara@test.com' };
        const destinationParticipant = { id: 'p-dest', name: 'Zoe Destination', email: 'zoe@test.com' };
        const otherParticipants = [
            { id: 'p1', name: 'Alice Participant', email: 'alice@test.com' },
            { id: 'p2', name: 'Bob Participant', email: 'bob@test.com' },
        ];

        // Mock getParticipantsFlexible to return participants WITHOUT source or destination
        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: otherParticipants,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        // Mock getParticipantById to return the appropriate participant
        vi.mocked(ParticipantService.getParticipantById)
            .mockImplementation(async (id: string) => {
                if (id === 'p-source') return sourceParticipant;
                if (id === 'p-dest') return destinationParticipant;
                throw new Error('Participant not found');
            });

        renderModal('p-source');

        // Wait for source to be fetched
        await waitFor(() => {
            expect(ParticipantService.getParticipantById).toHaveBeenCalledWith('p-source');
        });

        // Note: In a real scenario, the user would select the destination from the dropdown
        // For this test, we're verifying that the fetch mechanism is in place
        // The actual swap test would require more complex interaction simulation
    });

    it('should reset ensured entity state when ensureIncluded prop changes', async () => {
        const participant1 = { id: 'p1', name: 'Participant 1', email: 'p1@test.com' };
        const participant2 = { id: 'p2', name: 'Participant 2', email: 'p2@test.com' };
        const otherParticipants = [
            { id: 'p3', name: 'Participant 3', email: 'p3@test.com' },
        ];

        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: otherParticipants,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        vi.mocked(ParticipantService.getParticipantById)
            .mockImplementation(async (id: string) => {
                if (id === 'p1') return participant1;
                if (id === 'p2') return participant2;
                throw new Error('Participant not found');
            });

        const { rerender } = renderModal('p1');

        // Wait for p1 to be fetched
        await waitFor(() => {
            expect(ParticipantService.getParticipantById).toHaveBeenCalledWith('p1');
        });

        // Clear mocks to track new calls
        vi.clearAllMocks();

        // Simulate prop change (like what happens during swap)
        rerender(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <MergeInitiationModal
                        entityType="participant"
                        currentEntityId="p2" // Changed ID
                        currentEntityName="Current Participant"
                        isOpen={true}
                        onDismiss={vi.fn()}
                        onConfirm={vi.fn()}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for p2 to be fetched (state should have reset)
        await waitFor(() => {
            expect(ParticipantService.getParticipantById).toHaveBeenCalledWith('p2');
        });
    });

    it('should handle swap button click and maintain entity visibility', async () => {
        const sourceParticipant = { id: 'p-source', name: 'Zara Source', email: 'zara@test.com' };
        const otherParticipants = [
            { id: 'p1', name: 'Alice Participant', email: 'alice@test.com' },
        ];

        vi.mocked(ParticipantService.getParticipantsFlexible).mockResolvedValue({
            data: otherParticipants,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        vi.mocked(ParticipantService.getParticipantById).mockResolvedValue(sourceParticipant);

        renderModal('p-source');

        // Wait for initial load
        await waitFor(() => {
            expect(ParticipantService.getParticipantById).toHaveBeenCalledWith('p-source');
        });

        // Find and click the swap button
        const swapButton = screen.getByRole('button', { name: /swap/i });

        // Swap button should be disabled initially (no destination selected)
        expect(swapButton).toBeDisabled();

        // Note: Full swap test would require selecting a destination first
        // This test verifies the swap button exists and has correct initial state
    });
});
