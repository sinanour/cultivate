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


it('should transition from indeterminate to determinate mode', () => {
  const onCancel = vi.fn();
  const onResume = vi.fn();

  const { rerender } = render(
    <ProgressIndicator
      loadedCount={0}
      totalCount={0}
      entityName="markers"
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={false}
    />
  );

  // Initially in indeterminate mode
  expect(screen.getByText(/Loading markers\.\.\./i)).toBeInTheDocument();
  expect(document.querySelector('progress')).toBeNull();

  // Transition to determinate mode
  rerender(
    <ProgressIndicator
      loadedCount={50}
      totalCount={200}
      entityName="markers"
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={false}
    />
  );

  // Now in determinate mode
  expect(screen.getAllByText(/Loading 50 \/ 200 markers\.\.\./)[0]).toBeInTheDocument();
  expect(document.querySelector('progress')).toBeInTheDocument();
});

it('should handle paused state in indeterminate mode', () => {
  const onCancel = vi.fn();
  const onResume = vi.fn();

  render(
    <ProgressIndicator
      loadedCount={0}
      totalCount={0}
      entityName="markers"
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={true}
    />
  );

  // Should display paused text
  expect(screen.getByText(/Loading paused/i)).toBeInTheDocument();
  // Should have resume button
  expect(screen.getByRole('button', { name: /Resume loading markers/i })).toBeInTheDocument();
  // Should NOT have Spinner when paused
  const svgs = document.querySelectorAll('svg');
  // Only button icon SVG should be present (no Spinner SVG)
  expect(svgs.length).toBe(1);
});


it('should call onCancel when pause button is clicked in indeterminate mode', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  const onResume = vi.fn();

  render(
    <ProgressIndicator
      loadedCount={0}
      totalCount={0}
      entityName="markers"
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={false}
    />
  );

  const pauseButton = screen.getByRole('button', { name: /Pause loading/i });
  await user.click(pauseButton);

  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('should call onResume when resume button is clicked in indeterminate mode', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  const onResume = vi.fn();

  render(
    <ProgressIndicator
      loadedCount={0}
      totalCount={0}
      entityName="markers"
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={true}
    />
  );

  const resumeButton = screen.getByRole('button', { name: /Resume loading markers/i });
  await user.click(resumeButton);

  expect(onResume).toHaveBeenCalledTimes(1);
});


it('should handle empty entityName gracefully', () => {
  const onCancel = vi.fn();
  const onResume = vi.fn();

  render(
    <ProgressIndicator
      loadedCount={0}
      totalCount={0}
      entityName=""
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={false}
    />
  );

  // Should still render with empty entityName
  expect(screen.getByText(/Loading \.\.\./i)).toBeInTheDocument();
});

it('should unmount when loadedCount exceeds totalCount', () => {
  const onCancel = vi.fn();
  const onResume = vi.fn();

  const { container } = render(
    <ProgressIndicator
      loadedCount={150}
      totalCount={100}
      entityName="items"
      onCancel={onCancel}
      onResume={onResume}
      isCancelled={false}
    />
  );

  // Should unmount when loadedCount >= totalCount
  expect(container.firstChild).toBeNull();
});
