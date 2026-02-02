# Nginx SSL Configuration Guide

## Overview

This guide explains how to configure nginx.conf on your local build machine so that your remote deployment host has the correct SSL configuration. The nginx.conf file is baked into the Docker image during build, so any changes must be made locally before deployment.

## Quick Start

### Step 1: Configure Your Local nginx.conf

**File Location**: `deployment/dockerfiles/nginx.conf` (on your local build machine)

### Step 2: Update Certificate Paths for Your Structure

Since your certificates are organized in subdirectories (e.g., `nur.ddns.net/`), you need to update the SSL certificate paths in nginx.conf to match your structure.

**Current Structure**:
```
config/certs/nur.ddns.net/
├── cert1.pem
├── chain1.pem
├── fullchain1.pem
└── privkey1.pem
```

**Update nginx.conf**:

```nginx
server {
    listen 443 ssl;
    server_name _;

    # SSL certificate configuration - adjust paths to match your certificate structure
    ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
    ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;
    
    # ... rest of configuration
}
```

### Step 3: Enable HTTPS in .env

**File**: `deployment/config/.env`

```bash
ENABLE_HTTPS=true
CERT_PATH=./config/certs
```

### Step 4: Deploy

```bash
cd deployment
npm run deploy -- user@production-host
```

The deployment process will:
1. Build the Docker image with your nginx.conf baked in
2. Transfer your certificates recursively (preserving the `nur.ddns.net/` subdirectory)
3. Mount certificates at `/etc/nginx/certs/` in the container
4. Nginx will use the paths you configured in nginx.conf

## Certificate Path Mapping

### Local Machine → Container Mapping

| Local Path | Remote Host Path | Container Path |
|------------|------------------|----------------|
| `deployment/config/certs/nur.ddns.net/fullchain1.pem` | `/opt/cultivate/config/certs/nur.ddns.net/fullchain1.pem` (Linux) or `/Users/username/cultivate/config/certs/nur.ddns.net/fullchain1.pem` (macOS) | `/etc/nginx/certs/nur.ddns.net/fullchain1.pem` |
| `deployment/config/certs/nur.ddns.net/privkey1.pem` | `/opt/cultivate/config/certs/nur.ddns.net/privkey1.pem` (Linux) or `/Users/username/cultivate/config/certs/nur.ddns.net/privkey1.pem` (macOS) | `/etc/nginx/certs/nur.ddns.net/privkey1.pem` |

**Key Points**:
- The `CERT_PATH` in .env points to your **local** certificate directory
- Certificates are **automatically transferred** to the remote host during deployment
- The remote certificate directory is **mounted** into the container at `/etc/nginx/certs/`
- Your nginx.conf paths should reference `/etc/nginx/certs/` (the container mount point)

## Configuration Examples

### Example 1: Nested Directory Structure (Your Current Setup)

**Local Certificate Structure**:
```
deployment/config/certs/
└── nur.ddns.net/
    ├── fullchain1.pem
    └── privkey1.pem
```

**nginx.conf Configuration**:
```nginx
server {
    listen 443 ssl;
    server_name nur.ddns.net;

    # Match your nested directory structure
    ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
    ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;

    # SSL security configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # ... rest of your configuration
}
```

### Example 2: Multiple Domains with Separate Certificates

**Local Certificate Structure**:
```
deployment/config/certs/
├── domain1.com/
│   ├── fullchain.pem
│   └── privkey.pem
└── domain2.com/
    ├── fullchain.pem
    └── privkey.pem
```

**nginx.conf Configuration**:
```nginx
# Domain 1
server {
    listen 443 ssl;
    server_name domain1.com www.domain1.com;

    ssl_certificate /etc/nginx/certs/domain1.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/domain1.com/privkey.pem;

    # ... configuration for domain1
}

# Domain 2
server {
    listen 443 ssl;
    server_name domain2.com www.domain2.com;

    ssl_certificate /etc/nginx/certs/domain2.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/domain2.com/privkey.pem;

    # ... configuration for domain2
}
```

### Example 3: Flat Directory Structure

**Local Certificate Structure**:
```
deployment/config/certs/
├── fullchain.pem
└── privkey.pem
```

**nginx.conf Configuration**:
```nginx
server {
    listen 443 ssl;
    server_name _;

    # Flat structure - certificates at root of certs directory
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # ... rest of configuration
}
```

## Recommended SSL Configuration

Here's a production-ready SSL configuration with modern security settings:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Certificates - adjust paths to match your structure
    ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
    ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;

    # Modern SSL Configuration (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # SSL Session Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP Stapling (improves SSL handshake performance)
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ... rest of your location blocks
}
```

## HTTP to HTTPS Redirect (Optional)

To automatically redirect HTTP traffic to HTTPS, update the HTTP server block:

```nginx
# HTTP Server - redirect to HTTPS
server {
    listen 80;
    server_name _;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}
```

## Configuration Workflow

### 1. Edit nginx.conf Locally

```bash
# Edit the nginx configuration on your local machine
vim deployment/dockerfiles/nginx.conf

# Update the SSL certificate paths to match your certificate structure
# For your setup: /etc/nginx/certs/nur.ddns.net/fullchain1.pem
```

### 2. Enable HTTPS in .env

```bash
# Edit your local .env file
vim deployment/config/.env

# Set these values:
ENABLE_HTTPS=true
CERT_PATH=./config/certs
```

### 3. Verify Certificates Exist Locally

```bash
# Check that your certificates exist
ls -la deployment/config/certs/nur.ddns.net/
# Should show: fullchain1.pem, privkey1.pem, cert1.pem, chain1.pem
```

### 4. Deploy

```bash
cd deployment
npm run deploy -- user@production-host
```

The deployment will:
1. Build the frontend Docker image with your nginx.conf
2. Transfer certificates recursively (preserving `nur.ddns.net/` subdirectory)
3. Mount certificates at `/etc/nginx/certs/` in the container
4. Start Nginx with SSL enabled

## Troubleshooting

### Issue: "SSL: error:02001002:system library:fopen:No such file or directory"

**Cause**: Certificate paths in nginx.conf don't match the actual certificate locations in the container.

**Solution**: 
1. Check your local certificate structure:
   ```bash
   find deployment/config/certs/ -name "*.pem"
   ```

2. Update nginx.conf paths to match:
   ```nginx
   # If certificates are in nur.ddns.net/ subdirectory:
   ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
   ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;
   ```

3. Rebuild and redeploy:
   ```bash
   npm run deploy -- user@production-host
   ```

### Issue: "nginx: [emerg] cannot load certificate"

**Cause**: Certificate file format is invalid or corrupted.

**Solution**:
1. Verify certificate format:
   ```bash
   openssl x509 -in deployment/config/certs/nur.ddns.net/fullchain1.pem -text -noout
   ```

2. Verify private key format:
   ```bash
   openssl rsa -in deployment/config/certs/nur.ddns.net/privkey1.pem -check
   ```

3. Verify certificate and key match:
   ```bash
   openssl x509 -noout -modulus -in deployment/config/certs/nur.ddns.net/fullchain1.pem | openssl md5
   openssl rsa -noout -modulus -in deployment/config/certs/nur.ddns.net/privkey1.pem | openssl md5
   # The MD5 hashes should match
   ```

### Issue: HTTPS not working after deployment

**Checklist**:
1. ✅ `ENABLE_HTTPS=true` in deployment/config/.env
2. ✅ `CERT_PATH=./config/certs` in deployment/config/.env
3. ✅ Certificates exist locally at the CERT_PATH location
4. ✅ nginx.conf certificate paths match your directory structure
5. ✅ HTTPS port is accessible (check firewall rules)

**Verify on remote host**:
```bash
# SSH to remote host
ssh user@production-host

# Check certificates were transferred (Linux)
ls -la /opt/cultivate/config/certs/nur.ddns.net/

# Check certificates were transferred (macOS)
ls -la ~/cultivate/config/certs/nur.ddns.net/

# Check nginx configuration in container
docker exec cultivate_frontend cat /etc/nginx/nginx.conf | grep ssl_certificate

# Check if certificates are mounted in container
docker exec cultivate_frontend ls -la /etc/nginx/certs/nur.ddns.net/
```

## Advanced Configuration

### Using Environment Variables in nginx.conf

Nginx doesn't natively support environment variables in configuration files, but you can use a template approach:

**Create nginx.conf.template**:
```nginx
server {
    listen 443 ssl;
    server_name ${DOMAIN_NAME};

    ssl_certificate /etc/nginx/certs/${CERT_SUBDIRECTORY}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/${CERT_SUBDIRECTORY}/privkey.pem;
    
    # ... rest of configuration
}
```

**Use envsubst in Dockerfile**:
```dockerfile
FROM nginx:alpine
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

# Substitute environment variables and start nginx
CMD envsubst '${DOMAIN_NAME} ${CERT_SUBDIRECTORY}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'
```

### Multiple Server Blocks for Different Domains

If you have multiple domains with separate certificates:

```nginx
# Domain 1
server {
    listen 443 ssl;
    server_name nur.ddns.net;

    ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
    ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;

    root /usr/share/nginx/html;
    # ... configuration
}

# Domain 2
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/nginx/certs/example.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/example.com/privkey.pem;

    root /usr/share/nginx/html;
    # ... configuration
}

# Default server (catch-all)
server {
    listen 443 ssl default_server;
    server_name _;

    ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
    ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;

    return 444; # Close connection
}
```

## SSL Best Practices

### 1. Use Strong Protocols and Ciphers

```nginx
# Only allow TLS 1.2 and 1.3
ssl_protocols TLSv1.2 TLSv1.3;

# Modern cipher suite (Mozilla Intermediate)
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

# Let clients choose cipher (modern best practice)
ssl_prefer_server_ciphers off;
```

### 2. Enable OCSP Stapling

```nginx
# Improves SSL handshake performance
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### 3. Configure Session Caching

```nginx
# Improve performance for returning visitors
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;  # Disable for better security
```

### 4. Add Security Headers

```nginx
# HSTS - force HTTPS for 1 year
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevent MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# XSS protection
add_header X-XSS-Protection "1; mode=block" always;

# Referrer policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 5. HTTP to HTTPS Redirect

```nginx
server {
    listen 80;
    server_name _;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}
```

## Certificate Renewal

### Let's Encrypt Certificates

If using Let's Encrypt, certificates need renewal every 90 days:

**Option 1: Update Locally and Redeploy**
```bash
# Renew certificates on your local machine
certbot renew

# Copy renewed certificates to deployment directory
cp /etc/letsencrypt/live/nur.ddns.net/fullchain.pem deployment/config/certs/nur.ddns.net/fullchain1.pem
cp /etc/letsencrypt/live/nur.ddns.net/privkey.pem deployment/config/certs/nur.ddns.net/privkey1.pem

# Redeploy (this rebuilds the image with updated nginx.conf if changed)
cd deployment
npm run deploy -- user@production-host
```

**Option 2: Renew on Remote Host**
```bash
# SSH to remote host
ssh user@production-host

# Renew certificates on remote host
certbot renew

# Copy to deployment directory (Linux)
cp /etc/letsencrypt/live/nur.ddns.net/fullchain.pem /opt/cultivate/config/certs/nur.ddns.net/
cp /etc/letsencrypt/live/nur.ddns.net/privkey.pem /opt/cultivate/config/certs/nur.ddns.net/

# Copy to deployment directory (macOS)
cp /etc/letsencrypt/live/nur.ddns.net/fullchain.pem ~/cultivate/config/certs/nur.ddns.net/
cp /etc/letsencrypt/live/nur.ddns.net/privkey.pem ~/cultivate/config/certs/nur.ddns.net/

# Reload nginx without rebuilding container
docker exec cultivate_frontend nginx -s reload
```

## Testing SSL Configuration

### Test Locally Before Deployment

```bash
# Validate nginx.conf syntax
docker run --rm -v $(pwd)/deployment/dockerfiles/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
```

### Test After Deployment

```bash
# Test HTTPS connection
curl -I https://nur.ddns.net

# Test SSL certificate
openssl s_client -connect nur.ddns.net:443 -servername nur.ddns.net

# Check SSL configuration quality
# Use online tools like:
# - https://www.ssllabs.com/ssltest/
# - https://securityheaders.com/
```

## Summary

**To configure SSL for your deployment**:

1. ✅ Edit `deployment/dockerfiles/nginx.conf` on your local machine
2. ✅ Update SSL certificate paths to match your directory structure:
   ```nginx
   ssl_certificate /etc/nginx/certs/nur.ddns.net/fullchain1.pem;
   ssl_certificate_key /etc/nginx/certs/nur.ddns.net/privkey1.pem;
   ```
3. ✅ Set `ENABLE_HTTPS=true` and `CERT_PATH=./config/certs` in `deployment/config/.env`
4. ✅ Deploy: `npm run deploy -- user@production-host`

The deployment system will:
- Build the Docker image with your nginx.conf
- Transfer certificates recursively (preserving subdirectories)
- Mount certificates at `/etc/nginx/certs/` in the container
- Start Nginx with SSL enabled

**Your certificates in `nur.ddns.net/` subdirectory will be automatically transferred and mounted correctly!**
