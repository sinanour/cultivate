import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Select from '@cloudscape-design/components/select';
import Textarea from '@cloudscape-design/components/textarea';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { Assignment } from '../../types';
import { AssignmentService } from '../../services/api/assignment.service';
import { ParticipantService } from '../../services/api/participant.service';
import { ParticipantRoleService } from '../../services/api/participant-role.service';
import { AsyncEntitySelect } from '../common/AsyncEntitySelect';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { useAuth } from '../../hooks/useAuth';

interface AssignmentFormProps {
  activityId: string;
  existingAssignments: Assignment[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function AssignmentForm({ activityId, existingAssignments, onSuccess, onCancel }: AssignmentFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [participantId, setParticipantId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [notes, setNotes] = useState('');
  
  const [participantError, setParticipantError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [error, setError] = useState('');
  const [isRefreshingParticipants, setIsRefreshingParticipants] = useState(false);
  const [isRefreshingRoles, setIsRefreshingRoles] = useState(false);

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['participantRoles'],
    queryFn: () => ParticipantRoleService.getRoles(),
  });

  const roleOptions = roles.map((r) => ({
    label: r.name,
    value: r.id,
  }));

  const handleRefreshParticipants = async () => {
    setIsRefreshingParticipants(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['participants'] });
    } finally {
      setIsRefreshingParticipants(false);
    }
  };

  const handleRefreshRoles = async () => {
    setIsRefreshingRoles(true);
    try {
      await refetchRoles();
    } finally {
      setIsRefreshingRoles(false);
    }
  };

  const canAddParticipant = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';
  const canAddRole = user?.role === 'ADMINISTRATOR';

  const assignMutation = useMutation({
    mutationFn: (data: {
      activityId: string;
      participantId: string;
      roleId: string;
      notes?: string;
    }) => AssignmentService.addParticipant(data.activityId, data.participantId, data.roleId, data.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-participants', activityId] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to assign participant');
    },
  });

  const validateParticipant = (value: string): boolean => {
    if (!value) {
      setParticipantError('Participant is required');
      return false;
    }
    setParticipantError('');
    return true;
  };

  const validateRole = (value: string): boolean => {
    if (!value) {
      setRoleError('Role is required');
      return false;
    }
    setRoleError('');
    return true;
  };

  const checkDuplicate = (pId: string, rId: string): boolean => {
    const duplicate = existingAssignments.find(
      (a) => a.participantId === pId && a.roleId === rId
    );
    if (duplicate) {
      setError('This participant is already assigned with this role');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isParticipantValid = validateParticipant(participantId);
    const isRoleValid = validateRole(roleId);

    if (!isParticipantValid || !isRoleValid) {
      return;
    }

    if (!checkDuplicate(participantId, roleId)) {
      return;
    }

    assignMutation.mutate({
      activityId,
      participantId,
      roleId,
      notes: notes.trim() || undefined,
    });
  };

  const isSubmitting = assignMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} disabled={isSubmitting} formAction="submit">
              Assign
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
          <FormField label="Participant" errorText={participantError} constraintText="Required">
            <EntitySelectorWithActions
              onRefresh={handleRefreshParticipants}
              addEntityUrl="/participants/new"
              canAdd={canAddParticipant}
              isRefreshing={isRefreshingParticipants}
              entityTypeName="participant"
            >
              <AsyncEntitySelect
                value={participantId}
                onChange={(value) => {
                  setParticipantId(value);
                  if (participantError) validateParticipant(value);
                }}
                entityType="participant"
                fetchFunction={async (params) => {
                  const data = await ParticipantService.getParticipants(
                    params.page,
                    params.limit,
                    params.geographicAreaId,
                    params.search
                  );
                  return { data };
                }}
                formatOption={(p) => ({
                  value: p.id,
                  label: p.name,
                  description: p.email,
                })}
                placeholder="Search for a participant"
                disabled={isSubmitting}
                invalid={!!participantError}
                ariaLabel="Select participant"
              />
            </EntitySelectorWithActions>
          </FormField>
          <FormField label="Role" errorText={roleError} constraintText="Required">
            <EntitySelectorWithActions
              onRefresh={handleRefreshRoles}
              addEntityUrl="/configuration"
              canAdd={canAddRole}
              isRefreshing={isRefreshingRoles}
              entityTypeName="role"
            >
              <Select
                selectedOption={roleOptions.find((o) => o.value === roleId) || null}
                onChange={({ detail }) => {
                  setRoleId(detail.selectedOption.value || '');
                  if (roleError) validateRole(detail.selectedOption.value || '');
                }}
                options={roleOptions}
                placeholder="Select a role"
                disabled={isSubmitting}
                empty="No roles available"
              />
            </EntitySelectorWithActions>
          </FormField>
          <FormField label="Notes" constraintText="Optional">
            <Textarea
              value={notes}
              onChange={({ detail }) => setNotes(detail.value)}
              placeholder="Enter any notes about this assignment"
              disabled={isSubmitting}
              rows={3}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
