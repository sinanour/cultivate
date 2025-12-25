import type { Assignment } from '../../types';
import { ApiClient } from './api.client';

export class AssignmentService {
  static async getAssignments(activityId: string): Promise<Assignment[]> {
    return ApiClient.get<Assignment[]>(`/activities/${activityId}/assignments`);
  }

  static async assignParticipant(
    activityId: string,
    participantId: string,
    roleId: string
  ): Promise<Assignment> {
    return ApiClient.post<Assignment>(`/activities/${activityId}/assignments`, {
      participantId,
      roleId,
    });
  }

  static async removeAssignment(assignmentId: string): Promise<void> {
    return ApiClient.delete<void>(`/assignments/${assignmentId}`);
  }
}
