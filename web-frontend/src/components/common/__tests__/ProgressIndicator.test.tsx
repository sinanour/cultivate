import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressIndicator } from '../ProgressIndicator';

describe('ProgressIndicator', () => {
  it('should render with value', () => {
    render(<ProgressIndicator value={50} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<ProgressIndicator value={75} label="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should render with description', () => {
    render(<ProgressIndicator value={25} description="Step 1 of 4" />);
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('should render with both label and description', () => {
    render(<ProgressIndicator value={60} label="Uploading" description="60% complete" />);
    expect(screen.getByText('Uploading')).toBeInTheDocument();
    expect(screen.getByText('60% complete')).toBeInTheDocument();
  });

  it('should handle 0% progress', () => {
    render(<ProgressIndicator value={0} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should handle 100% progress', () => {
    render(<ProgressIndicator value={100} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });
});
