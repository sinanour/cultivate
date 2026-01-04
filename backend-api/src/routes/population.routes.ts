import { Router, Request, Response } from 'express';
import { PopulationService } from '../services/population.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { PopulationCreateSchema, PopulationUpdateSchema, ParticipantPopulationCreateSchema } from '../utils/validation.schemas';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';

export class PopulationRoutes {
    public router: Router;

    constructor(
        private populationService: PopulationService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware,
        private auditLoggingMiddleware: AuditLoggingMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Population CRUD routes
        this.router.get(
            '/populations',
            this.authMiddleware.authenticate(),
            this.getAllPopulations.bind(this)
        );

        this.router.post(
            '/populations',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAdmin(),
            ValidationMiddleware.validateBody(PopulationCreateSchema),
            this.auditLoggingMiddleware.logEntityModification('POPULATION'),
            this.createPopulation.bind(this)
        );

        this.router.put(
            '/populations/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAdmin(),
            ValidationMiddleware.validateBody(PopulationUpdateSchema),
            this.auditLoggingMiddleware.logEntityModification('POPULATION'),
            this.updatePopulation.bind(this)
        );

        this.router.delete(
            '/populations/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAdmin(),
            this.auditLoggingMiddleware.logEntityModification('POPULATION'),
            this.deletePopulation.bind(this)
        );

        // Participant-Population association routes
        this.router.get(
            '/participants/:participantId/populations',
            this.authMiddleware.authenticate(),
            this.getParticipantPopulations.bind(this)
        );

        this.router.post(
            '/participants/:participantId/populations',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireRole(['ADMINISTRATOR', 'EDITOR']),
            ValidationMiddleware.validateBody(ParticipantPopulationCreateSchema),
            this.auditLoggingMiddleware.logEntityModification('PARTICIPANT_POPULATION'),
            this.addParticipantToPopulation.bind(this)
        );

        this.router.delete(
            '/participants/:participantId/populations/:populationId',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireRole(['ADMINISTRATOR', 'EDITOR']),
            this.auditLoggingMiddleware.logEntityModification('PARTICIPANT_POPULATION'),
            this.removeParticipantFromPopulation.bind(this)
        );
    }

    private async getAllPopulations(_req: Request, res: Response) {
        try {
            const populations = await this.populationService.getAllPopulations();
            res.json({ success: true, data: populations });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    private async createPopulation(req: Request, res: Response) {
        try {
            const population = await this.populationService.createPopulation(req.body);
            res.status(201).json({ success: true, data: population });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    private async updatePopulation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const population = await this.populationService.updatePopulation(id, req.body);
            res.json({ success: true, data: population });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    private async deletePopulation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await this.populationService.deletePopulation(id);
            res.status(204).send();
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    private async getParticipantPopulations(req: Request, res: Response) {
        try {
            const { participantId } = req.params;
            const populations = await this.populationService.getParticipantPopulations(participantId);
            res.json({ success: true, data: populations });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    private async addParticipantToPopulation(req: Request, res: Response) {
        try {
            const { participantId } = req.params;
            const { populationId } = req.body;
            const association = await this.populationService.addParticipantToPopulation(participantId, populationId);
            res.status(201).json({ success: true, data: association });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    private async removeParticipantFromPopulation(req: Request, res: Response) {
        try {
            const { participantId, populationId } = req.params;
            await this.populationService.removeParticipantFromPopulation(participantId, populationId);
            res.status(204).send();
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message || 'An error occurred',
                details: error.details || {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
