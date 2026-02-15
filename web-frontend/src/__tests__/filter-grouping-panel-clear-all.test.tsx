import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { FilterGroupingPanel, FilterGroupingState, FilterPropertyWithLoader } from '../components/common/FilterGroupingPanel';

// Mock useMediaQuery hook
vi.mock('../hooks/useMediaQuery', () => ({
    useMediaQuery: () => false, // Desktop mode
}));

describe('FilterGroupingPanel - Clear All Immediate Application', () => {
    let mockOnUpdate: ReturnType<typeof vi.fn>;
    let mockFilterProperties: FilterPropertyWithLoader[];
    let mockOnInitialResolutionComplete: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockOnUpdate = vi.fn();
        mockOnInitialResolutionComplete = vi.fn();
        mockFilterProperties = [
            {
                key: 'activityCategory',
                propertyLabel: 'Activity Category',
                groupValuesLabel: 'Activity Categories',
                operators: ['='],
                loadItems: vi.fn().mockResolvedValue([
                    { value: 'cat1', label: 'Study Circles' },
                    { value: 'cat2', label: 'Devotional Gatherings' },
                ]),
            },
            {
                key: 'activityType',
                propertyLabel: 'Activity Type',
                groupValuesLabel: 'Activity Types',
                operators: ['='],
                loadItems: vi.fn().mockResolvedValue([
                    { value: 'type1', label: "Children's Class" },
                    { value: 'type2', label: 'Junior Youth Group' },
                ]),
            },
        ];
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof FilterGroupingPanel>> = {}) => {
        return render(
            <BrowserRouter>
                <FilterGroupingPanel
                    filterProperties={mockFilterProperties}
                    groupingMode="none"
                    onUpdate={mockOnUpdate}
                    onInitialResolutionComplete={mockOnInitialResolutionComplete}
                    {...props}
                />
            </BrowserRouter>
        );
    };

    const waitForInitialResolution = async () => {
        await waitFor(() => {
            expect(mockOnInitialResolutionComplete).toHaveBeenCalled();
        });
        // Clear mock to only track subsequent calls
        mockOnUpdate.mockClear();
    };

    describe('Clear All Button - Immediate Application', () => {
        it('should immediately invoke onUpdate callback when Clear All is clicked', async () => {
            const user = userEvent.setup();
            renderComponent();
            await waitForInitialResolution();

            // Find and click Clear All button
            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            // Verify onUpdate was called immediately
            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledTimes(1);
            });

            // Verify it was called with cleared state
            const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
            expect(calledState.dateRange).toBeNull();
            expect(calledState.filterTokens.tokens).toHaveLength(0);
            expect(calledState.grouping).toBeNull();
        });

        it('should synchronize cleared state to URL parameters when Clear All is clicked', async () => {
            const user = userEvent.setup();

            // Start with some filters in URL
            window.history.pushState({}, '', '?filter_activityCategory=cat1&filter_activityType=type1&otherParam=value');

            renderComponent();
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const currentURL = new URL(window.location.href);
                // Filter parameters should be removed
                expect(currentURL.searchParams.has('filter_activityCategory')).toBe(false);
                expect(currentURL.searchParams.has('filter_activityType')).toBe(false);
                // Other parameters should be preserved
                expect(currentURL.searchParams.get('otherParam')).toBe('value');
            });
        });

        it('should mark state as applied (isDirty = false) after Clear All', async () => {
            const user = userEvent.setup();
            renderComponent();
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                // Update button should be disabled after Clear All (no pending changes)
                const updateButton = screen.queryByRole('button', { name: /update/i });
                if (updateButton) {
                    expect(updateButton).toBeDisabled();
                }
            });
        });

        it('should NOT require separate Update click after Clear All', async () => {
            const user = userEvent.setup();
            renderComponent();
            await waitForInitialResolution();

            // Click Clear All
            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            // onUpdate should have been called once (from Clear All)
            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledTimes(1);
            });

            // No need to click Update - it should already be applied
            // If we were to click Update now, it should be disabled anyway
            const updateButton = screen.queryByRole('button', { name: /update/i });
            if (updateButton) {
                expect(updateButton).toBeDisabled();
            }
        });

        it('should clear date range when Clear All is clicked', async () => {
            const user = userEvent.setup();
            renderComponent({
                includeDateRange: true,
                initialDateRange: {
                    type: 'absolute',
                    startDate: '2025-01-01',
                    endDate: '2025-12-31',
                },
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.dateRange).toBeNull();
            });
        });

        it('should clear all filter tokens when Clear All is clicked', async () => {
            const user = userEvent.setup();
            renderComponent({
                initialFilterTokens: {
                    tokens: [
                        { propertyKey: 'activityCategory', operator: '=', value: 'cat1' },
                        { propertyKey: 'activityType', operator: '=', value: 'type1' },
                    ],
                    operation: 'and',
                },
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.filterTokens.tokens).toHaveLength(0);
            });
        });

        it('should reset grouping to default when Clear All is clicked (additive mode)', async () => {
            const user = userEvent.setup();
            renderComponent({
                groupingMode: 'additive',
                groupingDimensions: [
                    { value: 'activityType', label: 'Activity Type' },
                    { value: 'venue', label: 'Venue' },
                ],
                initialGrouping: ['activityType', 'venue'],
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.grouping).toEqual([]);
            });
        });

        it('should reset grouping to first option when Clear All is clicked (exclusive mode)', async () => {
            const user = userEvent.setup();
            const groupingDimensions = [
                { value: 'all', label: 'All' },
                { value: 'activityType', label: 'Activity Type' },
                { value: 'activityCategory', label: 'Activity Category' },
            ];

            renderComponent({
                groupingMode: 'exclusive',
                groupingDimensions,
                initialGrouping: 'activityType',
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.grouping).toBe('all');
            });
        });

        it('should preserve non-filter URL parameters when Clear All is clicked', async () => {
            const user = userEvent.setup();

            // Start with filter params and other params
            window.history.pushState(
                {},
                '',
                '?filter_activityCategory=cat1&geographicArea=area123&page=2'
            );

            renderComponent();
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const currentURL = new URL(window.location.href);
                // Filter parameters should be removed
                expect(currentURL.searchParams.has('filter_activityCategory')).toBe(false);
                // Other parameters should be preserved
                expect(currentURL.searchParams.get('geographicArea')).toBe('area123');
                expect(currentURL.searchParams.get('page')).toBe('2');
            });
        });
    });

    describe('Clear All vs Update Button Interaction', () => {
        it('should not enable Update button after Clear All (state is already applied)', async () => {
            const user = userEvent.setup();
            renderComponent({
                initialFilterTokens: {
                    tokens: [{ propertyKey: 'activityCategory', operator: '=', value: 'cat1' }],
                    operation: 'and',
                },
            });
            await waitForInitialResolution();

            // Initially, Update button should be disabled (no changes)
            const updateButton = screen.getByRole('button', { name: /update/i });
            expect(updateButton).toBeDisabled();

            // Click Clear All
            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            // After Clear All, Update button should still be disabled (state is applied)
            await waitFor(() => {
                expect(updateButton).toBeDisabled();
            });
        });
    });

    describe('URL Parameter Handling', () => {
        it('should remove all filter-prefixed parameters when Clear All is clicked', async () => {
            const user = userEvent.setup();

            window.history.pushState(
                {},
                '',
                '?filter_activityCategory=cat1&filter_activityType=type1&filter_startDate=2025-01-01&filter_endDate=2025-12-31&filter_groupBy=activityType'
            );

            renderComponent({
                includeDateRange: true,
                groupingMode: 'additive',
                groupingDimensions: [{ value: 'activityType', label: 'Activity Type' }],
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const currentURL = new URL(window.location.href);
                expect(currentURL.searchParams.has('filter_activityCategory')).toBe(false);
                expect(currentURL.searchParams.has('filter_activityType')).toBe(false);
                expect(currentURL.searchParams.has('filter_startDate')).toBe(false);
                expect(currentURL.searchParams.has('filter_endDate')).toBe(false);
                expect(currentURL.searchParams.has('filter_groupBy')).toBe(false);
            });
        });

        it('should preserve non-filter parameters when Clear All is clicked', async () => {
            const user = userEvent.setup();

            window.history.pushState(
                {},
                '',
                '?filter_activityCategory=cat1&geographicArea=area123&page=2&sort=name'
            );

            renderComponent();
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const currentURL = new URL(window.location.href);
                expect(currentURL.searchParams.get('geographicArea')).toBe('area123');
                expect(currentURL.searchParams.get('page')).toBe('2');
                expect(currentURL.searchParams.get('sort')).toBe('name');
            });
        });

        it('should handle custom URL prefix correctly', async () => {
            const user = userEvent.setup();

            window.history.pushState({}, '', '?custom_activityCategory=cat1&otherParam=value');

            renderComponent({
                urlParamPrefix: 'custom_',
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const currentURL = new URL(window.location.href);
                expect(currentURL.searchParams.has('custom_activityCategory')).toBe(false);
                expect(currentURL.searchParams.get('otherParam')).toBe('value');
            });
        });
    });

    describe('Different Grouping Modes', () => {
        it('should reset to empty array for additive grouping mode', async () => {
            const user = userEvent.setup();
            renderComponent({
                groupingMode: 'additive',
                groupingDimensions: [
                    { value: 'activityType', label: 'Activity Type' },
                    { value: 'venue', label: 'Venue' },
                ],
                initialGrouping: ['activityType'],
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(Array.isArray(calledState.grouping)).toBe(true);
                expect(calledState.grouping).toHaveLength(0);
            });
        });

        it('should reset to first option for exclusive grouping mode', async () => {
            const user = userEvent.setup();
            const groupingDimensions = [
                { value: 'all', label: 'All' },
                { value: 'activityType', label: 'Activity Type' },
            ];

            renderComponent({
                groupingMode: 'exclusive',
                groupingDimensions,
                initialGrouping: 'activityType',
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.grouping).toBe('all');
            });
        });

        it('should reset to null for no grouping mode', async () => {
            const user = userEvent.setup();
            renderComponent({
                groupingMode: 'none',
                initialFilterTokens: {
                    tokens: [{ propertyKey: 'activityCategory', operator: '=', value: 'cat1' }],
                    operation: 'and',
                },
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.grouping).toBeNull();
            });
        });
    });

    describe('Integration with hideUpdateButton prop', () => {
        it('should work correctly when Update button is hidden (dashboard pattern)', async () => {
            const user = userEvent.setup();
            renderComponent({
                hideUpdateButton: true,
                initialFilterTokens: {
                    tokens: [{ propertyKey: 'activityCategory', operator: '=', value: 'cat1' }],
                    operation: 'and',
                },
            });
            await waitForInitialResolution();

            // Update button should not be rendered
            expect(screen.queryByRole('button', { name: /update/i })).not.toBeInTheDocument();

            // Clear All should still be visible and functional
            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            expect(clearAllButton).toBeInTheDocument();

            await user.click(clearAllButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledTimes(1);
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.filterTokens.tokens).toHaveLength(0);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle Clear All when already in cleared state', async () => {
            const user = userEvent.setup();
            renderComponent(); // No initial filters
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledTimes(1);
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.dateRange).toBeNull();
                expect(calledState.filterTokens.tokens).toHaveLength(0);
            });
        });

        it('should handle multiple rapid Clear All clicks', async () => {
            const user = userEvent.setup();
            renderComponent({
                initialFilterTokens: {
                    tokens: [{ propertyKey: 'activityCategory', operator: '=', value: 'cat1' }],
                    operation: 'and',
                },
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });

            // Click multiple times rapidly
            await user.click(clearAllButton);
            await user.click(clearAllButton);
            await user.click(clearAllButton);

            // Should have been called 3 times (once per click)
            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledTimes(3);
            });
        });
    });

    describe('Comprehensive Clear All Tests', () => {
        it('should clear all filter types simultaneously', async () => {
            const user = userEvent.setup();
            renderComponent({
                includeDateRange: true,
                groupingMode: 'additive',
                groupingDimensions: [
                    { value: 'activityType', label: 'Activity Type' },
                    { value: 'venue', label: 'Venue' },
                ],
                initialDateRange: {
                    type: 'absolute',
                    startDate: '2025-01-01',
                    endDate: '2025-12-31',
                },
                initialFilterTokens: {
                    tokens: [
                        { propertyKey: 'activityCategory', operator: '=', value: 'cat1' },
                        { propertyKey: 'activityType', operator: '=', value: 'type1' },
                    ],
                    operation: 'and',
                },
                initialGrouping: ['activityType', 'venue'],
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledTimes(1);
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;

                // All should be cleared
                expect(calledState.dateRange).toBeNull();
                expect(calledState.filterTokens.tokens).toHaveLength(0);
                expect(calledState.grouping).toEqual([]);
            });
        });

        it('should handle relative date range clearing', async () => {
            const user = userEvent.setup();
            renderComponent({
                includeDateRange: true,
                initialDateRange: {
                    type: 'relative',
                    amount: 90,
                    unit: 'day',
                },
            });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });
            await user.click(clearAllButton);

            await waitFor(() => {
                const calledState = mockOnUpdate.mock.calls[0][0] as FilterGroupingState;
                expect(calledState.dateRange).toBeNull();
            });
        });

        it('should handle Clear All when component is in loading state', async () => {
            const user = userEvent.setup();
            renderComponent({ isLoading: true });
            await waitForInitialResolution();

            const clearAllButton = screen.getByRole('button', { name: /clear all/i });

            // Clear All button should be disabled when loading
            expect(clearAllButton).toBeDisabled();
        });
    });
});
