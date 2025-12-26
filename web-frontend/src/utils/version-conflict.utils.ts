import type { APIError } from '../types';

export interface VersionConflictInfo {
    entityType: string;
    entityId: string;
    clientVersion: number;
    serverVersion?: number;
    errorMessage: string;
}

/**
 * Checks if an error is a version conflict (409 with VERSION_CONFLICT code)
 */
export function isVersionConflict(error: any): boolean {
    return (
        error?.response?.status === 409 &&
        (error?.response?.data?.code === 'VERSION_CONFLICT' || error?.code === 'VERSION_CONFLICT')
    );
}

/**
 * Extracts version conflict information from an error response
 */
export function extractVersionConflictInfo(error: any): VersionConflictInfo | null {
    if (!isVersionConflict(error)) {
        return null;
    }

    const errorData: APIError = error?.response?.data || error;

    return {
        entityType: errorData.details?.entityType || 'Unknown',
        entityId: errorData.details?.entityId || 'Unknown',
        clientVersion: errorData.details?.clientVersion || 0,
        serverVersion: errorData.details?.serverVersion,
        errorMessage: errorData.message || 'Version conflict occurred',
    };
}

/**
 * Gets the current version from an entity
 */
export function getEntityVersion(entity: any): number {
    return entity?.version || 1;
}
