export * from './auth.types';

export interface ActivityCategory {
    id: string;
    name: string;
    isPredefined: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface ActivityType {
    id: string;
    name: string;
    activityCategoryId: string;
    activityCategory?: ActivityCategory;
    isPredefined: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface ParticipantRole {
    id: string;
    name: string;
    isPredefined: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface Population {
    id: string;
    name: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface ParticipantPopulation {
    id: string;
    participantId: string;
    populationId: string;
    population?: Population;
    createdAt: string;
}

export interface Participant {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
    dateOfBirth?: string;
    dateOfRegistration?: string;
    nickname?: string;
    populations?: Array<{ id: string; name: string }>;  // Population associations included by default
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface Venue {
    id: string;
    name: string;
    address: string;
    geographicAreaId: string;
    geographicArea?: GeographicArea;
    latitude?: number;
    longitude?: number;
    venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
    version: number;
    createdAt: string;
    updatedAt: string;
}

export type AreaType =
    | 'NEIGHBOURHOOD'
    | 'COMMUNITY'
    | 'CITY'
    | 'CLUSTER'
    | 'COUNTY'
    | 'PROVINCE'
    | 'STATE'
    | 'COUNTRY'
    | 'CONTINENT'
    | 'HEMISPHERE'
    | 'WORLD';

export interface GeographicArea {
    id: string;
    name: string;
    areaType: AreaType;
    parentGeographicAreaId?: string;
    parent?: GeographicArea;
    children?: GeographicArea[];
    childCount?: number;  // Number of immediate children (used for lazy loading)
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface GeographicAreaWithHierarchy extends GeographicArea {
    ancestors: GeographicArea[];  // Ordered from closest to most distant
    hierarchyPath: string;         // Formatted path: "Community A > City B > Province C"
}

export interface Activity {
    id: string;
    name: string;
    activityTypeId: string;
    activityType?: ActivityType;
    startDate: string;
    endDate?: string;
    status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    isOngoing: boolean;
    createdBy?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface ActivityVenueHistory {
    id: string;
    activityId: string;
    venueId: string;
    venue?: Venue;
    effectiveFrom: string | null;  // Nullable: null means uses activity startDate
}

export interface ParticipantAddressHistory {
    id: string;
    participantId: string;
    venueId: string;
    venue?: Venue;
    effectiveFrom: string | null;  // Nullable: null means oldest/initial address
}

export interface Assignment {
    id: string;
    activityId: string;
    participantId: string;
    roleId: string;
    notes?: string;
    participant?: Participant;
    role?: ParticipantRole;
    activity?: Activity;
    createdAt: string;
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

export interface ActivityTypeBreakdown {
    activityTypeId: string;
    activityTypeName: string;
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
        activityCategoryId?: string;
        activityTypeId?: string;
        venueId?: string;
        geographicAreaId?: string;
        populationIds?: string[];
        startDate?: string;
        endDate?: string;
    };
    groupingDimensions?: string[];
}

export interface GrowthMetrics {
    timeSeries: GrowthPeriodData[];
    groupedTimeSeries?: Record<string, GrowthPeriodData[]>; // When groupBy is specified
}

export interface GrowthPeriodData {
    date: string;
    uniqueParticipants: number;
    uniqueActivities: number;
    totalParticipation: number;
}

export interface GeographicAnalytics {
    geographicAreaId: string;
    geographicAreaName: string;
    areaType: string;
    activityCount: number;
    participantCount: number;
    participationCount: number;
    hasChildren: boolean;
}

export interface GeographicAreaStatistics {
    totalActivities: number;
    totalParticipants: number;
    totalVenues: number;
    activeActivities: number;
}

export interface APIResponse<T> {
    success: boolean;
    data: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface APIError {
    code: string;
    message: string;
    details?: any;
}

export interface GeocodingResult {
    latitude: number;
    longitude: number;
    displayName: string;
    address: {
        road?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
    };
    boundingBox?: [number, number, number, number];
}
