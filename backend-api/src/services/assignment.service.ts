import { Assignment } from '@prisma/client';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { ActivityRepository } from '../repositories/activity.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { RoleRepository } from '../repositories/role.repository';

export interface CreateAssignmentInput {
    participantId: string;
    roleId: string;
}

export class AssignmentService {
    constructor(
        private assignmentRepository: AssignmentRepository,
        private activityRepository: ActivityRepository,
        private participantRepository: ParticipantRepository,
        private roleRepository: RoleRepository
    ) { }

    async getActivityParticipants(activityId: string) {
        const activity = await this.activityRepository.findById(activityId);
        if (!activity) {
            throw new Error('Activity not found');
        }

        return this.assignmentRepository.findByActivityId(activityId);
    }

    async assignParticipant(activityId: string, data: CreateAssignmentInput): Promise<Assignment> {
        // Validate activity exists
        const activityExists = await this.activityRepository.exists(activityId);
        if (!activityExists) {
            throw new Error('Activity not found');
        }

        // Validate participant exists
        const participantExists = await this.participantRepository.exists(data.participantId);
        if (!participantExists) {
            throw new Error('Participant not found');
        }

        // Validate role exists
        const roleExists = await this.roleRepository.exists(data.roleId);
        if (!roleExists) {
            throw new Error('Role not found');
        }

        // Check for duplicate assignment
        const duplicate = await this.assignmentRepository.findDuplicate(
            activityId,
            data.participantId,
            data.roleId
        );
        if (duplicate) {
            throw new Error('This participant is already assigned to this activity with this role');
        }

        return this.assignmentRepository.create({
            activityId,
            participantId: data.participantId,
            roleId: data.roleId,
        });
    }

    async removeParticipant(activityId: string, participantId: string): Promise<void> {
        const activity = await this.activityRepository.findById(activityId);
        if (!activity) {
            throw new Error('Activity not found');
        }

        const participantExists = await this.participantRepository.exists(participantId);
        if (!participantExists) {
            throw new Error('Participant not found');
        }

        await this.assignmentRepository.delete(activityId, participantId);
    }
}
