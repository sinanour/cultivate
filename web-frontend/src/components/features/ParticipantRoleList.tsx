import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import Link from '@cloudscape-design/components/link';
import type { ParticipantRole } from '../../types';
import { ParticipantRoleService } from '../../services/api/participant-role.service';
import { ParticipantRoleForm } from './ParticipantRoleForm';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { usePermissions } from '../../hooks/usePermissions';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

export function ParticipantRoleList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<ParticipantRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ParticipantRole | null>(null);

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
      setDeleteError(error.message || 'Failed to remove role. It may be referenced by assignments.');
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

  const handleDelete = (role: ParticipantRole) => {
    setConfirmDelete(role);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
      setConfirmDelete(null);
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
        wrapLines={false}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Link
                onFollow={(e) => {
                  e.preventDefault();
                  const encodedName = encodeURIComponent(item.name).replace(/%20/g, '+');
                  navigate(`/participants?filter_role=${encodedName}`);
                }}
              >
                {item.name}
              </Link>
            ),
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
                    variant="normal"
                    iconName="edit"
                    onClick={() => handleEdit(item)}
                    ariaLabel={`Edit ${item.name}`}
                  />
                )}
                {canDelete() && !item.isPredefined && (
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => handleDelete(item)}
                    ariaLabel={`Remove ${item.name}`}
                  />
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
              <ResponsiveButton 
                onClick={handleCreate}
                mobileIcon="add-plus"
                mobileAriaLabel="Create new participant role"
              >
                Create participant role
              </ResponsiveButton>
            )}
          </Box>
        }
        header={
          <Header
            counter={`(${roles.length})`}
            actions={
              canCreate() && (
                <ResponsiveButton 
                  onClick={handleCreate}
                  mobileIcon="add-plus"
                  mobileAriaLabel="Create new participant role"
                >
                  Create participant role
                </ResponsiveButton>
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
        {isFormOpen && (
          <ParticipantRoleForm
            role={selectedRole}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        )}
      </Modal>
      <ConfirmationDialog
        visible={confirmDelete !== null}
        title="Remove Participant Role"
        message={`Are you sure you want to remove "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </SpaceBetween>
  );
}
