import { ActivityType } from '@prisma/client';
import { ActivityTypeRepository } from '../repositories/activity-type.repository';

export class ActivityTypeService {
    // Predefined activity types that are seeded
    private readonly PREDEFINED_TYPES = [
        "Children's Class",
        'Junior Youth Group',
        'Devotional Gathering',
        'Ruhi Book 1',
        'Ruhi Book 2',
        'Ruhi Book 3',
        'Ruhi Book 3A',
        'Ruhi Book 3B',
        'Ruhi Book 3C',
        'Ruhi Book 3D',
        'Ruhi Book 4',
        'Ruhi Book 5',
        'Ruhi Book 5A',
        'Ruhi Book 5B',
        'Ruhi Book 6',
        'Ruhi Book 7',
        'Ruhi Book 8',
        'Ruhi Book 9',
        'Ruhi Book 10',
        'Ruhi Book 11',
        'Ruhi Book 12',
        'Ruhi Book 13',
        'Ruhi Book 14',
    ];

    constructor(private activityTypeRepository: ActivityTypeRepository) { }

    private addComputedFields(activityType: ActivityType) {
        return {
            ...activityType,
            isPredefined: this.PREDEFINED_TYPES.includes(activityType.name),
        };
    }

    /**
     * Get all activity types
     */
    async getAllActivityTypes(): Promise<ActivityType[]> {
        const types = await this.activityTypeRepository.findAll();
        return types.map((t) => this.addComputedFields(t));
    }

    /**
     * Get activity type by ID
     */
    async getActivityTypeById(id: string): Promise<ActivityType> {
        const activityType = await this.activityTypeRepository.findById(id);
        if (!activityType) {
            throw new Error('Activity type not found');
        }
        return this.addComputedFields(activityType);
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

        const created = await this.activityTypeRepository.create(data);
        return this.addComputedFields(created);
    }

    /**
     * Update an activity type
     */
    async updateActivityType(id: string, data: { name: string; version?: number }): Promise<ActivityType> {
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

        try {
            const updated = await this.activityTypeRepository.update(id, data);
            return this.addComputedFields(updated);
        } catch (error) {
            if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
                throw new Error('VERSION_CONFLICT');
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
