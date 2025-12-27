import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Select from '@cloudscape-design/components/select';
import Pagination from '@cloudscape-design/components/pagination';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import type { Activity } from '../../types';
import { ActivityService } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { ActivityForm } from './ActivityForm';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '../../utils/date.utils';

const ITEMS_PER_PAGE = 10;

export function ActivityList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => ActivityService.getActivities(),
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete activity.');
    },
  });

  // Filtering
  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    if (typeFilter) {
      filtered = filtered.filter((a) => a.activityTypeId === typeFilter);
    }
    
    if (statusFilter) {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }
    
    return filtered;
  }, [activities, typeFilter, statusFilter]);

  // Pagination
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredActivities, currentPageIndex]);

  const typeFilterOptions = [
    { label: 'All types', value: '' },
    ...activityTypes.map((t) => ({ label: t.name, value: t.id })),
  ];

  const statusFilterOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Planned', value: 'PLANNED' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  const handleEdit = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedActivity(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (activity: Activity) => {
    if (window.confirm(`Are you sure you want to delete "${activity.name}"?`)) {
      deleteMutation.mutate(activity.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedActivity(null);
  };

  const handleViewDetails = (activity: Activity) => {
    navigate(`/activities/${activity.id}`);
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
            cell: (item) => item.activityType?.name || '-',
          },
          {
            id: 'dates',
            header: 'Dates',
            cell: (item) => {
              const start = formatDate(item.startDate);
              const end = item.endDate ? formatDate(item.endDate) : 'Ongoing';
              return `${start} - ${end}`;
            },
          },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => {
              const statusColors: Record<string, 'green' | 'grey' | 'blue' | 'red'> = {
                PLANNED: 'blue',
                ACTIVE: 'green',
                COMPLETED: 'grey',
                CANCELLED: 'red',
              };
              return (
                <SpaceBetween direction="horizontal" size="xs">
                  <Badge color={statusColors[item.status] || 'grey'}>
                    {item.status}
                  </Badge>
                  {item.isOngoing && <Badge color="blue">Ongoing</Badge>}
                </SpaceBetween>
              );
            },
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="inline-link"
                  onClick={() => handleViewDetails(item)}
                >
                  View
                </Button>
                {canEdit() && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </Button>
                )}
                {canDelete() && (
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
        items={paginatedActivities}
        loading={isLoading}
        loadingText="Loading activities"
        sortingDisabled
        empty={
          <Box textAlign="center" color="inherit">
            <b>No activities</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              {typeFilter || statusFilter ? 'No activities match your filters.' : 'No activities to display.'}
            </Box>
            {canCreate() && !typeFilter && !statusFilter && (
              <Button onClick={handleCreate}>Create activity</Button>
            )}
          </Box>
        }
        filter={
          <SpaceBetween direction="horizontal" size="s">
            <Select
              selectedOption={typeFilterOptions.find((o) => o.value === typeFilter) || typeFilterOptions[0]}
              onChange={({ detail }) => {
                setTypeFilter(detail.selectedOption.value || '');
                setCurrentPageIndex(1);
              }}
              options={typeFilterOptions}
            />
            <Select
              selectedOption={statusFilterOptions.find((o) => o.value === statusFilter) || statusFilterOptions[0]}
              onChange={({ detail }) => {
                setStatusFilter(detail.selectedOption.value || '');
                setCurrentPageIndex(1);
              }}
              options={statusFilterOptions}
            />
          </SpaceBetween>
        }
        header={
          <Header
            counter={`(${filteredActivities.length})`}
            actions={
              canCreate() && (
                <Button variant="primary" onClick={handleCreate}>
                  Create activity
                </Button>
              )
            }
          >
            Activities
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={Math.ceil(filteredActivities.length / ITEMS_PER_PAGE)}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
          />
        }
      />
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        size="large"
        header={selectedActivity ? 'Edit Activity' : 'Create Activity'}
      >
        {isFormOpen && (
          <ActivityForm
            activity={selectedActivity}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        )}
      </Modal>
    </SpaceBetween>
  );
}
