#!/bin/bash

# Cultivate - Local Database Setup Script
# This script sets up a local PostgreSQL database using Finch container runtime
# 
# Usage: ./setup-local-db.sh [-v|--verbose]
#   -v, --verbose    Enable verbose output with detailed command logging
#
# Why Finch instead of Docker Desktop?
# - Finch is open-source and freely available (Apache 2.0 license)
# - No licensing restrictions for commercial use
# - Lightweight and compatible with Docker CLI commands
# - Works on macOS, Linux, and Windows (via WSL2)
# - Maintained by AWS and the open-source community

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="cultivate-postgres-local"
POSTGRES_VERSION="16-alpine"
POSTGRES_PORT="5432"
POSTGRES_DB="cultivate"
POSTGRES_USER="cultivate_user"
POSTGRES_PASSWORD="cultivate_local_dev_password"
VOLUME_NAME="cultivate-postgres-data"

# Verbose mode flag
VERBOSE=false
if [[ "$1" == "-v" ]] || [[ "$1" == "--verbose" ]]; then
    VERBOSE=true
fi

# Get timestamp for logging
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Print colored output with timestamps
print_info() {
    echo -e "${BLUE}[$(get_timestamp)] [INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(get_timestamp)] [SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(get_timestamp)] [WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(get_timestamp)] [ERROR]${NC} $1"
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[$(get_timestamp)] [VERBOSE]${NC} $1"
    fi
}

# Execute command with logging in verbose mode
execute_command() {
    local cmd="$1"
    print_verbose "Executing: $cmd"
    
    if [ "$VERBOSE" = true ]; then
        eval "$cmd"
    else
        eval "$cmd" &> /dev/null
    fi
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            echo "$ID"
        else
            echo "linux"
        fi
    else
        echo "unknown"
    fi
}

# Check if Finch is installed
check_finch_installed() {
    if command -v finch &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Verify Finch installation is functional
verify_finch_installation() {
    print_info "Verifying Finch installation..."
    
    # Check if finch binary is in PATH
    if ! command -v finch &> /dev/null; then
        print_error "Finch binary not found in PATH after installation"
        return 1
    fi
    
    # Try to get version with retries (PATH may need time to update)
    local max_retries=5
    local retry_count=0
    local wait_time=2
    
    while [ $retry_count -lt $max_retries ]; do
        if finch --version &> /dev/null; then
            local version=$(finch --version 2>/dev/null)
            print_success "Finch installation verified: $version"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            print_info "Waiting for Finch to be available (attempt $retry_count/$max_retries)..."
            sleep $wait_time
            wait_time=$((wait_time * 2))  # Exponential backoff
            
            # Try to refresh PATH
            if [ -f ~/.zshrc ]; then
                source ~/.zshrc 2>/dev/null || true
            elif [ -f ~/.bashrc ]; then
                source ~/.bashrc 2>/dev/null || true
            fi
        fi
    done
    
    print_error "Finch installation verification failed after $max_retries attempts"
    print_error "Please ensure Finch is properly installed and in your PATH"
    print_info "Try running: finch --version"
    return 1
}

# Check if Finch VM is running
check_finch_running() {
    local vm_status=$(finch vm status 2>&1)
    if echo "$vm_status" | grep -q "Running"; then
        return 0
    else
        return 1
    fi
}

# Check if Finch VM exists (initialized but may be stopped)
check_finch_vm_exists() {
    # Check if VM status returns anything other than "does not exist" or error
    local vm_status=$(finch vm status 2>&1)
    
    if echo "$vm_status" | grep -q "does not exist\|No such file\|cannot find\|not been created"; then
        return 1  # VM does not exist
    elif echo "$vm_status" | grep -q "Stopped\|Running"; then
        return 0  # VM exists (may be stopped or running)
    else
        # Unknown state - try to be more specific
        print_warning "Unknown VM state: $vm_status"
        return 1  # Assume doesn't exist to trigger initialization
    fi
}

# Get Finch VM status with retry logic
get_finch_vm_status() {
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        local status=$(finch vm status 2>&1 | head -n 1)
        
        # If we got a valid status, return it
        if [ -n "$status" ]; then
            echo "$status"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            sleep 1
        fi
    done
    
    echo "unknown"
    return 1
}

# Install Finch on macOS using Homebrew
install_finch_macos() {
    print_info "Installing Finch on macOS using Homebrew..."
    
    if ! command -v brew &> /dev/null; then
        print_error "Homebrew is not installed. Please install Homebrew first:"
        print_error "Visit https://brew.sh/ for installation instructions"
        exit 1
    fi
    
    print_info "Running: brew install finch"
    if brew install finch; then
        print_success "Finch installed successfully via Homebrew"
        return 0
    else
        print_error "Failed to install Finch via Homebrew"
        exit 1
    fi
}

# Install Finch on RHEL/CentOS/Fedora using yum/dnf
install_finch_rhel() {
    print_info "Installing Finch on RHEL/CentOS/Fedora..."
    
    # Determine package manager
    if command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
    else
        print_error "Neither yum nor dnf package manager found"
        exit 1
    fi
    
    print_info "Downloading Finch RPM package..."
    FINCH_VERSION="1.1.0"
    ARCH=$(uname -m)
    
    if [ "$ARCH" = "x86_64" ]; then
        FINCH_ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ]; then
        FINCH_ARCH="arm64"
    else
        print_error "Unsupported architecture: $ARCH"
        exit 1
    fi
    
    FINCH_URL="https://github.com/runfinch/finch/releases/download/v${FINCH_VERSION}/finch-${FINCH_VERSION}-linux-${FINCH_ARCH}.rpm"
    
    print_info "Downloading from: $FINCH_URL"
    if curl -L -o /tmp/finch.rpm "$FINCH_URL"; then
        print_info "Installing Finch RPM package..."
        if sudo $PKG_MANAGER install -y /tmp/finch.rpm; then
            print_success "Finch installed successfully"
            rm -f /tmp/finch.rpm
            return 0
        else
            print_error "Failed to install Finch RPM package"
            rm -f /tmp/finch.rpm
            exit 1
        fi
    else
        print_error "Failed to download Finch RPM package"
        exit 1
    fi
}

# Install Finch on Debian/Ubuntu using apt
install_finch_debian() {
    print_info "Installing Finch on Debian/Ubuntu..."
    
    print_info "Downloading Finch DEB package..."
    FINCH_VERSION="1.1.0"
    ARCH=$(uname -m)
    
    if [ "$ARCH" = "x86_64" ]; then
        FINCH_ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        FINCH_ARCH="arm64"
    else
        print_error "Unsupported architecture: $ARCH"
        exit 1
    fi
    
    FINCH_URL="https://github.com/runfinch/finch/releases/download/v${FINCH_VERSION}/finch-${FINCH_VERSION}-linux-${FINCH_ARCH}.deb"
    
    print_info "Downloading from: $FINCH_URL"
    if curl -L -o /tmp/finch.deb "$FINCH_URL"; then
        print_info "Installing Finch DEB package..."
        if sudo apt-get install -y /tmp/finch.deb; then
            print_success "Finch installed successfully"
            rm -f /tmp/finch.deb
            return 0
        else
            print_error "Failed to install Finch DEB package"
            rm -f /tmp/finch.deb
            exit 1
        fi
    else
        print_error "Failed to download Finch DEB package"
        exit 1
    fi
}

# Install Finch using direct binary download
install_finch_binary() {
    print_info "Installing Finch using direct binary download..."
    
    FINCH_VERSION="1.1.0"
    ARCH=$(uname -m)
    OS=$(detect_os)
    
    if [ "$ARCH" = "x86_64" ]; then
        FINCH_ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        FINCH_ARCH="arm64"
    else
        print_error "Unsupported architecture: $ARCH"
        exit 1
    fi
    
    if [ "$OS" = "macos" ]; then
        FINCH_URL="https://github.com/runfinch/finch/releases/download/v${FINCH_VERSION}/finch-${FINCH_VERSION}-darwin-${FINCH_ARCH}.tar.gz"
    else
        FINCH_URL="https://github.com/runfinch/finch/releases/download/v${FINCH_VERSION}/finch-${FINCH_VERSION}-linux-${FINCH_ARCH}.tar.gz"
    fi
    
    print_info "Downloading from: $FINCH_URL"
    if curl -L -o /tmp/finch.tar.gz "$FINCH_URL"; then
        print_info "Extracting Finch binary..."
        mkdir -p /tmp/finch-install
        if tar -xzf /tmp/finch.tar.gz -C /tmp/finch-install; then
            print_info "Installing Finch to /usr/local/bin..."
            if sudo mv /tmp/finch-install/finch /usr/local/bin/finch; then
                sudo chmod +x /usr/local/bin/finch
                print_success "Finch installed successfully"
                rm -rf /tmp/finch.tar.gz /tmp/finch-install
                return 0
            else
                print_error "Failed to move Finch binary to /usr/local/bin"
                rm -rf /tmp/finch.tar.gz /tmp/finch-install
                exit 1
            fi
        else
            print_error "Failed to extract Finch archive"
            rm -rf /tmp/finch.tar.gz /tmp/finch-install
            exit 1
        fi
    else
        print_error "Failed to download Finch binary"
        exit 1
    fi
}

# Install Finch based on detected OS
install_finch() {
    OS=$(detect_os)
    
    print_info "Detected operating system: $OS"
    
    case "$OS" in
        macos)
            install_finch_macos
            ;;
        rhel|centos|fedora)
            install_finch_rhel
            ;;
        ubuntu|debian)
            install_finch_debian
            ;;
        *)
            print_warning "Unsupported OS for automatic installation: $OS"
            print_info "Attempting direct binary installation..."
            install_finch_binary
            ;;
    esac
}

# Initialize or start Finch VM
initialize_finch_vm() {
    local vm_status=$(get_finch_vm_status)
    print_info "Current VM status: $vm_status"
    
    if check_finch_vm_exists; then
        # VM exists but is not running - just start it
        print_info "Finch VM exists but is not running. Starting VM..."
        if finch vm start; then
            print_success "Finch VM start command completed"
        else
            print_error "Failed to start Finch VM"
            print_info "Recovery steps:"
            print_info "  1. Try: finch vm stop"
            print_info "  2. Then: finch vm start"
            print_info "  3. If that fails: finch vm remove && finch vm init"
            exit 1
        fi
    else
        # VM doesn't exist - need to initialize first
        print_info "Finch VM has not been initialized. Initializing VM..."
        print_info "This may take 1-2 minutes..."
        
        if finch vm init; then
            print_success "Finch VM initialized successfully"
        else
            print_error "Failed to initialize Finch VM"
            print_info "Common issues:"
            print_info "  - Insufficient disk space (need ~2GB)"
            print_info "  - Conflicting VM software (VirtualBox, VMware)"
            print_info "  - Permission issues"
            print_info "Recovery: Try running with sudo or check system requirements"
            exit 1
        fi
        
        print_info "Starting Finch VM..."
        if finch vm start; then
            print_success "Finch VM start command completed"
        else
            print_error "Failed to start Finch VM after initialization"
            print_info "Recovery steps:"
            print_info "  1. Try: finch vm remove"
            print_info "  2. Then re-run this script"
            exit 1
        fi
    fi
    
    # Wait for VM to be fully ready
    print_info "Waiting for VM to be fully ready..."
    if ! wait_for_vm_ready; then
        print_error "VM failed to become ready"
        print_info "Check VM status with: finch vm status"
        print_info "Check VM logs with: finch vm status --debug"
        exit 1
    fi
    
    print_success "Finch VM is now running and ready"
    
    # Display VM resource information
    display_vm_info
}

# Wait for VM to be fully ready with timeout
wait_for_vm_ready() {
    local max_wait=60  # Maximum 60 seconds
    local elapsed=0
    local check_interval=2
    
    while [ $elapsed -lt $max_wait ]; do
        # Check if VM reports as running
        if check_finch_running; then
            # VM reports running, now verify it's functional
            print_info "VM reports as running, verifying functionality..."
            
            # Test that we can execute basic commands
            if finch ps &> /dev/null; then
                print_success "VM is fully functional"
                return 0
            else
                print_info "VM is starting, waiting for it to be fully ready..."
            fi
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        echo -n "."
    done
    
    echo ""
    print_error "VM did not become ready within ${max_wait} seconds"
    return 1
}

# Test VM functionality before proceeding
test_vm_functionality() {
    print_info "Testing VM functionality..."
    
    # Test that we can list containers
    if ! finch ps &> /dev/null; then
        print_error "VM is not responding to commands"
        return 1
    fi
    
    # Test that we can list images
    if ! finch images &> /dev/null; then
        print_error "VM cannot list images"
        return 1
    fi
    
    print_success "VM functionality verified"
    return 0
}

# Display VM resource information
display_vm_info() {
    print_verbose "Retrieving VM resource information..."
    
    # Try to get VM info (may not be available on all platforms)
    local vm_info=$(finch vm status 2>/dev/null || echo "")
    
    if [ -n "$vm_info" ]; then
        print_info "VM Resource Allocation:"
        echo "$vm_info" | grep -E "CPUs|Memory|Disk" | sed 's/^/  /' || true
    fi
}

# Main execution starts here
print_info "=========================================="
print_info "Cultivate"
print_info "Local Database Setup Script"
print_info "=========================================="
echo ""

# Step 1: Check if Finch is installed
print_info "Step 1: Checking if Finch is installed..."
if check_finch_installed; then
    print_success "Finch is already installed"
    FINCH_VERSION=$(finch --version 2>/dev/null || echo "unknown")
    print_info "Finch version: $FINCH_VERSION"
    FINCH_NEWLY_INSTALLED=false
else
    print_warning "Finch is not installed"
    print_info "Finch is an open-source container runtime (Apache 2.0 license)"
    print_info "It provides a Docker-compatible CLI without licensing restrictions"
    echo ""
    
    read -p "Would you like to install Finch now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_finch
        FINCH_NEWLY_INSTALLED=true
        
        # Verify installation succeeded
        echo ""
        if ! verify_finch_installation; then
            print_error "Finch installation verification failed"
            print_error "Cannot proceed without a working Finch installation"
            exit 1
        fi
    else
        print_error "Finch installation declined. Cannot proceed without Finch."
        print_info "To install Finch manually, visit: https://github.com/runfinch/finch"
        exit 1
    fi
fi

echo ""

# Step 2: Check if Finch VM is running
print_info "Step 2: Checking Finch VM status..."

if check_finch_running; then
    print_success "Finch VM is running"
    
    # Even if running, verify it's functional
    if ! test_vm_functionality; then
        print_warning "VM is running but not responding properly"
        print_info "Attempting to restart VM..."
        
        if finch vm stop; then
            sleep 2
            initialize_finch_vm
        else
            print_error "Failed to stop VM for restart"
            exit 1
        fi
    fi
elif check_finch_vm_exists; then
    print_warning "Finch VM exists but is not running"
    vm_status=$(get_finch_vm_status)
    print_info "VM Status: $vm_status"
    initialize_finch_vm
else
    print_warning "Finch VM has not been initialized"
    initialize_finch_vm
fi

# Final verification that VM is ready
echo ""
print_info "Performing final VM readiness check..."
if ! test_vm_functionality; then
    print_error "VM is not ready for container operations"
    print_info "Please check VM status with: finch vm status"
    exit 1
fi

echo ""
print_success "Finch setup complete!"
print_info "Ready to proceed with PostgreSQL container setup..."


# Step 3: Check if container already exists
print_info "Step 3: Checking for existing PostgreSQL container..."
if finch ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    print_warning "Container '$CONTAINER_NAME' already exists"
    
    # Check if it's running
    if finch ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_info "Container is already running"
        CONTAINER_EXISTS=true
        CONTAINER_RUNNING=true
    else
        print_info "Container exists but is not running"
        CONTAINER_EXISTS=true
        CONTAINER_RUNNING=false
        
        read -p "Would you like to start the existing container? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Starting existing container..."
            if finch start "$CONTAINER_NAME"; then
                print_success "Container started successfully"
                CONTAINER_RUNNING=true
            else
                print_error "Failed to start existing container"
                exit 1
            fi
        else
            print_info "Removing existing container..."
            if finch rm -f "$CONTAINER_NAME"; then
                print_success "Existing container removed"
                CONTAINER_EXISTS=false
            else
                print_error "Failed to remove existing container"
                exit 1
            fi
        fi
    fi
else
    CONTAINER_EXISTS=false
    CONTAINER_RUNNING=false
fi

echo ""

# Step 4: Pull PostgreSQL image (if needed)
if [ "$CONTAINER_EXISTS" = false ]; then
    print_info "Step 4: Pulling PostgreSQL $POSTGRES_VERSION image..."
    if finch pull "postgres:${POSTGRES_VERSION}"; then
        print_success "PostgreSQL image pulled successfully"
    else
        print_error "Failed to pull PostgreSQL image"
        exit 1
    fi
    echo ""
fi

# Step 5: Create volume for persistent data (if needed)
if [ "$CONTAINER_EXISTS" = false ]; then
    print_info "Step 5: Creating persistent volume for database data..."
    
    # Check if volume already exists
    if finch volume ls --format '{{.Name}}' | grep -q "^${VOLUME_NAME}$"; then
        print_info "Volume '$VOLUME_NAME' already exists"
    else
        if finch volume create "$VOLUME_NAME"; then
            print_success "Volume created successfully"
        else
            print_error "Failed to create volume"
            exit 1
        fi
    fi
    echo ""
fi

# Step 6: Create and start PostgreSQL container (if needed)
if [ "$CONTAINER_EXISTS" = false ]; then
    print_info "Step 6: Creating and starting PostgreSQL container..."
    print_info "Container name: $CONTAINER_NAME"
    print_info "Database name: $POSTGRES_DB"
    print_info "Database user: $POSTGRES_USER"
    print_info "Port: $POSTGRES_PORT"
    
    if finch run -d \
        --name "$CONTAINER_NAME" \
        -e POSTGRES_DB="$POSTGRES_DB" \
        -e POSTGRES_USER="$POSTGRES_USER" \
        -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        -p "${POSTGRES_PORT}:5432" \
        -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
        "postgres:${POSTGRES_VERSION}"; then
        print_success "PostgreSQL container created and started successfully"
        CONTAINER_RUNNING=true
    else
        print_error "Failed to create and start PostgreSQL container"
        exit 1
    fi
    
    echo ""
    print_info "Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Wait for PostgreSQL to be ready
    MAX_RETRIES=30
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if finch exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" &> /dev/null; then
            print_success "PostgreSQL is ready!"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            print_error "PostgreSQL failed to become ready after $MAX_RETRIES attempts"
            exit 1
        fi
        echo -n "."
        sleep 1
    done
    echo ""
fi

echo ""

# Step 7: Output connection information
print_info "=========================================="
print_success "PostgreSQL Database Setup Complete!"
print_info "=========================================="
echo ""

print_info "Connection Details:"
echo "  Host:     localhost"
echo "  Port:     $POSTGRES_PORT"
echo "  Database: $POSTGRES_DB"
echo "  User:     $POSTGRES_USER"
echo "  Password: $POSTGRES_PASSWORD"
echo ""

# Generate connection string
CONNECTION_STRING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

print_info "Connection String:"
echo "  $CONNECTION_STRING"
echo ""

print_info "Add this to your .env file:"
echo "  DATABASE_URL=\"$CONNECTION_STRING\""
echo ""

print_info "Useful Commands:"
echo "  Start container:   finch start $CONTAINER_NAME"
echo "  Stop container:    finch stop $CONTAINER_NAME"
echo "  View logs:         finch logs $CONTAINER_NAME"
echo "  Connect to DB:     finch exec -it $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB"
echo "  Remove container:  finch rm -f $CONTAINER_NAME"
echo "  Remove volume:     finch volume rm $VOLUME_NAME"
echo ""

print_success "Container setup complete!"
echo ""

# Step 8: Set up development database
print_info "=========================================="
print_info "Step 8: Setting up development database..."
print_info "=========================================="
echo ""

print_info "Running migrations on development database ($POSTGRES_DB)..."
if DATABASE_URL="$CONNECTION_STRING" npx prisma migrate deploy; then
    print_success "Development database migrations completed"
else
    print_error "Failed to run migrations on development database"
    exit 1
fi

echo ""
print_info "Seeding development database..."
if DATABASE_URL="$CONNECTION_STRING" npx prisma db seed; then
    print_success "Development database seeded successfully"
else
    print_error "Failed to seed development database"
    exit 1
fi

echo ""

# Step 9: Set up test database
print_info "=========================================="
print_info "Step 9: Setting up test database..."
print_info "=========================================="
echo ""

TEST_DB_NAME="${POSTGRES_DB}_test"
TEST_CONNECTION_STRING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${TEST_DB_NAME}?schema=public"

print_info "Creating test database ($TEST_DB_NAME)..."
if finch exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE ${TEST_DB_NAME};" 2>/dev/null; then
    print_success "Test database created"
elif finch exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}';" | grep -q 1; then
    print_info "Test database already exists"
else
    print_error "Failed to create test database"
    exit 1
fi

echo ""
print_info "Running migrations on test database ($TEST_DB_NAME)..."
if DATABASE_URL="$TEST_CONNECTION_STRING" npx prisma migrate deploy; then
    print_success "Test database migrations completed"
else
    print_error "Failed to run migrations on test database"
    exit 1
fi

echo ""
print_info "Seeding test database..."
if DATABASE_URL="$TEST_CONNECTION_STRING" npx prisma db seed; then
    print_success "Test database seeded successfully"
else
    print_error "Failed to seed test database"
    exit 1
fi

echo ""

# Final summary
print_info "=========================================="
print_success "Database Setup Complete!"
print_info "=========================================="
echo ""

print_info "Development Database:"
echo "  Database: $POSTGRES_DB"
echo "  URL:      $CONNECTION_STRING"
echo ""

print_info "Test Database:"
echo "  Database: $TEST_DB_NAME"
echo "  URL:      $TEST_CONNECTION_STRING"
echo ""

print_info "Add this to your .env file:"
echo "  DATABASE_URL=\"$CONNECTION_STRING\""
echo ""

print_success "You can now run 'npm test' to run your test suite!"
