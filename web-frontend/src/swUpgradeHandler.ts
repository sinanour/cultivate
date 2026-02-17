/**
 * Service Worker Upgrade Handler
 * 
 * Handles automatic page reloads when a new service worker version is available.
 * Uses session storage to prevent infinite reload loops.
 */

// Service worker message interface
interface ServiceWorkerMessage {
    type: string;
    [key: string]: unknown;
}

// Upgrade handler interface
export interface UpgradeHandler {
    register(): void;
    handleUpgrade(): void;
    shouldReload(): boolean;
    markReloaded(): void;
}

// Session storage key for reload guard
const RELOAD_FLAG = 'app-version-reload';

/**
 * Check if a reload has already occurred in this tab session
 */
function shouldReload(): boolean {
    try {
        return sessionStorage.getItem(RELOAD_FLAG) === null;
    } catch (error) {
        console.warn('Session storage unavailable:', error);
        // Fallback: allow reload if session storage is unavailable
        return true;
    }
}

/**
 * Mark that a reload has occurred in this tab session
 */
function markReloaded(): void {
    try {
        sessionStorage.setItem(RELOAD_FLAG, 'true');
    } catch (error) {
        console.warn('Failed to set reload guard:', error);
    }
}

/**
 * Handle upgrade notification from service worker
 * Reloads the page exactly once per tab session
 */
function handleUpgrade(): void {
    if (shouldReload()) {
        markReloaded();
        window.location.reload();
    }
}

/**
 * Register service worker upgrade handler
 * Call this before rendering React to ensure upgrade handling is active
 */
export function registerSWUpgradeHandler(): void {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        return;
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data as ServiceWorkerMessage;

        if (data.type === 'NEW_VERSION_READY') {
            handleUpgrade();
        }
    });

    // Listen for controller changes as backup mechanism
    // This ensures upgrade still occurs even if message delivery fails
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Controller changed, new SW is active
        // The message should arrive shortly, but this provides a backup
        if (shouldReload()) {
            markReloaded();
            window.location.reload();
        }
    });
}

// Export functions for testing
export const _internal = {
    shouldReload,
    markReloaded,
    handleUpgrade,
    RELOAD_FLAG,
};
