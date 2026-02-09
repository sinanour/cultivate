import type { AuthenticatedRequest } from '../types/express.types';

/**
 * Authorization context extracted from authenticated request
 */
export interface AuthorizationContext {
    authorizedAreaIds: string[];
    hasGeographicRestrictions: boolean;
    userId: string;
    userRole: string;
}

/**
 * Extract authorization context from authenticated request
 * @param req - Authenticated Express request
 * @returns Authorization context with safe defaults
 * 
 * @example
 * const context = extractAuthorizationContext(req);
 * // Returns { authorizedAreaIds: [...], hasGeographicRestrictions: true, userId: '...', userRole: 'EDITOR' }
 */
export function extractAuthorizationContext(
    req: AuthenticatedRequest
): AuthorizationContext {
    return {
        authorizedAreaIds: req.user?.authorizedAreaIds || [],
        hasGeographicRestrictions: req.user?.hasGeographicRestrictions || false,
        userId: req.user?.userId || '',
        userRole: req.user?.role || '',
    };
}
