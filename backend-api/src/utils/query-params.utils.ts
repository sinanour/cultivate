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
