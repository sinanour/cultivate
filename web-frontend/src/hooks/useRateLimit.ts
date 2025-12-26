import { useState, useCallback } from 'react';
import {
    isRateLimitError,
    extractRateLimitInfo,
    type RateLimitInfo,
} from '../utils/rate-limit.utils';

interface UseRateLimitOptions {
    onRetry?: () => void;
}

export function useRateLimit({ onRetry }: UseRateLimitOptions = {}) {
    const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
    const [showNotification, setShowNotification] = useState(false);
    const [retryTimeoutId, setRetryTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const handleError = useCallback(
        (error: any): boolean => {
            if (isRateLimitError(error)) {
                const info = extractRateLimitInfo(error);
                if (info) {
                    setRateLimitInfo(info);
                    setShowNotification(true);
                    console.warn('Rate limit exceeded:', info);

                    // Set up automatic retry
                    if (info.retryAfterSeconds && onRetry) {
                        const timeoutId = setTimeout(() => {
                            console.log('Retrying after rate limit cooldown...');
                            setShowNotification(false);
                            setRateLimitInfo(null);
                            onRetry();
                        }, info.retryAfterSeconds * 1000);

                        setRetryTimeoutId(timeoutId);
                    }

                    return true;
                }
            }
            return false;
        },
        [onRetry]
    );

    const dismissNotification = useCallback(() => {
        setShowNotification(false);
        if (retryTimeoutId) {
            clearTimeout(retryTimeoutId);
            setRetryTimeoutId(null);
        }
    }, [retryTimeoutId]);

    const clearRateLimit = useCallback(() => {
        setRateLimitInfo(null);
        setShowNotification(false);
        if (retryTimeoutId) {
            clearTimeout(retryTimeoutId);
            setRetryTimeoutId(null);
        }
    }, [retryTimeoutId]);

    return {
        rateLimitInfo,
        showNotification,
        handleError,
        dismissNotification,
        clearRateLimit,
    };
}
