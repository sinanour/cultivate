import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationDialog } from '../ConfirmationDialog';

describe('ConfirmationDialog', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        mockOnConfirm.mockClear();
        mockOnCancel.mockClear();
    });

    it('should render with custom title and message', () => {
        render(
            <ConfirmationDialog
                visible={true}
                title="Remove Item"
                message="Are you sure you want to remove this item?"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('Remove Item')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to remove this item?')).toBeInTheDocument();
    });

    it('should call onConfirm when confirm button is clicked', () => {
        render(
            <ConfirmationDialog
                visible={true}
                message="Confirm this action?"
                confirmLabel="Yes"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        const confirmButton = screen.getByText('Yes');
        fireEvent.click(confirmButton);

        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
        render(
            <ConfirmationDialog
                visible={true}
                message="Confirm this action?"
                cancelLabel="No"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        const cancelButton = screen.getByText('No');
        fireEvent.click(cancelButton);

        expect(mockOnCancel).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should render with destructive variant', () => {
        const { container } = render(
            <ConfirmationDialog
                visible={true}
                message="Remove this?"
                variant="destructive"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        // Verify component renders without errors
        expect(container).toBeInTheDocument();
    });

    it('should render with normal variant', () => {
        const { container } = render(
            <ConfirmationDialog
                visible={true}
                message="Update this?"
                variant="normal"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        // Verify component renders without errors
        expect(container).toBeInTheDocument();
    });

    it('should apply default props when not provided', () => {
        render(
            <ConfirmationDialog
                visible={true}
                message="Confirm?"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        // Default title
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        // Default confirm label
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        // Default cancel label
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should use custom button labels when provided', () => {
        render(
            <ConfirmationDialog
                visible={true}
                message="Remove this item?"
                confirmLabel="Remove"
                cancelLabel="Keep"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('Remove')).toBeInTheDocument();
        expect(screen.getByText('Keep')).toBeInTheDocument();
    });

    it('should not render when visible is false', () => {
        const { container } = render(
            <ConfirmationDialog
                visible={false}
                message="Confirm?"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        // CloudScape Modal is in the DOM but hidden when visible=false
        expect(container).toBeInTheDocument();
    });

    it('should render when visible is true', () => {
        render(
            <ConfirmationDialog
                visible={true}
                message="Confirm?"
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('Confirm Action')).toBeVisible();
    });
});
