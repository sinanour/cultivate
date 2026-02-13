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

    // Find all cards with the clickable style
    const clickableCards = screen.getByRole('table').querySelectorAll('div[style*="cursor: pointer"]');
    expect(clickableCards.length).toBeGreaterThan(0);

    // For the name field, find source and destination cards
    const nameCards = Array.from(clickableCards).filter(card => 
      card.textContent?.includes('Source Name') || card.textContent?.includes('Destination Name')
    );

    expect(nameCards.length).toBe(2);

    // One should be selected (bold font), one should not
    const selectedCards = nameCards.filter(card => 
      (card as HTMLElement).style.fontWeight === 'bold'
    );
    expect(selectedCards.length).toBe(1);
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

    // Find all clickable cards
    const clickableCards = screen.getByRole('table').querySelectorAll('div[style*="cursor: pointer"]');
    
    // Count selected cards (bold font weight indicates selection)
    const selectedCards = Array.from(clickableCards).filter(card =>
      (card as HTMLElement).style.fontWeight === 'bold'
    );

    // All destination cards should be selected by default (7 fields = 7 selected destination cards)
    expect(selectedCards.length).toBe(7);
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

      // Find all clickable cards
      const clickableCards = screen.getByRole('table').querySelectorAll('div[style*="cursor: pointer"]');
      const nameCards = Array.from(clickableCards).filter(card =>
          card.textContent?.includes('Source Name') || card.textContent?.includes('Destination Name')
      );

      const sourceCard = nameCards.find(card => card.textContent?.includes('Source Name')) as HTMLElement;
      const destCard = nameCards.find(card => card.textContent?.includes('Destination Name')) as HTMLElement;

    // Initially destination is selected (bold)
    expect(destCard.style.fontWeight).toBe('bold');
    expect(sourceCard.style.fontWeight).toBe('normal');

    // Click source card
      await user.click(sourceCard);

    await waitFor(() => {
      // Source should now be selected (bold)
      expect(sourceCard.style.fontWeight).toBe('bold');
      // Destination should be deselected (normal)
      expect(destCard.style.fontWeight).toBe('normal');
    });
  });

  // Feature: record-merge, Property 5: Automatic complementary selection (toggle behavior)
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

      // Find all clickable cards
    const table = screen.getByRole('table');

    // Find a destination card that is currently selected (bold)
    const clickableCards = table.querySelectorAll('div[style*="cursor: pointer"]');
    const destCard = Array.from(clickableCards).find(card =>
      card.textContent?.includes('Destination Name') && (card as HTMLElement).style.fontWeight === 'bold'
    ) as HTMLElement;

    expect(destCard).toBeTruthy();

    // Click on the selected destination card
    await user.click(destCard);

    // After clicking, verify that a source card is now selected (toggle behavior)
    await waitFor(() => {
      const updatedClickableCards = table.querySelectorAll('div[style*="cursor: pointer"]');
      const boldSourceCards = Array.from(updatedClickableCards).filter(card =>
        card.textContent?.includes('Source Name') && (card as HTMLElement).style.fontWeight === 'bold'
      );
      // At least one source card should now be bold (the one we toggled)
      expect(boldSourceCards.length).toBeGreaterThan(0);
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

      // Find all clickable cards
      const clickableCards = screen.getByRole('table').querySelectorAll('div[style*="cursor: pointer"]');
      const nameCards = Array.from(clickableCards).filter(card =>
          card.textContent?.includes('Destination Name')
      );

      const destCard = nameCards[0] as HTMLElement;

    // Selected card should have bold font weight
    expect(destCard.style.fontWeight).toBe('bold');

    // Check for checkmark icon in the Cards container (CloudScape adds this automatically)
    const cardsContainer = destCard.closest('[class*="cards"]');
    expect(cardsContainer).toBeInTheDocument();
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

    // Verify no input fields exist in the table
    const table = screen.getByRole('table');
    const inputs = table.querySelectorAll('input[type="text"], textarea');
    expect(inputs).toHaveLength(0);

    // Verify cards are clickable but not editable
      const clickableCards = table.querySelectorAll('div[style*="cursor: pointer"]');
      expect(clickableCards.length).toBeGreaterThan(0);

      // None of the cards should contain input elements
      clickableCards.forEach(card => {
          expect(card.querySelector('input')).toBeNull();
      });
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

      // Find all clickable cards
      const clickableCards = screen.getByRole('table').querySelectorAll('div[style*="cursor: pointer"]');

      // Find source cards for name and email
      const sourceNameCard = Array.from(clickableCards).find(card =>
          card.textContent?.includes('Source Name')
      ) as HTMLElement;

      const sourceEmailCard = Array.from(clickableCards).find(card =>
          card.textContent?.includes('source@example.com')
      ) as HTMLElement;

      // Click source cards for name and email fields
      await user.click(sourceNameCard);
      await user.click(sourceEmailCard);

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
