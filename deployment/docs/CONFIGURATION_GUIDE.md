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
HTTP_PORT=80

# HTTPS port for web frontend
HTTPS_PORT=443

# Enable HTTPS (requires certificates)
ENABLE_HTTPS=false
```

### Certificate Configuration

```bash
# Path to SSL certificates on the TARGET HOST
# (certificates must exist on the remote host before deployment)
CERT_PATH=/etc/letsencrypt/live/yourdomain.com/

# Note: This is the path on the REMOTE host, not your local machine
```

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
CERT_PATH=/etc/letsencrypt/live/yourdomain.com/
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
SRP_ROOT_ADMIN_EMAIL=admin@yourdomain.com
SRP_ROOT_ADMIN_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)
EOF
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
CERT_PATH=/etc/letsencrypt/live/staging.yourdomain.com/
```

### Production

```bash
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
ENABLE_HTTPS=true
CERT_PATH=/etc/letsencrypt/live/yourdomain.com/
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
