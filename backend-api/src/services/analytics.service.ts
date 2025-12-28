import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import {
    ActivityStatus,
    TimePeriod,
    DateGranularity,
    GroupingDimension
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
    newParticipants: number;
    disengagedParticipants: number;
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
    newParticipants: number;
    disengagedParticipants: number;

    // Aggregate counts
    totalActivities: number;
    totalParticipants: number;

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
    newParticipants: number;
    newActivities: number;
    cumulativeParticipants: number;
    percentageChange: number | null;
}

export interface GrowthMetrics {
    timeSeries: GrowthPeriodData[];
}

export interface AnalyticsFilters {
    startDate?: Date;
    endDate?: Date;
    geographicAreaId?: string;
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
        const { startDate, endDate, geographicAreaId, activityTypeId, venueId, groupBy } = filters;

        // If groupBy dimensions are specified, return grouped results
        if (groupBy && groupBy.length > 0) {
            return this.getGroupedEngagementMetrics(filters);
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
                activityType: true,
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
        const activitiesAtStart = startDate
            ? allActivities.filter(a =>
                a.createdAt <= startDate &&
                (a.status !== ActivityStatus.COMPLETED && a.status !== ActivityStatus.CANCELLED ||
                    (a.endDate && a.endDate >= startDate))
            ).length
            : 0;

        const activitiesAtEnd = endDate
            ? allActivities.filter(a =>
                a.createdAt <= endDate &&
                (a.status !== ActivityStatus.COMPLETED && a.status !== ActivityStatus.CANCELLED ||
                    (a.endDate && a.endDate >= endDate))
            ).length
            : allActivities.length;

        const activitiesStarted = startDate && endDate
            ? allActivities.filter(a => a.startDate >= startDate && a.startDate <= endDate).length
            : allActivities.length;

        const activitiesCompleted = startDate && endDate
            ? allActivities.filter(a =>
                a.status === ActivityStatus.COMPLETED &&
                a.updatedAt >= startDate &&
                a.updatedAt <= endDate
            ).length
            : allActivities.filter(a => a.status === ActivityStatus.COMPLETED).length;

        const activitiesCancelled = startDate && endDate
            ? allActivities.filter(a =>
                a.status === ActivityStatus.CANCELLED &&
                a.updatedAt >= startDate &&
                a.updatedAt <= endDate
            ).length
            : allActivities.filter(a => a.status === ActivityStatus.CANCELLED).length;

        // Get all participants for temporal analysis
        const participantWhere: any = {};
        if (venueIds) {
            participantWhere.addressHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        const allParticipants = await this.prisma.participant.findMany({
            where: participantWhere,
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

        const newParticipants = startDate && endDate
            ? allParticipants.filter(p =>
                p.assignments.some(a =>
                    a.createdAt >= startDate &&
                    a.createdAt <= endDate &&
                    !p.assignments.some(a2 => a2.createdAt < startDate)
                )
            ).length
            : allParticipants.length;

        const disengagedParticipants = endDate
            ? allParticipants.filter(p =>
                p.createdAt <= endDate &&
                !p.assignments.some(a =>
                    allActivities.some(act => act.id === a.activityId)
                )
            ).length
            : allParticipants.filter(p => p.assignments.length === 0).length;

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
                    newParticipants: 0,
                    disengagedParticipants: 0,
                });
            }

            const breakdown = activitiesByTypeMap.get(typeId)!;

            // Count activities by temporal category
            if (startDate && activity.createdAt <= startDate &&
                (activity.status !== ActivityStatus.COMPLETED && activity.status !== ActivityStatus.CANCELLED ||
                    (activity.endDate && activity.endDate >= startDate))) {
                breakdown.activitiesAtStart++;
            }

            if (endDate && activity.createdAt <= endDate &&
                (activity.status !== ActivityStatus.COMPLETED && activity.status !== ActivityStatus.CANCELLED ||
                    (activity.endDate && activity.endDate >= endDate))) {
                breakdown.activitiesAtEnd++;
            }

            if (startDate && endDate && activity.startDate >= startDate && activity.startDate <= endDate) {
                breakdown.activitiesStarted++;
            }

            if (startDate && endDate && activity.status === ActivityStatus.COMPLETED &&
                activity.updatedAt >= startDate && activity.updatedAt <= endDate) {
                breakdown.activitiesCompleted++;
            }

            if (startDate && endDate && activity.status === ActivityStatus.CANCELLED &&
                activity.updatedAt >= startDate && activity.updatedAt <= endDate) {
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

            if (startDate && endDate) {
                const newParticipantsForType = activity.assignments.filter(a =>
                    a.createdAt >= startDate && a.createdAt <= endDate &&
                    !activity.assignments.some(a2 => a2.participantId === a.participantId && a2.createdAt < startDate)
                );
                breakdown.newParticipants += new Set(newParticipantsForType.map(a => a.participantId)).size;
            }
        }

        const activitiesByType = Array.from(activitiesByTypeMap.values());

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

        // Calculate geographic breakdown (if not already filtered by geographic area)
        const geographicBreakdown: GeographicBreakdown[] = [];
        if (!geographicAreaId) {
            const areas = await this.geographicAreaRepository.findAll();
            for (const area of areas) {
                const areaVenueIds = await this.getVenueIdsForArea(area.id);
                const areaActivities = allActivities.filter(a =>
                    a.activityVenueHistory?.some(vh => areaVenueIds.includes(vh.venueId))
                );
                const areaParticipantIds = new Set(
                    areaActivities.flatMap(a => a.assignments.map(as => as.participantId))
                );

                geographicBreakdown.push({
                    geographicAreaId: area.id,
                    geographicAreaName: area.name,
                    activityCount: areaActivities.length,
                    participantCount: areaParticipantIds.size,
                });
            }
        }

        return {
            activitiesAtStart,
            activitiesAtEnd,
            activitiesStarted,
            activitiesCompleted,
            activitiesCancelled,
            participantsAtStart,
            participantsAtEnd,
            newParticipants,
            disengagedParticipants,
            totalActivities,
            totalParticipants,
            activitiesByType,
            roleDistribution,
            geographicBreakdown,
            periodStart: startDate?.toISOString() || '',
            periodEnd: endDate?.toISOString() || new Date().toISOString(),
            appliedFilters: {
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

        // Generate grouped results
        const groupedResults: GroupedMetrics[] = [];

        // Process grouping dimensions in order
        const primaryDimension = groupBy[0];
        const remainingDimensions = groupBy.slice(1);

        switch (primaryDimension) {
            case GroupingDimension.ACTIVITY_TYPE:
                groupedResults.push(...await this.groupByActivityType(filters, remainingDimensions));
                break;

            case GroupingDimension.VENUE:
                groupedResults.push(...await this.groupByVenue(filters, remainingDimensions));
                break;

            case GroupingDimension.GEOGRAPHIC_AREA:
                groupedResults.push(...await this.groupByGeographicArea(filters, remainingDimensions));
                break;

            case GroupingDimension.DATE:
                groupedResults.push(...await this.groupByDate(filters, remainingDimensions));
                break;
        }

        return {
            ...baseMetrics,
            groupedResults,
            groupingDimensions: groupBy.map(d => d.toString()),
        };
    }

    private async groupByActivityType(
        filters: AnalyticsFilters,
        remainingDimensions: GroupingDimension[]
    ): Promise<GroupedMetrics[]> {
        const activityTypes = await this.prisma.activityType.findMany();
        const results: GroupedMetrics[] = [];

        for (const type of activityTypes) {
            const typeFilters = {
                ...filters,
                activityTypeId: type.id,
                groupBy: remainingDimensions.length > 0 ? remainingDimensions : undefined,
            };

            const metrics = await this.getEngagementMetrics(typeFilters);

            results.push({
                dimensions: { activityType: type.name },
                metrics,
            });
        }

        return results;
    }

    private async groupByVenue(
        filters: AnalyticsFilters,
        remainingDimensions: GroupingDimension[]
    ): Promise<GroupedMetrics[]> {
        // Get venues filtered by geographic area if specified
        const venueWhere: any = {};
        if (filters.geographicAreaId) {
            const venueIds = await this.getVenueIdsForArea(filters.geographicAreaId);
            venueWhere.id = { in: venueIds };
        }

        const venues = await this.prisma.venue.findMany({ where: venueWhere });
        const results: GroupedMetrics[] = [];

        for (const venue of venues) {
            const venueFilters = {
                ...filters,
                venueId: venue.id,
                groupBy: remainingDimensions.length > 0 ? remainingDimensions : undefined,
            };

            const metrics = await this.getEngagementMetrics(venueFilters);

            results.push({
                dimensions: { venue: venue.name },
                metrics,
            });
        }

        return results;
    }

    private async groupByGeographicArea(
        filters: AnalyticsFilters,
        remainingDimensions: GroupingDimension[]
    ): Promise<GroupedMetrics[]> {
        const areas = await this.geographicAreaRepository.findAll();
        const results: GroupedMetrics[] = [];

        for (const area of areas) {
            const areaFilters = {
                ...filters,
                geographicAreaId: area.id,
                groupBy: remainingDimensions.length > 0 ? remainingDimensions : undefined,
            };

            const metrics = await this.getEngagementMetrics(areaFilters);

            results.push({
                dimensions: { geographicArea: area.name },
                metrics,
            });
        }

        return results;
    }

    private async groupByDate(
        filters: AnalyticsFilters,
        remainingDimensions: GroupingDimension[]
    ): Promise<GroupedMetrics[]> {
        const { startDate, endDate, dateGranularity } = filters;

        if (!startDate || !endDate) {
            // Cannot group by date without date range
            return [];
        }

        // Convert DateGranularity to TimePeriod
        let timePeriod: TimePeriod;
        switch (dateGranularity) {
            case DateGranularity.WEEKLY:
                timePeriod = TimePeriod.WEEK;
                break;
            case DateGranularity.MONTHLY:
                timePeriod = TimePeriod.MONTH;
                break;
            case DateGranularity.QUARTERLY:
                timePeriod = TimePeriod.MONTH; // Will group by 3 months
                break;
            case DateGranularity.YEARLY:
                timePeriod = TimePeriod.YEAR;
                break;
            default:
                timePeriod = TimePeriod.MONTH;
        }

        const periods = this.generateTimePeriods(startDate, endDate, timePeriod);
        const results: GroupedMetrics[] = [];

        for (const period of periods) {
            const periodFilters = {
                ...filters,
                startDate: period.start,
                endDate: period.end,
                groupBy: remainingDimensions.length > 0 ? remainingDimensions : undefined,
            };

            const metrics = await this.getEngagementMetrics(periodFilters);

            results.push({
                dimensions: { date: period.label },
                metrics,
            });
        }

        // Handle quarterly grouping by combining 3 months
        if (dateGranularity === DateGranularity.QUARTERLY) {
            const quarterlyResults: GroupedMetrics[] = [];
            for (let i = 0; i < results.length; i += 3) {
                const quarterMonths = results.slice(i, i + 3);
                if (quarterMonths.length > 0) {
                    const quarterLabel = `Q${Math.floor(i / 3) + 1} ${quarterMonths[0].dimensions.date.split('-')[0]}`;
                    const combinedMetrics = this.combineMetrics(quarterMonths.map(m => m.metrics));

                    quarterlyResults.push({
                        dimensions: { date: quarterLabel },
                        metrics: combinedMetrics,
                    });
                }
            }
            return quarterlyResults;
        }

        return results;
    }

    private combineMetrics(metricsList: EngagementMetrics[]): EngagementMetrics {
        // Combine multiple metrics into one by summing counts
        const combined: EngagementMetrics = {
            activitiesAtStart: 0,
            activitiesAtEnd: 0,
            activitiesStarted: 0,
            activitiesCompleted: 0,
            activitiesCancelled: 0,
            participantsAtStart: 0,
            participantsAtEnd: 0,
            newParticipants: 0,
            disengagedParticipants: 0,
            totalActivities: 0,
            totalParticipants: 0,
            activitiesByType: [],
            roleDistribution: [],
            geographicBreakdown: [],
            periodStart: metricsList[0]?.periodStart || '',
            periodEnd: metricsList[metricsList.length - 1]?.periodEnd || '',
            appliedFilters: metricsList[0]?.appliedFilters || {},
            groupingDimensions: metricsList[0]?.groupingDimensions,
        };

        // Sum all numeric fields
        for (const metrics of metricsList) {
            combined.activitiesAtStart += metrics.activitiesAtStart;
            combined.activitiesAtEnd += metrics.activitiesAtEnd;
            combined.activitiesStarted += metrics.activitiesStarted;
            combined.activitiesCompleted += metrics.activitiesCompleted;
            combined.activitiesCancelled += metrics.activitiesCancelled;
            combined.participantsAtStart += metrics.participantsAtStart;
            combined.participantsAtEnd += metrics.participantsAtEnd;
            combined.newParticipants += metrics.newParticipants;
            combined.disengagedParticipants += metrics.disengagedParticipants;
            combined.totalActivities += metrics.totalActivities;
            combined.totalParticipants += metrics.totalParticipants;
        }

        // Combine activity type breakdowns
        const typeMap = new Map<string, ActivityTypeBreakdown>();
        for (const metrics of metricsList) {
            for (const typeBreakdown of metrics.activitiesByType) {
                if (!typeMap.has(typeBreakdown.activityTypeId)) {
                    typeMap.set(typeBreakdown.activityTypeId, { ...typeBreakdown });
                } else {
                    const existing = typeMap.get(typeBreakdown.activityTypeId)!;
                    existing.activitiesAtStart += typeBreakdown.activitiesAtStart;
                    existing.activitiesAtEnd += typeBreakdown.activitiesAtEnd;
                    existing.activitiesStarted += typeBreakdown.activitiesStarted;
                    existing.activitiesCompleted += typeBreakdown.activitiesCompleted;
                    existing.activitiesCancelled += typeBreakdown.activitiesCancelled;
                    existing.participantsAtStart += typeBreakdown.participantsAtStart;
                    existing.participantsAtEnd += typeBreakdown.participantsAtEnd;
                    existing.newParticipants += typeBreakdown.newParticipants;
                    existing.disengagedParticipants += typeBreakdown.disengagedParticipants;
                }
            }
        }
        combined.activitiesByType = Array.from(typeMap.values());

        // Combine role distributions
        const roleMap = new Map<string, RoleDistribution>();
        for (const metrics of metricsList) {
            for (const role of metrics.roleDistribution) {
                if (!roleMap.has(role.roleId)) {
                    roleMap.set(role.roleId, { ...role });
                } else {
                    roleMap.get(role.roleId)!.count += role.count;
                }
            }
        }
        combined.roleDistribution = Array.from(roleMap.values());

        // Combine geographic breakdowns
        const geoMap = new Map<string, GeographicBreakdown>();
        for (const metrics of metricsList) {
            for (const geo of metrics.geographicBreakdown) {
                if (!geoMap.has(geo.geographicAreaId)) {
                    geoMap.set(geo.geographicAreaId, { ...geo });
                } else {
                    const existing = geoMap.get(geo.geographicAreaId)!;
                    existing.activityCount += geo.activityCount;
                    existing.participantCount += geo.participantCount;
                }
            }
        }
        combined.geographicBreakdown = Array.from(geoMap.values());

        return combined;
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
        let previousNewParticipants = 0;

        for (const period of periods) {
            const newParticipants = participants.filter(
                (p) => p.createdAt >= period.start && p.createdAt < period.end
            ).length;

            const newActivities = activities.filter(
                (a) => a.createdAt >= period.start && a.createdAt < period.end
            ).length;

            cumulativeParticipants += newParticipants;

            const percentageChange =
                previousNewParticipants > 0
                    ? ((newParticipants - previousNewParticipants) / previousNewParticipants) * 100
                    : null;

            timeSeries.push({
                period: period.label,
                newParticipants,
                newActivities,
                cumulativeParticipants,
                percentageChange,
            });

            previousNewParticipants = newParticipants;
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