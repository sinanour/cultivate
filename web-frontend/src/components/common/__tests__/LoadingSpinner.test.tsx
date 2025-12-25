import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default text', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render with custom text', () => {
    render(<LoadingSpinner text="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('should not render text when text is empty', () => {
    render(<LoadingSpinner text="" />);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should render spinner with different sizes', () => {
    const { container, rerender } = render(<LoadingSpinner size="normal" />);
    expect(container.querySelector('.awsui_root_1612d_1pcpw_183')).toBeInTheDocument();

    rerender(<LoadingSpinner size="big" />);
    expect(container.querySelector('.awsui_root_1612d_1pcpw_183')).toBeInTheDocument();

    rerender(<LoadingSpinner size="large" />);
    expect(container.querySelector('.awsui_root_1612d_1pcpw_183')).toBeInTheDocument();
  });
});
