export * from './auth.types';

export interface ActivityType {
    id: string;
    name: string;
    isPredefined: boolean;
}

export interface ParticipantRole {
    id: string;
    name: string;
    isPredefined: boolean;
}

export interface Participant {
    id: string;
    name: string;
    email: string;
    phone?: string;
    notes?: string;
    homeVenueId?: string;
    createdAt: string;
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
    createdAt: string;
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
    createdAt: string;
}

export interface Activity {
    id: string;
    name: string;
    activityTypeId: string;
    activityType?: ActivityType;
    startDate: string;
    endDate?: string;
    status: 'ACTIVE' | 'COMPLETED';
    isOngoing: boolean;
    venues?: ActivityVenueHistory[];
    createdAt: string;
}

export interface ActivityVenueHistory {
    id: string;
    activityId: string;
    venueId: string;
    venue?: Venue;
    effectiveFrom: string;
    effectiveTo?: string;
}

export interface ParticipantAddressHistory {
    id: string;
    participantId: string;
    venueId: string;
    venue?: Venue;
    effectiveFrom: string;
    effectiveTo?: string;
}

export interface Assignment {
    id: string;
    activityId: string;
    participantId: string;
    roleId: string;
    participant?: Participant;
    role?: ParticipantRole;
}

export interface EngagementMetrics {
    totalParticipants: number;
    totalActivities: number;
    activeActivities: number;
    ongoingActivities: number;
    activitiesByType: { type: string; count: number }[];
    roleDistribution: { role: string; count: number }[];
    geographicBreakdown?: { area: string; count: number }[];
}

export interface GrowthMetrics {
    newParticipants: { date: string; count: number }[];
    newActivities: { date: string; count: number }[];
    cumulativeParticipants: { date: string; count: number }[];
    cumulativeActivities: { date: string; count: number }[];
    participantChange: number;
    activityChange: number;
}

export interface GeographicAreaStatistics {
    geographicAreaId: string;
    totalActivities: number;
    totalParticipants: number;
    activeActivities: number;
    ongoingActivities: number;
}
