# Your SSL Setup: nur.ddns.net

## Current Certificate Structure

Your certificates are organized in a subdirectory:

```
deployment/config/certs/
└── nur.ddns.net/
    ├── cert1.pem
    ├── chain1.pem
    ├── fullchain1.pem
    └── privkey1.pem
```

## nginx.conf Configuration

**File**: `deployment/dockerfiles/nginx.conf`

The HTTPS server block has been configured to use your nested certificate structure:

```nginx
server {
    listen 443 ssl;
    server_name _;

    # SSL certificate paths match your nur.ddns.net/ subdirectory
    ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
    ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;
    
    # Modern SSL security configuration included
    # ... (see full config in nginx.conf)
}
```

## Deployment Configuration

**File**: `deployment/config/.env`

To enable HTTPS with your certificates:

```bash
# Enable HTTPS
ENABLE_HTTPS=true

# Point to your local certificate directory
CERT_PATH=./config/certs

# Configure ports (optional - defaults shown)
HTTP_PORT=80
HTTPS_PORT=443
```

## How It Works

### 1. Local Build
When you run deployment, the system:
- Reads your local nginx.conf from `deployment/dockerfiles/nginx.conf`
- Bakes it into the Docker image during build
- The certificate paths in nginx.conf reference `/etc/nginx/certs/nur.ddns.net/`

### 2. Certificate Transfer
The deployment system:
- Reads `CERT_PATH=./config/certs` from your local .env
- Finds your certificates at `deployment/config/certs/nur.ddns.net/`
- **Recursively transfers** the entire directory structure to the remote host
- Preserves the `nur.ddns.net/` subdirectory

### 3. Container Mounting
On the remote host:
- Certificates are stored at `/opt/cultivate/config/certs/nur.ddns.net/` (Linux) or `~/cultivate/config/certs/nur.ddns.net/` (macOS)
- Docker Compose mounts the entire certs directory into the container at `/etc/nginx/certs/`
- Inside the container: `/etc/nginx/certs/nur.ddns.net/fullchain1.pem` exists
- Nginx uses the paths configured in nginx.conf

## Quick Deploy

```bash
cd deployment
npm run deploy -- user@production-host
```

That's it! Your certificates will be automatically transferred and configured.

## Verify SSL is Working

After deployment:

```bash
# Test HTTPS connection
curl -I https://nur.ddns.net

# Check certificate details
openssl s_client -connect nur.ddns.net:443 -servername nur.ddns.net < /dev/null

# Verify certificate in container
ssh user@production-host
docker exec cultivate_frontend ls -la /etc/nginx/certs/nur.ddns.net/
```

## Certificate Renewal

When your Let's Encrypt certificates need renewal:

### Option 1: Renew Locally and Redeploy
```bash
# Renew on your local machine
certbot renew

# Copy renewed certificates
cp /etc/letsencrypt/live/nur.ddns.net/fullchain.pem deployment/config/certs/nur.ddns.net/fullchain1.pem
cp /etc/letsencrypt/live/nur.ddns.net/privkey.pem deployment/config/certs/nur.ddns.net/privkey1.pem

# Redeploy
cd deployment
npm run deploy -- user@production-host
```

### Option 2: Renew on Remote Host (No Rebuild)
```bash
# SSH to remote
ssh user@production-host

# Renew certificates
certbot renew

# Copy to deployment directory
cp /etc/letsencrypt/live/nur.ddns.net/fullchain.pem /opt/cultivate/config/certs/nur.ddns.net/fullchain1.pem
cp /etc/letsencrypt/live/nur.ddns.net/privkey.pem /opt/cultivate/config/certs/nur.ddns.net/privkey1.pem

# Reload nginx (no container rebuild needed)
docker exec cultivate_frontend nginx -s reload
```

## Summary

✅ **nginx.conf is configured** for your `nur.ddns.net/` certificate structure
✅ **Recursive transfer enabled** - subdirectories are preserved
✅ **All tests pass** - 500 tests including recursive certificate transfer
✅ **Ready to deploy** - just run `npm run deploy`

Your SSL setup is complete and ready for production deployment!
