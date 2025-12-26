import { useQuery } from '@tanstack/react-query';
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
import { ParticipantService } from '../../services/api/participant.service';
import { ParticipantAddressHistoryService } from '../../services/api/participant-address-history.service';

export function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: participant, isLoading, error } = useQuery({
    queryKey: ['participant', id],
    queryFn: () => ParticipantService.getParticipant(id!),
    enabled: !!id,
  });

  const { data: addressHistory = [] } = useQuery({
    queryKey: ['participantAddressHistory', id],
    queryFn: () => ParticipantAddressHistoryService.getAddressHistory(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !participant) {
    return (
      <Alert type="error">
        Failed to load participant details. {error instanceof Error ? error.message : ''}
      </Alert>
    );
  }

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Button onClick={() => navigate('/participants')}>
                Back to Participants
              </Button>
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
            <div>{new Date(participant.createdAt).toLocaleDateString()}</div>
          </div>
          {participant.notes && (
            <div>
              <Box variant="awsui-key-label">Notes</Box>
              <div>{participant.notes}</div>
            </div>
          )}
        </ColumnLayout>
      </Container>

      {addressHistory.length > 0 && (
        <Container header={<Header variant="h3">Address History</Header>}>
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
                header: 'Effective From',
                cell: (item) => new Date(item.effectiveFrom).toLocaleDateString(),
              },
            ]}
            items={addressHistory}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No address history</b>
              </Box>
            }
          />
        </Container>
      )}

      <Container header={<Header variant="h3">Activities</Header>}>
        <Box textAlign="center" color="inherit">
          <b>Activities list</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            Activity assignments will be displayed here once implemented.
          </Box>
        </Box>
      </Container>
    </SpaceBetween>
  );
}
