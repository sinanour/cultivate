import { BulkEditPage } from '../components/features/bulk-edit/BulkEditPage';
import { venueBulkConfig } from '../components/features/bulk-edit/configs/venueBulkConfig';
import { VenueService } from '../services/api/venue.service';
import type { Venue } from '../types';

export default function VenueBulkEditPage() {
    return (
        <BulkEditPage<Venue>
            config={venueBulkConfig}
            listQueryKeyPrefix="venues"
            fetchPage={async ({ page, limit }) => {
                const res = await VenueService.getVenuesFlexible({ page, limit });
                return {
                    data: res.data,
                    pagination: res.pagination,
                };
            }}
        />
    );
}
