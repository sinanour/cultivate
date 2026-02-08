import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PasswordResetPage from '../PasswordResetPage';

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

describe('PasswordResetPage - Form Fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('password_reset');
    
    // Create a valid JWT token with email
    const payload = {
      email: 'test@example.com',
      userId: '123',
      purpose: 'password_reset',
    };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    mockSearchParams.set('password_reset', token);
  });

  it('should have email field present and disabled', () => {
    renderPasswordResetPage();

    const emailInput = screen.getByDisplayValue('test@example.com');
    expect(emailInput).toBeDefined();
    expect(emailInput.hasAttribute('disabled')).toBe(true);
    expect(emailInput.hasAttribute('readonly')).toBe(true);
  });

  it('should have new password field present', () => {
    renderPasswordResetPage();

    const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
    expect(newPasswordInput).toBeDefined();
    expect(newPasswordInput.getAttribute('type')).toBe('password');
  });

  it('should have confirm password field present', () => {
    renderPasswordResetPage();

    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');
    expect(confirmPasswordInput).toBeDefined();
    expect(confirmPasswordInput.getAttribute('type')).toBe('password');
  });
});
