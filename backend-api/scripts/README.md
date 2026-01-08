# Backend API Development Scripts

This directory contains utility scripts for local development of the Cultivate Backend API.

## Local Database Setup Script

### Overview

The `setup-local-db.sh` script automates the setup of a local PostgreSQL database using Finch container runtime. This script is designed for development and testing purposes only and should **not** be used in production environments.

### Why Finch Instead of Docker Desktop?

We use **Finch** as our container runtime for several important reasons:

1. **Open Source & Free**: Finch is licensed under Apache 2.0, making it completely free and open-source with no licensing restrictions for commercial use.

2. **No Licensing Concerns**: Unlike Docker Desktop, which requires paid licenses for certain commercial use cases, Finch has no such restrictions.

3. **Lightweight**: Finch is designed to be minimal and efficient, with a smaller footprint than Docker Desktop.

4. **Docker-Compatible**: Finch provides a Docker-compatible CLI, so most Docker commands work seamlessly.

5. **Cross-Platform**: Works on macOS, Linux, and Windows (via WSL2).

6. **AWS-Backed**: Maintained by AWS and the open-source community, ensuring long-term support and reliability.

### Prerequisites

- **Operating System**: macOS, Linux (Ubuntu, Debian, RHEL, CentOS, Fedora), or Windows with WSL2
- **Package Manager** (for automatic installation):
  - macOS: Homebrew
  - RHEL/CentOS/Fedora: yum or dnf
  - Ubuntu/Debian: apt
- **Permissions**: sudo access may be required for installation

### Usage

#### Quick Start

Run the setup script using npm:

```bash
npm run db:setup
```

Or run the script directly:

```bash
bash scripts/setup-local-db.sh
```

#### What the Script Does

The script performs the following steps automatically:

1. **Detects Operating System**: Identifies your OS to determine the appropriate installation method.

2. **Checks for Finch**: Verifies if Finch is already installed on your system.

3. **Installs Finch** (if needed): 
   - macOS: Uses Homebrew (`brew install finch`)
   - RHEL/CentOS/Fedora: Downloads and installs RPM package
   - Ubuntu/Debian: Downloads and installs DEB package
   - Other systems: Downloads and installs binary directly

4. **Checks Finch VM Status**: Intelligently detects whether the Finch VM is:
   - Running (ready to use)
   - Stopped (exists but needs to be started)
   - Not initialized (needs to be created first)

5. **Initializes or Starts Finch VM**: 
   - If VM doesn't exist: Initializes and starts it
   - If VM exists but is stopped: Simply starts it
   - Waits for VM to be fully ready before proceeding

6. **Pulls PostgreSQL Image**: Downloads the latest PostgreSQL 16 Alpine image.

7. **Creates Persistent Volume**: Sets up a named volume for database data persistence.

8. **Starts PostgreSQL Container**: Creates and starts a PostgreSQL container with:
   - Database name: `community_activity_tracker`
   - Username: `cat_user`
   - Password: `cat_local_dev_password`
   - Port: `5432` (exposed on localhost)

9. **Outputs Connection Information**: Displays the connection string and useful commands.

### Connection Details

After successful setup, the script outputs:

```
Connection String:
  postgresql://cat_user:cat_local_dev_password@localhost:5432/community_activity_tracker?schema=public

Add this to your .env file:
  DATABASE_URL="postgresql://cat_user:cat_local_dev_password@localhost:5432/community_activity_tracker?schema=public"
```

### Configuration

The script uses the following default configuration (defined at the top of the script):

```bash
CONTAINER_NAME="cat-postgres-local"
POSTGRES_VERSION="16-alpine"
POSTGRES_PORT="5432"
POSTGRES_DB="community_activity_tracker"
POSTGRES_USER="cat_user"
POSTGRES_PASSWORD="cat_local_dev_password"
VOLUME_NAME="cat-postgres-data"
```

You can modify these values in the script if needed for your local environment.

### Useful Commands

After setup, you can manage your database container with these commands:

```bash
# Start the container
finch start cat-postgres-local

# Stop the container
finch stop cat-postgres-local

# View container logs
finch logs cat-postgres-local

# Connect to the database using psql
finch exec -it cat-postgres-local psql -U cat_user -d community_activity_tracker

# Remove the container (data persists in volume)
finch rm -f cat-postgres-local

# Remove the volume (deletes all data)
finch volume rm cat-postgres-data

# List all containers
finch ps -a

# List all volumes
finch volume ls
```

### Next Steps

After running the setup script:

1. **Add the connection string to your `.env` file**:
   ```bash
   echo 'DATABASE_URL="postgresql://cat_user:cat_local_dev_password@localhost:5432/community_activity_tracker?schema=public"' >> .env
   ```

2. **Run Prisma migrations** to set up the database schema:
   ```bash
   npm run prisma:migrate
   ```

3. **Generate Prisma client**:
   ```bash
   npm run prisma:generate
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

### Troubleshooting

#### Finch Installation Fails

If automatic installation fails, you can install Finch manually:

1. Visit the [Finch GitHub releases page](https://github.com/runfinch/finch/releases)
2. Download the appropriate package for your system
3. Follow the installation instructions in the Finch documentation

#### Finch VM States

The script intelligently handles different Finch VM states:

- **VM Running**: Script proceeds immediately to container setup
- **VM Stopped**: Script automatically starts the existing VM
- **VM Not Initialized**: Script initializes and starts a new VM

To manually check your VM status:
```bash
finch vm status
```

Common VM states and solutions:
- `Running` - VM is ready to use
- `Stopped` - Run `finch vm start` or let the script start it
- `does not exist` - Run `finch vm init` or let the script initialize it

#### Finch VM Won't Start

If the Finch VM fails to start:

```bash
# Check VM status
finch vm status

# Try stopping and restarting
finch vm stop
finch vm start

# If issues persist, remove and reinitialize
finch vm remove
finch vm init
finch vm start
```

#### Port Already in Use

If port 5432 is already in use by another PostgreSQL instance:

1. Stop the other PostgreSQL instance, or
2. Modify the `POSTGRES_PORT` variable in the script to use a different port (e.g., 5433)

#### Container Won't Start

If the container fails to start:

```bash
# Check container logs
finch logs cat-postgres-local

# Remove and recreate the container
finch rm -f cat-postgres-local
npm run db:setup
```

#### Permission Denied Errors

If you encounter permission errors:

1. Ensure you have sudo access
2. Check that the script is executable: `chmod +x scripts/setup-local-db.sh`
3. On Linux, you may need to add your user to the finch group

### Security Notes

⚠️ **Important Security Considerations**:

- This script is for **local development only**
- The default password (`cat_local_dev_password`) is intentionally simple and should **never** be used in production
- The database is exposed on localhost only and is not accessible from external networks
- For production deployments, use proper database hosting with strong passwords and security configurations

### Script Location

This script is located in the `scripts/` directory within the backend-api package and is **not included** in production deployments. It is purely a development utility.

### Support

For issues or questions:

1. Check the [Finch documentation](https://github.com/runfinch/finch)
2. Review the script output for error messages
3. Consult the troubleshooting section above
4. Check the project's main README for additional setup information

## Additional Scripts

As the project grows, additional development scripts may be added to this directory. Each script will have its own documentation section in this README.


## Fake Data Generation Script

### Overview

The `generate-fake-data.ts` script generates large volumes of realistic test data for load testing and performance validation. It creates geographic areas, venues, participants, and activities with proper relationships and realistic distributions.

### Safety Mechanisms

⚠️ **Critical Safety Features**:

1. **Environment Check**: Script will **only run** when `NODE_ENV=development`
2. **User Confirmation**: Prompts for explicit confirmation before generating data
3. **Idempotent Operations**: Uses upsert operations - safe to run multiple times
4. **Deterministic IDs**: Uses MD5-based UUIDs - same input always produces same output

### Usage

#### Basic Usage (Default Configuration)

```bash
NODE_ENV=development npm run generate-fake-data
```

Default configuration:
- 10,000 geographic areas
- 1,000,000 venues
- 10,000,000 participants
- 20,000,000 activities

#### Custom Configuration

Specify custom record counts using command-line arguments:

```bash
NODE_ENV=development npm run generate-fake-data -- --areas=1000 --venues=10000 --participants=100000 --activities=200000
```

Available parameters:
- `--areas=N`: Number of geographic areas to generate
- `--venues=N`: Number of venues to generate
- `--participants=N`: Number of participants to generate
- `--activities=N`: Number of activities to generate

#### Small Test Dataset

For quick testing with a small dataset:

```bash
NODE_ENV=development npm run generate-fake-data -- --areas=100 --venues=1000 --participants=10000 --activities=20000
```

#### Removing Fake Data

Remove all auto-generated fake data while preserving manual records:

```bash
NODE_ENV=development npm run generate-fake-data -- --remove
```

This selective removal:
- Deletes only records matching fake data naming patterns
- Preserves manually created records (custom names)
- Preserves predefined seed data (activity categories, types, roles)
- Respects foreign key constraints (deletes in correct order)
- Requires same safety checks (NODE_ENV=development, user confirmation)

See the [Data Cleanup](#data-cleanup) section for more details.

### Data Generation Details

#### Geographic Areas

**Distribution by Type:**
- 2% COUNTRY (null parent)
- 5% STATE
- 3% PROVINCE
- 20% CLUSTER
- 30% CITY
- 40% NEIGHBOURHOOD

**Hierarchy Rules:**
- Only countries have null parents
- Each country's immediate subdivisions use a consistent type (all states, all provinces, or all clusters)
- Parent types are logically higher in hierarchy (e.g., cities can belong to clusters, counties, provinces, states, or countries, but never to neighbourhoods)

**Naming Pattern:** `{Type} {Serial}` (e.g., "COUNTRY 000001", "CITY 005432")

#### Venues

**Assignment:**
- Assigned only to leaf-node geographic areas (areas with no children)
- Distributed evenly across all leaf nodes using pseudo-random logic

**Naming Pattern:** `Area {AreaIdPrefix} Venue {Serial}` (e.g., "Area 3f2a1b4c Venue 042")

**Coordinates:**
- Each geographic area has a central coordinate point
- Venues within an area are distributed within a 10km radius
- Different geographic areas have different global coordinates

#### Participants

**Naming Pattern:** `Participant {Serial}` (e.g., "Participant 00000001")

**Home Address:**
- Each participant is assigned to one venue as their home address
- Assignment uses pseudo-random logic based on participant UUID
- Creates ParticipantAddressHistory record with null effectiveFrom (oldest address)

#### Activities

**Naming Pattern:** `Activity {Serial}` (e.g., "Activity 00000001")

**Properties:**
- Assigned to venues using pseudo-random logic
- Assigned to predefined activity types
- Start dates distributed over past year
- 10% ongoing (null endDate), 90% finite
- Status distribution: 70% PLANNED, 20% ACTIVE, 10% COMPLETED

**Participant Assignments:**
- Each activity has 3-15 participants (determined by activity UUID)
- Participants assigned using pseudo-random logic
- Each assignment has a role from predefined roles

### Idempotency

The script is designed to be **idempotent** - running it multiple times with the same parameters produces identical results:

- **Deterministic UUIDs**: Entity IDs are generated from MD5 hash of entity name
- **Upsert Operations**: Uses `createMany` with `skipDuplicates: true`
- **Consistent Naming**: Same index always produces same name
- **Pseudo-Random Logic**: UUID-based modulo ensures consistent assignments

This means you can:
- Run the script multiple times without creating duplicates
- Regenerate specific datasets reliably
- Test with consistent data across environments

### Performance Considerations

**Batch Processing:**
- Processes records in batches of 1,000 to avoid memory issues
- Shows progress percentage during generation

**Execution Time Estimates:**
- Small dataset (100/1K/10K/20K): ~10-30 seconds
- Medium dataset (1K/10K/100K/200K): ~1-5 minutes
- Default dataset (10K/1M/10M/20M): ~30-60 minutes (depends on hardware)

**Database Size Estimates:**
- Small dataset: ~50 MB
- Medium dataset: ~500 MB
- Default dataset: ~50 GB

### Prerequisites

1. **Database Setup**: Run `npm run db:setup` first to create local database
2. **Migrations**: Run `npm run prisma:migrate` to set up schema
3. **Seed Data**: Ensure predefined data exists (activity categories, types, roles)
4. **Environment**: Set `NODE_ENV=development` in your environment or .env file

### Example Workflow

```bash
# 1. Set up local database
npm run db:setup

# 2. Run migrations
npm run prisma:migrate

# 3. Generate fake data with small dataset for testing
NODE_ENV=development npm run generate-fake-data -- --areas=100 --venues=1000 --participants=10000 --activities=20000

# 4. Verify data was created
npm run prisma:studio

# 5. Test API with realistic data
npm run dev
```

### Troubleshooting

#### Script Won't Run

**Error: "This script can only run when NODE_ENV is set to 'development'"**

Solution: Set the NODE_ENV environment variable:
```bash
NODE_ENV=development npm run generate-fake-data
```

Or add to your .env file:
```
NODE_ENV=development
```

#### Database Connection Errors

**Error: "Failed to connect to database"**

Solutions:
1. Ensure PostgreSQL container is running: `finch ps`
2. Check DATABASE_URL in .env file matches connection string
3. Verify container is healthy: `finch logs cat-postgres-local`

#### Out of Memory Errors

**Error: "JavaScript heap out of memory"**

Solutions:
1. Reduce the number of records to generate
2. Increase Node.js memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run generate-fake-data
   ```

#### Slow Performance

If generation is taking too long:
1. Use smaller dataset for testing
2. Check database container resources
3. Ensure database is on fast storage (SSD)

### Data Cleanup

#### Option 1: Selective Removal (Recommended)

Remove only auto-generated fake data while preserving manual records and predefined seed data:

```bash
NODE_ENV=development npm run generate-fake-data -- --remove
```

This will:
- ✓ Delete all auto-generated fake data (identified by naming patterns)
- ✓ Preserve manually created test records
- ✓ Preserve predefined seed data (activity categories, types, roles)
- ✓ Respect foreign key constraints (deletes in correct order)

**What gets deleted:**
- Geographic areas matching pattern: `{TYPE} {6 digits}` (e.g., "COUNTRY 000001", "CITY 005432")
- Venues matching pattern: `Area {8 hex} Venue {3 digits}` (e.g., "Area 3f2a1b4c Venue 042")
- Participants matching pattern: `Participant {8 digits}` (e.g., "Participant 00000001")
- Activities matching pattern: `Activity {8 digits}` (e.g., "Activity 00000001")
- All related records (assignments, address history, venue history)

**What gets preserved:**
- Manually created records with custom names (e.g., "John Doe", "Community Center", "Weekly Study Circle")
- Predefined activity categories and types
- Predefined roles
- Root administrator user
- Any other manually entered data

**Example Workflow:**
```bash
# 1. Generate fake data
NODE_ENV=development npm run generate-fake-data -- --areas=100 --venues=1000 --participants=10000 --activities=5000

# 2. Manually add some test records via API or Prisma Studio
# (e.g., create a participant named "Test User", activity named "Test Activity")

# 3. Run tests or load testing

# 4. Remove only the fake data (manual records preserved)
NODE_ENV=development npm run generate-fake-data -- --remove

# 5. Verify manual records still exist
npm run prisma:studio
```

#### Option 2: Complete Database Reset

Drop and recreate the entire database (removes ALL data including manual records):

```bash
# Drop and recreate database
finch exec -it cat-postgres-local psql -U cat_user -d community_activity_tracker -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run prisma:migrate

# Or remove container and volume (complete reset)
finch rm -f cat-postgres-local
finch volume rm cat-postgres-data
npm run db:setup
npm run prisma:migrate
```

⚠️ **Warning**: Option 2 deletes ALL data including manually created records. Use Option 1 for selective removal.

### Security Notes

⚠️ **Important**:
- This script is for **development and testing only**
- Never run this script in production environments
- The NODE_ENV check prevents accidental production execution
- Generated data is fake and should not be used for real community tracking

### Technical Details

**UUID Generation:**
- Uses MD5 hash of entity name formatted as UUID v4
- Ensures deterministic IDs for idempotency
- Format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`

**Pseudo-Random Assignment:**
- Uses UUID modulo for deterministic but distributed assignment
- Same UUID always assigns to same entity
- Provides even distribution across entities

**Geographic Hierarchy:**
- Follows realistic parent-child relationships
- Countries use consistent subdivision types
- Leaf nodes (no children) receive venues

**Coordinate Generation:**
- Uses golden angle (137.5°) for even distribution
- Venues within 10km radius of area center
- Different areas have different global coordinates
