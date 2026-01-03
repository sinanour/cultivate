import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import { GeographicAreaForm } from '../components/features/GeographicAreaForm';
import { GeographicAreaService } from '../services/api/geographic-area.service';

export default function GeographicAreaFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { data: geographicArea, isLoading } = useQuery({
    queryKey: ['geographicArea', id],
    queryFn: () => GeographicAreaService.getGeographicArea(id!),
    enabled: isEditMode,
  });

  const handleSuccess = () => {
    navigate(isEditMode ? `/geographic-areas/${id}` : '/geographic-areas');
  };

  const handleCancel = () => {
    navigate(isEditMode ? `/geographic-areas/${id}` : '/geographic-areas');
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
          {isEditMode ? 'Edit Geographic Area' : 'Create Geographic Area'}
        </Header>
      }
    >
      <GeographicAreaForm
        geographicArea={geographicArea || null}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ContentLayout>
  );
}
