/**
 * Types for record merge operations
 */

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
 * Base interface for merge services
 */
export interface MergeService<T> {
  /**
   * Merge source record into destination record
   * @param sourceId - ID of record to merge from (will be deleted)
   * @param destinationId - ID of record to merge into (will be updated)
   * @param reconciledFields - Optional field updates for destination
   * @returns Updated destination record
   * @throws Error if merge fails
   */
  merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<T>
  ): Promise<T>;
}

/**
 * Entity types that support merging
 */
export type MergeableEntityType =
  | 'participant'
  | 'activity'
  | 'venue'
  | 'geographicArea'
  | 'activityType'
  | 'population';

/**
 * Complex entities requiring field reconciliation
 */
export type ComplexEntityType = 'participant' | 'activity' | 'venue' | 'geographicArea';

/**
 * Simple entities without field reconciliation
 */
export type SimpleEntityType = 'activityType' | 'population';
