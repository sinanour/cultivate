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
