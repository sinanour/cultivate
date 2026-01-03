import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import { useAuth } from '../hooks/useAuth';
import IconAnimation from '../components/common/IconAnimation';

type AnimationPhase = 'idle' | 'formFadeOut' | 'iconAnimation' | 'complete';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');

  // Get redirect URL from query parameter
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  // Redirect to original URL or dashboard if already authenticated
  // Skip redirect if we're in the middle of an animation
  useEffect(() => {
    if (isAuthenticated && animationPhase === 'idle') {
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectUrl, animationPhase]);

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
      // Start animation sequence instead of immediate navigation
      setAnimationPhase('formFadeOut');
      
      // Phase 1: Form fade out (1000ms)
      setTimeout(() => {
        setAnimationPhase('iconAnimation');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle icon animation completion
  const handleIconAnimationComplete = () => {
    // Navigate immediately after animation completes
    navigate(redirectUrl, { replace: true });
  };

  return (
    <>
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
        {/* Login Form Container with fade out animation */}
        <div
          style={{
            minWidth: '360px',
            width: '100%',
            maxWidth: '480px',
            opacity: animationPhase === 'formFadeOut' || animationPhase === 'iconAnimation' || animationPhase === 'complete' ? 0 : 1,
            transition: 'opacity 1000ms ease-out',
            display: animationPhase === 'iconAnimation' || animationPhase === 'complete' ? 'none' : 'block',
          }}
        >
          <Container
            header={
              <Header variant="h1">
                Cultivate
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
              <FormField
                label="Email"
                errorText={emailError}
                stretch={true}
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
                stretch={true}
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
            </Form>
          </form>
        </Container>
        </div>
      </div>

      {/* Icon Animation Phase */}
      {(animationPhase === 'iconAnimation' || animationPhase === 'complete') && (
        <IconAnimation onComplete={handleIconAnimationComplete} />
      )}
    </>
  );
}
