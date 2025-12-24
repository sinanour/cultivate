import { Router, Response } from 'express';
import { RoleService } from '../services/role.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { RoleCreateSchema, RoleUpdateSchema, UuidParamSchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class RoleRoutes {
    private router: Router;

    constructor(
        private roleService: RoleService,
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

        this.router.post(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(RoleCreateSchema),
            this.create.bind(this)
        );

        this.router.put(
            '/:id',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateParams(UuidParamSchema),
            ValidationMiddleware.validateBody(RoleUpdateSchema),
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

    private async getAll(_req: AuthenticatedRequest, res: Response) {
        try {
            const roles = await this.roleService.getAllRoles();
            res.status(200).json({ success: true, data: roles });
        } catch (error) {
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching roles',
                details: {},
            });
        }
    }

    private async create(req: AuthenticatedRequest, res: Response) {
        try {
            const role = await this.roleService.createRole(req.body);
            res.status(201).json({ success: true, data: role });
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
                message: 'An error occurred while creating role',
                details: {},
            });
        }
    }

    private async update(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const role = await this.roleService.updateRole(id, req.body);
            res.status(200).json({ success: true, data: role });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Role not found') {
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
                message: 'An error occurred while updating role',
                details: {},
            });
        }
    }

    private async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await this.roleService.deleteRole(id);
            res.status(200).json({ success: true, message: 'Role deleted successfully' });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Role not found') {
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
                message: 'An error occurred while deleting role',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
