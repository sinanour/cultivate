import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import Alert from '@cloudscape-design/components/alert';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f0f0f0',
      }}
    >
      <Container
        header={
          <Header variant="h1">
            Community Activity Tracker
          </Header>
        }
      >
        <form onSubmit={handleSubmit}>
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="primary"
                  loading={isLoading}
                  disabled={isLoading}
                  formAction="submit"
                >
                  Login
                </Button>
              </SpaceBetween>
            }
            errorText={error}
          >
            <SpaceBetween size="l">
              {error && (
                <Alert type="error" dismissible onDismiss={() => setError('')}>
                  {error}
                </Alert>
              )}
              <FormField
                label="Email"
                errorText={emailError}
              >
                <Input
                  value={email}
                  onChange={({ detail }) => {
                    setEmail(detail.value);
                    if (emailError) validateEmail(detail.value);
                  }}
                  onBlur={() => validateEmail(email)}
                  type="email"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </FormField>
              <FormField
                label="Password"
                errorText={passwordError}
              >
                <Input
                  value={password}
                  onChange={({ detail }) => {
                    setPassword(detail.value);
                    if (passwordError) validatePassword(detail.value);
                  }}
                  onBlur={() => validatePassword(password)}
                  type="password"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </form>
      </Container>
    </div>
  );
}
