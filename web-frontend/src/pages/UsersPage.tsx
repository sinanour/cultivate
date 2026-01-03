import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import { UserList } from '../components/features/UserList';

export default function UsersPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Manage user accounts and role assignments for system access control">
          User Administration
        </Header>
      }
    >
      <UserList />
    </ContentLayout>
  );
}
