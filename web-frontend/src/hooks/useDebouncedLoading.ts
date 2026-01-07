import { useState, useEffect } from 'react';

/**
 * Custom hook that debounces a loading state to prevent flicker from quick requests.
 * The loading indicator will only appear if the loading state persists for at least the specified delay.
 * 
 * @param isLoading - The actual loading state from the query
 * @param delay - Delay in milliseconds before showing loading indicator (default: 500ms)
 * @returns Debounced loading state
 */
export function useDebouncedLoading(isLoading: boolean, delay: number = 500): boolean {
  const [debouncedLoading, setDebouncedLoading] = useState(false);

  useEffect(() => {
    if (isLoading) {
      // Set a timer to show loading indicator after delay
      const timer = setTimeout(() => {
        setDebouncedLoading(true);
      }, delay);

      // Cleanup timer if loading completes before delay
      return () => clearTimeout(timer);
    } else {
      // Immediately hide loading indicator when loading completes
      setDebouncedLoading(false);
    }
  }, [isLoading, delay]);

  return debouncedLoading;
}
