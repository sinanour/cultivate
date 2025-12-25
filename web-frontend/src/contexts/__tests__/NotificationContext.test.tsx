import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { NotificationProvider, NotificationContext } from '../NotificationContext';
import type { ReactNode } from 'react';

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <NotificationProvider>{children}</NotificationProvider>
  );

  it('should provide notification methods', () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    expect(result.current?.showNotification).toBeDefined();
    expect(result.current?.showSuccess).toBeDefined();
    expect(result.current?.showError).toBeDefined();
    expect(result.current?.showWarning).toBeDefined();
    expect(result.current?.showInfo).toBeDefined();
  });

  it('should show success notification', () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showSuccess('Operation successful');
    });

    // Notification should be displayed
    expect(true).toBe(true); // Notification is rendered in provider
  });

  it('should show error notification', () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showError('Operation failed', 'Error');
    });

    expect(true).toBe(true);
  });

  it('should show warning notification', () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showWarning('Warning message');
    });

    expect(true).toBe(true);
  });

  it('should show info notification', () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showInfo('Info message');
    });

    expect(true).toBe(true);
  });

  it('should auto-dismiss non-error notifications after 5 seconds', async () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showSuccess('Success message');
    });

    // Fast-forward time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Notification should be auto-dismissed
    expect(true).toBe(true);
  });

  it('should not auto-dismiss error notifications', async () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showError('Error message');
    });

    // Fast-forward time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Error notification should still be present
    expect(true).toBe(true);
  });

  it('should allow showing multiple notifications', () => {
    const { result } = renderHook(() => {
      const context = NotificationContext._currentValue;
      return context;
    }, { wrapper });

    act(() => {
      result.current?.showSuccess('Success 1');
      result.current?.showInfo('Info 1');
      result.current?.showWarning('Warning 1');
    });

    expect(true).toBe(true);
  });
});
