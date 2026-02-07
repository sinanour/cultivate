# Implementation Plan: Mobile API Caching Fix

## Overview

This is a **critical security bugfix** to prevent cross-user data leakage caused by aggressive API response caching on mobile browsers. The fix involves changes to the service worker, backend API headers, nginx configuration, and frontend logout behavior.

**Priority:** CRITICAL - Must be completed immediately
**Estimated Time:** 4-8 hours
**Risk Level:** HIGH (security vulnerability)

## Tasks

- [-] 1. Investigate and fix service worker API caching
  - [x] 1.1 Locate service worker file
    - Search for `service-worker.js`, `sw.js`, or Vite/Workbox generated service worker
    - Check `web-frontend/public/` directory
    - Check `web-frontend/src/` directory
    - Check Vite configuration for service worker plugin
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7_

  - [x] 1.2 Audit service worker caching strategies
    - Search for `caches.open`, `cache.add`, `cache.put` in service worker code
    - Search for `fetch` event listeners
    - Search for `workbox.routing.registerRoute` or similar Workbox patterns
    - Identify any caching strategies applied to API routes
    - Document current caching behavior
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Implement API route exclusion in service worker
    - Add explicit exclusion for `/api/**` routes
    - Use `NetworkOnly` strategy for API requests (if using Workbox)
    - Or add early return in fetch event listener for API requests
    - Example code:
      ```javascript
      // Workbox approach
      import { NetworkOnly } from 'workbox-strategies';
      import { registerRoute } from 'workbox-routing';
      
      registerRoute(
        ({ url }) => url.pathname.startsWith('/api/'),
        new NetworkOnly()
      );
      
      // Or manual approach
      self.addEventListener('fetch', (event) => {
        if (event.request.url.includes('/api/')) {
          return; // Pass through without caching
        }
        // ... other caching logic
      });
      ```
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 1.4 Test service worker changes locally
    - Open Chrome DevTools → Application → Service Workers
    - Verify service worker is registered
    - Open Cache Storage
    - Make API requests
    - Verify no `/api/**` entries appear in cache
    - Test on mobile Safari using remote debugging
    - Test on mobile Chrome using remote debugging
    - _Requirements: 1.6, 1.7, 1.8_

  - [ ]* 1.5 Write property test for service worker API exclusion
    - **Property 1: Service Worker API Exclusion**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**

- [-] 2. Implement backend cache headers
  - [x] 2.1 Create no-cache middleware
    - Create `backend-api/src/middleware/no-cache.middleware.ts`
    - Implement middleware that adds cache headers:
      - `Cache-Control: no-store, no-cache, must-revalidate, private`
      - `Pragma: no-cache`
      - `Expires: 0`
      - `Vary: Authorization, Cookie`
    - Remove `ETag` and `Last-Modified` headers
    - Example code:
      ```typescript
      import { Request, Response, NextFunction } from 'express';
      
      export function noCacheMiddleware(req: Request, res: Response, next: NextFunction) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Vary', 'Authorization, Cookie');
        res.removeHeader('ETag');
        res.removeHeader('Last-Modified');
        next();
      }
      ```
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2_

  - [x] 2.2 Apply middleware to all API routes
    - Update `backend-api/src/app.ts` or main Express app file
    - Apply middleware globally to `/api` routes
    - Example: `app.use('/api', noCacheMiddleware);`
    - Ensure middleware runs before route handlers
    - _Requirements: 2.7_

  - [ ] 2.3 Test cache headers on all status codes
    - Test 200 OK responses
    - Test 304 Not Modified responses (should not occur after ETag removal)
    - Test 401 Unauthorized responses
    - Test 403 Forbidden responses
    - Test 404 Not Found responses
    - Test 500 Internal Server Error responses
    - Use curl or Postman to verify headers
    - Example: `curl -I http://localhost:3000/api/users/me -H "Authorization: Bearer <token>"`
    - _Requirements: 2.6_

  - [ ]* 2.4 Write property test for cache headers
    - **Property 2: Cache Header Presence**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

- [-] 3. Update nginx configuration
  - [x] 3.1 Locate nginx configuration file
    - Check for `nginx.conf` in project root or deployment directory
    - Check for site-specific config in `/etc/nginx/sites-available/`
    - Check for Docker nginx config if using containers
    - Document current nginx configuration
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Add API location block with cache disabling
    - Add or update `/api/` location block
    - Add `proxy_no_cache 1` directive
    - Add `proxy_cache_bypass 1` directive
    - Add cache headers with `always` flag
    - Disable ETag with `etag off`
    - Example:
      ```nginx
      location /api/ {
          proxy_pass http://backend:3000;
          
          # Disable proxy caching
          proxy_no_cache 1;
          proxy_cache_bypass 1;
          
          # Add cache headers (always flag for 304 responses)
          add_header Cache-Control "no-store, no-cache, must-revalidate, private" always;
          add_header Pragma "no-cache" always;
          add_header Expires "0" always;
          
          # Disable ETag
          etag off;
          
          # Standard proxy headers
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
      ```
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 4.3_

  - [x] 3.3 Verify no global caching directives affect APIs
    - Search for `proxy_cache` directives outside location blocks
    - Search for `fastcgi_cache` directives
    - Search for `expires` directives
    - Ensure none apply to `/api/` routes
    - _Requirements: 3.6, 3.7, 3.8_

  - [ ] 3.4 Test nginx configuration
    - Run `nginx -t` to test configuration syntax
    - Reload nginx: `nginx -s reload` or `systemctl reload nginx`
    - Make API requests and verify headers using curl
    - Verify backend is hit on every request (check backend logs)
    - _Requirements: 3.9, 3.10_

  - [ ]* 3.5 Write property test for nginx cache bypass
    - **Property 5: nginx Cache Bypass**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

- [ ] 4. Disable conditional requests
  - [ ] 4.1 Verify ETag removal in backend middleware
    - Confirm `res.removeHeader('ETag')` is in no-cache middleware
    - Confirm `res.removeHeader('Last-Modified')` is in no-cache middleware
    - _Requirements: 4.1, 4.2_

  - [ ] 4.2 Verify ETag disabling in nginx
    - Confirm `etag off` is in nginx API location block
    - _Requirements: 4.3_

  - [ ] 4.3 Test conditional request handling
    - Make API request with `If-None-Match` header
    - Verify response is 200 OK, not 304 Not Modified
    - Make API request with `If-Modified-Since` header
    - Verify response is 200 OK, not 304 Not Modified
    - _Requirements: 4.4, 4.5_

  - [ ]* 4.4 Write property test for conditional request disabling
    - **Property 4: Conditional Request Disabling**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

- [-] 5. Implement client-side cache busting (diagnostic)
  - [x] 5.1 Add cache busting to API client
    - Update `web-frontend/src/services/api-client.ts` or equivalent
    - Add environment variable `VITE_ENABLE_CACHE_BUSTING`
    - When enabled, append `?_t=${Date.now()}` to API URLs
    - Add `cache: 'no-store'` to all fetch requests
    - Add console logging for debugging
    - Example:
      ```typescript
      const ENABLE_CACHE_BUSTING = import.meta.env.VITE_ENABLE_CACHE_BUSTING === 'true';
      
      export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        let url = `${API_BASE_URL}${endpoint}`;
        
        if (ENABLE_CACHE_BUSTING) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}_t=${Date.now()}`;
          console.log('[Cache Buster] Request:', url);
        }
        
        const response = await fetch(url, {
          ...options,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        
        return response.json();
      }
      ```
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [ ] 5.2 Test with cache busting enabled
    - Set `VITE_ENABLE_CACHE_BUSTING=true` in `.env`
    - Rebuild frontend
    - Test on mobile browsers
    - Verify issue is resolved with cache busting
    - This confirms caching is the root cause
    - _Requirements: 5.4, 5.5_

  - [x] 5.3 Document cache busting as temporary diagnostic tool
    - Add comment in code explaining this is temporary
    - Document in README or deployment guide
    - Plan to remove once proper headers are in place
    - _Requirements: 5.6_

  - [ ]* 5.4 Write property test for cache busting
    - **Property 6: Client-Side Cache Busting**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [-] 6. Fix logout behavior
  - [x] 6.1 Update logout function to clear all state
    - Update `web-frontend/src/services/auth.service.ts` or equivalent
    - Clear localStorage (except service worker registration)
    - Clear sessionStorage
    - Clear React Query cache using `queryClient.clear()`
    - Example:
      ```typescript
      export async function logout(): Promise<void> {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout API call failed:', error);
        }
        
        // Clear all client-side state
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        // Clear React Query cache
        queryClient.clear();
        
        // Hard navigation to force page reload
        window.location.href = '/login';
      }
      ```
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.2 Replace client-side routing with hard navigation
    - Replace `navigate('/login')` with `window.location.href = '/login'`
    - Ensure hard navigation occurs after state clearing
    - _Requirements: 6.4, 6.5, 6.6_

  - [ ] 6.3 Test logout on mobile browsers
    - Test on mobile Safari
    - Test on mobile Chrome (Android)
    - Test on mobile Chrome (iOS)
    - Verify all state is cleared
    - Verify page reloads completely
    - Verify no cached data persists
    - _Requirements: 6.7, 6.8, 6.9_

  - [ ]* 6.4 Write property test for logout state clearing
    - **Property 7: Logout State Clearing**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

- [-] 7. Create service worker debugging tools
  - [x] 7.1 Create ServiceWorkerDebugPage component
    - Create `web-frontend/src/pages/ServiceWorkerDebugPage.tsx`
    - Display service worker registration status
    - List all cache storage entries
    - Provide button to unregister service worker
    - Provide button to clear all caches
    - Provide button to inspect each cache for API URLs
    - Alert if API URLs found in cache
    - Example structure:
      ```typescript
      export function ServiceWorkerDebugPage() {
        const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
        const [caches, setCaches] = useState<string[]>([]);
        
        async function loadServiceWorkerInfo() {
          const reg = await navigator.serviceWorker.getRegistration();
          setRegistration(reg || null);
          const cacheNames = await window.caches.keys();
          setCaches(cacheNames);
        }
        
        async function unregisterServiceWorker() {
          if (registration) {
            await registration.unregister();
            alert('Service worker unregistered. Reload the page.');
          }
        }
        
        async function clearAllCaches() {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.map(name => window.caches.delete(name)));
          alert('All caches cleared.');
        }
        
        async function inspectCache(cacheName: string) {
          const cache = await window.caches.open(cacheName);
          const requests = await cache.keys();
          const urls = requests.map(req => req.url);
          const apiUrls = urls.filter(url => url.includes('/api/'));
          
          if (apiUrls.length > 0) {
            alert(`⚠️ WARNING: API URLs found in cache!\n\n${apiUrls.join('\n')}`);
          } else {
            alert(`✓ No API URLs in cache "${cacheName}"`);
          }
        }
        
        // ... render UI
      }
      ```
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.2 Add route for debug page
    - Add route `/debug/service-worker` in React Router
    - Protect route with authentication (optional)
    - _Requirements: 7.7_

  - [ ] 7.3 Test debug tools
    - Navigate to `/debug/service-worker`
    - Verify service worker status is displayed
    - Verify cache list is displayed
    - Test unregister button
    - Test clear caches button
    - Test inspect cache button
    - Verify app continues to work after unregistering service worker
    - _Requirements: 7.6, 7.8_

  - [ ]* 7.4 Write property test for service worker debugging
    - **Property 8: Service Worker Debugging Tools**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**

- [ ] 8. Comprehensive mobile browser testing
  - [ ] 8.1 Prepare test environment
    - Set up test accounts: User A and User B
    - Prepare test data for each user
    - Set up remote debugging for mobile Safari
    - Set up remote debugging for mobile Chrome
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 8.2 Execute cross-user data leakage test
    - Test on mobile Safari (iOS):
      1. User A logs in and views their data
      2. Note specific data points (e.g., participant names, activity titles)
      3. User A logs out
      4. User B logs in on the same device
      5. Verify User B sees ONLY their own data, not User A's data
      6. Check all pages: dashboard, participants, activities, venues, analytics
    - Test on mobile Chrome (Android):
      1. Repeat same steps as mobile Safari
    - Test on mobile Chrome (iOS):
      1. Repeat same steps as mobile Safari
    - _Requirements: 8.4_

  - [ ] 8.3 Verify cache headers in mobile browser DevTools
    - Open remote debugging for mobile browser
    - Navigate to Network tab
    - Make API requests
    - Inspect response headers
    - Verify `Cache-Control`, `Pragma`, `Expires`, `Vary` headers are present
    - Verify no `ETag` or `Last-Modified` headers
    - _Requirements: 8.5_

  - [ ] 8.4 Verify service worker cache on mobile
    - Open remote debugging for mobile browser
    - Navigate to Application tab → Service Workers
    - Verify service worker is registered
    - Navigate to Cache Storage
    - Verify no `/api/**` entries exist
    - _Requirements: 8.6_

  - [ ] 8.5 Test with airplane mode (offline behavior)
    - Enable airplane mode on mobile device
    - Verify app shows appropriate offline message
    - Verify static assets are still cached (if intended)
    - Verify API requests fail gracefully
    - Disable airplane mode
    - Verify app recovers and fetches fresh data
    - _Requirements: 8.8_

  - [ ] 8.6 Test with slow network conditions
    - Use Chrome DevTools to throttle network (Slow 3G)
    - Make API requests
    - Verify responses are not cached
    - Verify loading indicators work correctly
    - _Requirements: 8.9_

  - [ ]* 8.7 Write property test for cross-user isolation
    - **Property 3: Cross-User Isolation**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9**

- [ ] 9. Complete validation checklist
  - [ ] 9.1 Service worker validation
    - [ ] Service worker does NOT cache `/api/**`
    - [ ] Cache storage contains no API entries
    - [ ] NetworkOnly strategy applied to API routes
    - _Requirements: 9.1_

  - [ ] 9.2 Backend cache headers validation
    - [ ] API responses include `Cache-Control: no-store, no-cache, must-revalidate, private`
    - [ ] API responses include `Pragma: no-cache`
    - [ ] API responses include `Expires: 0`
    - [ ] API responses include `Vary: Authorization, Cookie`
    - [ ] Headers present on all status codes (200, 304, 401, 403, 404, 500)
    - _Requirements: 9.2_

  - [ ] 9.3 nginx configuration validation
    - [ ] nginx caching disabled for APIs (`proxy_no_cache 1`, `proxy_cache_bypass 1`)
    - [ ] nginx adds cache headers with `always` flag
    - [ ] nginx disables ETag (`etag off`)
    - [ ] No global caching directives affect APIs
    - _Requirements: 9.4_

  - [ ] 9.4 Conditional requests validation
    - [ ] ETag headers not present in API responses
    - [ ] Last-Modified headers not present in API responses
    - [ ] Conditional requests return 200 OK, not 304 Not Modified
    - _Requirements: 9.5_

  - [ ] 9.5 Client-side validation
    - [ ] localStorage cleared on logout
    - [ ] sessionStorage cleared on logout
    - [ ] React Query cache cleared on logout
    - [ ] Hard navigation occurs on logout (`window.location.href`)
    - [ ] Fetch requests include `cache: 'no-store'`
    - _Requirements: 9.6, 9.7_

  - [ ] 9.6 Mobile browser validation
    - [ ] No cross-user data leakage on mobile Safari
    - [ ] No cross-user data leakage on mobile Chrome (Android)
    - [ ] No cross-user data leakage on mobile Chrome (iOS)
    - [ ] Fresh data fetched after login
    - _Requirements: 9.8_

  - [ ] 9.7 Final validation
    - [ ] All checklist items complete
    - [ ] Zero reports of cross-user data leakage
    - [ ] All property tests passing
    - [ ] Ready for production deployment
    - _Requirements: 9.9_

## Priority and Dependencies

**Critical Path:**
1. Service worker fix (Task 1) - HIGHEST PRIORITY
2. Backend cache headers (Task 2) - HIGHEST PRIORITY
3. nginx configuration (Task 3) - HIGH PRIORITY
4. Logout fix (Task 6) - HIGH PRIORITY
5. Mobile testing (Task 8) - HIGH PRIORITY
6. Validation (Task 9) - HIGH PRIORITY

**Can be done in parallel:**
- Tasks 1, 2, 3 can be done simultaneously by different developers
- Task 5 (cache busting) is diagnostic and can be done anytime
- Task 7 (debug tools) is helpful but not critical

**Dependencies:**
- Task 8 (mobile testing) depends on Tasks 1, 2, 3, 6 being complete
- Task 9 (validation) depends on all other tasks being complete

## Estimated Timeline

- **Task 1 (Service Worker):** 1-2 hours
- **Task 2 (Backend Headers):** 1 hour
- **Task 3 (nginx Config):** 1 hour
- **Task 4 (Conditional Requests):** 30 minutes (verification only)
- **Task 5 (Cache Busting):** 30 minutes
- **Task 6 (Logout Fix):** 1 hour
- **Task 7 (Debug Tools):** 1-2 hours
- **Task 8 (Mobile Testing):** 2-3 hours
- **Task 9 (Validation):** 1 hour

**Total:** 8-12 hours

## Success Criteria

The bugfix is complete when:
1. All validation checklist items are checked
2. All property tests pass
3. Mobile browser testing confirms no cross-user data leakage
4. Zero reports of stale data from users
5. Production deployment is successful

## Rollback Plan

If issues occur after deployment:
1. Revert service worker changes
2. Revert backend middleware changes
3. Revert nginx configuration changes
4. Monitor for continued reports of stale data
5. Investigate alternative solutions if needed
