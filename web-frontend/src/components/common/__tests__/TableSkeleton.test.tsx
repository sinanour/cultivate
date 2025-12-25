import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TableSkeleton } from '../TableSkeleton';

describe('TableSkeleton', () => {
  it('should render default number of rows and columns', () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll('[style*="display: flex"]');
    expect(rows).toHaveLength(5); // Default rows
  });

  it('should render custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll('[style*="display: flex"]');
    expect(rows).toHaveLength(3);
  });

  it('should render custom number of columns', () => {
    const { container } = render(<TableSkeleton rows={1} columns={6} />);
    const row = container.querySelector('[style*="display: flex"]');
    const columns = row?.querySelectorAll('[style*="flex: 1"]');
    expect(columns).toHaveLength(6);
  });

  it('should render skeleton with animation', () => {
    const { container } = render(<TableSkeleton />);
    const style = container.querySelector('style');
    expect(style?.textContent).toContain('@keyframes pulse');
  });
});
