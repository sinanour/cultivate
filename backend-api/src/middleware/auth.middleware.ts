import { Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types/express.types';
import { UserRepository } from '../repositories/user.repository';

export class AuthMiddleware {
    constructor(
        private authService: AuthService,
        private userRepository: UserRepository
    ) { }

    /**
     * Middleware to authenticate requests using JWT tokens
     * Validates the token from Authorization header and attaches user info to request
     */
    authenticate() {
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            try {
                // Get token from Authorization header
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    return res.status(401).json({
                        code: 'UNAUTHORIZED',
                        message: 'Missing authorization header',
                        details: {},
                    });
                }

          // Extract token from "Bearer <token>" format
          const parts = authHeader.split(' ');
          if (parts.length !== 2 || parts[0] !== 'Bearer') {
              return res.status(401).json({
                  code: 'UNAUTHORIZED',
                  message: 'Invalid authorization header format. Expected: Bearer <token>',
                  details: {},
              });
          }

          const token = parts[1];

              // Validate token and extract payload
              try {
                  const payload = this.authService.validateAccessToken(token);

                  // CRITICAL: Reject password reset tokens for regular API access
                  if ('purpose' in payload && (payload as any).purpose === 'password_reset') {
                      return res.status(403).json({
                          code: 'FORBIDDEN',
                          message: 'Password reset tokens cannot be used for API access',
                          details: {},
                      });
                  }

                  // Validate that the user still exists in the database
                  const user = await this.userRepository.findById(payload.userId);
                  if (!user) {
                      return res.status(401).json({
                          code: 'UNAUTHORIZED',
                          message: 'User no longer exists',
                          details: {},
                      });
                  }

                  // Validate token against lastInvalidationTimestamp
                  if (user.lastInvalidationTimestamp && payload.iat) {
                      const tokenIssuedAt = new Date(payload.iat * 1000); // Convert Unix timestamp to Date
                      if (tokenIssuedAt < user.lastInvalidationTimestamp) {
                          return res.status(401).json({
                              code: 'TOKEN_INVALIDATED',
                              message: 'Token has been invalidated. Please log in again.',
                              details: {},
                          });
                      }
                  }

                  req.user = payload;

                  // Extract authorization info from token payload
                  req.authorizationInfo = {
                      hasGeographicRestrictions: payload.hasGeographicRestrictions,
                      authorizedAreaIds: payload.authorizedAreaIds,
                      readOnlyAreaIds: payload.readOnlyAreaIds,
                  };

                  next();
              } catch (error) {
                  return res.status(401).json({
                      code: 'UNAUTHORIZED',
                      message: 'Invalid or expired token',
                      details: {},
                  });
              }
          } catch (error) {
              return res.status(401).json({
                  code: 'UNAUTHORIZED',
                  message: 'Authentication failed',
                  details: {},
              });
          }
      };
  }

    /**
     * Optional authentication middleware
     * Attaches user info if token is present, but doesn't fail if missing
     */
    optionalAuthenticate() {
        return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
          try {
              const authHeader = req.headers.authorization;
              if (!authHeader) {
                  return next();
              }

          const parts = authHeader.split(' ');
          if (parts.length === 2 && parts[0] === 'Bearer') {
              const token = parts[1];
              try {
                  const payload = this.authService.validateAccessToken(token);

                  // Validate that the user still exists in the database
                  const user = await this.userRepository.findById(payload.userId);
                  if (user) {
                      // Validate token against lastInvalidationTimestamp
                      if (user.lastInvalidationTimestamp && payload.iat) {
                          const tokenIssuedAt = new Date(payload.iat * 1000);
                          if (tokenIssuedAt < user.lastInvalidationTimestamp) {
                              // Token is invalidated, skip authentication
                              return next();
                          }
                      }

                      req.user = payload;

                      // Extract authorization info from token payload
                      req.authorizationInfo = {
                          hasGeographicRestrictions: payload.hasGeographicRestrictions,
                          authorizedAreaIds: payload.authorizedAreaIds,
                          readOnlyAreaIds: payload.readOnlyAreaIds,
                      };
                  }
              } catch {
                  // Ignore invalid tokens for optional auth
              }
          }

              next();
          } catch {
              next();
          }
      };
  }
}
