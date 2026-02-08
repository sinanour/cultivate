import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { AuthContext } from '../../contexts/AuthContext';
import { AuthService } from '../../services/auth/auth.service';
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

describe('LoginPage - Forgot Password Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.user = null;
  });

  it('should close modal on cancel without making API call', async () => {
    renderLoginPage();

    // Enter a valid email to enable the forgot password link
    const emailInput = screen.getByPlaceholderText('Enter your email');
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    // Wait for the link to be enabled
    await waitFor(() => {
      const forgotPasswordLink = screen.getByText('Forgot Password?');
      expect(forgotPasswordLink.tagName).toBe('A');
    });

    // Click the forgot password link
    const forgotPasswordLink = screen.getByText('Forgot Password?');
    fireEvent.click(forgotPasswordLink);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Password Reset')).toBeDefined();
    });

    // Verify modal is visible
    expect(screen.getByText('Confirm Password Reset')).toBeDefined();

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // API should not have been called
    expect(AuthService.requestPasswordReset).not.toHaveBeenCalled();
  });
});
