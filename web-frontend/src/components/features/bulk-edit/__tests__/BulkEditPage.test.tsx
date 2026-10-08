import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import { BulkEditPage } from '../BulkEditPage';
import { venueBulkConfig } from '../configs/venueBulkConfig';
import { participantBulkConfig } from '../configs/participantBulkConfig';
import { BulkService } from '../../../../services/api/bulk.service';
import type { Venue, Participant } from '../../../../types';

/**
 * BulkEditPage behavioural tests (requirement 14.6).
 *
 * Verifies the two-step persistence contract:
 *  - NO POST happens on edit / add / mark-delete / navigate.
 *  - Discard clears state and calls nothing.
 *  - Apply success clears the staged set.
 *  - Apply failure retains the staged set so the user can retry.
 */

vi.mock('../../../../services/api/bulk.service', () => ({
    BulkService: {
        submit: vi.fn(),
    },
}));
vi.mock('../../../../hooks/usePermissions', () => ({
    usePermissions: () => ({
        canCreate: () => true,
        canEdit: () => true,
        canDelete: () => true,
        isReadOnly: () => false,
        isAdministrator: () => true,
        hasRole: () => true,
    }),
}));

function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>{children}</BrowserRouter>
        </QueryClientProvider>
    );
}

const sampleVenues: Venue[] = [
    {
        id: 'v1',
        name: 'Alpha',
        address: '1 St',
        geographicAreaId: 'area-1',
        geographicArea: {
            id: 'area-1',
            name: 'Downtown',
            areaType: 'CITY',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

async function renderPageWithRows() {
    const fetchPage = vi.fn().mockResolvedValue({
        data: sampleVenues,
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(
        <Wrapper>
            <BulkEditPage<Venue>
                config={venueBulkConfig}
                listQueryKeyPrefix="venues"
                fetchPage={fetchPage}
            />
        </Wrapper>
    );
    await waitFor(() => {
        expect(screen.getByTestId('bulk-edit-table')).toBeInTheDocument();
    });
    await waitFor(() => {
        expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument();
    });
    return { fetchPage };
}

describe('BulkEditPage - two-step persistence', () => {
    beforeEach(() => {
        vi.mocked(BulkService.submit).mockReset();
    });

    it('does not POST on edit, add, delete, or discard - only on Apply', async () => {
        const user = userEvent.setup();
        await renderPageWithRows();

        // Edit the first row's name cell
        const nameInput = screen.getByDisplayValue('Alpha');
        await user.clear(nameInput);
        await user.type(nameInput, 'Beta');

        // Add a staged create
        await user.click(screen.getByTestId('bulk-edit-add-row'));

        // Mark the existing row for deletion
        await user.click(screen.getByTestId('bulk-edit-delete'));

        // No API call so far.
        expect(BulkService.submit).not.toHaveBeenCalled();

        // Discard confirms via dialog
        await user.click(screen.getByTestId('bulk-edit-discard'));
        await user.click(screen.getByText('Discard'));

        // Still no API call. The staged set should now be empty.
        expect(BulkService.submit).not.toHaveBeenCalled();
    });

    it('Apply success clears the staged change set', async () => {
        const user = userEvent.setup();
        vi.mocked(BulkService.submit).mockResolvedValue({
            success: true,
            applied: { created: 0, updated: 1, deleted: 0 },
            results: {
                creates: [],
                updates: [
                    {
                        ref: { id: 'v1' },
                        status: 'updated',
                        record: { ...sampleVenues[0], name: 'Beta' },
                    },
                ],
                deletes: [],
            },
        });

        await renderPageWithRows();

        const nameInput = screen.getByDisplayValue('Alpha');
        await user.clear(nameInput);
        await user.type(nameInput, 'Beta');

        await user.click(screen.getByTestId('bulk-edit-apply'));
        await user.click(screen.getByText('Apply'));

        await waitFor(() => {
            expect(BulkService.submit).toHaveBeenCalledTimes(1);
        });

        // Summary resets to 0/0/0 after success.
        await waitFor(() => {
            const summary = screen.getByTestId('bulk-edit-summary');
            expect(summary.textContent).toContain('0 creates');
            expect(summary.textContent).toContain('0 updates');
            expect(summary.textContent).toContain('0 deletes');
        });
    });

    it('Apply failure retains the staged set so the user can retry', async () => {
        const user = userEvent.setup();
        vi.mocked(BulkService.submit).mockResolvedValue({
            success: false,
            applied: { created: 0, updated: 0, deleted: 0 },
            code: 'BULK_VERSION_CONFLICT',
            message: 'Version conflict',
            errors: [{ ref: { id: 'v1' }, code: 'VERSION_CONFLICT', message: 'stale' }],
        });

        await renderPageWithRows();

        const nameInput = screen.getByDisplayValue('Alpha');
        await user.clear(nameInput);
        await user.type(nameInput, 'Beta');

        await user.click(screen.getByTestId('bulk-edit-apply'));
        await user.click(screen.getByText('Apply'));

        await waitFor(() => {
            expect(BulkService.submit).toHaveBeenCalledTimes(1);
        });

        // Summary still shows 1 update because the staged set was retained.
        await waitFor(() => {
            const summary = screen.getByTestId('bulk-edit-summary');
            expect(summary.textContent).toContain('1 updates');
        });
    });
});

// Guard against unused imports in some environments
void act;

const sampleParticipants: Participant[] = [
    {
        id: 'p1',
        name: 'Jordan',
        dateOfBirth: '1990-05-20T00:00:00.000Z',
        dateOfRegistration: null,
        version: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    } as unknown as Participant,
];

describe('BulkEditPage - request serialization (frontend/backend contract)', () => {
    beforeEach(() => {
        vi.mocked(BulkService.submit).mockReset();
    });

    it('sends dateOfBirth as a full ISO 8601 string, not a bare YYYY-MM-DD', async () => {
        const user = userEvent.setup();
        vi.mocked(BulkService.submit).mockResolvedValue({
            success: true,
            applied: { created: 0, updated: 1, deleted: 0 },
            results: { creates: [], updates: [], deletes: [] },
        });

        const fetchPage = vi.fn().mockResolvedValue({
            data: sampleParticipants,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        render(
            <Wrapper>
                <BulkEditPage<Participant>
                    config={participantBulkConfig}
                    listQueryKeyPrefix="participants"
                    fetchPage={fetchPage}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Jordan')).toBeInTheDocument();
        });

        // The DatePicker renders the stored value as date-only (YYYY/MM/DD).
        const dobInput = screen.getByDisplayValue('1990/05/20');
        await user.clear(dobInput);
        await user.type(dobInput, '1991/06/21');

        await user.click(screen.getByTestId('bulk-edit-apply'));
        await user.click(screen.getByText('Apply'));

        await waitFor(() => {
            expect(BulkService.submit).toHaveBeenCalledTimes(1);
        });

        const [, request] = vi.mocked(BulkService.submit).mock.calls[0];
        expect(request.updates).toHaveLength(1);
        const dob = (request.updates[0].data as { dateOfBirth?: string }).dateOfBirth;
        // Must be a full ISO 8601 date-time (what z.string().datetime() accepts),
        // never a bare YYYY-MM-DD (the cause of the reported VALIDATION_ERROR).
        expect(dob).toBe('1991-06-21T00:00:00.000Z');
        expect(dob).toMatch(/T\d{2}:\d{2}:\d{2}/);
    });
});

describe('BulkEditPage - respects the global geographic filter (authorization boundary)', () => {
    beforeEach(() => {
        vi.mocked(BulkService.submit).mockReset();
    });

    it('passes the selected geographic area to fetchPage', async () => {
        const fetchPage = vi.fn().mockResolvedValue({
            data: sampleVenues,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        render(
            <Wrapper>
                <BulkEditPage<Venue>
                    config={venueBulkConfig}
                    listQueryKeyPrefix="venues"
                    fetchPage={fetchPage}
                    geographicAreaId="area-99"
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('bulk-edit-table')).toBeInTheDocument();
        });

        expect(fetchPage).toHaveBeenCalledWith(
            expect.objectContaining({ geographicAreaId: 'area-99' })
        );
    });

    it('refetches with the new area when the filter changes (filter is in the query key)', async () => {
        const fetchPage = vi.fn().mockResolvedValue({
            data: sampleVenues,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        // A single QueryClient must survive the rerender so caching is realistic.
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const ui = (geo: string | null) => (
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <BulkEditPage<Venue>
                        config={venueBulkConfig}
                        listQueryKeyPrefix="venues"
                        fetchPage={fetchPage}
                        geographicAreaId={geo}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        );

        const { rerender } = render(ui('area-1'));
        await waitFor(() => {
            expect(fetchPage).toHaveBeenCalledWith(
                expect.objectContaining({ geographicAreaId: 'area-1' })
            );
        });

        rerender(ui('area-2'));
        await waitFor(() => {
            expect(fetchPage).toHaveBeenCalledWith(
                expect.objectContaining({ geographicAreaId: 'area-2' })
            );
        });
    });

    it('discards staged changes when the geographic filter changes', async () => {
        const user = userEvent.setup();
        const fetchPage = vi.fn().mockResolvedValue({
            data: sampleVenues,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const ui = (geo: string | null) => (
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <BulkEditPage<Venue>
                        config={venueBulkConfig}
                        listQueryKeyPrefix="venues"
                        fetchPage={fetchPage}
                        geographicAreaId={geo}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        );

        const { rerender } = render(ui('area-1'));
        await waitFor(() => expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument());

        // Stage an edit against the in-scope row.
        const nameInput = screen.getByDisplayValue('Alpha');
        await user.clear(nameInput);
        await user.type(nameInput, 'Beta');
        await waitFor(() => {
            expect(screen.getByTestId('bulk-edit-summary').textContent).toContain('1 updates');
        });

        // Change the geographic filter - the staged edit (keyed to a row that
        // may be out of the new scope) must be discarded, not carried over.
        rerender(ui('area-2'));
        await waitFor(() => {
            expect(screen.getByTestId('bulk-edit-summary').textContent).toContain('0 updates');
        });
        // And no POST was ever made (nothing applied).
        expect(BulkService.submit).not.toHaveBeenCalled();
    });
});
