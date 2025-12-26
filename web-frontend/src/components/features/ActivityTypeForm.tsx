import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { ActivityType } from '../../types';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import {
    isVersionConflict,
    extractVersionConflictInfo,
    getEntityVersion,
    type VersionConflictInfo,
} from '../../utils/version-conflict.utils';

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
  const [conflictInfo, setConflictInfo] = useState<VersionConflictInfo | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

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
    mutationFn: (data: { id: string; name: string; version?: number }) =>
      ActivityTypeService.updateActivityType(data.id, { name: data.name, version: data.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      onSuccess();
    },
    onError: (err: any) => {
      if (isVersionConflict(err)) {
        const info = extractVersionConflictInfo(err);
        setConflictInfo(info);
        setShowConflictModal(true);
        console.error('Version conflict:', info);
      } else {
        setError(err.message || 'Failed to update activity type');
      }
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
      updateMutation.mutate({
        id: activityType.id,
        name: name.trim(),
        version: getEntityVersion(activityType),
      });
    } else {
      createMutation.mutate({ name: name.trim() });
    }
  };

  const handleRetryWithLatest = async () => {
    setShowConflictModal(false);
    setConflictInfo(null);
    // Refetch the latest data
    await queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
    // The parent component should refetch and pass the latest activityType
    onCancel(); // Close the form so user can reopen with latest data
  };

  const handleDiscardChanges = () => {
    setShowConflictModal(false);
    setConflictInfo(null);
    onCancel();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
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

      <VersionConflictModal
        visible={showConflictModal}
        conflictInfo={conflictInfo}
        onRetryWithLatest={handleRetryWithLatest}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}
