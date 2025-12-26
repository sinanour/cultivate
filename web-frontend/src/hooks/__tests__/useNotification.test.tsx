import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotification } from '../useNotification';

describe('useNotification', () => {
  const originalError = console.error;
  
  beforeAll(() => {
    // Suppress console.error for error boundary tests
    // Note: React DOM will still log the error stack trace in development mode,
    // which is expected behavior when testing error conditions
    console.error = vi.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });

  it('should throw error when used outside NotificationProvider', () => {
    // This test intentionally triggers an error to verify proper error handling
    // The error stack trace in the console is expected React development mode behavior
    expect(() => {
      renderHook(() => useNotification());
    }).toThrow('useNotification must be used within a NotificationProvider');
  });
});
