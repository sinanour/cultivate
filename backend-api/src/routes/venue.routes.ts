import { Router, Response } from 'express';
import { VenueService } from '../services/venue.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { parseFilterParameters, ParsedFilterRequest } from '../middleware/filter-parser.middleware';
import {
    VenueCreateSchema,
    VenueUpdateSchema,
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
            parseFilterParameters,
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

        // Removed deprecated GET /search endpoint - use unified filter[] API with GET / instead

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

    private async getAll(req: AuthenticatedRequest & ParsedFilterRequest, res: Response) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const geographicAreaId = req.query.geographicAreaId as string | undefined;
            // Removed legacy search parameter - use filter[name] or filter[address] instead

            // Extract parsed filter and fields from middleware
            const filter = req.parsedFilter;
            const fields = req.parsedFields;

            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
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
                const result = await this.venueService.getVenuesFlexible({
                    page,
                    limit,
                    geographicAreaId,
                    filter,
                    fields,
                    authorizedAreaIds,
                    hasGeographicRestrictions
                });
                res.status(200).json({ success: true, ...result });
            } else {
                const venues = await this.venueService.getAllVenues(
                    geographicAreaId,
                    authorizedAreaIds,
                    hasGeographicRestrictions
                );
                res.status(200).json({ success: true, data: venues });
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
            if (error instanceof Error && error.message.includes('INVALID_FIELDS')) {
                res.status(400).json({
                    code: 'VALIDATION_ERROR',
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
                message: 'An error occurred while fetching venues',
                details: {},
            });
        }
    }

    private async getById(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const venue = await this.venueService.getVenueById(id, userId, userRole);
            res.status(200).json({ success: true, data: venue });
        } catch (error) {
            if (error instanceof Error && error.message === 'Venue not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this venue',
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

    // Removed deprecated search method - use unified filter[] API with getAll instead

    private async getActivities(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const activities = await this.venueService.getVenueActivities(id, userId, userRole);
            res.status(200).json({ success: true, data: activities });
        } catch (error) {
            if (error instanceof Error && error.message === 'Venue not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this venue',
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const participants = await this.venueService.getVenueParticipants(id, userId, userRole);
            res.status(200).json({ success: true, data: participants });
        } catch (error) {
            if (error instanceof Error && error.message === 'Venue not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                return res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this venue',
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
            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
            const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;

            const venue = await this.venueService.createVenue(
                req.body,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            res.status(201).json({ success: true, data: venue });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: error.message,
                        details: {},
                    });
                }
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const venue = await this.venueService.updateVenue(
                id,
                req.body,
                userId,
                userRole
            );
            res.status(200).json({ success: true, data: venue });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to update this venue',
                        details: {},
                    });
                }
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
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            await this.venueService.deleteVenue(id, userId, userRole);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to delete this venue',
                        details: {},
                    });
                }
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

            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
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

            const csv = await this.venueService.exportVenuesToCSV(
                geographicAreaId,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            const filename = generateCSVFilename('venues');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
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
