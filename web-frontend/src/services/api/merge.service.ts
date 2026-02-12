import type { 
  Participant, 
  Activity, 
  Venue, 
  GeographicArea, 
  ActivityType, 
  Population 
} from '../../types';
import { ApiClient } from './api.client';

/**
 * Request body for merge operations
 */
export interface MergeRequest {
  sourceId: string;
  reconciledFields?: Record<string, any>;
}

/**
 * Successful merge response
 */
export interface MergeResponse<T> {
  success: true;
  destinationEntity: T;
  message: string;
}

/**
 * Error response for merge operations
 */
export interface MergeErrorResponse {
  success: false;
  error: string;
  details?: string;
}

/**
 * Service for merging records across entity types
 */
export class MergeService {
  /**
   * Merge two participant records
   */
  static async mergeParticipants(
    destinationId: string,
    sourceId: string,
    reconciledFields?: Partial<Participant>,
    geographicAreaId?: string | null
  ): Promise<MergeResponse<Participant>> {
    const url = geographicAreaId
      ? `/participants/${destinationId}/merge?geographicAreaId=${encodeURIComponent(geographicAreaId)}`
      : `/participants/${destinationId}/merge`;

    const response = await ApiClient.post<MergeResponse<Participant>>(
      url,
      { sourceId, reconciledFields }
    );
    return response;
  }

  /**
   * Merge two activity records
   */
  static async mergeActivities(
    destinationId: string,
    sourceId: string,
    reconciledFields?: Partial<Activity>,
    geographicAreaId?: string | null
  ): Promise<MergeResponse<Activity>> {
    const url = geographicAreaId
      ? `/activities/${destinationId}/merge?geographicAreaId=${encodeURIComponent(geographicAreaId)}`
      : `/activities/${destinationId}/merge`;

    const response = await ApiClient.post<MergeResponse<Activity>>(
      url,
      { sourceId, reconciledFields }
    );
    return response;
  }

  /**
   * Merge two venue records
   */
  static async mergeVenues(
    destinationId: string,
    sourceId: string,
    reconciledFields?: Partial<Venue>,
    geographicAreaId?: string | null
  ): Promise<MergeResponse<Venue>> {
    const url = geographicAreaId
      ? `/venues/${destinationId}/merge?geographicAreaId=${encodeURIComponent(geographicAreaId)}`
      : `/venues/${destinationId}/merge`;

    const response = await ApiClient.post<MergeResponse<Venue>>(
      url,
      { sourceId, reconciledFields }
    );
    return response;
  }

  /**
   * Merge two geographic area records
   */
  static async mergeGeographicAreas(
    destinationId: string,
    sourceId: string,
    reconciledFields?: Partial<GeographicArea>,
    geographicAreaId?: string | null
  ): Promise<MergeResponse<GeographicArea>> {
    const url = geographicAreaId
      ? `/geographic-areas/${destinationId}/merge?geographicAreaId=${encodeURIComponent(geographicAreaId)}`
      : `/geographic-areas/${destinationId}/merge`;

    const response = await ApiClient.post<MergeResponse<GeographicArea>>(
      url,
      { sourceId, reconciledFields }
    );
    return response;
  }

  /**
   * Merge two activity type records
   */
  static async mergeActivityTypes(
    destinationId: string,
    sourceId: string
  ): Promise<MergeResponse<ActivityType>> {
    const response = await ApiClient.post<MergeResponse<ActivityType>>(
      `/activity-types/${destinationId}/merge`,
      { sourceId }
    );
    return response;
  }

  /**
   * Merge two population records
   */
  static async mergePopulations(
    destinationId: string,
    sourceId: string
  ): Promise<MergeResponse<Population>> {
    const response = await ApiClient.post<MergeResponse<Population>>(
      `/populations/${destinationId}/merge`,
      { sourceId }
    );
    return response;
  }
}
