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
import { AssignmentService } from '../../services/api/assignment.service';
import { AssignmentForm } from './AssignmentForm';
import { usePermissions } from '../../hooks/usePermissions';

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [isAssignmentFormOpen, setIsAssignmentFormOpen] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => ActivityService.getActivity(id!),
    enabled: !!id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', id],
    queryFn: () => AssignmentService.getAssignments(id!),
    enabled: !!id,
  });

  const queryClient = useQueryClient();

  const markCompleteMutation = useMutation({
    mutationFn: (activityId: string) => ActivityService.markComplete(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (err: Error) => {
      setRemoveError(err.message || 'Failed to mark activity as complete');
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => AssignmentService.removeAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', id] });
      setRemoveError('');
    },
    onError: (err: Error) => {
      setRemoveError(err.message || 'Failed to remove assignment');
    },
  });

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !activity) {
    return (
      <Alert type="error">
        Failed to load activity details. {error instanceof Error ? error.message : ''}
      </Alert>
    );
  }

  const handleMarkComplete = () => {
    if (window.confirm(`Mark "${activity.name}" as complete?`)) {
      markCompleteMutation.mutate(activity.id);
    }
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    if (window.confirm('Remove this participant assignment?')) {
      removeAssignmentMutation.mutate(assignmentId);
    }
  };

  return (
    <SpaceBetween size="l">
      {removeError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setRemoveError('')}
        >
          {removeError}
        </Alert>
      )}
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {!activity.isOngoing && activity.status === 'ACTIVE' && canEdit() && (
                  <Button
                    onClick={handleMarkComplete}
                    loading={markCompleteMutation.isPending}
                  >
                    Mark Complete
                  </Button>
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
                <Badge color={activity.status === 'ACTIVE' ? 'green' : 'grey'}>
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

      {activity.venues && activity.venues.length > 0 && (
        <Container header={<Header variant="h3">Venue History</Header>}>
          <Table
            columnDefinitions={[
              {
                id: 'venue',
                header: 'Venue',
                cell: (item) => item.venue?.name || 'Unknown',
              },
              {
                id: 'address',
                header: 'Address',
                cell: (item) => item.venue?.address || '-',
              },
              {
                id: 'effectiveFrom',
                header: 'From',
                cell: (item) => new Date(item.effectiveFrom).toLocaleDateString(),
              },
              {
                id: 'effectiveTo',
                header: 'To',
                cell: (item) => item.effectiveTo ? new Date(item.effectiveTo).toLocaleDateString() : 'Current',
              },
            ]}
            items={activity.venues}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No venue history</b>
              </Box>
            }
          />
        </Container>
      )}

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
                      onClick={() => handleRemoveAssignment(item.id)}
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
        <AssignmentForm
          activityId={activity.id}
          existingAssignments={assignments}
          onSuccess={() => setIsAssignmentFormOpen(false)}
          onCancel={() => setIsAssignmentFormOpen(false)}
        />
      </Modal>
    </SpaceBetween>
  );
}
