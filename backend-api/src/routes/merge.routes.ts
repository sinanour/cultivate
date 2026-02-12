import { Router, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/express.types';
import { z } from 'zod';
import { ParticipantMergeService } from '../services/merge/participant-merge.service';
import { ActivityMergeService } from '../services/merge/activity-merge.service';
import { VenueMergeService } from '../services/merge/venue-merge.service';
import { GeographicAreaMergeService } from '../services/merge/geographic-area-merge.service';
import { ActivityTypeMergeService } from '../services/merge/activity-type-merge.service';
import { PopulationMergeService } from '../services/merge/population-merge.service';
import { MergeRequest, MergeResponse, MergeErrorResponse } from '../types/merge.types';
import { AppError } from '../types/errors.types';

// Validation schemas
const MergeRequestSchema = z.object({
  sourceId: z.string().uuid('Source ID must be a valid UUID'),
  reconciledFields: z.record(z.any()).optional(),
});

const UuidParamSchema = z.object({
  destinationId: z.string().uuid('Destination ID must be a valid UUID'),
});

/**
 * Routes for merging records across entity types
 */
export class MergeRoutes {
  private router: Router;
  private participantMergeService: ParticipantMergeService;
  private activityMergeService: ActivityMergeService;
  private venueMergeService: VenueMergeService;
  private geographicAreaMergeService: GeographicAreaMergeService;
  private activityTypeMergeService: ActivityTypeMergeService;
  private populationMergeService: PopulationMergeService;

  constructor(
    private authMiddleware: AuthMiddleware,
    private authorizationMiddleware: AuthorizationMiddleware,
    private auditLoggingMiddleware: AuditLoggingMiddleware
  ) {
    this.router = Router();
    this.participantMergeService = new ParticipantMergeService();
    this.activityMergeService = new ActivityMergeService();
    this.venueMergeService = new VenueMergeService();
    this.geographicAreaMergeService = new GeographicAreaMergeService();
    this.activityTypeMergeService = new ActivityTypeMergeService();
    this.populationMergeService = new PopulationMergeService();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Participant merge
    this.router.post(
      '/participants/:destinationId/merge',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireEditor(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(MergeRequestSchema),
      this.auditLoggingMiddleware.logEntityModification('PARTICIPANT'),
      this.mergeParticipants.bind(this)
    );

    // Activity merge
    this.router.post(
      '/activities/:destinationId/merge',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireEditor(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(MergeRequestSchema),
      this.auditLoggingMiddleware.logEntityModification('ACTIVITY'),
      this.mergeActivities.bind(this)
    );

    // Venue merge
    this.router.post(
      '/venues/:destinationId/merge',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireEditor(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(MergeRequestSchema),
      this.auditLoggingMiddleware.logEntityModification('VENUE'),
      this.mergeVenues.bind(this)
    );

    // Geographic area merge
    this.router.post(
      '/geographic-areas/:destinationId/merge',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireEditor(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(MergeRequestSchema),
      this.auditLoggingMiddleware.logEntityModification('GEOGRAPHIC_AREA'),
      this.mergeGeographicAreas.bind(this)
    );

    // Activity type merge
    this.router.post(
      '/activity-types/:destinationId/merge',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireEditor(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(MergeRequestSchema),
      this.auditLoggingMiddleware.logEntityModification('ACTIVITY_TYPE'),
      this.mergeActivityTypes.bind(this)
    );

    // Population merge
    this.router.post(
      '/populations/:destinationId/merge',
      this.authMiddleware.authenticate(),
      this.authorizationMiddleware.requireEditor(),
      ValidationMiddleware.validateParams(UuidParamSchema),
      ValidationMiddleware.validateBody(MergeRequestSchema),
      this.auditLoggingMiddleware.logEntityModification('POPULATION'),
      this.mergePopulations.bind(this)
    );
  }

  /**
   * Merge two participant records
   */
  private async mergeParticipants(req: AuthenticatedRequest, res: Response) {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body as MergeRequest;

      // Validate source and destination are different
      if (sourceId === destinationId) {
        throw new AppError('INVALID_MERGE', 'Cannot merge a record with itself', 400);
      }

      const destinationEntity = await this.participantMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields
      );

      const response: MergeResponse<typeof destinationEntity> = {
        success: true,
        destinationEntity,
        message: 'Participants merged successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      this.handleMergeError(error, res);
    }
  }

  /**
   * Merge two activity records
   */
  private async mergeActivities(req: AuthenticatedRequest, res: Response) {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body as MergeRequest;

      if (sourceId === destinationId) {
        throw new AppError('INVALID_MERGE', 'Cannot merge a record with itself', 400);
      }

      const destinationEntity = await this.activityMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields
      );

      const response: MergeResponse<typeof destinationEntity> = {
        success: true,
        destinationEntity,
        message: 'Activities merged successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      this.handleMergeError(error, res);
    }
  }

  /**
   * Merge two venue records
   */
  private async mergeVenues(req: AuthenticatedRequest, res: Response) {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body as MergeRequest;

      if (sourceId === destinationId) {
        throw new AppError('INVALID_MERGE', 'Cannot merge a record with itself', 400);
      }

      const destinationEntity = await this.venueMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields
      );

      const response: MergeResponse<typeof destinationEntity> = {
        success: true,
        destinationEntity,
        message: 'Venues merged successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      this.handleMergeError(error, res);
    }
  }

  /**
   * Merge two geographic area records
   */
  private async mergeGeographicAreas(req: AuthenticatedRequest, res: Response) {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body as MergeRequest;

      if (sourceId === destinationId) {
        throw new AppError('INVALID_MERGE', 'Cannot merge a record with itself', 400);
      }

      const destinationEntity = await this.geographicAreaMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields
      );

      const response: MergeResponse<typeof destinationEntity> = {
        success: true,
        destinationEntity,
        message: 'Geographic areas merged successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      this.handleMergeError(error, res);
    }
  }

  /**
   * Merge two activity type records
   */
  private async mergeActivityTypes(req: AuthenticatedRequest, res: Response) {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body as MergeRequest;

      if (sourceId === destinationId) {
        throw new AppError('INVALID_MERGE', 'Cannot merge a record with itself', 400);
      }

      const destinationEntity = await this.activityTypeMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields
      );

      const response: MergeResponse<typeof destinationEntity> = {
        success: true,
        destinationEntity,
        message: 'Activity types merged successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      this.handleMergeError(error, res);
    }
  }

  /**
   * Merge two population records
   */
  private async mergePopulations(req: AuthenticatedRequest, res: Response) {
    try {
      const { destinationId } = req.params;
      const { sourceId, reconciledFields } = req.body as MergeRequest;

      if (sourceId === destinationId) {
        throw new AppError('INVALID_MERGE', 'Cannot merge a record with itself', 400);
      }

      const destinationEntity = await this.populationMergeService.merge(
        sourceId,
        destinationId,
        reconciledFields
      );

      const response: MergeResponse<typeof destinationEntity> = {
        success: true,
        destinationEntity,
        message: 'Populations merged successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      this.handleMergeError(error, res);
    }
  }

  /**
   * Handle merge errors and return appropriate response
   */
  private handleMergeError(error: any, res: Response) {
    if (error instanceof AppError) {
      const response: MergeErrorResponse = {
        success: false,
        error: error.message,
        details: error.code,
      };
      res.status(error.statusCode).json(response);
    } else {
      const response: MergeErrorResponse = {
        success: false,
        error: 'Merge operation failed',
        details: error.message,
      };
      res.status(500).json(response);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
