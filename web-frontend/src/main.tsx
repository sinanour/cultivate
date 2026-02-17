import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@cloudscape-design/global-styles/index.css'
import './index.css'
import App from './App.tsx'
import { registerSWUpgradeHandler } from './swUpgradeHandler'

/**
 * Register service worker for atomic version upgrades
 * Only registers in production mode
 */
async function registerServiceWorker(): Promise<void> {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Only register in production
  if (import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        type: 'module',
      });
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      // Continue without service worker - graceful degradation
    }
  }
}

// Register service worker and upgrade handler before React renders
// This ensures upgrade handling is active from the first page load
registerServiceWorker();
registerSWUpgradeHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
