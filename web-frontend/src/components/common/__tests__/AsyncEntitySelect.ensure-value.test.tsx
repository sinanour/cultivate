import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AsyncEntitySelect } from '../AsyncEntitySelect';

// Mock hooks
vi.mock('../../../hooks/useDebounce', () => ({
    useDebounce: (value: string) => value,
}));

vi.mock('../../../hooks/useGlobalGeographicFilter', () => ({
    useGlobalGeographicFilter: () => ({
        selectedGeographicAreaId: null,
    }),
}));

describe('AsyncEntitySelect - Ensure Value Functionality', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    it('should fetch selected entity by ID when not in initial results', async () => {
        const selectedEntity = { id: 'entity-selected', name: 'Selected Entity' };
        const otherEntities = [
            { id: 'entity-1', name: 'Entity 1' },
            { id: 'entity-2', name: 'Entity 2' },
        ];

        const mockFetchFunction = vi.fn().mockResolvedValue({
            data: otherEntities,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        const mockFetchByIdFunction = vi.fn().mockResolvedValue(selectedEntity);

        const mockFormatOption = (entity: any) => ({
            value: entity.id,
            label: entity.name,
        });

        render(
            <QueryClientProvider client={queryClient}>
                <AsyncEntitySelect
                    value="entity-selected"
                    onChange={vi.fn()}
                    entityType="participant"
                    fetchFunction={mockFetchFunction}
                    fetchByIdFunction={mockFetchByIdFunction}
                    formatOption={mockFormatOption}
                />
            </QueryClientProvider>
        );

        // Wait for both fetches to complete
        await waitFor(() => {
            expect(mockFetchFunction).toHaveBeenCalled();
            expect(mockFetchByIdFunction).toHaveBeenCalledWith('entity-selected');
        });

        // The selected entity should be displayed even though it wasn't in initial results
        await waitFor(() => {
            expect(screen.getByDisplayValue('Selected Entity')).toBeInTheDocument();
        });
    });

    it('should NOT fetch entity by ID when already in initial results', async () => {
        const selectedEntity = { id: 'entity-1', name: 'Entity 1' };
        const allEntities = [
            selectedEntity,
            { id: 'entity-2', name: 'Entity 2' },
        ];

        const mockFetchFunction = vi.fn().mockResolvedValue({
            data: allEntities,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        });

        const mockFetchByIdFunction = vi.fn().mockResolvedValue(selectedEntity);

        const mockFormatOption = (entity: any) => ({
            value: entity.id,
            label: entity.name,
        });

        render(
            <QueryClientProvider client={queryClient}>
                <AsyncEntitySelect
                    value="entity-1"
                    onChange={vi.fn()}
                    entityType="participant"
                    fetchFunction={mockFetchFunction}
                    fetchByIdFunction={mockFetchByIdFunction}
                    formatOption={mockFormatOption}
                />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(mockFetchFunction).toHaveBeenCalled();
        });

        // Should NOT fetch by ID since entity is already in results
        expect(mockFetchByIdFunction).not.toHaveBeenCalled();

        // The selected entity should still be displayed
        await waitFor(() => {
            expect(screen.getByDisplayValue('Entity 1')).toBeInTheDocument();
        });
    });

    it('should fetch newly selected entity when value changes', async () => {
        const entity1 = { id: 'entity-1', name: 'Entity 1' };
        const entity2 = { id: 'entity-2', name: 'Entity 2' };
        const otherEntities = [
            { id: 'entity-3', name: 'Entity 3' },
        ];

        const mockFetchFunction = vi.fn().mockResolvedValue({
            data: otherEntities,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        const mockFetchByIdFunction = vi.fn()
            .mockImplementation(async (id: string) => {
                if (id === 'entity-1') return entity1;
                if (id === 'entity-2') return entity2;
                throw new Error('Entity not found');
            });

        const mockFormatOption = (entity: any) => ({
            value: entity.id,
            label: entity.name,
        });

        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <AsyncEntitySelect
                    value="entity-1"
                    onChange={vi.fn()}
                    entityType="participant"
                    fetchFunction={mockFetchFunction}
                    fetchByIdFunction={mockFetchByIdFunction}
                    formatOption={mockFormatOption}
                />
            </QueryClientProvider>
        );

        // Wait for entity-1 to be fetched
        await waitFor(() => {
            expect(mockFetchByIdFunction).toHaveBeenCalledWith('entity-1');
        });

        // Clear mocks
        vi.clearAllMocks();

        // Simulate value change (user selected a different entity)
        rerender(
            <QueryClientProvider client={queryClient}>
                <AsyncEntitySelect
                    value="entity-2"
                    onChange={vi.fn()}
                    entityType="participant"
                    fetchFunction={mockFetchFunction}
                    fetchByIdFunction={mockFetchByIdFunction}
                    formatOption={mockFormatOption}
                />
            </QueryClientProvider>
        );

        // Wait for entity-2 to be fetched
        await waitFor(() => {
            expect(mockFetchByIdFunction).toHaveBeenCalledWith('entity-2');
        });
    });

    it('should persist selected entity when data changes', async () => {
    // This test verifies the fix: selected entities remain in options
    // even when the underlying query data changes
        const selectedEntity = { id: 'entity-selected', name: 'John Smith' };
        const otherEntities = [{ id: 'entity-other', name: 'Jane Doe' }];

        const mockFetchFunction = vi.fn().mockResolvedValue({
            data: otherEntities,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });

        const mockFetchByIdFunction = vi.fn().mockResolvedValue(selectedEntity);
        const mockFormatOption = (entity: any) => ({
            value: entity.id,
            label: entity.name,
        });

        // Render with John Smith selected, but initial data only has Jane Doe
        render(
            <QueryClientProvider client={queryClient}>
                <AsyncEntitySelect
                    value="entity-selected"
                    onChange={vi.fn()}
                    entityType="participant"
                    fetchFunction={mockFetchFunction}
                    fetchByIdFunction={mockFetchByIdFunction}
                    formatOption={mockFormatOption}
                />
            </QueryClientProvider>
        );

        // Wait for both fetches
        await waitFor(() => {
            expect(mockFetchFunction).toHaveBeenCalled();
            expect(mockFetchByIdFunction).toHaveBeenCalledWith('entity-selected');
        });

        // Selected value should be displayed
        await waitFor(() => {
            expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
        });

        // Open dropdown to verify both entities are in options
        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        // Both John Smith (ensured) and Jane Doe (from query) should be present
        await waitFor(() => {
            expect(screen.getByTitle('John Smith')).toBeInTheDocument();
            expect(screen.getByTitle('Jane Doe')).toBeInTheDocument();
        });
    });
});
