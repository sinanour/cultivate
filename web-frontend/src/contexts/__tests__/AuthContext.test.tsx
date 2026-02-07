import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../AuthContext';
import { AuthService } from '../../services/auth/auth.service';
import { useAuth } from '../../hooks/useAuth';
import { queryClient } from '../../queryClient';

vi.mock('../../services/auth/auth.service');

function TestComponent() {
  const { user, isAuthenticated } = useAuth();
  return (
    <div>
      <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="user">{user?.name || 'null'}</div>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Clear the shared queryClient before each test
    queryClient.clear();
  });

  it('should provide initial unauthenticated state', async () => {
    vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue(null);
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(null);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('should load stored auth on mount', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'EDITOR' as const,
    };
    const mockTokens = {
      accessToken: 'stored-access-token',
      refreshToken: 'stored-refresh-token',
    };

    vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue(mockTokens);
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(mockUser);
    vi.spyOn(AuthService, 'isTokenExpired').mockReturnValue(false);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('Test User');
  });

  it('should refresh expired token on mount', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'EDITOR' as const,
      displayName: 'Test User',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    const oldTokens = {
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
    };
    const newTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue(oldTokens);
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(mockUser);
    vi.spyOn(AuthService, 'isTokenExpired').mockReturnValue(true);
    vi.spyOn(AuthService, 'refreshToken').mockResolvedValue(newTokens);
    vi.spyOn(AuthService, 'fetchCurrentUser').mockResolvedValue(mockUser);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(AuthService.refreshToken).toHaveBeenCalled();
    expect(AuthService.fetchCurrentUser).toHaveBeenCalled();
  });

  it('should logout on failed token refresh', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'EDITOR' as const,
    };
    const oldTokens = {
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
    };

    vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue(oldTokens);
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(mockUser);
    vi.spyOn(AuthService, 'isTokenExpired').mockReturnValue(true);
    vi.spyOn(AuthService, 'refreshToken').mockRejectedValue(new Error('Refresh failed'));
    vi.spyOn(AuthService, 'logout').mockImplementation(() => {});

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });

    expect(AuthService.logout).toHaveBeenCalled();
  });

  describe('logout', () => {
    it('should clear all authentication state and React Query cache', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'EDITOR' as const,
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue(mockTokens);
      vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(mockUser);
      vi.spyOn(AuthService, 'isTokenExpired').mockReturnValue(false);
      vi.spyOn(AuthService, 'logout').mockImplementation(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Mock window.location.href to prevent actual navigation in tests
      delete (window as any).location;
      (window as any).location = { href: '' };

      // Add some data to React Query cache
      queryClient.setQueryData(['user-profile'], mockUser);
      queryClient.setQueryData(['participants'], [{ id: '1', name: 'Participant 1' }]);
      
      expect(queryClient.getQueryData(['user-profile'])).toBeDefined();
      expect(queryClient.getQueryData(['participants'])).toBeDefined();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Perform logout
      act(() => {
        result.current.logout();
      });

      // Verify AuthService.logout was called
      expect(AuthService.logout).toHaveBeenCalled();

      // Verify hard navigation occurred
      expect(window.location.href).toBe('/login');

      // Verify React Query cache is cleared
      expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
      expect(queryClient.getQueryData(['participants'])).toBeUndefined();
    });

    it('should clear localStorage items on logout', async () => {
      // Set up localStorage with various items
      localStorage.setItem('authTokens', JSON.stringify({ accessToken: 'token' }));
      localStorage.setItem('authUser', JSON.stringify({ id: '1' }));
      localStorage.setItem('globalGeographicAreaFilter', 'area-123');
      localStorage.setItem('someOtherKey', 'should-remain');

      vi.spyOn(AuthService, 'logout').mockImplementation(() => {
        // Simulate the actual logout implementation
        localStorage.removeItem('authTokens');
        localStorage.removeItem('authUser');
        sessionStorage.clear();
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('user') || key.includes('auth') || key === 'globalGeographicAreaFilter')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      });

      // Mock window.location.href
      delete (window as any).location;
      (window as any).location = { href: '' };

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.logout();
      });

      // Verify auth-related items are cleared
      expect(localStorage.getItem('authTokens')).toBeNull();
      expect(localStorage.getItem('authUser')).toBeNull();
      expect(localStorage.getItem('globalGeographicAreaFilter')).toBeNull();
      
      // Verify non-auth items remain
      expect(localStorage.getItem('someOtherKey')).toBe('should-remain');
    });
  });
});
