import { BulkEditPage } from '../components/features/bulk-edit/BulkEditPage';
import { activityBulkConfig } from '../components/features/bulk-edit/configs/activityBulkConfig';
import { ActivityService } from '../services/api/activity.service';
import type { Activity } from '../types';

export default function ActivityBulkEditPage() {
    return (
        <BulkEditPage<Activity>
            config={activityBulkConfig}
            listQueryKeyPrefix="activities"
            fetchPage={async ({ page, limit }) => {
                const res = await ActivityService.getActivitiesFlexible({ page, limit });
                return {
                    data: res.data,
                    pagination: res.pagination,
                };
            }}
        />
    );
}
