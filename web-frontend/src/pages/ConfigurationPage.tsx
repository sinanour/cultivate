import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
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
        <Container>
          <ActivityCategoryList />
        </Container>
        <Container>
          <ActivityTypeList />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
