import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import { BulkEditPage } from '../BulkEditPage';
import { venueBulkConfig } from '../configs/venueBulkConfig';
import { BulkService } from '../../../../services/api/bulk.service';
import type { Venue } from '../../../../types';

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
