# Cache Busting Strategy

## Overview

The Cultivate deployment system implements content-based cache busting to ensure users always receive the latest JavaScript and CSS after deployments. This prevents the common problem where browsers serve stale cached code, causing users to see outdated functionality or broken features.

## How It Works

### 1. Content-Hashed Filenames

Vite automatically generates content-based hashes for all static assets during the build process:

```
Before:  main.js, style.css, logo.png
After:   main.abc123def.js, style.xyz789ghi.css, logo.def456abc.png
```

The hash is derived from the file's content, so:
- **Same content = Same hash** (unchanged files keep their hash)
- **Different content = Different hash** (modified files get a new hash)

### 2. Nginx Caching Policy

The nginx configuration uses different caching strategies for different file types:

#### Hashed Assets (Long-Term Caching)
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

- **Cache Duration**: 1 year
- **Rationale**: Since filenames change when content changes, it's safe to cache aggressively
- **Benefit**: Optimal performance - browsers never re-download unchanged assets

#### index.html (No Caching)
```nginx
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

- **Cache Duration**: None (always fetch fresh)
- **Rationale**: index.html references the hashed filenames, so it must always be fresh
- **Benefit**: Users immediately see new asset references after deployment

### 3. Deployment Flow

Here's what happens when you deploy code changes:

```
1. Developer changes JavaScript code
   └─> File: src/App.tsx

2. Vite build generates new hash
   └─> Old: main.abc123def.js
   └─> New: main.xyz789ghi.js

3. index.html updated automatically
   └─> <script src="/assets/main.xyz789ghi.js"></script>

4. Deployment transfers files to container
   └─> Both old and new files exist temporarily

5. User visits site
   ├─> Browser fetches index.html (no-cache)
   ├─> Browser sees new filename: main.xyz789ghi.js
   ├─> Browser fetches new JavaScript (cache miss)
   └─> Old main.abc123def.js remains cached but is never requested
```

## Configuration

### Vite Configuration

The cache busting is configured in `web-frontend/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // JavaScript entry files: main.js -> main.[hash].js
        entryFileNames: 'assets/[name].[hash].js',
        
        // JavaScript chunks: vendor.js -> vendor.[hash].js
        chunkFileNames: 'assets/[name].[hash].js',
        
        // CSS and other assets: style.css -> style.[hash].css
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
})
```

### Nginx Configuration

The caching policy is configured in `deployment/dockerfiles/nginx.conf`:

```nginx
# Long-term caching for hashed assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# No caching for index.html
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

## Benefits

### 1. Immediate Updates
Users see code changes immediately after deployment without manual cache clearing.

### 2. Optimal Performance
Unchanged assets are cached for 1 year, minimizing bandwidth and improving load times.

### 3. No Manual Intervention
No need for:
- Version query parameters (`app.js?v=1.2.3`)
- Manual cache clearing
- Service worker cache invalidation
- User instructions to "hard refresh"

### 4. CDN Compatibility
Works seamlessly with CDNs and proxy caches since cache invalidation is automatic.

### 5. Rollback Safety
If you rollback to a previous deployment, the old hashed files are still cached, so rollbacks are instant.

## Verification

### Build Verification

After building, verify hashed filenames are generated:

```bash
cd web-frontend
npm run build
ls dist/assets/

# Expected output:
# main.abc123def.js
# style.xyz789ghi.css
# logo.def456abc.png
```

### Deployment Verification

After deployment, verify nginx serves correct cache headers:

```bash
# Check index.html (should have no-cache)
curl -I https://your-domain.com/

# Expected headers:
# Cache-Control: no-cache, no-store, must-revalidate
# Pragma: no-cache
# Expires: 0

# Check JavaScript file (should have long-term cache)
curl -I https://your-domain.com/assets/main.abc123def.js

# Expected headers:
# Cache-Control: public, immutable
# Expires: <1 year from now>
```

### Browser Verification

1. Open browser DevTools (Network tab)
2. Visit your site
3. Check the "Size" column:
   - index.html should show actual size (not "from cache")
   - JavaScript/CSS should show "from disk cache" on subsequent loads
4. After deployment:
   - index.html should reload (new size)
   - New JavaScript/CSS files should load (cache miss)
   - Old files remain cached but unused

## Troubleshooting

### Problem: Users still see old code after deployment

**Diagnosis:**
```bash
# Check if new files were deployed
ls /usr/share/nginx/html/assets/

# Check if index.html references new files
cat /usr/share/nginx/html/index.html | grep "assets/"
```

**Solutions:**
1. Verify build generated new hashes: `npm run build && ls dist/assets/`
2. Verify deployment transferred new files to container
3. Check nginx cache headers: `curl -I https://your-domain.com/`
4. Clear browser cache as last resort (shouldn't be needed)

### Problem: Assets not loading after deployment

**Diagnosis:**
```bash
# Check if files exist
ls /usr/share/nginx/html/assets/

# Check nginx error logs
docker logs cultivate_frontend
```

**Solutions:**
1. Verify all asset files were transferred during deployment
2. Check nginx configuration is valid: `nginx -t`
3. Verify file permissions allow nginx to read files

### Problem: Build generates unhashed filenames

**Diagnosis:**
```bash
# Check vite.config.ts
cat web-frontend/vite.config.ts
```

**Solutions:**
1. Verify `build.rollupOptions.output` is configured correctly
2. Ensure Vite version supports content hashing (v2+)
3. Run clean build: `rm -rf dist && npm run build`

## Testing

The cache busting implementation is tested in `web-frontend/src/__tests__/cache-busting.test.ts`:

```bash
cd web-frontend
npm test -- cache-busting.test.ts
```

Tests verify:
- JavaScript files have content hashes
- CSS files have content hashes
- index.html references hashed filenames
- All asset types are hashed
- Build output contains expected files

## References

- **Vite Build Options**: https://vitejs.dev/config/build-options.html
- **Nginx Caching**: https://nginx.org/en/docs/http/ngx_http_headers_module.html
- **HTTP Caching**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
- **Cache-Control**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control

## Requirements Satisfied

This implementation satisfies the following requirements:

- **16.1**: Build process generates content-hashed filenames for all JavaScript and CSS assets
- **16.2**: Content changes result in new filenames with different hashes
- **16.3**: Build process automatically updates HTML references to hashed filenames
- **16.4**: Nginx serves JavaScript and CSS with long-term cache headers (1 year)
- **16.5**: Nginx serves index.html with no-cache headers
- **16.6**: Deployment verifies new asset filenames are present in build output
- **16.7**: Build process applies content hashing to all imported assets (images, fonts, etc.)
- **16.8**: Documentation explains cache busting strategy and benefits
