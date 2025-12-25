import { Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types/express.types';

export class AuthMiddleware {
    constructor(private authService: AuthService) { }

    /**
     * Middleware to authenticate requests using JWT tokens
     * Validates the token from Authorization header and attaches user info to request
     */
    authenticate() {
        return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
                  req.user = payload;
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
      return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
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
                  req.user = payload;
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
