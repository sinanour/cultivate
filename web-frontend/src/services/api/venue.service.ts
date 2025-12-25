import type { Venue } from '../../types';
import { ApiClient } from './api.client';

interface CreateVenueData {
    name: string;
    address: string;
    geographicAreaId: string;
    latitude?: number;
    longitude?: number;
    venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
}

interface UpdateVenueData extends CreateVenueData { }

export class VenueService {
  static async getVenues(): Promise<Venue[]> {
    return ApiClient.get<Venue[]>('/venues');
  }

  static async getVenue(id: string): Promise<Venue> {
    return ApiClient.get<Venue>(`/venues/${id}`);
  }

    static async searchVenues(query: string): Promise<Venue[]> {
        return ApiClient.get<Venue[]>(`/venues/search?q=${encodeURIComponent(query)}`);
    }

    static async createVenue(data: CreateVenueData): Promise<Venue> {
        return ApiClient.post<Venue>('/venues', data);
    }

    static async updateVenue(id: string, data: UpdateVenueData): Promise<Venue> {
        return ApiClient.put<Venue>(`/venues/${id}`, data);
    }

    static async deleteVenue(id: string): Promise<void> {
        return ApiClient.delete<void>(`/venues/${id}`);
    }

    static async getVenueActivities(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/venues/${id}/activities`);
    }

    static async getVenueParticipants(id: string): Promise<any[]> {
        return ApiClient.get<any[]>(`/venues/${id}/participants`);
    }
}
