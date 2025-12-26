import { RoleService } from '../../services/role.service';
import { RoleRepository } from '../../repositories/role.repository';

jest.mock('../../repositories/role.repository');

describe('RoleService', () => {
    let service: RoleService;
    let mockRepository: jest.Mocked<RoleRepository>;

    beforeEach(() => {
        mockRepository = new RoleRepository(null as any) as jest.Mocked<RoleRepository>;
        service = new RoleService(mockRepository);
        jest.clearAllMocks();
    });

    describe('getAllRoles', () => {
        it('should return all roles', async () => {
            const mockRoles = [
                { id: '1', name: 'Participant', createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: '2', name: 'Organizer', createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];
            mockRepository.findAll = jest.fn().mockResolvedValue(mockRoles);

            const result = await service.getAllRoles();

            expect(result).toEqual(mockRoles.map(r => ({ ...r, isPredefined: true })));
            expect(mockRepository.findAll).toHaveBeenCalled();
        });

        it('should return empty array when no roles exist', async () => {
            mockRepository.findAll = jest.fn().mockResolvedValue([]);

            const result = await service.getAllRoles();

            expect(result).toEqual([]);
        });
    });

    describe('createRole', () => {
        it('should create role with valid data', async () => {
            const input = { name: 'Volunteer' };
            const mockRole = { id: '1', ...input, createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockRepository.findByName = jest.fn().mockResolvedValue(null);
            mockRepository.create = jest.fn().mockResolvedValue(mockRole);

            const result = await service.createRole(input);

            expect(result).toEqual({ ...mockRole, isPredefined: true });
            expect(mockRepository.findByName).toHaveBeenCalledWith('Volunteer');
            expect(mockRepository.create).toHaveBeenCalledWith(input);
        });

        it('should throw error for duplicate name', async () => {
            const input = { name: 'Volunteer' };
            const existing = { id: '1', name: 'Volunteer', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findByName = jest.fn().mockResolvedValue(existing);

            await expect(service.createRole(input)).rejects.toThrow('already exists');
        });

        it('should throw error for missing name', async () => {
            const input = { name: '' };

            await expect(service.createRole(input)).rejects.toThrow('required');
        });
    });

    describe('updateRole', () => {
        it('should update role with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Volunteer' };
            const existing = { id, name: 'Volunteer', createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const updated = { ...existing, ...input };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.findByName = jest.fn().mockResolvedValue(null);
            mockRepository.update = jest.fn().mockResolvedValue(updated);

            const result = await service.updateRole(id, input);

            expect(result).toEqual({ ...updated, isPredefined: false });
            expect(mockRepository.update).toHaveBeenCalledWith(id, input);
        });

        it('should throw error for non-existent role', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.updateRole('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });

        it('should throw error for duplicate name', async () => {
            const id = '1';
            const input = { name: 'Volunteer' };
            const existing = { id, name: 'Old Name', createdAt: new Date(), updatedAt: new Date() };
            const duplicate = { id: '2', name: 'Volunteer', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.findByName = jest.fn().mockResolvedValue(duplicate);

            await expect(service.updateRole(id, input)).rejects.toThrow('already exists');
        });
    });

    describe('deleteRole', () => {
        it('should delete role when not referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Volunteer', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countReferences = jest.fn().mockResolvedValue(0);
            mockRepository.delete = jest.fn().mockResolvedValue(undefined);

            await service.deleteRole(id);

            expect(mockRepository.delete).toHaveBeenCalledWith(id);
        });

        it('should throw error for non-existent role', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.deleteRole('invalid-id')).rejects.toThrow('not found');
        });

        it('should throw error when role is referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Volunteer', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countReferences = jest.fn().mockResolvedValue(3);

            await expect(service.deleteRole(id)).rejects.toThrow('referenced by');
        });
    });
});
