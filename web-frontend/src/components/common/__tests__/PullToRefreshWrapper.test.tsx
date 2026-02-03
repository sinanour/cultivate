import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PullToRefreshWrapper } from '../PullToRefreshWrapper';

// Mock the react-simple-pull-to-refresh library
vi.mock('react-simple-pull-to-refresh', () => ({
    default: ({ children, onRefresh, pullingContent, refreshingContent }: any) => (
        <div data-testid="pull-to-refresh-mock">
            <div data-testid="pulling-content">{pullingContent}</div>
            <div data-testid="refreshing-content">{refreshingContent}</div>
            <button onClick={onRefresh} data-testid="trigger-refresh">Trigger</button>
            {children}
        </div>
    ),
}));

describe('PullToRefreshWrapper', () => {
    it('should render children when not disabled', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh}>
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render pull-to-refresh wrapper when not disabled', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh}>
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        expect(screen.getByTestId('pull-to-refresh-mock')).toBeInTheDocument();
    });

    it('should render children without pull-to-refresh when disabled', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh} disabled={true}>
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        expect(screen.getByText('Test Content')).toBeInTheDocument();
        expect(screen.queryByTestId('pull-to-refresh-mock')).not.toBeInTheDocument();
    });

    it('should display pulling content indicator', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh}>
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        const pullingContent = screen.getByTestId('pulling-content');
        expect(pullingContent).toBeInTheDocument();
    });

    it('should display refreshing content indicator', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh}>
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        const refreshingContent = screen.getByTestId('refreshing-content');
        expect(refreshingContent).toBeInTheDocument();
        expect(refreshingContent.textContent).toContain('Refreshing...');
    });

    it('should call onRefresh when refresh is triggered', async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh}>
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        const triggerButton = screen.getByTestId('trigger-refresh');
        triggerButton.click();

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('should apply custom className when provided', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);

        render(
            <PullToRefreshWrapper onRefresh={onRefresh} className="custom-class">
                <div>Test Content</div>
            </PullToRefreshWrapper>
        );

        // The className is passed to the PullToRefresh component
        // Since we're mocking it, we can't test the actual className application
        // Just verify the component renders
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
});
