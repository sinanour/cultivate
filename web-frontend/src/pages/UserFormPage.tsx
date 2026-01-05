import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import { UserFormWithAuthorization } from '../components/features/UserFormWithAuthorization';
import { UserService } from '../services/api/user.service';

export default function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Fetch user data if editing
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => UserService.getUser(id!),
    enabled: isEditMode,
  });

  const handleSuccess = () => {
    navigate('/users');
  };

  const handleCancel = () => {
    navigate('/users');
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
        <Box>Loading user data...</Box>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          {isEditMode ? 'Edit User' : 'Create User'}
        </Header>
      }
    >
      <UserFormWithAuthorization
        user={user || null}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ContentLayout>
  );
}
