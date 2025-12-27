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
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Modal from '@cloudscape-design/components/modal';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { GeographicAreaForm } from './GeographicAreaForm';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '../../utils/date.utils';

export function GeographicAreaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

  const { data: geographicArea, isLoading, error } = useQuery({
    queryKey: ['geographicArea', id],
    queryFn: () => GeographicAreaService.getGeographicArea(id!),
    enabled: !!id,
  });

  const { data: children = [] } = useQuery({
    queryKey: ['geographicAreaChildren', id],
    queryFn: () => GeographicAreaService.getChildren(id!),
    enabled: !!id,
  });

  const { data: ancestors = [] } = useQuery({
    queryKey: ['geographicAreaAncestors', id],
    queryFn: () => GeographicAreaService.getAncestors(id!),
    enabled: !!id,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['geographicAreaVenues', id],
    queryFn: () => GeographicAreaService.getVenues(id!),
    enabled: !!id,
  });

  const { data: statistics } = useQuery({
    queryKey: ['geographicAreaStatistics', id],
    queryFn: () => GeographicAreaService.getStatistics(id!),
    enabled: !!id,
  });

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
                <Button onClick={() => navigate('/geographic-areas')}>
                  Back to Geographic Areas
                </Button>
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
              <Badge>{geographicArea.areaType}</Badge>
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
        <Container header={<Header variant="h3">Child Areas</Header>}>
          <Table
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
                cell: (item) => <Badge>{item.areaType}</Badge>,
              },
            ]}
            items={children}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No child areas</b>
              </Box>
            }
          />
        </Container>
      )}

      <Container header={<Header variant="h3">Venues in This Area</Header>}>
        {venues.length > 0 ? (
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'Name',
                cell: (item) => (
                  <Link href={`/venues/${item.id}`}>
                    {item.name || 'Unknown'}
                  </Link>
                ),
              },
              {
                id: 'address',
                header: 'Address',
                cell: (item) => item.address || '-',
              },
            ]}
            items={venues}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No venues</b>
              </Box>
            }
          />
        ) : (
          <Box textAlign="center" color="inherit">
            <b>No venues</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No venues are in this geographic area.
            </Box>
          </Box>
        )}
      </Container>
      
      <Modal
        visible={isEditFormOpen}
        onDismiss={() => setIsEditFormOpen(false)}
        header="Edit Geographic Area"
      >
        {isEditFormOpen && (
          <GeographicAreaForm
            geographicArea={geographicArea}
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
