import { useState, useEffect } from 'react';
import {
    Container,
    Header,
    Button,
    SpaceBetween,
    Box,
    Alert,
    ColumnLayout,
} from '@cloudscape-design/components';

/**
 * Service Worker Debug Page
 * 
 * Provides tools to inspect and control service worker behavior.
 * Useful for diagnosing caching issues, especially on mobile browsers.
 * 
 * Features:
 * - View service worker registration status
 * - List all cache storage entries
 * - Inspect each cache for API URLs (which should NOT be cached)
 * - Unregister service worker
 * - Clear all caches
 */
export default function ServiceWorkerDebugPage() {
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [caches, setCaches] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiUrlsFound, setApiUrlsFound] = useState<string[]>([]);

    useEffect(() => {
        loadServiceWorkerInfo();
    }, []);

    async function loadServiceWorkerInfo() {
        setLoading(true);
        try {
            // Get service worker registration
            const reg = await navigator.serviceWorker.getRegistration();
            setRegistration(reg || null);

            // List all caches
            const cacheNames = await window.caches.keys();
            setCaches(cacheNames);

            // Check all caches for API URLs
            const foundApiUrls: string[] = [];
            for (const cacheName of cacheNames) {
                const cache = await window.caches.open(cacheName);
                const requests = await cache.keys();
                const urls = requests.map((req) => req.url);
                const apiUrls = urls.filter((url) => url.includes('/api/'));
                foundApiUrls.push(...apiUrls);
            }
            setApiUrlsFound(foundApiUrls);
        } catch (error) {
            console.error('Failed to load service worker info:', error);
        } finally {
            setLoading(false);
        }
    }

    async function unregisterServiceWorker() {
        if (registration) {
            await registration.unregister();
            alert('Service worker unregistered. Reload the page to see changes.');
            setRegistration(null);
        }
    }

    async function clearAllCaches() {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
        alert('All caches cleared.');
        setCaches([]);
        setApiUrlsFound([]);
    }

    async function inspectCache(cacheName: string) {
        const cache = await window.caches.open(cacheName);
        const requests = await cache.keys();
        const urls = requests.map((req) => req.url);
        const apiUrls = urls.filter((url) => url.includes('/api/'));

        if (apiUrls.length > 0) {
            alert(`⚠️ WARNING: ${apiUrls.length} API URLs found in cache "${cacheName}"!\n\n${apiUrls.slice(0, 10).join('\n')}${apiUrls.length > 10 ? `\n... and ${apiUrls.length - 10} more` : ''}`);
        } else {
            alert(`✓ No API URLs in cache "${cacheName}"`);
        }
    }

    return (
        <Container
            header={
                <Header
                    variant="h1"
                    description="Debug tools for inspecting and controlling service worker behavior"
                >
                    Service Worker Debug
                </Header>
            }
        >
            <SpaceBetween size="l">
                {apiUrlsFound.length > 0 && (
                    <Alert type="error" header="API URLs Found in Cache!">
                        <strong>CRITICAL:</strong> {apiUrlsFound.length} API URLs are being cached by the service worker.
                        This can cause cross-user data leakage on mobile browsers.
                        <br />
                        <br />
                        First 10 URLs:
                        <ul>
                            {apiUrlsFound.slice(0, 10).map((url) => (
                                <li key={url} style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                                    {url}
                                </li>
                            ))}
                        </ul>
                        {apiUrlsFound.length > 10 && <div>... and {apiUrlsFound.length - 10} more</div>}
                    </Alert>
                )}

                {apiUrlsFound.length === 0 && !loading && (
                    <Alert type="success" header="No API URLs in Cache">
                        ✓ Service worker is correctly configured. No API URLs found in cache storage.
                    </Alert>
                )}

                <ColumnLayout columns={2}>
                    <Box>
                        <SpaceBetween size="s">
                            <Box variant="h3">Service Worker Status</Box>
                            <Box>
                                <strong>Status:</strong>{' '}
                                {loading ? 'Loading...' : registration ? '✓ Registered' : '✗ Not Registered'}
                            </Box>
                            {registration && (
                                <>
                                    <Box>
                                        <strong>State:</strong> {registration.active?.state || 'Unknown'}
                                    </Box>
                                    <Box>
                                        <strong>Scope:</strong> {registration.scope}
                                    </Box>
                                    <Button onClick={unregisterServiceWorker} variant="primary">
                                        Unregister Service Worker
                                    </Button>
                                </>
                            )}
                        </SpaceBetween>
                    </Box>

                    <Box>
                        <SpaceBetween size="s">
                            <Box variant="h3">Cache Storage</Box>
                            <Box>
                                <strong>Total Caches:</strong> {caches.length}
                            </Box>
                            {caches.length > 0 && (
                                <Button onClick={clearAllCaches} variant="normal">
                                    Clear All Caches
                                </Button>
                            )}
                        </SpaceBetween>
                    </Box>
                </ColumnLayout>

                {caches.length > 0 && (
                    <Box>
                        <SpaceBetween size="m">
                            <Box variant="h3">Cache Entries</Box>
                            {caches.map((cacheName) => (
                                <Box key={cacheName}>
                                    <SpaceBetween direction="horizontal" size="s">
                                        <Box>
                                            <strong>{cacheName}</strong>
                                        </Box>
                                        <Button onClick={() => inspectCache(cacheName)} variant="normal">
                                            Inspect for API URLs
                                        </Button>
                                    </SpaceBetween>
                                </Box>
                            ))}
                        </SpaceBetween>
                    </Box>
                )}

                <Box>
                    <SpaceBetween size="s">
                        <Box variant="h3">Instructions</Box>
                        <Box>
                            <ol>
                                <li>Check if service worker is registered</li>
                                <li>Inspect each cache for API URLs (should be none)</li>
                                <li>If API URLs are found, the service worker needs to be fixed</li>
                                <li>After fixing, unregister the service worker and reload</li>
                                <li>Verify no API URLs appear in cache after using the app</li>
                            </ol>
                        </Box>
                    </SpaceBetween>
                </Box>

                <Button onClick={loadServiceWorkerInfo} variant="normal">
                    Refresh Status
                </Button>
            </SpaceBetween>
        </Container>
    );
}
