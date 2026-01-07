import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuthenticatedRequest } from '../types/express.types';

export class AuditLoggingMiddleware {
    constructor(private auditLogRepository: AuditLogRepository) { }

    logEntityModification(entityType: string) {
        const repo = this.auditLogRepository;
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const originalSend = res.send.bind(res);

            res.send = ((data: any): Response => {
                res.send = originalSend;

                if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
                    const actionType = `${req.method}_${entityType}`;
                    const entityId = req.params.id || 'batch';

                    void (async () => {
                        try {
                            await repo.create({
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

                return originalSend(data);
            }) as any;

            next();
        };
    }

    logAuthenticationEvent(eventType: 'LOGIN' | 'LOGOUT' | 'REFRESH') {
        const repo = this.auditLogRepository;
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const originalSend = res.send.bind(res);

            res.send = ((data: any): Response => {
                res.send = originalSend;

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    void (async () => {
                        try {
                            let userId: string | undefined;

                            // For LOGIN, extract userId from response body after successful authentication
                            if (eventType === 'LOGIN') {
                                try {
                                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                                    userId = responseData?.data?.user?.id;
                                } catch (parseError) {
                                    console.warn('Failed to parse login response for audit logging:', parseError);
                                }
                            } else if (eventType === 'REFRESH') {
                                // For REFRESH, extract userId from refresh token in request body
                                try {
                                    const { refreshToken } = req.body;
                                    if (refreshToken) {
                                        // Decode without verification (just to get userId for logging)
                                        const decoded = jwt.decode(refreshToken) as any;
                                        userId = decoded?.userId;
                                    }
                                } catch (decodeError) {
                                    console.warn('Failed to decode refresh token for audit logging:', decodeError);
                                }
                            } else {
                                // For LOGOUT, user is already authenticated
                                userId = req.user?.userId;
                            }

                            // Only create audit log if we have a valid userId
                            if (userId) {
                                await repo.create({
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
                            } else {
                                console.warn(`Unable to determine userId for ${eventType} audit log`);
                            }
                        } catch (error) {
                            console.error('Failed to create audit log:', error);
                        }
                    })();
                }

                return originalSend(data);
            }) as any;

            next();
        };
    }

    logRoleChange() {
        const repo = this.auditLogRepository;
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const originalSend = res.send.bind(res);

            res.send = ((data: any): Response => {
                res.send = originalSend;

                if (res.statusCode >= 200 && res.statusCode < 300 && req.user && req.body.role) {
                    void (async () => {
                        try {
                            await repo.create({
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

                return originalSend(data);
            }) as any;

            next();
        };
    }
}
