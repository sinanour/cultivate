import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveButton } from '../ResponsiveButton';
import * as useMediaQueryModule from '../../../hooks/useMediaQuery';

// Mock the useMediaQuery hook
vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

describe('ResponsiveButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop/Tablet viewport', () => {
    beforeEach(() => {
      vi.mocked(useMediaQueryModule.useMediaQuery).mockReturnValue(false);
    });

    it('should render text button on desktop', () => {
      render(
        <ResponsiveButton onClick={() => {}}>
          Create Participant
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /create participant/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Create Participant');
    });

    it('should preserve button variant on desktop', () => {
      const { rerender } = render(
        <ResponsiveButton variant="primary" onClick={() => {}}>
          Update
        </ResponsiveButton>
      );

      let button = screen.getByRole('button', { name: /update/i });
      expect(button).toBeInTheDocument();

      rerender(
        <ResponsiveButton variant="link" onClick={() => {}}>
          Cancel
        </ResponsiveButton>
      );

      button = screen.getByRole('button', { name: /cancel/i });
      expect(button).toBeInTheDocument();
    });

    it('should render with iconName prop on desktop', () => {
      render(
        <ResponsiveButton iconName="upload" onClick={() => {}}>
          Import CSV
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /import csv/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Import CSV');
    });

    it('should not use mobileIcon on desktop', () => {
      render(
        <ResponsiveButton mobileIcon="add-plus" onClick={() => {}}>
          Create
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /create/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Create');
    });
  });

  describe('Mobile viewport', () => {
    beforeEach(() => {
      vi.mocked(useMediaQueryModule.useMediaQuery).mockReturnValue(true);
    });

    it('should render icon-only button on mobile with explicit mobileIcon', () => {
      render(
        <ResponsiveButton 
          mobileIcon="add-plus" 
          mobileAriaLabel="Create new participant"
          onClick={() => {}}
        >
          Create Participant
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /create new participant/i });
      expect(button).toBeInTheDocument();
      // Text should not be visible (icon-only)
      expect(button).not.toHaveTextContent('Create Participant');
    });

    it('should auto-detect icon from button text on mobile', () => {
      render(
        <ResponsiveButton onClick={() => {}}>
          Create Participant
        </ResponsiveButton>
      );

      // Should auto-detect and use aria-label from button text
      const button = screen.getByRole('button', { name: /create participant/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveTextContent('Create Participant');
    });

    it('should use mobileAriaLabel when provided', () => {
      render(
        <ResponsiveButton 
          mobileIcon="filter"
          mobileAriaLabel="Update filters"
          onClick={() => {}}
        >
          Update
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /update filters/i });
      expect(button).toBeInTheDocument();
    });

    it('should fallback to button text for aria-label when mobileAriaLabel not provided', () => {
      render(
        <ResponsiveButton mobileIcon="undo" onClick={() => {}}>
          Clear All
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /clear all/i });
      expect(button).toBeInTheDocument();
    });

    it('should preserve button variant on mobile', () => {
      const { rerender } = render(
        <ResponsiveButton 
          variant="primary" 
          mobileIcon="filter"
          onClick={() => {}}
        >
          Update
        </ResponsiveButton>
      );

      let button = screen.getByRole('button', { name: /update/i });
      expect(button).toBeInTheDocument();

      rerender(
        <ResponsiveButton 
          variant="link"
          mobileIcon="arrow-left"
          onClick={() => {}}
        >
          Back
        </ResponsiveButton>
      );

      button = screen.getByRole('button', { name: /back/i });
      expect(button).toBeInTheDocument();
    });

    it('should handle disabled state on mobile', () => {
      render(
        <ResponsiveButton 
          mobileIcon="filter"
          disabled
          onClick={() => {}}
        >
          Update
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /update/i });
      expect(button).toBeDisabled();
    });

    it('should handle loading state on mobile', () => {
      render(
        <ResponsiveButton 
          mobileIcon="filter"
          loading
          onClick={() => {}}
        >
          Update
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /update/i });
      expect(button).toBeInTheDocument();
    });

    it('should render text button when no icon mapping exists', () => {
      render(
        <ResponsiveButton onClick={() => {}}>
          Unknown Action
        </ResponsiveButton>
      );

      // Should fall back to text button since no icon mapping exists
      const button = screen.getByRole('button', { name: /unknown action/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Unknown Action');
    });

    it('should handle all common button types with auto-detection', () => {
      const buttonTypes = [
        { text: 'Create', expectedIcon: 'add-plus' },
        { text: 'Update', expectedIcon: 'filter' },
        { text: 'Clear All', expectedIcon: 'undo' },
        { text: 'Import CSV', expectedIcon: 'upload' },
        { text: 'Export CSV', expectedIcon: 'download' },
        { text: 'Mark Complete', expectedIcon: 'status-positive' },
        { text: 'Cancel Activity', expectedIcon: 'status-negative' },
        { text: 'Back to Activities', expectedIcon: 'arrow-left' },
        { text: 'Run Report', expectedIcon: 'redo' },
      ];

      buttonTypes.forEach(({ text }) => {
        const { unmount } = render(
          <ResponsiveButton onClick={() => {}}>
            {text}
          </ResponsiveButton>
        );

        const button = screen.getByRole('button', { name: new RegExp(text, 'i') });
        expect(button).toBeInTheDocument();
        expect(button).not.toHaveTextContent(text);

        unmount();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(useMediaQueryModule.useMediaQuery).mockReturnValue(true);
    });

    it('should have accessible name from mobileAriaLabel', () => {
      render(
        <ResponsiveButton 
          mobileIcon="add-plus"
          mobileAriaLabel="Create new participant"
          onClick={() => {}}
        >
          Create
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /create new participant/i });
      expect(button).toHaveAccessibleName('Create new participant');
    });

    it('should have accessible name from button text when mobileAriaLabel not provided', () => {
      render(
        <ResponsiveButton mobileIcon="filter" onClick={() => {}}>
          Update Filters
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /update filters/i });
      expect(button).toHaveAccessibleName('Update Filters');
    });

    it('should maintain accessibility for non-string children', () => {
      render(
        <ResponsiveButton 
          mobileIcon="add-plus"
          mobileAriaLabel="Create item"
          onClick={() => {}}
        >
          <span>Create</span>
        </ResponsiveButton>
      );

      const button = screen.getByRole('button', { name: /create item/i });
      expect(button).toHaveAccessibleName('Create item');
    });
  });
});
