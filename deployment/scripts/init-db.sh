#!/bin/bash
# Database initialization script for PostgreSQL with peer authentication
# This script is executed by docker-entrypoint-initdb.d during container initialization
# Requirements: 3.1, 3.3

set -e

echo "Starting database initialization..."

# Create apiuser database user if it doesn't exist
# Note: In peer authentication mode, the database user must match the OS user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create apiuser role if it doesn't exist
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'apiuser') THEN
            CREATE ROLE apiuser WITH LOGIN;
            RAISE NOTICE 'Created database user: apiuser';
        ELSE
            RAISE NOTICE 'Database user apiuser already exists';
        END IF;
    END
    \$\$;

    -- Create community_tracker database if it doesn't exist
    SELECT 'CREATE DATABASE community_tracker OWNER apiuser'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'community_tracker')\gexec

    -- Grant all privileges on the database to apiuser
    GRANT ALL PRIVILEGES ON DATABASE community_tracker TO apiuser;

    -- Connect to community_tracker and set up schema permissions
    \c community_tracker

    -- Grant schema permissions to apiuser
    GRANT ALL ON SCHEMA public TO apiuser;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO apiuser;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO apiuser;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO apiuser;

    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO apiuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO apiuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO apiuser;
EOSQL

echo "Database initialization completed successfully"
echo "  - Database user 'apiuser' created/verified"
echo "  - Database 'community_tracker' created with owner 'apiuser'"
echo "  - All necessary privileges granted to 'apiuser'"
