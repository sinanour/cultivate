import type { GeographicArea, GeographicAreaStatistics } from '../../types';
import { ApiClient } from './api.client';

interface CreateGeographicAreaData {
  name: string;
  areaType: string;
  parentGeographicAreaId?: string;
}

interface UpdateGeographicAreaData extends Partial<CreateGeographicAreaData> {
  version?: number;
}

export class GeographicAreaService {
  static async getGeographicAreas(page?: number, limit?: number, geographicAreaId?: string | null): Promise<GeographicArea[]> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (geographicAreaId) params.append('geographicAreaId', geographicAreaId);
    const query = params.toString();
    return ApiClient.get<GeographicArea[]>(`/geographic-areas${query ? `?${query}` : ''}`);
  }

  static async getGeographicArea(id: string): Promise<GeographicArea> {
    return ApiClient.get<GeographicArea>(`/geographic-areas/${id}`);
  }

  static async getGeographicAreaById(id: string): Promise<GeographicArea> {
    return this.getGeographicArea(id);
  }

  static async createGeographicArea(data: CreateGeographicAreaData): Promise<GeographicArea> {
    return ApiClient.post<GeographicArea>('/geographic-areas', data);
  }

  static async updateGeographicArea(id: string, data: UpdateGeographicAreaData): Promise<GeographicArea> {
    return ApiClient.put<GeographicArea>(`/geographic-areas/${id}`, data);
  }

  static async deleteGeographicArea(id: string): Promise<void> {
    return ApiClient.delete<void>(`/geographic-areas/${id}`);
  }

  static async getChildren(id: string): Promise<GeographicArea[]> {
    return ApiClient.get<GeographicArea[]>(`/geographic-areas/${id}/children`);
  }

  static async getAncestors(id: string): Promise<GeographicArea[]> {
    return ApiClient.get<GeographicArea[]>(`/geographic-areas/${id}/ancestors`);
  }

  static async getVenues(id: string): Promise<any[]> {
    return ApiClient.get<any[]>(`/geographic-areas/${id}/venues`);
  }

  static async getStatistics(id: string): Promise<GeographicAreaStatistics> {
    return ApiClient.get<GeographicAreaStatistics>(`/geographic-areas/${id}/statistics`);
  }
}
