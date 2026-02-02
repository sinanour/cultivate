import type { UserRole } from '../../types/auth.types';

interface Venue {
    id: string;
    name: string | null;
    address: string;
    geographicAreaId?: string;
}

interface VenueDisplayProps {
    venue: Venue;
    currentUserRole: UserRole;
    className?: string;
}

/**
 * Role-aware component for displaying venue names.
 * For PII_RESTRICTED users, displays address instead of name.
 * For other users, displays name with address as fallback.
 */
export function VenueDisplay({
    venue,
    currentUserRole,
    className,
}: VenueDisplayProps) {
    if (!venue) return null;

    // For PII_RESTRICTED users, always display address
    if (currentUserRole === 'PII_RESTRICTED') {
        return <span className={className}>{venue.address}</span>;
    }

    // For other users, display name or address as fallback
    const displayName = venue.name || venue.address;
    return <span className={className}>{displayName}</span>;
}
