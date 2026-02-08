import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Mock useSearchParams
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
    useNavigate: () => vi.fn(),
  };
});

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContext}>
        <LoginPage />
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('LoginPage - Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.user = null;
    mockSearchParams.delete('password_reset');
  });

  it('should render LoginPage by default when no password_reset parameter', () => {
    renderLoginPage();

    // Should show login form elements
    expect(screen.getByText('Cultivate')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your email')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Login' })).toBeDefined();
  });

  it('should render PasswordResetPage when password_reset parameter is present', () => {
    // Set up password_reset parameter
    const payload = {
      email: 'test@example.com',
      userId: '123',
      purpose: 'password_reset',
    };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    mockSearchParams.set('password_reset', token);

    renderLoginPage();

    // Should show password reset form elements
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeDefined();
    expect(screen.getByDisplayValue('test@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your new password')).toBeDefined();
    expect(screen.getByPlaceholderText('Confirm your new password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeDefined();
  });
});
