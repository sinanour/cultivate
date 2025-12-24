import { ActivityType } from '@prisma/client';
import { ActivityTypeRepository } from '../repositories/activity-type.repository';

export class ActivityTypeService {
    constructor(private activityTypeRepository: ActivityTypeRepository) { }

    /**
     * Get all activity types
     */
    async getAllActivityTypes(): Promise<ActivityType[]> {
        return this.activityTypeRepository.findAll();
    }

    /**
     * Get activity type by ID
     */
    async getActivityTypeById(id: string): Promise<ActivityType> {
        const activityType = await this.activityTypeRepository.findById(id);
        if (!activityType) {
            throw new Error('Activity type not found');
        }
        return activityType;
    }

    /**
     * Create a new activity type
     */
    async createActivityType(data: { name: string }): Promise<ActivityType> {
        // Validate name uniqueness
        const existing = await this.activityTypeRepository.findByName(data.name);
        if (existing) {
            throw new Error('Activity type with this name already exists');
        }

        // Validate name is provided
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Activity type name is required');
        }

        return this.activityTypeRepository.create(data);
    }

    /**
     * Update an activity type
     */
    async updateActivityType(id: string, data: { name: string }): Promise<ActivityType> {
        // Check if activity type exists
        const existing = await this.activityTypeRepository.findById(id);
        if (!existing) {
            throw new Error('Activity type not found');
        }

        // Validate name uniqueness (excluding current activity type)
        const duplicate = await this.activityTypeRepository.findByName(data.name);
        if (duplicate && duplicate.id !== id) {
            throw new Error('Activity type with this name already exists');
        }

        // Validate name is provided
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Activity type name is required');
        }

        return this.activityTypeRepository.update(id, data);
    }

    /**
     * Delete an activity type
     */
    async deleteActivityType(id: string): Promise<void> {
        // Check if activity type exists
        const existing = await this.activityTypeRepository.findById(id);
        if (!existing) {
            throw new Error('Activity type not found');
        }

        // Check if any activities reference this activity type
        const referenceCount = await this.activityTypeRepository.countReferences(id);
        if (referenceCount > 0) {
            throw new Error(
                `Cannot delete activity type. It is referenced by ${referenceCount} activity(ies)`
            );
        }

        await this.activityTypeRepository.delete(id);
    }
}
