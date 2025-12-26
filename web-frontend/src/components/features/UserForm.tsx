import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { User, UserRole } from '../../types';
import { UserService } from '../../services/api/user.service';

interface UserFormProps {
  user: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('READ_ONLY');
  
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');

  // Update form state when user prop changes
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setRole(user.role || 'READ_ONLY');
      // Password always starts empty for security (optional on edit)
      setPassword('');
    } else {
      // Reset to defaults for create mode
      setEmail('');
      setPassword('');
      setRole('READ_ONLY');
    }
    // Clear errors when switching modes
    setEmailError('');
    setPasswordError('');
    setError('');
  }, [user]);

  const roleOptions = [
    { label: 'Administrator', value: 'ADMINISTRATOR' },
    { label: 'Editor', value: 'EDITOR' },
    { label: 'Read Only', value: 'READ_ONLY' },
  ];

  const createMutation = useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      role: UserRole;
    }) => UserService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      email?: string;
      password?: string;
      role?: UserRole;
    }) =>
      UserService.updateUser(data.id, {
        email: data.email,
        password: data.password,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update user');
    },
  });

  const validateEmail = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value: string, isUpdate: boolean): boolean => {
    if (isUpdate && !value) {
      // Password is optional for updates
      setPasswordError('');
      return true;
    }
    
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }
    
    if (value.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return false;
    }
    
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password, !!user);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    if (user) {
      const updateData: {
        id: string;
        role: UserRole;
        email?: string;
        password?: string;
      } = {
        id: user.id,
        role,
      };
      
      if (email !== user.email) updateData.email = email.trim();
      if (password) updateData.password = password;
      
      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate({
        email: email.trim(),
        password,
        role,
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} disabled={isSubmitting} formAction="submit">
              {user ? 'Update' : 'Create'}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}
          <FormField label="Email" errorText={emailError} constraintText="Required">
            <Input
              value={email}
              onChange={({ detail }) => {
                setEmail(detail.value);
                if (emailError) validateEmail(detail.value);
              }}
              onBlur={() => validateEmail(email)}
              type="email"
              placeholder="Enter email address"
              disabled={isSubmitting}
            />
          </FormField>
          <FormField
            label="Password"
            errorText={passwordError}
            constraintText={user ? 'Optional - leave blank to keep current password' : 'Required (minimum 8 characters)'}
          >
            <Input
              value={password}
              onChange={({ detail }) => {
                setPassword(detail.value);
                if (passwordError) validatePassword(detail.value, !!user);
              }}
              onBlur={() => validatePassword(password, !!user)}
              type="password"
              placeholder={user ? 'Enter new password (optional)' : 'Enter password'}
              disabled={isSubmitting}
            />
          </FormField>
          <FormField label="Role" constraintText="Required">
            <Select
              selectedOption={roleOptions.find((o) => o.value === role) || roleOptions[2]}
              onChange={({ detail }) => setRole(detail.selectedOption.value as UserRole)}
              options={roleOptions}
              disabled={isSubmitting}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
