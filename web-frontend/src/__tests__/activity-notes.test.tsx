import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityDetail } from '../components/features/ActivityDetail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

// Mock the hooks and services
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { role: 'ADMINISTRATOR' } }),
}));

vi.mock('../hooks/usePermissions', () => ({
    usePermissions: () => ({ canEdit: () => true }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: () => ({ id: 'test-activity-id' }),
        useNavigate: () => vi.fn(),
    };
});

vi.mock('../services/api/activity.service', () => ({
    ActivityService: {
        getActivity: vi.fn().mockResolvedValue({
            id: 'test-activity-id',
            name: 'Test Activity',
            activityTypeId: 'type-id',
            activityType: { name: 'Test Type' },
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T00:00:00Z',
            status: 'ACTIVE',
            isOngoing: false,
            notes: 'These are test notes for the activity.',
            version: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        }),
        getActivityParticipants: vi.fn().mockResolvedValue([]),
        getActivityVenues: vi.fn().mockResolvedValue([]),
    },
}));

describe('Activity Notes Field', () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    const renderWithProviders = (component: React.ReactElement) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <AuthProvider>
                        {component}
                    </AuthProvider>
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('should display notes when activity has notes', async () => {
        renderWithProviders(<ActivityDetail />);

        // Wait for the notes to appear
        const notesHeader = await screen.findByText('Notes');
        expect(notesHeader).toBeInTheDocument();

        const notesContent = await screen.findByText('These are test notes for the activity.');
        expect(notesContent).toBeInTheDocument();
    });

    it('should preserve line breaks in notes display', async () => {
        const { ActivityService } = await import('../services/api/activity.service');
        (ActivityService.getActivity as any).mockResolvedValueOnce({
            id: 'test-activity-id',
            name: 'Test Activity',
            activityTypeId: 'type-id',
            activityType: { name: 'Test Type' },
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T00:00:00Z',
            status: 'ACTIVE',
            isOngoing: false,
            notes: 'Line 1\nLine 2\nLine 3',
            version: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        });

        renderWithProviders(<ActivityDetail />);

        const notesContent = await screen.findByText(/Line 1.*Line 2.*Line 3/s);
        expect(notesContent).toBeInTheDocument();

        // Check that the div has pre-wrap style
        const notesDiv = notesContent.closest('div');
        expect(notesDiv).toHaveStyle({ whiteSpace: 'pre-wrap' });
    });
});
