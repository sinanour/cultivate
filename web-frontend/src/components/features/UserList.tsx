import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Alert from '@cloudscape-design/components/alert';
import Modal from '@cloudscape-design/components/modal';
import type { User } from '../../types';
import { UserService } from '../../services/api/user.service';
import { useNotification } from '../../hooks/useNotification';

export function UserList() {
  const [error, setError] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => UserService.getUsers(),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => UserService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User deleted successfully');
      setShowDeleteConfirmation(false);
      setUserToDelete(null);
    },
    onError: (err: Error) => {
      const message = err.message || 'Failed to delete user';
      setError(message);
      showError(message);
      setShowDeleteConfirmation(false);
      setUserToDelete(null);
    },
  });

  const handleCreate = () => {
    navigate('/users/new');
  };

  const handleEdit = (user: User) => {
    navigate(`/users/${user.id}/edit`);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setUserToDelete(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return 'red';
      case 'EDITOR':
        return 'blue';
      case 'READ_ONLY':
        return 'grey';
      default:
        return 'grey';
    }
  };

  const formatRoleDisplay = (role: string) => {
    switch (role) {
      case 'READ_ONLY':
        return 'READ ONLY';
      case 'ADMINISTRATOR':
        return 'ADMINISTRATOR';
      case 'EDITOR':
        return 'EDITOR';
      default:
        return role;
    }
  };

  const getDisplayName = (user: User) => {
    return user.displayName || user.email;
  };

  return (
    <>
      <SpaceBetween size="l">
        {error && (
          <Alert
            type="error"
            dismissible
            onDismiss={() => setError('')}
          >
            {error}
          </Alert>
        )}
        <Table
          wrapLines={false}
          columnDefinitions={[
            {
              id: 'displayName',
              header: 'Name',
              cell: (item) => (
                <Link onFollow={() => handleEdit(item)}>
                  {getDisplayName(item)}
                </Link>
              ),
              sortingField: 'displayName',
            },
            {
              id: 'email',
              header: 'Email',
              cell: (item) => item.email,
              sortingField: 'email',
            },
            {
              id: 'role',
              header: 'Role',
              cell: (item) => (
                <Badge color={getRoleBadgeColor(item.role)}>
                  {formatRoleDisplay(item.role)}
                </Badge>
              ),
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: (item) => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button 
                    variant="inline-link" 
                    iconName="edit"
                    onClick={() => handleEdit(item)}
                    ariaLabel={`Edit ${getDisplayName(item)}`}
                  />
                  <Button 
                    variant="inline-link" 
                    iconName="remove"
                    onClick={() => handleDeleteClick(item)}
                    ariaLabel={`Remove ${getDisplayName(item)}`}
                  />
                </SpaceBetween>
              ),
            },
          ]}
          items={users}
          loading={isLoading}
          loadingText="Loading users"
          sortingDisabled
          empty={
            <Box textAlign="center" color="inherit">
              <b>No users</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                No users to display.
              </Box>
              <Button onClick={handleCreate}>Create user</Button>
            </Box>
          }
          header={
            <Header
              counter={`(${users.length})`}
              actions={
                <Button variant="primary" onClick={handleCreate}>
                  Create user
                </Button>
              }
            >
              Users
            </Header>
          }
        />
      </SpaceBetween>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmation}
        onDismiss={handleCancelDelete}
        header="Remove User"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCancelDelete}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleConfirmDelete}
                loading={deleteMutation.isPending}
              >
                Remove
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Are you sure you want to delete user <strong>{userToDelete ? getDisplayName(userToDelete) : ''}</strong>? 
        This action cannot be undone.
      </Modal>
    </>
  );
}
