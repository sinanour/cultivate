import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { getPrismaClient, disconnectPrisma } from './utils/prisma.client';
import { openApiSpec } from './utils/openapi.spec';
import { UserRepository } from './repositories/user.repository';
import { ActivityTypeRepository } from './repositories/activity-type.repository';
import { RoleRepository } from './repositories/role.repository';
import { ParticipantRepository } from './repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from './repositories/participant-address-history.repository';
import { GeographicAreaRepository } from './repositories/geographic-area.repository';
import { VenueRepository } from './repositories/venue.repository';
import { ActivityRepository } from './repositories/activity.repository';
import { ActivityVenueHistoryRepository } from './repositories/activity-venue-history.repository';
import { AssignmentRepository } from './repositories/assignment.repository';
import { AuthService } from './services/auth.service';
import { ActivityTypeService } from './services/activity-type.service';
import { RoleService } from './services/role.service';
import { ParticipantService } from './services/participant.service';
import { GeographicAreaService } from './services/geographic-area.service';
import { VenueService } from './services/venue.service';
import { ActivityService } from './services/activity.service';
import { AssignmentService } from './services/assignment.service';
import { AnalyticsService } from './services/analytics.service';
import { SyncService } from './services/sync.service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { AuthorizationMiddleware } from './middleware/authorization.middleware';
import { ErrorHandlerMiddleware } from './middleware/error-handler.middleware';
import {
  authRateLimiter,
  smartRateLimiter,
  addRateLimitHeaders,
} from './middleware/rate-limit.middleware';
import { AuthRoutes } from './routes/auth.routes';
import { ActivityTypeRoutes } from './routes/activity-type.routes';
import { RoleRoutes } from './routes/role.routes';
import { ParticipantRoutes } from './routes/participant.routes';
import { GeographicAreaRoutes } from './routes/geographic-area.routes';
import { VenueRoutes } from './routes/venue.routes';
import { ActivityRoutes } from './routes/activity.routes';
import { AssignmentRoutes } from './routes/assignment.routes';
import { AnalyticsRoutes } from './routes/analytics.routes';
import { SyncRoutes } from './routes/sync.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client
const prisma = getPrismaClient();

// Initialize repositories
const userRepository = new UserRepository(prisma);
const activityTypeRepository = new ActivityTypeRepository(prisma);
const roleRepository = new RoleRepository(prisma);
const participantRepository = new ParticipantRepository(prisma);
const addressHistoryRepository = new ParticipantAddressHistoryRepository(prisma);
const geographicAreaRepository = new GeographicAreaRepository(prisma);
const venueRepository = new VenueRepository(prisma);
const activityRepository = new ActivityRepository(prisma);
const activityVenueHistoryRepository = new ActivityVenueHistoryRepository(prisma);
const assignmentRepository = new AssignmentRepository(prisma);

// Initialize services
const authService = new AuthService(userRepository);
const activityTypeService = new ActivityTypeService(activityTypeRepository);
const roleService = new RoleService(roleRepository);
const participantService = new ParticipantService(
  participantRepository,
  addressHistoryRepository,
  prisma
);
const geographicAreaService = new GeographicAreaService(geographicAreaRepository, prisma);
const venueService = new VenueService(venueRepository, geographicAreaRepository);
const activityService = new ActivityService(
  activityRepository,
  activityTypeRepository,
  activityVenueHistoryRepository,
  venueRepository,
  prisma
);
const assignmentService = new AssignmentService(
  assignmentRepository,
  activityRepository,
  participantRepository,
  roleRepository
);
const analyticsService = new AnalyticsService(prisma, geographicAreaRepository);
const syncService = new SyncService(prisma);

// Initialize middleware
const authMiddleware = new AuthMiddleware(authService);
const authorizationMiddleware = new AuthorizationMiddleware();

// Initialize routes
const authRoutes = new AuthRoutes(authService, authMiddleware);
const activityTypeRoutes = new ActivityTypeRoutes(
  activityTypeService,
  authMiddleware,
  authorizationMiddleware
);
const roleRoutes = new RoleRoutes(roleService, authMiddleware, authorizationMiddleware);
const participantRoutes = new ParticipantRoutes(
  participantService,
  authMiddleware,
  authorizationMiddleware
);
const geographicAreaRoutes = new GeographicAreaRoutes(
  geographicAreaService,
  authMiddleware,
  authorizationMiddleware
);
const venueRoutes = new VenueRoutes(venueService, authMiddleware, authorizationMiddleware);
const activityRoutes = new ActivityRoutes(activityService, authMiddleware, authorizationMiddleware);
const assignmentRoutes = new AssignmentRoutes(
  assignmentService,
  authMiddleware,
  authorizationMiddleware
);
const analyticsRoutes = new AnalyticsRoutes(
  analyticsService,
  authMiddleware,
  authorizationMiddleware
);
const syncRoutes = new SyncRoutes(syncService, authMiddleware, authorizationMiddleware);

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
app.use('/api/v1/activity-types', smartRateLimiter, activityTypeRoutes.getRouter());
app.use('/api/v1/roles', smartRateLimiter, roleRoutes.getRouter());
app.use('/api/v1/participants', smartRateLimiter, participantRoutes.getRouter());
app.use('/api/v1/geographic-areas', smartRateLimiter, geographicAreaRoutes.getRouter());
app.use('/api/v1/venues', smartRateLimiter, venueRoutes.getRouter());
app.use('/api/v1/activities', smartRateLimiter, activityRoutes.getRouter());
app.use('/api/v1/activities/:id/participants', smartRateLimiter, assignmentRoutes.getRouter());
app.use('/api/v1/analytics', smartRateLimiter, analyticsRoutes.getRouter());
app.use('/api/v1/sync', smartRateLimiter, syncRoutes.getRouter());

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
