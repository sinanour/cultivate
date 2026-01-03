import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import { EngagementDashboard } from '../components/features/EngagementDashboard';

export default function EngagementDashboardPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="View comprehensive engagement metrics, activity lifecycle events, and participation patterns across your community">
          Engagement Analytics
        </Header>
      }
    >
      <EngagementDashboard />
    </ContentLayout>
  );
}
