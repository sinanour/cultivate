import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import { VenueForm } from '../components/features/VenueForm';
import { VenueService } from '../services/api/venue.service';

export default function VenueFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { data: venue, isLoading } = useQuery({
    queryKey: ['venue', id],
    queryFn: () => VenueService.getVenue(id!),
    enabled: isEditMode,
  });

  const handleSuccess = () => {
    navigate(isEditMode ? `/venues/${id}` : '/venues');
  };

  const handleCancel = () => {
    navigate(isEditMode ? `/venues/${id}` : '/venues');
  };

  if (isEditMode && isLoading) {
    return (
      <ContentLayout
        header={<Header variant="h1">Loading...</Header>}
      >
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          {isEditMode ? 'Edit Venue' : 'Create Venue'}
        </Header>
      }
    >
      <VenueForm
        venue={venue || null}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ContentLayout>
  );
}
