# Backend API Scripts

This directory contains utility scripts for local development and testing.

## Database Setup Scripts

### `setup-local-db.sh` - Initial Database Container Setup

Sets up a local PostgreSQL database using Finch container runtime, then initializes both development and test databases.

**Usage:**
```bash
npm run db:setup
```

**What it does:**
1. Checks if Finch is installed (installs if needed)
2. Initializes and starts Finch VM
3. Creates PostgreSQL container with persistent volume
4. Creates `cultivate` database (development)
5. Runs migrations on development database
6. Seeds development database with predefined data
7. Creates `cultivate_test` database (test)
8. Runs migrations on test database
9. Seeds test database with predefined data

**When to use:**
- First time setting up your local environment
- After removing the PostgreSQL container
- When you need to recreate everything from scratch

---

### `reset-databases.sh` - Reset Existing Databases

Resets both development and test databases without recreating the container.

**Usage:**
```bash
npm run db:reset
```

**What it does:**
1. Runs migrations on development database
2. Seeds development database
3. Creates test database if it doesn't exist
4. Runs migrations on test database
5. Seeds test database

**When to use:**
- After purging/dropping databases
- When you need fresh data but container is already running
- After making schema changes
- When tests are failing due to missing test database

---

## Data Generation Scripts

### `generate-fake-data.ts` - Generate Test Data

Generates large volumes of realistic test data for load testing and performance validation.

**Usage:**
```bash
npm run generate-fake-data -- --areas=10000 --venues=1000000 --participants=10000000 --activities=20000000
```

**Options:**
- `--areas`: Number of geographic areas (default: 10,000)
- `--venues`: Number of venues (default: 1,000,000)
- `--participants`: Number of participants (default: 10,000,000)
- `--activities`: Number of activities (default: 20,000,000)
- `--remove`: Remove all auto-generated fake data

**Safety:**
- Only runs when `NODE_ENV=development`
- Prompts for confirmation before proceeding
- Uses deterministic naming for idempotency

---

### `benchmark-map-queries.ts` - Benchmark Map Queries

Benchmarks map data query performance with various filter combinations.

**Usage:**
```bash
npm run benchmark:map-queries
```

---

## Common Workflows

### First Time Setup
```bash
# 1. Set up container and databases
npm run db:setup

# 2. Run tests to verify
npm test
```

### After Purging Databases
```bash
# Quick reset (container still running)
npm run db:reset

# Or full setup (if container was removed)
npm run db:setup
```

### After Schema Changes
```bash
# 1. Create migration
npm run prisma:migrate

# 2. Reset test database
npm run db:reset
```

### Generate Test Data
```bash
# Generate default amounts
npm run generate-fake-data

# Generate custom amounts
npm run generate-fake-data -- --areas=1000 --venues=10000 --participants=100000 --activities=200000

# Remove fake data
npm run generate-fake-data -- --remove
```

---

## Troubleshooting

### Tests failing after database changes
```bash
npm run db:reset
```

### Container not responding
```bash
finch restart cultivate-postgres-local
```

### Need to start fresh
```bash
# Remove container and volume
finch rm -f cultivate-postgres-local
finch volume rm cultivate-postgres-data

# Run setup again
npm run db:setup
```

### Check database contents
```bash
# Development database
finch exec -it cultivate-postgres-local psql -U cultivate_user -d cultivate

# Test database
finch exec -it cultivate-postgres-local psql -U cultivate_user -d cultivate_test
```
