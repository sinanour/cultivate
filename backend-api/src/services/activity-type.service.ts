import { ActivityType } from '@prisma/client';
import { ActivityTypeRepository } from '../repositories/activity-type.repository';
import { ActivityCategoryRepository } from '../repositories/activity-category.repository';
import { AppError } from '../types/errors.types';

export class ActivityTypeService {
    // Predefined activity types that are seeded
    private readonly PREDEFINED_TYPES = [
        "Children's Class",
        'Junior Youth Group',
        'Devotional Gathering',
        'Ruhi Book 01',
        'Ruhi Book 02',
        'Ruhi Book 03',
        'Ruhi Book 03A',
        'Ruhi Book 03B',
        'Ruhi Book 03C',
        'Ruhi Book 03D',
        'Ruhi Book 04',
        'Ruhi Book 05',
        'Ruhi Book 05A',
        'Ruhi Book 05B',
        'Ruhi Book 06',
        'Ruhi Book 07',
        'Ruhi Book 08',
        'Ruhi Book 09',
        'Ruhi Book 10',
        'Ruhi Book 11',
        'Ruhi Book 12',
        'Ruhi Book 13',
        'Ruhi Book 14',
    ];

    constructor(
        private activityTypeRepository: ActivityTypeRepository,
        private activityCategoryRepository: ActivityCategoryRepository
    ) { }

    private addComputedFields(activityType: any) {
        return {
            ...activityType,
            isPredefined: this.PREDEFINED_TYPES.includes(activityType.name),
        };
    }

    /**
     * Get all activity types with category information
     */
    async getAllActivityTypes(): Promise<ActivityType[]> {
        const types = await this.activityTypeRepository.findAll();
        return types.map((t) => this.addComputedFields(t));
    }

    /**
     * Get activity type by ID with category information
     */
    async getActivityTypeById(id: string): Promise<ActivityType> {
        const activityType = await this.activityTypeRepository.findById(id);
        if (!activityType) {
            throw new AppError('NOT_FOUND', 'Activity type not found', 404);
        }
        return this.addComputedFields(activityType);
    }

    /**
     * Create a new activity type
     */
    async createActivityType(data: { name: string; activityCategoryId: string }): Promise<ActivityType> {
        // Validate name is provided
        if (!data.name || data.name.trim().length === 0) {
            throw new AppError('VALIDATION_ERROR', 'Activity type name is required', 400);
        }

        // Validate name uniqueness
        const existing = await this.activityTypeRepository.findByName(data.name);
        if (existing) {
            throw new AppError('DUPLICATE_NAME', 'Activity type with this name already exists', 400);
        }

        // Validate activity category exists
        const categoryExists = await this.activityCategoryRepository.findById(data.activityCategoryId);
        if (!categoryExists) {
            throw new AppError('INVALID_REFERENCE', 'Activity category does not exist', 400);
        }

        const created = await this.activityTypeRepository.create(data);
        return this.addComputedFields(created);
    }

    /**
     * Update an activity type
     */
    async updateActivityType(
        id: string,
        data: { name?: string; activityCategoryId?: string; version?: number }
    ): Promise<ActivityType> {
        // Check if activity type exists
        const existing = await this.activityTypeRepository.findById(id);
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Activity type not found', 404);
        }

        // Validate name if provided
        if (data.name !== undefined && data.name.trim().length === 0) {
            throw new AppError('VALIDATION_ERROR', 'Activity type name cannot be empty', 400);
        }

        // Validate name uniqueness (excluding current activity type)
        if (data.name) {
            const duplicate = await this.activityTypeRepository.findByName(data.name);
            if (duplicate && duplicate.id !== id) {
                throw new AppError('DUPLICATE_NAME', 'Activity type with this name already exists', 400);
            }
        }

        // Validate activity category exists if provided
        if (data.activityCategoryId) {
            const categoryExists = await this.activityCategoryRepository.findById(data.activityCategoryId);
            if (!categoryExists) {
                throw new AppError('INVALID_REFERENCE', 'Activity category does not exist', 400);
            }
        }

        try {
            const updated = await this.activityTypeRepository.update(id, data);
            return this.addComputedFields(updated);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new AppError('VERSION_CONFLICT', 'Activity type was modified by another user', 409);
            }
            throw error;
        }
    }

    /**
     * Delete an activity type
     */
    async deleteActivityType(id: string): Promise<void> {
        // Check if activity type exists
        const existing = await this.activityTypeRepository.findById(id);
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Activity type not found', 404);
        }

        // Check if any activities reference this activity type
        const referenceCount = await this.activityTypeRepository.countReferences(id);
        if (referenceCount > 0) {
            throw new AppError(
                'REFERENCED_ENTITY',
                `Cannot delete activity type. ${referenceCount} activity(ies) reference it.`,
                400
            );
        }

        await this.activityTypeRepository.delete(id);
    }
}
