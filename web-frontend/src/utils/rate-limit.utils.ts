import type { APIError } from '../types';

export interface RateLimitInfo {
    limit?: number;
    remaining?: number;
    resetTimestamp?: number;
    retryAfterSeconds?: number;
    errorMessage: string;
}

/**
 * Checks if an error is a rate limit error (429 with RATE_LIMIT_EXCEEDED code)
 */
export function isRateLimitError(error: any): boolean {
    return (
        error?.response?.status === 429 ||
        error?.status === 429 ||
        error?.response?.data?.code === 'RATE_LIMIT_EXCEEDED' ||
        error?.code === 'RATE_LIMIT_EXCEEDED'
    );
}

/**
 * Extracts rate limit information from error response and headers
 */
export function extractRateLimitInfo(error: any): RateLimitInfo | null {
    if (!isRateLimitError(error)) {
        return null;
    }

    const headers = error?.response?.headers || {};
    const errorData: APIError = error?.response?.data || error;

    const limit = headers['x-ratelimit-limit'] ? parseInt(headers['x-ratelimit-limit'], 10) : undefined;
    const remaining = headers['x-ratelimit-remaining']
        ? parseInt(headers['x-ratelimit-remaining'], 10)
        : undefined;
    const resetTimestamp = headers['x-ratelimit-reset']
        ? parseInt(headers['x-ratelimit-reset'], 10)
        : undefined;

    const retryAfterSeconds = resetTimestamp
        ? Math.max(0, resetTimestamp - Math.floor(Date.now() / 1000))
        : 60; // Default to 60 seconds if not provided

    return {
        limit,
        remaining,
        resetTimestamp,
        retryAfterSeconds,
        errorMessage: errorData.message || 'Rate limit exceeded. Please try again later.',
    };
}

/**
 * Formats retry-after time as human-readable string
 */
export function formatRetryAfter(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Calculates time remaining until rate limit reset
 */
export function getTimeUntilReset(resetTimestamp: number): number {
    return Math.max(0, resetTimestamp - Math.floor(Date.now() / 1000));
}
