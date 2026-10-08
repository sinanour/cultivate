import { BulkEditPage } from '../components/features/bulk-edit/BulkEditPage';
import { participantBulkConfig } from '../components/features/bulk-edit/configs/participantBulkConfig';
import { ParticipantService } from '../services/api/participant.service';
import type { Participant } from '../types';

export default function ParticipantBulkEditPage() {
    return (
        <BulkEditPage<Participant>
            config={participantBulkConfig}
            listQueryKeyPrefix="participants"
            fetchPage={async ({ page, limit }) => {
                const res = await ParticipantService.getParticipantsFlexible({ page, limit });
                return {
                    data: res.data,
                    pagination: res.pagination,
                };
            }}
        />
    );
}
