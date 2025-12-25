import { Venue } from '../../types';
import { ApiClient } from './api.client';

export class VenueService {
  static async getVenues(): Promise<Venue[]> {
    return ApiClient.get<Venue[]>('/venues');
  }

  static async getVenue(id: string): Promise<Venue> {
    return ApiClient.get<Venue>(`/venues/${id}`);
  }
}
