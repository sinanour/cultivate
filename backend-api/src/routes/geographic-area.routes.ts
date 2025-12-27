import { Router, Response } from 'express';
import { GeographicAreaService } from '../services/geographic-area.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    GeographicAreaCreateSchema,
    GeographicAreaUpdateSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class GeographicAreaRoutes {
    private router: Router;

    constructor(
        private geographicAreaService: GeographicAreaService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getAll.bind(this)
        );

        this.router.get(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getById.bind(this)
        );

        this.router.get(
            '/:id/children',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getChildren.bind(this)
        );

        this.router.get(
            '/:id/ancestors',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getAncestors.bind(this)
        );

        this.router.get(
            '/:id/venues',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getVenues.bind(this)
        );

        this.router.get(
            '/:id/statistics',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getStatistics.bind(this)
        );

        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(GeographicAreaCreateSchema),
            this.create.bind(this)
        );

        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(GeographicAreaUpdateSchema),
            this.update.bind(this)
        );

        this.router.delete(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.delete.bind(this)
        );
    }

    private async getAll(req: AuthenticatedRequest, res: Response) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const geographicAreaId = req.query.geographicAreaId as string | undefined;

            if (page !== undefined || limit !== undefined) {
                const result = await this.geographicAreaService.getAllGeographicAreasPaginated(page, limit, geographicAreaId);
                res.status(200).json({ success: true, ...result });
            } else {
                const areas = await this.geographicAreaService.getAllGeographicAreas(geographicAreaId);
                res.status(200).json({ success: true, data: areas });
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('Page')) {
                res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: {},
                });
                return;
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching geographic areas',
                details: {},
            });
        }
    }

    private async getById(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const area = await this.geographicAreaService.getGeographicAreaById(id);
            res.status(200).json({ success: true, data: area });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching geographic area',
                details: {},
            });
        }
    }

    private async getChildren(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const children = await this.geographicAreaService.getChildren(id);
            res.status(200).json({ success: true, data: children });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching children',
                details: {},
            });
        }
    }

    private async getAncestors(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const ancestors = await this.geographicAreaService.getAncestors(id);
            res.status(200).json({ success: true, data: ancestors });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching ancestors',
                details: {},
            });
        }
    }

    private async getVenues(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const venues = await this.geographicAreaService.getVenues(id);
            res.status(200).json({ success: true, data: venues });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching venues',
                details: {},
            });
        }
    }

    private async getStatistics(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const statistics = await this.geographicAreaService.getStatistics(id);
            res.status(200).json({ success: true, data: statistics });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while calculating statistics',
                details: {},
            });
        }
    }

    private async create(req: AuthenticatedRequest, res: Response) {
        try {
            const area = await this.geographicAreaService.createGeographicArea(req.body);
            res.status(201).json({ success: true, data: area });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('required')) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('not found')) {
                    return res.status(400).json({
                        code: 'INVALID_REFERENCE',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while creating geographic area',
                details: {},
            });
        }
    }

    private async update(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const area = await this.geographicAreaService.updateGeographicArea(id, req.body);
            res.status(200).json({ success: true, data: area });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Geographic area not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message === 'VERSION_CONFLICT') {
                    return res.status(409).json({
                        code: 'VERSION_CONFLICT',
                        message: 'The geographic area has been modified by another user. Please refresh and try again.',
                        details: {},
                    });
                }
                if (error.message.includes('circular') || error.message.includes('own parent')) {
                    return res.status(400).json({
                        code: 'CIRCULAR_REFERENCE',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('not found')) {
                    return res.status(400).json({
                        code: 'INVALID_REFERENCE',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while updating geographic area',
                details: {},
            });
        }
    }

    private async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await this.geographicAreaService.deleteGeographicArea(id);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Geographic area not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('referenced by') || error.message.includes('has')) {
                    return res.status(400).json({
                        code: 'REFERENCED_ENTITY',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while deleting geographic area',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
