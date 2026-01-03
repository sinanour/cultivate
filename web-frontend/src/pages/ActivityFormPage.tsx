import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import { ActivityForm } from '../components/features/ActivityForm';
import { ActivityService } from '../services/api/activity.service';

export default function ActivityFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => ActivityService.getActivity(id!),
    enabled: isEditMode,
  });

  const handleSuccess = () => {
    navigate(isEditMode ? `/activities/${id}` : '/activities');
  };

  const handleCancel = () => {
    navigate(isEditMode ? `/activities/${id}` : '/activities');
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
          {isEditMode ? 'Edit Activity' : 'Create Activity'}
        </Header>
      }
    >
      <ActivityForm
        activity={activity || null}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ContentLayout>
  );
}
