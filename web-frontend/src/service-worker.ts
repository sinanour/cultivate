/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

// Declare service worker global scope
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision: string | null;
  }>;
};

// Upgrade message interface
interface UpgradeMessage {
  type: 'NEW_VERSION_READY';
}

// Immediate activation - force new service worker to activate immediately
self.skipWaiting();

// Take control of all clients immediately upon activation
clientsClaim();

// Precache all build assets from the Workbox manifest
// This ensures all hashed assets are cached during installation
precacheAndRoute(self.__WB_MANIFEST);

// Listen for activation event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Delete old caches during activation
        const cacheNames = await caches.keys();
        
        // Keep only Workbox-managed caches (precache and runtime)
        const cachesToDelete = cacheNames.filter((cacheName) => {
          return (
            !cacheName.includes('workbox-precache') &&
            !cacheName.includes('workbox-runtime')
          );
        });
        
        // Delete all other caches
        await Promise.all(
          cachesToDelete.map((cacheName) => caches.delete(cacheName))
        );
        
        // Broadcast upgrade notification to all clients
        const clients = await self.clients.matchAll({ type: 'window' });
        const message: UpgradeMessage = { type: 'NEW_VERSION_READY' };
        
        clients.forEach((client) => {
          client.postMessage(message);
        });
      } catch (error) {
        console.error('Service worker activation failed:', error);
        throw error;
      }
    })()
  );
});
