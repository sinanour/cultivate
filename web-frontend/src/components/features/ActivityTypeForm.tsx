import { useState, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import { ActivityType } from '../../types';
import { ActivityTypeService } from '../../services/api/activity-type.service';

interface ActivityTypeFormProps {
  activityType: ActivityType | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ActivityTypeForm({ activityType, onSuccess, onCancel }: ActivityTypeFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(activityType?.name || '');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => ActivityTypeService.createActivityType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create activity type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string }) =>
      ActivityTypeService.updateActivityType(data.id, { name: data.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update activity type');
    },
  });

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameError('Name is required and cannot be empty or whitespace');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateName(name)) {
      return;
    }

    if (activityType) {
      updateMutation.mutate({ id: activityType.id, name: name.trim() });
    } else {
      createMutation.mutate({ name: name.trim() });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" loading={isLoading} disabled={isLoading} formAction="submit">
              {activityType ? 'Update' : 'Create'}
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
          <FormField label="Name" errorText={nameError}>
            <Input
              value={name}
              onChange={({ detail }) => {
                setName(detail.value);
                if (nameError) validateName(detail.value);
              }}
              onBlur={() => validateName(name)}
              placeholder="Enter activity type name"
              disabled={isLoading}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
