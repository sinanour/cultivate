import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import { GrowthDashboard } from '../components/features/GrowthDashboard';

export default function GrowthDashboardPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Track growth trends in participant and activity counts over time with flexible grouping options">
          Growth Analytics
        </Header>
      }
    >
      <GrowthDashboard />
    </ContentLayout>
  );
}
