import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { ActivityCategoryList } from '../components/features/ActivityCategoryList';
import { ActivityTypeList } from '../components/features/ActivityTypeList';
import { ParticipantRoleList } from '../components/features/ParticipantRoleList';
import { PopulationList } from '../components/configuration/PopulationList';
import { PullToRefreshWrapper } from '../components/common/PullToRefreshWrapper';
import { invalidatePageCaches } from '../utils/cache-invalidation.utils';

export default function ConfigurationPage() {
  const queryClient = useQueryClient();

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    // Invalidate all configuration-related caches
    await invalidatePageCaches(queryClient, {
      queryKeys: [
        ['activityCategories'],
        ['activityTypes'],
        ['participantRoles'],
        ['populations']
      ],
      clearLocalStorage: false // Preserve auth tokens
    });
  }, [queryClient]);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
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
    </PullToRefreshWrapper>
  );
}
