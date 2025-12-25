import { createContext, ReactNode, useState, useEffect } from 'react';
import { User, AuthTokens } from '../types';

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
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

  useEffect(() => {
    // Load tokens from localStorage on mount
    const storedTokens = localStorage.getItem('authTokens');
    if (storedTokens) {
      try {
        const parsed = JSON.parse(storedTokens);
        setTokens(parsed);
        // TODO: Decode token to get user info
      } catch (error) {
        console.error('Failed to parse stored tokens:', error);
        localStorage.removeItem('authTokens');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    // TODO: Implement actual login logic
    console.log('Login:', email, password);
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem('authTokens');
  };

  const refreshToken = async () => {
    // TODO: Implement token refresh logic
    console.log('Refresh token');
  };

  const value = {
    user,
    tokens,
    isAuthenticated: !!tokens,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
