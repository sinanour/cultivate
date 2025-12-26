import type { ParticipantAddressHistory } from '../../types';
import { ApiClient } from './api.client';

interface CreateAddressHistoryData {
  venueId: string;
  effectiveFrom: string;
}

interface UpdateAddressHistoryData {
  venueId?: string;
  effectiveFrom?: string;
}

export class ParticipantAddressHistoryService {
  static async getAddressHistory(participantId: string): Promise<ParticipantAddressHistory[]> {
    return ApiClient.get<ParticipantAddressHistory[]>(`/participants/${participantId}/address-history`);
  }

  static async createAddressHistory(
    participantId: string,
    data: CreateAddressHistoryData
  ): Promise<ParticipantAddressHistory> {
    return ApiClient.post<ParticipantAddressHistory>(
      `/participants/${participantId}/address-history`,
      data
    );
  }

  static async updateAddressHistory(
    participantId: string,
    historyId: string,
    data: UpdateAddressHistoryData
  ): Promise<ParticipantAddressHistory> {
    return ApiClient.put<ParticipantAddressHistory>(
      `/participants/${participantId}/address-history/${historyId}`,
      data
    );
  }

  static async deleteAddressHistory(participantId: string, historyId: string): Promise<void> {
    return ApiClient.delete<void>(`/participants/${participantId}/address-history/${historyId}`);
  }
}
