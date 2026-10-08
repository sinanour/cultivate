import { BulkEditPage } from '../components/features/bulk-edit/BulkEditPage';
import { venueBulkConfig } from '../components/features/bulk-edit/configs/venueBulkConfig';
import { VenueService } from '../services/api/venue.service';
import { useGlobalGeographicFilter } from '../hooks/useGlobalGeographicFilter';
import type { Venue } from '../types';

export default function VenueBulkEditPage() {
    const { selectedGeographicAreaId } = useGlobalGeographicFilter();
    return (
        <BulkEditPage<Venue>
            config={venueBulkConfig}
            listQueryKeyPrefix="venues"
            geographicAreaId={selectedGeographicAreaId}
            fetchPage={async ({ page, limit, geographicAreaId }) => {
                const res = await VenueService.getVenuesFlexible({ page, limit, geographicAreaId });
                return {
                    data: res.data,
                    pagination: res.pagination,
                };
            }}
        />
    );
}
