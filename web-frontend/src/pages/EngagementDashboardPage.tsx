import { useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import { EngagementDashboard } from '../components/features/EngagementDashboard';

export default function EngagementDashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [runReportTrigger, setRunReportTrigger] = useState(0);

  const handleRunReportClick = () => {
    setRunReportTrigger(prev => prev + 1);
  };

  return (
    <ContentLayout
      header={
        <Header 
          variant="h1" 
          description="View comprehensive engagement metrics, activity lifecycle events, and participation patterns across your community"
          actions={
            <Button
              variant="primary"
              onClick={handleRunReportClick}
              loading={isLoading}
              disabled={isLoading}
            >
              Run Report
            </Button>
          }
        >
          Engagement Analytics
        </Header>
      }
    >
      <EngagementDashboard 
        runReportTrigger={runReportTrigger}
        onLoadingChange={setIsLoading}
      />
    </ContentLayout>
  );
}
