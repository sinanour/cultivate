import { type ReactNode } from 'react';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { Spinner } from '@cloudscape-design/components';

interface PullToRefreshWrapperProps {
    children: ReactNode;
    onRefresh: () => Promise<void>;
    disabled?: boolean;
    className?: string;
}

/**
 * Wrapper component that adds pull-to-refresh functionality to any page
 * 
 * @param children - The page content to wrap
 * @param onRefresh - Async function to call when refresh is triggered
 * @param disabled - Whether to disable pull-to-refresh (e.g., when not at top of page)
 * @param className - Optional CSS class name
 * 
 * @example
 * ```tsx
 * <PullToRefreshWrapper onRefresh={handleRefresh}>
 *   <ParticipantList />
 * </PullToRefreshWrapper>
 * ```
 */
export function PullToRefreshWrapper({
    children,
    onRefresh,
    disabled = false,
    className
}: PullToRefreshWrapperProps) {
    // Custom loading indicator using CloudScape Spinner
    const pullingContent = (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '20px',
            minHeight: '60px',
            alignItems: 'center'
        }}>
            <Spinner size="normal" />
        </div>
    );

    const refreshingContent = (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '20px',
            minHeight: '60px',
            alignItems: 'center'
        }}>
            <Spinner size="normal" />
            <span style={{ marginLeft: '10px' }}>Refreshing...</span>
        </div>
    );

    if (disabled) {
        // When disabled, just render children without pull-to-refresh
        return <div className={className}>{children}</div>;
    }

    return (
        <PullToRefresh
            onRefresh={onRefresh}
            pullingContent={pullingContent}
            refreshingContent={refreshingContent}
            pullDownThreshold={80}
            maxPullDownDistance={120}
            resistance={2}
            className={className}
        >
            <>{children}</>
        </PullToRefresh>
    );
}
