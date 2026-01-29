# Docker Container Definitions

This directory contains Dockerfile definitions for the Community Activity Tracker application containers.

## Web Frontend Container

### Dockerfile.frontend

A multi-stage Docker build that:
1. **Build Stage**: Uses `node:lts-alpine` to build the React/Vite application
2. **Serve Stage**: Uses `nginx:alpine` to serve the production-optimized static assets

#### Build Process

The Dockerfile follows these steps:

**Stage 1 - Builder:**
- Copies `package.json` and `package-lock.json`
- Runs `npm ci` for clean dependency installation
- Copies the entire web-frontend source code
- Runs `npm run build` to create production assets in `/app/dist`

**Stage 2 - Nginx Server:**
- Copies built assets from builder stage to `/usr/share/nginx/html`
- Copies custom nginx configuration
- Exposes ports 80 (HTTP) and 443 (HTTPS)
- Starts Nginx in foreground mode

#### Building the Image

From the project root directory:

```bash
docker build -f deployment/dockerfiles/Dockerfile.frontend -t cat-frontend:latest .
```

### nginx.conf

The Nginx configuration provides:

#### HTTP Server (Port 80)
- Always enabled and available
- Serves static assets from `/usr/share/nginx/html`
- Implements SPA routing (all routes serve `index.html`)
- Includes security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Configures caching for static assets (1 year expiration)
- Provides `/health` endpoint for health checks
- Enables gzip compression for better performance

#### HTTPS Server (Port 443)
- **Conditionally enabled** based on certificate presence
- Requires certificates to be mounted at `/etc/nginx/certs/`
- Expected certificate files:
  - `/etc/nginx/certs/cert.pem` - SSL certificate
  - `/etc/nginx/certs/key.pem` - SSL private key
- Uses TLS 1.2 and TLS 1.3 protocols
- Includes HSTS header for enhanced security
- Same routing and caching configuration as HTTP server

#### Conditional HTTPS Configuration

The HTTPS server block is **always present** in the nginx.conf, but it will only function correctly when certificates are mounted. This design allows for:

1. **HTTP-only mode**: Run the container without mounting certificates
   ```bash
   docker run -p 80:80 cat-frontend:latest
   ```
   - HTTP server works normally on port 80
   - HTTPS server on port 443 will fail to start (Nginx will log errors but HTTP continues)

2. **HTTP + HTTPS mode**: Run the container with certificates mounted
   ```bash
   docker run -p 80:80 -p 443:443 \
     -v /path/to/certs:/etc/nginx/certs:ro \
     cat-frontend:latest
   ```
   - Both HTTP (port 80) and HTTPS (port 443) servers work
   - Certificates are mounted read-only for security

#### Certificate Requirements

For HTTPS to work, you need:
- Valid SSL certificate file (`cert.pem`)
- Matching private key file (`key.pem`)
- Both files must be in PEM format
- Files should be mounted to `/etc/nginx/certs/` as a read-only volume

#### Certificate Renewal

Certificates can be renewed without rebuilding the Docker image:
1. Update certificate files on the host system
2. Reload Nginx configuration:
   ```bash
   docker exec cat_frontend nginx -s reload
   ```

### Security Features

- **Security Headers**: Protects against common web vulnerabilities
- **HSTS**: Enforces HTTPS connections (when HTTPS is enabled)
- **TLS Configuration**: Uses modern, secure protocols and ciphers
- **Read-only Certificate Mount**: Prevents container from modifying certificates
- **Gzip Compression**: Reduces bandwidth usage and improves performance

### Health Check

The `/health` endpoint returns:
- Status: 200 OK
- Body: "healthy\n"
- Content-Type: text/plain

This endpoint can be used by Docker health checks and load balancers.

### Production Optimizations

1. **Multi-stage build**: Minimizes final image size by excluding build tools
2. **Alpine base images**: Smaller image size and reduced attack surface
3. **Static asset caching**: 1-year cache for immutable assets
4. **Gzip compression**: Reduces bandwidth and improves load times
5. **HTTP/2**: Enabled for HTTPS connections (better performance)

## Backend API Container

### Dockerfile.backend

A single-stage Docker build that creates a secure Node.js/Express/Prisma backend API container with peer authentication support.

#### Key Features

1. **Peer Authentication Setup**: Creates `apiuser` with UID/GID 1001 to match the database container
2. **Security**: Runs as non-root user (apiuser) for enhanced security
3. **Prisma Client**: Generates Prisma client during build for database access
4. **Production Dependencies**: Installs only production dependencies to minimize image size

#### Build Process

The Dockerfile follows these steps:

1. **Base Image**: Uses `node:lts-alpine` for a lightweight, secure base
2. **User Creation**: Creates `apiuser` with specific UID/GID (1001) for peer authentication
3. **Dependency Installation**: Copies `package.json` and `package-lock.json`, runs `npm ci` (includes devDependencies for building)
4. **Application Copy**: Copies the entire backend-api source code
5. **TypeScript Compilation**: Runs `npm run build` to compile TypeScript to JavaScript in `dist/` directory
6. **Prisma Client Generation**: Runs `npx prisma generate` to create the Prisma client
7. **Cleanup**: Removes devDependencies with `npm prune --production` to reduce image size
8. **Ownership**: Changes ownership of all files to `apiuser`
9. **User Switch**: Switches to `apiuser` for running the application (non-root)
10. **Startup**: Runs the compiled application with `node dist/index.js`

#### Building the Image

From the project root directory:

```bash
docker build -f deployment/dockerfiles/Dockerfile.backend -t cat-backend:latest .
```

#### Peer Authentication

The backend container is designed to connect to PostgreSQL using **peer authentication** via Unix domain sockets:

1. **OS User Mapping**: The container runs as `apiuser` (UID/GID 1001)
2. **Database User**: The database container creates a matching `apiuser` database user
3. **Socket Connection**: The backend connects via Unix socket (not TCP/IP)
4. **Authentication**: PostgreSQL maps the OS user `apiuser` to the database user `apiuser`
5. **No Passwords**: No passwords are stored or transmitted

#### UID/GID Coordination

The UID/GID 1001 is **critical** for peer authentication:
- Backend container: `apiuser` has UID/GID 1001
- Database container: `apiuser` has UID/GID 1001
- Socket volume: Shared between both containers with appropriate permissions
- PostgreSQL: Configured to use peer authentication for local connections

#### Environment Variables

The backend requires the following environment variables:

- `DATABASE_URL`: PostgreSQL connection string using Unix socket
  - Example: `postgresql://apiuser@/community_tracker?host=/var/run/postgresql`
- `NODE_ENV`: Set to `production` for production deployments
- `PORT`: Backend API port (default: 3000)

#### Running the Container

The backend container requires:
1. **Socket Volume**: Shared volume with the database container for Unix socket
2. **Database Dependency**: Database container must be running and healthy
3. **Environment Configuration**: Proper DATABASE_URL pointing to Unix socket

Example with Docker Compose:
```yaml
backend:
  image: cat-backend:latest
  volumes:
    - db_socket:/var/run/postgresql:rw
  environment:
    - DATABASE_URL=postgresql://apiuser@/community_tracker?host=/var/run/postgresql
    - NODE_ENV=production
    - PORT=3000
  depends_on:
    database:
      condition: service_healthy
```

#### Security Features

1. **Non-root User**: Application runs as `apiuser`, not root
2. **Minimal Dependencies**: Only production dependencies installed
3. **No Password Storage**: Uses peer authentication (no passwords)
4. **Alpine Base**: Smaller attack surface with Alpine Linux
5. **Specific UID/GID**: Predictable user mapping for peer authentication

#### Health Check

The backend API should expose a `/health` endpoint for health checks:
- Status: 200 OK when database connection is healthy
- Used by Docker Compose and orchestration tools

#### Production Considerations

1. **Automatic Build**: The TypeScript application is compiled during Docker image build
2. **Prisma Migrations**: Database migrations should be run separately before starting the backend
3. **Socket Permissions**: The socket volume must have appropriate permissions (0770)
4. **Database Readiness**: Backend should wait for database to be ready before accepting requests

## Database Container

### Dockerfile.database

A PostgreSQL container configured for **peer authentication** via Unix domain sockets, eliminating password-based authentication vulnerabilities.

#### Key Features

1. **Peer Authentication**: Uses PostgreSQL peer authentication to map OS users to database users
2. **Security**: No password-based authentication - connections authenticated via Unix socket
3. **User Coordination**: Creates `apiuser` with UID/GID 1001 to match backend container
4. **Initialization Scripts**: Includes database setup and configuration scripts

#### Build Process

The Dockerfile follows these steps:

1. **Base Image**: Uses `postgres:15-alpine` for a lightweight, stable PostgreSQL installation
2. **User Creation**: Creates `apiuser` with UID/GID 1001 to match the backend container
3. **Script Copy**: Copies `init-db.sh` to `/docker-entrypoint-initdb.d/` for automatic execution
4. **Configuration Copy**: Copies `pg_hba.conf` to `/etc/postgresql/` for authentication rules
5. **Environment Setup**: Sets `POSTGRES_HOST_AUTH_METHOD=peer` and `POSTGRES_INITDB_ARGS="--auth=peer"`
6. **Port Exposure**: Exposes port 5432 (though connections will use Unix socket)

#### Building the Image

From the project root directory:

```bash
docker build -f deployment/dockerfiles/Dockerfile.database -t cat-database:latest .
```

#### Peer Authentication Configuration

The database container implements peer authentication through several mechanisms:

1. **pg_hba.conf**: Configures PostgreSQL to use peer authentication for local connections
   - Local connections (Unix socket): Use `peer` authentication method
   - Host connections (TCP/IP): Rejected completely
   
2. **apiuser Creation**: Creates OS user and database user with matching names
   - OS user: `apiuser` with UID/GID 1001
   - Database user: `apiuser` (created by init-db.sh)
   
3. **Socket Volume**: Exposes Unix domain socket on shared volume
   - Socket path: `/var/run/postgresql/`
   - Shared with backend container for peer authentication

#### Required Files

The Dockerfile expects these files to be present (created in Task 5):

1. **init-db.sh**: Database initialization script
   - Creates `apiuser` database user
   - Creates `community_tracker` database
   - Grants necessary privileges
   - Located at: `deployment/dockerfiles/init-db.sh`

2. **pg_hba.conf**: PostgreSQL client authentication configuration
   - Configures peer authentication for local connections
   - Rejects all TCP/IP connections
   - Located at: `deployment/dockerfiles/pg_hba.conf`

#### Environment Variables

The database container uses these environment variables:

- `POSTGRES_HOST_AUTH_METHOD=peer`: Configures peer authentication
- `POSTGRES_INITDB_ARGS="--auth=peer"`: Initializes database with peer authentication
- `POSTGRES_USER=apiuser`: Sets the PostgreSQL superuser (set by Docker Compose)
- `POSTGRES_DB=community_tracker`: Sets the default database name (set by Docker Compose)

#### Running the Container

The database container requires:

1. **Data Volume**: Persistent volume for PostgreSQL data
   - Mount point: `/var/lib/postgresql/data`
   - Ensures data persists across container restarts

2. **Socket Volume**: Shared volume for Unix domain socket
   - Mount point: `/var/run/postgresql`
   - Shared with backend container (read/write access)

3. **Health Check**: PostgreSQL readiness check
   - Command: `pg_isready -U apiuser`
   - Ensures database is ready before backend starts

Example with Docker Compose:
```yaml
database:
  image: cat-database:latest
  volumes:
    - db_data:/var/lib/postgresql/data
    - db_socket:/var/run/postgresql
  environment:
    - POSTGRES_USER=apiuser
    - POSTGRES_DB=community_tracker
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U apiuser"]
    interval: 10s
    timeout: 5s
    retries: 5
```

#### Security Features

1. **No Password Authentication**: Peer authentication eliminates password vulnerabilities
2. **Unix Socket Only**: No TCP/IP connections accepted
3. **User Mapping**: OS user must match database user for authentication
4. **Isolated Network**: Database not exposed to host network
5. **Volume Permissions**: Socket volume restricted to backend and database containers

#### Peer Authentication Flow

1. Backend container runs as OS user `apiuser` (UID 1001)
2. Backend connects to PostgreSQL via Unix socket at `/var/run/postgresql/`
3. PostgreSQL checks the OS user making the connection
4. PostgreSQL maps OS user `apiuser` to database user `apiuser`
5. Connection succeeds without password verification

#### UID/GID Coordination

The UID/GID 1001 is **critical** for peer authentication:
- Database container: `apiuser` has UID/GID 1001
- Backend container: `apiuser` has UID/GID 1001
- Socket volume: Accessible by both containers with matching permissions
- PostgreSQL: Configured to map OS user to database user

#### Data Persistence

The database uses two separate volumes:

1. **Data Volume** (`db_data`):
   - Stores PostgreSQL data files
   - Persists across container restarts and removals
   - Not shared with other containers

2. **Socket Volume** (`db_socket`):
   - Stores Unix domain socket file
   - Shared with backend container
   - Temporary - recreated on container start

#### Production Considerations

1. **Initialization**: The `init-db.sh` script runs only on first container start
2. **Migrations**: Database schema migrations should be managed by Prisma
3. **Backups**: Data volume should be backed up regularly
4. **Monitoring**: Use `pg_isready` for health checks and monitoring
5. **Security**: Never expose PostgreSQL port to host network in production

## Requirements Satisfied

### Web Frontend Container

- **Requirement 1.1**: Serves static assets built from React/Vite application
- **Requirement 1.2**: Supports HTTP connections on configurable port (80)
- **Requirement 1.3**: Supports HTTPS connections when certificates are provided
- **Requirement 1.5**: Uses production-optimized web server (Nginx)
- **Requirement 6.1**: Mounts certificates when provided
- **Requirement 6.2**: Enables HTTPS when certificates are present
- **Requirement 6.3**: Operates in HTTP-only mode when certificates are not provided
- **Requirement 6.5**: Supports certificate renewal without container rebuilds

### Backend API Container

- **Requirement 2.1**: Runs the Node.js/Express/Prisma application
- **Requirement 2.2**: Connects to database via Unix domain socket
- **Requirement 2.3**: Has OS user (apiuser) that maps to database user for peer authentication
- **Requirement 2.4**: Has exclusive access to socket volume (shared only with database)
- **Requirement 11.5**: Keeps sensitive configuration separate from Docker images

### Database Container

- **Requirement 3.1**: Runs PostgreSQL with peer authentication enabled
- **Requirement 3.2**: Exposes Unix domain socket on shared socket volume
- **Requirement 3.3**: Authenticates connections by mapping OS usernames to database usernames
- **Requirement 3.4**: Rejects password-based authentication attempts
- **Requirement 4.2**: Persists data to dedicated volume separate from socket volume
