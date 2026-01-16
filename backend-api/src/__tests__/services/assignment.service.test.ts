import { AssignmentService } from '../../services/assignment.service';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { ActivityRepository } from '../../repositories/activity.repository';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { RoleRepository } from '../../repositories/role.repository';

jest.mock('../../repositories/assignment.repository');
jest.mock('../../repositories/activity.repository');
jest.mock('../../repositories/participant.repository');
jest.mock('../../repositories/role.repository');

describe('AssignmentService', () => {
    let service: AssignmentService;
    let mockAssignmentRepo: jest.Mocked<AssignmentRepository>;
    let mockActivityRepo: jest.Mocked<ActivityRepository>;
    let mockParticipantRepo: jest.Mocked<ParticipantRepository>;
    let mockRoleRepo: jest.Mocked<RoleRepository>;

    beforeEach(() => {
        mockAssignmentRepo = new AssignmentRepository(null as any) as jest.Mocked<AssignmentRepository>;
        mockActivityRepo = new ActivityRepository(null as any) as jest.Mocked<ActivityRepository>;
        mockParticipantRepo = new ParticipantRepository(null as any) as jest.Mocked<ParticipantRepository>;
        mockRoleRepo = new RoleRepository(null as any) as jest.Mocked<RoleRepository>;

        service = new AssignmentService(mockAssignmentRepo, mockActivityRepo, mockParticipantRepo, mockRoleRepo);
        jest.clearAllMocks();
    });

    describe('getActivityParticipants', () => {
        it('should return participants for activity', async () => {
            const activityId = 'activity-1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };
            const mockAssignments = [
                {
                    id: '1',
                    activityId,
                    participantId: 'p1',
                    roleId: 'role-1',
                    participant: { id: 'p1', name: 'John Doe', email: 'john@example.com', populations: [] },
                    role: { id: 'role-1', name: 'Participant' },
                    createdAt: new Date(),
                },
            ];

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockAssignmentRepo.findByActivityId = jest.fn().mockResolvedValue(mockAssignments);

            const result = await service.getActivityParticipants(activityId);

            expect(result).toEqual(mockAssignments);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.getActivityParticipants('invalid-id')).rejects.toThrow('not found');
        });
    });

    describe('assignParticipant', () => {
        it('should assign participant to activity', async () => {
            const activityId = 'activity-1';
            const input = { participantId: 'p1', roleId: 'role-1' };
            const mockAssignment = { id: '1', activityId, ...input, createdAt: new Date() };

            mockActivityRepo.exists = jest.fn().mockResolvedValue(true);
            mockParticipantRepo.exists = jest.fn().mockResolvedValue(true);
            mockRoleRepo.exists = jest.fn().mockResolvedValue(true);
            mockAssignmentRepo.findDuplicate = jest.fn().mockResolvedValue(null);
            mockAssignmentRepo.create = jest.fn().mockResolvedValue(mockAssignment);

            const result = await service.assignParticipant(activityId, input);

            expect(result).toEqual(mockAssignment);
        });

        it('should throw error for non-existent activity', async () => {
            const input = { participantId: 'p1', roleId: 'role-1' };

            mockActivityRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.assignParticipant('invalid-activity', input)).rejects.toThrow('Activity not found');
        });

        it('should throw error for non-existent participant', async () => {
            const input = { participantId: 'invalid-p', roleId: 'role-1' };

            mockActivityRepo.exists = jest.fn().mockResolvedValue(true);
            mockParticipantRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.assignParticipant('activity-1', input)).rejects.toThrow('Participant not found');
        });

        it('should throw error for non-existent role', async () => {
            const input = { participantId: 'p1', roleId: 'invalid-role' };

            mockActivityRepo.exists = jest.fn().mockResolvedValue(true);
            mockParticipantRepo.exists = jest.fn().mockResolvedValue(true);
            mockRoleRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.assignParticipant('activity-1', input)).rejects.toThrow('Role not found');
        });

        it('should throw error for duplicate assignment', async () => {
            const activityId = 'activity-1';
            const input = { participantId: 'p1', roleId: 'role-1' };
            const existingAssignment = { id: '1', activityId, ...input, createdAt: new Date() };

            mockActivityRepo.exists = jest.fn().mockResolvedValue(true);
            mockParticipantRepo.exists = jest.fn().mockResolvedValue(true);
            mockRoleRepo.exists = jest.fn().mockResolvedValue(true);
            mockAssignmentRepo.findDuplicate = jest.fn().mockResolvedValue(existingAssignment);

            await expect(service.assignParticipant(activityId, input)).rejects.toThrow('already assigned');
        });
    });

    describe('removeParticipant', () => {
        it('should remove participant from activity', async () => {
            const activityId = 'activity-1';
            const participantId = 'p1';
            const mockActivity = { id: activityId, name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockParticipantRepo.exists = jest.fn().mockResolvedValue(true);
            mockAssignmentRepo.delete = jest.fn().mockResolvedValue(undefined);

            await service.removeParticipant(activityId, participantId);

            expect(mockAssignmentRepo.delete).toHaveBeenCalledWith(activityId, participantId);
        });

        it('should throw error for non-existent activity', async () => {
            mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

            await expect(service.removeParticipant('invalid-activity', 'p1')).rejects.toThrow('not found');
        });

        it('should throw error for non-existent participant', async () => {
            const mockActivity = { id: 'activity-1', name: 'Workshop', activityTypeId: 'type-1', startDate: new Date(), endDate: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

            mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
            mockParticipantRepo.exists = jest.fn().mockResolvedValue(false);

            await expect(service.removeParticipant('activity-1', 'invalid-p')).rejects.toThrow('not found');
        });
    });
});
