import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PasswordResetPage from '../PasswordResetPage';
import { AuthService } from '../../services/auth/auth.service';

// Mock AuthService
vi.mock('../../services/auth/auth.service', () => ({
  AuthService: {
    resetPassword: vi.fn(),
  },
}));

// Mock useSearchParams to provide a test token
const mockSearchParams = new URLSearchParams();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
    useNavigate: () => mockNavigate,
  };
});

const renderPasswordResetPage = () => {
  return render(
    <BrowserRouter>
      <PasswordResetPage />
    </BrowserRouter>
  );
};

describe('PasswordResetPage - Form Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('password_reset');
    mockNavigate.mockClear();
    
    // Create a valid JWT token with email
    const payload = {
      email: 'test@example.com',
      userId: '123',
      purpose: 'password_reset',
    };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    mockSearchParams.set('password_reset', token);
  });

  it('should submit form with matching passwords', async () => {
    (AuthService.resetPassword as any).mockResolvedValueOnce({
      success: true,
      message: 'Password has been reset successfully',
    });

    renderPasswordResetPage();

    // Fill in the form
    const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');

    fireEvent.change(newPasswordInput, { target: { value: 'newPassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    fireEvent.click(submitButton);

    // Wait for API call
    await waitFor(() => {
      expect(AuthService.resetPassword).toHaveBeenCalledWith(
        expect.any(String),
        'newPassword123'
      );
    });

    // Should redirect to login page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?reset_success=true', { replace: true });
    });
  });

  it('should prevent submission with mismatched passwords', async () => {
    renderPasswordResetPage();

    // Fill in the form with mismatched passwords
    const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');

    fireEvent.change(newPasswordInput, { target: { value: 'newPassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentPassword' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    fireEvent.click(submitButton);

    // API should not be called
    await waitFor(() => {
      expect(AuthService.resetPassword).not.toHaveBeenCalled();
    });
  });

  it('should display error message for mismatched passwords', async () => {
    renderPasswordResetPage();

    // Fill in the form with mismatched passwords
    const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');

    fireEvent.change(newPasswordInput, { target: { value: 'newPassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentPassword' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    fireEvent.click(submitButton);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeDefined();
    });
  });

  it('should redirect to login on successful password reset', async () => {
    (AuthService.resetPassword as any).mockResolvedValueOnce({
      success: true,
      message: 'Password has been reset successfully',
    });

    renderPasswordResetPage();

    // Fill in the form
    const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');

    fireEvent.change(newPasswordInput, { target: { value: 'newPassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    fireEvent.click(submitButton);

    // Should redirect to login page with success parameter
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?reset_success=true', { replace: true });
    });
  });
});
