import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressIndicator } from '../../common/ProgressIndicator';

describe('Batched Loading with Resume', () => {
  describe('ProgressIndicator pause/resume functionality', () => {
    it('should display pause button when actively loading', () => {
      const onCancel = vi.fn();
      const onResume = vi.fn();

      render(
        <ProgressIndicator
          loadedCount={100}
          totalCount={250}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={false}
        />
      );

      // Should show pause button when loading
      expect(screen.getByRole('button', { name: /Pause loading/i })).toBeInTheDocument();
      
      // Should show loading progress
      expect(screen.getByText(/Loading 100 \/ 250 participants\.\.\./)).toBeInTheDocument();
      
      // Should not show resume button
      expect(screen.queryByRole('button', { name: /Resume loading participants/i })).not.toBeInTheDocument();
    });

    it('should display resume button when paused', () => {
      const onCancel = vi.fn();
      const onResume = vi.fn();

      render(
        <ProgressIndicator
          loadedCount={100}
          totalCount={250}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={true}
        />
      );

      // Should show resume button when paused
      expect(screen.getByRole('button', { name: /Resume loading participants/i })).toBeInTheDocument();
      
      // Should show loaded progress (not "Loading...")
      expect(screen.getByText(/Loaded 100 \/ 250 participants\./)).toBeInTheDocument();
      
      // Should not show pause button
      expect(screen.queryByRole('button', { name: /Pause loading/i })).not.toBeInTheDocument();
    });

    it('should call onCancel when pause button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      const onResume = vi.fn();

      render(
        <ProgressIndicator
          loadedCount={100}
          totalCount={250}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={false}
        />
      );

      const pauseButton = screen.getByRole('button', { name: /Pause loading/i });
      await user.click(pauseButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onResume).not.toHaveBeenCalled();
    });

    it('should call onResume when resume button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      const onResume = vi.fn();

      render(
        <ProgressIndicator
          loadedCount={100}
          totalCount={250}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={true}
        />
      );

      const resumeButton = screen.getByRole('button', { name: /Resume loading participants/i });
      await user.click(resumeButton);

      expect(onResume).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should hide component when all items are loaded', () => {
      const onCancel = vi.fn();
      const onResume = vi.fn();

      const { container } = render(
        <ProgressIndicator
          loadedCount={150}
          totalCount={150}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={false}
        />
      );

      // Component should return null and not render anything
      expect(container.firstChild).toBeNull();
      
      // Should not show any buttons
      expect(screen.queryByRole('button', { name: /Pause loading/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Resume loading participants/i })).not.toBeInTheDocument();
    });

    it('should hide component when paused and all items are loaded', () => {
      const onCancel = vi.fn();
      const onResume = vi.fn();

      const { container } = render(
        <ProgressIndicator
          loadedCount={150}
          totalCount={150}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={true}
        />
      );

      // Component should return null even when paused if loading is complete
      expect(container.firstChild).toBeNull();
    });

    it('should calculate progress percentage correctly', () => {
      const onCancel = vi.fn();
      const onResume = vi.fn();

      render(
        <ProgressIndicator
          loadedCount={100}
          totalCount={200}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={false}
        />
      );

      // Progress bar should exist and show the correct text
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/Loading 100 \/ 200 participants\.\.\./)).toBeInTheDocument();
    });

    it('should render in indeterminate mode when totalCount is 0', () => {
      const onCancel = vi.fn();
      const onResume = vi.fn();

      render(
        <ProgressIndicator
          loadedCount={0}
          totalCount={0}
          entityName="participants"
          onCancel={onCancel}
          onResume={onResume}
          isCancelled={false}
        />
      );

      // Should display loading text in indeterminate mode
      expect(screen.getByText(/Loading participants\.\.\./i)).toBeInTheDocument();
      // Should have pause button
      expect(screen.getByRole('button', { name: /Pause loading/i })).toBeInTheDocument();
      // Should have Spinner (rendered as SVG)
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Should NOT have progress element
      const progressElement = document.querySelector('progress');
      expect(progressElement).toBeNull();
    });
  });
});

