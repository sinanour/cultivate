import type { UserRole } from '../../types/auth.types';

interface Participant {
    id: string;
    name: string | null;
    email?: string | null;
    phone?: string | null;
}

interface ParticipantDisplayProps {
    participant: Participant;
    currentUserRole: UserRole;
    className?: string;
}

/**
 * Role-aware component for displaying participant names.
 * For PII_RESTRICTED users, displays UUID instead of name.
 * For other users, displays name with UUID as fallback.
 */
export function ParticipantDisplay({
    participant,
    currentUserRole,
    className,
}: ParticipantDisplayProps) {
    if (!participant) return null;

    // For PII_RESTRICTED users, always display UUID
    if (currentUserRole === 'PII_RESTRICTED') {
        return <span className={className}>{participant.id}</span>;
    }

    // For other users, display name or UUID as fallback
    const displayName = participant.name || participant.id;
    return <span className={className}>{displayName}</span>;
}
