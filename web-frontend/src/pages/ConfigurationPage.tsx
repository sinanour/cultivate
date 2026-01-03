import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { ActivityCategoryList } from '../components/features/ActivityCategoryList';
import { ActivityTypeList } from '../components/features/ActivityTypeList';

export default function ConfigurationPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Manage activity categories and types">
          Activity Configuration
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ActivityCategoryList />
        <ActivityTypeList />
      </SpaceBetween>
    </ContentLayout>
  );
}
