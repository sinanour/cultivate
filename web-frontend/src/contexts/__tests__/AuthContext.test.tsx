import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';
import { AuthService } from '../../services/auth/auth.service';
import { useAuth } from '../../hooks/useAuth';

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
  });

  it('should provide initial unauthenticated state', async () => {
    vi.spyOn(AuthService, 'getStoredTokens').mockReturnValue(null);
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
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
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(AuthService.refreshToken).toHaveBeenCalled();
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
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });

    expect(AuthService.logout).toHaveBeenCalled();
  });
});
