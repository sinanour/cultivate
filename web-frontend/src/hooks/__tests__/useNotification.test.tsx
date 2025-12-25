import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotification } from '../useNotification';

describe('useNotification', () => {
  it('should throw error when used outside NotificationProvider', () => {
    expect(() => {
      renderHook(() => useNotification());
    }).toThrow('useNotification must be used within a NotificationProvider');
  });
});
