# Implementation Plan: SPA Atomic Upgrade System

## Overview

This implementation plan converts the atomic upgrade design into discrete coding tasks. The approach is incremental: set up dependencies and configuration first, implement the service worker with immediate activation and precaching, build the client-side upgrade handler with reload guards, integrate everything into the application, remove legacy retry logic, and finally add comprehensive tests.

Each task builds on previous work, with checkpoints to validate functionality. The implementation uses TypeScript throughout for type safety.

## Tasks

- [x] 1. Install dependencies and configure build system
  - Install vite-plugin-pwa for Workbox integration
  - Install workbox-core and workbox-precaching
  - Configure Vite to use injectManifest strategy
  - Configure TypeScript for service worker compilation
  - Verify build generates Workbox manifest
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 7.1, 7.2, 7.3, 7.4_

- [x] 2. Implement TypeScript service worker with immediate activation
  - [x] 2.1 Create src/service-worker.ts with TypeScript types
    - Define ServiceWorkerGlobalScope types
    - Define Workbox manifest types
    - Define upgrade message interface
    - _Requirements: 15.1, 15.3, 15.4_
  
  - [x] 2.2 Implement immediate activation logic
    - Import clientsClaim from workbox-core
    - Call self.skipWaiting() at top level
    - Call clientsClaim() at top level
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.3 Implement precaching with Workbox manifest
    - Import precacheAndRoute from workbox-precaching
    - Call precacheAndRoute(__WB_MANIFEST)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 2.4 Write property test for complete precaching
    - **Property 1: Complete Precaching**
    - **Validates: Requirements 2.1**
  
  - [x] 2.5 Implement cache cleanup during activation
    - Add activate event listener
    - Retrieve all cache keys using caches.keys()
    - Filter to keep only workbox-precache and workbox-runtime caches
    - Delete all other caches
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 2.6 Write property test for cache cleanup completeness
    - **Property 2: Cache Cleanup Completeness**
    - **Validates: Requirements 3.2, 3.3**
  
  - [ ]* 2.7 Write property test for cache cleanup ordering
    - **Property 3: Cache Cleanup Ordering**
    - **Validates: Requirements 3.4**
  
  - [x] 2.8 Implement client notification broadcasting
    - In activate event, get all window clients using self.clients.matchAll()
    - Post message { type: 'NEW_VERSION_READY' } to each client
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 2.9 Write property test for universal client notification
    - **Property 4: Universal Client Notification**
    - **Validates: Requirements 4.2**

- [x] 3. Checkpoint - Verify service worker compiles and builds
  - Ensure TypeScript compiles without errors
  - Ensure Vite build generates sw.js with Workbox manifest
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement client-side upgrade handler
  - [x] 4.1 Create src/swUpgradeHandler.ts with TypeScript types
    - Define ServiceWorkerMessage interface
    - Define UpgradeHandler interface
    - Define RELOAD_FLAG constant
    - _Requirements: 15.2_
  
  - [x] 4.2 Implement reload guard functions
    - Implement shouldReload() to check session storage
    - Implement markReloaded() to set session storage flag
    - Add try-catch for session storage errors
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 4.3 Write property test for reload guard behavior
    - **Property 5: Reload Guard Behavior**
    - **Validates: Requirements 5.3, 5.4, 5.5**
  
  - [ ]* 4.4 Write property test for single reload per tab
    - **Property 6: Single Reload Per Tab**
    - **Validates: Requirements 6.5**
  
  - [x] 4.5 Implement handleUpgrade function
    - Check shouldReload()
    - If true, call markReloaded() and window.location.reload()
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 4.6 Implement register function with event listeners
    - Check if navigator.serviceWorker exists
    - Add message event listener for NEW_VERSION_READY
    - Add controllerchange event listener as backup
    - Call handleUpgrade when upgrade detected
    - _Requirements: 5.1, 5.2, 5.6_
  
  - [x]* 4.7 Write unit tests for upgrade handler
    - Test shouldReload returns correct values
    - Test markReloaded sets session storage
    - Test handleUpgrade triggers reload when guard not set
    - Test handleUpgrade does not reload when guard is set
    - Test message listener registration
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 5. Integrate service worker and upgrade handler into application
  - [x] 5.1 Create service worker registration function in main.tsx
    - Check if service workers are supported
    - Register /sw.js in production mode only
    - Log registration success/failure
    - _Requirements: 12.1, 12.2_
  
  - [x] 5.2 Initialize upgrade handler before React renders
    - Import registerSWUpgradeHandler
    - Call registerServiceWorker() before createRoot
    - Call registerSWUpgradeHandler() before createRoot
    - Ensure initialization order is correct
    - _Requirements: 5.6, 12.3, 12.4_
  
  - [ ]* 5.3 Write integration test for initialization order
    - Test service worker registration happens first
    - Test upgrade handler initialization happens before React
    - _Requirements: 5.6, 12.4_

- [x] 6. Checkpoint - Test basic upgrade flow
  - Build and deploy version A
  - Open application in browser
  - Build and deploy version B
  - Verify page reloads once automatically
  - Verify new version loads
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Remove legacy chunk retry logic
  - [x] 7.1 Search and remove lazyWithRetry wrappers
    - Search codebase for "lazyWithRetry"
    - Remove all wrapper functions
    - Update imports to use standard React.lazy
    - _Requirements: 9.1_
  
  - [x] 7.2 Search and remove dynamic import retry handlers
    - Search codebase for dynamic import retry logic
    - Remove retry wrappers around import() calls
    - _Requirements: 9.2_
  
  - [x] 7.3 Search and remove global unhandledrejection handlers
    - Search for window.addEventListener('unhandledrejection')
    - Remove reload logic from rejection handlers
    - Keep error logging if needed
    - _Requirements: 9.3_
  
  - [ ]* 7.4 Write unit tests to verify legacy code removal
    - Test that lazyWithRetry is not present
    - Test that retry handlers are not present
    - Test that unhandledrejection reload logic is not present
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 8. Add property-based tests for atomic upgrade guarantees
  - [ ]* 8.1 Write property test for multi-tab race condition prevention
    - **Property 7: Multi-Tab Race Condition Prevention**
    - **Validates: Requirements 10.3**
  
  - [ ]* 8.2 Write property test for version consistency across tabs
    - **Property 8: Version Consistency Across Tabs**
    - **Validates: Requirements 10.4**
  
  - [ ]* 8.3 Write property test for no partial stale bundles
    - **Property 9: No Partial Stale Bundles**
    - **Validates: Requirements 13.1**
  
  - [ ]* 8.4 Write property test for no lazy chunk 404 failures
    - **Property 10: No Lazy Chunk 404 Failures**
    - **Validates: Requirements 13.2**
  
  - [ ]* 8.5 Write property test for old asset deletion safety
    - **Property 11: Old Asset Deletion Safety**
    - **Validates: Requirements 13.6**

- [ ] 9. Add property-based tests for offline functionality
  - [ ]* 9.1 Write property test for offline asset serving
    - **Property 12: Offline Asset Serving**
    - **Validates: Requirements 14.1**
  
  - [ ]* 9.2 Write property test for offline-to-online upgrade flow
    - **Property 13: Offline-to-Online Upgrade Flow**
    - **Validates: Requirements 14.3**
  
  - [ ]* 9.3 Write property test for offline transition data integrity
    - **Property 14: Offline Transition Data Integrity**
    - **Validates: Requirements 14.4**

- [ ] 10. Add unit tests for error handling
  - [ ]* 10.1 Write unit test for service worker registration failure
    - Test graceful degradation when registration fails
    - Test error logging
    - Test application continues without SW
  
  - [ ]* 10.2 Write unit test for service worker activation failure
    - Test error handling in activate event
    - Test that errors are logged
  
  - [ ]* 10.3 Write unit test for precache failure
    - Test that installation fails if precaching fails
    - Test that old SW remains active
  
  - [ ]* 10.4 Write unit test for reload guard corruption
    - Test fallback behavior when session storage unavailable
    - Test that reload is allowed as fallback
  
  - [ ]* 10.5 Write unit test for message delivery failure
    - Test controllerchange event as backup
    - Test upgrade still occurs without message
  
  - [ ]* 10.6 Write unit test for quota exceeded error
    - Test error handling during precaching
    - Test cache cleanup on quota error

- [x] 11. Configure HTTP cache headers
  - [x] 11.1 Document cache header requirements
    - Create documentation for index.html cache headers (no-cache)
    - Create documentation for asset cache headers (immutable, max-age=31536000)
    - Provide examples for nginx, CloudFront, and other CDNs
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 11.2 Write integration test for cache headers
    - Test that index.html has no-cache header
    - Test that JS/CSS assets have immutable headers
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12. Final checkpoint - Comprehensive testing
  - Run all unit tests and property tests
  - Perform manual testing for all scenarios:
    - Basic upgrade (single tab)
    - Multi-tab upgrade
    - Offline upgrade
    - Old asset deletion
    - Lazy loading after upgrade
    - Reload guard persistence
  - Verify no console errors
  - Verify no infinite reload loops
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- All code is written in TypeScript for type safety
- Service worker uses Workbox for battle-tested caching strategies
- Reload guard uses session storage to prevent infinite loops
- Multi-tab safety is guaranteed through broadcast messages and independent reload guards
