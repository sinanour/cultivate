import { Router, Response } from 'express';
import { ParticipantService } from '../services/participant.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    ParticipantCreateSchema,
    ParticipantUpdateSchema,
    ParticipantSearchSchema,
    ParticipantAddressHistoryCreateSchema,
    ParticipantAddressHistoryUpdateSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';
import { z } from 'zod';
import { generateCSVFilename } from '../utils/csv.utils';
import { csvUpload } from '../middleware/upload.middleware';

export class ParticipantRoutes {
    private router: Router;

    constructor(
        private participantService: ParticipantService,
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
            ValidationMiddleware.validateQuery(ParticipantSearchSchema),
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
            this.getParticipantActivities.bind(this)
        );

        this.router.get(
            '/:id/address-history',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getAddressHistory.bind(this)
        );

        this.router.post(
            '/:id/address-history',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(ParticipantAddressHistoryCreateSchema),
            this.createAddressHistory.bind(this)
        );

        this.router.put(
            '/:id/address-history/:historyId',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(z.object({
                id: z.string().uuid('Invalid ID format'),
                historyId: z.string().uuid('Invalid history ID format'),
            })),
            ValidationMiddleware.validateBody(ParticipantAddressHistoryUpdateSchema),
            this.updateAddressHistory.bind(this)
        );

        this.router.delete(
            '/:id/address-history/:historyId',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(z.object({
                id: z.string().uuid('Invalid ID format'),
                historyId: z.string().uuid('Invalid history ID format'),
            })),
            this.deleteAddressHistory.bind(this)
        );

        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(ParticipantCreateSchema),
            this.auditLoggingMiddleware.logEntityModification('PARTICIPANT'),
            this.create.bind(this)
        );

        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(ParticipantUpdateSchema),
            this.auditLoggingMiddleware.logEntityModification('PARTICIPANT'),
            this.update.bind(this)
        );

        this.router.delete(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.auditLoggingMiddleware.logEntityModification('PARTICIPANT'),
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
                const result = await this.participantService.getAllParticipantsPaginated(page, limit, geographicAreaId, search);
                res.status(200).json({ success: true, ...result });
            } else {
                const participants = await this.participantService.getAllParticipants(geographicAreaId, search);
                res.status(200).json({ success: true, data: participants });
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
                message: 'An error occurred while fetching participants',
                details: {},
            });
        }
    }

    private async getById(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const participant = await this.participantService.getParticipantById(id);
            res.status(200).json({ success: true, data: participant });
        } catch (error) {
            if (error instanceof Error && error.message === 'Participant not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching participant',
                details: {},
            });
        }
    }

    private async getParticipantActivities(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const activities = await this.participantService.getParticipantActivities(id);
            res.status(200).json({ success: true, data: activities });
        } catch (error) {
            if (error instanceof Error && error.message === 'Participant not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching participant activities',
                details: {},
            });
        }
    }

    private async search(req: AuthenticatedRequest, res: Response) {
        try {
            const { q } = req.query;
            const participants = await this.participantService.searchParticipants((q as string) || '');
            res.status(200).json({ success: true, data: participants });
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while searching participants',
                details: {},
            });
        }
    }

    private async create(req: AuthenticatedRequest, res: Response) {
        try {
            const participant = await this.participantService.createParticipant(req.body);
            res.status(201).json({ success: true, data: participant });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_EMAIL',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('required') || error.message.includes('Invalid email')) {
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
                message: 'An error occurred while creating participant',
                details: {},
            });
        }
    }

    private async update(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const participant = await this.participantService.updateParticipant(id, req.body);
            res.status(200).json({ success: true, data: participant });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Participant not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message === 'VERSION_CONFLICT') {
                    return res.status(409).json({
                        code: 'VERSION_CONFLICT',
                        message: 'The participant has been modified by another user. Please refresh and try again.',
                        details: {},
                    });
                }
                if (error.message.includes('already exists')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_EMAIL',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('Invalid email')) {
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
                message: 'An error occurred while updating participant',
                details: {},
            });
        }
    }

    private async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await this.participantService.deleteParticipant(id);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error && error.message === 'Participant not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while deleting participant',
                details: {},
            });
        }
    }

    private async getAddressHistory(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const history = await this.participantService.getAddressHistory(id);
            res.status(200).json({ success: true, data: history });
        } catch (error) {
            if (error instanceof Error && error.message === 'Participant not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching address history',
                details: {},
            });
        }
    }

    private async createAddressHistory(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const { venueId, effectiveFrom } = req.body;
            const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : null;
            const history = await this.participantService.createAddressHistory(id, {
                venueId,
                effectiveFrom: effectiveDate,
            });
            res.status(201).json({ success: true, data: history });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Participant not found' || error.message === 'Venue not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('already exists') || error.message.includes('Only one')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_EFFECTIVE_FROM',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while creating address history',
                details: {},
            });
        }
    }

    private async updateAddressHistory(req: AuthenticatedRequest, res: Response) {
        try {
            const { id, historyId } = req.params;
            const updateData: { venueId?: string; effectiveFrom?: Date } = {};

            if (req.body.venueId) {
                updateData.venueId = req.body.venueId;
            }
            if (req.body.effectiveFrom) {
                updateData.effectiveFrom = new Date(req.body.effectiveFrom);
            }

            const history = await this.participantService.updateAddressHistory(id, historyId, updateData);
            res.status(200).json({ success: true, data: history });
        } catch (error) {
            if (error instanceof Error) {
                if (
                    error.message === 'Participant not found' ||
                    error.message === 'Venue not found' ||
                    error.message === 'Address history record not found'
                ) {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('does not belong')) {
                    return res.status(400).json({
                        code: 'INVALID_REFERENCE',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('already exists')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_EFFECTIVE_FROM',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while updating address history',
                details: {},
            });
        }
    }

    private async deleteAddressHistory(req: AuthenticatedRequest, res: Response) {
        try {
            const { id, historyId } = req.params;
            await this.participantService.deleteAddressHistory(id, historyId);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (
                    error.message === 'Participant not found' ||
                    error.message === 'Address history record not found'
                ) {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('does not belong')) {
                    return res.status(400).json({
                        code: 'INVALID_REFERENCE',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while deleting address history',
                details: {},
            });
        }
    }

    private async exportCSV(req: AuthenticatedRequest, res: Response) {
        try {
            const geographicAreaId = req.query.geographicAreaId as string | undefined;
            const csv = await this.participantService.exportParticipantsToCSV(geographicAreaId);
            const filename = generateCSVFilename('participants');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while exporting participants',
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

            // Validate file size (multer already handles this, but double-check)
            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(413).json({
                    code: 'FILE_TOO_LARGE',
                    message: 'File exceeds 10MB limit',
                    details: {},
                });
            }

            // Process import
            const result = await this.participantService.importParticipantsFromCSV(req.file.buffer);

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
                message: 'An error occurred while importing participants',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
