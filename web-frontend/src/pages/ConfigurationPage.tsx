import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { ActivityCategoryList } from '../components/features/ActivityCategoryList';
import { ActivityTypeList } from '../components/features/ActivityTypeList';
import { ParticipantRoleList } from '../components/features/ParticipantRoleList';
import { PopulationList } from '../components/configuration/PopulationList';

export default function ConfigurationPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Manage activity categories, activity types, participant roles, and populations">
          Configuration
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ActivityCategoryList />
        <ActivityTypeList />
        <ParticipantRoleList />
        <PopulationList />
      </SpaceBetween>
    </ContentLayout>
  );
}
