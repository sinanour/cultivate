import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { getPrismaClient, disconnectPrisma } from './utils/prisma.client';
import { openApiSpec } from './utils/openapi.spec';
import { UserRepository } from './repositories/user.repository';
import { ActivityCategoryRepository } from './repositories/activity-category.repository';
import { ActivityTypeRepository } from './repositories/activity-type.repository';
import { RoleRepository } from './repositories/role.repository';
import { PopulationRepository } from './repositories/population.repository';
import { ParticipantPopulationRepository } from './repositories/participant-population.repository';
import { ParticipantRepository } from './repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from './repositories/participant-address-history.repository';
import { GeographicAreaRepository } from './repositories/geographic-area.repository';
import { VenueRepository } from './repositories/venue.repository';
import { ActivityRepository } from './repositories/activity.repository';
import { ActivityVenueHistoryRepository } from './repositories/activity-venue-history.repository';
import { AssignmentRepository } from './repositories/assignment.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { UserGeographicAuthorizationRepository } from './repositories/user-geographic-authorization.repository';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { ActivityCategoryService } from './services/activity-category.service';
import { ActivityTypeService } from './services/activity-type.service';
import { RoleService } from './services/role.service';
import { PopulationService } from './services/population.service';
import { ParticipantService } from './services/participant.service';
import { GeographicAreaService } from './services/geographic-area.service';
import { VenueService } from './services/venue.service';
import { ActivityService } from './services/activity.service';
import { AssignmentService } from './services/assignment.service';
import { AnalyticsService } from './services/analytics.service';
import { MapDataService } from './services/map-data.service';
import { SyncService } from './services/sync.service';
import { GeocodingService } from './services/geocoding.service';
import { GeographicAuthorizationService } from './services/geographic-authorization.service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { AuthorizationMiddleware } from './middleware/authorization.middleware';
import { ErrorHandlerMiddleware } from './middleware/error-handler.middleware';
import { AuditLoggingMiddleware } from './middleware/audit-logging.middleware';
import {
  authRateLimiter,
  smartRateLimiter,
  addRateLimitHeaders,
} from './middleware/rate-limit.middleware';
import { AuthRoutes } from './routes/auth.routes';
import { UserRoutes } from './routes/user.routes';
import { ActivityCategoryRoutes } from './routes/activity-category.routes';
import { ActivityTypeRoutes } from './routes/activity-type.routes';
import { RoleRoutes } from './routes/role.routes';
import { PopulationRoutes } from './routes/population.routes';
import { ParticipantRoutes } from './routes/participant.routes';
import { GeographicAreaRoutes } from './routes/geographic-area.routes';
import { VenueRoutes } from './routes/venue.routes';
import { ActivityRoutes } from './routes/activity.routes';
import { AssignmentRoutes } from './routes/assignment.routes';
import { AnalyticsRoutes } from './routes/analytics.routes';
import { SyncRoutes } from './routes/sync.routes';
import { GeocodingRoutes } from './routes/geocoding.routes';
import { GeographicAuthorizationRoutes } from './routes/geographic-authorization.routes';
import { MapDataRoutes } from './routes/map-data.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client
const prisma = getPrismaClient();

// Initialize repositories
const userRepository = new UserRepository(prisma);
const activityCategoryRepository = new ActivityCategoryRepository(prisma);
const activityTypeRepository = new ActivityTypeRepository(prisma);
const roleRepository = new RoleRepository(prisma);
const populationRepository = new PopulationRepository(prisma);
const participantPopulationRepository = new ParticipantPopulationRepository(prisma);
const participantRepository = new ParticipantRepository(prisma);
const addressHistoryRepository = new ParticipantAddressHistoryRepository(prisma);
const geographicAreaRepository = new GeographicAreaRepository(prisma);
const venueRepository = new VenueRepository(prisma);
const activityRepository = new ActivityRepository(prisma);
const activityVenueHistoryRepository = new ActivityVenueHistoryRepository(prisma);
const assignmentRepository = new AssignmentRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);
const userGeographicAuthorizationRepository = new UserGeographicAuthorizationRepository(prisma);

// Initialize services
const geographicAuthorizationService = new GeographicAuthorizationService(
  userGeographicAuthorizationRepository,
  geographicAreaRepository,
  userRepository,
  auditLogRepository
);
const authService = new AuthService(userRepository, geographicAuthorizationService);
const userService = new UserService(userRepository, userGeographicAuthorizationRepository, prisma);
const activityCategoryService = new ActivityCategoryService(activityCategoryRepository);
const activityTypeService = new ActivityTypeService(activityTypeRepository, activityCategoryRepository);
const roleService = new RoleService(roleRepository);
const populationService = new PopulationService(
  populationRepository,
  participantPopulationRepository,
  participantRepository
);
const participantService = new ParticipantService(
  participantRepository,
  addressHistoryRepository,
  assignmentRepository,
  prisma,
  geographicAreaRepository,
  geographicAuthorizationService
);
const geographicAreaService = new GeographicAreaService(geographicAreaRepository, prisma, geographicAuthorizationService);
const venueService = new VenueService(venueRepository, geographicAreaRepository, geographicAuthorizationService);
const activityService = new ActivityService(
  activityRepository,
  activityTypeRepository,
  activityVenueHistoryRepository,
  venueRepository,
  prisma,
  geographicAreaRepository,
  geographicAuthorizationService
);
const assignmentService = new AssignmentService(
  assignmentRepository,
  activityRepository,
  participantRepository,
  roleRepository
);
const analyticsService = new AnalyticsService(prisma, geographicAreaRepository, geographicAuthorizationService);
const mapDataService = new MapDataService(prisma, geographicAreaRepository, geographicAuthorizationService);
const syncService = new SyncService(prisma);
const geocodingService = new GeocodingService();

// Initialize middleware
const authMiddleware = new AuthMiddleware(authService, userRepository);
const authorizationMiddleware = new AuthorizationMiddleware();
const auditLoggingMiddleware = new AuditLoggingMiddleware(auditLogRepository);

// Initialize routes
const authRoutes = new AuthRoutes(authService, authMiddleware, auditLoggingMiddleware);
const userRoutes = new UserRoutes(userService, authMiddleware, authorizationMiddleware, auditLoggingMiddleware);
const geographicAuthorizationRoutes = new GeographicAuthorizationRoutes(
  geographicAuthorizationService,
  authMiddleware,
  authorizationMiddleware
);
const activityCategoryRoutes = new ActivityCategoryRoutes(
  activityCategoryService,
  authMiddleware,
  authorizationMiddleware,
  auditLoggingMiddleware
);
const activityTypeRoutes = new ActivityTypeRoutes(
  activityTypeService,
  authMiddleware,
  authorizationMiddleware,
  auditLoggingMiddleware
);
const roleRoutes = new RoleRoutes(roleService, authMiddleware, authorizationMiddleware, auditLoggingMiddleware);
const populationRoutes = new PopulationRoutes(populationService, authMiddleware, authorizationMiddleware, auditLoggingMiddleware);
const participantRoutes = new ParticipantRoutes(
  participantService,
  authMiddleware,
  authorizationMiddleware,
  auditLoggingMiddleware
);
const geographicAreaRoutes = new GeographicAreaRoutes(
  geographicAreaService,
  authMiddleware,
  authorizationMiddleware,
  auditLoggingMiddleware
);
const venueRoutes = new VenueRoutes(venueService, authMiddleware, authorizationMiddleware, auditLoggingMiddleware);
const activityRoutes = new ActivityRoutes(activityService, authMiddleware, authorizationMiddleware, auditLoggingMiddleware);
const assignmentRoutes = new AssignmentRoutes(
  assignmentService,
  authMiddleware,
  authorizationMiddleware,
  auditLoggingMiddleware
);
const analyticsRoutes = new AnalyticsRoutes(
  analyticsService,
  authMiddleware,
  authorizationMiddleware
);
const mapDataRoutes = new MapDataRoutes(
  mapDataService,
  authMiddleware,
  authorizationMiddleware
);
const syncRoutes = new SyncRoutes(syncService, authMiddleware, authorizationMiddleware);
const geocodingRoutes = new GeocodingRoutes(geocodingService, authMiddleware, authorizationMiddleware);

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add rate limit headers to all responses
app.use(addRateLimitHeaders);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// API Documentation
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/api/v1/docs/openapi.json', (_req, res) => {
  res.status(200).json(openApiSpec);
});

// API Routes (v1)
app.use('/api/v1/auth', authRateLimiter, authRoutes.getRouter());
app.use('/api/v1/users', smartRateLimiter, userRoutes.getRouter());
app.use('/api/v1/users', smartRateLimiter, geographicAuthorizationRoutes.router);
app.use('/api/v1/activity-categories', smartRateLimiter, activityCategoryRoutes.getRouter());
app.use('/api/v1/activity-types', smartRateLimiter, activityTypeRoutes.getRouter());
app.use('/api/v1/roles', smartRateLimiter, roleRoutes.getRouter());
app.use('/api/v1', smartRateLimiter, populationRoutes.getRouter());
app.use('/api/v1/participants', smartRateLimiter, participantRoutes.getRouter());
app.use('/api/v1/geographic-areas', smartRateLimiter, geographicAreaRoutes.getRouter());
app.use('/api/v1/venues', smartRateLimiter, venueRoutes.getRouter());
app.use('/api/v1/activities', smartRateLimiter, activityRoutes.getRouter());
app.use('/api/v1/activities/:id/participants', smartRateLimiter, assignmentRoutes.getRouter());
app.use('/api/v1/analytics', smartRateLimiter, analyticsRoutes.getRouter());
app.use('/api/v1/map', smartRateLimiter, mapDataRoutes.getRouter());
app.use('/api/v1/sync', smartRateLimiter, syncRoutes.getRouter());
app.use('/api/v1/geocoding', smartRateLimiter, geocodingRoutes.getRouter());

// 404 handler for undefined routes
app.use(ErrorHandlerMiddleware.notFound());

// Global error handler (must be last)
app.use(ErrorHandlerMiddleware.handle());

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await disconnectPrisma();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on port ${PORT}`);
});

export default app;
