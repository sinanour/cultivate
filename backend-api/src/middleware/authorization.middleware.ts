import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../types/express.types';

export type Permission = 'read' | 'write' | 'admin';

/**
 * Role-based permission mapping
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMINISTRATOR]: ['read', 'write', 'admin'],
  [UserRole.EDITOR]: ['read', 'write'],
  [UserRole.READ_ONLY]: ['read'],
  [UserRole.PII_RESTRICTED]: ['read'], // PII_RESTRICTED has read-only access
};

export class AuthorizationMiddleware {
  /**
   * Middleware to check if user has required permission
   */
  requirePermission(permission: Permission) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {},
        });
      }

      // Check if user's role has the required permission
      const userPermissions = ROLE_PERMISSIONS[req.user.role];
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: {
            required: permission,
            userRole: req.user.role,
          },
        });
      }

      next();
    };
  }

  /**
   * Middleware to check if user has specific role
   */
  requireRole(roles: UserRole | UserRole[]) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {},
        });
      }

      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: {
            required: allowedRoles,
            userRole: req.user.role,
          },
        });
      }

      next();
    };
  }

  /**
   * Middleware to require administrator role
   */
  requireAdmin() {
    return this.requireRole(UserRole.ADMINISTRATOR);
  }

  /**
   * Middleware to require editor or administrator role
   */
  requireEditor() {
    return this.requireRole([UserRole.ADMINISTRATOR, UserRole.EDITOR]);
  }

  /**
   * Middleware to allow read-only access (all authenticated users)
   */
  requireAuthenticated() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {},
        });
      }
      next();
    };
  }
}
