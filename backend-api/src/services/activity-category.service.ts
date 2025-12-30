import { ActivityCategory } from '@prisma/client';
import { ActivityCategoryRepository } from '../repositories/activity-category.repository';
import { AppError } from '../types/errors.types';

export class ActivityCategoryService {
    constructor(private activityCategoryRepository: ActivityCategoryRepository) { }

    async getAllActivityCategories(): Promise<ActivityCategory[]> {
        return this.activityCategoryRepository.findAll();
    }

    async getActivityCategoryById(id: string): Promise<ActivityCategory> {
        const activityCategory = await this.activityCategoryRepository.findById(id);

        if (!activityCategory) {
            throw new AppError('NOT_FOUND', 'Activity category not found', 404);
        }

        return activityCategory;
    }

    async createActivityCategory(data: { name: string }): Promise<ActivityCategory> {
        // Check for duplicate name
        const existing = await this.activityCategoryRepository.findByName(data.name);
        if (existing) {
            throw new AppError('DUPLICATE_NAME', 'Activity category with this name already exists', 400);
        }

        return this.activityCategoryRepository.create(data);
    }

    async updateActivityCategory(id: string, data: { name: string; version: number }): Promise<ActivityCategory> {
        // Check if activity category exists
        const existing = await this.activityCategoryRepository.findById(id);
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Activity category not found', 404);
        }

        // Check for duplicate name (excluding current category)
        const duplicate = await this.activityCategoryRepository.findByName(data.name);
        if (duplicate && duplicate.id !== id) {
            throw new AppError('DUPLICATE_NAME', 'Activity category with this name already exists', 400);
        }

        try {
            return await this.activityCategoryRepository.update(id, data);
        } catch (error: any) {
            if (error.message === 'VERSION_CONFLICT') {
                throw new AppError('VERSION_CONFLICT', 'Activity category was modified by another user', 409);
            }
            throw error;
        }
    }

    async deleteActivityCategory(id: string): Promise<void> {
        // Check if activity category exists
        const existing = await this.activityCategoryRepository.findById(id);
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Activity category not found', 404);
        }

        // Check if any activity types reference this category
        const referenceCount = await this.activityCategoryRepository.countReferences(id);
        if (referenceCount > 0) {
            throw new AppError(
                'REFERENCED_ENTITY',
                `Cannot delete activity category. ${referenceCount} activity type(s) reference it.`,
                400
            );
        }

        await this.activityCategoryRepository.delete(id);
    }
}
