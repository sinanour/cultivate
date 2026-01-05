import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { User, UserRole } from '../../types';
import { UserService } from '../../services/api/user.service';
import { geographicAuthorizationService } from '../../services/api/geographic-authorization.service';
import { GeographicAuthorizationForm } from './GeographicAuthorizationForm';
import { useNotification } from '../../hooks/useNotification';

interface UserFormWithAuthorizationProps {
  user: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface AuthorizationRuleInput {
  geographicAreaId: string;
  ruleType: 'ALLOW' | 'DENY';
}

export function UserFormWithAuthorization({ user, onSuccess, onCancel }: UserFormWithAuthorizationProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('READ_ONLY');
  const [authorizationRules, setAuthorizationRules] = useState<AuthorizationRuleInput[]>([]);
  
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [showAddAuthForm, setShowAddAuthForm] = useState(false);

  const isEditMode = !!user;

  // Fetch existing authorization rules if editing
  const { data: existingRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['geographicAuthorizations', user?.id],
    queryFn: () => geographicAuthorizationService.getAuthorizationRules(user!.id),
    enabled: isEditMode,
  });

  // Fetch effective authorized areas for display
  const { data: authorizedAreas = [] } = useQuery({
    queryKey: ['authorizedAreas', user?.id],
    queryFn: () => geographicAuthorizationService.getAuthorizedAreas(user!.id),
    enabled: isEditMode,
  });

  // Update form state when user prop changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      setRole(user.role || 'READ_ONLY');
      setPassword('');
    } else {
      setDisplayName('');
      setEmail('');
      setPassword('');
      setRole('READ_ONLY');
      setAuthorizationRules([]);
    }
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
      displayName?: string;
      email: string;
      password: string;
      role: UserRole;
      authorizationRules?: AuthorizationRuleInput[];
    }) => UserService.createUser(data),
    onSuccess: () => {
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
    mutationFn: (data: {
      id: string;
      displayName?: string | null;
      email?: string;
      password?: string;
      role?: UserRole;
    }) =>
      UserService.updateUser(data.id, {
        displayName: data.displayName,
        email: data.email,
        password: data.password,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', user?.id] });
      showSuccess('User updated successfully');
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update user');
      showError(err.message || 'Failed to update user');
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (authId: string) =>
      geographicAuthorizationService.deleteAuthorizationRule(user!.id, authId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAuthorizations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['authorizedAreas', user?.id] });
      showSuccess('Authorization rule deleted successfully');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to delete authorization rule');
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
      createMutation.mutate({
        displayName: displayName.trim() || undefined,
        email: email.trim(),
        password,
        role,
        authorizationRules: authorizationRules.length > 0 ? authorizationRules : undefined,
      });
    }
  };

  const handleAddAuthRule = () => {
    if (isEditMode) {
      // For existing users, the rule is created via API in GeographicAuthorizationForm
      // Just refresh the queries
      queryClient.invalidateQueries({ queryKey: ['geographicAuthorizations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['authorizedAreas', user?.id] });
      showSuccess('Authorization rule added successfully');
    }
    setShowAddAuthForm(false);
  };

  const handleDeleteRule = (authId: string) => {
    if (window.confirm('Are you sure you want to delete this authorization rule?')) {
      if (isEditMode) {
        deleteRuleMutation.mutate(authId);
      } else {
        // Remove from local state for new users
        const index = parseInt(authId);
        setAuthorizationRules(authorizationRules.filter((_, i) => i !== index));
      }
    }
  };

  // Separate authorized areas by access level
  const fullAccessAreas = authorizedAreas.filter((a) => a.accessLevel === 'FULL');
  const readOnlyAreas = authorizedAreas.filter((a) => a.accessLevel === 'READ_ONLY');
  const deniedAreas = authorizedAreas.filter((a) => a.accessLevel === 'NONE');

  // Check for DENY rules that override ALLOW rules
  const displayRules = isEditMode ? existingRules : authorizationRules.map((rule, i) => ({
    id: i.toString(),
    ...rule,
    geographicArea: { id: '', name: 'Area', areaType: 'NEIGHBOURHOOD' }, // Placeholder for new users
    createdAt: new Date().toISOString(),
    userId: '',
    createdBy: '',
  }));
  
  const denyRules = displayRules.filter((r) => r.ruleType === 'DENY');
  const allowRules = displayRules.filter((r) => r.ruleType === 'ALLOW');
  const hasConflictingRules = denyRules.length > 0 && allowRules.length > 0;

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

          {/* Explanatory Text */}
          <Alert type="info" header="How Geographic Authorization Works">
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
          </Alert>

          {/* Warning for conflicting rules */}
          {hasConflictingRules && (
            <Alert type="warning" header="Conflicting Rules Detected">
              This user has both ALLOW and DENY rules. DENY rules will take precedence and may
              override ALLOW rules for overlapping geographic areas.
            </Alert>
          )}

          {/* Authorization Rules Table */}
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <Button 
                    onClick={() => setShowAddAuthForm(true)} 
                    disabled={isSubmitting || !isEditMode}
                  >
                    Add Rule
                  </Button>
                }
                description={!isEditMode ? 'Save the user first to add authorization rules' : undefined}
              >
                Geographic Authorization Rules
              </Header>
            }
          >
            {rulesLoading ? (
              <Box textAlign="center" padding="l">
                <StatusIndicator type="loading">Loading authorization rules...</StatusIndicator>
              </Box>
            ) : (
              <Table
                columnDefinitions={[
                  {
                    id: 'geographicArea',
                    header: 'Geographic Area',
                    cell: (item) => item.geographicArea?.name || item.geographicAreaId,
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
                    cell: (item) => new Date(item.createdAt).toLocaleDateString(),
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (item) => (
                      <Button
                        variant="icon"
                        iconName="remove"
                        onClick={() => handleDeleteRule(item.id)}
                        loading={deleteRuleMutation.isPending}
                        disabled={isSubmitting}
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
            )}
          </Container>

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
                      <Box key={area.geographicAreaId}>
                        <Badge color="green">{area.geographicAreaName}</Badge>
                        {' '}
                        {area.isDescendant && (
                          <Box variant="small" color="text-body-secondary" display="inline">
                            (via parent)
                          </Box>
                        )}
                      </Box>
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
                      <Box key={area.geographicAreaId}>
                        <Badge color="blue">{area.geographicAreaName}</Badge>
                        {' '}
                        <Box variant="small" color="text-body-secondary" display="inline">
                          (ancestor)
                        </Box>
                      </Box>
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
        </SpaceBetween>
      </Form>

      {/* Add Authorization Rule Form */}
      <GeographicAuthorizationForm
        userId={user?.id || ''}
        visible={showAddAuthForm}
        onDismiss={() => setShowAddAuthForm(false)}
        onSuccess={handleAddAuthRule}
      />
    </form>
  );
}
