# Docker Compose Configuration

This directory contains the Docker Compose configuration for the Cultivate production deployment system.

## Files

- **docker-compose.yml**: Main orchestration file defining all services, networks, and volumes
- **.env.example**: Example environment configuration file (copy to `.env` and customize)

## Architecture

The docker-compose.yml defines three services:

### 1. Database Service (`database`)
- **Image**: PostgreSQL 15 Alpine
- **Purpose**: Stores application data with peer authentication
- **Volumes**:
  - `db_data`: Persistent storage for PostgreSQL data
  - `db_socket`: Unix domain socket for peer authentication
- **Health Check**: Verifies PostgreSQL is ready using `pg_isready`
- **Network**: Connected to private `backend` network

### 2. Backend API Service (`backend`)
- **Image**: Node.js LTS Alpine with Express/Prisma
- **Purpose**: Provides REST API for the application
- **Dependencies**: Waits for `database` to be healthy before starting
- **Volumes**:
  - `db_socket`: Shared socket for database connection (read/write)
- **Health Check**: Verifies API responds on `/health` endpoint
- **Network**: Connected to private `backend` network
- **Authentication**: Uses peer authentication via Unix socket

### 3. Web Frontend Service (`frontend`)
- **Image**: Nginx Alpine serving React/Vite static assets
- **Purpose**: Serves the web application to users
- **Dependencies**: Waits for `backend` to be healthy before starting
- **Ports**: Exposes HTTP (80) and HTTPS (443) to the host
- **Volumes**: Optional certificate mount for HTTPS
- **Health Check**: Verifies Nginx is serving content
- **Network**: Connected to private `backend` network

## Networks

- **backend**: Private bridge network for inter-container communication
  - Only the frontend service exposes ports to the host
  - Database and backend are not directly accessible from outside

## Volumes

- **db_data**: Persistent volume for PostgreSQL data
  - Survives container restarts and removals
  - Stores all database tables and data
  
- **db_socket**: Shared volume for Unix domain socket
  - Enables peer authentication between backend and database
  - Provides secure, password-less authentication

## Configuration

### Environment Variables

Create a `.env` file from `.env.example` and configure:

```bash
# HTTP/HTTPS Configuration
HTTP_PORT=80
HTTPS_PORT=443

# Database Configuration
POSTGRES_USER=apiuser
POSTGRES_DB=cultivate

# Backend Configuration
NODE_ENV=production
BACKEND_PORT=3000
```

### HTTPS Configuration

To enable HTTPS:

1. Set `CERT_PATH` in your `.env` file to the directory containing your certificates
2. Uncomment the certificate volume mount in `docker-compose.yml`:
   ```yaml
   volumes:
     - ${CERT_PATH}:/etc/nginx/certs:ro
   ```
3. Ensure your certificates are named correctly (see nginx.conf for expected names)

## Usage

### Starting the Application

```bash
# From the deployment/config directory
docker-compose up -d
```

This will:
1. Build all Docker images (if not already built)
2. Create the private network and volumes
3. Start the database and wait for it to be healthy
4. Start the backend API and wait for it to be healthy
5. Start the frontend web server

### Checking Status

```bash
# View running containers
docker-compose ps

# View logs from all services
docker-compose logs

# View logs from a specific service
docker-compose logs frontend
docker-compose logs backend
docker-compose logs database

# Follow logs in real-time
docker-compose logs -f
```

### Stopping the Application

```bash
# Stop all containers (preserves volumes)
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

### Rebuilding Images

```bash
# Rebuild all images
docker-compose build

# Rebuild a specific service
docker-compose build frontend

# Rebuild and restart
docker-compose up -d --build
```

## Health Checks

All services include health checks that verify:

- **Database**: PostgreSQL is accepting connections
- **Backend**: API responds to HTTP requests on `/health`
- **Frontend**: Nginx is serving content

Health checks run every 10 seconds with:
- 5-second timeout
- 5 retries before marking unhealthy
- Start period to allow initialization

## Dependency Order

The services start in the following order:

1. **Database** starts first
2. **Backend** waits for database to be healthy
3. **Frontend** waits for backend to be healthy

This ensures each service has its dependencies available before starting.

## Security Features

### Peer Authentication
- Backend connects to database via Unix domain socket
- No passwords stored or transmitted
- OS user `apiuser` (UID 1001) maps to database user `apiuser`

### Network Isolation
- Private `backend` network for inter-container communication
- Only frontend ports exposed to host
- Database and backend not directly accessible

### Volume Security
- Socket volume restricted to backend and database containers
- Data volume restricted to database container
- Certificate volume mounted read-only

## Troubleshooting

### Database Connection Issues

If the backend cannot connect to the database:

1. Check database health: `docker-compose ps`
2. Verify socket volume is mounted: `docker inspect cultivate_backend`
3. Check database logs: `docker-compose logs database`
4. Verify apiuser exists in database

### Frontend Cannot Reach Backend

If the frontend cannot connect to the backend:

1. Check backend health: `docker-compose ps`
2. Verify backend is responding: `docker-compose logs backend`
3. Check network connectivity: `docker network inspect deployment_config_backend`

### Port Conflicts

If ports 80 or 443 are already in use:

1. Change `HTTP_PORT` or `HTTPS_PORT` in `.env`
2. Restart: `docker-compose down && docker-compose up -d`

### Volume Permission Issues

If you encounter permission errors:

1. Check volume ownership: `docker volume inspect deployment_config_db_socket`
2. Verify UID/GID match between containers (should be 1001)
3. Recreate volumes: `docker-compose down -v && docker-compose up -d`

## Prerequisites

Before using this configuration, ensure:

1. **Database initialization scripts exist**:
   - `init-db.sh` in project root
   - `pg_hba.conf` in project root
   
2. **Dockerfiles are present**:
   - `deployment/dockerfiles/Dockerfile.frontend`
   - `deployment/dockerfiles/Dockerfile.backend`
   - `deployment/dockerfiles/Dockerfile.database`
   
3. **Application code is available**:
   - `web-frontend/` directory with React/Vite app
   - `backend-api/` directory with Node.js/Express/Prisma app

## Cloud Deployment Considerations

This Docker Compose configuration is designed for single-host deployments. For cloud deployment:

- Replace Docker Compose with cloud-native orchestration (ECS, Cloud Run, etc.)
- Use managed database services instead of containerized PostgreSQL
- Replace Unix socket authentication with cloud-native authentication
- Use cloud load balancers instead of exposing container ports directly
- Use cloud secret management instead of `.env` files

See the main deployment documentation for cloud migration guidance.
