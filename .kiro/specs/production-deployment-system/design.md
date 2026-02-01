# Design Document: Production Deployment System

## Overview

The Production Deployment System provides a containerized packaging and deployment solution for the Cultivate application. The system uses Docker containers orchestrated by Docker Compose for single-host deployments, with a security-first approach using PostgreSQL peer authentication via Unix domain sockets. An automated deployment script handles the complete workflow from building images to starting containers on remote hosts.

The architecture separates concerns between application containers (web frontend, backend API, database), deployment orchestration (Docker Compose), and deployment automation (deployment script). This separation enables future migration to cloud platforms while maintaining security best practices for on-premise deployments.

**Container Runtime Support:** The system supports both Docker and Finch as container runtimes for local image building. Finch is AWS's open-source container development tool that provides a Docker-compatible CLI optimized for macOS. The deployment script automatically detects the available runtime and uses compatible commands.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Target Host                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Docker Compose Network                     │  │
│  │                                                      │  │
│  │  ┌─────────────────┐                                │  │
│  │  │  Web Frontend   │                                │  │
│  │  │   Container     │                                │  │
│  │  │  (Nginx/Static) │                                │  │
│  │  └────────┬────────┘                                │  │
│  │           │ HTTP/HTTPS                              │  │
│  │           │                                          │  │
│  │  ┌────────▼────────┐      ┌──────────────────┐     │  │
│  │  │  Backend API    │      │    Database      │     │  │
│  │  │   Container     │◄─────┤    Container     │     │  │
│  │  │ (Node.js/Prisma)│ Unix │   (PostgreSQL)   │     │  │
│  │  └─────────────────┘Socket└──────────────────┘     │  │
│  │           │                        │                │  │
│  │           │                        │                │  │
│  │      ┌────▼────────────────────────▼────┐           │  │
│  │      │      Socket Volume (Shared)      │           │  │
│  │      └──────────────────────────────────┘           │  │
│  │                                                      │  │
│  │      ┌──────────────────────────────────┐           │  │
│  │      │    Data Volume (DB Persistence)  │           │  │
│  │      └──────────────────────────────────┘           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Deployment Workflow                      │
│                                                             │
│  Local Machine          SSH Connection        Target Host  │
│  ┌──────────┐          ──────────────►       ┌──────────┐  │
│  │Deployment│                                │  Docker  │  │
│  │  Script  │  1. Check Dependencies         │  Engine  │  │
│  │          │  2. Build/Transfer Images      │          │  │
│  │          │  3. Deploy Compose Config      │  Docker  │  │
│  │          │  4. Start Containers           │ Compose  │  │
│  └──────────┘                                └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Container Architecture

**Web Frontend Container:**
- Base: nginx:alpine or similar lightweight web server
- Contents: Production-built React/Vite static assets
- Ports: 80 (HTTP), 443 (HTTPS - optional)
- Volumes: Optional certificate mount for HTTPS
- Network: Exposed to host, connected to internal Docker network

**Backend API Container:**
- Base: node:lts-alpine
- Contents: Node.js application, Prisma client
- OS User: `apiuser` (maps to PostgreSQL user)
- Volumes: Socket volume (read/write access)
- Network: Internal Docker network only
- Environment: Database connection via Unix socket path

**Database Container:**
- Base: postgres:15-alpine (or latest stable)
- Configuration: Peer authentication enabled, password auth disabled
- Volumes: Socket volume (read/write), data volume (persistence)
- Network: Internal Docker network only
- Users: `apiuser` database user for peer authentication

### Security Model

**Peer Authentication Flow:**
1. Backend API container runs as OS user `apiuser` (UID/GID configured)
2. Database container creates database user `apiuser`
3. PostgreSQL configured with `peer` authentication method
4. Connection via Unix socket maps OS user → database user
5. No passwords stored or transmitted

**Volume Security:**
- Socket volume: Restricted permissions (0770), owned by shared group
- Data volume: Restricted to database container only
- Certificate volume: Read-only mount when HTTPS enabled

**Network Isolation:**
- Internal Docker network for container-to-container communication
- Only web frontend exposed to host network
- Database and backend API not directly accessible from host

## Components and Interfaces

### Component 1: Dockerfile Definitions

**Web Frontend Dockerfile:**
```dockerfile
# Multi-stage build
FROM node:lts-alpine AS builder
WORKDIR /app
COPY web-frontend/package*.json ./
RUN npm ci
COPY web-frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
```

**Backend API Dockerfile:**
```dockerfile
FROM node:lts-alpine

# Create apiuser with specific UID/GID for peer auth
RUN addgroup -g 1001 apiuser && \
    adduser -D -u 1001 -G apiuser apiuser

WORKDIR /app
COPY backend-api/package*.json ./
RUN npm ci --only=production
COPY backend-api/ ./

# Generate Prisma client
RUN npx prisma generate

USER apiuser
EXPOSE 3000
CMD ["node", "src/index.js"]
```

**Database Dockerfile:**
```dockerfile
FROM postgres:15-alpine

# Create apiuser with matching UID/GID
RUN addgroup -g 1001 apiuser && \
    adduser -D -u 1001 -G apiuser -s /bin/sh apiuser

# Copy initialization scripts
COPY init-db.sh /docker-entrypoint-initdb.d/
COPY pg_hba.conf /etc/postgresql/

ENV POSTGRES_HOST_AUTH_METHOD=peer
ENV POSTGRES_INITDB_ARGS="--auth=peer"

EXPOSE 5432
```

### Component 2: Docker Compose Configuration

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  database:
    build:
      context: .
      dockerfile: Dockerfile.database
    container_name: cultivate_database
    volumes:
      - db_data:/var/lib/postgresql/data
      - db_socket:/var/run/postgresql
    environment:
      - POSTGRES_USER=apiuser
      - POSTGRES_DB=cultivate
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U apiuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: cultivate_backend
    depends_on:
      database:
        condition: service_healthy
    volumes:
      - db_socket:/var/run/postgresql:rw
    environment:
      - DATABASE_URL=postgresql://apiuser@/cultivate?host=/var/run/postgresql
      - NODE_ENV=production
      - PORT=3000
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: cultivate_frontend
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
    volumes:
      - ${CERT_PATH}:/etc/nginx/certs:ro
    environment:
      - BACKEND_URL=/api/v1
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  backend:
    driver: bridge

volumes:
  db_data:
    driver: local
  db_socket:
    driver: local
```

### Component 3: Deployment Script

**deploy.sh Structure:**

```bash
#!/bin/bash

# Main deployment script
# Usage: ./deploy.sh <target-host> [options]

main() {
    parse_arguments "$@"
    validate_prerequisites
    detect_container_runtime
    establish_ssh_connection
    check_target_dependencies
    build_or_transfer_images
    deploy_configuration
    start_containers
    verify_deployment
    display_summary
}

# Function: detect_container_runtime
# Detect available container runtime (Docker or Finch) on local machine
detect_container_runtime() {
    if command -v docker &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        CONTAINER_COMPOSE="docker-compose"
    elif command -v finch &> /dev/null; then
        CONTAINER_RUNTIME="finch"
        CONTAINER_COMPOSE="finch compose"
    else
        echo "Error: Neither Docker nor Finch found on local machine"
        exit 1
    fi
    
    echo "Using container runtime: $CONTAINER_RUNTIME"
}

# Main deployment script
# Usage: ./deploy.sh <target-host> [options]

main() {
    parse_arguments "$@"
    validate_prerequisites
    establish_ssh_connection
    check_target_dependencies
    build_or_transfer_images
    deploy_configuration
    start_containers
    verify_deployment
    display_summary
}

# Function: parse_arguments
# Parse command-line arguments and set configuration
parse_arguments() {
    TARGET_HOST=$1
    BUILD_MODE=${BUILD_MODE:-"local"}  # local or remote
    VERBOSE=${VERBOSE:-false}
    ROLLBACK=${ROLLBACK:-false}
}

# Function: validate_prerequisites
# Check local prerequisites (SSH keys, Docker if building locally)
validate_prerequisites() {
    check_ssh_key_exists
    if [ "$BUILD_MODE" = "local" ]; then
        check_docker_installed
    fi
}

# Function: establish_ssh_connection
# Test SSH connectivity to target host
establish_ssh_connection() {
    ssh -o ConnectTimeout=10 "$TARGET_HOST" "echo 'SSH connection successful'" || exit 1
}

# Function: check_target_dependencies
# Verify Docker and Docker Compose on target, install if missing
check_target_dependencies() {
    detect_target_os
    check_and_install_docker
    check_and_install_docker_compose
}

# Function: detect_target_os
# Detect the operating system distribution on the target host
detect_target_os() {
    # Check if running on macOS
    if [ "$(uname)" = "Darwin" ]; then
        OS_DISTRIBUTION="macos"
        OS_VERSION=$(sw_vers -productVersion)
        PACKAGE_MANAGER="brew"
        echo "Detected OS: macOS $OS_VERSION (using Homebrew)"
        return
    fi
    
    # Check for /etc/os-release (most modern Linux distributions)
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_DISTRIBUTION=$ID
        OS_VERSION=$VERSION_ID
    # Fallback to other detection methods
    elif [ -f /etc/redhat-release ]; then
        OS_DISTRIBUTION="rhel"
    elif [ -f /etc/debian_version ]; then
        OS_DISTRIBUTION="debian"
    else
        echo "Error: Unable to detect OS distribution"
        exit 1
    fi
    
    # Determine package manager based on distribution
    case "$OS_DISTRIBUTION" in
        ubuntu|debian)
            PACKAGE_MANAGER="apt-get"
            ;;
        rhel|centos|fedora|rocky|alma)
            # Use dnf for newer versions, yum for older
            if command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
            else
                PACKAGE_MANAGER="yum"
            fi
            ;;
        amzn)
            # Amazon Linux: AL2023 uses dnf, AL2 uses yum
            if command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
            else
                PACKAGE_MANAGER="yum"
            fi
            ;;
        sles|opensuse*)
            PACKAGE_MANAGER="zypper"
            ;;
        alpine)
            PACKAGE_MANAGER="apk"
            ;;
        *)
            echo "Error: Unsupported OS distribution: $OS_DISTRIBUTION"
            echo "Supported distributions: Ubuntu, Debian, RHEL, CentOS, Fedora, Rocky, AlmaLinux, Amazon Linux, SLES, openSUSE, Alpine, macOS"
            exit 1
            ;;
    esac
    
    echo "Detected OS: $OS_DISTRIBUTION (using $PACKAGE_MANAGER)"
}
    case "$OS_DISTRIBUTION" in
        ubuntu|debian)
            PACKAGE_MANAGER="apt-get"
            ;;
        rhel|centos|fedora|rocky|alma)
            # Use dnf for newer versions, yum for older
            if command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
            else
                PACKAGE_MANAGER="yum"
            fi
            ;;
        amzn)
            # Amazon Linux: AL2023 uses dnf, AL2 uses yum
            if command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
            else
                PACKAGE_MANAGER="yum"
            fi
            ;;
        sles|opensuse*)
            PACKAGE_MANAGER="zypper"
            ;;
        alpine)
            PACKAGE_MANAGER="apk"
            ;;
        *)
            echo "Error: Unsupported OS distribution: $OS_DISTRIBUTION"
            echo "Supported distributions: Ubuntu, Debian, RHEL, CentOS, Fedora, Rocky, AlmaLinux, Amazon Linux, SLES, openSUSE, Alpine"
            exit 1
            ;;
    esac
    
    echo "Detected OS: $OS_DISTRIBUTION (using $PACKAGE_MANAGER)"
}

# Function: build_or_transfer_images
# Build images locally or remotely based on BUILD_MODE
build_or_transfer_images() {
    if [ "$BUILD_MODE" = "local" ]; then
        build_images_locally
        transfer_images_to_target
    else
        build_images_on_target
    fi
}

# Function: deploy_configuration
# Transfer docker-compose.yml and environment files
deploy_configuration() {
    transfer_compose_file
    transfer_environment_config
    transfer_certificates_if_present
}

# Function: start_containers
# Use docker-compose to start all containers
start_containers() {
    ssh "$TARGET_HOST" "cd /opt/cultivate && docker-compose up -d"
}

# Function: verify_deployment
# Check health endpoints and container status
verify_deployment() {
    wait_for_health_checks
    verify_all_containers_running
}
```

### Component 3.1: Container Runtime Detection and Compatibility

**Container Runtime Support:**

The deployment system supports both Docker and Finch as container runtimes for both local image building and target host deployment. This provides flexibility for developers on different platforms, particularly macOS users who may prefer Finch.

**Local Machine Runtime Detection:**

For local image building, the system detects the available container runtime on the development machine.

**Target Host Runtime Detection:**

For target host deployment, the system detects whether the target is running Docker or Finch and uses the appropriate commands for all container operations.

**Runtime Detection Logic:**

```typescript
interface ContainerRuntime {
    name: 'docker' | 'finch';
    buildCommand: string;
    composeCommand: string;
    available: boolean;
}

async function detectContainerRuntime(): Promise<ContainerRuntime> {
    // Check for Docker first (most common)
    const dockerAvailable = await checkCommand('docker --version');
    if (dockerAvailable) {
        return {
            name: 'docker',
            buildCommand: 'docker',
            composeCommand: 'docker-compose',
            available: true
        };
    }
    
    // Check for Finch (macOS alternative)
    const finchAvailable = await checkCommand('finch --version');
    if (finchAvailable) {
        return {
            name: 'finch',
            buildCommand: 'finch',
            composeCommand: 'finch compose',
            available: true
        };
    }
    
    throw new Error('No container runtime found. Please install Docker or Finch.');
}
```

**macOS Target Host Support:**

When deploying to a macOS target host:

1. **OS Detection**: The system detects macOS using `uname` command
2. **Finch Check**: Verifies Finch is installed on the target
3. **Installation Guidance**: If Finch is not installed, provides installation instructions
4. **Command Adaptation**: Uses `finch` and `finch compose` commands instead of `docker` and `docker-compose`
5. **Compose Compatibility**: Finch's built-in compose support works identically to Docker Compose

**macOS Dependency Management:**

```typescript
async function checkMacOSDependencies(sshClient: SSHClient): Promise<DependencyCheckSummary> {
    // Check for Finch installation
    const finchCheck = await sshClient.executeCommand('command -v finch');
    
    if (finchCheck.exitCode !== 0) {
        return {
            docker: {
                installed: false,
                meetsMinimum: false,
                error: 'Finch not installed on macOS target'
            },
            dockerCompose: {
                installed: false,
                meetsMinimum: false,
                error: 'Finch not installed on macOS target'
            },
            allDependenciesMet: false
        };
    }
    
    // Verify Finch version
    const versionResult = await sshClient.executeCommand('finch --version');
    const version = parseFinchVersion(versionResult.stdout);
    
    // Finch includes compose built-in, so both are satisfied
    return {
        docker: {
            installed: true,
            version,
            meetsMinimum: true
        },
        dockerCompose: {
            installed: true,
            version,
            meetsMinimum: true
        },
        allDependenciesMet: true
    };
}
```

**Finch Installation Instructions for macOS:**

When Finch is not found on a macOS target, the deployment script provides:

```bash
echo "Finch is not installed on the target macOS system."
echo "To install Finch, run the following commands on the target host:"
echo ""
echo "  # Using Homebrew:"
echo "  brew install --cask finch"
echo ""
echo "  # Or download from GitHub:"
echo "  # https://github.com/runfinch/finch/releases"
echo ""
echo "After installation, initialize Finch:"
echo "  finch vm init"
```
    }
    
    throw new Error('No container runtime found. Please install Docker or Finch.');
}
```

**Command Compatibility:**

Both Docker and Finch support the same CLI commands for image building:

| Operation | Docker Command | Finch Command | Compatible |
|-----------|---------------|---------------|------------|
| Build image | `docker build` | `finch build` | ✅ Yes |
| Tag image | `docker tag` | `finch tag` | ✅ Yes |
| Save image | `docker save` | `finch save` | ✅ Yes |
| Load image | `docker load` | `finch load` | ✅ Yes |
| List images | `docker images` | `finch images` | ✅ Yes |
| Remove image | `docker rmi` | `finch rmi` | ✅ Yes |
| Compose up | `docker-compose up` | `finch compose up` | ✅ Yes |
| Compose down | `docker-compose down` | `finch compose down` | ✅ Yes |

**Implementation Strategy:**

```typescript
class ImageBuilder {
    private runtime: ContainerRuntime;
    
    constructor(runtime: ContainerRuntime) {
        this.runtime = runtime;
    }
    
    async buildImage(dockerfile: string, tag: string, context: string): Promise<void> {
        const command = `${this.runtime.buildCommand} build -f ${dockerfile} -t ${tag} ${context}`;
        await executeCommand(command);
    }
    
    async saveImage(tag: string, outputPath: string): Promise<void> {
        const command = `${this.runtime.buildCommand} save ${tag} -o ${outputPath}`;
        await executeCommand(command);
    }
}
```

**Finch-Specific Considerations:**

1. **macOS Optimization**: Finch uses a lightweight VM optimized for macOS, providing better performance than Docker Desktop on Apple Silicon
2. **CLI Compatibility**: Finch intentionally maintains Docker CLI compatibility, making it a drop-in replacement
3. **Compose Support**: Finch includes built-in compose support via `finch compose` (no separate installation needed)
4. **Image Format**: Finch uses the same OCI image format as Docker, ensuring full compatibility
5. **Registry Support**: Finch supports the same container registries as Docker (Docker Hub, ECR, etc.)

**Target Host Requirements:**

- Linux target hosts use Docker for running containers
- macOS target hosts use Finch for running containers
- Finch is only used on macOS systems (both development and target)
- Images built with either Docker or Finch are fully compatible across platforms
- Docker Compose and Finch Compose configurations are identical and interchangeable

### Component 3.2: macOS/Finch Filesystem Boundary Constraints

**Critical Architectural Constraint for macOS Targets:**

When deploying to macOS targets using Finch, there is a fundamental filesystem boundary issue that must be understood and addressed. This constraint affects all file path configurations and volume mounts.

**The Filesystem Boundary Problem:**

Finch on macOS runs containers inside a Lima-managed Linux VM. This creates a filesystem boundary between the macOS host and the Linux VM where containers actually execute:

```
┌─────────────────────────────────────────────────────────┐
│                    macOS Host                           │
│                                                         │
│  /Users/username/  ✅ Mounted in VM                     │
│  /opt/cultivate/   ❌ NOT mounted in VM                 │
│  /var/log/         ❌ NOT mounted in VM                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Lima Linux VM (Finch)                   │ │
│  │                                                   │ │
│  │  Only sees:                                       │ │
│  │  - /Users (mounted from host)                     │ │
│  │  - Sometimes /Volumes (if configured)             │ │
│  │  - VM-internal paths only                         │ │
│  │                                                   │ │
│  │  Containers run HERE, not on macOS host          │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Why This Matters:**

1. **File paths passed to `finch compose` must exist inside the VM**, not just on the macOS host
2. **Default VM mounts**: Lima typically only mounts `/Users` and sometimes `/Volumes` into the VM
3. **Paths like `/opt` are NOT mounted** by default, so `/opt/cultivate` appears as "no such file or directory" inside the VM
4. **This is NOT a permissions issue** - `chown` and `chmod` on the host won't help because the path doesn't exist in the VM filesystem

**Impact on Deployment Configuration:**

```yaml
# ❌ FAILS on macOS with Finch - /opt not mounted in VM
services:
  database:
    volumes:
      - /opt/cultivate/data:/var/lib/postgresql/data

# ✅ WORKS on macOS with Finch - /Users is mounted
services:
  database:
    volumes:
      - /Users/username/cultivate/data:/var/lib/postgresql/data

# ✅ ALTERNATIVE: Use symlink in home directory
# On host: ln -s /opt/cultivate ~/cultivate
services:
  database:
    volumes:
      - ~/cultivate/data:/var/lib/postgresql/data
```

**Deployment Path Strategy for macOS:**

The deployment system must handle path configuration differently for macOS targets:

```typescript
interface DeploymentPathStrategy {
    targetOS: 'linux' | 'macos';
    deploymentBasePath: string;
    configPath: string;
    logPath: string;
    volumePath: string;
}

function getDeploymentPaths(targetOS: 'linux' | 'macos', username?: string): DeploymentPathStrategy {
    if (targetOS === 'linux') {
        // Linux: Use standard FHS paths
        return {
            targetOS: 'linux',
            deploymentBasePath: '/opt/cultivate',
            configPath: '/opt/cultivate/config',
            logPath: '/var/log/cultivate',
            volumePath: '/opt/cultivate/volumes'
        };
    } else {
        // macOS: Use home directory to ensure VM accessibility
        const homeDir = username ? `/Users/${username}` : '~';
        return {
            targetOS: 'macos',
            deploymentBasePath: `${homeDir}/cultivate`,
            configPath: `${homeDir}/cultivate/config`,
            logPath: `${homeDir}/cultivate/logs`,
            volumePath: `${homeDir}/cultivate/volumes`
        };
    }
}
```

**Configuration File Path Resolution:**

When transferring configuration files to macOS targets:

```typescript
async function deployConfiguration(
    sshClient: SSHClient,
    targetOS: 'linux' | 'macos',
    username: string
): Promise<void> {
    const paths = getDeploymentPaths(targetOS, username);
    
    // Create deployment directory structure
    await sshClient.executeCommand(`mkdir -p ${paths.configPath}`);
    await sshClient.executeCommand(`mkdir -p ${paths.logPath}`);
    await sshClient.executeCommand(`mkdir -p ${paths.volumePath}`);
    
    // Transfer docker-compose.yml with OS-appropriate paths
    const composeContent = generateComposeFile(paths);
    await sshClient.transferFile(
        composeContent,
        `${paths.configPath}/docker-compose.yml`
    );
    
    // Transfer .env file
    const envContent = generateEnvFile(paths);
    await sshClient.transferFile(
        envContent,
        `${paths.configPath}/.env`
    );
}
```

**Volume Path Configuration:**

Docker Compose configuration uses different volume strategies based on the target OS and volume type:

**Critical: Unix Domain Socket Volumes**

Unix domain sockets CANNOT be created on macOS filesystems mounted into the Finch VM. Therefore, the socket volume MUST always use Docker named volumes, never host path mounts:

```yaml
# ✅ CORRECT: Named volume for socket (works on both Linux and macOS)
services:
  database:
    volumes:
      - db_socket:/var/run/postgresql  # Named volume

volumes:
  db_socket:
    driver: local

# ❌ INCORRECT: Host path for socket (fails on macOS)
services:
  database:
    volumes:
      - /Users/username/cultivate/volumes/db_socket:/var/run/postgresql  # Fails!
```

**Data Volume Strategy:**

For data persistence, the strategy differs by OS:

```yaml
# Generated for Linux targets
version: '3.8'
services:
  database:
    volumes:
      - /opt/cultivate/volumes/db_data:/var/lib/postgresql/data  # Host path
      - db_socket:/var/run/postgresql  # Named volume

volumes:
  db_socket:
    driver: local

# Generated for macOS targets
version: '3.8'
services:
  database:
    volumes:
      - db_data:/var/lib/postgresql/data  # Named volume (avoids filesystem issues)
      - db_socket:/var/run/postgresql  # Named volume

volumes:
  db_data:
    driver: local
  db_socket:
    driver: local
```

**Why This Matters:**

1. **Unix sockets require native filesystem support** - They use special file types that don't work on mounted filesystems
2. **macOS → VM boundary breaks socket creation** - Even if the directory is accessible, socket creation fails
3. **Named volumes are VM-internal** - They exist inside the VM's native filesystem where sockets work properly
4. **Data volumes can use host paths on Linux** - Regular files work fine on mounted filesystems, making backups easier

**Symlink Alternative (Advanced):**

For users who prefer `/opt` paths on macOS, the deployment script can create a symlink:

```bash
# On macOS target, create symlink from home directory to /opt
sudo mkdir -p /opt
sudo ln -s /Users/username/cultivate /opt/cultivate

# Then use /opt/cultivate in compose files
# The symlink makes /opt/cultivate accessible via ~/cultivate in the VM
```

**Note:** Even with symlinks, socket volumes must still use named volumes, not host paths.

**Documentation Requirements:**

The deployment system must:

1. **Detect macOS targets** and automatically use named volumes for sockets
2. **Use named volumes for data on macOS** to avoid filesystem boundary issues
3. **Document the socket volume constraint** in error messages
4. **Provide clear guidance** on volume configuration for macOS users
5. **Log volume strategy** in verbose mode to aid troubleshooting

**Error Message Example:**

```
Error: Cannot access path '/opt/cultivate' on macOS target

Finch runs containers in a Linux VM that only mounts certain host directories.
The path '/opt/cultivate' is not accessible inside the VM.

Solutions:
1. Use a path under /Users (recommended):
   DEPLOYMENT_PATH=/Users/username/cultivate

2. Create a symlink in your home directory:
   ln -s /opt/cultivate ~/cultivate
   DEPLOYMENT_PATH=~/cultivate

3. Configure Lima to mount /opt (advanced):
   Edit ~/.finch/finch.yaml to add /opt to mounts

For more information, see: docs/MACOS_DEPLOYMENT.md
```

**Testing Considerations:**

Property tests for macOS deployment must verify:

1. All configured paths are under VM-mounted directories
2. Volume mounts use VM-accessible paths
3. Configuration files are transferred to VM-accessible locations
4. Error messages guide users when paths are inaccessible

This filesystem boundary constraint is a fundamental architectural consideration for macOS deployments and must be handled correctly to ensure successful container orchestration with Finch.

### Component 4: Configuration Management

**Environment Configuration (.env):**
```bash
# HTTP/HTTPS Configuration
HTTP_PORT=80
HTTPS_PORT=443
ENABLE_HTTPS=false

# Certificate Paths (when HTTPS enabled)
CERT_PATH=/path/to/certs

# Database Configuration
POSTGRES_USER=apiuser
POSTGRES_DB=cultivate

# Backend Configuration
NODE_ENV=production
BACKEND_PORT=3000

# Deployment Configuration
DEPLOYMENT_PATH=/opt/cultivate
LOG_PATH=/var/log/cultivate
```

**Certificate Configuration:**
- Certificates stored outside Docker images
- Mounted as read-only volumes when HTTPS enabled
- Support for Let's Encrypt or custom certificates
- Renewal handled independently of container lifecycle

### Component 5: Database Initialization

**init-db.sh:**
```bash
#!/bin/bash
set -e

# Create apiuser if not exists
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER apiuser;
    CREATE DATABASE cultivate OWNER apiuser;
    GRANT ALL PRIVILEGES ON DATABASE cultivate TO apiuser;
EOSQL

# Run Prisma migrations
# Note: This would be triggered by backend container on first start
```

**pg_hba.conf:**
```
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Unix domain socket connections use peer authentication
local   all             all                                     peer

# Reject all other connection types
host    all             all             0.0.0.0/0               reject
host    all             all             ::/0                    reject
```

## Data Models

### Deployment State Model

```typescript
interface DeploymentState {
    version: string;              // Deployment version/tag
    timestamp: Date;              // Deployment timestamp
    targetHost: string;           // Target host identifier
    imageVersions: {
        frontend: string;
        backend: string;
        database: string;
    };
    configurationHash: string;    // Hash of configuration files
    status: 'pending' | 'active' | 'failed' | 'rolled_back';
    healthChecks: HealthCheckResult[];
}

interface HealthCheckResult {
    service: 'frontend' | 'backend' | 'database';
    status: 'healthy' | 'unhealthy';
    timestamp: Date;
    message?: string;
}
```

### Configuration Model

```typescript
interface DeploymentConfiguration {
    network: {
        httpPort: number;
        httpsPort: number;
        enableHttps: boolean;
    };
    volumes: {
        dataPath: string;
        socketPath: string;
        certPath?: string;
    };
    environment: {
        nodeEnv: 'production' | 'staging';
        databaseUrl: string;
        backendPort: number;
    };
    security: {
        apiUserUid: number;
        apiUserGid: number;
        socketPermissions: string;
    };
}
```

### Docker Image Model

```typescript
interface DockerImage {
    name: string;                 // Image name
    tag: string;                  // Image tag/version
    digest: string;               // Image digest (SHA256)
    size: number;                 // Image size in bytes
    buildTimestamp: Date;         // When image was built
    buildHost: 'local' | 'remote'; // Where image was built
}
```

### Container Runtime Model

```typescript
interface ContainerRuntime {
    name: 'docker' | 'finch';     // Runtime name
    buildCommand: string;         // Command for building images
    composeCommand: string;       // Command for compose operations
    available: boolean;           // Whether runtime is available
    version?: string;             // Runtime version string
}
```

**Runtime Detection Flow:**
1. Check for Docker availability (`docker --version`)
2. If Docker not found, check for Finch (`finch --version`)
3. If neither found, throw error with installation guidance
4. Verify runtime functionality by listing images
5. Use detected runtime for all subsequent operations

**Command Mapping:**
- Build: `${runtime.buildCommand} build -f Dockerfile -t tag context`
- Save: `${runtime.buildCommand} save image -o file.tar`
- Load: `${runtime.buildCommand} load -i file.tar`
- Compose: `${runtime.composeCommand} up -d`


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **Configuration via environment variables** (11.1 and 12.5) - These test the same behavior
2. **Health check verification** (2.5, 10.4, 13.3) - These overlap in testing container health validation
3. **Volume access control** (2.4, 4.1, 4.4) - These all test socket volume permissions
4. **Dependency checking** (8.1, 8.2) - Can be combined into a single property about dependency verification

The properties below represent the unique, non-redundant set of correctness properties.

### Container Properties

**Property 1: Static asset accessibility**
*For any* set of static assets built from the React/Vite application, when served by the Web_Frontend_Container, all assets should be accessible via HTTP requests.
**Validates: Requirements 1.1**

**Property 2: Port configuration flexibility**
*For any* valid port number, when configured for the Web_Frontend_Container, the container should respond to HTTP requests on that port.
**Validates: Requirements 1.2**

**Property 3: Conditional HTTPS enablement**
*For any* valid SSL certificate and key pair, when provided to the Web_Frontend_Container, HTTPS connections on port 443 should succeed.
**Validates: Requirements 1.3, 6.2**

**Property 4: HTTP-only fallback**
*For any* Web_Frontend_Container configuration without certificates, only HTTP connections should succeed and HTTPS connections should fail.
**Validates: Requirements 6.3**

**Property 5: Unix socket connectivity**
*For any* Backend_API_Container connected to a Database_Container, the connection should use a Unix domain socket path (not TCP/IP).
**Validates: Requirements 2.2**

**Property 6: Socket volume exclusivity**
*For any* deployment configuration, only the Backend_API_Container and Database_Container should have mount access to the Socket_Volume.
**Validates: Requirements 2.4, 4.1, 4.4**

**Property 7: Peer authentication mapping**
*For any* connection attempt from the Backend_API_Container to the Database_Container, authentication should succeed if and only if the OS username matches the database username.
**Validates: Requirements 3.3**

**Property 8: Password authentication rejection**
*For any* connection attempt using password authentication to the Database_Container, the connection should be rejected regardless of password correctness.
**Validates: Requirements 3.4**

**Property 9: Socket file creation**
*For any* running Database_Container with Socket_Volume mounted, a PostgreSQL socket file should exist in the Socket_Volume path.
**Validates: Requirements 3.2**

### Volume Properties

**Property 10: Volume persistence after container removal**
*For any* data volume attached to containers, removing the containers should not delete the volume or its contents.
**Validates: Requirements 4.3**

**Property 11: Volume mount verification before startup**
*For any* container with volume dependencies, the container should not start if required volume mounts are unavailable.
**Validates: Requirements 4.5**

**Property 12: Environment variable interpolation**
*For any* environment variable referenced in the Docker_Compose_Configuration, the variable should be correctly substituted with its value when containers start.
**Validates: Requirements 5.5**

### Certificate Properties

**Property 13: Certificate mounting when provided**
*For any* valid certificate files in the configured certificate path, the files should be accessible inside the Web_Frontend_Container at the expected mount point.
**Validates: Requirements 6.1**

**Property 14: Certificate validation before mounting**
*For any* certificate file that is invalid or corrupted, the Deployment_System should reject the certificate and prevent container startup.
**Validates: Requirements 6.4**

**Property 15: Certificate renewal without rebuild**
*For any* running Web_Frontend_Container, updating certificate files on the host should make new certificates available without rebuilding the Docker image.
**Validates: Requirements 6.5**

### Deployment Script Properties

**Property 16: SSH connectivity verification**
*For any* target host, the Deployment_Script should verify SSH connectivity before attempting any deployment operations.
**Validates: Requirements 7.2, 7.3**

**Property 17: SSH failure error messages**
*For any* SSH connection failure, the Deployment_Script should produce an error message containing the target host and failure reason.
**Validates: Requirements 7.4**

**Property 18: OS distribution detection**
*For any* target host, the Deployment_Script should correctly detect the operating system distribution before attempting package installation.
**Validates: Requirements 8.6**

**Property 19: Package manager selection**
*For any* detected OS distribution, the Deployment_Script should select the appropriate package manager (apt-get, yum, dnf, zypper, or apk) including special handling for Amazon Linux.
**Validates: Requirements 8.7**

**Property 20: Dependency verification and installation**
*For any* target host, the Deployment_Script should check for Docker and Docker Compose, and install them using the correct package manager if missing, including Amazon Linux systems.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.7**

**Property 21: Unsupported OS error handling**
*For any* target host with an unsupported OS distribution, the Deployment_Script should provide an error message listing all supported distributions including Amazon Linux.
**Validates: Requirements 8.8**

**Property 22: Version requirement enforcement**
*For any* target host with Docker or Docker Compose installed, if the version is below the minimum required version, the Deployment_Script should report the version mismatch.
**Validates: Requirements 8.5**

**Property 20: Image transfer verification**
*For any* Docker image transferred to a target host, the Deployment_Script should verify the image digest matches before proceeding.
**Validates: Requirements 9.3, 9.4**

**Property 21: Progress feedback during operations**
*For any* long-running operation (build, transfer, start), the Deployment_Script should output progress messages at regular intervals.
**Validates: Requirements 9.5**

### Container Runtime Properties

**Property 21a: Container runtime detection**
*For any* local machine with Docker or Finch installed, the Deployment_Script should correctly detect the available container runtime.
**Validates: Requirements 9.7**

**Property 21b: Runtime command compatibility**
*For any* container operation (build, save, load), the Deployment_Script should use commands that work with both Docker and Finch.
**Validates: Requirements 9.8**

**Property 21c: Finch support on macOS**
*For any* macOS system with Finch installed and Docker not installed, the Deployment_Script should successfully build images using Finch.
**Validates: Requirements 9.6**

**Property 21d: Image format compatibility**
*For any* image built with Finch on the local machine, the image should be loadable and runnable with Docker on the target host.
**Validates: Requirements 9.3, 9.6**

**Property 21e: Runtime preference order**
*For any* local machine with both Docker and Finch installed, the Deployment_Script should prefer Docker over Finch.
**Validates: Requirements 9.7**

**Property 22: Configuration deployment completeness**
*For any* deployment, all required configuration files (docker-compose.yml, .env, certificates if applicable) should be present on the target host before starting containers.
**Validates: Requirements 10.1, 10.2**

**Property 23: Container startup verification**
*For any* deployment, all containers should reach a healthy state before the Deployment_Script reports success.
**Validates: Requirements 2.5, 10.4, 13.3**

**Property 24: Failure rollback with diagnostics**
*For any* container that fails to start, the Deployment_Script should capture container logs and rollback to the previous deployment state.
**Validates: Requirements 10.5**

### Configuration Properties

**Property 25: Required configuration validation**
*For any* deployment attempt, if required configuration values are missing, the Deployment_System should fail before starting containers.
**Validates: Requirements 11.3**

**Property 26: Default value application**
*For any* optional configuration value not provided, the Deployment_System should use the documented default value.
**Validates: Requirements 11.4**

**Property 27: Secret exclusion from images**
*For any* Docker image built by the Deployment_System, the image should not contain sensitive configuration values (passwords, API keys, certificates).
**Validates: Requirements 11.5**

### Rollback Properties

**Property 28: Previous deployment preservation**
*For any* failed deployment, the previous working deployment's images and configuration should remain available for rollback.
**Validates: Requirements 14.1**

**Property 29: Image version tagging**
*For any* Docker image built or deployed, the image should be tagged with version information that enables rollback.
**Validates: Requirements 14.3**

**Property 30: Configuration restoration on rollback**
*For any* rollback operation, the configuration files should be restored to match the previous deployment version.
**Validates: Requirements 14.4**

**Property 31: Rollback verification**
*For any* rollback operation, all containers should reach a healthy state before the rollback is considered successful.
**Validates: Requirements 14.5**

### Logging Properties

**Property 32: Timestamped deployment logs**
*For any* deployment operation, all log entries should include ISO 8601 timestamps.
**Validates: Requirements 15.1**

**Property 33: Container log capture on failure**
*For any* container that fails health checks, the Deployment_Script should capture and display the container's logs.
**Validates: Requirements 15.2**

**Property 34: Log persistence**
*For any* deployment operation, logs should be written to persistent storage on the target host.
**Validates: Requirements 15.3**

**Property 35: Verbose mode output**
*For any* deployment operation with verbose mode enabled, the output should include detailed diagnostic information not present in normal mode.
**Validates: Requirements 15.5**

## Error Handling

### Container Startup Failures

**Database Container Failures:**
- Socket creation failure: Check volume permissions and ownership
- Peer authentication configuration errors: Verify pg_hba.conf and user mappings
- Data volume mount failures: Verify volume exists and has correct permissions
- Recovery: Rollback to previous deployment, preserve data volume

**Backend API Container Failures:**
- Socket connection failures: Verify socket volume mount and database container health
- Prisma client errors: Check DATABASE_URL format and socket path
- User permission errors: Verify apiuser UID/GID matches between containers
- Recovery: Display container logs, rollback deployment

**Web Frontend Container Failures:**
- Certificate loading errors: Validate certificate files and paths
- Port binding conflicts: Check for existing processes on configured ports
- Static asset missing: Verify build completed successfully
- Recovery: Rollback to previous deployment

### Deployment Script Failures

**SSH Connection Failures:**
- Connection timeout: Verify target host is reachable and SSH service is running
- Authentication failure: Check SSH key permissions and authorized_keys configuration
- Host key verification: Handle new hosts with appropriate warnings
- Recovery: Abort deployment, provide diagnostic information

**Dependency Installation Failures:**
- Docker installation failure: Check package manager availability and network connectivity
- Version incompatibility: Report required vs. available versions
- Permission errors: Verify sudo/root access for installation
- Recovery: Abort deployment, provide manual installation instructions

**Image Build/Transfer Failures:**
- Build failures: Capture and display build logs, check Dockerfile syntax
- Transfer failures: Verify network connectivity and disk space on target
- Image corruption: Verify image digests, retry transfer
- Recovery: Abort deployment, preserve previous images

**Configuration Errors:**
- Missing required values: List all missing configuration keys
- Invalid certificate files: Report certificate validation errors
- Environment variable errors: Show which variables failed interpolation
- Recovery: Abort deployment before starting containers

### Volume and Permission Errors

**Socket Volume Issues:**
- Permission denied: Verify volume ownership and permissions (0770)
- Mount failures: Check Docker volume driver and host filesystem
- Socket file missing: Verify database container created socket
- Recovery: Recreate volume with correct permissions, restart containers

**Data Volume Issues:**
- Disk space exhausted: Report available space, suggest cleanup
- Corruption detected: Attempt recovery, suggest restore from backup
- Mount failures: Verify volume exists and is accessible
- Recovery: Preserve data, attempt remount, rollback if necessary

### Health Check Failures

**Timeout Handling:**
- Database health check timeout: Extend timeout, check database logs
- Backend API timeout: Verify database connectivity, check application logs
- Frontend timeout: Check backend connectivity, verify static assets
- Recovery: Capture logs, rollback deployment

**Persistent Failures:**
- Retry logic: Attempt health checks with exponential backoff
- Failure threshold: Rollback after N consecutive failures
- Diagnostic capture: Collect logs from all containers
- Recovery: Full rollback to previous working deployment

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests as complementary approaches:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property-based tests**: Verify universal properties across randomized inputs

Both are necessary for comprehensive coverage. Unit tests catch concrete bugs in specific scenarios, while property-based tests verify general correctness across a wide input space.

### Property-Based Testing Configuration

**Testing Framework:**
- For shell scripts (deploy.sh): Use `bats` (Bash Automated Testing System) with property test helpers
- For configuration validation: Use Python with `hypothesis` library
- For Docker operations: Use Python with `hypothesis` and `docker-py` library

**Test Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `# Feature: production-deployment-system, Property N: [property text]`

**Example Property Test Structure:**
```python
# Feature: production-deployment-system, Property 10: Volume persistence after container removal
@given(
    container_name=st.text(min_size=1, max_size=20),
    volume_name=st.text(min_size=1, max_size=20),
    volume_data=st.binary(min_size=1, max_size=1024)
)
@settings(max_examples=100)
def test_volume_persists_after_container_removal(container_name, volume_name, volume_data):
    # Create volume and container
    volume = create_volume(volume_name)
    container = create_container(container_name, volumes={volume_name: '/data'})
    
    # Write data to volume
    write_to_volume(container, '/data/test', volume_data)
    
    # Remove container
    remove_container(container)
    
    # Verify volume still exists and contains data
    assert volume_exists(volume_name)
    assert read_from_volume(volume_name, '/data/test') == volume_data
```

### Unit Testing Focus Areas

**Configuration Parsing:**
- Test .env file parsing with various formats
- Test environment variable substitution
- Test certificate path validation
- Test default value application

**SSH Operations:**
- Test SSH connection with valid credentials
- Test SSH connection failure handling
- Test SSH command execution
- Test file transfer operations

**Docker Operations:**
- Test image building with valid Dockerfiles
- Test image tagging and versioning
- Test container creation with various configurations
- Test volume creation and mounting

**Health Checks:**
- Test health check endpoint responses
- Test health check timeout handling
- Test health check retry logic
- Test health check failure detection

**Rollback Operations:**
- Test rollback with previous deployment available
- Test rollback with missing previous deployment
- Test configuration restoration
- Test image version switching

### Integration Testing

**End-to-End Deployment:**
- Deploy to test environment with all components
- Verify all containers start and reach healthy state
- Verify inter-container communication
- Verify external accessibility

**Failure Scenarios:**
- Simulate SSH connection failures
- Simulate Docker daemon unavailability
- Simulate disk space exhaustion
- Simulate network connectivity issues
- Verify rollback in each scenario

**Certificate Management:**
- Deploy with valid certificates
- Deploy without certificates
- Update certificates on running deployment
- Deploy with invalid certificates

**Multi-Environment Testing:**
- Test deployment to multiple target hosts
- Test deployment with different configurations
- Test deployment with different Docker versions
- Test deployment with different OS distributions

### Test Environment Requirements

**Local Testing:**
- Docker and Docker Compose installed
- SSH server for testing SSH operations
- Test certificates for HTTPS testing
- Mock target hosts using containers

**CI/CD Integration:**
- Automated test execution on commits
- Property-based tests run with full iteration count
- Integration tests run against test infrastructure
- Test coverage reporting

**Test Data Management:**
- Generate test certificates for HTTPS testing
- Create test configuration files
- Generate test static assets
- Create test database schemas
