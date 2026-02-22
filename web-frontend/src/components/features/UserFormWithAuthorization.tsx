import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Table from '@cloudscape-design/components/table';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Modal from '@cloudscape-design/components/modal';
import Popover from '@cloudscape-design/components/popover';
import type { User, UserRole } from '../../types';
import { UserService } from '../../services/api/user.service';
import { AuthService } from '../../services/auth/auth.service';
import { geographicAuthorizationService } from '../../services/api/geographic-authorization.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { GeographicAuthorizationForm } from './GeographicAuthorizationForm';
import { useNotification } from '../../hooks/useNotification';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

interface UserFormWithAuthorizationProps {
  user: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface AuthorizationRuleInput {
  geographicAreaId: string;
  ruleType: 'ALLOW' | 'DENY';
}

interface AuthorizationRuleWithMetadata extends AuthorizationRuleInput {
  id: string;
  geographicArea?: {
    id: string;
    name: string;
    areaType: string;
  };
  createdAt: string;
  userId: string;
  createdBy: string;
  isPending?: boolean; // Flag for rules not yet persisted
}

export function UserFormWithAuthorization({ user, onSuccess, onCancel }: UserFormWithAuthorizationProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('READ_ONLY');
  
  // Local state for authorization rules (both new users and pending changes for existing users)
  const [localAuthRules, setLocalAuthRules] = useState<AuthorizationRuleWithMetadata[]>([]);
  const [deletedRuleIds, setDeletedRuleIds] = useState<string[]>([]); // Track rules to remove on submit
  
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [showAddAuthForm, setShowAddAuthForm] = useState(false);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);
  const [showAdminLogoutConfirmation, setShowAdminLogoutConfirmation] = useState(false);

  // Track initial values for dirty state detection
  const [initialFormState, setInitialFormState] = useState<{
    displayName: string;
    email: string;
    password: string;
    role: UserRole;
    ruleIds: string[]; // Track initial rule IDs for dirty detection
  } | null>(null);

  // Track if we should bypass navigation guard (set when submitting)
  const [bypassNavigationGuard, setBypassNavigationGuard] = useState(false);

  // Navigation guard confirmation state
  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const isEditMode = !!user;

  // Fetch existing authorization rules if editing
  const { data: existingRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['geographicAuthorizations', user?.id],
    queryFn: () => geographicAuthorizationService.getAuthorizationRules(user!.id),
    enabled: isEditMode,
  });

  // Initialize local rules from fetched rules when they load
  useEffect(() => {
    if (isEditMode && existingRules.length > 0 && localAuthRules.length === 0) {
      setLocalAuthRules(existingRules);
    }
  }, [isEditMode, existingRules, localAuthRules.length]);

  // Fetch effective authorized areas for display (not used for dirty detection, just display)
  const { data: authorizedAreas = [] } = useQuery({
    queryKey: ['authorizedAreas', user?.id],
    queryFn: () => geographicAuthorizationService.getAuthorizedAreas(user!.id),
    enabled: isEditMode,
  });

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (!initialFormState) return false;
    
    // Bypass guard if we're in the process of submitting
    if (bypassNavigationGuard) return false;
    
    // Check if rules have changed
    const currentRuleIds = localAuthRules.map(r => r.id).sort();
    const initialRuleIds = [...initialFormState.ruleIds].sort();
    const rulesChanged = 
      currentRuleIds.length !== initialRuleIds.length ||
      currentRuleIds.some((id, i) => id !== initialRuleIds[i]) ||
      deletedRuleIds.length > 0;
    
    // Compare current state with initial state
    return (
      displayName !== initialFormState.displayName ||
      email !== initialFormState.email ||
      password !== initialFormState.password ||
      role !== initialFormState.role ||
      rulesChanged
    );
  }, [displayName, email, password, role, localAuthRules, deletedRuleIds, initialFormState, bypassNavigationGuard]);

  // Navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Show confirmation dialog when navigation is blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowNavigationConfirmation(true);
      setPendingNavigation(() => blocker.proceed);
    }
  }, [blocker.state, blocker.proceed]);

  const handleConfirmNavigation = () => {
    setShowNavigationConfirmation(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowNavigationConfirmation(false);
    setPendingNavigation(null);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const handleCancelClick = () => {
    // If form is dirty, the blocker will intercept and show confirmation
    // If form is clean, just navigate away
    onCancel();
  };

  // Update form state when user prop changes
  useEffect(() => {
    // Reset bypass flag when switching modes or when user data loads
    setBypassNavigationGuard(false);
    
    if (user) {
      const values = {
        displayName: user.displayName || '',
        email: user.email || '',
        password: '',
        role: user.role || 'READ_ONLY',
        ruleIds: existingRules.map(r => r.id),
      };
      setDisplayName(values.displayName);
      setEmail(values.email);
      setRole(values.role);
      setPassword('');
      setLocalAuthRules(existingRules);
      setDeletedRuleIds([]);
      setInitialFormState(values);
    } else {
      const emptyValues = {
        displayName: '',
        email: '',
        password: '',
        role: 'READ_ONLY' as UserRole,
        ruleIds: [],
      };
      setDisplayName(emptyValues.displayName);
      setEmail(emptyValues.email);
      setPassword(emptyValues.password);
      setRole(emptyValues.role);
      setLocalAuthRules([]);
      setDeletedRuleIds([]);
      setInitialFormState(emptyValues);
    }
    setEmailError('');
    setPasswordError('');
    setError('');
  }, [user?.id, existingRules.length]); // Only depend on user ID and rules length, not the entire arrays

  const roleOptions = [
    { label: 'Administrator', value: 'ADMINISTRATOR' },
    { label: 'Editor', value: 'EDITOR' },
    { label: 'Read Only', value: 'READ_ONLY' },
    { label: 'PII Restricted', value: 'PII_RESTRICTED' },
  ];

  const createMutation = useMutation({
    mutationFn: (data: {
      displayName?: string;
      email: string;
      password: string;
      role: UserRole;
      authorizationRules?: AuthorizationRuleInput[];
    }) => UserService.createUser(data),
    onSuccess: () => {
      // Set flag to bypass navigation guard
      setBypassNavigationGuard(true);
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User created successfully');
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create user');
      showError(err.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      displayName?: string | null;
      email?: string;
      password?: string;
      role?: UserRole;
    }) => {
      // First update the user
      await UserService.updateUser(data.id, {
        displayName: data.displayName,
        email: data.email,
        password: data.password,
        role: data.role,
      });

      // Then apply authorization rule changes
      // Remove rules that were marked for deletion
      for (const ruleId of deletedRuleIds) {
        await geographicAuthorizationService.deleteAuthorizationRule(user!.id, ruleId);
      }

      // Add new rules (those with isPending flag)
      const newRules = localAuthRules.filter(r => r.isPending);
      for (const rule of newRules) {
        await geographicAuthorizationService.createAuthorizationRule(
          user!.id,
          rule.geographicAreaId,
          rule.ruleType
        );
      }
    },
    onSuccess: () => {
      // Set flag to bypass navigation guard
      setBypassNavigationGuard(true);
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['geographicAuthorizations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['authorizedAreas', user?.id] });
      showSuccess('User updated successfully');
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update user');
      showError(err.message || 'Failed to update user');
    },
  });

  const adminLogoutUserMutation = useMutation({
    mutationFn: (userId: string) => AuthService.invalidateUserTokens(userId),
    onSuccess: () => {
      showSuccess('User has been logged out from all devices successfully');
      setShowAdminLogoutConfirmation(false);
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to log out user from all devices');
      setShowAdminLogoutConfirmation(false);
    },
  });

  const handleAdminLogoutUser = () => {
    if (user) {
      adminLogoutUserMutation.mutate(user.id);
    }
  };

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

    // Set flag to bypass navigation guard during submission
    setBypassNavigationGuard(true);

    if (user) {
      const updateData: {
        id: string;
        role: UserRole;
        displayName?: string | null;
        email?: string;
        password?: string;
      } = {
        id: user.id,
        role,
      };
      
      if (displayName !== user.displayName) {
        updateData.displayName = displayName.trim() || null;
      }
      if (email !== user.email) updateData.email = email.trim();
      if (password) updateData.password = password;
      
      updateMutation.mutate(updateData);
    } else {
      // For new users, convert local rules to the format expected by API
      const rulesToCreate = localAuthRules.map(r => ({
        geographicAreaId: r.geographicAreaId,
        ruleType: r.ruleType,
      }));
      
      createMutation.mutate({
        displayName: displayName.trim() || undefined,
        email: email.trim(),
        password,
        role,
        authorizationRules: rulesToCreate.length > 0 ? rulesToCreate : undefined,
      });
    }
  };

  const handleAddAuthRule = async (geographicAreaId: string, ruleType: 'ALLOW' | 'DENY') => {
    // Fetch the geographic area details to display the name
    try {
      const geographicArea = await GeographicAreaService.getGeographicArea(geographicAreaId);
      
      // Add rule to local state (not persisted until form submit)
      const newRule: AuthorizationRuleWithMetadata = {
        id: `pending-${Date.now()}`, // Temporary ID
        geographicAreaId,
        ruleType,
        geographicArea: {
          id: geographicArea.id,
          name: geographicArea.name,
          areaType: geographicArea.areaType,
        },
        createdAt: new Date().toISOString(),
        userId: user?.id || '',
        createdBy: '',
        isPending: true,
      };
      
      setLocalAuthRules([...localAuthRules, newRule]);
      setShowAddAuthForm(false);
    } catch (error) {
      showError('Failed to fetch geographic area details');
      console.error('Error fetching geographic area:', error);
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    setConfirmDeleteRuleId(ruleId);
  };

  const handleConfirmDeleteRule = () => {
    if (confirmDeleteRuleId) {
      const rule = localAuthRules.find(r => r.id === confirmDeleteRuleId);
      
      if (rule?.isPending) {
        // Remove pending rule from local state
        setLocalAuthRules(localAuthRules.filter(r => r.id !== confirmDeleteRuleId));
      } else {
        // Mark existing rule for deletion (will be deleted on submit)
        setDeletedRuleIds([...deletedRuleIds, confirmDeleteRuleId]);
        setLocalAuthRules(localAuthRules.filter(r => r.id !== confirmDeleteRuleId));
      }
      setConfirmDeleteRuleId(null);
    }
  };

  // Separate authorized areas by access level
  const fullAccessAreas = authorizedAreas.filter((a) => a.accessLevel === 'FULL');
  const readOnlyAreas = authorizedAreas.filter((a) => a.accessLevel === 'READ_ONLY');
  const deniedAreas = authorizedAreas.filter((a) => a.accessLevel === 'NONE');

  // Check for DENY rules that override ALLOW rules
  const displayRules = localAuthRules;
  
  const denyRules = displayRules.filter((r) => r.ruleType === 'DENY');
  const allowRules = displayRules.filter((r) => r.ruleType === 'ALLOW');
  const hasConflictingRules = denyRules.length > 0 && allowRules.length > 0;

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleCancelClick} disabled={isSubmitting} formAction="none">
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

          <Container header={<Header variant="h2">User Information</Header>}>
            <SpaceBetween size="l">
              <FormField label="Display Name" constraintText="Optional - defaults to email if not provided">
                <Input
                  value={displayName}
                  onChange={({ detail }) => setDisplayName(detail.value)}
                  placeholder="Enter display name"
                  disabled={isSubmitting}
                />
              </FormField>
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
          </Container>

          {/* Warning for conflicting rules */}
          {hasConflictingRules && (
            <Alert type="warning" header="Conflicting Rules Detected">
              This user has both ALLOW and DENY rules. DENY rules will take precedence and may
              override ALLOW rules for overlapping geographic areas.
            </Alert>
          )}

          {/* Authorization Rules Table */}
          <Table
            wrapLines={false}
            header={
              <Header
                variant="h2"
                actions={
                  <Button 
                    onClick={() => setShowAddAuthForm(true)} 
                    disabled={isSubmitting}
                    formAction="none"
                  >
                    Add Rule
                  </Button>
                }
                description={isEditMode ? 'Changes will be saved when you click Update' : 'Rules will be created when you click Create'}
              >
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <span>Geographic Authorization Rules</span>
                  <Popover
                    dismissButton={false}
                    position="right"
                    size="large"
                    triggerType="custom"
                    content={
                      <SpaceBetween size="xs">
                        <Box>
                          <strong>ALLOW rules</strong> grant access to the selected area and all its
                          descendants (child areas).
                        </Box>
                        <Box>
                          <strong>ALLOW rules</strong> also grant read-only access to ancestor areas for
                          navigation context.
                        </Box>
                        <Box>
                          <strong>DENY rules</strong> take precedence over ALLOW rules and block access to
                          the area and all descendants.
                        </Box>
                        <Box>
                          Users with <strong>no rules</strong> have unrestricted access to all areas.
                        </Box>
                      </SpaceBetween>
                    }
                  >
                    <Button
                      variant="inline-icon"
                      iconName="status-info"
                      ariaLabel="How Geographic Authorization Works"
                      formAction="none"
                    />
                  </Popover>
                </SpaceBetween>
              </Header>
            }
            loading={rulesLoading}
            loadingText="Loading authorization rules..."
            columnDefinitions={[
              {
                id: 'geographicArea',
                header: 'Geographic Area',
                cell: (item) => (
                  <SpaceBetween direction="horizontal" size="xs">
                    <span>{item.geographicArea?.name || item.geographicAreaId}</span>
                    {item.isPending && <Badge color="blue">Pending</Badge>}
                  </SpaceBetween>
                ),
              },
              {
                id: 'areaType',
                header: 'Area Type',
                cell: (item) => item.geographicArea?.areaType || '-',
              },
              {
                id: 'ruleType',
                header: 'Rule Type',
                cell: (item) =>
                  item.ruleType === 'ALLOW' ? (
                    <StatusIndicator type="success">ALLOW</StatusIndicator>
                  ) : (
                    <StatusIndicator type="error">DENY</StatusIndicator>
                  ),
              },
              {
                id: 'createdAt',
                header: 'Created',
                cell: (item) => item.isPending ? 'Not saved' : new Date(item.createdAt).toLocaleDateString(),
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: (item) => (
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => handleDeleteRule(item.id)}
                    formAction="none"
                  />
                ),
              },
            ]}
            items={displayRules}
            empty={
              <Box textAlign="center" color="inherit">
                <SpaceBetween size="xs">
                  <Box variant="p" color="inherit">
                    No authorization rules
                  </Box>
                  <Box variant="small" color="text-body-secondary">
                    This user has unrestricted access to all geographic areas
                  </Box>
                </SpaceBetween>
              </Box>
            }
          />

          {/* Effective Access Summary - only show for existing users */}
          {isEditMode && authorizedAreas.length > 0 && (
            <Container header={<Header variant="h2">Effective Access Summary</Header>}>
              <ColumnLayout columns={3}>
                {/* Full Access Areas */}
                <SpaceBetween size="s">
                  <Box variant="h4">Full Access ({fullAccessAreas.length})</Box>
                  {fullAccessAreas.length === 0 ? (
                    <Box variant="small" color="text-body-secondary">
                      {displayRules.length === 0
                        ? 'All areas (unrestricted)'
                        : 'No areas with full access'}
                    </Box>
                  ) : (
                    fullAccessAreas.slice(0, 10).map((area) => (
                      <SpaceBetween key={area.geographicAreaId} direction="horizontal" size="xs">
                        <Badge color="green">{area.geographicAreaName}</Badge>
                        {area.isDescendant && (
                          <Box variant="small" color="text-body-secondary">
                            (via parent)
                          </Box>
                        )}
                      </SpaceBetween>
                    ))
                  )}
                  {fullAccessAreas.length > 10 && (
                    <Box variant="small" color="text-body-secondary">
                      ...and {fullAccessAreas.length - 10} more
                    </Box>
                  )}
                </SpaceBetween>

                {/* Read-Only Access Areas */}
                <SpaceBetween size="s">
                  <Box variant="h4">Read-Only Access ({readOnlyAreas.length})</Box>
                  {readOnlyAreas.length === 0 ? (
                    <Box variant="small" color="text-body-secondary">
                      No ancestor areas
                    </Box>
                  ) : (
                    readOnlyAreas.slice(0, 10).map((area) => (
                      <SpaceBetween key={area.geographicAreaId} direction="horizontal" size="xs">
                        <Badge color="blue">{area.geographicAreaName}</Badge>
                        <Box variant="small" color="text-body-secondary">
                          (ancestor)
                        </Box>
                      </SpaceBetween>
                    ))
                  )}
                  {readOnlyAreas.length > 10 && (
                    <Box variant="small" color="text-body-secondary">
                      ...and {readOnlyAreas.length - 10} more
                    </Box>
                  )}
                </SpaceBetween>

                {/* Denied Areas */}
                <SpaceBetween size="s">
                  <Box variant="h4">Denied Access ({deniedAreas.length})</Box>
                  {deniedAreas.length === 0 ? (
                    <Box variant="small" color="text-body-secondary">
                      No denied areas
                    </Box>
                  ) : (
                    deniedAreas.slice(0, 10).map((area) => (
                      <Box key={area.geographicAreaId}>
                        <Badge color="red">{area.geographicAreaName}</Badge>
                      </Box>
                    ))
                  )}
                  {deniedAreas.length > 10 && (
                    <Box variant="small" color="text-body-secondary">
                      ...and {deniedAreas.length - 10} more
                    </Box>
                  )}
                </SpaceBetween>
              </ColumnLayout>
            </Container>
          )}

          {/* Security Section - Admin only, Edit mode only */}
          {isEditMode && user && (
            <Container header={<Header variant="h2">Security</Header>}>
              <SpaceBetween size="m">
                <Box>
                  <Box variant="p" margin={{ bottom: 's' }}>
                    Log out <strong>{user.displayName || user.email}</strong> from all devices. This will invalidate all their authorization tokens and require them to log in again on all devices.
                  </Box>
                  <Box variant="p" color="text-status-info">
                    Use this if the user's account has been compromised or they have lost a device.
                  </Box>
                </Box>

                <Button
                  variant="normal"
                  onClick={() => setShowAdminLogoutConfirmation(true)}
                  loading={adminLogoutUserMutation.isPending}
                  disabled={adminLogoutUserMutation.isPending}
                  formAction="none"
                >
                  Log Out User from All Devices
                </Button>
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Form>

      {/* Add Authorization Rule Form */}
      <GeographicAuthorizationForm
        userId={user?.id || ''}
        visible={showAddAuthForm}
        onDismiss={() => setShowAddAuthForm(false)}
        onSuccess={(geographicAreaId, ruleType) => {
          handleAddAuthRule(geographicAreaId, ruleType);
        }}
        localMode={true}
      />

      {/* Navigation Confirmation Modal */}
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
        You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.
      </Modal>

      {/* Remove Authorization Rule Confirmation */}
      <ConfirmationDialog
        visible={confirmDeleteRuleId !== null}
        title="Remove Authorization Rule"
        message="Are you sure you want to remove this authorization rule?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDeleteRule}
        onCancel={() => setConfirmDeleteRuleId(null)}
      />

      {/* Admin Logout User Confirmation */}
      {isEditMode && user && (
        <Modal
          visible={showAdminLogoutConfirmation}
          onDismiss={() => setShowAdminLogoutConfirmation(false)}
          header={`Log Out ${user.displayName || user.email} from All Devices?`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowAdminLogoutConfirmation(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAdminLogoutUser}
                  loading={adminLogoutUserMutation.isPending}
                >
                  Confirm
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Box>
              This will invalidate all authorization tokens for <strong>{user.displayName || user.email}</strong> and require them to log in again on all devices.
            </Box>
            <Box color="text-status-warning">
              Are you sure you want to continue?
            </Box>
          </SpaceBetween>
        </Modal>
      )}
    </form>
  );
}
