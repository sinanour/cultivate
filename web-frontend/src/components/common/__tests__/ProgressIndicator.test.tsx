import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressIndicator } from '../ProgressIndicator';

describe('ProgressIndicator', () => {
  it('should display progress bar with pause button when actively loading', () => {
    const onCancel = vi.fn();
    const onResume = vi.fn();

    render(
      <ProgressIndicator
        loadedCount={50}
        totalCount={100}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={false}
      />
    );

    // Check for label with count (appears twice - once visible, once for screen readers)
    expect(screen.getAllByText(/Loading 50 \/ 100 participants\.\.\./)[0]).toBeInTheDocument();
    // Check for pause button
    expect(screen.getByRole('button', { name: /Pause loading/i })).toBeInTheDocument();
    // Check that progress bar is rendered (by checking for the progress element)
    const progressElement = document.querySelector('progress');
    expect(progressElement).toBeInTheDocument();
    expect(progressElement?.getAttribute('value')).toBe('50');
  });

  it('should call onCancel when pause button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onResume = vi.fn();

    render(
      <ProgressIndicator
        loadedCount={50}
        totalCount={100}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={false}
      />
    );

    const pauseButton = screen.getByRole('button', { name: /Pause loading/i });
    await user.click(pauseButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should display play button when paused with partial results', () => {
    const onCancel = vi.fn();
    const onResume = vi.fn();

    render(
      <ProgressIndicator
        loadedCount={50}
        totalCount={100}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={true}
      />
    );

    expect(screen.getByRole('button', { name: /Resume loading participants/i })).toBeInTheDocument();
    // Progress bar should still be visible when paused, but with "Loaded" label
    expect(screen.getAllByText(/Loaded 50 \/ 100 participants\./)[0]).toBeInTheDocument();
    const progressElement = document.querySelector('progress');
    expect(progressElement).toBeInTheDocument();
  });

  it('should call onResume when play button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onResume = vi.fn();

    render(
      <ProgressIndicator
        loadedCount={50}
        totalCount={100}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={true}
      />
    );

    const playButton = screen.getByRole('button', { name: /Resume loading participants/i });
    await user.click(playButton);

    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('should return null when loading is complete', () => {
    const onCancel = vi.fn();
    const onResume = vi.fn();

    const { container } = render(
      <ProgressIndicator
        loadedCount={100}
        totalCount={100}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should return null when totalCount is 0', () => {
    const onCancel = vi.fn();
    const onResume = vi.fn();

    const { container } = render(
      <ProgressIndicator
        loadedCount={0}
        totalCount={0}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not display play button when all items are loaded', () => {
    const onCancel = vi.fn();
    const onResume = vi.fn();

    const { container } = render(
      <ProgressIndicator
        loadedCount={100}
        totalCount={100}
        entityName="participants"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={true}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should calculate correct progress percentage', () => {
    const onCancel = vi.fn();
    const onResume = vi.fn();

    render(
      <ProgressIndicator
        loadedCount={25}
        totalCount={100}
        entityName="activities"
        onCancel={onCancel}
        onResume={onResume}
        isCancelled={false}
      />
    );

    // ProgressBar should show 25% progress with count in label
    expect(screen.getAllByText(/Loading 25 \/ 100 activities\.\.\./)[0]).toBeInTheDocument();
    const progressElement = document.querySelector('progress');
    expect(progressElement).toBeInTheDocument();
    expect(progressElement?.getAttribute('value')).toBe('25');
    expect(progressElement?.getAttribute('max')).toBe('100');
  });
});
