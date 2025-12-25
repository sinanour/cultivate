import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionStatus } from '../useConnectionStatus';
import { ConnectionMonitor } from '../../services/offline/connection-monitor.service';

vi.mock('../../services/offline/connection-monitor.service', () => ({
  ConnectionMonitor: {
    isOnline: vi.fn(),
    initialize: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial online status', () => {
    vi.mocked(ConnectionMonitor.isOnline).mockReturnValue(true);

    const { result } = renderHook(() => useConnectionStatus());

    expect(result.current.isOnline).toBe(true);
  });

  it('should return initial offline status', () => {
    vi.mocked(ConnectionMonitor.isOnline).mockReturnValue(false);

    const { result } = renderHook(() => useConnectionStatus());

    expect(result.current.isOnline).toBe(false);
  });

  it('should initialize ConnectionMonitor', () => {
    renderHook(() => useConnectionStatus());

    expect(ConnectionMonitor.initialize).toHaveBeenCalled();
  });

  it('should subscribe to connection changes', () => {
    renderHook(() => useConnectionStatus());

    expect(ConnectionMonitor.subscribe).toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(ConnectionMonitor.subscribe).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useConnectionStatus());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should update status when connection changes', () => {
    let connectionCallback: ((isOnline: boolean) => void) | null = null;
    
    vi.mocked(ConnectionMonitor.subscribe).mockImplementation((callback) => {
      connectionCallback = callback;
      return vi.fn();
    });
    vi.mocked(ConnectionMonitor.isOnline).mockReturnValue(true);

    const { result } = renderHook(() => useConnectionStatus());

    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    act(() => {
      connectionCallback!(false);
    });

    expect(result.current.isOnline).toBe(false);

    // Simulate going back online
    act(() => {
      connectionCallback!(true);
    });

    expect(result.current.isOnline).toBe(true);
  });
});
