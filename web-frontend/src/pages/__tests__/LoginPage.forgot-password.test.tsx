import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { AuthContext } from '../../contexts/AuthContext';
import type { User } from '../../types';

// Mock the IconAnimation component
vi.mock('../../components/common/IconAnimation', () => ({
  default: () => <div>Icon Animation</div>,
}));

// Mock AuthService
vi.mock('../../services/auth/auth.service', () => ({
  AuthService: {
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

const mockAuthContext = {
  user: null as User | null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
};

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContext}>
        <LoginPage />
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('LoginPage - Forgot Password Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.user = null;
  });

  it('should render forgot password link on login page', () => {
    renderLoginPage();

    const forgotPasswordLink = screen.getByText('Forgot Password?');
    expect(forgotPasswordLink).toBeDefined();
  });

  it('should have forgot password link disabled by default when email is empty', () => {
    renderLoginPage();

    const forgotPasswordText = screen.getByText('Forgot Password?');
    
    // When disabled, it's rendered as a span (not a clickable link)
    expect(forgotPasswordText.tagName).toBe('SPAN');
    expect(forgotPasswordText.style.cursor).toBe('default');
  });
});
