export * from './auth.types';

export interface ActivityType {
    id: string;
    name: string;
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

export interface Participant {
    id: string;
    name: string;
    email: string;
    phone?: string;
    notes?: string;
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
    | 'CUSTOM';

export interface GeographicArea {
    id: string;
    name: string;
    areaType: AreaType;
    parentGeographicAreaId?: string;
    parent?: GeographicArea;
    children?: GeographicArea[];
    version: number;
    createdAt: string;
    updatedAt: string;
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
    effectiveFrom: string;
}

export interface ParticipantAddressHistory {
    id: string;
    participantId: string;
    venueId: string;
    venue?: Venue;
    effectiveFrom: string;
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

export interface EngagementMetrics {
    totalActivities: number;
    activeActivities: number;
    totalParticipants: number;
    activeParticipants: number;
    participationRate: number;
    retentionRate: number;
    averageActivitySize: number;
    geographicBreakdown: {
        geographicAreaId: string;
        geographicAreaName: string;
        activityCount: number;
        participantCount: number;
    }[];
    periodStart: string;
    periodEnd: string;
}

export interface GrowthMetrics {
    timeSeries: GrowthPeriodData[];
}

export interface GrowthPeriodData {
    date: string;
    newParticipants: number;
    newActivities: number;
    cumulativeParticipants: number;
    cumulativeActivities: number;
}

export interface GeographicAnalytics {
    geographicAreaId: string;
    geographicAreaName: string;
    areaType: string;
    totalActivities: number;
    activeActivities: number;
    totalParticipants: number;
    activeParticipants: number;
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
