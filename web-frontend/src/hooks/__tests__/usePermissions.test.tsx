import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../usePermissions';
import * as useAuthModule from '../useAuth';

vi.mock('../useAuth');

describe('usePermissions', () => {
  it('should return true for all permissions when user is ADMINISTRATOR', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'admin@example.com', name: 'Admin', role: 'ADMINISTRATOR' },
      tokens: null,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canCreate()).toBe(true);
    expect(result.current.canEdit()).toBe(true);
    expect(result.current.canDelete()).toBe(true);
    expect(result.current.isAdministrator()).toBe(true);
    expect(result.current.isReadOnly()).toBe(false);
    expect(result.current.hasRole('ADMINISTRATOR')).toBe(true);
  });

  it('should return true for create/edit/delete when user is EDITOR', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'editor@example.com', name: 'Editor', role: 'EDITOR' },
      tokens: null,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canCreate()).toBe(true);
    expect(result.current.canEdit()).toBe(true);
    expect(result.current.canDelete()).toBe(true);
    expect(result.current.isAdministrator()).toBe(false);
    expect(result.current.isReadOnly()).toBe(false);
    expect(result.current.hasRole('EDITOR')).toBe(true);
  });

  it('should return false for create/edit/delete when user is READ_ONLY', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'reader@example.com', name: 'Reader', role: 'READ_ONLY' },
      tokens: null,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canCreate()).toBe(false);
    expect(result.current.canEdit()).toBe(false);
    expect(result.current.canDelete()).toBe(false);
    expect(result.current.isAdministrator()).toBe(false);
    expect(result.current.isReadOnly()).toBe(true);
    expect(result.current.hasRole('READ_ONLY')).toBe(true);
  });

  it('should handle null user', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      tokens: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.canCreate()).toBe(false);
    expect(result.current.canEdit()).toBe(false);
    expect(result.current.canDelete()).toBe(false);
    expect(result.current.isAdministrator()).toBe(false);
    expect(result.current.isReadOnly()).toBe(false);
  });
});
