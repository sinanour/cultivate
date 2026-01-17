import { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Header,
  FormField,
  RadioGroup,
  Button,
  Alert,
} from '@cloudscape-design/components';
import { useMutation } from '@tanstack/react-query';
import { geographicAuthorizationService } from '../../services/api/geographic-authorization.service';
import { GeographicAreaSelector } from '../common/GeographicAreaSelector';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { useGeographicAreaOptions } from '../../hooks/useGeographicAreaOptions';

interface GeographicAuthorizationFormProps {
  userId: string;
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (geographicAreaId: string, ruleType: 'ALLOW' | 'DENY') => void;
  localMode?: boolean; // If true, don't persist to API, just call onSuccess with data
}

export function GeographicAuthorizationForm({
  userId,
  visible,
  onDismiss,
  onSuccess,
  localMode = false,
}: GeographicAuthorizationFormProps) {
  const { user } = useAuth();
  const [geographicAreaId, setGeographicAreaId] = useState<string>('');
  const [ruleType, setRuleType] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [validationError, setValidationError] = useState<string>('');
  const { showError } = useNotification();

  const canAddGeographicArea = user?.role === 'ADMINISTRATOR';

  // Geographic area options with lazy loading
  const {
    options: geographicAreas,
    isLoading: isLoadingAreas,
    handleLoadItems: handleGeographicAreaSearch,
    refetch: refetchAreas,
  } = useGeographicAreaOptions();

  const [isRefreshingAreas, setIsRefreshingAreas] = useState(false);

  const handleRefreshAreas = async () => {
    setIsRefreshingAreas(true);
    try {
      await refetchAreas();
    } finally {
      setIsRefreshingAreas(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      geographicAuthorizationService.createAuthorizationRule(userId, geographicAreaId, ruleType),
    onSuccess: () => {
      onSuccess(geographicAreaId, ruleType);
      handleReset();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create authorization rule';
      if (message.includes('already exists')) {
        setValidationError('An authorization rule already exists for this geographic area');
      } else {
        showError(message);
      }
    },
  });

  const handleSubmit = () => {
    setValidationError('');

    if (!geographicAreaId) {
      setValidationError('Please select a geographic area');
      return;
    }

    if (localMode) {
      // Local mode: just call onSuccess with the data, don't persist to API
      onSuccess(geographicAreaId, ruleType);
      handleReset();
    } else {
      // API mode: persist to API
      createMutation.mutate();
    }
  };

  const handleReset = () => {
    setGeographicAreaId('');
    setRuleType('ALLOW');
    setValidationError('');
  };

  const handleDismiss = () => {
    handleReset();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      header={<Header>Add Authorization Rule</Header>}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={!localMode && createMutation.isPending}
              disabled={!geographicAreaId}
            >
              Add Rule
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        {validationError && <Alert type="error">{validationError}</Alert>}

        <FormField label="Geographic Area" description="Select the geographic area for this rule">
          <EntitySelectorWithActions
            onRefresh={handleRefreshAreas}
            addEntityUrl="/geographic-areas/new"
            canAdd={canAddGeographicArea}
            isRefreshing={isRefreshingAreas}
            entityTypeName="geographic area"
          >
            <GeographicAreaSelector
              value={geographicAreaId}
              onChange={(id) => setGeographicAreaId(id || '')}
              options={geographicAreas}
              loading={isLoadingAreas}
              placeholder="Select geographic area"
              onLoadItems={handleGeographicAreaSearch}
              filteringType="manual"
            />
          </EntitySelectorWithActions>
        </FormField>

        <FormField
          label="Rule Type"
          description="ALLOW grants access to the area and descendants. DENY blocks access."
        >
          <RadioGroup
            value={ruleType}
            onChange={({ detail }) => setRuleType(detail.value as 'ALLOW' | 'DENY')}
            items={[
              {
                value: 'ALLOW',
                label: 'ALLOW - Grant access to this area and all descendants',
              },
              {
                value: 'DENY',
                label: 'DENY - Block access to this area and all descendants',
              },
            ]}
          />
        </FormField>

        {ruleType === 'DENY' && (
          <Alert type="warning" header="DENY Rule Warning">
            DENY rules take precedence over ALLOW rules. This will block access to the selected
            area and all its descendants, even if there are ALLOW rules for those areas.
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
