import { Router, Response } from 'express';
import { VenueService } from '../services/venue.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    VenueCreateSchema,
    VenueUpdateSchema,
    VenueSearchSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';
import { generateCSVFilename } from '../utils/csv.utils';
import { csvUpload } from '../middleware/upload.middleware';

export class VenueRoutes {
    private router: Router;

    constructor(
        private venueService: VenueService,
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

        this.router.get(
            '/search',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(VenueSearchSchema),
            this.search.bind(this)
        );

        this.router.get(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getById.bind(this)
        );

        this.router.get(
            '/:id/activities',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getActivities.bind(this)
        );

        this.router.get(
            '/:id/participants',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getParticipants.bind(this)
        );

        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(VenueCreateSchema),
            this.auditLoggingMiddleware.logEntityModification('VENUE'),
            this.create.bind(this)
        );

        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(VenueUpdateSchema),
            this.auditLoggingMiddleware.logEntityModification('VENUE'),
            this.update.bind(this)
        );

        this.router.delete(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.auditLoggingMiddleware.logEntityModification('VENUE'),
            this.delete.bind(this)
        );
    }

    private async getAll(req: AuthenticatedRequest, res: Response) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const geographicAreaId = req.query.geographicAreaId as string | undefined;
            const search = req.query.search as string | undefined;

            if (page !== undefined || limit !== undefined) {
                const result = await this.venueService.getAllVenuesPaginated(page, limit, geographicAreaId, search);
                res.status(200).json({ success: true, ...result });
            } else {
                const venues = await this.venueService.getAllVenues(geographicAreaId, search);
                res.status(200).json({ success: true, data: venues });
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
                message: 'An error occurred while fetching venues',
                details: {},
            });
        }
    }

    private async getById(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const venue = await this.venueService.getVenueById(id);
            res.status(200).json({ success: true, data: venue });
        } catch (error) {
            if (error instanceof Error && error.message === 'Venue not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching venue',
                details: {},
            });
        }
    }

    private async search(req: AuthenticatedRequest, res: Response) {
        try {
            const { q } = req.query;
            const venues = await this.venueService.searchVenues((q as string) || '');
            res.status(200).json({ success: true, data: venues });
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while searching venues',
                details: {},
            });
        }
    }

    private async getActivities(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const activities = await this.venueService.getVenueActivities(id);
            res.status(200).json({ success: true, data: activities });
        } catch (error) {
            if (error instanceof Error && error.message === 'Venue not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching venue activities',
                details: {},
            });
        }
    }

    private async getParticipants(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const participants = await this.venueService.getVenueParticipants(id);
            res.status(200).json({ success: true, data: participants });
        } catch (error) {
            if (error instanceof Error && error.message === 'Venue not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching venue participants',
                details: {},
            });
        }
    }

    private async create(req: AuthenticatedRequest, res: Response) {
        try {
            const venue = await this.venueService.createVenue(req.body);
            res.status(201).json({ success: true, data: venue });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('required') || error.message.includes('must be between')) {
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
                message: 'An error occurred while creating venue',
                details: {},
            });
        }
    }

    private async update(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const venue = await this.venueService.updateVenue(id, req.body);
            res.status(200).json({ success: true, data: venue });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Venue not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message === 'VERSION_CONFLICT') {
                    return res.status(409).json({
                        code: 'VERSION_CONFLICT',
                        message: 'The venue has been modified by another user. Please refresh and try again.',
                        details: {},
                    });
                }
                if (error.message.includes('must be between')) {
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
                message: 'An error occurred while updating venue',
                details: {},
            });
        }
    }

    private async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await this.venueService.deleteVenue(id);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Venue not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('referenced by')) {
                    return res.status(400).json({
                        code: 'REFERENCED_ENTITY',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while deleting venue',
                details: {},
            });
        }
    }

    private async exportCSV(req: AuthenticatedRequest, res: Response) {
        try {
            const geographicAreaId = req.query.geographicAreaId as string | undefined;
            const csv = await this.venueService.exportVenuesToCSV(geographicAreaId);
            const filename = generateCSVFilename('venues');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while exporting venues',
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
            const result = await this.venueService.importVenuesFromCSV(req.file.buffer);

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
                message: 'An error occurred while importing venues',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
