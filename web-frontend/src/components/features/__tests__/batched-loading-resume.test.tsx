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

    // Wait for first batch to load - check for progress bar and pause button
    await waitFor(() => {
      expect(screen.getAllByText(/Loading \d+ \/ 250 participants\.\.\./)[0]).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pause loading/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click Pause button (was Cancel button)
    const pauseButton = screen.getByRole('button', { name: /Pause loading/i });
    await user.click(pauseButton);

    // Wait for Resume button to appear (play icon)
    await waitFor(() => {
      const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
      expect(resumeButton).toBeInTheDocument();
    });

    // Entity count should be hidden while paused (to prevent button shift)
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    // Progress bar should still be visible when paused, but with "Loaded" label
    expect(screen.getAllByText(/Loaded \d+ \/ 250 participants\./)[0]).toBeInTheDocument();

    // Click Resume button (play icon)
    const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
    await user.click(resumeButton);

    // Wait for loading to continue - check for progress bar and pause button again
    await waitFor(() => {
      expect(screen.getAllByText(/Loading \d+ \/ 250 participants\.\.\./)[0]).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pause loading/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify Resume button is gone while loading
    expect(screen.queryByRole('button', { name: /Resume loading participants/i })).not.toBeInTheDocument();
  });

  it('should hide Resume button when all items are loaded', async () => {
    const user = userEvent.setup();

    // Mock paginated response with 150 total items (2 pages)
    const mockGetParticipantsPaginated = vi.mocked(ParticipantService.getParticipantsPaginated);
    mockGetParticipantsPaginated.mockImplementation(async (page: number) => {
      // Longer delay for page 2 to prevent race condition
      await new Promise(resolve => setTimeout(resolve, page === 2 ? 500 : 50));
      
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

    // Wait for first batch to load - check for progress bar and pause button
    await waitFor(() => {
      expect(screen.getAllByText(/Loading \d+ \/ 150 participants\.\.\./)[0]).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pause loading/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click Pause button
    const pauseButton = screen.getByRole('button', { name: /Pause loading/i });
    await user.click(pauseButton);

    // Wait for Resume button to appear (play icon)
    await waitFor(() => {
      const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
      expect(resumeButton).toBeInTheDocument();
    });

    // Progress bar should still be visible when paused, but with "Loaded" label
    expect(screen.getAllByText(/Loaded \d+ \/ 150 participants\./)[0]).toBeInTheDocument();

    // Click Resume button (play icon) - get it fresh to avoid stale reference
    await user.click(screen.getByRole('button', { name: /Resume loading participants/i }));

    // Wait for all items to load - component should unmount completely
    await waitFor(() => {
      expect(screen.getByText(/\(150\)/)).toBeInTheDocument();
      // Progress bar should be gone
      expect(screen.queryByText(/Loading \d+ \/ 150 participants\.\.\./)).not.toBeInTheDocument();
      // Pause button should be gone
      expect(screen.queryByRole('button', { name: /Pause loading/i })).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify Resume button is also hidden when all items loaded (component unmounted)
    expect(screen.queryByRole('button', { name: /Resume loading participants/i })).not.toBeInTheDocument();
  });
});

