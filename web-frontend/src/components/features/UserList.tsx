import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import type { User } from '../../types';
import { UserService } from '../../services/api/user.service';
import { UserForm } from './UserForm';

export function UserList() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => UserService.getUsers(),
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
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

  return (
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
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => item.name,
            sortingField: 'name',
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
                {item.role}
              </Badge>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <Button
                variant="inline-link"
                onClick={() => handleEdit(item)}
              >
                Edit
              </Button>
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
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        size="medium"
        header={selectedUser ? 'Edit User' : 'Create User'}
      >
        <UserForm
          user={selectedUser}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </SpaceBetween>
  );
}
