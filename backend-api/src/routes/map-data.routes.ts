import { Router, Response } from 'express';
import { MapDataService } from '../services/map-data.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    MapActivityMarkersQuerySchema,
    MapParticipantHomeMarkersQuerySchema,
    MapVenueMarkersQuerySchema,
} from '../utils/validation.schemas';
import { ActivityStatus } from '../utils/constants';
import { AuthenticatedRequest } from '../types/express.types';

export class MapDataRoutes {
    private router: Router;

    constructor(
        private mapDataService: MapDataService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(
            '/activities',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(MapActivityMarkersQuerySchema),
            this.getActivityMarkers.bind(this)
        );

        this.router.get(
            '/activities/:id/popup',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getActivityPopupContent.bind(this)
        );

        this.router.get(
            '/participant-homes',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(MapParticipantHomeMarkersQuerySchema),
            this.getParticipantHomeMarkers.bind(this)
        );

        this.router.get(
            '/participant-homes/:venueId/popup',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getParticipantHomePopupContent.bind(this)
        );

        this.router.get(
            '/venues',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(MapVenueMarkersQuerySchema),
            this.getVenueMarkers.bind(this)
        );

        this.router.get(
            '/venues/:id/popup',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getVenuePopupContent.bind(this)
        );
    }

    private async getActivityMarkers(req: AuthenticatedRequest, res: Response) {
        try {
            const query = req.query as any;

            // Extract pagination parameters
            const page = query.page ? parseInt(query.page as string, 10) : 1;
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

            // Convert query to filters
            const filters = {
                geographicAreaIds: query.geographicAreaIds,
                activityCategoryIds: query.activityCategoryIds,
                activityTypeIds: query.activityTypeIds,
                venueIds: query.venueIds,
                populationIds: query.populationIds,
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined,
                status: query.status as ActivityStatus | undefined,
            };

            const result = await this.mapDataService.getActivityMarkers(
                filters,
                req.user!.userId,
                page,
                limit
            );

            // Set cache headers
            res.set('Cache-Control', 'public, max-age=60');

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination,
            });
        } catch (error) {
            throw error;
        }
    }

    private async getActivityPopupContent(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;

            const popupContent = await this.mapDataService.getActivityPopupContent(
                id,
                req.user!.userId
            );

            if (!popupContent) {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: 'Activity not found or access denied',
                });
            }

            res.json({
                success: true,
                data: popupContent,
            });
        } catch (error) {
            throw error;
        }
    }

    private async getParticipantHomeMarkers(req: AuthenticatedRequest, res: Response) {
        try {
            const query = req.query as any;

            // Extract pagination parameters
            const page = query.page ? parseInt(query.page as string, 10) : 1;
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

            const filters = {
                geographicAreaIds: query.geographicAreaIds,
                populationIds: query.populationIds,
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined,
            };

            const result = await this.mapDataService.getParticipantHomeMarkers(
                filters,
                req.user!.userId,
                page,
                limit
            );

            // Set cache headers
            res.set('Cache-Control', 'public, max-age=60');

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination,
            });
        } catch (error) {
            throw error;
        }
    }

    private async getParticipantHomePopupContent(req: AuthenticatedRequest, res: Response) {
        try {
            const { venueId } = req.params;

            const popupContent = await this.mapDataService.getParticipantHomePopupContent(
                venueId,
                req.user!.userId
            );

            if (!popupContent) {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: 'Venue not found or access denied',
                });
            }

            res.json({
                success: true,
                data: popupContent,
            });
        } catch (error) {
            throw error;
        }
    }

    private async getVenueMarkers(req: AuthenticatedRequest, res: Response) {
        try {
            const query = req.query as any;

            // Extract pagination parameters
            const page = query.page ? parseInt(query.page as string, 10) : 1;
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

            const filters = {
                geographicAreaIds: query.geographicAreaIds,
            };

            const result = await this.mapDataService.getVenueMarkers(
                filters,
                req.user!.userId,
                page,
                limit
            );

            // Set cache headers
            res.set('Cache-Control', 'public, max-age=60');

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination,
            });
        } catch (error) {
            throw error;
        }
    }

    private async getVenuePopupContent(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;

            const popupContent = await this.mapDataService.getVenuePopupContent(
                id,
                req.user!.userId
            );

            if (!popupContent) {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: 'Venue not found or access denied',
                });
            }

            res.json({
                success: true,
                data: popupContent,
            });
        } catch (error) {
            throw error;
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
