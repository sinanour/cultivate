import type { ReactNode } from 'react';
import { createContext, useState, useEffect } from 'react';
import type { User, AuthTokens } from '../types';
import { AuthService } from '../services/auth/auth.service';

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load tokens and user from localStorage on mount
    const storedTokens = AuthService.getStoredTokens();
    const storedUser = AuthService.getCurrentUser();

    if (storedTokens && storedUser) {
      // Check if access token is expired
      if (AuthService.isTokenExpired(storedTokens.accessToken)) {
        // Try to refresh token
        AuthService.refreshToken()
          .then((newTokens) => {
            setTokens(newTokens);
            setUser(storedUser);
          })
          .catch(() => {
            // Refresh failed, clear everything
            AuthService.logout();
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        setTokens(storedTokens);
        setUser(storedUser);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { user: loggedInUser, tokens: authTokens } = await AuthService.login({
      email,
      password,
    });
    setUser(loggedInUser);
    setTokens(authTokens);
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    setTokens(null);
  };

  const refreshToken = async () => {
    const newTokens = await AuthService.refreshToken();
    setTokens(newTokens);
  };

  const value = {
    user,
    tokens,
    isAuthenticated: !!tokens && !!user,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  // Don't render children until we've checked for stored auth
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
