/**
 * URL Parameter Utilities
 * 
 * Provides validation and manipulation functions for URL search parameters
 * to ensure robust handling across analytics dashboards.
 */

/**
 * Validates UUID v4 format
 */
export function isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Validates ISO date format (YYYY-MM-DD)
 */
export function isValidDateString(value: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;

    const date = new Date(value);
    return !isNaN(date.getTime());
}

/**
 * Validates relative period format (-90d, -6m, -1y)
 */
export function isValidRelativePeriod(value: string): boolean {
    return /^-\d+[dwmy]$/.test(value);
}

/**
 * Safely sets multi-value parameter by deleting first then appending
 * This prevents duplicate parameters from accumulating
 */
export function setMultiValueParam(
    params: URLSearchParams,
    key: string,
    values: string[]
): void {
    params.delete(key); // Clear existing
    values.forEach(value => params.append(key, value));
}

/**
 * Extracts and validates multi-value UUID parameters
 */
export function getValidatedUUIDs(
    searchParams: URLSearchParams,
    key: string
): string[] {
    return searchParams.getAll(key).filter(isValidUUID);
}
