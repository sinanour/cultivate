import { Router, Response } from 'express';
import { GeographicAreaService } from '../services/geographic-area.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    GeographicAreaCreateSchema,
    GeographicAreaUpdateSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';
import { generateCSVFilename } from '../utils/csv.utils';
import { csvUpload } from '../middleware/upload.middleware';

export class GeographicAreaRoutes {
    private router: Router;

    constructor(
        private geographicAreaService: GeographicAreaService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware,
        private auditLoggingMiddleware: AuditLoggingMiddleware
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
            '/export',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.exportCSV.bind(this)
        );

        this.router.post(
            '/import',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            csvUpload.single('file'),
            this.importCSV.bind(this)
        );

        // Batch ancestors endpoint - must come before /:id to avoid route conflicts
        this.router.post(
            '/batch-ancestors',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getBatchAncestors.bind(this)
        );

        // Batch details endpoint - must come before /:id to avoid route conflicts
        this.router.post(
            '/batch-details',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getBatchDetails.bind(this)
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
            this.auditLoggingMiddleware.logEntityModification('GEOGRAPHIC_AREA'),
            this.create.bind(this)
        );

        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(GeographicAreaUpdateSchema),
            this.auditLoggingMiddleware.logEntityModification('GEOGRAPHIC_AREA'),
            this.update.bind(this)
        );

        this.router.delete(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.auditLoggingMiddleware.logEntityModification('GEOGRAPHIC_AREA'),
            this.delete.bind(this)
        );
    }

    private async getAll(req: AuthenticatedRequest, res: Response) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const geographicAreaId = req.query.geographicAreaId as string | undefined;
            const search = req.query.search as string | undefined;
            const depth = req.query.depth ? parseInt(req.query.depth as string) : undefined;

            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
            const readOnlyAreaIds = req.user?.readOnlyAreaIds || [];
            const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;

            // Validate explicit geographic area access
            if (geographicAreaId && hasGeographicRestrictions) {
                const hasAccess = authorizedAreaIds.includes(geographicAreaId);
                if (!hasAccess) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access this geographic area',
                        details: {},
                    });
                }
            }

            if (page !== undefined || limit !== undefined) {
                const result = await this.geographicAreaService.getAllGeographicAreasPaginated(
                    page,
                    limit,
                    geographicAreaId,
                    search,
                    depth,
                    authorizedAreaIds,
                    hasGeographicRestrictions,
                    readOnlyAreaIds
                );
                res.status(200).json({ success: true, ...result });
            } else {
                const areas = await this.geographicAreaService.getAllGeographicAreas(
                    geographicAreaId,
                    search,
                    depth,
                    authorizedAreaIds,
                    hasGeographicRestrictions,
                    readOnlyAreaIds
                );
                res.status(200).json({ success: true, data: areas });
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const area = await this.geographicAreaService.getGeographicAreaById(id, userId, userRole);
            res.status(200).json({ success: true, data: area });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this geographic area',
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
            const { page, limit } = req.query;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            // Check if pagination parameters are provided
            if (page !== undefined || limit !== undefined) {
                const result = await this.geographicAreaService.getChildrenPaginated(
                    id,
                    page ? parseInt(page as string) : undefined,
                    limit ? parseInt(limit as string) : undefined,
                    userId,
                    userRole
                );
                res.status(200).json({ success: true, ...result });
            } else {
                const children = await this.geographicAreaService.getChildren(id, userId, userRole);
                res.status(200).json({ success: true, data: children });
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this geographic area',
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const ancestors = await this.geographicAreaService.getAncestors(id, userId, userRole);
            res.status(200).json({ success: true, data: ancestors });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this geographic area',
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

    private async getBatchAncestors(req: AuthenticatedRequest, res: Response) {
        try {
            const { areaIds } = req.body;

            // Validate request body
            if (!areaIds || !Array.isArray(areaIds)) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'Request body must contain an areaIds array',
                    details: {},
                });
            }

            if (areaIds.length === 0) {
                return res.status(200).json({ success: true, data: {} });
            }

            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const batchAncestors = await this.geographicAreaService.getBatchAncestors(
                areaIds,
                userId,
                userRole
            );

            res.status(200).json({ success: true, data: batchAncestors });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('VALIDATION_ERROR') || error.message.includes('Invalid UUID')) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('more than 100')) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching batch ancestors',
                details: {},
            });
        }
    }

    private async getBatchDetails(req: AuthenticatedRequest, res: Response) {
        try {
            const { areaIds } = req.body;

            // Validate request body
            if (!areaIds || !Array.isArray(areaIds)) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'Request body must contain an areaIds array',
                    details: {},
                });
            }

            if (areaIds.length === 0) {
                return res.status(200).json({ success: true, data: {} });
            }

            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const batchDetails = await this.geographicAreaService.getBatchDetails(
                areaIds,
                userId,
                userRole
            );

            res.status(200).json({ success: true, data: batchDetails });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('VALIDATION_ERROR') || error.message.includes('Invalid UUID')) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('more than 100')) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching batch details',
                details: {},
            });
        }
    }

    private async getVenues(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const venues = await this.geographicAreaService.getVenues(id, userId, userRole);
            res.status(200).json({ success: true, data: venues });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this geographic area',
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const statistics = await this.geographicAreaService.getStatistics(id, userId, userRole);
            res.status(200).json({ success: true, data: statistics });
        } catch (error) {
            if (error instanceof Error && error.message === 'Geographic area not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this geographic area',
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
            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
            const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;

            const area = await this.geographicAreaService.createGeographicArea(
                req.body,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            res.status(201).json({ success: true, data: area });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: error.message,
                        details: {},
                    });
                }
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const area = await this.geographicAreaService.updateGeographicArea(
                id,
                req.body,
                userId,
                userRole
            );
            res.status(200).json({ success: true, data: area });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to update this geographic area',
                        details: {},
                    });
                }
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            await this.geographicAreaService.deleteGeographicArea(
                id,
                userId,
                userRole
            );
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to delete this geographic area',
                        details: {},
                    });
                }
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

    private async exportCSV(_req: AuthenticatedRequest, res: Response) {
        try {
            const csv = await this.geographicAreaService.exportGeographicAreasToCSV();
            const filename = generateCSVFilename('geographic-areas');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while exporting geographic areas',
                details: {},
            });
        }
    }

    private async importCSV(req: AuthenticatedRequest, res: Response) {
        try {
            // Validate file exists
            if (!req.file) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'No file uploaded',
                    details: {},
                });
            }

            // Validate file extension
            if (!req.file.originalname.endsWith('.csv')) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'File must be a CSV',
                    details: {},
                });
            }

            // Validate file size
            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(413).json({
                    code: 'FILE_TOO_LARGE',
                    message: 'File exceeds 10MB limit',
                    details: {},
                });
            }

            // Process import
            const result = await this.geographicAreaService.importGeographicAreasFromCSV(req.file.buffer);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('Invalid CSV format')) {
                return res.status(400).json({
                    code: 'INVALID_CSV',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while importing geographic areas',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
