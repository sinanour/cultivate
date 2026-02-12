import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { VenueDisplay } from '../common/VenueDisplay';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { formatDate } from '../../utils/date.utils';
import { renderPopulationBadges } from '../../utils/population-badge.utils';
import { VenueDetailMapPreview } from './VenueDetailMapPreview';
import { BreadcrumbGroup, type BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { GeographicArea } from '../../types';
import { PullToRefreshWrapper } from '../common/PullToRefreshWrapper';
import { invalidatePageCaches, getDetailPageQueryKeys } from '../../utils/cache-invalidation.utils';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { MergeInitiationModal } from '../merge/MergeInitiationModal';

export function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const { data: venue, isLoading, error, refetch } = useQuery({
    queryKey: ['venue', id],
    queryFn: () => VenueService.getVenue(id!),
    enabled: !!id,
  });

  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ['venueActivities', id],
    queryFn: () => VenueService.getVenueActivities(id!),
    enabled: !!id,
  });

  const { data: participants = [], refetch: refetchParticipants } = useQuery({
    queryKey: ['venueParticipants', id],
    queryFn: () => VenueService.getVenueParticipants(id!),
    enabled: !!id,
  });

  const { data: ancestors = [], refetch: refetchAncestors } = useQuery({
    queryKey: ['geographicAreaAncestors', venue?.geographicAreaId],
    queryFn: () => GeographicAreaService.getAncestors(venue!.geographicAreaId),
    enabled: !!venue?.geographicAreaId,
  });

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    if (!id) return;

    // Invalidate caches
    await invalidatePageCaches(queryClient, {
      queryKeys: getDetailPageQueryKeys('venue', id),
      clearLocalStorage: false
    });

    // Trigger refetch of all queries
    await Promise.all([
      refetch(),
      refetchActivities(),
      refetchParticipants(),
      refetchAncestors()
    ]);
  }, [id, queryClient, refetch, refetchActivities, refetchParticipants, refetchAncestors]);

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !venue) {
    return (
      <Alert type="error">
        Failed to load venue details. {error instanceof Error ? error.message : ''}
      </Alert>
    );
  }

  const handleConfirmDelete = () => {
    VenueService.deleteVenue(id!)
      .then(() => {
        navigate('/venues');
      })
      .catch((err) => {
        setDeleteError(err.message || 'Failed to remove venue');
      });
    setConfirmDelete(false);
  };

  // Reverse ancestors to get correct order: most ancestral -> leaf node
  const hierarchyItems = [...ancestors].reverse();
  if (venue.geographicArea) {
    hierarchyItems.push(venue.geographicArea);
  }
  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
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
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <>
                    <ResponsiveButton variant="primary" onClick={() => navigate(`/venues/${id}/edit`)}>
                      Edit
                    </ResponsiveButton>
                    <ResponsiveButton mobileIcon="shrink" onClick={() => setShowMergeModal(true)}>
                      Merge
                    </ResponsiveButton>
                    <ResponsiveButton 
                      mobileIcon="remove"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Remove
                    </ResponsiveButton>
                  </>
                )}
                <ResponsiveButton 
                  onClick={() => navigate('/venues')}
                  mobileIcon="arrow-left"
                  mobileAriaLabel="Back to venues list"
                >
                  Back to Venues
                </ResponsiveButton>
              </SpaceBetween>
            }
          >
            <VenueDisplay
              venue={venue}
              currentUserRole={user?.role || 'READ_ONLY'}
            />
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Address</Box>
            <div>{venue.address}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Geographic Area</Box>
            <BreadcrumbGroup items={hierarchyItems.map((area: GeographicArea): BreadcrumbGroupProps.Item => {
              return { text: area.name, href: `/geographic-areas/${area.id}` };
            }).concat({ text: "", href: "#" })} />
          </div>
          {venue.latitude && venue.longitude && (
            <>
              <div>
                <Box variant="awsui-key-label">Latitude</Box>
                <div>{venue.latitude}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Longitude</Box>
                <div>{venue.longitude}</div>
              </div>
            </>
          )}
          {venue.venueType && (
            <div>
              <Box variant="awsui-key-label">Venue Type</Box>
              <div>
                <Badge>
                  {venue.venueType === 'PUBLIC_BUILDING' ? 'Public Building' : 'Private Residence'}
                </Badge>
              </div>
            </div>
          )}
          <div>
            <Box variant="awsui-key-label">Created</Box>
            <div>{formatDate(venue.createdAt)}</div>
          </div>
        </ColumnLayout>
      </Container>

      {/* Map Preview - only shown when coordinates are available */}
      {venue.latitude !== null && venue.longitude !== null && (
        <Container header={<Header variant="h3">Location</Header>}>
          <VenueDetailMapPreview latitude={venue.latitude as number} longitude={venue.longitude as number} />
        </Container>
      )}

      <Table
        wrapLines={false}
        header={<Header variant="h3">Associated Activities</Header>}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Activity Name',
            cell: (item) => (
              <Link href={`/activities/${item.id}`}>
                {item.name || 'Unknown'}
              </Link>
            ),
          },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => item.activityType?.name || '-',
          },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => <Badge color={item.status === 'ACTIVE' ? 'green' : 'grey'}>{item.status}</Badge>,
          },
        ]}
        items={activities}
        empty={
          <Box textAlign="center" color="inherit">
            <b>No activities</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No activities are associated with this venue.
            </Box>
          </Box>
        }
      />

      {/* Hide participant associations for PII_RESTRICTED users (home addresses are PII) */}
      {user?.role !== 'PII_RESTRICTED' && (
        <Table
          wrapLines={false}
          header={<Header variant="h3">Participants with Home Address Here</Header>}
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: (item) => (
                <>
                  <Link href={`/participants/${item.id}`}>
                    {item.name || 'Unknown'}
                  </Link>
                  {renderPopulationBadges(item.populations)}
                </>
              ),
            },
            {
              id: 'email',
              header: 'Email',
              cell: (item) => item.email || '-',
            },
          ]}
          items={participants}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No participants</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                No participants have this venue as their home address.
              </Box>
            </Box>
          }
        />
      )}
        <ConfirmationDialog
          visible={confirmDelete}
          title="Remove Venue"
          message="Are you sure you want to remove this venue? This action cannot be undone."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />

        {/* Merge Initiation Modal */}
        {venue && showMergeModal && (
          <MergeInitiationModal
            entityType="venue"
            currentEntityId={venue.id}
            currentEntityName={venue.name}
            isOpen={showMergeModal}
            onDismiss={() => setShowMergeModal(false)}
            onConfirm={() => {
              setShowMergeModal(false);
              refetch();
            }}
          />
        )}
      </SpaceBetween>
    </PullToRefreshWrapper>
  );
}
