#!/bin/bash

# Cultivate - Reset Databases Script
# This script resets both development and test databases
# Useful after purging databases or when you need a fresh start
#
# Usage: ./reset-databases.sh

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration from .env or defaults
POSTGRES_DB="${POSTGRES_DB:-cultivate}"
POSTGRES_USER="${POSTGRES_USER:-cultivate_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-cultivate_local_dev_password}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"

# Connection strings
DEV_CONNECTION_STRING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
TEST_DB_NAME="${POSTGRES_DB}_test"
TEST_CONNECTION_STRING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${TEST_DB_NAME}?schema=public"

print_info "=========================================="
print_info "Cultivate Database Reset Script"
print_info "=========================================="
echo ""

print_warning "This will reset both development and test databases!"
print_warning "All data will be lost!"
echo ""

read -p "Are you sure you want to continue? (yes/no) " -r
echo ""
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_info "Database reset cancelled"
    exit 0
fi

echo ""

# Step 1: Reset development database
print_info "Step 1: Resetting development database ($POSTGRES_DB)..."
echo ""

print_info "Running migrations on development database..."
if DATABASE_URL="$DEV_CONNECTION_STRING" npx prisma migrate deploy; then
    print_success "Development database migrations completed"
else
    print_error "Failed to run migrations on development database"
    exit 1
fi

echo ""
print_info "Seeding development database..."
if DATABASE_URL="$DEV_CONNECTION_STRING" npx prisma db seed; then
    print_success "Development database seeded successfully"
else
    print_error "Failed to seed development database"
    exit 1
fi

echo ""

# Step 2: Reset test database
print_info "Step 2: Resetting test database ($TEST_DB_NAME)..."
echo ""

print_info "Checking if test database exists..."
if PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -h "$POSTGRES_HOST" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'" | grep -q 1; then
    print_info "Test database exists"
else
    print_info "Creating test database..."
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -h "$POSTGRES_HOST" -d postgres -c "CREATE DATABASE ${TEST_DB_NAME};"; then
        print_success "Test database created"
    else
        print_error "Failed to create test database"
        exit 1
    fi
fi

echo ""
print_info "Running migrations on test database..."
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
print_success "Database Reset Complete!"
print_info "=========================================="
echo ""

print_info "Development Database:"
echo "  Database: $POSTGRES_DB"
echo "  URL:      $DEV_CONNECTION_STRING"
echo ""

print_info "Test Database:"
echo "  Database: $TEST_DB_NAME"
echo "  URL:      $TEST_CONNECTION_STRING"
echo ""

print_success "You can now run 'npm test' to run your test suite!"
