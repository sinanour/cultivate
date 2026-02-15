import { Activity, ActivityStatus, PrismaClient } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import { ActivityTypeRepository } from '../repositories/activity-type.repository';
import { ActivityVenueHistoryRepository } from '../repositories/activity-venue-history.repository';
import { VenueRepository } from '../repositories/venue.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
import { PaginatedResponse, PaginationHelper } from '../utils/pagination';
import { generateCSV, formatDateForCSV, parseCSV } from '../utils/csv.utils';
import { ImportResult } from '../types/csv.types';
import { ActivityImportSchema } from '../utils/validation.schemas';
import { AppError } from '../types/errors.types';
import { buildSelectClause, getValidFieldNames } from '../utils/query-builder.util';
import { GeographicFilteringService } from './geographic-filtering.service';

export interface CreateActivityInput {
  name: string;
  activityTypeId: string;
  startDate: Date;
  endDate?: Date;
  status?: ActivityStatus;
  additionalParticipantCount?: number | null;
  notes?: string | null;
  venueIds?: string[];
  createdBy?: string;
}

export interface UpdateActivityInput {
  name?: string;
  activityTypeId?: string;
  startDate?: Date;
  endDate?: Date | null;
  status?: ActivityStatus;
  additionalParticipantCount?: number | null;
  notes?: string | null;
  version?: number;
}

export interface FlexibleActivityQuery {
  page?: number;
  limit?: number;
  geographicAreaId?: string;
  activityTypeIds?: string[];
  activityCategoryIds?: string[];
  status?: ActivityStatus[];
  populationIds?: string[];
  startDate?: string;
  endDate?: string;
  filter?: Record<string, any>;
  fields?: string[];
  authorizedAreaIds?: string[];
  hasGeographicRestrictions?: boolean;
}

export class ActivityService {
  private geographicFilteringService: GeographicFilteringService;

  constructor(
    private activityRepository: ActivityRepository,
    private activityTypeRepository: ActivityTypeRepository,
    private venueHistoryRepository: ActivityVenueHistoryRepository,
    private venueRepository: VenueRepository,
    private prisma: PrismaClient,
    private geographicAuthorizationService: GeographicAuthorizationService
  ) {
    this.geographicFilteringService = new GeographicFilteringService(prisma);
  }

  /**
   * Normalize a value to an array
   * Handles comma-separated strings, single values, and arrays
   */
  private normalizeToArray(value: string | string[] | undefined): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
    }
    return undefined;
  }

  private addComputedFields(activity: Activity) {
    return {
      ...activity,
      isOngoing: activity.endDate === null,
    };
  }

  async getAllActivities(
    geographicAreaId?: string,
    authorizedAreaIds: string[] = [],
    hasGeographicRestrictions: boolean = false
  ): Promise<Activity[]> {
    // Determine effective geographic area IDs using shared service
    const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIds(
      geographicAreaId,
      authorizedAreaIds,
      hasGeographicRestrictions
    );

    if (!effectiveAreaIds) {
  // No geographic filter
      const activities = await this.activityRepository.findAll();
      return activities.map((a) => this.addComputedFields(a));
    }

    // Use effective area IDs for filtering
    const areaIds = effectiveAreaIds;

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

  async getAllActivitiesPaginated(
    page?: number,
    limit?: number,
    geographicAreaId?: string,
    authorizedAreaIds: string[] = [],
    hasGeographicRestrictions: boolean = false
  ): Promise<PaginatedResponse<Activity>> {
    const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

    // Determine effective geographic area IDs using shared service
    const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIds(
      geographicAreaId,
      authorizedAreaIds,
      hasGeographicRestrictions
    );

    if (!effectiveAreaIds) {
    // No geographic filter
      const { data, total } = await this.activityRepository.findAllPaginated(validPage, validLimit);
      const activitiesWithComputed = data.map((a) => this.addComputedFields(a));
      return PaginationHelper.createResponse(activitiesWithComputed, validPage, validLimit, total);
    }

    // Use effective area IDs for filtering
    const areaIds = effectiveAreaIds;

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

  async getAllActivitiesWithFilters(
    page?: number,
    limit?: number,
    filters?: {
      geographicAreaId?: string;
      activityTypeIds?: string[];
      activityCategoryIds?: string[];
      status?: ActivityStatus[];
      populationIds?: string[];
      startDate?: Date;
      endDate?: Date;
    },
    authorizedAreaIds: string[] = [],
    hasGeographicRestrictions: boolean = false
  ): Promise<PaginatedResponse<Activity>> {
    // Delegate to flexible query method for backward compatibility
    return this.getActivitiesFlexible({
      page,
      limit,
      geographicAreaId: filters?.geographicAreaId,
      activityTypeIds: filters?.activityTypeIds,
      activityCategoryIds: filters?.activityCategoryIds,
      status: filters?.status,
      populationIds: filters?.populationIds,
      startDate: filters?.startDate?.toISOString(),
      endDate: filters?.endDate?.toISOString(),
      authorizedAreaIds,
      hasGeographicRestrictions
    });
  }

  /**
   * Get activities with flexible filtering and customizable attribute selection
   */
  async getActivitiesFlexible(query: FlexibleActivityQuery): Promise<PaginatedResponse<Activity>> {
    const {
      page,
      limit,
      geographicAreaId,
      activityTypeIds,
      activityCategoryIds,
      status,
      populationIds,
      startDate,
      endDate,
      filter,
      fields,
      authorizedAreaIds = [],
      hasGeographicRestrictions = false
    } = query;

    const { page: validPage, limit: validLimit } = PaginationHelper.validateAndNormalize({ page, limit });

    // Build select clause for attribute selection
    let select: any = undefined;
    if (fields && fields.length > 0) {
      try {
        const validFields = getValidFieldNames('activity');
        select = buildSelectClause(fields, validFields);
      } catch (error) {
        throw new AppError('INVALID_FIELDS', (error as Error).message, 400);
      }
    }

    // Determine effective geographic area IDs using shared service
    const effectiveAreaIds = await this.geographicFilteringService.getEffectiveGeographicAreaIds(
      geographicAreaId,
      authorizedAreaIds,
      hasGeographicRestrictions
    );

    // Build filter object for repository (merge legacy and flexible filters)
    const repositoryFilters: any = {
      activityTypeIds: this.normalizeToArray(activityTypeIds || filter?.activityTypeIds),
      activityCategoryIds: this.normalizeToArray(activityCategoryIds || filter?.activityCategoryIds),
      status: this.normalizeToArray(status || filter?.status),
      populationIds: this.normalizeToArray(populationIds || filter?.populationIds),
      startDate: startDate ? new Date(startDate) : (filter?.startDate ? new Date(filter.startDate) : undefined),
      endDate: endDate ? new Date(endDate) : (filter?.endDate ? new Date(filter.endDate) : undefined),
      geographicAreaIds: effectiveAreaIds,
    };

    // Add name filter if provided (high-cardinality text field)
    if (filter?.name) {
      repositoryFilters.name = filter.name;
    }

    // Add updatedAt filter if provided (timestamp range filtering)
    if (filter?.updatedAt) {
      repositoryFilters.updatedAt = filter.updatedAt;
    }

    // Use repository's comprehensive filtering method
    const { data, total } = await this.activityRepository.findWithFilters(
      repositoryFilters,
      validPage,
      validLimit,
      select
    );

    const activitiesWithComputed = data.map((a) => this.addComputedFields(a));
    return PaginationHelper.createResponse(activitiesWithComputed, validPage, validLimit, total);
  }

  async getActivityById(id: string, userId?: string, userRole?: string): Promise<Activity> {
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Enforce geographic authorization if userId is provided
    if (userId) {
      // Administrator bypass
      if (userRole === 'ADMINISTRATOR') {
        return this.addComputedFields(activity);
      }

      // Determine activity's current venue from venue history
      const currentVenue = await this.venueHistoryRepository.getCurrentVenue(id);

      if (currentVenue) {
        // Get the venue to access its geographic area
        const venue = await this.prisma.venue.findUnique({
          where: { id: currentVenue.venueId },
        });

        if (venue) {
          // Validate authorization to access the venue's geographic area
          const accessLevel = await this.geographicAuthorizationService.evaluateAccess(
            userId,
            venue.geographicAreaId
          );

          if (accessLevel === AccessLevel.NONE) {
            await this.geographicAuthorizationService.logAuthorizationDenial(
              userId,
              'ACTIVITY',
              id,
              'GET'
            );
            throw new AppError(
              'GEOGRAPHIC_AUTHORIZATION_DENIED',
              'You do not have permission to access this activity',
              403
            );
          }
        }
      }
      // If no venue history, allow access (activity not yet associated with any area)
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
      if (data.endDate < data.startDate) {
        throw new Error('End date must be on or after start date');
      }
    }

    // Validate additionalParticipantCount if provided
    if (data.additionalParticipantCount !== undefined && data.additionalParticipantCount !== null) {
      if (data.additionalParticipantCount <= 0) {
        throw new Error('Additional participant count must be a positive integer');
      }
      if (!Number.isInteger(data.additionalParticipantCount)) {
        throw new Error('Additional participant count must be an integer');
      }
    }

    // Validate notes if provided
    if (data.notes !== undefined && data.notes !== null) {
      if (data.notes.length > 2000) {
        throw new Error('Notes must be at most 2000 characters');
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
          additionalParticipantCount: data.additionalParticipantCount,
          notes: data.notes,
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

  async updateActivity(
    id: string,
    data: UpdateActivityInput,
    userId?: string,
    userRole?: string
  ): Promise<Activity> {
    // Validate authorization by calling getActivityById (which enforces geographic authorization)
    await this.getActivityById(id, userId, userRole);

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

    // Validate end date if provided (skip validation if explicitly null for clearing)
    if (data.endDate !== undefined && data.endDate !== null) {
      const startDate = data.startDate || existing.startDate;
      if (data.endDate < startDate) {
        throw new Error('End date must be on or after start date');
      }
    }

    // Validate additionalParticipantCount if provided
    if (data.additionalParticipantCount !== undefined && data.additionalParticipantCount !== null) {
      if (data.additionalParticipantCount <= 0) {
        throw new Error('Additional participant count must be a positive integer');
      }
      if (!Number.isInteger(data.additionalParticipantCount)) {
        throw new Error('Additional participant count must be an integer');
      }
    }

    // Validate notes if provided
    if (data.notes !== undefined && data.notes !== null) {
      if (data.notes.length > 2000) {
        throw new Error('Notes must be at most 2000 characters');
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

  async deleteActivity(
    id: string,
    userId?: string,
    userRole?: string
  ): Promise<void> {
    // Validate authorization by calling getActivityById (which enforces geographic authorization)
    await this.getActivityById(id, userId, userRole);

    await this.activityRepository.delete(id);
  }

  async associateVenue(
    activityId: string,
    venueId: string,
    effectiveFrom?: Date | null,
    authorizedAreaIds: string[] = [],
    hasGeographicRestrictions: boolean = false
  ) {
    const activity = await this.activityRepository.findById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const venue = await this.venueRepository.findById(venueId);
    if (!venue) {
      throw new Error('Venue not found');
    }

    // Validate user has access to the venue's geographic area
    if (hasGeographicRestrictions && !authorizedAreaIds.includes(venue.geographicAreaId)) {
      throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to associate this venue with the activity');
    }

    // Use provided effectiveFrom, or null if not provided
    const effectiveDate = effectiveFrom !== undefined ? effectiveFrom : null;

    // Check if a duplicate effectiveFrom exists (including null)
    const hasDuplicate = await this.venueHistoryRepository.hasDuplicateEffectiveFrom(
      activityId,
      effectiveDate
    );
    if (hasDuplicate) {
      throw new Error(
        effectiveDate === null
          ? 'A venue association with null effective date (activity start) already exists'
          : 'A venue association already exists with this effective date'
      );
    }

    // Validate at most one null effectiveFrom per activity
    if (effectiveDate === null) {
      const hasNullDate = await this.venueHistoryRepository.hasNullEffectiveFrom(activityId);
      if (hasNullDate) {
        throw new Error('Only one venue association can have a null effective date per activity');
      }
    }

    return this.venueHistoryRepository.create({
      activityId,
      venueId,
      effectiveFrom: effectiveDate,
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

  async getActivityVenues(activityId: string, userId?: string, userRole?: string) {
    // Validate authorization by calling getActivityById (which enforces geographic authorization)
    await this.getActivityById(activityId, userId, userRole);

    return this.venueHistoryRepository.findByActivityId(activityId);
  }

  async exportActivitiesToCSV(
    geographicAreaId?: string,
    authorizedAreaIds: string[] = [],
    hasGeographicRestrictions: boolean = false
  ): Promise<string> {
    // Get all activities (with geographic filter if provided)
    const activities = await this.getAllActivities(geographicAreaId, authorizedAreaIds, hasGeographicRestrictions);

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
      'additionalParticipantCount',
      'notes',
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
      additionalParticipantCount: (a as any).additionalParticipantCount ?? '',
      notes: (a as any).notes ?? '',
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
            status: validated.status,
            additionalParticipantCount: validated.additionalParticipantCount,
            notes: validated.notes
          });
        } else {
          // Create new activity
          await this.createActivity({
            name: validated.name,
            activityTypeId: validated.activityTypeId,
            startDate: new Date(validated.startDate),
            endDate: validated.endDate ? new Date(validated.endDate) : undefined,
            status: validated.status,
            additionalParticipantCount: validated.additionalParticipantCount,
            notes: validated.notes
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
