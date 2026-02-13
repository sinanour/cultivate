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
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { VenueDisplay } from '../common/VenueDisplay';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { formatDate } from '../../utils/date.utils';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import { PullToRefreshWrapper } from '../common/PullToRefreshWrapper';
import { invalidatePageCaches, getDetailPageQueryKeys } from '../../utils/cache-invalidation.utils';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { MergeInitiationModal } from '../merge/MergeInitiationModal';

export function GeographicAreaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { user } = useAuth();
  const { setGeographicAreaFilter } = useGlobalGeographicFilter();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const { data: geographicArea, isLoading, error, refetch } = useQuery({
    queryKey: ['geographicArea', id],
    queryFn: () => GeographicAreaService.getGeographicArea(id!),
    enabled: !!id,
  });

  const { data: children = [], refetch: refetchChildren } = useQuery({
    queryKey: ['geographicAreaChildren', id],
    queryFn: () => GeographicAreaService.getChildren(id!),
    enabled: !!id,
  });

  const { data: ancestors = [], refetch: refetchAncestors } = useQuery({
    queryKey: ['geographicAreaAncestors', id],
    queryFn: () => GeographicAreaService.getAncestors(id!),
    enabled: !!id,
  });

  const { data: venues = [], refetch: refetchVenues } = useQuery({
    queryKey: ['geographicAreaVenues', id],
    queryFn: () => GeographicAreaService.getVenues(id!),
    enabled: !!id && user?.role !== 'PII_RESTRICTED', // Don't fetch for PII_RESTRICTED
  });

  const { data: statistics, refetch: refetchStatistics } = useQuery({
    queryKey: ['geographicAreaStatistics', id],
    queryFn: () => GeographicAreaService.getStatistics(id!),
    enabled: !!id && user?.role !== 'PII_RESTRICTED', // Don't fetch for PII_RESTRICTED
  });

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    if (!id) return;

    // Invalidate caches
    await invalidatePageCaches(queryClient, {
      queryKeys: getDetailPageQueryKeys('geographic-area', id),
      clearLocalStorage: false
    });

    // Trigger refetch of all queries
    await Promise.all([
      refetch(),
      refetchChildren(),
      refetchAncestors(),
      refetchVenues(),
      refetchStatistics()
    ]);
  }, [id, queryClient, refetch, refetchChildren, refetchAncestors, refetchVenues, refetchStatistics]);

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !geographicArea) {
    return (
      <Alert type="error">
        Failed to load geographic area details. {error instanceof Error ? error.message : ''}
      </Alert>
    );
  }

  const handleConfirmDelete = () => {
    GeographicAreaService.deleteGeographicArea(id!)
      .then(() => {
        navigate('/geographic-areas');
      })
      .catch((err) => {
        setDeleteError(err.message || 'Failed to remove geographic area');
      });
    setConfirmDelete(false);
  };

  // Build dropdown items for geographic area actions
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
        setConfirmDelete(true);
        break;
      default:
        console.warn(`Unknown action: ${itemId}`);
    }
  };

  const breadcrumbItems = [
    ...[...ancestors].reverse().map((ancestor) => ({
      text: ancestor.name,
      href: `/geographic-areas/${ancestor.id}`,
    })),
    {
      text: geographicArea.name,
      href: `/geographic-areas/${geographicArea.id}`,
    },
  ];

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
                <ResponsiveButton
                  onClick={() => navigate('/geographic-areas')}
                  mobileIcon="arrow-left"
                  mobileAriaLabel="Back to geographic areas list"
                >
                  Back to Geographic Areas
                </ResponsiveButton>
                <ResponsiveButton 
                  mobileIcon="filter" 
                  onClick={() => {
                    if (id) {
                      setGeographicAreaFilter(id);
                      navigate('/geographic-areas');
                    }
                  }}
                >
                  Apply Filter
                </ResponsiveButton>
                {canEdit() && (
                  <ButtonDropdown
                    variant="primary"
                    mainAction={{
                      text: "Edit",
                      onClick: () => navigate(`/geographic-areas/${id}/edit`)
                    }}
                    items={buildDropdownItems()}
                    onItemClick={({ detail }) => handleItemClick(detail.id)}
                    ariaLabel="Geographic area actions"
                  />
                )}
              </SpaceBetween>
            }
          >
            {geographicArea.name}
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Area Type</Box>
            <div>
              <Badge color={getAreaTypeBadgeColor(geographicArea.areaType)}>{geographicArea.areaType}</Badge>
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Hierarchy Path</Box>
            <BreadcrumbGroup
              items={breadcrumbItems}
              onFollow={(event) => {
                event.preventDefault();
                navigate(event.detail.href);
              }}
            />
          </div>
          <div>
            <Box variant="awsui-key-label">Created</Box>
            <div>{formatDate(geographicArea.createdAt)}</div>
          </div>
        </ColumnLayout>
      </Container>

      {statistics && (
        <Container header={<Header variant="h3">Statistics</Header>}>
          <ColumnLayout columns={4} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Total Activities</Box>
              <div>{statistics.totalActivities}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Active Activities</Box>
              <div>{statistics.activeActivities}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Total Participants</Box>
              <div>{statistics.totalParticipants}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Total Venues</Box>
              <div>{statistics.totalVenues}</div>
            </div>
          </ColumnLayout>
        </Container>
      )}

      {children.length > 0 && (
        <Table
          wrapLines={false}
          header={<Header variant="h3">Sub-Divisions Within This Area</Header>}
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: (item) => (
                <Link href={`/geographic-areas/${item.id}`}>
                  {item.name}
                </Link>
              ),
            },
            {
              id: 'type',
              header: 'Type',
              cell: (item) => <Badge color={getAreaTypeBadgeColor(item.areaType)}>{item.areaType}</Badge>,
            },
          ]}
          items={children}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No sub-divisions</b>
            </Box>
          }
        />
      )}

        {/* Hide venues list for PII_RESTRICTED users */}
        {user?.role !== 'PII_RESTRICTED' && (
          <Table
            wrapLines={false}
            header={<Header variant="h3">Venues in This Area</Header>}
            columnDefinitions={[
              {
                id: 'name',
                header: 'Name',
                cell: (item) => (
                  <Link href={`/venues/${item.id}`}>
                    <VenueDisplay
                      venue={item}
                      currentUserRole={user?.role || 'READ_ONLY'}
                    />
                  </Link>
                ),
              },
              {
                id: 'address',
                header: 'Address',
                cell: (item) => item.address || '-',
              },
              {
                id: 'venueType',
                header: 'Venue Type',
                cell: (item) => {
                  if (!item.venueType) return '';

                  const badgeColor = item.venueType === 'PRIVATE_RESIDENCE' ? 'green' : 'severity-medium';
                  const badgeLabel = item.venueType === 'PRIVATE_RESIDENCE' ? 'Private Residence' : 'Public Building';

                  return (
                    <Badge color={badgeColor}>
                      {badgeLabel}
                    </Badge>
                  );
                },
              },
            ]}
            items={venues}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No venues</b>
                <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                  No venues are in this geographic area.
                </Box>
              </Box>
            }
          />
        )}
        <ConfirmationDialog
          visible={confirmDelete}
          title="Remove Geographic Area"
          message="Are you sure you want to remove this geographic area? This action cannot be undone."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />

        {/* Merge Initiation Modal */}
        {geographicArea && showMergeModal && (
          <MergeInitiationModal
            entityType="geographicArea"
            currentEntityId={geographicArea.id}
            currentEntityName={geographicArea.name}
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
