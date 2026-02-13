import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReconciliationPage from '../ReconciliationPage';
import { ParticipantService } from '../../../services/api/participant.service';

vi.mock('../../../services/api/participant.service');
vi.mock('../../../services/api/merge.service');
vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
    useGlobalGeographicFilter: () => ({ selectedGeographicAreaId: null }),
}));

const mockSourceParticipant = {
    id: 'source-id',
    name: 'Source Participant',
    email: 'source@example.com',
    phone: '111-111-1111',
    nickname: 'SourceNick',
    dateOfBirth: '1990-01-01',
    dateOfRegistration: '2020-01-01',
    notes: 'Source notes',
};

const mockDestinationParticipant = {
    id: 'dest-id',
    name: 'Destination Participant',
    email: 'dest@example.com',
    phone: '222-222-2222',
    nickname: 'DestNick',
    dateOfBirth: '1991-02-02',
    dateOfRegistration: '2021-02-02',
    notes: 'Destination notes',
};

function TestWrapper({ children, initialUrl }: { children: React.ReactNode; initialUrl: string }) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialUrl]}>
                <Routes>
                    <Route path="/merge/:entityType/reconcile" element={children} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('ReconciliationPage - URL Parameters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ParticipantService.getParticipant).mockImplementation(async (id: string) => {
            if (id === 'source-id') return mockSourceParticipant as any;
            if (id === 'dest-id') return mockDestinationParticipant as any;
            throw new Error('Participant not found');
        });
    });

    it('should load entities using URL parameters', async () => {
        render(
            <TestWrapper initialUrl="/merge/participant/reconcile?source=source-id&destination=dest-id">
                <ReconciliationPage />
            </TestWrapper>
        );

        // Wait for entities to load
        await waitFor(() => {
            expect(screen.getByText('Merge Participant')).toBeInTheDocument();
        });

        // Verify both services were called with correct IDs
        expect(ParticipantService.getParticipant).toHaveBeenCalledWith('source-id');
        expect(ParticipantService.getParticipant).toHaveBeenCalledWith('dest-id');

        // Verify field values are displayed (using getAllByText since values appear in multiple places)
        expect(screen.getAllByText('Source Participant').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Destination Participant').length).toBeGreaterThan(0);
    });

    it('should show error when URL parameters are missing', async () => {
        render(
            <TestWrapper initialUrl="/merge/participant/reconcile">
                <ReconciliationPage />
            </TestWrapper>
        );

        // Wait for error to be displayed
        await waitFor(() => {
            expect(screen.getByText(/This page must be accessed through the merge workflow/i)).toBeInTheDocument();
        });

        // Verify services were not called
        expect(ParticipantService.getParticipant).not.toHaveBeenCalled();

        // Verify Go Back button is present
        expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should show error when only source parameter is provided', async () => {
        render(
            <TestWrapper initialUrl="/merge/participant/reconcile?source=source-id">
                <ReconciliationPage />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/This page must be accessed through the merge workflow/i)).toBeInTheDocument();
        });

        expect(ParticipantService.getParticipant).not.toHaveBeenCalled();
    });

    it('should show error when only destination parameter is provided', async () => {
        render(
            <TestWrapper initialUrl="/merge/participant/reconcile?destination=dest-id">
                <ReconciliationPage />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/This page must be accessed through the merge workflow/i)).toBeInTheDocument();
        });

        expect(ParticipantService.getParticipant).not.toHaveBeenCalled();
    });
});
