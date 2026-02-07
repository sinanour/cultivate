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

/**
 * Blocked endpoint patterns for PII_RESTRICTED role
 */
const BLOCKED_ENDPOINTS_FOR_PII_RESTRICTED = [
  /^\/participants/,
  /^\/venues/,
  /^\/activities/,
  /^\/map/,
  /^\/geographic-areas\/[^/]+\/venues$/, // Block /geographic-areas/:id/venues
  /^\/geographic-areas\/[^/]+\/statistics$/, // Block /geographic-areas/:id/statistics
];

/**
 * Check if an endpoint is blocked for PII_RESTRICTED role
 */
function isEndpointBlocked(path: string, role: UserRole): boolean {
  if (role !== UserRole.PII_RESTRICTED) {
    return false;
  }

  return BLOCKED_ENDPOINTS_FOR_PII_RESTRICTED.some((pattern) =>
    pattern.test(path)
  );
}

export class AuthorizationMiddleware {
  /**
   * Middleware to check PII_RESTRICTED access restrictions
   * This should be applied AFTER authentication in individual routes
   */
  checkPIIRestrictedAccess() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Only apply restrictions if user is authenticated and has PII_RESTRICTED role
      if (!req.user || req.user.role !== UserRole.PII_RESTRICTED) {
        return next();
      }

      // Check if endpoint is blocked for PII_RESTRICTED role
      if (isEndpointBlocked(req.path, req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ENDPOINT_ACCESS_DENIED',
            message: 'PII_RESTRICTED role does not have access to this endpoint',
          },
        });
      }

      // For analytics endpoints, validate parameters
      const isAnalyticsEndpoint =
        req.path.includes('/analytics/engagement') ||
        req.path.includes('/analytics/growth') ||
        req.path.includes('/analytics/activity-lifecycle') ||
        req.path.includes('/analytics/geographic');

      if (isAnalyticsEndpoint) {
        // Check for venue grouping
        const groupBy = req.query.groupBy;
        if (groupBy) {
          const groupByArray = Array.isArray(groupBy) ? groupBy : [groupBy];
          const hasVenueGrouping = groupByArray.some((dim) => String(dim) === 'venue');

          if (hasVenueGrouping) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_GROUPING_PARAMETER',
                message: 'Venue grouping is not allowed for PII_RESTRICTED role',
              },
            });
          }
        }

        // Check for venue filtering (venueIds parameter)
        const venueIds = req.query.venueIds;
        if (venueIds !== undefined && venueIds !== null && venueIds !== '') {
          // venueIds can be a string, array, or comma-separated values
          const hasVenueFilter = Array.isArray(venueIds)
            ? venueIds.length > 0
            : String(venueIds).length > 0;

          if (hasVenueFilter) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_FILTER_PARAMETER',
                message: 'Venue filtering is not allowed for PII_RESTRICTED role',
              },
            });
          }
        }
      }

      next();
    };
  }

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
