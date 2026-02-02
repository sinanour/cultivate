import { Request, Response, NextFunction } from 'express';
import { PIIRedactionService } from '../services/pii-redaction.service';
import { UserRole } from '@prisma/client';

/**
 * Middleware that intercepts API responses and applies PII redaction
 * based on the authenticated user's role.
 */
export class PIIRedactionMiddleware {
    constructor(private piiRedactionService: PIIRedactionService) { }

    /**
     * Express middleware function that wraps res.json to apply PII redaction
     */
    intercept() {
        return (req: Request, res: Response, next: NextFunction) => {
            // Store original json method
            const originalJson = res.json.bind(res);

            // Store reference to service for use in closure
            const redactionService = this.piiRedactionService;

            // Override res.json to apply redaction
            res.json = function (data: any): Response {
                // Extract user role from request (set by auth middleware)
                const userRole = (req as any).user?.role as UserRole | undefined;

                // Apply redaction if user has PII_RESTRICTED role
                if (userRole === UserRole.PII_RESTRICTED) {
                    const redactedData = redactionService.redactResponse(data, userRole);
                    return originalJson(redactedData);
                }

                // No redaction for other roles
                return originalJson(data);
            };

            next();
        };
    }
}
