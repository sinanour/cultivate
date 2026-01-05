import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Alert from '@cloudscape-design/components/alert';
import type { User } from '../../types';
import { UserService } from '../../services/api/user.service';

export function UserList() {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => UserService.getUsers(),
  });

  const handleCreate = () => {
    navigate('/users/new');
  };

  const handleEdit = (user: User) => {
    navigate(`/users/${user.id}/edit`);
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

  const getDisplayName = (user: User) => {
    return user.displayName || user.email;
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
                {item.role}
              </Badge>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => handleEdit(item)}>
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
    </SpaceBetween>
  );
}
