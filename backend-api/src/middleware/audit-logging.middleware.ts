import { Response, NextFunction } from 'express';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuthenticatedRequest } from '../types/express.types';

export class AuditLoggingMiddleware {
    constructor(private auditLogRepository: AuditLogRepository) { }

    /**
     * Middleware to log entity modifications (create, update, delete)
     */
    logEntityModification(entityType: string) {
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            // Store original send function
            const originalSend = res.send;

            // Override send to capture response
            res.send = function (data: any): Response {
                // Restore original send
                res.send = originalSend;

                // Log if operation was successful
                if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
                    const actionType = `${req.method}_${entityType}`;
                    const entityId = req.params.id || 'batch';

                    // Don't await - log asynchronously
                    void (async () => {
                        try {
                            await this.auditLogRepository.create({
                                userId: req.user!.userId,
                                actionType,
                                entityType,
                                entityId,
                                details: {
                                    method: req.method,
                                    path: req.path,
                                    body: req.body,
                                    params: req.params,
                                },
                            });
                        } catch (error) {
                            console.error('Failed to create audit log:', error);
                        }
                    })();
                }

                return originalSend.call(res, data);
            }.bind(this);

            next();
        };
    }

    /**
     * Middleware to log authentication events
     */
    logAuthenticationEvent(eventType: 'LOGIN' | 'LOGOUT' | 'REFRESH') {
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const originalSend = res.send;

            res.send = function (data: any): Response {
                res.send = originalSend;

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const userId = req.user?.userId || req.body.email || 'unknown';

                    void (async () => {
                        try {
                            await this.auditLogRepository.create({
                                userId,
                                actionType: eventType,
                                entityType: 'AUTH',
                                entityId: userId,
                                details: {
                                    eventType,
                                    timestamp: new Date(),
                                    ip: req.ip,
                                },
                            });
                        } catch (error) {
                            console.error('Failed to create audit log:', error);
                        }
                    })();
                }

                return originalSend.call(res, data);
            }.bind(this);

            next();
        };
    }

    /**
     * Middleware to log role changes
     */
    logRoleChange() {
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const originalSend = res.send;

            res.send = function (data: any): Response {
                res.send = originalSend;

                if (res.statusCode >= 200 && res.statusCode < 300 && req.user && req.body.role) {
                    void (async () => {
                        try {
                            await this.auditLogRepository.create({
                                userId: req.user!.userId,
                                actionType: 'ROLE_CHANGE',
                                entityType: 'USER',
                                entityId: req.params.id || req.user!.userId,
                                details: {
                                    oldRole: req.body.oldRole,
                                    newRole: req.body.role,
                                    changedBy: req.user!.userId,
                                },
                            });
                        } catch (error) {
                            console.error('Failed to create audit log:', error);
                        }
                    })();
                }

                return originalSend.call(res, data);
            }.bind(this);

            next();
        };
    }
}
