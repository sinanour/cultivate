/**
 * Normalizes a query parameter that should be an array.
 * Handles single values, multiple values, and comma-separated values.
 * 
 * @param param - The query parameter value (string, string[], or undefined)
 * @returns Array of strings, or undefined if param is undefined
 * 
 * @example
 * normalizeArrayParam(undefined) // → undefined
 * normalizeArrayParam('abc123') // → ['abc123']
 * normalizeArrayParam(['abc123', 'def456']) // → ['abc123', 'def456']
 * normalizeArrayParam('abc123,def456') // → ['abc123', 'def456']
 * normalizeArrayParam(['abc123', 'def456,ghi789']) // → ['abc123', 'def456', 'ghi789']
 */
export function normalizeArrayParam(param: string | string[] | undefined): string[] | undefined {
    if (param === undefined || param === null) {
        return undefined;
    }

    if (Array.isArray(param)) {
        // Already an array - flatten any comma-separated values
        const flattened = param.flatMap(p => p.split(',').map(s => s.trim())).filter(s => s.length > 0);
        return flattened.length > 0 ? flattened : undefined;
    }

    // Single string - check if it's comma-separated
    const values = param.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return values.length > 0 ? values : undefined;
}

/**
 * Parse a query parameter as an integer
 * @param value - Query parameter value
 * @param paramName - Parameter name for error messages
 * @returns Parsed integer or error
 * 
 * @example
 * parseIntegerParam('42', 'page') // → { value: 42 }
 * parseIntegerParam('abc', 'page') // → { error: 'page must be a valid integer' }
 * parseIntegerParam(undefined, 'page') // → { value: undefined }
 */
export function parseIntegerParam(
    value: any,
    paramName: string
): { value?: number; error?: string } {
    if (value === undefined || value === null) {
        return { value: undefined };
    }

    const parsed = parseInt(value as string, 10);
    if (isNaN(parsed)) {
        return { error: `${paramName} must be a valid integer` };
    }

    return { value: parsed };
}

import { QUERY_PARAMS, PAGINATION } from './constants';

// Re-export QUERY_PARAMS for convenience
export { QUERY_PARAMS };

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
}

/**
 * Pagination parse result with validation errors
 */
export interface PaginationParseResult {
    pagination: PaginationParams;
    errors: string[];
}

/**
 * Parse pagination parameters from query string
 * @param query - Express request query object
 * @returns Parsed pagination with validation errors
 * 
 * @example
 * parsePaginationParams({ page: '1', limit: '50' }) // → { pagination: { page: 1, limit: 50 }, errors: [] }
 * parsePaginationParams({ page: 'abc' }) // → { pagination: {}, errors: ['page must be a valid integer'] }
 * parsePaginationParams({ page: '0' }) // → { pagination: {}, errors: ['Page must be >= 1'] }
 */
export function parsePaginationParams(
    query: Record<string, any>
): PaginationParseResult {
    const errors: string[] = [];
    const pagination: PaginationParams = {};

    // Parse page
    if (query[QUERY_PARAMS.PAGE] !== undefined) {
        const page = parseIntegerParam(query[QUERY_PARAMS.PAGE], 'page');
        if (page.error) {
            errors.push(page.error);
        } else if (page.value !== undefined) {
            if (page.value < 1) {
                errors.push('Page must be >= 1');
            } else {
                pagination.page = page.value;
            }
        }
    }

    // Parse limit
    if (query[QUERY_PARAMS.LIMIT] !== undefined) {
        const limit = parseIntegerParam(query[QUERY_PARAMS.LIMIT], 'limit');
        if (limit.error) {
            errors.push(limit.error);
        } else if (limit.value !== undefined) {
            if (limit.value < 1) {
                errors.push('Limit must be >= 1');
            } else if (limit.value > PAGINATION.MAX_LIMIT) {
                errors.push(`Limit must be <= ${PAGINATION.MAX_LIMIT}`);
            } else {
                pagination.limit = limit.value;
            }
        }
    }

    return { pagination, errors };
}
