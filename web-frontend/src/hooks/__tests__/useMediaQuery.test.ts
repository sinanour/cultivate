import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
    beforeEach(() => {
        // Reset matchMedia mock before each test
        vi.clearAllMocks();
    });

    it('should return false when media query does not match', () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
        expect(result.current).toBe(false);
    });

    it('should return true when media query matches', () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: true,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
        expect(result.current).toBe(true);
    });

    it('should update when media query match changes', async () => {
        let listener: ((event: MediaQueryListEvent) => void) | null = null;

        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn((event, handler) => {
                if (event === 'change') {
                    listener = handler;
                }
            }),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result, rerender } = renderHook(() => useMediaQuery('(max-width: 767px)'));
        expect(result.current).toBe(false);

        // Simulate media query change
        if (listener) {
            listener({ matches: true, media: '(max-width: 767px)' } as MediaQueryListEvent);
            rerender();
        }

        expect(result.current).toBe(true);
    });

    it('should clean up event listener on unmount', () => {
        const removeEventListener = vi.fn();

        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener,
            dispatchEvent: vi.fn(),
        }));

        const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));
        unmount();

        expect(removeEventListener).toHaveBeenCalled();
    });
});
