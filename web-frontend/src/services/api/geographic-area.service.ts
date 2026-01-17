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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FlexibleGeographicAreaQuery {
  page?: number;
  limit?: number;
  geographicAreaId?: string | null;
  depth?: number;
  filter?: Record<string, any>;
  fields?: string[];
}

export class GeographicAreaService {
  /**
   * Get geographic areas with flexible filtering and customizable attribute selection
   */
  static async getGeographicAreasFlexible(options: FlexibleGeographicAreaQuery): Promise<PaginatedResponse<GeographicArea>> {
    const params = new URLSearchParams();

    // Add pagination params
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());

    // Add geographicAreaId as first-class parameter (not in filter[])
    if (options.geographicAreaId) params.append('geographicAreaId', options.geographicAreaId);

    // Add depth parameter (geographic areas only)
    if (options.depth !== undefined) params.append('depth', options.depth.toString());

    // Add flexible filter params using filter[fieldName]=value syntax
    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(`filter[${key}]`, value.join(','));
          } else {
            params.append(`filter[${key}]`, value.toString());
          }
        }
      }
    }

    // Add fields param
    if (options.fields && options.fields.length > 0) {
      params.append('fields', options.fields.join(','));
    }

    const query = params.toString();
    return ApiClient.get<PaginatedResponse<GeographicArea>>(`/geographic-areas${query ? `?${query}` : ''}`);
  }

  static async getGeographicAreas(page?: number, limit?: number, geographicAreaId?: string | null, depth?: number): Promise<PaginatedResponse<GeographicArea>> {
    // Delegate to flexible method for backward compatibility
    return this.getGeographicAreasFlexible({ page, limit, geographicAreaId, depth });
  }

  static async getChildrenPaginated(parentId: string, page: number = 1, limit: number = 100): Promise<PaginatedResponse<GeographicArea>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    const query = params.toString();
    return ApiClient.get<PaginatedResponse<GeographicArea>>(`/geographic-areas/${parentId}/children${query ? `?${query}` : ''}`);
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

  /**
   * Fetches ancestors for a single geographic area.
   * Uses the batch endpoint internally for consistency and performance.
   * 
   * @param id - Geographic area ID
   * @returns Array of ancestor GeographicArea objects ordered from closest to most distant
   */
  static async getAncestors(id: string): Promise<GeographicArea[]> {
    // Use batch endpoint with single-element array
    const parentMap = await this.getBatchAncestors([id]);

    // Traverse parent map to build ancestor chain
    const ancestorIds: string[] = [];
    let currentId = parentMap[id];

    while (currentId) {
      ancestorIds.push(currentId);
      currentId = parentMap[currentId] || null;
    }

    // Fetch full details for all ancestors
    if (ancestorIds.length === 0) {
      return [];
    }

    const detailsMap = await this.getBatchDetails(ancestorIds);

    // Return ancestors in order (closest to most distant)
    return ancestorIds.map(ancestorId => detailsMap[ancestorId]).filter(Boolean);
  }

  /**
   * Fetches batch ancestors for multiple geographic areas.
   * Returns a simplified parent map where each area ID maps to its parent ID.
   * Clients can traverse the hierarchy by following parent IDs.
   * 
   * @param areaIds - Array of geographic area IDs (max 100)
   * @returns Map of area ID to parent ID (e.g., { "area-1": "parent-1", "parent-1": null })
   */
  static async getBatchAncestors(areaIds: string[]): Promise<Record<string, string | null>> {
    return ApiClient.post<Record<string, string | null>>('/geographic-areas/batch-ancestors', { areaIds });
  }

  /**
   * Fetches complete entity details for multiple geographic areas in a single request.
   * Complements getBatchAncestors by providing full geographic area objects after ancestor IDs are obtained.
   * 
   * @param areaIds - Array of geographic area IDs (max 100)
   * @returns Map of area ID to complete geographic area object with childCount
   */
  static async getBatchDetails(areaIds: string[]): Promise<Record<string, GeographicArea>> {
    return ApiClient.post<Record<string, GeographicArea>>('/geographic-areas/batch-details', { areaIds });
  }

  static async getVenues(id: string): Promise<any[]> {
    return ApiClient.get<any[]>(`/geographic-areas/${id}/venues`);
  }

  static async getStatistics(id: string): Promise<GeographicAreaStatistics> {
    return ApiClient.get<GeographicAreaStatistics>(`/geographic-areas/${id}/statistics`);
  }

  static async exportGeographicAreas(): Promise<void> {
    const response = await fetch(`${ApiClient.getBaseURL()}/geographic-areas/export`, {
      method: 'GET',
      headers: ApiClient.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to export geographic areas');
    }

    const blob = await response.blob();
    const { downloadBlob } = await import('../../utils/csv.utils');
    const filename = `geographic-areas-${new Date().toISOString().split('T')[0]}.csv`;
    downloadBlob(blob, filename);
  }

  static async importGeographicAreas(file: File): Promise<import('../../types/csv.types').ImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${ApiClient.getBaseURL()}/geographic-areas/import`, {
      method: 'POST',
      headers: {
        ...ApiClient.getAuthHeaders(),
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import geographic areas');
    }

    const result = await response.json();
    return result.data;
  }
}
