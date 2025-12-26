import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints
 * 5 requests per minute per IP
 */
export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per window
    message: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication requests. Please try again later.',
        details: {},
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Use custom header names to match API contract
    handler: (req, res) => {
        res.status(429).json({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication requests. Please try again later.',
            details: {},
        });
    },
});

/**
 * Rate limiter for mutation endpoints (POST, PUT, DELETE)
 * 100 requests per minute per user
 */
export const mutationRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
    message: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many mutation requests. Please try again later.',
        details: {},
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Key by user ID if authenticated, otherwise by IP
    // Use the default keyGenerator which properly handles IPv6
    skip: (req: any) => {
        // If user is authenticated, use a custom key based on user ID
        if (req.user?.userId) {
            // Store the user ID for the skip function to use
            (req as any).rateLimitKey = `user:${req.user.userId}`;
        }
        return false;
    },
    keyGenerator: (req: any) => {
        // Return custom key if set (for authenticated users)
        // Otherwise, let the default keyGenerator handle IP (with IPv6 support)
        return (req as any).rateLimitKey;
    },
    handler: (req, res) => {
        res.status(429).json({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many mutation requests. Please try again later.',
            details: {},
        });
    },
});

/**
 * Rate limiter for query endpoints (GET)
 * 1000 requests per minute per user
 */
export const queryRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per window
    message: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many query requests. Please try again later.',
        details: {},
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Key by user ID if authenticated, otherwise by IP
    // Use the default keyGenerator which properly handles IPv6
    skip: (req: any) => {
        // If user is authenticated, use a custom key based on user ID
        if (req.user?.userId) {
            // Store the user ID for the skip function to use
            (req as any).rateLimitKey = `user:${req.user.userId}`;
        }
        return false;
    },
    keyGenerator: (req: any) => {
        // Return custom key if set (for authenticated users)
        // Otherwise, let the default keyGenerator handle IP (with IPv6 support)
        return (req as any).rateLimitKey;
    },
    handler: (req, res) => {
        res.status(429).json({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many query requests. Please try again later.',
            details: {},
        });
    },
});

/**
 * Helper to add custom rate limit headers matching API contract
 */
export const addRateLimitHeaders = (req: any, res: any, next: any) => {
    // The rate limit middleware already adds RateLimit-* headers
    // We just need to map them to X-RateLimit-* for backward compatibility
    res.on('finish', () => {
        const limit = res.getHeader('RateLimit-Limit');
        const remaining = res.getHeader('RateLimit-Remaining');
        const reset = res.getHeader('RateLimit-Reset');

        if (limit) res.setHeader('X-RateLimit-Limit', limit);
        if (remaining) res.setHeader('X-RateLimit-Remaining', remaining);
        if (reset) res.setHeader('X-RateLimit-Reset', reset);
    });

    next();
};

/**
 * Smart rate limiter that applies different limits based on HTTP method
 */
export const smartRateLimiter = (req: any, res: any, next: any) => {
    const method = req.method.toUpperCase();

    if (method === 'GET') {
        return queryRateLimiter(req, res, next);
    } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        return mutationRateLimiter(req, res, next);
    } else {
        return next();
    }
};
