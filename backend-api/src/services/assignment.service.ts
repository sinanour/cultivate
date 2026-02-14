import { Assignment } from '@prisma/client';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { ActivityRepository } from '../repositories/activity.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { RoleRepository } from '../repositories/role.repository';
import { transformParticipantResponse } from '../utils/participant.utils';

export interface CreateAssignmentInput {
    participantId: string;
    roleId: string;
    notes?: string;
}

export interface UpdateAssignmentInput {
    roleId?: string;
    notes?: string | null;
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

        const assignments = await this.assignmentRepository.findByActivityId(activityId);

        // Determine reference date for age calculation
        // Use activity's endDate if non-null, otherwise use current date
        const referenceDate = activity.endDate || new Date();

        // Transform participant data to include flattened populations array and contextual ageCohort
        return assignments.map(assignment => ({
            ...assignment,
            participant: transformParticipantResponse(assignment.participant, referenceDate)
        }));
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
            notes: data.notes,
        });
    }

    async updateAssignment(activityId: string, participantId: string, data: UpdateAssignmentInput): Promise<Assignment> {
        // Validate activity exists
        const activityExists = await this.activityRepository.exists(activityId);
        if (!activityExists) {
            throw new Error('Activity not found');
        }

        // Validate participant exists
        const participantExists = await this.participantRepository.exists(participantId);
        if (!participantExists) {
            throw new Error('Participant not found');
        }

        // Validate role exists if provided
        if (data.roleId) {
            const roleExists = await this.roleRepository.exists(data.roleId);
            if (!roleExists) {
                throw new Error('Role not found');
            }
        }

        return this.assignmentRepository.update(activityId, participantId, data);
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
