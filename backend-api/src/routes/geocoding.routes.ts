import { Router, Response } from 'express';
import { GeocodingService } from '../services/geocoding.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/express.types';
import { z } from 'zod';

// Validation schema for geocoding search
const GeocodingSearchSchema = z.object({
    q: z.string().min(1, 'Address query is required').max(500, 'Address query too long'),
});

export class GeocodingRoutes {
    private router: Router;

    constructor(
        private geocodingService: GeocodingService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // GET /api/v1/geocoding/search?q=address
        this.router.get(
            '/search',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            ValidationMiddleware.validateQuery(GeocodingSearchSchema),
            this.search.bind(this)
        );
    }

    private async search(req: AuthenticatedRequest, res: Response) {
        try {
            const { q } = req.query;
            const results = await this.geocodingService.geocodeAddress(q as string);
            
            res.status(200).json({ 
                success: true, 
                data: results 
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('required')) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
                if (error.message.includes('Geocoding failed')) {
                    return res.status(502).json({
                        code: 'EXTERNAL_API_ERROR',
                        message: error.message,
                        details: {},
                    });
                }
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while geocoding address',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
