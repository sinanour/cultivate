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
    mutationFn: (data: { id: string; name: string }) =>
      ParticipantRoleService.updateRole(data.id, { name: data.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update participant role');
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
      updateMutation.mutate({ id: role.id, name: name.trim() });
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
  );
}
