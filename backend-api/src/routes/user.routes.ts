import { Router, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { UserCreateSchema, UserUpdateSchema, UserProfileUpdateSchema, UuidParamSchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class UserRoutes {
  private router: Router;

  constructor(
    private userService: UserService,
    private authMiddleware: AuthMiddleware,
    private authorizationMiddleware: AuthorizationMiddleware,
    private auditLoggingMiddleware: AuditLoggingMiddleware
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Profile endpoints (all authenticated users)
    this.router.get(
      '/me/profile',
      this.authMiddleware.authenticate(),
      this.getProfile.bind(this)
    );

    this.router.put(
      '/me/profile',
      this.authMiddleware.authenticate(),
      ValidationMiddleware.validateBody(UserProfileUpdateSchema),
      this.auditLoggingMiddleware.logEntityModification('USER_PROFILE'),
      this.updateProfile.bind(this)
    );

    // All user management endpoints require ADMINISTRATOR role
    this.router.get(
      '/',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireAdmin(),
      this.getAll.bind(this)
    );

    this.router.get(
      '/:id',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireAdmin(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      this.getById.bind(this)
    );

    this.router.post(
      '/',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireAdmin(),
      ValidationMiddleware.validateBody(UserCreateSchema),
      this.auditLoggingMiddleware.logEntityModification('USER'),
      this.create.bind(this)
    );

    this.router.put(
      '/:id',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireAdmin(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(UserUpdateSchema),
      this.auditLoggingMiddleware.logEntityModification('USER'),
      this.auditLoggingMiddleware.logRoleChange(),
      this.update.bind(this)
    );

    this.router.delete(
      '/:id',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireAdmin(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      this.auditLoggingMiddleware.logEntityModification('USER'),
      this.delete.bind(this)
    );
  }

  private async getAll(_req: AuthenticatedRequest, res: Response) {
    try {
      const users = await this.userService.getAllUsers();
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching users',
        details: {},
      });
    }
  }

  private async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: error.message,
          details: {},
        });
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching user',
        details: {},
      });
    }
  }

  private async create(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await this.userService.createUser(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(400).json({
            code: 'DUPLICATE_EMAIL',
            message: error.message,
            details: {},
          });
        }
        if (error.message.includes('required') || error.message.includes('must be')) {
          return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: {},
          });
        }
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating user',
        details: {},
      });
    }
  }

  private async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await this.userService.updateUser(id, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
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
        if (error.message.includes('required') || error.message.includes('must be')) {
          return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: {},
          });
        }
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating user',
        details: {},
      });
    }
  }

  private async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: error.message,
            details: {},
          });
        }
        if (error.message.includes('Cannot delete the last administrator')) {
          return res.status(400).json({
            code: 'LAST_ADMINISTRATOR',
            message: error.message,
            details: {},
          });
        }
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while deleting user',
        details: {},
      });
    }
  }

  private async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const profile = await this.userService.getCurrentUserProfile(userId);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: error.message,
          details: {},
        });
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching profile',
        details: {},
      });
    }
  }

  private async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const profile = await this.userService.updateCurrentUserProfile(userId, req.body);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: error.message,
            details: {},
          });
        }
        if ((error as any).code === 'INVALID_CURRENT_PASSWORD') {
          return res.status(401).json({
            code: 'INVALID_CURRENT_PASSWORD',
            message: error.message,
            details: {},
          });
        }
        if (error.message.includes('required') || error.message.includes('must be')) {
          return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: {},
          });
        }
      }
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating profile',
        details: {},
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
