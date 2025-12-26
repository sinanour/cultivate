import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { ParticipantRole } from '../../types';
import { ParticipantRoleService } from '../../services/api/participant-role.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import {
    isVersionConflict,
    extractVersionConflictInfo,
    getEntityVersion,
    type VersionConflictInfo,
} from '../../utils/version-conflict.utils';

interface ParticipantRoleFormProps {
  role: ParticipantRole | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ParticipantRoleForm({ role, onSuccess, onCancel }: ParticipantRoleFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name || '');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [conflictInfo, setConflictInfo] = useState<VersionConflictInfo | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => ParticipantRoleService.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create participant role');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; version?: number }) =>
      ParticipantRoleService.updateRole(data.id, { name: data.name, version: data.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
      onSuccess();
    },
    onError: (err: any) => {
      if (isVersionConflict(err)) {
        const info = extractVersionConflictInfo(err);
        setConflictInfo(info);
        setShowConflictModal(true);
        console.error('Version conflict:', info);
      } else {
        setError(err.message || 'Failed to update participant role');
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

    if (role) {
      updateMutation.mutate({
        id: role.id,
        name: name.trim(),
        version: getEntityVersion(role),
      });
    } else {
      createMutation.mutate({ name: name.trim() });
    }
  };

  const handleRetryWithLatest = async () => {
    setShowConflictModal(false);
    setConflictInfo(null);
    await queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
    onCancel();
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
                {role ? 'Update' : 'Create'}
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
                placeholder="Enter participant role name"
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
