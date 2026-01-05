import { ActivityTypeService } from '../../services/activity-type.service';
import { ActivityTypeRepository } from '../../repositories/activity-type.repository';
import { ActivityCategoryRepository } from '../../repositories/activity-category.repository';
import { createMockPrismaClient, MockPrismaClient } from '../utils/mock-prisma';

describe('ActivityTypeService', () => {
    let service: ActivityTypeService;
    let mockPrisma: MockPrismaClient;
    let mockRepository: ActivityTypeRepository;
    let mockCategoryRepository: ActivityCategoryRepository;

    beforeEach(() => {
        // Create a fresh mock Prisma client for each test
        mockPrisma = createMockPrismaClient();

        // Create repositories with the mocked Prisma client
        mockRepository = new ActivityTypeRepository(mockPrisma);
        mockCategoryRepository = new ActivityCategoryRepository(mockPrisma);

        // Create service with mocked repositories
        service = new ActivityTypeService(mockRepository, mockCategoryRepository);
    });

    describe('getAllActivityTypes', () => {
        it('should return all activity types', async () => {
            const mockTypes = [
                { id: '1', name: "Children's Class", activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1 },
                { id: '2', name: 'Ruhi Book 1', activityCategoryId: 'cat-2', createdAt: new Date(), updatedAt: new Date(), version: 1 },
            ];
            mockPrisma.activityType.findMany.mockResolvedValue(mockTypes as any);

            const result = await service.getAllActivityTypes();

            expect(result).toEqual(mockTypes.map(t => ({ ...t, isPredefined: true })));
            expect(mockPrisma.activityType.findMany).toHaveBeenCalled();
        });

        it('should return empty array when no types exist', async () => {
            mockPrisma.activityType.findMany.mockResolvedValue([]);

            const result = await service.getAllActivityTypes();

            expect(result).toEqual([]);
        });
    });

    describe('createActivityType', () => {
        it('should create activity type with valid data', async () => {
            const input = { name: 'Ruhi Book 1', activityCategoryId: 'cat-1' };
            const mockType = { id: '1', name: input.name, activityCategoryId: input.activityCategoryId, isPredefined: false, createdAt: new Date(), updatedAt: new Date(), version: 1 };
            const mockCategory = { id: 'cat-1', name: 'Study Circles', isPredefined: true, version: 1, createdAt: new Date(), updatedAt: new Date() };

            mockPrisma.activityType.findUnique.mockResolvedValue(null);
            mockPrisma.activityCategory.findUnique.mockResolvedValue(mockCategory as any);
            mockPrisma.activityType.create.mockResolvedValue({ ...mockType, activityCategory: mockCategory } as any);

            const result = await service.createActivityType(input);

            expect(result).toEqual({ ...mockType, activityCategory: mockCategory, isPredefined: true });
            expect(mockPrisma.activityType.findUnique).toHaveBeenCalledWith({ where: { name: 'Ruhi Book 1' } });
            expect(mockPrisma.activityCategory.findUnique).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
            expect(mockPrisma.activityType.create).toHaveBeenCalledWith({
                data: {
                    name: input.name,
                    activityCategoryId: input.activityCategoryId,
                    isPredefined: false
                },
                include: { activityCategory: true }
            });
        });

        it('should throw error for duplicate name', async () => {
            const input = { name: 'Ruhi Book 1', activityCategoryId: 'cat-1' };
            const existing = { id: '1', name: 'Ruhi Book 1', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockPrisma.activityType.findUnique.mockResolvedValue(existing as any);

            await expect(service.createActivityType(input)).rejects.toThrow('already exists');
        });

        it('should throw error for missing name', async () => {
            const input = { name: '', activityCategoryId: 'cat-1' };

            await expect(service.createActivityType(input)).rejects.toThrow('required');
        });

        it('should throw error for non-existent category', async () => {
            const input = { name: 'New Type', activityCategoryId: 'invalid-cat' };

            mockPrisma.activityType.findUnique.mockResolvedValue(null);
            mockPrisma.activityCategory.findUnique.mockResolvedValue(null);

            await expect(service.createActivityType(input)).rejects.toThrow('does not exist');
        });
    });

    describe('updateActivityType', () => {
        it('should update activity type with valid data', async () => {
            const id = '1';
            const input = { name: 'Updated Custom Type' };
            const existing = { id, name: 'Custom Type', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1, isPredefined: false };
            const updated = { ...existing, ...input, version: 2 };

            mockPrisma.activityType.findUnique.mockResolvedValueOnce(existing as any); // First call for findById
            mockPrisma.activityType.findUnique.mockResolvedValueOnce(null); // Second call for findByName
            mockPrisma.activityType.update.mockResolvedValue(updated as any);

            const result = await service.updateActivityType(id, input);

            expect(result).toEqual({ ...updated, isPredefined: false });
            expect(mockPrisma.activityType.update).toHaveBeenCalledWith({
                where: { id },
                data: {
                    name: input.name,
                    version: { increment: 1 }
                },
                include: { activityCategory: true }
            });
        });

        it('should throw error for non-existent activity type', async () => {
            mockPrisma.activityType.findUnique.mockResolvedValue(null);

            await expect(service.updateActivityType('invalid-id', { name: 'Test' })).rejects.toThrow('not found');
        });

        it('should throw error for duplicate name', async () => {
            const id = '1';
            const input = { name: 'Ruhi Book 1' };
            const existing = { id, name: 'Old Name', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1, isPredefined: false };
            const duplicate = { id: '2', name: 'Ruhi Book 1', activityCategoryId: 'cat-2', createdAt: new Date(), updatedAt: new Date(), version: 1, isPredefined: false };

            mockPrisma.activityType.findUnique.mockResolvedValueOnce(existing as any); // First call for findById
            mockPrisma.activityType.findUnique.mockResolvedValueOnce(duplicate as any); // Second call for findByName

            await expect(service.updateActivityType(id, input)).rejects.toThrow('already exists');
        });
    });

    describe('deleteActivityType', () => {
        it('should delete activity type when not referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Custom Type', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockPrisma.activityType.findUnique.mockResolvedValue(existing as any);
            mockPrisma.activity.count.mockResolvedValue(0);
            mockPrisma.activityType.delete.mockResolvedValue(existing as any);

            await service.deleteActivityType(id);

            expect(mockPrisma.activityType.delete).toHaveBeenCalledWith({ where: { id } });
        });

        it('should throw error for non-existent activity type', async () => {
            mockPrisma.activityType.findUnique.mockResolvedValue(null);

            await expect(service.deleteActivityType('invalid-id')).rejects.toThrow('not found');
        });

        it('should throw error when activity type is referenced', async () => {
            const id = '1';
            const existing = { id, name: 'Custom Type', activityCategoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(), version: 1 };

            mockPrisma.activityType.findUnique.mockResolvedValue(existing as any);
            mockPrisma.activity.count.mockResolvedValue(5);

            await expect(service.deleteActivityType(id)).rejects.toThrow('reference');
        });
    });
});
