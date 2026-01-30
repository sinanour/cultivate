import { useState, useEffect } from 'react';

/**
 * Custom hook to detect media query matches
 * @param query - CSS media query string (e.g., '(max-width: 767px)')
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        // Initialize with current match state
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia(query);

        // Update state if initial value was different
        setMatches(mediaQuery.matches);

        // Create event listener for changes
        const handleChange = (event: MediaQueryListEvent) => {
            setMatches(event.matches);
        };

        // Add listener (use deprecated addListener for older browsers as fallback)
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            // @ts-ignore - fallback for older browsers
            mediaQuery.addListener(handleChange);
        }

        // Cleanup
        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleChange);
            } else {
                // @ts-ignore - fallback for older browsers
                mediaQuery.removeListener(handleChange);
            }
        };
    }, [query]);

    return matches;
}
