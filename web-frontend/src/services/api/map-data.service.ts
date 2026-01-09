import { ApiClient } from './api.client';

export interface ActivityMarker {
    id: string;
    latitude: number;
    longitude: number;
    activityTypeId: string;
    activityCategoryId: string;
}

export interface ActivityPopupContent {
    id: string;
    name: string;
    activityTypeName: string;
    activityCategoryName: string;
    startDate: string;
    participantCount: number;
}

export interface ParticipantHomeMarker {
    venueId: string;
    latitude: number;
    longitude: number;
    participantCount: number;
}

export interface ParticipantHomePopupContent {
    venueId: string;
    venueName: string;
    participantCount: number;
    participantNames: string[];
}

export interface VenueMarker {
    id: string;
    latitude: number;
    longitude: number;
}

export interface VenuePopupContent {
    id: string;
    name: string;
    address: string;
    geographicAreaName: string;
}

export interface MapFilters {
    geographicAreaIds?: string[];
    activityCategoryIds?: string[];
    activityTypeIds?: string[];
    venueIds?: string[];
    populationIds?: string[];
    startDate?: string;
    endDate?: string;
    status?: string;
}

export class MapDataService {
    private static readonly BASE_PATH = '/map';

    /**
     * Get lightweight activity marker data for map rendering
     */
    static async getActivityMarkers(filters: MapFilters = {}): Promise<ActivityMarker[]> {
        const params = new URLSearchParams();

        // Add array filters
        if (filters.geographicAreaIds) {
            filters.geographicAreaIds.forEach(id => params.append('geographicAreaIds', id));
        }
        if (filters.activityCategoryIds) {
            filters.activityCategoryIds.forEach(id => params.append('activityCategoryIds', id));
        }
        if (filters.activityTypeIds) {
            filters.activityTypeIds.forEach(id => params.append('activityTypeIds', id));
        }
        if (filters.venueIds) {
            filters.venueIds.forEach(id => params.append('venueIds', id));
        }
        if (filters.populationIds) {
            filters.populationIds.forEach(id => params.append('populationIds', id));
        }

        // Add date filters
        if (filters.startDate) {
            params.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
            params.append('endDate', filters.endDate);
        }

        // Add status filter
        if (filters.status) {
            params.append('status', filters.status);
        }

        const queryString = params.toString();
        const url = `${ApiClient.getBaseURL()}${this.BASE_PATH}/activities${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch activity markers: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * Get detailed popup content for an activity marker
     */
    static async getActivityPopupContent(activityId: string): Promise<ActivityPopupContent> {
        const url = `${ApiClient.getBaseURL()}${this.BASE_PATH}/activities/${activityId}/popup`;

        const response = await fetch(url, {
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch activity popup content: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * Get lightweight participant home marker data grouped by venue
     */
    static async getParticipantHomeMarkers(
        filters: Pick<MapFilters, 'geographicAreaIds' | 'populationIds'> = {}
    ): Promise<ParticipantHomeMarker[]> {
        const params = new URLSearchParams();

        if (filters.geographicAreaIds) {
            filters.geographicAreaIds.forEach(id => params.append('geographicAreaIds', id));
        }
        if (filters.populationIds) {
            filters.populationIds.forEach(id => params.append('populationIds', id));
        }

        const queryString = params.toString();
        const url = `${ApiClient.getBaseURL()}${this.BASE_PATH}/participant-homes${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch participant home markers: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * Get detailed popup content for a participant home marker
     */
    static async getParticipantHomePopupContent(venueId: string): Promise<ParticipantHomePopupContent> {
        const url = `${ApiClient.getBaseURL()}${this.BASE_PATH}/participant-homes/${venueId}/popup`;

        const response = await fetch(url, {
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch participant home popup content: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * Get lightweight venue marker data for map rendering
     */
    static async getVenueMarkers(
        filters: Pick<MapFilters, 'geographicAreaIds'> = {}
    ): Promise<VenueMarker[]> {
        const params = new URLSearchParams();

        if (filters.geographicAreaIds) {
            filters.geographicAreaIds.forEach(id => params.append('geographicAreaIds', id));
        }

        const queryString = params.toString();
        const url = `${ApiClient.getBaseURL()}${this.BASE_PATH}/venues${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch venue markers: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * Get detailed popup content for a venue marker
     */
    static async getVenuePopupContent(venueId: string): Promise<VenuePopupContent> {
        const url = `${ApiClient.getBaseURL()}${this.BASE_PATH}/venues/${venueId}/popup`;

        const response = await fetch(url, {
            headers: ApiClient.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch venue popup content: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
    }
}
