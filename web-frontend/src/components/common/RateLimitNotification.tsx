import { useEffect, useState } from 'react';
import { Flashbar, type FlashbarProps } from '@cloudscape-design/components';
import type { RateLimitInfo } from '../../utils/rate-limit.utils';
import { formatRetryAfter, getTimeUntilReset } from '../../utils/rate-limit.utils';

interface RateLimitNotificationProps {
    rateLimitInfo: RateLimitInfo | null;
    onDismiss: () => void;
}

export function RateLimitNotification({ rateLimitInfo, onDismiss }: RateLimitNotificationProps) {
    const [countdown, setCountdown] = useState<number>(0);

    useEffect(() => {
        if (!rateLimitInfo) {
            setCountdown(0);
            return;
        }

        // Initialize countdown
        const initialSeconds = rateLimitInfo.resetTimestamp
            ? getTimeUntilReset(rateLimitInfo.resetTimestamp)
            : rateLimitInfo.retryAfterSeconds || 0;
        
        setCountdown(initialSeconds);

        // Update countdown every second
        const interval = setInterval(() => {
            setCountdown((prev) => {
                const newValue = prev - 1;
                if (newValue <= 0) {
                    clearInterval(interval);
                    return 0;
                }
                return newValue;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [rateLimitInfo]);

    if (!rateLimitInfo) {
        return null;
    }

    const items: FlashbarProps.MessageDefinition[] = [
        {
            type: 'warning',
            dismissible: true,
            onDismiss,
            header: 'Rate Limit Exceeded',
            content: (
                <div>
                    <p>{rateLimitInfo.errorMessage}</p>
                    {countdown > 0 && (
                        <p>
                            <strong>Retry in: {formatRetryAfter(countdown)}</strong>
                        </p>
                    )}
                    {rateLimitInfo.limit !== undefined && (
                        <p>
                            <small>
                                Request limit: {rateLimitInfo.limit} requests
                                {rateLimitInfo.remaining !== undefined &&
                                    ` (${rateLimitInfo.remaining} remaining)`}
                            </small>
                        </p>
                    )}
                </div>
            ),
        },
    ];

    return <Flashbar items={items} />;
}
