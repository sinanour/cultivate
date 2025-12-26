import { Router, Response } from 'express';
import { ParticipantService } from '../services/participant.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    ParticipantCreateSchema,
    ParticipantUpdateSchema,
    ParticipantSearchSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class ParticipantRoutes {
    private router: Router;

    constructor(
        private participantService: ParticipantService,
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
            '/:id/address-history',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getAddressHistory.bind(this)
        );

        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(ParticipantCreateSchema),
            this.create.bind(this)
        );

        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(ParticipantUpdateSchema),
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

            if (page !== undefined || limit !== undefined) {
                const result = await this.participantService.getAllParticipantsPaginated(page, limit);
                res.status(200).json({ success: true, ...result });
            } else {
                const participants = await this.participantService.getAllParticipants();
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
            res.status(200).json({ success: true, message: 'Participant deleted successfully' });
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

    getRouter(): Router {
        return this.router;
    }
}
