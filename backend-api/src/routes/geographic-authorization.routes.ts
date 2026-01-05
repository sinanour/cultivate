import { Router } from 'express';
import { GeographicAuthorizationService } from '../services/geographic-authorization.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuthenticatedRequest } from '../types/express.types';
import { z } from 'zod';
import { AuthorizationRuleType } from '@prisma/client';

const GeographicAuthorizationCreateSchema = z.object({
    geographicAreaId: z.string().uuid(),
    ruleType: z.nativeEnum(AuthorizationRuleType),
});

export class GeographicAuthorizationRoutes {
    public router: Router;

    constructor(
        private geographicAuthorizationService: GeographicAuthorizationService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // All routes require authentication and ADMINISTRATOR role
        const authenticate = this.authMiddleware.authenticate();
        const requireAdmin = this.authorizationMiddleware.requireAdmin();

        // GET /api/v1/users/:userId/geographic-authorizations
        this.router.get(
            '/:userId/geographic-authorizations',
            authenticate,
            requireAdmin,
            this.getAuthorizationRules.bind(this)
        );

        // POST /api/v1/users/:userId/geographic-authorizations
        this.router.post(
            '/:userId/geographic-authorizations',
            authenticate,
            requireAdmin,
            this.createAuthorizationRule.bind(this)
        );

        // DELETE /api/v1/users/:userId/geographic-authorizations/:authId
        this.router.delete(
            '/:userId/geographic-authorizations/:authId',
            authenticate,
            requireAdmin,
            this.deleteAuthorizationRule.bind(this)
        );

        // GET /api/v1/users/:userId/authorized-areas
        this.router.get(
            '/:userId/authorized-areas',
            authenticate,
            requireAdmin,
            this.getAuthorizedAreas.bind(this)
        );
    }

    private async getAuthorizationRules(req: AuthenticatedRequest, res: any) {
        try {
            const { userId } = req.params;
            console.log(`[GeographicAuthorizationRoutes] Getting authorization rules for user: ${userId}`);

            const rules = await this.geographicAuthorizationService.getAuthorizationRules(userId);
            console.log(`[GeographicAuthorizationRoutes] Found ${rules.length} authorization rules`);

            res.json({
                success: true,
                data: rules,
            });
        } catch (error: any) {
            console.error('[GeographicAuthorizationRoutes] Error getting authorization rules:', error);
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message,
                details: error.details,
            });
        }
    }

    private async createAuthorizationRule(req: AuthenticatedRequest, res: any) {
        try {
            const { userId } = req.params;
            const validation = GeographicAuthorizationCreateSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: validation.error.errors,
                });
            }

            const { geographicAreaId, ruleType } = validation.data;
            const createdBy = req.user!.userId;

            const rule = await this.geographicAuthorizationService.createAuthorizationRule(
                userId,
                geographicAreaId,
                ruleType,
                createdBy
            );

            res.status(201).json({
                success: true,
                data: rule,
            });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message,
                details: error.details,
            });
        }
    }

    private async deleteAuthorizationRule(req: AuthenticatedRequest, res: any) {
        try {
            const { authId } = req.params;
            await this.geographicAuthorizationService.deleteAuthorizationRule(authId);

            res.status(204).send();
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message,
                details: error.details,
            });
        }
    }

    private async getAuthorizedAreas(req: AuthenticatedRequest, res: any) {
        try {
            const { userId } = req.params;
            console.log(`[GeographicAuthorizationRoutes] Getting authorized areas for user: ${userId}`);

            const areas = await this.geographicAuthorizationService.getAuthorizedAreas(userId);
            console.log(`[GeographicAuthorizationRoutes] Found ${areas.length} authorized areas`);

            res.json({
                success: true,
                data: areas,
            });
        } catch (error: any) {
            console.error('[GeographicAuthorizationRoutes] Error getting authorized areas:', error);
            res.status(error.statusCode || 500).json({
                code: error.code || 'INTERNAL_ERROR',
                message: error.message,
                details: error.details,
            });
        }
    }
}
