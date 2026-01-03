import { Router, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { LoginSchema, RefreshTokenSchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class AuthRoutes {
    private router: Router;

    constructor(
        private authService: AuthService,
        private authMiddleware: AuthMiddleware,
        private auditLoggingMiddleware: AuditLoggingMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // POST /api/auth/login - Authenticate user
        this.router.post(
            '/login',
            ValidationMiddleware.validateBody(LoginSchema),
            this.auditLoggingMiddleware.logAuthenticationEvent('LOGIN'),
            this.login.bind(this)
        );

        // POST /api/auth/logout - Invalidate token (client-side operation)
        this.router.post(
            '/logout',
            this.authMiddleware.authenticate(),
            this.auditLoggingMiddleware.logAuthenticationEvent('LOGOUT'),
            this.logout.bind(this)
        );

        // POST /api/auth/refresh - Refresh access token
        this.router.post(
            '/refresh',
            ValidationMiddleware.validateBody(RefreshTokenSchema),
            this.auditLoggingMiddleware.logAuthenticationEvent('REFRESH'),
            this.refresh.bind(this)
        );

        // GET /api/auth/me - Get current user information
        this.router.get('/me', this.authMiddleware.authenticate(), this.getCurrentUser.bind(this));
    }

    /**
     * POST /api/auth/login
     * Authenticate user with email and password
     */
    private async login(req: AuthenticatedRequest, res: Response) {
        try {
            const { email, password } = req.body;
            const tokens = await this.authService.login({ email, password });

            res.status(200).json({
                success: true,
                data: tokens,
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'Invalid credentials') {
                return res.status(401).json({
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password',
                    details: {},
                });
            }

            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred during login',
                details: {},
            });
        }
    }

    /**
     * POST /api/auth/logout
     * Logout user (client-side token invalidation)
     */
    private async logout(_req: AuthenticatedRequest, res: Response) {
        // JWT tokens are stateless, so logout is handled client-side
        // by removing the token from storage
        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    }

    /**
     * POST /api/auth/refresh
     * Refresh access token using refresh token
     */
    private async refresh(req: AuthenticatedRequest, res: Response) {
        try {
            const { refreshToken } = req.body;
            const tokens = await this.authService.refreshAccessToken(refreshToken);

            res.status(200).json({
                success: true,
                data: tokens,
            });
        } catch (error) {
            return res.status(401).json({
                code: 'INVALID_REFRESH_TOKEN',
                message: 'Invalid or expired refresh token',
                details: {},
            });
        }
    }

    /**
     * GET /api/auth/me
     * Get current user information
     */
    private async getCurrentUser(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated',
                    details: {},
                });
            }

            const userInfo = await this.authService.getUserInfo(req.user.userId);

            res.status(200).json({
                success: true,
                data: userInfo,
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                return res.status(404).json({
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    details: {},
                });
            }

            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching user information',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
