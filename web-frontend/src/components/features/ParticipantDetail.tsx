import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import Badge from '@cloudscape-design/components/badge';
import { ParticipantService } from '../../services/api/participant.service';
import { ParticipantAddressHistoryService } from '../../services/api/participant-address-history.service';
import { VenueService } from '../../services/api/venue.service';
import { AddressHistoryTable } from './AddressHistoryTable';
import { AddressHistoryForm } from './AddressHistoryForm';
import { ParticipantForm } from './ParticipantForm';
import { usePermissions } from '../../hooks/usePermissions';
import type { ParticipantAddressHistory } from '../../types';
import { formatDate } from '../../utils/date.utils';
import Modal from '@cloudscape-design/components/modal';

export function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const queryClient = useQueryClient();
  
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ParticipantAddressHistory | undefined>();
  const [error, setError] = useState('');

  const { data: participant, isLoading, error: loadError } = useQuery({
    queryKey: ['participant', id],
    queryFn: () => ParticipantService.getParticipant(id!),
    enabled: !!id,
  });

  const { data: addressHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['participantAddressHistory', id],
    queryFn: () => ParticipantAddressHistoryService.getAddressHistory(id!),
    enabled: !!id,
  });

  const { data: activities = [], isLoading: isLoadingActivities } = useQuery({
    queryKey: ['participantActivities', id],
    queryFn: () => ParticipantService.getParticipantActivities(id!),
    enabled: !!id,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => VenueService.getVenues(),
  });

  const createAddressMutation = useMutation({
    mutationFn: (data: { venueId: string; effectiveFrom: string }) =>
      ParticipantAddressHistoryService.createAddressHistory(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantAddressHistory', id] });
      setIsAddressFormOpen(false);
      setEditingAddress(undefined);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to add address history');
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: (data: { historyId: string; venueId: string; effectiveFrom: string }) =>
      ParticipantAddressHistoryService.updateAddressHistory(id!, data.historyId, {
        venueId: data.venueId,
        effectiveFrom: data.effectiveFrom,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantAddressHistory', id] });
      setIsAddressFormOpen(false);
      setEditingAddress(undefined);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update address history');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (historyId: string) =>
      ParticipantAddressHistoryService.deleteAddressHistory(id!, historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantAddressHistory', id] });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to delete address history');
    },
  });

  const handleAddAddress = () => {
    setEditingAddress(undefined);
    setIsAddressFormOpen(true);
  };

  const handleEditAddress = (record: ParticipantAddressHistory) => {
    setEditingAddress(record);
    setIsAddressFormOpen(true);
  };

  const handleDeleteAddress = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this address history record?')) {
      deleteAddressMutation.mutate(recordId);
    }
  };

  const handleSubmitAddress = async (data: { venueId: string; effectiveFrom: string }) => {
    if (editingAddress) {
      await updateAddressMutation.mutateAsync({
        historyId: editingAddress.id,
        ...data,
      });
    } else {
      await createAddressMutation.mutateAsync(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'blue';
      case 'ACTIVE': return 'green';
      case 'COMPLETED': return 'grey';
      case 'CANCELLED': return 'red';
      default: return 'grey';
    }
  };

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError || !participant) {
    return (
      <Alert type="error">
        Failed to load participant details. {loadError instanceof Error ? loadError.message : ''}
      </Alert>
    );
  }

  const existingDates = addressHistory.map(h => h.effectiveFrom);

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
                  <Button variant="primary" onClick={() => setIsEditFormOpen(true)}>
                    Edit
                  </Button>
                )}
                <Button onClick={() => navigate('/participants')}>
                  Back to Participants
                </Button>
              </SpaceBetween>
            }
          >
            {participant.name}
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Email</Box>
            <div>{participant.email}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Phone</Box>
            <div>{participant.phone || '-'}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Created</Box>
            <div>{formatDate(participant.createdAt)}</div>
          </div>
          {participant.notes && (
            <div>
              <Box variant="awsui-key-label">Notes</Box>
              <div>{participant.notes}</div>
            </div>
          )}
        </ColumnLayout>
      </Container>

      <Container
        header={
          <Header
            variant="h3"
            actions={
              canEdit() && (
                <Button onClick={handleAddAddress}>
                  Add Address History
                </Button>
              )
            }
          >
            Address History
          </Header>
        }
      >
        <AddressHistoryTable
          addressHistory={addressHistory}
          onEdit={handleEditAddress}
          onDelete={handleDeleteAddress}
          loading={isLoadingHistory}
        />
      </Container>

      <Container header={<Header variant="h3">Activities</Header>}>
        {isLoadingActivities ? (
          <Box textAlign="center" padding="xxl">
            <Spinner size="large" />
          </Box>
        ) : activities.length === 0 ? (
          <Box textAlign="center" color="inherit">
            <Box variant="p" color="inherit">
              No activity assignments found.
            </Box>
          </Box>
        ) : (
          <Table
            columnDefinitions={[
              {
                id: 'activity',
                header: 'Activity',
                cell: (item) => (
                  <Link href={`/activities/${item.activityId}`}>
                    {item.activity?.name || 'Unknown'}
                  </Link>
                ),
              },
              {
                id: 'type',
                header: 'Type',
                cell: (item) => item.activity?.activityType?.name || '-',
              },
              {
                id: 'role',
                header: 'Role',
                cell: (item) => item.role?.name || '-',
              },
              {
                id: 'status',
                header: 'Status',
                cell: (item) => item.activity ? (
                  <Badge color={getStatusColor(item.activity.status)}>
                    {item.activity.status}
                  </Badge>
                ) : '-',
              },
              {
                id: 'dates',
                header: 'Dates',
                cell: (item) => {
                  if (!item.activity) return '-';
                  if (item.activity.isOngoing) {
                    return `${formatDate(item.activity.startDate)} - Ongoing`;
                  }
                  return `${formatDate(item.activity.startDate)} - ${formatDate(item.activity.endDate)}`;
                },
              },
              {
                id: 'notes',
                header: 'Notes',
                cell: (item) => item.notes || '-',
              },
            ]}
            items={activities}
            variant="embedded"
            empty={
              <Box textAlign="center" color="inherit">
                <b>No activities</b>
                <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                  This participant is not assigned to any activities.
                </Box>
              </Box>
            }
          />
        )}
      </Container>

      <AddressHistoryForm
        visible={isAddressFormOpen}
        onDismiss={() => {
          setIsAddressFormOpen(false);
          setEditingAddress(undefined);
        }}
        onSubmit={handleSubmitAddress}
        venues={venues}
        existingRecord={editingAddress}
        existingDates={existingDates}
        loading={createAddressMutation.isPending || updateAddressMutation.isPending}
      />

      <Modal
        visible={isEditFormOpen}
        onDismiss={() => setIsEditFormOpen(false)}
        header="Edit Participant"
      >
        {isEditFormOpen && (
          <ParticipantForm
            participant={participant}
            onSuccess={() => {
              setIsEditFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ['participant', id] });
            }}
            onCancel={() => setIsEditFormOpen(false)}
          />
        )}
      </Modal>
    </SpaceBetween>
  );
}
