import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _internal, registerSWUpgradeHandler } from '../swUpgradeHandler';

const { shouldReload, markReloaded, handleUpgrade, RELOAD_FLAG } = _internal;

describe('swUpgradeHandler', () => {
  beforeEach(() => {
    // Clear session storage before each test
    sessionStorage.clear();
    // Reset window.location.reload mock
    vi.stubGlobal('location', { reload: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('shouldReload', () => {
    it('should return true when reload flag is not set', () => {
      expect(shouldReload()).toBe(true);
    });

    it('should return false when reload flag is set', () => {
      sessionStorage.setItem(RELOAD_FLAG, 'true');
      expect(shouldReload()).toBe(false);
    });

    it('should return true as fallback when session storage is unavailable', () => {
      // Mock session storage to throw error
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = vi.fn(() => {
        throw new Error('Session storage unavailable');
      });

      expect(shouldReload()).toBe(true);

      // Restore original
      sessionStorage.getItem = originalGetItem;
    });
  });

  describe('markReloaded', () => {
    it('should set reload flag in session storage', () => {
      markReloaded();
      expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('true');
    });

    it('should handle session storage errors gracefully', () => {
      // Mock session storage to throw error
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn(() => {
        throw new Error('Session storage unavailable');
      });

      // Should not throw
      expect(() => markReloaded()).not.toThrow();

      // Restore original
      sessionStorage.setItem = originalSetItem;
    });
  });

  describe('handleUpgrade', () => {
    it('should trigger reload when guard is not set', () => {
      handleUpgrade();
      
      expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('true');
      expect(window.location.reload).toHaveBeenCalledOnce();
    });

    it('should not reload when guard is already set', () => {
      sessionStorage.setItem(RELOAD_FLAG, 'true');
      
      handleUpgrade();
      
      expect(window.location.reload).not.toHaveBeenCalled();
    });
  });

  describe('registerSWUpgradeHandler', () => {
    it('should register message listener', () => {
      const addEventListenerSpy = vi.fn();
      
      // Mock navigator.serviceWorker
      vi.stubGlobal('navigator', {
        serviceWorker: {
          addEventListener: addEventListenerSpy,
        },
      });

      registerSWUpgradeHandler();

      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('controllerchange', expect.any(Function));
    });

    it('should not register when service workers are not supported', () => {
      vi.stubGlobal('navigator', {});

      // Should not throw
      expect(() => registerSWUpgradeHandler()).not.toThrow();
    });

    it('should handle NEW_VERSION_READY message', () => {
      let messageHandler: ((event: MessageEvent) => void) | undefined;
      
      const addEventListenerSpy = vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      vi.stubGlobal('navigator', {
        serviceWorker: {
          addEventListener: addEventListenerSpy,
        },
      });

      registerSWUpgradeHandler();

      // Simulate message event
      if (messageHandler) {
        messageHandler({ data: { type: 'NEW_VERSION_READY' } } as MessageEvent);
      }

      expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('true');
      expect(window.location.reload).toHaveBeenCalledOnce();
    });

    it('should handle controllerchange event', () => {
      let controllerChangeHandler: (() => void) | undefined;
      
      const addEventListenerSpy = vi.fn((event: string, handler: () => void) => {
        if (event === 'controllerchange') {
          controllerChangeHandler = handler;
        }
      });
      
      vi.stubGlobal('navigator', {
        serviceWorker: {
          addEventListener: addEventListenerSpy,
        },
      });

      registerSWUpgradeHandler();

      // Simulate controllerchange event
      if (controllerChangeHandler) {
        controllerChangeHandler();
      }

      expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('true');
      expect(window.location.reload).toHaveBeenCalledOnce();
    });
  });
});
