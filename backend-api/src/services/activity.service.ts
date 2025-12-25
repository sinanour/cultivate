import { Activity, ActivityStatus, PrismaClient } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import { ActivityTypeRepository } from '../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../repositories/activity-venue-history.repository';
import { VenueRepository } from '../repositories/venue.repository';

export interface CreateActivityInput {
  name: string;
  activityTypeId: string;
  startDate: Date;
  endDate?: Date;
  status?: ActivityStatus;
  venueIds?: string[];
}

export interface UpdateActivityInput {
  name?: string;
  activityTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ActivityStatus;
}

export class ActivityService {
  constructor(
    private activityRepository: ActivityRepository,
    private activityTypeRepository: ActivityTypeRepository,
    private venueHistoryRepository: ActivityVenueHistoryRepository,
    private venueRepository: VenueRepository,
    private prisma: PrismaClient
  ) {}

  async getAllActivities(): Promise<Activity[]> {
    return this.activityRepository.findAll();
  }

  async getActivityById(id: string): Promise<Activity> {
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new Error('Activity not found');
    }
    return activity;
  }

  async createActivity(data: CreateActivityInput): Promise<Activity> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Activity name is required');
    }

    if (!data.activityTypeId) {
      throw new Error('Activity type ID is required');
    }

    if (!data.startDate) {
      throw new Error('Start date is required');
    }

    // Validate activity type exists
    const activityTypeExists = await this.activityTypeRepository.exists(data.activityTypeId);
    if (!activityTypeExists) {
      throw new Error('Activity type not found');
    }

    // Validate end date for finite activities
    // If endDate is provided, it's a finite activity
    if (data.endDate) {
      if (data.endDate <= data.startDate) {
        throw new Error('End date must be after start date');
      }
    }

    // Validate venues if provided
    if (data.venueIds && data.venueIds.length > 0) {
      for (const venueId of data.venueIds) {
        const venueExists = await this.venueRepository.exists(venueId);
        if (!venueExists) {
          throw new Error(`Venue ${venueId} not found`);
        }
      }
    }

    // Create activity and venue associations in a transaction
    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          name: data.name,
          activityTypeId: data.activityTypeId,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status || ActivityStatus.PLANNED,
        },
        include: {
          activityType: true,
        },
      });

      // Create venue associations if provided
      if (data.venueIds && data.venueIds.length > 0) {
        const now = new Date();
        for (const venueId of data.venueIds) {
          await tx.activityVenueHistory.create({
            data: {
              activityId: activity.id,
              venueId,
              effectiveFrom: now,
            },
          });
        }
      }

      return activity;
    });
  }

  async updateActivity(id: string, data: UpdateActivityInput): Promise<Activity> {
    const existing = await this.activityRepository.findById(id);
    if (!existing) {
      throw new Error('Activity not found');
    }

    // Validate activity type exists if provided
    if (data.activityTypeId) {
      const activityTypeExists = await this.activityTypeRepository.exists(data.activityTypeId);
      if (!activityTypeExists) {
        throw new Error('Activity type not found');
      }
    }

    // Validate end date if provided
    if (data.endDate !== undefined) {
      const startDate = data.startDate || existing.startDate;
      if (data.endDate && data.endDate <= startDate) {
        throw new Error('End date must be after start date');
      }
    }

    return this.activityRepository.update(id, data);
  }

  async deleteActivity(id: string): Promise<void> {
    const existing = await this.activityRepository.findById(id);
    if (!existing) {
      throw new Error('Activity not found');
    }

    await this.activityRepository.delete(id);
  }

  async getActivityVenues(activityId: string) {
    const activity = await this.activityRepository.findById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    return this.venueHistoryRepository.findByActivityId(activityId);
  }

  async associateVenue(activityId: string, venueId: string) {
    const activity = await this.activityRepository.findById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const venueExists = await this.venueRepository.exists(venueId);
    if (!venueExists) {
      throw new Error('Venue not found');
    }

    // Check if venue is already currently associated
    const currentVenues = await this.venueHistoryRepository.getCurrentVenues(activityId);
    const alreadyAssociated = currentVenues.some((v) => v.venueId === venueId);
    if (alreadyAssociated) {
      throw new Error('Venue is already associated with this activity');
    }

    return this.venueHistoryRepository.create({
      activityId,
      venueId,
      effectiveFrom: new Date(),
    });
  }

  async removeVenueAssociation(activityId: string, venueId: string) {
    const activity = await this.activityRepository.findById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const result = await this.venueHistoryRepository.closeVenueAssociation(
      activityId,
      venueId,
      new Date()
    );

    if (!result) {
      throw new Error('Venue association not found or already closed');
    }

    return result;
  }
}
