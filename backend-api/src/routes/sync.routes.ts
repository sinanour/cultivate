import { Router, Response } from 'express';
import { SyncService } from '../services/sync.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { BatchSyncSchema } from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';

export class SyncRoutes {
    private router: Router;

    constructor(
        private syncService: SyncService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post(
            '/batch',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            ValidationMiddleware.validateBody(BatchSyncSchema),
            this.batchSync.bind(this)
        );
    }

    private async batchSync(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { operations } = req.body;

            // Convert timestamp strings to Date objects
            const processedOperations = operations.map((op: any) => ({
                ...op,
                timestamp: new Date(op.timestamp),
            }));

            const result = await this.syncService.processBatchSync(processedOperations);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                code: 'SYNC_ERROR',
                message: 'An error occurred during batch synchronization',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}
