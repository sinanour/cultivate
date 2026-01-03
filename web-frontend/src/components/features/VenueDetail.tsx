import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import Icon from '@cloudscape-design/components/icon';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '../../utils/date.utils';

export function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [deleteError, setDeleteError] = useState('');

  const { data: venue, isLoading, error } = useQuery({
    queryKey: ['venue', id],
    queryFn: () => VenueService.getVenue(id!),
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['venueActivities', id],
    queryFn: () => VenueService.getVenueActivities(id!),
    enabled: !!id,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['venueParticipants', id],
    queryFn: () => VenueService.getVenueParticipants(id!),
    enabled: !!id,
  });

  const { data: ancestors = [] } = useQuery({
    queryKey: ['geographicAreaAncestors', venue?.geographicAreaId],
    queryFn: () => GeographicAreaService.getAncestors(venue!.geographicAreaId),
    enabled: !!venue?.geographicAreaId,
  });

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

  // Reverse ancestors to get correct order: most ancestral -> leaf node
  const hierarchyItems = [...ancestors].reverse();
  if (venue.geographicArea) {
    hierarchyItems.push(venue.geographicArea);
  }
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
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <>
                    <Button variant="primary" onClick={() => navigate(`/venues/${id}/edit`)}>
                      Edit
                    </Button>
                    <Button 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this venue? This action cannot be undone.')) {
                          VenueService.deleteVenue(id!)
                            .then(() => {
                              navigate('/venues');
                            })
                            .catch((err) => {
                              setDeleteError(err.message || 'Failed to delete venue');
                            });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
                <Button onClick={() => navigate('/venues')}>
                  Back to Venues
                </Button>
              </SpaceBetween>
            }
          >
            {venue.name}
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
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '4px' }}>
              {hierarchyItems.length > 0 ? (
                hierarchyItems.map((area, index) => (
                  <span key={area.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <Link href={`/geographic-areas/${area.id}`} fontSize="body-m" variant="primary">
                      {area.name}
                    </Link>
                    {index < hierarchyItems.length - 1 && (
                      <span style={{ marginLeft: '8px', marginRight: '8px', display: 'flex', alignItems: 'center', color: 'var(--color-text-breadcrumb-icon, #8c8c94)' }}>
                        <Icon 
                          name="angle-right" 
                          size="normal"
                        />
                      </span>
                    )}
                  </span>
                ))
              ) : (
                '-'
              )}
            </div>
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

      <Table
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

      <Table
        header={<Header variant="h3">Participants with Home Address Here</Header>}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Link href={`/participants/${item.id}`}>
                {item.name || 'Unknown'}
              </Link>
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
    </SpaceBetween>
  );
}
