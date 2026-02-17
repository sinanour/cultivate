# HTTP Cache Headers Configuration

This document explains the cache header requirements for the SPA atomic upgrade system.

## Overview

The atomic upgrade system relies on proper HTTP cache headers to ensure:
- HTML is always fresh (no-cache)
- Hashed assets are safely long-lived (immutable, 1 year)
- Users always get the latest code after deployment
- Optimal performance with long-term caching for unchanged assets

## Cache Header Strategy

### index.html - Always Fresh

The `index.html` file must NEVER be cached. It contains references to the latest hashed assets and must always be fetched from the server.

```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

### Hashed Assets - Long-Lived

All JavaScript, CSS, and other assets with content hashes in their filenames can be cached indefinitely because:
- The filename changes when content changes
- Old filenames are never requested after deployment
- The service worker precaches all assets

```
Cache-Control: public, max-age=31536000, immutable
```

## Server Configuration Examples

### Nginx

```nginx
server {
    listen 80;
    server_name example.com;
    root /usr/share/nginx/html;

    # index.html - always fresh
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Hashed assets - long-lived
    location ~* ^/assets/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Service worker - no cache (needs to update immediately)
    location = /service-worker.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Fallback for SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### AWS CloudFront

Create two cache behaviors:

**Behavior 1: index.html (no cache)**
```json
{
  "PathPattern": "/index.html",
  "TargetOriginId": "S3-origin",
  "ViewerProtocolPolicy": "redirect-to-https",
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "ResponseHeadersPolicyId": "custom-no-cache-policy"
}
```

Custom Response Headers Policy for no-cache:
```json
{
  "Name": "no-cache-policy",
  "CustomHeadersConfig": {
    "Items": [
      {
        "Header": "Cache-Control",
        "Value": "no-cache, no-store, must-revalidate",
        "Override": true
      },
      {
        "Header": "Pragma",
        "Value": "no-cache",
        "Override": true
      },
      {
        "Header": "Expires",
        "Value": "0",
        "Override": true
      }
    ]
  }
}
```

**Behavior 2: Hashed assets (long-lived)**
```json
{
  "PathPattern": "/assets/*",
  "TargetOriginId": "S3-origin",
  "ViewerProtocolPolicy": "redirect-to-https",
  "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
  "ResponseHeadersPolicyId": "custom-immutable-policy"
}
```

Custom Response Headers Policy for immutable:
```json
{
  "Name": "immutable-policy",
  "CustomHeadersConfig": {
    "Items": [
      {
        "Header": "Cache-Control",
        "Value": "public, max-age=31536000, immutable",
        "Override": true
      }
    ]
  }
}
```

### Apache

```apache
<IfModule mod_headers.c>
    # index.html - always fresh
    <FilesMatch "index\.html$">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
        Header set Pragma "no-cache"
        Header set Expires "0"
    </FilesMatch>

    # Hashed assets - long-lived
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>

    # Service worker - no cache
    <FilesMatch "service-worker\.js$">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
        Header set Pragma "no-cache"
        Header set Expires "0"
    </FilesMatch>
</IfModule>

# SPA routing fallback
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

### Express.js (Node.js)

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve static files with appropriate cache headers
app.use('/assets', express.static(path.join(__dirname, 'dist/assets'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Service worker - no cache
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist/service-worker.js'));
});

// index.html - no cache
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(3000);
```

## Why This Works

### Content-Based Cache Busting

Vite automatically generates content-based hashes for all assets:

```
Before:  main.js
After:   main.abc123def.js
```

When you change the code:
```
After:   main.xyz789ghi.js
```

### Deployment Flow

1. Developer changes JavaScript code
2. Vite build generates new hash: `main.abc123def.js` → `main.xyz789ghi.js`
3. `index.html` updated to reference `main.xyz789ghi.js`
4. Deployment transfers new files to server
5. Browser fetches fresh `index.html` (no-cache)
6. Browser sees new filename `main.xyz789ghi.js`
7. Browser fetches new JavaScript (cache miss)
8. Old `main.abc123def.js` remains cached but is never requested

### Service Worker Integration

The service worker precaches all hashed assets during installation:
- Ensures complete version consistency
- Eliminates 404 errors for lazy-loaded chunks
- Enables offline functionality
- Allows safe deletion of old assets server-side

## Verification

### Check Cache Headers

Use browser DevTools Network tab:

1. Open DevTools (F12)
2. Go to Network tab
3. Reload page (Cmd+R / Ctrl+R)
4. Click on `index.html`
5. Check Response Headers:
   - Should see `Cache-Control: no-cache`
6. Click on any asset in `/assets/`
7. Check Response Headers:
   - Should see `Cache-Control: public, max-age=31536000, immutable`

### Test with curl

```bash
# Check index.html
curl -I https://example.com/index.html

# Check hashed asset
curl -I https://example.com/assets/main.abc123def.js
```

## Common Issues

### Issue: Users see old code after deployment

**Cause**: `index.html` is being cached

**Solution**: Verify cache headers on `index.html` are set to `no-cache`

### Issue: Slow page loads after deployment

**Cause**: Assets are not being cached long-term

**Solution**: Verify hashed assets have `max-age=31536000, immutable`

### Issue: 404 errors for lazy-loaded chunks

**Cause**: Service worker not precaching assets or old assets deleted too soon

**Solution**: 
1. Verify service worker is registered and active
2. Check that Workbox manifest includes all assets
3. Ensure old assets remain available until service worker updates

## Best Practices

1. **Always use content hashing**: Vite does this automatically
2. **Never cache index.html**: It must always be fresh
3. **Use immutable for hashed assets**: Prevents unnecessary revalidation
4. **Don't cache service-worker.js**: It needs to update immediately
5. **Test cache headers**: Verify in production before deployment
6. **Monitor service worker**: Check registration and activation in DevTools

## References

- [MDN: HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Vite: Build Optimizations](https://vitejs.dev/guide/build.html)
- [Workbox: Precaching](https://developers.google.com/web/tools/workbox/modules/workbox-precaching)
