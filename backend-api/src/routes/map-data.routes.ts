import { Router, Response } from 'express';
import { MapDataService } from '../services/map-data.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { parseFilterParameters, ParsedFilterRequest } from '../middleware/filter-parser.middleware';
import {
    MapActivityMarkersQuerySchema,
    MapParticipantHomeMarkersQuerySchema,
    MapVenueMarkersQuerySchema,
} from '../utils/validation.schemas';
import { ActivityStatus } from '../utils/constants';
import { AuthenticatedRequest } from '../types/express.types';

// Extend AuthenticatedRequest to include parsed filter
interface MapDataRequest extends AuthenticatedRequest, ParsedFilterRequest { }

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
            parseFilterParameters,
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
            parseFilterParameters,
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
            parseFilterParameters,
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

    private async getActivityMarkers(req: MapDataRequest, res: Response) {
        try {
            const query = req.query as any;
            const filter = req.parsedFilter || {};

            // Helper function to normalize array parameters
            const normalizeArray = (val: any): string[] | undefined => {
                if (val === undefined || val === null) return undefined;
                if (Array.isArray(val)) {
                    return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
                }
                const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
                return values.length > 0 ? values : undefined;
            };

            // Extract pagination parameters
            const page = query.page ? parseInt(query.page as string, 10) : 1;
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

            // Extract bounding box if provided
            const boundingBox = (query.minLat !== undefined && query.maxLat !== undefined &&
                query.minLon !== undefined && query.maxLon !== undefined) ? {
                minLat: parseFloat(query.minLat as string),
                maxLat: parseFloat(query.maxLat as string),
                minLon: parseFloat(query.minLon as string),
                maxLon: parseFloat(query.maxLon as string),
            } : undefined;

            // Convert query to filters
            // Support both top-level parameters (backward compatibility) and filter[] syntax
            const filters = {
                geographicAreaIds: normalizeArray(filter.geographicAreaIds || query.geographicAreaIds),
                activityCategoryIds: normalizeArray(filter.activityCategoryIds || query.activityCategoryIds),
                activityTypeIds: normalizeArray(filter.activityTypeIds || query.activityTypeIds),
                venueIds: normalizeArray(filter.venueIds || query.venueIds),
                populationIds: normalizeArray(filter.populationIds || query.populationIds),
                roleIds: normalizeArray(filter.roleIds || query.roleIds),
                ageCohorts: normalizeArray(filter.ageCohorts || query.ageCohorts),
                startDate: (filter.startDate || query.startDate) ? new Date(filter.startDate || query.startDate) : undefined,
                endDate: (filter.endDate || query.endDate) ? new Date(filter.endDate || query.endDate) : undefined,
                status: (filter.status || query.status) as ActivityStatus | undefined,
            };

            const result = await this.mapDataService.getActivityMarkers(
                filters,
                req.user!.userId,
                boundingBox,
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

    private async getActivityPopupContent(req: MapDataRequest, res: Response) {
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

    private async getParticipantHomeMarkers(req: MapDataRequest, res: Response) {
        try {
            const query = req.query as any;
            const filter = req.parsedFilter || {};

            // Helper function to normalize array parameters
            const normalizeArray = (val: any): string[] | undefined => {
                if (val === undefined || val === null) return undefined;
                if (Array.isArray(val)) {
                    return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
                }
                const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
                return values.length > 0 ? values : undefined;
            };

            // Extract pagination parameters
            const page = query.page ? parseInt(query.page as string, 10) : 1;
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

            // Extract bounding box if provided
            const boundingBox = (query.minLat !== undefined && query.maxLat !== undefined &&
                query.minLon !== undefined && query.maxLon !== undefined) ? {
                minLat: parseFloat(query.minLat as string),
                maxLat: parseFloat(query.maxLat as string),
                minLon: parseFloat(query.minLon as string),
                maxLon: parseFloat(query.maxLon as string),
            } : undefined;

            // Support both top-level parameters (backward compatibility) and filter[] syntax
            const filters = {
                geographicAreaIds: normalizeArray(filter.geographicAreaIds || query.geographicAreaIds),
                populationIds: normalizeArray(filter.populationIds || query.populationIds),
                roleIds: normalizeArray(filter.roleIds || query.roleIds),
                ageCohorts: normalizeArray(filter.ageCohorts || query.ageCohorts),
                startDate: (filter.startDate || query.startDate) ? new Date(filter.startDate || query.startDate) : undefined,
                endDate: (filter.endDate || query.endDate) ? new Date(filter.endDate || query.endDate) : undefined,
            };

            const result = await this.mapDataService.getParticipantHomeMarkers(
                filters,
                req.user!.userId,
                boundingBox,
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

    private async getParticipantHomePopupContent(req: MapDataRequest, res: Response) {
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

    private async getVenueMarkers(req: MapDataRequest, res: Response) {
        try {
            const query = req.query as any;
            const filter = req.parsedFilter || {};

            // Helper function to normalize array parameters
            const normalizeArray = (val: any): string[] | undefined => {
                if (val === undefined || val === null) return undefined;
                if (Array.isArray(val)) {
                    return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
                }
                const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
                return values.length > 0 ? values : undefined;
            };

            // Extract pagination parameters
            const page = query.page ? parseInt(query.page as string, 10) : 1;
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

            // Extract bounding box if provided
            const boundingBox = (query.minLat !== undefined && query.maxLat !== undefined &&
                query.minLon !== undefined && query.maxLon !== undefined) ? {
                minLat: parseFloat(query.minLat as string),
                maxLat: parseFloat(query.maxLat as string),
                minLon: parseFloat(query.minLon as string),
                maxLon: parseFloat(query.maxLon as string),
            } : undefined;

            // Support both top-level parameters (backward compatibility) and filter[] syntax
            const filters = {
                geographicAreaIds: normalizeArray(filter.geographicAreaIds || query.geographicAreaIds),
                roleIds: normalizeArray(filter.roleIds || query.roleIds), // Accept but will be ignored by service
                ageCohorts: normalizeArray(filter.ageCohorts || query.ageCohorts), // Accept but will be ignored by service
            };

            const result = await this.mapDataService.getVenueMarkers(
                filters,
                req.user!.userId,
                boundingBox,
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

    private async getVenuePopupContent(req: MapDataRequest, res: Response) {
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
