import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
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

  // Update form state when geographicArea prop changes
  useEffect(() => {
    if (geographicArea) {
      setName(geographicArea.name || '');
      setAreaType(geographicArea.areaType || '');
      setParentGeographicAreaId(geographicArea.parentGeographicAreaId || '');
    } else {
      // Reset to defaults for create mode
      setName('');
      setAreaType('');
      setParentGeographicAreaId('');
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
    { label: 'Custom', value: 'CUSTOM' },
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
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      onSuccess();
    },
    onError: (err: Error) => {
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

    const data = {
      name: name.trim(),
      areaType,
      parentGeographicAreaId: parentGeographicAreaId || undefined,
    };

    if (geographicArea) {
      updateMutation.mutate({
        id: geographicArea.id,
        ...data,
        version: getEntityVersion(geographicArea),
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onCancel} disabled={isSubmitting}>
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
    </>
  );
}
