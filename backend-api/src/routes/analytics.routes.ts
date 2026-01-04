import { Router, Response } from 'express';
import { AnalyticsService, TimePeriod, GroupingDimension } from '../services/analytics.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { EngagementQuerySchema, GrowthQuerySchema, ActivityLifecycleQuerySchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';
import { ErrorCode, HttpStatus } from '../utils/constants';

export class AnalyticsRoutes {
    private router: Router;

    constructor(
        private analyticsService: AnalyticsService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
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
            const { startDate, endDate, geographicAreaId, activityCategoryId, activityTypeId, venueId, populationIds, groupBy, dateGranularity } = req.query;

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                geographicAreaId: geographicAreaId as string | undefined,
                activityCategoryId: activityCategoryId as string | undefined,
                activityTypeId: activityTypeId as string | undefined,
                venueId: venueId as string | undefined,
                populationIds: populationIds as string[] | undefined,
                groupBy: groupBy as any[] | undefined, // Already normalized by Zod transform
                dateGranularity: dateGranularity as any | undefined,
            };

            const metrics = await this.analyticsService.getEngagementMetrics(filters);
            res.status(HttpStatus.OK).json({ success: true, data: metrics });
        } catch (error) {
            console.error('Error in getEngagement:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating engagement metrics',
                details: error instanceof Error ? { message: error.message, stack: error.stack } : {},
            });
        }
    }

    private async getGrowth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { period, startDate, endDate, geographicAreaId, populationIds, groupBy } = req.query;

            // Parse groupBy parameter
            let groupByDimensions: GroupingDimension[] | undefined;
            if (groupBy === 'type') {
                groupByDimensions = [GroupingDimension.ACTIVITY_TYPE];
            } else if (groupBy === 'category') {
                groupByDimensions = [GroupingDimension.ACTIVITY_CATEGORY];
            }

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                geographicAreaId: geographicAreaId as string | undefined,
                populationIds: populationIds as string[] | undefined,
                groupBy: groupByDimensions,
            };

            const metrics = await this.analyticsService.getGrowthMetrics(
                period as TimePeriod,
                filters
            );
            res.status(HttpStatus.OK).json({ success: true, data: metrics });
        } catch (error) {
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
            const { startDate, endDate } = req.query;

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
            };

            const breakdown = await this.analyticsService.getGeographicBreakdown(filters);
            res.status(HttpStatus.OK).json({ success: true, data: breakdown });
        } catch (error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating geographic breakdown',
                details: {},
            });
        }
    }

    private async getActivityLifecycle(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            // Query parameters have been validated and transformed by ValidationMiddleware
            const { startDate, endDate, groupBy, geographicAreaIds, activityCategoryIds, activityTypeIds, venueIds, populationIds } = req.query;

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
                }
            );

            res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error) {
            console.error('Error in getActivityLifecycle:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating activity lifecycle events',
                details: error instanceof Error ? { message: error.message, stack: error.stack } : {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
