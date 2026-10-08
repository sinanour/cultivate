import { BulkEditPage } from '../components/features/bulk-edit/BulkEditPage';
import { participantBulkConfig } from '../components/features/bulk-edit/configs/participantBulkConfig';
import { ParticipantService } from '../services/api/participant.service';
import { useGlobalGeographicFilter } from '../hooks/useGlobalGeographicFilter';
import type { Participant } from '../types';

export default function ParticipantBulkEditPage() {
    const { selectedGeographicAreaId } = useGlobalGeographicFilter();
    return (
        <BulkEditPage<Participant>
            config={participantBulkConfig}
            listQueryKeyPrefix="participants"
            geographicAreaId={selectedGeographicAreaId}
            fetchPage={async ({ page, limit, geographicAreaId }) => {
                const res = await ParticipantService.getParticipantsFlexible({
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
