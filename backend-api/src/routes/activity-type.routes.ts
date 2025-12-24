import { Router, Response } from 'express';
import { ActivityTypeService } from '../services/activity-type.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    ActivityTypeCreateSchema,
    ActivityTypeUpdateSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class ActivityTypeRoutes {
    private router: Router;

    constructor(
        private activityTypeService: ActivityTypeService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // GET /api/activity-types - List all activity types
        this.router.get(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getAll.bind(this)
        );

        // POST /api/activity-types - Create activity type
        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(ActivityTypeCreateSchema),
            this.create.bind(this)
        );

        // PUT /api/activity-types/:id - Update activity type
        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(ActivityTypeUpdateSchema),
            this.update.bind(this)
        );

        // DELETE /api/activity-types/:id - Delete activity type
        this.router.delete(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.delete.bind(this)
        );
    }

    /**
     * GET /api/activity-types
     * Get all activity types
     */
    private async getAll(_req: AuthenticatedRequest, res: Response) {
        try {
            const activityTypes = await this.activityTypeService.getAllActivityTypes();

            res.status(200).json({
                success: true,
                data: activityTypes,
            });
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching activity types',
                details: {},
            });
        }
    }

    /**
     * POST /api/activity-types
     * Create a new activity type
     */
    private async create(req: AuthenticatedRequest, res: Response) {
        try {
            const activityType = await this.activityTypeService.createActivityType(req.body);

            res.status(201).json({
                success: true,
                data: activityType,
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_NAME',
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
            }

            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while creating activity type',
                details: {},
            });
        }
    }

    /**
     * PUT /api/activity-types/:id
     * Update an activity type
     */
    private async update(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const activityType = await this.activityTypeService.updateActivityType(id, req.body);

            res.status(200).json({
                success: true,
                data: activityType,
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Activity type not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('already exists')) {
                    return res.status(400).json({
                        code: 'DUPLICATE_NAME',
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
            }

            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while updating activity type',
                details: {},
            });
        }
    }

    /**
     * DELETE /api/activity-types/:id
     * Delete an activity type
     */
    private async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await this.activityTypeService.deleteActivityType(id);

            res.status(200).json({
                success: true,
                message: 'Activity type deleted successfully',
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Activity type not found') {
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
                message: 'An error occurred while deleting activity type',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
