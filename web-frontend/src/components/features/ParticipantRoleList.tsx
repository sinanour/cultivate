import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import type { ParticipantRole } from '../../types';
import { ParticipantRoleService } from '../../services/api/participant-role.service';
import { ParticipantRoleForm } from './ParticipantRoleForm';
import { usePermissions } from '../../hooks/usePermissions';

export function ParticipantRoleList() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<ParticipantRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['participantRoles'],
    queryFn: () => ParticipantRoleService.getRoles(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ParticipantRoleService.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete role. It may be referenced by assignments.');
    },
  });

  const handleEdit = (role: ParticipantRole) => {
    setSelectedRole(role);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedRole(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (role: ParticipantRole) => {
    if (window.confirm(`Are you sure you want to delete "${role.name}"?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedRole(null);
  };

  return (
    <SpaceBetween size="l">
      {deleteError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setDeleteError('')}
        >
          {deleteError}
        </Alert>
      )}
      <Table
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => item.name,
            sortingField: 'name',
          },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => (
              <Badge color={item.isPredefined ? 'blue' : 'grey'}>
                {item.isPredefined ? 'Predefined' : 'Custom'}
              </Badge>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </Button>
                )}
                {canDelete() && !item.isPredefined && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleDelete(item)}
                  >
                    Delete
                  </Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={roles}
        loading={isLoading}
        loadingText="Loading participant roles"
        empty={
          <Box textAlign="center" color="inherit">
            <b>No participant roles</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No participant roles to display.
            </Box>
            {canCreate() && (
              <Button onClick={handleCreate}>Create participant role</Button>
            )}
          </Box>
        }
        header={
          <Header
            counter={`(${roles.length})`}
            actions={
              canCreate() && (
                <Button variant="primary" onClick={handleCreate}>
                  Create participant role
                </Button>
              )
            }
          >
            Participant Roles
          </Header>
        }
      />
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        header={selectedRole ? 'Edit Participant Role' : 'Create Participant Role'}
      >
        <ParticipantRoleForm
          role={selectedRole}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </SpaceBetween>
  );
}
