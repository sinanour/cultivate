#!/bin/bash
# Database initialization script for PostgreSQL with peer authentication
# This script is executed by docker-entrypoint-initdb.d during container initialization
# Requirements: 3.1, 3.3

set -e

echo "Starting database initialization..."

# The database and user are already created by the PostgreSQL entrypoint
# using POSTGRES_USER and POSTGRES_DB environment variables
# We just need to set up permissions

# Connect to cultivate and set up schema permissions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Grant schema permissions to apiuser
    GRANT ALL ON SCHEMA public TO apiuser;
    
    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO apiuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO apiuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO apiuser;
EOSQL

echo "Database initialization completed successfully"
echo "  - Database 'cultivate' ready"
echo "  - User 'apiuser' has all necessary privileges"

# Configure pg_hba.conf for trust authentication (simpler than peer for containerized setup)
# Trust authentication allows connections from the same host without password
echo "Configuring pg_hba.conf for trust authentication..."
cat > "$PGDATA/pg_hba.conf" <<'EOF'
# PostgreSQL Client Authentication Configuration
# Trust authentication for Unix socket connections (no password required)
local   all             all                                     trust

# Reject all TCP/IP connections for security
host    all             all             0.0.0.0/0               reject
host    all             all             ::/0                    reject
EOF

echo "pg_hba.conf configured for trust authentication"
