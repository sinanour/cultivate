import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';

export type TimePeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface EngagementMetrics {
    totalParticipants: number;
    totalActivities: number;
    activeActivities: number;
    activitiesByType: Record<string, number>;
    participantsByType: Record<string, number>;
    roleDistribution: Record<string, number>;
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
}

export class AnalyticsService {
    constructor(
        private prisma: PrismaClient,
        private geographicAreaRepository: GeographicAreaRepository
    ) { }

    async getEngagementMetrics(filters: AnalyticsFilters = {}): Promise<EngagementMetrics> {
        const { startDate, endDate, geographicAreaId } = filters;

        // Get venue IDs if geographic filter is provided
        let venueIds: string[] | undefined;
        if (geographicAreaId) {
            venueIds = await this.getVenueIdsForArea(geographicAreaId);
        }

        // Build activity filter
        const activityWhere: any = {};
        if (startDate || endDate) {
            activityWhere.OR = [
                {
                    startDate: {
                        ...(startDate && { gte: startDate }),
                        ...(endDate && { lte: endDate }),
                    },
                },
                {
                    endDate: {
                        ...(startDate && { gte: startDate }),
                        ...(endDate && { lte: endDate }),
                    },
                },
                {
                    AND: [
                        startDate && { startDate: { lte: startDate } },
                        endDate && { endDate: { gte: endDate } },
                    ].filter(Boolean),
                },
            ];
        }

        if (venueIds) {
            activityWhere.activityVenueHistory = {
                some: {
                    venueId: { in: venueIds },
                },
            };
        }

        // Get activities
        const activities = await this.prisma.activity.findMany({
            where: activityWhere,
            include: {
                activityType: true,
                assignments: {
                    include: {
                        participant: true,
                        role: true,
                    },
                },
            },
        });

        // Calculate metrics
        const totalActivities = activities.length;
        const activeActivities = activities.filter(
            (a) => a.status === 'ACTIVE' || (a.endDate === null && a.status !== 'CANCELLED')
        ).length;

        // Count activities by type
        const activitiesByType: Record<string, number> = {};
        activities.forEach((activity) => {
            const typeName = activity.activityType.name;
            activitiesByType[typeName] = (activitiesByType[typeName] || 0) + 1;
        });

        // Count unique participants
        const participantIds = new Set<string>();
        activities.forEach((activity) => {
            activity.assignments.forEach((assignment) => {
                participantIds.add(assignment.participantId);
            });
        });

        // Count participants by activity type
        const participantsByType: Record<string, Set<string>> = {};
        activities.forEach((activity) => {
            const typeName = activity.activityType.name;
            if (!participantsByType[typeName]) {
                participantsByType[typeName] = new Set();
            }
            activity.assignments.forEach((assignment) => {
                participantsByType[typeName].add(assignment.participantId);
            });
        });

        const participantsByTypeCount: Record<string, number> = {};
        Object.entries(participantsByType).forEach(([type, participants]) => {
            participantsByTypeCount[type] = participants.size;
        });

        // Count role distribution
        const roleDistribution: Record<string, number> = {};
        activities.forEach((activity) => {
            activity.assignments.forEach((assignment) => {
                const roleName = assignment.role.name;
                roleDistribution[roleName] = (roleDistribution[roleName] || 0) + 1;
            });
        });

        return {
            totalParticipants: participantIds.size,
            totalActivities,
            activeActivities,
            activitiesByType,
            participantsByType: participantsByTypeCount,
            roleDistribution,
        };
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

        // Determine date range
        const now = new Date();
        const start = startDate || new Date(now.getFullYear() - 1, 0, 1);
        const end = endDate || now;

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
                case 'DAY':
                    periodEnd = new Date(current);
                    periodEnd.setDate(periodEnd.getDate() + 1);
                    label = periodStart.toISOString().split('T')[0];
                    break;

                case 'WEEK':
                    periodEnd = new Date(current);
                    periodEnd.setDate(periodEnd.getDate() + 7);
                    label = `Week of ${periodStart.toISOString().split('T')[0]}`;
                    break;

                case 'MONTH':
                    periodEnd = new Date(current);
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                    label = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
                    break;

                case 'YEAR':
                    periodEnd = new Date(current);
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                    label = String(periodStart.getFullYear());
                    break;
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
