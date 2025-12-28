import { Router, Response } from 'express';
import { AnalyticsService, TimePeriod } from '../services/analytics.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { EngagementQuerySchema, GrowthQuerySchema } from '../utils/validation.schemas';
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
    }

    private async getEngagement(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { startDate, endDate, geographicAreaId, activityTypeId, venueId, groupBy, dateGranularity } = req.query;

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                geographicAreaId: geographicAreaId as string | undefined,
                activityTypeId: activityTypeId as string | undefined,
                venueId: venueId as string | undefined,
                groupBy: groupBy ? (Array.isArray(groupBy) ? groupBy : [groupBy]) as any[] : undefined,
                dateGranularity: dateGranularity as any | undefined,
            };

            const metrics = await this.analyticsService.getEngagementMetrics(filters);
            res.status(HttpStatus.OK).json({ success: true, data: metrics });
        } catch (error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_ERROR,
                message: 'An error occurred while calculating engagement metrics',
                details: {},
            });
        }
    }

    private async getGrowth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { period, startDate, endDate, geographicAreaId } = req.query;

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                geographicAreaId: geographicAreaId as string | undefined,
            };

            const metrics = await this.analyticsService.getGrowthMetrics(
                period as TimePeriod,
                filters
            );
            res.status(HttpStatus.OK).json({ success: true, data: metrics });
        } catch (error) {
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

    getRouter(): Router {
        return this.router;
    }
}
