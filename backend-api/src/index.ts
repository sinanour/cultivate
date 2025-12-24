import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPrismaClient, disconnectPrisma } from './utils/prisma.client';
import { UserRepository } from './repositories/user.repository';
import { ActivityTypeRepository } from './repositories/activity-type.repository';
import { RoleRepository } from './repositories/role.repository';
import { AuthService } from './services/auth.service';
import { ActivityTypeService } from './services/activity-type.service';
import { RoleService } from './services/role.service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { AuthorizationMiddleware } from './middleware/authorization.middleware';
import { AuthRoutes } from './routes/auth.routes';
import { ActivityTypeRoutes } from './routes/activity-type.routes';
import { RoleRoutes } from './routes/role.routes';

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

// Initialize services
const authService = new AuthService(userRepository);
const activityTypeService = new ActivityTypeService(activityTypeRepository);
const roleService = new RoleService(roleRepository);

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

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// API Routes
app.use('/api/auth', authRoutes.getRouter());
app.use('/api/activity-types', activityTypeRoutes.getRouter());
app.use('/api/roles', roleRoutes.getRouter());

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
