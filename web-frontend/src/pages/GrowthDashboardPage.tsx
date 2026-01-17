import { useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import { GrowthDashboard } from '../components/features/GrowthDashboard';

export default function GrowthDashboardPage() {
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
          description="Track growth trends in participant and activity counts over time with flexible grouping options"
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
          Growth Analytics
        </Header>
      }
    >
      <GrowthDashboard 
        runReportTrigger={runReportTrigger}
        onLoadingChange={setIsLoading}
      />
    </ContentLayout>
  );
}
