import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedLoading } from '../useDebouncedLoading';

describe('useDebouncedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false initially when not loading', () => {
    const { result } = renderHook(() => useDebouncedLoading(false));
    expect(result.current).toBe(false);
  });

  it('should not show loading immediately when loading starts', () => {
    const { result } = renderHook(() => useDebouncedLoading(true));
    expect(result.current).toBe(false);
  });

  it('should show loading after default delay of 500ms', () => {
    const { result } = renderHook(() => useDebouncedLoading(true));
    
    expect(result.current).toBe(false);
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(result.current).toBe(true);
  });

  it('should show loading after custom delay', () => {
    const { result } = renderHook(() => useDebouncedLoading(true, 1000));
    
    expect(result.current).toBe(false);
    
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(false);
    
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('should immediately hide loading when loading completes', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useDebouncedLoading(isLoading),
      { initialProps: { isLoading: true } }
    );
    
    // Advance past delay to show loading
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
    
    // Loading completes
    rerender({ isLoading: false });
    expect(result.current).toBe(false);
  });

  it('should cancel timer if loading completes before delay', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useDebouncedLoading(isLoading),
      { initialProps: { isLoading: true } }
    );
    
    expect(result.current).toBe(false);
    
    // Loading completes before delay
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ isLoading: false });
    
    // Should never show loading
    expect(result.current).toBe(false);
    
    // Advance past original delay
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(false);
  });

  it('should handle rapid loading state changes', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useDebouncedLoading(isLoading),
      { initialProps: { isLoading: true } }
    );
    
    // Start loading
    expect(result.current).toBe(false);
    
    // Stop loading before delay
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ isLoading: false });
    expect(result.current).toBe(false);
    
    // Start loading again
    rerender({ isLoading: true });
    expect(result.current).toBe(false);
    
    // Complete delay for second loading
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });
});
