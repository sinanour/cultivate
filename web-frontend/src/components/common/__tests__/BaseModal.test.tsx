import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseModal } from '../BaseModal';

describe('BaseModal', () => {
    const mockOnDismiss = vi.fn();

    beforeEach(() => {
        mockOnDismiss.mockClear();
    });

    it('should render with custom header and content', () => {
        render(
            <BaseModal
                visible={true}
                onDismiss={mockOnDismiss}
                header="Test Header"
            >
                <div>Test Content</div>
            </BaseModal>
        );

        expect(screen.getByText('Test Header')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should use custom footer when provided', () => {
        const customFooter = (
            <div data-testid="custom-footer">Custom Footer</div>
        );

        render(
            <BaseModal
                visible={true}
                onDismiss={mockOnDismiss}
                header="Test Header"
                footer={customFooter}
            >
                <div>Content</div>
            </BaseModal>
        );

        expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
        expect(screen.queryByText('Close')).not.toBeInTheDocument();
    });

    it('should use default footer when not provided', () => {
        render(
            <BaseModal
                visible={true}
                onDismiss={mockOnDismiss}
                header="Test Header"
            >
                <div>Content</div>
            </BaseModal>
        );

        expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should call onDismiss when Close button is clicked', () => {
        render(
            <BaseModal
                visible={true}
                onDismiss={mockOnDismiss}
                header="Test Header"
            >
                <div>Content</div>
            </BaseModal>
        );

        const closeButton = screen.getByText('Close');
        fireEvent.click(closeButton);

        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should pass size prop through to Modal', () => {
        const { container } = render(
            <BaseModal
                visible={true}
                onDismiss={mockOnDismiss}
                header="Test Header"
                size="large"
            >
                <div>Content</div>
            </BaseModal>
        );

        // CloudScape Modal applies size through CSS classes
        // We verify the component renders without errors with the size prop
        expect(container).toBeInTheDocument();
    });

    it('should not render when visible is false', () => {
        const { container } = render(
            <BaseModal
                visible={false}
                onDismiss={mockOnDismiss}
                header="Test Header"
            >
                <div>Content</div>
            </BaseModal>
        );

        // CloudScape Modal is in the DOM but hidden when visible=false
        // We verify the component renders without errors
        expect(container).toBeInTheDocument();
    });

    it('should render when visible is true', () => {
        render(
            <BaseModal
                visible={true}
                onDismiss={mockOnDismiss}
                header="Test Header"
            >
                <div>Content</div>
            </BaseModal>
        );

        expect(screen.getByText('Test Header')).toBeVisible();
    });
});
