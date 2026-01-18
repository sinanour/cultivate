import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import { ProfileForm } from '../components/features/ProfileForm';
import { UserService } from '../services/api/user.service';

export default function ProfilePage() {
  const navigate = useNavigate();

  // Fetch current user profile
  const { data: user, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => UserService.getCurrentUserProfile(),
  });

  const handleSuccess = () => {
    // Stay on profile page after successful update
    // The query will be invalidated and refetched automatically
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <ContentLayout
        header={
          <Header variant="h1">
            Loading...
          </Header>
        }
      >
        <Box>Loading profile...</Box>
      </ContentLayout>
    );
  }

  if (!user) {
    return (
      <ContentLayout
        header={
          <Header variant="h1">
            Error
          </Header>
        }
      >
        <Box>Unable to load profile</Box>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          My Profile
        </Header>
      }
    >
      <ProfileForm
        user={user}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ContentLayout>
  );
}
