import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ParticipantList } from '../ParticipantList';
import { ParticipantService } from '../../../services/api/participant.service';

// Mock the services
vi.mock('../../../services/api/participant.service');
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
  }),
}));
vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
  useGlobalGeographicFilter: () => ({
    selectedGeographicAreaId: null,
  }),
}));

describe('Batched Loading with Resume', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should display Resume button after cancelling load', async () => {
    const user = userEvent.setup();

    // Mock paginated response with 250 total items (3 pages)
    const mockGetParticipantsPaginated = vi.mocked(ParticipantService.getParticipantsPaginated);
    mockGetParticipantsPaginated.mockImplementation(async (page: number) => {
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `participant-${page}-${i}`,
        name: `Participant ${page}-${i}`,
        email: `participant${page}${i}@example.com`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      return {
        data: items,
        pagination: {
          page,
          limit: 100,
          total: 250,
          totalPages: 3,
        },
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ParticipantList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for first batch to load
    await waitFor(() => {
      expect(screen.getByText(/Loading: 100 \/ 250/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel loading/i });
    await user.click(cancelButton);

    // Wait for Resume button to appear
    await waitFor(() => {
      const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
      expect(resumeButton).toBeInTheDocument();
    });

    // Verify loading stopped (should show partial count)
    expect(screen.getByText(/\(\d+ \/ 250\)/)).toBeInTheDocument();

    // Click Resume button
    const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
    await user.click(resumeButton);

    // Wait for loading to continue
    await waitFor(() => {
      expect(screen.getByText(/Loading: 200 \/ 250/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify Resume button is gone while loading
    expect(screen.queryByRole('button', { name: /Resume loading participants/i })).not.toBeInTheDocument();
  });

  it('should hide Resume button when all items are loaded', async () => {
    const user = userEvent.setup();

    // Mock paginated response with 150 total items (2 pages)
    const mockGetParticipantsPaginated = vi.mocked(ParticipantService.getParticipantsPaginated);
    mockGetParticipantsPaginated.mockImplementation(async (page: number) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const itemCount = page === 1 ? 100 : 50;
      const items = Array.from({ length: itemCount }, (_, i) => ({
        id: `participant-${page}-${i}`,
        name: `Participant ${page}-${i}`,
        email: `participant${page}${i}@example.com`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      return {
        data: items,
        pagination: {
          page,
          limit: 100,
          total: 150,
          totalPages: 2,
        },
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ParticipantList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for first batch to load
    await waitFor(() => {
      expect(screen.getByText(/Loading: 100 \/ 150/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel loading/i });
    await user.click(cancelButton);

    // Wait for Resume button to appear
    await waitFor(() => {
      const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
      expect(resumeButton).toBeInTheDocument();
    });

    // Click Resume button
    const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
    await user.click(resumeButton);

    // Wait for all items to load
    await waitFor(() => {
      expect(screen.getByText(/\(150\)/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify Resume button is hidden when all items loaded
    expect(screen.queryByRole('button', { name: /Resume loading participants/i })).not.toBeInTheDocument();
  });
});
