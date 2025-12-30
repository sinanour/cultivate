import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import {
    ActivityStatus,
    TimePeriod,
    DateGranularity,
    GroupingDimension,
    DimensionKeys,
} from '../utils/constants';

export { TimePeriod, DateGranularity, GroupingDimension };

export interface ActivityTypeBreakdown {
    activityTypeId: string;
    activityTypeName: string;
    activitiesAtStart: number;
    activitiesAtEnd: number;
    activitiesStarted: number;
    activitiesCompleted: number;
    activitiesCancelled: number;
    participantsAtStart: number;
    participantsAtEnd: number;
}

export interface ActivityCategoryBreakdown {
    activityCategoryId: string;
    activityCategoryName: string;
    activitiesAtStart: number;
    activitiesAtEnd: number;
    activitiesStarted: number;
    activitiesCompleted: number;
    activitiesCancelled: number;
    participantsAtStart: number;
    participantsAtEnd: number;
}

export interface RoleDistribution {
    roleId: string;
    roleName: string;
    count: number;
}

export interface GeographicBreakdown {
    geographicAreaId: string;
    geographicAreaName: string;
    activityCount: number;
    participantCount: number;
    hasChildren: boolean;
}

export interface GroupedMetrics {
    dimensions: Record<string, string>;
    metrics: EngagementMetrics;
}

export interface EngagementMetrics {
    // Temporal activity counts
    activitiesAtStart: number;
    activitiesAtEnd: number;
    activitiesStarted: number;
    activitiesCompleted: number;
    activitiesCancelled: number;

    // Temporal participant counts
    participantsAtStart: number;
    participantsAtEnd: number;

    // Aggregate counts
    totalActivities: number;
    totalParticipants: number;

    // Breakdown by activity category
    activitiesByCategory: ActivityCategoryBreakdown[];

    // Breakdown by activity type
    activitiesByType: ActivityTypeBreakdown[];

    // Role distribution
    roleDistribution: RoleDistribution[];

    // Geographic breakdown
    geographicBreakdown: GeographicBreakdown[];

    // Grouped results (when groupBy dimensions specified)
    groupedResults?: GroupedMetrics[];

    // Metadata
    periodStart: string;
    periodEnd: string;
    appliedFilters: {
        activityCategoryId?: string;
        activityTypeId?: string;
        venueId?: string;
        geographicAreaId?: string;
        startDate?: string;
        endDate?: string;
    };
    groupingDimensions?: string[];
}

export interface GrowthPeriodData {
    period: string;
    newActivities: number;
    cumulativeParticipants: number;
    cumulativeActivities: number;
    percentageChange: number | null;
}

export interface GrowthMetrics {
    timeSeries: GrowthPeriodData[];
}

export interface AnalyticsFilters {
    startDate?: Date;
    endDate?: Date;
    geographicAreaId?: string;
    activityCategoryId?: string;
    activityTypeId?: string;
    venueId?: string;
    groupBy?: GroupingDimension[];
    dateGranularity?: DateGranularity;
}

export class AnalyticsService {
    constructor(
        private prisma: PrismaClient,
        private geographicAreaRepository: GeographicAreaRepository
    ) { }

    async getEngagementMetrics(filters: AnalyticsFilters = {}): Promise<EngagementMetrics> {
        const { startDate, geographicAreaId, activityCategoryId, activityTypeId, venueId, groupBy } = filters;

        // Default endDate to now if startDate is provided but endDate is not
        const endDate = filters.endDate || (startDate ? new Date() : undefined);

        // If groupBy dimensions are specified, return grouped results
        if (groupBy && groupBy.length > 0) {
            return this.getGroupedEngagementMetrics({ ...filters, endDate });
        }

        // Get venue IDs if geographic or venue filter is provided
        let venueIds: string[] | undefined;
        if (geographicAreaId) {
            venueIds = await this.getVenueIdsForArea(geographicAreaId);
        } else if (venueId) {
            venueIds = [venueId];
        }

        // Build base activity filter
        const activityWhere: any = {};

        if (activityCategoryId) {
            activityWhere.activityType = {
                activityCategoryId,
            };
        }

        if (activityTypeId) {
            activityWhere.activityTypeId = activityTypeId;
        }

        if (venueIds) {
            activityWhere.activityVenueHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        // Get all activities (we'll filter by date in memory for temporal analysis)
        const allActivities = await this.prisma.activity.findMany({
            where: activityWhere,
            include: {
                activityType: {
                    include: {
                        activityCategory: true,
                    },
                },
                activityVenueHistory: true,
                assignments: {
                    include: {
                        participant: true,
                        role: true,
                    },
                },
            },
        });

        // Calculate temporal metrics
        // An activity "exists" at a point in time if:
        // - It was created before or at that time AND
        // - It was not completed or cancelled before that time (or has no end date for ongoing)

        const activitiesAtStart = startDate
            ? allActivities.filter(a => {
                // Must be created before or at start date
                if (a.createdAt > startDate) return false;

                // If completed or cancelled, check if it happened after start date
                if (a.status === ActivityStatus.COMPLETED || a.status === ActivityStatus.CANCELLED) {
                    // For completed/cancelled activities, check if endDate is after startDate
                    return a.endDate && a.endDate >= startDate;
                }

                // For planned/active activities, they exist if created before startDate
                return true;
            }).length
            : 0;

        const activitiesAtEnd = endDate
            ? allActivities.filter(a => {
                // Must be created before or at end date
                if (a.createdAt > endDate) return false;

                // If completed or cancelled, check if it happened after end date
                if (a.status === ActivityStatus.COMPLETED || a.status === ActivityStatus.CANCELLED) {
                    // For completed/cancelled activities, check if endDate is after the reference date
                    return a.endDate && a.endDate >= endDate;
                }

                // For planned/active activities, they exist if created before endDate
                return true;
            }).length
            : allActivities.filter(a =>
                a.status !== ActivityStatus.COMPLETED && a.status !== ActivityStatus.CANCELLED
            ).length;

        const activitiesStarted = startDate && endDate
            ? allActivities.filter(a => a.startDate >= startDate && a.startDate <= endDate).length
            : startDate && !endDate
                ? allActivities.filter(a => a.startDate >= startDate).length
                : !startDate && endDate
                    ? allActivities.filter(a => a.startDate <= endDate).length
                    : allActivities.length; // No date filter = all activities were "started"

        // For completed/cancelled, we need to check when the status changed
        // Since we don't have a status change timestamp, we'll use endDate as a proxy
        const activitiesCompleted = startDate && endDate
            ? allActivities.filter(a =>
                a.status === ActivityStatus.COMPLETED &&
                a.endDate &&
                a.endDate >= startDate &&
                a.endDate <= endDate
            ).length
            : allActivities.filter(a => a.status === ActivityStatus.COMPLETED).length;

        const activitiesCancelled = startDate && endDate
            ? allActivities.filter(a =>
                a.status === ActivityStatus.CANCELLED &&
                a.endDate &&
                a.endDate >= startDate &&
                a.endDate <= endDate
            ).length
            : allActivities.filter(a => a.status === ActivityStatus.CANCELLED).length;

        // Get all participants for temporal analysis
        // Participants should be filtered based on the venues of activities they're assigned to,
        // not their home address history
        const activityIds = allActivities.map(a => a.id);

        const allParticipants = await this.prisma.participant.findMany({
            where: {
                assignments: {
                    some: {
                        activityId: { in: activityIds },
                    },
                },
            },
            include: {
                assignments: {
                    include: {
                        activity: true,
                    },
                },
            },
        });

        // Calculate participant temporal metrics
        const participantsAtStart = startDate
            ? allParticipants.filter(p =>
                p.assignments.some(a =>
                    a.createdAt <= startDate &&
                    allActivities.some(act => act.id === a.activityId)
                )
            ).length
            : 0;

        const participantsAtEnd = endDate
            ? allParticipants.filter(p =>
                p.assignments.some(a =>
                    a.createdAt <= endDate &&
                    allActivities.some(act => act.id === a.activityId)
                )
            ).length
            : allParticipants.filter(p => p.assignments.length > 0).length;

        // Calculate aggregate counts
        const totalActivities = allActivities.length;
        const totalParticipants = new Set(
            allActivities.flatMap(a => a.assignments.map(as => as.participantId))
        ).size;

        // Calculate breakdown by activity type
        const activitiesByTypeMap = new Map<string, ActivityTypeBreakdown>();

        for (const activity of allActivities) {
            const typeId = activity.activityTypeId;
            const typeName = activity.activityType.name;

            if (!activitiesByTypeMap.has(typeId)) {
                activitiesByTypeMap.set(typeId, {
                    activityTypeId: typeId,
                    activityTypeName: typeName,
                    activitiesAtStart: 0,
                    activitiesAtEnd: 0,
                    activitiesStarted: 0,
                    activitiesCompleted: 0,
                    activitiesCancelled: 0,
                    participantsAtStart: 0,
                    participantsAtEnd: 0,
                });
            }

            const breakdown = activitiesByTypeMap.get(typeId)!;

            // Count activities by temporal category using same logic as aggregate
            if (startDate) {
                // Activity exists at start if created before start and not completed/cancelled before start
                if (activity.createdAt <= startDate) {
                    if (activity.status === ActivityStatus.COMPLETED || activity.status === ActivityStatus.CANCELLED) {
                        if (activity.endDate && activity.endDate >= startDate) {
                            breakdown.activitiesAtStart++;
                        }
                    } else {
                        breakdown.activitiesAtStart++;
                    }
                }
            }

            if (endDate) {
                // Activity exists at end if created before end and not completed/cancelled before end
                if (activity.createdAt <= endDate) {
                    if (activity.status === ActivityStatus.COMPLETED || activity.status === ActivityStatus.CANCELLED) {
                        if (activity.endDate && activity.endDate >= endDate) {
                            breakdown.activitiesAtEnd++;
                        }
                    } else {
                        breakdown.activitiesAtEnd++;
                    }
                }
            }

            if (startDate && endDate && activity.startDate >= startDate && activity.startDate <= endDate) {
                breakdown.activitiesStarted++;
            } else if (startDate && !endDate && activity.startDate >= startDate) {
                breakdown.activitiesStarted++;
            } else if (!startDate && endDate && activity.startDate <= endDate) {
                breakdown.activitiesStarted++;
            } else if (!startDate && !endDate) {
                breakdown.activitiesStarted++;
            }

            if (startDate && endDate && activity.status === ActivityStatus.COMPLETED &&
                activity.endDate && activity.endDate >= startDate && activity.endDate <= endDate) {
                breakdown.activitiesCompleted++;
            }

            if (startDate && endDate && activity.status === ActivityStatus.CANCELLED &&
                activity.endDate && activity.endDate >= startDate && activity.endDate <= endDate) {
                breakdown.activitiesCancelled++;
            }

            // Count participants by type
            if (startDate) {
                const participantsAtStartForType = activity.assignments.filter(a => a.createdAt <= startDate);
                breakdown.participantsAtStart += new Set(participantsAtStartForType.map(a => a.participantId)).size;
            }

            if (endDate) {
                const participantsAtEndForType = activity.assignments.filter(a => a.createdAt <= endDate);
                breakdown.participantsAtEnd += new Set(participantsAtEndForType.map(a => a.participantId)).size;
            }
        }

        const activitiesByType = Array.from(activitiesByTypeMap.values());

        // Calculate breakdown by activity category
        const activitiesByCategoryMap = new Map<string, ActivityCategoryBreakdown>();

        for (const activity of allActivities) {
            const categoryId = activity.activityType.activityCategoryId;
            const categoryName = activity.activityType.activityCategory.name;

            if (!activitiesByCategoryMap.has(categoryId)) {
                activitiesByCategoryMap.set(categoryId, {
                    activityCategoryId: categoryId,
                    activityCategoryName: categoryName,
                    activitiesAtStart: 0,
                    activitiesAtEnd: 0,
                    activitiesStarted: 0,
                    activitiesCompleted: 0,
                    activitiesCancelled: 0,
                    participantsAtStart: 0,
                    participantsAtEnd: 0,
                });
            }

            const breakdown = activitiesByCategoryMap.get(categoryId)!;

            // Count activities by temporal category using same logic as aggregate
            if (startDate) {
                // Activity exists at start if created before start and not completed/cancelled before start
                if (activity.createdAt <= startDate) {
                    if (activity.status === ActivityStatus.COMPLETED || activity.status === ActivityStatus.CANCELLED) {
                        if (activity.endDate && activity.endDate >= startDate) {
                            breakdown.activitiesAtStart++;
                        }
                    } else {
                        breakdown.activitiesAtStart++;
                    }
                }
            }

            if (endDate) {
                // Activity exists at end if created before end and not completed/cancelled before end
                if (activity.createdAt <= endDate) {
                    if (activity.status === ActivityStatus.COMPLETED || activity.status === ActivityStatus.CANCELLED) {
                        if (activity.endDate && activity.endDate >= endDate) {
                            breakdown.activitiesAtEnd++;
                        }
                    } else {
                        breakdown.activitiesAtEnd++;
                    }
                }
            }

            if (startDate && endDate && activity.startDate >= startDate && activity.startDate <= endDate) {
                breakdown.activitiesStarted++;
            } else if (startDate && !endDate && activity.startDate >= startDate) {
                breakdown.activitiesStarted++;
            } else if (!startDate && endDate && activity.startDate <= endDate) {
                breakdown.activitiesStarted++;
            } else if (!startDate && !endDate) {
                breakdown.activitiesStarted++;
            }

            if (startDate && endDate && activity.status === ActivityStatus.COMPLETED &&
                activity.endDate && activity.endDate >= startDate && activity.endDate <= endDate) {
                breakdown.activitiesCompleted++;
            }

            if (startDate && endDate && activity.status === ActivityStatus.CANCELLED &&
                activity.endDate && activity.endDate >= startDate && activity.endDate <= endDate) {
                breakdown.activitiesCancelled++;
            }

            // Count participants by category
            if (startDate) {
                const participantsAtStartForCategory = activity.assignments.filter(a => a.createdAt <= startDate);
                breakdown.participantsAtStart += new Set(participantsAtStartForCategory.map(a => a.participantId)).size;
            }

            if (endDate) {
                const participantsAtEndForCategory = activity.assignments.filter(a => a.createdAt <= endDate);
                breakdown.participantsAtEnd += new Set(participantsAtEndForCategory.map(a => a.participantId)).size;
            }
        }

        const activitiesByCategory = Array.from(activitiesByCategoryMap.values());

        // Calculate role distribution
        const roleDistributionMap = new Map<string, RoleDistribution>();
        allActivities.forEach(activity => {
            activity.assignments.forEach(assignment => {
                const roleId = assignment.roleId;
                const roleName = assignment.role.name;

                if (!roleDistributionMap.has(roleId)) {
                    roleDistributionMap.set(roleId, {
                        roleId,
                        roleName,
                        count: 0,
                    });
                }

                roleDistributionMap.get(roleId)!.count++;
            });
        });

        const roleDistribution = Array.from(roleDistributionMap.values());

        // Calculate geographic breakdown
        const geographicBreakdown: GeographicBreakdown[] = [];

        // Determine which areas to include in breakdown
        let areasToBreakdown: any[];
        if (geographicAreaId) {
            // When filtered by geographic area, show breakdown of that area and its descendants
            const descendantIds = await this.geographicAreaRepository.findDescendants(geographicAreaId);
            const parentArea = await this.geographicAreaRepository.findById(geographicAreaId);

            // Fetch all descendant areas
            const descendantAreas = descendantIds.length > 0
                ? await this.prisma.geographicArea.findMany({
                    where: { id: { in: descendantIds } },
                })
                : [];

            areasToBreakdown = parentArea ? [parentArea, ...descendantAreas] : descendantAreas;
        } else {
            // When not filtered, show all areas
            areasToBreakdown = await this.geographicAreaRepository.findAll();
        }

        for (const area of areasToBreakdown) {
            const areaVenueIds = await this.getVenueIdsForArea(area.id);
            const areaActivities = allActivities.filter(a =>
                a.activityVenueHistory?.some(vh => areaVenueIds.includes(vh.venueId))
            );
            const areaParticipantIds = new Set(
                areaActivities.flatMap(a => a.assignments.map(as => as.participantId))
            );

            // Check if this area has children
            const childrenCount = await this.geographicAreaRepository.countChildReferences(area.id);

            geographicBreakdown.push({
                geographicAreaId: area.id,
                geographicAreaName: area.name,
                activityCount: areaActivities.length,
                participantCount: areaParticipantIds.size,
                hasChildren: childrenCount > 0,
            });
        }

        return {
            activitiesAtStart,
            activitiesAtEnd,
            activitiesStarted,
            activitiesCompleted,
            activitiesCancelled,
            participantsAtStart,
            participantsAtEnd,
            totalActivities,
            totalParticipants,
            activitiesByCategory,
            activitiesByType,
            roleDistribution,
            geographicBreakdown,
            periodStart: startDate?.toISOString() || '',
            periodEnd: endDate?.toISOString() || new Date().toISOString(),
            appliedFilters: {
                activityCategoryId,
                activityTypeId,
                venueId,
                geographicAreaId,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
            },
            groupingDimensions: groupBy,
        };
    }

    private async getGroupedEngagementMetrics(filters: AnalyticsFilters): Promise<EngagementMetrics> {
        const { groupBy } = filters;

        if (!groupBy || groupBy.length === 0) {
            // No grouping, return ungrouped metrics
            const ungroupedFilters = { ...filters };
            delete ungroupedFilters.groupBy;
            return this.getEngagementMetrics(ungroupedFilters);
        }

        // Get base metrics without grouping
        const baseFilters = { ...filters };
        delete baseFilters.groupBy;
        const baseMetrics = await this.getEngagementMetrics(baseFilters);

        // Query database to find actual dimension combinations that exist in the data (SQL GROUP BY style)
        const actualCombinations = await this.queryActualDimensionCombinations(filters, groupBy);

        // Calculate metrics for each actual combination
        const groupedResults: GroupedMetrics[] = [];
        for (const combination of actualCombinations) {
            const combinationFilters: AnalyticsFilters = {
                ...filters,
                ...combination.filters,
            };
            delete combinationFilters.groupBy;

            const metrics = await this.getEngagementMetrics(combinationFilters);

            // Only include results that have actual data
            if (metrics.totalActivities > 0 || metrics.totalParticipants > 0) {
                groupedResults.push({
                    dimensions: combination.dimensions,
                    metrics,
                });
            }
        }

        return {
            ...baseMetrics,
            groupedResults,
            groupingDimensions: Array.isArray(groupBy) ? groupBy.map(d => d.toString()) : [],
        };
    }

    private async queryActualDimensionCombinations(
        filters: AnalyticsFilters,
        dimensions: GroupingDimension[]
    ): Promise<Array<{ dimensions: Record<string, string>; filters: Partial<AnalyticsFilters> }>> {
        // Build base activity filter from existing filters
        const { startDate, endDate, geographicAreaId, activityCategoryId, activityTypeId, venueId } = filters;

        let venueIds: string[] | undefined;
        if (geographicAreaId) {
            venueIds = await this.getVenueIdsForArea(geographicAreaId);
        } else if (venueId) {
            venueIds = [venueId];
        }

        const activityWhere: any = {};
        if (activityCategoryId) {
            activityWhere.activityType = {
                activityCategoryId,
            };
        }
        if (activityTypeId) {
            activityWhere.activityTypeId = activityTypeId;
        }
        if (venueIds) {
            activityWhere.activityVenueHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        // Query activities with all necessary relations to determine actual combinations
        const activities = await this.prisma.activity.findMany({
            where: activityWhere,
            include: {
                activityType: {
                    include: {
                        activityCategory: true,
                    },
                },
                activityVenueHistory: {
                    include: {
                        venue: {
                            include: {
                                geographicArea: true,
                            },
                        },
                    },
                    orderBy: {
                        effectiveFrom: 'desc',
                    },
                },
            },
        });

        // Extract unique combinations from actual data
        const combinationMap = new Map<string, { dimensions: Record<string, string>; filters: Partial<AnalyticsFilters> }>();

        for (const activity of activities) {
            // Get current venue (most recent in history)
            const currentVenue = activity.activityVenueHistory[0];
            if (!currentVenue) continue;

            // Build dimension values for this activity
            const dimensionValues: Record<string, any> = {
                [GroupingDimension.ACTIVITY_CATEGORY]: {
                    id: activity.activityType.activityCategoryId,
                    name: activity.activityType.activityCategory.name,
                },
                [GroupingDimension.ACTIVITY_TYPE]: {
                    id: activity.activityTypeId,
                    name: activity.activityType.name,
                },
                [GroupingDimension.VENUE]: {
                    id: currentVenue.venueId,
                    name: currentVenue.venue.name,
                },
                [GroupingDimension.GEOGRAPHIC_AREA]: {
                    id: currentVenue.venue.geographicAreaId,
                    name: currentVenue.venue.geographicArea.name,
                },
            };

            // Handle date dimension if specified
            if (dimensions.includes(GroupingDimension.DATE) && startDate && endDate) {
                const { dateGranularity } = filters;
                let timePeriod: TimePeriod;
                switch (dateGranularity) {
                    case DateGranularity.WEEKLY:
                        timePeriod = TimePeriod.WEEK;
                        break;
                    case DateGranularity.MONTHLY:
                        timePeriod = TimePeriod.MONTH;
                        break;
                    case DateGranularity.QUARTERLY:
                        timePeriod = TimePeriod.MONTH;
                        break;
                    case DateGranularity.YEARLY:
                        timePeriod = TimePeriod.YEAR;
                        break;
                    default:
                        timePeriod = TimePeriod.MONTH;
                }

                const periods = this.generateTimePeriods(startDate, endDate, timePeriod);
                const activityPeriod = periods.find(p =>
                    activity.createdAt >= p.start && activity.createdAt < p.end
                );

                if (activityPeriod) {
                    if (dateGranularity === DateGranularity.QUARTERLY) {
                        // Map to quarter
                        const monthIndex = periods.findIndex(p => p.label === activityPeriod.label);
                        const quarterIndex = Math.floor(monthIndex / 3);
                        const quarterMonths = periods.slice(quarterIndex * 3, quarterIndex * 3 + 3);
                        if (quarterMonths.length > 0) {
                            const quarterLabel = `Q${quarterIndex + 1} ${quarterMonths[0].start.getFullYear()}`;

                            dimensionValues[GroupingDimension.DATE] = {
                                label: quarterLabel,
                                start: quarterMonths[0].start,
                                end: quarterMonths[quarterMonths.length - 1].end,
                            };
                        }
                    } else {
                        dimensionValues[GroupingDimension.DATE] = {
                            label: activityPeriod.label,
                            start: activityPeriod.start,
                            end: activityPeriod.end,
                        };
                    }
                }
            }

            // Build combination key and record for requested dimensions
            const combination: { dimensions: Record<string, string>; filters: Partial<AnalyticsFilters> } = {
                dimensions: {},
                filters: {},
            };

            let combinationKey = '';
            for (const dim of dimensions) {
                const value = dimensionValues[dim];
                if (!value) continue;

                switch (dim) {
                    case GroupingDimension.ACTIVITY_CATEGORY:
                        combination.dimensions[DimensionKeys.ACTIVITY_CATEGORY.name] = value.name;
                        combination.dimensions[DimensionKeys.ACTIVITY_CATEGORY.id] = value.id;
                        combination.filters.activityCategoryId = value.id;
                        combinationKey += `category:${value.id}|`;
                        break;

                    case GroupingDimension.ACTIVITY_TYPE:
                        combination.dimensions[DimensionKeys.ACTIVITY_TYPE.name] = value.name;
                        combination.dimensions[DimensionKeys.ACTIVITY_TYPE.id] = value.id;
                        combination.filters.activityTypeId = value.id;
                        combinationKey += `type:${value.id}|`;
                        break;

                    case GroupingDimension.VENUE:
                        combination.dimensions[DimensionKeys.VENUE.name] = value.name;
                        combination.dimensions[DimensionKeys.VENUE.id] = value.id;
                        combination.filters.venueId = value.id;
                        combinationKey += `venue:${value.id}|`;
                        break;

                    case GroupingDimension.GEOGRAPHIC_AREA:
                        combination.dimensions[DimensionKeys.GEOGRAPHIC_AREA.name] = value.name;
                        combination.dimensions[DimensionKeys.GEOGRAPHIC_AREA.id] = value.id;
                        combination.filters.geographicAreaId = value.id;
                        combinationKey += `area:${value.id}|`;
                        break;

                    case GroupingDimension.DATE:
                        combination.dimensions[DimensionKeys.DATE.name] = value.label;
                        combination.filters.startDate = value.start;
                        combination.filters.endDate = value.end;
                        combinationKey += `date:${value.label}|`;
                        break;
                }
            }

            if (!combinationMap.has(combinationKey)) {
                combinationMap.set(combinationKey, combination);
            }
        }

        return Array.from(combinationMap.values());
    }

    async getGrowthMetrics(
        timePeriod: TimePeriod,
        filters: AnalyticsFilters = {}
    ): Promise<GrowthMetrics> {
        const { startDate, endDate, geographicAreaId } = filters;

        // Get venue IDs if geographic filter is provided
        let venueIds: string[] | undefined;
        if (geographicAreaId) {
            venueIds = await this.getVenueIdsForArea(geographicAreaId);
        }

        // Determine date range - if no dates provided, query all history
        let start: Date;
        let end: Date;

        if (!startDate && !endDate) {
            // Query all history - get earliest record
            const earliestParticipant = await this.prisma.participant.findFirst({
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            });
            const earliestActivity = await this.prisma.activity.findFirst({
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            });

            const earliestDate = earliestParticipant && earliestActivity
                ? new Date(Math.min(earliestParticipant.createdAt.getTime(), earliestActivity.createdAt.getTime()))
                : earliestParticipant?.createdAt || earliestActivity?.createdAt || new Date();

            start = earliestDate;
            end = new Date();
        } else {
            const now = new Date();
            start = startDate || new Date(now.getFullYear() - 1, 0, 1);
            end = endDate || now;
        }

        // Generate time periods
        const periods = this.generateTimePeriods(start, end, timePeriod);

        // Get all participants and activities
        const participantWhere: any = {
            createdAt: {
                gte: start,
                lte: end,
            },
        };

        if (venueIds) {
            participantWhere.addressHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        const activityWhere: any = {
            createdAt: {
                gte: start,
                lte: end,
            },
        };

        if (venueIds) {
            activityWhere.activityVenueHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        const participants = await this.prisma.participant.findMany({
            where: participantWhere,
            select: { id: true, createdAt: true },
        });

        const activities = await this.prisma.activity.findMany({
            where: activityWhere,
            select: { id: true, createdAt: true },
        });

        // Calculate metrics for each period
        const timeSeries: GrowthPeriodData[] = [];
        let cumulativeParticipants = 0;
        let cumulativeActivities = 0;
        let previousNewActivities = 0;

        for (const period of periods) {
            const newActivities = activities.filter(
                (a) => a.createdAt >= period.start && a.createdAt < period.end
            ).length;

            const participantsInPeriod = participants.filter(
                (p) => p.createdAt >= period.start && p.createdAt < period.end
            ).length;

            cumulativeParticipants += participantsInPeriod;
            cumulativeActivities += newActivities;

            const percentageChange =
                previousNewActivities > 0
                    ? ((newActivities - previousNewActivities) / previousNewActivities) * 100
                    : null;

            timeSeries.push({
                period: period.label,
                newActivities,
                cumulativeParticipants,
                cumulativeActivities,
                percentageChange,
            });

            previousNewActivities = newActivities;
        }

        return { timeSeries };
    }

    async getGeographicBreakdown(filters: AnalyticsFilters = {}): Promise<Record<string, EngagementMetrics>> {
        const areas = await this.geographicAreaRepository.findAll();
        const breakdown: Record<string, EngagementMetrics> = {};

        for (const area of areas) {
            const metrics = await this.getEngagementMetrics({
                ...filters,
                geographicAreaId: area.id,
            });
            breakdown[area.name] = metrics;
        }

        return breakdown;
    }

    private async getVenueIdsForArea(geographicAreaId: string): Promise<string[]> {
        const descendants = await this.geographicAreaRepository.findDescendants(geographicAreaId);
        const areaIds = [geographicAreaId, ...descendants];

        const venues = await this.prisma.venue.findMany({
            where: { geographicAreaId: { in: areaIds } },
            select: { id: true },
        });

        return venues.map((v) => v.id);
    }

    private generateTimePeriods(
        start: Date,
        end: Date,
        period: TimePeriod
    ): Array<{ start: Date; end: Date; label: string }> {
        const periods: Array<{ start: Date; end: Date; label: string }> = [];
        let current = new Date(start);

        while (current < end) {
            const periodStart = new Date(current);
            let periodEnd: Date;
            let label: string;

            switch (period) {
                case TimePeriod.DAY:
                    periodEnd = new Date(current);
                    periodEnd.setDate(periodEnd.getDate() + 1);
                    label = periodStart.toISOString().split('T')[0];
                    break;

                case TimePeriod.WEEK:
                    periodEnd = new Date(current);
                    periodEnd.setDate(periodEnd.getDate() + 7);
                    label = `Week of ${periodStart.toISOString().split('T')[0]}`;
                    break;

                case TimePeriod.MONTH:
                    periodEnd = new Date(current);
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                    label = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
                    break;

                case TimePeriod.YEAR:
                    periodEnd = new Date(current);
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                    label = String(periodStart.getFullYear());
                    break;

                default:
                    throw new Error(`Unsupported time period: ${period}`);
            }

            if (periodEnd > end) {
                periodEnd = new Date(end);
            }

            periods.push({ start: periodStart, end: periodEnd, label });
            current = periodEnd;
        }

        return periods;
    }
}