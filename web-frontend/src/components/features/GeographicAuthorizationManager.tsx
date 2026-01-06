import { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Header,
  Table,
  Button,
  Alert,
  Container,
  ColumnLayout,
  Badge,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { geographicAuthorizationService } from '../../services/api/geographic-authorization.service';
import { GeographicAuthorizationForm } from './GeographicAuthorizationForm';
import { useNotification } from '../../hooks/useNotification';

interface GeographicAuthorizationManagerProps {
  userId: string;
  visible: boolean;
  onDismiss: () => void;
}

export function GeographicAuthorizationManager({
  userId,
  visible,
  onDismiss,
}: GeographicAuthorizationManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  // Fetch authorization rules
  const { data: rules = [], isLoading: rulesLoading, error: rulesError } = useQuery({
    queryKey: ['geographicAuthorizations', userId],
    queryFn: async () => {
      try {
        const result = await geographicAuthorizationService.getAuthorizationRules(userId);
        console.log('Authorization rules loaded:', result);
        return result;
      } catch (error) {
        console.error('Error loading authorization rules:', error);
        throw error;
      }
    },
    enabled: visible && !!userId,
    retry: false,
  });

  // Fetch effective authorized areas
  const { data: authorizedAreas = [], error: areasError } = useQuery({
    queryKey: ['authorizedAreas', userId],
    queryFn: async () => {
      try {
        const result = await geographicAuthorizationService.getAuthorizedAreas(userId);
        console.log('Authorized areas loaded:', result);
        return result;
      } catch (error) {
        console.error('Error loading authorized areas:', error);
        throw error;
      }
    },
    enabled: visible && !!userId,
    retry: false,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (authId: string) =>
      geographicAuthorizationService.deleteAuthorizationRule(userId, authId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAuthorizations', userId] });
      queryClient.invalidateQueries({ queryKey: ['authorizedAreas', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('Authorization rule deleted successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to delete authorization rule');
    },
  });

  const handleDelete = (authId: string) => {
    if (window.confirm('Are you sure you want to delete this authorization rule?')) {
      deleteMutation.mutate(authId);
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: ['geographicAuthorizations', userId] });
    queryClient.invalidateQueries({ queryKey: ['authorizedAreas', userId] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    showSuccess('Authorization rule created successfully');
  };

  // Separate authorized areas by access level
  const fullAccessAreas = authorizedAreas.filter((a) => a.accessLevel === 'FULL');
  const readOnlyAreas = authorizedAreas.filter((a) => a.accessLevel === 'READ_ONLY');
  const deniedAreas = authorizedAreas.filter((a) => a.accessLevel === 'NONE');

  // Check for DENY rules that override ALLOW rules
  const denyRules = rules.filter((r) => r.ruleType === 'DENY');
  const allowRules = rules.filter((r) => r.ruleType === 'ALLOW');
  const hasConflictingRules = denyRules.length > 0 && allowRules.length > 0;

  return (
    <>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        size="large"
        header={<Header>Manage Geographic Authorizations</Header>}
      >
        <SpaceBetween size="l">
          {/* Error Display */}
          {(rulesError || areasError) && (
            <Alert type="error" header="Error Loading Authorization Data">
              {rulesError instanceof Error ? rulesError.message : 'Failed to load authorization rules'}
            </Alert>
          )}

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
          <Table
            header={
              <Header 
                actions={
                  <Button onClick={() => setShowAddForm(true)} disabled={rulesLoading}>
                    Add Rule
                  </Button>
                }
              >
                Authorization Rules
              </Header>
            }
            loading={rulesLoading}
            loadingText="Loading authorization rules..."
            items={rules}
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
                    onClick={() => handleDelete(item.id)}
                    loading={deleteMutation.isPending}
                  />
                ),
              },
            ]}
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

          {/* Effective Access Summary */}
          <Container header={<Header>Effective Access Summary</Header>}>
            <ColumnLayout columns={3}>
              {/* Full Access Areas */}
              <SpaceBetween size="s">
                <Box variant="h4">Full Access ({fullAccessAreas.length})</Box>
                {fullAccessAreas.length === 0 ? (
                  <Box variant="small" color="text-body-secondary">
                    {rules.length === 0
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
        </SpaceBetween>
      </Modal>

      {/* Add Authorization Rule Form */}
      <GeographicAuthorizationForm
        userId={userId}
        visible={showAddForm}
        onDismiss={() => setShowAddForm(false)}
        onSuccess={handleAddSuccess}
      />
    </>
  );
}
