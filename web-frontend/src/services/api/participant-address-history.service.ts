import { ParticipantAddressHistory } from '../../types';
import { ApiClient } from './api.client';

export class ParticipantAddressHistoryService {
  static async getAddressHistory(participantId: string): Promise<ParticipantAddressHistory[]> {
    return ApiClient.get<ParticipantAddressHistory[]>(`/participants/${participantId}/address-history`);
  }
}
