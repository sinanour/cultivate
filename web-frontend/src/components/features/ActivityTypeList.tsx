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
import { ActivityType } from '../../types';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { ActivityTypeForm } from './ActivityTypeForm';
import { usePermissions } from '../../hooks/usePermissions';

export function ActivityTypeList() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: activityTypes = [], isLoading } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityTypeService.deleteActivityType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete activity type. It may be referenced by activities.');
    },
  });

  const handleEdit = (type: ActivityType) => {
    setSelectedType(type);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedType(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (type: ActivityType) => {
    if (window.confirm(`Are you sure you want to delete "${type.name}"?`)) {
      deleteMutation.mutate(type.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedType(null);
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
        items={activityTypes}
        loading={isLoading}
        loadingText="Loading activity types"
        empty={
          <Box textAlign="center" color="inherit">
            <b>No activity types</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No activity types to display.
            </Box>
            {canCreate() && (
              <Button onClick={handleCreate}>Create activity type</Button>
            )}
          </Box>
        }
        header={
          <Header
            counter={`(${activityTypes.length})`}
            actions={
              canCreate() && (
                <Button variant="primary" onClick={handleCreate}>
                  Create activity type
                </Button>
              )
            }
          >
            Activity Types
          </Header>
        }
      />
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        header={selectedType ? 'Edit Activity Type' : 'Create Activity Type'}
      >
        <ActivityTypeForm
          activityType={selectedType}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </SpaceBetween>
  );
}
