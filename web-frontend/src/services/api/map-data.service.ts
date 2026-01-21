import { ApiClient } from './api.client';

export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

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

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export class MapDataService {
    private static readonly BASE_PATH = '/map';

    /**
     * Get lightweight activity marker data for map rendering with pagination
     */
    static async getActivityMarkers(
        filters: MapFilters = {},
        boundingBox?: BoundingBox,
        page: number = 1,
        limit: number = 100
    ): Promise<PaginatedResponse<ActivityMarker>> {
        const params = new URLSearchParams();

        // Add pagination parameters
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        // Add bounding box parameters
        if (boundingBox) {
            params.append('minLat', boundingBox.minLat.toString());
            params.append('maxLat', boundingBox.maxLat.toString());
            params.append('minLon', boundingBox.minLon.toString());
            params.append('maxLon', boundingBox.maxLon.toString());
        }

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

        const endpoint = `${this.BASE_PATH}/activities?${params.toString()}`;
        return ApiClient.get<PaginatedResponse<ActivityMarker>>(endpoint);
    }

    /**
     * Get detailed popup content for an activity marker
     */
    static async getActivityPopupContent(activityId: string): Promise<ActivityPopupContent> {
        const endpoint = `${this.BASE_PATH}/activities/${activityId}/popup`;
        return ApiClient.get<ActivityPopupContent>(endpoint);
    }

    /**
     * Get lightweight participant home marker data grouped by venue with pagination
     */
    static async getParticipantHomeMarkers(
        filters: Pick<MapFilters, 'geographicAreaIds' | 'populationIds' | 'startDate' | 'endDate'> = {},
        boundingBox?: BoundingBox,
        page: number = 1,
        limit: number = 100
    ): Promise<PaginatedResponse<ParticipantHomeMarker>> {
        const params = new URLSearchParams();

        // Add pagination parameters
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        // Add bounding box parameters
        if (boundingBox) {
            params.append('minLat', boundingBox.minLat.toString());
            params.append('maxLat', boundingBox.maxLat.toString());
            params.append('minLon', boundingBox.minLon.toString());
            params.append('maxLon', boundingBox.maxLon.toString());
        }

        if (filters.geographicAreaIds) {
            filters.geographicAreaIds.forEach(id => params.append('geographicAreaIds', id));
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

        const endpoint = `${this.BASE_PATH}/participant-homes?${params.toString()}`;
        return ApiClient.get<PaginatedResponse<ParticipantHomeMarker>>(endpoint);
    }

    /**
     * Get detailed popup content for a participant home marker
     */
    static async getParticipantHomePopupContent(venueId: string): Promise<ParticipantHomePopupContent> {
        const endpoint = `${this.BASE_PATH}/participant-homes/${venueId}/popup`;
        return ApiClient.get<ParticipantHomePopupContent>(endpoint);
    }

    /**
     * Get lightweight venue marker data for map rendering with pagination
     */
    static async getVenueMarkers(
        filters: Pick<MapFilters, 'geographicAreaIds'> = {},
        boundingBox?: BoundingBox,
        page: number = 1,
        limit: number = 100
    ): Promise<PaginatedResponse<VenueMarker>> {
        const params = new URLSearchParams();

        // Add pagination parameters
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        // Add bounding box parameters
        if (boundingBox) {
            params.append('minLat', boundingBox.minLat.toString());
            params.append('maxLat', boundingBox.maxLat.toString());
            params.append('minLon', boundingBox.minLon.toString());
            params.append('maxLon', boundingBox.maxLon.toString());
        }

        if (filters.geographicAreaIds) {
            filters.geographicAreaIds.forEach(id => params.append('geographicAreaIds', id));
        }

        const endpoint = `${this.BASE_PATH}/venues?${params.toString()}`;
        return ApiClient.get<PaginatedResponse<VenueMarker>>(endpoint);
    }

    /**
     * Get detailed popup content for a venue marker
     */
    static async getVenuePopupContent(venueId: string): Promise<VenuePopupContent> {
        const endpoint = `${this.BASE_PATH}/venues/${venueId}/popup`;
        return ApiClient.get<VenuePopupContent>(endpoint);
    }
}
