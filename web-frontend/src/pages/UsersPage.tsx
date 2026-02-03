import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import { UserList } from '../components/features/UserList';
import { PullToRefreshWrapper } from '../components/common/PullToRefreshWrapper';
import { invalidatePageCaches } from '../utils/cache-invalidation.utils';

export default function UsersPage() {
  const queryClient = useQueryClient();

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    // Invalidate user-related caches
    await invalidatePageCaches(queryClient, {
      queryKeys: [
        ['users'],
        ['users-count']
      ],
      clearLocalStorage: false // Preserve auth tokens
    });
  }, [queryClient]);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
      <ContentLayout
        header={
          <Header variant="h1" description="Manage user accounts and role assignments for system access control">
            User Administration
          </Header>
        }
      >
        <UserList />
      </ContentLayout>
    </PullToRefreshWrapper>
  );
}
