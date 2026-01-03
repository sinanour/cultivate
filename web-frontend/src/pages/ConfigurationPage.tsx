import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { ActivityCategoryList } from '../components/features/ActivityCategoryList';
import { ActivityTypeList } from '../components/features/ActivityTypeList';
import { ParticipantRoleList } from '../components/features/ParticipantRoleList';

export default function ConfigurationPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Manage activity categories, activity types, and participant roles">
          Configuration
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ActivityCategoryList />
        <ActivityTypeList />
        <ParticipantRoleList />
      </SpaceBetween>
    </ContentLayout>
  );
}
