import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import { ActivityService } from '../../services/api/activity.service';
import { VenueService } from '../../services/api/venue.service';
import type { Activity } from '../../types';
import { AssignmentService } from '../../services/api/assignment.service';
import { AssignmentForm } from './AssignmentForm';
import { ActivityVenueHistoryTable } from './ActivityVenueHistoryTable';
import { ActivityVenueHistoryForm } from './ActivityVenueHistoryForm';
import { usePermissions } from '../../hooks/usePermissions';

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const queryClient = useQueryClient();
  
  const [isAssignmentFormOpen, setIsAssignmentFormOpen] = useState(false);
  const [isVenueFormOpen, setIsVenueFormOpen] = useState(false);
  const [error, setError] = useState('');

  const { data: activity, isLoading, error: loadError } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => ActivityService.getActivity(id!),
    enabled: !!id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['activity-participants', id],
    queryFn: () => ActivityService.getActivityParticipants(id!),
    enabled: !!id,
  });

  const { data: venueHistory = [], isLoading: isLoadingVenues } = useQuery({
    queryKey: ['activity-venues', id],
    queryFn: () => ActivityService.getActivityVenues(id!),
    enabled: !!id,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => VenueService.getVenues(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: { id: string; status: string; version: number }) =>
      ActivityService.updateActivity(data.id, { status: data.status as Activity['status'], version: data.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update activity status');
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (participantId: string) =>
      AssignmentService.removeParticipant(id!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-participants', id] });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to remove assignment');
    },
  });

  const addVenueMutation = useMutation({
    mutationFn: (data: { venueId: string; effectiveFrom: string }) =>
      ActivityService.addActivityVenue(id!, data.venueId, data.effectiveFrom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-venues', id] });
      setIsVenueFormOpen(false);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to add venue association');
    },
  });

  const deleteVenueMutation = useMutation({
    mutationFn: (venueId: string) =>
      ActivityService.deleteActivityVenue(id!, venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-venues', id] });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to delete venue association');
    },
  });

  const handleUpdateStatus = (newStatus: string) => {
    if (window.confirm(`Update activity status to ${newStatus}?`)) {
      updateStatusMutation.mutate({
        id: activity!.id,
        status: newStatus,
        version: activity!.version,
      });
    }
  };

  const handleRemoveAssignment = (participantId: string) => {
    if (window.confirm('Remove this participant assignment?')) {
      removeAssignmentMutation.mutate(participantId);
    }
  };

  const handleAddVenue = () => {
    setIsVenueFormOpen(true);
  };

  const handleDeleteVenue = (venueId: string) => {
    if (window.confirm('Are you sure you want to remove this venue association?')) {
      deleteVenueMutation.mutate(venueId);
    }
  };

  const handleSubmitVenue = async (data: { venueId: string; effectiveFrom: string }) => {
    await addVenueMutation.mutateAsync(data);
  };

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError || !activity) {
    return (
      <Alert type="error">
        Failed to load activity details. {loadError instanceof Error ? loadError.message : ''}
      </Alert>
    );
  }

  const existingDates = venueHistory.map(v => v.effectiveFrom);

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
      
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <SpaceBetween direction="horizontal" size="xs">
                    {activity.status !== 'COMPLETED' && (
                      <Button
                        onClick={() => handleUpdateStatus('COMPLETED')}
                        loading={updateStatusMutation.isPending}
                      >
                        Mark Complete
                      </Button>
                    )}
                    {activity.status !== 'CANCELLED' && (
                      <Button
                        onClick={() => handleUpdateStatus('CANCELLED')}
                        loading={updateStatusMutation.isPending}
                      >
                        Cancel Activity
                      </Button>
                    )}
                    {activity.status !== 'ACTIVE' && (
                      <Button
                        onClick={() => handleUpdateStatus('ACTIVE')}
                        loading={updateStatusMutation.isPending}
                      >
                        Set Active
                      </Button>
                    )}
                  </SpaceBetween>
                )}
                <Button onClick={() => navigate('/activities')}>
                  Back to Activities
                </Button>
              </SpaceBetween>
            }
          >
            {activity.name}
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Activity Type</Box>
            <div>{activity.activityType?.name || '-'}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Status</Box>
            <div>
              <SpaceBetween direction="horizontal" size="xs">
                <Badge
                  color={
                    activity.status === 'PLANNED'
                      ? 'blue'
                      : activity.status === 'ACTIVE'
                      ? 'green'
                      : activity.status === 'CANCELLED'
                      ? 'red'
                      : 'grey'
                  }
                >
                  {activity.status}
                </Badge>
                {activity.isOngoing && <Badge color="blue">Ongoing</Badge>}
              </SpaceBetween>
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Start Date</Box>
            <div>{new Date(activity.startDate).toLocaleDateString()}</div>
          </div>
          {activity.endDate && (
            <div>
              <Box variant="awsui-key-label">End Date</Box>
              <div>{new Date(activity.endDate).toLocaleDateString()}</div>
            </div>
          )}
          <div>
            <Box variant="awsui-key-label">Created</Box>
            <div>{new Date(activity.createdAt).toLocaleDateString()}</div>
          </div>
        </ColumnLayout>
      </Container>

      <Container
        header={
          <Header
            variant="h3"
            actions={
              canEdit() && (
                <Button onClick={handleAddVenue}>
                  Add Venue
                </Button>
              )
            }
          >
            Venue History
          </Header>
        }
      >
        <ActivityVenueHistoryTable
          venueHistory={venueHistory}
          onDelete={handleDeleteVenue}
          loading={isLoadingVenues}
        />
      </Container>

      <Container
        header={
          <Header
            variant="h3"
            actions={
              canEdit() && (
                <Button onClick={() => setIsAssignmentFormOpen(true)}>
                  Assign Participant
                </Button>
              )
            }
          >
            Assigned Participants
          </Header>
        }
      >
        {assignments.length > 0 ? (
          <Table
            columnDefinitions={[
              {
                id: 'participant',
                header: 'Participant',
                cell: (item) => item.participant?.name || 'Unknown',
              },
              {
                id: 'email',
                header: 'Email',
                cell: (item) => item.participant?.email || '-',
              },
              {
                id: 'role',
                header: 'Role',
                cell: (item) => item.role?.name || '-',
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: (item) => (
                  canEdit() && (
                    <Button
                      variant="inline-link"
                      onClick={() => handleRemoveAssignment(item.participantId)}
                    >
                      Remove
                    </Button>
                  )
                ),
              },
            ]}
            items={assignments}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No assignments</b>
              </Box>
            }
          />
        ) : (
          <Box textAlign="center" color="inherit">
            <b>No assigned participants</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No participants are assigned to this activity.
            </Box>
            {canEdit() && (
              <Button onClick={() => setIsAssignmentFormOpen(true)}>
                Assign Participant
              </Button>
            )}
          </Box>
        )}
      </Container>

      <Modal
        visible={isAssignmentFormOpen}
        onDismiss={() => setIsAssignmentFormOpen(false)}
        header="Assign Participant"
      >
        {isAssignmentFormOpen && (
          <AssignmentForm
            activityId={activity.id}
            existingAssignments={assignments}
            onSuccess={() => setIsAssignmentFormOpen(false)}
            onCancel={() => setIsAssignmentFormOpen(false)}
          />
        )}
      </Modal>

      <ActivityVenueHistoryForm
        visible={isVenueFormOpen}
        onDismiss={() => setIsVenueFormOpen(false)}
        onSubmit={handleSubmitVenue}
        venues={venues}
        existingDates={existingDates}
        loading={addVenueMutation.isPending}
      />
    </SpaceBetween>
  );
}
