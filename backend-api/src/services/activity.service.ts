import { Activity, ActivityStatus, PrismaClient } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import { ActivityTypeRepository } from '../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../repositories/activity-venue-history.repository';
import { VenueRepository } from '../repositories/venue.repository';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { ActivityImportSchema } from '../utils/validation.schemas';

export interface CreateActivityInput {
  name: string;
  activityTypeId: string;
  startDate: Date;
  endDate?: Date;
  status?: ActivityStatus;
  venueIds?: string[];
  createdBy?: string;
}

export interface UpdateActivityInput {
  name?: string;
  activityTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ActivityStatus;
  version?: number;
}

export class ActivityService {
  constructor(
    private activityRepository: ActivityRepository,
    private activityTypeRepository: ActivityTypeRepository,
    private venueHistoryRepository: ActivityVenueHistoryRepository,
    private venueRepository: VenueRepository,
    private prisma: PrismaClient,
    private geographicAreaRepository: GeographicAreaRepository
  ) {}

  private addComputedFields(activity: Activity) {
    return {
      ...activity,
      isOngoing: activity.endDate === null,
    };
  }

  async getAllActivities(geographicAreaId?: string): Promise<Activity[]> {
    if (!geographicAreaId) {
      const activities = await this.activityRepository.findAll();
      return activities.map((a) => this.addComputedFields(a));
    }

    // Get all descendant IDs including the area itself
    const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
    const areaIds = [geographicAreaId, ...descendantIds];

    // Get all activities with their most recent venue and activityType
    const allActivities = await this.prisma.activity.findMany({
      include: {
        activityType: {
          include: {
            activityCategory: true,
          },
        },
        activityVenueHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: { venue: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Filter to only those whose current venue is in the geographic area
    const filteredActivities = allActivities.filter(a =>
      a.activityVenueHistory.length > 0 &&
      areaIds.includes(a.activityVenueHistory[0].venue.geographicAreaId)
    );

    // Remove the activityVenueHistory from the response (keep activityType)
    const activities = filteredActivities.map((a) => {
      const { activityVenueHistory, ...activity } = a;
      return activity;
    });
    return activities.map((a) => this.addComputedFields(a));
  }

  async getAllActivitiesPaginated(page?: number, limit?: number, geographicAreaId?: string): Promise<PaginatedResponse<Activity>> {
    const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

    if (!geographicAreaId) {
      const { data, total } = await this.activityRepository.findAllPaginated(validPage, validLimit);
      const activitiesWithComputed = data.map((a) => this.addComputedFields(a));
      return PaginationHelper.createResponse(activitiesWithComputed, validPage, validLimit, total);
    }

    // Get all descendant IDs including the area itself
    const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
    const areaIds = [geographicAreaId, ...descendantIds];

    // Get all activities with their most recent venue and activityType
    const allActivities = await this.prisma.activity.findMany({
      include: {
        activityType: {
          include: {
            activityCategory: true,
          },
        },
        activityVenueHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: { venue: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Filter to only those whose current venue is in the geographic area
    const filteredActivities = allActivities.filter(a =>
      a.activityVenueHistory.length > 0 &&
      areaIds.includes(a.activityVenueHistory[0].venue.geographicAreaId)
    );

    // Apply pagination
    const total = filteredActivities.length;
    const skip = (validPage - 1) * validLimit;
    const paginatedActivities = filteredActivities.slice(skip, skip + validLimit);

    // Remove the activityVenueHistory from the response (keep activityType)
    const data = paginatedActivities.map((a) => {
      const { activityVenueHistory, ...activity } = a;
      return activity;
    });
    const activitiesWithComputed = data.map((a) => this.addComputedFields(a));
    return PaginationHelper.createResponse(activitiesWithComputed, validPage, validLimit, total);
  }

  async getActivityById(id: string): Promise<Activity> {
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new Error('Activity not found');
    }
    return this.addComputedFields(activity);
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
          createdBy: data.createdBy,
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

    try {
      const updated = await this.activityRepository.update(id, data);
      return this.addComputedFields(updated);
    } catch (error) {
      if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
        throw new Error('VERSION_CONFLICT');
      }
      throw error;
    }
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

    // Check if a duplicate effectiveFrom exists (same date)
    const now = new Date();
    const hasDuplicate = await this.venueHistoryRepository.hasDuplicateEffectiveFrom(
      activityId,
      now
    );
    if (hasDuplicate) {
      throw new Error('A venue association already exists with this effective date');
    }

    return this.venueHistoryRepository.create({
      activityId,
      venueId,
      effectiveFrom: now,
    });
  }

  async removeVenueAssociation(activityId: string, venueHistoryId: string) {
    const activity = await this.activityRepository.findById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const venueHistory = await this.venueHistoryRepository.findById(venueHistoryId);
    if (!venueHistory || venueHistory.activityId !== activityId) {
      throw new Error('Venue association not found');
    }

    await this.venueHistoryRepository.delete(venueHistoryId);
  }

  async exportActivitiesToCSV(geographicAreaId?: string): Promise<string> {
    // Get all activities (with geographic filter if provided)
    const activities = await this.getAllActivities(geographicAreaId);

    // Fetch activities with full details
    const activitiesWithDetails = await Promise.all(
      activities.map(a => this.activityRepository.findById(a.id))
    );

    // Define CSV columns
    const columns = [
      'id',
      'name',
      'activityTypeId',
      'activityTypeName',
      'activityCategoryId',
      'activityCategoryName',
      'startDate',
      'endDate',
      'status',
      'createdAt',
      'updatedAt'
    ];

    // Transform activities to CSV format
    const data = activitiesWithDetails.map(a => ({
      id: a!.id,
      name: a!.name,
      activityTypeId: a!.activityTypeId,
      activityTypeName: (a as any).activityType?.name || '',
      activityCategoryId: (a as any).activityType?.activityCategoryId || '',
      activityCategoryName: (a as any).activityType?.activityCategory?.name || '',
      startDate: formatDateForCSV(a!.startDate),
      endDate: formatDateForCSV(a!.endDate),
      status: a!.status,
      createdAt: formatDateForCSV(a!.createdAt),
      updatedAt: formatDateForCSV(a!.updatedAt)
    }));

    return generateCSV({ columns, data });
  }

  async importActivitiesFromCSV(fileBuffer: Buffer): Promise<ImportResult> {
    // Parse CSV
    let records: any[];
    try {
      records = parseCSV(fileBuffer);
    } catch (error) {
      throw new Error(`Invalid CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const result: ImportResult = {
      totalRows: records.length,
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 for header row and 0-based index

      try {
        // Validate record
        const validated = ActivityImportSchema.parse(record);

        // Create or update
        if (validated.id) {
          // Update existing activity
          await this.updateActivity(validated.id, {
            name: validated.name,
            activityTypeId: validated.activityTypeId,
            startDate: new Date(validated.startDate),
            endDate: validated.endDate ? new Date(validated.endDate) : undefined,
            status: validated.status
          });
        } else {
          // Create new activity
          await this.createActivity({
            name: validated.name,
            activityTypeId: validated.activityTypeId,
            startDate: new Date(validated.startDate),
            endDate: validated.endDate ? new Date(validated.endDate) : undefined,
            status: validated.status
          });
        }

        result.successCount++;
      } catch (error) {
        result.failureCount++;
        const errorMessages: string[] = [];

        if (error instanceof Error) {
          errorMessages.push(error.message);
        } else if (typeof error === 'object' && error !== null && 'errors' in error) {
          // Zod validation error
          const zodError = error as any;
          errorMessages.push(...zodError.errors.map((e: any) => e.message));
        } else {
          errorMessages.push('Unknown error');
        }

        result.errors.push({
          row: rowNumber,
          data: record,
          errors: errorMessages
        });
      }
    }

    return result;
  }
}
