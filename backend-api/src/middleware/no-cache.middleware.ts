import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to prevent caching of API responses.
 * 
 * This middleware adds comprehensive no-cache headers to all API responses
 * to prevent mobile browsers from caching authenticated user data and causing
 * cross-user data leakage.
 * 
 * Critical for security: Ensures users never see stale data from other users
 * after logout and re-login, especially on mobile Safari and Chrome.
 */
export function noCacheMiddleware(_req: Request, res: Response, next: NextFunction): void {
    // Set comprehensive no-cache headers
    // - no-store: Don't store response in any cache
    // - no-cache: Revalidate before using cached response
    // - must-revalidate: Force revalidation when stale
    // - private: Only browser can cache, not shared caches
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // HTTP/1.0 compatibility
    res.setHeader('Pragma', 'no-cache');

    // Expire immediately
    res.setHeader('Expires', '0');

    // CRITICAL: Vary header ensures separate cache entries per auth context
    // Without this, mobile browsers may reuse cached responses across different users
    res.setHeader('Vary', 'Authorization, Cookie');

    // Remove conditional request headers to prevent 304 responses
    // Mobile browsers aggressively revalidate caches using ETag/Last-Modified
    // Removing these forces full 200 responses every time
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');

    next();
}
