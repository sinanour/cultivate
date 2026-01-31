import { useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import { GrowthDashboard } from '../components/features/GrowthDashboard';
import { ResponsiveButton } from '../components/common/ResponsiveButton';

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
            <ResponsiveButton
              variant="primary"
              onClick={handleRunReportClick}
              loading={isLoading}
              disabled={isLoading}
              mobileIcon="redo"
              mobileAriaLabel="Run growth analytics report"
            >
              Run Report
            </ResponsiveButton>
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
