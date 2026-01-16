import { Router, Response } from 'express';
import { ActivityService } from '../services/activity.service';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../middleware/authorization.middleware';
import { AuditLoggingMiddleware } from '../middleware/audit-logging.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import { parseFilterParameters, ParsedFilterRequest } from '../middleware/filter-parser.middleware';
import {
    ActivityCreateSchema,
    ActivityUpdateSchema,
    ActivityQuerySchema,
    ActivityVenueAssociationSchema,
    UuidParamSchema,
} from '../utils/validation.schemas';
import { AuthenticatedRequest } from '../types/express.types';
import { generateCSVFilename } from '../utils/csv.utils';
import { csvUpload } from '../middleware/upload.middleware';

export class ActivityRoutes {
    private router: Router;

    constructor(
        private activityService: ActivityService,
        private authMiddleware: AuthMiddleware,
        private authorizationMiddleware: AuthorizationMiddleware,
        private auditLoggingMiddleware: AuditLoggingMiddleware
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(
            '/',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            parseFilterParameters,
            ValidationMiddleware.validateQuery(ActivityQuerySchema),
            this.getAll.bind(this)
        );

        this.router.get(
            '/export',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireAuthenticated(),
            this.exportCSV.bind(this)
        );

        this.router.post(
            '/import',
            this.authMiddleware.authenticate(),
            this.authorizationMiddleware.requireEditor(),
            csvUpload.single('file'),
            this.importCSV.bind(this)
        );

      this.router.get(
          '/:id',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireAuthenticated(),
          ValidationMiddleware.validateParams(UuidParamSchema),
          this.getById.bind(this)
      );

      this.router.get(
          '/:id/venues',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireAuthenticated(),
          ValidationMiddleware.validateParams(UuidParamSchema),
          this.getVenues.bind(this)
      );

      this.router.post(
          '/',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireEditor(),
          ValidationMiddleware.validateBody(ActivityCreateSchema),
          this.auditLoggingMiddleware.logEntityModification('ACTIVITY'),
          this.create.bind(this)
      );

      this.router.post(
          '/:id/venues',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireEditor(),
          ValidationMiddleware.validateParams(UuidParamSchema),
          ValidationMiddleware.validateBody(ActivityVenueAssociationSchema),
          this.auditLoggingMiddleware.logEntityModification('ACTIVITY'),
          this.associateVenue.bind(this)
      );

      this.router.put(
          '/:id',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireEditor(),
          ValidationMiddleware.validateParams(UuidParamSchema),
          ValidationMiddleware.validateBody(ActivityUpdateSchema),
          this.auditLoggingMiddleware.logEntityModification('ACTIVITY'),
          this.update.bind(this)
      );

      this.router.delete(
          '/:id',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireEditor(),
          ValidationMiddleware.validateParams(UuidParamSchema),
          this.auditLoggingMiddleware.logEntityModification('ACTIVITY'),
          this.delete.bind(this)
      );

      this.router.delete(
          '/:id/venue-history/:venueHistoryId',
          this.authMiddleware.authenticate(),
          this.authorizationMiddleware.requireEditor(),
          this.auditLoggingMiddleware.logEntityModification('ACTIVITY'),
          this.removeVenue.bind(this)
      );
  }

    private async getAll(req: AuthenticatedRequest & ParsedFilterRequest, res: Response) {
        try {
            // Query parameters are already validated and normalized by ActivityQuerySchema
            const {
                page,
                limit,
                geographicAreaId
            } = req.query as any;

            // Removed legacy parameters: activityTypeIds, activityCategoryIds, status, populationIds, startDate, endDate
            // Use filter[activityTypeId], filter[status], filter[populationIds], filter[startDate], filter[endDate] instead

            // Extract parsed filter and fields from middleware
            const filter = req.parsedFilter;
            const fields = req.parsedFields;

            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
            const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;

            // Validate explicit geographic area access
            if (geographicAreaId && hasGeographicRestrictions) {
                const hasAccess = authorizedAreaIds.includes(geographicAreaId);
                if (!hasAccess) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access this geographic area',
                        details: {},
                    });
                }
            }

            // Check if any filters are provided (beyond pagination and geographic area)
            const hasAdvancedFilters = filter && Object.keys(filter).length > 0;

            if (hasAdvancedFilters || fields) {
                // Use flexible filtering method
                const result = await this.activityService.getActivitiesFlexible({
                    page,
                    limit,
                    geographicAreaId,
                    filter,
                    fields,
                    authorizedAreaIds,
                    hasGeographicRestrictions
                });
                res.status(200).json({ success: true, ...result });
            } else if (page !== undefined || limit !== undefined) {
                // Use simple pagination with geographic filter only
                const result = await this.activityService.getAllActivitiesPaginated(
                    page,
                    limit,
                    geographicAreaId,
                    authorizedAreaIds,
                    hasGeographicRestrictions
                );
                res.status(200).json({ success: true, ...result });
            } else {
                // No pagination, no advanced filters
                const activities = await this.activityService.getAllActivities(
                    geographicAreaId,
                    authorizedAreaIds,
                    hasGeographicRestrictions
                );
                res.status(200).json({ success: true, data: activities });
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
            if (error instanceof Error && error.message.includes('Page')) {
                res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: {},
                });
                return;
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while fetching activities',
                details: {},
            });
        }
    }

    private async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const activity = await this.activityService.getActivityById(id, userId, userRole);
            res.status(200).json({ success: true, data: activity });
        } catch (error) {
            if (error instanceof Error && error.message === 'Activity not found') {
          res.status(404).json({
              code: 'NOT_FOUND',
              message: error.message,
              details: {},
          });
          return;
          }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this activity',
                    details: {},
                });
                return;
            }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while fetching activity',
              details: {},
          });
      }
  }

    private async getVenues(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const venues = await this.activityService.getActivityVenues(id, userId, userRole);
            res.status(200).json({ success: true, data: venues });
        } catch (error) {
            if (error instanceof Error && error.message === 'Activity not found') {
          res.status(404).json({
              code: 'NOT_FOUND',
              message: error.message,
              details: {},
          });
          return;
          }
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: 'You do not have permission to access this activity',
                    details: {},
                });
                return;
            }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while fetching activity venues',
              details: {},
          });
      }
  }

    private async create(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const activityData = {
                ...req.body,
                startDate: new Date(req.body.startDate),
                endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
                createdBy: req.user?.userId,
            };
            const activity = await this.activityService.createActivity(activityData);
            res.status(201).json({ success: true, data: activity });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('required') || error.message.includes('must be after')) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: error.message,
                details: {},
            });
            return;
          }
          if (error.message.includes('not found')) {
            res.status(400).json({
                code: 'INVALID_REFERENCE',
                message: error.message,
                details: {},
            });
            return;
              }
          }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while creating activity',
              details: {},
          });
      }
  }

    private async update(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            const activityData: any = {
                ...req.body,
                startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
            };

            // Handle endDate: preserve null for clearing, convert string to Date, or omit if undefined
            if ('endDate' in req.body) {
                if (req.body.endDate === null) {
                    activityData.endDate = null; // Explicitly clear endDate
                } else if (req.body.endDate) {
                    activityData.endDate = new Date(req.body.endDate); // Convert to Date
                }
                // If undefined, omit from activityData (already handled by spread)
            }

            const activity = await this.activityService.updateActivity(
                id,
                activityData,
                userId,
                userRole
            );
            res.status(200).json({ success: true, data: activity });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to update this activity',
                        details: {},
                    });
                    return;
                }
                if (error.message === 'Activity not found') {
            res.status(404).json({
                code: 'NOT_FOUND',
                message: error.message,
                details: {},
            });
            return;
          }
                if (error.message === 'VERSION_CONFLICT') {
                    res.status(409).json({
                        code: 'VERSION_CONFLICT',
                        message: 'The activity has been modified by another user. Please refresh and try again.',
                        details: {},
                    });
                    return;
                }
          if (error.message.includes('must be after')) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: error.message,
                details: {},
            });
            return;
          }
          if (error.message.includes('not found')) {
            res.status(400).json({
                code: 'INVALID_REFERENCE',
                message: error.message,
                details: {},
            });
            return;
              }
          }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while updating activity',
              details: {},
          });
      }
  }

    private async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const userRole = req.user?.role;

            await this.activityService.deleteActivity(id, userId, userRole);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to delete this activity',
                        details: {},
                    });
                    return;
                }
                if (error.message === 'Activity not found') {
          res.status(404).json({
              code: 'NOT_FOUND',
              message: error.message,
              details: {},
          });
          return;
          }
            }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while deleting activity',
              details: {},
          });
      }
  }

    private async associateVenue(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { venueId, effectiveFrom } = req.body;
            const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : null;

            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
            const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;

            const association = await this.activityService.associateVenue(
                id,
                venueId,
                effectiveDate,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            res.status(201).json({ success: true, data: association });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                    res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: error.message,
                        details: {},
                    });
                    return;
                }
                if (error.message.includes('not found')) {
            res.status(404).json({
                code: 'NOT_FOUND',
                message: error.message,
                details: {},
            });
            return;
          }
                if (error.message.includes('already associated') || error.message.includes('already exists')) {
            res.status(400).json({
                code: 'DUPLICATE_ASSOCIATION',
                message: error.message,
                details: {},
            });
            return;
              }
          }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while associating venue',
              details: {},
          });
      }
  }

    private async removeVenue(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id, venueHistoryId } = req.params;
            await this.activityService.removeVenueAssociation(id, venueHistoryId);
            res.status(204).send();
        } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            res.status(404).json({
                code: 'NOT_FOUND',
                message: error.message,
                details: {},
            });
              return;
          }
          res.status(500).json({
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while removing venue association',
              details: {},
          });
      }
  }

    private async exportCSV(req: AuthenticatedRequest, res: Response) {
        try {
            const geographicAreaId = req.query.geographicAreaId as string | undefined;

            // Extract authorization info from request
            const authorizedAreaIds = req.user?.authorizedAreaIds || [];
            const hasGeographicRestrictions = req.user?.hasGeographicRestrictions || false;

            // Validate explicit geographic area access
            if (geographicAreaId && hasGeographicRestrictions) {
                const hasAccess = authorizedAreaIds.includes(geographicAreaId);
                if (!hasAccess) {
                    return res.status(403).json({
                        code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                        message: 'You do not have permission to access this geographic area',
                        details: {},
                    });
                }
            }

            const csv = await this.activityService.exportActivitiesToCSV(
                geographicAreaId,
                authorizedAreaIds,
                hasGeographicRestrictions
            );
            const filename = generateCSVFilename('activities');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } catch (error) {
            if (error instanceof Error && error.message.includes('GEOGRAPHIC_AUTHORIZATION_DENIED')) {
                res.status(403).json({
                    code: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    message: error.message,
                    details: {},
                });
                return;
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while exporting activities',
                details: {},
            });
        }
    }

    private async importCSV(req: AuthenticatedRequest, res: Response) {
        try {
            // Validate file exists
            if (!req.file) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'No file uploaded',
                    details: {},
                });
            }

            // Validate file extension
            if (!req.file.originalname.endsWith('.csv')) {
                return res.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: 'File must be a CSV',
                    details: {},
                });
            }

            // Validate file size
            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(413).json({
                    code: 'FILE_TOO_LARGE',
                    message: 'File exceeds 10MB limit',
                    details: {},
                });
            }

            // Process import
            const result = await this.activityService.importActivitiesFromCSV(req.file.buffer);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            if (error instanceof Error && error.message.includes('Invalid CSV format')) {
                return res.status(400).json({
                    code: 'INVALID_CSV',
                    message: error.message,
                    details: {},
                });
            }
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'An error occurred while importing activities',
                details: {},
            });
        }
    }

    getRouter(): Router {
        return this.router;
    }
}