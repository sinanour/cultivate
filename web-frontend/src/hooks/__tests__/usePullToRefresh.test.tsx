import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePullToRefresh } from '../usePullToRefresh';

describe('usePullToRefresh', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  function Wrapper({ children }: any) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('should initialize with isRefreshing false and no error', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), { wrapper: Wrapper });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should call onRefresh callback when triggerRefresh is called', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), { wrapper: Wrapper });

    await result.current.triggerRefresh();

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should invalidate specific query keys when provided', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => usePullToRefresh({ onRefresh, queryKeys: [['participants'], ['activities']] }),
      { wrapper: Wrapper }
    );

    await result.current.triggerRefresh();

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle errors during refresh', async () => {
    const error = new Error('Refresh failed');
    const onRefresh = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), { wrapper: Wrapper });

    await result.current.triggerRefresh();

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
      expect(result.current.isRefreshing).toBe(false);
    });
  });
});
