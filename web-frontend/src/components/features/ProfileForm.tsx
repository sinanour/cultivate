import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Modal from '@cloudscape-design/components/modal';
import type { User } from '../../types';
import { UserService } from '../../services/api/user.service';
import { AuthService } from '../../services/auth/auth.service';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/date.utils';

interface ProfileFormProps {
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProfileForm({ user, onSuccess, onCancel }: ProfileFormProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const { updateUser, logout } = useAuth();
  
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [displayNameError, setDisplayNameError] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  // Track initial values for dirty state detection
  const initialValues = useMemo(() => ({
    displayName: user.displayName || '',
  }), [user.displayName]);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return displayName !== initialValues.displayName ||
           currentPassword !== '' ||
           newPassword !== '' ||
           confirmPassword !== '';
  }, [displayName, currentPassword, newPassword, confirmPassword, initialValues]);

  // Navigation guard
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return isDirty && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowNavigationConfirmation(true);
    }
  }, [blocker.state]);

  const updateMutation = useMutation({
    mutationFn: (data: { displayName?: string | null; currentPassword?: string; newPassword?: string }) =>
      UserService.updateCurrentUserProfile(data),
    onSuccess: (updatedUser: User) => {
      // Update React Query cache
      queryClient.setQueryData(['user-profile'], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      
      // Update AuthContext so the user menu reflects the change immediately
      updateUser(updatedUser);
      
      showSuccess('Profile updated successfully');
      
      // Clear password fields after successful update
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.code === 'INVALID_CURRENT_PASSWORD') {
        setCurrentPasswordError('Current password is incorrect');
        showError('Current password is incorrect');
      } else {
        showError(error.response?.data?.message || 'Failed to update profile');
      }
    },
  });

  const logoutAllDevicesMutation = useMutation({
    mutationFn: () => AuthService.invalidateAllTokens(),
    onSuccess: () => {
      showSuccess('All devices have been logged out successfully');
      // Wait a moment for the user to see the success message, then logout
      setTimeout(() => {
        logout();
      }, 1500);
    },
    onError: (error: any) => {
      showError(error.message || 'Failed to log out of all devices');
    },
  });

  const handleLogoutAllDevices = () => {
    setShowLogoutConfirmation(false);
    logoutAllDevicesMutation.mutate();
  };

  const validate = (): boolean => {
    let isValid = true;
    
    // Clear previous errors
    setDisplayNameError('');
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');

    // Validate display name if provided
    if (displayName && (displayName.length < 1 || displayName.length > 200)) {
      setDisplayNameError('Display name must be between 1 and 200 characters');
      isValid = false;
    }

    // Validate password change if attempted
    if (newPassword) {
      if (!currentPassword) {
        setCurrentPasswordError('Current password is required when changing password');
        isValid = false;
      }

      if (newPassword.length < 8) {
        setNewPasswordError('New password must be at least 8 characters');
        isValid = false;
      }

      if (newPassword !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match');
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    const updateData: { displayName?: string | null; currentPassword?: string; newPassword?: string } = {};

    // Include displayName if changed (including empty string to clear)
    if (displayName !== (user.displayName || '')) {
      updateData.displayName = displayName || null;
    }

    // Include password change if provided
    if (newPassword) {
      updateData.currentPassword = currentPassword;
      updateData.newPassword = newPassword;
    }

    // Only submit if there are changes
    if (Object.keys(updateData).length === 0) {
      showError('No changes to save');
      return;
    }

    updateMutation.mutate(updateData);
  };

  const handleConfirmNavigation = () => {
    setShowNavigationConfirmation(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  };

  const handleCancelNavigation = () => {
    setShowNavigationConfirmation(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  return (
    <>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={updateMutation.isPending}
              disabled={!isDirty}
            >
              Save Changes
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Container header={<Header variant="h2">Profile Information</Header>}>
            <SpaceBetween size="m">
              <ColumnLayout columns={2}>
                <FormField
                  label="Display Name"
                  description="Optional display name shown in the interface"
                  errorText={displayNameError}
                >
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.detail.value)}
                    placeholder="Enter display name"
                    clearAriaLabel="Clear display name"
                    type="text"
                  />
                </FormField>

                <FormField label="Email" description="Email address (cannot be changed)">
                  <Box variant="p">{user.email}</Box>
                </FormField>
              </ColumnLayout>

              <ColumnLayout columns={2}>
                <FormField label="Role" description="Your system role (cannot be changed)">
                  <Box variant="p">{user.role}</Box>
                </FormField>

                <FormField label="Member Since">
                  <Box variant="p">{formatDate(user.createdAt)}</Box>
                </FormField>
              </ColumnLayout>
            </SpaceBetween>
          </Container>

          <Container header={<Header variant="h2">Change Password</Header>}>
            <SpaceBetween size="m">
              <Alert type="info">
                Leave password fields empty if you don't want to change your password.
              </Alert>

              <FormField
                label="Current Password"
                description="Enter your current password to verify your identity"
                errorText={currentPasswordError}
              >
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.detail.value);
                    setCurrentPasswordError('');
                  }}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </FormField>

              <ColumnLayout columns={2}>
                <FormField
                  label="New Password"
                  description="Minimum 8 characters"
                  errorText={newPasswordError}
                >
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.detail.value);
                      setNewPasswordError('');
                    }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                </FormField>

                <FormField
                  label="Confirm New Password"
                  description="Re-enter new password"
                  errorText={confirmPasswordError}
                >
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.detail.value);
                      setConfirmPasswordError('');
                    }}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </FormField>
              </ColumnLayout>
            </SpaceBetween>
          </Container>

          <Container header={<Header variant="h2">Security</Header>}>
            <SpaceBetween size="m">
              <Box>
                <Box variant="p" margin={{ bottom: 's' }}>
                  Log out of all devices where you're currently signed in. This will invalidate all your authorization tokens and require you to log in again on all devices.
                </Box>
                <Box variant="p" color="text-status-info">
                  Use this if you suspect unauthorized access to your account or have lost a device.
                </Box>
              </Box>

              <Button
                variant="normal"
                onClick={() => setShowLogoutConfirmation(true)}
                loading={logoutAllDevicesMutation.isPending}
                disabled={logoutAllDevicesMutation.isPending}
              >
                Log Out of All Devices
              </Button>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </Form>

      <Modal
        visible={showLogoutConfirmation}
        onDismiss={() => setShowLogoutConfirmation(false)}
        header="Log Out of All Devices?"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowLogoutConfirmation(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleLogoutAllDevices}
                loading={logoutAllDevicesMutation.isPending}
              >
                Confirm
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            This will invalidate all your authorization tokens and require you to log in again on all devices.
          </Box>
          <Box color="text-status-warning">
            Are you sure you want to continue?
          </Box>
        </SpaceBetween>
      </Modal>

      <Modal
        visible={showNavigationConfirmation}
        onDismiss={handleCancelNavigation}
        header="Unsaved Changes"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCancelNavigation}>
                Stay on Page
              </Button>
              <Button variant="primary" onClick={handleConfirmNavigation}>
                Discard Changes
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        You have unsaved changes. Are you sure you want to leave this page?
      </Modal>
    </>
  );
}
