import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import Badge from '@cloudscape-design/components/badge';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import { ParticipantService } from '../../services/api/participant.service';
import { ParticipantAddressHistoryService } from '../../services/api/participant-address-history.service';
import { ParticipantPopulationService } from '../../services/api/population.service';
import { AddressHistoryTable } from './AddressHistoryTable';
import { AddressHistoryForm } from './AddressHistoryForm';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { ParticipantDisplay } from '../common/ParticipantDisplay';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { PullToRefreshWrapper } from '../common/PullToRefreshWrapper';
import type { ParticipantAddressHistory } from '../../types';
import { formatDate } from '../../utils/date.utils';
import { invalidatePageCaches, getDetailPageQueryKeys } from '../../utils/cache-invalidation.utils';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { MergeInitiationModal } from '../merge/MergeInitiationModal';

export function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ParticipantAddressHistory | undefined>();
  const [error, setError] = useState('');
  const [confirmDeleteParticipant, setConfirmDeleteParticipant] = useState(false);
  const [confirmDeleteAddress, setConfirmDeleteAddress] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const { data: participant, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['participant', id],
    queryFn: () => ParticipantService.getParticipant(id!),
    enabled: !!id,
  });

  const { data: addressHistory = [], isLoading: isLoadingHistory, refetch: refetchAddressHistory } = useQuery({
    queryKey: ['participantAddressHistory', id],
    queryFn: () => ParticipantAddressHistoryService.getAddressHistory(id!),
    enabled: !!id,
  });

  const { data: activities = [], isLoading: isLoadingActivities, refetch: refetchActivities } = useQuery({
    queryKey: ['participantActivities', id],
    queryFn: () => ParticipantService.getParticipantActivities(id!),
    enabled: !!id,
  });

  const { data: populations = [], refetch: refetchPopulations } = useQuery({
    queryKey: ['participantPopulations', id],
    queryFn: () => ParticipantPopulationService.getParticipantPopulations(id!),
    enabled: !!id,
  });

  const createAddressMutation = useMutation({
    mutationFn: (data: { venueId: string; effectiveFrom: string | null }) =>
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
    mutationFn: (data: { historyId: string; venueId: string; effectiveFrom: string | null }) =>
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
      setError(err.message || 'Failed to remove address history');
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
    setConfirmDeleteAddress(recordId);
  };

  const handleConfirmDeleteAddress = () => {
    if (confirmDeleteAddress) {
      deleteAddressMutation.mutate(confirmDeleteAddress);
      setConfirmDeleteAddress(null);
    }
  };

  const handleSubmitAddress = async (data: { venueId: string; effectiveFrom: string | null }) => {
    if (editingAddress) {
      await updateAddressMutation.mutateAsync({
        historyId: editingAddress.id,
        ...data,
      });
    } else {
      await createAddressMutation.mutateAsync(data);
    }
  };

  const handleConfirmDeleteParticipant = () => {
    ParticipantService.deleteParticipant(id!)
      .then(() => {
        navigate('/participants');
      })
      .catch((err) => {
        setError(err.message || 'Failed to remove participant');
      });
    setConfirmDeleteParticipant(false);
  };

  // Build dropdown items for participant actions
  const buildDropdownItems = () => {
    return [
      { id: "merge", text: "Merge", iconName: "shrink" as const },
      { id: "delete", text: "Remove", iconName: "remove" as const }
    ];
  };

  // Handle dropdown item clicks
  const handleItemClick = (itemId: string) => {
    switch (itemId) {
      case "merge":
        setShowMergeModal(true);
        break;
      case "delete":
        setConfirmDeleteParticipant(true);
        break;
      default:
        console.warn(`Unknown action: ${itemId}`);
    }
  };

  // Pull-to-refresh handler - MUST be defined before any conditional returns
  const handlePullToRefresh = useCallback(async () => {
    if (!id) return;

    // Invalidate caches
    await invalidatePageCaches(queryClient, {
      queryKeys: getDetailPageQueryKeys('participant', id),
      clearLocalStorage: false // Don't clear localStorage on detail pages
    });

    // Trigger refetch
    await Promise.all([
      refetch(),
      refetchAddressHistory(),
      refetchActivities(),
      refetchPopulations()
    ]);
  }, [id, queryClient, refetch, refetchAddressHistory, refetchActivities, refetchPopulations]);

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
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
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
                <ResponsiveButton
                  onClick={() => navigate('/participants')}
                  iconName="arrow-left"
                  mobileIcon="arrow-left"
                  mobileAriaLabel="Back to participants list"
                >
                  Back to Participants
                </ResponsiveButton>
                {canEdit() && (
                  <ButtonDropdown
                    variant="primary"
                    mainAction={{
                      text: "Edit",
                      onClick: () => navigate(`/participants/${id}/edit`)
                    }}
                    items={buildDropdownItems()}
                    onItemClick={({ detail }) => handleItemClick(detail.id)}
                    ariaLabel="Participant actions"
                  />
                )}
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <ParticipantDisplay
                participant={participant}
                currentUserRole={user?.role || 'READ_ONLY'}
              />
              {populations.map((pp) => (
                <Badge key={pp.id} color="blue">
                  {pp.population?.name || 'Unknown'}
                </Badge>
              ))}
            </SpaceBetween>
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Email</Box>
            <div>
              {participant.email ? (
                <Link href={`mailto:${participant.email}`} external>
                  {participant.email}
                </Link>
              ) : (
                '-'
              )}
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Phone</Box>
            <div>
              {participant.phone ? (
                <Link href={`tel:${participant.phone}`} external>
                  {participant.phone}
                </Link>
              ) : (
                '-'
              )}
            </div>
          </div>
          {participant.nickname && (
            <div>
              <Box variant="awsui-key-label">Nickname</Box>
              <div>{participant.nickname}</div>
            </div>
          )}
          {participant.dateOfBirth && (
            <div>
              <Box variant="awsui-key-label">Date of Birth</Box>
              <div>{formatDate(participant.dateOfBirth)}</div>
            </div>
          )}
          {participant.dateOfRegistration && (
            <div>
              <Box variant="awsui-key-label">Date of Registration</Box>
              <div>{formatDate(participant.dateOfRegistration)}</div>
            </div>
          )}
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

      {/* Hide address history for PII_RESTRICTED users (home addresses are PII) */}
      {user?.role !== 'PII_RESTRICTED' && (
        <AddressHistoryTable
          addressHistory={addressHistory}
          onEdit={handleEditAddress}
          onDelete={handleDeleteAddress}
          loading={isLoadingHistory}
          header={
            <Header
              variant="h3"
              actions={
                canEdit() && (
                  <ResponsiveButton mobileIcon="add-plus" onClick={handleAddAddress}>
                    Add Address History
                  </ResponsiveButton>
                )
              }
            >
              Address History
            </Header>
          }
        />
      )}

      <Table
        wrapLines={false}
        header={<Header variant="h3">Activities</Header>}
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
        loading={isLoadingActivities}
        empty={
          <Box textAlign="center" color="inherit">
            <b>No activities</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              This participant is not assigned to any activities.
            </Box>
          </Box>
        }
      />

      <AddressHistoryForm
        visible={isAddressFormOpen}
        onDismiss={() => {
          setIsAddressFormOpen(false);
          setEditingAddress(undefined);
        }}
        onSubmit={handleSubmitAddress}
        existingRecord={editingAddress}
        existingDates={existingDates}
        loading={createAddressMutation.isPending || updateAddressMutation.isPending}
      />

        {/* Remove Participant Confirmation */}
<ConfirmationDialog
  visible={confirmDeleteParticipant}
          title="Remove Participant"
          message="Are you sure you want to remove this participant? This action cannot be undone."
          confirmLabel="Remove"
  cancelLabel="Cancel"
  variant="destructive"
  onConfirm={handleConfirmDeleteParticipant}
  onCancel={() => setConfirmDeleteParticipant(false)}
/>

        {/* Remove Address History Confirmation */}
        <ConfirmationDialog
          visible={confirmDeleteAddress !== null}
          title="Remove Address History"
          message="Are you sure you want to remove this address history record?"
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDeleteAddress}
          onCancel={() => setConfirmDeleteAddress(null)}
        />

        {/* Merge Initiation Modal */}
        {participant && showMergeModal && (
          <MergeInitiationModal
            entityType="participant"
            currentEntityId={participant.id}
            currentEntityName={participant.name}
            isOpen={showMergeModal}
            onDismiss={() => setShowMergeModal(false)}
            onConfirm={() => {
              setShowMergeModal(false);
              // Refresh participant data after merge
              refetch();
            }}
          />
        )}
      </SpaceBetween>
    </PullToRefreshWrapper>
  );
}
