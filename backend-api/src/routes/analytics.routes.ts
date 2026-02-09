import { Router, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { OptimizedAnalyticsService } from '../services/analytics/optimized-analytics.service';
import { RoleDistributionService } from '../services/analytics/role-distribution.service';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { EngagementQuerySchema, EngagementQueryOptimizedSchema, GrowthQuerySchema, ActivityLifecycleQuerySchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';
import { ErrorCode, HttpStatus, GroupingDimension } from '../utils/constants';
import { PrismaClient } from '@prisma/client';
import { extractAuthorizationContext } from '../utils/auth.utils';
import { parsePaginationParams } from '../utils/query-params.utils';

export class AnalyticsRoutes {
    private router: Router;
    private optimizedAnalyticsService: OptimizedAnalyticsService;
    private roleDistributionService: RoleDistributionService;

    constructor(
        private analyticsService: AnalyticsService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware,
        prisma: PrismaClient
    ) {
        this.router = Router();
        this.optimizedAnalyticsService = new OptimizedAnalyticsService(prisma);
        const geographicAreaRepository = new GeographicAreaRepository(prisma);
        this.roleDistributionService = new RoleDistributionService(prisma, geographicAreaRepository);
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(
            '/engagement',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(EngagementQuerySchema),
            this.getEngagement.bind(this)
        );

        // New optimized endpoint
        this.router.post(
            '/engagement-optimized',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(EngagementQueryOptimizedSchema),
            this.getEngagementOptimized.bind(this)
        );

        // Role distribution endpoint
        this.router.post(
            '/role-distribution',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(EngagementQueryOptimizedSchema),
            this.getRoleDistribution.bind(this)
        );

        this.router.get(
            '/growth',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(GrowthQuerySchema),
            this.getGrowth.bind(this)
        );

        this.router.get(
            '/geographic',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(EngagementQuerySchema),
            this.getGeographic.bind(this)
        );

        this.router.get(
            '/activity-lifecycle',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(ActivityLifecycleQuerySchema),
            this.getActivityLifecycle.bind(this)
        );
    }

    private async getEngagement(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                startDate,
                endDate,
                activityCategoryIds,
                activityTypeIds,
                geographicAreaIds,
                venueIds,
                populationIds,
                groupBy,
                dateGranularity
            } = req.query;

            // Extract authorization context
            const { authorizedAreaIds, hasGeographicRestrictions } = extractAuthorizationContext(req);

            // Validate explicit geographic area access
            if (geographicAreaIds && hasGeographicRestrictions) {
                const areaIdsArray = Array.isArray(geographicAreaIds) ? geographicAreaIds : [geographicAreaIds];
                const allAuthorized = areaIdsArray.every(id => authorizedAreaIds.includes(id as string));
                if (!allAuthorized) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access one or more of the specified geographic areas',
                        details: {},
                    });
                    return;
                }
            }

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                activityCategoryIds: activityCategoryIds as string[] | undefined,
                activityTypeIds: activityTypeIds as string[] | undefined,
                geographicAreaIds: geographicAreaIds as string[] | undefined,
                venueIds: venueIds as string[] | undefined,
                populationIds: populationIds as string[] | undefined,
                groupBy: groupBy as any[] | undefined, // Already normalized by Zod transform
                dateGranularity: dateGranularity as any | undefined,
            };

            const metrics = await this.analyticsService.getEngagementMetrics(
                filters,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            res.status(HttpStatus.OK).json({ success: true, data: metrics });
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
            console.error('Error in getEngagement:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating engagement metrics',
                details: error instanceof Error ? { message: error.message, stack: error.stack } : {},
            });
        }
    }

    private async getEngagementOptimized(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                startDate,
                endDate,
                activityCategoryIds,
                activityTypeIds,
                geographicAreaIds,
                venueIds,
                populationIds,
                groupBy,
            } = req.query;

            // Extract authorization context
            const { authorizedAreaIds, hasGeographicRestrictions } = extractAuthorizationContext(req);

            // Parse pagination parameters (using 'limit' instead of 'pageSize')
            const { pagination, errors: paginationErrors } = parsePaginationParams(req.query);
            if (paginationErrors.length > 0) {
                res.status(400).json({
                    code: ErrorCode.VALIDATION_ERROR,
                    message: 'Invalid pagination parameters',
                    details: { errors: paginationErrors },
                });
                return;
            }

            // Validate explicit geographic area access
            if (geographicAreaIds && hasGeographicRestrictions) {
                const areaIdsArray = Array.isArray(geographicAreaIds) ? geographicAreaIds : [geographicAreaIds];
                const allAuthorized = areaIdsArray.every(id => authorizedAreaIds.includes(id as string));
                if (!allAuthorized) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access one or more of the specified geographic areas',
                        details: {},
                    });
                    return;
                }
            }

            // Parse groupBy parameter to GroupingDimension enum
            const groupByDimensions: any[] = [];
            if (groupBy) {
                const groupByArray = Array.isArray(groupBy) ? groupBy : [groupBy];
                for (const dim of groupByArray) {
                    if (dim === 'type') groupByDimensions.push('activityType');
                    else if (dim === 'category') groupByDimensions.push('activityCategory');
                    else if (dim === 'geographicArea') groupByDimensions.push('geographicArea');
                    else if (dim === 'venue') groupByDimensions.push('venue');
                }
            }

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                activityCategoryIds: activityCategoryIds as string[] | undefined,
                activityTypeIds: activityTypeIds as string[] | undefined,
                geographicAreaIds: geographicAreaIds as string[] | undefined,
                venueIds: venueIds as string[] | undefined,
                populationIds: populationIds as string[] | undefined,
                groupBy: groupByDimensions,
            };

            const wireFormat = await this.optimizedAnalyticsService.getEngagementMetrics(
                filters,
                authorizedAreaIds,
                hasGeographicRestrictions,
                {
                    page: pagination.page || 1,
                    pageSize: pagination.limit || 100
                }
            );

            res.status(HttpStatus.OK).json({ success: true, data: wireFormat });
        } catch (error: any) {
            // Handle specific error codes
            if (error.statusCode) {
                res.status(error.statusCode).json({
                    code: error.code || ErrorCode.INTERNAL_ERROR,
                    message: error.message,
                    details: {},
                });
                return;
            }

            console.error('Error in getEngagementOptimized:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating engagement metrics',
                details: error instanceof Error ? { message: error.message } : {},
            });
        }
    }

    private async getGrowth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                period,
                startDate,
                endDate,
                activityCategoryIds,
                activityTypeIds,
                geographicAreaIds,
                venueIds,
                populationIds,
                groupBy
            } = req.query;

            // Extract authorization context
            const { authorizedAreaIds, hasGeographicRestrictions } = extractAuthorizationContext(req);

            // Validate explicit geographic area access
            if (geographicAreaIds && hasGeographicRestrictions) {
                const areaIdsArray = Array.isArray(geographicAreaIds) ? geographicAreaIds : [geographicAreaIds];
                const allAuthorized = areaIdsArray.every(id => authorizedAreaIds.includes(id as string));
                if (!allAuthorized) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access one or more of the specified geographic areas',
                        details: {},
                    });
                    return;
                }
            }

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                activityCategoryIds: activityCategoryIds as string[] | undefined,
                activityTypeIds: activityTypeIds as string[] | undefined,
                geographicAreaIds: geographicAreaIds as string[] | undefined,
                venueIds: venueIds as string[] | undefined,
                populationIds: populationIds as string[] | undefined,
                groupBy: groupBy as GroupingDimension | undefined,
            };

            const metrics = await this.analyticsService.getGrowthMetrics(
                period as any,
                filters,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            res.status(HttpStatus.OK).json({ success: true, data: metrics });
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
            console.error('Error in getGrowth:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating growth metrics',
                details: {},
            });
        }
    }

    private async getGeographic(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                parentGeographicAreaId,
                startDate,
                endDate,
                activityCategoryIds,
                activityTypeIds,
                venueIds,
                populationIds
            } = req.query;

            // Extract authorization context
            const { authorizedAreaIds, hasGeographicRestrictions } = extractAuthorizationContext(req);

            // Validate explicit parent geographic area access if provided
            if (parentGeographicAreaId && hasGeographicRestrictions) {
                const hasAccess = authorizedAreaIds.includes(parentGeographicAreaId as string);
                if (!hasAccess) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access this geographic area',
                        details: {},
                    });
                    return;
                }
            }

            // Parse pagination parameters (using 'limit' instead of 'pageSize')
            const { pagination, errors: paginationErrors } = parsePaginationParams(req.query);
            if (paginationErrors.length > 0) {
                res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid pagination parameters',
                    details: { errors: paginationErrors },
                });
                return;
            }

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                activityCategoryIds: activityCategoryIds as string[] | undefined,
                activityTypeIds: activityTypeIds as string[] | undefined,
                venueIds: venueIds as string[] | undefined,
                populationIds: populationIds as string[] | undefined,
            };

            const paginationForService = (pagination.page !== undefined || pagination.limit !== undefined)
                ? { page: pagination.page, pageSize: pagination.limit }
                : undefined;

            const result = await this.analyticsService.getGeographicBreakdown(
                parentGeographicAreaId as string | undefined,
                filters,
                authorizedAreaIds,
                hasGeographicRestrictions,
                req.user?.userId,
                paginationForService
            );
            res.status(HttpStatus.OK).json({ success: true, ...result });
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
            if (error instanceof Error && error.message.includes('Invalid pagination')) {
                res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: {},
                });
                return;
            }
            console.error('Error in getGeographic:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating geographic breakdown',
                details: error instanceof Error ? { message: error.message, stack: error.stack } : {},
            });
        }
    }

    private async getActivityLifecycle(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            // Query parameters have been validated and transformed by ValidationMiddleware
            const { startDate, endDate, groupBy, geographicAreaIds, activityCategoryIds, activityTypeIds, venueIds, populationIds } = req.query;

            // Extract authorization info from request
            // Extract authorization context
            const { authorizedAreaIds, hasGeographicRestrictions } = extractAuthorizationContext(req);

            // Validate explicit geographic area access
            if (geographicAreaIds && hasGeographicRestrictions) {
                const requestedAreaIds = geographicAreaIds as string[];
                const hasAccess = requestedAreaIds.every(areaId => authorizedAreaIds.includes(areaId));
                if (!hasAccess) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access one or more of the requested geographic areas',
                        details: {},
                    });
                    return;
                }
            }

            const data = await this.analyticsService.getActivityLifecycleEvents(
                startDate ? new Date(startDate as string) : undefined,
                endDate ? new Date(endDate as string) : undefined,
                groupBy as 'category' | 'type',
                {
                    geographicAreaIds: geographicAreaIds as string[] | undefined,
                    activityCategoryIds: activityCategoryIds as string[] | undefined,
                    activityTypeIds: activityTypeIds as string[] | undefined,
                    venueIds: venueIds as string[] | undefined,
                    populationIds: populationIds as string[] | undefined,
                },
                authorizedAreaIds,
                hasGeographicRestrictions
            );

            res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
            console.error('Error in getActivityLifecycle:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating activity lifecycle events',
                details: error instanceof Error ? { message: error.message, stack: error.stack } : {},
            });
        }
    }

    private async getRoleDistribution(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const {
                startDate,
                endDate,
                activityCategoryIds,
                activityTypeIds,
                geographicAreaIds,
                venueIds,
                populationIds
            } = req.query;

            // Extract authorization context
            const { authorizedAreaIds, hasGeographicRestrictions } = extractAuthorizationContext(req);

            // Validate explicit geographic area access
            if (geographicAreaIds && hasGeographicRestrictions) {
                const areaIdsArray = Array.isArray(geographicAreaIds) ? geographicAreaIds : [geographicAreaIds];
                const allAuthorized = areaIdsArray.every(id => authorizedAreaIds.includes(id as string));
                if (!allAuthorized) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access one or more of the specified geographic areas',
                        details: {},
                    });
                    return;
                }
            }

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                activityCategoryIds: activityCategoryIds as string[] | undefined,
                activityTypeIds: activityTypeIds as string[] | undefined,
                geographicAreaIds: geographicAreaIds as string[] | undefined,
                venueIds: venueIds as string[] | undefined,
                populationIds: populationIds as string[] | undefined,
            };

            const wireFormat = await this.roleDistributionService.getRoleDistribution(
                filters,
                authorizedAreaIds,
                hasGeographicRestrictions
            );

            res.status(HttpStatus.OK).json({ success: true, data: wireFormat });
        } catch (error: any) {
            // Handle specific error codes
            if (error.statusCode) {
                res.status(error.statusCode).json({
                    code: error.code || ErrorCode.INTERNAL_ERROR,
                    message: error.message,
                    details: {},
                });
                return;
            }

            console.error('Error in getRoleDistribution:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating role distribution',
                details: error instanceof Error ? { message: error.message } : {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
