import { Router, Response } from 'express';
import { AssignmentService } from '../services/assignment.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { AssignmentCreateSchema, UuidParamSchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class AssignmentRoutes {
    private router: Router;

    constructor(
        private assignmentService: AssignmentService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router({ mergeParams: true }); // Merge params from parent router
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // GET /api/activities/:id/participants
        this.router.get(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getActivityParticipants.bind(this)
        );

        // POST /api/activities/:id/participants
        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(AssignmentCreateSchema),
            this.assignParticipant.bind(this)
        );

        // DELETE /api/activities/:id/participants/:participantId
        this.router.delete(
            '/:participantId',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            this.removeParticipant.bind(this)
        );
    }

    private async getActivityParticipants(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const assignments = await this.assignmentService.getActivityParticipants(id);
            res.status(200).json({ success: true, data: assignments });
        } catch (error) {
            if (error instanceof Error && error.message === 'Activity not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching activity participants',
                details: {},
            });
        }
    }

    private async assignParticipant(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const assignment = await this.assignmentService.assignParticipant(id, req.body);
            res.status(201).json({ success: true, data: assignment });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('already assigned')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_ASSIGNMENT',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while assigning participant',
                details: {},
            });
        }
    }

    private async removeParticipant(req: AuthenticatedRequest, res: Response) {
        try {
            const { id, participantId } = req.params;
            await this.assignmentService.removeParticipant(id, participantId);
            res.status(200).json({ success: true, message: 'Participant removed successfully' });
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while removing participant',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
