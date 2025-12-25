import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { GeographicArea, AreaType } from '../../types';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { isCircularRelationship } from '../../utils/tree.utils';

interface GeographicAreaFormProps {
  geographicArea: GeographicArea | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function GeographicAreaForm({ geographicArea, onSuccess, onCancel }: GeographicAreaFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(geographicArea?.name || '');
  const [areaType, setAreaType] = useState(geographicArea?.areaType || '');
  const [parentGeographicAreaId, setParentGeographicAreaId] = useState(geographicArea?.parentGeographicAreaId || '');
  
  const [nameError, setNameError] = useState('');
  const [areaTypeError, setAreaTypeError] = useState('');
  const [parentError, setParentError] = useState('');
  const [error, setError] = useState('');

  const { data: geographicAreas = [] } = useQuery({
    queryKey: ['geographicAreas'],
    queryFn: () => GeographicAreaService.getGeographicAreas(),
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

  const parentOptions = [
    { label: 'No parent (root level)', value: '' },
    ...geographicAreas
      .filter((a) => a.id !== geographicArea?.id) // Can't be parent of itself
      .map((area) => ({
        label: area.name,
        value: area.id,
      })),
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
      name: string;
      areaType: string;
      parentGeographicAreaId?: string;
    }) =>
      GeographicAreaService.updateGeographicArea(data.id, {
        name: data.name,
        areaType: data.areaType,
        parentGeographicAreaId: data.parentGeographicAreaId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update geographic area');
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

  const validateParent = (value: string): boolean => {
    if (!value) {
      setParentError('');
      return true; // Optional field
    }
    
    // Check for circular relationship
    if (geographicArea && isCircularRelationship(geographicArea.id, value, geographicAreas)) {
      setParentError('Cannot create circular relationship: selected parent is a descendant of this area');
      return false;
    }
    
    setParentError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isNameValid = validateName(name);
    const isAreaTypeValid = validateAreaType(areaType);
    const isParentValid = validateParent(parentGeographicAreaId);

    if (!isNameValid || !isAreaTypeValid || !isParentValid) {
      return;
    }

    const data = {
      name: name.trim(),
      areaType,
      parentGeographicAreaId: parentGeographicAreaId || undefined,
    };

    if (geographicArea) {
      updateMutation.mutate({ id: geographicArea.id, ...data });
    } else {
      createMutation.mutate(data);
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
              {geographicArea ? 'Update' : 'Create'}
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
          <FormField label="Name" errorText={nameError} constraintText="Required">
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
          <FormField label="Area Type" errorText={areaTypeError} constraintText="Required">
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
          <FormField label="Parent Geographic Area" errorText={parentError} constraintText="Optional">
            <Select
              selectedOption={parentOptions.find((o) => o.value === parentGeographicAreaId) || parentOptions[0]}
              onChange={({ detail }) => {
                setParentGeographicAreaId(detail.selectedOption.value || '');
                if (parentError) validateParent(detail.selectedOption.value || '');
              }}
              options={parentOptions}
              disabled={isSubmitting}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
