import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { GeographicAuthorizationService, AccessLevel } from './geographic-authorization.service';
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
    participationAtStart: number;
    participationAtEnd: number;
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
    participationAtStart: number;
    participationAtEnd: number;
}

export interface RoleDistribution {
    roleId: string;
    roleName: string;
    count: number;
}

export interface GeographicBreakdown {
    geographicAreaId: string;
    geographicAreaName: string;
    areaType: string;
    activityCount: number;
    participantCount: number;
    participationCount: number;
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

    // Temporal participation counts (non-unique)
    participationAtStart: number;
    participationAtEnd: number;

    // Aggregate counts
    totalActivities: number;
    totalParticipants: number;
    totalParticipation: number;

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
        activityCategoryIds?: string[];
        activityTypeIds?: string[];
        venueIds?: string[];
        geographicAreaIds?: string[];
        populationIds?: string[];
        startDate?: string;
        endDate?: string;
    };
    groupingDimensions?: string[];
}

export interface GrowthPeriodData {
    date: string;
    uniqueParticipants: number;
    uniqueActivities: number;
    totalParticipation: number;
}

export interface GrowthMetrics {
    timeSeries: GrowthPeriodData[];
    groupedTimeSeries?: Record<string, GrowthPeriodData[]>; // When groupBy is specified
}

export interface ActivityLifecycleData {
    groupName: string;
    started: number;
    completed: number;
}

export interface AnalyticsFilters {
    startDate?: Date;
    endDate?: Date;
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    geographicAreaIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
    groupBy?: GroupingDimension[];
    dateGranularity?: DateGranularity;
    // Legacy single-value filters (deprecated, use array versions)
    geographicAreaId?: string;
    activityCategoryId?: string;
    activityTypeId?: string;
    venueId?: string;
}

export class AnalyticsService {
    constructor(
        private prisma: PrismaClient,
        private geographicAreaRepository: GeographicAreaRepository,
        private geographicAuthorizationService?: GeographicAuthorizationService
    ) { }

    /**
     * Determines the effective geographic area IDs to filter by, considering:
     * 1. Explicit geographicAreaId parameter (if provided, validate authorization)
     * 2. Implicit filtering based on user's authorized areas (if user has restrictions)
     * 3. No filtering (if user has no restrictions and no explicit filter)
     * 
     * IMPORTANT: authorizedAreaIds already includes descendants and excludes DENY rules.
     * Do NOT expand descendants again during implicit filtering.
     */
    private async getEffectiveGeographicAreaIds(
        explicitGeographicAreaIds: string | string[] | undefined,
        authorizedAreaIds: string[],
        hasGeographicRestrictions: boolean
    ): Promise<string[] | undefined> {
        // Convert single value to array for uniform processing
        const areaIdsArray = explicitGeographicAreaIds
            ? (Array.isArray(explicitGeographicAreaIds) ? explicitGeographicAreaIds : [explicitGeographicAreaIds])
            : undefined;

        // If explicit filter provided
        if (areaIdsArray && areaIdsArray.length > 0) {
            // Validate user has access to all areas
            if (hasGeographicRestrictions) {
                const allAuthorized = areaIdsArray.every(id => authorizedAreaIds.includes(id));
                if (!allAuthorized) {
                    throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access one or more of the specified geographic areas');
                }
            }

            // Expand each area to include descendants using batch processing
            const descendantIds = await this.geographicAreaRepository.findBatchDescendants(areaIdsArray);
            const allExpandedIds = new Set<string>([...areaIdsArray, ...descendantIds]);

            const allPotentialIds = Array.from(allExpandedIds);

            // If user has geographic restrictions, filter to only authorized areas
            if (hasGeographicRestrictions) {
                return allPotentialIds.filter(id => authorizedAreaIds.includes(id));
            }

            // No restrictions - return all descendants
            return allPotentialIds;
        }

        // No explicit filter - apply implicit filtering if user has restrictions
        if (hasGeographicRestrictions) {
            // IMPORTANT: authorizedAreaIds already has descendants expanded and DENY rules applied
            // Do NOT expand descendants again, as this would re-add denied areas
            return authorizedAreaIds;
        }

        // No restrictions and no explicit filter - return undefined (no filtering)
        return undefined;
    }

    async getEngagementMetrics(
        filters: AnalyticsFilters = {},
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<EngagementMetrics> {
        const {
            startDate,
            activityCategoryIds,
            activityTypeIds,
            geographicAreaIds,
            venueIds: filterVenueIds,
            populationIds,
            groupBy
        } = filters;

        // Default endDate to now if startDate is provided but endDate is not
        const endDate = filters.endDate || (startDate ? new Date() : undefined);

        // If groupBy dimensions are specified, return grouped results
        if (groupBy && groupBy.length > 0) {
            return this.getGroupedEngagementMetrics({ ...filters, endDate }, authorizedAreaIds, hasGeographicRestrictions);
        }

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaIds,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        // Get venue IDs if geographic filter is provided
        let venueIds: string[] | undefined;
        if (effectiveAreaIds) {
            // Use effective area IDs to get venues
            const venues = await this.prisma.venue.findMany({
                where: { geographicAreaId: { in: effectiveAreaIds } },
                select: { id: true },
            });
            venueIds = venues.map((v) => v.id);
        }

        // Merge explicit venue filter with geographic-derived venue IDs
        if (filterVenueIds && filterVenueIds.length > 0) {
            if (venueIds) {
                // Intersection: only venues that match both filters
                venueIds = venueIds.filter(id => filterVenueIds.includes(id));
            } else {
                // Use explicit venue filter
                venueIds = filterVenueIds;
            }
        }

        // Build base activity filter
        const activityWhere: any = {};

        if (activityCategoryIds && activityCategoryIds.length > 0) {
            activityWhere.activityType = {
                activityCategoryId: { in: activityCategoryIds },
            };
        }

        if (activityTypeIds && activityTypeIds.length > 0) {
            activityWhere.activityTypeId = { in: activityTypeIds };
        }

        if (venueIds) {
            activityWhere.activityVenueHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        // Add population filtering
        if (populationIds && populationIds.length > 0) {
            activityWhere.assignments = {
                some: {
                    participant: {
                        participantPopulations: {
                            some: {
                                populationId: { in: populationIds },
                            },
                        },
                    },
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
                        participant: {
                            include: {
                                participantPopulations: {
                                    include: {
                                        population: true,
                                    },
                                },
                            },
                        },
                        role: true,
                    },
                },
            },
        });

        // Calculate temporal metrics
        // An activity "exists" at a point in time if:
        // - Its startDate is on or before that time AND
        // - It hasn't ended yet (endDate is null OR endDate is after that time)

        const activitiesAtStart = startDate
            ? allActivities.filter(a => {
                // Activity must have started on or before the start date
                if (a.startDate > startDate) return false;

                // Activity must not have ended before the start date
                // If endDate is null (ongoing), it exists
                // If endDate exists, it must be after startDate
                if (a.endDate) {
                    return a.endDate >= startDate;
                }

                // Ongoing activity (no endDate) that started before startDate
                return true;
            }).length
            : 0;

        const activitiesAtEnd = endDate
            ? allActivities.filter(a => {
                // Activity must have started on or before the end date
                if (a.startDate > endDate) return false;

                // Activity must not have ended before the end date
                // If endDate is null (ongoing), it exists
                // If endDate exists, it must be after the reference date
                if (a.endDate) {
                    return a.endDate >= endDate;
                }

                // Ongoing activity (no endDate) that started before endDate
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

        // Helper function to filter assignments by population
        const filterAssignmentsByPopulation = (assignments: any[]) => {
            if (!populationIds || populationIds.length === 0) {
                return assignments;
            }
            return assignments.filter(assignment =>
                assignment.participant.participantPopulations.some((pp: any) =>
                    populationIds.includes(pp.populationId)
                )
            );
        };

        // Calculate participant temporal metrics
        // A participant is engaged at a point in time if they're assigned to an activity that was active at that time
        // The assignment createdAt is irrelevant - what matters is the activity's start/end dates
        // When population filter is active, only count participants who belong to the specified populations
        const participantsAtStart = startDate
            ? new Set(
                allActivities
                    .filter(act => {
                        // Activity was active at startDate if:
                        // - It started on or before startDate AND
                        // - It hasn't ended OR it ended after startDate
                        return act.startDate <= startDate && (!act.endDate || act.endDate >= startDate);
                    })
                    .flatMap(act => filterAssignmentsByPopulation(act.assignments).map(a => a.participantId))
            ).size
            : 0;

        const participantsAtEnd = endDate
            ? new Set(
                allActivities
                    .filter(act => {
                        // Activity was active at endDate if:
                        // - It started on or before endDate AND
                        // - It hasn't ended OR it ended after endDate
                        return act.startDate <= endDate && (!act.endDate || act.endDate >= endDate);
                    })
                    .flatMap(act => filterAssignmentsByPopulation(act.assignments).map(a => a.participantId))
            ).size
            : new Set(allActivities.flatMap(a => filterAssignmentsByPopulation(a.assignments).map(as => as.participantId))).size;

        // Calculate participation temporal metrics (non-unique, counts all assignments)
        // When population filter is active, only count assignments where participant belongs to specified populations
        const participationAtStart = startDate
            ? allActivities
                .filter(act => {
                    return act.startDate <= startDate && (!act.endDate || act.endDate >= startDate);
                })
                .reduce((sum, act) => sum + filterAssignmentsByPopulation(act.assignments).length, 0)
            : 0;

        const participationAtEnd = endDate
            ? allActivities
                .filter(act => {
                    return act.startDate <= endDate && (!act.endDate || act.endDate >= endDate);
                })
                .reduce((sum, act) => sum + filterAssignmentsByPopulation(act.assignments).length, 0)
            : allActivities.reduce((sum, a) => sum + filterAssignmentsByPopulation(a.assignments).length, 0);

        // Calculate aggregate counts
        // When population filter is active, only count participants and participation for filtered participants
        const totalActivities = allActivities.length;
        const totalParticipants = new Set(
            allActivities.flatMap(a => filterAssignmentsByPopulation(a.assignments).map(as => as.participantId))
        ).size;
        const totalParticipation = allActivities.reduce((sum, a) => sum + filterAssignmentsByPopulation(a.assignments).length, 0);

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
                    participationAtStart: 0,
                    participationAtEnd: 0,
                });
            }

            const breakdown = activitiesByTypeMap.get(typeId)!;

            // Count activities by temporal category using same logic as aggregate
            if (startDate) {
                // Activity must have started on or before the start date
                if (activity.startDate <= startDate) {
                    // Activity must not have ended before the start date
                    if (activity.endDate) {
                        if (activity.endDate >= startDate) {
                            breakdown.activitiesAtStart++;
                        }
                    } else {
                        // Ongoing activity (no endDate)
                        breakdown.activitiesAtStart++;
                    }
                }
            }

            if (endDate) {
                // Activity must have started on or before the end date
                if (activity.startDate <= endDate) {
                    // Activity must not have ended before the end date
                    if (activity.endDate) {
                        if (activity.endDate >= endDate) {
                            breakdown.activitiesAtEnd++;
                        }
                    } else {
                        // Ongoing activity (no endDate)
                        breakdown.activitiesAtEnd++;
                    }
                }
            } else if (!startDate) {
                // When no date range is specified, count all current activities (not completed/cancelled)
                if (activity.status !== ActivityStatus.COMPLETED && activity.status !== ActivityStatus.CANCELLED) {
                    breakdown.activitiesAtEnd++;
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

            // Count participants and participation by type
            // Participants are engaged if the activity was active at the point in time
            // When population filter is active, only count participants who belong to specified populations
            if (startDate) {
                // Activity was active at startDate if it started on or before startDate
                // AND it hasn't ended OR it ended after startDate
                const wasActiveAtStart = activity.startDate <= startDate &&
                    (!activity.endDate || activity.endDate >= startDate);

                if (wasActiveAtStart) {
                    // Participation: count filtered assignments (non-unique)
                    breakdown.participationAtStart += filterAssignmentsByPopulation(activity.assignments).length;
                }
            }

            if (endDate) {
                // Activity was active at endDate if it started on or before endDate
                // AND it hasn't ended OR it ended after endDate
                const wasActiveAtEnd = activity.startDate <= endDate &&
                    (!activity.endDate || activity.endDate >= endDate);

                if (wasActiveAtEnd) {
                    // Participation: count filtered assignments (non-unique)
                    breakdown.participationAtEnd += filterAssignmentsByPopulation(activity.assignments).length;
                }
            }
        }

        // Now calculate unique participants per type (second pass to collect unique IDs)
        // When population filter is active, only count participants who belong to specified populations
        for (const [typeId, breakdown] of activitiesByTypeMap.entries()) {
            const typeActivities = allActivities.filter(a => a.activityTypeId === typeId);

            if (startDate) {
                const uniqueParticipantsAtStart = new Set(
                    typeActivities
                        .filter(act => act.startDate <= startDate && (!act.endDate || act.endDate >= startDate))
                        .flatMap(act => filterAssignmentsByPopulation(act.assignments).map(a => a.participantId))
                );
                breakdown.participantsAtStart = uniqueParticipantsAtStart.size;
            }

            if (endDate) {
                const uniqueParticipantsAtEnd = new Set(
                    typeActivities
                        .filter(act => act.startDate <= endDate && (!act.endDate || act.endDate >= endDate))
                        .flatMap(act => filterAssignmentsByPopulation(act.assignments).map(a => a.participantId))
                );
                breakdown.participantsAtEnd = uniqueParticipantsAtEnd.size;
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
                    participationAtStart: 0,
                    participationAtEnd: 0,
                });
            }

            const breakdown = activitiesByCategoryMap.get(categoryId)!;

            // Count activities by temporal category using same logic as aggregate
            if (startDate) {
                // Activity must have started on or before the start date
                if (activity.startDate <= startDate) {
                    // Activity must not have ended before the start date
                    if (activity.endDate) {
                        if (activity.endDate >= startDate) {
                            breakdown.activitiesAtStart++;
                        }
                    } else {
                        // Ongoing activity (no endDate)
                        breakdown.activitiesAtStart++;
                    }
                }
            }

            if (endDate) {
                // Activity must have started on or before the end date
                if (activity.startDate <= endDate) {
                    // Activity must not have ended before the end date
                    if (activity.endDate) {
                        if (activity.endDate >= endDate) {
                            breakdown.activitiesAtEnd++;
                        }
                    } else {
                        // Ongoing activity (no endDate)
                        breakdown.activitiesAtEnd++;
                    }
                }
            } else if (!startDate) {
                // When no date range is specified, count all current activities (not completed/cancelled)
                if (activity.status !== ActivityStatus.COMPLETED && activity.status !== ActivityStatus.CANCELLED) {
                    breakdown.activitiesAtEnd++;
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

            // Count participation by category (non-unique, filtered assignments)
            // When population filter is active, only count assignments where participant belongs to specified populations
            if (startDate) {
                const wasActiveAtStart = activity.startDate <= startDate &&
                    (!activity.endDate || activity.endDate >= startDate);

                if (wasActiveAtStart) {
                    breakdown.participationAtStart += filterAssignmentsByPopulation(activity.assignments).length;
                }
            }

            if (endDate) {
                const wasActiveAtEnd = activity.startDate <= endDate &&
                    (!activity.endDate || activity.endDate >= endDate);

                if (wasActiveAtEnd) {
                    breakdown.participationAtEnd += filterAssignmentsByPopulation(activity.assignments).length;
                }
            }
        }

        // Calculate unique participants per category (second pass)
        // When population filter is active, only count participants who belong to specified populations
        for (const [categoryId, breakdown] of activitiesByCategoryMap.entries()) {
            const categoryActivities = allActivities.filter(a => a.activityType.activityCategoryId === categoryId);

            if (startDate) {
                const uniqueParticipantsAtStart = new Set(
                    categoryActivities
                        .filter(act => act.startDate <= startDate && (!act.endDate || act.endDate >= startDate))
                        .flatMap(act => filterAssignmentsByPopulation(act.assignments).map(a => a.participantId))
                );
                breakdown.participantsAtStart = uniqueParticipantsAtStart.size;
            }

            if (endDate) {
                const uniqueParticipantsAtEnd = new Set(
                    categoryActivities
                        .filter(act => act.startDate <= endDate && (!act.endDate || act.endDate >= endDate))
                        .flatMap(act => filterAssignmentsByPopulation(act.assignments).map(a => a.participantId))
                );
                breakdown.participantsAtEnd = uniqueParticipantsAtEnd.size;
            }
        }

        const activitiesByCategory = Array.from(activitiesByCategoryMap.values());

        // Calculate role distribution
        // When population filter is active, only count assignments where participant belongs to specified populations
        const roleDistributionMap = new Map<string, RoleDistribution>();
        allActivities.forEach(activity => {
            filterAssignmentsByPopulation(activity.assignments).forEach(assignment => {
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
        const firstGeographicAreaId = geographicAreaIds && geographicAreaIds.length > 0 ? geographicAreaIds[0] : undefined;
        if (firstGeographicAreaId) {
            // When filtered by geographic area, show breakdown of that area and its descendants
            const descendantIds = await this.geographicAreaRepository.findBatchDescendants([firstGeographicAreaId]);
            const parentArea = await this.geographicAreaRepository.findById(firstGeographicAreaId);

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
            // When population filter is active, only count participants and participation for filtered participants
            const areaParticipantIds = new Set(
                areaActivities.flatMap(a => filterAssignmentsByPopulation(a.assignments).map(as => as.participantId))
            );
            const areaParticipationCount = areaActivities.reduce((sum, a) => sum + filterAssignmentsByPopulation(a.assignments).length, 0);

            // Check if this area has children
            const childrenCount = await this.geographicAreaRepository.countChildReferences(area.id);

            geographicBreakdown.push({
                geographicAreaId: area.id,
                geographicAreaName: area.name,
                areaType: area.areaType,
                activityCount: areaActivities.length,
                participantCount: areaParticipantIds.size,
                participationCount: areaParticipationCount,
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
            participationAtStart,
            participationAtEnd,
            totalActivities,
            totalParticipants,
            totalParticipation,
            activitiesByCategory,
            activitiesByType,
            roleDistribution,
            geographicBreakdown,
            periodStart: startDate?.toISOString() || '',
            periodEnd: endDate?.toISOString() || new Date().toISOString(),
            appliedFilters: {
                activityCategoryIds,
                activityTypeIds,
                venueIds: filterVenueIds,
                geographicAreaIds,
                populationIds,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
            },
            groupingDimensions: groupBy,
        };
    }

    private async getGroupedEngagementMetrics(
        filters: AnalyticsFilters,
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<EngagementMetrics> {
        const { groupBy } = filters;

        if (!groupBy || groupBy.length === 0) {
            // No grouping, return ungrouped metrics
            const ungroupedFilters = { ...filters };
            delete ungroupedFilters.groupBy;
            return this.getEngagementMetrics(ungroupedFilters, authorizedAreaIds, hasGeographicRestrictions);
        }

        // Get base metrics without grouping
        const baseFilters = { ...filters };
        delete baseFilters.groupBy;
        const baseMetrics = await this.getEngagementMetrics(baseFilters, authorizedAreaIds, hasGeographicRestrictions);

        // Query database to find actual dimension combinations that exist in the data (SQL GROUP BY style)
        const actualCombinations = await this.queryActualDimensionCombinations(filters, groupBy, authorizedAreaIds, hasGeographicRestrictions);

        // Calculate metrics for each actual combination
        const groupedResults: GroupedMetrics[] = [];
        for (const combination of actualCombinations) {
            const combinationFilters: AnalyticsFilters = {
                ...filters,
                ...combination.filters,
            };
            delete combinationFilters.groupBy;

            const metrics = await this.getEngagementMetrics(combinationFilters, authorizedAreaIds, hasGeographicRestrictions);

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
        dimensions: GroupingDimension[],
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<Array<{ dimensions: Record<string, string>; filters: Partial<AnalyticsFilters> }>> {
        // Build base activity filter from existing filters
        const {
            startDate,
            endDate,
            activityCategoryIds,
            activityTypeIds,
            geographicAreaIds,
            venueIds: filterVenueIds
        } = filters;

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaIds,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        let venueIds: string[] | undefined;
        if (effectiveAreaIds) {
            const venues = await this.prisma.venue.findMany({
                where: { geographicAreaId: { in: effectiveAreaIds } },
                select: { id: true },
            });
            venueIds = venues.map((v) => v.id);
        }

        // Merge explicit venue filter with geographic-derived venue IDs
        if (filterVenueIds && filterVenueIds.length > 0) {
            if (venueIds) {
                venueIds = venueIds.filter(id => filterVenueIds.includes(id));
            } else {
                venueIds = filterVenueIds;
            }
        }

        const activityWhere: any = {};
        if (activityCategoryIds && activityCategoryIds.length > 0) {
            activityWhere.activityType = {
                activityCategoryId: { in: activityCategoryIds },
            };
        }
        if (activityTypeIds && activityTypeIds.length > 0) {
            activityWhere.activityTypeId = { in: activityTypeIds };
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
                    activity.startDate >= p.start && activity.startDate < p.end
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
                        combination.filters.activityCategoryIds = [value.id];
                        combinationKey += `category:${value.id}|`;
                        break;

                    case GroupingDimension.ACTIVITY_TYPE:
                        combination.dimensions[DimensionKeys.ACTIVITY_TYPE.name] = value.name;
                        combination.dimensions[DimensionKeys.ACTIVITY_TYPE.id] = value.id;
                        combination.filters.activityTypeIds = [value.id];
                        combinationKey += `type:${value.id}|`;
                        break;

                    case GroupingDimension.VENUE:
                        combination.dimensions[DimensionKeys.VENUE.name] = value.name;
                        combination.dimensions[DimensionKeys.VENUE.id] = value.id;
                        combination.filters.venueIds = [value.id];
                        combinationKey += `venue:${value.id}|`;
                        break;

                    case GroupingDimension.GEOGRAPHIC_AREA:
                        combination.dimensions[DimensionKeys.GEOGRAPHIC_AREA.name] = value.name;
                        combination.dimensions[DimensionKeys.GEOGRAPHIC_AREA.id] = value.id;
                        combination.filters.geographicAreaIds = [value.id];
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
        filters: AnalyticsFilters = {},
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<GrowthMetrics> {
        const {
            startDate,
            endDate,
            activityCategoryIds,
            activityTypeIds,
            geographicAreaIds,
            venueIds: filterVenueIds,
            populationIds,
            groupBy
        } = filters;

        // Determine effective geographic area IDs
        const effectiveAreaIds = await this.getEffectiveGeographicAreaIds(
            geographicAreaIds,
            authorizedAreaIds,
            hasGeographicRestrictions
        );

        // Get venue IDs if geographic filter is provided
        let venueIds: string[] | undefined;
        if (effectiveAreaIds) {
            const venues = await this.prisma.venue.findMany({
                where: { geographicAreaId: { in: effectiveAreaIds } },
                select: { id: true },
            });
            venueIds = venues.map((v) => v.id);
        }

        // Merge explicit venue filter with geographic-derived venue IDs
        if (filterVenueIds && filterVenueIds.length > 0) {
            if (venueIds) {
                // Intersection: only venues that match both filters
                venueIds = venueIds.filter(id => filterVenueIds.includes(id));
            } else {
                // Use explicit venue filter
                venueIds = filterVenueIds;
            }
        }

        // Determine date range - if no dates provided, query all history
        let start: Date;
        let end: Date;

        if (!startDate && !endDate) {
            // Query all history - get earliest activity start date
            const earliestActivity = await this.prisma.activity.findFirst({
                orderBy: { startDate: 'asc' },
                select: { startDate: true },
            });

            start = earliestActivity?.startDate || new Date();
            end = new Date();
        } else {
            const now = new Date();
            start = startDate || new Date(now.getFullYear() - 1, 0, 1);
            end = endDate || now;
        }

        // Generate time periods
        const periods = this.generateTimePeriods(start, end, timePeriod);

        // Build base activity filter
        // We need activities that were active at ANY point during our analysis period
        // This means:
        // 1. Activity started on or before the analysis end date
        // 2. Activity has no end date (ongoing) OR ended on or after the analysis start date
        const activityWhere: any = {
            AND: [
                {
                    startDate: {
                        lte: end, // Started on or before analysis end
                    },
                },
                {
                    OR: [
                        {
                            endDate: null, // Ongoing activities
                        },
                        {
                            endDate: {
                                gte: start, // Or ended on or after analysis start
                            },
                        },
                    ],
                },
            ],
        };

        // Add additional filters to the AND array
        if (activityCategoryIds && activityCategoryIds.length > 0) {
            activityWhere.AND.push({
                activityType: {
                    activityCategoryId: { in: activityCategoryIds },
                },
            });
        }

        if (activityTypeIds && activityTypeIds.length > 0) {
            activityWhere.AND.push({
                activityTypeId: { in: activityTypeIds },
            });
        }

        if (venueIds) {
            activityWhere.AND.push({
                activityVenueHistory: {
                    some: {
                        venueId: { in: venueIds },
                    },
                },
            });
        }

        // Add population filtering
        if (populationIds && populationIds.length > 0) {
            activityWhere.AND.push({
                assignments: {
                    some: {
                        participant: {
                            participantPopulations: {
                                some: {
                                    populationId: { in: populationIds },
                                },
                            },
                        },
                    },
                },
            });
        }

        const activities = await this.prisma.activity.findMany({
            where: activityWhere,
            include: {
                activityType: {
                    include: {
                        activityCategory: true,
                    },
                },
                assignments: {
                    include: {
                        participant: {
                            include: {
                                participantPopulations: populationIds && populationIds.length > 0 ? {
                                    include: {
                                        population: true,
                                    },
                                } : false,
                            },
                        },
                    },
                },
            },
        });

        // If groupBy is specified, calculate grouped time series
        if (groupBy && (groupBy.includes(GroupingDimension.ACTIVITY_TYPE) || groupBy.includes(GroupingDimension.ACTIVITY_CATEGORY))) {
            const groupedTimeSeries: Record<string, GrowthPeriodData[]> = {};
            const groupByType = groupBy.includes(GroupingDimension.ACTIVITY_TYPE);

            // Group activities by type or category
            const activityGroups = new Map<string, typeof activities>();

            activities.forEach(activity => {
                const groupKey = groupByType
                    ? activity.activityType.name
                    : activity.activityType.activityCategory.name;

                if (!activityGroups.has(groupKey)) {
                    activityGroups.set(groupKey, []);
                }
                activityGroups.get(groupKey)!.push(activity);
            });

            // Calculate time series for each group
            for (const [groupName, groupActivities] of activityGroups) {
                groupedTimeSeries[groupName] = this.calculateGrowthTimeSeries(periods, groupActivities, populationIds);
            }

            return { timeSeries: [], groupedTimeSeries };
        }

        // Calculate aggregate time series
        const timeSeries = this.calculateGrowthTimeSeries(periods, activities, populationIds);

        return { timeSeries };
    }

    private calculateGrowthTimeSeries(
        periods: Array<{ start: Date; end: Date; label: string }>,
        activities: Array<{
            id: string;
            startDate: Date;
            endDate: Date | null;
            status: any; // Use any to accept Prisma's ActivityStatus enum
            assignments: Array<{
                participantId: string;
                participant?: any; // Include participant when population filtering is used
            }>;
        }>,
        populationIds?: string[]
    ): GrowthPeriodData[] {
        const timeSeries: GrowthPeriodData[] = [];

        // Helper function to filter assignments by population
        const filterAssignmentsByPopulation = (assignments: any[]) => {
            if (!populationIds || populationIds.length === 0) {
                return assignments;
            }
            return assignments.filter(assignment =>
                assignment.participant?.participantPopulations?.some((pp: any) =>
                    populationIds.includes(pp.populationId)
                )
            );
        };

        for (const period of periods) {
            // Unique activities: activities that were ACTIVE during this period
            // An activity is active during a period [start, end) if:
            // - It started strictly before the period end: startDate < period.end
            // - It hasn't ended yet OR it ended on or after the period start: endDate === null OR endDate >= period.start
            const activeActivities = activities.filter(activity => {
                const startedBeforePeriodEnd = activity.startDate < period.end;
                const notEndedOrEndedAfterPeriodStart =
                    !activity.endDate || activity.endDate >= period.start;

                return startedBeforePeriodEnd && notEndedOrEndedAfterPeriodStart;
            });

            const uniqueActivities = activeActivities.length;

            // Unique participants: participants assigned to activities that were active during this period
            // The assignment createdAt is irrelevant - what matters is whether the activity was active
            // When population filter is active, only count participants who belong to specified populations
            const uniqueParticipantIds = new Set<string>();
            activeActivities.forEach(activity => {
                filterAssignmentsByPopulation(activity.assignments).forEach(assignment => {
                    uniqueParticipantIds.add(assignment.participantId);
                });
            });

            const uniqueParticipants = uniqueParticipantIds.size;

            // Total participation: sum of filtered assignments for activities active during this period (non-unique)
            // When population filter is active, only count assignments where participant belongs to specified populations
            const totalParticipation = activeActivities.reduce((sum, activity) => {
                return sum + filterAssignmentsByPopulation(activity.assignments).length;
            }, 0);

            timeSeries.push({
                date: period.label,
                uniqueParticipants,
                uniqueActivities,
                totalParticipation,
            });
        }

        return timeSeries;
    }

    /**
     * Get geographic breakdown showing metrics for immediate children of a parent area.
     * When parentGeographicAreaId is provided: returns metrics for immediate children
     * When not provided: returns metrics for all top-level areas (null parent)
     * Each area's metrics aggregate data from the area and all its descendants.
     */
    async getGeographicBreakdown(
        parentGeographicAreaId: string | undefined,
        filters: AnalyticsFilters = {},
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false,
        userId?: string
    ): Promise<GeographicBreakdown[]> {
        // Validate parent area access if provided
        if (parentGeographicAreaId && hasGeographicRestrictions) {
            const hasAccess = authorizedAreaIds.includes(parentGeographicAreaId);
            if (!hasAccess) {
                throw new Error('GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access this geographic area');
            }
        }

        // Determine which areas to return based on parent parameter
        let areasToReturn: any[];

        if (parentGeographicAreaId) {
            // Return immediate children of the specified parent
            areasToReturn = await this.prisma.geographicArea.findMany({
                where: { parentGeographicAreaId },
                orderBy: { name: 'asc' },
            });
        } else {
            // Return all top-level areas (null parent)
            // If user has geographic restrictions, filter to only authorized top-level areas
            const where: any = { parentGeographicAreaId: null };

            if (hasGeographicRestrictions) {
                // Only show top-level areas that the user has access to
                where.id = { in: authorizedAreaIds };
            }

            areasToReturn = await this.prisma.geographicArea.findMany({
                where,
                orderBy: { name: 'asc' },
            });
        }

        // Filter out denied areas if user has geographic restrictions
        if (hasGeographicRestrictions && userId && this.geographicAuthorizationService) {
            const authorizedAreas: any[] = [];

            for (const area of areasToReturn) {
                // Check if user has FULL access to this area
                const accessLevel = await this.geographicAuthorizationService.evaluateAccess(userId, area.id);

                // Only include areas with FULL access (exclude NONE and READ_ONLY)
                if (accessLevel === AccessLevel.FULL) {
                    authorizedAreas.push(area);
                }
            }

            areasToReturn = authorizedAreas;
        }

        // For each area, calculate metrics by aggregating from the area and all its descendants
        const breakdown: GeographicBreakdown[] = [];

        // Batch fetch all descendants for all areas at once
        const allAreaIds = areasToReturn.map(a => a.id);
        const allDescendantsMap = new Map<string, string[]>();

        // Get descendants for all areas in one query
        const allDescendants = await this.geographicAreaRepository.findBatchDescendants(allAreaIds);

        // Build a map of parent -> descendants by checking parentGeographicAreaId
        // We need to query the areas to know their parents
        if (allDescendants.length > 0) {
            const descendantAreas = await this.prisma.geographicArea.findMany({
                where: { id: { in: allDescendants } },
                select: { id: true, parentGeographicAreaId: true }
            });

            // Build parent-child relationships
            for (const area of areasToReturn) {
                const descendants: string[] = [];
                const toCheck = [area.id];
                const checked = new Set<string>();

                while (toCheck.length > 0) {
                    const currentId = toCheck.pop()!;
                    if (checked.has(currentId)) continue;
                    checked.add(currentId);

                    const children = descendantAreas.filter(d => d.parentGeographicAreaId === currentId);
                    for (const child of children) {
                        descendants.push(child.id);
                        toCheck.push(child.id);
                    }
                }

                allDescendantsMap.set(area.id, descendants);
            }
        }

        for (const area of areasToReturn) {
            // Get all descendant IDs for this area
            const allDescendantIds = allDescendantsMap.get(area.id) || [];

            // Filter descendants to only include authorized areas
            let authorizedDescendantIds = allDescendantIds;
            if (hasGeographicRestrictions && userId && this.geographicAuthorizationService) {
                const authorizedDescendants: string[] = [];

                for (const descendantId of allDescendantIds) {
                    const accessLevel = await this.geographicAuthorizationService.evaluateAccess(userId, descendantId);

                    // Only include descendants with FULL access
                    if (accessLevel === AccessLevel.FULL) {
                        authorizedDescendants.push(descendantId);
                    }
                }

                authorizedDescendantIds = authorizedDescendants;
            }

            // Include the area itself and only authorized descendants
            const areaIds = [area.id, ...authorizedDescendantIds];

            // Get all venues in this area and authorized descendants
            const venues = await this.prisma.venue.findMany({
                where: { geographicAreaId: { in: areaIds } },
                select: { id: true },
            });
            const venueIds = venues.map(v => v.id);

            if (venueIds.length === 0) {
                // No venues in this area or authorized descendants - return zero metrics
                breakdown.push({
                    geographicAreaId: area.id,
                    geographicAreaName: area.name,
                    areaType: area.areaType,
                    activityCount: 0,
                    participantCount: 0,
                    participationCount: 0,
                    hasChildren: (await this.prisma.geographicArea.count({ where: { parentGeographicAreaId: area.id } })) > 0,
                });
                continue;
            }

            // Build activity filter
            const activityWhere: any = {
                activityVenueHistory: {
                    some: {
                        venueId: { in: venueIds },
                    },
                },
            };

            // Apply additional filters
            if (filters.activityCategoryIds && filters.activityCategoryIds.length > 0) {
                activityWhere.activityType = {
                    activityCategoryId: { in: filters.activityCategoryIds },
                };
            }

            if (filters.activityTypeIds && filters.activityTypeIds.length > 0) {
                activityWhere.activityTypeId = { in: filters.activityTypeIds };
            }

            if (filters.venueIds && filters.venueIds.length > 0) {
                activityWhere.activityVenueHistory = {
                    some: {
                        venueId: { in: filters.venueIds },
                    },
                };
            }

            // Add date range filtering
            if (filters.startDate && filters.endDate) {
                activityWhere.AND = [
                    { startDate: { lte: filters.endDate } },
                    {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: filters.startDate } },
                        ],
                    },
                ];
            } else if (filters.startDate) {
                activityWhere.AND = [
                    { startDate: { gte: filters.startDate } },
                ];
            } else if (filters.endDate) {
                activityWhere.startDate = { lte: filters.endDate };
            }

            // Add population filtering
            if (filters.populationIds && filters.populationIds.length > 0) {
                activityWhere.assignments = {
                    some: {
                        participant: {
                            participantPopulations: {
                                some: {
                                    populationId: { in: filters.populationIds },
                                },
                            },
                        },
                    },
                };
            }

            // Get activities in this area
            const activities = await this.prisma.activity.findMany({
                where: activityWhere,
                include: {
                    assignments: {
                        include: {
                            participant: {
                                include: {
                                    participantPopulations: true,
                                },
                            },
                        },
                    },
                },
            });

            // Filter assignments by population if needed
            const filterAssignmentsByPopulation = (assignments: any[]) => {
                if (!filters.populationIds || filters.populationIds.length === 0) {
                    return assignments;
                }
                return assignments.filter(assignment =>
                    assignment.participant.participantPopulations.some((pp: any) =>
                        filters.populationIds!.includes(pp.populationId)
                    )
                );
            };

            // Calculate metrics
            const activityCount = activities.length;
            const participantCount = new Set(
                activities.flatMap(a => filterAssignmentsByPopulation(a.assignments).map(as => as.participantId))
            ).size;
            const participationCount = activities.reduce(
                (sum, a) => sum + filterAssignmentsByPopulation(a.assignments).length,
                0
            );

            // Check if this area has children
            const hasChildren = (await this.prisma.geographicArea.count({
                where: { parentGeographicAreaId: area.id },
            })) > 0;

            breakdown.push({
                geographicAreaId: area.id,
                geographicAreaName: area.name,
                areaType: area.areaType,
                activityCount,
                participantCount,
                participationCount,
                hasChildren,
            });
        }

        return breakdown;
    }

    async getActivityLifecycleEvents(
        startDate: Date | undefined,
        endDate: Date | undefined,
        groupBy: 'category' | 'type',
        filters: {
            geographicAreaIds?: string[];
            activityCategoryIds?: string[];
            activityTypeIds?: string[];
            venueIds?: string[];
            populationIds?: string[];
        } = {},
        authorizedAreaIds: string[] = [],
        hasGeographicRestrictions: boolean = false
    ): Promise<ActivityLifecycleData[]> {
        const { geographicAreaIds, activityCategoryIds, activityTypeIds, venueIds, populationIds } = filters;

        // Determine effective geographic area IDs
        let effectiveGeographicAreaIds: string[] | undefined;
        if (geographicAreaIds && geographicAreaIds.length > 0) {
            // Validate each provided geographic area
            for (const areaId of geographicAreaIds) {
                const effectiveIds = await this.getEffectiveGeographicAreaIds(
                    areaId,
                    authorizedAreaIds,
                    hasGeographicRestrictions
                );
                if (!effectiveIds) {
                    // No restrictions, use the provided area
                    if (!effectiveGeographicAreaIds) effectiveGeographicAreaIds = [];
                    effectiveGeographicAreaIds.push(areaId);
                } else {
                    // Add effective IDs
                    if (!effectiveGeographicAreaIds) effectiveGeographicAreaIds = [];
                    effectiveGeographicAreaIds.push(...effectiveIds);
                }
            }
            // Remove duplicates
            if (effectiveGeographicAreaIds) {
                effectiveGeographicAreaIds = [...new Set(effectiveGeographicAreaIds)];
            }
        } else if (hasGeographicRestrictions) {
            // No explicit geographic filter, but user has restrictions - apply implicit filtering
            const effectiveIds = await this.getEffectiveGeographicAreaIds(
                undefined,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            effectiveGeographicAreaIds = effectiveIds;
        }

        // Get venue IDs if geographic filter is provided
        let effectiveVenueIds: string[] | undefined = venueIds;
        if (effectiveGeographicAreaIds && effectiveGeographicAreaIds.length > 0) {
            const venues = await this.prisma.venue.findMany({
                where: { geographicAreaId: { in: effectiveGeographicAreaIds } },
                select: { id: true },
            });
            effectiveVenueIds = venues.map((v) => v.id);

            // If geographic filter is specified but no venues exist in those areas,
            // return empty result immediately
            if (effectiveVenueIds.length === 0) {
                return [];
            }
        }

        // Build base activity filter
        const activityWhere: any = {
            status: {
                not: ActivityStatus.CANCELLED, // Exclude cancelled activities
            },
        };

        if (activityCategoryIds && activityCategoryIds.length > 0) {
            activityWhere.activityType = {
                activityCategoryId: { in: activityCategoryIds },
            };
        }

        if (activityTypeIds && activityTypeIds.length > 0) {
            activityWhere.activityTypeId = { in: activityTypeIds };
        }

        if (effectiveVenueIds && effectiveVenueIds.length > 0) {
            activityWhere.activityVenueHistory = {
                some: {
                    venueId: { in: effectiveVenueIds },
                },
            };
        }

        // Add population filtering
        if (populationIds && populationIds.length > 0) {
            activityWhere.assignments = {
                some: {
                    participant: {
                        participantPopulations: {
                            some: {
                                populationId: { in: populationIds },
                            },
                        },
                    },
                },
            };
        }

        // Query activities with necessary relations
        const activities = await this.prisma.activity.findMany({
            where: activityWhere,
            include: {
                activityType: {
                    include: {
                        activityCategory: true,
                    },
                },
            },
        });

        // Group activities by category or type
        const groupMap = new Map<string, { groupName: string; started: number; completed: number }>();

        for (const activity of activities) {
            // Determine group key and name
            let groupKey: string;
            let groupName: string;

            if (groupBy === 'category') {
                groupKey = activity.activityType.activityCategoryId;
                groupName = activity.activityType.activityCategory.name;
            } else {
                groupKey = activity.activityTypeId;
                groupName = activity.activityType.name;
            }

            // Initialize group if not exists
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    groupName,
                    started: 0,
                    completed: 0,
                });
            }

            const group = groupMap.get(groupKey)!;

            // Count started activities (startDate within period)
            // Handle different date range scenarios
            if (startDate && endDate) {
                // Absolute or relative date range
                if (activity.startDate >= startDate && activity.startDate <= endDate) {
                    group.started++;
                }
            } else if (startDate && !endDate) {
                // Only start date provided
                if (activity.startDate >= startDate) {
                    group.started++;
                }
            } else if (!startDate && endDate) {
                // Only end date provided
                if (activity.startDate <= endDate) {
                    group.started++;
                }
            } else {
                // No date range - count all started activities
                group.started++;
            }

            // Count completed activities (endDate within period and status is COMPLETED)
            if (activity.status === ActivityStatus.COMPLETED && activity.endDate) {
                if (startDate && endDate) {
                    // Absolute or relative date range
                    if (activity.endDate >= startDate && activity.endDate <= endDate) {
                        group.completed++;
                    }
                } else if (startDate && !endDate) {
                    // Only start date provided
                    if (activity.endDate >= startDate) {
                        group.completed++;
                    }
                } else if (!startDate && endDate) {
                    // Only end date provided
                    if (activity.endDate <= endDate) {
                        group.completed++;
                    }
                } else {
                    // No date range - count all completed activities
                    group.completed++;
                }
            }
        }

        // Convert map to array and sort by group name
        return Array.from(groupMap.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
    }

    private async getVenueIdsForArea(geographicAreaId: string): Promise<string[]> {
        const descendants = await this.geographicAreaRepository.findBatchDescendants([geographicAreaId]);
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
                    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
                    label = periodStart.toISOString().split('T')[0];
                    break;

                case TimePeriod.WEEK:
                    periodEnd = new Date(current);
                    periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);
                    label = `Week of ${periodStart.toISOString().split('T')[0]}`;
                    break;

                case TimePeriod.MONTH:
                    periodEnd = new Date(current);
                    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
                    label = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`;
                    break;

                case TimePeriod.YEAR:
                    periodEnd = new Date(current);
                    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
                    label = String(periodStart.getUTCFullYear());
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