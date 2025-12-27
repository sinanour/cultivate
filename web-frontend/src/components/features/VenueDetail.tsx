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
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { VenueForm } from './VenueForm';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '../../utils/date.utils';

export function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

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

  const hierarchyPath = [...ancestors, venue.geographicArea].filter(Boolean).map((a) => a!.name).join(' > ');

  return (
    <SpaceBetween size="l">
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
            <div>{hierarchyPath || venue.geographicArea?.name || '-'}</div>
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

      <Container header={<Header variant="h3">Associated Activities</Header>}>
        {activities.length > 0 ? (
          <Table
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
              </Box>
            }
          />
        ) : (
          <Box textAlign="center" color="inherit">
            <b>No activities</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No activities are associated with this venue.
            </Box>
          </Box>
        )}
      </Container>

      <Container header={<Header variant="h3">Participants with Home Address Here</Header>}>
        {participants.length > 0 ? (
          <Table
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
              </Box>
            }
          />
        ) : (
          <Box textAlign="center" color="inherit">
            <b>No participants</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No participants have this venue as their home address.
            </Box>
          </Box>
        )}
      </Container>
      
      <Modal
        visible={isEditFormOpen}
        onDismiss={() => setIsEditFormOpen(false)}
        header="Edit Venue"
      >
        {isEditFormOpen && (
          <VenueForm
            venue={venue}
            onSuccess={() => {
              setIsEditFormOpen(false);
            }}
            onCancel={() => setIsEditFormOpen(false)}
          />
        )}
      </Modal>
    </SpaceBetween>
  );
}
