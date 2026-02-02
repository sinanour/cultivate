# Cultivate - Deployment System

This directory contains the production deployment system for the Cultivate application. The system uses Docker containers orchestrated by Docker Compose, with automated deployment scripts for streamlined operations.

## Overview

The deployment system provides:
- **Containerized packaging** using Docker for web frontend, backend API, and PostgreSQL database
- **Secure database connectivity** using PostgreSQL peer authentication via Unix domain sockets
- **Automated deployment** to remote hosts via SSH
- **Health checking and rollback** capabilities for reliable deployments
- **HTTPS support** with optional certificate management

## Directory Structure

```
deployment/
├── src/                    # TypeScript source code
│   ├── types/             # Type definitions
│   └── index.ts           # Main entry point
├── dockerfiles/           # Dockerfile definitions
├── scripts/               # Database initialization and helper scripts
├── config/                # Docker Compose and environment configurations
├── dist/                  # Compiled JavaScript (generated)
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

## Prerequisites

- Node.js 18+ and npm
- Docker or Finch (for local builds)
  - **Docker**: Standard container runtime (all platforms)
  - **Finch**: AWS's container runtime optimized for macOS (recommended for Apple Silicon)
- Docker Compose (or Finch with built-in compose support)
- SSH access to target deployment hosts

**macOS Production Hosts:** If deploying to macOS, you must configure Finch port forwarding for external access. See [macOS Port Forwarding Setup](#macos-port-forwarding-setup) below.

**Note:** The deployment script automatically detects whether Docker or Finch is available and uses the appropriate commands.

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Usage

The deployment script will be implemented in subsequent tasks. Basic usage:

```bash
# Deploy to a target host
npm start -- deploy <target-host>

# Rollback to previous deployment
npm start -- rollback <target-host>
```

## macOS Port Forwarding Setup

**⚠️ IMPORTANT for macOS Production Hosts**

If you're deploying to a macOS host, Finch's Lima VM only forwards ports to localhost by default. To make your application accessible from external machines, you must configure port forwarding **before deployment**.

### Quick Setup

Run this script on the macOS target host:

```bash
# Transfer the script to the macOS host
scp deployment/scripts/configure-finch-ports.sh user@macos-host:~/

# SSH to the macOS host
ssh user@macos-host

# Run the configuration script with your ports
./configure-finch-ports.sh 8080 1443

# Or use default ports (80, 443)
./configure-finch-ports.sh
```

The script will:
1. Backup your existing Finch configuration
2. Configure port forwarding to 0.0.0.0 (all interfaces)
3. Restart the Finch VM
4. Verify the configuration

### Manual Setup

Alternatively, edit `~/.finch/finch.yaml` on the macOS host:

```yaml
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
  - guestPort: 443
    hostIP: "0.0.0.0"
    hostPort: 1443
```

Then restart: `finch vm stop && finch vm start`

### Why This Is Needed

Finch runs containers in a Lima VM. By default, Lima only forwards ports to 127.0.0.1 (localhost), even when docker-compose specifies 0.0.0.0. The deployment system correctly configures docker-compose.yml, but Lima's network configuration must also be updated.

**For complete details, see:** [docs/MACOS_DEPLOYMENT.md](docs/MACOS_DEPLOYMENT.md)

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Clean build artifacts
npm clean
```

## Architecture

### Containers

1. **Web Frontend Container**: Nginx serving React/Vite static assets
2. **Backend API Container**: Node.js/Express/Prisma application
3. **Database Container**: PostgreSQL with peer authentication

### Security Model

- Database uses peer authentication (no passwords)
- Backend connects via Unix domain socket
- Only web frontend exposed to host network
- Certificates mounted as read-only volumes for HTTPS

### Deployment Workflow

1. Establish SSH connection to target host
2. Check and install dependencies (Docker, Docker Compose)
3. Build or transfer Docker images
4. Deploy configuration files
5. Start containers with health checks
6. Verify deployment success

## Configuration

Configuration is managed through:
- Environment variables in `.env` files
- Docker Compose configuration in `docker-compose.yml`
- TypeScript configuration interfaces

See the design document for detailed configuration options.

## Testing

The system includes:
- **Unit tests**: Specific examples and edge cases
- **Property-based tests**: Universal correctness properties
- **Integration tests**: End-to-end deployment scenarios

Run tests with `npm test`.

## Documentation

- [Requirements Document](../.kiro/specs/production-deployment-system/requirements.md)
- [Design Document](../.kiro/specs/production-deployment-system/design.md)
- [Implementation Tasks](../.kiro/specs/production-deployment-system/tasks.md)

## License

See LICENSE file in the project root.
