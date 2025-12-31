import type { Assignment } from '../../types';
import { ApiClient } from './api.client';

export class AssignmentService {
  static async getActivityParticipants(activityId: string): Promise<Assignment[]> {
    return ApiClient.get<Assignment[]>(`/activities/${activityId}/participants`);
  }

  static async addParticipant(
    activityId: string,
    participantId: string,
    roleId: string,
    notes?: string
  ): Promise<Assignment> {
    return ApiClient.post<Assignment>(`/activities/${activityId}/participants`, {
      participantId,
      roleId,
      notes,
    });
  }

  static async updateParticipant(
    activityId: string,
    participantId: string,
    roleId?: string,
    notes?: string | null
  ): Promise<Assignment> {
    return ApiClient.put<Assignment>(`/activities/${activityId}/participants/${participantId}`, {
      roleId,
      notes,
    });
  }

  static async removeParticipant(activityId: string, participantId: string): Promise<void> {
    return ApiClient.delete<void>(`/activities/${activityId}/participants/${participantId}`);
  }
}
