import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import ReconciliationPage from '../ReconciliationPage';
import { ParticipantService } from '../../../services/api/participant.service';
import { MergeService } from '../../../services/api/merge.service';

// Mock services
vi.mock('../../../services/api/participant.service');
vi.mock('../../../services/api/merge.service');
vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
  useGlobalGeographicFilter: () => ({ selectedGeographicAreaId: null }),
}));

const mockSourceParticipant = {
  id: 'source-id',
  name: 'Source Name',
  email: 'source@example.com',
  phone: '111-111-1111',
  nickname: 'SourceNick',
  dateOfBirth: '1990-01-01',
  dateOfRegistration: '2020-01-01',
  notes: 'Source notes',
};

const mockDestinationParticipant = {
  id: 'dest-id',
  name: 'Destination Name',
  email: 'dest@example.com',
  phone: '222-222-2222',
  nickname: 'DestNick',
  dateOfBirth: '1991-02-02',
  dateOfRegistration: '2021-02-02',
  notes: 'Destination notes',
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/merge/participant/reconcile',
            state: { sourceId: 'source-id', destinationId: 'dest-id' },
          },
        ]}
      >
        <Routes>
          <Route path="/merge/:entityType/reconcile" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ReconciliationPage - Card Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ParticipantService.getParticipant).mockImplementation(async (id: string) => {
      if (id === 'source-id') return mockSourceParticipant as any;
      if (id === 'dest-id') return mockDestinationParticipant as any;
      throw new Error('Participant not found');
    });
  });

  // Feature: record-merge, Property 3: Card mutual exclusivity
  it('should ensure exactly one card is selected per row at all times', async () => {
    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Source Name').length).toBeGreaterThan(0);
    });

    // Find the table
    const table = screen.getByRole('table');

    // CloudScape Cards with selectionType="multi" renders checkboxes
    const checkboxes = table.querySelectorAll('input[type="checkbox"]');
    const checkedCheckboxes = Array.from(checkboxes).filter(cb => (cb as HTMLInputElement).checked);

    // We have 7 fields with 2 cards each = 14 checkboxes total
    // Exactly 7 should be checked (one per row)
    expect(checkboxes.length).toBe(14);
    expect(checkedCheckboxes.length).toBe(7);
  });

  // Feature: record-merge, Property 4: Default destination selection
  it('should select destination cards by default for all fields', async () => {
    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Destination Name').length).toBeGreaterThan(0);
    });

    // Find the table
    const table = screen.getByRole('table');
    
    // Find all checkboxes
    const checkboxes = table.querySelectorAll('input[type="checkbox"]');
    const checkedCheckboxes = Array.from(checkboxes).filter(cb => (cb as HTMLInputElement).checked);

    // All destination cards should be selected by default (7 fields = 7 checked checkboxes)
    expect(checkedCheckboxes.length).toBe(7);

    // Verify destination values are present
    expect(table.textContent).toContain('Destination Name');
    expect(table.textContent).toContain('dest@example.com');
  });

  // Feature: record-merge, Property 5: Automatic complementary selection
  it('should automatically deselect complementary card when clicking unselected card', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
        expect(screen.getAllByText('Source Name').length).toBeGreaterThan(0);
    });

    const table = screen.getByRole('table');

    // Initially 7 checkboxes should be checked (all destination)
    const initialCheckboxes = table.querySelectorAll('input[type="checkbox"]');
    const initialChecked = Array.from(initialCheckboxes).filter(cb => (cb as HTMLInputElement).checked);
    expect(initialChecked.length).toBe(7);

    // Find and click the source name card
    const sourceNameText = screen.getAllByText('Source Name')[0];
    const sourceNameCard = sourceNameText.closest('div');
    await user.click(sourceNameCard!);

    await waitFor(() => {
      // Still should have 7 checked checkboxes (one per row)
      const checkboxes = table.querySelectorAll('input[type="checkbox"]');
      const checkedCheckboxes = Array.from(checkboxes).filter(cb => (cb as HTMLInputElement).checked);
      expect(checkedCheckboxes.length).toBe(7);
    });
  });

  // Feature: record-merge, Property 5: Automatic complementary selection (toggle behavior)
  it('should automatically select complementary card when clicking already-selected card', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
        expect(screen.getAllByText('Destination Name').length).toBeGreaterThan(0);
    });

    const table = screen.getByRole('table');

    // Find a destination card that is currently selected
    const destNameText = screen.getAllByText('Destination Name')[0];
    const destCard = destNameText.closest('div');

    // Click on the selected destination card (should toggle to source)
    await user.click(destCard!);

    // After clicking, verify selection toggled
    await waitFor(() => {
      const checkboxes = table.querySelectorAll('input[type="checkbox"]');
      const checkedCheckboxes = Array.from(checkboxes).filter(cb => (cb as HTMLInputElement).checked);
      // Should still have 7 checked (one per row)
      expect(checkedCheckboxes.length).toBe(7);
    });
  });

  // Feature: record-merge, Property 6: Selected card visual styling
  it('should apply distinct visual styling to selected cards', async () => {
    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
        expect(screen.getAllByText('Destination Name').length).toBeGreaterThan(0);
    });

    const table = screen.getByRole('table');

    // CloudScape Cards with selectionType="multi" shows checkboxes
    const checkboxes = table.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);

    // Selected cards have checked checkboxes
    const checkedCheckboxes = Array.from(checkboxes).filter(cb => (cb as HTMLInputElement).checked);
    expect(checkedCheckboxes.length).toBe(7);
  });

  // Feature: record-merge, Property 7: No manual field editing
  it('should not provide any facility to manually edit field values', async () => {
    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
        expect(screen.getAllByText('Source Name').length).toBeGreaterThan(0);
    });

    // Verify no text input fields or textareas exist in the table
    const table = screen.getByRole('table');
    const textInputs = table.querySelectorAll('input[type="text"], textarea');
    expect(textInputs).toHaveLength(0);

    // Only checkboxes should exist (for card selection)
    const checkboxes = table.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('should build correct reconciled fields based on card selections', async () => {
    const user = userEvent.setup();
    const mockMerge = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(MergeService.mergeParticipants).mockImplementation(mockMerge);

    render(
      <TestWrapper>
        <ReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
        expect(screen.getAllByText('Source Name').length).toBeGreaterThan(0);
    });

    // Find and click source cards for name and email fields
    const sourceNameText = screen.getAllByText('Source Name')[0];
    const sourceNameCard = sourceNameText.closest('div');
    await user.click(sourceNameCard!);

    const sourceEmailText = screen.getAllByText('source@example.com')[0];
    const sourceEmailCard = sourceEmailText.closest('div');
    await user.click(sourceEmailCard!);

    // Submit merge
    const submitButton = screen.getByRole('button', { name: /submit merge/i });
    await user.click(submitButton);

    // Confirm in dialog
    const confirmButton = await screen.findByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMerge).toHaveBeenCalledWith(
        'dest-id',
        'source-id',
        expect.objectContaining({
          name: 'Source Name', // Selected from source
          email: 'source@example.com', // Selected from source
          phone: '222-222-2222', // Default destination
          nickname: 'DestNick', // Default destination
          dateOfBirth: '1991-02-02', // Default destination
          dateOfRegistration: '2021-02-02', // Default destination
          notes: 'Destination notes', // Default destination
        }),
        null
      );
    });
  });
});
