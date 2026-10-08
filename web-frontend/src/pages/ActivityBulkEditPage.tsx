import { BulkEditPage } from '../components/features/bulk-edit/BulkEditPage';
import { activityBulkConfig } from '../components/features/bulk-edit/configs/activityBulkConfig';
import { ActivityService } from '../services/api/activity.service';
import { useGlobalGeographicFilter } from '../hooks/useGlobalGeographicFilter';
import type { Activity } from '../types';

export default function ActivityBulkEditPage() {
    const { selectedGeographicAreaId } = useGlobalGeographicFilter();
    return (
        <BulkEditPage<Activity>
            config={activityBulkConfig}
            listQueryKeyPrefix="activities"
            geographicAreaId={selectedGeographicAreaId}
            fetchPage={async ({ page, limit, geographicAreaId }) => {
                const res = await ActivityService.getActivitiesFlexible({
                    page,
                    limit,
                    geographicAreaId,
                });
                return {
                    data: res.data,
                    pagination: res.pagination,
                };
            }}
        />
    );
}
