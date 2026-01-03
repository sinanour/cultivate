import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import type { GeographicArea } from '../../types';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';
import { AsyncEntitySelect } from '../common/AsyncEntitySelect';

interface GeographicAreaFormProps {
  geographicArea: GeographicArea | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function GeographicAreaForm({ geographicArea, onSuccess, onCancel }: GeographicAreaFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [areaType, setAreaType] = useState('');
  const [parentGeographicAreaId, setParentGeographicAreaId] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [areaTypeError, setAreaTypeError] = useState('');
  const [parentError, setParentError] = useState('');
  const [error, setError] = useState('');

  // Track initial values for dirty state detection
  const [initialFormState, setInitialFormState] = useState<{
    name: string;
    areaType: string;
    parentGeographicAreaId: string;
  } | null>(null);

  // Track if we should bypass navigation guard (set when submitting)
  const [bypassNavigationGuard, setBypassNavigationGuard] = useState(false);

  // Navigation guard confirmation state
  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (!initialFormState) return false;
    
    // Bypass guard if we're in the process of submitting
    if (bypassNavigationGuard) return false;
    
    // Compare current state with initial state
    return (
      name !== initialFormState.name ||
      areaType !== initialFormState.areaType ||
      parentGeographicAreaId !== initialFormState.parentGeographicAreaId
    );
  }, [name, areaType, parentGeographicAreaId, initialFormState, bypassNavigationGuard]);

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

  // Update form state when geographicArea prop changes
  useEffect(() => {
    // Reset bypass flag when switching modes or when geographic area data loads
    setBypassNavigationGuard(false);
    
    if (geographicArea) {
      const values = {
        name: geographicArea.name || '',
        areaType: geographicArea.areaType || '',
        parentGeographicAreaId: geographicArea.parentGeographicAreaId || '',
      };
      setName(values.name);
      setAreaType(values.areaType);
      setParentGeographicAreaId(values.parentGeographicAreaId);
      setInitialFormState(values);
    } else {
      // Reset to defaults for create mode
      const emptyValues = {
        name: '',
        areaType: '',
        parentGeographicAreaId: '',
      };
      setName(emptyValues.name);
      setAreaType(emptyValues.areaType);
      setParentGeographicAreaId(emptyValues.parentGeographicAreaId);
      setInitialFormState(emptyValues);
    }
    // Clear errors when switching modes
    setNameError('');
    setAreaTypeError('');
    setParentError('');
    setError('');
  }, [geographicArea]);

  const versionConflict = useVersionConflict({
    queryKey: ['geographicAreas'],
    onDiscard: onCancel,
  });

  const areaTypeOptions = [
    { label: 'Neighbourhood', value: 'NEIGHBOURHOOD' },
    { label: 'Community', value: 'COMMUNITY' },
    { label: 'City', value: 'CITY' },
    { label: 'Cluster', value: 'CLUSTER' },
    { label: 'County', value: 'COUNTY' },
    { label: 'Province', value: 'PROVINCE' },
    { label: 'State', value: 'STATE' },
    { label: 'Country', value: 'COUNTRY' },
    { label: 'Continent', value: 'CONTINENT' },
    { label: 'Hemisphere', value: 'HEMISPHERE' },
    { label: 'World', value: 'WORLD' },
  ];

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      areaType: string;
      parentGeographicAreaId?: string;
    }) => GeographicAreaService.createGeographicArea(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create geographic area');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name?: string;
      areaType?: string;
      parentGeographicAreaId?: string;
      version?: number;
    }) => GeographicAreaService.updateGeographicArea(data.id, data),
    onSuccess: () => {
      // Set flag to bypass navigation guard
      setBypassNavigationGuard(true);
      
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      if (geographicArea?.id) {
        queryClient.invalidateQueries({ queryKey: ['geographicArea', geographicArea.id] });
        queryClient.invalidateQueries({ queryKey: ['geographicAreaChildren', geographicArea.id] });
        queryClient.invalidateQueries({ queryKey: ['geographicAreaAncestors', geographicArea.id] });
        queryClient.invalidateQueries({ queryKey: ['geographicAreaVenues', geographicArea.id] });
        queryClient.invalidateQueries({ queryKey: ['geographicAreaStatistics', geographicArea.id] });
      }
      
      onSuccess();
    },
    onError: (err: Error) => {
      setBypassNavigationGuard(false);
      if (!versionConflict.handleError(err)) {
        setError(err.message || 'Failed to update geographic area');
      }
    },
  });

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateAreaType = (value: string): boolean => {
    if (!value) {
      setAreaTypeError('Area type is required');
      return false;
    }
    setAreaTypeError('');
    return true;
  };

  const validateParent = (): boolean => {
    // Note: Circular relationship validation is handled by the backend
    setParentError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isNameValid = validateName(name);
    const isAreaTypeValid = validateAreaType(areaType);
    const isParentValid = validateParent();

    if (!isNameValid || !isAreaTypeValid || !isParentValid) {
      return;
    }

    // Set flag to bypass navigation guard during submission
    setBypassNavigationGuard(true);

    // Build update data - send null for cleared fields
    const data: any = {
      name: name.trim(),
      areaType,
    };

    // Handle parent: empty string means cleared (send null), non-empty means update
    if (parentGeographicAreaId) {
      data.parentGeographicAreaId = parentGeographicAreaId;
    } else if (geographicArea && geographicArea.parentGeographicAreaId) {
      // Field was cleared (had value, now empty)
      data.parentGeographicAreaId = null;
    }

    if (geographicArea) {
      updateMutation.mutate({
        id: geographicArea.id,
        ...data,
        version: getEntityVersion(geographicArea),
      });
    } else {
      try {
        await createMutation.mutateAsync(data);
      } catch (err: any) {
        setBypassNavigationGuard(false);
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCancelClick} disabled={isSubmitting} formAction="none">
                Cancel
              </Button>
              <Button variant="primary" loading={isSubmitting} disabled={isSubmitting} formAction="submit">
                {geographicArea ? 'Update' : 'Create'}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {error ? (
              <Alert key="error-alert" type="error" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            ) : null}
            <FormField key="name-field" label="Name" errorText={nameError} constraintText="Required">
              <Input
                value={name}
                onChange={({ detail }) => {
                  setName(detail.value);
                  if (nameError) validateName(detail.value);
                }}
                onBlur={() => validateName(name)}
                placeholder="Enter geographic area name"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField key="area-type-field" label="Area Type" errorText={areaTypeError} constraintText="Required">
              <Select
                selectedOption={areaTypeOptions.find((o) => o.value === areaType) || null}
                onChange={({ detail }) => {
                  setAreaType(detail.selectedOption.value || '');
                  if (areaTypeError) validateAreaType(detail.selectedOption.value || '');
                }}
                options={areaTypeOptions}
                placeholder="Select an area type"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField key="parent-field" label="Parent Geographic Area" errorText={parentError} constraintText="Optional">
              <AsyncEntitySelect
                value={parentGeographicAreaId}
                onChange={(value) => {
                  setParentGeographicAreaId(value);
                  if (parentError) validateParent();
                }}
                entityType="geographic-area"
                fetchFunction={async (params) => {
                  const data = await GeographicAreaService.getGeographicAreas(
                    params.page,
                    params.limit,
                    params.geographicAreaId,
                    params.search
                  );
                  // Filter out current area to prevent self-reference
                  const filtered = geographicArea 
                    ? data.filter((a) => a.id !== geographicArea.id)
                    : data;
                  return { data: filtered };
                }}
                formatOption={(area) => ({
                  value: area.id,
                  label: area.name,
                  description: area.areaType,
                })}
                placeholder="Search for parent area (optional)"
                disabled={isSubmitting}
                invalid={!!parentError}
                ariaLabel="Select parent geographic area"
                clearable={true}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </form>

      <VersionConflictModal
        visible={versionConflict.showConflictModal}
        conflictInfo={versionConflict.conflictInfo}
        onRetryWithLatest={versionConflict.handleRetryWithLatest}
        onDiscardChanges={versionConflict.handleDiscardChanges}
      />

      {/* Navigation guard confirmation dialog */}
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
    </>
  );
}
