# Deployment Configuration Guide

## Quick Start

**Configure locally, deploy remotely - your .env is automatically transferred!**

### Step 1: Edit Your Local Configuration

**File:** `deployment/config/.env` (on your local build machine)

```bash
# Edit the configuration file on your local machine
vim deployment/config/.env

# Example: Set custom HTTPS port
HTTP_PORT=80
HTTPS_PORT=1443
ENABLE_HTTPS=true
```

### Step 2: Deploy

```bash
# Run deployment from the deployment directory
cd deployment
npm run deploy -- user@production-host

# Your local deployment/config/.env is automatically:
# 1. Read from your local machine
# 2. Validated
# 3. Transferred to the remote host
# 4. Used to configure containers
```

**That's it!** Your local `.env` configuration is automatically transferred to the remote host. No manual remote configuration needed.

## Configuration File Location

**Local (your build machine):**
```
/Volumes/workplace/src/cultivate/deployment/config/.env
```

**Remote (after deployment):**
- **Linux targets:** `/opt/cultivate/config/.env`
- **macOS targets:** `/Users/username/cultivate/config/.env`

## Available Configuration Options

### Network Configuration

```bash
# HTTP port for web frontend
# This port is mapped from the host to the container
# Example: HTTP_PORT=8080 means the application is accessible at http://host:8080
HTTP_PORT=80

# HTTPS port for web frontend
# This port is mapped from the host to the container
# Example: HTTPS_PORT=1443 means the application is accessible at https://host:1443
HTTPS_PORT=443

# Enable HTTPS (requires certificates)
# When true and CERT_PATH is set, certificates will be mounted into the frontend container
ENABLE_HTTPS=false
```

**Port Mapping Behavior:**
- The configured ports are used in the docker-compose.yml port mappings
- Format: `"0.0.0.0:${HTTP_PORT}:80"` and `"0.0.0.0:${HTTPS_PORT}:443"`
- Ports are explicitly bound to `0.0.0.0` for public accessibility (not just localhost)
- The left side (host port) uses your configured value
- The right side (container port) is always 80 and 443
- Example: `HTTP_PORT=8080` results in `"0.0.0.0:8080:80"` mapping

**Public Accessibility:**
- Ports are bound to `0.0.0.0` (all network interfaces), not `127.0.0.1` (localhost only)
- This allows external access to the application from other machines
- Ensure your firewall allows traffic on the configured ports

### Certificate Configuration

```bash
# Path to SSL certificates on the LOCAL BUILD MACHINE
# Certificates will be automatically transferred to the remote host during deployment
CERT_PATH=./config/certs

# Note: This path is relative to deployment/config/ on your LOCAL machine
# Absolute paths are also supported
```

**Certificate Transfer Behavior:**
- Certificates are **automatically transferred** from your local machine to the remote host during deployment
- The `CERT_PATH` in `.env` refers to the **local path** on your build machine
- Certificates are transferred to `{configPath}/certs` on the remote host
- The docker-compose.yml automatically mounts the remote certificate directory
- **Certificate directories are transferred recursively**, preserving subdirectory structure
- This allows organizing certificates in subdirectories (e.g., separate folders per domain)

**Certificate Mounting Behavior:**
- Certificates are only mounted when **both** `ENABLE_HTTPS=true` **and** `CERT_PATH` is set
- If either condition is false, the certificate volume mount is omitted from docker-compose.yml
- The certificate directory is mounted read-only into the frontend container at `/etc/nginx/certs`
- Nginx configuration automatically uses certificates when they are present

**Certificate Requirements:**
- Certificates must exist on your **local machine** at the `CERT_PATH` location before deployment
- The `CERT_PATH` directory should contain:
  - `fullchain.pem` (or `cert.pem`)
  - `privkey.pem` (or `key.pem`)
- Certificates are transferred with appropriate permissions (keys: 0600, certs: 0644)
- Subdirectories are preserved during transfer, allowing nested organization

**Local Certificate Paths:**

Relative path (recommended):
```bash
CERT_PATH=./config/certs
# Resolves to: /path/to/cultivate/deployment/config/certs
```

Absolute path:
```bash
CERT_PATH=/etc/letsencrypt/live/yourdomain.com/
# Uses the exact path specified
```

**Remote Certificate Location:**

After deployment, certificates are located at:
- **Linux:** `/opt/cultivate/config/certs/`
- **macOS:** `/Users/username/cultivate/config/certs/`

**Examples:**

1. **HTTP only (no certificates):**
   ```bash
   HTTP_PORT=80
   HTTPS_PORT=443
   ENABLE_HTTPS=false
   # CERT_PATH not set
   ```
   Result: No certificate transfer, no volume mount, HTTP only

2. **HTTPS with certificates:**
   ```bash
   HTTP_PORT=80
   HTTPS_PORT=443
   ENABLE_HTTPS=true
   CERT_PATH=./config/certs
   ```
   Result: Certificates transferred and mounted, both HTTP and HTTPS available

3. **Custom ports with HTTPS:**
   ```bash
   HTTP_PORT=8080
   HTTPS_PORT=1443
   ENABLE_HTTPS=true
   CERT_PATH=./config/certs
   ```
   Result: Application accessible at http://host:8080 and https://host:1443

### Backend API Configuration

```bash
# Backend API URL (used by frontend)
VITE_BACKEND_URL=/api/v1

# Node environment
NODE_ENV=production

# Backend API port (internal)
BACKEND_PORT=3000

# CORS origin (comma-separated for multiple origins)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Or allow all origins (not recommended for production)
CORS_ORIGIN=*
```

### Database Configuration

```bash
# PostgreSQL user (must match apiuser for peer authentication)
POSTGRES_USER=apiuser

# Database name
POSTGRES_DB=cultivate
```

### Security Configuration

```bash
# Admin account credentials
SRP_ROOT_ADMIN_EMAIL=admin@yourdomain.com
SRP_ROOT_ADMIN_PASSWORD=your-secure-password-here

# JWT secret (use a long random string)
JWT_SECRET=your-very-long-random-secret-key-at-least-32-characters

# JWT token expiry times
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# API user UID/GID (for peer authentication)
API_USER_UID=1001
API_USER_GID=1001

# Socket permissions
SOCKET_PERMISSIONS=0770
```

### Deployment Configuration

```bash
# Build mode: local (build on your machine) or remote (build on target)
BUILD_MODE=local

# Verbose output
VERBOSE=false
```

### SSH Configuration (Optional)

```bash
# SSH username (defaults to current user)
SSH_USERNAME=deploy

# SSH private key path (defaults to ~/.ssh/id_rsa)
SSH_PRIVATE_KEY_PATH=~/.ssh/id_rsa

# SSH port (defaults to 22)
SSH_PORT=22

# SSH connection timeout in milliseconds
SSH_TIMEOUT=30000
```

## Configuration Workflow

### 1. Initial Setup

```bash
# Copy example to create your configuration
cp deployment/config/.env.example deployment/config/.env

# Edit with your settings
vim deployment/config/.env
```

### 2. Configure for Production

```bash
# Set production values
cat >> deployment/config/.env << 'EOF'
# Production settings
HTTP_PORT=80
HTTPS_PORT=443
ENABLE_HTTPS=true
CERT_PATH=./config/certs  # Local path - certificates will be transferred automatically
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
SRP_ROOT_ADMIN_EMAIL=admin@yourdomain.com
SRP_ROOT_ADMIN_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)
EOF

# Place your certificates in the local directory
mkdir -p deployment/config/certs
cp /path/to/your/fullchain.pem deployment/config/certs/
cp /path/to/your/privkey.pem deployment/config/certs/
```

### 3. Deploy

```bash
# Deploy to production host
npm run deploy -- user@production-host

# The deployment script will:
# 1. Read deployment/config/.env from your local machine
# 2. Validate the configuration
# 3. Transfer it to the remote host
# 4. Use it to configure containers
# 5. Start the application with your settings
```

### 4. Verify Configuration

```bash
# SSH to remote host
ssh user@production-host

# Check the transferred .env file
# On Linux:
cat /opt/cultivate/config/.env

# On macOS:
cat ~/cultivate/config/.env
```

## Configuration Updates

### Updating Configuration

To update configuration on a running deployment:

```bash
# 1. Edit local .env file
vim deployment/config/.env

# 2. Redeploy (this will restart containers with new config)
npm run deploy -- user@production-host
```

### Configuration Rollback

If deployment fails, the previous `.env` is automatically restored:

```bash
# Deployment fails
npm run deploy -- user@production-host
# Error: Configuration validation failed

# Previous .env is automatically restored
# Application continues running with old configuration
```

## Security Best Practices

### 1. Protect Your Local .env File

```bash
# Set restrictive permissions
chmod 600 deployment/config/.env

# Never commit to git
echo "deployment/config/.env" >> .gitignore
```

### 2. Use Strong Secrets

```bash
# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 48)

# Generate strong admin password
SRP_ROOT_ADMIN_PASSWORD=$(openssl rand -base64 32)
```

### 3. Limit CORS Origins

```bash
# Don't use wildcard in production
CORS_ORIGIN=https://yourdomain.com

# Multiple origins
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### 4. Enable HTTPS

```bash
# Always enable HTTPS in production
ENABLE_HTTPS=true
CERT_PATH=/etc/letsencrypt/live/yourdomain.com/
```

## Troubleshooting

### Configuration Not Transferred

**Symptom:** Remote host has default .env values

**Cause:** Deployment script is generating .env instead of transferring local file

**Solution:** Ensure you're using the latest deployment script that reads `deployment/config/.env`

### Configuration Validation Fails

**Symptom:** Deployment aborts with validation error

**Cause:** Required configuration values are missing or invalid

**Solution:** Check the error message for which values are invalid and fix them in your local `.env`

### Secrets Not Working

**Symptom:** JWT authentication fails or admin login doesn't work

**Cause:** Secrets not properly transferred or containers not restarted

**Solution:** 
1. Verify secrets are in your local `.env`
2. Redeploy to restart containers with new secrets
3. Check remote `.env` file to confirm transfer

### Certificates Not Working

**Symptom:** HTTPS not available or certificate errors

**Cause:** Certificates not found locally or not transferred

**Solution:**
1. Verify certificates exist at the local `CERT_PATH` location
2. Check that both `ENABLE_HTTPS=true` and `CERT_PATH` are set
3. Verify certificate files are named correctly (fullchain.pem, privkey.pem)
4. Check deployment logs for certificate transfer errors
5. SSH to remote host and verify certificates at `{configPath}/certs/`

**Example:**
```bash
# Check local certificates
ls -la deployment/config/certs/
# Should show: fullchain.pem, privkey.pem

# After deployment, check remote certificates
ssh user@host
ls -la /opt/cultivate/config/certs/  # Linux
ls -la ~/cultivate/config/certs/     # macOS
```

### Ports Only Accessible on Localhost (macOS with Finch)

**Symptom:** Application accessible at `http://localhost:8080` on the macOS host but not from external machines at `http://hostname:8080`

**Cause:** Finch's Lima VM only forwards ports to localhost (127.0.0.1) by default, even when docker-compose specifies `0.0.0.0`

**Solution:** Configure Lima to forward ports to all interfaces

Edit `~/.finch/finch.yaml` on the macOS target host:

```yaml
# Add or modify the portForwards section
portForwards:
  - guestSocket: /var/run/docker.sock
    hostSocket: /Users/{{.User}}/.finch/finch.sock
  # Add explicit port forwards for your application
  - guestPort: 80
    hostIP: "0.0.0.0"
    hostPort: 8080
  - guestPort: 443
    hostIP: "0.0.0.0"
    hostPort: 1443
```

Then restart Finch VM:

```bash
finch vm stop
finch vm start
```

**Note:** This is a Finch/Lima limitation. The deployment system correctly specifies `0.0.0.0` in docker-compose.yml, but Lima's network configuration must also be updated for external access.

For more details, see: [macOS Deployment Guide](MACOS_DEPLOYMENT.md)

## Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
CORS_ORIGIN=*
ENABLE_HTTPS=false
VERBOSE=true
```

### Staging

```bash
NODE_ENV=staging
CORS_ORIGIN=https://staging.yourdomain.com
ENABLE_HTTPS=true
CERT_PATH=./config/certs  # Local certificates, transferred automatically
```

### Production

```bash
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
ENABLE_HTTPS=true
CERT_PATH=./config/certs  # Local certificates, transferred automatically
JWT_SECRET=<strong-random-secret>
SRP_ROOT_ADMIN_PASSWORD=<strong-random-password>
```

## Summary

- ✅ **Configure locally** in `deployment/config/.env`
- ✅ **Deploy automatically** - no manual remote configuration
- ✅ **Secure transfer** via SSH
- ✅ **Automatic validation** before deployment
- ✅ **Automatic rollback** if configuration is invalid
- ✅ **Version control friendly** - keep `.env` out of git, use `.env.example` as template

**You never need to manually edit files on the production host!**
