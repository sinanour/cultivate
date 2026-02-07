# Requirements Document: Mobile API Caching Fix

## Introduction

This specification addresses a critical security and data integrity bug where API responses are being cached on mobile browsers, resulting in stale data and cross-user data leakage. Users report seeing data from previously logged-in users after logout and re-login, particularly on mobile Safari and Chrome.

The root cause is a combination of:
1. Service worker potentially caching API responses
2. Missing or incorrect HTTP cache headers on API responses
3. Possible nginx caching configuration issues
4. Aggressive mobile browser caching behavior

This is a **security-critical bugfix** that must be resolved immediately to prevent unauthorized access to user data.

## Glossary

- **Service_Worker**: A background script that can intercept network requests and cache responses
- **Cache_Control_Header**: HTTP header that controls caching behavior
- **Vary_Header**: HTTP header that tells caches to store separate versions based on request headers
- **ETag**: HTTP header used for conditional requests and cache revalidation
- **nginx**: Web server and reverse proxy serving the frontend application
- **Stale_Cache**: Cached data that is outdated or belongs to a different user
- **Cross_User_Data_Leakage**: Security vulnerability where one user sees another user's data
- **Cache_Buster**: Query parameter added to URLs to force fresh requests
- **Hard_Reset**: Complete page reload that clears all JavaScript state

## Requirements

### Requirement 1: Service Worker API Exclusion

**User Story:** As a system administrator, I want to ensure the service worker never caches API responses, so that users always receive fresh, authenticated data.

#### Acceptance Criteria

1. THE Web_App service worker SHALL NOT cache any requests to `/api/**` endpoints
2. THE Web_App service worker SHALL use `NetworkOnly` strategy for all API requests
3. THE Web_App service worker SHALL NOT apply `CacheFirst`, `StaleWhileRevalidate`, or `NetworkFirst` strategies to API routes
4. WHEN the service worker intercepts a fetch request to an API endpoint, THE service worker SHALL pass the request through without caching
5. THE Web_App service worker SHALL explicitly exclude API routes from all caching strategies
6. THE Web_App service worker configuration SHALL be verifiable in browser DevTools → Application → Service Workers
7. THE Web_App service worker cache storage SHALL NOT contain any entries for API endpoints
8. WHEN tested on mobile Safari and Chrome, API requests SHALL bypass the service worker cache

### Requirement 2: Backend API Cache Headers

**User Story:** As a backend developer, I want all authenticated API responses to include proper cache-control headers, so that browsers and proxies never cache user-specific data.

#### Acceptance Criteria

1. ALL authenticated API responses SHALL include `Cache-Control: no-store, no-cache, must-revalidate, private` header
2. ALL authenticated API responses SHALL include `Pragma: no-cache` header for HTTP/1.0 compatibility
3. ALL authenticated API responses SHALL include `Expires: 0` header
4. ALL authenticated API responses SHALL include `Vary: Authorization, Cookie` header
5. THE `Vary` header SHALL ensure separate cache entries for different authentication contexts
6. THE cache headers SHALL be present on all HTTP status codes (200, 304, 401, 403, 404, 500)
7. THE cache headers SHALL be applied to all API endpoints under `/api/**`
8. THE cache headers SHALL prevent mobile browsers from reusing responses across different users
9. WHEN a user logs out and logs in as a different user, THE browser SHALL NOT serve cached responses from the previous user

### Requirement 3: nginx Caching Configuration

**User Story:** As a DevOps engineer, I want nginx to never cache API responses, so that all API requests reach the backend with proper authentication.

#### Acceptance Criteria

1. THE nginx configuration SHALL disable proxy caching for all `/api/**` locations
2. THE nginx configuration SHALL include `proxy_no_cache 1` directive for API routes
3. THE nginx configuration SHALL include `proxy_cache_bypass 1` directive for API routes
4. THE nginx configuration SHALL add `Cache-Control: no-store, no-cache, must-revalidate, private` header with `always` flag
5. THE `always` flag SHALL ensure headers are applied to 304 Not Modified responses
6. THE nginx configuration SHALL NOT include global `proxy_cache` directives that affect API routes
7. THE nginx configuration SHALL NOT include `fastcgi_cache` directives for API routes
8. THE nginx configuration SHALL NOT include `expires` directives for API routes
9. WHEN nginx receives an API request, THE request SHALL be forwarded to the backend without caching
10. WHEN nginx receives an API response, THE response SHALL be sent to the client without caching

### Requirement 4: Conditional Request Disabling

**User Story:** As a backend developer, I want to disable ETag and Last-Modified headers for user-specific APIs, so that mobile browsers cannot revalidate and reuse stale cached responses.

#### Acceptance Criteria

1. THE backend API SHALL NOT include `ETag` headers in responses for authenticated endpoints
2. THE backend API SHALL NOT include `Last-Modified` headers in responses for authenticated endpoints
3. THE nginx configuration SHALL include `etag off` directive for API routes
4. WHEN a mobile browser sends a conditional request (If-None-Match, If-Modified-Since), THE backend SHALL respond with a full 200 response instead of 304
5. THE removal of conditional request headers SHALL prevent mobile browsers from reusing cached responses via revalidation
6. THE backend SHALL still support conditional requests for public, non-authenticated resources (static assets)

### Requirement 5: Client-Side Cache Busting

**User Story:** As a frontend developer, I want to add cache-busting mechanisms to API requests during the diagnostic phase, so that I can confirm caching is the root cause of the issue.

#### Acceptance Criteria

1. THE Web_App SHALL provide a diagnostic mode that adds timestamp query parameters to API requests
2. WHEN diagnostic mode is enabled, THE Web_App SHALL append `?_t=${Date.now()}` to all API URLs
3. THE Web_App SHALL include `cache: 'no-store'` option in all fetch requests to API endpoints
4. THE diagnostic cache busting SHALL be implemented as a temporary measure to confirm the issue
5. WHEN cache busting is enabled and the issue is resolved, THE root cause SHALL be confirmed as caching
6. THE cache busting mechanism SHALL be removable once proper cache headers are in place
7. THE Web_App SHALL log cache-busting activity to the console for debugging purposes

### Requirement 6: Logout State Clearing

**User Story:** As a user, I want all cached data to be cleared when I log out, so that the next user cannot see my data.

#### Acceptance Criteria

1. WHEN a user logs out, THE Web_App SHALL clear all React Query caches
2. WHEN a user logs out, THE Web_App SHALL clear all localStorage data except service worker registration
3. WHEN a user logs out, THE Web_App SHALL clear all sessionStorage data
4. WHEN a user logs out, THE Web_App SHALL perform a hard navigation to the login page using `window.location.href = '/login'`
5. THE hard navigation SHALL force a complete page reload and clear all JavaScript state
6. THE Web_App SHALL NOT rely on client-side routing for logout navigation
7. WHEN a user logs out on a mobile browser, THE browser SHALL not preserve any cached API responses
8. WHEN a new user logs in after logout, THE Web_App SHALL fetch fresh data from the backend
9. THE logout process SHALL be tested specifically on mobile Safari and Chrome

### Requirement 7: Service Worker Debugging and Unregistration

**User Story:** As a developer, I want tools to debug and unregister the service worker, so that I can test the application without service worker interference.

#### Acceptance Criteria

1. THE Web_App SHALL provide a debug page or console command to unregister the service worker
2. THE debug page SHALL display the current service worker registration status
3. THE debug page SHALL display all cached entries in the service worker cache storage
4. THE debug page SHALL provide a button to clear all service worker caches
5. THE debug page SHALL provide a button to unregister the service worker
6. WHEN the service worker is unregistered, THE Web_App SHALL continue to function normally
7. THE debug page SHALL be accessible at `/debug/service-worker` or via console command
8. THE debug tools SHALL help developers verify that API routes are not cached

### Requirement 8: Mobile Browser Testing

**User Story:** As a QA engineer, I want a comprehensive test plan for mobile browsers, so that I can verify the caching fix works correctly on all affected platforms.

#### Acceptance Criteria

1. THE caching fix SHALL be tested on mobile Safari (iOS)
2. THE caching fix SHALL be tested on mobile Chrome (Android)
3. THE caching fix SHALL be tested on mobile Chrome (iOS)
4. THE test plan SHALL include the following scenario:
   - User A logs in and views their data
   - User A logs out
   - User B logs in on the same device
   - User B SHALL see only their own data, not User A's data
5. THE test plan SHALL verify that API responses include correct cache headers using browser DevTools
6. THE test plan SHALL verify that the service worker does not cache API responses
7. THE test plan SHALL verify that nginx does not cache API responses
8. THE test plan SHALL include testing with airplane mode to verify offline behavior
9. THE test plan SHALL include testing with slow network conditions to verify caching behavior

### Requirement 9: Validation Checklist

**User Story:** As a developer, I want a validation checklist to confirm all caching issues are resolved, so that I can be confident the fix is complete.

#### Acceptance Criteria

1. THE validation checklist SHALL verify service worker does NOT cache `/api/**`
2. THE validation checklist SHALL verify API responses include `Cache-Control: no-store, no-cache, must-revalidate, private`
3. THE validation checklist SHALL verify API responses include `Vary: Authorization, Cookie`
4. THE validation checklist SHALL verify nginx caching is disabled for APIs
5. THE validation checklist SHALL verify ETag and Last-Modified headers are disabled for APIs
6. THE validation checklist SHALL verify client state is cleared on logout
7. THE validation checklist SHALL verify hard navigation occurs on logout
8. THE validation checklist SHALL verify cross-user data leakage does not occur on mobile browsers
9. THE validation checklist SHALL be completed before the fix is considered production-ready

## Success Criteria

The bugfix is considered successful when:

1. No cross-user data leakage occurs on mobile browsers after logout and re-login
2. All API responses include proper cache-control headers
3. Service worker does not cache any API responses
4. nginx does not cache any API responses
5. Mobile browser testing confirms fresh data is always fetched after login
6. Validation checklist is 100% complete

## Out of Scope

- Caching optimization for static assets (this is a bugfix, not an optimization)
- Service worker implementation for offline functionality (focus is on fixing the bug)
- Performance improvements (focus is on correctness and security)

## Dependencies

- Backend API package (for cache header implementation)
- nginx configuration (for proxy cache disabling)
- Web frontend package (for service worker and logout fixes)

## Risks

- **High Risk**: If not fixed immediately, users may continue to see other users' data, violating privacy and security
- **Medium Risk**: Disabling all caching may impact performance, but correctness is more important
- **Low Risk**: Service worker changes may affect offline functionality if not implemented carefully
