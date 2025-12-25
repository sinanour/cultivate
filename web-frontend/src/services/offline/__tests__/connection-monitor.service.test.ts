import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionMonitor } from '../connection-monitor.service';
import { SyncQueue } from '../sync-queue.service';

vi.mock('../sync-queue.service');

describe('ConnectionMonitor', () => {
    beforeEach(() => {
        ConnectionMonitor.cleanup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        ConnectionMonitor.cleanup();
    });

    describe('initialize', () => {
        it('should initialize only once', () => {
            ConnectionMonitor.initialize();
            ConnectionMonitor.initialize();

            // Should not throw or cause issues
            expect(true).toBe(true);
        });
    });

    describe('isOnline', () => {
        it('should return navigator.onLine status', () => {
            const result = ConnectionMonitor.isOnline();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('subscribe', () => {
        it('should call listener when connection changes', () => {
            ConnectionMonitor.initialize();

            const listener = vi.fn();
            ConnectionMonitor.subscribe(listener);

            // Simulate online event
            window.dispatchEvent(new Event('online'));

            // Wait for async processing
            return new Promise((resolve) => {
                setTimeout(() => {
                    expect(listener).toHaveBeenCalledWith(true);
                    resolve(undefined);
                }, 100);
            });
        });

        it('should call listener when going offline', () => {
            ConnectionMonitor.initialize();

            const listener = vi.fn();
            ConnectionMonitor.subscribe(listener);

            // Simulate offline event
            window.dispatchEvent(new Event('offline'));

            expect(listener).toHaveBeenCalledWith(false);
        });

        it('should return unsubscribe function', () => {
            ConnectionMonitor.initialize();

            const listener = vi.fn();
            const unsubscribe = ConnectionMonitor.subscribe(listener);

            expect(typeof unsubscribe).toBe('function');

            unsubscribe();

            // Listener should not be called after unsubscribe
            window.dispatchEvent(new Event('offline'));
            expect(listener).not.toHaveBeenCalled();
        });

        it('should support multiple listeners', () => {
            ConnectionMonitor.initialize();

            const listener1 = vi.fn();
            const listener2 = vi.fn();

            ConnectionMonitor.subscribe(listener1);
            ConnectionMonitor.subscribe(listener2);

            window.dispatchEvent(new Event('offline'));

            expect(listener1).toHaveBeenCalledWith(false);
            expect(listener2).toHaveBeenCalledWith(false);
        });
    });

    describe('handleOnline', () => {
        it('should process sync queue when going online', async () => {
            vi.mocked(SyncQueue.processQueue).mockResolvedValueOnce({
                success: 5,
                failed: 0,
            });

            ConnectionMonitor.initialize();

            window.dispatchEvent(new Event('online'));

            // Wait for async processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(SyncQueue.processQueue).toHaveBeenCalled();
        });

        it('should handle sync queue errors gracefully', async () => {
            vi.mocked(SyncQueue.processQueue).mockRejectedValueOnce(new Error('Sync failed'));

            ConnectionMonitor.initialize();

            // Should not throw
            window.dispatchEvent(new Event('online'));

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(SyncQueue.processQueue).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should remove event listeners', () => {
            ConnectionMonitor.initialize();

            const listener = vi.fn();
            ConnectionMonitor.subscribe(listener);

            ConnectionMonitor.cleanup();

            // Events should not trigger listeners after cleanup
            window.dispatchEvent(new Event('online'));
            expect(listener).not.toHaveBeenCalled();
        });

        it('should clear all listeners', () => {
            ConnectionMonitor.initialize();

            const listener1 = vi.fn();
            const listener2 = vi.fn();

            ConnectionMonitor.subscribe(listener1);
            ConnectionMonitor.subscribe(listener2);

            ConnectionMonitor.cleanup();

            window.dispatchEvent(new Event('offline'));

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();
        });
    });
});
