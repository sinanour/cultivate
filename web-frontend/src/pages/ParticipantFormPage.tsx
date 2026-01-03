import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import { ParticipantForm } from '../components/features/ParticipantForm';
import { ParticipantService } from '../services/api/participant.service';

export default function ParticipantFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Fetch participant data if editing
  const { data: participant, isLoading } = useQuery({
    queryKey: ['participant', id],
    queryFn: () => ParticipantService.getParticipant(id!),
    enabled: isEditMode,
  });

  const handleSuccess = () => {
    navigate(isEditMode ? `/participants/${id}` : '/participants');
  };

  const handleCancel = () => {
    navigate(isEditMode ? `/participants/${id}` : '/participants');
  };

  if (isEditMode && isLoading) {
    return (
      <ContentLayout
        header={
          <Header variant="h1">
            Loading...
          </Header>
        }
      >
        <Box>Loading participant data...</Box>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          {isEditMode ? 'Edit Participant' : 'Create Participant'}
        </Header>
      }
    >
      <ParticipantForm
        participant={participant || null}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        enableNavigationGuard={true}
      />
    </ContentLayout>
  );
}
