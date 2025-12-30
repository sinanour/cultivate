import { ActivityTypeService } from '../../services/activity-type.service';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityCategoryRepository } from '../../repositories/activity-category.repository';

jest.mock('../../repositories/activity-type.repository');
jest.mock('../../repositories/activity-category.repository');

describe('ActivityTypeService', () => {
    let service: ActivityTypeService;
    let mockRepository: jest.Mocked<ActivityTypeRepository>;
    let mockCategoryRepository: jest.Mocked<ActivityCategoryRepository>;

    beforeEach(() => {
        mockRepository = new ActivityTypeRepository(null as any) as jest.Mocked<ActivityTypeRepository>;
        mockCategoryRepository = new ActivityCategoryRepository(null as any) as jest.Mocked<ActivityCategoryRepository>;
        service = new ActivityTypeService(mockRepository, mockCategoryRepository);
        jest.clearAllMocks();
    });

    describe('getAllActivityTypes', () => {
        it('should return all activity types', async () => {
            const mockTypes = [
                { id: '1', name: "Children's Class", createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: '2', name: 'Ruhi Book 1', createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];
            mockRepository.findAll = jest.fn().mockResolvedValue(mockTypes);

            const result = await service.getAllActivityTypes();

            expect(result).toEqual(mockTypes.map(t => ({ ...t, isPredefined: true })));
            expect(mockRepository.findAll).toHaveBeenCalled();
        });

        it('should return empty array when no types exist', async () => {
            mockRepository.findAll = jest.fn().mockResolvedValue([]);

            const result = await service.getAllActivityTypes();

            expect(result).toEqual([]);
        });
    });

    describe('createActivityType', () => {
        it('should create activity type with valid data', async () => {
            const input = { name: 'Ruhi Book 1', activityCategoryId: 'cat-1' };
            const mockType = { id: '1', ...input, createdAt: new Date(), updatedAt: new Date(), version: 1, isPredefined: false, activityCategory: { id: 'cat-1', name: 'Study Circles', isPredefined: true, version: 1, createdAt: new Date(), updatedAt: new Date() } };

            mockRepository.findByName = jest.fn().mockResolvedValue(null);
            mockCategoryRepository.findById = jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Study Circles', isPredefined: true, version: 1, createdAt: new Date(), updatedAt: new Date() });
            mockRepository.create = jest.fn().mockResolvedValue(mockType);

            const result = await service.createActivityType(input);

            expect(result).toEqual({ ...mockType, isPredefined: true });
            expect(mockRepository.findByName).toHaveBeenCalledWith('Ruhi Book 1');
            expect(mockCategoryRepository.findById).toHaveBeenCalledWith('cat-1');
            expect(mockRepository.create).toHaveBeenCalledWith(input);
        });

        it('should throw error for duplicate name', async () => {
            const input = { name: 'Ruhi Book 1', activityCategoryId: 'cat-1' };
            const existing = { id: '1', name: 'Ruhi Book 1', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findByName = jest.fn().mockResolvedValue(existing);

            await expect(service.createActivityType(input)).rejects.toThrow('already exists');
        });

        it('should throw error for missing name', async () => {
            const input = { name: '', activityCategoryId: 'cat-1' };

            await expect(service.createActivityType(input)).rejects.toThrow('required');
        });

        it('should throw error for non-existent category', async () => {
            const input = { name: 'New Type', activityCategoryId: 'invalid-cat' };

            mockRepository.findByName = jest.fn().mockResolvedValue(null);
            mockCategoryRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.createActivityType(input)).rejects.toThrow('does not exist');
        });
    });

    describe('updateActivityType', () => {
        it('should update activity type with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Custom Type' };
            const existing = { id, name: 'Custom Type', createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const updated = { ...existing, ...input };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.findByName = jest.fn().mockResolvedValue(null);
            mockRepository.update = jest.fn().mockResolvedValue(updated);

            const result = await service.updateActivityType(id, input);

            expect(result).toEqual({ ...updated, isPredefined: false });
            expect(mockRepository.update).toHaveBeenCalledWith(id, input);
        });

        it('should throw error for non-existent activity type', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.updateActivityType('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });

        it('should throw error for duplicate name', async () => {
            const id = '1';
            const input = { name: 'Ruhi Book 1' };
            const existing = { id, name: 'Old Name', createdAt: new Date(), updatedAt: new Date() };
            const duplicate = { id: '2', name: 'Ruhi Book 1', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.findByName = jest.fn().mockResolvedValue(duplicate);

            await expect(service.updateActivityType(id, input)).rejects.toThrow('already exists');
        });
    });

    describe('deleteActivityType', () => {
        it('should delete activity type when not referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Custom Type', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countReferences = jest.fn().mockResolvedValue(0);
            mockRepository.delete = jest.fn().mockResolvedValue(undefined);

            await service.deleteActivityType(id);

            expect(mockRepository.delete).toHaveBeenCalledWith(id);
        });

        it('should throw error for non-existent activity type', async () => {
            mockRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(service.deleteActivityType('invalid-id')).rejects.toThrow('not found');
        });

        it('should throw error when activity type is referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Custom Type', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date() };

            mockRepository.findById = jest.fn().mockResolvedValue(existing);
            mockRepository.countReferences = jest.fn().mockResolvedValue(5);

            await expect(service.deleteActivityType(id)).rejects.toThrow('reference');
        });
    });
});
