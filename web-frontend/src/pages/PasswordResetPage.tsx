import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import { AuthService } from '../services/auth/auth.service';

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Extract token from URL and decode email
  useEffect(() => {
    const resetToken = searchParams.get('password_reset');
    if (!resetToken) {
      navigate('/login', { replace: true });
      return;
    }

    setToken(resetToken);

    // Decode JWT token to extract email (client-side decode, no verification)
    try {
      const payload = JSON.parse(atob(resetToken.split('.')[1]));
      setEmail(payload.email || '');
    } catch (err) {
      setError('Invalid reset token');
    }
  }, [searchParams, navigate]);

  const validatePasswords = (): boolean => {
    let isValid = true;

    if (!newPassword) {
      setNewPasswordError('Password is required');
      isValid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters');
      isValid = false;
    } else {
      setNewPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePasswords()) {
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.resetPassword(token, newPassword);
      // Redirect to login with success message
      navigate('/login?reset_success=true', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Link may be expired.');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0B1F3B',
      }}
    >
      <div
        style={{
          minWidth: '360px',
          width: '100%',
          maxWidth: '480px',
        }}
      >
        <Container
          header={
            <Header variant="h1">
              Reset Password
            </Header>
          }
        >
          <form onSubmit={handleSubmit}>
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="link"
                    onClick={() => navigate('/login')}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    loading={isLoading}
                    disabled={isLoading}
                    formAction="submit"
                  >
                    Reset Password
                  </Button>
                </SpaceBetween>
              }
              errorText={error}
            >
              <FormField
                label="Email"
                stretch={true}
              >
                <Input
                  value={email}
                  type="email"
                  disabled={true}
                  readOnly={true}
                />
              </FormField>
              <FormField
                label="New Password"
                errorText={newPasswordError}
                stretch={true}
              >
                <Input
                  value={newPassword}
                  onChange={({ detail }) => {
                    setNewPassword(detail.value);
                    if (newPasswordError) {
                      if (!detail.value) {
                        setNewPasswordError('Password is required');
                      } else if (detail.value.length < 8) {
                        setNewPasswordError('Password must be at least 8 characters');
                      } else {
                        setNewPasswordError('');
                      }
                    }
                  }}
                  type="password"
                  placeholder="Enter your new password"
                  disabled={isLoading}
                />
              </FormField>
              <FormField
                label="Confirm Password"
                errorText={confirmPasswordError}
                stretch={true}
              >
                <Input
                  value={confirmPassword}
                  onChange={({ detail }) => {
                    setConfirmPassword(detail.value);
                    if (confirmPasswordError) {
                      if (!detail.value) {
                        setConfirmPasswordError('Please confirm your password');
                      } else if (newPassword !== detail.value) {
                        setConfirmPasswordError('Passwords do not match');
                      } else {
                        setConfirmPasswordError('');
                      }
                    }
                  }}
                  type="password"
                  placeholder="Confirm your new password"
                  disabled={isLoading}
                />
              </FormField>
            </Form>
          </form>
        </Container>
      </div>
    </div>
  );
}
