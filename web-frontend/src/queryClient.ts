import { QueryClient } from '@tanstack/react-query';

// Export queryClient so it can be accessed by services (e.g., for clearing cache on logout)
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
        },
    },
});
