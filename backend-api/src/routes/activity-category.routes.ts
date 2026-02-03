import { Router, Response } from 'express';
import { ActivityCategoryService } from '../services/activity-category.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import {
    ActivityCategoryCreateSchema,
    ActivityCategoryUpdateSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class ActivityCategoryRoutes {
    private router: Router;

    constructor(
        private activityCategoryService: ActivityCategoryService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware,
        private auditLoggingMiddleware: AuditLoggingMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // GET /api/v1/activity-categories - List all activity categories (all authenticated users)
        this.router.get(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.getAll.bind(this)
        );

        // GET /api/v1/activity-categories/:id - Get activity category by ID (all authenticated users)
        this.router.get(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.getById.bind(this)
        );

        // POST /api/v1/activity-categories - Create activity category (admin only)
        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAdmin(),
            ValidationMiddleware.validateBody(ActivityCategoryCreateSchema),
            this.auditLoggingMiddleware.logEntityModification('ACTIVITY_CATEGORY'),
            this.create.bind(this)
        );

        // PUT /api/v1/activity-categories/:id - Update activity category (admin only)
        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAdmin(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(ActivityCategoryUpdateSchema),
            this.auditLoggingMiddleware.logEntityModification('ACTIVITY_CATEGORY'),
            this.update.bind(this)
        );

        // DELETE /api/v1/activity-categories/:id - Delete activity category (admin only)
        this.router.delete(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAdmin(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            this.auditLoggingMiddleware.logEntityModification('ACTIVITY_CATEGORY'),
            this.delete.bind(this)
        );
    }

    /**
     * GET /api/v1/activity-categories
     * Get all activity categories
     */
    private async getAll(_req: AuthenticatedRequest, res: Response) {
        try {
            const activityCategories = await this.activityCategoryService.getAllActivityCategories();

            res.status(200).json({
                success: true,
                data: activityCategories,
            });
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching activity categories',
                details: {},
            });
        }
    }

    /**
     * GET /api/v1/activity-categories/:id
     * Get activity category by ID
     */
    private async getById(req: AuthenticatedRequest, res: Response) {
        try {
            const activityCategory = await this.activityCategoryService.getActivityCategoryById(req.params.id);

            res.status(200).json({
                success: true,
                data: activityCategory,
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'Activity category not found') {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: error.message,
                    details: {},
                });
            }

            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching activity category',
                details: {},
            });
        }
    }

    /**
     * POST /api/v1/activity-categories
     * Create a new activity category
     */
    private async create(req: AuthenticatedRequest, res: Response) {
        try {
            const activityCategory = await this.activityCategoryService.createActivityCategory(req.body);

            res.status(201).json({
                success: true,
                data: activityCategory,
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
                message: 'An error occurred while creating activity category',
                details: {},
            });
        }
    }

    /**
     * PUT /api/v1/activity-categories/:id
     * Update an activity category
     */
    private async update(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const activityCategory = await this.activityCategoryService.updateActivityCategory(id, req.body);

            res.status(200).json({
                success: true,
                data: activityCategory,
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Activity category not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message === 'VERSION_CONFLICT') {
                    return res.status(409).json({
                        code: 'VERSION_CONFLICT',
                        message: 'The activity category has been modified by another user. Please refresh and try again.',
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
                message: 'An error occurred while updating activity category',
                details: {},
            });
        }
    }

    /**
     * DELETE /api/v1/activity-categories/:id
     * Delete an activity category
     */
    private async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await this.activityCategoryService.deleteActivityCategory(id);

            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Activity category not found') {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('reference')) {
                    return res.status(400).json({
                        code: 'REFERENCED_ENTITY',
                        message: error.message,
                        details: {},
                    });
                }
            }

            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while deleting activity category',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
